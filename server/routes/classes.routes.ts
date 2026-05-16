import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertClassSchema, insertPartnerSchema } from "@shared/schema";
import { authenticateToken, requireRole, apiRateLimiter } from "../security";
import { createAuditLog, AuditAction, AuditSeverity } from "../audit-log";

const router = Router();

// Apply rate limiting
router.use(apiRateLimiter);

// Get all classes with optional filters - authenticated users only
// SECURITY: Role-based filtering - students only see their own class
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { schoolId, teacherId, secondaryTeacherId } = req.query;

    let classes;

    // SECURITY: Students can only see their own class
    if (currentUser.role === 'student') {
      if (currentUser.classId) {
        const studentClass = await storage.getClass(currentUser.classId);
        classes = studentClass ? [studentClass] : [];
      } else {
        classes = [];
      }
    } else if (schoolId) {
      // SchoolAdmins can only see classes in their school
      if (currentUser.role === 'schoolAdmin' && Number(schoolId) !== currentUser.schoolId) {
        return res.status(403).json({ message: 'Access denied. You can only view classes in your school.' });
      }
      classes = await storage.getClassesBySchool(Number(schoolId));
    } else if (teacherId) {
      classes = await storage.getClassesByTeacher(Number(teacherId));
    } else if (secondaryTeacherId) {
      // Get classes assigned to a secondary teacher
      const assignments = await storage.getSecondaryTeacherAssignmentsByTeacher(Number(secondaryTeacherId));
      const classIds = assignments.map(a => a.classId);
      const allClasses = await storage.getAllClasses();
      classes = allClasses.filter(c => classIds.includes(c.id));
    } else {
      // Default listing based on role
      if (currentUser.role === 'admin') {
        classes = await storage.getAllClasses();
      } else if (currentUser.role === 'schoolAdmin') {
        classes = await storage.getClassesBySchool(currentUser.schoolId);
      } else if (currentUser.role === 'teacher' || currentUser.role === 'secondaryTeacher') {
        // Teachers see classes they teach
        const teacherClasses = await storage.getClassesByTeacher(currentUser.id);
        const secondaryAssignments = await storage.getSecondaryTeacherAssignmentsByTeacher(currentUser.id);
        const secondaryClassIds = secondaryAssignments.map(a => a.classId);
        const allClasses = await storage.getAllClasses();
        const secondaryClasses = allClasses.filter(c => secondaryClassIds.includes(c.id));
        classes = [...teacherClasses, ...secondaryClasses];
      } else {
        classes = [];
      }
    }

    // Enhance classes with additional information
    const schools = await storage.getAllSchools();
    const allUsers = await storage.getAllUsers();

    const enhancedClasses = await Promise.all(classes.map(async (classItem) => {
      const school = schools.find(s => s.id === classItem.schoolId);
      const teacher = classItem.teacherId ? allUsers.find(u => u.id === classItem.teacherId) : null;

      // Get student count for this class
      const studentCount = allUsers.filter(u =>
        u.role === 'student' &&
        u.classId === classItem.id &&
        u.isActive
      ).length;

      // Get secondary teacher assignments
      const secondaryAssignments = await storage.getSecondaryTeacherAssignmentsByClass(classItem.id);
      const secondaryTeachers = secondaryAssignments.map(assignment => {
        const secTeacher = allUsers.find(u => u.id === assignment.teacherId);
        return secTeacher ? {
          id: secTeacher.id,
          fullName: secTeacher.fullName,
          assignmentId: assignment.id
        } : null;
      }).filter(Boolean);

      return {
        ...classItem,
        schoolName: school ? school.name : null,
        teacherName: teacher ? teacher.fullName : null,
        studentCount,
        secondaryTeachers
      };
    }));

    res.json(enhancedClasses);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Failed to fetch classes' });
  }
});

// Get class by ID - authenticated users only
// SECURITY: Role-based access control - students can only see their own class
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const classId = Number(req.params.id);
    const classItem = await storage.getClass(classId);

    if (!classItem) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // SECURITY: Role-based access control for class data
    // Students can only view their own class
    if (currentUser.role === 'student') {
      if (currentUser.classId !== classId) {
        return res.status(403).json({
          message: 'Access denied. You can only view your own class.',
          code: 'ACCESS_DENIED'
        });
      }
    }

    // Teachers can only view classes they teach (primary or secondary)
    if (currentUser.role === 'teacher' || currentUser.role === 'secondaryTeacher') {
      const isTeacherOfClass = classItem.teacherId === currentUser.id;
      const secondaryAssignments = await storage.getSecondaryTeacherAssignmentsByTeacher(currentUser.id);
      const isSecondaryTeacher = secondaryAssignments.some(a => a.classId === classId);

      if (!isTeacherOfClass && !isSecondaryTeacher && currentUser.classId !== classId) {
        return res.status(403).json({
          message: 'Access denied. You can only view classes you teach.',
          code: 'ACCESS_DENIED'
        });
      }
    }

    // SchoolAdmins can only view classes in their school
    if (currentUser.role === 'schoolAdmin') {
      if (classItem.schoolId !== currentUser.schoolId) {
        return res.status(403).json({
          message: 'Access denied. You can only view classes in your school.',
          code: 'ACCESS_DENIED'
        });
      }
    }

    // Get additional information
    const school = classItem.schoolId ? await storage.getSchool(classItem.schoolId) : null;
    const teacher = classItem.teacherId ? await storage.getUser(classItem.teacherId) : null;
    const students = await storage.getUsersByClass(classItem.id);
    const secondaryAssignments = await storage.getSecondaryTeacherAssignmentsByClass(classItem.id);

    const enhancedClass = {
      ...classItem,
      schoolName: school ? school.name : null,
      teacherName: teacher ? teacher.fullName : null,
      studentCount: students.filter(s => s.isActive).length,
      secondaryTeachers: await Promise.all(secondaryAssignments.map(async (assignment) => {
        const secTeacher = await storage.getUser(assignment.teacherId);
        return secTeacher ? {
          id: secTeacher.id,
          fullName: secTeacher.fullName,
          assignmentId: assignment.id
        } : null;
      }))
    };

    res.json(enhancedClass);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch class' });
  }
});

// Create new class - admin/schoolAdmin only
router.post('/', authenticateToken, requireRole(['admin', 'schoolAdmin']), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const classData = insertClassSchema.parse(req.body);

    // SchoolAdmins can only create classes in their school
    if (currentUser.role === 'schoolAdmin' && classData.schoolId !== currentUser.schoolId) {
      return res.status(403).json({ message: 'You can only create classes in your own school' });
    }

    const classItem = await storage.createClass(classData);

    await createAuditLog(req, AuditAction.DATA_CREATED, 'class', {
      resourceId: String(classItem.id),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { after: classItem }
    });

    res.status(201).json(classItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid class data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create class' });
  }
});

// Update class - admin/schoolAdmin only
router.patch('/:id', authenticateToken, requireRole(['admin', 'schoolAdmin']), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const classId = Number(req.params.id);
    const classItem = await storage.getClass(classId);

    if (!classItem) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // SchoolAdmins can only update classes in their school
    if (currentUser.role === 'schoolAdmin' && classItem.schoolId !== currentUser.schoolId) {
      return res.status(403).json({ message: 'You can only update classes in your own school' });
    }

    const updatedClass = await storage.updateClass(classId, req.body);

    await createAuditLog(req, AuditAction.DATA_UPDATED, 'class', {
      resourceId: String(classId),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { before: classItem, after: updatedClass }
    });

    res.json(updatedClass);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update class' });
  }
});

// Delete class - admin only
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const classId = Number(req.params.id);
    const classItem = await storage.getClass(classId);

    if (!classItem) {
      return res.status(404).json({ message: 'Class not found' });
    }

    const deleted = await storage.deleteClass(classId);

    if (!deleted) {
      return res.status(500).json({ message: 'Failed to delete class' });
    }

    await createAuditLog(req, AuditAction.DATA_DELETED, 'class', {
      resourceId: String(classId),
      success: true,
      severity: AuditSeverity.WARNING,
      changes: { before: classItem }
    });

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete class' });
  }
});

// Partner routes - authenticated users only
router.get('/partners', authenticateToken, async (req: Request, res: Response) => {
  try {
    const showInactive = req.query.showInactive === 'true';

    let partners = await storage.getAllPartners();

    if (!showInactive) {
      partners = partners.filter(partner => partner.isActive);
    }

    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch partners' });
  }
});

router.get('/partners/:id', authenticateToken, async (req: Request, res: Response) => {
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

router.post('/partners', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const partnerData = insertPartnerSchema.parse(req.body);
    const partner = await storage.createPartner(partnerData);

    await createAuditLog(req, AuditAction.DATA_CREATED, 'partner', {
      resourceId: String(partner.id),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { after: partner }
    });

    res.status(201).json(partner);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid partner data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create partner' });
  }
});

router.patch('/partners/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const partnerId = Number(req.params.id);
    const partner = await storage.getPartner(partnerId);

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    const updatedPartner = await storage.updatePartner(partnerId, req.body);

    await createAuditLog(req, AuditAction.DATA_UPDATED, 'partner', {
      resourceId: String(partnerId),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { before: partner, after: updatedPartner }
    });

    res.json(updatedPartner);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update partner' });
  }
});

router.delete('/partners/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const partnerId = Number(req.params.id);
    const partner = await storage.getPartner(partnerId);

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    const deleted = await storage.deletePartner(partnerId);

    if (!deleted) {
      return res.status(500).json({ message: 'Failed to delete partner' });
    }

    await createAuditLog(req, AuditAction.DATA_DELETED, 'partner', {
      resourceId: String(partnerId),
      success: true,
      severity: AuditSeverity.WARNING,
      changes: { before: partner }
    });

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete partner' });
  }
});

// Secondary teacher assignment routes - authenticated users only
router.get('/secondary-teacher-assignments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { teacherId, classId } = req.query;

    let assignments;
    if (teacherId) {
      assignments = await storage.getSecondaryTeacherAssignmentsByTeacher(Number(teacherId));
    } else if (classId) {
      assignments = await storage.getSecondaryTeacherAssignmentsByClass(Number(classId));
    } else {
      assignments = await storage.getAllSecondaryTeacherAssignments();
    }

    // Enhance with teacher and class information
    const enhancedAssignments = await Promise.all(assignments.map(async (assignment) => {
      const teacher = await storage.getUser(assignment.teacherId);
      const classItem = await storage.getClass(assignment.classId);
      const school = classItem?.schoolId ? await storage.getSchool(classItem.schoolId) : null;

      return {
        ...assignment,
        teacherName: teacher ? teacher.fullName : null,
        className: classItem ? classItem.name : null,
        gradeLevel: classItem ? classItem.gradeLevel : null,
        schoolName: school ? school.name : null
      };
    }));

    res.json(enhancedAssignments);
  } catch (error) {
    console.error('Error fetching secondary teacher assignments:', error);
    res.status(500).json({ message: 'Failed to fetch secondary teacher assignments' });
  }
});

router.get('/secondary-teacher-assignments/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const assignment = await storage.getSecondaryTeacherAssignment(Number(req.params.id));

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const teacher = await storage.getUser(assignment.teacherId);
    const classItem = await storage.getClass(assignment.classId);

    res.json({
      ...assignment,
      teacherName: teacher ? teacher.fullName : null,
      className: classItem ? classItem.name : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch assignment' });
  }
});

router.post('/secondary-teacher-assignments', authenticateToken, requireRole(['admin', 'schoolAdmin']), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { teacherId, classId } = req.body;

    if (!teacherId || !classId) {
      return res.status(400).json({ message: 'teacherId and classId are required' });
    }

    // Check if teacher exists and is a secondary teacher
    const teacher = await storage.getUser(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    if (teacher.role !== 'secondaryTeacher' && teacher.role !== 'teacher') {
      return res.status(400).json({ message: 'User must be a teacher or secondary teacher' });
    }

    // Check if class exists
    const classItem = await storage.getClass(classId);
    if (!classItem) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // SchoolAdmins can only assign teachers within their school
    if (currentUser.role === 'schoolAdmin') {
      if (classItem.schoolId !== currentUser.schoolId) {
        return res.status(403).json({ message: 'You can only assign teachers to classes in your school' });
      }
      if (teacher.schoolId !== currentUser.schoolId) {
        return res.status(403).json({ message: 'You can only assign teachers from your school' });
      }
    }

    // Check for duplicate assignment
    const existingAssignments = await storage.getSecondaryTeacherAssignmentsByClass(classId);
    const isDuplicate = existingAssignments.some(a => a.teacherId === teacherId);
    if (isDuplicate) {
      return res.status(409).json({ message: 'Teacher is already assigned to this class' });
    }

    const assignment = await storage.createSecondaryTeacherAssignment({
      teacherId,
      classId
    });

    await createAuditLog(req, AuditAction.DATA_CREATED, 'secondary_teacher_assignment', {
      resourceId: String(assignment.id),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { after: assignment }
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error creating secondary teacher assignment:', error);
    res.status(500).json({ message: 'Failed to create assignment' });
  }
});

router.delete('/secondary-teacher-assignments/:id', authenticateToken, requireRole(['admin', 'schoolAdmin']), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const assignmentId = Number(req.params.id);
    const assignment = await storage.getSecondaryTeacherAssignment(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // SchoolAdmins can only delete assignments in their school
    if (currentUser.role === 'schoolAdmin') {
      const classItem = await storage.getClass(assignment.classId);
      if (classItem && classItem.schoolId !== currentUser.schoolId) {
        return res.status(403).json({ message: 'You can only delete assignments in your school' });
      }
    }

    const deleted = await storage.deleteSecondaryTeacherAssignment(assignmentId);

    if (!deleted) {
      return res.status(500).json({ message: 'Failed to delete assignment' });
    }

    await createAuditLog(req, AuditAction.DATA_DELETED, 'secondary_teacher_assignment', {
      resourceId: String(assignmentId),
      success: true,
      severity: AuditSeverity.WARNING,
      changes: { before: assignment }
    });

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete assignment' });
  }
});

// Get classes for a secondary teacher - authenticated users only
router.get('/secondary-teacher/:id/classes', authenticateToken, async (req: Request, res: Response) => {
  try {
    const teacherId = Number(req.params.id);

    const assignments = await storage.getSecondaryTeacherAssignmentsByTeacher(teacherId);
    const classIds = assignments.map(a => a.classId);

    const allClasses = await storage.getAllClasses();
    const assignedClasses = allClasses.filter(c => classIds.includes(c.id));

    // Enhance with school and teacher information
    const enhancedClasses = await Promise.all(assignedClasses.map(async (classItem) => {
      const school = classItem.schoolId ? await storage.getSchool(classItem.schoolId) : null;
      const teacher = classItem.teacherId ? await storage.getUser(classItem.teacherId) : null;
      const students = await storage.getUsersByClass(classItem.id);

      return {
        ...classItem,
        schoolName: school ? school.name : null,
        teacherName: teacher ? teacher.fullName : null,
        studentCount: students.filter(s => s.isActive).length
      };
    }));

    res.json(enhancedClasses);
  } catch (error) {
    console.error('Error fetching secondary teacher classes:', error);
    res.status(500).json({ message: 'Failed to fetch classes' });
  }
});

export default router;
