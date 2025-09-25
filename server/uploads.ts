import multer from 'multer';
import path from 'path';
import fs from 'fs';
import express, { Router, Request, Response, Express } from 'express';
import { storage as dbStorage } from './storage';
import { randomUUID } from 'crypto';
import { authenticateToken, requireRole } from './security';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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

// File filter to only allow image files
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Configure multer
export const upload = multer({
  storage: multerStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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
        
        // Additional file validation (enhance based on architect's recommendations)
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
          // Delete the uploaded file if it's not allowed
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ 
            message: 'File type not allowed. Only JPG, PNG, GIF, and WebP images are permitted.',
            allowedTypes: allowedExtensions
          });
        }
        
        // Check file size (additional validation)
        if (req.file.size > 5 * 1024 * 1024) { // 5MB
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ 
            message: 'File size too large. Maximum size is 5MB.'
          });
        }
        
        // Form the URL to access the file
        const fileUrl = `/uploads/${req.file.filename}`;
        
        console.log(`File uploaded by user ID ${user.id}: ${req.file.originalname} -> ${req.file.filename}`);
        
        // Return the file information and URL
        res.status(200).json({
          message: 'File uploaded successfully',
          url: fileUrl,
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
}

// Set up static file serving for uploads
export function setupStaticUploads(app: Express) {
  app.use('/uploads', express.static(uploadDir));
}