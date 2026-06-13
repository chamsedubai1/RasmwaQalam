import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertRegistrationSchema } from "@shared/schema";
import { authenticateToken, apiRateLimiter } from "../security";

/**
 * Event registration routes.
 *
 * Mounted at /api/registrations. Any authenticated user may list, create
 * (themselves only — server enforces below), and delete their own
 * registrations. Previously these handlers lived inside events.routes.ts
 * at the path `/registrations`, which meant they only resolved at
 * `/api/events/registrations` and `/api/registrations/registrations` —
 * not at `/api/registrations`, which is what the client actually calls.
 * A POST to /api/registrations was hitting POST `/` on events.routes.ts
 * (event creation, admin-only), which is why students got a 403.
 */

const router = Router();

router.use(apiRateLimiter);

// GET /api/registrations — list by user or event
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const currentUser = (req as any).user;

    let registrations;
    if (userId) {
      // Users may only list their own registrations; admins/teachers may list any.
      if (
        userId !== currentUser.id &&
        currentUser.role !== 'admin' &&
        currentUser.role !== 'teacher' &&
        currentUser.role !== 'secondaryTeacher' &&
        currentUser.role !== 'schoolAdmin'
      ) {
        return res.status(403).json({ message: 'You can only view your own registrations' });
      }
      registrations = await storage.getRegistrationsByUser(userId);
    } else if (eventId) {
      registrations = await storage.getRegistrationsByEvent(eventId);
    } else {
      return res.status(400).json({ message: 'userId or eventId query parameter is required' });
    }

    res.json(registrations);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ message: 'Failed to fetch registrations' });
  }
});

// POST /api/registrations — register the current user for an event
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const registrationData = insertRegistrationSchema.parse(req.body);

    // SECURITY: A user can only register themselves (unless admin/teacher
    // is registering a student in their class, which we permit).
    if (
      registrationData.userId !== currentUser.id &&
      currentUser.role !== 'admin' &&
      currentUser.role !== 'teacher' &&
      currentUser.role !== 'secondaryTeacher' &&
      currentUser.role !== 'schoolAdmin'
    ) {
      return res.status(403).json({ message: 'You can only register yourself for events' });
    }

    const existingRegistrations = await storage.getRegistrationsByUser(registrationData.userId);
    const alreadyRegistered = existingRegistrations.some((reg) => reg.eventId === registrationData.eventId);

    if (alreadyRegistered) {
      return res.status(409).json({ message: 'User already registered for this event' });
    }

    const registration = await storage.createRegistration(registrationData);
    res.status(201).json(registration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid registration data', errors: error.errors });
    }
    console.error('Error creating registration:', error);
    res.status(500).json({ message: 'Failed to create registration' });
  }
});

// DELETE /api/registrations?userId=X&eventId=Y — unregister
router.delete('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const currentUser = (req as any).user;

    if (!userId || !eventId) {
      return res.status(400).json({ message: 'userId and eventId query parameters are required' });
    }

    // SECURITY: Only the user themselves or an admin/teacher can delete.
    if (
      userId !== currentUser.id &&
      currentUser.role !== 'admin' &&
      currentUser.role !== 'teacher' &&
      currentUser.role !== 'secondaryTeacher' &&
      currentUser.role !== 'schoolAdmin'
    ) {
      return res.status(403).json({ message: 'You can only unregister yourself' });
    }

    const registrations = await storage.getRegistrationsByUser(userId);
    const registration = registrations.find((reg) => reg.eventId === eventId);

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const deleted = await storage.deleteRegistration(registration.id);
    if (!deleted) {
      return res.status(500).json({ message: 'Failed to delete registration' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({ message: 'Failed to delete registration' });
  }
});

export default router;
