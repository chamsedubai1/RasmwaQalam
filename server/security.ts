import { NextFunction, Request, Response } from 'express';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

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
 * Generates JWT access and refresh tokens for a user
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

  // Refresh token expires in 7 days
  const refreshToken = jwt.sign(
    { userId: user.id, tokenType: 'refresh' }, 
    JWT_REFRESH_SECRET, 
    { 
      expiresIn: '7d',
      issuer: 'rasm-wa-qalam',
      audience: 'rasm-wa-qalam-users'
    }
  );

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