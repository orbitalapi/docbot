import { PlatformResolver } from '../../src/platform/resolver';
import { MockPlatform } from '../mocks/platform.mock';

describe('PlatformResolver', () => {
  let gitlabPlatform: MockPlatform;
  let githubPlatform: MockPlatform;
  let resolver: PlatformResolver;

  beforeEach(() => {
    gitlabPlatform = new MockPlatform('gitlab');
    githubPlatform = new MockPlatform('github');
    resolver = new PlatformResolver([gitlabPlatform, githubPlatform], 'https://gitlab.com');
  });

  describe('resolve', () => {
    it('should resolve GitHub URLs', () => {
      const platform = resolver.resolve('https://github.com/org/repo.git');

      expect(platform).toBe(githubPlatform);
    });

    it('should resolve gitlab.com URLs', () => {
      const platform = resolver.resolve('https://gitlab.com/org/repo.git');

      expect(platform).toBe(gitlabPlatform);
    });

    it('should resolve self-hosted GitLab URLs', () => {
      const selfHostedResolver = new PlatformResolver(
        [gitlabPlatform, githubPlatform],
        'https://gitlab.mycompany.com'
      );

      const platform = selfHostedResolver.resolve('https://gitlab.mycompany.com/org/repo.git');

      expect(platform).toBe(gitlabPlatform);
    });

    it('should return null for unknown hosts', () => {
      const platform = resolver.resolve('https://bitbucket.org/org/repo.git');

      expect(platform).toBeNull();
    });

    it('should return null for invalid URLs', () => {
      const platform = resolver.resolve('not-a-valid-url');

      expect(platform).toBeNull();
    });
  });

  describe('getPlatform', () => {
    it('should get platform by name', () => {
      expect(resolver.getPlatform('gitlab')).toBe(gitlabPlatform);
      expect(resolver.getPlatform('github')).toBe(githubPlatform);
    });

    it('should return null for unregistered platform', () => {
      expect(resolver.getPlatform('gitlab')).toBe(gitlabPlatform);
    });
  });

  describe('hasPlatform', () => {
    it('should return true for registered platforms', () => {
      expect(resolver.hasPlatform('gitlab')).toBe(true);
      expect(resolver.hasPlatform('github')).toBe(true);
    });

    it('should return false for unregistered platforms', () => {
      const emptyResolver = new PlatformResolver([]);
      expect(emptyResolver.hasPlatform('gitlab')).toBe(false);
    });
  });

  describe('getAllPlatforms', () => {
    it('should return all registered platforms', () => {
      const platforms = resolver.getAllPlatforms();

      expect(platforms).toHaveLength(2);
      expect(platforms).toContain(gitlabPlatform);
      expect(platforms).toContain(githubPlatform);
    });
  });
});
