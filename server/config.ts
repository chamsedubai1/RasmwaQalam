import { randomBytes } from 'crypto';
import { initializeVault, getSecretOrEnv, getVault } from './vault.js';

/**
 * SECURITY ENHANCEMENT: HashiCorp Vault Integration for FERPA-Compliant Secrets Management
 * 
 * This module provides centralized configuration and secrets management with:
 * - Primary: HashiCorp Vault for production secrets (with audit trails)
 * - Fallback: Environment variables for development
 * - Validation at startup with clear error messages
 * - Type-safe access to configuration
 * 
 * FERPA Compliance Features:
 * - Audit trail of secret access (who, what, when)
 * - Encryption at rest (Vault handles this)
 * - Secret rotation support
 * - Access control via Vault policies
 */

interface AppConfig {
  // Server Configuration
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  
  // Security Secrets
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  SESSION_SECRET: string;
  
  // Database Configuration
  DATABASE_URL: string;
  
  // Optional AI Service Keys
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  HUGGING_FACE_API_KEY?: string;
  STABILITY_API_KEY?: string;
  
  // CORS Configuration
  ALLOWED_ORIGINS?: string;
  
  // Vault Status
  VAULT_ENABLED: boolean;
}

class ConfigValidator {
  private config: AppConfig | null = null;
  private warnings: string[] = [];
  private errors: string[] = [];
  private vaultEnabled: boolean = false;

  async initialize(): Promise<void> {
    // Initialize Vault if configured
    const vault = await initializeVault();
    this.vaultEnabled = vault !== null;

    if (this.vaultEnabled) {
      console.log('✅ Config: Using HashiCorp Vault for secrets management');
    } else {
      console.log('ℹ️  Config: Using environment variables for secrets');
    }

    // Load and validate configuration
    this.config = await this.loadAndValidate();
  }

  private async loadAndValidate(): Promise<AppConfig> {
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

    // SECURITY: Load critical secrets from Vault or environment
    let jwtSecret: string;
    let jwtRefreshSecret: string;
    let sessionSecret: string;
    let databaseUrl: string;

    try {
      // Try loading from Vault with environment variable fallback
      jwtSecret = await this.getSecretWithValidation(
        'app/jwt-secret',
        'JWT_SECRET',
        nodeEnv === 'production'
      );

      jwtRefreshSecret = await this.getSecretWithValidation(
        'app/jwt-refresh-secret',
        'JWT_REFRESH_SECRET',
        nodeEnv === 'production'
      );

      sessionSecret = await this.getSecretWithValidation(
        'app/session-secret',
        'SESSION_SECRET',
        nodeEnv === 'production'
      );

      databaseUrl = await this.getSecretWithValidation(
        'app/database-url',
        'DATABASE_URL',
        true // Always required
      );

      // Validate secret lengths
      if (jwtSecret && jwtSecret.length < 32) {
        this.warnings.push('JWT_SECRET should be at least 32 characters for security');
      }
      if (jwtRefreshSecret && jwtRefreshSecret.length < 32) {
        this.warnings.push('JWT_REFRESH_SECRET should be at least 32 characters for security');
      }
      if (sessionSecret && sessionSecret.length < 32) {
        this.warnings.push('SESSION_SECRET should be at least 32 characters for security');
      }

      // Validate DATABASE_URL format
      if (databaseUrl && !databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
        this.warnings.push('DATABASE_URL should use postgres:// or postgresql:// protocol');
      }

    } catch (error) {
      this.errors.push(`Failed to load required secrets: ${error}`);
      throw error;
    }

    // Load optional AI service keys
    let anthropicApiKey: string | undefined;
    let openaiApiKey: string | undefined;
    let huggingFaceApiKey: string | undefined;
    let stabilityApiKey: string | undefined;

    try {
      anthropicApiKey = await getSecretOrEnv('app/anthropic-api-key', 'ANTHROPIC_API_KEY', '');
      openaiApiKey = await getSecretOrEnv('app/openai-api-key', 'OPENAI_API_KEY', '');
      huggingFaceApiKey = await getSecretOrEnv('app/huggingface-api-key', 'HUGGING_FACE_API_KEY', '');
      stabilityApiKey = await getSecretOrEnv('app/stability-api-key', 'STABILITY_API_KEY', '');
    } catch (error) {
      console.warn('⚠️  Failed to load AI service keys:', error);
    }

    const hasAnyAIKey = !!(anthropicApiKey || openaiApiKey || huggingFaceApiKey || stabilityApiKey);
    if (!hasAnyAIKey) {
      this.warnings.push('No AI service API keys configured (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)');
    }

    return {
      NODE_ENV: nodeEnv,
      PORT: port || 5000,
      JWT_SECRET: jwtSecret,
      JWT_REFRESH_SECRET: jwtRefreshSecret,
      SESSION_SECRET: sessionSecret,
      DATABASE_URL: databaseUrl,
      ANTHROPIC_API_KEY: anthropicApiKey || undefined,
      OPENAI_API_KEY: openaiApiKey || undefined,
      HUGGING_FACE_API_KEY: huggingFaceApiKey || undefined,
      STABILITY_API_KEY: stabilityApiKey || undefined,
      ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
      VAULT_ENABLED: this.vaultEnabled,
    };
  }

  /**
   * Get a secret from Vault or environment with validation
   */
  private async getSecretWithValidation(
    vaultPath: string,
    envVarName: string,
    required: boolean
  ): Promise<string> {
    try {
      const value = await getSecretOrEnv(vaultPath, envVarName, '');
      
      if (!value && required) {
        const nodeEnv = process.env.NODE_ENV || 'development';
        if (nodeEnv === 'production') {
          throw new Error(`${envVarName} is required in production environment`);
        } else {
          // Generate random value for development
          const randomValue = randomBytes(32).toString('hex');
          this.warnings.push(`${envVarName} not set, using random value (NOT suitable for production)`);
          return randomValue;
        }
      }

      return value;
    } catch (error) {
      if (required) {
        throw error;
      }
      return '';
    }
  }

  public getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
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

// Export async initialization function
export async function initializeConfig(): Promise<AppConfig> {
  await validator.initialize();
  validator.validateOrThrow();
  return validator.getConfig();
}

// Export synchronous getter (only works after initialization)
export function getConfig(): AppConfig {
  return validator.getConfig();
}

/**
 * Utility function to refresh a secret from Vault
 * Useful for secret rotation
 */
export async function refreshSecret(vaultPath: string, envVarName: string): Promise<string> {
  const vault = getVault();
  if (!vault) {
    console.warn('⚠️  Vault not available, cannot refresh secret');
    return process.env[envVarName] || '';
  }

  try {
    const secret = await vault.getSecret(vaultPath, 'config-refresh');
    const value = secret[envVarName] || secret.value;
    if (value) {
      console.log(`✅ Secret refreshed from Vault: ${vaultPath}`);
      return value;
    }
    throw new Error('Secret value not found in Vault response');
  } catch (error) {
    console.error(`❌ Failed to refresh secret ${vaultPath}:`, error);
    throw error;
  }
}

/**
 * Get Vault audit log for compliance reporting
 */
export function getVaultAuditLog() {
  const vault = getVault();
  if (!vault) {
    return [];
  }
  return vault.getAuditLog();
}

// Note: config is now initialized asynchronously in server/index.ts
// Do not use config directly on import - use getConfig() after initialization
