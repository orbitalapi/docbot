import { Platform, PlatformName } from './interface';

/**
 * Resolves which platform adapter to use based on a repository URL
 */
export class PlatformResolver {
  private platforms: Map<PlatformName, Platform>;
  private gitlabUrl: string;

  constructor(platforms: Platform[], gitlabUrl: string = 'https://gitlab.com') {
    this.platforms = new Map(platforms.map((p) => [p.name, p]));
    this.gitlabUrl = gitlabUrl;
  }

  /**
   * Resolve platform from a repository URL
   * @param repoUrl Repository URL (e.g., https://github.com/org/repo or https://gitlab.com/org/repo)
   * @returns Platform adapter, or null if not supported
   */
  resolve(repoUrl: string): Platform | null {
    try {
      const url = new URL(repoUrl);
      const hostname = url.hostname.toLowerCase();

      // Check for GitHub
      if (hostname === 'github.com') {
        return this.platforms.get('github') || null;
      }

      // Check for GitLab (gitlab.com or self-hosted)
      const gitlabHostname = new URL(this.gitlabUrl).hostname.toLowerCase();
      if (hostname === 'gitlab.com' || hostname === gitlabHostname) {
        return this.platforms.get('gitlab') || null;
      }

      return null;
    } catch (error) {
      // Invalid URL
      return null;
    }
  }

  /**
   * Get platform by name
   * @param name Platform name
   * @returns Platform adapter, or null if not registered
   */
  getPlatform(name: PlatformName): Platform | null {
    return this.platforms.get(name) || null;
  }

  /**
   * Check if a platform is available
   * @param name Platform name
   * @returns true if platform is registered
   */
  hasPlatform(name: PlatformName): boolean {
    return this.platforms.has(name);
  }

  /**
   * Get all registered platforms
   * @returns Array of registered platforms
   */
  getAllPlatforms(): Platform[] {
    return Array.from(this.platforms.values());
  }
}
