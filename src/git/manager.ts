import simpleGit, { SimpleGit } from 'simple-git';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface CloneOptions {
  /** Repository URL with authentication */
  repoUrl: string;
  /** Branch to clone */
  branch: string;
  /** Depth for shallow clone (default: 1) */
  depth?: number;
}

export interface CommitOptions {
  /** Files to stage (glob patterns or specific paths) */
  files?: string[];
  /** Commit message */
  message: string;
  /** Author name (defaults to "Doc-Bot") */
  authorName?: string;
  /** Author email (defaults to "doc-bot@localhost") */
  authorEmail?: string;
}

/**
 * Git operations manager
 * Handles cloning, branching, committing, and pushing
 */
export class GitManager {
  private baseDir: string;

  constructor(baseDir: string = join(tmpdir(), 'doc-bot')) {
    this.baseDir = baseDir;
  }

  /**
   * Create a shallow clone of a repository
   * @param options Clone options
   * @returns Object with git instance and working directory path
   */
  async clone(options: CloneOptions): Promise<{ git: SimpleGit; workDir: string }> {
    // Create a unique temporary directory for this clone
    const workDir = await mkdtemp(join(this.baseDir, 'clone-'));

    const git = simpleGit();

    await git.clone(options.repoUrl, workDir, {
      '--depth': options.depth || 1,
      '--branch': options.branch,
      '--single-branch': null,
    });

    // Configure git for the working directory
    const repoGit = simpleGit(workDir);

    return { git: repoGit, workDir };
  }

  /**
   * Create a new branch from the current HEAD
   * @param git SimpleGit instance
   * @param branchName New branch name
   */
  async createBranch(git: SimpleGit, branchName: string): Promise<void> {
    await git.checkoutLocalBranch(branchName);
  }

  /**
   * Checkout an existing branch
   * @param git SimpleGit instance
   * @param branchName Branch name
   */
  async checkout(git: SimpleGit, branchName: string): Promise<void> {
    await git.checkout(branchName);
  }

  /**
   * Stage and commit changes
   * @param git SimpleGit instance
   * @param options Commit options
   */
  async commit(git: SimpleGit, options: CommitOptions): Promise<void> {
    // Configure author
    const authorName = options.authorName || 'Doc-Bot';
    const authorEmail = options.authorEmail || 'doc-bot@localhost';

    await git.addConfig('user.name', authorName);
    await git.addConfig('user.email', authorEmail);

    // Stage files
    if (options.files && options.files.length > 0) {
      await git.add(options.files);
    } else {
      // Stage all changes if no specific files provided
      await git.add('.');
    }

    // Check if there are changes to commit
    const status = await git.status();
    if (status.staged.length === 0) {
      throw new Error('No changes to commit');
    }

    // Commit
    await git.commit(options.message);
  }

  /**
   * Push commits to remote
   * @param git SimpleGit instance
   * @param branch Branch to push
   * @param remote Remote name (default: "origin")
   * @param force Whether to force push (default: false)
   */
  async push(
    git: SimpleGit,
    branch: string,
    remote: string = 'origin',
    force: boolean = false
  ): Promise<void> {
    const args: string[] = [remote, branch];

    if (force) {
      args.push('--force');
    }

    // Set upstream tracking
    args.push('--set-upstream');

    await git.push(args);
  }

  /**
   * Get the current branch name
   * @param git SimpleGit instance
   * @returns Current branch name
   */
  async getCurrentBranch(git: SimpleGit): Promise<string> {
    const status = await git.status();
    return status.current || 'unknown';
  }

  /**
   * Get the status of the working directory
   * @param git SimpleGit instance
   * @returns Git status
   */
  async getStatus(git: SimpleGit) {
    return git.status();
  }

  /**
   * Get the diff of uncommitted changes
   * @param git SimpleGit instance
   * @returns Diff output
   */
  async getDiff(git: SimpleGit): Promise<string> {
    return git.diff();
  }

  /**
   * Clean up a working directory
   * @param workDir Working directory path
   */
  async cleanup(workDir: string): Promise<void> {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch (error) {
      // Log but don't throw - cleanup failures shouldn't break the workflow
      console.error(`Failed to cleanup ${workDir}:`, error);
    }
  }

  /**
   * Clone multiple repositories for cross-repo scenarios
   * @param clones Array of clone options
   * @returns Array of git instances with their work directories
   */
  async cloneMultiple(
    clones: CloneOptions[]
  ): Promise<Array<{ git: SimpleGit; workDir: string; repoUrl: string }>> {
    const results = await Promise.all(
      clones.map(async (opts) => {
        const { git, workDir } = await this.clone(opts);
        return { git, workDir, repoUrl: opts.repoUrl };
      })
    );

    return results;
  }

  /**
   * Cleanup multiple working directories
   * @param workDirs Array of working directory paths
   */
  async cleanupMultiple(workDirs: string[]): Promise<void> {
    await Promise.all(workDirs.map((dir) => this.cleanup(dir)));
  }
}
