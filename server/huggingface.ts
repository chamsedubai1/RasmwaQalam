import { HfInference } from '@huggingface/inference';

// Initialize the Hugging Face Inference client
// Try to use API key if available, otherwise use public inference (limited capabilities)
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY || '';
const hf = new HfInference(HUGGING_FACE_API_KEY);

// Flag to check if we're using the API key
const hasApiKey = !!HUGGING_FACE_API_KEY;

// Fallback models (free and open-source)
const TEXT_GENERATION_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
const IMAGE_GENERATION_MODEL = 'stabilityai/stable-diffusion-2';

/**
 * Generates text using a Hugging Face text generation model
 * @param prompt The prompt for text generation
 * @param style Optional style parameter (haiku, sonnet, etc.)
 * @returns Generated text content
 */
export async function generateText(prompt: string, style?: string): Promise<string> {
  try {
    // If no API key, generate a basic poem without using Hugging Face API
    if (!hasApiKey) {
      return generateFallbackPoem(prompt, style);
    }
    
    let fullPrompt = prompt;
    
    if (style) {
      switch (style.toLowerCase()) {
        case 'haiku':
          fullPrompt = `Write a haiku about: ${prompt}`;
          break;
        case 'sonnet':
          fullPrompt = `Write a sonnet about: ${prompt}`;
          break;
        case 'limerick':
          fullPrompt = `Write a limerick about: ${prompt}`;
          break;
        default:
          fullPrompt = `Write a poem about: ${prompt}`;
      }
    } else {
      fullPrompt = `Write a poem about: ${prompt}`;
    }

    const response = await hf.textGeneration({
      model: TEXT_GENERATION_MODEL,
      inputs: fullPrompt,
      parameters: {
        max_new_tokens: 250,
        temperature: 0.7,
        top_p: 0.95,
        repetition_penalty: 1.1
      }
    });

    return response.generated_text || 'Could not generate text.';
  } catch (error) {
    console.error('Error generating text with Hugging Face:', error);
    // Fall back to basic poem generation if API fails
    return generateFallbackPoem(prompt, style);
  }
}

/**
 * Generates a simple poem without using external APIs
 * This is used as a fallback when API keys are not available
 */
function generateFallbackPoem(prompt: string, style?: string): string {
  const promptWords = prompt.split(/\s+/).filter(word => word.length > 3);
  let poem = '';
  
  // Generate different poem types based on style
  if (style === 'haiku') {
    poem = `Nature's beauty calls\n`;
    poem += `${promptWords[0] || 'Gentle'} ${promptWords[1] || 'whispers'} in the breeze\n`;
    poem += `${promptWords[2] || 'Dreams'} bloom like flowers\n`;
  } 
  else if (style === 'limerick') {
    poem = `There once was a ${promptWords[0] || 'tale'} of ${promptWords[1] || 'delight'}\n`;
    poem += `That gave everyone such a fright\n`;
    poem += `    But with ${promptWords[2] || 'courage'} and care\n`;
    poem += `    And ${promptWords[0] || 'wisdom'} to spare\n`;
    poem += `The ${promptWords[1] || 'story'} turned out just right\n`;
  }
  else if (style === 'sonnet') {
    poem = `When ${promptWords[0] || 'thoughts'} of ${promptWords[1] || 'wonder'} fill my mind\n`;
    poem += `And ${promptWords[2] || 'dreams'} of ${promptWords[0] || 'beauty'} touch my heart\n`;
    poem += `I find within these words so kind\n`;
    poem += `A world where joy will never part\n\n`;
    poem += `The ${promptWords[1] || 'gentle'} ${promptWords[2] || 'breeze'} upon my face\n`;
    poem += `Reminds me of your tender grace\n`;
  }
  else {
    // Default free verse poem
    poem = `The ${promptWords[0] || 'journey'} begins\n`;
    poem += `With ${promptWords[1] || 'hope'} in our hearts\n`;
    poem += `And ${promptWords[2] || 'dreams'} in our minds\n\n`;
    poem += `We explore the ${promptWords[0] || 'path'} together\n`;
    poem += `Finding ${promptWords[1] || 'meaning'} in each moment\n`;
    poem += `Creating ${promptWords[2] || 'memories'} that last forever\n`;
  }
  
  return `(Offline mode poem about "${prompt}"):\n\n${poem}`;
}

/**
 * Generates an image using Hugging Face Stable Diffusion model
 * @param prompt The prompt for image generation
 * @returns URL to the generated image (base64 data URL)
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    // If no API key, generate a placeholder SVG image
    if (!hasApiKey) {
      return generatePlaceholderImage(prompt);
    }
    
    const response = await hf.textToImage({
      model: IMAGE_GENERATION_MODEL,
      inputs: prompt,
      parameters: {
        negative_prompt: 'blurry, bad quality, low resolution, ugly, disfigured',
      }
    });

    // The response is already a blob
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error generating image with Hugging Face:', error);
    // Fall back to placeholder image if API fails
    return generatePlaceholderImage(prompt);
  }
}

/**
 * Generates a placeholder SVG image with the prompt text
 * This is used as a fallback when API keys are not available
 */
function generatePlaceholderImage(prompt: string): string {
  // Use the first few words of the prompt for the image
  const shortPrompt = prompt.split(' ').slice(0, 3).join(' ');
  
  // Get random pastel colors for background
  const hue = Math.floor(Math.random() * 360);
  const bgColor = `hsl(${hue}, 70%, 80%)`;
  const textColor = `hsl(${hue}, 80%, 30%)`;
  
  // Create an SVG with the prompt text
  const svgContent = `
  <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${bgColor}"/>
    <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="${textColor}">Placeholder Image</text>
    <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="${textColor}">"${shortPrompt}..."</text>
    <text x="50%" y="75%" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="${textColor}">(No API key available)</text>
  </svg>
  `;
  
  // Convert SVG to base64
  const base64 = Buffer.from(svgContent).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}