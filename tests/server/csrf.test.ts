/**
 * CSRF Protection tests
 * Tests CSRF token generation and validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the config module
vi.mock('../../server/config', () => ({
  config: {
    NODE_ENV: 'test',
  },
}));

describe('CSRF Token Generation', () => {
  it('should generate a CSRF token of correct length', async () => {
    const { generateCsrfToken, CSRF_CONFIG } = await import('../../server/csrf');

    const token = generateCsrfToken();

    // Token should be hex string of CSRF_TOKEN_LENGTH * 2 (since each byte = 2 hex chars)
    expect(typeof token).toBe('string');
    expect(token.length).toBe(CSRF_CONFIG.TOKEN_LENGTH * 2);
  });

  it('should generate unique tokens each time', async () => {
    const { generateCsrfToken } = await import('../../server/csrf');

    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();

    expect(token1).not.toBe(token2);
  });
});

describe('CSRF Middleware - setCsrfToken', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      cookies: {},
    };
    mockRes = {
      cookie: vi.fn(),
      locals: {},
    };
    mockNext = vi.fn();
  });

  it('should set CSRF token cookie if not present', async () => {
    const { setCsrfToken, CSRF_CONFIG } = await import('../../server/csrf');

    setCsrfToken(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.cookie).toHaveBeenCalledWith(
      CSRF_CONFIG.COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: false, // Must be readable by JS
        sameSite: 'strict',
      })
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should not set new cookie if already present', async () => {
    const { setCsrfToken, CSRF_CONFIG } = await import('../../server/csrf');

    const existingToken = 'existing-csrf-token';
    mockReq.cookies = { [CSRF_CONFIG.COOKIE_NAME]: existingToken };

    setCsrfToken(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.cookie).not.toHaveBeenCalled();
    expect(mockRes.locals!.csrfToken).toBe(existingToken);
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('CSRF Middleware - validateCsrfToken', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/api/test',
      cookies: {},
      headers: {},
      body: {},
      ip: '127.0.0.1',
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should skip validation for GET requests', async () => {
    const { validateCsrfToken } = await import('../../server/csrf');

    mockReq.method = 'GET';

    validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should skip validation for HEAD requests', async () => {
    const { validateCsrfToken } = await import('../../server/csrf');

    mockReq.method = 'HEAD';

    validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip validation for OPTIONS requests', async () => {
    const { validateCsrfToken } = await import('../../server/csrf');

    mockReq.method = 'OPTIONS';

    validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject POST without CSRF token', async () => {
    const { validateCsrfToken } = await import('../../server/csrf');

    validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CSRF_VALIDATION_FAILED',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject mismatched tokens', async () => {
    const { validateCsrfToken, CSRF_CONFIG } = await import('../../server/csrf');

    mockReq.cookies = { [CSRF_CONFIG.COOKIE_NAME]: 'cookie-token' };
    mockReq.headers = { [CSRF_CONFIG.HEADER_NAME]: 'different-token' };

    validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should accept matching tokens in header', async () => {
    const { validateCsrfToken, CSRF_CONFIG, generateCsrfToken } = await import('../../server/csrf');

    const token = generateCsrfToken();
    mockReq.cookies = { [CSRF_CONFIG.COOKIE_NAME]: token };
    mockReq.headers = { [CSRF_CONFIG.HEADER_NAME]: token };

    validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should accept matching tokens in body', async () => {
    const { validateCsrfToken, CSRF_CONFIG, generateCsrfToken } = await import('../../server/csrf');

    const token = generateCsrfToken();
    mockReq.cookies = { [CSRF_CONFIG.COOKIE_NAME]: token };
    mockReq.body = { csrfToken: token };

    validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('CSRF Configuration Export', () => {
  it('should export correct configuration constants', async () => {
    const { CSRF_CONFIG } = await import('../../server/csrf');

    expect(CSRF_CONFIG.COOKIE_NAME).toBe('csrf_token');
    expect(CSRF_CONFIG.HEADER_NAME).toBe('x-csrf-token');
    expect(CSRF_CONFIG.TOKEN_LENGTH).toBe(32);
  });
});
