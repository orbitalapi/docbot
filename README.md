# Doc-Bot: Automated Documentation Maintenance

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Doc-Bot is a lightweight TypeScript service that automatically maintains documentation in sync with code changes across GitLab and GitHub repositories. When a Merge Request (GitLab) or Pull Request (GitHub) is opened or updated, Doc-Bot analyses the diff, identifies which documentation may be affected, and suggests updates via comments.

## Features

- **Multi-Platform Support**: Works with both GitLab and GitHub
- **Cross-Platform Documentation**: Supports scenarios where source code is on one platform and docs are on another
- **Intelligent Triage**: Automatically identifies which docs need updating based on code changes
- **Slash Commands**: Control the bot via simple commands like `/doc-bot review`
- **Configurable Triggers**: Auto-triage, slash-command-only, or hybrid mode
- **Style-Aware**: Respects project-specific documentation style guides
- **Session-Based Feedback**: Provide feedback and refine suggestions iteratively
- **Minimal Infrastructure**: Single Docker container, no database required

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Anthropic API key
- GitLab Access Token and/or GitHub credentials (App or Personal Access Token)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/docbot.git
   cd docbot
   ```

2. Copy the example environment file and configure it:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Build and start the service:
   ```bash
   docker-compose up -d
   ```

4. Check the service is running:
   ```bash
   curl http://localhost:3000/health
   ```

### Configuration

Create a `.doc-bot.yaml` file in the root of your repository:

```yaml
# Trigger mode: auto, slash-command, or hybrid
trigger:
  mode: hybrid

# Claude model to use
model: claude-sonnet-4-5-20250929

# Maximum agent turns per invocation
max_turns: 20

# Path to style guide (optional)
style_guide: docs/docs-style.md

# Documentation targets
docs:
  # Same-repo docs
  - source_patterns:
      - "src/compiler/**"
      - "src/parser/**"
    docs_path: docs/language/
    mode: same-repo

  # Cross-repo docs (can be on different platform)
  - source_patterns:
      - "src/api/**"
    docs_repo: https://github.com/yourorg/api-docs
    docs_path: docs/
    mode: cross-repo
```

See [.doc-bot.example.yaml](.doc-bot.example.yaml) for a complete example.

## Usage

### Slash Commands

Doc-Bot responds to the following commands in MR/PR comments:

- `/doc-bot review` — Analyze code changes and propose documentation updates
- `/doc-bot update [instructions]` — Propose doc changes (optionally with custom instructions)
- `/doc-bot revise <feedback>` — Revise previously proposed changes based on feedback
- `/doc-bot status` — Show current session status
- `/doc-bot help` — Show help message

### Examples

```markdown
/doc-bot review

/doc-bot update — focus on the API reference, skip the tutorial

/doc-bot revise please make the language more concise
```

### Trigger Modes

#### Auto Mode
Bot automatically comments on every MR/PR that touches documentation-mapped source files.

#### Slash-Command Mode
Bot only acts when explicitly invoked via `/doc-bot` commands.

#### Hybrid Mode (Recommended)
Bot auto-triages on MR/PR open/update and posts suggestions, but only takes action when commanded.

## Platform Setup

### GitLab

#### Option 1: Project-Level Webhook (Free Tier)

1. Create a Project Access Token or Personal Access Token with `api` scope
2. Configure project webhook on each repository:
   - Go to **Settings → Webhooks**
   - **URL**: `https://your-docbot-host/webhooks/gitlab`
   - **Secret Token**: Your webhook secret
   - **Triggers**: ✓ Merge request events, ✓ Comments
3. Set environment variables:
   ```
   GITLAB_TOKEN=your-project-or-personal-token
   GITLAB_WEBHOOK_SECRET=your-webhook-secret
   GITLAB_URL=https://gitlab.com  # or your self-hosted instance
   ```

#### Option 2: Group-Level Webhook (Premium/Ultimate)

If you have GitLab Premium or Ultimate, you can set up a single webhook for all projects in a group:

1. Create a Group Access Token with `api` scope
2. Configure group-level webhook at **Group → Settings → Webhooks**:
   - **URL**: `https://your-docbot-host/webhooks/gitlab`
   - **Secret Token**: Your webhook secret
   - **Triggers**: ✓ Merge request events, ✓ Comments
3. Set environment variables (same as Option 1)

> **Note**: Both options work identically. Group-level webhooks are just a convenience to avoid setting up webhooks on each project individually.

### GitHub

#### Option 1: GitHub App (Recommended)

1. Create a GitHub App:
   - **Permissions**:
     - Repository: Contents (Read & Write), Pull Requests (Read & Write), Issues (Read & Write)
   - **Events**: Pull request, Issue comment
   - **Webhook URL**: `https://your-docbot-host/webhooks/github`
   - **Webhook Secret**: Your webhook secret
2. Install the app on your repositories
3. Set environment variables:
   ```
   GITHUB_APP_ID=your-app-id
   GITHUB_PRIVATE_KEY=your-app-private-key
   GITHUB_WEBHOOK_SECRET=your-webhook-secret
   ```

#### Option 2: Personal Access Token (No App Install Required)

1. Create a Personal Access Token with `repo` scope
2. Configure webhooks on each repository:
   - Go to **Settings → Webhooks → Add webhook**
   - **Payload URL**: `https://your-docbot-host/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Your webhook secret
   - **Events**: ✓ Pull requests, ✓ Issue comments
3. Set environment variables:
   ```
   GITHUB_TOKEN=your-personal-token
   GITHUB_WEBHOOK_SECRET=your-webhook-secret
   ```

## Architecture

```
┌──────────────┐              ┌──────────────┐
│    GitLab    │              │    GitHub    │
│              │   webhooks   │              │
│  MR events   │─────────┐   │  PR events   │
│  Note hooks  │         │   │  Comments    │
│              │         ▼   │              │
│              │    ┌────────────┐          │
│  GitLab API ◀────│            │────▶ GitHub API
│              │    │  Doc-Bot   │          │
│              │    │  Service   │          │
└──────────────┘    │            │   └──────────────┘
                    └─────┬──────┘
                          │
                          │ Claude API
                          ▼
                   ┌──────────────┐
                   │  Anthropic   │
                   │  API         │
                   └──────────────┘
```

### Key Components

- **Platform Adapters**: Abstract GitLab/GitHub differences behind a common interface
- **Event Router**: Routes webhook events to appropriate workflows
- **Git Manager**: Handles repository cloning and operations
- **Agent Orchestrator**: Manages Claude API interactions
- **Workflows**: Triage, Update, Revise, Review
- **Task Queue**: Ensures bounded concurrency

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `PORT` | No (default: 3000) | HTTP server port |
| `CONCURRENCY_LIMIT` | No (default: 3) | Max parallel agent invocations |
| `MAX_COST_PER_INVOCATION` | No (default: 2.00) | Cost ceiling per invocation (USD) |
| `SESSION_TTL_HOURS` | No (default: 24) | Session retention time |
| `LOG_LEVEL` | No (default: info) | Logging verbosity |
| `GITLAB_TOKEN` | If using GitLab | Project, Group, or Personal access token |
| `GITLAB_WEBHOOK_SECRET` | If using GitLab | Webhook secret |
| `GITLAB_URL` | No (default: https://gitlab.com) | GitLab instance URL |
| `GITHUB_APP_ID` | If using GitHub App | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | If using GitHub App | GitHub App private key |
| `GITHUB_TOKEN` | If using PAT | Personal access token |
| `GITHUB_WEBHOOK_SECRET` | If using GitHub | Webhook secret |

## Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests (when implemented)
npm test

# Lint
npm run lint

# Format
npm run format
```

### Project Structure

```
doc-bot/
├── src/
│   ├── platform/          # Platform adapters (GitLab, GitHub)
│   ├── webhook/           # Webhook server and event routing
│   ├── git/               # Git operations
│   ├── agent/             # Claude agent orchestration
│   ├── workflows/         # Business logic workflows
│   ├── queue/             # Task queue
│   ├── util/              # Utilities (logger, config loader)
│   ├── config.ts          # Environment configuration
│   └── index.ts           # Entry point
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Roadmap

- [ ] Full file editing and MR/PR creation (currently provides recommendations only)
- [ ] Multi-turn agent interactions with tool use (Read, Edit, Glob, Grep)
- [ ] Support for additional platforms (Bitbucket, Gitea)
- [ ] Metrics dashboard and cost tracking
- [ ] Automatic merge of approved doc changes
- [ ] Multi-language documentation support

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Credits

Created by Marty, February 2026.

Powered by [Anthropic Claude](https://www.anthropic.com/).
