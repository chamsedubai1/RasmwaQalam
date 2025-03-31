import multer from 'multer';
import path from 'path';
import fs from 'fs';
import express, { Router, Request, Response, Express } from 'express';
import { randomUUID } from 'crypto';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
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
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Set up upload routes
export function setupUploadRoutes(apiRouter: Router) {
  // Route for uploading files
  apiRouter.post('/upload', upload.single('image'), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Form the URL to access the file
      const fileUrl = `/uploads/${req.file.filename}`;

      // Return the file information
      res.status(200).json({
        message: 'File uploaded successfully',
        file: {
          originalName: req.file.originalname,
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: fileUrl
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