import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadTaskConfig,
  saveTaskConfig,
  parseRepoUrl,
  createTaskConfig,
} from '../../../src/task/config';

describe('Task Config', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'docbot-task-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadTaskConfig', () => {
    it('should load valid task config', async () => {
      const configPath = join(testDir, 'task.yaml');
      const configContent = `
repo: https://github.com/org/repo
platform: github
project: org/repo
branch: feature/test
base_branch: main
      `;
      await writeFile(configPath, configContent);

      const config = await loadTaskConfig(configPath);

      expect(config.repo).toBe('https://github.com/org/repo');
      expect(config.platform).toBe('github');
      expect(config.project).toBe('org/repo');
      expect(config.branch).toBe('feature/test');
      expect(config.baseBranch).toBe('main');
    });

    it('should load config with optional fields', async () => {
      const configPath = join(testDir, 'task.yaml');
      const configContent = `
repo: https://gitlab.com/org/repo
platform: gitlab
project: org/repo
branch: develop
base_branch: main
commits:
  - abc123
  - def456
pr: "123"
work_dir: /tmp/test
instructions: Focus on API docs
      `;
      await writeFile(configPath, configContent);

      const config = await loadTaskConfig(configPath);

      expect(config.commits).toEqual(['abc123', 'def456']);
      expect(config.pr).toBe('123');
      expect(config.workDir).toBe('/tmp/test');
      expect(config.instructions).toBe('Focus on API docs');
    });

    it('should fail on invalid config', async () => {
      const configPath = join(testDir, 'task.yaml');
      const configContent = `
repo: not-a-url
platform: invalid
      `;
      await writeFile(configPath, configContent);

      await expect(loadTaskConfig(configPath)).rejects.toThrow();
    });
  });

  describe('saveTaskConfig', () => {
    it('should save task config', async () => {
      const configPath = join(testDir, 'task.yaml');
      const config = {
        repo: 'https://github.com/org/repo',
        platform: 'github' as const,
        project: 'org/repo',
        branch: 'feature/test',
        baseBranch: 'main',
      };

      await saveTaskConfig(configPath, config);

      // Load it back and verify
      const loaded = await loadTaskConfig(configPath);
      expect(loaded.repo).toBe(config.repo);
      expect(loaded.platform).toBe(config.platform);
      expect(loaded.branch).toBe(config.branch);
    });

    it('should save with optional fields', async () => {
      const configPath = join(testDir, 'task.yaml');
      const config = {
        repo: 'https://gitlab.com/org/repo',
        platform: 'gitlab' as const,
        project: 'org/repo',
        branch: 'develop',
        baseBranch: 'main',
        pr: '456',
        instructions: 'Test instructions',
      };

      await saveTaskConfig(configPath, config);

      const loaded = await loadTaskConfig(configPath);
      expect(loaded.pr).toBe('456');
      expect(loaded.instructions).toBe('Test instructions');
    });
  });

  describe('parseRepoUrl', () => {
    it('should parse GitHub URL', () => {
      const result = parseRepoUrl('https://github.com/org/repo');

      expect(result.platform).toBe('github');
      expect(result.project).toBe('org/repo');
    });

    it('should parse GitLab URL', () => {
      const result = parseRepoUrl('https://gitlab.com/group/subgroup/project');

      expect(result.platform).toBe('gitlab');
      expect(result.project).toBe('group/subgroup/project');
    });

    it('should handle .git suffix', () => {
      const result = parseRepoUrl('https://github.com/org/repo.git');

      expect(result.project).toBe('org/repo');
    });
  });

  describe('createTaskConfig', () => {
    it('should create task config from repo URL', () => {
      const config = createTaskConfig(
        'https://github.com/org/repo',
        'feature/test',
        'main',
        'Test instructions'
      );

      expect(config.repo).toBe('https://github.com/org/repo');
      expect(config.platform).toBe('github');
      expect(config.project).toBe('org/repo');
      expect(config.branch).toBe('feature/test');
      expect(config.baseBranch).toBe('main');
      expect(config.instructions).toBe('Test instructions');
    });

    it('should use default base branch', () => {
      const config = createTaskConfig('https://gitlab.com/org/repo', 'develop');

      expect(config.baseBranch).toBe('main');
    });
  });
});
