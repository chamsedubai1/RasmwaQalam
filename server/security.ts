import { NextFunction, Request, Response } from 'express';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { db } from './db';
import { refreshTokens } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';

// Convert callback-based scrypt to Promise-based
const scryptAsync = promisify(scrypt);

/**
 * Hashes a password using scrypt with a random salt
 * @param password The plaintext password to hash
 * @returns A string in the format "hash.salt"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${derivedKey.toString('hex')}.${salt}`;
}

/**
 * Verifies a password against a stored hash
 * @param plainPassword The plaintext password to verify
 * @param storedHash The stored password hash in the format "hash.salt"
 * @returns Whether the password matches the hash
 */
export async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  try {
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
  // Store to count requests during the 1 minute window
  // Default: Memory store (not designed for production use)
  // For production, use a more robust store like Redis
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
 * Revokes a refresh token by ID with reason
 */
export async function revokeRefreshTokenById(tokenId: number, reason: string = 'rotation'): Promise<boolean> {
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
 * Hash refresh token for secure storage
 */
async function hashRefreshToken(token: string): Promise<string> {
  const hash = await scryptAsync(token, 'refresh_token_salt_rasm_qalam', 32);
  return (hash as Buffer).toString('hex');
}

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || randomBytes(32).toString('hex');

// Warn if using default secrets in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('WARNING: Using default JWT_SECRET in production. Set JWT_SECRET environment variable.');
}

interface JWTPayload {
  userId: number;
  username: string;
  role: string;
  schoolId?: number;
  classId?: number;
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
}): Promise<AuthTokens> {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    schoolId: user.schoolId || undefined,
    classId: user.classId || undefined,
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
 * Replaces the insecure username:timestamp system
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }
    
    const token = authHeader.split(' ')[1];
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