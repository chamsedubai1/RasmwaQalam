import { randomBytes } from 'crypto';

/**
 * SECURITY ENHANCEMENT: Centralized environment variable validation and secrets management
 * Validates required secrets at startup and provides type-safe access
 */

interface AppConfig {
  // Server Configuration
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;

  // Security Secrets (each cryptographic purpose has its own key so a leak
  // of one does not compromise the others)
  JWT_SECRET: string;            // signing access tokens
  JWT_REFRESH_SECRET: string;    // signing refresh tokens
  SESSION_SECRET: string;        // express-session signing
  AUDIT_LOG_HMAC_SECRET: string; // HMAC for tamper-evident audit log integrity
  DOWNLOAD_SIGNING_SECRET: string; // HMAC for signed file download URLs

  // Database Configuration
  DATABASE_URL: string;
  
  // Optional AI Service Keys
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  HUGGING_FACE_API_KEY?: string;
  STABILITY_API_KEY?: string;

  // Qwen AI Configuration (Apache-2.0)
  QWEN_API_KEY?: string;       // API key for Qwen service
  QWEN_API_BASE?: string;      // Custom Qwen API endpoint (for self-hosted deployments)
  QWEN_IMAGE_ENDPOINT?: string; // Optional: Separate image generation endpoint

  // CORS Configuration
  ALLOWED_ORIGINS?: string;
}

class ConfigValidator {
  private config: AppConfig;
  private warnings: string[] = [];
  private errors: string[] = [];

  constructor() {
    this.config = this.loadAndValidate();
  }

  private loadAndValidate(): AppConfig {
    const env = process.env;
    
    // Validate NODE_ENV
    const nodeEnv = (env.NODE_ENV || 'development') as AppConfig['NODE_ENV'];
    if (!['development', 'production', 'test'].includes(nodeEnv)) {
      this.errors.push('NODE_ENV must be development, production, or test');
    }

    // Validate PORT
    const port = parseInt(env.PORT || '5000', 10);
    if (isNaN(port) || port < 1024 || port > 65535) {
      this.warnings.push('PORT should be between 1024 and 65535, using default 5000');
    }

    // SECURITY: Validate critical secrets
    let jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      if (nodeEnv === 'production') {
        this.errors.push('JWT_SECRET is required in production environment');
      } else {
        jwtSecret = randomBytes(32).toString('hex');
        this.warnings.push('JWT_SECRET not set, using random value (NOT suitable for production)');
      }
    } else if (jwtSecret.length < 32) {
      this.warnings.push('JWT_SECRET should be at least 32 characters for security');
    }

    let jwtRefreshSecret = env.JWT_REFRESH_SECRET;
    if (!jwtRefreshSecret) {
      if (nodeEnv === 'production') {
        this.errors.push('JWT_REFRESH_SECRET is required in production environment');
      } else {
        jwtRefreshSecret = randomBytes(32).toString('hex');
        this.warnings.push('JWT_REFRESH_SECRET not set, using random value (NOT suitable for production)');
      }
    } else if (jwtRefreshSecret.length < 32) {
      this.warnings.push('JWT_REFRESH_SECRET should be at least 32 characters for security');
    }

    let sessionSecret = env.SESSION_SECRET;
    if (!sessionSecret) {
      if (nodeEnv === 'production') {
        this.errors.push('SESSION_SECRET is required in production environment');
      } else {
        sessionSecret = randomBytes(32).toString('hex');
        this.warnings.push('SESSION_SECRET not set, using random value (NOT suitable for production)');
      }
    } else if (sessionSecret.length < 32) {
      this.warnings.push('SESSION_SECRET should be at least 32 characters for security');
    }

    // SECURITY: Per-purpose secrets. Falling back to JWT_SECRET keeps existing
    // deployments working but is logged as a warning so operators upgrade.
    let auditHmacSecret = env.AUDIT_LOG_HMAC_SECRET;
    if (!auditHmacSecret) {
      if (nodeEnv === 'production') {
        auditHmacSecret = jwtSecret;
        this.warnings.push('AUDIT_LOG_HMAC_SECRET not set; reusing JWT_SECRET (set a dedicated secret to isolate audit-log integrity)');
      } else {
        auditHmacSecret = jwtSecret;
      }
    } else if (auditHmacSecret.length < 32) {
      this.warnings.push('AUDIT_LOG_HMAC_SECRET should be at least 32 characters for security');
    }

    let downloadSigningSecret = env.DOWNLOAD_SIGNING_SECRET;
    if (!downloadSigningSecret) {
      if (nodeEnv === 'production') {
        downloadSigningSecret = jwtSecret;
        this.warnings.push('DOWNLOAD_SIGNING_SECRET not set; reusing JWT_SECRET (set a dedicated secret to isolate signed-URL keys)');
      } else {
        downloadSigningSecret = jwtSecret;
      }
    } else if (downloadSigningSecret.length < 32) {
      this.warnings.push('DOWNLOAD_SIGNING_SECRET should be at least 32 characters for security');
    }

    // Validate DATABASE_URL
    const databaseUrl = env.DATABASE_URL;
    if (!databaseUrl) {
      this.errors.push('DATABASE_URL is required');
    } else if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
      this.warnings.push('DATABASE_URL should use postgres:// or postgresql:// protocol');
    }

    // AI Service Keys (optional but warn if none are set)
    const hasAnyAIKey = !!(
      env.ANTHROPIC_API_KEY ||
      env.OPENAI_API_KEY ||
      env.HUGGING_FACE_API_KEY ||
      env.STABILITY_API_KEY ||
      env.QWEN_API_KEY
    );

    if (!hasAnyAIKey) {
      this.warnings.push('No AI service API keys configured (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)');
    }

    return {
      NODE_ENV: nodeEnv,
      PORT: port || 5000,
      JWT_SECRET: jwtSecret!,
      JWT_REFRESH_SECRET: jwtRefreshSecret!,
      SESSION_SECRET: sessionSecret!,
      AUDIT_LOG_HMAC_SECRET: auditHmacSecret!,
      DOWNLOAD_SIGNING_SECRET: downloadSigningSecret!,
      DATABASE_URL: databaseUrl!,
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      HUGGING_FACE_API_KEY: env.HUGGING_FACE_API_KEY,
      STABILITY_API_KEY: env.STABILITY_API_KEY,
      QWEN_API_KEY: env.QWEN_API_KEY,
      QWEN_API_BASE: env.QWEN_API_BASE,
      QWEN_IMAGE_ENDPOINT: env.QWEN_IMAGE_ENDPOINT,
      ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
    };
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public validate(): { valid: boolean; warnings: string[]; errors: string[] } {
    // Log warnings
    if (this.warnings.length > 0) {
      console.warn('\n⚠️  Configuration Warnings:');
      this.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    // Log errors
    if (this.errors.length > 0) {
      console.error('\n❌ Configuration Errors:');
      this.errors.forEach(error => console.error(`  - ${error}`));
    }

    const isValid = this.errors.length === 0;
    
    if (isValid && this.warnings.length === 0) {
      console.log('✅ Configuration validated successfully');
    }

    return {
      valid: isValid,
      warnings: this.warnings,
      errors: this.errors
    };
  }

  /**
   * Throws an error if configuration is invalid (has errors)
   */
  public validateOrThrow(): void {
    const result = this.validate();
    if (!result.valid) {
      throw new Error(`Invalid configuration: ${result.errors.join(', ')}`);
    }
  }
}

// Create singleton instance
const validator = new ConfigValidator();

// Export validated configuration
export const config = validator.getConfig();

// Export validation function
export function validateConfig(): void {
  validator.validateOrThrow();
}

// Auto-validate on import
validateConfig();
