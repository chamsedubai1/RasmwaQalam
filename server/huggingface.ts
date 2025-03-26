import { HfInference } from '@huggingface/inference';

// Initialize the Hugging Face Inference client
// Note: This will work with public models that don't require authentication
// For models requiring authentication, you would need to add an API key here
const hf = new HfInference();

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
    throw new Error('Failed to generate text. Please try again later.');
  }
}

/**
 * Generates an image using Hugging Face Stable Diffusion model
 * @param prompt The prompt for image generation
 * @returns URL to the generated image (base64 data URL)
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    const response = await hf.textToImage({
      model: IMAGE_GENERATION_MODEL,
      inputs: prompt,
      parameters: {
        negative_prompt: 'blurry, bad quality, low resolution, ugly, disfigured',
      }
    });

    // Convert the blob to base64
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error generating image with Hugging Face:', error);
    throw new Error('Failed to generate image. Please try again later.');
  }
}