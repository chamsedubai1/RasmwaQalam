import { NextFunction, Request, Response } from 'express';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import rateLimit from 'express-rate-limit';

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