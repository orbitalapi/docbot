/**
 * GitLab webhook event types
 */

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  email: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  http_url_to_repo: string;
  ssh_url_to_repo: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: string;
  source_branch: string;
  target_branch: string;
  author: GitLabUser;
  web_url: string;
}

/**
 * GitLab Merge Request Hook
 * Fires on MR open, update, merge, close
 */
export interface GitLabMergeRequestHook {
  object_kind: 'merge_request';
  event_type: 'merge_request';
  user: GitLabUser;
  project: GitLabProject;
  object_attributes: GitLabMergeRequest & {
    action: 'open' | 'update' | 'close' | 'merge' | 'reopen';
    oldrev?: string;
    updated_at: string;
  };
}

/**
 * GitLab Note Hook
 * Fires on comment creation
 */
export interface GitLabNoteHook {
  object_kind: 'note';
  event_type: 'note';
  user: GitLabUser;
  project: GitLabProject;
  merge_request?: GitLabMergeRequest;
  object_attributes: {
    id: number;
    note: string;
    noteable_type: string;
    noteable_id: number;
    author_id: number;
    created_at: string;
    updated_at: string;
    url: string;
  };
}

export type GitLabWebhookEvent = GitLabMergeRequestHook | GitLabNoteHook;

/**
 * GitLab API response types
 */

export interface GitLabMRResponse {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: string;
  source_branch: string;
  target_branch: string;
  web_url: string;
  author: GitLabUser;
  changes?: Array<{
    old_path: string;
    new_path: string;
    diff: string;
  }>;
}

export interface GitLabFileResponse {
  file_name: string;
  file_path: string;
  size: number;
  encoding: 'base64';
  content: string;
  ref: string;
}

export interface GitLabBranchResponse {
  name: string;
  commit: {
    id: string;
    short_id: string;
    title: string;
  };
}
