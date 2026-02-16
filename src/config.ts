import { z } from 'zod';
import { logger } from './util/logger';

/**
 * Environment configuration schema
 */
const ConfigSchema = z.object({
  // Core
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  CONCURRENCY_LIMIT: z.coerce.number().int().positive().default(3),
  MAX_COST_PER_INVOCATION: z.coerce.number().positive().default(2.0),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(24),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  CLONE_BASE_DIR: z.string().default('/tmp/doc-bot'),

  // GitLab (optional - only required if using GitLab repos)
  GITLAB_TOKEN: z.string().optional(),
  GITLAB_URL: z.string().url().default('https://gitlab.com'),
  GITLAB_WEBHOOK_SECRET: z.string().optional(),

  // GitHub (optional - only required if using GitHub repos)
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load and validate environment configuration
 */
export function loadConfig(): Config {
  try {
    const config = ConfigSchema.parse(process.env);

    // Validate that at least one platform is configured
    const hasGitLab = !!(config.GITLAB_TOKEN && config.GITLAB_WEBHOOK_SECRET);
    const hasGitHub = !!(
      (config.GITHUB_APP_ID && config.GITHUB_PRIVATE_KEY) ||
      config.GITHUB_TOKEN
    );

    if (!config.GITHUB_WEBHOOK_SECRET && hasGitHub) {
      throw new Error('GITHUB_WEBHOOK_SECRET is required when GitHub is configured');
    }

    if (!hasGitLab && !hasGitHub) {
      throw new Error(
        'At least one platform must be configured (GitLab or GitHub). ' +
          'For GitLab: set GITLAB_TOKEN and GITLAB_WEBHOOK_SECRET. ' +
          'For GitHub: set (GITHUB_APP_ID + GITHUB_PRIVATE_KEY or GITHUB_TOKEN) and GITHUB_WEBHOOK_SECRET.'
      );
    }

    logger.info(
      {
        port: config.PORT,
        concurrency: config.CONCURRENCY_LIMIT,
        platforms: {
          gitlab: hasGitLab,
          github: hasGitHub,
        },
      },
      'Configuration loaded'
    );

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ errors: error.errors }, 'Configuration validation failed');
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if GitLab is configured
 */
export function isGitLabConfigured(config: Config): boolean {
  return !!(config.GITLAB_TOKEN && config.GITLAB_WEBHOOK_SECRET);
}

/**
 * Check if GitHub is configured
 */
export function isGitHubConfigured(config: Config): boolean {
  return !!(
    ((config.GITHUB_APP_ID && config.GITHUB_PRIVATE_KEY) || config.GITHUB_TOKEN) &&
    config.GITHUB_WEBHOOK_SECRET
  );
}
