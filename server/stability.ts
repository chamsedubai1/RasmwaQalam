// Import functions, types from stability-client
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';
import { Readable } from 'stream';

/**
 * A simpler, direct implementation of Stability.ai image generation
 * @param prompt User's prompt for the image generation
 * @returns Base64 data URL of the generated image
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    // Check API key
    if (!process.env.STABILITY_API_KEY) {
      throw new Error('STABILITY_API_KEY environment variable is not set');
    }

    console.log(`Starting stability.ai image generation for prompt: "${prompt.substring(0, 50)}..."`);
    
    // Direct API call to Stability.ai
    const engineId = 'stable-diffusion-xl-1024-v1-0';
    const response = await fetch(
      `https://api.stability.ai/v1/generation/${engineId}/text-to-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt }],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 30,
        }),
      }
    );
    
    // Check for API errors
    if (!response.ok) {
      let errorMessage;
      try {
        const errorJson = await response.json() as any;
        errorMessage = errorJson?.message || `Status: ${response.status} ${response.statusText}`;
      } catch (e) {
        errorMessage = await response.text();
      }
      
      console.error(`Stability API error: ${errorMessage}`);
      
      // Check for insufficient balance
      if (errorMessage.includes('not have enough balance')) {
        return generatePlaceholderImage(
          prompt + "\n\nNote: Image couldn't be generated with Stability.ai due to insufficient account balance."
        );
      }
      
      return generatePlaceholderImage(
        prompt + "\n\nNote: Stability.ai API error: " + errorMessage
      );
    }
    
    // Parse the successful response
    const result = await response.json() as any;
    
    if (!result || !result.artifacts || !Array.isArray(result.artifacts) || result.artifacts.length === 0) {
      console.error('No artifacts found in stability.ai response');
      return generatePlaceholderImage(
        prompt + "\n\nNote: No images were generated. The API returned an empty result."
      );
    }
    
    // Get the first artifact with a valid base64 image
    for (const artifact of result.artifacts) {
      if (artifact && typeof artifact.base64 === 'string') {
        console.log(`Successfully generated image with seed ${artifact.seed || 'unknown'}`);
        return `data:image/png;base64,${artifact.base64}`;
      }
    }
    
    // If we reached here, we didn't find a valid image
    console.error('No valid base64 image found in stability.ai response');
    return generatePlaceholderImage(
      prompt + "\n\nNote: Image generation completed but no valid image data was found."
    );
    
  } catch (error: any) {
    console.error('Error generating image with Stability.ai:', error);
    return generatePlaceholderImage(
      prompt + "\n\nNote: Error during image generation: " + (error instanceof Error ? error.message : String(error))
    );
  }
}

/**
 * Fallback function to generate a placeholder image
 * @param prompt The original prompt with additional error info
 * @returns SVG image as data URL
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
        Image Generation Error
      </text>
      
      <text x="50%" y="550" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#666">
        Please try using a different image generation service
      </text>
      
      <text x="50%" y="580" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#666">
        or try again with a different prompt
      </text>
    </svg>
  `;
  
  // Convert SVG to Base64
  const base64Svg = Buffer.from(svgContent).toString('base64');
  return `data:image/svg+xml;base64,${base64Svg}`;
}