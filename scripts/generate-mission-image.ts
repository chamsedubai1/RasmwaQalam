// Script to generate a new mission image for the About page
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function enhancePrompt(prompt: string): Promise<string> {
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

async function generateMissionImage() {
  try {
    const basePrompt = "Art was created to empower students to explore their creativity using cutting-edge AI tools while building a competitive and collaborative environment for artistic expression.";
    
    const enhancedPrompt = await enhancePrompt(basePrompt);
    console.log("Enhanced prompt:", enhancedPrompt);
    
    console.log("Generating mission image...");
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    
    const imageUrl = response.data[0].url;
    console.log("Image generated successfully. URL:", imageUrl);
    console.log("Use this URL to download the image and replace it in the About page");
  } catch (error) {
    console.error("Error generating mission image:", error);
  }
}

generateMissionImage();