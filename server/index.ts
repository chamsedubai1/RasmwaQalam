import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "./config";
import { setCsrfToken } from "./csrf";

console.log(`Starting server in ${config.NODE_ENV} mode`);

const app = express();

// Trust proxy for rate limiting to work correctly behind Replit proxy
// This is necessary for X-Forwarded-For headers to be properly read
app.set('trust proxy', 1);

// SECURITY ENHANCEMENT: Strict CORS policy with allowlist
const allowedOrigins = config.ALLOWED_ORIGINS 
  ? config.ALLOWED_ORIGINS.split(',')
  : [
      'https://*.replit.dev',
      'https://*.repl.co',
      config.NODE_ENV === 'development' ? 'http://localhost:5000' : ''
    ].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // In development, allow requests with no origin (same-origin requests, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        // Handle wildcard patterns like https://*.replit.dev
        const pattern = allowed.replace(/\*/g, '[^.]+');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else if (config.NODE_ENV === 'development') {
      // In development, allow all origins for local testing
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation: Origin not allowed'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-csrf-token'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400 // 24 hours preflight cache
}));

// SECURITY: Cookie parser middleware for reading httpOnly cookies
app.use(cookieParser());

// SECURITY ENHANCEMENT: Comprehensive security headers middleware
app.use((req, res, next) => {
  // HSTS: Force HTTPS for 1 year (including subdomains)
  if (config.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // SECURITY FIX: Strict CSP without unsafe-inline/unsafe-eval
  // Different policies for development vs production
  let cspDirectives: string;
  
  if (config.NODE_ENV === 'production') {
    // Production: Strict CSP - no unsafe directives
    cspDirectives = [
      "default-src 'self'",
      "script-src 'self'", // No unsafe-inline, no unsafe-eval
      "style-src 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' wss:", // Production uses WSS
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests"
    ].join('; ');
  } else {
    // Development: Relaxed for Vite HMR, but still avoid eval
    cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Vite needs inline for HMR
      "style-src 'self' 'unsafe-inline'", // Vite injects inline styles
      "img-src 'self' data: https: blob:", // Blob for Vite assets
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:", // Dev uses WS
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'"
    ].join('; ');
  }
  
  res.setHeader('Content-Security-Policy', cspDirectives);
  
  // X-Frame-Options: Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options: Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-XSS-Protection: Enable XSS filter (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer-Policy: Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy: Disable unnecessary browser features
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );
  
  next();
});

// Set up session middleware for CAPTCHA
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: config.NODE_ENV === 'production',
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

// Increase JSON body size limit to 50MB for image data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// SECURITY ENHANCEMENT: CSRF protection - generate tokens for all requests
// This sets the CSRF token cookie that the frontend can read
app.use(setCsrfToken);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // SECURITY ENHANCEMENT: Sanitized error handling middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    // Log full error details server-side for debugging (never expose to client)
    console.error('Error occurred:', {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status,
      message: err.message,
      stack: config.NODE_ENV === 'development' ? err.stack : undefined,
      // Don't log request body as it may contain sensitive data
    });
    
    // SECURITY: Sanitize error message for client (prevent information disclosure)
    let clientMessage: string;
    
    if (status >= 400 && status < 500) {
      // Client errors: safe to expose message
      clientMessage = err.message || 'Bad Request';
    } else {
      // Server errors: use generic message to prevent information leakage
      clientMessage = config.NODE_ENV === 'production' 
        ? 'An unexpected error occurred. Please try again later.'
        : err.message || 'Internal Server Error';
    }
    
    // Send sanitized error response
    res.status(status).json({ 
      message: clientMessage,
      // Only include error code in production (no stack traces)
      ...(config.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: err.details 
      })
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
