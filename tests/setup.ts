/**
 * Jest setup file
 * Runs before each test suite
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in test output
process.env.ANTHROPIC_API_KEY = 'test-api-key';
process.env.GITLAB_TOKEN = 'test-gitlab-token';
process.env.GITLAB_WEBHOOK_SECRET = 'test-gitlab-secret';
process.env.GITHUB_TOKEN = 'test-github-token';
process.env.GITHUB_WEBHOOK_SECRET = 'test-github-secret';

// Extend Jest timeout for integration tests
jest.setTimeout(10000);
