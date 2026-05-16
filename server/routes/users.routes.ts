import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { hashPassword, authenticateToken, requireRole, apiRateLimiter } from "../security";
import { insertUserSchema } from "@shared/schema";
import { createAuditLog, AuditAction, AuditSeverity } from "../audit-log";

const router = Router();

// Apply rate limiting to all routes
router.use(apiRateLimiter);

// SECURITY: Authenticated users only - with role-based filtering
// Admins see all users, teachers see their class, schoolAdmins see their school
// SECURITY ENHANCEMENT: Added pagination to prevent data scraping
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { role, classId, schoolId } = req.query;
    const currentUser = (req as any).user;

    // SECURITY: Pagination parameters with sensible defaults and limits
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50)); // Max 100 per page
    const offset = (page - 1) * limit;

    let users;

    // Role-based access control for user listing
    if (currentUser.role === 'admin') {
      // Admins can see all users with any filter
      if (classId) {
        users = await storage.getUsersByClass(Number(classId));
      } else if (schoolId) {
        users = await storage.getUsersBySchool(Number(schoolId));
      } else if (role) {
        if (typeof role === 'string' && role.includes(',')) {
          const roles = role.split(',').map(r => r.trim());
          const usersByRole = await Promise.all(
            roles.map(r => storage.getUsersByRole(r))
          );
          users = Array.from(new Set(usersByRole.flat().map(u => u.id)))
            .map(id => usersByRole.flat().find(u => u.id === id));
        } else {
          users = await storage.getUsersByRole(String(role));
        }
      } else {
        users = await storage.getAllUsers();
      }
    } else if (currentUser.role === 'schoolAdmin') {
      // SchoolAdmins can only see users from their school
      users = await storage.getUsersBySchool(currentUser.schoolId);
    } else if (currentUser.role === 'teacher' || currentUser.role === 'secondaryTeacher') {
      // Teachers can only see students in their class
      if (currentUser.classId) {
        users = await storage.getUsersByClass(currentUser.classId);
      } else {
        users = [];
      }
    } else {
      // Students and others cannot list users
      return res.status(403).json({ message: 'Access denied' });
    }

    const schools = await storage.getAllSchools();
    const classes = await storage.getAllClasses();

    // Store total count before pagination
    const totalCount = users.length;

    // Apply pagination
    const paginatedUsers = users.slice(offset, offset + limit);

    const sanitizedUsers = paginatedUsers.map(user => {
      if (!user) return null;
      const { password, ...userWithoutPassword } = user;

      const school = schools.find(s => s.id === userWithoutPassword.schoolId);
      const schoolName = school ? school.name : null;

      const classInfo = classes.find(c => c.id === userWithoutPassword.classId);
      const className = classInfo ? classInfo.name : null;
      const gradeLevel = classInfo ? classInfo.gradeLevel : null;

      return {
        ...userWithoutPassword,
        schoolName,
        className,
        gradeLevel
      };
    }).filter(Boolean);

    // Return paginated response with metadata
    res.json({
      data: sanitizedUsers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// SECURITY: Get user by ID - users can view themselves, admins can view anyone
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const requestedUserId = Number(req.params.id);
    const currentUser = (req as any).user;

    // Users can view themselves, admins/teachers/schoolAdmins have broader access
    if (currentUser.role !== 'admin' &&
        currentUser.role !== 'schoolAdmin' &&
        currentUser.role !== 'teacher' &&
        currentUser.role !== 'secondaryTeacher' &&
        currentUser.id !== requestedUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await storage.getUser(requestedUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Additional checks for non-admin roles
    if (currentUser.role === 'schoolAdmin' && user.schoolId !== currentUser.schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if ((currentUser.role === 'teacher' || currentUser.role === 'secondaryTeacher') &&
        user.classId !== currentUser.classId && currentUser.id !== requestedUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { password, ...userData } = user;

    let schoolName = null;
    if (userData.schoolId) {
      const school = await storage.getSchool(userData.schoolId);
      schoolName = school ? school.name : null;
    }

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

// SECURITY: Admin-only user creation with audit logging
// Note: Registration for new users goes through auth routes with CAPTCHA
router.post('/', authenticateToken, requireRole(['admin', 'schoolAdmin']), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userData = insertUserSchema.parse(req.body);

    // SchoolAdmins can only create users in their school
    if (currentUser.role === 'schoolAdmin') {
      if (userData.schoolId !== currentUser.schoolId) {
        return res.status(403).json({ message: 'You can only create users in your own school' });
      }
      // SchoolAdmins cannot create admins
      if (userData.role === 'admin') {
        return res.status(403).json({ message: 'You cannot create admin users' });
      }
    }

    // SECURITY: Check for existing username/email but use generic error message
    // to prevent account enumeration attacks
    const existingUsername = await storage.getUserByUsername(userData.username);
    const existingEmail = await storage.getUserByEmail(userData.email);

    if (existingUsername || existingEmail) {
      // SECURITY: Generic error message prevents username/email enumeration
      return res.status(409).json({
        message: 'User creation failed. The username or email may already be in use. Please try different credentials.',
        code: 'CREDENTIALS_UNAVAILABLE'
      });
    }

    if (userData.role === 'teacher' && userData.classId) {
      const existingClasses = await storage.getAllClasses();
      const alreadyAssigned = existingClasses.some(c => c.teacherId !== null &&
        (userData as any).id !== c.teacherId && c.id === userData.classId);

      if (alreadyAssigned) {
        return res.status(409).json({
          message: 'This class already has a teacher assigned. Please choose a different class or create a new one.',
          field: 'classId'
        });
      }
    }

    const hashedPassword = await hashPassword(userData.password);

    const user = await storage.createUser({
      ...userData,
      password: hashedPassword
    });

    // Audit log the user creation
    await createAuditLog(req, AuditAction.USER_CREATED, 'user', {
      resourceId: String(user.id),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { after: { ...user, password: '[REDACTED]' } }
    });

    const { password, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid user data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create user' });
  }
});

// SECURITY: User update with proper authorization and audit logging
// Users can update themselves, admins can update anyone
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const currentUser = (req as any).user;

    // Authorization check
    const canUpdate =
      currentUser.role === 'admin' ||
      (currentUser.role === 'schoolAdmin' && (await storage.getUser(userId))?.schoolId === currentUser.schoolId) ||
      currentUser.id === userId;

    if (!canUpdate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Non-admins cannot change roles
    if (req.body.role && currentUser.role !== 'admin' && req.body.role !== user.role) {
      return res.status(403).json({ message: 'Only admins can change user roles' });
    }

    // Non-admins cannot update admin accounts
    if (user.role === 'admin' && currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can modify admin accounts' });
    }

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

    if (user.role === 'teacher' && req.body.classId && req.body.classId !== user.classId) {
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

    // Whitelist allowed update fields to prevent prototype pollution
    const allowedFields = ['username', 'email', 'fullName', 'password', 'isActive', 'role', 'schoolId', 'classId', 'gradeLevel'];
    let updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.password) {
      const hashedPassword = await hashPassword(updateData.password);
      updateData.password = hashedPassword;
    }

    const updatedUser = await storage.updateUser(userId, updateData);

    // Audit log the update
    await createAuditLog(req, AuditAction.USER_UPDATED, 'user', {
      resourceId: String(userId),
      success: true,
      severity: AuditSeverity.INFO,
      changes: {
        before: { ...user, password: '[REDACTED]' },
        after: { ...updatedUser, password: '[REDACTED]' }
      }
    });

    const { password, ...userWithoutPassword } = updatedUser!;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// SECURITY: Admin-only user deletion with audit logging
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const currentUser = (req as any).user;

    // Prevent self-deletion
    if (currentUser.id === userId) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const userToDelete = await storage.getUser(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    const deleted = await storage.deleteUser(userId);

    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Audit log the deletion
    await createAuditLog(req, AuditAction.USER_DELETED, 'user', {
      resourceId: String(userId),
      success: true,
      severity: AuditSeverity.WARNING,
      changes: { before: { ...userToDelete, password: '[REDACTED]' } }
    });

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

export default router;
