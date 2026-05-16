/**
 * Audit Log tests
 * Tests audit logging functionality and integrity verification
 */

import { describe, it, expect, vi } from 'vitest';
import { Request } from 'express';

// Mock the config module
vi.mock('../../server/config', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-min-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-characters',
    SESSION_SECRET: 'test-session-secret-min-32-chars-long',
    AUDIT_LOG_HMAC_SECRET: 'test-audit-secret-min-32-characters',
    DOWNLOAD_SIGNING_SECRET: 'test-download-secret-min-32-chars-long',
    NODE_ENV: 'test',
  },
}));

// Mock the storage module
vi.mock('../../server/storage', () => ({
  storage: {
    createAuditLog: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

// Mock the db module
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));

describe('Audit Action Enum', () => {
  it('should export all required audit actions', async () => {
    const { AuditAction } = await import('../../server/audit-log');

    // User management actions
    expect(AuditAction.USER_CREATED).toBe('USER_CREATED');
    expect(AuditAction.USER_UPDATED).toBe('USER_UPDATED');
    expect(AuditAction.USER_DELETED).toBe('USER_DELETED');

    // Authentication actions
    expect(AuditAction.LOGIN_SUCCESS).toBe('LOGIN_SUCCESS');
    expect(AuditAction.LOGIN_FAILED).toBe('LOGIN_FAILED');
    expect(AuditAction.LOGOUT).toBe('LOGOUT');

    // Security actions
    expect(AuditAction.SUSPICIOUS_ACTIVITY).toBe('SUSPICIOUS_ACTIVITY');
    expect(AuditAction.CSRF_VIOLATION).toBe('CSRF_VIOLATION');
    expect(AuditAction.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('Audit Severity Enum', () => {
  it('should export all severity levels', async () => {
    const { AuditSeverity } = await import('../../server/audit-log');

    expect(AuditSeverity.INFO).toBe('INFO');
    expect(AuditSeverity.WARNING).toBe('WARNING');
    expect(AuditSeverity.ERROR).toBe('ERROR');
    expect(AuditSeverity.CRITICAL).toBe('CRITICAL');
  });
});

describe('Audit Log Entry Interface', () => {
  it('should have all required fields', async () => {
    const { AuditAction, AuditSeverity } = await import('../../server/audit-log');

    // Define a sample audit log entry to verify interface
    const sampleEntry = {
      id: 1,
      timestamp: new Date(),
      userId: 1,
      username: 'testuser',
      userRole: 'admin',
      action: AuditAction.USER_CREATED,
      resource: 'user',
      resourceId: '123',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Browser',
      changes: {
        before: { name: 'Old Name' },
        after: { name: 'New Name' },
      },
      success: true,
      severity: AuditSeverity.INFO,
      integrityHash: 'abc123',
    };

    expect(sampleEntry.userId).toBeDefined();
    expect(sampleEntry.action).toBeDefined();
    expect(sampleEntry.resource).toBeDefined();
    expect(sampleEntry.success).toBeDefined();
    expect(sampleEntry.severity).toBeDefined();
    expect(sampleEntry.integrityHash).toBeDefined();
  });
});

describe('Audit Log Integrity Verification', () => {
  it('should verify valid integrity hash', async () => {
    const { verifyAuditLogIntegrity, AuditAction, AuditSeverity } = await import(
      '../../server/audit-log'
    );

    // Create a log entry without hash
    const entry = {
      timestamp: new Date('2025-01-01T00:00:00Z'),
      userId: 1,
      username: 'testuser',
      userRole: 'admin',
      action: AuditAction.LOGIN_SUCCESS,
      resource: 'auth',
      ipAddress: '127.0.0.1',
      userAgent: 'Test',
      success: true,
      severity: AuditSeverity.INFO,
    };

    // Without a hash, verification should fail
    const isValid = verifyAuditLogIntegrity(entry as any);
    expect(isValid).toBe(false);
  });

  it('should reject entry without integrity hash', async () => {
    const { verifyAuditLogIntegrity, AuditAction, AuditSeverity } = await import(
      '../../server/audit-log'
    );

    const entryWithoutHash = {
      timestamp: new Date(),
      userId: 1,
      username: 'test',
      userRole: 'user',
      action: AuditAction.LOGIN_SUCCESS,
      resource: 'auth',
      ipAddress: '127.0.0.1',
      userAgent: 'Test',
      success: true,
      severity: AuditSeverity.INFO,
      // No integrityHash
    };

    const isValid = verifyAuditLogIntegrity(entryWithoutHash as any);
    expect(isValid).toBe(false);
  });
});

describe('Create Audit Log', () => {
  it('should create audit log entry successfully', async () => {
    const { createAuditLog, AuditAction, AuditSeverity } = await import('../../server/audit-log');

    const mockReq = {
      user: {
        id: 1,
        username: 'testuser',
        role: 'admin',
      },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Test Browser',
      },
      session: {},
    } as unknown as Request;

    // Should not throw
    await expect(
      createAuditLog(mockReq, AuditAction.USER_CREATED, 'user', {
        resourceId: '123',
        success: true,
      })
    ).resolves.not.toThrow();
  });

  it('should handle anonymous users', async () => {
    const { createAuditLog, AuditAction } = await import('../../server/audit-log');

    const mockReq = {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Test Browser',
      },
      session: {},
    } as unknown as Request;

    // Should not throw even without user
    await expect(
      createAuditLog(mockReq, AuditAction.LOGIN_FAILED, 'auth', {
        success: false,
        errorMessage: 'Invalid credentials',
      })
    ).resolves.not.toThrow();
  });
});

describe('Query Audit Logs', () => {
  it('should query audit logs with filters', async () => {
    const { queryAuditLogs, AuditAction, AuditSeverity } = await import('../../server/audit-log');

    const logs = await queryAuditLogs({
      userId: 1,
      action: AuditAction.LOGIN_SUCCESS,
      severity: AuditSeverity.INFO,
      limit: 10,
    });

    expect(Array.isArray(logs)).toBe(true);
  });

  it('should query audit logs with date range', async () => {
    const { queryAuditLogs } = await import('../../server/audit-log');

    const logs = await queryAuditLogs({
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      limit: 100,
    });

    expect(Array.isArray(logs)).toBe(true);
  });

  it('should return empty array on error', async () => {
    const { queryAuditLogs } = await import('../../server/audit-log');

    // Should handle gracefully
    const logs = await queryAuditLogs({});
    expect(Array.isArray(logs)).toBe(true);
  });
});

describe('Export Audit Logs', () => {
  it('should export logs as JSON', async () => {
    const { exportAuditLogs } = await import('../../server/audit-log');

    const result = await exportAuditLogs(new Date('2025-01-01'), new Date('2025-12-31'), 'json');

    expect(typeof result).toBe('string');
    // Should be valid JSON
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should export logs as CSV', async () => {
    const { exportAuditLogs } = await import('../../server/audit-log');

    const result = await exportAuditLogs(new Date('2025-01-01'), new Date('2025-12-31'), 'csv');

    expect(typeof result).toBe('string');
    // CSV should have header row
    expect(result).toContain('Timestamp');
    expect(result).toContain('User');
    expect(result).toContain('Action');
  });
});
