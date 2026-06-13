/**
 * Ollama provider — self-hosted LLM for content generation and moderation.
 *
 * Two models are used:
 *   - GENERATION_MODEL (default qwen2.5:3b)  — poems, prompt enhancement
 *   - MODERATION_MODEL (default llama-guard3:1b) — Meta's purpose-built
 *     safety classifier. Returns "safe" or "unsafe\n<category>".
 *
 * Configuration via env:
 *   OLLAMA_URL            base URL (default http://localhost:11434)
 *   OLLAMA_GENERATION_MODEL  (default qwen2.5:3b)
 *   OLLAMA_MODERATION_MODEL  (default llama-guard3:1b)
 *
 * This module replaces server/anthropic.ts. The public API surface is
 * compatible (generatePoem / enhanceImagePrompt / moderateContent) so
 * callers don't need provider-specific branches.
 */

import fetch from 'node-fetch';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const GENERATION_MODEL = process.env.OLLAMA_GENERATION_MODEL || 'qwen2.5:3b';
const MODERATION_MODEL = process.env.OLLAMA_MODERATION_MODEL || 'llama-guard3:1b';

const FETCH_TIMEOUT_MS = 60_000;
const MODERATION_TIMEOUT_MS = 15_000;

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  // ...other fields we don't use
}

interface OllamaTagsResponse {
  models: Array<{ name: string; size: number; modified_at: string }>;
}

/**
 * POST to /api/chat with timeout. Throws on non-2xx or timeout.
 */
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

/**
 * Returns true if Ollama is reachable AND both required models are present.
 * Cached for 30 seconds so we don't hammer the daemon.
 */
let availabilityCache: { value: boolean; expiresAt: number } | null = null;

export async function isOllamaAvailable(): Promise<boolean> {
  if (availabilityCache && Date.now() < availabilityCache.expiresAt) {
    return availabilityCache.value;
  }

  const value = await checkOllamaAvailability();
  availabilityCache = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const data = (await response.json()) as OllamaTagsResponse;
    const names = data.models?.map((m) => m.name) ?? [];

    const haveGen = names.some((n) => n === GENERATION_MODEL || n.startsWith(GENERATION_MODEL + ':'));
    const haveMod = names.some((n) => n === MODERATION_MODEL || n.startsWith(MODERATION_MODEL + ':'));

    if (!haveGen) console.warn(`[OLLAMA] Generation model not installed: ${GENERATION_MODEL}`);
    if (!haveMod) console.warn(`[OLLAMA] Moderation model not installed: ${MODERATION_MODEL}`);

    return haveGen && haveMod;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[OLLAMA] Unreachable at ${OLLAMA_URL}: ${msg}`);
    return false;
  }
}

/**
 * Generate a poem from a user prompt using the local generation model.
 */
export async function generatePoem(prompt: string, style?: string): Promise<string> {
  const systemPrompt =
    'You are a creative poetry AI assistant for children aged 6-18. Write beautiful, ' +
    'thoughtful, age-appropriate poems. Use simple vocabulary. Never include violence, ' +
    'weapons, hate, romance, alcohol, drugs, or mature themes. Format with line breaks.';

  const completePrompt = style
    ? `Write a ${style} based on this prompt: "${prompt}"`
    : `Write a poem based on this prompt: "${prompt}"`;

  return ollamaChat(GENERATION_MODEL, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: completePrompt },
  ]);
}

/**
 * Enhance a short image prompt into a more vivid description, while keeping
 * it strictly child-safe.
 */
export async function enhanceImagePrompt(prompt: string): Promise<string> {
  const systemPrompt =
    'You enhance short image prompts written by children (ages 6-18) for an AI image ' +
    'generator. Output ONLY the enhanced prompt (no preamble, no explanation). Keep ' +
    'vocabulary simple. Strictly avoid violence, weapons, blood, fire, weapons, hate, ' +
    'romance, mature themes. 80 words max. The result must be safe for a school art project.';

  const result = await ollamaChat(GENERATION_MODEL, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Enhance this image prompt: "${prompt}"` },
  ], { temperature: 0.5 });

  return result || prompt;
}

/**
 * Moderate text using Llama Guard 3.
 *
 * Llama Guard outputs:
 *   "safe"          → all clear
 *   "unsafe\nS1"    → unsafe, with category code (S1..S14)
 *
 * Categories (Llama Guard 3 taxonomy):
 *   S1 Violent Crimes      S8 Intellectual Property
 *   S2 Non-Violent Crimes  S9 Indiscriminate Weapons
 *   S3 Sex-Related Crimes  S10 Hate
 *   S4 Child Sexual Exploitation
 *   S5 Defamation          S11 Suicide & Self-Harm
 *   S6 Specialized Advice  S12 Sexual Content
 *   S7 Privacy             S13 Elections
 *                          S14 Code Interpreter Abuse
 */
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
  // Llama Guard's chat template handles the safety prompt internally; we just
  // pass the message-to-evaluate as the user turn.
  const raw = await ollamaChat(
    MODERATION_MODEL,
    [{ role: 'user', content: text }],
    { temperature: 0, timeoutMs: MODERATION_TIMEOUT_MS },
  );

  // Normalize: strip whitespace and trailing punctuation.
  const lines = raw.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const verdict = (lines[0] ?? '').toLowerCase();

  if (verdict === 'safe') {
    return { isSafe: true };
  }

  // Anything other than the literal token "safe" is treated as unsafe.
  // This is intentional: an unparseable response from a safety classifier
  // should fail closed, not be silently allowed.
  const categoryCode = (lines[1] ?? '').toUpperCase().split(/[,\s]/)[0] || '';
  const categoryName = CATEGORY_NAMES[categoryCode] || categoryCode || 'unknown';

  return {
    isSafe: false,
    category: categoryName,
    reason: `Llama Guard flagged content as unsafe (${categoryCode || 'unknown category'})`,
  };
}
