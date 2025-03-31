// Script to generate a new mission image for the About page using Hugging Face
import { HfInference } from '@huggingface/inference';
import * as fs from 'fs';
import * as path from 'path';

// Initialize the Hugging Face Inference client
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY || '';
const hf = new HfInference(HUGGING_FACE_API_KEY);

// Image generation model
const IMAGE_GENERATION_MODEL = 'stabilityai/stable-diffusion-2';

async function saveMissionImage() {
  try {
    const prompt = "A vibrant, inspiring digital illustration showing diverse students collaboratively using AI art tools. The image should depict teenagers from different backgrounds gathered around tablets and screens displaying AI-generated art in progress. The composition should communicate empowerment, creativity, innovation, and friendly competition in a modern, high-tech educational environment. The style should be colorful, optimistic, and suitable for a school art program.";
    
    console.log("Generating mission image using Hugging Face API...");
    
    const response = await hf.textToImage({
      model: IMAGE_GENERATION_MODEL,
      inputs: prompt,
      parameters: {
        negative_prompt: 'blurry, bad quality, low resolution, ugly, disfigured',
      }
    });

    // The response is a blob
    const buffer = await response.arrayBuffer();
    
    // Define the output file path
    const outputPath = path.resolve('./client/src/assets/mission-image.jpg');
    
    // Save the image to file
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    
    console.log(`Mission image saved to: ${outputPath}`);
    console.log("Please update the About page to use this new image.");
  } catch (error) {
    console.error("Error generating mission image:", error);
  }
}

saveMissionImage();