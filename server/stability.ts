import * as stabilityClient from 'stability-client';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Direct reference to the generate function
const stabilityGenerate = stabilityClient.generate;

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
      const generation = stabilityGenerate(stabilityOptions);
      
      // Handle image generation events
      generation.on('image', (result) => {
        console.log(`Stability AI generated image with seed ${result.seed}`);
        imageData = result.buffer;
      });
      
      // Handle completion or error
      generation.on('end', (result) => {
        if (!result.isOk) {
          console.error(`Stability AI generation failed: ${result.message}`);
          return reject(new Error(`Image generation failed: ${result.message}`));
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
  // Simple SVG placeholder with the prompt text
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="#f0f0f0" />
      <text x="50%" y="50%" font-family="Arial" font-size="24" text-anchor="middle" fill="#666">
        ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}
      </text>
      <text x="50%" y="60%" font-family="Arial" font-size="18" text-anchor="middle" fill="#999">
        (Image generation failed)
      </text>
    </svg>
  `;
  
  // Convert SVG to Base64
  const base64Svg = Buffer.from(svgContent).toString('base64');
  return `data:image/svg+xml;base64,${base64Svg}`;
}