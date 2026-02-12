/**
 * Session identifier
 */
export interface SessionKey {
  platform: string;
  project: string;
  mrId: string;
}

/**
 * Session data
 */
export interface SessionData {
  /** Claude Agent SDK session ID */
  sessionId: string;
  /** When the session was created */
  createdAt: Date;
  /** When the session was last accessed */
  lastAccessedAt: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * In-memory session store
 * Tracks Claude Agent SDK sessions for MRs/PRs to enable context resumption
 */
export class SessionStore {
  private sessions = new Map<string, SessionData>();
  private ttlMs: number;

  constructor(ttlHours: number = 24) {
    this.ttlMs = ttlHours * 60 * 60 * 1000;

    // Start cleanup interval (every hour)
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Store a session
   */
  set(key: SessionKey, sessionId: string, metadata?: Record<string, unknown>): void {
    const now = new Date();
    const sessionKey = this.keyToString(key);

    this.sessions.set(sessionKey, {
      sessionId,
      createdAt: now,
      lastAccessedAt: now,
      metadata,
    });
  }

  /**
   * Get a session
   * Returns null if not found or expired
   */
  get(key: SessionKey): string | null {
    const sessionKey = this.keyToString(key);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return null;
    }

    // Check if expired
    const age = Date.now() - session.createdAt.getTime();
    if (age > this.ttlMs) {
      this.sessions.delete(sessionKey);
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = new Date();

    return session.sessionId;
  }

  /**
   * Check if a session exists
   */
  has(key: SessionKey): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a session
   */
  delete(key: SessionKey): void {
    const sessionKey = this.keyToString(key);
    this.sessions.delete(sessionKey);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): Array<{ key: string; data: SessionData }> {
    const now = Date.now();

    return Array.from(this.sessions.entries())
      .filter(([, session]) => {
        const age = now - session.createdAt.getTime();
        return age <= this.ttlMs;
      })
      .map(([key, data]) => ({ key, data }));
  }

  /**
   * Clean up expired sessions
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, session] of this.sessions.entries()) {
      const age = now - session.createdAt.getTime();
      if (age > this.ttlMs) {
        this.sessions.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired sessions`);
    }
  }

  /**
   * Convert session key to string
   */
  private keyToString(key: SessionKey): string {
    return `${key.platform}:${key.project}:${key.mrId}`;
  }

  /**
   * Get session count (for monitoring)
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * Clear all sessions (for testing)
   */
  clear(): void {
    this.sessions.clear();
  }
}
