import { Request } from 'express';
import { storage } from './storage';
import { createHash, createHmac } from 'crypto';
import { config } from './config';

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
    before?: any;
    after?: any;
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
  
  // Data exports
  DATA_EXPORTED = 'DATA_EXPORTED',
  BULK_OPERATION = 'BULK_OPERATION',
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
  
  return createHmac('sha256', config.JWT_SECRET)
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
 */
function getRequestMetadata(req: Request): { ipAddress: string; userAgent: string; sessionId?: string } {
  return {
    ipAddress: (req.ip || req.headers['x-forwarded-for'] || 'unknown') as string,
    userAgent: req.headers['user-agent'] || 'unknown',
    sessionId: (req.session as any)?.id,
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
    changes?: { before?: any; after?: any };
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
    
    // Store in database for long-term retention and forensics
    // TODO: Implement database storage for audit logs
    // await storage.createAuditLog(fullEntry);
    
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
  return async (req: Request, _res: any, next: any) => {
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
 */
export async function queryAuditLogs(filters: {
  userId?: number;
  action?: AuditAction;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: AuditSeverity;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  // TODO: Implement database query for audit logs
  // This would query the audit_logs table with the given filters
  // For now, return empty array
  return [];
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
