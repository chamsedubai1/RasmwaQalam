import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Define session interface with captcha property
declare module 'express-session' {
  interface SessionData {
    captcha?: {
      text: string;
      expiry: Date;
    };
  }
}

interface CaptchaData {
  text: string;
  svgImage: string;
  expiry: Date;
}

// In-memory fallback store for sessions without proper session support
const captchaStore = new Map<string, { text: string; expiry: Date }>();

/**
 * Generates a random string for CAPTCHA
 * @param length Length of the random string
 * @returns Random alphanumeric string
 */
function generateRandomString(length: number): string {
  // Use only alphanumeric characters that are not easily confused
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a SVG image for CAPTCHA
 * @param text The text to display in the CAPTCHA
 * @returns SVG image as string
 */
function generateCaptchaSvg(text: string): string {
  // SVG parameters
  const width = 220;
  const height = 80;
  const fontSize = 36;
  const charSpacing = 10;
  
  // Generate random colors
  const getRandomColor = () => {
    const colors = ['#3069FE', '#0A3FE3', '#0645AB', '#1E40AF', '#0F65BD'];
    return colors[Math.floor(Math.random() * colors.length)];
  };
  
  // SVG header
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  
  // Background with subtle pattern
  svg += `<rect width="100%" height="100%" fill="white"/>`;
  
  // Add confusing background lines
  for (let i = 0; i < 5; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${getRandomColor()}" stroke-width="1" stroke-opacity="0.5"/>`;
  }
  
  // Add random circles as noise
  for (let i = 0; i < 15; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const r = 1 + Math.random() * 3;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${getRandomColor()}" fill-opacity="0.3"/>`;
  }
  
  // Add the characters with random transformations
  let x = 30;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const y = height / 2 + (Math.random() * 10 - 5);
    const rotate = Math.random() * 20 - 10;
    const color = getRandomColor();
    
    svg += `<text x="${x}" y="${y}" 
      font-family="Arial, sans-serif" 
      font-size="${fontSize + Math.floor(Math.random() * 10 - 5)}" 
      font-weight="bold" 
      fill="${color}" 
      transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
    
    x += fontSize + charSpacing + Math.floor(Math.random() * 10);
  }
  
  // Add some more distortion with wavy patterns
  svg += `<path d="M0,${height/2} Q${width/4},${height/3} ${width/2},${height/2} T${width},${height/2}" 
    stroke="${getRandomColor()}" 
    stroke-width="2" 
    fill="none" 
    stroke-opacity="0.3"/>`;
  
  // Close SVG
  svg += '</svg>';
  
  return svg;
}

/**
 * Generates a CAPTCHA for the given session
 * @param sessionId The session ID
 * @returns CAPTCHA data including the text and SVG image
 */
export function generateCaptcha(sessionId: string): CaptchaData {
  // Generate random text (5-6 characters)
  const length = 5 + Math.floor(Math.random() * 2); 
  const text = generateRandomString(length);
  
  // Generate SVG image
  const svgImage = generateCaptchaSvg(text);
  
  // Set expiry time (5 minutes)
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 5);
  
  // Store in session or fallback store
  captchaStore.set(sessionId, { text, expiry });
  
  const captchaData: CaptchaData = {
    text,
    svgImage,
    expiry,
  };
  
  return captchaData;
}

/**
 * Validates a CAPTCHA for the given session
 * @param sessionId The session ID
 * @param userInput The user's input
 * @returns True if valid, false otherwise
 */
export function validateCaptcha(sessionId: string, userInput: string): boolean {
  // Get stored captcha
  const storedCaptcha = captchaStore.get(sessionId);
  
  if (!storedCaptcha) {
    return false;
  }
  
  // Check if expired
  if (new Date() > storedCaptcha.expiry) {
    // Remove expired captcha
    captchaStore.delete(sessionId);
    return false;
  }
  
  // Case insensitive comparison
  const isValid = storedCaptcha.text.toUpperCase() === userInput.toUpperCase();
  
  // Remove used captcha
  if (isValid) {
    captchaStore.delete(sessionId);
  }
  
  return isValid;
}

/**
 * Express middleware to require valid CAPTCHA
 */
export function requireCaptcha(req: Request, res: Response, next: NextFunction) {
  const { captchaText } = req.body;
  
  if (!captchaText) {
    return res.status(400).json({ message: 'CAPTCHA is required', field: 'captchaText' });
  }
  
  // Get session ID
  const sessionId = req.sessionID || req.ip || crypto.randomBytes(16).toString('hex');
  
  if (!validateCaptcha(sessionId, captchaText)) {
    return res.status(400).json({ 
      message: 'Invalid or expired CAPTCHA. Please try again.', 
      field: 'captchaText'
    });
  }
  
  next();
}