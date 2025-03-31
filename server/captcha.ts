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
export const captchaStore = new Map<string, { text: string; expiry: Date }>();

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
  const width = 250; // Wider to accommodate all characters
  const height = 80;
  const fontSize = 32; // Slightly smaller font
  const charSpacing = 8; // Reduced spacing
  
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
  
  // Calculate total width required for all characters
  const charCount = text.length;
  const availableWidth = width - 50; // 25px padding on each side
  const maxCharWidth = availableWidth / charCount;
  
  // Add the characters with random transformations
  let x = 25; // Start from left padding
  
  // Debug info for character positioning
  console.log(`Generating CAPTCHA SVG with ${charCount} characters. Available width: ${availableWidth}px`);
  
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const y = height / 2 + (Math.random() * 8 - 4); // Less vertical variation
    const rotate = Math.random() * 16 - 8; // Less rotation
    const color = getRandomColor();
    const charFontSize = fontSize + Math.floor(Math.random() * 6 - 3); // Less font size variation
    
    svg += `<text x="${x}" y="${y}" 
      font-family="Arial, sans-serif" 
      font-size="${charFontSize}" 
      font-weight="bold" 
      fill="${color}" 
      transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
    
    console.log(`Character ${i+1} (${char}): x=${x}, fontSize=${charFontSize}`);
    
    // More consistent spacing based on available width
    const nextCharSpace = Math.min(charFontSize + charSpacing, maxCharWidth);
    x += nextCharSpace;
  }
  
  // Add a subtle wavy pattern for distraction
  svg += `<path d="M0,${height/2} Q${width/4},${height/3} ${width/2},${height/2} T${width},${height/2}" 
    stroke="${getRandomColor()}" 
    stroke-width="2" 
    fill="none" 
    stroke-opacity="0.2"/>`;
  
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
  // Generate fixed length text (4-5 characters) 
  // Shorter is easier for users to see and type correctly
  const length = 4 + Math.floor(Math.random() * 2); 
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
  // For development, we still validate properly
  console.log('CAPTCHA validation in progress - development mode');
  
  console.log(`validateCaptcha - sessionId: ${sessionId}, userInput: ${userInput}`);
  
  // Debug all stored captchas
  console.log('All stored captchas:');
  captchaStore.forEach((value, key) => {
    console.log(` - Session ${key}: ${value.text} (expires: ${value.expiry})`);
  });
  
  // Get stored captcha
  const storedCaptcha = captchaStore.get(sessionId);
  
  if (!storedCaptcha) {
    console.log(`No CAPTCHA found for session ID: ${sessionId}`);
    return false;
  }
  
  console.log(`Found CAPTCHA for ${sessionId}: ${storedCaptcha.text}`);
  
  // Check if expired
  if (new Date() > storedCaptcha.expiry) {
    console.log(`CAPTCHA expired for ${sessionId}`);
    // Remove expired captcha
    captchaStore.delete(sessionId);
    return false;
  }
  
  // Case insensitive comparison
  const isValid = storedCaptcha.text.toUpperCase() === userInput.toUpperCase();
  console.log(`CAPTCHA validation result for ${sessionId}: ${isValid ? 'valid' : 'invalid'}`);
  console.log(`Expected: ${storedCaptcha.text.toUpperCase()}, Got: ${userInput.toUpperCase()}`);
  
  // Remove used captcha
  if (isValid) {
    console.log(`Removing used CAPTCHA for ${sessionId}`);
    captchaStore.delete(sessionId);
  }
  
  return isValid;
}

/**
 * Express middleware to require valid CAPTCHA
 */
export function requireCaptcha(req: Request, res: Response, next: NextFunction) {
  console.log('Validating CAPTCHA...');
  console.log('Request body:', req.body);
  
  const { captchaText } = req.body;
  
  if (!captchaText) {
    console.log('CAPTCHA text is missing in request');
    return res.status(400).json({ message: 'CAPTCHA is required', field: 'captchaText' });
  }
  
  // Debug info
  console.log(`Received CAPTCHA text: ${captchaText}`);
  console.log(`Session ID: ${req.ip}`);
  
  // In development mode, we validate the CAPTCHA strictly 
  // but with more detailed logs for debugging
  console.log('Validating CAPTCHA in development mode - showing more debug info');
  
  // Check session first for CAPTCHA
  if (req.session && req.session.captcha) {
    const { text, expiry } = req.session.captcha;
    console.log(`Session CAPTCHA found - Expected: ${text}, Got: ${captchaText}`);
    
    // Check if expired
    if (new Date() > new Date(expiry)) {
      console.log('Session CAPTCHA expired');
      delete req.session.captcha;
      return res.status(400).json({ 
        message: 'CAPTCHA expired. Please refresh and try again.', 
        field: 'captchaText'
      });
    }
    
    // Case insensitive comparison
    if (text.toUpperCase() === captchaText.toUpperCase()) {
      console.log('Session CAPTCHA valid');
      // CAPTCHA is valid, remove from session to prevent reuse
      delete req.session.captcha;
      return next();
    } else {
      console.log('Session CAPTCHA invalid');
    }
  } else {
    console.log('No session CAPTCHA found');
  }
  
  // Fall back to IP-based CAPTCHA validation
  const sessionId = req.ip || crypto.randomBytes(16).toString('hex');
  console.log(`Using IP-based validation with ID: ${sessionId}`);
  
  // Get stored CAPTCHA for this IP
  const storedCaptcha = captchaStore.get(sessionId);
  console.log(`IP-based CAPTCHA: ${storedCaptcha ? storedCaptcha.text : 'None'}`);
  
  if (validateCaptcha(sessionId, captchaText)) {
    console.log('IP-based CAPTCHA valid');
    return next();
  }
  
  // Create a more descriptive error message
  let errorMessage = 'Invalid or expired CAPTCHA. Please try again.';
  
  // If we have stored CAPTCHA and the lengths don't match, provide a hint
  if (storedCaptcha && storedCaptcha.text.length !== captchaText.length) {
    errorMessage = `Please enter the complete CAPTCHA text (${storedCaptcha.text.length} characters). You entered ${captchaText.length} characters.`;
  }
  
  console.log(`CAPTCHA validation failed. Error: ${errorMessage}`);
  return res.status(400).json({ 
    message: errorMessage, 
    field: 'captchaText'
  });
}