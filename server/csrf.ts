/**
 * SECURITY ENHANCEMENT: CSRF (Cross-Site Request Forgery) Protection
 * Implements double-submit cookie pattern for state-changing requests
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { config } from './config';

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Validate CSRF token using timing-safe comparison (internal helper)
 */
function verifyCsrfTokenMatch(cookieToken: string | undefined, headerToken: string | undefined): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }
  
  // Both tokens must be the same length
  if (cookieToken.length !== headerToken.length) {
    return false;
  }
  
  try {
    // Use timing-safe comparison to prevent timing attacks
    const cookieBuffer = Buffer.from(cookieToken, 'utf8');
    const headerBuffer = Buffer.from(headerToken, 'utf8');
    
    return timingSafeEqual(cookieBuffer, headerBuffer);
  } catch (error) {
    // If comparison fails (e.g., invalid encoding), return false
    return false;
  }
}

/**
 * Middleware to generate and set CSRF token cookie
 * Should be applied to all routes that render pages or return user data
 */
export function setCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Check if CSRF token cookie already exists
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!csrfToken) {
    // Generate new token if it doesn't exist
    csrfToken = generateCsrfToken();
    
    // Set CSRF token in cookie
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false, // Must be readable by JavaScript for double-submit
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict', // Additional CSRF protection
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }
  
  // Attach token to response locals for access in templates/API responses
  res.locals.csrfToken = csrfToken;
  
  next();
}

/**
 * Middleware to validate CSRF token on state-changing requests
 * Should be applied to POST, PUT, PATCH, DELETE routes
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF validation for safe HTTP methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }
  
  // Get CSRF token from cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  // Get CSRF token from header or body
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
  const bodyToken = req.body?.csrfToken as string | undefined;
  const tokenFromRequest = headerToken || bodyToken;
  
  // Validate tokens match
  if (!verifyCsrfTokenMatch(cookieToken, tokenFromRequest)) {
    console.warn(`CSRF validation failed for ${req.method} ${req.path} from IP: ${req.ip}`);
    return res.status(403).json({ 
      message: 'Invalid or missing CSRF token',
      code: 'CSRF_VALIDATION_FAILED'
    });
  }
  
  // CSRF token is valid, proceed
  next();
}

/**
 * Middleware factory to protect specific routes with CSRF validation
 * Use this for routes that need CSRF protection
 */
export function requireCsrfToken() {
  return validateCsrfToken;
}

/**
 * Get CSRF token from request (for including in API responses)
 */
export function getCsrfToken(req: Request): string | undefined {
  return req.cookies?.[CSRF_COOKIE_NAME];
}

/**
 * SECURITY: Force-rotate the CSRF cookie. Call this on login and logout so
 * that a token captured before authentication state changes cannot be reused
 * across the boundary (e.g. a pre-login token surviving into an authenticated
 * session, or vice versa).
 */
export function rotateCsrfToken(req: Request, res: Response): string {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  if (req.cookies) {
    req.cookies[CSRF_COOKIE_NAME] = token;
  }
  return token;
}

/**
 * Export constants for use in other modules
 */
export const CSRF_CONFIG = {
  COOKIE_NAME: CSRF_COOKIE_NAME,
  HEADER_NAME: CSRF_HEADER_NAME,
  TOKEN_LENGTH: CSRF_TOKEN_LENGTH
};
