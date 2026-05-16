/**
 * Test setup file for Vitest
 * Configures global test utilities and mocks
 */

import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters';
process.env.SESSION_SECRET = 'test-session-secret-min-32-chars';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Global test setup
beforeAll(() => {
  // Setup that runs before all tests
  console.log('Starting test suite...');
});

afterAll(() => {
  // Cleanup that runs after all tests
  console.log('Test suite completed.');
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock console methods in tests to reduce noise (optional)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
