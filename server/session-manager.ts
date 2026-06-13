/**
 * SECURITY ENHANCEMENT: Session timeout and automatic cleanup for inactive users.
 * Tracks user sessions and automatically revokes tokens for inactive users.
 *
 * KNOWN LIMITATION (in-memory only):
 *   The session map is local to this Node process. Consequences:
 *     - Server restart wipes all bindings. A stolen access token presented
 *       as the first request after a restart will be re-bound to the
 *       attacker's IP/User-Agent, defeating the purpose of the binding.
 *     - Multi-instance deployments have separate maps and cannot enforce
 *       binding across instances.
 *   For a strict deployment, back this with Redis (a `redis` client is
 *   already a dependency) keyed by userId, with a TTL matching
 *   SESSION_TIMEOUT_MS.
 */

import { revokeAllUserRefreshTokensDb } from './security';

interface UserSession {
  userId: number;
  username: string;
  lastActivity: Date;
  // SECURITY: Session binding to detect token theft (best-effort while
  // the map is in-memory; see file header).
  ipAddress?: string;
  userAgent?: string;
}

class SessionManager {
  private sessions: Map<number, UserSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
  
  constructor() {
    this.startCleanupInterval();
    console.log('Session manager initialized');
  }
  
  /**
   * Track user activity (login, API calls, etc.)
   * SECURITY ENHANCEMENT: Now tracks IP address and User-Agent for session binding
   */
  public trackActivity(userId: number, username: string, ipAddress?: string, userAgent?: string): void {
    const existingSession = this.sessions.get(userId);

    const session: UserSession = existingSession || {
      userId,
      username,
      lastActivity: new Date(),
      ipAddress: undefined,
      userAgent: undefined,
    };

    session.lastActivity = new Date();

    // SECURITY: Bind session to initial IP/User-Agent on first activity
    if (!session.ipAddress && ipAddress) {
      session.ipAddress = ipAddress;
    }
    if (!session.userAgent && userAgent) {
      session.userAgent = userAgent;
    }

    this.sessions.set(userId, session);
  }

  /**
   * SECURITY: Validate that request matches the session binding
   * Returns true if session is valid, false if there's a potential session hijacking attempt
   */
  public validateSessionBinding(userId: number, ipAddress?: string, userAgent?: string): { valid: boolean; reason?: string } {
    const session = this.sessions.get(userId);

    if (!session) {
      return { valid: true }; // No session to validate against
    }

    // SECURITY: Check if IP address has changed significantly
    // Note: We allow some flexibility for users behind dynamic IPs or corporate proxies
    if (session.ipAddress && ipAddress && session.ipAddress !== ipAddress) {
      console.warn(`[SECURITY] IP address change detected for user ${userId}: ${session.ipAddress} -> ${ipAddress}`);
      // Log the change but don't block - could be legitimate (mobile networks, VPN changes)
      // In strict mode, you could return { valid: false, reason: 'ip_changed' }
    }

    // SECURITY: Check if User-Agent has changed completely
    // This is more suspicious than IP changes and could indicate token theft
    if (session.userAgent && userAgent && session.userAgent !== userAgent) {
      console.warn(`[SECURITY] User-Agent change detected for user ${userId}`);
      // SECURITY: User-Agent change is highly suspicious - likely token theft
      return { valid: false, reason: 'user_agent_changed' };
    }

    return { valid: true };
  }
  
  /**
   * Get session for a user
   */
  public getSession(userId: number): UserSession | undefined {
    return this.sessions.get(userId);
  }
  
  /**
   * Check if a user's session is still active.
   *
   * IMPORTANT: "no session" is treated as ACTIVE, not expired. A fresh login
   * or a server restart leaves the in-memory map empty for that user; if we
   * returned false here, authenticateToken would reject the very first
   * authenticated request (with a still-valid JWT) and force a pointless
   * re-login loop. trackActivity() is called later in the same middleware
   * so the session gets created on first touch.
   *
   * Only returns false when a session DOES exist and its last activity is
   * older than SESSION_TIMEOUT_MS — that's the real "inactive" condition
   * we want to enforce.
   */
  public isSessionActive(userId: number): boolean {
    const session = this.sessions.get(userId);
    if (!session) return true;

    const inactiveTime = Date.now() - session.lastActivity.getTime();
    return inactiveTime < this.SESSION_TIMEOUT_MS;
  }
  
  /**
   * Manually end a user's session
   */
  public async endSession(userId: number, reason: string = 'manual_logout'): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      // Revoke all refresh tokens for this user
      const revokedCount = await revokeAllUserRefreshTokensDb(userId, reason);
      console.log(`Session ended for user ${userId}: ${revokedCount} tokens revoked (${reason})`);
      
      // Remove session
      this.sessions.delete(userId);
    }
  }
  
  /**
   * Clean up inactive sessions
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const inactiveSessions: number[] = [];
    
    // Find inactive sessions
    for (const [userId, session] of this.sessions.entries()) {
      const inactiveTime = now - session.lastActivity.getTime();
      
      if (inactiveTime >= this.SESSION_TIMEOUT_MS) {
        inactiveSessions.push(userId);
      }
    }
    
    // End inactive sessions
    if (inactiveSessions.length > 0) {
      console.log(`Cleaning up ${inactiveSessions.length} inactive session(s)`);
      
      for (const userId of inactiveSessions) {
        await this.endSession(userId, 'session_timeout');
      }
    }
  }
  
  /**
   * Start the cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions().catch(error => {
        console.error('Error during session cleanup:', error);
      });
    }, this.CLEANUP_INTERVAL_MS);
  }
  
  /**
   * Stop the session manager
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('Session manager stopped');
  }
  
  /**
   * Get session statistics
   */
  public getStats(): { totalSessions: number; activeSessions: number; inactiveSessions: number } {
    const now = Date.now();
    let activeSessions = 0;
    let inactiveSessions = 0;
    
    for (const session of this.sessions.values()) {
      const inactiveTime = now - session.lastActivity.getTime();
      if (inactiveTime < this.SESSION_TIMEOUT_MS) {
        activeSessions++;
      } else {
        inactiveSessions++;
      }
    }
    
    return {
      totalSessions: this.sessions.size,
      activeSessions,
      inactiveSessions
    };
  }
}

// Create singleton instance
export const sessionManager = new SessionManager();
