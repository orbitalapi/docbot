#!/usr/bin/env node
import { program } from 'commander';
import { loadTaskConfig, saveTaskConfig, createTaskConfig } from './task/config';
import { TaskExecutor } from './task/executor';
import { PlatformResolver } from './platform/resolver';
import { GitManager } from './git/manager';
import { SessionStore } from './agent/session-store';
import { loadConfig } from './config';
import { logger } from './util/logger';

/**
 * CLI for running doc-bot in task mode
 * Allows iterative/active mode operation instead of webhook-triggered
 */

program
  .name('doc-bot-task')
  .description('Run doc-bot in task mode for iterative documentation updates')
  .version('1.0.0');

program
  .command('run')
  .description('Execute a task from a configuration file')
  .argument('<config-file>', 'Path to task configuration YAML file')
  .option('--dry-run', 'Analyze changes without making updates')
  .action(async (configFile: string, options: { dryRun?: boolean }) => {
    try {
      // Load task config
      const taskConfig = await loadTaskConfig(configFile);

      // Load app config
      const appConfig = loadConfig();

      // Create platform resolver
      const platformResolver = new PlatformResolver(appConfig);

      // Create git manager
      const gitManager = new GitManager(taskConfig.workDir);

      // Create session store
      const sessionStore = new SessionStore(appConfig.sessionTtlHours);

      // Create executor
      const executor = new TaskExecutor(
        platformResolver,
        gitManager,
        appConfig.anthropicApiKey,
        sessionStore
      );

      if (options.dryRun) {
        await executor.dryRun(taskConfig);
      } else {
        await executor.execute(taskConfig, configFile);
      }

      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      logger.error({ error }, 'Task execution failed');
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create a new task configuration file')
  .argument('<repo>', 'Repository URL (e.g., https://github.com/org/repo)')
  .argument('<branch>', 'Branch to check for changes')
  .option('-b, --base <branch>', 'Base branch to compare against', 'main')
  .option('-o, --output <file>', 'Output file path', 'doc-bot-task.yaml')
  .option('-i, --instructions <text>', 'User instructions for documentation updates')
  .action(
    async (
      repo: string,
      branch: string,
      options: { base: string; output: string; instructions?: string }
    ) => {
      try {
        const taskConfig = createTaskConfig(repo, branch, options.base, options.instructions);

        await saveTaskConfig(options.output, taskConfig);

        console.log(`✅ Created task configuration: ${options.output}`);
        console.log(`\nTo run: doc-bot-task run ${options.output}`);
        console.log(`To preview: doc-bot-task run ${options.output} --dry-run`);

        process.exit(0);
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }
  );

program
  .command('status')
  .description('Show status of a task')
  .argument('<config-file>', 'Path to task configuration YAML file')
  .action(async (configFile: string) => {
    try {
      const taskConfig = await loadTaskConfig(configFile);

      console.log('\n📋 Task Status\n');
      console.log(`Repository: ${taskConfig.repo}`);
      console.log(`Platform:   ${taskConfig.platform}`);
      console.log(`Project:    ${taskConfig.project}`);
      console.log(`Branch:     ${taskConfig.branch}`);
      console.log(`Base:       ${taskConfig.baseBranch}`);

      if (taskConfig.pr) {
        console.log(`PR/MR:      #${taskConfig.pr}`);
      } else {
        console.log(`PR/MR:      (not created yet)`);
      }

      if (taskConfig.commits && taskConfig.commits.length > 0) {
        console.log(`\nCommits:`);
        taskConfig.commits.forEach((c) => console.log(`  - ${c}`));
      }

      if (taskConfig.instructions) {
        console.log(`\nInstructions:\n${taskConfig.instructions}`);
      }

      console.log('');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parse();
