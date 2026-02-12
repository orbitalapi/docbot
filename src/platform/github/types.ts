/**
 * GitHub webhook event types
 */

export interface GitHubUser {
  login: string;
  id: number;
  email?: string;
  name?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  html_url: string;
  clone_url: string;
  ssh_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  draft: boolean;
  head: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  base: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  user: GitHubUser;
  html_url: string;
  diff_url: string;
  updated_at: string;
}

/**
 * GitHub Pull Request webhook event
 */
export interface GitHubPullRequestEvent {
  action: 'opened' | 'synchronize' | 'reopened' | 'closed' | 'edited';
  number: number;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
}

/**
 * GitHub Issue Comment webhook event
 * (includes comments on pull requests)
 */
export interface GitHubIssueCommentEvent {
  action: 'created' | 'edited' | 'deleted';
  issue: {
    number: number;
    pull_request?: {
      url: string;
      html_url: string;
    };
  };
  comment: {
    id: number;
    body: string;
    user: GitHubUser;
    created_at: string;
    updated_at: string;
  };
  repository: GitHubRepository;
  sender: GitHubUser;
}

export type GitHubWebhookEvent = GitHubPullRequestEvent | GitHubIssueCommentEvent;

/**
 * GitHub API response types
 */

export interface GitHubFileResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  encoding: 'base64';
  content: string;
}

export interface GitHubBranchResponse {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface GitHubPRCreateResponse {
  id: number;
  number: number;
  html_url: string;
  title: string;
  state: string;
}
