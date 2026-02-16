import { PlatformEvent } from '../platform/interface';
import { PlatformResolver } from '../platform/resolver';
import { GitManager } from '../git/manager';
import { SessionStore } from '../agent/session-store';
import { TaskQueue } from '../queue/task-queue';
import { createWorkflowContext, shouldProcessEvent } from '../workflows/common';
import { triageWorkflow } from '../workflows/triage';
import { updateWorkflow } from '../workflows/update';
import { reviseWorkflow } from '../workflows/revise';
import { reviewWorkflow } from '../workflows/review';
import { logger } from '../util/logger';

/**
 * Slash command types
 */
export type SlashCommand = 'update' | 'revise' | 'review' | 'status' | 'help';

/**
 * Parsed slash command
 */
export interface ParsedCommand {
  command: SlashCommand;
  args?: string;
}

/**
 * Event router
 * Routes webhook events to appropriate workflows
 */
export class EventRouter {
  constructor(
    private platformResolver: PlatformResolver,
    private gitManager: GitManager,
    private sessionStore: SessionStore,
    private taskQueue: TaskQueue,
    private apiKey: string
  ) {}

  /**
   * Route a platform event
   */
  async route(event: PlatformEvent): Promise<void> {
    const platform = this.platformResolver.getPlatform(event.platform);
    if (!platform) {
      logger.warn({ platform: event.platform }, 'Unknown platform, ignoring event');
      return;
    }

    logger.info(
      {
        type: event.type,
        platform: event.platform,
        project: event.project,
        mrId: event.mrId,
      },
      'Routing event'
    );

    // Handle comment events with slash commands
    if (event.type === 'comment' && event.commentBody) {
      const command = this.parseSlashCommand(event.commentBody);
      if (command) {
        await this.handleSlashCommand(event, command);
        return;
      }
    }

    // Handle MR open/update events
    if (event.type === 'mr_opened' || event.type === 'mr_updated') {
      await this.handleMREvent(event);
      return;
    }
  }

  /**
   * Parse slash command from comment body
   */
  private parseSlashCommand(commentBody: string): ParsedCommand | null {
    const match = commentBody.match(/^\/doc-bot\s+(\w+)(?:\s+(.+))?/i);
    if (!match) {
      return null;
    }

    const command = match[1].toLowerCase();
    const args = match[2]?.trim();

    const validCommands: SlashCommand[] = ['update', 'revise', 'review', 'status', 'help'];
    if (!validCommands.includes(command as SlashCommand)) {
      return null;
    }

    return {
      command: command as SlashCommand,
      args,
    };
  }

  /**
   * Handle slash command
   */
  private async handleSlashCommand(
    event: PlatformEvent,
    command: ParsedCommand
  ): Promise<void> {
    const taskId = `${event.platform}:${event.project}:${event.mrId}:${command.command}`;

    // Enqueue task to respect concurrency limits
    await this.taskQueue.enqueue(taskId, async () => {
      logger.info({ command: command.command, taskId }, 'Processing slash command');

      const platform = this.platformResolver.getPlatform(event.platform)!;

      // Handle special commands
      if (command.command === 'help') {
        await this.handleHelpCommand(platform, event);
        return;
      }

      if (command.command === 'status') {
        await this.handleStatusCommand(platform, event);
        return;
      }

      // Create workflow context
      const ctx = await createWorkflowContext(
        event,
        platform,
        this.platformResolver,
        this.gitManager
      );

      // Route to workflow
      switch (command.command) {
        case 'update':
          await updateWorkflow(ctx, this.apiKey, this.sessionStore, command.args);
          break;

        case 'revise':
          if (!command.args) {
            await platform.postComment(
              event.project,
              event.mrId,
              '## Doc-Bot\n\n`/doc-bot revise` requires feedback as an argument.\n\nExample: `/doc-bot revise please make the language more concise`'
            );
            return;
          }
          await reviseWorkflow(ctx, this.apiKey, this.sessionStore, command.args);
          break;

        case 'review':
          await reviewWorkflow(ctx, this.apiKey, this.sessionStore);
          break;
      }
    });
  }

  /**
   * Handle MR open/update events
   */
  private async handleMREvent(event: PlatformEvent): Promise<void> {
    const taskId = `${event.platform}:${event.project}:${event.mrId}:triage`;

    await this.taskQueue.enqueue(taskId, async () => {
      logger.info({ taskId }, 'Processing MR event');

      const platform = this.platformResolver.getPlatform(event.platform)!;

      const ctx = await createWorkflowContext(
        event,
        platform,
        this.platformResolver,
        this.gitManager
      );

      // Check if we should process based on trigger mode
      if (!shouldProcessEvent(ctx.config, event)) {
        logger.info({ mode: ctx.config.trigger.mode }, 'Event ignored due to trigger mode');
        return;
      }

      // Run triage for auto and hybrid modes
      if (ctx.config.trigger.mode === 'auto' || ctx.config.trigger.mode === 'hybrid') {
        await triageWorkflow(ctx, this.apiKey);
      }
    });
  }

  /**
   * Handle /doc-bot help command
   */
  private async handleHelpCommand(platform: any, event: PlatformEvent): Promise<void> {
    const help = `## Doc-Bot Help

Available commands:

- \`/doc-bot review\` — Analyze code changes and propose documentation updates in one step
- \`/doc-bot update [instructions]\` — Propose documentation changes (optionally with custom instructions)
- \`/doc-bot revise <feedback>\` — Revise previously proposed changes based on your feedback
- \`/doc-bot status\` — Show the current status for this MR/PR
- \`/doc-bot help\` — Show this help message

**Examples:**

\`\`\`
/doc-bot review
/doc-bot update — focus on the API reference, skip the tutorial
/doc-bot revise please make the language more concise
\`\`\`

**Configuration:**

Doc-Bot is configured via \`.doc-bot.yaml\` in your repository root.
See the documentation for configuration options.`;

    await platform.postComment(event.project, event.mrId, help);
  }

  /**
   * Handle /doc-bot status command
   */
  private async handleStatusCommand(platform: any, event: PlatformEvent): Promise<void> {
    const sessionId = this.sessionStore.get({
      platform: event.platform,
      project: event.project,
      mrId: event.mrId,
    });

    const status = sessionId
      ? `## Doc-Bot Status\n\n✅ Active session: \`${sessionId.substring(0, 12)}...\`\n\nYou can use \`/doc-bot revise\` to refine previous recommendations.`
      : `## Doc-Bot Status\n\n❌ No active session for this MR/PR.\n\nRun \`/doc-bot review\` or \`/doc-bot update\` to start.`;

    await platform.postComment(event.project, event.mrId, status);
  }
}
