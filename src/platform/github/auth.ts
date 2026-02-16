import { createAppAuth } from '@octokit/auth-app';

/**
 * GitHub App authentication manager
 */
export class GitHubAuth {
  private appAuth: ReturnType<typeof createAppAuth> | null = null;
  private personalToken: string | null = null;
  private installationTokenCache = new Map<
    number,
    { token: string; expiresAt: Date }
  >();

  constructor(config: { appId?: string; privateKey?: string; token?: string }) {
    if (config.appId && config.privateKey) {
      // Use GitHub App authentication
      this.appAuth = createAppAuth({
        appId: config.appId,
        privateKey: config.privateKey,
      });
    } else if (config.token) {
      // Use personal access token
      this.personalToken = config.token;
    } else {
      throw new Error(
        'GitHub authentication requires either (appId + privateKey) or token'
      );
    }
  }

  /**
   * Get an authentication token for API calls
   * @param installationId Installation ID (only needed for GitHub App auth)
   * @returns Authentication token
   */
  async getToken(installationId?: number): Promise<string> {
    if (this.personalToken) {
      return this.personalToken;
    }

    if (!this.appAuth) {
      throw new Error('No GitHub authentication configured');
    }

    if (!installationId) {
      throw new Error('Installation ID required for GitHub App authentication');
    }

    // Check cache
    const cached = this.installationTokenCache.get(installationId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.token;
    }

    // Get new installation token
    const auth = await this.appAuth({
      type: 'installation',
      installationId,
    });

    // Cache with 50-minute expiry (tokens are valid for 1 hour)
    const expiresAt = new Date(Date.now() + 50 * 60 * 1000);
    this.installationTokenCache.set(installationId, {
      token: auth.token,
      expiresAt,
    });

    return auth.token;
  }

  /**
   * Get installation ID for a repository
   * Note: This requires fetching from GitHub API or webhook payload
   */
  async getInstallationId(owner: string, repo: string): Promise<number> {
    if (this.personalToken) {
      // Personal tokens don't use installations
      return 0;
    }

    if (!this.appAuth) {
      throw new Error('No GitHub App authentication configured');
    }

    // Get app authentication (JWT)
    const appAuth = await this.appAuth({ type: 'app' });

    // Fetch installation for this repository
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/installation`,
      {
        headers: {
          Authorization: `Bearer ${appAuth.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get installation for ${owner}/${repo}: ${response.status}`
      );
    }

    const data = (await response.json()) as { id: number };
    return data.id;
  }

  /**
   * Check if using GitHub App authentication
   */
  isAppAuth(): boolean {
    return this.appAuth !== null;
  }
}
