import { Request } from 'express';
import { PlatformEvent } from '../interface';
import { GitLabWebhookEvent, GitLabMergeRequestHook, GitLabNoteHook } from './types';

/**
 * GitLab webhook validator and parser
 */
export class GitLabWebhook {
  constructor(private webhookSecret: string) {}

  /**
   * Validate GitLab webhook request
   * Uses X-Gitlab-Token header for validation
   */
  validate(req: Request): boolean {
    const token = req.headers['x-gitlab-token'];
    return token === this.webhookSecret;
  }

  /**
   * Parse GitLab webhook event into normalized platform event
   */
  parse(req: Request): PlatformEvent | null {
    const event = req.body as GitLabWebhookEvent;

    // Handle Merge Request events
    if (event.object_kind === 'merge_request') {
      return this.parseMergeRequestEvent(event as GitLabMergeRequestHook);
    }

    // Handle Note (comment) events
    if (event.object_kind === 'note') {
      return this.parseNoteEvent(event as GitLabNoteHook);
    }

    return null;
  }

  private parseMergeRequestEvent(event: GitLabMergeRequestHook): PlatformEvent | null {
    const { action } = event.object_attributes;

    // Only handle open and update actions
    if (action !== 'open' && action !== 'update') {
      return null;
    }

    const type = action === 'open' ? 'mr_opened' : 'mr_updated';

    return {
      type,
      platform: 'gitlab',
      project: event.project.path_with_namespace,
      mrId: event.object_attributes.iid.toString(),
      sourceBranch: event.object_attributes.source_branch,
      targetBranch: event.object_attributes.target_branch,
      repoUrl: event.project.http_url_to_repo,
      eventId: `gitlab-mr-${event.object_attributes.id}-${action}`,
    };
  }

  private parseNoteEvent(event: GitLabNoteHook): PlatformEvent | null {
    // Only handle notes on merge requests
    if (event.object_attributes.noteable_type !== 'MergeRequest' || !event.merge_request) {
      return null;
    }

    // Check if comment contains doc-bot marker (ignore bot's own comments)
    const commentBody = event.object_attributes.note;
    if (commentBody.includes('<!-- doc-bot:v1 -->')) {
      return null;
    }

    return {
      type: 'comment',
      platform: 'gitlab',
      project: event.project.path_with_namespace,
      mrId: event.merge_request.iid.toString(),
      sourceBranch: event.merge_request.source_branch,
      targetBranch: event.merge_request.target_branch,
      commentBody,
      commentAuthor: event.user.username,
      repoUrl: event.project.http_url_to_repo,
      eventId: `gitlab-note-${event.object_attributes.id}`,
    };
  }
}
