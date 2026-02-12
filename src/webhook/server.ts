import express, { Request, Response } from 'express';
import { PlatformResolver } from '../platform/resolver';
import { EventRouter } from './router';
import { logger } from '../util/logger';

/**
 * Webhook server
 * Receives and validates webhooks from GitLab and GitHub
 */
export class WebhookServer {
  private app: express.Application;

  constructor(
    private platformResolver: PlatformResolver,
    private eventRouter: EventRouter
  ) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());

    // Request logging
    this.app.use((req, _res, next) => {
      logger.debug(
        {
          method: req.method,
          path: req.path,
          headers: {
            'x-gitlab-event': req.headers['x-gitlab-event'],
            'x-github-event': req.headers['x-github-event'],
          },
        },
        'Incoming request'
      );
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, _res: Response) => {
      const stats = this.eventRouter['taskQueue'].getStats();
      _res.json({
        status: 'ok',
        queue: stats,
        timestamp: new Date().toISOString(),
      });
    });

    // GitLab webhook
    const gitlabPlatform = this.platformResolver.getPlatform('gitlab');
    if (gitlabPlatform) {
      this.app.post('/webhooks/gitlab', async (req: Request, res: Response) => {
        await this.handleWebhook(req, res, gitlabPlatform);
      });
      logger.info('GitLab webhook endpoint registered at /webhooks/gitlab');
    }

    // GitHub webhook
    const githubPlatform = this.platformResolver.getPlatform('github');
    if (githubPlatform) {
      this.app.post('/webhooks/github', async (req: Request, res: Response) => {
        await this.handleWebhook(req, res, githubPlatform);
      });
      logger.info('GitHub webhook endpoint registered at /webhooks/github');
    }

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: any) => {
      logger.error({ error: err }, 'Server error');
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * Handle webhook request
   */
  private async handleWebhook(req: Request, res: Response, platform: any): Promise<void> {
    // Validate webhook
    if (!platform.validateWebhook(req)) {
      logger.warn({ platform: platform.name }, 'Invalid webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Parse event
    const event = platform.parseWebhookEvent(req);

    if (!event) {
      logger.debug('Event not actionable, ignoring');
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    // Acknowledge webhook immediately
    res.status(202).json({ message: 'Accepted' });

    // Route event asynchronously
    try {
      await this.eventRouter.route(event);
    } catch (error) {
      logger.error({ error, event }, 'Failed to process event');
    }
  }

  /**
   * Start the server
   */
  listen(port: number): void {
    this.app.listen(port, () => {
      logger.info({ port }, 'Webhook server listening');
    });
  }

  /**
   * Get Express app (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }
}
