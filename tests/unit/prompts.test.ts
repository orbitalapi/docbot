import {
  buildTriagePrompt,
  buildUpdatePrompt,
  buildRevisePrompt,
  buildReviewPrompt,
  parseAgentOutput,
} from '../../src/agent/prompts';
import { DocTarget } from '../../src/util/config-loader';

describe('Agent Prompts', () => {
  const mockDocTargets: DocTarget[] = [
    {
      sourcePatterns: ['src/compiler/**'],
      docsPath: 'docs/language/',
      mode: 'same-repo',
    },
    {
      sourcePatterns: ['src/api/**'],
      docsPath: 'docs/api/',
      mode: 'cross-repo',
      docsRepo: 'https://github.com/org/api-docs',
    },
  ];

  const mockChangedFiles = ['src/compiler/parser.ts', 'src/api/server.ts'];
  const mockDiff = `diff --git a/src/compiler/parser.ts b/src/compiler/parser.ts
index abc123..def456 100644
--- a/src/compiler/parser.ts
+++ b/src/compiler/parser.ts`;

  describe('buildTriagePrompt', () => {
    it('should include changed files in prompt', () => {
      const prompt = buildTriagePrompt(mockDiff, mockDocTargets, mockChangedFiles);

      expect(prompt).toContain('src/compiler/parser.ts');
      expect(prompt).toContain('src/api/server.ts');
    });

    it('should include diff in prompt', () => {
      const prompt = buildTriagePrompt(mockDiff, mockDocTargets, mockChangedFiles);

      expect(prompt).toContain('diff --git');
      expect(prompt).toContain('src/compiler/parser.ts');
    });

    it('should describe documentation targets', () => {
      const prompt = buildTriagePrompt(mockDiff, mockDocTargets, mockChangedFiles);

      expect(prompt).toContain('docs/language/');
      expect(prompt).toContain('docs/api/');
      expect(prompt).toContain('same-repo');
      expect(prompt).toContain('cross-repo');
    });

    it('should instruct not to make changes', () => {
      const prompt = buildTriagePrompt(mockDiff, mockDocTargets, mockChangedFiles);

      expect(prompt).toContain('Do NOT make any changes yet');
    });
  });

  describe('buildUpdatePrompt', () => {
    it('should include style guide when provided', () => {
      const styleGuide = '# Style Guide\nUse active voice.';
      const prompt = buildUpdatePrompt(mockDiff, mockDocTargets, mockChangedFiles, styleGuide);

      expect(prompt).toContain('Style Guide');
      expect(prompt).toContain('Use active voice');
    });

    it('should include user instructions when provided', () => {
      const instructions = 'Focus on the API reference';
      const prompt = buildUpdatePrompt(
        mockDiff,
        mockDocTargets,
        mockChangedFiles,
        undefined,
        instructions
      );

      expect(prompt).toContain('User Instructions');
      expect(prompt).toContain('Focus on the API reference');
    });

    it('should mention docs repo for cross-repo targets', () => {
      const prompt = buildUpdatePrompt(mockDiff, mockDocTargets, mockChangedFiles);

      expect(prompt).toContain('https://github.com/org/api-docs');
    });

    it('should request structured output', () => {
      const prompt = buildUpdatePrompt(mockDiff, mockDocTargets, mockChangedFiles);

      expect(prompt).toContain('commit message');
      expect(prompt).toContain('MR/PR description');
    });
  });

  describe('buildRevisePrompt', () => {
    it('should include feedback', () => {
      const feedback = 'Please make the language more concise';
      const prompt = buildRevisePrompt(feedback);

      expect(prompt).toContain(feedback);
    });

    it('should ask for revision', () => {
      const prompt = buildRevisePrompt('Some feedback');

      expect(prompt).toContain('revise');
      expect(prompt).toContain('feedback');
    });
  });

  describe('buildReviewPrompt', () => {
    it('should combine triage and update', () => {
      const prompt = buildReviewPrompt(mockDiff, mockDocTargets, mockChangedFiles);

      expect(prompt).toContain('two-step process');
      expect(prompt).toContain('analyze');
      expect(prompt).toContain('making the necessary updates');
    });
  });

  describe('parseAgentOutput', () => {
    it('should parse commit message', () => {
      const response = `
Here are my recommendations:

Commit message: "docs: update parser documentation"

The parser has changed significantly.
`;

      const output = parseAgentOutput(response);

      expect(output.commitMessage).toBe('docs: update parser documentation');
    });

    it('should parse MR description', () => {
      const response = `
MR description:
\`\`\`
Updated the parser docs to reflect the new AST structure.
\`\`\`
`;

      const output = parseAgentOutput(response);

      expect(output.mrDescription).toBe(
        'Updated the parser docs to reflect the new AST structure.'
      );
    });

    it('should parse summary', () => {
      const response = `
Summary:
\`\`\`
Updated 3 documentation files to reflect API changes.
\`\`\`
`;

      const output = parseAgentOutput(response);

      expect(output.summary).toBe('Updated 3 documentation files to reflect API changes.');
    });

    it('should handle missing fields', () => {
      const response = 'Just some text without structured output';

      const output = parseAgentOutput(response);

      expect(output.commitMessage).toBeUndefined();
      expect(output.mrDescription).toBeUndefined();
      expect(output.summary).toBeUndefined();
    });

    it('should handle multiple fields', () => {
      const response = `
Commit message: "docs: comprehensive update"

MR description:
\`\`\`
Updated all affected documentation files.
\`\`\`

Summary:
\`\`\`
Complete documentation refresh.
\`\`\`
`;

      const output = parseAgentOutput(response);

      expect(output.commitMessage).toBe('docs: comprehensive update');
      expect(output.mrDescription).toBe('Updated all affected documentation files.');
      expect(output.summary).toBe('Complete documentation refresh.');
    });
  });
});
