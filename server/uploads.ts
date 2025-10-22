import multer from 'multer';
import path from 'path';
import fs from 'fs';
import express, { Router, Request, Response, Express } from 'express';
import { storage as dbStorage } from './storage';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { authenticateToken, requireRole } from './security';
import { config } from './config';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * SECURITY ENHANCEMENT: Magic byte signatures for file type validation
 * Verifies actual file content instead of trusting the extension or MIME type
 */
const MAGIC_BYTES = {
  'image/jpeg': [
    Buffer.from([0xFF, 0xD8, 0xFF]),
  ],
  'image/png': [
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  ],
  'image/gif': [
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
  ],
  'image/webp': [
    Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
  ],
};

/**
 * Verify file content matches the declared MIME type using magic bytes
 */
function verifyFileType(filePath: string, declaredMimeType: string): boolean {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const magicBytes = MAGIC_BYTES[declaredMimeType as keyof typeof MAGIC_BYTES];
    
    if (!magicBytes) {
      console.warn(`No magic bytes defined for MIME type: ${declaredMimeType}`);
      return false;
    }
    
    // Check if file starts with any of the valid magic byte sequences
    return magicBytes.some(signature => {
      if (fileBuffer.length < signature.length) {
        return false;
      }
      return fileBuffer.subarray(0, signature.length).equals(signature);
    });
  } catch (error) {
    console.error('Error verifying file type:', error);
    return false;
  }
}

/**
 * SECURITY ENHANCEMENT: Generate signed URL for secure file downloads
 * Prevents direct access to uploaded files and enables access control
 */
export function generateSignedUrl(filename: string, expiresIn: number = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const payload = `${filename}:${expires}`;
  
  // Create HMAC signature using JWT secret
  const signature = createHmac('sha256', config.JWT_SECRET)
    .update(payload)
    .digest('base64url');
  
  return `/api/download/${filename}?expires=${expires}&signature=${signature}`;
}

/**
 * Verify signed URL is valid and not expired
 */
function verifySignedUrl(filename: string, expires: string, signature: string): boolean {
  try {
    // Check expiration
    const expiryTime = parseInt(expires, 10);
    if (isNaN(expiryTime) || Date.now() / 1000 > expiryTime) {
      return false;
    }
    
    // Recreate expected signature
    const payload = `${filename}:${expires}`;
    const expectedSignature = createHmac('sha256', config.JWT_SECRET)
      .update(payload)
      .digest('base64url');
    
    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('Error verifying signed URL:', error);
    return false;
  }
}

// Configure storage
const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueFileName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  },
});

/**
 * SECURITY ENHANCEMENT: Strict file filter with allowlist of MIME types
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Validate MIME type against allowlist
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`));
  }
  
  // Validate extension against allowlist
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file extension: ${ext}. Only JPG, PNG, GIF, and WebP are allowed.`));
  }
  
  // Validate filename doesn't contain path traversal attempts
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return cb(new Error('Invalid filename: path traversal detected'));
  }
  
  cb(null, true);
};

// Configure multer with strict limits
export const upload = multer({
  storage: multerStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only one file per request
    fields: 10, // Limit number of fields
    parts: 20, // Limit total parts
  },
});

// Set up upload routes with secure JWT authentication
export function setupUploadRoutes(apiRouter: Router) {
  // SECURE file upload route - now uses JWT authentication instead of insecure token parsing
  apiRouter.post('/upload', 
    authenticateToken, 
    requireRole(['admin', 'teacher', 'schoolAdmin']), 
    upload.single('file'), 
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }
        
        // User data is already validated and attached by authenticateToken middleware
        const user = (req as any).user;
        
        // SECURITY ENHANCEMENT: Verify file content using magic bytes
        // This prevents malicious files disguised as images
        const isValidFileType = verifyFileType(req.file.path, req.file.mimetype);
        
        if (!isValidFileType) {
          // Delete the uploaded file if content doesn't match MIME type
          fs.unlinkSync(req.file.path);
          console.warn(`File upload rejected: Magic byte verification failed for ${req.file.originalname} (${req.file.mimetype})`);
          return res.status(400).json({ 
            message: 'File content does not match the declared file type. Upload rejected for security.',
            code: 'INVALID_FILE_CONTENT'
          });
        }
        
        // Additional extension validation (double-check)
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ 
            message: 'File type not allowed. Only JPG, PNG, GIF, and WebP images are permitted.',
            allowedTypes: ALLOWED_EXTENSIONS
          });
        }
        
        // Check file size (additional validation)
        if (req.file.size > 10 * 1024 * 1024) { // 10MB
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ 
            message: 'File size too large. Maximum size is 10MB.'
          });
        }
        
        // SECURITY ENHANCEMENT: Generate signed URL instead of public URL
        // This provides access control and prevents unauthorized downloads
        const signedUrl = generateSignedUrl(req.file.filename, 86400); // 24 hour expiry
        
        console.log(`File uploaded by user ID ${user.id}: ${req.file.originalname} -> ${req.file.filename} (magic bytes verified)`);
        
        // Return the file information with signed URL
        res.status(200).json({
          message: 'File uploaded successfully',
          url: signedUrl, // Signed URL with expiration
          file: {
            originalName: req.file.originalname,
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadedBy: user.id,
            uploadedAt: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        
        // Clean up file if there was an error
        if (req.file?.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.error('Error cleaning up uploaded file:', cleanupError);
          }
        }
        
        res.status(500).json({ message: 'Error uploading file' });
      }
    }
  );
  
  // SECURITY ENHANCEMENT: Secure file download with signed URL validation
  // Replaces public /uploads directory with access-controlled downloads
  apiRouter.get('/download/:filename', async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const { expires, signature } = req.query;
      
      // Validate parameters
      if (!filename || !expires || !signature) {
        return res.status(400).json({ 
          message: 'Missing required parameters',
          code: 'INVALID_REQUEST'
        });
      }
      
      // Validate filename to prevent path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        console.warn(`Download rejected: Path traversal attempt in filename: ${filename}`);
        return res.status(400).json({ 
          message: 'Invalid filename',
          code: 'PATH_TRAVERSAL_DETECTED'
        });
      }
      
      // Verify signed URL
      const isValid = verifySignedUrl(filename, expires as string, signature as string);
      
      if (!isValid) {
        console.warn(`Download rejected: Invalid signature for ${filename} from IP: ${req.ip}`);
        return res.status(403).json({ 
          message: 'Invalid or expired download link',
          code: 'INVALID_SIGNATURE'
        });
      }
      
      // Build file path
      const filePath = path.join(uploadDir, filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ 
          message: 'File not found',
          code: 'FILE_NOT_FOUND'
        });
      }
      
      // Security check: Ensure file is within uploads directory (prevent directory traversal)
      const realPath = fs.realpathSync(filePath);
      const realUploadDir = fs.realpathSync(uploadDir);
      
      if (!realPath.startsWith(realUploadDir)) {
        console.error(`Security violation: Attempted access outside uploads directory: ${realPath}`);
        return res.status(403).json({ 
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }
      
      // Set security headers for file download
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      
      // Send file
      res.sendFile(realPath);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ message: 'Error downloading file' });
    }
  });
}

/**
 * SECURITY NOTE: Public uploads directory is deprecated
 * Use signed URLs via /api/download/:filename instead for access control
 * This function is kept for backwards compatibility but should be removed in production
 */
export function setupStaticUploads(app: Express) {
  // DEPRECATED: Public file access - use signed URLs instead
  // Keeping for backwards compatibility with existing uploaded files
  console.warn('⚠️  Public uploads directory is enabled - consider using signed URLs for better security');
  app.use('/uploads', express.static(uploadDir));
}