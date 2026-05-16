/**
 * WebSocket channel authorization tests
 * Covers the security fix for issue C1: any authenticated user could
 * previously SUBSCRIBE to any channel, including `admin` and other users'
 * scoped channels. authorizeChannel must allow only the scoped owner.
 */

import { describe, it, expect, vi } from 'vitest';

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

vi.mock('../../server/storage', () => ({
  storage: { getUser: vi.fn() },
}));

vi.mock('../../server/monitoring', () => ({
  monitoring: {
    trackWebSocketConnection: vi.fn(),
    trackWebSocketDisconnection: vi.fn(),
    trackWebSocketMessageSent: vi.fn(),
    trackWebSocketMessageReceived: vi.fn(),
  },
}));

const student = { userId: 42, userRole: 'student', classId: 7, schoolId: 3 } as const;
const otherStudent = { userId: 99, userRole: 'student', classId: 8, schoolId: 4 } as const;
const teacher = { userId: 12, userRole: 'teacher', classId: null, schoolId: 3 } as const;
const admin = { userId: 1, userRole: 'admin', classId: null, schoolId: null } as const;

describe('authorizeChannel', () => {
  it('admin channel: only admins allowed', async () => {
    const { authorizeChannel } = await import('../../server/services/websocket');
    expect(authorizeChannel('admin', admin).ok).toBe(true);
    expect(authorizeChannel('admin', student).ok).toBe(false);
    expect(authorizeChannel('admin', teacher).ok).toBe(false);
  });

  it('user channel: only the owning user can subscribe', async () => {
    const { authorizeChannel } = await import('../../server/services/websocket');
    expect(authorizeChannel('user:42', student).ok).toBe(true);
    expect(authorizeChannel('user_42', student).ok).toBe(true);
    expect(authorizeChannel('user:99', student).ok).toBe(false);
    expect(authorizeChannel('user:42', otherStudent).ok).toBe(false);
  });

  it('class channel: only members, teachers, admins allowed', async () => {
    const { authorizeChannel } = await import('../../server/services/websocket');
    expect(authorizeChannel('class:7', student).ok).toBe(true);
    expect(authorizeChannel('class:8', student).ok).toBe(false);
    expect(authorizeChannel('class:99', teacher).ok).toBe(true);
    expect(authorizeChannel('class:99', admin).ok).toBe(true);
  });

  it('school channel: only members and admins allowed', async () => {
    const { authorizeChannel } = await import('../../server/services/websocket');
    expect(authorizeChannel('school:3', student).ok).toBe(true);
    expect(authorizeChannel('school:4', student).ok).toBe(false);
    expect(authorizeChannel('school:4', admin).ok).toBe(true);
  });

  it('event channel: any authenticated user', async () => {
    const { authorizeChannel } = await import('../../server/services/websocket');
    expect(authorizeChannel('event:1', student).ok).toBe(true);
    expect(authorizeChannel('event_42', otherStudent).ok).toBe(true);
  });

  it('rejects unknown or malformed channel names', async () => {
    const { authorizeChannel } = await import('../../server/services/websocket');
    expect(authorizeChannel('', student).ok).toBe(false);
    expect(authorizeChannel('foo:1', student).ok).toBe(false);
    expect(authorizeChannel('user:abc', student).ok).toBe(false);
    expect(authorizeChannel('user:-1', student).ok).toBe(false);
    expect(authorizeChannel('a'.repeat(200), student).ok).toBe(false);
  });
});
