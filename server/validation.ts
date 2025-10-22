import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * SECURITY ENHANCEMENT: Global input validation middleware
 * Validates request data against Zod schemas to prevent injection attacks
 * and ensure data integrity throughout the application
 */

/**
 * Common validation schemas for reusable field validation
 */
export const commonSchemas = {
  // ID validation - must be positive integer
  id: z.number().int().positive(),
  
  // String ID validation (for UUIDs or numeric string IDs)
  stringId: z.string().min(1).max(100),
  
  // Email validation
  email: z.string().email().max(255),
  
  // Username validation - alphanumeric, underscores, hyphens
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  
  // Password validation - strong password requirements
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  
  // URL validation
  url: z.string().url().max(2048),
  
  // Safe text input - prevents common injection patterns
  safeText: z.string()
    .max(1000)
    .refine(
      (val) => !/<script|javascript:|onerror=|onclick=/i.test(val),
      'Input contains potentially unsafe content'
    ),
  
  // Pagination parameters
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  
  // Date validation
  isoDate: z.string().datetime(),
  
  // Enum validation helper
  enumValue: <T extends string>(values: readonly T[]) => 
    z.enum(values as [T, ...T[]]),
};

/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeValidationError(error: ZodError): object {
  return {
    message: 'Validation failed',
    errors: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Middleware factory for validating request data against Zod schemas
 * 
 * @param schema - Zod schema to validate against
 * @param source - Which part of the request to validate ('body', 'query', 'params')
 * @returns Express middleware function
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get the data to validate based on source
      const dataToValidate = req[source];
      
      // Parse and validate the data
      const validated = await schema.parseAsync(dataToValidate);
      
      // Replace the original data with validated data
      // This ensures type safety and removes any extra fields
      req[source] = validated;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Log validation failures for security monitoring
        console.warn(`Validation failed for ${req.method} ${req.path}:`, {
          source,
          errors: error.errors.map(e => ({ path: e.path, message: e.message })),
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        
        return res.status(400).json(sanitizeValidationError(error));
      }
      
      // Unexpected error during validation
      console.error('Unexpected validation error:', error);
      return res.status(500).json({ message: 'Validation error occurred' });
    }
  };
}

/**
 * Middleware to validate multiple request parts at once
 * 
 * @param schemas - Object mapping sources to schemas
 * @returns Express middleware function
 */
export function validateMultiple(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate each specified part
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query) as any;
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as any;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        console.warn(`Multi-part validation failed for ${req.method} ${req.path}:`, {
          errors: error.errors.map(e => ({ path: e.path, message: e.message })),
          ip: req.ip,
        });
        
        return res.status(400).json(sanitizeValidationError(error));
      }
      
      console.error('Unexpected validation error:', error);
      return res.status(500).json({ message: 'Validation error occurred' });
    }
  };
}

/**
 * SQL injection prevention - validates and sanitizes SQL-like inputs
 */
export const sqlInjectionFilter = z.string().refine(
  (val) => {
    // Block common SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/i,
      /(--|;|\/\*|\*\/|xp_|sp_)/i,
      /('|(\\')|(")|(\\")|(;))/,
    ];
    
    return !sqlPatterns.some(pattern => pattern.test(val));
  },
  'Input contains potentially unsafe SQL characters'
);

/**
 * XSS prevention - validates and sanitizes HTML/script inputs
 */
export const xssFilter = z.string().refine(
  (val) => {
    // Block common XSS patterns
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // onclick, onerror, etc.
      /<embed[\s\S]*?>/gi,
      /<object[\s\S]*?>/gi,
    ];
    
    return !xssPatterns.some(pattern => pattern.test(val));
  },
  'Input contains potentially unsafe HTML/JavaScript'
);

/**
 * Path traversal prevention - validates file paths
 */
export const pathTraversalFilter = z.string().refine(
  (val) => {
    // Block path traversal patterns
    const pathPatterns = [
      /\.\./,  // Parent directory
      /~\//,   // Home directory
      /\/\//,  // Double slashes
      /\\/,    // Backslashes
    ];
    
    return !pathPatterns.some(pattern => pattern.test(val));
  },
  'Input contains potentially unsafe path characters'
);

/**
 * Strict sanitization for user-generated content
 */
export function sanitizeUserInput(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[{}]/g, ''); // Remove curly braces
}

/**
 * Middleware to apply strict sanitization to all string fields in request body
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeUserInput(req.body[key]);
      }
    }
  }
  next();
}

/**
 * Rate limit key validation - ensures rate limit keys are safe
 */
export const rateLimitKeySchema = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9:_-]+$/, 'Invalid rate limit key format');

/**
 * File upload validation schema
 */
export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string()
    .min(1)
    .max(255)
    .refine(
      (name) => /^[a-zA-Z0-9_\-. ]+$/.test(name),
      'Filename contains invalid characters'
    ),
  encoding: z.string(),
  mimetype: z.string().refine(
    (type) => [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
    ].includes(type),
    'Invalid file type - only images allowed'
  ),
  size: z.number()
    .max(10 * 1024 * 1024, 'File size must not exceed 10MB'),
});
