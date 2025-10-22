# Vault Operations Runbook

## Overview

This runbook provides operational procedures for managing HashiCorp Vault in the RASM wa QALAM platform.

## Monitoring and Alerts

### Critical Alerts

#### 🚨 CRITICAL: Vault Token Renewal Failure

**Alert Message:**
```
🚨 CRITICAL: Vault token renewal has failed multiple times. Service may lose access to secrets.
```

**Impact:**
- Application may lose access to secrets
- Users may be unable to log in
- Service interruption possible within 1-4 hours (depends on token TTL)

**Immediate Actions:**

1. **Check Vault connectivity:**
   ```bash
   curl -k https://your-vault-addr:8200/v1/sys/health
   ```

2. **Verify Vault is unsealed:**
   ```bash
   vault status
   # Should show: Sealed = false
   ```

3. **Check application logs:**
   ```bash
   grep "VAULT_AUDIT" logs/application.log | tail -n 50
   ```

4. **Verify AppRole credentials are valid:**
   ```bash
   # Test authentication manually
   vault write auth/approle/login \
     role_id=$VAULT_ROLE_ID \
     secret_id=$VAULT_SECRET_ID
   ```

5. **If AppRole auth succeeds, restart the application:**
   ```bash
   # The application will re-authenticate on startup
   npm run dev
   ```

**Root Cause Analysis:**

Common causes:
- Vault server unreachable (network issue)
- Vault sealed (after restart or crash)
- AppRole secret-id expired
- AppRole policy changed
- Token TTL too short for application renewal cycle

#### 🚨 CRITICAL: Vault Re-authentication Failed

**Alert Message:**
```
🚨 CRITICAL: Unable to renew or re-authenticate Vault token. Immediate operator intervention required.
```

**Impact:**
- Service has lost access to Vault
- Existing JWTs will continue to work until expiration
- No new logins possible
- SEVERE: Service interruption imminent

**Immediate Actions:**

1. **EMERGENCY: Switch to environment variable mode (if configured):**
   ```bash
   # Remove Vault configuration temporarily
   unset VAULT_ADDR
   # Ensure secrets are in environment
   export JWT_SECRET="your-jwt-secret"
   export JWT_REFRESH_SECRET="your-refresh-secret"
   export SESSION_SECRET="your-session-secret"
   # Restart application
   npm run dev
   ```

2. **Debug Vault connectivity in parallel:**
   ```bash
   # Check if Vault is reachable
   nc -zv vault-server 8200
   
   # Check Vault health
   curl -k https://vault-server:8200/v1/sys/health
   
   # Check DNS resolution
   nslookup vault-server
   ```

3. **Escalate to Vault administrator if Vault is down**

4. **Once Vault is restored, switch back:**
   ```bash
   export VAULT_ADDR="https://vault-server:8200"
   export VAULT_ROLE_ID="your-role-id"
   export VAULT_SECRET_ID="your-secret-id"
   npm run dev
   ```

### Warning Alerts

#### ⚠️ Vault Secret Access Failure

**Log Pattern:**
```
❌ Vault: Failed to read secret at app/jwt-secret
```

**Impact:**
- Configuration initialization failed
- Application may have fallen back to environment variables
- Potential security policy violation (not using Vault)

**Actions:**

1. **Verify secret exists in Vault:**
   ```bash
   vault kv get secret/app/jwt-secret
   ```

2. **If secret missing, create it:**
   ```bash
   vault kv put secret/app/jwt-secret value="your-secret-value"
   ```

3. **Check AppRole policy has read permissions:**
   ```bash
   vault policy read rasmwa-qalam-policy
   ```

4. **Verify the policy grants access to the secret path:**
   ```hcl
   path "secret/data/app/*" {
     capabilities = ["read", "list"]
   }
   ```

## Routine Maintenance

### Daily Checks

1. **Review Vault audit logs:**
   ```bash
   grep "VAULT_AUDIT" logs/application.log | jq .
   ```

2. **Check for unauthorized access attempts:**
   ```bash
   grep "VAULT_AUDIT.*success.*false" logs/application.log
   ```

3. **Verify token renewal is working:**
   ```bash
   grep "Token renewed successfully" logs/application.log | tail -n 5
   ```

### Weekly Tasks

1. **Review Vault secret access patterns:**
   ```bash
   # Analyze which secrets are being accessed most frequently
   grep "VAULT_AUDIT" logs/application.log | \
     jq -r '.path' | sort | uniq -c | sort -rn
   ```

2. **Check for expiring SecretIDs:**
   ```bash
   # HCP Vault: Check in dashboard
   # Self-hosted: Check AppRole configuration
   vault read auth/approle/role/rasmwa-qalam-app
   ```

3. **Verify Vault backups are current** (self-hosted only)

### Monthly Tasks

1. **Rotate AppRole SecretID:**
   ```bash
   # Generate new SecretID
   NEW_SECRET_ID=$(vault write -f -format=json \
     auth/approle/role/rasmwa-qalam-app/secret-id | \
     jq -r '.data.secret_id')
   
   # Update in Replit Secrets
   # Update VAULT_SECRET_ID with new value
   
   # Restart application
   npm run dev
   
   # After confirming it works, the old SecretID can be revoked
   ```

2. **Review and rotate sensitive secrets:**
   ```bash
   # Rotate JWT secrets with zero-downtime
   # 1. Generate new secret
   NEW_JWT_SECRET=$(openssl rand -base64 32)
   
   # 2. Store in Vault
   vault kv put secret/app/jwt-secret-new value="$NEW_JWT_SECRET"
   
   # 3. Update application to use new secret
   # 4. Wait for all old JWTs to expire (15 minutes)
   # 5. Remove old secret
   ```

3. **Audit Vault access logs for compliance:**
   ```bash
   # Export last 30 days of Vault access
   grep "VAULT_AUDIT" logs/application-*.log > vault-audit-export.json
   
   # Analyze for FERPA compliance reporting
   cat vault-audit-export.json | jq -r \
     '[.timestamp, .accessor, .path, .success] | @csv' \
     > vault-audit-report.csv
   ```

## Troubleshooting Guide

### Problem: Application won't start

**Symptoms:**
```
Error: Configuration not initialized
```

**Solution:**
1. Check Vault configuration:
   ```bash
   echo $VAULT_ADDR
   echo $VAULT_ROLE_ID
   echo $VAULT_SECRET_ID
   ```

2. Test Vault connectivity:
   ```bash
   curl -k $VAULT_ADDR/v1/sys/health
   ```

3. If Vault unavailable, ensure fallback environment variables are set:
   ```bash
   echo $JWT_SECRET
   echo $JWT_REFRESH_SECRET
   echo $SESSION_SECRET
   ```

### Problem: Secrets not updating

**Symptoms:**
Application using old secret values after Vault update

**Solution:**
1. **Verify secret updated in Vault:**
   ```bash
   vault kv get secret/app/jwt-secret
   ```

2. **Restart application to reload secrets:**
   ```bash
   npm run dev
   ```

3. **For zero-downtime rotation, use versioned secrets:**
   ```bash
   # Application should support reading both old and new versions
   # during transition period
   ```

### Problem: Permission denied errors

**Symptoms:**
```
❌ Vault: Failed to read secret: permission denied
```

**Solution:**
1. **Check current token capabilities:**
   ```bash
   vault token lookup
   ```

2. **Verify AppRole policy:**
   ```bash
   vault policy read rasmwa-qalam-policy
   ```

3. **Update policy if needed:**
   ```bash
   vault policy write rasmwa-qalam-policy - <<EOF
   path "secret/data/app/*" {
     capabilities = ["read", "list"]
   }
   EOF
   ```

4. **Verify role uses correct policy:**
   ```bash
   vault read auth/approle/role/rasmwa-qalam-app
   ```

## Disaster Recovery

### Scenario: Vault Completely Unavailable

**Recovery Steps:**

1. **Switch to environment variable mode:**
   ```bash
   # Remove Vault configuration
   unset VAULT_ADDR
   unset VAULT_ROLE_ID
   unset VAULT_SECRET_ID
   
   # Set required secrets from secure backup
   export JWT_SECRET="..." 
   export JWT_REFRESH_SECRET="..."
   export SESSION_SECRET="..."
   export DATABASE_URL="..."
   
   # Restart application
   npm run dev
   ```

2. **Communicate to stakeholders:**
   - Service running in degraded mode
   - FERPA audit trail for secret access unavailable
   - Restore Vault as soon as possible

3. **Once Vault restored:**
   ```bash
   # Restore Vault configuration
   export VAULT_ADDR="https://vault-server:8200"
   export VAULT_ROLE_ID="your-role-id"
   export VAULT_SECRET_ID="your-secret-id"
   
   # Restart application
   npm run dev
   ```

### Scenario: Vault Sealed

**Recovery Steps:**

1. **Unseal Vault (requires unseal keys):**
   ```bash
   vault operator unseal <key-1>
   vault operator unseal <key-2>
   vault operator unseal <key-3>
   ```

2. **Verify Vault is healthy:**
   ```bash
   vault status
   # Should show: Sealed = false
   ```

3. **Application should automatically reconnect**
   - Monitor logs for successful authentication

### Scenario: Lost Vault Credentials

**Recovery Steps:**

1. **For HCP Vault:**
   - Log into HCP dashboard
   - Regenerate AppRole credentials
   - Update Replit secrets

2. **For self-hosted Vault:**
   - Use root token or admin credentials to recreate AppRole
   - Follow setup guide in VAULT_SETUP.md

3. **If root token also lost:**
   - Vault recovery procedure required (beyond scope)
   - Contact HashiCorp support
   - Consider restoring from backup

## Integration with Monitoring Systems

### Recommended Metrics to Track

1. **Vault Token TTL Remaining:**
   ```javascript
   // Log current TTL periodically
   const vault = getVault();
   if (vault) {
     console.log('Vault token TTL:', vault.tokenTTL);
   }
   ```

2. **Secret Access Rate:**
   ```javascript
   // Track secrets/minute
   const auditLog = vault.getAuditLog();
   const recentAccess = auditLog.filter(e => 
     e.timestamp > Date.now() - 60000
   );
   console.log('Secrets accessed in last minute:', recentAccess.length);
   ```

3. **Failed Secret Access Count:**
   ```javascript
   const failures = auditLog.filter(e => !e.success);
   console.log('Failed secret accesses:', failures.length);
   ```

### Alerting Integration (TODO)

```javascript
// server/monitoring/vault-alerts.ts
import { getVault } from '../vault';

export async function sendVaultAlert(severity: string, message: string, metadata: any) {
  // Integrate with your alerting system
  // Examples:
  // - PagerDuty: await pagerduty.createIncident(...)
  // - Slack: await slack.sendMessage(...)
  // - Email: await sendEmail(...)
  
  console.error(`VAULT_ALERT [${severity}]:`, message, metadata);
}

// Call from vault.ts when critical conditions detected
```

## Compliance and Audit

### FERPA Audit Requirements

1. **Export Vault access logs monthly:**
   ```bash
   ./scripts/export-vault-audit.sh 2025-10
   ```

2. **Review for unauthorized access:**
   ```bash
   grep "success.*false" vault-audit-2025-10.json
   ```

3. **Verify all accesses are from authorized services:**
   ```bash
   cat vault-audit-2025-10.json | jq -r '.accessor' | sort | uniq
   # Should only show: 'system', 'config-loader', etc.
   ```

### Required Documentation

- Monthly Vault access audit reports
- Secret rotation logs
- Incident response documentation
- Configuration change history

## Contacts

- **Vault Administrator:** [Contact info]
- **Platform SRE:** [Contact info]
- **Security Team:** [Contact info]
- **HashiCorp Support:** [For HCP Vault customers]

## References

- [VAULT_SETUP.md](./VAULT_SETUP.md) - Initial setup and configuration
- [Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [FERPA Compliance Guide](https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html)
