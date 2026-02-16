import { parseChangedFiles, findAffectedDocTargets } from '../../src/util/config-loader';
import { DocBotConfig } from '../../src/util/config-loader';

describe('Config Loader', () => {
  describe('parseChangedFiles', () => {
    it('should parse changed files from diff', () => {
      const diff = `
diff --git a/src/compiler/parser.ts b/src/compiler/parser.ts
index abc123..def456 100644
--- a/src/compiler/parser.ts
+++ b/src/compiler/parser.ts
@@ -1,5 +1,5 @@

diff --git a/src/api/server.ts b/src/api/server.ts
index 111222..333444 100644
--- a/src/api/server.ts
+++ b/src/api/server.ts
`;

      const files = parseChangedFiles(diff);

      expect(files).toContain('src/compiler/parser.ts');
      expect(files).toContain('src/api/server.ts');
      expect(files).toHaveLength(2);
    });

    it('should handle file renames', () => {
      const diff = `
diff --git a/old-name.ts b/new-name.ts
similarity index 100%
rename from old-name.ts
rename to new-name.ts
`;

      const files = parseChangedFiles(diff);

      expect(files).toContain('new-name.ts');
    });

    it('should handle empty diff', () => {
      const files = parseChangedFiles('');
      expect(files).toHaveLength(0);
    });
  });

  describe('findAffectedDocTargets', () => {
    const config: DocBotConfig = {
      trigger: { mode: 'hybrid' },
      model: 'claude-sonnet-4-5-20250929',
      maxTurns: 20,
      docs: [
        {
          sourcePatterns: ['src/compiler/**', 'src/parser/**'],
          docsPath: 'docs/language/',
          mode: 'same-repo',
        },
        {
          sourcePatterns: ['src/api/**'],
          docsPath: 'docs/api/',
          mode: 'same-repo',
        },
        {
          sourcePatterns: ['src/runtime/**'],
          docsPath: 'docs/runtime/',
          mode: 'cross-repo',
          docsRepo: 'https://github.com/org/docs',
        },
      ],
    };

    it('should find affected doc targets', () => {
      const changedFiles = ['src/compiler/parser.ts', 'src/api/server.ts'];

      const affected = findAffectedDocTargets(config, changedFiles);

      expect(affected).toHaveLength(2);
      expect(affected[0].docsPath).toBe('docs/language/');
      expect(affected[1].docsPath).toBe('docs/api/');
    });

    it('should handle no affected targets', () => {
      const changedFiles = ['README.md', 'package.json'];

      const affected = findAffectedDocTargets(config, changedFiles);

      expect(affected).toHaveLength(0);
    });

    it('should not duplicate targets', () => {
      const changedFiles = ['src/compiler/parser.ts', 'src/compiler/lexer.ts'];

      const affected = findAffectedDocTargets(config, changedFiles);

      expect(affected).toHaveLength(1);
      expect(affected[0].docsPath).toBe('docs/language/');
    });

    it('should match glob patterns correctly', () => {
      const changedFiles = ['src/runtime/executor.ts'];

      const affected = findAffectedDocTargets(config, changedFiles);

      expect(affected).toHaveLength(1);
      expect(affected[0].mode).toBe('cross-repo');
      expect(affected[0].docsRepo).toBe('https://github.com/org/docs');
    });
  });
});
