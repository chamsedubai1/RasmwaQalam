/**
 * Security module tests
 * Tests password hashing, JWT tokens, and authentication utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the config module before importing security
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
    getUser: vi.fn(),
  },
}));

// Mock the db module
vi.mock('../../server/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    }),
  },
}));

// Mock session-manager
vi.mock('../../server/session-manager', () => ({
  sessionManager: {
    isSessionActive: vi.fn().mockReturnValue(true),
    trackActivity: vi.fn(),
  },
}));

describe('Password Hashing', () => {
  it('should hash a password and verify it correctly', async () => {
    const { hashPassword, verifyPassword } = await import('../../server/security');

    const password = 'SecurePass123!@';
    const hashedPassword = await hashPassword(password);

    // Hash should be different from original
    expect(hashedPassword).not.toBe(password);

    // Hash should contain the salt separator
    expect(hashedPassword).toContain('.');

    // Verification should succeed
    const isValid = await verifyPassword(password, hashedPassword);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const { hashPassword, verifyPassword } = await import('../../server/security');

    const password = 'SecurePass123!@';
    const wrongPassword = 'WrongPassword123!@';
    const hashedPassword = await hashPassword(password);

    const isValid = await verifyPassword(wrongPassword, hashedPassword);
    expect(isValid).toBe(false);
  });

  it('should generate different hashes for same password', async () => {
    const { hashPassword } = await import('../../server/security');

    const password = 'SecurePass123!@';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Different salts should produce different hashes
    expect(hash1).not.toBe(hash2);
  });

  it('should handle invalid hash format gracefully', async () => {
    const { verifyPassword } = await import('../../server/security');

    const isValid = await verifyPassword('password', 'invalid-hash-no-separator');
    expect(isValid).toBe(false);
  });
});

describe('JWT Token Generation', () => {
  it('should generate valid auth tokens', async () => {
    const { generateAuthTokens } = await import('../../server/security');

    const user = {
      id: 1,
      username: 'testuser',
      role: 'student',
      schoolId: 1,
      classId: 1,
    };

    const tokens = await generateAuthTokens(user);

    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
    expect(tokens).toHaveProperty('expiresIn');
    expect(tokens.expiresIn).toBe(15 * 60); // 15 minutes in seconds
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
  });

  it('should generate different tokens each time', async () => {
    const { generateAuthTokens } = await import('../../server/security');

    const user = {
      id: 1,
      username: 'testuser',
      role: 'student',
    };

    const tokens1 = await generateAuthTokens(user);
    const tokens2 = await generateAuthTokens(user);

    expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
    expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
  });
});

describe('JWT Token Verification', () => {
  it('should verify valid access token', async () => {
    const { generateAuthTokens, verifyAccessToken } = await import('../../server/security');

    const user = {
      id: 1,
      username: 'testuser',
      role: 'student',
      schoolId: 1,
    };

    const tokens = await generateAuthTokens(user);
    const decoded = await verifyAccessToken(tokens.accessToken);

    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(user.id);
    expect(decoded?.username).toBe(user.username);
    expect(decoded?.role).toBe(user.role);
  });

  it('should reject invalid access token', async () => {
    const { verifyAccessToken } = await import('../../server/security');

    const decoded = await verifyAccessToken('invalid.token.here');
    expect(decoded).toBeNull();
  });

  it('should reject tampered token', async () => {
    const { generateAuthTokens, verifyAccessToken } = await import('../../server/security');

    const user = {
      id: 1,
      username: 'testuser',
      role: 'student',
    };

    const tokens = await generateAuthTokens(user);
    const tamperedToken = tokens.accessToken.slice(0, -5) + 'xxxxx';

    const decoded = await verifyAccessToken(tamperedToken);
    expect(decoded).toBeNull();
  });
});

describe('Refresh Token Verification', () => {
  it('should verify valid refresh token', async () => {
    const { generateAuthTokens, verifyRefreshToken } = await import('../../server/security');

    const user = {
      id: 1,
      username: 'testuser',
      role: 'student',
    };

    const tokens = await generateAuthTokens(user);
    const userId = await verifyRefreshToken(tokens.refreshToken);

    expect(userId).toBe(user.id);
  });

  it('should reject invalid refresh token', async () => {
    const { verifyRefreshToken } = await import('../../server/security');

    const userId = await verifyRefreshToken('invalid.refresh.token');
    expect(userId).toBeNull();
  });
});

describe('Rate Limiters', () => {
  it('should export rate limiter configurations', async () => {
    const { loginRateLimiter, registrationRateLimiter, passwordResetRateLimiter, apiRateLimiter } =
      await import('../../server/security');

    expect(loginRateLimiter).toBeDefined();
    expect(registrationRateLimiter).toBeDefined();
    expect(passwordResetRateLimiter).toBeDefined();
    expect(apiRateLimiter).toBeDefined();
  });
});

describe('Cookie Configuration', () => {
  it('should export secure cookie configuration', async () => {
    const { COOKIE_CONFIG } = await import('../../server/security');

    expect(COOKIE_CONFIG).toBeDefined();
    expect(COOKIE_CONFIG.ACCESS_TOKEN).toBe('access_token');
    expect(COOKIE_CONFIG.REFRESH_TOKEN).toBe('refresh_token');
    expect(COOKIE_CONFIG.OPTIONS.httpOnly).toBe(true);
    expect(COOKIE_CONFIG.OPTIONS.sameSite).toBe('strict');
  });
});
