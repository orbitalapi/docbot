import { readFile } from 'fs/promises';
import { load as loadYaml } from 'js-yaml';
import { z } from 'zod';
import { minimatch } from 'minimatch';

/**
 * Trigger mode for the bot
 */
export type TriggerMode = 'auto' | 'slash-command' | 'hybrid';

/**
 * Documentation mode
 */
export type DocMode = 'same-repo' | 'cross-repo';

/**
 * Documentation target configuration
 */
export interface DocTarget {
  /** Glob patterns for source files that map to this doc target */
  sourcePatterns: string[];
  /** Path to documentation directory (relative to repo root) */
  docsPath: string;
  /** Where the documentation lives */
  mode: DocMode;
  /** Clone URL for docs repo (required if mode is cross-repo) */
  docsRepo?: string;
}

/**
 * Doc-Bot project configuration (.doc-bot.yaml)
 */
export interface DocBotConfig {
  /** Trigger configuration */
  trigger: {
    mode: TriggerMode;
  };
  /** Claude model to use */
  model: string;
  /** Maximum agent turns per invocation */
  maxTurns: number;
  /** Path to style guide file (relative to repo root) */
  styleGuide?: string;
  /** Documentation targets */
  docs: DocTarget[];
}

/**
 * Zod schema for validation
 */
const DocTargetSchema = z.object({
  source_patterns: z.array(z.string()).min(1),
  docs_path: z.string(),
  mode: z.enum(['same-repo', 'cross-repo']),
  docs_repo: z.string().optional(),
});

const DocBotConfigSchema = z.object({
  trigger: z
    .object({
      mode: z.enum(['auto', 'slash-command', 'hybrid']).default('hybrid'),
    })
    .default({ mode: 'hybrid' }),
  model: z.string().default('claude-sonnet-4-5-20250929'),
  max_turns: z.number().int().positive().default(20),
  style_guide: z.string().optional(),
  docs: z.array(DocTargetSchema).min(1),
});

/**
 * Load and validate .doc-bot.yaml configuration
 */
export async function loadConfig(filePath: string): Promise<DocBotConfig> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const raw = loadYaml(content);

    // Validate with Zod
    const validated = DocBotConfigSchema.parse(raw);

    // Transform snake_case to camelCase
    return {
      trigger: validated.trigger,
      model: validated.model,
      maxTurns: validated.max_turns,
      styleGuide: validated.style_guide,
      docs: validated.docs.map((doc) => ({
        sourcePatterns: doc.source_patterns,
        docsPath: doc.docs_path,
        mode: doc.mode,
        docsRepo: doc.docs_repo,
      })),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load .doc-bot.yaml: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate configuration for consistency
 */
export function validateConfig(config: DocBotConfig): void {
  // Check that cross-repo targets have a docs_repo
  for (const doc of config.docs) {
    if (doc.mode === 'cross-repo' && !doc.docsRepo) {
      throw new Error(
        `Cross-repo doc target with docs_path "${doc.docsPath}" must specify docs_repo`
      );
    }
  }
}

/**
 * Find which doc targets are affected by changed files
 */
export function findAffectedDocTargets(
  config: DocBotConfig,
  changedFiles: string[]
): DocTarget[] {
  const affected = new Set<DocTarget>();

  for (const file of changedFiles) {
    for (const doc of config.docs) {
      for (const pattern of doc.sourcePatterns) {
        if (minimatch(file, pattern)) {
          affected.add(doc);
          break; // Move to next doc target
        }
      }
    }
  }

  return Array.from(affected);
}

/**
 * Parse changed files from a git diff
 */
export function parseChangedFiles(diff: string): string[] {
  const files = new Set<string>();

  // Match diff headers like: diff --git a/path/to/file b/path/to/file
  const diffHeaderRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;

  let match;
  while ((match = diffHeaderRegex.exec(diff)) !== null) {
    // Use the 'b' path (new path) as it reflects renames
    files.add(match[2]);
  }

  return Array.from(files);
}
