import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import * as fs from "fs";

import { apiRateLimiter } from "../security";
import { validateCsrfToken } from "../csrf";
import { setupUploadRoutes, setupStaticUploads } from "../uploads";
import { setupWebSocketServer } from "../services/websocket";

// Import route modules
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import schoolsRoutes from "./schools.routes";
import classesRoutes from "./classes.routes";
import eventsRoutes from "./events.routes";
import registrationsRoutes from "./registrations.routes";
import submissionsRoutes from "./submissions.routes";
import aiRoutes from "./ai.routes";
import adminRoutes from "./admin.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes - all prefixed with /api
  const apiRouter = express.Router();

  // Apply general rate limiting to all API routes
  apiRouter.use(apiRateLimiter);

  // SECURITY ENHANCEMENT: Apply CSRF protection to all state-changing routes
  apiRouter.use(validateCsrfToken);

  // Mount route modules
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/users', usersRoutes);
  apiRouter.use('/schools', schoolsRoutes);
  apiRouter.use('/cities', schoolsRoutes); // Cities are handled by schools routes
  apiRouter.use('/classes', classesRoutes);
  apiRouter.use('/partners', classesRoutes); // Partners are handled by classes routes
  apiRouter.use('/events', eventsRoutes);
  apiRouter.use('/registrations', registrationsRoutes);
  apiRouter.use('/submissions', submissionsRoutes);
  apiRouter.use('/votes', submissionsRoutes); // Votes are handled by submissions routes
  apiRouter.use('/gallery-items', submissionsRoutes); // Gallery items are handled by submissions routes
  apiRouter.use('/ai', aiRoutes);
  apiRouter.use('/', adminRoutes); // Admin routes (reports, monitoring, import/export)

  // Also mount some routes at the root for backwards compatibility
  apiRouter.use('/', authRoutes); // For /captcha, /verify-captcha, etc.

  // Setup upload routes
  setupUploadRoutes(apiRouter);

  // Register API routes
  app.use('/api', apiRouter);

  // SECURITY: Use secure static uploads with signed URLs (not public static serving)
  // The setupStaticUploads function handles authentication and signed URL validation
  setupStaticUploads(app);

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

export default registerRoutes;
