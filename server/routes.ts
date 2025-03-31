import type { Express } from "express";
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
  
  // Registration endpoint
  apiRouter.post('/auth/register', async (req, res) => {
    try {
      // Validate the user data
      const userData = insertUserSchema.parse({
        ...req.body,
        isActive: true // Set to active by default
      });
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(409).json({ 
          message: 'Username already exists. Please choose a different username.' 
        });
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
      const users = await storage.getAllUsers();
      // Return users without passwords
      const sanitizedUsers = users.map(({ password, ...rest }) => rest);
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });
  
  apiRouter.get('/users/:id', async (req, res) => {
    try {
      const user = await storage.getUser(Number(req.params.id));
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });
  
  apiRouter.post('/users', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
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
      
      const updatedUser = await storage.updateUser(userId, req.body);
      
      // Return user without password
      const { password, ...userWithoutPassword } = updatedUser!;
      res.json(userWithoutPassword);
    } catch (error) {
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
      const schools = await storage.getAllSchools();
      res.json(schools);
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
      
      const updatedClass = await storage.updateClass(classId, req.body);
      res.json(updatedClass);
    } catch (error) {
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
      const partners = await storage.getAllPartners();
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
      } else if (eventId) {
        // Get all submissions for this event
        submissions = await storage.getSubmissionsByEvent(eventId);
        console.log(`Found ${submissions.length} submissions for event ID ${eventId}`);
        
        // If this is for voting purposes and we have a current user ID
        if (forVoting && currentUserId) {
          // 1. Filter out current user's own submissions
          const beforeFilter = submissions.length;
          submissions = submissions.filter(sub => sub.userId !== currentUserId);
          console.log(`Filtered out user's own submissions: ${beforeFilter} -> ${submissions.length}`);
          
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
              // SCHOOL STAGE: Only show winning submissions from the same grade level within the same school
              if (currentUser.schoolId) {
                // Get all users in the same school with the same grade level
                const allUsers = await storage.getUsersBySchool(currentUser.schoolId);
                
                // Get current user's class to determine grade level
                const userClass = currentUser.classId ? await storage.getClass(currentUser.classId) : null;
                const userGradeLevel = userClass ? userClass.gradeLevel : null;
                
                console.log(`User grade level: ${userGradeLevel}`);
                
                if (userGradeLevel) {
                  // Get all classes with the same grade level in this school
                  const allClasses = await storage.getClassesBySchool(currentUser.schoolId);
                  const sameGradeClasses = allClasses.filter(cls => cls.gradeLevel === userGradeLevel);
                  const sameGradeClassIds = sameGradeClasses.map(cls => cls.id);
                  
                  console.log(`Classes with grade level ${userGradeLevel}:`, sameGradeClassIds);
                  
                  // Get users from these classes
                  const sameGradeUsers = allUsers.filter(usr => 
                    usr.classId && sameGradeClassIds.includes(usr.classId)
                  );
                  const sameGradeUserIds = sameGradeUsers.map(usr => usr.id);
                  
                  console.log(`Users in same grade (${userGradeLevel}):`, sameGradeUserIds);
                  
                  // Filter submissions to only include those from same grade/school
                  const beforeSchoolFilter = submissions.length;
                  submissions = submissions.filter(sub => sameGradeUserIds.includes(sub.userId));
                  console.log(`Filtered to same grade in school: ${beforeSchoolFilter} -> ${submissions.length}`);
                }
              }
              break;
              
            case 'country':
              // COUNTRY STAGE: Only show winning submissions from the same grade level across all schools
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
                
                // Filter submissions to only include those from same grade across all schools
                const beforeCountryFilter = submissions.length;
                submissions = submissions.filter(sub => sameGradeUserIds.includes(sub.userId));
                console.log(`Filtered to same grade across all schools: ${beforeCountryFilter} -> ${submissions.length}`);
              }
              break;
              
            case 'global':
              // GLOBAL STAGE: No filtering needed, all submissions are visible
              console.log('Global stage: showing all submissions');
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
      
      // For each submission, get the vote count and whether current user voted
      const submissionsWithVotes = await Promise.all(
        submissions.map(async (sub) => {
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
      
      const voteCount = await storage.getVoteCountForSubmission(submission.id);
      
      res.json({ ...submission, voteCount });
    } catch (error) {
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
  
  apiRouter.get('/votes/count/:submissionId', async (req, res) => {
    try {
      const submissionId = Number(req.params.submissionId);
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
      
      // Get all votes from this voter
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
            gradeLevel: item.gradeLevel
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
          
          // Check if teacher role is correct
          if (teacher.role !== 'teacher') {
            const errorMsg = `User with ID ${classData.teacherId} is not a teacher (role: ${teacher.role})`;
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

  // Register API routes
  app.use('/api', apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}
