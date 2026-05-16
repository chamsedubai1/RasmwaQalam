/**
 * Qwen AI Service Integration
 *
 * Integrates Qwen2.5-VL (Vision-Language Model) for:
 * - Image generation from text prompts
 * - Image understanding/analysis (vision capabilities)
 * - Text generation with visual context
 *
 * Model: Qwen2.5-VL (Apache-2.0 License)
 * API: Uses Hugging Face Inference API or local deployment
 */

import fetch from 'node-fetch';

// Qwen model configuration
const QWEN_CONFIG = {
  // Qwen2.5-VL models available on Hugging Face
  VISION_MODEL: 'Qwen/Qwen2.5-VL-7B-Instruct',
  TEXT_MODEL: 'Qwen/Qwen2.5-7B-Instruct',
  IMAGE_GEN_MODEL: 'Qwen/Qwen2.5-VL-7B-Instruct', // For image generation tasks

  // API endpoints - supports both Hugging Face and custom deployment
  HF_API_BASE: 'https://api-inference.huggingface.co/models',
  CUSTOM_API_BASE: process.env.QWEN_API_BASE || '',

  // Generation parameters
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
  TOP_P: 0.9,
};

/**
 * Get the appropriate API key and endpoint
 */
function getApiConfig(): { apiKey: string; baseUrl: string; useCustom: boolean } {
  const customApiKey = process.env.QWEN_API_KEY;
  const customBaseUrl = process.env.QWEN_API_BASE;
  const hfApiKey = process.env.HUGGING_FACE_API_KEY;

  // Prefer custom Qwen deployment if available
  if (customApiKey && customBaseUrl) {
    return {
      apiKey: customApiKey,
      baseUrl: customBaseUrl,
      useCustom: true
    };
  }

  // Fall back to Hugging Face inference
  return {
    apiKey: hfApiKey || '',
    baseUrl: QWEN_CONFIG.HF_API_BASE,
    useCustom: false
  };
}

/**
 * Check if Qwen service is available
 */
export function isQwenAvailable(): boolean {
  const config = getApiConfig();
  return !!config.apiKey;
}

/**
 * Generate text using Qwen model
 *
 * @param prompt - The user prompt
 * @param style - Optional style for text generation
 * @returns Generated text content
 */
export async function generateText(prompt: string, style?: string): Promise<string> {
  const config = getApiConfig();

  if (!config.apiKey) {
    console.warn('[QWEN] No API key available, using fallback');
    return generateFallbackText(prompt, style);
  }

  try {
    const systemPrompt = style
      ? `You are a creative writing assistant. Generate content in the style of: ${style}. Keep the content appropriate for school students.`
      : 'You are a creative writing assistant. Generate beautiful, thoughtful content appropriate for school students.';

    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}\n\nResponse:`;

    if (config.useCustom) {
      // Custom Qwen deployment (OpenAI-compatible API)
      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: QWEN_CONFIG.TEXT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: QWEN_CONFIG.MAX_TOKENS,
          temperature: QWEN_CONFIG.TEMPERATURE,
          top_p: QWEN_CONFIG.TOP_P,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[QWEN] Custom API error:', errorText);
        throw new Error(`Qwen API error: ${response.status}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || generateFallbackText(prompt, style);

    } else {
      // Hugging Face Inference API
      const response = await fetch(`${config.baseUrl}/${QWEN_CONFIG.TEXT_MODEL}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: QWEN_CONFIG.MAX_TOKENS,
            temperature: QWEN_CONFIG.TEMPERATURE,
            top_p: QWEN_CONFIG.TOP_P,
            return_full_text: false,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[QWEN] Hugging Face API error:', errorText);

        if (response.status === 503) {
          // Model is loading
          throw new Error('MODEL_LOADING');
        }
        throw new Error(`Hugging Face API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const generatedText = Array.isArray(data)
        ? data[0]?.generated_text
        : data.generated_text;

      return generatedText || generateFallbackText(prompt, style);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[QWEN] Text generation error:', err.message);

    if (err.message === 'MODEL_LOADING') {
      throw new Error('The Qwen model is currently loading. Please try again in a moment.');
    }

    return generateFallbackText(prompt, style);
  }
}

/**
 * Generate a poem using Qwen model
 *
 * @param prompt - The poem topic/theme
 * @param style - Style of poem (haiku, sonnet, limerick, free verse)
 * @returns Generated poem
 */
export async function generatePoem(prompt: string, style?: string): Promise<string> {
  const poemPrompt = style
    ? `Write a ${style} about: ${prompt}. Make it creative, meaningful, and appropriate for school students.`
    : `Write a beautiful poem about: ${prompt}. Make it creative, meaningful, and appropriate for school students.`;

  return generateText(poemPrompt, 'poetry');
}

/**
 * Analyze an image using Qwen2.5-VL vision capabilities
 *
 * @param imageUrl - URL of the image to analyze
 * @param prompt - Optional prompt for specific analysis
 * @returns Analysis of the image
 */
export async function analyzeImage(imageUrl: string, prompt?: string): Promise<{
  description: string;
  tags: string[];
  isSafe: boolean;
  safetyReason?: string;
}> {
  const config = getApiConfig();

  if (!config.apiKey) {
    console.warn('[QWEN] No API key available for image analysis');
    return {
      description: 'Image analysis unavailable',
      tags: [],
      isSafe: true, // Default to safe when analysis unavailable
    };
  }

  try {
    const analysisPrompt = prompt ||
      `Analyze this image and provide:
      1. A detailed description suitable for an art education platform
      2. Key visual elements and artistic techniques
      3. Whether this image is appropriate for school students (ages 6-18)

      Format your response as JSON with keys: description, tags (array), isSafe (boolean), safetyReason (string, only if not safe)`;

    if (config.useCustom) {
      // Custom Qwen deployment with vision
      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: QWEN_CONFIG.VISION_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: analysisPrompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ],
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[QWEN] Vision API error:', errorText);
        throw new Error(`Qwen Vision API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';

      // Parse JSON response
      return parseImageAnalysis(content);

    } else {
      // Hugging Face doesn't directly support Qwen2.5-VL vision via inference API
      // Return a placeholder response
      console.warn('[QWEN] Vision analysis requires custom deployment');
      return {
        description: 'Advanced image analysis requires Qwen custom deployment',
        tags: ['image'],
        isSafe: true,
      };
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[QWEN] Image analysis error:', err.message);

    return {
      description: 'Unable to analyze image',
      tags: [],
      isSafe: true,
    };
  }
}

/**
 * Parse image analysis response from Qwen
 */
function parseImageAnalysis(content: string): {
  description: string;
  tags: string[];
  isSafe: boolean;
  safetyReason?: string;
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        description: parsed.description || 'No description available',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        isSafe: parsed.isSafe !== false,
        safetyReason: parsed.safetyReason,
      };
    }
  } catch (e) {
    // JSON parsing failed, extract information manually
  }

  // Fallback: use the content as description
  return {
    description: content.slice(0, 500),
    tags: [],
    isSafe: true,
  };
}

/**
 * Generate an image using Qwen-compatible image generation
 * Note: Qwen2.5-VL is primarily a vision-language model, not an image generator.
 * For image generation, we integrate with compatible services or use the model
 * to enhance prompts for other generators.
 *
 * @param prompt - Text prompt for image generation
 * @returns URL of generated image or base64 data
 */
export async function generateImage(prompt: string): Promise<string> {
  const config = getApiConfig();

  if (!config.apiKey) {
    console.warn('[QWEN] No API key available, returning placeholder');
    return generatePlaceholderImage(prompt);
  }

  try {
    // First, use Qwen to enhance the prompt for better image generation
    const enhancedPrompt = await enhanceImagePrompt(prompt);

    if (config.useCustom && process.env.QWEN_IMAGE_ENDPOINT) {
      // Custom image generation endpoint
      const response = await fetch(process.env.QWEN_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          size: '1024x1024',
          quality: 'standard',
        }),
      });

      if (!response.ok) {
        throw new Error(`Image generation error: ${response.status}`);
      }

      const data = await response.json() as any;
      return data.url || data.image || generatePlaceholderImage(prompt);

    } else {
      // Use Hugging Face Stable Diffusion as fallback with enhanced prompt
      const response = await fetch(`${config.baseUrl}/stabilityai/stable-diffusion-2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: enhancedPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`Image generation error: ${response.status}`);
      }

      // Response is binary image data
      const buffer = await response.buffer();
      const base64 = buffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[QWEN] Image generation error:', err.message);
    return generatePlaceholderImage(prompt);
  }
}

/**
 * Enhance an image prompt using Qwen's language capabilities
 *
 * @param prompt - Original user prompt
 * @returns Enhanced, detailed prompt for image generation
 */
export async function enhanceImagePrompt(prompt: string): Promise<string> {
  const config = getApiConfig();

  if (!config.apiKey) {
    return prompt;
  }

  try {
    const enhanceRequest = `You are an expert at creating detailed, vivid image descriptions for AI image generators.
    The images will be used by school students, so keep descriptions:
    - Appropriate for all ages
    - Artistic and educational
    - Free from any violent, scary, or inappropriate elements

    Original prompt: "${prompt}"

    Create an enhanced, detailed description (max 100 words) that will produce a beautiful, school-appropriate image.
    Output only the enhanced prompt, nothing else.`;

    const enhanced = await generateText(enhanceRequest, 'prompt enhancement');

    // Clean up the response
    return enhanced.trim().slice(0, 500) || prompt;
  } catch (error) {
    console.error('[QWEN] Prompt enhancement failed:', error);
    return prompt;
  }
}

/**
 * Moderate content using Qwen's understanding capabilities
 *
 * @param text - Content to moderate
 * @returns Moderation result
 */
export async function moderateContent(text: string): Promise<{
  isSafe: boolean;
  category?: string;
  reason?: string;
}> {
  const config = getApiConfig();

  if (!config.apiKey) {
    // When Qwen is unavailable, defer to other moderation (Anthropic)
    return { isSafe: true };
  }

  try {
    const moderationPrompt = `Analyze this content for appropriateness in a school art platform for students ages 6-18.

Content: "${text}"

Check for:
- Violence or harmful content
- Sexual or adult content
- Hate speech or discrimination
- Bullying or harassment
- Self-harm references
- Illegal activities
- Personal information exposure

Respond in JSON format:
{
  "isSafe": boolean,
  "category": "category if unsafe",
  "reason": "brief explanation if unsafe"
}

Only output the JSON, nothing else.`;

    const response = await generateText(moderationPrompt, 'content moderation');

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          isSafe: result.isSafe !== false,
          category: result.category,
          reason: result.reason,
        };
      }
    } catch (e) {
      // Parsing failed, assume safe
    }

    return { isSafe: true };
  } catch (error) {
    console.error('[QWEN] Content moderation error:', error);
    return { isSafe: true };
  }
}

/**
 * Generate creative writing feedback using Qwen
 * Useful for giving students feedback on their poetry submissions
 *
 * @param content - Student's creative writing
 * @param type - Type of content (poem, story, etc.)
 * @returns Constructive feedback
 */
export async function generateCreativeFeedback(content: string, type: string = 'poem'): Promise<{
  feedback: string;
  strengths: string[];
  suggestions: string[];
  rating: number; // 1-5 stars
}> {
  const config = getApiConfig();

  if (!config.apiKey) {
    return {
      feedback: 'Feedback service is currently unavailable.',
      strengths: [],
      suggestions: [],
      rating: 3,
    };
  }

  try {
    const feedbackPrompt = `You are a supportive creative writing teacher for students ages 6-18.

Analyze this ${type} and provide constructive, encouraging feedback:

"${content}"

Respond in JSON format:
{
  "feedback": "2-3 sentences of overall encouraging feedback",
  "strengths": ["strength 1", "strength 2"],
  "suggestions": ["gentle suggestion 1", "gentle suggestion 2"],
  "rating": number from 1-5
}

Be kind, supportive, and age-appropriate. Focus on what the student did well.`;

    const response = await generateText(feedbackPrompt, 'educational feedback');

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          feedback: result.feedback || 'Great creative work!',
          strengths: Array.isArray(result.strengths) ? result.strengths : [],
          suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
          rating: Math.min(5, Math.max(1, Number(result.rating) || 3)),
        };
      }
    } catch (e) {
      // Parsing failed
    }

    return {
      feedback: 'Wonderful creative expression! Keep writing!',
      strengths: ['Creative ideas', 'Good effort'],
      suggestions: ['Keep practicing'],
      rating: 4,
    };
  } catch (error) {
    console.error('[QWEN] Feedback generation error:', error);
    return {
      feedback: 'Feedback service encountered an error.',
      strengths: [],
      suggestions: [],
      rating: 3,
    };
  }
}

/**
 * Fallback text generation when API is unavailable
 */
function generateFallbackText(prompt: string, style?: string): string {
  const topic = prompt.slice(0, 50);

  if (style === 'haiku' || prompt.toLowerCase().includes('haiku')) {
    return `Words about ${topic}\nDance like autumn leaves falling\nBeauty in each line`;
  }

  if (style === 'poetry' || prompt.toLowerCase().includes('poem')) {
    return `Reflections on ${topic}\n\n` +
      `In the realm of imagination,\n` +
      `Where creativity takes flight,\n` +
      `We explore the wonders of art,\n` +
      `And bring our visions to light.\n\n` +
      `Each word a brushstroke of thought,\n` +
      `Each line a path to explore,\n` +
      `The beauty of expression\n` +
      `Opens every door.`;
  }

  return `Here is a creative response about ${topic}:\n\n` +
    `Art and creativity help us express our thoughts and feelings in unique ways. ` +
    `Through writing, drawing, and imagination, we can share our perspectives with the world. ` +
    `Every creative work is a reflection of the artist's heart and mind.`;
}

/**
 * Generate a placeholder SVG image
 */
function generatePlaceholderImage(prompt: string): string {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const shortPrompt = prompt.slice(0, 30).replace(/[<>&"']/g, '');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.8" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#grad)"/>
      <text x="256" y="240" font-family="Arial, sans-serif" font-size="18"
            fill="#333" text-anchor="middle" font-weight="bold">
        Qwen AI Art
      </text>
      <text x="256" y="280" font-family="Arial, sans-serif" font-size="14"
            fill="#666" text-anchor="middle">
        ${shortPrompt}...
      </text>
      <circle cx="256" cy="350" r="40" fill="none" stroke="#333" stroke-width="2"/>
      <path d="M240 350 L256 335 L272 350 L256 380 Z" fill="#333"/>
    </svg>
  `;

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// Export service info
export const QWEN_SERVICE_INFO = {
  name: 'Qwen',
  version: '2.5-VL',
  license: 'Apache-2.0',
  capabilities: [
    'text_generation',
    'poem_generation',
    'image_analysis',
    'image_generation',
    'content_moderation',
    'creative_feedback',
    'prompt_enhancement'
  ],
  models: QWEN_CONFIG,
};
