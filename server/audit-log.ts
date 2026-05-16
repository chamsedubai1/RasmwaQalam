import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { createHash, createHmac } from 'crypto';
import { config } from './config';
import { db } from './db';
import { auditLogs } from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

/**
 * SECURITY ENHANCEMENT: Comprehensive audit logging system
 * Tracks administrative actions with tamper-proof integrity verification
 * Provides accountability and forensic capabilities
 */

export interface AuditLogEntry {
  id?: number;
  timestamp: Date;
  userId: number;
  username: string;
  userRole: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  success: boolean;
  errorMessage?: string;
  severity: AuditSeverity;
  sessionId?: string;
  integrityHash?: string; // Tamper-proof hash
}

export enum AuditAction {
  // User management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
  
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  
  // School management
  SCHOOL_CREATED = 'SCHOOL_CREATED',
  SCHOOL_UPDATED = 'SCHOOL_UPDATED',
  SCHOOL_DELETED = 'SCHOOL_DELETED',
  SCHOOL_APPROVED = 'SCHOOL_APPROVED',
  SCHOOL_REJECTED = 'SCHOOL_REJECTED',
  
  // Class management
  CLASS_CREATED = 'CLASS_CREATED',
  CLASS_UPDATED = 'CLASS_UPDATED',
  CLASS_DELETED = 'CLASS_DELETED',
  
  // Event management
  EVENT_CREATED = 'EVENT_CREATED',
  EVENT_UPDATED = 'EVENT_UPDATED',
  EVENT_DELETED = 'EVENT_DELETED',
  EVENT_PUBLISHED = 'EVENT_PUBLISHED',
  EVENT_UNPUBLISHED = 'EVENT_UNPUBLISHED',
  
  // Submission management
  SUBMISSION_CREATED = 'SUBMISSION_CREATED',
  SUBMISSION_UPDATED = 'SUBMISSION_UPDATED',
  SUBMISSION_DELETED = 'SUBMISSION_DELETED',
  SUBMISSION_APPROVED = 'SUBMISSION_APPROVED',
  SUBMISSION_REJECTED = 'SUBMISSION_REJECTED',
  
  // Voting
  VOTE_CAST = 'VOTE_CAST',
  VOTE_CHANGED = 'VOTE_CHANGED',
  VOTE_DELETED = 'VOTE_DELETED',
  
  // System configuration
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
  FEATURE_FLAG_CHANGED = 'FEATURE_FLAG_CHANGED',
  
  // Security events
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  FILE_UPLOAD_REJECTED = 'FILE_UPLOAD_REJECTED',
  FILE_UPLOADED = 'FILE_UPLOADED',
  FILE_DOWNLOADED = 'FILE_DOWNLOADED',

  // Data exports
  DATA_EXPORTED = 'DATA_EXPORTED',
  BULK_OPERATION = 'BULK_OPERATION',

  // Generic resource operations
  RESOURCE_CREATED = 'RESOURCE_CREATED',
  RESOURCE_UPDATED = 'RESOURCE_UPDATED',
  RESOURCE_DELETED = 'RESOURCE_DELETED',
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * Generate tamper-proof integrity hash for audit log entry
 * Uses HMAC-SHA256 to ensure logs cannot be modified without detection
 */
function generateIntegrityHash(entry: Omit<AuditLogEntry, 'integrityHash'>): string {
  const data = JSON.stringify({
    timestamp: entry.timestamp.toISOString(),
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    ipAddress: entry.ipAddress,
    changes: entry.changes,
    success: entry.success,
  });
  
  return createHmac('sha256', config.AUDIT_LOG_HMAC_SECRET)
    .update(data)
    .digest('hex');
}

/**
 * Verify integrity of an audit log entry
 */
export function verifyAuditLogIntegrity(entry: AuditLogEntry): boolean {
  if (!entry.integrityHash) {
    return false;
  }
  
  const expectedHash = generateIntegrityHash(entry);
  return entry.integrityHash === expectedHash;
}

/**
 * Extract user information from authenticated request
 */
function getUserFromRequest(req: Request): { userId: number; username: string; userRole: string } {
  const user = (req as any).user;
  
  if (!user) {
    return {
      userId: 0,
      username: 'anonymous',
      userRole: 'anonymous',
    };
  }
  
  return {
    userId: user.id || 0,
    username: user.username || 'unknown',
    userRole: user.role || 'unknown',
  };
}

/**
 * Extract request metadata
 *
 * SECURITY: Prefer req.ip (Express resolves the trusted proxy chain when
 * `app.set('trust proxy', ...)` is configured). Only fall back to a parsed
 * X-Forwarded-For if req.ip is genuinely empty, and take only the first
 * (leftmost) entry — a raw header would otherwise be the entire comma-
 * separated chain.
 */
function getRequestMetadata(req: Request): { ipAddress: string; userAgent: string; sessionId?: string } {
  let ipAddress = req.ip;
  if (!ipAddress) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      ipAddress = xff.split(',')[0].trim();
    } else if (Array.isArray(xff) && xff.length > 0) {
      ipAddress = xff[0].split(',')[0].trim();
    }
  }
  return {
    ipAddress: ipAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    // Note: we intentionally do not persist a session-id surrogate in the
    // audit log; sessionID lifetimes leak into long-term storage and offer
    // no forensic value beyond what the JWT-tracked user id already gives.
    sessionId: undefined,
  };
}

/**
 * Create an audit log entry
 * This is the main function to call when logging administrative actions
 */
export async function createAuditLog(
  req: Request,
  action: AuditAction,
  resource: string,
  options: {
    resourceId?: string | number;
    changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
    success?: boolean;
    errorMessage?: string;
    severity?: AuditSeverity;
  } = {}
): Promise<void> {
  try {
    const userInfo = getUserFromRequest(req);
    const metadata = getRequestMetadata(req);
    
    const entry: Omit<AuditLogEntry, 'integrityHash'> = {
      timestamp: new Date(),
      ...userInfo,
      action,
      resource,
      resourceId: options.resourceId?.toString(),
      ...metadata,
      changes: options.changes,
      success: options.success !== false, // Default to true
      errorMessage: options.errorMessage,
      severity: options.severity || determineSeverity(action, options.success !== false),
    };
    
    // Generate integrity hash
    const integrityHash = generateIntegrityHash(entry);
    
    const fullEntry: AuditLogEntry = {
      ...entry,
      integrityHash,
    };
    
    // Log to console for immediate visibility (structured logging)
    console.log('[AUDIT]', {
      action: fullEntry.action,
      user: `${fullEntry.username} (${fullEntry.userId})`,
      resource: fullEntry.resource,
      resourceId: fullEntry.resourceId,
      success: fullEntry.success,
      severity: fullEntry.severity,
      ip: fullEntry.ipAddress,
    });
    
    // CRITICAL FIX: Store in database for long-term retention and forensics
    // Persist audit logs with tamper-proof integrity hashes
    await storage.createAuditLog(fullEntry);
    
    // For critical events, also log to a separate security event stream
    if (fullEntry.severity === AuditSeverity.CRITICAL || fullEntry.severity === AuditSeverity.ERROR) {
      console.error('[SECURITY]', {
        severity: fullEntry.severity,
        action: fullEntry.action,
        user: fullEntry.username,
        resource: fullEntry.resource,
        error: fullEntry.errorMessage,
        ip: fullEntry.ipAddress,
      });
    }
    
  } catch (error) {
    // Never let audit logging errors break the main application flow
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Determine severity based on action type and success
 */
function determineSeverity(action: AuditAction, success: boolean): AuditSeverity {
  // Failed actions are generally more severe
  if (!success) {
    if (isSecurityAction(action)) {
      return AuditSeverity.CRITICAL;
    }
    return AuditSeverity.WARNING;
  }
  
  // Security-related actions
  if (isSecurityAction(action)) {
    return AuditSeverity.WARNING;
  }
  
  // Destructive actions
  if (isDestructiveAction(action)) {
    return AuditSeverity.WARNING;
  }
  
  // Normal operations
  return AuditSeverity.INFO;
}

/**
 * Check if action is security-related
 */
function isSecurityAction(action: AuditAction): boolean {
  const securityActions = [
    AuditAction.LOGIN_FAILED,
    AuditAction.SUSPICIOUS_ACTIVITY,
    AuditAction.CSRF_VIOLATION,
    AuditAction.RATE_LIMIT_EXCEEDED,
    AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
    AuditAction.FILE_UPLOAD_REJECTED,
    AuditAction.PASSWORD_CHANGED,
    AuditAction.TOKEN_REVOKED,
  ];
  
  return securityActions.includes(action);
}

/**
 * Check if action is destructive (delete, deactivate, etc.)
 */
function isDestructiveAction(action: AuditAction): boolean {
  return action.includes('DELETED') || action.includes('DEACTIVATED') || action.includes('REJECTED');
}

/**
 * Middleware to automatically log all administrative API calls
 */
export function auditLogMiddleware(resource: string, action: AuditAction) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Log the action before it executes
      await createAuditLog(req, action, resource, {
        resourceId: req.params.id,
      });
    } catch (error) {
      console.error('Audit logging middleware error:', error);
    }

    next();
  };
}

/**
 * Query audit logs (for admin dashboard)
 * Implements database query with filtering and pagination
 */
export async function queryAuditLogs(filters: {
  userId?: number;
  action?: AuditAction;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: AuditSeverity;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  try {
    const conditions = [];

    // Build dynamic WHERE conditions
    if (filters.userId !== undefined) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }

    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }

    if (filters.resource) {
      conditions.push(eq(auditLogs.resource, filters.resource));
    }

    if (filters.severity) {
      conditions.push(eq(auditLogs.severity, filters.severity));
    }

    if (filters.startDate) {
      conditions.push(gte(auditLogs.timestamp, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(auditLogs.timestamp, filters.endDate));
    }

    // Build the query
    let query = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp));

    // Apply conditions if any exist
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Apply limit
    if (filters.limit) {
      query = query.limit(filters.limit) as typeof query;
    } else {
      query = query.limit(100) as typeof query; // Default limit
    }

    // Apply offset for pagination
    if (filters.offset) {
      query = query.offset(filters.offset) as typeof query;
    }

    const results = await query;

    // Map database results to AuditLogEntry interface, then verify each
    // entry's integrity hash. Tampered or unverifiable rows are still
    // returned but flagged for the caller via a `verified: false` field
    // that admin UIs can render distinctly. We never silently drop rows
    // (so a tamperer cannot hide an event by also breaking its hash).
    return results.map(row => {
      const entry: AuditLogEntry = {
        id: row.id,
        timestamp: new Date(row.timestamp),
        userId: row.userId,
        username: row.username,
        userRole: row.userRole,
        action: row.action as AuditAction,
        resource: row.resource,
        resourceId: row.resourceId || undefined,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        changes: row.changesBefore || row.changesAfter ? {
          before: row.changesBefore ? JSON.parse(row.changesBefore) : undefined,
          after: row.changesAfter ? JSON.parse(row.changesAfter) : undefined,
        } : undefined,
        success: row.success,
        errorMessage: row.errorMessage || undefined,
        severity: row.severity as AuditSeverity,
        sessionId: row.sessionId || undefined,
        integrityHash: row.integrityHash,
      };

      const verified = verifyAuditLogIntegrity(entry);
      if (!verified) {
        console.error(`[SECURITY] Audit log integrity check FAILED for entry id=${row.id}`);
      }
      return Object.assign(entry, { verified });
    });
  } catch (error) {
    console.error('Failed to query audit logs:', error);
    return [];
  }
}

/**
 * Export audit logs for compliance reporting
 */
export async function exportAuditLogs(
  startDate: Date,
  endDate: Date,
  format: 'json' | 'csv' = 'json'
): Promise<string> {
  const logs = await queryAuditLogs({ startDate, endDate });
  
  if (format === 'csv') {
    // Convert to CSV format
    const headers = [
      'Timestamp',
      'User',
      'Role',
      'Action',
      'Resource',
      'Resource ID',
      'IP Address',
      'Success',
      'Severity',
      'Error Message',
    ];
    
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.username,
      log.userRole,
      log.action,
      log.resource,
      log.resourceId || '',
      log.ipAddress,
      log.success.toString(),
      log.severity,
      log.errorMessage || '',
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  // JSON format
  return JSON.stringify(logs, null, 2);
}
