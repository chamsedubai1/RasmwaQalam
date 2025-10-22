import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import { z } from "zod";
import * as anthropic from "./anthropic";
import { generateText as generateHuggingFaceText, generateImage as generateHuggingFaceImage } from "./huggingface";
import { generateImage as generateStabilityImage } from "./stability";
import multer from "multer";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";
import { setupUploadRoutes, setupStaticUploads } from "./uploads";
import session from "express-session";
import { generateCaptcha, validateCaptcha, requireCaptcha, captchaStore } from "./captcha";
import crypto from "crypto";
import { performance } from "perf_hooks";
import { monitoring } from "./monitoring";
import { setupWebSocketServer, sendToChannel, broadcast } from "./services/websocket";
import { 
  loginRateLimiter, 
  registrationRateLimiter, 
  passwordResetRateLimiter, 
  apiRateLimiter,
  hashPassword,
  verifyPassword,
  generateAuthTokens,
  authenticateToken,
  requireRole,
  verifyDatabaseRefreshToken,
  revokeRefreshTokenById,
  revokeAllUserRefreshTokensDb,
  COOKIE_CONFIG
} from "./security";
import { validateCsrfToken } from "./csrf";

// AI service selection
const AI_SERVICE = {
  OPENAI: 'openai',
  CLAUDE: 'claude',
  HUGGING_FACE: 'huggingface',
  STABILITY: 'stability'
};

// Default AI service to use for text generation
const DEFAULT_TEXT_SERVICE = AI_SERVICE.CLAUDE;

// Default AI service to use for image generation
const DEFAULT_IMAGE_SERVICE = AI_SERVICE.STABILITY;
import { 
  insertUserSchema,
  insertSchoolSchema,
  insertClassSchema,
  insertPartnerSchema,
  insertEventSchema,
  insertRegistrationSchema,
  insertSubmissionSchema,
  insertVoteSchema,
  insertSecondaryTeacherAssignmentSchema,
  insertGalleryItemSchema,
  Submission,
  School,
  Class,
  SecondaryTeacherAssignment,
  GalleryItem
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes - all prefixed with /api
  const apiRouter = express.Router();
  
  // Apply general rate limiting to all API routes
  apiRouter.use(apiRateLimiter);
  
  // SECURITY ENHANCEMENT: Apply CSRF protection to all state-changing routes
  // This validates CSRF tokens on POST, PUT, PATCH, DELETE requests
  apiRouter.use(validateCsrfToken);
  
  // Auth and user-related routes
  // SECURE JWT-based login endpoint - replaces insecure username:timestamp system
  apiRouter.post('/auth/login', loginRateLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // Log login attempt for security auditing (but not sensitive details)
    console.log(`Login attempt from IP: ${req.ip || 'unknown'}`);
    
    try {
      const user = await storage.getUserByUsername(username);
      
      // Enhanced security - no different error messages for non-existent user vs wrong password
      // This prevents username enumeration attacks
      if (!user) {
        // Add a small delay to prevent timing attacks that could determine if a username exists
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // SECURITY FIX: Remove plaintext password fallback (architect's critical finding)
      // Only accept properly hashed passwords
      if (!user.password.includes('.')) {
        // Force password reset for users with old plaintext passwords
        console.log(`User ${username} has insecure password format - forcing reset`);
        return res.status(403).json({ 
          message: 'Password reset required for security. Please use the forgot password feature.',
          code: 'PASSWORD_RESET_REQUIRED'
        });
      }
      
      // Verify password using secure hashing
      const isPasswordValid = await verifyPassword(password, user.password);
      
      if (!isPasswordValid) {
        // For security, log failed attempts (but not username)
        console.log(`Failed login attempt from IP: ${req.ip || 'unknown'}`);
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      if (!user.isActive) {
        // Provide specific message for school admin accounts awaiting approval
        if (user.role === 'schoolAdmin') {
          return res.status(403).json({ 
            message: 'Your School Admin account is pending approval from the system administrator. Please check back later.' 
          });
        }
        return res.status(403).json({ message: 'Account is locked or inactive' });
      }
      
      // Generate secure JWT tokens
      const authTokens = await generateAuthTokens(user);
      
      // Update the last login date
      const updatedUser = await storage.updateUser(user.id, { 
        lastLoginDate: new Date() 
      });
      
      if (!updatedUser) {
        console.error('Failed to update lastLoginDate for user:', user.id);
      }
      
      // Log successful login (without sensitive data)
      console.log(`Successful login from IP: ${req.ip || 'unknown'}`);
      
      // SECURITY ENHANCEMENT: Set tokens in httpOnly cookies (XSS-safe)
      res.cookie(COOKIE_CONFIG.ACCESS_TOKEN, authTokens.accessToken, {
        ...COOKIE_CONFIG.OPTIONS,
        maxAge: COOKIE_CONFIG.ACCESS_MAX_AGE,
      });
      
      res.cookie(COOKIE_CONFIG.REFRESH_TOKEN, authTokens.refreshToken, {
        ...COOKIE_CONFIG.OPTIONS,
        maxAge: COOKIE_CONFIG.REFRESH_MAX_AGE,
      });
      
      // Return user data without password (tokens now in cookies)
      const { password: _, ...userWithoutPassword } = updatedUser || user;
      res.json({
        user: userWithoutPassword,
        expiresIn: authTokens.expiresIn
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Get current authenticated user - now using secure JWT authentication
  apiRouter.get('/user', authenticateToken, async (req, res) => {
    try {
      // User data is already validated and attached by authenticateToken middleware
      const user = (req as any).user;
      
      res.status(200).json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Server error retrieving user data" });
    }
  });
  
  // SECURE Token refresh endpoint with rotation and database validation
  apiRouter.post('/auth/refresh', async (req, res) => {
    try {
      // SECURITY ENHANCEMENT: Read refresh token from httpOnly cookie (or body fallback)
      const refreshToken = req.cookies?.[COOKIE_CONFIG.REFRESH_TOKEN] || req.body.refreshToken;
      
      if (!refreshToken) {
        return res.status(400).json({ 
          message: 'Refresh token required',
          code: 'MISSING_REFRESH_TOKEN'
        });
      }
      
      // SECURITY: Verify refresh token from database (not just JWT)
      const tokenData = await verifyDatabaseRefreshToken(refreshToken);
      
      if (!tokenData) {
        return res.status(401).json({ 
          message: 'Invalid, expired, or revoked refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }
      
      // Get user data
      const user = await storage.getUser(tokenData.userId);
      
      if (!user || !user.isActive) {
        return res.status(401).json({ 
          message: 'User account not found or inactive',
          code: 'USER_INACTIVE'
        });
      }
      
      // SECURITY: Revoke the old refresh token (rotation)
      const revoked = await revokeRefreshTokenById(tokenData.tokenId, 'rotation');
      
      if (!revoked) {
        console.warn(`Failed to revoke refresh token ${tokenData.tokenId} during rotation`);
      }
      
      // Generate new tokens (automatically stores new refresh token in database)
      const authTokens = await generateAuthTokens(user);
      
      console.log(`Token rotation successful for user ${user.id}: old token revoked, new token issued`);
      
      // SECURITY ENHANCEMENT: Set new tokens in httpOnly cookies
      res.cookie(COOKIE_CONFIG.ACCESS_TOKEN, authTokens.accessToken, {
        ...COOKIE_CONFIG.OPTIONS,
        maxAge: COOKIE_CONFIG.ACCESS_MAX_AGE,
      });
      
      res.cookie(COOKIE_CONFIG.REFRESH_TOKEN, authTokens.refreshToken, {
        ...COOKIE_CONFIG.OPTIONS,
        maxAge: COOKIE_CONFIG.REFRESH_MAX_AGE,
      });
      
      res.json({
        expiresIn: authTokens.expiresIn
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ 
        message: 'Server error during token refresh',
        code: 'REFRESH_ERROR'
      });
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
        // Provide specific message for school admin accounts awaiting approval
        if (user.role === 'schoolAdmin') {
          return res.status(403).json({ 
            message: 'Your School Admin account is pending approval from the system administrator. Please check back later.' 
          });
        }
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
  // Logout endpoint with token revocation and cookie clearing
  apiRouter.post('/auth/logout', authenticateToken, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // SECURITY ENHANCEMENT: Revoke all user's refresh tokens in database
      const revokedCount = await revokeAllUserRefreshTokensDb(user.id, 'user_logout');
      console.log(`Logout: Revoked ${revokedCount} refresh tokens for user ${user.id}`);
      
      // SECURITY ENHANCEMENT: Clear httpOnly cookies
      res.clearCookie(COOKIE_CONFIG.ACCESS_TOKEN, COOKIE_CONFIG.OPTIONS);
      res.clearCookie(COOKIE_CONFIG.REFRESH_TOKEN, COOKIE_CONFIG.OPTIONS);
      
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
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
      
      // Hash the new password before saving it
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the user's password with the hashed version
      await storage.updateUser(userId, {
        ...user,
        password: hashedPassword
      });
      
      return res.status(200).json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  apiRouter.post('/auth/register', registrationRateLimiter, requireCaptcha, async (req, res) => {
    try {
      // Log registration attempt for security auditing
      console.log(`Registration attempt from IP: ${req.ip || 'unknown'}, role: ${req.body.role || 'unknown'}`);
      
      // Determine if the user should be active by default
      // For schoolAdmin role, set isActive to false (requires admin approval)
      const isActiveByDefault = req.body.role === 'schoolAdmin' ? false : true;
      
      // Validate the user data
      const userData = insertUserSchema.parse({
        ...req.body,
        isActive: isActiveByDefault // Set active status based on role
      });
      
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(userData.username);
      if (existingUsername) {
        // Log security event
        console.log(`Registration rejected - duplicate username "${userData.username}" from IP: ${req.ip || 'unknown'}`);
        return res.status(409).json({ 
          message: 'Username already exists. Please choose a different username.',
          field: 'username'
        });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        // Log security event
        console.log(`Registration rejected - duplicate email "${userData.email}" from IP: ${req.ip || 'unknown'}`);
        return res.status(409).json({ 
          message: 'Email already exists. Please use a different email address.',
          field: 'email'
        });
      }
      
      // School Admin requires a school ID
      if (userData.role === 'schoolAdmin' && !userData.schoolId) {
        return res.status(400).json({
          message: 'School Admin accounts must be associated with a school.',
          field: 'schoolId'
        });
      }
      
      // Check if the class is locked for new registrations (only for student role)
      if (userData.role === 'student' && userData.classId) {
        const classData = await storage.getClass(userData.classId);
        if (classData && classData.isLocked) {
          return res.status(403).json({
            message: 'This class is currently locked for new registrations. Please contact your teacher.',
            field: 'classId'
          });
        }
      }
      
      // For teachers, check if teacher is already assigned to a class
      if (userData.role === 'teacher' && userData.classId) {
        // We can't check teacher classes here since user doesn't have an ID yet
        // This check is handled after the user is created when updating the class
      }
      
      // Hash the password before storing it
      const hashedPassword = await hashPassword(userData.password);
      
      // Create the user with the hashed password
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Log successful registration
      console.log(`User registered successfully: ${userData.username}, role: ${userData.role}, IP: ${req.ip || 'unknown'}`);
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      
      // Special message for school admin registrations
      if (userData.role === 'schoolAdmin') {
        return res.status(201).json({
          ...userWithoutPassword,
          message: "Your School Admin account has been created but requires approval from the system administrator before you can log in."
        });
      }
      
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
        // If role is provided, check if it's a comma-separated list
        if (typeof role === 'string' && role.includes(',')) {
          // Handle multiple roles (e.g., "teacher,secondaryTeacher")
          const roles = role.split(',').map(r => r.trim());
          const usersByRole = await Promise.all(
            roles.map(r => storage.getUsersByRole(r))
          );
          // Flatten the array of arrays and remove duplicates
          users = Array.from(new Set(usersByRole.flat().map(u => u.id)))
            .map(id => usersByRole.flat().find(u => u.id === id));
        } else {
          // Single role
          users = await storage.getUsersByRole(String(role));
        }
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
      
      // Hash the password for secure storage
      const hashedPassword = await hashPassword(userData.password);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
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
      
      // If password is being updated, hash it first
      let updateData = { ...req.body };
      
      if (updateData.password) {
        // Hash the new password
        const hashedPassword = await hashPassword(updateData.password);
        updateData.password = hashedPassword;
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
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
  
  // City routes
  apiRouter.get('/cities', async (req, res) => {
    try {
      // Get the showInactive parameter, default to false if not provided
      const showInactive = req.query.showInactive === 'true';
      
      // Get cities based on showInactive parameter
      let cities;
      if (showInactive) {
        cities = await storage.getAllCities();
      } else {
        cities = await storage.getActiveCities();
      }
      
      res.json(cities);
    } catch (error) {
      console.error('Error fetching cities:', error);
      res.status(500).json({ message: 'Failed to fetch cities' });
    }
  });
  
  apiRouter.get('/cities/:id', async (req, res) => {
    try {
      const city = await storage.getCity(parseInt(req.params.id));
      if (!city) {
        return res.status(404).json({ message: 'City not found' });
      }
      res.json(city);
    } catch (error) {
      console.error('Error fetching city:', error);
      res.status(500).json({ message: 'Failed to fetch city' });
    }
  });
  
  apiRouter.post('/cities', async (req, res) => {
    try {
      const newCity = await storage.createCity(req.body);
      res.status(201).json(newCity);
    } catch (error) {
      console.error('Error creating city:', error);
      res.status(500).json({ message: 'Failed to create city' });
    }
  });
  
  apiRouter.patch('/cities/:id', async (req, res) => {
    try {
      const updatedCity = await storage.updateCity(parseInt(req.params.id), req.body);
      if (!updatedCity) {
        return res.status(404).json({ message: 'City not found' });
      }
      res.json(updatedCity);
    } catch (error) {
      console.error('Error updating city:', error);
      res.status(500).json({ message: 'Failed to update city' });
    }
  });
  
  apiRouter.delete('/cities/:id', async (req, res) => {
    try {
      const result = await storage.deleteCity(parseInt(req.params.id));
      if (!result) {
        return res.status(404).json({ message: 'City not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting city:', error);
      res.status(500).json({ message: 'Failed to delete city' });
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
      
      // Enhance class data with related entities
      const enhancedClasses = await Promise.all(classes.map(async (cls) => {
        const school = cls.schoolId ? await storage.getSchool(cls.schoolId) : null;
        const teacher = cls.teacherId ? await storage.getUser(cls.teacherId) : null;
        
        // Get secondary teacher assignments for this class
        const secondaryTeacherAssignments = await storage.getSecondaryTeacherAssignmentsByClass(cls.id);
        
        // Get secondary teachers information
        const secondaryTeachers = await Promise.all(
          secondaryTeacherAssignments.map(async (assignment) => {
            const teacher = await storage.getUser(assignment.secondaryTeacherId);
            return {
              id: assignment.id,
              teacherId: assignment.secondaryTeacherId,
              teacherName: teacher ? teacher.fullName : 'Unknown',
              assignedAt: assignment.assignedAt,
              isActive: assignment.isActive
            };
          })
        );
        
        // Get students count in this class
        const students = await storage.getUsersByClass(cls.id);
        
        return {
          ...cls,
          school: school ? {
            id: school.id,
            name: school.name
          } : null,
          schoolName: school ? school.name : null,
          teacher: teacher ? {
            id: teacher.id,
            fullName: teacher.fullName,
            email: teacher.email
          } : null,
          teacherName: teacher ? teacher.fullName : null,
          secondaryTeachers: secondaryTeachers,
          studentCount: students.length
        };
      }));
      
      res.json(enhancedClasses);
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
      
      // Get related school and teacher information
      const school = classData.schoolId ? await storage.getSchool(classData.schoolId) : null;
      const teacher = classData.teacherId ? await storage.getUser(classData.teacherId) : null;
      
      // Get secondary teacher assignments for this class
      const secondaryTeacherAssignments = await storage.getSecondaryTeacherAssignmentsByClass(classData.id);
      
      // Get secondary teachers information
      const secondaryTeachers = await Promise.all(
        secondaryTeacherAssignments.map(async (assignment) => {
          const teacher = await storage.getUser(assignment.secondaryTeacherId);
          return {
            id: assignment.id,
            teacherId: assignment.secondaryTeacherId,
            teacherName: teacher ? teacher.fullName : 'Unknown',
            assignedAt: assignment.assignedAt,
            isActive: assignment.isActive
          };
        })
      );
      
      // Get students in this class
      const students = await storage.getUsersByClass(classData.id);
      
      // Enhanced class data with additional information
      const enhancedClassData = {
        ...classData,
        school: school ? {
          id: school.id,
          name: school.name
        } : null,
        schoolName: school ? school.name : null,
        teacher: teacher ? {
          id: teacher.id,
          fullName: teacher.fullName,
          email: teacher.email
        } : null,
        teacherName: teacher ? teacher.fullName : null,
        secondaryTeachers: secondaryTeachers,
        studentCount: students.length,
        // Student details (without sensitive information)
        students: students.map(student => ({
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          gradeLevel: student.gradeLevel
        }))
      };
      
      res.json(enhancedClassData);
    } catch (error) {
      console.error('Error fetching class details:', error);
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
      const includeDisabled = req.query.includeDisabled === 'true';
      // Admin routes will explicitly set includeDisabled=true to see all events
      // For the main events page, disabled events will be filtered out
      
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
      
      // Filter out disabled events unless specifically requested to include them
      if (!includeDisabled) {
        events = events.filter(event => event.isEnabled !== false);
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
      
      // Send WebSocket notification about new event
      broadcast('EVENT_UPDATE', { 
        action: 'created', 
        event: event
      });
      
      // Also notify admin channel
      sendToChannel('admin', 'EVENT_UPDATE', { 
        action: 'created', 
        event: event
      });
      
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
      
      // Make sure we explicitly handle isEnabled flag
      const updateData = {
        ...req.body,
        // Ensure isEnabled is treated as a boolean
        isEnabled: req.body.isEnabled === true || req.body.isEnabled === 'true',
      };
      
      console.log('Updating event with data:', updateData);
      const updatedEvent = await storage.updateEvent(eventId, updateData);
      
      // Send WebSocket notification about event update
      broadcast('EVENT_UPDATE', { 
        action: 'updated', 
        event: updatedEvent
      });
      
      // Also notify admin channel
      sendToChannel('admin', 'EVENT_UPDATE', { 
        action: 'updated', 
        event: updatedEvent
      });
      
      // Force a refresh of the events cache to ensure consistent data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.json(updatedEvent);
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ message: 'Failed to update event' });
    }
  });
  
  apiRouter.delete('/events/:id', async (req, res) => {
    try {
      const eventId = Number(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      const deleted = await storage.deleteEvent(eventId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Event deletion failed' });
      }
      
      // Send WebSocket notification about event deletion
      broadcast('EVENT_UPDATE', { 
        action: 'deleted', 
        eventId: eventId,
        eventName: event.name
      });
      
      // Also notify admin channel
      sendToChannel('admin', 'EVENT_UPDATE', { 
        action: 'deleted', 
        eventId: eventId,
        eventName: event.name
      });
      
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
      
      // Check if event stage is explicitly provided in the query parameters
      const requestedEventStage = req.query.currentEventStage as string;
      
      // Check if we want a specific historical stage different from the current event stage
      // This is used to view voting history from previous stages
      const requestedStage = req.query.requestedStage as string;
      
      // Get current event to determine voting stage
      let currentEvent = eventId ? await storage.getEvent(eventId) : null;
      
      // Use the requested stage if provided, otherwise use the event's stage, or fall back to 'class'
      let currentEventStage = requestedEventStage || (currentEvent ? currentEvent.stage : 'class');
      
      // For historical voting stages, we need to know the actual event stage to properly show voting history
      const isHistoricalView = requestedStage && requestedStage !== currentEventStage;
      
      console.log('Submissions query params:', { 
        userId, eventId, classId, forVoting, currentUserId, currentEventStage,
        requestedStage,
        actualEventStage: currentEvent?.stage 
      });
      
      let submissions;
      
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
          } else if (req.query.rejected === 'true') {
            console.log(`Looking for rejected submissions in class ${classId}`);
            submissions = await storage.getRejectedSubmissions(classId);
            console.log(`Found ${submissions.length} rejected submissions`);
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
        
        // Apply validation filters if specified
        if (req.query.pending === 'true') {
          console.log('Filtering event submissions: pending validation only');
          submissions = submissions.filter(sub => sub.validated === null);
          console.log(`Found ${submissions.length} pending submissions for event ${eventId}`);
        } else if (req.query.validated === 'true') {
          console.log('Filtering event submissions: validated only');
          submissions = submissions.filter(sub => sub.validated === true);
          console.log(`Found ${submissions.length} validated submissions for event ${eventId}`);
        } else if (req.query.rejected === 'true') {
          console.log('Filtering event submissions: rejected only');
          submissions = submissions.filter(sub => sub.validated === false);
          console.log(`Found ${submissions.length} rejected submissions for event ${eventId}`);
        }
        
        // If this is for voting purposes and we have a current user ID
        if (forVoting && currentUserId) {
          // Get current user information first
          const currentUser = await storage.getUser(currentUserId);
          console.log('Current user:', currentUser);
          
          if (!currentUser) {
            return res.status(400).json({ message: 'Invalid user ID' });
          }

          // Get current event to determine its stage
          console.log(`Current event stage from request: ${currentEventStage}`);
          
          // Check if we have a request for a specific voting stage (might be different from current event stage)
          // This is used for viewing voting history from previous stages
          const stageToUseForFiltering = requestedStage || currentEventStage;
          
          // 1. CRITICAL FIX: Apply winner status filtering FIRST based on the stage
          // This ensures only winners from previous stages are shown
          if (stageToUseForFiltering === 'school') {
            // In school stage, only show class winners from previous stage
            // Get ALL submissions for this event, not just from user's class
            if (currentEvent) {
              // First get all current submissions across all classes/schools
              const allEventSubmissions = await storage.getSubmissionsByEvent(eventId);
              console.log(`SCHOOL STAGE IMPROVEMENT: Retrieved all ${allEventSubmissions.length} submissions for event`);
              
              // Then filter to only class winners
              const beforeFilter = allEventSubmissions.length;
              submissions = allEventSubmissions.filter(sub => sub.classWinner === true);
              console.log(`CRITICAL FILTER: Filtered to only class winners: ${beforeFilter} -> ${submissions.length}`);
            } else {
              // Fallback to previous behavior if no event (shouldn't happen)
              const beforeFilter = submissions.length;
              submissions = submissions.filter(sub => sub.classWinner === true);
              console.log(`CRITICAL FILTER: Filtered to only class winners: ${beforeFilter} -> ${submissions.length}`);
            }
          } else if (stageToUseForFiltering === 'country') {
            // In country stage, only show school winners from previous stage
            // Same improvement as for school stage - get ALL submissions for this event across all schools
            if (currentEvent) {
              // First get all current submissions across all classes/schools
              const allEventSubmissions = await storage.getSubmissionsByEvent(eventId);
              console.log(`COUNTRY STAGE IMPROVEMENT: Retrieved all ${allEventSubmissions.length} submissions for event`);
              
              // Then filter to only school winners
              const beforeFilter = allEventSubmissions.length;
              submissions = allEventSubmissions.filter(sub => sub.schoolWinner === true);
              console.log(`CRITICAL FILTER: Filtered to only school winners: ${beforeFilter} -> ${submissions.length}`);
            } else {
              // Fallback to previous behavior if no event (shouldn't happen)
              const beforeFilter = submissions.length;
              submissions = submissions.filter(sub => sub.schoolWinner === true);
              console.log(`CRITICAL FILTER: Filtered to only school winners: ${beforeFilter} -> ${submissions.length}`);
            }
          } else if (stageToUseForFiltering === 'global') {
            // In global stage, only show country winners from previous stage
            // Same improvement as for other stages - get ALL submissions for this event
            if (currentEvent) {
              // First get all current submissions across all classes/schools
              const allEventSubmissions = await storage.getSubmissionsByEvent(eventId);
              console.log(`GLOBAL STAGE IMPROVEMENT: Retrieved all ${allEventSubmissions.length} submissions for event`);
              
              // Then filter to only country winners
              const beforeFilter = allEventSubmissions.length;
              submissions = allEventSubmissions.filter(sub => sub.countryWinner === true);
              console.log(`CRITICAL FILTER: Filtered to only country winners: ${beforeFilter} -> ${submissions.length}`);
            } else {
              // Fallback to previous behavior if no event (shouldn't happen)
              const beforeFilter = submissions.length;
              submissions = submissions.filter(sub => sub.countryWinner === true);
              console.log(`CRITICAL FILTER: Filtered to only country winners: ${beforeFilter} -> ${submissions.length}`);
            }
          }
          
          // 2. Basic Filtering: Remove user's own submissions and unvalidated submissions 
          const beforeBasicFilter = submissions.length;
          submissions = submissions.filter(sub => 
            sub.userId !== currentUserId && // Filter out user's own submissions
            sub.validated === true          // Only show submissions validated by teacher
          );
          console.log(`Filtered out user's own and unvalidated submissions: ${beforeBasicFilter} -> ${submissions.length}`);
          
          // 3. Apply additional stage-specific filters for user context (class, grade, school)
          // Use the requested stage for filtering if available, otherwise use current event stage
          switch (stageToUseForFiltering) {
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
              // SCHOOL STAGE: Show class winners from the same grade level within the same school
              console.log('School stage: Already filtered to only show class winners');
              
              if (currentUser.schoolId) {
                // Get current user's class to determine grade level
                const userClass = currentUser.classId ? await storage.getClass(currentUser.classId) : null;
                const userGradeLevel = userClass ? userClass.gradeLevel : null;
                
                console.log(`CRITICAL - User grade level for school stage: ${userGradeLevel}, School ID: ${currentUser.schoolId}, Class ID: ${currentUser.classId}`);
                
                if (userGradeLevel) {
                  // IMPROVED FILTERING LOGIC:
                  // 1. First, identify all users who have submissions
                  const submissionUserIds: number[] = Array.from(new Set(submissions.map(sub => sub.userId)));
                  console.log(`Users with class winner submissions: ${submissionUserIds.length}`);
                  
                  // 2. Get all users with their details
                  const usersWithSubmissions = await Promise.all(
                    submissionUserIds.map(userId => storage.getUser(userId))
                  );
                  
                  // 3. For each user, retrieve their class info to determine grade level
                  interface UserClassDetails {
                    userId: number;
                    userName: string;
                    classId: number;
                    className: string;
                    schoolId: number;
                    gradeLevel: string;
                  }
                  
                  const userClassDetailsMap = new Map<number, UserClassDetails>();
                  for (const user of usersWithSubmissions) {
                    if (user && user.classId) {
                      const classInfo = await storage.getClass(user.classId);
                      if (classInfo) {
                        userClassDetailsMap.set(user.id, {
                          userId: user.id,
                          userName: user.fullName,
                          classId: classInfo.id,
                          className: classInfo.name,
                          schoolId: classInfo.schoolId,
                          gradeLevel: classInfo.gradeLevel
                        });
                      }
                    }
                  }
                  
                  // 4. Filter for users in the same school AND same grade level
                  const sameGradeSchoolUserIds: number[] = [];
                  userClassDetailsMap.forEach((details, userId) => {
                    if (details.schoolId === currentUser.schoolId && details.gradeLevel === userGradeLevel) {
                      sameGradeSchoolUserIds.push(userId);
                    }
                  });
                  
                  console.log(`SCHOOL STAGE - Found ${sameGradeSchoolUserIds.length} students in same grade (${userGradeLevel}) in same school (${currentUser.schoolId})`);
                  
                  // Debug logging for all users with submissions
                  console.log(`SCHOOL STAGE - All user submissions class details:`, 
                    Array.from(userClassDetailsMap.values()).map(details => ({
                      userId: details.userId,
                      userName: details.userName,
                      classId: details.classId,
                      className: details.className,
                      schoolId: details.schoolId, 
                      gradeLevel: details.gradeLevel
                    }))
                  );
                  
                  // Before filtering, log which submissions would be excluded
                  const excludedSubmissions = submissions.filter(sub => !sameGradeSchoolUserIds.includes(sub.userId));
                  if (excludedSubmissions.length > 0) {
                    console.log(`SCHOOL STAGE FILTERING - These submissions will be EXCLUDED as they're from different grades or schools:`, 
                      excludedSubmissions.map(s => {
                        const userDetails = userClassDetailsMap.get(s.userId);
                        return {
                          id: s.id,
                          title: s.title,
                          userId: s.userId,
                          grade: userDetails?.gradeLevel,
                          schoolId: userDetails?.schoolId
                        };
                      })
                    );
                  }
                  
                  // Filter submissions to only include class winners from the same grade level in the same school
                  const beforeSchoolFilter = submissions.length;
                  submissions = submissions.filter(sub => sameGradeSchoolUserIds.includes(sub.userId));
                  console.log(`SCHOOL STAGE FILTERING - Filtered class winners to same grade in same school: ${beforeSchoolFilter} -> ${submissions.length}`);
                  
                  // Log the final submissions being shown
                  console.log(`SCHOOL STAGE FILTERING - Final submissions for voting:`, 
                    submissions.map(s => {
                      const userDetails = userClassDetailsMap.get(s.userId);
                      return {
                        id: s.id,
                        title: s.title,
                        userId: s.userId,
                        userName: userDetails?.userName,
                        grade: userDetails?.gradeLevel,
                        schoolId: userDetails?.schoolId
                      };
                    })
                  );
                }
              }
              break;
              
            case 'country':
              // COUNTRY STAGE: Show school winners from the same grade level across all schools
              console.log('Country stage: Already filtered to only show school winners');
              
              // Filter for same grade level across all schools
              // Get current user's class to determine grade level
              const userClass = currentUser.classId ? await storage.getClass(currentUser.classId) : null;
              const userGradeLevel = userClass ? userClass.gradeLevel : null;
              
              console.log(`CRITICAL - User grade level for country stage: ${userGradeLevel}, Class ID: ${currentUser.classId}`);
              
              if (userGradeLevel) {
                // IMPROVED FILTERING LOGIC FOR COUNTRY STAGE:
                // 1. First, identify all users who have submissions
                const submissionUserIds: number[] = Array.from(new Set(submissions.map(sub => sub.userId)));
                console.log(`Users with school winner submissions: ${submissionUserIds.length}`);
                
                // 2. Get all users with their details
                const usersWithSubmissions = await Promise.all(
                  submissionUserIds.map(userId => storage.getUser(userId))
                );
                
                // 3. For each user, retrieve their class info to determine grade level
                interface UserClassDetails {
                  userId: number;
                  userName: string;
                  classId: number;
                  className: string;
                  schoolId: number;
                  gradeLevel: string;
                }
                
                const userClassDetailsMap = new Map<number, UserClassDetails>();
                for (const user of usersWithSubmissions) {
                  if (user && user.classId) {
                    const classInfo = await storage.getClass(user.classId);
                    if (classInfo) {
                      userClassDetailsMap.set(user.id, {
                        userId: user.id,
                        userName: user.fullName,
                        classId: classInfo.id,
                        className: classInfo.name,
                        schoolId: classInfo.schoolId,
                        gradeLevel: classInfo.gradeLevel
                      });
                    }
                  }
                }
                
                // 4. Filter for users in the same grade level across all schools
                const sameGradeUserIds: number[] = [];
                userClassDetailsMap.forEach((details, userId) => {
                  if (details.gradeLevel === userGradeLevel) {
                    sameGradeUserIds.push(userId);
                  }
                });
                
                console.log(`COUNTRY STAGE - Found ${sameGradeUserIds.length} students in same grade (${userGradeLevel}) across all schools`);
                
                // Debug logging for all users with submissions
                console.log(`COUNTRY STAGE - All user submissions class details:`, 
                  Array.from(userClassDetailsMap.values()).map(details => ({
                    userId: details.userId,
                    userName: details.userName,
                    classId: details.classId,
                    className: details.className,
                    schoolId: details.schoolId, 
                    gradeLevel: details.gradeLevel
                  }))
                );
                
                // Before filtering, log which submissions would be excluded
                const excludedSubmissions = submissions.filter(sub => !sameGradeUserIds.includes(sub.userId));
                if (excludedSubmissions.length > 0) {
                  console.log(`COUNTRY STAGE FILTERING - These submissions will be EXCLUDED as they're from different grades:`, 
                    excludedSubmissions.map(s => {
                      const userDetails = userClassDetailsMap.get(s.userId);
                      return {
                        id: s.id,
                        title: s.title,
                        userId: s.userId,
                        grade: userDetails?.gradeLevel,
                        schoolId: userDetails?.schoolId
                      };
                    })
                  );
                }
                
                // Filter submissions to only include school winners from the same grade level across all schools
                const beforeCountryFilter = submissions.length;
                submissions = submissions.filter(sub => sameGradeUserIds.includes(sub.userId));
                console.log(`COUNTRY STAGE FILTERING - Filtered school winners to same grade across all schools: ${beforeCountryFilter} -> ${submissions.length}`);
                
                // Log the final submissions being shown
                console.log(`COUNTRY STAGE FILTERING - Final submissions for voting:`, 
                  submissions.map(s => {
                    const userDetails = userClassDetailsMap.get(s.userId);
                    return {
                      id: s.id,
                      title: s.title,
                      userId: s.userId,
                      userName: userDetails?.userName,
                      grade: userDetails?.gradeLevel,
                      schoolId: userDetails?.schoolId
                    };
                  })
                );
              }
              break;
              
            case 'global':
              // GLOBAL STAGE: Already filtered for country winners at the top level
              console.log('Global stage: Already filtered to only show country winners');
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
            
            // If we have a current event, check if this is a winner from previous stage
            // In that case, we'll set hasVoted to false to allow voting again
            if (hasVoted && currentEvent && !isHistoricalView) {
              let isWinnerFromPreviousStage = false;
              
              switch (currentEvent.stage) {
                case 'school':
                  // If we're in school stage, students can vote for class winners again
                  isWinnerFromPreviousStage = sub.classWinner === true;
                  break;
                case 'country':
                  // If we're in country stage, students can vote for school winners again
                  isWinnerFromPreviousStage = sub.schoolWinner === true;
                  break;
                case 'global':
                  // If we're in global stage, students can vote for country winners again
                  isWinnerFromPreviousStage = sub.countryWinner === true;
                  break;
              }
              
              // If it's a winner from previous stage, allow voting again by setting hasVoted to false
              if (isWinnerFromPreviousStage) {
                console.log(`Submission ${sub.id} is a winner from previous stage. Allowing user ${currentUserId} to vote again.`);
                hasVoted = false;
              }
            }
          }
          
          // Get the user's full name for each submission
          const user = await storage.getUser(sub.userId);
          const userFullName = user ? user.fullName : "Anonymous";
          
          // Get the event name for each submission
          const event = await storage.getEvent(sub.eventId);
          const eventName = event ? event.name : `Event #${sub.eventId}`;
          
          // Get class and school information if available
          let classData = null;
          let schoolData = null;
          let teacherData = null;
          
          if (sub.classId) {
            classData = await storage.getClass(sub.classId);
            if (classData) {
              teacherData = await storage.getUser(classData.teacherId);
              if (classData.schoolId) {
                schoolData = await storage.getSchool(classData.schoolId);
              }
            }
          } else if (user && user.classId) {
            // If submission doesn't have classId but user does
            classData = await storage.getClass(user.classId);
            if (classData) {
              teacherData = await storage.getUser(classData.teacherId);
              if (classData.schoolId) {
                schoolData = await storage.getSchool(classData.schoolId);
              }
            }
          }
          
          // Return enhanced submission data
          return { 
            ...sub, 
            voteCount, 
            hasVoted, 
            userFullName, 
            eventName,
            user: user ? {
              id: user.id,
              fullName: user.fullName,
              role: user.role,
              classId: user.classId,
              schoolId: user.schoolId,
              gradeLevel: user.gradeLevel
            } : null,
            event: event ? {
              id: event.id,
              name: event.name,
              type: event.type,
              stage: event.stage,
              status: event.status
            } : null,
            class: classData ? {
              id: classData.id,
              name: classData.name,
              gradeLevel: classData.gradeLevel
            } : null,
            school: schoolData ? {
              id: schoolData.id,
              name: schoolData.name
            } : null,
            teacher: teacherData ? {
              id: teacherData.id,
              fullName: teacherData.fullName
            } : null,
            statusText: sub.validated === null 
              ? 'Pending' 
              : sub.validated 
                ? 'Approved' 
                : 'Rejected',
            winnerStatus: {
              class: sub.classWinner,
              school: sub.schoolWinner,
              country: sub.countryWinner,
              global: sub.globalWinner
            }
          };
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
      
      // Get detailed information about the class and school
      let classData = null;
      let schoolData = null;
      let teacherData = null;
      
      if (submission.classId) {
        classData = await storage.getClass(submission.classId);
        if (classData) {
          teacherData = await storage.getUser(classData.teacherId);
          if (classData.schoolId) {
            schoolData = await storage.getSchool(classData.schoolId);
          }
        }
      }
      
      // Get votes for this submission with voter information
      const votes = await storage.getVotesBySubmission(submission.id);
      const votesWithDetails = await Promise.all(votes.map(async (vote) => {
        const voter = await storage.getUser(vote.voterId);
        return {
          ...vote,
          voterName: voter ? voter.fullName : 'Unknown',
          voterRole: voter ? voter.role : 'unknown'
        };
      }));
      
      // Format the data to match the frontend expectations
      const extendedSubmission = {
        ...submission,
        voteCount,
        votes: votesWithDetails,
        user: user ? {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          email: user.email,
          schoolId: user.schoolId,
          classId: user.classId,
          gradeLevel: user.gradeLevel
        } : null,
        event: event ? {
          id: event.id,
          name: event.name,
          description: event.description,
          type: event.type,
          status: event.status,
          stage: event.stage,
          startDate: event.startDate,
          endDate: event.endDate
        } : null,
        class: classData ? {
          id: classData.id,
          name: classData.name,
          gradeLevel: classData.gradeLevel
        } : null,
        school: schoolData ? {
          id: schoolData.id,
          name: schoolData.name
        } : null,
        teacher: teacherData ? {
          id: teacherData.id,
          fullName: teacherData.fullName
        } : null,
        eventName: event ? event.name : 'Unknown Event',
        userFullName: user ? user.fullName : 'Unknown User',
        type: event ? event.type : undefined,
        imageUrl: submission.content.startsWith('data:image') ? submission.content : undefined,
        winnerStatus: {
          class: submission.classWinner,
          school: submission.schoolWinner,
          country: submission.countryWinner,
          global: submission.globalWinner
        },
        statusText: submission.validated === null 
          ? 'Pending' 
          : submission.validated 
            ? 'Approved' 
            : 'Rejected'
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
      
      // Get the event to check its stage and type
      const event = await storage.getEvent(submissionData.eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      // Get user info to get their class ID
      const user = await storage.getUser(submissionData.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Add user's classId to the submission data
      if (user.classId) {
        submissionData.classId = user.classId;
      }
      
      // Check if event is in a stage that allows submissions (only class stage)
      if (event.stage !== 'class') {
        return res.status(403).json({ 
          message: 'Submissions are only allowed for events in the class stage',
          currentStage: event.stage 
        });
      }
      
      // Enforce content type based on event type
      if (event.type && typeof event.type === 'string') {
        const eventType = event.type.toLowerCase();
        
        // Poetry events only accept text submissions
        if (eventType === 'poetry' && submissionData.contentType !== 'text') {
          return res.status(400).json({ 
            message: 'Poetry events only accept text submissions',
            eventType: eventType,
            submittedContentType: submissionData.contentType
          });
        }
        
        // Painting events only accept image submissions
        if (eventType === 'painting' && submissionData.contentType !== 'image') {
          return res.status(400).json({ 
            message: 'Painting events only accept image submissions',
            eventType: eventType,
            submittedContentType: submissionData.contentType
          });
        }
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
      
      // Send WebSocket notification about new submission
      // To the specific class channel for teachers
      if (user.classId) {
        sendToChannel(`class_${user.classId}`, 'SUBMISSION_UPDATE', {
          action: 'created',
          submission: submission,
          eventName: event.name
        });
      }
      
      // Also to event-specific channel
      sendToChannel(`event_${submissionData.eventId}`, 'SUBMISSION_UPDATE', {
        action: 'created',
        submission: submission,
        eventName: event.name
      });
      
      // Also notify the admin channel
      sendToChannel('admin', 'SUBMISSION_UPDATE', {
        action: 'created',
        submission: submission,
        eventName: event.name
      });
      
      res.status(201).json(submission);
    } catch (error) {
      console.error('Error creating submission:', error);
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
  // Define validation handler function for reuse with both POST and PUT endpoints
  const handleValidation = async (req: Request, res: Response) => {
    try {
      const submissionId = Number(req.params.id);
      const { validated } = req.body;
      
      if (validated === undefined) {
        return res.status(400).json({ message: 'Validation status is required' });
      }
      
      console.log(`Validating submission ${submissionId} with value:`, validated);
      
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
      
      // Convert input to an explicit boolean value
      // - true = approved
      // - false = rejected
      // (null for pending is managed at creation time only, not through validation API)
      const validationValue = validated === true || validated === 'true';
      const updatedSubmission = await storage.validateSubmission(submissionId, validationValue);
      
      if (!updatedSubmission) {
        return res.status(500).json({ message: 'Failed to validate submission' });
      }
      
      // Get additional data for the response
      const voteCount = await storage.getVoteCountForSubmission(submissionId);
      const user = await storage.getUser(submission.userId);
      const event = await storage.getEvent(submission.eventId);
      
      console.log(`Submission ${submissionId} updated validation status:`, updatedSubmission.validated);
      
      // Send WebSocket notifications about submission validation
      if (submission.classId) {
        // Notify the specific class channel
        sendToChannel(`class_${submission.classId}`, 'SUBMISSION_UPDATE', {
          action: 'validated',
          submission: updatedSubmission,
          validated: validationValue,
          submissionId: submissionId
        });
      }
      
      // Notify the specific event channel
      sendToChannel(`event_${submission.eventId}`, 'SUBMISSION_UPDATE', {
        action: 'validated',
        submission: updatedSubmission,
        validated: validationValue,
        submissionId: submissionId
      });
      
      // Notify student who created the submission
      sendToChannel(`user_${submission.userId}`, 'SUBMISSION_UPDATE', {
        action: 'validated',
        submission: updatedSubmission,
        validated: validationValue,
        submissionId: submissionId,
        eventName: event ? event.name : 'Unknown Event'
      });
      
      // Get detailed information about the class and school
      let classData = null;
      let schoolData = null;
      let teacherData = null;
      
      if (submission.classId) {
        classData = await storage.getClass(submission.classId);
        if (classData) {
          teacherData = await storage.getUser(classData.teacherId);
          if (classData.schoolId) {
            schoolData = await storage.getSchool(classData.schoolId);
          }
        }
      } else if (user && user.classId) {
        // If submission doesn't have classId but user does
        classData = await storage.getClass(user.classId);
        if (classData) {
          teacherData = await storage.getUser(classData.teacherId);
          if (classData.schoolId) {
            schoolData = await storage.getSchool(classData.schoolId);
          }
        }
      }
      
      res.json({
        ...updatedSubmission,
        voteCount,
        userFullName: user ? user.fullName : 'Unknown User',
        message: validationValue ? 'Submission approved' : 'Submission rejected',
        user: user ? {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          email: user.email,
          schoolId: user.schoolId,
          classId: user.classId,
          gradeLevel: user.gradeLevel
        } : null,
        event: event ? {
          id: event.id,
          name: event.name,
          type: event.type,
          stage: event.stage,
          status: event.status
        } : null,
        class: classData ? {
          id: classData.id,
          name: classData.name,
          gradeLevel: classData.gradeLevel
        } : null,
        school: schoolData ? {
          id: schoolData.id,
          name: schoolData.name
        } : null,
        teacher: teacherData ? {
          id: teacherData.id,
          fullName: teacherData.fullName
        } : null,
        statusText: updatedSubmission.validated === null 
          ? 'Pending' 
          : updatedSubmission.validated 
            ? 'Approved' 
            : 'Rejected',
        winnerStatus: {
          class: updatedSubmission.classWinner,
          school: updatedSubmission.schoolWinner,
          country: updatedSubmission.countryWinner,
          global: updatedSubmission.globalWinner
        }
      });
    } catch (error) {
      console.error('Error validating submission:', error);
      res.status(500).json({ message: 'Failed to validate submission' });
    }
  };
  
  // Support both POST and PUT endpoints for the same validation logic
  apiRouter.post('/submissions/:id/validate', handleValidation);
  apiRouter.put('/submissions/:id/validate', handleValidation);
  
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
      
      // Get the event info for notification
      const event = await storage.getEvent(eventId);
      
      // Send WebSocket notifications about winners being selected
      // Notify the event channel
      sendToChannel(`event_${eventId}`, 'WINNERS_SELECTED', {
        action: 'winners_marked',
        stage: stage,
        winnerIds: winnerIds,
        eventName: event ? event.name : 'Unknown Event'
      });
      
      // Notify the admin channel
      sendToChannel('admin', 'WINNERS_SELECTED', {
        action: 'winners_marked',
        stage: stage,
        winnerIds: winnerIds,
        eventName: event ? event.name : 'Unknown Event'
      });
      
      // Notify each winner's channel
      for (const winnerId of winnerIds) {
        const submission = await storage.getSubmission(winnerId);
        if (submission) {
          sendToChannel(`user_${submission.userId}`, 'SUBMISSION_UPDATE', {
            action: 'winner_selected',
            submissionId: winnerId,
            stage: stage,
            eventName: event ? event.name : 'Unknown Event'
          });
        }
      }
      
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
      let currentStage = event.stage;
      
      switch (currentStage) {
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
      
      // Get all submissions for this event
      const eventSubmissions = await storage.getSubmissionsByEvent(eventId);
      const eventSubmissionIds = eventSubmissions.map(s => s.id);
      
      console.log(`Removing votes for ${eventSubmissionIds.length} submissions in event ${eventId} for promotion to ${nextStage} stage`);
      
      // 1. Get submissions with vote counts first (need this for determining winners)
      const submissionsWithVoteCounts = await Promise.all(
        eventSubmissions.map(async (sub) => {
          // Calculate the vote count for each submission
          const voteCount = await storage.getVoteCountForSubmission(sub.id);
          
          // Get user info to determine class
          const user = await storage.getUser(sub.userId);
          const classId = user?.classId;
          
          return { ...sub, voteCount, classId };
        })
      );
      
      // Get a list of unique class IDs from the submissions
      const classIdsSet = new Set<number>();
      
      // Collect all unique class IDs
      submissionsWithVoteCounts
        .filter(sub => sub.classId !== undefined && sub.classId !== null)
        .forEach(sub => classIdsSet.add(sub.classId as number));
      
      // Convert to array
      const classIds = Array.from(classIdsSet);
      
      console.log(`Found submissions from ${classIds.length} different classes`);
      
      // 2. Determine which field to set based on current stage
      const winnerField = 
        currentStage === 'class' ? 'classWinner' : 
        currentStage === 'school' ? 'schoolWinner' : 
        currentStage === 'country' ? 'countryWinner' : 'globalWinner';
      
      let winnerIds: number[] = [];
      
      if (currentStage === 'class') {
        // For class stage, we need to determine winners for each class separately
        
        for (const classId of classIds) {
          // Get submissions for this class
          const classSubmissions = submissionsWithVoteCounts.filter(sub => sub.classId === classId);
          
          // Sort by vote count (descending)
          classSubmissions.sort((a, b) => b.voteCount - a.voteCount);
          
          console.log(`Class ${classId}: ${classSubmissions.length} submissions`);
          
          if (classSubmissions.length === 0) continue;
          
          // Take top 3 submissions from this class (handle ties for 3rd place)
          const topSubmissionsForClass = [];
          
          // Always include the top 2 submissions if they exist
          if (classSubmissions.length >= 1) topSubmissionsForClass.push(classSubmissions[0]);
          if (classSubmissions.length >= 2) topSubmissionsForClass.push(classSubmissions[1]);
          
          // For the 3rd position, include all submissions that tie with the 3rd place score
          if (classSubmissions.length >= 3) {
            const thirdPlaceScore = classSubmissions[2].voteCount;
            const tiedSubmissions = classSubmissions.filter((sub, index) => 
              index >= 2 && sub.voteCount === thirdPlaceScore
            );
            
            topSubmissionsForClass.push(...tiedSubmissions);
          }
          
          // Add the winning IDs from this class to the overall winners list
          const classWinnerIds = topSubmissionsForClass.map(sub => sub.id);
          winnerIds.push(...classWinnerIds);
          
          console.log(`Top submissions for class ${classId}:`, classWinnerIds.length);
        }
      } else {
        // For other stages, we use the previous approach but handle ties
        
        // Sort submissions by vote count (descending)
        submissionsWithVoteCounts.sort((a, b) => b.voteCount - a.voteCount);
        
        // Take top 3 submissions but include any that tie with the 3rd place score
        const topSubmissions = [];
        
        // Always include the top 2 submissions if they exist
        if (submissionsWithVoteCounts.length >= 1) topSubmissions.push(submissionsWithVoteCounts[0]);
        if (submissionsWithVoteCounts.length >= 2) topSubmissions.push(submissionsWithVoteCounts[1]);
        
        // For the 3rd position, include all submissions that tie with the 3rd place score
        if (submissionsWithVoteCounts.length >= 3) {
          const thirdPlaceScore = submissionsWithVoteCounts[2].voteCount;
          const tiedSubmissions = submissionsWithVoteCounts.filter((sub, index) => 
            index >= 2 && sub.voteCount === thirdPlaceScore
          );
          
          topSubmissions.push(...tiedSubmissions);
        }
        
        winnerIds = topSubmissions.map(sub => sub.id);
      }
      
      console.log(`Marking ${winnerIds.length} submissions as ${currentStage} winners:`, winnerIds);
      
      // 5. Mark these submissions as winners for the current stage
      for (const id of winnerIds) {
        await storage.updateSubmission(id, { [winnerField]: true });
      }
      
      // NEW BEHAVIOR: Only delete votes for non-winning submissions
      // This preserves vote counts for winners when they move to the next stage
      for (const submissionId of eventSubmissionIds) {
        // Skip deletion of votes for winning submissions
        if (winnerIds.includes(submissionId)) {
          console.log(`Preserving votes for winning submission ${submissionId}`);
          continue;
        }
        
        const votes = await storage.getVotesBySubmission(submissionId);
        for (const vote of votes) {
          await storage.deleteVote(vote.id);
        }
      }
      
      console.log(`Cleared votes for non-winning submissions in event ${eventId} during promotion to ${nextStage} stage. Preserved votes for ${winnerIds.length} winning submissions.`);
      
      // Note: We've already determined the winners above, no need to redo the calculation
      
      // Update the event stage
      const updatedEvent = await storage.updateEvent(eventId, { 
        stage: nextStage as "class" | "school" | "country" | "global" 
      });
      
      // Send WebSocket notifications about event promotion
      broadcast('EVENT_UPDATE', {
        action: 'promoted',
        eventId: eventId,
        eventName: event.name,
        previousStage: currentStage,
        newStage: nextStage,
        winnerCount: winnerIds.length
      });
      
      // Send WebSocket notifications to admin channel
      sendToChannel('admin', 'EVENT_UPDATE', {
        action: 'promoted',
        eventId: eventId,
        eventName: event.name,
        previousStage: currentStage,
        newStage: nextStage,
        winnerCount: winnerIds.length
      });
      
      // Notify each winner
      for (const winnerId of winnerIds) {
        const submission = await storage.getSubmission(winnerId);
        if (submission) {
          sendToChannel(`user_${submission.userId}`, 'SUBMISSION_UPDATE', {
            action: 'promoted_to_next_stage',
            submissionId: winnerId,
            eventName: event.name,
            previousStage: currentStage,
            newStage: nextStage
          });
        }
      }
      
      res.json({ 
        message: `Event promoted from ${event.stage} to ${nextStage} stage. All votes have been reset and top ${winnerIds.length} submissions marked as winners.`,
        event: updatedEvent,
        winnerIds: winnerIds
      });
    } catch (error) {
      console.error('Error promoting event:', error);
      res.status(500).json({ message: 'Failed to promote event' });
    }
  });
  
  // NEW ENDPOINT: Get event voting history (for teacher and admin dashboards)
  apiRouter.get('/events/:id/voting-history', async (req, res) => {
    try {
      const eventId = Number(req.params.id);
      const classId = req.query.classId ? Number(req.query.classId) : null;
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      // Get all submissions for this event
      const allSubmissions = await storage.getSubmissionsByEvent(eventId);
      
      // Organize submissions by stage
      const classStageWinners = allSubmissions.filter(sub => sub.classWinner === true);
      const schoolStageWinners = allSubmissions.filter(sub => sub.schoolWinner === true);
      const countryStageWinners = allSubmissions.filter(sub => sub.countryWinner === true);
      const globalStageWinners = allSubmissions.filter(sub => sub.globalWinner === true);

      // For teacher view, we need to filter data based on their class
      let classInfo: Class | null = null; 
      let schoolInfo: School | null = null;
      let filteredClassWinners = classStageWinners;
      let filteredSchoolWinners = schoolStageWinners;

      if (classId) {
        // Get class and school info for the teacher
        classInfo = await storage.getClass(classId);
        
        if (classInfo) {
          schoolInfo = classInfo.schoolId ? await storage.getSchool(classInfo.schoolId) : null;
          
          // For Class stage: Only include submissions from the teacher's own class
          filteredClassWinners = classStageWinners.filter(async (sub) => {
            const user = await storage.getUser(sub.userId);
            return user && user.classId === classId;
          });
          
          // For School stage: Only include submissions from the same grade level in the school
          if (schoolInfo && classInfo.gradeLevel) {
            filteredSchoolWinners = await Promise.all(
              schoolStageWinners.filter(async (sub) => {
                const user = await storage.getUser(sub.userId);
                if (!user || !user.classId) return false;
                
                const userClass = await storage.getClass(user.classId);
                return userClass && 
                       userClass.schoolId === classInfo.schoolId && 
                       userClass.gradeLevel === classInfo.gradeLevel;
              })
            );
          }
        }
      }
      
      // For each submission, get the vote count and user details
      const processSubmissions = async (submissions: Submission[]) => {
        return await Promise.all(
          submissions.map(async (sub) => {
            const voteCount = await storage.getVoteCountForSubmission(sub.id);
            const user = await storage.getUser(sub.userId);
            const userFullName = user ? user.fullName : 'Anonymous';
            
            // Get class name if available
            let className = 'Unknown Class';
            let schoolName = 'Unknown School';
            let gradeLevel = 'Unknown Grade';
            
            if (user?.classId) {
              const userClass = await storage.getClass(user.classId);
              className = userClass ? userClass.name : 'Unknown Class';
              gradeLevel = userClass ? userClass.gradeLevel : 'Unknown Grade';
              
              if (userClass?.schoolId) {
                const school = await storage.getSchool(userClass.schoolId);
                schoolName = school ? school.name : 'Unknown School';
              }
            }
            
            return {
              id: sub.id,
              title: sub.title,
              voteCount,
              userFullName,
              userId: sub.userId,
              contentType: sub.contentType,
              thumbnail: sub.contentType === 'image' ? sub.content : null,
              className,
              schoolName,
              gradeLevel
            };
          })
        );
      };
      
      // Get enhanced data for each stage
      const classStageResults = await processSubmissions(filteredClassWinners);
      const schoolStageResults = await processSubmissions(filteredSchoolWinners);
      const countryStageResults = await processSubmissions(countryStageWinners);
      const globalStageResults = await processSubmissions(globalStageWinners);
      
      // Get votes for each stage based on available submissions
      let classStageVotes = 0;
      let schoolStageVotes = 0;
      
      for (const sub of filteredClassWinners) {
        classStageVotes += await storage.getVoteCountForSubmission(sub.id);
      }
      
      for (const sub of filteredSchoolWinners) {
        schoolStageVotes += await storage.getVoteCountForSubmission(sub.id);
      }
      
      // Get submissions specific to the class or school if classId is provided
      let filteredSubmissions = allSubmissions;
      
      if (classId && classInfo) {
        // For class-specific view, get submissions from this class
        const classSubmissions = await storage.getSubmissionsByClass(classId);
        
        // Additional filter for same grade if we're looking at school level
        if (schoolInfo && classInfo.gradeLevel) {
          // Get classes in the same grade
          const schoolClasses = await storage.getClassesBySchool(schoolInfo.id);
          const sameGradeClasses = schoolClasses.filter(c => c.gradeLevel === classInfo.gradeLevel);
          
          // Get submissions from same-grade classes
          const sameGradeSubmissions = [];
          for (const cls of sameGradeClasses) {
            const clsSubmissions = await storage.getSubmissionsByClass(cls.id);
            sameGradeSubmissions.push(...clsSubmissions);
          }
          
          // Add to filtered submissions
          filteredSubmissions = [...classSubmissions, ...sameGradeSubmissions];
        } else {
          filteredSubmissions = classSubmissions;
        }
      }
      
      // Get overall statistics for filtered submissions
      const totalSubmissions = filteredSubmissions.length;
      const validatedSubmissions = filteredSubmissions.filter(sub => sub.validated === true).length;
      const rejectedSubmissions = filteredSubmissions.filter(sub => sub.validated === false).length;
      const pendingSubmissions = filteredSubmissions.filter(sub => sub.validated === null).length;
      const approvalRate = totalSubmissions > 0 
        ? Math.round((validatedSubmissions / totalSubmissions) * 100) 
        : 0;
      
      // Determine overall votes (sum of votes on all validated submissions)
      let totalVotes = 0;
      for (const sub of filteredSubmissions.filter(s => s.validated === true)) {
        totalVotes += await storage.getVoteCountForSubmission(sub.id);
      }
      
      // Format the response for the teacher view
      const response = {
        eventId: event.id,
        eventName: event.name,
        eventType: event.type,
        eventStage: event.stage,
        eventStatus: event.status,
        className: classInfo ? classInfo.name : null,
        schoolName: schoolInfo ? schoolInfo.name : null,
        
        // Overall stats
        overall: {
          totalSubmissions,
          totalVotes,
          approvalRate,
          validatedSubmissions,
          rejectedSubmissions,
          pendingSubmissions,
        },
        
        // Class stage data
        classStage: {
          totalSubmissions: filteredClassWinners.length,
          totalVotes: classStageVotes,
          winnersCount: classStageResults.length,
          winners: classStageResults.sort((a, b) => b.voteCount - a.voteCount),
          completed: event.stage !== 'class'
        },
        
        // School stage data
        schoolStage: {
          totalSubmissions: filteredSchoolWinners.length,
          totalVotes: schoolStageVotes,
          winnersCount: schoolStageResults.length,
          winners: schoolStageResults.sort((a, b) => b.voteCount - a.voteCount),
          completed: ['school', 'country', 'global'].includes(event.stage)
        },
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error fetching event voting history:', error);
      res.status(500).json({ message: 'Failed to fetch event voting history' });
    }
  });
  
  // Get overall statistics for reports
  apiRouter.get('/reports/statistics', async (req, res) => {
    try {
      const allSchools = await storage.getAllSchools();
      const allClasses = await storage.getAllClasses();
      const allSubmissions = await storage.getAllSubmissions();
      const allEvents = await storage.getAllEvents();
      
      // Process school statistics
      const schoolStats = await Promise.all(allSchools.map(async (school) => {
        // Get classes for this school
        const schoolClasses = allClasses.filter(c => c.schoolId === school.id);
        
        // Get teachers and students for this school
        const teachersCount = (await storage.getUsersByRole('teacher')).filter(t => 
          schoolClasses.some(c => c.id === t.classId)
        ).length;
        
        const studentsCount = (await storage.getUsersByRole('student')).filter(s => 
          schoolClasses.some(c => c.id === s.classId)
        ).length;
        
        // Get submissions for this school
        const schoolSubmissions = allSubmissions.filter(sub => {
          const classIds = schoolClasses.map(c => c.id);
          return sub.classId !== null && classIds.includes(sub.classId);
        });
        
        // Get winners for this school
        const schoolWinners = schoolSubmissions.filter(sub => 
          sub.schoolWinner === true || sub.countryWinner === true || sub.globalWinner === true
        );
        
        return {
          id: school.id,
          name: school.name,
          classesCount: schoolClasses.length,
          teachersCount,
          studentsCount,
          submissionsCount: schoolSubmissions.length,
          winnersCount: schoolWinners.length,
          hasWinner: schoolWinners.length > 0
        };
      }));
      
      // Process class statistics
      const classStats = await Promise.all(allClasses.map(async (cls) => {
        // Get school name
        const school = await storage.getSchool(cls.schoolId);
        const schoolName = school ? school.name : 'Unknown School';
        
        // Get students for this class
        const students = await storage.getUsersByClass(cls.id);
        
        // Get submissions for this class
        const classSubmissions = allSubmissions.filter(sub => sub.classId === cls.id);
        
        // Calculate total votes for this class's submissions
        let totalVotes = 0;
        for (const sub of classSubmissions) {
          totalVotes += await storage.getVoteCountForSubmission(sub.id);
        }
        
        // Get winners from this class
        const classWinners = classSubmissions.filter(sub => 
          sub.classWinner === true || sub.schoolWinner === true || 
          sub.countryWinner === true || sub.globalWinner === true
        );
        
        return {
          id: cls.id,
          name: cls.name,
          schoolId: cls.schoolId,
          schoolName,
          gradeLevel: cls.gradeLevel,
          studentsCount: students.length,
          submissionsCount: classSubmissions.length,
          totalVotes,
          winnersCount: classWinners.length,
          hasWinner: classWinners.length > 0
        };
      }));
      
      res.json({
        schoolStats,
        classStats
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({ message: 'Failed to fetch statistics' });
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
      
      // Check if voter has already voted for this submission
      const hasVoted = await storage.hasUserVotedForSubmission(voteData.voterId, voteData.submissionId);
      
      // When a user has already voted for this submission, we reject the vote
      // Removed the special case handling based on winners from previous stages
      // This ensures even if a submission is a winner from a previous stage, users cannot vote multiple times
      if (hasVoted) {
        return res.status(409).json({ message: 'User already voted for this submission' });
      }
      
      // This special handling for previous stage winners has been removed
      // to enforce the rule that users can only vote once per submission
      // even across different competition stages
      
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
      const { prompt, style, service } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }
      
      // Use the specified service or fall back to the default
      let aiService = service || DEFAULT_TEXT_SERVICE;
      let poem;
      let usedFallback = false;
      
      try {
        switch (aiService) {
          case AI_SERVICE.HUGGING_FACE:
            // Use Hugging Face (free open-source AI)
            poem = await generateHuggingFaceText(prompt, style);
            break;
          case AI_SERVICE.CLAUDE:
            // Use Claude (Anthropic AI)
            poem = await anthropic.generatePoem(prompt, style);
            break;
          default:
            // Default to Hugging Face as fallback
            poem = await generateHuggingFaceText(prompt, style);
        }
      } catch (serviceError: any) {
        // Check if this is a quota exceeded error from Claude
        if (serviceError.message === "QUOTA_EXCEEDED" && aiService === AI_SERVICE.CLAUDE) {
          console.log("Claude AI quota exceeded, falling back to Hugging Face");
          // Fall back to Hugging Face
          poem = await generateHuggingFaceText(prompt, style);
          aiService = AI_SERVICE.HUGGING_FACE;
          usedFallback = true;
        } else {
          // If it's a different error or from a different service, rethrow it
          throw serviceError;
        }
      }
      
      const response = { 
        content: poem, 
        service: aiService,
        usedFallback: usedFallback
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error generating poem:', error);
      res.status(500).json({ message: 'Failed to generate poem' });
    }
  });

  apiRouter.post('/ai/generate-image', async (req, res) => {
    try {
      const { prompt, service } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }
      
      // Use the specified service or fall back to the default
      let aiService = service || DEFAULT_IMAGE_SERVICE;
      let imageUrl;
      let usedFallback = false;
      
      try {
        // Use the original prompt directly without enhancement
        let enhancedPrompt = prompt;
        
        // Only keep content safety check
        try {
          if (process.env.ANTHROPIC_API_KEY) {
            console.log("PROMPT FROM USER:", prompt);
            
            // Check original prompt for safety
            const moderationResult = await anthropic.moderateContent(prompt);
            if (!moderationResult.isSafe) {
              console.log("PROMPT MODERATION FAILED:", moderationResult.category, moderationResult.reason);
              throw new Error(`Your prompt contains inappropriate content: ${moderationResult.reason}`);
            }
          }
        } catch (enhanceError) {
          console.error("Error in prompt processing:", enhanceError);
          // Check if this is a moderation error that we want to pass to the user
          if (enhanceError.message && enhanceError.message.includes("inappropriate content")) {
            throw enhanceError; // Pass this error up to be shown to the user
          }
        }
        
        switch (aiService) {
          case AI_SERVICE.HUGGING_FACE:
            // Use Hugging Face (free open-source AI)
            imageUrl = await generateHuggingFaceImage(enhancedPrompt);
            break;
          case AI_SERVICE.STABILITY:
            // Use Stability AI
            imageUrl = await generateStabilityImage(enhancedPrompt);
            break;
          default:
            // Default to Hugging Face as fallback
            imageUrl = await generateHuggingFaceImage(enhancedPrompt);
        }
      } catch (serviceError: any) {
        // Check if this is a quota exceeded error from OpenAI
        if (serviceError.message === "QUOTA_EXCEEDED") {
          console.log(`${aiService} quota exceeded, falling back to Hugging Face`);
          
          // Fall back to Hugging Face for any service that fails with quota issue
          imageUrl = await generateHuggingFaceImage(prompt);
          aiService = AI_SERVICE.HUGGING_FACE;
          usedFallback = true;
        } else {
          // If it's a different error, rethrow it
          throw serviceError;
        }
      }
      
      const response = {
        imageUrl, 
        service: aiService,
        usedFallback: usedFallback
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('Error generating image:', error);
      
      // Extract and format a more user-friendly error message
      let errorMessage = 'Failed to generate image';
      
      if (error && error.message) {
        if (error.message.includes('not have enough balance')) {
          errorMessage = 'Your Stability.ai account has insufficient funds. Please add funds to your account or try using a different image generation service.';
        } else if (error.message.includes('QUOTA_EXCEEDED')) {
          errorMessage = 'API quota exceeded. Please try again later or use a different AI service.';
        } else if (error.message.includes('API key')) {
          errorMessage = 'API configuration issue. Please check your API key settings.';
        } else {
          // Include original error message for better debugging
          errorMessage = `Failed to generate image: ${error.message}`;
        }
      }
      
      res.status(500).json({ 
        message: errorMessage,
        originalError: process.env.NODE_ENV === 'development' ? error.message : undefined,
        service: req.body.aiService
      });
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
          } catch (createError: any) {
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
      
      // CRITICAL CHANGE: Create a participant entry for EACH SUBMISSION (not each user)
      // This ensures we can properly track vote counts and winner status for each submission
      let participants = [];
      
      // First add entries for users who have submitted
      for (const submission of eventSubmissions) {
        const user = allUsers.find(u => u.id === submission.userId);
        if (!user) continue;
        
        // Find user's school and class
        const school = allSchools.find(s => s.id === user.schoolId);
        const classInfo = allClasses.find(c => c.id === user.classId);
        
        // Find registration for this user
        const registration = registrations.find(r => r.userId === user.id);
        
        // Get votes for this submission
        const voteCount = await storage.getVoteCountForSubmission(submission.id);
        
        participants.push({
          id: submission.id, // Important: Now using submission ID as primary identifier
          userId: user.id,
          name: user.fullName,
          email: user.email,
          schoolId: user.schoolId,
          schoolName: school ? school.name : 'Unknown',
          classId: user.classId,
          className: classInfo ? classInfo.name : 'Unknown',
          gradeLevel: user.gradeLevel || classInfo?.gradeLevel || 'Unknown',
          registrationDate: registration?.registeredAt,
          hasSubmitted: true,
          submissionId: submission.id,
          submissionTitle: submission.title || "Untitled",
          submissionDate: submission.submittedAt,
          voteCount: voteCount,
          classWinner: submission.classWinner || false,
          schoolWinner: submission.schoolWinner || false,
          countryWinner: submission.countryWinner || false,
          globalWinner: submission.globalWinner || false,
          currentStage: submission.globalWinner ? "Global" : 
                         submission.countryWinner ? "Country" : 
                         submission.schoolWinner ? "School" : 
                         submission.classWinner ? "Class" : "-"
        });
      }
      
      // Now add entries for users who registered but haven't submitted
      for (const registration of registrations) {
        // Skip users who have already submitted (we already added them above)
        if (eventSubmissions.some(s => s.userId === registration.userId)) {
          continue;
        }
        
        const user = allUsers.find(u => u.id === registration.userId);
        if (!user) continue;
        
        // Find user's school and class
        const school = allSchools.find(s => s.id === user.schoolId);
        const classInfo = allClasses.find(c => c.id === user.classId);
        
        participants.push({
          id: `user-${user.id}`, // Using a different ID format for non-submissions
          userId: user.id,
          name: user.fullName,
          email: user.email,
          schoolId: user.schoolId,
          schoolName: school ? school.name : 'Unknown',
          classId: user.classId,
          className: classInfo ? classInfo.name : 'Unknown',
          gradeLevel: user.gradeLevel || classInfo?.gradeLevel || 'Unknown',
          registrationDate: registration?.registeredAt,
          hasSubmitted: false,
          submissionId: null,
          submissionTitle: "-",
          voteCount: 0,
          classWinner: false,
          schoolWinner: false,
          countryWinner: false,
          globalWinner: false,
          currentStage: "-"
        });
      }
      
      console.log(`Returning ${participants.length} participants with submission details for event ${eventId}`);
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
  
  // Add statistics endpoint for reports
  apiRouter.get('/reports/statistics', async (req, res) => {
    try {
      // Get all submissions from storage
      const submissions = await storage.getAllSubmissions();
      
      // Count total submissions
      const totalSubmissions = submissions.length;
      
      // Count approved submissions
      const approvedSubmissions = submissions.filter(sub => sub.validated === true).length;
      
      // Count rejected submissions
      const rejectedSubmissions = submissions.filter(sub => sub.validated === false).length;
      
      // Count pending submissions
      const pendingSubmissions = submissions.filter(sub => sub.validated === null).length;
      
      // Count submissions by type
      const poetrySubmissions = await Promise.all(
        submissions.map(async sub => {
          const event = await storage.getEvent(sub.eventId);
          return event && event.type === 'poetry';
        })
      ).then(results => results.filter(Boolean).length);
      
      const paintingSubmissions = await Promise.all(
        submissions.map(async sub => {
          const event = await storage.getEvent(sub.eventId);
          return event && event.type === 'painting';
        })
      ).then(results => results.filter(Boolean).length);
      
      // Get all votes
      const votes = [];
      for (const sub of submissions) {
        const subVotes = await storage.getVotesBySubmission(sub.id);
        votes.push(...subVotes);
      }
      
      // Get all schools
      const schools = await storage.getAllSchools();
      
      // Get all classes
      const classes = await storage.getAllClasses();
      
      // Calculate statistics by school
      const schoolStats = await Promise.all(
        schools.map(async school => {
          const schoolUsers = await storage.getUsersBySchool(school.id);
          const schoolUserIds = schoolUsers.map(user => user.id);
          
          // Count submissions by users from this school
          const schoolSubmissions = submissions.filter(sub => 
            schoolUserIds.includes(sub.userId)
          );
          
          return {
            schoolId: school.id,
            schoolName: school.name,
            totalSubmissions: schoolSubmissions.length,
            approvedSubmissions: schoolSubmissions.filter(sub => sub.validated === true).length,
            pendingSubmissions: schoolSubmissions.filter(sub => sub.validated === null).length,
            rejectedSubmissions: schoolSubmissions.filter(sub => sub.validated === false).length
          };
        })
      );
      
      // Calculate statistics by class
      const classStats = await Promise.all(
        classes.map(async cls => {
          const classUsers = await storage.getUsersByClass(cls.id);
          const classUserIds = classUsers.map(user => user.id);
          
          // Count submissions by users from this class
          const classSubmissions = submissions.filter(sub => 
            classUserIds.includes(sub.userId)
          );
          
          return {
            classId: cls.id,
            className: cls.name,
            schoolId: cls.schoolId,
            totalSubmissions: classSubmissions.length,
            approvedSubmissions: classSubmissions.filter(sub => sub.validated === true).length,
            pendingSubmissions: classSubmissions.filter(sub => sub.validated === null).length,
            rejectedSubmissions: classSubmissions.filter(sub => sub.validated === false).length
          };
        })
      );
      
      // Return combined statistics
      res.json({
        overall: {
          totalSubmissions,
          approvedSubmissions,
          rejectedSubmissions,
          pendingSubmissions,
          totalVotes: votes.length,
          poetrySubmissions,
          paintingSubmissions
        },
        schoolStats,
        classStats
      });
    } catch (error) {
      console.error('Error generating statistics:', error);
      res.status(500).json({ error: 'Failed to generate statistics' });
    }
  });
  
  // Add monitoring endpoint for system performance and security
  apiRouter.get('/monitoring/system', async (req, res) => {
    try {
      const startTime = performance.now();
      
      // Get system info from monitoring service
      const systemInfo = monitoring.getSystemInfo();
      
      // Get database connection status
      const dbConnectionStatus = {
        isConnected: true,
        connectionTime: 0,
        error: null as string | null,
      };
      
      try {
        const dbStartTime = performance.now();
        // Simple DB query to test connection
        await storage.getAllUsers();
        dbConnectionStatus.connectionTime = performance.now() - dbStartTime;
      } catch (dbError: any) {
        dbConnectionStatus.isConnected = false;
        dbConnectionStatus.error = dbError.message;
      }
      
      // Get API service health
      const apiServices = [
        { name: 'Anthropic Claude', type: 'AI', status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not configured' },
        { name: 'OpenAI', type: 'AI', status: process.env.OPENAI_API_KEY ? 'configured' : 'not configured' },
        { name: 'Stability.ai', type: 'AI', status: process.env.STABILITY_API_KEY ? 'configured' : 'not configured' },
        { name: 'Hugging Face', type: 'AI', status: process.env.HUGGING_FACE_API_KEY ? 'configured' : 'not configured' },
      ];
      
      // Get monitoring data from our service
      const recentErrors = monitoring.getErrorLog();
      const requestStats = monitoring.getRequestStats();
      
      // User activity metrics - Get real data from our storage
      const users = await storage.getAllUsers();
      const submissions = await storage.getAllSubmissions();
      const events = await storage.getAllEvents();
      
      // Calculate the dates for time periods
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Calculate active user counts based on user lastLoginDate
      const activeUsers = {
        last24Hours: users.filter(user => 
          user.lastLoginDate && new Date(user.lastLoginDate) >= oneDayAgo
        ).length,
        last7Days: users.filter(user => 
          user.lastLoginDate && new Date(user.lastLoginDate) >= sevenDaysAgo
        ).length,
        last30Days: users.filter(user => 
          user.lastLoginDate && new Date(user.lastLoginDate) >= thirtyDaysAgo
        ).length
      };
      
      // Calculate submission counts
      const submissionCounts = {
        last24Hours: submissions.filter(sub => 
          sub.submittedAt && new Date(sub.submittedAt) >= oneDayAgo
        ).length,
        last7Days: submissions.filter(sub => 
          sub.submittedAt && new Date(sub.submittedAt) >= sevenDaysAgo
        ).length,
        last30Days: submissions.filter(sub => 
          sub.submittedAt && new Date(sub.submittedAt) >= thirtyDaysAgo
        ).length
      };
      
      // Get login count from the request stats for API login endpoint
      const loginEndpoint = '/api/auth/login';
      const loginStats = requestStats.endpoints[loginEndpoint] || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0
      };
      
      const userActivity = {
        activeUsers,
        submissions: submissionCounts,
        logins: {
          last24Hours: loginStats.successfulRequests || 0,
          last7Days: loginStats.successfulRequests || 0,
          last30Days: loginStats.successfulRequests || 0
        }
      };
      
      // Security metrics - Get real data
      const securityMetrics = {
        failedLoginAttempts: {
          last24Hours: loginStats.failedRequests || 0,
          last7Days: loginStats.failedRequests || 0
        },
        suspiciousActivities: recentErrors
          .filter(err => err.statusCode === 401 || err.statusCode === 403)
          .map(err => `${err.method} ${err.endpoint} failed with ${err.statusCode} at ${new Date(err.timestamp).toLocaleString()}`)
      };
      
      // Calculate response time for this monitoring request
      const responseTime = performance.now() - startTime;
      
      res.json({
        timestamp: new Date().toISOString(),
        systemInfo,
        dbConnectionStatus,
        apiServices,
        recentErrors,
        requestStats,
        userActivity,
        securityMetrics,
        responseTime
      });
    } catch (error: any) {
      console.error('Error generating monitoring data:', error);
      res.status(500).json({ error: 'Failed to generate monitoring data' });
    }
  });
  
  // Secondary Teacher Assignment routes
  apiRouter.get('/secondary-teacher-assignments', async (req, res) => {
    try {
      const { teacherId, classId, secondaryTeacherId, schoolId } = req.query;
      
      let assignments: SecondaryTeacherAssignment[] = [];
      
      if (teacherId) {
        // Get assignments where this teacher is the primary teacher
        assignments = await storage.getSecondaryTeacherAssignmentsByTeacher(Number(teacherId));
      } else if (secondaryTeacherId) {
        // We need to find all classes assigned to this secondary teacher
        const classesForSecondaryTeacher = await storage.getClassesBySecondaryTeacher(Number(secondaryTeacherId));
        
        // For each class, get the secondary teacher assignment
        const assignmentPromises = classesForSecondaryTeacher.map(async (cls) => {
          const classAssignments = await storage.getSecondaryTeacherAssignmentsByClass(cls.id);
          return classAssignments.filter(a => a.secondaryTeacherId === Number(secondaryTeacherId));
        });
        
        // Flatten the array of arrays into a single array
        const assignmentArrays = await Promise.all(assignmentPromises);
        assignments = assignmentArrays.flat();
      } else if (classId) {
        // Get all assignments for this class
        assignments = await storage.getSecondaryTeacherAssignmentsByClass(Number(classId));
      } else if (schoolId) {
        // Get all assignments for classes in this school
        const allAssignments = [];
        const classes = await storage.getClassesBySchool(Number(schoolId));
        
        for (const cls of classes) {
          const classAssignments = await storage.getSecondaryTeacherAssignmentsByClass(cls.id);
          allAssignments.push(...classAssignments);
        }
        
        assignments = allAssignments;
      } else {
        // No specific filter, get all assignments (should be admin only)
        // Implement pagination here if the dataset is large
        const allAssignments = [];
        const classes = await storage.getAllClasses();
        
        for (const cls of classes) {
          const classAssignments = await storage.getSecondaryTeacherAssignmentsByClass(cls.id);
          allAssignments.push(...classAssignments);
        }
        
        assignments = allAssignments;
      }
      
      // Enhance the assignments with teacher names, class names, etc.
      const enhancedAssignments = await Promise.all(assignments.map(async (assignment) => {
        const teacher = await storage.getUser(assignment.teacherId);
        const secondaryTeacher = await storage.getUser(assignment.secondaryTeacherId);
        const cls = await storage.getClass(assignment.classId);
        
        return {
          ...assignment,
          teacherName: teacher ? teacher.fullName : "Unknown Teacher",
          secondaryTeacherName: secondaryTeacher ? secondaryTeacher.fullName : "Unknown Teacher",
          className: cls ? cls.name : "Unknown Class",
          gradeLevel: cls ? cls.gradeLevel : null
        };
      }));
      
      res.json(enhancedAssignments);
    } catch (error) {
      console.error('Error fetching secondary teacher assignments:', error);
      res.status(500).json({ message: 'Failed to fetch secondary teacher assignments' });
    }
  });
  
  apiRouter.get('/secondary-teacher-assignments/:id', async (req, res) => {
    try {
      const assignment = await storage.getSecondaryTeacherAssignment(Number(req.params.id));
      
      if (!assignment) {
        return res.status(404).json({ message: 'Secondary teacher assignment not found' });
      }
      
      // Get additional information
      const teacher = await storage.getUser(assignment.teacherId);
      const secondaryTeacher = await storage.getUser(assignment.secondaryTeacherId);
      const cls = await storage.getClass(assignment.classId);
      
      const enhancedAssignment = {
        ...assignment,
        teacherName: teacher ? teacher.fullName : "Unknown Teacher",
        secondaryTeacherName: secondaryTeacher ? secondaryTeacher.fullName : "Unknown Teacher",
        className: cls ? cls.name : "Unknown Class",
        gradeLevel: cls ? cls.gradeLevel : null
      };
      
      res.json(enhancedAssignment);
    } catch (error) {
      console.error('Error fetching secondary teacher assignment:', error);
      res.status(500).json({ message: 'Failed to fetch secondary teacher assignment' });
    }
  });
  
  apiRouter.post('/secondary-teacher-assignments', async (req, res) => {
    try {
      // Validate data
      const assignmentData = insertSecondaryTeacherAssignmentSchema.parse({
        ...req.body,
        isActive: true,
        assignedAt: new Date()
      });
      
      // Check if the class exists
      const cls = await storage.getClass(assignmentData.classId);
      if (!cls) {
        return res.status(404).json({ 
          message: 'Class not found',
          field: 'classId'
        });
      }
      
      // Check if the teacher exists
      const teacher = await storage.getUser(assignmentData.teacherId);
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(404).json({ 
          message: 'Teacher not found or not a teacher',
          field: 'teacherId'
        });
      }
      
      // Check if the secondary teacher exists
      const secondaryTeacher = await storage.getUser(assignmentData.secondaryTeacherId);
      if (!secondaryTeacher || secondaryTeacher.role !== 'secondaryTeacher') {
        return res.status(404).json({ 
          message: 'Secondary teacher not found or not a secondary teacher',
          field: 'secondaryTeacherId'
        });
      }
      
      // Check if this assignment already exists
      const existingAssignments = await storage.getSecondaryTeacherAssignmentsByClass(assignmentData.classId);
      const existingAssignment = existingAssignments.find(
        a => a.teacherId === assignmentData.teacherId && 
             a.secondaryTeacherId === assignmentData.secondaryTeacherId
      );
      
      if (existingAssignment) {
        return res.status(409).json({ 
          message: 'This secondary teacher is already assigned to this class',
          field: 'secondaryTeacherId'
        });
      }
      
      // Create the assignment
      const assignment = await storage.createSecondaryTeacherAssignment(assignmentData);
      
      // Return with additional information
      const enhancedAssignment = {
        ...assignment,
        teacherName: teacher.fullName,
        secondaryTeacherName: secondaryTeacher.fullName,
        className: cls.name,
        gradeLevel: cls.gradeLevel
      };
      
      res.status(201).json(enhancedAssignment);
    } catch (error) {
      console.error('Error creating secondary teacher assignment:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid assignment data', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to create secondary teacher assignment' });
    }
  });
  
  apiRouter.delete('/secondary-teacher-assignments/:id', async (req, res) => {
    try {
      const assignment = await storage.getSecondaryTeacherAssignment(Number(req.params.id));
      
      if (!assignment) {
        return res.status(404).json({ message: 'Secondary teacher assignment not found' });
      }
      
      const deleted = await storage.deleteSecondaryTeacherAssignment(Number(req.params.id));
      
      if (!deleted) {
        return res.status(500).json({ message: 'Failed to delete secondary teacher assignment' });
      }
      
      res.status(200).json({ message: 'Secondary teacher assignment deleted successfully' });
    } catch (error) {
      console.error('Error deleting secondary teacher assignment:', error);
      res.status(500).json({ message: 'Failed to delete secondary teacher assignment' });
    }
  });
  
  // Get classes for a specific secondary teacher
  apiRouter.get('/secondary-teacher/:id/classes', async (req, res) => {
    try {
      const secondaryTeacherId = Number(req.params.id);
      
      // Get the secondary teacher user to confirm they exist
      const secondaryTeacher = await storage.getUser(secondaryTeacherId);
      if (!secondaryTeacher || secondaryTeacher.role !== 'secondaryTeacher') {
        return res.status(404).json({ message: 'Secondary teacher not found' });
      }
      
      // Get all assignment entries for this secondary teacher
      const assignments = Array.from(await storage.getSecondaryTeacherAssignmentsBySecondaryTeacher(secondaryTeacherId));
      
      // Get the actual class objects
      const classPromises = assignments.map(async (assignment) => {
        if (!assignment) return null;
        return await storage.getClass(assignment.classId);
      });
      
      const classes = (await Promise.all(classPromises)).filter(Boolean) as Class[];
      
      // Enhance class data with school and teacher information
      const enhancedClasses = (await Promise.all(classes.map(async (cls) => {
        if (!cls) {
          return null;
        }
        
        console.log('Class info:', cls);
        
        const school = cls.schoolId ? await storage.getSchool(cls.schoolId) : null;
        console.log('School info:', school);
        
        const teacher = cls.teacherId ? await storage.getUser(cls.teacherId) : null;
        console.log('Teacher info:', teacher);
        
        return {
          ...cls,
          schoolId: cls.schoolId || null,
          teacherId: cls.teacherId || null,
          schoolName: school ? school.name : null,
          teacherName: teacher ? teacher.fullName : null
        };
      }))).filter(Boolean);
      
      res.json(enhancedClasses);
    } catch (error) {
      console.error('Error fetching classes for secondary teacher:', error);
      res.status(500).json({ message: 'Failed to fetch classes for secondary teacher' });
    }
  });

  // Middleware to track request statistics
  apiRouter.use((req, res, next) => {
    const startTime = performance.now();
    const endpoint = req.path;
    
    // Track request start
    monitoring.trackRequestStart(endpoint);
    
    // Override end function to capture response status and time
    const originalEnd = res.end;
    
    // Using any here to work around TypeScript signature complexity
    (res as any).end = function(...args: any[]) {
      const responseTime = performance.now() - startTime;
      
      // Track request completion
      monitoring.trackRequestEnd(endpoint, res.statusCode, responseTime);
      
      // Log error for 4xx and 5xx responses
      if (res.statusCode >= 400) {
        const errorEntry = {
          timestamp: new Date().toISOString(),
          endpoint,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          ip: req.ip || 'unknown',
          userAgent: req.get('user-agent')
        };
        
        // Add to error log
        monitoring.addErrorEntry(errorEntry);
      }
      
      // Call the original end function
      return originalEnd.apply(this, args);
    };
    
    next();
  });

  // Gallery Items routes
  // Get all gallery items
  apiRouter.get('/gallery-items', async (req, res) => {
    try {
      const { type, featured } = req.query;
      
      let galleryItems;
      if (type && (type === 'poem' || type === 'image')) {
        galleryItems = await storage.getGalleryItemsByType(type as 'poem' | 'image');
      } else if (featured === 'true') {
        galleryItems = await storage.getFeaturedGalleryItems();
      } else {
        galleryItems = await storage.getAllGalleryItems();
      }
      
      // Get creator information for each item
      const enhancedItems = await Promise.all(
        galleryItems.map(async (item) => {
          const creator = await storage.getUser(item.createdBy);
          return {
            ...item,
            creatorName: creator ? creator.fullName : 'Unknown'
          };
        })
      );
      
      res.json(enhancedItems);
    } catch (error) {
      console.error('Error fetching gallery items:', error);
      res.status(500).json({ message: 'Failed to fetch gallery items' });
    }
  });
  
  // Get a specific gallery item by ID
  apiRouter.get('/gallery-items/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid gallery item ID' });
      }
      
      const galleryItem = await storage.getGalleryItem(id);
      if (!galleryItem) {
        return res.status(404).json({ message: 'Gallery item not found' });
      }
      
      // Get creator information
      const creator = await storage.getUser(galleryItem.createdBy);
      
      res.json({
        ...galleryItem,
        creatorName: creator ? creator.fullName : 'Unknown'
      });
    } catch (error) {
      console.error('Error fetching gallery item:', error);
      res.status(500).json({ message: 'Failed to fetch gallery item' });
    }
  });
  
  // Create a new gallery item (admin only)
  apiRouter.post('/gallery-items', async (req, res) => {
    try {
      // Log the request body for debugging
      console.log('Gallery item request body:', req.body);
      
      // Check if the user has admin role
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization required' });
      }
      
      const token = authHeader.split(' ')[1];
      const username = token.split(':')[0];
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can create gallery items' });
      }

      // Prepare gallery item data with correct createdBy value from authenticated user
      const galleryItemData = {
        ...req.body,
        createdBy: user.id, // Always use the authenticated user's ID
        updatedAt: new Date(), // Ensure we have an updatedAt date
        isActive: true, // Default to active
        createdAt: new Date() // Ensure we have a createdAt date
      };
      
      // Validate the data with our corrected schema
      try {
        // Parse will throw if validation fails
        const validatedData = insertGalleryItemSchema.parse(galleryItemData);
        console.log('Validated gallery item data:', validatedData);
        
        // Create gallery item
        const newGalleryItem = await storage.createGalleryItem(validatedData);
        
        res.status(201).json(newGalleryItem);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error('Validation errors:', validationError.errors);
          return res.status(400).json({ 
            message: 'Invalid gallery item data', 
            errors: validationError.errors 
          });
        } else {
          console.error('Unexpected validation error:', validationError);
          throw validationError; // rethrow for the outer catch block
        }
      }
    } catch (error) {
      console.error('Error creating gallery item:', error);
      res.status(500).json({ message: 'Failed to create gallery item' });
    }
  });
  
  // Update a gallery item (admin only)
  apiRouter.patch('/gallery-items/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid gallery item ID' });
      }
      
      // Check if the user has admin role
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization required' });
      }
      
      const token = authHeader.split(' ')[1];
      const username = token.split(':')[0];
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can update gallery items' });
      }
      
      // Check if gallery item exists
      const existingItem = await storage.getGalleryItem(id);
      if (!existingItem) {
        return res.status(404).json({ message: 'Gallery item not found' });
      }
      
      // Log update request
      console.log('Updating gallery item. Request body:', req.body);
      
      // Bypass validation and directly update with all required fields
      try {
        const updatedItem = await storage.updateGalleryItem(id, {
          title: req.body.title || existingItem.title,
          content: req.body.content || existingItem.content,
          type: req.body.type || existingItem.type,
          description: req.body.description !== undefined ? req.body.description : existingItem.description,
          createdBy: existingItem.createdBy, // Keep the original createdBy value
          featured: req.body.featured !== undefined ? req.body.featured : existingItem.featured,
          orderIndex: req.body.orderIndex !== undefined ? req.body.orderIndex : existingItem.orderIndex,
          isActive: req.body.isActive !== undefined ? req.body.isActive : existingItem.isActive,
          createdAt: existingItem.createdAt,
          updatedAt: new Date()
        });
        
        res.json(updatedItem);
      } catch (storageError) {
        console.error('Storage error updating gallery item:', storageError);
        res.status(500).json({ message: 'Database error updating gallery item' });
      }
    } catch (error) {
      console.error('Error updating gallery item:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
        return res.status(400).json({ 
          message: 'Invalid gallery item data', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to update gallery item' });
    }
  });
  
  // Delete a gallery item (admin only)
  apiRouter.delete('/gallery-items/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid gallery item ID' });
      }
      
      // Check if the user has admin role
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization required' });
      }
      
      const token = authHeader.split(' ')[1];
      const username = token.split(':')[0];
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can delete gallery items' });
      }
      
      // Check if gallery item exists
      const existingItem = await storage.getGalleryItem(id);
      if (!existingItem) {
        return res.status(404).json({ message: 'Gallery item not found' });
      }
      
      // Delete gallery item
      const result = await storage.deleteGalleryItem(id);
      
      if (result) {
        res.status(204).send(); // No content response for successful deletion
      } else {
        res.status(500).json({ message: 'Failed to delete gallery item' });
      }
    } catch (error) {
      console.error('Error deleting gallery item:', error);
      res.status(500).json({ message: 'Failed to delete gallery item' });
    }
  });

  // Removed duplicate file upload endpoint - now using the one from setupUploadRoutes

  // Register API routes
  app.use('/api', apiRouter);

  // Setup static file serving for uploads
  app.use('/uploads', express.static('uploads'));
  
  // Make sure uploads directory exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
  }

  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time updates
  const wss = setupWebSocketServer(httpServer);
  console.log('WebSocket server initialized on path /ws');
  
  return httpServer;
}
