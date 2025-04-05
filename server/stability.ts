// Import functions, types from stability-client
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import stabilityClient from 'stability-client';

// Extract the generate function
const { generate } = stabilityClient;

// Define types matching stability-client's type structure
interface ImageData {
  buffer: Buffer;
  filePath: string;
  seed: number;
  mimeType: string;
  classifications: {
    realizedAction: number;
  };
}

interface ResponseData {
  isOk: boolean;
  status: string;
  code: number;
  message: string;
  trailers: any;
}

// Create a temporary directory for Stability AI images if needed
const tmpDir = path.join(os.tmpdir(), 'stability-ai-images');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

/**
 * Converts a base64 string to a readable stream
 * @param base64 Base64 string to convert
 * @returns Readable stream
 */
function base64ToStream(base64: string): Readable {
  const buffer = Buffer.from(base64.split(',')[1], 'base64');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * Generates an image based on the given prompt using Stability.ai's API
 * @param prompt User's prompt for the image
 * @returns Base64 data URL of the generated image
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    if (!process.env.STABILITY_API_KEY) {
      throw new Error('STABILITY_API_KEY environment variable is not set');
    }

    return new Promise((resolve, reject) => {
      // Create a unique filename for this generation
      const filename = `stability-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // Configure the Stability API request
      const stabilityOptions = {
        prompt: prompt,
        apiKey: process.env.STABILITY_API_KEY as string, // Type assertion to assure TypeScript that this is not undefined
        outDir: tmpDir,
        width: 1024,
        height: 1024,
        samples: 1,
        steps: 30,
        cfgScale: 7.0,
        engine: 'stable-diffusion-xl-1024-v1-0',
      };

      let imageData: Buffer | null = null;
      
      // Call the Stability API
      const generation = generate(stabilityOptions);
      
      // Handle image generation events
      generation.on('image', (data: ImageData) => {
        console.log(`Stability AI generated image with seed ${data.seed}`);
        imageData = data.buffer;
      });
      
      // Handle completion or error
      generation.on('end', (data: ResponseData) => {
        if (!data.isOk) {
          const errorMsg = data.message || 'Unknown error';
          console.error(`Stability AI generation failed: ${errorMsg}`);
          
          // Check for specific error about insufficient balance
          if (errorMsg.includes('not have enough balance')) {
            console.warn('Stability.ai account has insufficient balance. Using fallback image generation.');
            return resolve(generatePlaceholderImage(
              prompt + "\n\nNote: Image couldn't be generated with Stability.ai due to insufficient account balance."
            ));
          }
          
          return reject(new Error(`Image generation failed: ${errorMsg}`));
        }
        
        if (!imageData) {
          return reject(new Error('No image was generated'));
        }
        
        // Convert the image buffer to a base64 data URL
        const base64Data = imageData.toString('base64');
        resolve(`data:image/png;base64,${base64Data}`);
        
        // Clean up the temporary file if it exists
        try {
          const filePath = path.join(tmpDir, `${filename}.png`);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary image file:', cleanupError);
        }
      });
    });
  } catch (error: any) {
    console.error('Error generating image with Stability.ai:', error);
    
    // Use a placeholder image if the API call fails
    return generatePlaceholderImage(prompt);
  }
}

/**
 * Fallback function to generate a placeholder image
 * Only used if the API call fails
 */
function generatePlaceholderImage(prompt: string): string {
  // Enhanced SVG placeholder with gradient background and better styling
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f5f7fa;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#c3cfe2;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="textgrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4a6fa5;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#166bb9;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="800" height="800" fill="url(#grad)" />
      <rect x="100" y="100" width="600" height="600" rx="15" ry="15" fill="white" fill-opacity="0.8" />
      
      <text x="50%" y="200" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="url(#textgrad)">
        Image Generation Unavailable
      </text>
      
      <text x="50%" y="250" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#666">
        Original prompt:
      </text>
      
      <foreignObject x="150" y="270" width="500" height="200">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 16px; color: #333; text-align: center; overflow-wrap: break-word;">
          ${prompt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
      </foreignObject>
      
      <text x="50%" y="520" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#e74c3c">
        Stability.ai account has insufficient funds
      </text>
      
      <text x="50%" y="550" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#666">
        Please visit stability.ai to add funds to your account
      </text>
      
      <text x="50%" y="580" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#666">
        or try using a different image generation service
      </text>
    </svg>
  `;
  
  // Convert SVG to Base64
  const base64Svg = Buffer.from(svgContent).toString('base64');
  return `data:image/svg+xml;base64,${base64Svg}`;
}