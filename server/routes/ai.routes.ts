import { Router, Request, Response } from "express";
import * as anthropic from "../anthropic";
import { generateText as generateHuggingFaceText, generateImage as generateHuggingFaceImage } from "../huggingface";
import { generateImage as generateStabilityImage } from "../stability";
import * as qwen from "../qwen";
import { AI_SERVICE, DEFAULT_TEXT_SERVICE, DEFAULT_IMAGE_SERVICE } from "./types";
import { authenticateToken, apiRateLimiter } from "../security";
import { createAuditLog, AuditAction, AuditSeverity } from "../audit-log";

const router = Router();

// Apply rate limiting to AI endpoints (expensive operations)
router.use(apiRateLimiter);

// Generate poem using AI - authenticated users only
// SECURITY: Content moderation is MANDATORY for student safety
router.post('/generate-poem', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { prompt, style, service } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // SECURITY: Content moderation is REQUIRED - fail closed if not available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[SECURITY] AI poem generation blocked: Content moderation unavailable (ANTHROPIC_API_KEY not set)');
      return res.status(503).json({
        message: 'AI poem generation is temporarily unavailable. Content moderation service is required for student safety.',
        code: 'MODERATION_UNAVAILABLE'
      });
    }

    // SECURITY: Mandatory content safety check for student protection
    console.log("[MODERATION] Checking poem prompt for inappropriate content");
    const moderationResult = await anthropic.moderateContent(prompt);
    if (!moderationResult.isSafe) {
      console.warn(`[SECURITY] Poem prompt moderation BLOCKED: ${moderationResult.category} - ${moderationResult.reason}`);
      return res.status(400).json({
        message: 'Your prompt cannot be used because it contains inappropriate content. Please try a different prompt.',
        code: 'CONTENT_BLOCKED',
        category: moderationResult.category
      });
    }
    console.log("[MODERATION] Poem prompt approved for generation");

    let aiService = service || DEFAULT_TEXT_SERVICE;
    let poem;
    let usedFallback = false;

    try {
      switch (aiService) {
        case AI_SERVICE.HUGGING_FACE:
          poem = await generateHuggingFaceText(prompt, style);
          break;
        case AI_SERVICE.CLAUDE:
          poem = await anthropic.generatePoem(prompt, style);
          break;
        case AI_SERVICE.QWEN:
          console.log("[QWEN] Using Qwen2.5 for poem generation");
          poem = await qwen.generatePoem(prompt, style);
          break;
        default:
          poem = await generateHuggingFaceText(prompt, style);
      }
    } catch (serviceError: unknown) {
      const error = serviceError as Error;
      if (error.message === "QUOTA_EXCEEDED" || error.message === "MODEL_LOADING") {
        console.log(`${aiService} unavailable, falling back to Hugging Face`);
        poem = await generateHuggingFaceText(prompt, style);
        aiService = AI_SERVICE.HUGGING_FACE;
        usedFallback = true;
      } else {
        throw serviceError;
      }
    }

    const response = {
      content: poem,
      service: aiService,
      usedFallback: usedFallback
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating poem:', error);
    res.status(500).json({ message: 'Failed to generate poem' });
  }
});

// Generate image using AI - authenticated users only
// SECURITY: Content moderation is MANDATORY for student safety
router.post('/generate-image', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { prompt, service } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // SECURITY: Content moderation is REQUIRED - fail closed if not available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[SECURITY] AI image generation blocked: Content moderation unavailable (ANTHROPIC_API_KEY not set)');
      return res.status(503).json({
        message: 'AI image generation is temporarily unavailable. Content moderation service is required for student safety.',
        code: 'MODERATION_UNAVAILABLE'
      });
    }

    let aiService = service || DEFAULT_IMAGE_SERVICE;
    let imageUrl;
    let usedFallback = false;

    try {
      let enhancedPrompt = prompt;

      // SECURITY: Mandatory content safety check for student protection
      console.log("[MODERATION] Checking prompt for inappropriate content");

      const moderationResult = await anthropic.moderateContent(prompt);
      if (!moderationResult.isSafe) {
        console.warn(`[SECURITY] Prompt moderation BLOCKED: ${moderationResult.category} - ${moderationResult.reason}`);
        return res.status(400).json({
          message: 'Your prompt cannot be used because it contains inappropriate content. Please try a different prompt.',
          code: 'CONTENT_BLOCKED',
          category: moderationResult.category
        });
      }
      console.log("[MODERATION] Prompt approved for image generation");

      switch (aiService) {
        case AI_SERVICE.HUGGING_FACE:
          imageUrl = await generateHuggingFaceImage(enhancedPrompt);
          break;
        case AI_SERVICE.STABILITY:
          imageUrl = await generateStabilityImage(enhancedPrompt);
          break;
        case AI_SERVICE.QWEN:
          console.log("[QWEN] Using Qwen2.5-VL for image generation");
          // Qwen can enhance prompts before generating
          const qwenEnhancedPrompt = await qwen.enhanceImagePrompt(enhancedPrompt);
          imageUrl = await qwen.generateImage(qwenEnhancedPrompt);
          break;
        default:
          imageUrl = await generateHuggingFaceImage(enhancedPrompt);
      }
    } catch (serviceError: unknown) {
      const error = serviceError as Error;
      if (error.message === "QUOTA_EXCEEDED" || error.message === "MODEL_LOADING") {
        console.log(`${aiService} unavailable, falling back to Hugging Face`);
        imageUrl = await generateHuggingFaceImage(prompt);
        aiService = AI_SERVICE.HUGGING_FACE;
        usedFallback = true;
      } else {
        throw serviceError;
      }
    }

    const response = {
      imageUrl,
      service: aiService,
      usedFallback: usedFallback
    };

    res.json(response);
  } catch (error: unknown) {
    console.error('Error generating image:', error);

    let errorMessage = 'Failed to generate image';
    const err = error as Error;

    if (err && err.message) {
      if (err.message.includes('not have enough balance')) {
        errorMessage = 'Your Stability.ai account has insufficient funds. Please add funds to your account or try using a different image generation service.';
      } else if (err.message.includes('QUOTA_EXCEEDED')) {
        errorMessage = 'API quota exceeded. Please try again later or use a different AI service.';
      } else if (err.message.includes('API key')) {
        errorMessage = 'API configuration issue. Please check your API key settings.';
      } else {
        errorMessage = `Failed to generate image: ${err.message}`;
      }
    }

    res.status(500).json({
      message: errorMessage,
      originalError: process.env.NODE_ENV === 'development' ? err.message : undefined,
      service: req.body.aiService
    });
  }
});

// ============================================================================
// QWEN-SPECIFIC ENDPOINTS
// ============================================================================

/**
 * Analyze an image using Qwen2.5-VL vision capabilities
 * Useful for understanding student artwork submissions
 */
router.post('/analyze-image', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { imageUrl, prompt } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    // Check if Qwen is available
    if (!qwen.isQwenAvailable()) {
      return res.status(503).json({
        message: 'Image analysis service is not available. Please configure QWEN_API_KEY or HUGGING_FACE_API_KEY.',
        code: 'QWEN_UNAVAILABLE'
      });
    }

    console.log("[QWEN] Analyzing image with Qwen2.5-VL vision model");

    const analysis = await qwen.analyzeImage(imageUrl, prompt);

    // Log for audit purposes
    const currentUser = (req as any).user;
    await createAuditLog(req, AuditAction.DATA_CREATED, 'ai_image_analysis', {
      resourceId: imageUrl.slice(0, 50),
      success: true,
      severity: AuditSeverity.INFO,
      changes: { userId: currentUser?.id, isSafe: analysis.isSafe }
    });

    res.json({
      ...analysis,
      service: AI_SERVICE.QWEN,
      model: 'Qwen2.5-VL'
    });
  } catch (error: unknown) {
    console.error('[QWEN] Image analysis error:', error);
    const err = error as Error;
    res.status(500).json({
      message: 'Failed to analyze image',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Generate creative feedback for student submissions using Qwen
 * Provides encouraging, educational feedback on poetry and artwork
 */
router.post('/creative-feedback', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { content, type } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required for feedback' });
    }

    // Content moderation first
    if (process.env.ANTHROPIC_API_KEY) {
      const moderationResult = await anthropic.moderateContent(content);
      if (!moderationResult.isSafe) {
        return res.status(400).json({
          message: 'Cannot provide feedback on inappropriate content.',
          code: 'CONTENT_BLOCKED'
        });
      }
    }

    console.log("[QWEN] Generating creative feedback for student work");

    const feedback = await qwen.generateCreativeFeedback(content, type || 'poem');

    res.json({
      ...feedback,
      service: AI_SERVICE.QWEN
    });
  } catch (error: unknown) {
    console.error('[QWEN] Feedback generation error:', error);
    const err = error as Error;
    res.status(500).json({
      message: 'Failed to generate feedback',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Enhance a prompt using Qwen's language understanding
 * Makes prompts more detailed and suitable for image generation
 */
router.post('/enhance-prompt', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // Content moderation
    if (process.env.ANTHROPIC_API_KEY) {
      const moderationResult = await anthropic.moderateContent(prompt);
      if (!moderationResult.isSafe) {
        return res.status(400).json({
          message: 'Cannot enhance inappropriate content.',
          code: 'CONTENT_BLOCKED'
        });
      }
    }

    console.log("[QWEN] Enhancing prompt for better image generation");

    const enhancedPrompt = await qwen.enhanceImagePrompt(prompt);

    res.json({
      original: prompt,
      enhanced: enhancedPrompt,
      service: AI_SERVICE.QWEN
    });
  } catch (error: unknown) {
    console.error('[QWEN] Prompt enhancement error:', error);
    const err = error as Error;
    res.status(500).json({
      message: 'Failed to enhance prompt',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Get information about available AI services and their status
 */
router.get('/services', authenticateToken, async (req: Request, res: Response) => {
  try {
    const services = {
      claude: {
        available: !!process.env.ANTHROPIC_API_KEY,
        capabilities: ['text_generation', 'poem_generation', 'content_moderation', 'prompt_enhancement'],
        default_for: ['text_generation', 'content_moderation']
      },
      huggingface: {
        available: true, // Always available with fallbacks
        capabilities: ['text_generation', 'image_generation'],
        default_for: ['fallback']
      },
      stability: {
        available: !!process.env.STABILITY_API_KEY,
        capabilities: ['image_generation'],
        default_for: ['image_generation']
      },
      qwen: {
        available: qwen.isQwenAvailable(),
        capabilities: qwen.QWEN_SERVICE_INFO.capabilities,
        model: qwen.QWEN_SERVICE_INFO.version,
        license: qwen.QWEN_SERVICE_INFO.license,
        default_for: []
      }
    };

    res.json({
      services,
      defaults: {
        text: DEFAULT_TEXT_SERVICE,
        image: DEFAULT_IMAGE_SERVICE
      }
    });
  } catch (error) {
    console.error('Error fetching AI services:', error);
    res.status(500).json({ message: 'Failed to fetch AI service information' });
  }
});

export default router;
