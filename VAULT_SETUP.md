# HashiCorp Vault Integration Guide

## Overview

RASM wa QALAM now uses **HashiCorp Vault** for secure secrets management to meet FERPA compliance requirements. This provides:

- ✅ **Audit trails** - Track who accessed which secrets and when
- ✅ **Encryption at rest** - All secrets encrypted in Vault storage
- ✅ **Secret rotation** - Ability to rotate secrets without downtime
- ✅ **Access control** - Fine-grained policies for secret access
- ✅ **Version control** - Track secret changes over time

## Architecture

### Hybrid Approach

The platform uses a **hybrid secrets management approach**:

1. **Production/FERPA-compliant**: HashiCorp Vault (when configured)
2. **Development/Testing**: Environment variables (automatic fallback)

This ensures:
- ✅ Development is easy (no Vault setup required)
- ✅ Production is secure (Vault provides full audit trail)
- ✅ Gradual migration (can enable Vault without code changes)

## Quick Start (Development)

For local development, **no changes needed**! The platform automatically falls back to environment variables:

```bash
# Just start the server as usual
npm run dev

# You'll see this message:
# ⚠️  Vault: VAULT_ADDR not configured, using environment variables for secrets
# ℹ️  Config: Using environment variables for secrets
```

## Production Setup with HashiCorp Vault

### Option 1: HCP Vault (Recommended - Fully Managed)

HashiCorp Cloud Platform (HCP) Vault is the easiest option - no infrastructure to manage.

#### Step 1: Create HCP Vault Cluster

1. Sign up at [https://cloud.hashicorp.com](https://cloud.hashicorp.com)
2. Create a new HCP Vault cluster
3. Select tier (Development or Standard)
4. Choose your region
5. Wait for cluster to be ready (~5 minutes)

#### Step 2: Get Cluster URL and Create AppRole

After your cluster is ready:

```bash
# Install Vault CLI
brew install vault  # macOS
# or download from https://www.vaultproject.io/downloads

# Set Vault address
export VAULT_ADDR="https://your-cluster-id.vault.hashicorp.cloud:8200"
export VAULT_TOKEN="your-admin-token"  # From HCP dashboard

# Enable AppRole authentication
vault auth enable approle

# Create a policy for the application
vault policy write rasmwa-qalam-policy - <<EOF
path "secret/data/app/*" {
  capabilities = ["read", "list"]
}
EOF

# Create AppRole with the policy
vault write auth/approle/role/rasmwa-qalam-app \
  token_ttl=1h \
  token_max_ttl=4h \
  token_policies=rasmwa-qalam-policy

# Get RoleID (save this)
vault read auth/approle/role/rasmwa-qalam-app/role-id

# Generate SecretID (save this securely)
vault write -f auth/approle/role/rasmwa-qalam-app/secret-id
```

#### Step 3: Store Your Secrets in Vault

```bash
# Store JWT secrets
vault kv put secret/app/jwt-secret value="your-secure-random-jwt-secret-at-least-32-chars"
vault kv put secret/app/jwt-refresh-secret value="your-secure-random-refresh-secret-at-least-32-chars"
vault kv put secret/app/session-secret value="your-secure-random-session-secret-at-least-32-chars"

# Store database credentials
vault kv put secret/app/database-url value="postgresql://user:password@host:port/database"

# Store API keys (optional)
vault kv put secret/app/openai-api-key value="sk-..."
vault kv put secret/app/anthropic-api-key value="sk-ant-..."
vault kv put secret/app/huggingface-api-key value="hf_..."
vault kv put secret/app/stability-api-key value="sk-..."
```

#### Step 4: Configure Replit Secrets

Add these secrets to your Replit project:

```
VAULT_ADDR=https://your-cluster-id.vault.hashicorp.cloud:8200
VAULT_ROLE_ID=your-role-id-from-step-2
VAULT_SECRET_ID=your-secret-id-from-step-2
```

#### Step 5: Restart Your Application

```bash
npm run dev
```

You should see:
```
🔐 Initializing configuration and secrets management...
✅ Vault: Connected and authenticated successfully
✅ Vault: AppRole authentication successful (TTL: 3600s)
✅ Config: Using HashiCorp Vault for secrets management
```

### Option 2: Self-Hosted Vault (Advanced)

For organizations that need full control:

#### Prerequisites

- Docker or Kubernetes
- Persistent storage for Vault data
- TLS certificates for HTTPS

#### Docker Setup

```bash
# Create Vault config
cat > vault-config.hcl <<EOF
storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 0
  tls_cert_file = "/vault/certs/vault.crt"
  tls_key_file  = "/vault/certs/vault.key"
}

api_addr = "https://vault.yourdomain.com:8200"
ui = true
EOF

# Run Vault
docker run -d \
  --name vault \
  --cap-add=IPC_LOCK \
  -p 8200:8200 \
  -v $(pwd)/vault-data:/vault/data \
  -v $(pwd)/vault-certs:/vault/certs \
  -v $(pwd)/vault-config.hcl:/vault/config/vault.hcl \
  hashicorp/vault server

# Initialize Vault (FIRST TIME ONLY)
docker exec vault vault operator init

# Save the unseal keys and root token securely!

# Unseal Vault (required after every restart)
docker exec vault vault operator unseal <key-1>
docker exec vault vault operator unseal <key-2>
docker exec vault vault operator unseal <key-3>
```

Then follow Steps 2-5 from HCP Vault setup above.

## Vault Features

### 1. Audit Trail

All secret access is logged automatically:

```javascript
import { getVault } from './vault';

// Get audit log
const vault = getVault();
if (vault) {
  const auditLog = vault.getAuditLog();
  console.log('Secret access history:', auditLog);
}
```

Example audit entry:
```json
{
  "timestamp": "2025-10-22T19:42:10.000Z",
  "path": "secret/data/app/jwt-secret",
  "accessedBy": "system",
  "success": true
}
```

### 2. Secret Rotation

Update secrets without downtime:

```bash
# Update JWT secret
vault kv put secret/app/jwt-secret value="new-secret-value"

# The application will use the new secret immediately
# Old JWTs will still work until they expire
```

### 3. Dynamic Configuration

Secrets are loaded at application startup and can be refreshed:

```javascript
import { refreshSecret } from './config';

// Manually refresh a secret
const newValue = await refreshSecret('app/jwt-secret', 'JWT_SECRET');
```

### 4. Health Monitoring

Check Vault connectivity:

```javascript
import { getVault } from './vault';

const vault = getVault();
if (vault) {
  const healthy = await vault.healthCheck();
  console.log('Vault healthy:', healthy);
}
```

## Environment Variables Reference

### Development (No Vault)

```env
# Required
JWT_SECRET=your-jwt-secret-at-least-32-characters
JWT_REFRESH_SECRET=your-refresh-secret-at-least-32-characters
SESSION_SECRET=your-session-secret-at-least-32-characters
DATABASE_URL=postgresql://user:password@localhost:5432/database

# Optional
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
HUGGING_FACE_API_KEY=hf_...
STABILITY_API_KEY=sk-...
```

### Production (With Vault)

```env
# Vault Configuration
VAULT_ADDR=https://your-vault-server:8200
VAULT_ROLE_ID=your-role-id
VAULT_SECRET_ID=your-secret-id
VAULT_NAMESPACE=admin  # Optional, for Vault Enterprise

# Note: Secrets come from Vault, not environment variables
# But you can still provide fallback values if needed
```

## Migration from Environment Variables to Vault

### Step-by-Step Migration

1. **Set up Vault** (see Production Setup above)

2. **Copy existing secrets to Vault**:

```bash
# Get your current secrets
echo $JWT_SECRET
echo $JWT_REFRESH_SECRET
echo $SESSION_SECRET
echo $DATABASE_URL

# Store them in Vault
vault kv put secret/app/jwt-secret value="$JWT_SECRET"
vault kv put secret/app/jwt-refresh-secret value="$JWT_REFRESH_SECRET"
vault kv put secret/app/session-secret value="$SESSION_SECRET"
vault kv put secret/app/database-url value="$DATABASE_URL"
```

3. **Configure Vault credentials** in Replit:

```
VAULT_ADDR=https://your-vault:8200
VAULT_ROLE_ID=your-role-id
VAULT_SECRET_ID=your-secret-id
```

4. **Test the migration**:

```bash
# Restart the application
npm run dev

# Check logs for successful Vault connection
# ✅ Vault: Connected and authenticated successfully
```

5. **Remove old environment variables** (optional):

Once confirmed working, you can remove the old secrets from environment variables for added security.

## Troubleshooting

### Vault Connection Fails

**Symptom:**
```
❌ Vault: Initialization failed
⚠️  Vault: Falling back to environment variables for secrets
```

**Solutions:**
1. Check `VAULT_ADDR` is correct and accessible
2. Verify `VAULT_ROLE_ID` and `VAULT_SECRET_ID` are valid
3. Ensure Vault is unsealed (self-hosted only)
4. Check network connectivity to Vault

### Secrets Not Found

**Symptom:**
```
❌ Vault: Failed to read secret at app/jwt-secret
```

**Solutions:**
1. Verify secrets exist in Vault: `vault kv get secret/app/jwt-secret`
2. Check AppRole policy has read access to `secret/data/app/*`
3. Ensure secret path matches (use `secret/data/app/...` not `secret/app/...`)

### Token Expiration

**Symptom:**
```
❌ Vault: Token renewal failed, attempting re-authentication
```

**Solution:**
- This is normal! The application automatically renews tokens
- If re-authentication fails, check AppRole credentials

### Permission Denied

**Symptom:**
```
❌ Vault: Failed to read secret: permission denied
```

**Solution:**
Update AppRole policy to grant access:

```bash
vault policy write rasmwa-qalam-policy - <<EOF
path "secret/data/app/*" {
  capabilities = ["read", "list"]
}
EOF
```

## Security Best Practices

### 1. Never Commit Vault Credentials

```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo ".vault-token" >> .gitignore
echo "vault-credentials.txt" >> .gitignore
```

### 2. Rotate SecretIDs Regularly

```bash
# Generate new SecretID monthly
vault write -f auth/approle/role/rasmwa-qalam-app/secret-id

# Update VAULT_SECRET_ID in Replit
# Restart application
```

### 3. Use Least Privilege Policies

```hcl
# Only grant read access to required paths
path "secret/data/app/*" {
  capabilities = ["read", "list"]
}

# Don't grant write/delete unless needed
```

### 4. Monitor Audit Logs

```javascript
// Check who accessed secrets
const auditLog = await getVaultAuditLog();
const recentAccess = auditLog.filter(entry => 
  entry.timestamp > Date.now() - 24 * 60 * 60 * 1000
);
console.log('Secret access in last 24h:', recentAccess);
```

### 5. Enable Vault Audit Device

```bash
# Enable file audit logging (production)
vault audit enable file file_path=/var/log/vault/audit.log
```

## FERPA Compliance Checklist

- [x] **Audit Trail**: All secret access logged with timestamp, user, and success/failure
- [x] **Encryption at Rest**: Vault encrypts all secrets in storage
- [x] **Access Control**: Fine-grained policies control who can read which secrets
- [x] **Secret Rotation**: Ability to rotate secrets without service interruption
- [x] **Centralized Management**: Single source of truth for all secrets
- [x] **Tamper-Proof Logs**: Audit logs use HMAC integrity verification
- [x] **Fallback Mechanism**: Graceful degradation to environment variables if Vault unavailable

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Vault logs: `vault audit list`
3. Check application logs for Vault-related messages
4. Consult [Vault documentation](https://developer.hashicorp.com/vault/docs)

## Additional Resources

- [HashiCorp Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [HCP Vault](https://cloud.hashicorp.com/products/vault)
- [Vault AppRole Auth](https://developer.hashicorp.com/vault/docs/auth/approle)
- [FERPA Compliance Guide](https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html)
