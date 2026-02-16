import { Request } from 'express';
import { createHmac } from 'crypto';
import { PlatformEvent } from '../interface';
import {
  GitHubPullRequestEvent,
  GitHubIssueCommentEvent,
} from './types';

/**
 * GitHub webhook validator and parser
 */
export class GitHubWebhook {
  constructor(private webhookSecret: string) {}

  /**
   * Validate GitHub webhook request using HMAC signature
   * GitHub uses X-Hub-Signature-256 header with SHA256 HMAC
   */
  validate(req: Request): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      return false;
    }

    // Compute expected signature
    const body = JSON.stringify(req.body);
    const hmac = createHmac('sha256', this.webhookSecret);
    hmac.update(body);
    const expected = 'sha256=' + hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    return this.secureCompare(signature, expected);
  }

  /**
   * Parse GitHub webhook event into normalized platform event
   */
  parse(req: Request): PlatformEvent | null {
    const eventType = req.headers['x-github-event'] as string;

    if (eventType === 'pull_request') {
      return this.parsePullRequestEvent(req.body as GitHubPullRequestEvent);
    }

    if (eventType === 'issue_comment') {
      return this.parseIssueCommentEvent(req.body as GitHubIssueCommentEvent);
    }

    return null;
  }

  private parsePullRequestEvent(event: GitHubPullRequestEvent): PlatformEvent | null {
    const { action, pull_request, repository } = event;

    // Only handle opened and synchronize (update) actions
    if (action !== 'opened' && action !== 'synchronize') {
      return null;
    }

    const type = action === 'opened' ? 'mr_opened' : 'mr_updated';

    return {
      type,
      platform: 'github',
      project: repository.full_name,
      mrId: pull_request.number.toString(),
      sourceBranch: pull_request.head.ref,
      targetBranch: pull_request.base.ref,
      repoUrl: repository.clone_url,
      eventId: `github-pr-${pull_request.id}-${action}`,
    };
  }

  private parseIssueCommentEvent(event: GitHubIssueCommentEvent): PlatformEvent | null {
    // Only handle comments on pull requests
    if (!event.issue.pull_request) {
      return null;
    }

    // Only handle created comments
    if (event.action !== 'created') {
      return null;
    }

    const commentBody = event.comment.body;

    // Check if comment contains doc-bot marker (ignore bot's own comments)
    if (commentBody.includes('<!-- doc-bot:v1 -->')) {
      return null;
    }

    // We need to fetch the PR details to get branch info
    // For now, return a partial event - the handler will fetch PR details
    return {
      type: 'comment',
      platform: 'github',
      project: event.repository.full_name,
      mrId: event.issue.number.toString(),
      sourceBranch: '', // Will be fetched by handler
      targetBranch: '', // Will be fetched by handler
      commentBody,
      commentAuthor: event.comment.user.login,
      repoUrl: event.repository.clone_url,
      eventId: `github-comment-${event.comment.id}`,
    };
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
