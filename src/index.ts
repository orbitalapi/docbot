import { loadConfig, isGitLabConfigured, isGitHubConfigured } from './config';
import { GitLabAdapter } from './platform/gitlab/adapter';
import { GitHubAdapter } from './platform/github/adapter';
import { PlatformResolver } from './platform/resolver';
import { GitManager } from './git/manager';
import { SessionStore } from './agent/session-store';
import { TaskQueue } from './queue/task-queue';
import { EventRouter } from './webhook/router';
import { WebhookServer } from './webhook/server';
import { logger } from './util/logger';
import { Platform } from './platform/interface';

/**
 * Main entry point for Doc-Bot service
 */
async function main() {
  logger.info('Starting Doc-Bot service...');

  // Load configuration
  const config = loadConfig();

  // Initialize platform adapters
  const platforms: Platform[] = [];

  if (isGitLabConfigured(config)) {
    logger.info('Initializing GitLab adapter');
    const gitlabAdapter = new GitLabAdapter(
      config.GITLAB_TOKEN!,
      config.GITLAB_WEBHOOK_SECRET!,
      config.GITLAB_URL
    );
    platforms.push(gitlabAdapter);
  }

  if (isGitHubConfigured(config)) {
    logger.info('Initializing GitHub adapter');
    const githubAdapter = new GitHubAdapter(
      {
        appId: config.GITHUB_APP_ID,
        privateKey: config.GITHUB_PRIVATE_KEY,
        token: config.GITHUB_TOKEN,
      },
      config.GITHUB_WEBHOOK_SECRET!
    );
    platforms.push(githubAdapter);
  }

  if (platforms.length === 0) {
    logger.error('No platforms configured. Exiting.');
    process.exit(1);
  }

  // Initialize platform resolver
  const platformResolver = new PlatformResolver(platforms, config.GITLAB_URL);

  // Initialize Git manager
  const gitManager = new GitManager(config.CLONE_BASE_DIR);

  // Initialize session store
  const sessionStore = new SessionStore(config.SESSION_TTL_HOURS);

  // Initialize task queue
  const taskQueue = new TaskQueue(config.CONCURRENCY_LIMIT);

  // Initialize event router
  const eventRouter = new EventRouter(
    platformResolver,
    gitManager,
    sessionStore,
    taskQueue,
    config.ANTHROPIC_API_KEY
  );

  // Initialize webhook server
  const webhookServer = new WebhookServer(platformResolver, eventRouter);

  // Start server
  webhookServer.listen(config.PORT);

  logger.info(
    {
      platforms: platforms.map((p) => p.name),
      concurrency: config.CONCURRENCY_LIMIT,
      sessionTTL: config.SESSION_TTL_HOURS,
    },
    'Doc-Bot service started successfully'
  );

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');

    // Wait for pending tasks to complete
    logger.info('Waiting for pending tasks to complete...');
    await taskQueue.drain();

    logger.info('Shutdown complete');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');

    await taskQueue.drain();

    logger.info('Shutdown complete');
    process.exit(0);
  });
}

// Run the service
main().catch((error) => {
  logger.error({ error }, 'Fatal error during startup');
  process.exit(1);
});
