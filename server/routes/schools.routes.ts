import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertSchoolSchema } from "@shared/schema";
import { authenticateToken, requireRole, apiRateLimiter } from "../security";
import { createAuditLog, AuditAction, AuditSeverity } from "../audit-log";

const router = Router();

// Apply rate limiting to all routes
router.use(apiRateLimiter);

// City routes - authenticated users only
router.get('/cities', authenticateToken, async (req: Request, res: Response) => {
  try {
    const showInactive = req.query.showInactive === 'true';

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

router.get('/cities/:id', authenticateToken, async (req: Request, res: Response) => {
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

// SECURITY: Admin-only city creation with audit logging
router.post('/cities', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const newCity = await storage.createCity(req.body);

    // Audit log the creation
    await createAuditLog(req, AuditAction.RESOURCE_CREATED, 'city', {
      resourceId: String(newCity.id),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { after: newCity }
    });

    res.status(201).json(newCity);
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ message: 'Failed to create city' });
  }
});

// SECURITY: Admin-only city update with audit logging
router.patch('/cities/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const cityId = parseInt(req.params.id);
    const existingCity = await storage.getCity(cityId);

    const updatedCity = await storage.updateCity(cityId, req.body);
    if (!updatedCity) {
      return res.status(404).json({ message: 'City not found' });
    }

    // Audit log the update
    await createAuditLog(req, AuditAction.RESOURCE_UPDATED, 'city', {
      resourceId: String(cityId),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { before: existingCity, after: updatedCity }
    });

    res.json(updatedCity);
  } catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({ message: 'Failed to update city' });
  }
});

// SECURITY: Admin-only city deletion with audit logging
router.delete('/cities/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const cityId = parseInt(req.params.id);
    const existingCity = await storage.getCity(cityId);

    const result = await storage.deleteCity(cityId);
    if (!result) {
      return res.status(404).json({ message: 'City not found' });
    }

    // Audit log the deletion
    await createAuditLog(req, AuditAction.RESOURCE_DELETED, 'city', {
      resourceId: String(cityId),
      success: true,
      severity: AuditSeverity.WARNING,
      changes: { before: existingCity }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting city:', error);
    res.status(500).json({ message: 'Failed to delete city' });
  }
});

// School routes - authenticated users only
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const showInactive = req.query.showInactive === 'true';

    let schools = await storage.getAllSchools();

    if (!showInactive) {
      schools = schools.filter(school => school.isActive);
    }

    const allUsers = await storage.getAllUsers();

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

router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
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

// SECURITY: Admin-only school creation with audit logging
router.post('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const schoolData = insertSchoolSchema.parse(req.body);
    const school = await storage.createSchool(schoolData);

    // Audit log the creation
    await createAuditLog(req, AuditAction.RESOURCE_CREATED, 'school', {
      resourceId: String(school.id),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { after: school }
    });

    res.status(201).json(school);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid school data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create school' });
  }
});

// SECURITY: Admin/SchoolAdmin can update schools with audit logging
router.patch('/:id', authenticateToken, requireRole(['admin', 'schoolAdmin']), async (req: Request, res: Response) => {
  try {
    const schoolId = Number(req.params.id);
    const school = await storage.getSchool(schoolId);

    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // SchoolAdmins can only update their own school
    const user = (req as any).user;
    if (user.role === 'schoolAdmin' && user.schoolId !== schoolId) {
      return res.status(403).json({ message: 'You can only update your own school' });
    }

    const updatedSchool = await storage.updateSchool(schoolId, req.body);

    // Audit log the update
    await createAuditLog(req, AuditAction.RESOURCE_UPDATED, 'school', {
      resourceId: String(schoolId),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { before: school, after: updatedSchool }
    });

    res.json(updatedSchool);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update school' });
  }
});

// SECURITY: Admin-only school deletion with audit logging
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const schoolId = Number(req.params.id);
    const school = await storage.getSchool(schoolId);

    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const deleted = await storage.deleteSchool(schoolId);

    if (!deleted) {
      return res.status(500).json({ message: 'Failed to delete school' });
    }

    // Audit log the deletion
    await createAuditLog(req, AuditAction.RESOURCE_DELETED, 'school', {
      resourceId: String(schoolId),
      success: true,
      severity: AuditSeverity.WARNING,
      changes: { before: school }
    });

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete school' });
  }
});

export default router;
