import { Platform, PlatformEvent } from '../platform/interface';
import { PlatformResolver } from '../platform/resolver';
import { GitManager } from '../git/manager';
import { loadConfig, DocBotConfig, parseChangedFiles, findAffectedDocTargets } from '../util/config-loader';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { logger } from '../util/logger';

/**
 * Context for workflow execution
 */
export interface WorkflowContext {
  event: PlatformEvent;
  platform: Platform;
  platformResolver: PlatformResolver;
  gitManager: GitManager;
  config: DocBotConfig;
  diff: string;
  changedFiles: string[];
  styleGuide?: string;
}

/**
 * Load project configuration and create workflow context
 */
export async function createWorkflowContext(
  event: PlatformEvent,
  platform: Platform,
  platformResolver: PlatformResolver,
  gitManager: GitManager
): Promise<WorkflowContext> {
  logger.info({ event: event.type, project: event.project, mrId: event.mrId }, 'Creating workflow context');

  // Get diff
  const diff = await platform.getDiff(event.project, event.mrId);

  // Parse changed files
  const changedFiles = parseChangedFiles(diff);

  // Clone source repo to read config
  const cloneUrl = await platform.getAuthenticatedCloneUrl(event.project);
  const { workDir } = await gitManager.clone({
    repoUrl: cloneUrl,
    branch: event.sourceBranch,
  });

  try {
    // Load .doc-bot.yaml
    const configPath = join(workDir, '.doc-bot.yaml');
    const config = await loadConfig(configPath);

    // Load style guide if specified
    let styleGuide: string | undefined;
    if (config.styleGuide) {
      const styleGuidePath = join(workDir, config.styleGuide);
      try {
        styleGuide = await readFile(styleGuidePath, 'utf-8');
      } catch (error) {
        logger.warn({ path: config.styleGuide }, 'Style guide file not found, continuing without it');
      }
    }

    return {
      event,
      platform,
      platformResolver,
      gitManager,
      config,
      diff,
      changedFiles,
      styleGuide,
    };
  } finally {
    // Clean up the temporary clone
    await gitManager.cleanup(workDir);
  }
}

/**
 * Check if any documentation targets are affected by the changes
 */
export function getAffectedDocTargets(ctx: WorkflowContext) {
  return findAffectedDocTargets(ctx.config, ctx.changedFiles);
}

/**
 * Generate a unique branch name for doc changes
 */
export function generateDocBranchName(event: PlatformEvent): string {
  return `doc-bot/${event.platform}-${event.project.replace(/\//g, '-')}-mr-${event.mrId}`;
}

/**
 * Check if the bot should process this event based on trigger mode
 */
export function shouldProcessEvent(config: DocBotConfig, event: PlatformEvent): boolean {
  const { mode } = config.trigger;

  if (mode === 'slash-command') {
    // Only process comment events with slash commands
    return event.type === 'comment';
  }

  if (mode === 'auto') {
    // Process all MR events
    return event.type === 'mr_opened' || event.type === 'mr_updated';
  }

  if (mode === 'hybrid') {
    // Process MR events for triage, and comments for actions
    return true;
  }

  return false;
}
