import Anthropic from '@anthropic-ai/sdk';

// Create Anthropic client
// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generates a poem based on the given prompt using Claude AI
 * @param prompt User's prompt for the poem
 * @param style Optional style for the poem (e.g., "haiku", "sonnet")
 * @returns Generated poem text
 * @throws Error if generation fails and no fallback is available
 */
export async function generatePoem(prompt: string, style?: string): Promise<string> {
  try {
    // Build a complete prompt including the style if specified
    const completePrompt = style
      ? `Write a ${style} based on the following prompt: "${prompt}"`
      : `Write a poem based on the following prompt: "${prompt}"`;
      
    const systemPrompt = "You are a creative poetry AI assistant. Create beautiful, thoughtful poems based on the user's prompts. Format your output nicely with line breaks.";

    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: completePrompt }],
    });

    // Claude's response is in the content field
    // Claude 3 type checking workaround
    return response.content[0]?.type === 'text' ? response.content[0].text : String(response.content[0]);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Claude AI poem generation error:", errorMessage);

    // Generate a simple fallback poem if Claude fails
    return generateFallbackPoem(prompt, style);
  }
}

/**
 * Generates a simple poem without using external APIs
 * This is used as a fallback when API keys are not available or service fails
 */
function generateFallbackPoem(prompt: string, style?: string): string {
  // Create a basic poem structure
  let poem = "";
  
  if (style === "haiku") {
    poem = `Thoughts about ${prompt}\nInspire creativity\nWords flow like water`;
  } else if (style === "sonnet") {
    poem = `A sonnet about ${prompt} I write,\n`;
    poem += `With flowing words that dance in the light.\n`;
    poem += `Fourteen lines I craft with great care,\n`;
    poem += `Expressing thoughts beyond compare.\n\n`;
    poem += `The rhythm flows in a structured way,\n`;
    poem += `Like ocean waves at the break of day.\n`;
    poem += `Ideas build as the lines progress,\n`;
    poem += `Revealing truths I must express.\n\n`;
    poem += `And as I reach the final rhyme,\n`;
    poem += `Reflection comes with passing time.\n`;
    poem += `The beauty found in ${prompt} so clear,\n`;
    poem += `Creates emotions that draw you near,\n`;
    poem += `Until the closing couplet's view,\n`;
    poem += `Leaves lasting thoughts for me and you.`;
  } else if (style === "limerick") {
    poem = `There once was a tale of ${prompt},\n`;
    poem += `That sparked imagination to romp.\n`;
    poem += `With rhythm and rhyme,\n`;
    poem += `It passed through time,\n`;
    poem += `Until we were left with a tromp.`;
  } else {
    // Free verse fallback
    poem = `Reflections on ${prompt}\n\n`;
    poem += `Words cascade like gentle rain,\n`;
    poem += `Thoughts intertwine and dance,\n`;
    poem += `Creating patterns of meaning\n`;
    poem += `That speak to something deeper.\n\n`;
    poem += `We search for understanding\n`;
    poem += `In the spaces between moments,\n`;
    poem += `Finding beauty in the unexpected,\n`;
    poem += `And wisdom in simplicity.`;
  }
  
  return poem;
}

/**
 * Enhances a prompt for image generation
 * @param prompt User's basic prompt
 * @returns Enhanced prompt with more detail
 */
export async function enhanceImagePrompt(prompt: string): Promise<string> {
  try {
    const systemPrompt = "You are an expert at creating detailed, vivid image descriptions for AI image generators used by school students. Enhance the user's prompt in a way that is always appropriate for all ages and school settings. IMPORTANT: Keep vocabulary simple and never include terms that might trigger content filters (avoid terms related to violence, weapons, blood, mature themes, etc). Your enhanced prompts should be artistic, educational, and completely safe for children. Keep your response concise (80 words max) and focused only on the enhanced prompt text without any explanations.";
    
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ 
        role: 'user', 
        content: `Please enhance this simple image prompt for a school art project: "${prompt}". Keep it child-appropriate and avoid any terms that might trigger content filters. Remember to output only the enhanced prompt text without any explanations.`
      }],
    });

    // Claude 3 type checking workaround
    return response.content[0]?.type === 'text' ? response.content[0].text.trim() : String(response.content[0]).trim();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Claude AI prompt enhancement error:", errorMessage);
    // If enhancement fails, return the original prompt
    return prompt;
  }
}

/**
 * Analyzes text content for moderation
 * @param text Content to moderate
 * @returns Object with moderation results
 */
export async function moderateContent(text: string): Promise<{
  isSafe: boolean;
  category?: string;
  reason?: string;
}> {
  try {
    const systemPrompt = "You are a content moderation system. Your job is to analyze the content and determine if it contains inappropriate material such as: violence, hate speech, sexual content, harassment, self-harm, illegal activities, or private information. Respond in JSON format with keys 'isSafe' (boolean), 'category' (string, only if not safe), and 'reason' (string, brief explanation only if not safe).";
    
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Analyze this content for moderation: "${text}"` }],
    });

    // Extract and parse the JSON from Claude's response
    const rawResponse = response.content[0]?.type === 'text' ? response.content[0].text : String(response.content[0]);
    // Use a simple regex match that works in ES2017
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const moderationResult = JSON.parse(jsonMatch[0]);
      return {
        isSafe: moderationResult.isSafe,
        category: moderationResult.category,
        reason: moderationResult.reason
      };
    }
    
    // Fallback if JSON parsing fails
    return { isSafe: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Content moderation error:", errorMessage);
    // Default to safe if moderation fails
    return { isSafe: true };
  }
}