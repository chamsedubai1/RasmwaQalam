import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import { z } from "zod";
import { generatePoem as generateOpenAIPoem, generateImage as generateOpenAIImage } from "./openai";
import { generateText as generateHuggingFaceText, generateImage as generateHuggingFaceImage } from "./huggingface";
import multer from "multer";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";
import { setupUploadRoutes, setupStaticUploads } from "./uploads";
import session from "express-session";
import { generateCaptcha, validateCaptcha, requireCaptcha, captchaStore } from "./captcha";
import crypto from "crypto";

// Set this to true to use Hugging Face (free open-source AI) instead of OpenAI
const USE_HUGGING_FACE = true;
import { 
  insertUserSchema,
  insertSchoolSchema,
  insertClassSchema,
  insertPartnerSchema,
  insertEventSchema,
  insertRegistrationSchema,
  insertSubmissionSchema,
  insertVoteSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes - all prefixed with /api
  const apiRouter = express.Router();
  
  // Auth and user-related routes
  apiRouter.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    try {
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is locked or inactive' });
      }
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Get current authenticated user
  apiRouter.get('/user', async (req, res) => {
    try {
      // Get authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const token = authHeader.split(' ')[1];
      const username = token.split(':')[0];
      
      // Find user by username
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is locked or inactive" });
      }
      
      // Return user data (excluding password)
      const { password: _, ...userData } = user;
      res.status(200).json(userData);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Server error retrieving user data" });
    }
  });
  
  // Helper function to generate and return CAPTCHA
  const handleCaptchaRequest = (req: Request, res: Response) => {
    try {
      // Get session ID - use IP address as fallback if session not available
      const sessionId = req.ip || crypto.randomBytes(16).toString('hex');
      
      // Generate new CAPTCHA
      const captcha = generateCaptcha(sessionId);
      
      // For debugging 
      console.log(`Generated CAPTCHA for ${sessionId}: ${captcha.text}`);
      
      // Store in session if available (optional)
      if (req.session) {
        req.session.captcha = {
          text: captcha.text,
          expiry: captcha.expiry
        };
        console.log(`Stored CAPTCHA in session: ${captcha.text}`);
      }
      
      // Return the SVG image (without the actual text)
      res.json({
        image: captcha.svgImage,
        expires: captcha.expiry,
        // During development, we send the text to make debugging easier
        text: process.env.NODE_ENV === 'development' ? captcha.text : undefined
      });
    } catch (error) {
      console.error('CAPTCHA generation error:', error);
      res.status(500).json({ message: 'Failed to generate CAPTCHA' });
    }
  };
  
  // CAPTCHA endpoints
  apiRouter.get('/api/captcha', handleCaptchaRequest);
  
  // Keep old endpoint for backward compatibility
  apiRouter.get('/captcha', handleCaptchaRequest);
  
  // Get current user endpoint for authentication
  apiRouter.get('/user', async (req, res) => {
    try {
      // This endpoint is used to check if a user is currently logged in
      // and to get their data for authenticated routes
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No credentials provided' });
      }
      
      // Extract username from token (simple implementation)
      const token = authHeader.split(' ')[1];
      const [username, _] = token.split(':');
      
      // Get user by username
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is locked or inactive' });
      }
      
      // Return user without password
      const { password: __, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error retrieving user:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Debug endpoint to check session
  apiRouter.get('/debug-session', (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).send('Debug endpoints only available in development mode');
    }
    
    console.log('Session ID:', req.sessionID);
    console.log('IP:', req.ip);
    console.log('Session data:', req.session);
    
    // Get CAPTCHA from session
    const sessionCaptcha = req.session?.captcha;
    
    // Get CAPTCHA from store based on IP
    const ipBasedCaptcha = captchaStore.get(req.ip || '');
    
    // Return session info
    res.json({
      sessionId: req.sessionID,
      ip: req.ip,
      sessionData: req.session,
      hasCaptchaInSession: !!sessionCaptcha,
      sessionCaptcha: sessionCaptcha ? {
        text: sessionCaptcha.text,
        expires: sessionCaptcha.expiry
      } : null,
      hasCaptchaInStore: !!ipBasedCaptcha,
      storeCaptcha: ipBasedCaptcha ? {
        text: ipBasedCaptcha.text,
        expires: ipBasedCaptcha.expiry
      } : null
    });
  });
  
  // Verify CAPTCHA without proceeding further
  apiRouter.post('/verify-captcha', (req, res) => {
    const { captchaText } = req.body;
    
    if (!captchaText) {
      return res.status(400).json({ 
        message: 'CAPTCHA text is required', 
        field: 'captchaText',
        valid: false 
      });
    }
    
    // Get session ID
    const sessionId = req.sessionID || req.ip || crypto.randomBytes(16).toString('hex');
    
    // Validate CAPTCHA
    const isValid = validateCaptcha(sessionId, captchaText);
    
    if (!isValid) {
      return res.status(400).json({ 
        message: 'Invalid or expired CAPTCHA', 
        field: 'captchaText',
        valid: false 
      });
    }
    
    res.json({ valid: true });
  });

  // Registration endpoint with CAPTCHA verification
  // Logout endpoint
  apiRouter.post('/auth/logout', async (req, res) => {
    try {
      // In a token-based authentication system without sessions, 
      // we don't need to do anything on the server side
      // The client should remove the token from storage
      res.status(200).send();
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Forgot password - request password reset
  apiRouter.post('/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security reasons, we don't want to reveal if an email exists or not
        // We'll still return a success message
        return res.status(200).json({ 
          message: 'If your email is registered, you will receive password reset instructions.'
        });
      }
      
      // Generate a reset token (uuid)
      const resetToken = `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 1); // Token expires in 1 hour
      
      // Normally, here we would:
      // 1. Save the token and its expiration to the database
      // 2. Send an email with a reset link
      
      // For demo purposes, we'll just return the token
      // In a real app, you would NEVER return this token in the response
      return res.status(200).json({ 
        message: 'If your email is registered, you will receive password reset instructions.',
        // For development only:
        debug: {
          token: resetToken,
          userId: user.id,
          expires: tokenExpiry
        }
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Reset password with token
  apiRouter.post('/auth/reset-password', async (req, res) => {
    try {
      const { token, userId, newPassword } = req.body;
      
      if (!token || !userId || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
      }
      
      // In a real app, we would:
      // 1. Verify the token is valid and not expired
      // 2. Update the user's password
      
      // For this demo, we'll just update the password
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Update the user's password
      await storage.updateUser(userId, {
        ...user,
        password: newPassword
      });
      
      return res.status(200).json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  apiRouter.post('/auth/register', requireCaptcha, async (req, res) => {
    try {
      // Validate the user data
      const userData = insertUserSchema.parse({
        ...req.body,
        isActive: true // Set to active by default
      });
      
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(userData.username);
      if (existingUsername) {
        return res.status(409).json({ 
          message: 'Username already exists. Please choose a different username.',
          field: 'username'
        });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(409).json({ 
          message: 'Email already exists. Please use a different email address.',
          field: 'email'
        });
      }
      
      // For teachers, check if teacher is already assigned to a class
      if (userData.role === 'teacher' && userData.classId) {
        // We can't check teacher classes here since user doesn't have an ID yet
        // This check is handled after the user is created when updating the class
      }
      
      // Create the user
      const user = await storage.createUser(userData);
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid registration data', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to register user' });
    }
  });
  
  // User management routes
  apiRouter.get('/users', async (req, res) => {
    try {
      const { role, classId, schoolId } = req.query;
      
      // Get users based on filters if provided
      let users;
      if (classId) {
        // If classId is provided, get users from that specific class
        users = await storage.getUsersByClass(Number(classId));
      } else if (schoolId) {
        // If schoolId is provided, get users from that school
        users = await storage.getUsersBySchool(Number(schoolId));
      } else if (role) {
        // If role is provided, get users with that specific role
        users = await storage.getUsersByRole(String(role));
      } else {
        // If no filters provided, get all users
        users = await storage.getAllUsers();
      }
      
      const schools = await storage.getAllSchools();
      const classes = await storage.getAllClasses();
      
      // Return users without passwords and with additional information
      const sanitizedUsers = users.map(({ password, ...user }) => {
        // Find school name
        const school = schools.find(s => s.id === user.schoolId);
        const schoolName = school ? school.name : null;
        
        // Find class and grade info
        const classInfo = classes.find(c => c.id === user.classId);
        const className = classInfo ? classInfo.name : null;
        const gradeLevel = classInfo ? classInfo.gradeLevel : null;
        
        return {
          ...user,
          schoolName,
          className,
          gradeLevel
        };
      });
      
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });
  
  apiRouter.get('/users/:id', async (req, res) => {
    try {
      const user = await storage.getUser(Number(req.params.id));
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Return user without password and with additional information
      const { password, ...userData } = user;
      
      // Get school info
      let schoolName = null;
      if (userData.schoolId) {
        const school = await storage.getSchool(userData.schoolId);
        schoolName = school ? school.name : null;
      }
      
      // Get class and grade info
      let className = null;
      let gradeLevel = null;
      if (userData.classId) {
        const classInfo = await storage.getClass(userData.classId);
        if (classInfo) {
          className = classInfo.name;
          gradeLevel = classInfo.gradeLevel;
        }
      }
      
      const enhancedUserData = {
        ...userData,
        schoolName,
        className,
        gradeLevel
      };
      
      res.json(enhancedUserData);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });
  
  apiRouter.post('/users', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(userData.username);
      if (existingUsername) {
        return res.status(409).json({ 
          message: 'Username already exists. Please choose a different username.',
          field: 'username'
        });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(409).json({ 
          message: 'Email already exists. Please use a different email address.',
          field: 'email'
        });
      }
      
      // For teachers, restrict to one class assignment
      if (userData.role === 'teacher' && userData.classId) {
        const existingClasses = await storage.getAllClasses();
        const alreadyAssigned = existingClasses.some(c => c.teacherId !== null && 
          userData.id !== c.teacherId && c.id === userData.classId);
        
        if (alreadyAssigned) {
          return res.status(409).json({
            message: 'This class already has a teacher assigned. Please choose a different class or create a new one.',
            field: 'classId'
          });
        }
      }
      
      const user = await storage.createUser(userData);
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid user data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create user' });
    }
  });
  
  apiRouter.patch('/users/:id', async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check for username and email conflicts if they are being changed
      if (req.body.username && req.body.username !== user.username) {
        const existingUsername = await storage.getUserByUsername(req.body.username);
        if (existingUsername && existingUsername.id !== userId) {
          return res.status(409).json({ 
            message: 'Username already exists. Please choose a different username.',
            field: 'username'
          });
        }
      }
      
      if (req.body.email && req.body.email !== user.email) {
        const existingEmail = await storage.getUserByEmail(req.body.email);
        if (existingEmail && existingEmail.id !== userId) {
          return res.status(409).json({ 
            message: 'Email already exists. Please use a different email address.',
            field: 'email'
          });
        }
      }
      
      // For teachers, check class assignment when changing class
      if (user.role === 'teacher' && req.body.classId && req.body.classId !== user.classId) {
        // Check if the new class already has a teacher assigned
        const classes = await storage.getAllClasses();
        const isClassTaken = classes.some(c => 
          c.id === req.body.classId && 
          c.teacherId !== null && 
          c.teacherId !== userId
        );
        
        if (isClassTaken) {
          return res.status(409).json({
            message: 'This class already has a teacher assigned. Please choose a different class.',
            field: 'classId'
          });
        }
      }
      
      const updatedUser = await storage.updateUser(userId, req.body);
      
      // Return user without password
      const { password, ...userWithoutPassword } = updatedUser!;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('User update error:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });
  
  apiRouter.delete('/users/:id', async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const deleted = await storage.deleteUser(userId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });
  
  // School routes
  apiRouter.get('/schools', async (req, res) => {
    try {
      // Get the showInactive parameter, default to false if not provided
      const showInactive = req.query.showInactive === 'true';
      
      // Get all schools
      let schools = await storage.getAllSchools();
      
      // Filter out inactive schools if showInactive is false
      if (!showInactive) {
        schools = schools.filter(school => school.isActive);
      }
      
      // Get all users to calculate student counts
      const allUsers = await storage.getAllUsers();
      
      // Calculate active student count for each school
      const schoolsWithCounts = schools.map(school => {
        const activeStudentCount = allUsers.filter(user => 
          user.role === 'student' && 
          user.schoolId === school.id && 
          user.isActive
        ).length;
        
        return {
          ...school,
          activeStudentCount
        };
      });
      
      res.json(schoolsWithCounts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch schools' });
    }
  });
  
  apiRouter.get('/schools/:id', async (req, res) => {
    try {
      const school = await storage.getSchool(Number(req.params.id));
      
      if (!school) {
        return res.status(404).json({ message: 'School not found' });
      }
      
      res.json(school);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch school' });
    }
  });
  
  apiRouter.post('/schools', async (req, res) => {
    try {
      const schoolData = insertSchoolSchema.parse(req.body);
      const school = await storage.createSchool(schoolData);
      res.status(201).json(school);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid school data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create school' });
    }
  });
  
  apiRouter.patch('/schools/:id', async (req, res) => {
    try {
      const schoolId = Number(req.params.id);
      const school = await storage.getSchool(schoolId);
      
      if (!school) {
        return res.status(404).json({ message: 'School not found' });
      }
      
      const updatedSchool = await storage.updateSchool(schoolId, req.body);
      res.json(updatedSchool);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update school' });
    }
  });
  
  apiRouter.delete('/schools/:id', async (req, res) => {
    try {
      const schoolId = Number(req.params.id);
      const deleted = await storage.deleteSchool(schoolId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'School not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete school' });
    }
  });
  
  // Class routes
  apiRouter.get('/classes', async (req, res) => {
    try {
      const teacherId = req.query.teacherId ? Number(req.query.teacherId) : undefined;
      const schoolId = req.query.schoolId ? Number(req.query.schoolId) : undefined;
      
      let classes;
      if (teacherId) {
        classes = await storage.getClassesByTeacher(teacherId);
      } else if (schoolId) {
        classes = await storage.getClassesBySchool(schoolId);
      } else {
        classes = await storage.getAllClasses();
      }
      
      res.json(classes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch classes' });
    }
  });
  
  apiRouter.get('/classes/:id', async (req, res) => {
    try {
      const classData = await storage.getClass(Number(req.params.id));
      
      if (!classData) {
        return res.status(404).json({ message: 'Class not found' });
      }
      
      res.json(classData);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch class' });
    }
  });
  
  apiRouter.post('/classes', async (req, res) => {
    try {
      console.log('Received class creation request:', req.body);
      const classData = insertClassSchema.parse(req.body);
      console.log('Validated class data:', classData);
      
      // Check if the teacher is already assigned to another class
      if (classData.teacherId) {
        const teacherClasses = await storage.getClassesByTeacher(classData.teacherId);
        if (teacherClasses.length > 0) {
          console.error('Teacher already assigned to a class:', teacherClasses);
          return res.status(409).json({
            message: 'This teacher is already assigned to a class. Teachers can only be assigned to one class.',
            field: 'teacherId'
          });
        }
      }
      
      const newClass = await storage.createClass(classData);
      console.log('Class created successfully:', newClass);
      res.status(201).json(newClass);
    } catch (error) {
      console.error('Error creating class:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
        return res.status(400).json({ message: 'Invalid class data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create class' });
    }
  });
  
  apiRouter.patch('/classes/:id', async (req, res) => {
    try {
      const classId = Number(req.params.id);
      const classData = await storage.getClass(classId);
      
      if (!classData) {
        return res.status(404).json({ message: 'Class not found' });
      }
      
      // Check if we're changing the teacher assignment
      if (req.body.teacherId && req.body.teacherId !== classData.teacherId) {
        // Check if the teacher is already assigned to another class
        const teacherClasses = await storage.getClassesByTeacher(req.body.teacherId);
        const otherAssignments = teacherClasses.filter(c => c.id !== classId);
        
        if (otherAssignments.length > 0) {
          return res.status(409).json({
            message: 'This teacher is already assigned to another class. Teachers can only be assigned to one class.',
            field: 'teacherId'
          });
        }
      }
      
      const updatedClass = await storage.updateClass(classId, req.body);
      res.json(updatedClass);
    } catch (error) {
      console.error('Class update error:', error);
      res.status(500).json({ message: 'Failed to update class' });
    }
  });
  
  apiRouter.delete('/classes/:id', async (req, res) => {
    try {
      const classId = Number(req.params.id);
      const deleted = await storage.deleteClass(classId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Class not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete class' });
    }
  });
  
  // Partner routes
  apiRouter.get('/partners', async (req, res) => {
    try {
      // Get the showInactive parameter, default to false if not provided
      const showInactive = req.query.showInactive === 'true';
      
      // Get all partners
      let partners = await storage.getAllPartners();
      
      // Filter out inactive partners if showInactive is false
      if (!showInactive) {
        partners = partners.filter(partner => partner.isActive);
      }
      
      res.json(partners);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch partners' });
    }
  });
  
  apiRouter.get('/partners/:id', async (req, res) => {
    try {
      const partner = await storage.getPartner(Number(req.params.id));
      
      if (!partner) {
        return res.status(404).json({ message: 'Partner not found' });
      }
      
      res.json(partner);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch partner' });
    }
  });
  
  apiRouter.post('/partners', async (req, res) => {
    try {
      const partnerData = insertPartnerSchema.parse(req.body);
      const partner = await storage.createPartner(partnerData);
      res.status(201).json(partner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid partner data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create partner' });
    }
  });
  
  apiRouter.patch('/partners/:id', async (req, res) => {
    try {
      const partnerId = Number(req.params.id);
      const partner = await storage.getPartner(partnerId);
      
      if (!partner) {
        return res.status(404).json({ message: 'Partner not found' });
      }
      
      const updatedPartner = await storage.updatePartner(partnerId, req.body);
      res.json(updatedPartner);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update partner' });
    }
  });
  
  apiRouter.delete('/partners/:id', async (req, res) => {
    try {
      const partnerId = Number(req.params.id);
      const deleted = await storage.deletePartner(partnerId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Partner not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete partner' });
    }
  });
  
  // Event routes
  apiRouter.get('/events', async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;
      const stage = req.query.stage as string | undefined;
      
      let events;
      if (status) {
        events = await storage.getEventsByStatus(status);
      } else if (type) {
        events = await storage.getEventsByType(type);
      } else if (stage) {
        events = await storage.getEventsByStage(stage);
      } else {
        events = await storage.getAllEvents();
      }
      
      // Enhance events with participant counts
      const eventsWithCounts = await Promise.all(events.map(async (event) => {
        // Get registrations for this event
        const registrations = await storage.getRegistrationsByEvent(event.id);
        // Get submissions for this event
        const submissions = await storage.getSubmissionsByEvent(event.id);
        
        return {
          ...event,
          participantCount: registrations.length,
          submissionCount: submissions.length
        };
      }));
      
      res.json(eventsWithCounts);
    } catch (error) {
      console.error('Error fetching events with counts:', error);
      res.status(500).json({ message: 'Failed to fetch events' });
    }
  });
  
  apiRouter.get('/events/:id', async (req, res) => {
    try {
      const eventId = Number(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      // Get registrations for this event
      const registrations = await storage.getRegistrationsByEvent(eventId);
      // Get submissions for this event
      const submissions = await storage.getSubmissionsByEvent(eventId);
      
      // Include participant and submission counts
      const eventWithCounts = {
        ...event,
        participantCount: registrations.length,
        submissionCount: submissions.length
      };
      
      res.json(eventWithCounts);
    } catch (error) {
      console.error('Error fetching event with counts:', error);
      res.status(500).json({ message: 'Failed to fetch event' });
    }
  });
  
  apiRouter.post('/events', async (req, res) => {
    try {
      console.log('Event creation request received:', req.body);
      const eventData = insertEventSchema.parse(req.body);
      console.log('Validated event data:', eventData);
      const event = await storage.createEvent(eventData);
      console.log('Event created successfully:', event);
      res.status(201).json(event);
    } catch (error) {
      console.error('Event creation error:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
        return res.status(400).json({ message: 'Invalid event data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create event' });
    }
  });
  
  apiRouter.patch('/events/:id', async (req, res) => {
    try {
      const eventId = Number(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      const updatedEvent = await storage.updateEvent(eventId, req.body);
      res.json(updatedEvent);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update event' });
    }
  });
  
  apiRouter.delete('/events/:id', async (req, res) => {
    try {
      const eventId = Number(req.params.id);
      const deleted = await storage.deleteEvent(eventId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete event' });
    }
  });
  
  // Registration routes
  apiRouter.get('/registrations', async (req, res) => {
    try {
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
      
      let registrations;
      if (userId) {
        registrations = await storage.getRegistrationsByUser(userId);
      } else if (eventId) {
        registrations = await storage.getRegistrationsByEvent(eventId);
      } else {
        return res.status(400).json({ message: 'userId or eventId query parameter is required' });
      }
      
      res.json(registrations);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch registrations' });
    }
  });
  
  // Get detailed participant information for an event
  // Endpoint removed - duplicate of the one at line ~2081
  
  apiRouter.post('/registrations', async (req, res) => {
    try {
      const registrationData = insertRegistrationSchema.parse(req.body);
      
      // Check if the user already registered for this event
      const existingRegistrations = await storage.getRegistrationsByUser(registrationData.userId);
      const alreadyRegistered = existingRegistrations.some(reg => reg.eventId === registrationData.eventId);
      
      if (alreadyRegistered) {
        return res.status(409).json({ message: 'User already registered for this event' });
      }
      
      const registration = await storage.createRegistration(registrationData);
      res.status(201).json(registration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid registration data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create registration' });
    }
  });
  
  apiRouter.delete('/registrations', async (req, res) => {
    try {
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
      
      if (!userId || !eventId) {
        return res.status(400).json({ message: 'userId and eventId query parameters are required' });
      }
      
      const registrations = await storage.getRegistrationsByUser(userId);
      const registration = registrations.find(reg => reg.eventId === eventId);
      
      if (!registration) {
        return res.status(404).json({ message: 'Registration not found' });
      }
      
      const deleted = await storage.deleteRegistration(registration.id);
      
      if (!deleted) {
        return res.status(500).json({ message: 'Failed to delete registration' });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete registration' });
    }
  });
  
  // Submission routes
  apiRouter.get('/submissions', async (req, res) => {
    try {
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
      const classId = req.query.classId ? Number(req.query.classId) : undefined;
      const winnerCategory = req.query.winnerCategory as string | undefined;
      const forVoting = req.query.forVoting === 'true';
      const currentUserId = req.query.currentUserId ? Number(req.query.currentUserId) : undefined;
      
      console.log('Submissions query params:', { userId, eventId, classId, forVoting, currentUserId });
      
      let submissions;
      // Get current event to determine voting stage
      let currentEvent = eventId ? await storage.getEvent(eventId) : null;
      let currentEventStage = currentEvent ? currentEvent.stage : 'class';
      
      if (userId && eventId) {
        submissions = await storage.getSubmissionsByUserAndEvent(userId, eventId);
      } else if (userId) {
        submissions = await storage.getSubmissionsByUser(userId);
      } else if (classId) {
        // Teacher or student view with class ID
        if (forVoting && currentUserId) {
          // Student voting view - get only validated submissions from classmates
          console.log(`Getting validated submissions for voting in class ${classId}`);
          const allClassSubmissions = await storage.getSubmissionsByClass(classId);
          console.log(`Found ${allClassSubmissions.length} total submissions in class, filtering for voting`);
          
          // Filter to show only validated submissions and exclude current user's own submissions
          submissions = allClassSubmissions.filter(sub => 
            sub.userId !== currentUserId && // Don't show own submissions
            sub.validated === true         // Only show teacher-validated submissions
          );
          console.log(`After filtering for voting: ${submissions.length} submissions eligible for voting`);
        } else {
          // Regular teacher view - get submissions by class with validation filter options
          console.log(`Getting submissions for class ID: ${classId}, filter: ${req.query.pending ? 'pending' : (req.query.validated ? 'validated' : 'all')}`);
          if (req.query.pending === 'true') {
            console.log(`Looking for pending validation submissions in class ${classId}`);
            submissions = await storage.getSubmissionsPendingValidation(classId);
            console.log(`Found ${submissions.length} pending submissions`);
          } else if (req.query.validated === 'true') {
            console.log(`Looking for validated submissions in class ${classId}`);
            submissions = await storage.getValidatedSubmissions(classId);
            console.log(`Found ${submissions.length} validated submissions`);
          } else {
            console.log(`Looking for all submissions in class ${classId}`);
            submissions = await storage.getSubmissionsByClass(classId);
            console.log(`Found ${submissions.length} total submissions`);
          }
        }
      } else if (eventId) {
        // Get all submissions for this event
        submissions = await storage.getSubmissionsByEvent(eventId);
        console.log(`Found ${submissions.length} submissions for event ID ${eventId}`);
        
        // If this is for voting purposes and we have a current user ID
        if (forVoting && currentUserId) {
          // 1. Filter out unvalidated submissions and current user's own submissions
          const beforeFilter = submissions.length;
          submissions = submissions.filter(sub => 
            sub.userId !== currentUserId && // Filter out user's own submissions
            sub.validated === true          // Only show submissions validated by teacher
          );
          console.log(`Filtered out user's own and unvalidated submissions: ${beforeFilter} -> ${submissions.length}`);
          
          // Get current user information
          const currentUser = await storage.getUser(currentUserId);
          console.log('Current user:', currentUser);
          
          if (!currentUser) {
            return res.status(400).json({ message: 'Invalid user ID' });
          }
          
          // Apply stage-specific filters
          switch (currentEventStage) {
            case 'class':
              // CLASS STAGE: Only show submissions from students in the same class
              if (classId) {
                // Get all users in the class
                const classUsers = await storage.getUsersByClass(classId);
                const classUserIds = classUsers.map(user => user.id);
                console.log(`Users in class ${classId}:`, classUserIds);
                
                const beforeClassFilter = submissions.length;
                // Only keep submissions from users in this class
                submissions = submissions.filter(sub => classUserIds.includes(sub.userId));
                console.log(`Filtered to only classmates: ${beforeClassFilter} -> ${submissions.length}`);
              } else if (currentUser.classId) {
                // If no class ID was explicitly provided, use current user's class
                const classUsers = await storage.getUsersByClass(currentUser.classId);
                const classUserIds = classUsers.map(user => user.id);
                console.log(`Users in current user's class ${currentUser.classId}:`, classUserIds);
                
                const beforeClassFilter = submissions.length;
                // Only keep submissions from users in the same class
                submissions = submissions.filter(sub => classUserIds.includes(sub.userId));
                console.log(`Filtered to only classmates: ${beforeClassFilter} -> ${submissions.length}`);
              }
              break;
              
            case 'school':
              // SCHOOL STAGE: Only show WINNING submissions from the class stage
              // from the same grade level within the same school
              if (currentUser.schoolId) {
                // Get current user's class to determine grade level
                const userClass = currentUser.classId ? await storage.getClass(currentUser.classId) : null;
                const userGradeLevel = userClass ? userClass.gradeLevel : null;
                
                console.log(`User grade level for school stage: ${userGradeLevel}`);
                
                if (userGradeLevel) {
                  // Get all classes with the same grade level in this school
                  const allClasses = await storage.getClassesBySchool(currentUser.schoolId);
                  const sameGradeClasses = allClasses.filter(cls => cls.gradeLevel === userGradeLevel);
                  const sameGradeClassIds = sameGradeClasses.map(cls => cls.id);
                  
                  console.log(`Classes with grade level ${userGradeLevel}:`, sameGradeClassIds);
                  
                  // Get users from these classes
                  const allUsers = await storage.getUsersBySchool(currentUser.schoolId);
                  const sameGradeUsers = allUsers.filter(usr => 
                    usr.classId && sameGradeClassIds.includes(usr.classId)
                  );
                  const sameGradeUserIds = sameGradeUsers.map(usr => usr.id);
                  
                  console.log(`Users in same grade (${userGradeLevel}):`, sameGradeUserIds);
                  
                  // Filter submissions to only include:
                  // 1. Submissions from the same grade/school
                  // 2. Only ones marked as class winners
                  const beforeSchoolFilter = submissions.length;
                  submissions = submissions.filter(sub => 
                    sameGradeUserIds.includes(sub.userId) && sub.classWinner === true
                  );
                  console.log(`Filtered to class winners from same grade in school: ${beforeSchoolFilter} -> ${submissions.length}`);
                }
              }
              break;
              
            case 'country':
              // COUNTRY STAGE: Only show WINNING submissions from the school stage
              // from the same grade level across all schools
              // Get current user's class to determine grade level
              const userClass = currentUser.classId ? await storage.getClass(currentUser.classId) : null;
              const userGradeLevel = userClass ? userClass.gradeLevel : null;
              
              console.log(`User grade level for country stage: ${userGradeLevel}`);
              
              if (userGradeLevel) {
                // Get all classes with the same grade level across all schools
                const allClasses = await storage.getAllClasses();
                const sameGradeClasses = allClasses.filter(cls => cls.gradeLevel === userGradeLevel);
                const sameGradeClassIds = sameGradeClasses.map(cls => cls.id);
                
                console.log(`All classes with grade level ${userGradeLevel}:`, sameGradeClassIds);
                
                // Get all users from these classes
                const allUsers = await storage.getAllUsers();
                const sameGradeUsers = allUsers.filter(usr => 
                  usr.classId && sameGradeClassIds.includes(usr.classId)
                );
                const sameGradeUserIds = sameGradeUsers.map(usr => usr.id);
                
                console.log(`Users in same grade (${userGradeLevel}) across all schools:`, sameGradeUserIds);
                
                // Filter submissions to only include:
                // 1. Submissions from the same grade across all schools
                // 2. Only ones marked as school winners
                const beforeCountryFilter = submissions.length;
                submissions = submissions.filter(sub => 
                  sameGradeUserIds.includes(sub.userId) && sub.schoolWinner === true
                );
                console.log(`Filtered to school winners from same grade across all schools: ${beforeCountryFilter} -> ${submissions.length}`);
              }
              break;
              
            case 'global':
              // GLOBAL STAGE: Only show WINNING submissions from the country stage
              console.log('Global stage: showing only country winners');
              const beforeGlobalFilter = submissions.length;
              submissions = submissions.filter(sub => sub.countryWinner === true);
              console.log(`Filtered to country winners: ${beforeGlobalFilter} -> ${submissions.length}`);
              break;
              
            default:
              console.log(`Unknown event stage: ${currentEventStage}, defaulting to class stage behavior`);
              // Default to class stage behavior
              if (currentUser.classId) {
                const classUsers = await storage.getUsersByClass(currentUser.classId);
                const classUserIds = classUsers.map(user => user.id);
                submissions = submissions.filter(sub => classUserIds.includes(sub.userId));
              }
          }
          
          // Debug: Get student submissions for this event
          const allStudentSubmissions = await storage.getSubmissionsByEvent(eventId);
          console.log(`All submissions for event ${eventId}:`, 
            allStudentSubmissions.map(s => ({ id: s.id, userId: s.userId, title: s.title })));
        }
      } else if (winnerCategory) {
        submissions = await storage.getWinningSubmissions(winnerCategory);
      } else {
        return res.status(400).json({ message: 'Query parameters are required' });
      }
      
      // For each submission, get the vote count (votes received by this submission) and whether current user voted
      const submissionsWithVotes = await Promise.all(
        submissions.map(async (sub) => {
          // Get votes received by this submission
          const voteCount = await storage.getVoteCountForSubmission(sub.id);
          
          // Check if current user has voted for this submission
          let hasVoted = false;
          if (currentUserId) {
            hasVoted = await storage.hasUserVotedForSubmission(currentUserId, sub.id);
          }
          
          // Get the user's full name for each submission
          const user = await storage.getUser(sub.userId);
          const userFullName = user ? user.fullName : "Anonymous";
          
          // Get the event name for each submission
          const event = await storage.getEvent(sub.eventId);
          const eventName = event ? event.name : `Event #${sub.eventId}`;
          
          return { ...sub, voteCount, hasVoted, userFullName, eventName };
        })
      );
      
      res.json(submissionsWithVotes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch submissions' });
    }
  });
  
  apiRouter.get('/submissions/:id', async (req, res) => {
    try {
      const submission = await storage.getSubmission(Number(req.params.id));
      
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
      
      // Get additional data needed for the view
      const voteCount = await storage.getVoteCountForSubmission(submission.id);
      const user = await storage.getUser(submission.userId);
      const event = await storage.getEvent(submission.eventId);
      
      // Format the data to match the frontend expectations
      const extendedSubmission = {
        ...submission,
        voteCount,
        userFullName: user ? user.fullName : 'Unknown User',
        eventName: event ? event.name : 'Unknown Event',
        type: event ? event.type : undefined,
        imageUrl: submission.content.startsWith('data:image') ? submission.content : undefined
      };
      
      res.json(extendedSubmission);
    } catch (error) {
      console.error('Error fetching submission:', error);
      res.status(500).json({ message: 'Failed to fetch submission' });
    }
  });
  
  apiRouter.post('/submissions', async (req, res) => {
    try {
      const submissionData = insertSubmissionSchema.parse(req.body);
      
      // Check if user is registered for this event
      const registrations = await storage.getRegistrationsByUser(submissionData.userId);
      const isRegistered = registrations.some(reg => reg.eventId === submissionData.eventId);
      
      if (!isRegistered) {
        return res.status(403).json({ message: 'User is not registered for this event' });
      }
      
      // Get the event to check its stage
      const event = await storage.getEvent(submissionData.eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      // Check if event is in a stage that allows submissions (only class stage)
      if (event.stage !== 'class') {
        return res.status(403).json({ 
          message: 'Submissions are only allowed for events in the class stage',
          currentStage: event.stage 
        });
      }
      
      // Check if user already has 3 submissions for this event
      const existingSubmissions = await storage.getSubmissionsByUserAndEvent(
        submissionData.userId, 
        submissionData.eventId
      );
      
      if (existingSubmissions.length >= 3) {
        return res.status(403).json({ message: 'Maximum number of submissions (3) reached for this event' });
      }
      
      const submission = await storage.createSubmission(submissionData);
      res.status(201).json(submission);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid submission data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create submission' });
    }
  });
  
  apiRouter.patch('/submissions/:id', async (req, res) => {
    try {
      const submissionId = Number(req.params.id);
      const submission = await storage.getSubmission(submissionId);
      
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
      
      const updatedSubmission = await storage.updateSubmission(submissionId, req.body);
      const voteCount = await storage.getVoteCountForSubmission(submissionId);
      
      res.json({ ...updatedSubmission, voteCount });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update submission' });
    }
  });
  
  // Validate submissions (teacher approval)
  apiRouter.post('/submissions/:id/validate', async (req, res) => {
    try {
      const submissionId = Number(req.params.id);
      const { validated } = req.body;
      
      if (validated === undefined) {
        return res.status(400).json({ message: 'Validation status is required' });
      }
      
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
      
      // Update the validation status
      const updatedSubmission = await storage.validateSubmission(submissionId, !!validated);
      
      // Get additional data for the response
      const voteCount = await storage.getVoteCountForSubmission(submissionId);
      const user = await storage.getUser(submission.userId);
      
      res.json({
        ...updatedSubmission,
        voteCount,
        userFullName: user ? user.fullName : 'Unknown User',
        message: validated ? 'Submission approved' : 'Submission rejected'
      });
    } catch (error) {
      console.error('Error validating submission:', error);
      res.status(500).json({ message: 'Failed to validate submission' });
    }
  });
  
  // Mark submissions as winners for different competition stages
  apiRouter.post('/submissions/mark-winners', async (req, res) => {
    try {
      const { eventId, stage, winnerIds } = req.body;
      
      if (!eventId || !stage || !Array.isArray(winnerIds)) {
        return res.status(400).json({ 
          message: 'Invalid request data. Required: eventId, stage, and winnerIds array' 
        });
      }
      
      // Get all submissions for this event
      const eventSubmissions = await storage.getSubmissionsByEvent(eventId);
      
      // Validate that all winnerIds exist and belong to this event
      const eventSubmissionIds = eventSubmissions.map(s => s.id);
      const invalidIds = winnerIds.filter(id => !eventSubmissionIds.includes(id));
      
      if (invalidIds.length > 0) {
        return res.status(400).json({ 
          message: `Some submissions don't exist or don't belong to this event: ${invalidIds.join(', ')}` 
        });
      }
      
      // Update submissions based on the stage
      const winnerField = 
        stage === 'class' ? 'classWinner' : 
        stage === 'school' ? 'schoolWinner' : 
        stage === 'country' ? 'countryWinner' : 'globalWinner';
      
      // Mark the selected submissions as winners for this stage
      const updatePromises = winnerIds.map(id => 
        storage.updateSubmission(id, { [winnerField]: true })
      );
      
      await Promise.all(updatePromises);
      
      res.json({ 
        message: `Successfully marked ${winnerIds.length} submissions as winners for ${stage} stage`,
        eventId,
        stage,
        winnerIds
      });
    } catch (error) {
      console.error('Error marking winners:', error);
      res.status(500).json({ message: 'Failed to mark winners' });
    }
  });
  
  // Promote an event to the next stage
  apiRouter.post('/events/:id/promote', async (req, res) => {
    try {
      const eventId = Number(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      // Determine the next stage based on current stage
      let nextStage;
      switch (event.stage) {
        case 'class':
          nextStage = 'school';
          break;
        case 'school':
          nextStage = 'country';
          break;
        case 'country':
          nextStage = 'global';
          break;
        case 'global':
          return res.status(400).json({ message: 'Event is already at the final stage' });
        default:
          return res.status(400).json({ message: 'Invalid current stage' });
      }
      
      // Update the event stage
      // Type-safe stage update
      const updatedEvent = await storage.updateEvent(eventId, { 
        stage: nextStage as "class" | "school" | "country" | "global" 
      });
      
      res.json({ 
        message: `Event promoted from ${event.stage} to ${nextStage} stage`,
        event: updatedEvent
      });
    } catch (error) {
      console.error('Error promoting event:', error);
      res.status(500).json({ message: 'Failed to promote event' });
    }
  });
  
  apiRouter.delete('/submissions/:id', async (req, res) => {
    try {
      const submissionId = Number(req.params.id);
      const deleted = await storage.deleteSubmission(submissionId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Submission not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete submission' });
    }
  });
  
  // Vote routes
  apiRouter.post('/votes', async (req, res) => {
    try {
      const voteData = insertVoteSchema.parse(req.body);
      
      // Check if voter has already voted for this submission
      const hasVoted = await storage.hasUserVotedForSubmission(voteData.voterId, voteData.submissionId);
      
      if (hasVoted) {
        return res.status(409).json({ message: 'User already voted for this submission' });
      }
      
      // Get the submission to determine the event
      const submission = await storage.getSubmission(voteData.submissionId);
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
      
      // Prevent users from voting for their own submissions
      if (submission.userId === voteData.voterId) {
        return res.status(403).json({ message: 'You cannot vote for your own submission' });
      }
      
      // Check if submission is validated by teacher
      if (submission.validated !== true) {
        return res.status(403).json({ message: 'This submission has not been validated by a teacher yet' });
      }
      
      // Get the event to determine the stage
      const event = await storage.getEvent(submission.eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      // Count how many votes this user has already cast for submissions in this event
      const userVotes = await storage.getVotesByVoter(voteData.voterId);
      
      // Filter to only count votes for submissions in the same event
      const eventSubmissions = await storage.getSubmissionsByEvent(submission.eventId);
      const eventSubmissionIds = eventSubmissions.map(s => s.id);
      
      const votesInThisEvent = userVotes.filter(vote => 
        eventSubmissionIds.includes(vote.submissionId)
      );
      
      // Check if user has reached the maximum number of votes (3) for this event
      if (votesInThisEvent.length >= 3) {
        return res.status(403).json({ 
          message: 'Maximum number of votes (3) reached for this event',
          votesUsed: votesInThisEvent.length
        });
      }
      
      const vote = await storage.createVote(voteData);
      res.status(201).json({
        ...vote,
        votesUsed: votesInThisEvent.length + 1
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid vote data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create vote' });
    }
  });
  
  // Get the count of votes RECEIVED by a submission (not votes cast by a user)
  apiRouter.get('/votes/count/:submissionId', async (req, res) => {
    try {
      const submissionId = Number(req.params.submissionId);
      // This counts votes received by the submission (votes where this submission was voted for)
      const count = await storage.getVoteCountForSubmission(submissionId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get vote count' });
    }
  });
  
  apiRouter.get('/votes/check', async (req, res) => {
    try {
      const voterId = req.query.voterId ? Number(req.query.voterId) : undefined;
      const submissionId = req.query.submissionId ? Number(req.query.submissionId) : undefined;
      
      if (!voterId || !submissionId) {
        return res.status(400).json({ message: 'voterId and submissionId query parameters are required' });
      }
      
      const hasVoted = await storage.hasUserVotedForSubmission(voterId, submissionId);
      res.json({ hasVoted });
    } catch (error) {
      res.status(500).json({ message: 'Failed to check vote status' });
    }
  });
  
  // Get the count of votes CAST by a user (not votes received by their submissions)
  apiRouter.get('/votes/count-by-voter', async (req, res) => {
    try {
      const voterId = req.query.voterId ? Number(req.query.voterId) : undefined;
      const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
      
      if (!voterId || !eventId) {
        return res.status(400).json({ message: 'voterId and eventId query parameters are required' });
      }
      
      // Get all submissions for this event
      const eventSubmissions = await storage.getSubmissionsByEvent(eventId);
      const eventSubmissionIds = eventSubmissions.map(s => s.id);
      
      // Get all votes CAST BY this voter (not votes received by their submissions)
      const userVotes = await storage.getVotesByVoter(voterId);
      
      // Filter votes to only include those for submissions in this event
      const votesInThisEvent = userVotes.filter(vote => 
        eventSubmissionIds.includes(vote.submissionId)
      );
      
      res.json({ 
        votesUsed: votesInThisEvent.length, 
        maxVotes: 3,
        remaining: Math.max(0, 3 - votesInThisEvent.length)
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to count voter votes' });
    }
  });

  // AI Content Generation routes
  apiRouter.post('/ai/generate-poem', async (req, res) => {
    try {
      const { prompt, style } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }
      
      let poem;
      if (USE_HUGGING_FACE) {
        // Use Hugging Face (free open-source AI)
        poem = await generateHuggingFaceText(prompt, style);
      } else {
        // Use OpenAI
        poem = await generateOpenAIPoem(prompt, style);
      }
      
      res.json({ content: poem });
    } catch (error) {
      console.error('Error generating poem:', error);
      res.status(500).json({ message: 'Failed to generate poem' });
    }
  });

  apiRouter.post('/ai/generate-image', async (req, res) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }
      
      let imageUrl;
      if (USE_HUGGING_FACE) {
        // Use Hugging Face (free open-source AI)
        imageUrl = await generateHuggingFaceImage(prompt);
      } else {
        // Use OpenAI
        imageUrl = await generateOpenAIImage(prompt);
      }
      
      res.json({ imageUrl });
    } catch (error) {
      console.error('Error generating image:', error);
      res.status(500).json({ message: 'Failed to generate image' });
    }
  });

  // Set up file upload middleware
  const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // Import/export endpoints
  // Data export endpoints
  apiRouter.get('/export/users', async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const schools = await storage.getAllSchools();
      const classes = await storage.getAllClasses();
      
      // For students export, include School Id, Class Id, Grade Id, and Password information
      const exportableUsers = users.map(user => {
        // Find school and class information
        const userSchool = schools.find(s => s.id === user.schoolId);
        const userClass = classes.find(c => c.id === user.classId);
        
        // Create enhanced user object with additional fields
        return {
          ...user,
          // Include IDs instead of names
          schoolId: user.schoolId || '',
          classId: user.classId || '',
          gradeId: userClass ? userClass.gradeLevel : '',
          // Include password for import/export functionality
          // Note: In a real production environment, we would never export actual passwords
          // This is only included here for the demonstration/development environment
          password: user.password || ''
        };
      });
      
      const format = req.query.format as string || 'json';
      
      if (format === 'csv') {
        const csv = Papa.unparse(exportableUsers);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="users.csv"');
        return res.send(csv);
      } else if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(exportableUsers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Users');
        
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.header('Content-Disposition', 'attachment; filename="users.xlsx"');
        return res.send(Buffer.from(excelBuffer));
      }
      
      // Default: JSON
      res.json(exportableUsers);
    } catch (error) {
      console.error('Export users error:', error);
      res.status(500).json({ message: 'Failed to export users' });
    }
  });

  apiRouter.get('/export/schools', async (req, res) => {
    try {
      const schools = await storage.getAllSchools();
      
      const format = req.query.format as string || 'json';
      
      if (format === 'csv') {
        const csv = Papa.unparse(schools);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="schools.csv"');
        return res.send(csv);
      } else if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(schools);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Schools');
        
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.header('Content-Disposition', 'attachment; filename="schools.xlsx"');
        return res.send(Buffer.from(excelBuffer));
      }
      
      // Default: JSON
      res.json(schools);
    } catch (error) {
      console.error('Export schools error:', error);
      res.status(500).json({ message: 'Failed to export schools' });
    }
  });

  apiRouter.get('/export/classes', async (req, res) => {
    try {
      const classes = await storage.getAllClasses();
      
      const format = req.query.format as string || 'json';
      
      if (format === 'csv') {
        const csv = Papa.unparse(classes);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="classes.csv"');
        return res.send(csv);
      } else if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(classes);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Classes');
        
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.header('Content-Disposition', 'attachment; filename="classes.xlsx"');
        return res.send(Buffer.from(excelBuffer));
      }
      
      // Default: JSON
      res.json(classes);
    } catch (error) {
      console.error('Export classes error:', error);
      res.status(500).json({ message: 'Failed to export classes' });
    }
  });

  apiRouter.get('/export/events', async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      
      const format = req.query.format as string || 'json';
      
      if (format === 'csv') {
        const csv = Papa.unparse(events);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="events.csv"');
        return res.send(csv);
      } else if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(events);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Events');
        
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.header('Content-Disposition', 'attachment; filename="events.xlsx"');
        return res.send(Buffer.from(excelBuffer));
      }
      
      // Default: JSON
      res.json(events);
    } catch (error) {
      console.error('Export events error:', error);
      res.status(500).json({ message: 'Failed to export events' });
    }
  });
  
  // Data import endpoints
  apiRouter.post('/import/users', upload.single('file'), async (req, res) => {
    try {
      // Create log directory if it doesn't exist
      if (!fs.existsSync('uploads/log')) {
        fs.mkdirSync('uploads/log', { recursive: true });
      }
      
      const logFilePath = 'uploads/log/import_users_debug.log';
      
      const logToFile = (message: string) => {
        fs.appendFileSync(logFilePath, `${new Date().toISOString()}: ${message}\n`);
      };
      
      logToFile('Starting user import process');
      
      if (!req.file) {
        logToFile('No file uploaded');
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      logToFile(`File uploaded: ${req.file.originalname}, extension: ${fileExtension}`);
      
      let data: any[] = [];
      
      if (fileExtension === '.csv') {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        logToFile(`CSV file content length: ${fileContent.length} characters`);
        const parseResult = Papa.parse(fileContent, { header: true });
        data = parseResult.data;
        logToFile(`Parsed ${data.length} rows from CSV file`);
        
        // Log a sample of the parsed data
        if (data.length > 0) {
          logToFile(`Sample data first row: ${JSON.stringify(data[0])}`);
        }
      } else if (fileExtension === '.xlsx') {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        logToFile(`Excel file, using sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
        logToFile(`Parsed ${data.length} rows from Excel file`);
      } else if (fileExtension === '.txt') {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        logToFile(`TXT file content length: ${fileContent.length} characters`);
        // Try to parse as JSON
        try {
          data = JSON.parse(fileContent);
          if (!Array.isArray(data)) {
            data = [data];
          }
          logToFile(`Parsed ${data.length} items from JSON content`);
        } catch (e) {
          logToFile(`JSON parsing failed, trying CSV: ${e.message}`);
          // Try to parse as CSV if JSON parsing fails
          const parseResult = Papa.parse(fileContent, { header: true });
          data = parseResult.data;
          logToFile(`Parsed ${data.length} rows as CSV`);
        }
      } else {
        logToFile(`Unsupported file format: ${fileExtension}`);
        return res.status(400).json({ message: 'Unsupported file format. Please upload CSV, XLSX, or TXT file' });
      }
      
      // Filter out empty rows (common in CSV files)
      data = data.filter(item => {
        // Check if the row has at least one non-empty value
        return Object.values(item).some(val => val !== '' && val !== undefined && val !== null);
      });
      
      logToFile(`After filtering empty rows: ${data.length} rows remain`);
      
      // Get schools and classes for reference
      const schools = await storage.getAllSchools();
      const classes = await storage.getAllClasses();
      logToFile(`Loaded ${schools.length} schools and ${classes.length} classes for reference`);
      
      // Validate and insert users
      const results = {
        success: 0,
        errors: [] as string[]
      };
      
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        logToFile(`Processing row ${i + 1}: ${JSON.stringify(item)}`);
        
        try {
          // Make sure required fields are present
          if (!item.username || !item.password || !item.fullName || !item.email || !item.role) {
            const missingFields = [];
            if (!item.username) missingFields.push('username');
            if (!item.password) missingFields.push('password');
            if (!item.fullName) missingFields.push('fullName');
            if (!item.email) missingFields.push('email');
            if (!item.role) missingFields.push('role');
            
            const errorMsg = `Row ${i + 1}: Missing required fields: ${missingFields.join(', ')}`;
            logToFile(errorMsg);
            results.errors.push(errorMsg);
            continue;
          }
          
          // Handle school name, class name, and grade level lookup
          let schoolId = item.schoolId ? Number(item.schoolId) : undefined;
          let classId = item.classId ? Number(item.classId) : undefined;
          
          logToFile(`Initial IDs - schoolId: ${schoolId}, classId: ${classId}`);
          
          // If schoolName is provided but schoolId is missing, look up the school
          if (item.schoolName && !schoolId) {
            logToFile(`Looking up school by name: ${item.schoolName}`);
            const foundSchool = schools.find(s => s.name === item.schoolName);
            if (foundSchool) {
              schoolId = foundSchool.id;
              logToFile(`Found school with ID: ${schoolId}`);
            } else {
              const errorMsg = `School name '${item.schoolName}' not found`;
              logToFile(errorMsg);
              results.errors.push(`Row ${i + 1}: ${errorMsg}`);
              continue;
            }
          }
          
          // If className is provided but classId is missing, look up the class
          if (item.className && !classId) {
            logToFile(`Looking up class by name: ${item.className}`);
            // Filter by school first if available
            let potentialClasses = classes;
            if (schoolId) {
              potentialClasses = classes.filter(c => c.schoolId === schoolId);
            }
            
            // Then by grade if available
            if (item.gradeLevel) {
              potentialClasses = potentialClasses.filter(c => c.gradeLevel === item.gradeLevel);
            }
            
            logToFile(`Filtered to ${potentialClasses.length} potential classes`);
            
            // Find the matching class name
            const foundClass = potentialClasses.find(c => c.name === item.className);
            
            if (foundClass) {
              classId = foundClass.id;
              logToFile(`Found class with ID: ${classId}`);
              // If school wasn't provided but we found the class, use its schoolId
              if (!schoolId) {
                schoolId = foundClass.schoolId;
                logToFile(`Using schoolId from class: ${schoolId}`);
              }
            } else {
              const errorMsg = `Class name '${item.className}' not found (school: ${item.schoolName}, grade: ${item.gradeLevel})`;
              logToFile(errorMsg);
              results.errors.push(`Row ${i + 1}: ${errorMsg}`);
              continue;
            }
          }
          
          // Normalize the role value to match our enum
          const normalizedRole = item.role.toLowerCase();
          if (!['student', 'teacher', 'admin'].includes(normalizedRole)) {
            const errorMsg = `Invalid role: ${item.role}. Must be one of: student, teacher, admin`;
            logToFile(errorMsg);
            results.errors.push(`Row ${i + 1}: ${errorMsg}`);
            continue;
          }
          
          // Set default values for missing fields if needed
          const userData = {
            username: item.username,
            password: item.password,
            fullName: item.fullName,
            email: item.email,
            role: normalizedRole as 'student' | 'teacher' | 'admin',
            isActive: item.isActive === 'false' ? false : true,
            schoolId: schoolId,
            classId: classId,
            // Use gradeLevel if present, otherwise try gradeId (for backward compatibility)
            gradeLevel: item.gradeLevel || item.gradeId || undefined
          };
          
          logToFile(`Prepared user data: ${JSON.stringify(userData)}`);
          
          // Check if username already exists
          const existingUser = await storage.getUserByUsername(userData.username);
          if (existingUser) {
            const errorMsg = `Username ${userData.username} already exists`;
            logToFile(errorMsg);
            results.errors.push(`Row ${i + 1}: ${errorMsg}`);
            continue;
          }
          
          // Create user
          try {
            const newUser = await storage.createUser(userData);
            logToFile(`Successfully created user with ID: ${newUser.id}`);
            results.success++;
          } catch (createError) {
            const errorMsg = `Failed to create user: ${createError.message}`;
            logToFile(errorMsg);
            results.errors.push(`Row ${i + 1}: ${errorMsg}`);
          }
        } catch (error) {
          let errorMessage = 'Invalid user data';
          if (error instanceof z.ZodError) {
            errorMessage = `Validation error: ${error.errors.map(e => e.message).join(', ')}`;
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          logToFile(`Error processing row ${i + 1}: ${errorMessage}`);
          results.errors.push(`Row ${i + 1}: ${errorMessage}`);
        }
      }
      
      const resultMsg = `Import completed: ${results.success} users imported successfully, ${results.errors.length} errors`;
      logToFile(resultMsg);
      logToFile(`Errors: ${JSON.stringify(results.errors)}`);
      
      // Keep the file for debugging
      // fs.unlinkSync(req.file.path);
      
      res.json({
        message: resultMsg,
        ...results
      });
    } catch (error) {
      console.error('Import users error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fs.appendFileSync('uploads/log/import_users_debug.log', `ERROR: ${errorMessage}\n`);
      res.status(500).json({ message: 'Failed to import users', error: errorMessage });
    }
  });
  
  apiRouter.post('/import/schools', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      let data: any[] = [];
      
      if (fileExtension === '.csv') {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        data = Papa.parse(fileContent, { header: true }).data;
      } else if (fileExtension === '.xlsx') {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      } else if (fileExtension === '.txt') {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        // Try to parse as JSON
        try {
          data = JSON.parse(fileContent);
          if (!Array.isArray(data)) {
            data = [data];
          }
        } catch (e) {
          // Try to parse as CSV if JSON parsing fails
          data = Papa.parse(fileContent, { header: true }).data;
        }
      } else {
        return res.status(400).json({ message: 'Unsupported file format. Please upload CSV, XLSX, or TXT file' });
      }
      
      // Remove file after processing
      fs.unlinkSync(req.file.path);
      
      // Validate and insert schools
      const results = {
        success: 0,
        errors: [] as string[]
      };
      
      for (const item of data) {
        try {
          // Validate school data
          insertSchoolSchema.parse(item);
          
          // Create school
          await storage.createSchool(item);
          results.success++;
        } catch (error) {
          let errorMessage = 'Invalid school data';
          if (error instanceof z.ZodError) {
            errorMessage = `Validation error: ${error.errors.map(e => e.message).join(', ')}`;
          }
          results.errors.push(`Row ${results.success + results.errors.length + 1}: ${errorMessage}`);
        }
      }
      
      res.json({
        message: `Import completed: ${results.success} schools imported successfully, ${results.errors.length} errors`,
        ...results
      });
    } catch (error) {
      console.error('Import schools error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to import schools', error: errorMessage });
    }
  });
  
  apiRouter.post('/import/classes', upload.single('file'), async (req, res) => {
    try {
      // Create log directory if it doesn't exist
      if (!fs.existsSync('uploads/log')) {
        fs.mkdirSync('uploads/log', { recursive: true });
      }
      
      const logFilePath = 'uploads/log/import_classes_debug.log';
      
      const logToFile = (message: string) => {
        fs.appendFileSync(logFilePath, `${new Date().toISOString()}: ${message}\n`);
      };
      
      logToFile('Starting class import process');
      
      if (!req.file) {
        logToFile('No file uploaded');
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      logToFile(`File uploaded: ${req.file.originalname}, extension: ${fileExtension}`);
      
      let data: any[] = [];
      
      if (fileExtension === '.csv') {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        logToFile(`CSV file content length: ${fileContent.length} characters`);
        const parseResult = Papa.parse(fileContent, { header: true });
        data = parseResult.data;
        logToFile(`Parsed ${data.length} rows from CSV file`);
        
        // Log a sample of the parsed data
        if (data.length > 0) {
          logToFile(`Sample data first row: ${JSON.stringify(data[0])}`);
        }
      } else if (fileExtension === '.xlsx') {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        logToFile(`Excel file, using sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
        logToFile(`Parsed ${data.length} rows from Excel file`);
      } else if (fileExtension === '.txt') {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        logToFile(`TXT file content length: ${fileContent.length} characters`);
        // Try to parse as JSON
        try {
          data = JSON.parse(fileContent);
          if (!Array.isArray(data)) {
            data = [data];
          }
          logToFile(`Parsed ${data.length} items from JSON content`);
        } catch (e) {
          logToFile(`JSON parsing failed, trying CSV: ${e.message}`);
          // Try to parse as CSV if JSON parsing fails
          const parseResult = Papa.parse(fileContent, { header: true });
          data = parseResult.data;
          logToFile(`Parsed ${data.length} rows as CSV`);
        }
      } else {
        logToFile(`Unsupported file format: ${fileExtension}`);
        return res.status(400).json({ message: 'Unsupported file format. Please upload CSV, XLSX, or TXT file' });
      }
      
      // Filter out empty rows (common in CSV files)
      data = data.filter(item => {
        // Check if the row has at least one non-empty value
        return Object.values(item).some(val => val !== '' && val !== undefined && val !== null);
      });
      
      logToFile(`After filtering empty rows: ${data.length} rows remain`);
      
      // Get schools and teachers for reference
      const schools = await storage.getAllSchools();
      const teachers = await storage.getUsersByRole('teacher');
      logToFile(`Loaded ${schools.length} schools and ${teachers.length} teachers for reference`);
      
      // Validate and insert classes
      const results = {
        success: 0,
        errors: [] as string[]
      };
      
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        logToFile(`Processing row ${i + 1}: ${JSON.stringify(item)}`);
        
        try {
          // Make sure required fields are present
          if (!item.name || !item.gradeLevel || (!item.schoolId && !item.schoolName) || 
              (!item.teacherId && !item.teacherUsername)) {
            const missingFields = [];
            if (!item.name) missingFields.push('name');
            if (!item.gradeLevel) missingFields.push('gradeLevel');
            if (!item.schoolId && !item.schoolName) missingFields.push('schoolId or schoolName');
            if (!item.teacherId && !item.teacherUsername) missingFields.push('teacherId or teacherUsername');
            
            const errorMsg = `Missing required fields: ${missingFields.join(', ')}`;
            logToFile(errorMsg);
            results.errors.push(`Row ${i + 1}: ${errorMsg}`);
            continue;
          }
          
          // Handle schoolId and teacherId resolution
          let schoolId = item.schoolId ? Number(item.schoolId) : undefined;
          let teacherId = item.teacherId ? Number(item.teacherId) : undefined;
          
          logToFile(`Initial IDs - schoolId: ${schoolId}, teacherId: ${teacherId}`);
          
          // Resolve school by name if needed
          if (!schoolId && item.schoolName) {
            logToFile(`Looking up school by name: ${item.schoolName}`);
            const foundSchool = schools.find(s => s.name === item.schoolName);
            if (foundSchool) {
              schoolId = foundSchool.id;
              logToFile(`Found school with ID: ${schoolId}`);
            } else {
              const errorMsg = `School name '${item.schoolName}' not found`;
              logToFile(errorMsg);
              results.errors.push(`Row ${i + 1}: ${errorMsg}`);
              continue;
            }
          }
          
          // Resolve teacher by username if needed
          if (!teacherId && item.teacherUsername) {
            logToFile(`Looking up teacher by username: ${item.teacherUsername}`);
            const foundTeacher = teachers.find(t => t.username === item.teacherUsername);
            if (foundTeacher) {
              teacherId = foundTeacher.id;
              logToFile(`Found teacher with ID: ${teacherId}`);
            } else {
              const errorMsg = `Teacher username '${item.teacherUsername}' not found`;
              logToFile(errorMsg);
              results.errors.push(`Row ${i + 1}: ${errorMsg}`);
              continue;
            }
          }
          
          // Convert string IDs to numbers if needed
          const classData = {
            name: item.name.trim(),
            gradeLevel: item.gradeLevel.trim(),
            schoolId: schoolId as number,
            teacherId: teacherId as number,
            isLocked: item.isLocked === 'true' || item.isLocked === true
          };
          
          logToFile(`Prepared class data: ${JSON.stringify(classData)}`);
          
          // Check if school exists
          const school = await storage.getSchool(classData.schoolId);
          if (!school) {
            const errorMsg = `School with ID ${classData.schoolId} not found`;
            logToFile(errorMsg);
            results.errors.push(`Row ${i + 1}: ${errorMsg}`);
            continue;
          }
          
          // Check if teacher exists
          const teacher = await storage.getUser(classData.teacherId);
          if (!teacher) {
            const errorMsg = `Teacher with ID ${classData.teacherId} not found`;
            logToFile(errorMsg);
            results.errors.push(`Row ${i + 1}: ${errorMsg}`);
            continue;
          }
          
          // Allow admin users to be assigned as teachers as well
          if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
            const errorMsg = `User with ID ${classData.teacherId} must be a teacher or admin (current role: ${teacher.role})`;
            logToFile(errorMsg);
            results.errors.push(`Row ${i + 1}: ${errorMsg}`);
            continue;
          }
          
          // Create class
          try {
            const newClass = await storage.createClass(classData);
            logToFile(`Successfully created class with ID: ${newClass.id}`);
            results.success++;
          } catch (createError) {
            const errorMsg = `Failed to create class: ${createError.message}`;
            logToFile(errorMsg);
            results.errors.push(`Row ${i + 1}: ${errorMsg}`);
          }
        } catch (error) {
          let errorMessage = 'Invalid class data';
          if (error instanceof z.ZodError) {
            errorMessage = `Validation error: ${error.errors.map(e => e.message).join(', ')}`;
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          logToFile(`Error processing row ${i + 1}: ${errorMessage}`);
          results.errors.push(`Row ${i + 1}: ${errorMessage}`);
        }
      }
      
      const resultMsg = `Import completed: ${results.success} classes imported successfully, ${results.errors.length} errors`;
      logToFile(resultMsg);
      logToFile(`Errors: ${JSON.stringify(results.errors)}`);
      
      // Keep the file for debugging
      // fs.unlinkSync(req.file.path);
      
      res.json({
        message: resultMsg,
        ...results
      });
    } catch (error) {
      console.error('Import classes error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fs.appendFileSync('uploads/log/import_classes_debug.log', `ERROR: ${errorMessage}\n`);
      res.status(500).json({ message: 'Failed to import classes', error: errorMessage });
    }
  });
  
  // Export endpoints
  apiRouter.get('/export/:entity/:format', async (req, res) => {
    try {
      const { entity, format } = req.params;
      let data: any[] = [];

      // Get the data based on the entity
      switch(entity) {
        case 'users':
          const users = await storage.getAllUsers();
          const schools = await storage.getAllSchools();
          const classes = await storage.getAllClasses();
          
          // Include School ID, Class ID, Grade ID, and Password information for students
          data = users.map(user => {
            // Find school and class information
            const userSchool = schools.find(s => s.id === user.schoolId);
            const userClass = classes.find(c => c.id === user.classId);
            
            // Create enhanced user object with additional fields
            return {
              ...user,
              // Include IDs instead of names
              schoolId: user.schoolId || '',
              classId: user.classId || '',
              // Include both fields for compatibility with import process
              gradeLevel: user.gradeLevel || (userClass ? userClass.gradeLevel : ''),
              gradeId: userClass ? userClass.gradeLevel : '',
              // Include password for import/export functionality
              password: user.password || ''
            };
          });
          break;
        case 'schools':
          data = await storage.getAllSchools();
          break;
        case 'classes':
          data = await storage.getAllClasses();
          break;
        case 'events':
          data = await storage.getAllEvents();
          break;
        default:
          return res.status(400).json({ message: 'Invalid entity type' });
      }

      // Format the data based on the requested format
      switch(format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename=${entity}.json`);
          return res.json(data);
        
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=${entity}.csv`);
          // Convert data to CSV
          const csv = Papa.unparse(data);
          return res.send(csv);
        
        case 'xlsx':
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=${entity}.xlsx`);
          
          // Create workbook
          const workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.json_to_sheet(data);
          
          // Add worksheet to workbook
          XLSX.utils.book_append_sheet(workbook, worksheet, entity);
          
          // Write to buffer and send
          const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          return res.send(buffer);
        
        default:
          return res.status(400).json({ message: 'Invalid format' });
      }
    } catch (error) {
      console.error(`Export ${req.params.entity} error:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: `Failed to export ${req.params.entity}`, error: errorMessage });
    }
  });

  apiRouter.post('/import/events', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      let data: any[] = [];
      
      if (fileExtension === '.csv') {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        data = Papa.parse(fileContent, { header: true }).data;
      } else if (fileExtension === '.xlsx') {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      } else if (fileExtension === '.txt') {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        // Try to parse as JSON
        try {
          data = JSON.parse(fileContent);
          if (!Array.isArray(data)) {
            data = [data];
          }
        } catch (e) {
          // Try to parse as CSV if JSON parsing fails
          data = Papa.parse(fileContent, { header: true }).data;
        }
      } else {
        return res.status(400).json({ message: 'Unsupported file format. Please upload CSV, XLSX, or TXT file' });
      }
      
      // Remove file after processing
      fs.unlinkSync(req.file.path);
      
      // Validate and insert events
      const results = {
        success: 0,
        errors: [] as string[]
      };
      
      for (const item of data) {
        try {
          // Handle date strings conversion
          const eventData = {
            ...item,
            startDate: item.startDate ? new Date(item.startDate) : undefined,
            endDate: item.endDate ? new Date(item.endDate) : undefined
          };
          
          // Validate event data
          insertEventSchema.parse(eventData);
          
          // Create event
          await storage.createEvent(eventData);
          results.success++;
        } catch (error) {
          let errorMessage = 'Invalid event data';
          if (error instanceof z.ZodError) {
            errorMessage = `Validation error: ${error.errors.map(e => e.message).join(', ')}`;
          }
          results.errors.push(`Row ${results.success + results.errors.length + 1}: ${errorMessage}`);
        }
      }
      
      res.json({
        message: `Import completed: ${results.success} events imported successfully, ${results.errors.length} errors`,
        ...results
      });
    } catch (error) {
      console.error('Import events error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to import events', error: errorMessage });
    }
  });

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // API endpoint to get participants for a specific event
  apiRouter.get('/events/:eventId/participants', async (req, res) => {
    try {
      const eventId = Number(req.params.eventId);
      
      // Get event details first
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      // Get all registrations for this event
      const registrations = await storage.getRegistrationsByEvent(eventId);
      
      if (!registrations || registrations.length === 0) {
        return res.json([]);
      }
      
      // Get user IDs from registrations
      const userIds = registrations.map(r => r.userId);
      
      // Get all users, schools, and classes for efficiency
      const allUsers = await storage.getAllUsers();
      const allSchools = await storage.getAllSchools();
      const allClasses = await storage.getAllClasses();
      
      // Get all submissions for this event
      const eventSubmissions = await storage.getSubmissionsByEvent(eventId);
      
      // Format participant data
      const participants = userIds.map(userId => {
        const user = allUsers.find(u => u.id === userId);
        if (!user) return null;
        
        // Find user's school and class
        const school = allSchools.find(s => s.id === user.schoolId);
        const classInfo = allClasses.find(c => c.id === user.classId);
        
        // Find registration for this user
        const registration = registrations.find(r => r.userId === userId);
        
        // Check if user has submitted
        const submission = eventSubmissions.find(s => s.userId === userId);
        const hasSubmitted = !!submission;
        
        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          schoolId: user.schoolId,
          schoolName: school ? school.name : 'Unknown',
          classId: user.classId,
          className: classInfo ? classInfo.name : 'Unknown',
          gradeLevel: user.gradeLevel || classInfo?.gradeLevel || 'Unknown',
          registrationDate: registration?.registeredAt,
          hasSubmitted,
          submissionId: submission?.id || null
        };
      }).filter(Boolean);
      
      res.json(participants);
    } catch (error) {
      console.error('Error fetching participants:', error);
      res.status(500).json({ message: 'Failed to fetch participants' });
    }
  });
  
  // Send reminder email to a participant who hasn't submitted yet
  apiRouter.post('/events/:eventId/reminder', async (req, res) => {
    try {
      const eventId = Number(req.params.eventId);
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      // Get event details
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if user has a submission for this event
      const userSubmissions = await storage.getSubmissionsByUserAndEvent(userId, eventId);
      if (userSubmissions.length > 0) {
        return res.status(400).json({ message: 'User has already submitted for this event' });
      }
      
      // In a real application, this would send an email
      // For this example, we'll just log it and return success
      console.log(`Sending reminder email to ${user.fullName} (${user.email}) for event "${event.name}"`);
      
      // If the application had actual email sending, it would be implemented here
      
      res.status(200).json({ 
        message: 'Reminder sent successfully',
        details: {
          user: {
            id: user.id,
            email: user.email,
            name: user.fullName
          },
          event: {
            id: event.id,
            name: event.name
          },
          sentAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error sending reminder:', error);
      res.status(500).json({ message: 'Failed to send reminder' });
    }
  });

  // Setup upload routes
  setupUploadRoutes(apiRouter);

  // Register API routes
  app.use('/api', apiRouter);

  // Setup static file serving for uploads
  setupStaticUploads(app);

  const httpServer = createServer(app);
  return httpServer;
}
