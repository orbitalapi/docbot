import { EventRouter } from '../../src/webhook/router';
import { PlatformResolver } from '../../src/platform/resolver';
import { SessionStore } from '../../src/agent/session-store';
import { TaskQueue } from '../../src/queue/task-queue';
import { MockPlatform } from '../mocks/platform.mock';
import { MockGitManager } from '../mocks/git.mock';
import { PlatformEvent } from '../../src/platform/interface';

// Mock the agent orchestrator to avoid real API calls
jest.mock('../../src/agent/orchestrator', () => {
  return {
    AgentOrchestrator: jest.fn().mockImplementation(() => ({
      run: jest.fn().mockResolvedValue({
        response: 'Mock agent response',
        sessionId: 'mock-session-123',
        cost: 0.05,
        turns: 1,
      }),
    })),
  };
});

// Mock fs to avoid actual file operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(`
trigger:
  mode: hybrid
model: claude-sonnet-4-5-20250929
max_turns: 20
docs:
  - source_patterns: ["src/**"]
    docs_path: docs/
    mode: same-repo
`),
  mkdtemp: jest.fn().mockResolvedValue('/tmp/test-dir'),
  rm: jest.fn().mockResolvedValue(undefined),
}));

describe('EventRouter', () => {
  let router: EventRouter;
  let mockPlatform: MockPlatform;
  let platformResolver: PlatformResolver;
  let gitManager: MockGitManager;
  let sessionStore: SessionStore;
  let taskQueue: TaskQueue;

  beforeEach(() => {
    mockPlatform = new MockPlatform('gitlab');
    platformResolver = new PlatformResolver([mockPlatform]);
    gitManager = new MockGitManager();
    sessionStore = new SessionStore(24);
    taskQueue = new TaskQueue(3);

    router = new EventRouter(
      platformResolver,
      gitManager,
      sessionStore,
      taskQueue,
      'test-api-key'
    );
  });

  afterEach(() => {
    mockPlatform.reset();
    gitManager.reset();
    sessionStore.clear();
    taskQueue.clear();
  });

  describe('Slash Command Parsing', () => {
    it('should parse /doc-bot help command', () => {
      const parseMethod = (router as any).parseSlashCommand.bind(router);

      const result = parseMethod('/doc-bot help');

      expect(result).toEqual({ command: 'help', args: undefined });
    });

    it('should parse /doc-bot update with arguments', () => {
      const parseMethod = (router as any).parseSlashCommand.bind(router);

      const result = parseMethod('/doc-bot update — focus on API docs');

      expect(result).toEqual({
        command: 'update',
        args: '— focus on API docs',
      });
    });

    it('should parse /doc-bot revise with feedback', () => {
      const parseMethod = (router as any).parseSlashCommand.bind(router);

      const result = parseMethod('/doc-bot revise please make it more concise');

      expect(result).toEqual({
        command: 'revise',
        args: 'please make it more concise',
      });
    });

    it('should return null for invalid commands', () => {
      const parseMethod = (router as any).parseSlashCommand.bind(router);

      expect(parseMethod('just a normal comment')).toBeNull();
      expect(parseMethod('/doc-bot invalid-command')).toBeNull();
    });

    it('should be case insensitive', () => {
      const parseMethod = (router as any).parseSlashCommand.bind(router);

      const result = parseMethod('/DOC-BOT REVIEW');

      expect(result).toEqual({ command: 'review', args: undefined });
    });
  });

  describe('Event Routing', () => {
    it('should route MR opened event', async () => {
      const event: PlatformEvent = {
        type: 'mr_opened',
        platform: 'gitlab',
        project: 'org/repo',
        mrId: '123',
        sourceBranch: 'feature-x',
        targetBranch: 'main',
        repoUrl: 'https://gitlab.com/org/repo.git',
        eventId: 'event-1',
      };

      mockPlatform.mockDiff = 'diff --git a/src/test.ts b/src/test.ts';

      await router.route(event);

      // Wait for async task to complete
      await taskQueue.drain();

      // Should have called getDiff
      expect(mockPlatform.calls.getDiff).toBeGreaterThan(0);
    });

    it('should route comment event with slash command', async () => {
      const event: PlatformEvent = {
        type: 'comment',
        platform: 'gitlab',
        project: 'org/repo',
        mrId: '123',
        sourceBranch: 'feature-x',
        targetBranch: 'main',
        commentBody: '/doc-bot help',
        commentAuthor: 'user',
        repoUrl: 'https://gitlab.com/org/repo.git',
        eventId: 'event-2',
      };

      await router.route(event);

      // Wait for async task
      await taskQueue.drain();

      // Should have posted help comment
      expect(mockPlatform.calls.postComment).toBeGreaterThan(0);
      const lastComment = mockPlatform.getLastComment();
      expect(lastComment).toContain('Doc-Bot Help');
    });

    it('should ignore events from unknown platforms', async () => {
      const event: PlatformEvent = {
        type: 'mr_opened',
        platform: 'github', // Not registered
        project: 'org/repo',
        mrId: '123',
        sourceBranch: 'feature-x',
        targetBranch: 'main',
        repoUrl: 'https://github.com/org/repo.git',
        eventId: 'event-3',
      };

      await router.route(event);

      // Should not have made any platform calls
      expect(mockPlatform.calls.getDiff).toBe(0);
    });
  });

  describe('Status Command', () => {
    it('should show status when no session exists', async () => {
      const event: PlatformEvent = {
        type: 'comment',
        platform: 'gitlab',
        project: 'org/repo',
        mrId: '123',
        sourceBranch: 'feature-x',
        targetBranch: 'main',
        commentBody: '/doc-bot status',
        commentAuthor: 'user',
        repoUrl: 'https://gitlab.com/org/repo.git',
        eventId: 'event-4',
      };

      await router.route(event);
      await taskQueue.drain();

      const lastComment = mockPlatform.getLastComment();
      expect(lastComment).toContain('No active session');
    });

    it('should show status when session exists', async () => {
      // Set up a session
      sessionStore.set(
        { platform: 'gitlab', project: 'org/repo', mrId: '123' },
        'session-abc-123'
      );

      const event: PlatformEvent = {
        type: 'comment',
        platform: 'gitlab',
        project: 'org/repo',
        mrId: '123',
        sourceBranch: 'feature-x',
        targetBranch: 'main',
        commentBody: '/doc-bot status',
        commentAuthor: 'user',
        repoUrl: 'https://gitlab.com/org/repo.git',
        eventId: 'event-5',
      };

      await router.route(event);
      await taskQueue.drain();

      const lastComment = mockPlatform.getLastComment();
      expect(lastComment).toContain('Active session');
      expect(lastComment).toContain('session-abc');
    });
  });

  describe('Revise Command', () => {
    it('should require feedback argument', async () => {
      const event: PlatformEvent = {
        type: 'comment',
        platform: 'gitlab',
        project: 'org/repo',
        mrId: '123',
        sourceBranch: 'feature-x',
        targetBranch: 'main',
        commentBody: '/doc-bot revise',
        commentAuthor: 'user',
        repoUrl: 'https://gitlab.com/org/repo.git',
        eventId: 'event-6',
      };

      await router.route(event);
      await taskQueue.drain();

      const lastComment = mockPlatform.getLastComment();
      expect(lastComment).toContain('requires feedback as an argument');
    });
  });
});
