import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates a poem based on the given prompt
 * @param prompt User's prompt for the poem
 * @param style Optional style for the poem (e.g., "haiku", "sonnet")
 * @returns Generated poem text
 * @throws Error if generation fails and no fallback is available
 */
export async function generatePoem(prompt: string, style?: string): Promise<string> {
  try {
    const styleText = style ? `in the style of a ${style}` : '';
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a skilled poet specializing in creating beautiful, meaningful poetry for students. 
          Create evocative, age-appropriate poems that convey emotion and imagery.
          Never include any inappropriate or adult content.`
        },
        {
          role: "user",
          content: `Write a poem about "${prompt}" ${styleText}. The poem should be suitable for a student art competition.`
        }
      ],
      max_tokens: 500,
    });
    
    return response.choices[0].message.content || "Sorry, I couldn't generate a poem at this time.";
  } catch (error: any) {
    console.error("Error generating poem:", error);
    
    // Check for quota/rate limit errors to provide specific error for front-end handling
    if (error?.code === 'insufficient_quota' || error?.code === 'rate_limit_exceeded') {
      throw new Error("QUOTA_EXCEEDED");
    }
    
    throw new Error("Failed to generate poem. Please try again later.");
  }
}

/**
 * Generates an image description for DALL-E based on the given prompt
 * @param prompt User's prompt for the image
 * @returns Enhanced image description
 */
async function generateImageDescription(prompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an art description specialist who creates detailed 
          prompts for DALL-E to generate beautiful, school-appropriate artwork. 
          Your descriptions should be vivid, detailed, and suitable for students.`
        },
        {
          role: "user",
          content: `Create a detailed image description based on this idea: "${prompt}".
          The description should be suitable for generating an image for a student art competition.
          Be concrete and specific about the visual elements, composition, lighting, and style.
          Never include any inappropriate or adult content.`
        }
      ],
      max_tokens: 300,
    });
    
    return response.choices[0].message.content || prompt;
  } catch (error) {
    console.error("Error generating image description:", error);
    // Fall back to the original prompt if enhancement fails
    return prompt;
  }
}

/**
 * Generates an image based on the given prompt
 * @param prompt User's prompt for the image
 * @returns URL of the generated image
 * @throws Error if generation fails and no fallback is available
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    // Enhance the prompt with more details for better image generation
    const enhancedPrompt = await generateImageDescription(prompt);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    
    return response.data[0].url || "";
  } catch (error: any) {
    console.error("Error generating image:", error);
    
    // Check for quota/rate limit errors to provide specific error for front-end handling
    if (error?.code === 'insufficient_quota' || error?.code === 'rate_limit_exceeded') {
      throw new Error("QUOTA_EXCEEDED");
    }
    
    throw new Error("Failed to generate image. Please try again later.");
  }
}