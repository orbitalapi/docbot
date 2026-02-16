import { readFile, writeFile } from 'fs/promises';
import { load as loadYaml, dump as dumpYaml } from 'js-yaml';
import { z } from 'zod';

/**
 * Task configuration for iterative doc-bot runs
 * Allows running doc-bot in active mode rather than webhook-triggered mode
 */

export interface TaskConfig {
  /** Repository to clone (GitLab or GitHub URL) */
  repo: string;

  /** Platform: gitlab or github */
  platform: 'gitlab' | 'github';

  /** Project path (e.g., "org/repo") */
  project: string;

  /** Branch to check */
  branch: string;

  /** Base branch to compare against */
  baseBranch: string;

  /** Specific commits to check (optional - if not specified, checks latest commit) */
  commits?: string[];

  /** Existing PR/MR number (optional - if not specified, will create one) */
  pr?: string;

  /** Working directory for clones (optional) */
  workDir?: string;

  /** User instructions for the doc update (optional) */
  instructions?: string;
}

/**
 * Zod schema for validation
 */
const TaskConfigSchema = z.object({
  repo: z.string().url(),
  platform: z.enum(['gitlab', 'github']),
  project: z.string(),
  branch: z.string(),
  base_branch: z.string(),
  commits: z.array(z.string()).optional(),
  pr: z.string().optional(),
  work_dir: z.string().optional(),
  instructions: z.string().optional(),
});

/**
 * Load task configuration from YAML file
 */
export async function loadTaskConfig(filePath: string): Promise<TaskConfig> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const raw = loadYaml(content);

    // Validate with Zod
    const validated = TaskConfigSchema.parse(raw);

    // Transform snake_case to camelCase
    return {
      repo: validated.repo,
      platform: validated.platform,
      project: validated.project,
      branch: validated.branch,
      baseBranch: validated.base_branch,
      commits: validated.commits,
      pr: validated.pr,
      workDir: validated.work_dir,
      instructions: validated.instructions,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load task config: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Save task configuration to YAML file
 */
export async function saveTaskConfig(filePath: string, config: TaskConfig): Promise<void> {
  try {
    // Transform camelCase to snake_case
    const raw = {
      repo: config.repo,
      platform: config.platform,
      project: config.project,
      branch: config.branch,
      base_branch: config.baseBranch,
      commits: config.commits,
      pr: config.pr,
      work_dir: config.workDir,
      instructions: config.instructions,
    };

    const content = dumpYaml(raw, {
      indent: 2,
      lineWidth: 100,
    });

    await writeFile(filePath, content, 'utf-8');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to save task config: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Parse repository URL to extract platform and project
 */
export function parseRepoUrl(url: string): { platform: 'gitlab' | 'github'; project: string } {
  const urlObj = new URL(url);

  // Determine platform from hostname
  const platform = urlObj.hostname.includes('github') ? 'github' : 'gitlab';

  // Extract project path (remove .git if present)
  const project = urlObj.pathname.replace(/^\//, '').replace(/\.git$/, '');

  return { platform, project };
}

/**
 * Create a task config from minimal input
 */
export function createTaskConfig(
  repo: string,
  branch: string,
  baseBranch: string = 'main',
  instructions?: string
): TaskConfig {
  const { platform, project } = parseRepoUrl(repo);

  return {
    repo,
    platform,
    project,
    branch,
    baseBranch,
    instructions,
  };
}
