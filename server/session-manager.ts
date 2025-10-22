/**
 * SECURITY ENHANCEMENT: Session timeout and automatic cleanup for inactive users
 * Tracks user sessions and automatically revokes tokens for inactive users
 */

import { revokeAllUserRefreshTokensDb } from './security';

interface UserSession {
  userId: number;
  username: string;
  lastActivity: Date;
  refreshTokenIds: Set<number>;
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
   */
  public trackActivity(userId: number, username: string): void {
    const session = this.sessions.get(userId) || {
      userId,
      username,
      lastActivity: new Date(),
      refreshTokenIds: new Set()
    };
    
    session.lastActivity = new Date();
    this.sessions.set(userId, session);
  }
  
  /**
   * Get session for a user
   */
  public getSession(userId: number): UserSession | undefined {
    return this.sessions.get(userId);
  }
  
  /**
   * Check if a user's session is still active
   */
  public isSessionActive(userId: number): boolean {
    const session = this.sessions.get(userId);
    if (!session) return false;
    
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
