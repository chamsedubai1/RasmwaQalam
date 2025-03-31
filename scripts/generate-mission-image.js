// Script to generate a new mission image for the About page
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateImage } from '../server/openai.js';

dotenv.config();

async function generateMissionImage() {
  try {
    const prompt = "A vibrant, inspiring digital illustration showing diverse students collaboratively using AI art tools. The image should depict teenagers from different backgrounds gathered around tablets and screens displaying AI-generated art in progress. Show neural network visualizations, digital brushes, and creative sparks flowing between the students and devices. The composition should communicate empowerment, creativity, innovation, and friendly competition in a modern, high-tech educational environment. The style should be colorful, optimistic, and suitable for a school art program.";
    
    console.log("Generating mission image...");
    const imageUrl = await generateImage(prompt);
    
    console.log("Image generated successfully. URL:", imageUrl);
    console.log("Use this URL to download the image and save it to client/src/assets/mission-image.jpg");
  } catch (error) {
    console.error("Error generating mission image:", error);
  }
}

generateMissionImage();