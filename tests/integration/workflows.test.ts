import { triageWorkflow } from '../../src/workflows/triage';
import { updateWorkflow } from '../../src/workflows/update';
import { reviseWorkflow } from '../../src/workflows/revise';
import { reviewWorkflow } from '../../src/workflows/review';
import { createWorkflowContext } from '../../src/workflows/common';
import { MockPlatform } from '../mocks/platform.mock';
import { MockGitManager } from '../mocks/git.mock';
import { PlatformResolver } from '../../src/platform/resolver';
import { SessionStore } from '../../src/agent/session-store';
import { PlatformEvent } from '../../src/platform/interface';

// Mock the agent orchestrator
jest.mock('../../src/agent/orchestrator', () => {
  return {
    AgentOrchestrator: jest.fn().mockImplementation(() => ({
      run: jest.fn().mockResolvedValue({
        response: 'Mock agent analysis response',
        sessionId: 'mock-session-123',
        cost: 0.05,
        turns: 1,
      }),
    })),
  };
});

// Mock fs for config loading
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockImplementation((path: string) => {
    if (path.includes('.doc-bot.yaml')) {
      return Promise.resolve(`
trigger:
  mode: hybrid
model: claude-sonnet-4-5-20250929
max_turns: 20
docs:
  - source_patterns: ["src/compiler/**"]
    docs_path: docs/language/
    mode: same-repo
`);
    }
    return Promise.reject(new Error('File not found'));
  }),
  mkdtemp: jest.fn().mockResolvedValue('/tmp/test-dir'),
  rm: jest.fn().mockResolvedValue(undefined),
}));

describe('Workflows Integration', () => {
  let mockPlatform: MockPlatform;
  let platformResolver: PlatformResolver;
  let gitManager: MockGitManager;
  let sessionStore: SessionStore;
  let event: PlatformEvent;

  beforeEach(() => {
    mockPlatform = new MockPlatform('gitlab');
    platformResolver = new PlatformResolver([mockPlatform]);
    gitManager = new MockGitManager();
    sessionStore = new SessionStore(24);

    event = {
      type: 'mr_opened',
      platform: 'gitlab',
      project: 'org/repo',
      mrId: '123',
      sourceBranch: 'feature-x',
      targetBranch: 'main',
      repoUrl: 'https://gitlab.com/org/repo.git',
      eventId: 'event-1',
    };

    mockPlatform.mockDiff = `
diff --git a/src/compiler/parser.ts b/src/compiler/parser.ts
index abc123..def456 100644
--- a/src/compiler/parser.ts
+++ b/src/compiler/parser.ts
@@ -1,5 +1,5 @@
`;
    mockPlatform.mockCloneUrl = 'https://token@gitlab.com/org/repo.git';
  });

  afterEach(() => {
    mockPlatform.reset();
    gitManager.reset();
    sessionStore.clear();
  });

  describe('Triage Workflow', () => {
    it('should post analysis comment when docs are affected', async () => {
      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      await triageWorkflow(ctx, 'test-api-key');

      expect(mockPlatform.calls.postComment).toBe(1);
      const comment = mockPlatform.getLastComment();
      expect(comment).toContain('Doc-Bot Analysis');
      expect(comment).toContain('Mock agent analysis response');
    });

    it('should not post comment when no docs are affected', async () => {
      // Change diff to affect non-doc files
      mockPlatform.mockDiff = `
diff --git a/README.md b/README.md
index abc123..def456 100644
`;

      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      await triageWorkflow(ctx, 'test-api-key');

      expect(mockPlatform.calls.postComment).toBe(0);
    });

    it('should clone the repository to load config', async () => {
      await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      expect(gitManager.cloneCalls.length).toBe(1);
      expect(gitManager.cloneCalls[0].branch).toBe('feature-x');
      expect(gitManager.cleanupCalls.length).toBe(1);
    });
  });

  describe('Update Workflow', () => {
    it('should post update recommendations', async () => {
      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      await updateWorkflow(ctx, 'test-api-key', sessionStore);

      expect(mockPlatform.calls.postComment).toBe(1);
      const comment = mockPlatform.getLastComment();
      expect(comment).toContain('Doc-Bot Update Recommendations');
    });

    it('should store session for revisions', async () => {
      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      await updateWorkflow(ctx, 'test-api-key', sessionStore);

      const session = sessionStore.get({
        platform: 'gitlab',
        project: 'org/repo',
        mrId: '123',
      });

      expect(session).toBe('mock-session-123');
    });

    it('should handle no affected docs', async () => {
      mockPlatform.mockDiff = `
diff --git a/README.md b/README.md
index abc123..def456 100644
`;

      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      await updateWorkflow(ctx, 'test-api-key', sessionStore);

      const comment = mockPlatform.getLastComment();
      expect(comment).toContain('No documentation targets');
    });
  });

  describe('Revise Workflow', () => {
    it('should revise using existing session', async () => {
      // First, create a session
      sessionStore.set(
        { platform: 'gitlab', project: 'org/repo', mrId: '123' },
        'existing-session-456'
      );

      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      await reviseWorkflow(ctx, 'test-api-key', sessionStore, 'Please make it more concise');

      expect(mockPlatform.calls.postComment).toBe(1);
      const comment = mockPlatform.getLastComment();
      expect(comment).toContain('Revised Recommendations');
    });

    it('should handle missing session', async () => {
      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      await reviseWorkflow(ctx, 'test-api-key', sessionStore, 'Some feedback');

      const comment = mockPlatform.getLastComment();
      expect(comment).toContain('No previous session found');
    });
  });

  describe('Review Workflow', () => {
    it('should perform triage and update in one step', async () => {
      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      await reviewWorkflow(ctx, 'test-api-key', sessionStore);

      expect(mockPlatform.calls.postComment).toBe(1);
      const comment = mockPlatform.getLastComment();
      expect(comment).toContain('Doc-Bot Review');
    });

    it('should store session', async () => {
      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      await reviewWorkflow(ctx, 'test-api-key', sessionStore);

      const session = sessionStore.get({
        platform: 'gitlab',
        project: 'org/repo',
        mrId: '123',
      });

      expect(session).toBeTruthy();
    });
  });

  describe('Workflow Context Creation', () => {
    it('should load config from repository', async () => {
      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      expect(ctx.config.model).toBe('claude-sonnet-4-5-20250929');
      expect(ctx.config.trigger.mode).toBe('hybrid');
      expect(ctx.config.docs).toHaveLength(1);
    });

    it('should get diff from platform', async () => {
      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      expect(mockPlatform.calls.getDiff).toBe(1);
      expect(ctx.diff).toContain('src/compiler/parser.ts');
    });

    it('should parse changed files', async () => {
      const ctx = await createWorkflowContext(event, mockPlatform, platformResolver, gitManager);

      expect(ctx.changedFiles).toContain('src/compiler/parser.ts');
    });
  });
});
