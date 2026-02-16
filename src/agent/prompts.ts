import { DocTarget } from '../util/config-loader';

/**
 * System prompt for all agent invocations
 */
export const SYSTEM_PROMPT = `You are Doc-Bot, an AI assistant specialized in maintaining software documentation.

Your role is to keep documentation synchronized with code changes. You analyze code diffs,
understand the impact on documentation, and propose precise updates.

**Guiding Principles:**
- Be conservative: only propose changes when there is a clear documentation impact
- Preserve existing documentation structure and style
- Follow the project's style guide if provided
- Focus on accuracy over completeness
- Never modify non-documentation files
- When in doubt, explain the reasoning for your changes

**Available Tools:**
You have access to Read, Edit, Glob, Grep, and read-only git commands (diff, log, status).
You can read and edit documentation files, but you CANNOT commit, push, or perform other git write operations.

**Output Format:**
When you finish making documentation changes, provide a structured response with:
1. A concise commit message (conventional commit format)
2. An MR/PR description explaining what changed and why
3. A summary comment for the source MR/PR

Be professional, precise, and helpful.`;

/**
 * Triage prompt - analyzes if docs need updating
 */
export function buildTriagePrompt(
  diff: string,
  docTargets: DocTarget[],
  changedFiles: string[]
): string {
  const targetDescriptions = docTargets
    .map(
      (t, i) =>
        `${i + 1}. **${t.docsPath}** (${t.mode})\n   - Source patterns: ${t.sourcePatterns.join(', ')}`
    )
    .join('\n');

  return `# Documentation Triage Analysis

An MR/PR has been opened with the following code changes:

## Changed Files
${changedFiles.map((f) => `- ${f}`).join('\n')}

## Full Diff
\`\`\`diff
${diff}
\`\`\`

## Documentation Targets
${targetDescriptions}

## Your Task

Analyze this code diff and determine which documentation files (if any) need to be updated.

For each documentation target that may be affected:
1. Identify specific documentation files that need updating
2. Explain what changes would be needed and why
3. Cite specific code changes that motivate the doc updates

If no documentation updates are needed, explain why.

**Important:** Do NOT make any changes yet. This is analysis only.

Provide your analysis as a clear, structured markdown comment that can be posted on the MR/PR.`;
}

/**
 * Update prompt with tools - makes documentation changes with file operations
 */
export function buildUpdatePromptWithTools(
  diff: string,
  docTargets: DocTarget[],
  changedFiles: string[],
  styleGuide?: string,
  userInstructions?: string,
  sameRepo: boolean = true
): string {
  const targetDescriptions = docTargets
    .map(
      (t, i) =>
        `${i + 1}. **${t.docsPath}** (${t.mode})${t.docsRepo ? `\n   - Docs repo: ${t.docsRepo}` : ''}`
    )
    .join('\n');

  const styleSection = styleGuide
    ? `\n## Style Guide\n\n${styleGuide}\n`
    : '\n## Style Guide\n\nNo specific style guide provided. Follow the existing style in the documentation.\n';

  const userSection = userInstructions
    ? `\n## User Instructions\n\n${userInstructions}\n`
    : '';

  const repoContext = sameRepo
    ? 'The documentation is in the same repository as the source code.'
    : 'The documentation is in a separate repository from the source code.';

  return `# Documentation Update Task

You are updating documentation to reflect code changes in an MR/PR.

${repoContext}

## Changed Files
${changedFiles.map((f) => `- ${f}`).join('\n')}

## Code Diff
\`\`\`diff
${diff}
\`\`\`

## Documentation Targets
${targetDescriptions}
${styleSection}${userSection}
## Your Task

Use the available tools to:
1. **Explore** the documentation structure using \`glob\` or \`list_directory\`
2. **Read** the current documentation files using \`read_file\`
3. **Analyze** the code changes and their impact on the docs
4. **Update** the documentation files using \`write_file\` to reflect the changes
5. **Verify** your changes by reading the files back

When finished, provide a summary including:
- What files you modified
- What changes you made and why
- Any notes or concerns

**Important Guidelines:**
- Only edit documentation files, never code files
- Preserve the existing documentation structure and style
- Be precise and focused - only change what's affected by the code changes
- Use write_file to completely replace file contents (not append)
- Follow the style guide if provided

Begin by exploring the documentation structure.`;
}

/**
 * Update prompt - makes documentation changes (legacy, non-tool version)
 */
export function buildUpdatePrompt(
  diff: string,
  docTargets: DocTarget[],
  changedFiles: string[],
  styleGuide?: string,
  userInstructions?: string
): string {
  const targetDescriptions = docTargets
    .map(
      (t, i) =>
        `${i + 1}. **${t.docsPath}** (${t.mode})${t.docsRepo ? `\n   - Docs repo: ${t.docsRepo}` : ''}`
    )
    .join('\n');

  const styleSection = styleGuide
    ? `\n## Style Guide\n\n${styleGuide}\n`
    : '\n## Style Guide\n\nNo specific style guide provided. Follow the existing style in the documentation.\n';

  const userSection = userInstructions
    ? `\n## User Instructions\n\n${userInstructions}\n`
    : '';

  return `# Documentation Update Task

You are updating documentation to reflect code changes in an MR/PR.

## Changed Files
${changedFiles.map((f) => `- ${f}`).join('\n')}

## Code Diff
\`\`\`diff
${diff}
\`\`\`

## Documentation Targets
${targetDescriptions}
${styleSection}${userSection}
## Your Task

1. Read the current documentation in the specified paths
2. Analyze the code changes and their impact on the docs
3. Update the documentation files to reflect the changes
4. Ensure consistency with the style guide
5. When finished, provide:
   - A commit message (conventional commits format, e.g., "docs: update API reference for new endpoint")
   - An MR/PR description explaining what was changed and why
   - A summary comment for the source MR/PR

**Important:**
- Only edit documentation files, never code files
- Preserve the existing documentation structure
- Be precise and concise
- Focus on the specific changes, don't rewrite unrelated sections

Begin by exploring the documentation structure and reading the relevant files.`;
}

/**
 * Revise prompt - revises previously proposed changes based on feedback
 */
export function buildRevisePrompt(feedback: string): string {
  return `# Documentation Revision Request

A reviewer has provided feedback on your proposed documentation changes:

---
${feedback}
---

## Your Task

Please revise the documentation changes according to this feedback.

1. Understand the reviewer's concerns or suggestions
2. Make the requested changes to the documentation
3. When finished, provide an updated:
   - Commit message
   - MR/PR description
   - Summary comment

The changes will be force-pushed to the existing documentation branch.`;
}

/**
 * Review prompt - combines triage and update in one step
 */
export function buildReviewPrompt(
  diff: string,
  docTargets: DocTarget[],
  changedFiles: string[],
  styleGuide?: string
): string {
  return `# Documentation Review and Update

You are performing a complete documentation review for an MR/PR.

This is a two-step process:
1. First, analyze which documentation needs updating (triage)
2. Then, immediately make those updates

${buildUpdatePrompt(diff, docTargets, changedFiles, styleGuide)}

Begin by analyzing the code changes to understand what documentation impact they have,
then proceed directly to making the necessary updates.`;
}

/**
 * Parse structured output from agent
 * Expected format includes commit message, MR description, and summary
 */
export interface AgentOutput {
  commitMessage?: string;
  mrDescription?: string;
  summary?: string;
}

/**
 * Extract structured output from agent response
 * This is a simple parser that looks for specific markers
 */
export function parseAgentOutput(response: string): AgentOutput {
  const output: AgentOutput = {};

  // Extract commit message
  const commitMatch = response.match(
    /(?:commit message|commit):\s*\n*["']?([^\n"']+)["']?/i
  );
  if (commitMatch) {
    output.commitMessage = commitMatch[1].trim();
  }

  // Extract MR description
  const mrMatch = response.match(
    /(?:MR description|PR description|description):\s*\n*```?\n?([\s\S]+?)\n?```?/i
  );
  if (mrMatch) {
    output.mrDescription = mrMatch[1].trim();
  }

  // Extract summary
  const summaryMatch = response.match(/(?:summary|comment):\s*\n*```?\n?([\s\S]+?)\n?```?/i);
  if (summaryMatch) {
    output.summary = summaryMatch[1].trim();
  }

  return output;
}
