import { NextFunction, Request, Response } from 'express';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { db } from './db';
import { refreshTokens } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { config } from './config';
import { sessionManager } from './session-manager';
import { createAuditLog, AuditAction, AuditSeverity } from './audit-log';

// Convert callback-based scrypt to Promise-based
const scryptAsync = promisify(scrypt);

/**
 * SECURITY: Maximum allowed plaintext password length on hash and verify.
 * scrypt's cost is roughly linear in input size; without an upper bound a
 * single 50 MB password (within the previous body limit) could pin a CPU
 * for seconds. 128 chars matches the password Zod schema in validation.ts.
 */
const MAX_PASSWORD_LENGTH = 128;

/**
 * Hashes a password using scrypt with a random salt
 * @param password The plaintext password to hash
 * @returns A string in the format "hash.salt"
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Password exceeds maximum allowed length');
  }
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${derivedKey.toString('hex')}.${salt}`;
}

// SECURITY: Precomputed dummy hash for constant-time login on unknown users.
// Generated at module load against a fixed dummy password so verify calls
// during user-not-found paths spend the same scrypt time as real verifications.
let DUMMY_PASSWORD_HASH = '';
(async () => {
  try {
    DUMMY_PASSWORD_HASH = await hashPassword('dummy-password-for-timing-equalization');
  } catch (error) {
    console.error('Failed to precompute dummy password hash:', error);
  }
})();

/**
 * SECURITY: Constant-time stand-in for verifyPassword when the user lookup
 * failed. Runs the same scrypt work so that the unknown-user code path is
 * indistinguishable from the known-user-bad-password path by response timing.
 */
export async function runDummyPasswordCheck(plainPassword: string): Promise<void> {
  if (!DUMMY_PASSWORD_HASH) {
    // Module-init hash not ready yet; fall back to a fresh scrypt to still
    // do the work. This branch is only hit in the first ~100ms after start.
    DUMMY_PASSWORD_HASH = await hashPassword('dummy-password-for-timing-equalization');
  }
  await verifyPassword(plainPassword, DUMMY_PASSWORD_HASH);
}

/**
 * Verifies a password against a stored hash
 * @param plainPassword The plaintext password to verify
 * @param storedHash The stored password hash in the format "hash.salt"
 * @returns Whether the password matches the hash
 */
export async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  try {
    // SECURITY: Cap plaintext length to defend against scrypt DoS via oversized
    // password bodies. The login route also enforces this earlier with Zod.
    if (typeof plainPassword !== 'string' || plainPassword.length > MAX_PASSWORD_LENGTH) {
      return false;
    }

    const [hashedPassword, salt] = storedHash.split('.');

    if (!hashedPassword || !salt) {
      // If the hash is not in the expected format, return false
      console.error('Invalid password hash format');
      return false;
    }

    const hashedPasswordBuf = Buffer.from(hashedPassword, 'hex');
    const derivedKey = (await scryptAsync(plainPassword, salt, 64)) as Buffer;

    return timingSafeEqual(hashedPasswordBuf, derivedKey);
  } catch (error) {
    console.error('Error verifying password:', error);
    // In case of any error, fail closed (return false)
    return false;
  }
}

/**
 * SECURITY WARNING: Rate limiters use in-memory storage by default.
 *
 * Consequences with in-memory storage:
 *   - Multi-instance deploys: each instance keeps its own counters, so the
 *     effective rate scales with replica count (5 logins/min × N instances).
 *   - Process restart: all counters reset, briefly allowing a fresh burst.
 *
 * To enable a Redis-backed shared store (already a dependency):
 *   1. npm install rate-limit-redis ioredis
 *   2. Construct a Redis client and a RedisStore here, then pass `store:`
 *      to each rate-limit config below. Example:
 *
 *        import RedisStore from 'rate-limit-redis';
 *        import Redis from 'ioredis';
 *        const redis = new Redis(process.env.REDIS_URL!);
 *        const store = new RedisStore({ sendCommand: (...args) => redis.call(...args) });
 *        // then: rateLimit({ ..., store })
 *
 *   3. Set REDIS_URL in env for production.
 *
 * Until that is wired, the warning below tells operators when they are
 * running with the soft limit.
 */
if (config.NODE_ENV === 'production' && !process.env.REDIS_URL) {
  console.warn('[SECURITY WARNING] Rate limiters are using in-memory storage (REDIS_URL not set). Multi-instance or post-restart bypass is possible. See server/security.ts for the Redis store wiring.');
}

/**
 * IP-based rate limiter for login attempts
 * Limits to 5 requests per minute per IP
 */
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts from this IP, please try again after a minute'
  },
});

/**
 * IP-based rate limiter for registration attempts
 * Limits to 3 requests per 10 minutes per IP
 */
export const registrationRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 registration attempts per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many registration attempts from this IP, please try again later'
  }
});

/**
 * IP-based rate limiter for password reset attempts
 * Limits to 3 requests per 60 minutes per IP
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 3, // 3 password reset attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many password reset attempts from this IP, please try again later'
  }
});

/**
 * General API rate limiter
 * Limits to 100 requests per minute per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests from this IP, please try again after a minute'
  },
  skip: (req) => {
    // Skip rate limiting for certain routes like static resources
    return req.path.startsWith('/uploads/') || req.path.startsWith('/public/');
  }
});

// Database-based Refresh Token Management
// SECURITY: These functions provide server-side token storage and rotation

/**
 * Stores a refresh token in the database with hash for security
 */
export async function storeRefreshToken(userId: number, token: string, expiresAt: Date): Promise<number> {
  const tokenHash = await hashRefreshToken(token);
  
  const [refreshToken] = await db.insert(refreshTokens).values({
    tokenHash,
    userId,
    expiresAt,
    isRevoked: false
  }).returning();
  
  return refreshToken.id;
}

/**
 * Verifies and retrieves refresh token from database with JWT signature validation
 * SECURITY FIX: Now validates JWT signature and expiration before database check
 */
export async function verifyDatabaseRefreshToken(token: string): Promise<{ userId: number; tokenId: number } | null> {
  try {
    // SECURITY: First verify the JWT signature and expiration
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'rasm-wa-qalam',
      audience: 'rasm-wa-qalam-users'
    }) as { userId: number; tokenType: string; exp: number };
    
    // Ensure this is a refresh token
    if (decoded.tokenType !== 'refresh') {
      console.warn('Token verification failed: not a refresh token');
      return null;
    }
    
    // Check JWT expiration (additional safety check)
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      console.warn('Token verification failed: JWT expired');
      return null;
    }
    
    // Now check database for token hash and revocation status
    const tokenHash = await hashRefreshToken(token);
    
    const [dbToken] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          eq(refreshTokens.userId, decoded.userId),
          eq(refreshTokens.isRevoked, false)
        )
      )
      .limit(1);
    
    if (!dbToken) {
      console.warn('Token verification failed: not found in database or revoked');
      return null;
    }
    
    // Check database expiration
    if (new Date() >= new Date(dbToken.expiresAt)) {
      console.warn('Token verification failed: expired in database');
      return null;
    }
    
    return { userId: decoded.userId, tokenId: dbToken.id };
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

/**
 * Reasons a refresh token can be revoked. Kept as a string-valued enum so
 * audit queries can group by reason without typo risk.
 */
export const RevokeReason = {
  Rotation: 'rotation',
  UserLogout: 'user_logout',
  LogoutAll: 'logout_all',
  PasswordReset: 'password_reset',
  Security: 'security',
  SessionTimeout: 'session_timeout',
  Admin: 'admin_revoked',
} as const;
export type RevokeReason = typeof RevokeReason[keyof typeof RevokeReason];

/**
 * Revokes a refresh token by ID with reason
 */
export async function revokeRefreshTokenById(tokenId: number, reason: RevokeReason | string = RevokeReason.Rotation): Promise<boolean> {
  try {
    const [updated] = await db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason
      })
      .where(eq(refreshTokens.id, tokenId))
      .returning();
    
    return !!updated;
  } catch (error) {
    console.error('Failed to revoke refresh token:', error);
    return false;
  }
}

/**
 * Revokes all refresh tokens for a user (logout all devices)
 */
export async function revokeAllUserRefreshTokensDb(userId: number, reason: string = 'logout_all'): Promise<number> {
  try {
    const updated = await db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason
      })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isRevoked, false)
        )
      )
      .returning();
    
    return updated.length;
  } catch (error) {
    console.error('Failed to revoke user refresh tokens:', error);
    return 0;
  }
}

/**
 * Cleanup expired refresh tokens (run periodically)
 */
export async function cleanupExpiredRefreshTokensDb(): Promise<number> {
  try {
    const deleted = await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning();
    
    return deleted.length;
  } catch (error) {
    console.error('Failed to cleanup expired refresh tokens:', error);
    return 0;
  }
}

/**
 * Hash refresh token for secure storage using SHA-256
 * SECURITY: Uses cryptographic hash for token lookup (not password storage)
 * This approach is acceptable because:
 * 1. Refresh tokens are high-entropy random values (not low-entropy passwords)
 * 2. We need deterministic hashing for database lookup
 * 3. The JWT signature provides the primary security layer
 */
function hashRefreshToken(token: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(token).digest('hex');
}

// SECURITY ENHANCEMENT: Use centralized validated configuration
const JWT_SECRET = config.JWT_SECRET;
const JWT_REFRESH_SECRET = config.JWT_REFRESH_SECRET;

// Cookie Configuration for secure token storage
export const COOKIE_CONFIG = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  OPTIONS: {
    httpOnly: true, // Prevents XSS attacks
    secure: config.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict' as const, // CSRF protection
    path: '/',
  },
  ACCESS_MAX_AGE: 15 * 60 * 1000, // 15 minutes
  REFRESH_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
};

interface JWTPayload {
  userId: number;
  username: string;
  role: string;
  schoolId?: number;
  classId?: number;
  // SECURITY: Epoch seconds of the user's most recent password change at
  // the time this token was issued. authenticateToken rejects tokens whose
  // pwdAt is older than the current users.passwordChangedAt, so a password
  // reset invalidates all outstanding access tokens (not just refresh).
  pwdAt?: number;
  iat?: number;
  exp?: number;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Generates JWT access and refresh tokens for a user with database storage
 * SECURITY: Refresh tokens are now stored in database for rotation and revocation
 * @param user User object containing id, username, role, etc.
 * @returns Object containing access token, refresh token, and expiration time
 */
export async function generateAuthTokens(user: {
  id: number;
  username: string;
  role: string;
  schoolId?: number | null;
  classId?: number | null;
  passwordChangedAt?: Date | null;
}): Promise<AuthTokens> {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    schoolId: user.schoolId || undefined,
    classId: user.classId || undefined,
    pwdAt: user.passwordChangedAt
      ? Math.floor(user.passwordChangedAt.getTime() / 1000)
      : 0,
  };

  // Access token expires in 15 minutes
  const accessToken = jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '15m',
    issuer: 'rasm-wa-qalam',
    audience: 'rasm-wa-qalam-users'
  });

  // Generate refresh token with 7 days expiration
  const refreshToken = jwt.sign(
    { userId: user.id, tokenType: 'refresh' }, 
    JWT_REFRESH_SECRET, 
    { 
      expiresIn: '7d',
      issuer: 'rasm-wa-qalam',
      audience: 'rasm-wa-qalam-users'
    }
  );

  // SECURITY: Store refresh token in database for rotation and revocation
  const refreshTokenExpiresAt = new Date();
  refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7); // 7 days from now
  
  try {
    await storeRefreshToken(user.id, refreshToken, refreshTokenExpiresAt);
    console.log(`Refresh token stored for user ${user.id}`);
  } catch (error) {
    console.error('Failed to store refresh token in database:', error);
    // Continue anyway - token will work but won't have rotation capability
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verifies and decodes a JWT access token
 * @param token The JWT token to verify
 * @returns Decoded token payload or null if invalid
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'rasm-wa-qalam',
      audience: 'rasm-wa-qalam-users'
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Verifies a refresh token and returns the user ID
 * @param token The refresh token to verify
 * @returns User ID if valid, null if invalid
 */
export async function verifyRefreshToken(token: string): Promise<number | null> {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'rasm-wa-qalam',
      audience: 'rasm-wa-qalam-users'
    }) as { userId: number; tokenType: string };
    
    if (decoded.tokenType !== 'refresh') {
      return null;
    }
    
    return decoded.userId;
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 * SECURITY ENHANCEMENT: Now reads from httpOnly cookies (XSS-safe) with Bearer token fallback
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    // Try to get token from httpOnly cookie first (most secure)
    let token = req.cookies?.[COOKIE_CONFIG.ACCESS_TOKEN];
    
    // Fallback to Authorization header for API clients
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }
    
    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }
    
    const decoded = await verifyAccessToken(token);
    
    if (!decoded) {
      return res.status(401).json({ 
        message: 'Invalid or expired access token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Verify user still exists and is active
    const user = await storage.getUser(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        message: 'User account not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    // SECURITY: Reject access tokens issued before the user's most recent
    // password change. Without this, an attacker holding a stolen access
    // token could continue to use it for up to 15 minutes after the victim
    // resets their password — refresh-token revocation alone is insufficient.
    const userPwdAt = (user as { passwordChangedAt?: Date | null }).passwordChangedAt;
    const userPwdAtSec = userPwdAt ? Math.floor(userPwdAt.getTime() / 1000) : 0;
    const tokenPwdAt = decoded.pwdAt ?? 0;
    if (userPwdAtSec > tokenPwdAt) {
      return res.status(401).json({
        message: 'Session invalidated due to credential change. Please log in again.',
        code: 'CREDENTIALS_CHANGED'
      });
    }

    // SECURITY ENHANCEMENT: Check session timeout
    if (!sessionManager.isSessionActive(user.id)) {
      return res.status(401).json({
        message: 'Session expired due to inactivity. Please log in again.',
        code: 'SESSION_TIMEOUT'
      });
    }

    // SECURITY ENHANCEMENT: Get client IP and User-Agent for session binding.
    // Take only the first XFF entry when falling back — `trust proxy` should
    // already have populated req.ip, so this fallback is mostly defensive.
    let clientIp = req.ip;
    if (!clientIp) {
      const xff = req.headers['x-forwarded-for'];
      if (typeof xff === 'string' && xff.length > 0) clientIp = xff.split(',')[0].trim();
      else if (Array.isArray(xff) && xff.length > 0) clientIp = xff[0].split(',')[0].trim();
    }
    clientIp = clientIp || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // SECURITY ENHANCEMENT: Validate session binding (detect potential token theft)
    const bindingValidation = sessionManager.validateSessionBinding(user.id, clientIp, userAgent);
    if (!bindingValidation.valid) {
      console.warn(`[SECURITY] Session binding validation failed for user ${user.id}: ${bindingValidation.reason}`);
      // SECURITY: Force re-authentication on suspicious session activity (potential token theft)
      await createAuditLog(req, AuditAction.LOGIN_FAILED, 'session', {
        resourceId: String(user.id),
        success: false,
        errorMessage: `Session binding violation: ${bindingValidation.reason}`,
        severity: AuditSeverity.WARNING,
      });
      return res.status(401).json({
        message: 'Your session has been invalidated for security reasons. Please log in again.',
        code: 'SESSION_BINDING_INVALID'
      });
    }

    // SECURITY ENHANCEMENT: Track user activity with IP and User-Agent
    sessionManager.trackActivity(user.id, user.username, clientIp, userAgent);
    
    // Attach user info to request for use in route handlers
    (req as any).user = {
      id: user.id,
      username: user.username,
      role: user.role,
      schoolId: user.schoolId,
      classId: user.classId,
      fullName: user.fullName,
      email: user.email
    };
    
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Middleware to check if user has required role(s)
 * Must be used after authenticateToken middleware
 */
export function requireRole(roles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: user.role
      });
    }
    
    next();
  };
}