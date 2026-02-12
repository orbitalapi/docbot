import { SimpleGit } from 'simple-git';
import { GitManager, CloneOptions } from '../../src/git/manager';

/**
 * Mock Git Manager for testing
 */
export class MockGitManager extends GitManager {
  public cloneCalls: CloneOptions[] = [];
  public cleanupCalls: string[] = [];

  public mockWorkDir = '/tmp/mock-work-dir';
  public mockGit = {} as SimpleGit;

  async clone(options: CloneOptions): Promise<{ git: SimpleGit; workDir: string }> {
    this.cloneCalls.push(options);
    return {
      git: this.mockGit,
      workDir: this.mockWorkDir,
    };
  }

  async cleanup(workDir: string): Promise<void> {
    this.cleanupCalls.push(workDir);
  }

  reset(): void {
    this.cloneCalls = [];
    this.cleanupCalls = [];
  }
}
