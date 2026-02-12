import { Request } from 'express';

/**
 * Platform identifier
 */
export type PlatformName = 'gitlab' | 'github';

/**
 * Event types that Doc-Bot responds to
 */
export type EventType = 'mr_opened' | 'mr_updated' | 'comment';

/**
 * Normalized platform event - all platform-specific events are translated to this format
 */
export interface PlatformEvent {
  /** Event type */
  type: EventType;
  /** Platform that generated the event */
  platform: PlatformName;
  /** Project identifier (e.g., "orbital/orbital-core") */
  project: string;
  /** MR/PR identifier (IID for GitLab, number for GitHub) */
  mrId: string;
  /** Source branch of the MR/PR */
  sourceBranch: string;
  /** Target branch of the MR/PR */
  targetBranch: string;
  /** Comment body (only present for comment events) */
  commentBody?: string;
  /** Comment author username (only present for comment events) */
  commentAuthor?: string;
  /** Repository clone URL */
  repoUrl: string;
  /** Unique identifier for the event (for deduplication) */
  eventId: string;
}

/**
 * Parameters for creating an MR/PR
 */
export interface MRParams {
  /** Source branch */
  sourceBranch: string;
  /** Target branch */
  targetBranch: string;
  /** MR/PR title */
  title: string;
  /** MR/PR description/body */
  description: string;
  /** Whether to mark as draft */
  draft?: boolean;
}

/**
 * Result of creating an MR/PR
 */
export interface MRResult {
  /** MR/PR identifier */
  mrId: string;
  /** Web URL of the MR/PR */
  webUrl: string;
}

/**
 * Platform interface - abstracts GitLab and GitHub differences
 */
export interface Platform {
  /** Platform name */
  readonly name: PlatformName;

  // ========== Inbound - webhook handling ==========

  /**
   * Validate that a webhook request is authentic
   * @param req Express request object
   * @returns true if valid, false otherwise
   */
  validateWebhook(req: Request): boolean;

  /**
   * Parse a webhook request into a normalized event
   * @param req Express request object
   * @returns Normalized platform event, or null if not actionable
   */
  parseWebhookEvent(req: Request): PlatformEvent | null;

  // ========== Outbound - reading ==========

  /**
   * Get the diff for an MR/PR
   * @param project Project identifier
   * @param mrId MR/PR identifier
   * @returns Diff in unified format
   */
  getDiff(project: string, mrId: string): Promise<string>;

  /**
   * Get the content of a file at a specific ref
   * @param project Project identifier
   * @param path File path
   * @param ref Git ref (branch, tag, SHA)
   * @returns File content as string
   */
  getFileContent(project: string, path: string, ref: string): Promise<string>;

  /**
   * Get the clone URL for a repository with embedded credentials
   * @param project Project identifier
   * @returns HTTPS clone URL with authentication
   */
  getAuthenticatedCloneUrl(project: string): Promise<string>;

  // ========== Outbound - writing ==========

  /**
   * Post a comment on an MR/PR
   * @param project Project identifier
   * @param mrId MR/PR identifier
   * @param body Comment body (markdown)
   */
  postComment(project: string, mrId: string, body: string): Promise<void>;

  /**
   * Create a new MR/PR
   * @param project Project identifier
   * @param params MR/PR parameters
   * @returns MR/PR result with ID and URL
   */
  openMR(project: string, params: MRParams): Promise<MRResult>;

  /**
   * Check if a branch exists in a repository
   * @param project Project identifier
   * @param branch Branch name
   * @returns true if branch exists, false otherwise
   */
  branchExists(project: string, branch: string): Promise<boolean>;
}
