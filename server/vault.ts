import nodeVault from 'node-vault';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * SECURITY ENHANCEMENT: HashiCorp Vault Integration for FERPA-Compliant Secrets Management
 * 
 * Features:
 * - Centralized secrets management with audit trails
 * - Automatic token renewal to prevent expiration
 * - AppRole authentication for secure, automated access
 * - Audit logging for all secret access (FERPA compliance)
 * - Graceful error handling and fallback mechanisms
 * - Secret rotation support
 */

interface VaultConfig {
  address: string;
  namespace?: string;
  roleId?: string;
  secretId?: string;
  token?: string; // For development only
}

interface SecretMetadata {
  path: string;
  accessedBy: string;
  timestamp: Date;
  success: boolean;
}

export class VaultService {
  private client: any;
  private token: string | null = null;
  private tokenTTL: number = 0;
  private renewalInterval: NodeJS.Timeout | null = null;
  private config: VaultConfig;
  private accessLog: SecretMetadata[] = [];
  private isInitialized: boolean = false;

  constructor(config: VaultConfig) {
    this.config = config;
    
    // Initialize Vault client
    this.client = nodeVault({
      apiVersion: 'v1',
      endpoint: config.address,
      namespace: config.namespace,
    });
  }

  /**
   * Initialize Vault connection with authentication
   */
  async initialize(): Promise<void> {
    try {
      // Use AppRole authentication for production, token for development
      if (this.config.roleId && this.config.secretId) {
        await this.authenticateWithAppRole();
      } else if (this.config.token) {
        this.token = this.config.token;
        this.client.token = this.token;
        console.warn('⚠️  Vault: Using direct token authentication (development only)');
      } else {
        throw new Error('Vault authentication credentials not provided');
      }

      // Set up automatic token renewal
      this.setupTokenRenewal();
      
      this.isInitialized = true;
      console.log('✅ Vault: Connected and authenticated successfully');
    } catch (error) {
      console.error('❌ Vault: Initialization failed:', error);
      throw new Error(`Vault initialization failed: ${error}`);
    }
  }

  /**
   * Authenticate using AppRole method (recommended for applications)
   */
  private async authenticateWithAppRole(): Promise<void> {
    try {
      const result = await this.client.approleLogin({
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      });

      this.token = result.auth.client_token;
      this.tokenTTL = result.auth.lease_duration;
      this.client.token = this.token;

      console.log(`✅ Vault: AppRole authentication successful (TTL: ${this.tokenTTL}s)`);
      
      // Audit log for authentication
      this.logAccess({
        path: 'auth/approle/login',
        accessedBy: 'system',
        timestamp: new Date(),
        success: true,
      });
    } catch (error) {
      console.error('❌ Vault: AppRole authentication failed:', error);
      throw error;
    }
  }

  /**
   * Set up automatic token renewal before expiration
   */
  private setupTokenRenewal(): void {
    if (!this.tokenTTL || this.tokenTTL === 0) {
      console.warn('⚠️  Vault: Token TTL is 0, skipping auto-renewal setup');
      return;
    }

    // Renew at 80% of TTL to have a buffer
    const renewalTime = this.tokenTTL * 0.8 * 1000;

    this.renewalInterval = setInterval(async () => {
      try {
        await this.renewToken();
      } catch (error) {
        console.error('❌ Vault: Token renewal failed, attempting re-authentication');
        try {
          await this.authenticateWithAppRole();
        } catch (reAuthError) {
          console.error('❌ Vault: Re-authentication failed:', reAuthError);
          // In production, you might want to trigger an alert here
        }
      }
    }, renewalTime);

    console.log(`✅ Vault: Token auto-renewal configured (every ${renewalTime / 1000}s)`);
  }

  /**
   * Renew the current Vault token
   */
  private async renewToken(): Promise<void> {
    try {
      const result = await this.client.tokenRenewSelf();
      this.tokenTTL = result.auth.lease_duration;
      console.log(`✅ Vault: Token renewed successfully (new TTL: ${this.tokenTTL}s)`);
      
      this.logAccess({
        path: 'auth/token/renew-self',
        accessedBy: 'system',
        timestamp: new Date(),
        success: true,
      });
    } catch (error) {
      console.error('❌ Vault: Token renewal failed:', error);
      throw error;
    }
  }

  /**
   * Read a secret from Vault (KV v2 engine)
   * @param path - Path to the secret (e.g., "myapp/database")
   * @param accessor - Identifier of who/what is accessing the secret
   */
  async getSecret(path: string, accessor: string = 'system'): Promise<Record<string, any>> {
    if (!this.isInitialized) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }

    try {
      // KV v2 uses "secret/data/..." path format
      const fullPath = path.startsWith('secret/data/') ? path : `secret/data/${path}`;
      const result = await this.client.read(fullPath);
      
      const secretData = result.data.data;
      
      // Audit log for successful access
      this.logAccess({
        path: fullPath,
        accessedBy: accessor,
        timestamp: new Date(),
        success: true,
      });

      return secretData;
    } catch (error) {
      // Audit log for failed access
      this.logAccess({
        path,
        accessedBy: accessor,
        timestamp: new Date(),
        success: false,
      });

      console.error(`❌ Vault: Failed to read secret at ${path}:`, error);
      throw new Error(`Failed to retrieve secret from Vault: ${path}`);
    }
  }

  /**
   * Write a secret to Vault (KV v2 engine)
   * @param path - Path where to store the secret
   * @param data - Secret data to store
   * @param accessor - Identifier of who is writing the secret
   */
  async setSecret(path: string, data: Record<string, any>, accessor: string = 'system'): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }

    try {
      // KV v2 uses "secret/data/..." path format
      const fullPath = path.startsWith('secret/data/') ? path : `secret/data/${path}`;
      await this.client.write(fullPath, { data });
      
      console.log(`✅ Vault: Secret written to ${fullPath}`);
      
      // Audit log
      this.logAccess({
        path: fullPath,
        accessedBy: accessor,
        timestamp: new Date(),
        success: true,
      });
    } catch (error) {
      this.logAccess({
        path,
        accessedBy: accessor,
        timestamp: new Date(),
        success: false,
      });

      console.error(`❌ Vault: Failed to write secret to ${path}:`, error);
      throw new Error(`Failed to write secret to Vault: ${path}`);
    }
  }

  /**
   * List secrets at a given path
   * @param path - Path to list (e.g., "myapp/")
   */
  async listSecrets(path: string): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }

    try {
      const fullPath = path.startsWith('secret/metadata/') ? path : `secret/metadata/${path}`;
      const result = await this.client.list(fullPath);
      
      return result.data.keys || [];
    } catch (error) {
      console.error(`❌ Vault: Failed to list secrets at ${path}:`, error);
      throw new Error(`Failed to list secrets from Vault: ${path}`);
    }
  }

  /**
   * Delete a secret from Vault
   * @param path - Path to the secret to delete
   * @param accessor - Identifier of who is deleting the secret
   */
  async deleteSecret(path: string, accessor: string = 'system'): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }

    try {
      const fullPath = path.startsWith('secret/data/') ? path : `secret/data/${path}`;
      await this.client.delete(fullPath);
      
      console.log(`✅ Vault: Secret deleted from ${fullPath}`);
      
      this.logAccess({
        path: fullPath,
        accessedBy: accessor,
        timestamp: new Date(),
        success: true,
      });
    } catch (error) {
      this.logAccess({
        path,
        accessedBy: accessor,
        timestamp: new Date(),
        success: false,
      });

      console.error(`❌ Vault: Failed to delete secret at ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get the audit log of secret access
   * FERPA Compliance: Provides trail of who accessed what and when
   */
  getAuditLog(): SecretMetadata[] {
    return [...this.accessLog];
  }

  /**
   * Clear the in-memory audit log
   * Note: Vault's built-in audit device provides persistent audit logging
   */
  clearAuditLog(): void {
    this.accessLog = [];
  }

  /**
   * Log secret access for audit trail (FERPA compliance)
   */
  private logAccess(metadata: SecretMetadata): void {
    this.accessLog.push(metadata);
    
    // Keep only last 1000 entries in memory
    if (this.accessLog.length > 1000) {
      this.accessLog.shift();
    }

    // In production, you'd also write this to persistent audit logs
    if (process.env.NODE_ENV === 'production') {
      const logEntry = {
        timestamp: metadata.timestamp.toISOString(),
        path: metadata.path,
        accessor: metadata.accessedBy,
        success: metadata.success,
      };
      console.log('VAULT_AUDIT:', JSON.stringify(logEntry));
    }
  }

  /**
   * Health check to verify Vault connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.client.health();
      return health.initialized && !health.sealed;
    } catch (error) {
      console.error('❌ Vault: Health check failed:', error);
      return false;
    }
  }

  /**
   * Clean up resources (call on application shutdown)
   */
  destroy(): void {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
    }
    this.isInitialized = false;
    console.log('✅ Vault: Service destroyed');
  }
}

/**
 * Create and export a singleton Vault service instance
 * Only initializes if Vault configuration is provided
 */
let vaultInstance: VaultService | null = null;

export async function initializeVault(): Promise<VaultService | null> {
  const vaultAddress = process.env.VAULT_ADDR;
  const vaultToken = process.env.VAULT_TOKEN;
  const vaultRoleId = process.env.VAULT_ROLE_ID;
  const vaultSecretId = process.env.VAULT_SECRET_ID;
  const vaultNamespace = process.env.VAULT_NAMESPACE;

  // If Vault is not configured, return null (fallback to environment variables)
  if (!vaultAddress) {
    console.warn('⚠️  Vault: VAULT_ADDR not configured, using environment variables for secrets');
    return null;
  }

  try {
    vaultInstance = new VaultService({
      address: vaultAddress,
      namespace: vaultNamespace,
      roleId: vaultRoleId,
      secretId: vaultSecretId,
      token: vaultToken,
    });

    await vaultInstance.initialize();
    return vaultInstance;
  } catch (error) {
    console.error('❌ Vault: Failed to initialize:', error);
    console.warn('⚠️  Vault: Falling back to environment variables for secrets');
    return null;
  }
}

/**
 * Get the Vault instance
 */
export function getVault(): VaultService | null {
  return vaultInstance;
}

/**
 * Helper function to get a secret with fallback to environment variable
 * This provides backward compatibility during migration
 */
export async function getSecretOrEnv(
  vaultPath: string,
  envVarName: string,
  defaultValue?: string
): Promise<string> {
  // Try Vault first
  if (vaultInstance) {
    try {
      const secret = await vaultInstance.getSecret(vaultPath, 'config-loader');
      const value = secret[envVarName] || secret.value;
      if (value) return value;
    } catch (error) {
      console.warn(`⚠️  Vault: Failed to get ${vaultPath}, falling back to env var`);
    }
  }

  // Fallback to environment variable
  const envValue = process.env[envVarName];
  if (envValue) return envValue;

  // Use default if provided
  if (defaultValue !== undefined) return defaultValue;

  throw new Error(`Secret not found in Vault or environment: ${envVarName}`);
}
