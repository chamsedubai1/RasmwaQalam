import { Router, Request, Response } from "express";
import { performance } from "perf_hooks";
import multer from "multer";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { storage } from "../storage";
import { monitoring } from "../monitoring";
import { hashPassword, authenticateToken, requireRole, apiRateLimiter } from "../security";
import { createAuditLog, AuditAction, AuditSeverity } from "../audit-log";
import * as ollama from "../ollama";

const router = Router();

// SECURITY: Apply rate limiting to all admin routes
router.use(apiRateLimiter);

// Set up file upload middleware
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// SECURITY: Admin-only statistics endpoint
router.get('/reports/statistics', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const submissions = await storage.getAllSubmissions();

    const totalSubmissions = submissions.length;
    const approvedSubmissions = submissions.filter(sub => sub.validated === true).length;
    const rejectedSubmissions = submissions.filter(sub => sub.validated === false).length;
    const pendingSubmissions = submissions.filter(sub => sub.validated === null).length;

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

    const votes = [];
    for (const sub of submissions) {
      const subVotes = await storage.getVotesBySubmission(sub.id);
      votes.push(...subVotes);
    }

    const schools = await storage.getAllSchools();
    const classes = await storage.getAllClasses();

    const schoolStats = await Promise.all(
      schools.map(async school => {
        const schoolUsers = await storage.getUsersBySchool(school.id);
        const schoolUserIds = schoolUsers.map(user => user.id);

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

    const classStats = await Promise.all(
      classes.map(async cls => {
        const classUsers = await storage.getUsersByClass(cls.id);
        const classUserIds = classUsers.map(user => user.id);

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

// SECURITY: Admin-only monitoring endpoint
router.get('/monitoring/system', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();

    const systemInfo = monitoring.getSystemInfo();

    const dbConnectionStatus = {
      isConnected: true,
      connectionTime: 0,
      error: null as string | null,
    };

    try {
      const dbStartTime = performance.now();
      await storage.getAllUsers();
      dbConnectionStatus.connectionTime = performance.now() - dbStartTime;
    } catch (dbError: unknown) {
      const error = dbError as Error;
      dbConnectionStatus.isConnected = false;
      dbConnectionStatus.error = error.message;
    }

    const apiServices = [
      { name: 'Ollama (self-hosted)', type: 'AI', status: await ollama.isOllamaAvailable() ? 'configured' : 'not configured' },
      { name: 'OpenAI', type: 'AI', status: process.env.OPENAI_API_KEY ? 'configured' : 'not configured' },
      { name: 'Stability.ai', type: 'AI', status: process.env.STABILITY_API_KEY ? 'configured' : 'not configured' },
      { name: 'Hugging Face', type: 'AI', status: process.env.HUGGING_FACE_API_KEY ? 'configured' : 'not configured' },
    ];

    const recentErrors = monitoring.getErrorLog();
    const requestStats = monitoring.getRequestStats();

    const users = await storage.getAllUsers();
    const submissions = await storage.getAllSubmissions();

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

    const securityMetrics = {
      failedLoginAttempts: {
        last24Hours: loginStats.failedRequests || 0,
        last7Days: loginStats.failedRequests || 0
      },
      suspiciousActivities: recentErrors
        .filter(err => err.statusCode === 401 || err.statusCode === 403)
        .map(err => `${err.method} ${err.endpoint} failed with ${err.statusCode} at ${new Date(err.timestamp).toLocaleString()}`)
    };

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
  } catch (error) {
    console.error('Error generating monitoring data:', error);
    res.status(500).json({ error: 'Failed to generate monitoring data' });
  }
});

// SECURITY: Admin-only data export with audit logging
// SECURITY ENHANCEMENT: Added pagination to prevent data scraping (for JSON exports)
router.get('/export/users', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllUsers();
    const schools = await storage.getAllSchools();
    const classes = await storage.getAllClasses();

    // SECURITY: Pagination for JSON responses (files get all data for completeness)
    const format = req.query.format as string || 'json';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 100)); // Max 500 for exports
    const offset = (page - 1) * limit;

    // SECURITY: Never export passwords, even hashed ones
    const exportableUsers = users.map(user => {
      const userSchool = schools.find(s => s.id === user.schoolId);
      const userClass = classes.find(c => c.id === user.classId);

      // Destructure to exclude password
      const { password, ...userWithoutPassword } = user;

      return {
        ...userWithoutPassword,
        schoolId: user.schoolId || '',
        classId: user.classId || '',
        schoolName: userSchool ? userSchool.name : '',
        className: userClass ? userClass.name : '',
        gradeLevel: userClass ? userClass.gradeLevel : ''
      };
    });

    // Audit log the export
    await createAuditLog(req, AuditAction.DATA_EXPORTED, 'users', {
      success: true,
      severity: AuditSeverity.INFO,
    });

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

    // SECURITY: Apply pagination for JSON responses
    const totalCount = exportableUsers.length;
    const paginatedUsers = exportableUsers.slice(offset, offset + limit);

    res.json({
      data: paginatedUsers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({ message: 'Failed to export users' });
  }
});

router.get('/export/schools', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
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

    res.json(schools);
  } catch (error) {
    console.error('Export schools error:', error);
    res.status(500).json({ message: 'Failed to export schools' });
  }
});

router.get('/export/classes', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
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

    res.json(classes);
  } catch (error) {
    console.error('Export classes error:', error);
    res.status(500).json({ message: 'Failed to export classes' });
  }
});

router.get('/export/events', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
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

    res.json(events);
  } catch (error) {
    console.error('Export events error:', error);
    res.status(500).json({ message: 'Failed to export events' });
  }
});

router.get('/export/:entity/:format', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { entity, format } = req.params;

    let data: unknown[] = [];
    let filename = entity;

    switch (entity) {
      case 'users':
        // SECURITY: Never export passwords, even hashed ones
        const users = await storage.getAllUsers();
        data = users.map(user => {
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
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

    if (format === 'csv') {
      const csv = Papa.unparse(data as Record<string, unknown>[]);
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(data as Record<string, unknown>[]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, entity);

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.header('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(Buffer.from(excelBuffer));
    } else if (format === 'json') {
      return res.json(data);
    }

    return res.status(400).json({ message: 'Invalid format' });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Failed to export data' });
  }
});

// SECURITY: Admin-only data import with audit logging
router.post('/import/users', authenticateToken, requireRole(['admin']), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();

    let userData: Record<string, unknown>[] = [];

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      userData = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileExt === 'csv') {
      const fs = await import('fs');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const result = Papa.parse(fileContent, { header: true });
      userData = result.data as Record<string, unknown>[];
    } else {
      return res.status(400).json({ message: 'Unsupported file format. Please use CSV or XLSX.' });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[]
    };

    for (const user of userData) {
      try {
        const username = String(user.username || '').trim();
        const email = String(user.email || '').trim();

        if (!username || !email) {
          results.errors.push(`Skipped row: missing username or email`);
          continue;
        }

        const existingUser = await storage.getUserByUsername(username);

        if (existingUser) {
          await storage.updateUser(existingUser.id, user);
          results.updated++;
        } else {
          // SECURITY: Generate cryptographically secure random password for imported users
          // Users MUST reset their password on first login
          const crypto = await import('crypto');
          const randomPassword = crypto.randomBytes(16).toString('base64') + '!Aa1'; // Meets password policy
          const hashedPassword = await hashPassword(randomPassword);

          await storage.createUser({
            username,
            email,
            password: hashedPassword,
            fullName: String(user.fullName || username),
            role: String(user.role || 'student') as 'student' | 'teacher' | 'admin' | 'schoolAdmin' | 'secondaryTeacher',
            isActive: user.isActive !== false,
            schoolId: user.schoolId ? Number(user.schoolId) : undefined,
            classId: user.classId ? Number(user.classId) : undefined,
            gradeLevel: user.gradeLevel ? String(user.gradeLevel) : undefined,
            // SECURITY: Flag to force password reset on first login
            // Note: This requires adding 'requirePasswordReset' field to schema
          });
          results.created++;

          // Log that password reset is required (admin should communicate this to users)
          console.log(`[IMPORT] User ${username} created - password reset required`);
        }
      } catch (userError: unknown) {
        const error = userError as Error;
        results.errors.push(`Error processing user: ${error.message}`);
      }
    }

    res.json({
      message: `Import completed: ${results.created} created, ${results.updated} updated`,
      ...results
    });
  } catch (error) {
    console.error('Import users error:', error);
    res.status(500).json({ message: 'Failed to import users' });
  }
});

router.post('/import/schools', authenticateToken, requireRole(['admin']), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();

    let schoolData: Record<string, unknown>[] = [];

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      schoolData = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileExt === 'csv') {
      const fs = await import('fs');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const result = Papa.parse(fileContent, { header: true });
      schoolData = result.data as Record<string, unknown>[];
    } else {
      return res.status(400).json({ message: 'Unsupported file format. Please use CSV or XLSX.' });
    }

    const results = {
      created: 0,
      errors: [] as string[]
    };

    for (const school of schoolData) {
      try {
        const name = String(school.name || '').trim();

        if (!name) {
          results.errors.push(`Skipped row: missing school name`);
          continue;
        }

        await storage.createSchool({
          name,
          cityId: school.cityId ? Number(school.cityId) : 1,
          isActive: school.isActive !== false
        });
        results.created++;
      } catch (schoolError: unknown) {
        const error = schoolError as Error;
        results.errors.push(`Error processing school: ${error.message}`);
      }
    }

    res.json({
      message: `Import completed: ${results.created} schools created`,
      ...results
    });
  } catch (error) {
    console.error('Import schools error:', error);
    res.status(500).json({ message: 'Failed to import schools' });
  }
});

router.post('/import/classes', authenticateToken, requireRole(['admin']), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();

    let classData: Record<string, unknown>[] = [];

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      classData = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileExt === 'csv') {
      const fs = await import('fs');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const result = Papa.parse(fileContent, { header: true });
      classData = result.data as Record<string, unknown>[];
    } else {
      return res.status(400).json({ message: 'Unsupported file format. Please use CSV or XLSX.' });
    }

    const results = {
      created: 0,
      errors: [] as string[]
    };

    for (const cls of classData) {
      try {
        const name = String(cls.name || '').trim();
        const schoolId = cls.schoolId ? Number(cls.schoolId) : undefined;

        if (!name || !schoolId) {
          results.errors.push(`Skipped row: missing class name or school ID`);
          continue;
        }

        await storage.createClass({
          name,
          schoolId,
          gradeLevel: String(cls.gradeLevel || ''),
          teacherId: cls.teacherId ? Number(cls.teacherId) : undefined,
          isLocked: cls.isLocked === true
        });
        results.created++;
      } catch (classError: unknown) {
        const error = classError as Error;
        results.errors.push(`Error processing class: ${error.message}`);
      }
    }

    res.json({
      message: `Import completed: ${results.created} classes created`,
      ...results
    });
  } catch (error) {
    console.error('Import classes error:', error);
    res.status(500).json({ message: 'Failed to import classes' });
  }
});

router.post('/import/events', authenticateToken, requireRole(['admin']), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();

    let eventData: Record<string, unknown>[] = [];

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      eventData = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileExt === 'csv') {
      const fs = await import('fs');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const result = Papa.parse(fileContent, { header: true });
      eventData = result.data as Record<string, unknown>[];
    } else {
      return res.status(400).json({ message: 'Unsupported file format. Please use CSV or XLSX.' });
    }

    const results = {
      created: 0,
      errors: [] as string[]
    };

    for (const event of eventData) {
      try {
        const name = String(event.name || '').trim();

        if (!name) {
          results.errors.push(`Skipped row: missing event name`);
          continue;
        }

        await storage.createEvent({
          name,
          description: String(event.description || ''),
          type: (event.type as 'poetry' | 'painting') || 'poetry',
          status: (event.status as 'upcoming' | 'open' | 'closed') || 'upcoming',
          stage: (event.stage as 'class' | 'school' | 'country' | 'global') || 'class',
          mode: (event.mode as 'allowAI' | 'noAI') || 'noAI',
          startDate: event.startDate ? new Date(String(event.startDate)) : new Date(),
          endDate: event.endDate ? new Date(String(event.endDate)) : new Date(),
          isEnabled: event.isEnabled !== false
        });
        results.created++;
      } catch (eventError: unknown) {
        const error = eventError as Error;
        results.errors.push(`Error processing event: ${error.message}`);
      }
    }

    res.json({
      message: `Import completed: ${results.created} events created`,
      ...results
    });
  } catch (error) {
    console.error('Import events error:', error);
    res.status(500).json({ message: 'Failed to import events' });
  }
});

export default router;
