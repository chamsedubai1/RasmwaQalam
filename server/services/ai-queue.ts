import Queue from 'bull';
import { generatePoem as generateAnthropicPoem } from '../anthropic';
import { generatePoem as generateHuggingFacePoem } from '../huggingface';
import { monitoring } from '../monitoring';

// Create a Redis-backed queue for AI processing
const aiQueue = new Queue('ai-processing', process.env.REDIS_URL || 'redis://localhost:6379');

// Set concurrency to limit the number of simultaneous API calls
// This prevents overwhelming the AI service providers and handles quota limitations
aiQueue.process(10, async (job) => {
  const { prompt, style, userId, service } = job.data;
  
  // Add to monitoring
  monitoring.trackRequestStart(`/api/ai/${service}`);
  const startTime = Date.now();
  
  try {
    // Process with fallback options
    let result;
    
    // Try primary service first (Claude if specified or available)
    if (service === 'anthropic' || !service) {
      try {
        result = await generateAnthropicPoem(prompt, style);
      } catch (error) {
        console.log(`Claude AI failed for user ${userId}, falling back to Hugging Face: ${error.message}`);
        // Fall back to HuggingFace
        result = await generateHuggingFacePoem(prompt, style);
      }
    } else if (service === 'huggingface') {
      // Specifically requested Hugging Face
      result = await generateHuggingFacePoem(prompt, style);
    } else {
      throw new Error(`Unknown AI service: ${service}`);
    }
    
    // Track successful request
    monitoring.trackRequestEnd(
      `/api/ai/${service}`, 
      200, 
      Date.now() - startTime
    );
    
    return result;
  } catch (error) {
    // Track failed request
    monitoring.trackRequestEnd(
      `/api/ai/${service}`, 
      500, 
      Date.now() - startTime
    );
    
    console.error('AI processing error:', error);
    throw error;
  }
});

// Add error handler
aiQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error: ${err.message}`);
});

// Export functions to interact with the queue
export const aiService = {
  /**
   * Queue an AI text generation request
   * @param prompt The user's prompt
   * @param style Optional style (haiku, sonnet, etc.)
   * @param userId User ID for tracking
   * @param service Preferred service (anthropic, huggingface)
   * @returns Promise that resolves with job result
   */
  async generatePoem(prompt: string, style?: string, userId?: number, service?: string) {
    const job = await aiQueue.add(
      {
        prompt,
        style,
        userId: userId || 0,
        service: service || 'anthropic'
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: 100,
      }
    );
    
    return job.finished();
  },
  
  /**
   * Get queue statistics
   * @returns Object with queue stats
   */
  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      aiQueue.getWaitingCount(),
      aiQueue.getActiveCount(),
      aiQueue.getCompletedCount(),
      aiQueue.getFailedCount()
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed
    };
  }
};