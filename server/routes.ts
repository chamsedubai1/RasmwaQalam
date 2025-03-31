import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import { z } from "zod";
import { generatePoem as generateOpenAIPoem, generateImage as generateOpenAIImage } from "./openai";
import { generateText as generateHuggingFaceText, generateImage as generateHuggingFaceImage } from "./huggingface";

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
          
          // 2. If we are in class voting mode, only show submissions from students in the same class
          if (classId) {
            // Get all users in the class
            const classUsers = await storage.getUsersByClass(classId);
            const classUserIds = classUsers.map(user => user.id);
            console.log(`Users in class ${classId}:`, classUserIds);
            
            const beforeClassFilter = submissions.length;
            // Only keep submissions from users in this class
            submissions = submissions.filter(sub => classUserIds.includes(sub.userId));
            console.log(`Filtered to only classmates: ${beforeClassFilter} -> ${submissions.length}`);
            
            // Debug: Get student submissions for this event
            const allStudentSubmissions = await storage.getSubmissionsByEvent(eventId);
            console.log(`All submissions for event ${eventId}:`, 
              allStudentSubmissions.map(s => ({ id: s.id, userId: s.userId, title: s.title })));
          } else if (currentUserId) {
            // If no class ID was explicitly provided but we have a current user,
            // try to get their class ID from their user info
            const currentUser = await storage.getUser(currentUserId);
            console.log('Current user:', currentUser);
            
            if (currentUser && currentUser.classId) {
              // Get all users in the current user's class
              const classUsers = await storage.getUsersByClass(currentUser.classId);
              const classUserIds = classUsers.map(user => user.id);
              console.log(`Users in current user's class ${currentUser.classId}:`, classUserIds);
              
              const beforeClassFilter = submissions.length;
              // Only keep submissions from users in the same class
              submissions = submissions.filter(sub => classUserIds.includes(sub.userId));
              console.log(`Filtered to only classmates: ${beforeClassFilter} -> ${submissions.length}`);
            }
          }
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
          
          return { ...sub, voteCount, hasVoted, userFullName };
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

  // Register API routes
  app.use('/api', apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}
