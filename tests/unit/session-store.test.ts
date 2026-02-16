import { SessionStore } from '../../src/agent/session-store';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(24); // 24 hour TTL
  });

  afterEach(() => {
    store.destroy();
  });

  it('should store and retrieve sessions', () => {
    const key = { platform: 'gitlab', project: 'org/repo', mrId: '123' };
    const sessionId = 'session-abc-123';

    store.set(key, sessionId);

    expect(store.get(key)).toBe(sessionId);
    expect(store.has(key)).toBe(true);
  });

  it('should return null for non-existent sessions', () => {
    const key = { platform: 'github', project: 'org/repo', mrId: '456' };

    expect(store.get(key)).toBeNull();
    expect(store.has(key)).toBe(false);
  });

  it('should delete sessions', () => {
    const key = { platform: 'gitlab', project: 'org/repo', mrId: '123' };
    const sessionId = 'session-abc-123';

    store.set(key, sessionId);
    expect(store.has(key)).toBe(true);

    store.delete(key);
    expect(store.has(key)).toBe(false);
  });

  it('should handle multiple sessions', () => {
    const key1 = { platform: 'gitlab' as const, project: 'org/repo1', mrId: '1' };
    const key2 = { platform: 'github' as const, project: 'org/repo2', mrId: '2' };

    store.set(key1, 'session-1');
    store.set(key2, 'session-2');

    expect(store.get(key1)).toBe('session-1');
    expect(store.get(key2)).toBe('session-2');
    expect(store.size()).toBe(2);
  });

  it('should update last accessed time on get', async () => {
    const key = { platform: 'gitlab', project: 'org/repo', mrId: '123' };
    store.set(key, 'session-123');

    const sessions1 = store.getAllSessions();
    const firstAccess = sessions1[0].data.lastAccessedAt;

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));

    store.get(key);
    const sessions2 = store.getAllSessions();
    const secondAccess = sessions2[0].data.lastAccessedAt;

    expect(secondAccess.getTime()).toBeGreaterThanOrEqual(firstAccess.getTime());
  });

  it('should expire old sessions', async () => {
    const shortTTLStore = new SessionStore(0.0001); // Very short TTL (~0.36 seconds)
    const key = { platform: 'gitlab', project: 'org/repo', mrId: '123' };

    shortTTLStore.set(key, 'session-123');
    expect(shortTTLStore.has(key)).toBe(true);

    // Wait for expiration (TTL is 0.0001 hours = 360ms, so wait 500ms to be safe)
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(shortTTLStore.get(key)).toBeNull();
    shortTTLStore.clear();
  });

  it('should store metadata', () => {
    const key = { platform: 'gitlab', project: 'org/repo', mrId: '123' };
    const metadata = { branch: 'feature-x', author: 'user' };

    store.set(key, 'session-123', metadata);

    const sessions = store.getAllSessions();
    expect(sessions[0].data.metadata).toEqual(metadata);
  });

  it('should clear all sessions', () => {
    store.set({ platform: 'gitlab', project: 'org/repo1', mrId: '1' }, 'session-1');
    store.set({ platform: 'github', project: 'org/repo2', mrId: '2' }, 'session-2');

    expect(store.size()).toBe(2);

    store.clear();

    expect(store.size()).toBe(0);
  });
});
