# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Workflows

### ci.yml - Main CI/CD Pipeline

**Triggers:**
- Push to `main` or `master` branch
- New tags matching `v*.*.*`
- Pull requests to `main` or `master`

**Jobs:**

1. **test** - Run tests
   - Checkout code
   - Install dependencies
   - Run linter
   - Run tests with coverage
   - Upload coverage to Codecov

2. **build** - Build the project
   - Build TypeScript
   - Upload build artifacts

3. **docker** - Build and push Docker image
   - Only runs on main branch or tags
   - Builds multi-platform images (linux/amd64, linux/arm64)
   - Tags:
     - `next` - Latest main/master branch build
     - `latest` - Latest tagged release
     - `<version>` - Specific version (e.g., `1.0.0`)
     - `<major>.<minor>` - Major.minor version (e.g., `1.0`)
     - `<major>` - Major version (e.g., `1`)
     - `<branch>-<sha>` - Branch and commit SHA

### pr-checks.yml - Pull Request Validation

**Triggers:**
- Pull request events (opened, synchronize, reopened)

**Jobs:**

1. **validate** - Validate PR code
   - Check code formatting
   - Run linter
   - Run tests
   - Build TypeScript
   - Check for TypeScript errors

2. **size-check** - Check bundle size
   - Build and report distribution size

### release.yml - GitHub Release Creation

**Triggers:**
- New tags matching `v*.*.*`

**Jobs:**

1. **release** - Create GitHub release
   - Run tests
   - Generate changelog from commits
   - Create GitHub release with changelog
   - Include Docker Hub links

## Required Secrets

To enable Docker publishing, add these secrets to your GitHub repository:

1. `DOCKER_USERNAME` - Your Docker Hub username
2. `DOCKER_PASSWORD` - Your Docker Hub access token or password

**Setting secrets:**
1. Go to repository Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret

## Docker Hub Setup

### Option 1: Docker Hub Account

1. Create a Docker Hub account at https://hub.docker.com
2. Create a repository named `docbot`
3. Generate an access token:
   - Go to Account Settings → Security
   - Click "New Access Token"
   - Copy the token (this is your `DOCKER_PASSWORD`)

### Option 2: Docker Hub Organization

1. Create an organization on Docker Hub
2. Update `DOCKER_IMAGE` in `.github/workflows/ci.yml`:
   ```yaml
   env:
     DOCKER_IMAGE: your-org/docbot
   ```
3. Use organization credentials for secrets

## Dependabot

`dependabot.yml` configures automatic dependency updates:

- **npm packages** - Weekly updates
- **GitHub Actions** - Weekly updates
- **Docker base images** - Weekly updates

Dependabot will create PRs for dependency updates automatically.

## Release Process

### Creating a Release

1. **Update version** in `package.json`:
   ```bash
   npm version patch  # or minor, or major
   ```

2. **Push with tags**:
   ```bash
   git push --follow-tags
   ```

3. **Automated steps**:
   - CI runs tests
   - Docker image builds with version tag
   - GitHub release created with changelog
   - Docker Hub updated with new image

### Version Tags

Follow semantic versioning:
- `v1.0.0` - Major release (breaking changes)
- `v1.1.0` - Minor release (new features)
- `v1.0.1` - Patch release (bug fixes)

Pre-release tags:
- `v1.0.0-alpha.1` - Alpha release
- `v1.0.0-beta.1` - Beta release
- `v1.0.0-rc.1` - Release candidate

## Local Testing

Test workflows locally with [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run PR checks
act pull_request

# Run CI workflow
act push

# Run specific job
act -j test
```

## Troubleshooting

### Docker push fails

- Check `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets
- Verify Docker Hub repository exists
- Check repository permissions

### Tests fail in CI but pass locally

- Ensure all dependencies are in `package.json`
- Check Node.js version matches (20.x)
- Review environment variables in workflow

### Coverage upload fails

- Codecov failures are non-blocking (`continue-on-error: true`)
- Check Codecov token if needed (currently optional)

## Monitoring

- **Actions tab** - View workflow runs
- **Insights → Dependency graph** - View dependencies
- **Security → Dependabot** - View dependency updates
- **Docker Hub** - View image downloads and tags
