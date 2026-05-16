import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";

// Extended Request type with authenticated user
export interface AuthenticatedRequest extends Request {
  user: Omit<User, 'password'>;
}

// Route handler types
export type RouteHandler = (req: Request, res: Response, next?: NextFunction) => Promise<void | Response> | void | Response;
export type AuthenticatedRouteHandler = (req: AuthenticatedRequest, res: Response, next?: NextFunction) => Promise<void | Response> | void | Response;

// Common response types
export interface ApiError {
  message: string;
  field?: string;
  code?: string;
  errors?: unknown[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// AI Service constants
export const AI_SERVICE = {
  OPENAI: 'openai',
  CLAUDE: 'claude',
  HUGGING_FACE: 'huggingface',
  STABILITY: 'stability',
  QWEN: 'qwen'  // Qwen2.5-VL Vision-Language Model (Apache-2.0)
} as const;

export type AIServiceType = typeof AI_SERVICE[keyof typeof AI_SERVICE];

// Default AI services
export const DEFAULT_TEXT_SERVICE = AI_SERVICE.CLAUDE;
export const DEFAULT_IMAGE_SERVICE = AI_SERVICE.STABILITY;

// Qwen-specific capabilities
export const QWEN_CAPABILITIES = {
  TEXT_GENERATION: true,
  IMAGE_GENERATION: true,
  IMAGE_ANALYSIS: true,      // Vision capabilities (Qwen2.5-VL)
  CONTENT_MODERATION: true,
  CREATIVE_FEEDBACK: true,   // Educational feedback for students
  PROMPT_ENHANCEMENT: true
} as const;
