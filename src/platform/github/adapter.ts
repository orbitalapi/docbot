import { Request } from 'express';
import { Octokit } from '@octokit/rest';
import { Platform, PlatformEvent, MRParams, MRResult } from '../interface';
import { GitHubWebhook } from './webhook';
import { GitHubAuth } from './auth';
import {
  GitHubFileResponse,
  GitHubPRCreateResponse,
  GitHubPullRequest,
} from './types';

/**
 * GitHub platform adapter
 */
export class GitHubAdapter implements Platform {
  readonly name = 'github' as const;
  private webhook: GitHubWebhook;
  private auth: GitHubAuth;
  private octokitCache = new Map<string, Octokit>();

  constructor(
    authConfig: { appId?: string; privateKey?: string; token?: string },
    webhookSecret: string
  ) {
    this.webhook = new GitHubWebhook(webhookSecret);
    this.auth = new GitHubAuth(authConfig);
  }

  // ========== Webhook handling ==========

  validateWebhook(req: Request): boolean {
    return this.webhook.validate(req);
  }

  parseWebhookEvent(req: Request): PlatformEvent | null {
    const event = this.webhook.parse(req);

    // For comment events, we need to fetch PR details to get branch info
    if (event && event.type === 'comment' && (!event.sourceBranch || !event.targetBranch)) {
      // This will be handled asynchronously by the event handler
      // For now, return the partial event
    }

    return event;
  }

  // ========== API methods ==========

  async getDiff(project: string, mrId: string): Promise<string> {
    const [owner, repo] = project.split('/');
    const octokit = await this.getOctokit(owner, repo);

    // Fetch PR diff in unified format
    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: parseInt(mrId),
      mediaType: {
        format: 'diff',
      },
    });

    // Data will be a string when format is 'diff'
    return data as unknown as string;
  }

  async getFileContent(project: string, path: string, ref: string): Promise<string> {
    const [owner, repo] = project.split('/');
    const octokit = await this.getOctokit(owner, repo);

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      // Ensure we got a file, not a directory
      if (Array.isArray(data) || data.type !== 'file') {
        throw new Error(`Path ${path} is not a file`);
      }

      const fileData = data as GitHubFileResponse;

      // GitHub returns base64-encoded content
      return Buffer.from(fileData.content, 'base64').toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to fetch file ${path} at ref ${ref}: ${error}`);
    }
  }

  async getAuthenticatedCloneUrl(project: string): Promise<string> {
    const [owner, repo] = project.split('/');

    // Get token for this repository
    const installationId = await this.auth.getInstallationId(owner, repo);
    const token = await this.auth.getToken(installationId);

    // Return HTTPS URL with token: https://x-access-token:TOKEN@github.com/org/repo.git
    return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  }

  async postComment(project: string, mrId: string, body: string): Promise<void> {
    const [owner, repo] = project.split('/');
    const octokit = await this.getOctokit(owner, repo);

    // Add doc-bot marker to prevent responding to own comments
    const markedBody = `<!-- doc-bot:v1 -->\n${body}`;

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: parseInt(mrId),
      body: markedBody,
    });
  }

  async openMR(project: string, params: MRParams): Promise<MRResult> {
    const [owner, repo] = project.split('/');
    const octokit = await this.getOctokit(owner, repo);

    const title = params.draft ? `[Draft] ${params.title}` : params.title;

    const { data } = await octokit.pulls.create({
      owner,
      repo,
      head: params.sourceBranch,
      base: params.targetBranch,
      title,
      body: params.description,
      draft: params.draft || false,
    });

    const response = data as GitHubPRCreateResponse;

    return {
      mrId: response.number.toString(),
      webUrl: response.html_url,
    };
  }

  async branchExists(project: string, branch: string): Promise<boolean> {
    const [owner, repo] = project.split('/');
    const octokit = await this.getOctokit(owner, repo);

    try {
      await octokit.repos.getBranch({
        owner,
        repo,
        branch,
      });
      return true;
    } catch (error) {
      // 404 means branch doesn't exist
      return false;
    }
  }

  /**
   * Fetch PR details (helper for enriching comment events)
   */
  async getPRDetails(project: string, prNumber: number): Promise<GitHubPullRequest> {
    const [owner, repo] = project.split('/');
    const octokit = await this.getOctokit(owner, repo);

    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return data as GitHubPullRequest;
  }

  // ========== Helper methods ==========

  private async getOctokit(owner: string, repo: string): Promise<Octokit> {
    const key = `${owner}/${repo}`;

    if (this.octokitCache.has(key)) {
      return this.octokitCache.get(key)!;
    }

    const installationId = await this.auth.getInstallationId(owner, repo);
    const token = await this.auth.getToken(installationId);

    const octokit = new Octokit({
      auth: token,
    });

    this.octokitCache.set(key, octokit);

    return octokit;
  }
}
