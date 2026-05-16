import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { sendToChannel, broadcast } from "../services/websocket";
import { insertSubmissionSchema, insertVoteSchema, insertGalleryItemSchema } from "@shared/schema";
import { authenticateToken, requireRole, apiRateLimiter } from "../security";
import { createAuditLog, AuditAction, AuditSeverity } from "../audit-log";
import * as anthropic from "../anthropic";
import { sanitizeSubmissionContent } from "../validation";

const router = Router();

// Apply rate limiting to all routes
router.use(apiRateLimiter);

// Helper interface for user class details
interface UserClassDetails {
  userId: number;
  userName: string;
  classId: number;
  className: string;
  schoolId: number;
  gradeLevel: string;
}

// Get submissions with complex filtering - authenticated users only
// SECURITY ENHANCEMENT: Added pagination to prevent data scraping
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const classId = req.query.classId ? Number(req.query.classId) : undefined;
    const forVoting = req.query.forVoting === 'true';
    const currentUserId = req.query.currentUserId ? Number(req.query.currentUserId) : undefined;
    const requestedEventStage = req.query.currentEventStage as string;
    const requestedStage = req.query.requestedStage as string;

    // SECURITY: Pagination parameters with sensible defaults and limits
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50)); // Max 100 per page
    const offset = (page - 1) * limit;

    const currentEvent = eventId ? await storage.getEvent(eventId) : null;
    const currentEventStage = requestedEventStage || (currentEvent ? currentEvent.stage : 'class');

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
      if (forVoting && currentUserId) {
        console.log(`Getting validated submissions for voting in class ${classId}`);
        const allClassSubmissions = await storage.getSubmissionsByClass(classId);
        submissions = allClassSubmissions.filter(sub =>
          sub.userId !== currentUserId &&
          sub.validated === true
        );
        console.log(`After filtering for voting: ${submissions.length} submissions eligible for voting`);
      } else {
        console.log(`Getting submissions for class ID: ${classId}`);
        if (req.query.pending === 'true') {
          submissions = await storage.getSubmissionsPendingValidation(classId);
        } else if (req.query.validated === 'true') {
          submissions = await storage.getValidatedSubmissions(classId);
        } else if (req.query.rejected === 'true') {
          submissions = await storage.getRejectedSubmissions(classId);
        } else {
          submissions = await storage.getSubmissionsByClass(classId);
        }
      }
    } else if (eventId) {
      submissions = await storage.getSubmissionsByEvent(eventId);

      if (req.query.pending === 'true') {
        submissions = submissions.filter(sub => sub.validated === null);
      } else if (req.query.validated === 'true') {
        submissions = submissions.filter(sub => sub.validated === true);
      } else if (req.query.rejected === 'true') {
        submissions = submissions.filter(sub => sub.validated === false);
      }

      if (forVoting && currentUserId) {
        const currentUser = await storage.getUser(currentUserId);
        if (!currentUser) {
          return res.status(400).json({ message: 'Invalid user ID' });
        }

        const stageToUseForFiltering = requestedStage || currentEventStage;

        // Apply winner status filtering based on stage
        if (stageToUseForFiltering === 'school') {
          const allEventSubmissions = await storage.getSubmissionsByEvent(eventId);
          submissions = allEventSubmissions.filter(sub => sub.classWinner === true);
        } else if (stageToUseForFiltering === 'country') {
          const allEventSubmissions = await storage.getSubmissionsByEvent(eventId);
          submissions = allEventSubmissions.filter(sub => sub.schoolWinner === true);
        } else if (stageToUseForFiltering === 'global') {
          const allEventSubmissions = await storage.getSubmissionsByEvent(eventId);
          submissions = allEventSubmissions.filter(sub => sub.countryWinner === true);
        }

        // Filter out user's own submissions and unvalidated submissions
        submissions = submissions.filter(sub =>
          sub.userId !== currentUserId &&
          sub.validated === true
        );

        // Apply stage-specific context filters
        const userClass = currentUser.classId ? await storage.getClass(currentUser.classId) : null;
        const userGradeLevel = userClass ? userClass.gradeLevel : null;

        if (stageToUseForFiltering === 'class' && (classId || currentUser.classId)) {
          const targetClassId = classId || currentUser.classId;
          const classUsers = await storage.getUsersByClass(targetClassId!);
          const classUserIds = classUsers.map(user => user.id);
          submissions = submissions.filter(sub => classUserIds.includes(sub.userId));
        } else if (stageToUseForFiltering === 'school' && currentUser.schoolId && userGradeLevel) {
          const userClassDetailsMap = await buildUserClassDetailsMap(submissions);
          const sameGradeSchoolUserIds = filterUsersByGradeAndSchool(
            userClassDetailsMap,
            userGradeLevel,
            currentUser.schoolId
          );
          submissions = submissions.filter(sub => sameGradeSchoolUserIds.includes(sub.userId));
        } else if (stageToUseForFiltering === 'country' && userGradeLevel) {
          const userClassDetailsMap = await buildUserClassDetailsMap(submissions);
          const sameGradeUserIds = filterUsersByGrade(userClassDetailsMap, userGradeLevel);
          submissions = submissions.filter(sub => sameGradeUserIds.includes(sub.userId));
        }
      }
    } else {
      submissions = await storage.getAllSubmissions();
    }

    // Store total count before pagination
    const totalCount = submissions.length;

    // Apply pagination
    const paginatedSubmissions = submissions.slice(offset, offset + limit);

    // Enhance submissions with additional data (only paginated results)
    const enhancedSubmissions = await Promise.all(
      paginatedSubmissions.map(async (submission) => {
        const user = await storage.getUser(submission.userId);
        const event = await storage.getEvent(submission.eventId);
        const voteCount = await storage.getVoteCountForSubmission(submission.id);

        let classData = null;
        let schoolData = null;

        if (submission.classId) {
          classData = await storage.getClass(submission.classId);
          if (classData?.schoolId) {
            schoolData = await storage.getSchool(classData.schoolId);
          }
        } else if (user?.classId) {
          classData = await storage.getClass(user.classId);
          if (classData?.schoolId) {
            schoolData = await storage.getSchool(classData.schoolId);
          }
        }

        return {
          ...submission,
          voteCount,
          userFullName: user ? user.fullName : 'Unknown User',
          eventName: event ? event.name : 'Unknown Event',
          eventType: event ? event.type : undefined,
          className: classData ? classData.name : null,
          schoolName: schoolData ? schoolData.name : null,
          gradeLevel: classData ? classData.gradeLevel : null,
          statusText: submission.validated === null
            ? 'Pending'
            : submission.validated
              ? 'Approved'
              : 'Rejected',
          winnerStatus: {
            class: submission.classWinner,
            school: submission.schoolWinner,
            country: submission.countryWinner,
            global: submission.globalWinner
          }
        };
      })
    );

    // Return paginated response with metadata
    res.json({
      data: enhancedSubmissions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Failed to fetch submissions' });
  }
});

// Helper function to build user class details map
async function buildUserClassDetailsMap(submissions: { userId: number }[]): Promise<Map<number, UserClassDetails>> {
  const submissionUserIds = Array.from(new Set(submissions.map(sub => sub.userId)));
  const usersWithSubmissions = await Promise.all(
    submissionUserIds.map(userId => storage.getUser(userId))
  );

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
  return userClassDetailsMap;
}

function filterUsersByGradeAndSchool(
  map: Map<number, UserClassDetails>,
  gradeLevel: string,
  schoolId: number
): number[] {
  const result: number[] = [];
  map.forEach((details, userId) => {
    if (details.schoolId === schoolId && details.gradeLevel === gradeLevel) {
      result.push(userId);
    }
  });
  return result;
}

function filterUsersByGrade(map: Map<number, UserClassDetails>, gradeLevel: string): number[] {
  const result: number[] = [];
  map.forEach((details, userId) => {
    if (details.gradeLevel === gradeLevel) {
      result.push(userId);
    }
  });
  return result;
}

// Get submission by ID - authenticated users only
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const submissionId = Number(req.params.id);
    const submission = await storage.getSubmission(submissionId);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const user = await storage.getUser(submission.userId);
    const event = await storage.getEvent(submission.eventId);
    const voteCount = await storage.getVoteCountForSubmission(submissionId);

    let classData = null;
    let schoolData = null;
    let teacherData = null;

    if (submission.classId) {
      classData = await storage.getClass(submission.classId);
      if (classData) {
        teacherData = classData.teacherId ? await storage.getUser(classData.teacherId) : null;
        if (classData.schoolId) {
          schoolData = await storage.getSchool(classData.schoolId);
        }
      }
    } else if (user?.classId) {
      classData = await storage.getClass(user.classId);
      if (classData) {
        teacherData = classData.teacherId ? await storage.getUser(classData.teacherId) : null;
        if (classData.schoolId) {
          schoolData = await storage.getSchool(classData.schoolId);
        }
      }
    }

    const extendedSubmission = {
      ...submission,
      voteCount,
      user: user ? {
        id: user.id,
        fullName: user.fullName,
        role: user.role
      } : null,
      event: event ? {
        id: event.id,
        name: event.name,
        type: event.type,
        status: event.status,
        stage: event.stage
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

// Create submission - authenticated users only
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const submissionData = insertSubmissionSchema.parse(req.body);

    // Users can only create submissions for themselves (unless admin)
    if (currentUser.role !== 'admin' && submissionData.userId !== currentUser.id) {
      return res.status(403).json({ message: 'You can only create submissions for yourself' });
    }

    const registrations = await storage.getRegistrationsByUser(submissionData.userId);
    const isRegistered = registrations.some(reg => reg.eventId === submissionData.eventId);

    if (!isRegistered) {
      return res.status(403).json({ message: 'User is not registered for this event' });
    }

    const event = await storage.getEvent(submissionData.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const user = await storage.getUser(submissionData.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.classId) {
      submissionData.classId = user.classId;
    }

    if (event.stage !== 'class') {
      return res.status(403).json({
        message: 'Submissions are only allowed for events in the class stage',
        currentStage: event.stage
      });
    }

    if (event.type && typeof event.type === 'string') {
      const eventType = event.type.toLowerCase();

      if (eventType === 'poetry' && submissionData.contentType !== 'text') {
        return res.status(400).json({
          message: 'Poetry events only accept text submissions',
          eventType: eventType,
          submittedContentType: submissionData.contentType
        });
      }

      if (eventType === 'painting' && submissionData.contentType !== 'image') {
        return res.status(400).json({
          message: 'Painting events only accept image submissions',
          eventType: eventType,
          submittedContentType: submissionData.contentType
        });
      }
    }

    const existingSubmissions = await storage.getSubmissionsByUserAndEvent(
      submissionData.userId,
      submissionData.eventId
    );

    if (existingSubmissions.length >= 3) {
      return res.status(403).json({ message: 'Maximum number of submissions (3) reached for this event' });
    }

    // SECURITY: Sanitize all text content to prevent XSS attacks
    if (submissionData.title) {
      submissionData.title = sanitizeSubmissionContent(submissionData.title);
    }
    if (submissionData.contentType === 'text' && submissionData.content) {
      submissionData.content = sanitizeSubmissionContent(submissionData.content);
    }
    if (submissionData.description) {
      submissionData.description = sanitizeSubmissionContent(submissionData.description);
    }

    // SECURITY: Content moderation for student safety
    // Moderate text content (titles and poem content)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        // Moderate the title
        if (submissionData.title) {
          const titleModeration = await anthropic.moderateContent(submissionData.title);
          if (!titleModeration.isSafe) {
            console.warn(`[SECURITY] Submission title blocked for user ${currentUser.id}: ${titleModeration.category}`);
            return res.status(400).json({
              message: 'Your submission title contains inappropriate content. Please revise and try again.',
              code: 'CONTENT_BLOCKED',
              field: 'title'
            });
          }
        }

        // Moderate text content (poetry submissions)
        if (submissionData.contentType === 'text' && submissionData.content) {
          const contentModeration = await anthropic.moderateContent(submissionData.content);
          if (!contentModeration.isSafe) {
            console.warn(`[SECURITY] Submission content blocked for user ${currentUser.id}: ${contentModeration.category}`);
            return res.status(400).json({
              message: 'Your submission contains inappropriate content. Please revise and try again.',
              code: 'CONTENT_BLOCKED',
              field: 'content',
              category: contentModeration.category
            });
          }
        }

        console.log(`[MODERATION] Submission content approved for user ${currentUser.id}`);
      } catch (moderationError) {
        console.error('[MODERATION] Content moderation failed:', moderationError);
        // In strict mode, you could block submission if moderation fails
        // For now, we log and allow (teacher will manually review)
      }
    } else {
      console.warn('[SECURITY] Content moderation unavailable - submission will require manual review');
    }

    const submission = await storage.createSubmission(submissionData);

    if (user.classId) {
      sendToChannel(`class_${user.classId}`, 'SUBMISSION_UPDATE', {
        action: 'created',
        submission: submission,
        eventName: event.name
      });
    }

    sendToChannel(`event_${submissionData.eventId}`, 'SUBMISSION_UPDATE', {
      action: 'created',
      submission: submission,
      eventName: event.name
    });

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

// Update submission - owner or teacher/admin only
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const submissionId = Number(req.params.id);
    const submission = await storage.getSubmission(submissionId);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Authorization: owner, teacher of the class, or admin
    const isOwner = submission.userId === currentUser.id;
    const isTeacherOfClass = (currentUser.role === 'teacher' || currentUser.role === 'secondaryTeacher') &&
                              submission.classId === currentUser.classId;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isTeacherOfClass && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Non-admins/teachers cannot modify validation status
    if (req.body.validated !== undefined && !isTeacherOfClass && !isAdmin) {
      return res.status(403).json({ message: 'Only teachers or admins can validate submissions' });
    }

    const updatedSubmission = await storage.updateSubmission(submissionId, req.body);
    const voteCount = await storage.getVoteCountForSubmission(submissionId);

    res.json({ ...updatedSubmission, voteCount });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update submission' });
  }
});

// Delete submission - owner or admin only
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const submissionId = Number(req.params.id);
    const submission = await storage.getSubmission(submissionId);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Only owner or admin can delete
    if (submission.userId !== currentUser.id && currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const deleted = await storage.deleteSubmission(submissionId);

    if (!deleted) {
      return res.status(500).json({ message: 'Failed to delete submission' });
    }

    await createAuditLog(req, AuditAction.DATA_DELETED, 'submission', {
      resourceId: String(submissionId),
      success: true,
      severity: AuditSeverity.WARNING,
      changes: { before: submission }
    });

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete submission' });
  }
});

// Validate submission (teacher approval)
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

    const validationValue = validated === true || validated === 'true';
    const updatedSubmission = await storage.validateSubmission(submissionId, validationValue);

    if (!updatedSubmission) {
      return res.status(500).json({ message: 'Failed to validate submission' });
    }

    const voteCount = await storage.getVoteCountForSubmission(submissionId);
    const user = await storage.getUser(submission.userId);
    const event = await storage.getEvent(submission.eventId);

    // Send WebSocket notifications
    if (submission.classId) {
      sendToChannel(`class_${submission.classId}`, 'SUBMISSION_UPDATE', {
        action: 'validated',
        submission: updatedSubmission,
        validated: validationValue,
        submissionId: submissionId
      });
    }

    sendToChannel(`event_${submission.eventId}`, 'SUBMISSION_UPDATE', {
      action: 'validated',
      submission: updatedSubmission,
      validated: validationValue,
      submissionId: submissionId
    });

    sendToChannel(`user_${submission.userId}`, 'SUBMISSION_UPDATE', {
      action: 'validated',
      submission: updatedSubmission,
      validated: validationValue,
      submissionId: submissionId,
      eventName: event ? event.name : 'Unknown Event'
    });

    let classData = null;
    let schoolData = null;
    let teacherData = null;

    if (submission.classId) {
      classData = await storage.getClass(submission.classId);
      if (classData) {
        teacherData = classData.teacherId ? await storage.getUser(classData.teacherId) : null;
        if (classData.schoolId) {
          schoolData = await storage.getSchool(classData.schoolId);
        }
      }
    } else if (user?.classId) {
      classData = await storage.getClass(user.classId);
      if (classData) {
        teacherData = classData.teacherId ? await storage.getUser(classData.teacherId) : null;
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

// Teacher/admin only validation endpoints
router.post('/:id/validate', authenticateToken, requireRole(['teacher', 'secondaryTeacher', 'admin']), handleValidation);
router.put('/:id/validate', authenticateToken, requireRole(['teacher', 'secondaryTeacher', 'admin']), handleValidation);

// Mark submissions as winners - admin only
router.post('/mark-winners', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { eventId, stage, winnerIds } = req.body;

    if (!eventId || !stage || !Array.isArray(winnerIds)) {
      return res.status(400).json({
        message: 'Invalid request data. Required: eventId, stage, and winnerIds array'
      });
    }

    const eventSubmissions = await storage.getSubmissionsByEvent(eventId);
    const eventSubmissionIds = eventSubmissions.map(s => s.id);
    const invalidIds = winnerIds.filter(id => !eventSubmissionIds.includes(id));

    if (invalidIds.length > 0) {
      return res.status(400).json({
        message: `Some submissions don't exist or don't belong to this event: ${invalidIds.join(', ')}`
      });
    }

    const winnerField =
      stage === 'class' ? 'classWinner' :
        stage === 'school' ? 'schoolWinner' :
          stage === 'country' ? 'countryWinner' : 'globalWinner';

    const updatePromises = winnerIds.map(id =>
      storage.updateSubmission(id, { [winnerField]: true })
    );

    await Promise.all(updatePromises);

    const event = await storage.getEvent(eventId);

    sendToChannel(`event_${eventId}`, 'WINNERS_SELECTED', {
      action: 'winners_marked',
      stage: stage,
      winnerIds: winnerIds,
      eventName: event ? event.name : 'Unknown Event'
    });

    sendToChannel('admin', 'WINNERS_SELECTED', {
      action: 'winners_marked',
      stage: stage,
      winnerIds: winnerIds,
      eventName: event ? event.name : 'Unknown Event'
    });

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

// Vote routes - authenticated users only
router.post('/votes', authenticateToken, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const voteData = insertVoteSchema.parse(req.body);

    // Users can only vote as themselves
    if (voteData.voterId !== currentUser.id) {
      return res.status(403).json({ message: 'You can only vote as yourself' });
    }

    const submission = await storage.getSubmission(voteData.submissionId);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (submission.userId === voteData.voterId) {
      return res.status(400).json({ message: 'You cannot vote for your own submission' });
    }

    const hasVoted = await storage.hasUserVotedForSubmission(voteData.voterId, voteData.submissionId);
    if (hasVoted) {
      return res.status(409).json({ message: 'You have already voted for this submission' });
    }

    const event = await storage.getEvent(submission.eventId);
    const eventSubmissions = await storage.getSubmissionsByEvent(submission.eventId);
    const eventSubmissionIds = eventSubmissions.map(s => s.id);

    const userVotes = await storage.getVotesByVoter(voteData.voterId);
    const votesInThisEvent = userVotes.filter(vote =>
      eventSubmissionIds.includes(vote.submissionId)
    );

    if (votesInThisEvent.length >= 3) {
      return res.status(403).json({
        message: 'You have already used all 3 of your votes in this event',
        votesUsed: votesInThisEvent.length,
        maxVotes: 3
      });
    }

    const vote = await storage.createVote(voteData);

    sendToChannel(`event_${submission.eventId}`, 'VOTE_UPDATE', {
      action: 'created',
      submissionId: voteData.submissionId,
      voterId: voteData.voterId,
      eventName: event ? event.name : 'Unknown Event'
    });

    sendToChannel(`user_${submission.userId}`, 'VOTE_UPDATE', {
      action: 'received_vote',
      submissionId: voteData.submissionId,
      submissionTitle: submission.title,
      eventName: event ? event.name : 'Unknown Event'
    });

    res.status(201).json({
      ...vote,
      votesRemaining: 3 - (votesInThisEvent.length + 1)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid vote data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create vote' });
  }
});

router.get('/votes/count/:submissionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const submissionId = Number(req.params.submissionId);
    const voteCount = await storage.getVoteCountForSubmission(submissionId);
    res.json({ count: voteCount });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vote count' });
  }
});

router.get('/votes/check', authenticateToken, async (req: Request, res: Response) => {
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

router.get('/votes/count-by-voter', authenticateToken, async (req: Request, res: Response) => {
  try {
    const voterId = req.query.voterId ? Number(req.query.voterId) : undefined;
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;

    if (!voterId || !eventId) {
      return res.status(400).json({ message: 'voterId and eventId query parameters are required' });
    }

    const eventSubmissions = await storage.getSubmissionsByEvent(eventId);
    const eventSubmissionIds = eventSubmissions.map(s => s.id);

    const userVotes = await storage.getVotesByVoter(voterId);
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

// Gallery routes - authenticated users only
router.get('/gallery-items', authenticateToken, async (req: Request, res: Response) => {
  try {
    const showInactive = req.query.showInactive === 'true';
    let galleryItems = await storage.getAllGalleryItems();

    if (!showInactive) {
      galleryItems = galleryItems.filter(item => item.isActive);
    }

    const enhancedItems = await Promise.all(galleryItems.map(async (item) => {
      const submission = await storage.getSubmission(item.submissionId);
      const event = submission ? await storage.getEvent(submission.eventId) : null;
      const user = submission ? await storage.getUser(submission.userId) : null;

      return {
        ...item,
        submission: submission ? {
          id: submission.id,
          title: submission.title,
          contentType: submission.contentType,
          content: submission.content
        } : null,
        eventName: event ? event.name : 'Unknown Event',
        userName: user ? user.fullName : 'Unknown User'
      };
    }));

    res.json(enhancedItems);
  } catch (error) {
    console.error('Error fetching gallery items:', error);
    res.status(500).json({ message: 'Failed to fetch gallery items' });
  }
});

router.get('/gallery-items/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid gallery item ID' });
    }

    const item = await storage.getGalleryItem(id);
    if (!item) {
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    const submission = await storage.getSubmission(item.submissionId);
    const event = submission ? await storage.getEvent(submission.eventId) : null;
    const user = submission ? await storage.getUser(submission.userId) : null;

    res.json({
      ...item,
      submission,
      eventName: event ? event.name : 'Unknown Event',
      userName: user ? user.fullName : 'Unknown User'
    });
  } catch (error) {
    console.error('Error fetching gallery item:', error);
    res.status(500).json({ message: 'Failed to fetch gallery item' });
  }
});

router.post('/gallery-items', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const galleryData = insertGalleryItemSchema.parse(req.body);
    const item = await storage.createGalleryItem(galleryData);

    await createAuditLog(req, AuditAction.DATA_CREATED, 'gallery_item', {
      resourceId: String(item.id),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { after: item }
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating gallery item:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid gallery item data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create gallery item' });
  }
});

router.patch('/gallery-items/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid gallery item ID' });
    }

    const existingItem = await storage.getGalleryItem(id);
    if (!existingItem) {
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    const updatedItem = await storage.updateGalleryItem(id, {
      ...existingItem,
      ...req.body,
      updatedAt: new Date()
    });

    await createAuditLog(req, AuditAction.DATA_UPDATED, 'gallery_item', {
      resourceId: String(id),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { before: existingItem, after: updatedItem }
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating gallery item:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid gallery item data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update gallery item' });
  }
});

router.delete('/gallery-items/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid gallery item ID' });
    }

    const existingItem = await storage.getGalleryItem(id);
    if (!existingItem) {
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    const result = await storage.deleteGalleryItem(id);

    if (result) {
      await createAuditLog(req, AuditAction.DATA_DELETED, 'gallery_item', {
        resourceId: String(id),
        success: true,
        severity: AuditSeverity.WARNING,
        changes: { before: existingItem }
      });

      res.status(204).send();
    } else {
      res.status(500).json({ message: 'Failed to delete gallery item' });
    }
  } catch (error) {
    console.error('Error deleting gallery item:', error);
    res.status(500).json({ message: 'Failed to delete gallery item' });
  }
});

export default router;
