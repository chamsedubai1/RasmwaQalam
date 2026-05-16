import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage";
import { db } from "../db";
import { passwordResetTokens } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { generateCaptcha, validateCaptcha, requireCaptcha, captchaStore } from "../captcha";
import {
  loginRateLimiter,
  registrationRateLimiter,
  passwordResetRateLimiter,
  hashPassword,
  verifyPassword,
  runDummyPasswordCheck,
  generateAuthTokens,
  authenticateToken,
  verifyDatabaseRefreshToken,
  revokeRefreshTokenById,
  revokeAllUserRefreshTokensDb,
  COOKIE_CONFIG,
} from "../security";
import { rotateCsrfToken } from "../csrf";
import { createAuditLog, AuditAction, AuditSeverity } from "../audit-log";
import { insertUserSchema } from "@shared/schema";
import type { AuthenticatedRequest } from "./types";

/**
 * SECURITY: Hash password reset token using SHA-256
 * We hash tokens before storing to prevent token theft if database is compromised
 */
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const router = Router();

// SECURE JWT-based login endpoint
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // SECURITY: Validate types and bound lengths BEFORE doing any expensive work.
  // Without this the previous code would feed a 50 MB password directly into
  // scrypt — combined with the in-memory rate limiter this enabled a single-
  // request DoS that pinned a CPU per attempt.
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length === 0 ||
    password.length === 0 ||
    username.length > 50 ||
    password.length > 128
  ) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  console.log(`Login attempt from IP: ${req.ip || 'unknown'}`);

  try {
    const user = await storage.getUserByUsername(username);

    if (!user) {
      // SECURITY: Equalize timing with the user-found branch by running scrypt
      // against a fixed dummy hash. Without this the response-time difference
      // between "no such user" and "wrong password" is a reliable enumeration
      // oracle. A small jittered delay is added on top in case scrypt is fast
      // enough on the host to still be distinguishable.
      await runDummyPasswordCheck(password);
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));

      await createAuditLog(req, AuditAction.LOGIN_FAILED, 'auth', {
        success: false,
        errorMessage: 'User not found',
        severity: AuditSeverity.WARNING,
      });

      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password.includes('.')) {
      console.log(`User ${username} has insecure password format - forcing reset`);
      return res.status(403).json({
        message: 'Password reset required for security. Please use the forgot password feature.',
        code: 'PASSWORD_RESET_REQUIRED'
      });
    }

    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      console.log(`Failed login attempt from IP: ${req.ip || 'unknown'}`);

      await createAuditLog(req, AuditAction.LOGIN_FAILED, 'auth', {
        resourceId: user.id.toString(),
        success: false,
        errorMessage: 'Invalid password',
        severity: AuditSeverity.WARNING,
      });

      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      if (user.role === 'schoolAdmin') {
        return res.status(403).json({
          message: 'Your School Admin account is pending approval from the system administrator. Please check back later.'
        });
      }
      return res.status(403).json({ message: 'Account is locked or inactive' });
    }

    const authTokens = await generateAuthTokens(user);

    const updatedUser = await storage.updateUser(user.id, {
      lastLoginDate: new Date()
    });

    if (!updatedUser) {
      console.error('Failed to update lastLoginDate for user:', user.id);
    }

    console.log(`Successful login from IP: ${req.ip || 'unknown'}`);

    await createAuditLog(req, AuditAction.LOGIN_SUCCESS, 'auth', {
      resourceId: user.id.toString(),
      success: true,
      severity: AuditSeverity.INFO,
    });

    res.cookie(COOKIE_CONFIG.ACCESS_TOKEN, authTokens.accessToken, {
      ...COOKIE_CONFIG.OPTIONS,
      maxAge: COOKIE_CONFIG.ACCESS_MAX_AGE,
    });

    res.cookie(COOKIE_CONFIG.REFRESH_TOKEN, authTokens.refreshToken, {
      ...COOKIE_CONFIG.OPTIONS,
      maxAge: COOKIE_CONFIG.REFRESH_MAX_AGE,
    });

    // SECURITY: Rotate the CSRF cookie at authentication-state changes so a
    // token captured pre-login cannot be replayed in an authenticated context.
    rotateCsrfToken(req, res);

    const { password: _, ...userWithoutPassword } = updatedUser || user;
    res.json({
      user: userWithoutPassword,
      expiresIn: authTokens.expiresIn
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current authenticated user
router.get('/user', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    res.status(200).json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error retrieving user data" });
  }
});

// Token refresh endpoint with rotation
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_CONFIG.REFRESH_TOKEN] || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        message: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const tokenData = await verifyDatabaseRefreshToken(refreshToken);

    if (!tokenData) {
      return res.status(401).json({
        message: 'Invalid, expired, or revoked refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    const user = await storage.getUser(tokenData.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: 'User account not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    const revoked = await revokeRefreshTokenById(tokenData.tokenId, 'rotation');

    if (!revoked) {
      console.warn(`Failed to revoke refresh token ${tokenData.tokenId} during rotation`);
    }

    const authTokens = await generateAuthTokens(user);

    console.log(`Token rotation successful for user ${user.id}: old token revoked, new token issued`);

    res.cookie(COOKIE_CONFIG.ACCESS_TOKEN, authTokens.accessToken, {
      ...COOKIE_CONFIG.OPTIONS,
      maxAge: COOKIE_CONFIG.ACCESS_MAX_AGE,
    });

    res.cookie(COOKIE_CONFIG.REFRESH_TOKEN, authTokens.refreshToken, {
      ...COOKIE_CONFIG.OPTIONS,
      maxAge: COOKIE_CONFIG.REFRESH_MAX_AGE,
    });

    res.json({
      expiresIn: authTokens.expiresIn
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      message: 'Server error during token refresh',
      code: 'REFRESH_ERROR'
    });
  }
});

// Logout endpoint with token revocation
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;

    const revokedCount = await revokeAllUserRefreshTokensDb(user.id, 'user_logout');
    console.log(`Logout: Revoked ${revokedCount} refresh tokens for user ${user.id}`);

    res.clearCookie(COOKIE_CONFIG.ACCESS_TOKEN, COOKIE_CONFIG.OPTIONS);
    res.clearCookie(COOKIE_CONFIG.REFRESH_TOKEN, COOKIE_CONFIG.OPTIONS);

    // SECURITY: Rotate the CSRF cookie at logout so the next session starts
    // with a fresh token unrelated to the prior one.
    rotateCsrfToken(req, res);

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// SECURITY: Forgot password - request password reset with rate limiting
router.post('/forgot-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await storage.getUserByEmail(email);

    // SECURITY: Always return the same message to prevent email enumeration
    const responseMessage = 'If your email is registered, you will receive password reset instructions.';

    if (!user) {
      // Log for monitoring but don't reveal to client
      console.log(`Password reset requested for non-existent email: ${email}`);
      // Add delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      return res.status(200).json({ message: responseMessage });
    }

    // SECURITY: Per-user issuance throttle. Previously each call invalidated
    // any pending unused token for the user, which let an attacker who only
    // knew the victim's email spam /forgot-password from rotating IPs and
    // continuously invalidate the legitimate reset link the victim received.
    //
    // New behavior: if a recent (within 5 minutes) unused token already
    // exists, do not issue a new one and do not touch the existing token.
    // The caller still gets the generic success response, preserving the
    // email-enumeration defense.
    const existing = await db.select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.userId, user.id),
        eq(passwordResetTokens.isUsed, false),
        gt(passwordResetTokens.expiresAt, new Date()),
      ))
      .limit(1);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (existing.length > 0 && existing[0].createdAt && existing[0].createdAt > fiveMinutesAgo) {
      console.log(`Password reset throttled for user ${user.id}: recent token still valid`);
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      return res.status(200).json({ message: responseMessage });
    }

    // Generate secure reset token (64 bytes = 128 hex characters)
    const resetToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashResetToken(resetToken);
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 1); // 1 hour expiry

    // Store hashed token in database. Existing pending tokens are left
    // alone — each token is single-use (`isUsed` flips on consumption) so
    // having two valid links in flight at once is safe.
    await db.insert(passwordResetTokens).values({
      tokenHash,
      userId: user.id,
      expiresAt: tokenExpiry,
      isUsed: false,
      ipAddress: req.ip || 'unknown',
    });

    // Audit log the password reset request
    await createAuditLog(req, AuditAction.PASSWORD_RESET_REQUESTED, 'auth', {
      resourceId: String(user.id),
      success: true,
      severity: AuditSeverity.INFO,
    });

    // TODO: Send reset token via email
    // In production, you would use a service like SendGrid, AWS SES, etc.
    // The email would contain a link like: https://yoursite.com/reset-password?token=<resetToken>

    // SECURITY: Only log tokens in development mode to prevent credential exposure
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV ONLY] Password reset token for user ${user.id}: ${resetToken}`);
      console.log(`[DEV ONLY] Reset link: /reset-password?token=${resetToken}`);
    }

    // SECURITY: Never expose token or user info in response
    return res.status(200).json({ message: responseMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// SECURITY: Reset password with proper token validation
router.post('/reset-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    // SECURITY: Don't accept userId from client - derive it from valid token
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Validate password strength
    const passwordSchema = z.string()
      .min(8, 'Password must be at least 8 characters')
      .refine(val => /[A-Z]/.test(val), 'Password must contain at least one uppercase letter')
      .refine(val => /[0-9]/.test(val), 'Password must contain at least one number')
      .refine(val => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val), 'Password must contain at least one special character');

    try {
      passwordSchema.parse(newPassword);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Password does not meet security requirements',
          errors: validationError.errors.map(e => e.message)
        });
      }
    }

    // Hash the provided token and look it up
    const tokenHash = hashResetToken(token);

    const resetTokenRecords = await db.select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        eq(passwordResetTokens.isUsed, false),
        gt(passwordResetTokens.expiresAt, new Date())
      ))
      .limit(1);

    if (resetTokenRecords.length === 0) {
      // Audit log failed attempt
      await createAuditLog(req, AuditAction.PASSWORD_RESET_FAILED, 'auth', {
        success: false,
        errorMessage: 'Invalid or expired reset token',
        severity: AuditSeverity.WARNING,
      });

      return res.status(401).json({ message: 'Invalid or expired reset token' });
    }

    const resetTokenRecord = resetTokenRecords[0];
    const user = await storage.getUser(resetTokenRecord.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash and update the password.
    // SECURITY: Bump passwordChangedAt so all access tokens issued before
    // this moment are rejected by authenticateToken (see security.ts).
    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUser(resetTokenRecord.userId, {
      ...user,
      password: hashedPassword,
      passwordChangedAt: new Date(),
    });

    // Mark token as used
    await db.update(passwordResetTokens)
      .set({ isUsed: true, usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetTokenRecord.id));

    // Revoke all refresh tokens for this user (force re-login everywhere)
    await revokeAllUserRefreshTokensDb(resetTokenRecord.userId, 'password_reset');

    // Audit log successful password reset
    await createAuditLog(req, AuditAction.PASSWORD_RESET_COMPLETED, 'auth', {
      resourceId: String(resetTokenRecord.userId),
      success: true,
      severity: AuditSeverity.INFO,
    });

    console.log(`Password reset completed for user ${resetTokenRecord.userId}`);

    return res.status(200).json({ message: 'Password has been reset successfully. Please log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Registration endpoint with CAPTCHA verification
router.post('/register', registrationRateLimiter, requireCaptcha, async (req: Request, res: Response) => {
  try {
    console.log(`Registration attempt from IP: ${req.ip || 'unknown'}, role: ${req.body.role || 'unknown'}`);

    const isActiveByDefault = req.body.role === 'schoolAdmin' ? false : true;

    const userData = insertUserSchema.parse({
      ...req.body,
      isActive: isActiveByDefault
    });

    // SECURITY: Check for existing username/email but return generic error
    // to prevent account enumeration attacks
    const existingUsername = await storage.getUserByUsername(userData.username);
    const existingEmail = await storage.getUserByEmail(userData.email);

    if (existingUsername || existingEmail) {
      // Log specific details for security monitoring (not exposed to client)
      if (existingUsername) {
        console.log(`Registration rejected - duplicate username from IP: ${req.ip || 'unknown'}`);
      }
      if (existingEmail) {
        console.log(`Registration rejected - duplicate email from IP: ${req.ip || 'unknown'}`);
      }
      // SECURITY: Generic error message prevents username/email enumeration
      return res.status(409).json({
        message: 'Registration failed. The username or email may already be in use. Please try different credentials.'
      });
    }

    if (userData.role === 'schoolAdmin' && !userData.schoolId) {
      return res.status(400).json({
        message: 'School Admin accounts must be associated with a school.',
        field: 'schoolId'
      });
    }

    if (userData.role === 'student' && userData.classId) {
      const classData = await storage.getClass(userData.classId);
      if (classData && classData.isLocked) {
        return res.status(403).json({
          message: 'This class is currently locked for new registrations. Please contact your teacher.',
          field: 'classId'
        });
      }
    }

    const hashedPassword = await hashPassword(userData.password);

    const user = await storage.createUser({
      ...userData,
      password: hashedPassword
    });

    console.log(`User registered successfully: ${userData.username}, role: ${userData.role}, IP: ${req.ip || 'unknown'}`);

    const { password, ...userWithoutPassword } = user;

    if (userData.role === 'schoolAdmin') {
      return res.status(201).json({
        ...userWithoutPassword,
        message: "Your School Admin account has been created but requires approval from the system administrator before you can log in."
      });
    }

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

// CAPTCHA endpoints
const handleCaptchaRequest = (req: Request, res: Response) => {
  try {
    // SECURITY: Use a single canonical key for the CAPTCHA store across
    // generate and verify. Previously generate used `req.ip` and verify used
    // `req.sessionID || req.ip`, which meant that when two requests behind
    // the same NAT hit the same instance the captcha keyed under their
    // shared IP could be observed/consumed by either user.
    const sessionId = req.sessionID || req.ip || crypto.randomBytes(16).toString('hex');

    const captcha = generateCaptcha(sessionId);

    // SECURITY: Do NOT log captcha plaintext. Anyone with log read access
    // could otherwise solve every captcha by tailing logs.
    console.log(`Generated CAPTCHA session=${sessionId} length=${captcha.text.length}`);

    if (req.session) {
      req.session.captcha = {
        text: captcha.text,
        expiry: captcha.expiry
      };
    }

    // SECURITY: Never expose CAPTCHA text in response, even in development
    // Use server-side logging for debugging instead
    res.json({
      image: captcha.svgImage,
      expires: captcha.expiry
      // SECURITY: Removed text field - even in development, this creates bad habits
      // For debugging, check server logs where the CAPTCHA text is already printed
    });
  } catch (error) {
    console.error('CAPTCHA generation error:', error);
    res.status(500).json({ message: 'Failed to generate CAPTCHA' });
  }
};

router.get('/captcha', handleCaptchaRequest);
router.get('/api/captcha', handleCaptchaRequest);

// Verify CAPTCHA
router.post('/verify-captcha', (req: Request, res: Response) => {
  const { captchaText } = req.body;

  if (!captchaText) {
    return res.status(400).json({
      message: 'CAPTCHA text is required',
      field: 'captchaText',
      valid: false
    });
  }

  const sessionId = req.sessionID || req.ip || crypto.randomBytes(16).toString('hex');

  const isValid = validateCaptcha(sessionId, captchaText);

  if (!isValid) {
    return res.status(400).json({
      message: 'Invalid or expired CAPTCHA',
      field: 'captchaText',
      valid: false
    });
  }

  res.json({ valid: true });
});

// SECURITY: Debug endpoint completely removed for production safety
// In development, use proper logging and debugging tools instead

export default router;
