import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GitManager } from '../../../src/git/manager';
import simpleGit, { SimpleGit } from 'simple-git';
import { mkdir, rm } from 'fs/promises';

// Mock simple-git
jest.mock('simple-git');

describe('GitManager', () => {
  let gitManager: GitManager;
  let mockGit: jest.Mocked<SimpleGit>;
  const testBaseDir = '/tmp/docbot-git-manager-test';

  beforeEach(async () => {
    // Create test base directory
    await mkdir(testBaseDir, { recursive: true });
    gitManager = new GitManager(testBaseDir);

    // Create mock git instance - use explicit implementations to avoid type issues
    mockGit = {
      clone: jest.fn(() => Promise.resolve()),
      checkoutLocalBranch: jest.fn(() => Promise.resolve()),
      checkout: jest.fn(() => Promise.resolve()),
      add: jest.fn(() => Promise.resolve()),
      addConfig: jest.fn(() => Promise.resolve()),
      commit: jest.fn(() => Promise.resolve()),
      push: jest.fn(() => Promise.resolve()),
      status: jest.fn(() =>
        Promise.resolve({
          current: 'main',
          staged: ['file.txt'],
        })
      ),
      diff: jest.fn(() => Promise.resolve('diff content')),
    } as any;

    (simpleGit as jest.MockedFunction<typeof simpleGit>).mockReturnValue(mockGit);
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testBaseDir, { recursive: true, force: true });
  });

  describe('clone', () => {
    it('should clone repository with options', async () => {
      const options = {
        repoUrl: 'https://github.com/org/repo.git',
        branch: 'main',
        depth: 1,
      };

      await gitManager.clone(options);

      expect(mockGit.clone).toHaveBeenCalledWith(
        options.repoUrl,
        expect.any(String),
        expect.objectContaining({
          '--depth': 1,
          '--branch': 'main',
          '--single-branch': null,
        })
      );
    });

    it('should use default depth if not specified', async () => {
      const options = {
        repoUrl: 'https://github.com/org/repo.git',
        branch: 'main',
      };

      await gitManager.clone(options);

      expect(mockGit.clone).toHaveBeenCalledWith(
        options.repoUrl,
        expect.any(String),
        expect.objectContaining({
          '--depth': 1,
        })
      );
    });
  });

  describe('createBranch', () => {
    it('should create new branch', async () => {
      await gitManager.createBranch(mockGit, 'new-branch');

      expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('new-branch');
    });
  });

  describe('checkout', () => {
    it('should checkout existing branch', async () => {
      await gitManager.checkout(mockGit, 'existing-branch');

      expect(mockGit.checkout).toHaveBeenCalledWith('existing-branch');
    });
  });

  describe('commit', () => {
    it('should stage and commit changes', async () => {
      const options = {
        files: ['file1.ts', 'file2.ts'],
        message: 'Test commit',
      };

      await gitManager.commit(mockGit, options);

      expect(mockGit.addConfig).toHaveBeenCalledWith('user.name', 'Doc-Bot');
      expect(mockGit.addConfig).toHaveBeenCalledWith('user.email', 'doc-bot@localhost');
      expect(mockGit.add).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
      expect(mockGit.commit).toHaveBeenCalledWith('Test commit');
    });

    it('should use custom author info', async () => {
      const options = {
        message: 'Test commit',
        authorName: 'Custom Author',
        authorEmail: 'custom@example.com',
      };

      await gitManager.commit(mockGit, options);

      expect(mockGit.addConfig).toHaveBeenCalledWith('user.name', 'Custom Author');
      expect(mockGit.addConfig).toHaveBeenCalledWith('user.email', 'custom@example.com');
    });

    it('should fail if no changes to commit', async () => {
      mockGit.status = jest.fn(() =>
        Promise.resolve({
          staged: [],
        })
      ) as any;

      await expect(
        gitManager.commit(mockGit, { message: 'Test' })
      ).rejects.toThrow('No changes to commit');
    });
  });

  describe('push', () => {
    it('should push branch to remote', async () => {
      await gitManager.push(mockGit, 'feature-branch');

      expect(mockGit.push).toHaveBeenCalledWith([
        'origin',
        'feature-branch',
        '--set-upstream',
      ]);
    });

    it('should support force push', async () => {
      await gitManager.push(mockGit, 'feature-branch', 'origin', true);

      expect(mockGit.push).toHaveBeenCalledWith([
        'origin',
        'feature-branch',
        '--force',
        '--set-upstream',
      ]);
    });

    it('should support custom remote', async () => {
      await gitManager.push(mockGit, 'feature-branch', 'upstream');

      expect(mockGit.push).toHaveBeenCalledWith([
        'upstream',
        'feature-branch',
        '--set-upstream',
      ]);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockGit.status = jest.fn(() =>
        Promise.resolve({
          current: 'develop',
        })
      ) as any;

      const branch = await gitManager.getCurrentBranch(mockGit);

      expect(branch).toBe('develop');
    });
  });

  describe('getDiff', () => {
    it('should return diff output', async () => {
      const diff = await gitManager.getDiff(mockGit);

      expect(diff).toBe('diff content');
      expect(mockGit.diff).toHaveBeenCalled();
    });
  });
});
