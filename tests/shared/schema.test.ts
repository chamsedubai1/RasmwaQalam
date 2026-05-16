/**
 * Schema validation tests
 * Tests Zod schemas for input validation
 */

import { describe, it, expect } from 'vitest';
import {
  insertUserSchema,
  insertEventSchema,
  insertSubmissionSchema,
  insertSchoolSchema,
  insertCitySchema,
  insertClassSchema,
} from '@shared/schema';

describe('User Schema Validation', () => {
  it('should accept valid user data', () => {
    const validUser = {
      username: 'testuser',
      password: 'SecurePass1!@',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'student',
      isActive: true,
    };

    const result = insertUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it('should reject password without uppercase', () => {
    const invalidUser = {
      username: 'testuser',
      password: 'securepass1!@', // no uppercase
      email: 'test@example.com',
      fullName: 'Test User',
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it('should reject password without number', () => {
    const invalidUser = {
      username: 'testuser',
      password: 'SecurePass!@', // no number
      email: 'test@example.com',
      fullName: 'Test User',
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it('should reject password without special characters', () => {
    const invalidUser = {
      username: 'testuser',
      password: 'SecurePass123', // no special chars
      email: 'test@example.com',
      fullName: 'Test User',
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const invalidUser = {
      username: 'testuser',
      password: 'Sp1!@', // too short
      email: 'test@example.com',
      fullName: 'Test User',
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const invalidUser = {
      username: 'testuser',
      password: 'SecurePass1!@',
      email: 'not-an-email',
      fullName: 'Test User',
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it('should reject short username', () => {
    const invalidUser = {
      username: 'ab', // too short
      password: 'SecurePass1!@',
      email: 'test@example.com',
      fullName: 'Test User',
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it('should reject long username', () => {
    const invalidUser = {
      username: 'a'.repeat(51), // too long
      password: 'SecurePass1!@',
      email: 'test@example.com',
      fullName: 'Test User',
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });
});

describe('City Schema Validation', () => {
  it('should accept valid city data', () => {
    const validCity = {
      name: 'Dubai',
      country: 'UAE',
      isActive: true,
    };

    const result = insertCitySchema.safeParse(validCity);
    expect(result.success).toBe(true);
  });

  it('should reject empty city name', () => {
    const invalidCity = {
      name: '',
      country: 'UAE',
    };

    const result = insertCitySchema.safeParse(invalidCity);
    expect(result.success).toBe(false);
  });

  it('should reject city name exceeding max length', () => {
    const invalidCity = {
      name: 'a'.repeat(101),
      country: 'UAE',
    };

    const result = insertCitySchema.safeParse(invalidCity);
    expect(result.success).toBe(false);
  });
});

describe('School Schema Validation', () => {
  it('should accept valid school data', () => {
    const validSchool = {
      name: 'Test School',
      description: 'A test school',
      cityId: 1,
      isActive: true,
    };

    const result = insertSchoolSchema.safeParse(validSchool);
    expect(result.success).toBe(true);
  });

  it('should reject short school name', () => {
    const invalidSchool = {
      name: 'A',
      cityId: 1,
    };

    const result = insertSchoolSchema.safeParse(invalidSchool);
    expect(result.success).toBe(false);
  });

  it('should reject school name exceeding max length', () => {
    const invalidSchool = {
      name: 'a'.repeat(201),
      cityId: 1,
    };

    const result = insertSchoolSchema.safeParse(invalidSchool);
    expect(result.success).toBe(false);
  });

  it('should reject description exceeding max length', () => {
    const invalidSchool = {
      name: 'Test School',
      description: 'a'.repeat(2001),
      cityId: 1,
    };

    const result = insertSchoolSchema.safeParse(invalidSchool);
    expect(result.success).toBe(false);
  });
});

describe('Class Schema Validation', () => {
  it('should accept valid class data', () => {
    const validClass = {
      name: 'Grade 5A',
      gradeLevel: 'Grade 5',
      schoolId: 1,
      teacherId: 1,
    };

    const result = insertClassSchema.safeParse(validClass);
    expect(result.success).toBe(true);
  });

  it('should reject empty class name', () => {
    const invalidClass = {
      name: '',
      gradeLevel: 'Grade 5',
      schoolId: 1,
    };

    const result = insertClassSchema.safeParse(invalidClass);
    expect(result.success).toBe(false);
  });
});

describe('Event Schema Validation', () => {
  it('should accept valid event data', () => {
    const validEvent = {
      name: 'Poetry Competition',
      description: 'Annual poetry contest',
      type: 'poetry',
      status: 'open',
      stage: 'class',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    };

    const result = insertEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('should reject short event name', () => {
    const invalidEvent = {
      name: 'AB',
      type: 'poetry',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    };

    const result = insertEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });

  it('should reject event name exceeding max length', () => {
    const invalidEvent = {
      name: 'a'.repeat(201),
      type: 'poetry',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    };

    const result = insertEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });
});

describe('Submission Schema Validation', () => {
  it('should accept valid submission data', () => {
    const validSubmission = {
      title: 'My Poem',
      description: 'A beautiful poem about spring',
      content: 'Roses are red, violets are blue...',
      contentType: 'text',
      userId: 1,
      eventId: 1,
    };

    const result = insertSubmissionSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it('should reject empty title', () => {
    const invalidSubmission = {
      title: '',
      content: 'Some content',
      contentType: 'text',
      userId: 1,
      eventId: 1,
    };

    const result = insertSubmissionSchema.safeParse(invalidSubmission);
    expect(result.success).toBe(false);
  });

  it('should reject title exceeding max length', () => {
    const invalidSubmission = {
      title: 'a'.repeat(201),
      content: 'Some content',
      contentType: 'text',
      userId: 1,
      eventId: 1,
    };

    const result = insertSubmissionSchema.safeParse(invalidSubmission);
    expect(result.success).toBe(false);
  });
});
