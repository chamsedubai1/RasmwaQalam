import { Router, Request, Response } from "express";
import * as ollama from "../ollama";
import { generateText as generateHuggingFaceText, generateImage as generateHuggingFaceImage } from "../huggingface";
import { generateImage as generateStabilityImage } from "../stability";
import * as qwen from "../qwen";
import { AI_SERVICE, DEFAULT_TEXT_SERVICE, DEFAULT_IMAGE_SERVICE } from "./types";
import { authenticateToken, apiRateLimiter } from "../security";
import { createAuditLog, AuditAction, AuditSeverity } from "../audit-log";

const router = Router();

// Apply rate limiting to AI endpoints (expensive operations)
router.use(apiRateLimiter);

/**
 * SECURITY: Mandatory moderation gate.
 *
 * Returns a 503-style payload if Ollama isn't reachable or the moderation
 * model isn't installed. We fail closed — no AI generation is allowed
 * without working moderation, no matter what generation service is requested.
 */
async function assertModerationAvailable(res: Response): Promise<boolean> {
  if (await ollama.isOllamaAvailable()) return true;

  console.error('[SECURITY] AI generation blocked: Ollama moderation unavailable');
  res.status(503).json({
    message: 'AI features are temporarily unavailable. Content moderation service is required for student safety.',
    code: 'MODERATION_UNAVAILABLE',
  });
  return false;
}

/**
 * SECURITY: Run a prompt through Llama Guard before any generation.
 * Returns true if safe, false (and sends 400) if not.
 */
async function checkContentSafety(
  res: Response,
  text: string,
  feature: string,
): Promise<boolean> {
  const moderationResult = await ollama.moderateContent(text);
  if (!moderationResult.isSafe) {
    console.warn(`[SECURITY] ${feature} moderation BLOCKED: ${moderationResult.category} - ${moderationResult.reason}`);
    res.status(400).json({
      message: 'Your prompt cannot be used because it contains inappropriate content. Please try a different prompt.',
      code: 'CONTENT_BLOCKED',
      category: moderationResult.category,
    });
    return false;
  }
  return true;
}

// Generate poem using AI - authenticated users only
// SECURITY: Content moderation is MANDATORY for student safety
router.post('/generate-poem', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { prompt, style, service, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    if (!(await assertModerationAvailable(res))) return;
    if (!(await checkContentSafety(res, prompt, 'Poem prompt'))) return;
    console.log('[MODERATION] Poem prompt approved for generation');

    let aiService = service || DEFAULT_TEXT_SERVICE;
    let poem;
    let usedFallback = false;
    let modelUsed: string | undefined;

    try {
      switch (aiService) {
        case AI_SERVICE.HUGGING_FACE:
          poem = await generateHuggingFaceText(prompt, style);
          break;
        case AI_SERVICE.OLLAMA:
          modelUsed = await ollama.resolveModel(model);
          console.log(`[OLLAMA] Generating poem with ${modelUsed}`);
          poem = await ollama.generatePoem(prompt, style, modelUsed);
          break;
        case AI_SERVICE.QWEN:
          console.log('[QWEN] Using external Qwen2.5 for poem generation');
          poem = await qwen.generatePoem(prompt, style);
          break;
        default:
          modelUsed = await ollama.resolveModel(model);
          poem = await ollama.generatePoem(prompt, style, modelUsed);
      }
    } catch (serviceError: unknown) {
      const error = serviceError as Error;
      if (error.message === 'QUOTA_EXCEEDED' || error.message === 'MODEL_LOADING') {
        console.log(`${aiService} unavailable, falling back to Hugging Face`);
        poem = await generateHuggingFaceText(prompt, style);
        aiService = AI_SERVICE.HUGGING_FACE;
        usedFallback = true;
      } else {
        throw serviceError;
      }
    }

    res.json({ content: poem, service: aiService, model: modelUsed, usedFallback });
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

    if (!(await assertModerationAvailable(res))) return;
    if (!(await checkContentSafety(res, prompt, 'Image prompt'))) return;
    console.log('[MODERATION] Image prompt approved for generation');

    let aiService = service || DEFAULT_IMAGE_SERVICE;
    let imageUrl;
    let usedFallback = false;

    try {
      switch (aiService) {
        case AI_SERVICE.HUGGING_FACE:
          imageUrl = await generateHuggingFaceImage(prompt);
          break;
        case AI_SERVICE.STABILITY:
          imageUrl = await generateStabilityImage(prompt);
          break;
        case AI_SERVICE.QWEN: {
          console.log('[QWEN] Using Qwen2.5-VL for image generation');
          const qwenEnhancedPrompt = await qwen.enhanceImagePrompt(prompt);
          imageUrl = await qwen.generateImage(qwenEnhancedPrompt);
          break;
        }
        default:
          imageUrl = await generateHuggingFaceImage(prompt);
      }
    } catch (serviceError: unknown) {
      const error = serviceError as Error;
      if (error.message === 'QUOTA_EXCEEDED' || error.message === 'MODEL_LOADING') {
        console.log(`${aiService} unavailable, falling back to Hugging Face`);
        imageUrl = await generateHuggingFaceImage(prompt);
        aiService = AI_SERVICE.HUGGING_FACE;
        usedFallback = true;
      } else {
        throw serviceError;
      }
    }

    res.json({ imageUrl, service: aiService, usedFallback });
  } catch (error: unknown) {
    console.error('Error generating image:', error);
    const err = error as Error;
    let errorMessage = 'Failed to generate image';

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
      service: req.body.aiService,
    });
  }
});

// ============================================================================
// QWEN-SPECIFIC ENDPOINTS
// ============================================================================

/**
 * Analyze an image using a local vision-language model (default: qwen2.5vl:3b).
 * The model is selectable as long as it's in the catalog and installed.
 *
 * Accepts:
 *   imageUrl   — http(s) URL, data: URL, or bare base64
 *   prompt     — optional natural-language question (e.g. "describe the colors")
 *   model      — optional model id (e.g. "qwen2.5vl:3b"); defaults to qwen2.5vl:3b
 */
router.post('/analyze-image', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { imageUrl, prompt, model } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    // SECURITY (SSRF): Only data: URLs and bare base64 are allowed here.
    // We never let an authenticated user trick the server into fetching an
    // arbitrary URL (which would reach internal services on the host such
    // as n8n, Traefik dashboard, the Docker socket via tcp, or cloud
    // metadata endpoints). The same check is enforced inside
    // ollama.analyzeImage as defense in depth.
    if (typeof imageUrl !== 'string') {
      return res.status(400).json({ message: 'imageUrl must be a string', code: 'INVALID_IMAGE_INPUT' });
    }
    if (/^(?!data:)[a-zA-Z][a-zA-Z0-9+.-]*:/.test(imageUrl)) {
      console.warn(`[SECURITY] /analyze-image rejected URL scheme from user ${(req as any).user?.id}`);
      return res.status(400).json({
        message: 'Only data: URLs or bare base64 image data are accepted.',
        code: 'REMOTE_URLS_NOT_ALLOWED',
      });
    }

    if (!(await assertModerationAvailable(res))) return;

    console.log('[OLLAMA] Analyzing image with local vision model');

    const analysis = await ollama.analyzeImage(imageUrl, prompt, model);

    const currentUser = (req as any).user;
    await createAuditLog(req, AuditAction.DATA_CREATED, 'ai_image_analysis', {
      resourceId: typeof imageUrl === 'string' ? imageUrl.slice(0, 50) : 'unknown',
      success: true,
      severity: AuditSeverity.INFO,
      changes: { userId: currentUser?.id, isSafe: analysis.isSafe },
    });

    res.json({ ...analysis, service: AI_SERVICE.OLLAMA });
  } catch (error: unknown) {
    console.error('[OLLAMA] Image analysis error:', error);
    const err = error as Error;
    res.status(500).json({
      message: 'Failed to analyze image',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * Generate creative feedback for student submissions using Qwen
 */
router.post('/creative-feedback', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { content, type } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required for feedback' });
    }

    if (!(await assertModerationAvailable(res))) return;
    if (!(await checkContentSafety(res, content, 'Feedback content'))) return;

    console.log('[QWEN] Generating creative feedback for student work');
    const feedback = await qwen.generateCreativeFeedback(content, type || 'poem');

    res.json({ ...feedback, service: AI_SERVICE.QWEN });
  } catch (error: unknown) {
    console.error('[QWEN] Feedback generation error:', error);
    const err = error as Error;
    res.status(500).json({
      message: 'Failed to generate feedback',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * Enhance a prompt using the local LLM. Model is selectable.
 */
router.post('/enhance-prompt', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { prompt, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    if (!(await assertModerationAvailable(res))) return;
    if (!(await checkContentSafety(res, prompt, 'Prompt enhancement'))) return;

    const modelUsed = await ollama.resolveModel(model);
    console.log(`[OLLAMA] Enhancing prompt with ${modelUsed}`);
    const enhancedPrompt = await ollama.enhanceImagePrompt(prompt, modelUsed);

    res.json({
      original: prompt,
      enhanced: enhancedPrompt,
      service: AI_SERVICE.OLLAMA,
      model: modelUsed,
    });
  } catch (error: unknown) {
    console.error('[OLLAMA] Prompt enhancement error:', error);
    const err = error as Error;
    res.status(500).json({
      message: 'Failed to enhance prompt',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * Return the catalog of LLM models that are configured AND installed on this
 * Ollama instance. The client uses this to populate the model picker dropdown.
 *
 * Each entry includes capability tags so the UI can group / filter:
 *   - capabilities: ['text'] → poem generation, prompt enhancement
 *   - capabilities: ['vision'] → image analysis
 *   - capabilities: ['reasoning'] → DeepSeek-R1 style chain-of-thought
 */
router.get('/models', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const available = await ollama.listAvailableModels();
    res.json({ models: available, catalog: ollama.MODEL_CATALOG });
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ message: 'Failed to list models' });
  }
});

/**
 * Get information about available AI services and their status
 */
router.get('/services', authenticateToken, async (req: Request, res: Response) => {
  try {
    const ollamaUp = await ollama.isOllamaAvailable();
    const services = {
      ollama: {
        available: ollamaUp,
        capabilities: ['text_generation', 'poem_generation', 'content_moderation', 'prompt_enhancement'],
        default_for: ['text_generation', 'content_moderation'],
      },
      huggingface: {
        available: true,
        capabilities: ['text_generation', 'image_generation'],
        default_for: ['fallback'],
      },
      stability: {
        available: !!process.env.STABILITY_API_KEY,
        capabilities: ['image_generation'],
        default_for: ['image_generation'],
      },
      qwen: {
        available: qwen.isQwenAvailable(),
        capabilities: qwen.QWEN_SERVICE_INFO.capabilities,
        model: qwen.QWEN_SERVICE_INFO.version,
        license: qwen.QWEN_SERVICE_INFO.license,
        default_for: [],
      },
    };

    res.json({
      services,
      defaults: { text: DEFAULT_TEXT_SERVICE, image: DEFAULT_IMAGE_SERVICE },
    });
  } catch (error) {
    console.error('Error fetching AI services:', error);
    res.status(500).json({ message: 'Failed to fetch AI service information' });
  }
});

export default router;
