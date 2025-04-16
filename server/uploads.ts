import multer from 'multer';
import path from 'path';
import fs from 'fs';
import express, { Router, Request, Response, Express } from 'express';
import { storage as dbStorage } from './storage';
import { randomUUID } from 'crypto';

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

// Set up upload routes
export function setupUploadRoutes(apiRouter: Router) {
  // Route for uploading files
  apiRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Check if the user has proper authorization
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization required' });
      }
      
      const token = authHeader.split(' ')[1];
      const username = token.split(':')[0];
      
      // Get user information from the storage
      const user = await dbStorage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is inactive' });
      }
      
      // Only admins, teachers, and school admins can upload files
      if (user.role !== 'admin' && user.role !== 'teacher' && user.role !== 'schoolAdmin') {
        return res.status(403).json({ message: 'Unauthorized to upload files' });
      }

      // Form the URL to access the file
      const fileUrl = `/uploads/${req.file.filename}`;

      console.log(`File uploaded by ${username}: ${req.file.originalname} -> ${req.file.filename}`);

      // Return the file information and URL
      res.status(200).json({
        message: 'File uploaded successfully',
        url: fileUrl,
        file: {
          originalName: req.file.originalname,
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Error uploading file' });
    }
  });
}

// Set up static file serving for uploads
export function setupStaticUploads(app: Express) {
  app.use('/uploads', express.static(uploadDir));
}