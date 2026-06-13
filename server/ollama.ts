/**
 * Ollama provider — self-hosted LLM for content generation, moderation,
 * and image understanding.
 *
 * Supports multiple models that the client can pick per request, via a
 * curated catalog. The moderation model is fixed (Llama Guard 3) and not
 * user-selectable.
 *
 * Configuration via env:
 *   OLLAMA_URL                base URL (default http://localhost:11434)
 *   OLLAMA_GENERATION_MODEL   default generation model id (default qwen2.5:3b)
 *   OLLAMA_MODERATION_MODEL   moderation model id        (default llama-guard3:1b)
 */

import fetch from 'node-fetch';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_GENERATION_MODEL = process.env.OLLAMA_GENERATION_MODEL || 'qwen2.5:3b';
const MODERATION_MODEL = process.env.OLLAMA_MODERATION_MODEL || 'llama-guard3:1b';

const FETCH_TIMEOUT_MS = 120_000; // generation can be slow on CPU
const MODERATION_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Model catalog
//
// What clients can pick from. We only advertise models we actually understand
// how to talk to. Anything else can still be reached by setting
// OLLAMA_GENERATION_MODEL directly, but won't appear in the UI dropdown.
// ---------------------------------------------------------------------------

export interface ModelInfo {
  /** Ollama model identifier as accepted by `ollama pull <id>` and `ollama list`. */
  id: string;
  /** Human-readable name shown in the UI. */
  displayName: string;
  /** Short hint for tooltips / help text. */
  description: string;
  /** What this model can do. */
  capabilities: Array<'text' | 'vision' | 'reasoning'>;
  /** Approximate on-disk size in MB. Used for catalog display. */
  sizeMB: number;
  /** Approximate latency hint for the UI. */
  speedHint: 'fast' | 'medium' | 'slow';
}

export const MODEL_CATALOG: readonly ModelInfo[] = [
  {
    id: 'qwen2.5:3b',
    displayName: 'Qwen 2.5 (3B) — Fast',
    description: 'Default. Fast and good for poems.',
    capabilities: ['text'],
    sizeMB: 2_000,
    speedHint: 'fast',
  },
  {
    id: 'qwen2.5vl:3b',
    displayName: 'Qwen 2.5 VL (3B) — Vision',
    description: 'Can see and describe images. Used for artwork analysis.',
    capabilities: ['text', 'vision'],
    sizeMB: 3_200,
    speedHint: 'medium',
  },
];

// Models we've removed from the active catalog but might want to re-add later:
//   - deepseek-r1:7b    too heavy for an 8 GB VPS while running alongside
//                       n8n + Traefik + Llama Guard + the platform itself.
//                       Revisit when on a 16+ GB host.

// ---------------------------------------------------------------------------
// Low-level Ollama HTTP client
// ---------------------------------------------------------------------------

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** base64-encoded images, for vision-capable models */
  images?: string[];
}

interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
}

interface OllamaTagsResponse {
  models: Array<{ name: string; size: number; modified_at: string }>;
}

async function ollamaChat(
  model: string,
  messages: OllamaChatMessage[],
  options: { temperature?: number; numCtx?: number; timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          ...(options.numCtx ? { num_ctx: options.numCtx } : {}),
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message?.content?.trim() ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Availability / installed-models discovery
// ---------------------------------------------------------------------------

let tagsCache: { models: Set<string>; expiresAt: number } | null = null;

async function listInstalledModelIds(): Promise<Set<string>> {
  if (tagsCache && Date.now() < tagsCache.expiresAt) {
    return tagsCache.models;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return new Set();

    const data = (await response.json()) as OllamaTagsResponse;
    const ids = new Set<string>(data.models?.map((m) => m.name) ?? []);
    tagsCache = { models: ids, expiresAt: Date.now() + 30_000 };
    return ids;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[OLLAMA] Unreachable at ${OLLAMA_URL}: ${msg}`);
    return new Set();
  }
}

function modelInstalled(installed: Set<string>, modelId: string): boolean {
  if (installed.has(modelId)) return true;
  // Allow loose-tag match — e.g. "qwen2.5" matches "qwen2.5:3b" if user typed
  // the short name in env. Required so OLLAMA_GENERATION_MODEL=qwen2.5
  // still works even though `ollama list` returns "qwen2.5:3b".
  return Array.from(installed).some(
    (id) => id === modelId || id.startsWith(modelId + ':') || modelId.startsWith(id + ':'),
  );
}

/**
 * True iff Ollama is reachable AND the default generation + moderation
 * models are both installed. The moderation gate uses this.
 */
export async function isOllamaAvailable(): Promise<boolean> {
  const installed = await listInstalledModelIds();
  if (installed.size === 0) return false;

  const haveGen = modelInstalled(installed, DEFAULT_GENERATION_MODEL);
  const haveMod = modelInstalled(installed, MODERATION_MODEL);

  if (!haveGen) console.warn(`[OLLAMA] Generation model not installed: ${DEFAULT_GENERATION_MODEL}`);
  if (!haveMod) console.warn(`[OLLAMA] Moderation model not installed: ${MODERATION_MODEL}`);

  return haveGen && haveMod;
}

/**
 * Catalog entries filtered to models that are actually installed and reachable.
 * Used by the UI to populate the model picker.
 */
export async function listAvailableModels(): Promise<ModelInfo[]> {
  const installed = await listInstalledModelIds();
  return MODEL_CATALOG.filter((m) => modelInstalled(installed, m.id));
}

/**
 * Resolve a user-supplied model id to a safe choice. Returns the requested
 * model if it's in the catalog and installed; otherwise falls back to the
 * default. This is a security/UX boundary — never pass an arbitrary string
 * straight through to Ollama.
 */
export async function resolveModel(requested?: string): Promise<string> {
  if (!requested) return DEFAULT_GENERATION_MODEL;

  const inCatalog = MODEL_CATALOG.some((m) => m.id === requested);
  if (!inCatalog) {
    console.warn(`[OLLAMA] Rejected unknown model "${requested}", using default`);
    return DEFAULT_GENERATION_MODEL;
  }

  const installed = await listInstalledModelIds();
  if (!modelInstalled(installed, requested)) {
    console.warn(`[OLLAMA] Model "${requested}" not installed, using default`);
    return DEFAULT_GENERATION_MODEL;
  }

  return requested;
}

// ---------------------------------------------------------------------------
// High-level helpers used by routes
// ---------------------------------------------------------------------------

export async function generatePoem(
  prompt: string,
  style?: string,
  modelId?: string,
): Promise<string> {
  const model = await resolveModel(modelId);

  const systemPrompt =
    'You are a creative poetry AI assistant for children aged 6-18. Write beautiful, ' +
    'thoughtful, age-appropriate poems. Use simple vocabulary. Never include violence, ' +
    'weapons, hate, romance, alcohol, drugs, or mature themes. Format with line breaks.';

  const completePrompt = style
    ? `Write a ${style} based on this prompt: "${prompt}"`
    : `Write a poem based on this prompt: "${prompt}"`;

  return ollamaChat(model, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: completePrompt },
  ]);
}

export async function enhanceImagePrompt(
  prompt: string,
  modelId?: string,
): Promise<string> {
  const model = await resolveModel(modelId);

  const systemPrompt =
    'You enhance short image prompts written by children (ages 6-18) for an AI image ' +
    'generator. Output ONLY the enhanced prompt (no preamble, no explanation). Keep ' +
    'vocabulary simple. Strictly avoid violence, weapons, blood, fire, hate, romance, ' +
    'mature themes. 80 words max. The result must be safe for a school art project.';

  const result = await ollamaChat(model, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Enhance this image prompt: "${prompt}"` },
  ], { temperature: 0.5 });

  return result || prompt;
}

/**
 * Image analysis using a vision-capable model (e.g. qwen2.5vl:3b).
 *
 * SECURITY: To prevent SSRF, `imageInput` must be one of:
 *   - A `data:image/<type>;base64,...` URL
 *   - A bare base64 string (max ~2MB encoded)
 *
 * Remote URLs (http(s)) are intentionally NOT accepted here. If a caller
 * needs to analyze a file that lives on the server's filesystem, it should
 * read the file directly and pass the base64 contents — never hand
 * arbitrary URLs to this function. The previous http(s) branch let any
 * authenticated user trigger fetches to internal services (n8n, traefik
 * dashboard, cloud metadata endpoints, etc).
 */
export async function analyzeImage(
  imageInput: string,
  prompt?: string,
  modelId?: string,
): Promise<{
  description: string;
  isSafe: boolean;
  model: string;
}> {
  const requested = modelId || 'qwen2.5vl:3b';
  const catalog = MODEL_CATALOG.find((m) => m.id === requested);
  if (!catalog?.capabilities.includes('vision')) {
    throw new Error(`Model "${requested}" does not support vision`);
  }

  const installed = await listInstalledModelIds();
  if (!modelInstalled(installed, requested)) {
    throw new Error(`Vision model "${requested}" is not installed on this Ollama instance`);
  }

  const base64 = normalizeToBase64(imageInput);
  const userPrompt = prompt || 'Describe this image clearly and concisely.';

  const description = await ollamaChat(requested, [
    {
      role: 'system',
      content:
        'You are an art teacher who analyzes student artwork. Be encouraging, specific, ' +
        'and constructive. Keep descriptions appropriate for ages 6-18.',
    },
    { role: 'user', content: userPrompt, images: [base64] },
  ]);

  // Quick safety pass on the user's prompt (not the image itself — image
  // moderation is harder and we leave it to teachers).
  const safetyCheck = await moderateContent(userPrompt);

  return {
    description,
    isSafe: safetyCheck.isSafe,
    model: requested,
  };
}

const MAX_IMAGE_BASE64_LENGTH = 2_800_000; // ~2 MB binary after decode
const BASE64_REGEX = /^[A-Za-z0-9+/=\s]+$/;

/**
 * SSRF-safe normalization. Accepts only data: URLs with an image MIME and
 * base64 payload, or a bare base64 string. Anything resembling a URL is
 * rejected — including file:, http:, https:, gopher:, etc.
 */
function normalizeToBase64(input: string): string {
  if (typeof input !== 'string' || !input) {
    throw new Error('Image input must be a non-empty string');
  }

  if (input.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new Error('Image input exceeds maximum allowed size');
  }

  if (input.startsWith('data:')) {
    // Require image/* MIME and base64 encoding. Reject e.g. data:text/html or
    // data:application/x-something which a vision model might still try to
    // interpret as text.
    const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) {
      throw new Error('data: URL must be an image MIME with base64 payload');
    }
    return match[2].replace(/\s+/g, '');
  }

  // Reject anything that looks like a URL of any other scheme.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) {
    throw new Error('Only data: URLs and bare base64 are accepted (no http/https/file/...)');
  }

  // Bare base64 path. Sanity-check the alphabet.
  const stripped = input.replace(/\s+/g, '');
  if (!BASE64_REGEX.test(stripped) || stripped.length < 100) {
    throw new Error('Image input is not valid base64');
  }
  return stripped;
}

// ---------------------------------------------------------------------------
// Moderation — Llama Guard 3
// ---------------------------------------------------------------------------

const CATEGORY_NAMES: Record<string, string> = {
  S1: 'violent_crimes',
  S2: 'non_violent_crimes',
  S3: 'sex_related_crimes',
  S4: 'child_sexual_exploitation',
  S5: 'defamation',
  S6: 'specialized_advice',
  S7: 'privacy',
  S8: 'intellectual_property',
  S9: 'indiscriminate_weapons',
  S10: 'hate',
  S11: 'suicide_self_harm',
  S12: 'sexual_content',
  S13: 'elections',
  S14: 'code_interpreter_abuse',
};

export async function moderateContent(text: string): Promise<{
  isSafe: boolean;
  category?: string;
  reason?: string;
}> {
  const raw = await ollamaChat(
    MODERATION_MODEL,
    [{ role: 'user', content: text }],
    { temperature: 0, timeoutMs: MODERATION_TIMEOUT_MS },
  );

  const lines = raw.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const verdict = (lines[0] ?? '').toLowerCase();

  if (verdict === 'safe') {
    return { isSafe: true };
  }

  // Anything other than the literal token "safe" is treated as unsafe.
  // Unparseable safety responses fail closed, not open.
  const categoryCode = (lines[1] ?? '').toUpperCase().split(/[,\s]/)[0] || '';
  const categoryName = CATEGORY_NAMES[categoryCode] || categoryCode || 'unknown';

  return {
    isSafe: false,
    category: categoryName,
    reason: `Llama Guard flagged content as unsafe (${categoryCode || 'unknown category'})`,
  };
}
