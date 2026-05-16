/**
 * AI processing service.
 *
 * Two modes:
 *   - REDIS_URL set: a Bull/Redis queue gives concurrency control + retries.
 *   - REDIS_URL absent: a synchronous fallback runs jobs in-process with a
 *     small concurrency cap. Used on shared hosts (Hostinger Cloud, etc.)
 *     that don't expose Redis.
 *
 * In both modes, the public API (`aiService.generatePoem`, `aiService.getStats`)
 * is identical so callers don't care which mode is active.
 */

import { generatePoem as generateAnthropicPoem } from '../anthropic';
// NOTE: server/huggingface.ts exports `generateText`, not `generatePoem`.
// Original code imported `generatePoem` which silently resolved to undefined
// at runtime, so the HF fallback never worked. Use the actual export.
import { generateText as generateHuggingFacePoem } from '../huggingface';
import { monitoring } from '../monitoring';

interface JobData {
  prompt: string;
  style?: string;
  userId?: number;
  service?: string;
}

async function runJob({ prompt, style, userId, service }: JobData): Promise<unknown> {
  monitoring.trackRequestStart(`/api/ai/${service}`);
  const startTime = Date.now();

  try {
    let result;

    if (service === 'anthropic' || !service) {
      try {
        result = await generateAnthropicPoem(prompt, style);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`Claude AI failed for user ${userId}, falling back to Hugging Face: ${msg}`);
        result = await generateHuggingFacePoem(prompt, style);
      }
    } else if (service === 'huggingface') {
      result = await generateHuggingFacePoem(prompt, style);
    } else {
      throw new Error(`Unknown AI service: ${service}`);
    }

    monitoring.trackRequestEnd(`/api/ai/${service}`, 200, Date.now() - startTime);
    return result;
  } catch (error) {
    monitoring.trackRequestEnd(`/api/ai/${service}`, 500, Date.now() - startTime);
    console.error('AI processing error:', error);
    throw error;
  }
}

// -- Redis/Bull-backed implementation ---------------------------------------

type StatsFn = () => Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}>;

type GenerateFn = (
  prompt: string,
  style?: string,
  userId?: number,
  service?: string,
) => Promise<unknown>;

let generatePoem: GenerateFn;
let getStats: StatsFn;

if (process.env.REDIS_URL) {
  // Dynamic require so Bull never tries to connect when there is no Redis.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Queue = require('bull') as typeof import('bull');
  const aiQueue = new Queue('ai-processing', process.env.REDIS_URL);

  aiQueue.process(10, async (job) => runJob(job.data as JobData));

  aiQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed: ${err.message}`);
  });

  generatePoem = async (prompt, style, userId, service) => {
    const job = await aiQueue.add(
      { prompt, style, userId: userId || 0, service: service || 'anthropic' },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    return job.finished();
  };

  getStats = async () => {
    const [waiting, active, completed, failed] = await Promise.all([
      aiQueue.getWaitingCount(),
      aiQueue.getActiveCount(),
      aiQueue.getCompletedCount(),
      aiQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed, total: waiting + active + completed + failed };
  };

  console.log('[ai-queue] Using Redis-backed Bull queue');
} else {
  // In-process semaphore so a burst of requests still cannot fan out
  // unbounded against the upstream AI providers (which is exactly what the
  // Bull concurrency limit gave us before).
  const MAX_CONCURRENT = 4;
  let active = 0;
  let waiting = 0;
  let completed = 0;
  let failed = 0;
  const queue: Array<() => void> = [];

  const acquire = () =>
    new Promise<void>((resolve) => {
      if (active < MAX_CONCURRENT) {
        active++;
        resolve();
      } else {
        waiting++;
        queue.push(() => {
          waiting--;
          active++;
          resolve();
        });
      }
    });

  const release = () => {
    active--;
    const next = queue.shift();
    if (next) next();
  };

  generatePoem = async (prompt, style, userId, service) => {
    await acquire();
    try {
      const result = await runJob({ prompt, style, userId, service });
      completed++;
      return result;
    } catch (error) {
      failed++;
      throw error;
    } finally {
      release();
    }
  };

  getStats = async () => ({
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  });

  console.warn(
    '[ai-queue] REDIS_URL not set — using in-process AI queue (no retries, no cross-instance coordination). Suitable for single-instance shared hosting.',
  );
}

export const aiService = { generatePoem, getStats };
