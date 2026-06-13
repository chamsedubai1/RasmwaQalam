import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { sendToChannel, broadcast } from "../services/websocket";
import { insertEventSchema, insertRegistrationSchema, Submission, School, Class } from "@shared/schema";
import { authenticateToken, requireRole, apiRateLimiter } from "../security";
import { createAuditLog, AuditAction, AuditSeverity } from "../audit-log";

const router = Router();

// Apply rate limiting to all routes
router.use(apiRateLimiter);

// Get all events with optional filters - authenticated users only
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const stage = req.query.stage as string | undefined;
    const includeDisabled = req.query.includeDisabled === 'true';

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

    if (!includeDisabled) {
      events = events.filter(event => event.isEnabled !== false);
    }

    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const registrations = await storage.getRegistrationsByEvent(event.id);
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

// Get event by ID - authenticated users only
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.id);
    const event = await storage.getEvent(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const registrations = await storage.getRegistrationsByEvent(eventId);
    const submissions = await storage.getSubmissionsByEvent(eventId);

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

// SECURITY: Admin-only event creation with audit logging
router.post('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    console.log('Event creation request received:', req.body);
    const eventData = insertEventSchema.parse(req.body);
    console.log('Validated event data:', eventData);
    const event = await storage.createEvent(eventData);
    console.log('Event created successfully:', event);

    // Audit log the creation
    await createAuditLog(req, AuditAction.RESOURCE_CREATED, 'event', {
      resourceId: String(event.id),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { after: event }
    });

    broadcast('EVENT_UPDATE', {
      action: 'created',
      event: event
    });

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

// SECURITY: Admin-only event update with audit logging
router.patch('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.id);
    const event = await storage.getEvent(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const updateData = {
      ...req.body,
      isEnabled: req.body.isEnabled === true || req.body.isEnabled === 'true',
    };

    console.log('Updating event with data:', updateData);
    const updatedEvent = await storage.updateEvent(eventId, updateData);

    // Audit log the update
    await createAuditLog(req, AuditAction.RESOURCE_UPDATED, 'event', {
      resourceId: String(eventId),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { before: event, after: updatedEvent }
    });

    broadcast('EVENT_UPDATE', {
      action: 'updated',
      event: updatedEvent
    });

    sendToChannel('admin', 'EVENT_UPDATE', {
      action: 'updated',
      event: updatedEvent
    });

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(updatedEvent);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Failed to update event' });
  }
});

// SECURITY: Admin-only event deletion with audit logging
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
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

    // Audit log the deletion
    await createAuditLog(req, AuditAction.RESOURCE_DELETED, 'event', {
      resourceId: String(eventId),
      success: true,
      severity: AuditSeverity.WARNING,
      changes: { before: event }
    });

    broadcast('EVENT_UPDATE', {
      action: 'deleted',
      eventId: eventId,
      eventName: event.name
    });

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

// SECURITY: Admin/teacher only - get event participants
router.get('/:eventId/participants', authenticateToken, requireRole(['admin', 'teacher', 'secondaryTeacher', 'schoolAdmin']), async (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.eventId);
    const event = await storage.getEvent(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const registrations = await storage.getRegistrationsByEvent(eventId);
    const submissions = await storage.getSubmissionsByEvent(eventId);

    const participantsData = await Promise.all(
      registrations.map(async (reg) => {
        const user = await storage.getUser(reg.userId);
        if (!user) return null;

        const userSubmissions = submissions.filter(s => s.userId === reg.userId);

        let className = null;
        let schoolName = null;
        if (user.classId) {
          const classInfo = await storage.getClass(user.classId);
          if (classInfo) {
            className = classInfo.name;
            if (classInfo.schoolId) {
              const school = await storage.getSchool(classInfo.schoolId);
              schoolName = school ? school.name : null;
            }
          }
        }

        return {
          userId: user.id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          role: user.role,
          className,
          schoolName,
          registeredAt: reg.registeredAt,
          submissionCount: userSubmissions.length,
          hasSubmitted: userSubmissions.length > 0
        };
      })
    );

    res.json(participantsData.filter(Boolean));
  } catch (error) {
    console.error('Error fetching event participants:', error);
    res.status(500).json({ message: 'Failed to fetch participants' });
  }
});

// SECURITY: Admin-only - send reminder for event
router.post('/:eventId/reminder', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.eventId);
    const event = await storage.getEvent(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const registrations = await storage.getRegistrationsByEvent(eventId);
    const submissions = await storage.getSubmissionsByEvent(eventId);

    const usersWithSubmissions = new Set(submissions.map(s => s.userId));

    const usersToRemind = registrations
      .filter(reg => !usersWithSubmissions.has(reg.userId))
      .map(reg => reg.userId);

    for (const userId of usersToRemind) {
      sendToChannel(`user_${userId}`, 'EVENT_REMINDER', {
        eventId: event.id,
        eventName: event.name,
        message: `Reminder: Please submit your entry for "${event.name}" before the deadline!`
      });
    }

    res.json({
      message: `Reminder sent to ${usersToRemind.length} participants`,
      reminderCount: usersToRemind.length
    });
  } catch (error) {
    console.error('Error sending event reminder:', error);
    res.status(500).json({ message: 'Failed to send reminder' });
  }
});

// SECURITY: Admin-only - promote event to next stage with audit logging
router.post('/:id/promote', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.id);
    const event = await storage.getEvent(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    let nextStage: string;
    const currentStage = event.stage;

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

    const eventSubmissions = await storage.getSubmissionsByEvent(eventId);
    const eventSubmissionIds = eventSubmissions.map(s => s.id);

    console.log(`Removing votes for ${eventSubmissionIds.length} submissions in event ${eventId} for promotion to ${nextStage} stage`);

    const submissionsWithVoteCounts = await Promise.all(
      eventSubmissions.map(async (sub) => {
        const voteCount = await storage.getVoteCountForSubmission(sub.id);
        const user = await storage.getUser(sub.userId);
        const classId = user?.classId;
        return { ...sub, voteCount, classId };
      })
    );

    const classIdsSet = new Set<number>();
    submissionsWithVoteCounts
      .filter(sub => sub.classId !== undefined && sub.classId !== null)
      .forEach(sub => classIdsSet.add(sub.classId as number));

    const classIds = Array.from(classIdsSet);
    console.log(`Found submissions from ${classIds.length} different classes`);

    const winnerField =
      currentStage === 'class' ? 'classWinner' :
        currentStage === 'school' ? 'schoolWinner' :
          currentStage === 'country' ? 'countryWinner' : 'globalWinner';

    let winnerIds: number[] = [];

    if (currentStage === 'class') {
      for (const classId of classIds) {
        const classSubmissions = submissionsWithVoteCounts.filter(sub => sub.classId === classId);
        classSubmissions.sort((a, b) => b.voteCount - a.voteCount);

        console.log(`Class ${classId}: ${classSubmissions.length} submissions`);

        if (classSubmissions.length === 0) continue;

        const topSubmissionsForClass = [];

        if (classSubmissions.length >= 1) topSubmissionsForClass.push(classSubmissions[0]);
        if (classSubmissions.length >= 2) topSubmissionsForClass.push(classSubmissions[1]);

        if (classSubmissions.length >= 3) {
          const thirdPlaceScore = classSubmissions[2].voteCount;
          const tiedSubmissions = classSubmissions.filter((sub, index) =>
            index >= 2 && sub.voteCount === thirdPlaceScore
          );
          topSubmissionsForClass.push(...tiedSubmissions);
        }

        const classWinnerIds = topSubmissionsForClass.map(sub => sub.id);
        winnerIds.push(...classWinnerIds);

        console.log(`Top submissions for class ${classId}:`, classWinnerIds.length);
      }
    } else {
      submissionsWithVoteCounts.sort((a, b) => b.voteCount - a.voteCount);

      const topSubmissions = [];

      if (submissionsWithVoteCounts.length >= 1) topSubmissions.push(submissionsWithVoteCounts[0]);
      if (submissionsWithVoteCounts.length >= 2) topSubmissions.push(submissionsWithVoteCounts[1]);

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

    for (const id of winnerIds) {
      await storage.updateSubmission(id, { [winnerField]: true });
    }

    for (const submissionId of eventSubmissionIds) {
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

    const updatedEvent = await storage.updateEvent(eventId, {
      stage: nextStage as "class" | "school" | "country" | "global"
    });

    broadcast('EVENT_UPDATE', {
      action: 'promoted',
      eventId: eventId,
      eventName: event.name,
      previousStage: currentStage,
      newStage: nextStage,
      winnerCount: winnerIds.length
    });

    sendToChannel('admin', 'EVENT_UPDATE', {
      action: 'promoted',
      eventId: eventId,
      eventName: event.name,
      previousStage: currentStage,
      newStage: nextStage,
      winnerCount: winnerIds.length
    });

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

// SECURITY: Authenticated users can view voting history
router.get('/:id/voting-history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.id);
    const classId = req.query.classId ? Number(req.query.classId) : null;

    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const allSubmissions = await storage.getSubmissionsByEvent(eventId);

    const classStageWinners = allSubmissions.filter(sub => sub.classWinner === true);
    const schoolStageWinners = allSubmissions.filter(sub => sub.schoolWinner === true);
    const countryStageWinners = allSubmissions.filter(sub => sub.countryWinner === true);
    const globalStageWinners = allSubmissions.filter(sub => sub.globalWinner === true);

    let classInfo: Class | null = null;
    let schoolInfo: School | null = null;
    let filteredClassWinners = classStageWinners;
    let filteredSchoolWinners = schoolStageWinners;

    if (classId) {
      classInfo = await storage.getClass(classId);

      if (classInfo) {
        schoolInfo = classInfo.schoolId ? await storage.getSchool(classInfo.schoolId) : null;

        const classWinnersFiltered: Submission[] = [];
        for (const sub of classStageWinners) {
          const user = await storage.getUser(sub.userId);
          if (user && user.classId === classId) {
            classWinnersFiltered.push(sub);
          }
        }
        filteredClassWinners = classWinnersFiltered;

        if (schoolInfo && classInfo.gradeLevel) {
          const schoolWinnersFiltered: Submission[] = [];
          for (const sub of schoolStageWinners) {
            const user = await storage.getUser(sub.userId);
            if (!user || !user.classId) continue;

            const userClass = await storage.getClass(user.classId);
            if (userClass &&
              userClass.schoolId === classInfo.schoolId &&
              userClass.gradeLevel === classInfo.gradeLevel) {
              schoolWinnersFiltered.push(sub);
            }
          }
          filteredSchoolWinners = schoolWinnersFiltered;
        }
      }
    }

    const processSubmissions = async (submissions: Submission[]) => {
      return await Promise.all(
        submissions.map(async (sub) => {
          const voteCount = await storage.getVoteCountForSubmission(sub.id);
          const user = await storage.getUser(sub.userId);
          const userFullName = user ? user.fullName : 'Anonymous';

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

    const result = {
      eventId,
      eventName: event.name,
      currentStage: event.stage,
      votingHistory: {
        class: await processSubmissions(filteredClassWinners),
        school: await processSubmissions(filteredSchoolWinners),
        country: await processSubmissions(countryStageWinners),
        global: await processSubmissions(globalStageWinners)
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching voting history:', error);
    res.status(500).json({ message: 'Failed to fetch voting history' });
  }
});

// Registration routes moved to server/routes/registrations.routes.ts and
// mounted at /api/registrations so the URL the client actually calls
// resolves to the right handler (was hitting POST /events as admin-only).

export default router;
