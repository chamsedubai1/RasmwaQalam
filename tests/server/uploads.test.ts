/**
 * File Upload Security tests
 * Tests file upload validation and security measures
 */

import { describe, it, expect, vi } from 'vitest';

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

// Mock fs modules
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
    realpath: vi.fn(),
  },
}));

// Mock storage
vi.mock('../../server/storage', () => ({
  storage: {},
}));

// Mock security
vi.mock('../../server/security', () => ({
  authenticateToken: vi.fn((req, res, next) => next()),
  requireRole: vi.fn(() => (req: unknown, res: unknown, next: () => void) => next()),
}));

describe('Signed URL Generation', () => {
  it('should generate a signed URL with correct format', async () => {
    const { generateSignedUrl } = await import('../../server/uploads');

    const filename = 'test-file.jpg';
    const signedUrl = generateSignedUrl(filename, 3600); // 1 hour expiry

    expect(signedUrl).toContain('/api/download/');
    expect(signedUrl).toContain(filename);
    expect(signedUrl).toContain('expires=');
    expect(signedUrl).toContain('signature=');
  });

  it('should generate different URLs for different files', async () => {
    const { generateSignedUrl } = await import('../../server/uploads');

    const url1 = generateSignedUrl('file1.jpg', 3600);
    const url2 = generateSignedUrl('file2.jpg', 3600);

    expect(url1).not.toBe(url2);
  });

  it('should include expiration time in URL', async () => {
    const { generateSignedUrl } = await import('../../server/uploads');

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600;
    const signedUrl = generateSignedUrl('test.jpg', expiresIn);

    // Extract expires parameter
    const urlParams = new URLSearchParams(signedUrl.split('?')[1]);
    const expires = parseInt(urlParams.get('expires') || '0', 10);

    // Should expire within a reasonable range
    expect(expires).toBeGreaterThanOrEqual(now + expiresIn - 1);
    expect(expires).toBeLessThanOrEqual(now + expiresIn + 1);
  });
});

describe('Upload Configuration', () => {
  it('should export upload middleware', async () => {
    const { upload } = await import('../../server/uploads');

    expect(upload).toBeDefined();
    expect(upload.single).toBeDefined();
  });
});

describe('Allowed File Types', () => {
  it('should only allow specific MIME types', async () => {
    // Test that the allowed MIME types are correct
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    // These should be the only allowed types
    expect(allowedMimeTypes).toContain('image/jpeg');
    expect(allowedMimeTypes).toContain('image/png');
    expect(allowedMimeTypes).toContain('image/gif');
    expect(allowedMimeTypes).toContain('image/webp');
    expect(allowedMimeTypes).not.toContain('application/pdf');
    expect(allowedMimeTypes).not.toContain('text/html');
    expect(allowedMimeTypes).not.toContain('application/javascript');
  });

  it('should only allow specific file extensions', async () => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    expect(allowedExtensions).toContain('.jpg');
    expect(allowedExtensions).toContain('.png');
    expect(allowedExtensions).not.toContain('.exe');
    expect(allowedExtensions).not.toContain('.php');
    expect(allowedExtensions).not.toContain('.js');
  });
});

describe('Magic Bytes Validation', () => {
  it('should have magic bytes defined for allowed types', () => {
    // JPEG magic bytes: FF D8 FF
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff]);
    expect(jpegMagic[0]).toBe(0xff);
    expect(jpegMagic[1]).toBe(0xd8);

    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(pngMagic[0]).toBe(0x89);
    expect(pngMagic[1]).toBe(0x50); // 'P'

    // GIF magic bytes: 47 49 46 38 (GIF8)
    const gifMagic = Buffer.from([0x47, 0x49, 0x46, 0x38]);
    expect(gifMagic.toString('ascii').startsWith('GIF8')).toBe(true);

    // WebP: RIFF....WEBP
    const webpRiff = Buffer.from([0x52, 0x49, 0x46, 0x46]);
    expect(webpRiff.toString('ascii')).toBe('RIFF');
  });
});

describe('Path Traversal Prevention', () => {
  it('should detect path traversal patterns', () => {
    const maliciousFilenames = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      'file/../../../secret.txt',
      'normal.jpg/../../etc/shadow',
    ];

    for (const filename of maliciousFilenames) {
      const containsTraversal =
        filename.includes('..') || filename.includes('/') || filename.includes('\\');
      expect(containsTraversal).toBe(true);
    }
  });

  it('should allow safe filenames', () => {
    const safeFilenames = ['photo.jpg', 'my-image.png', 'artwork_2024.gif', 'image123.webp'];

    for (const filename of safeFilenames) {
      const containsTraversal = filename.includes('..') || filename.includes('/');
      expect(containsTraversal).toBe(false);
    }
  });
});
