import { Request } from 'express';
import { Platform, PlatformEvent, MRParams, MRResult } from '../interface';
import { GitLabWebhook } from './webhook';
import { GitLabMRResponse, GitLabFileResponse, GitLabBranchResponse } from './types';

/**
 * GitLab platform adapter
 */
export class GitLabAdapter implements Platform {
  readonly name = 'gitlab' as const;
  private webhook: GitLabWebhook;
  private apiUrl: string;

  constructor(
    private token: string,
    webhookSecret: string,
    gitlabUrl: string = 'https://gitlab.com'
  ) {
    this.webhook = new GitLabWebhook(webhookSecret);
    this.apiUrl = `${gitlabUrl}/api/v4`;
  }

  // ========== Webhook handling ==========

  validateWebhook(req: Request): boolean {
    return this.webhook.validate(req);
  }

  parseWebhookEvent(req: Request): PlatformEvent | null {
    return this.webhook.parse(req);
  }

  // ========== API methods ==========

  async getDiff(project: string, mrId: string): Promise<string> {
    const encodedProject = encodeURIComponent(project);
    const url = `${this.apiUrl}/projects/${encodedProject}/merge_requests/${mrId}/changes`;

    const response = await this.apiCall<GitLabMRResponse>(url);

    if (!response.changes || response.changes.length === 0) {
      return '';
    }

    // Combine all diffs into unified format
    return response.changes.map((change) => change.diff).join('\n\n');
  }

  async getFileContent(project: string, path: string, ref: string): Promise<string> {
    const encodedProject = encodeURIComponent(project);
    const encodedPath = encodeURIComponent(path);
    const encodedRef = encodeURIComponent(ref);

    const url = `${this.apiUrl}/projects/${encodedProject}/repository/files/${encodedPath}?ref=${encodedRef}`;

    try {
      const response = await this.apiCall<GitLabFileResponse>(url);

      // GitLab returns base64-encoded content
      return Buffer.from(response.content, 'base64').toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to fetch file ${path} at ref ${ref}: ${error}`);
    }
  }

  async getAuthenticatedCloneUrl(project: string): Promise<string> {
    const encodedProject = encodeURIComponent(project);
    const url = `${this.apiUrl}/projects/${encodedProject}`;

    const response = await this.apiCall<{ http_url_to_repo: string }>(url);

    // Inject token into URL: https://oauth2:TOKEN@gitlab.com/org/repo.git
    const repoUrl = new URL(response.http_url_to_repo);
    repoUrl.username = 'oauth2';
    repoUrl.password = this.token;

    return repoUrl.toString();
  }

  async postComment(project: string, mrId: string, body: string): Promise<void> {
    const encodedProject = encodeURIComponent(project);

    // Add doc-bot marker to prevent responding to own comments
    const markedBody = `<!-- doc-bot:v1 -->\n${body}`;

    const url = `${this.apiUrl}/projects/${encodedProject}/merge_requests/${mrId}/notes`;

    await this.apiCall(url, {
      method: 'POST',
      body: JSON.stringify({ body: markedBody }),
    });
  }

  async openMR(project: string, params: MRParams): Promise<MRResult> {
    const encodedProject = encodeURIComponent(project);
    const url = `${this.apiUrl}/projects/${encodedProject}/merge_requests`;

    const response = await this.apiCall<GitLabMRResponse>(url, {
      method: 'POST',
      body: JSON.stringify({
        source_branch: params.sourceBranch,
        target_branch: params.targetBranch,
        title: params.draft ? `Draft: ${params.title}` : params.title,
        description: params.description,
      }),
    });

    return {
      mrId: response.iid.toString(),
      webUrl: response.web_url,
    };
  }

  async branchExists(project: string, branch: string): Promise<boolean> {
    const encodedProject = encodeURIComponent(project);
    const encodedBranch = encodeURIComponent(branch);
    const url = `${this.apiUrl}/projects/${encodedProject}/repository/branches/${encodedBranch}`;

    try {
      await this.apiCall<GitLabBranchResponse>(url);
      return true;
    } catch (error) {
      // 404 means branch doesn't exist
      return false;
    }
  }

  // ========== Helper methods ==========

  private async apiCall<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `GitLab API error: ${response.status} ${response.statusText} - ${errorBody}`
      );
    }

    return response.json() as Promise<T>;
  }
}
