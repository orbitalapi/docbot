# Contributing to Doc-Bot

Thank you for your interest in contributing to Doc-Bot! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** and clone your fork
2. **Install dependencies**: `npm install`
3. **Run tests**: `npm test`
4. **Build the project**: `npm run build`

## Development Workflow

### Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/docbot.git
cd docbot

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Making Changes

1. **Create a new branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style:
   - Use TypeScript
   - Follow the existing code structure
   - Add tests for new functionality
   - Update documentation as needed

3. **Run tests and linting**:
   ```bash
   npm test
   npm run lint
   npm run format
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   Use conventional commit format:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `test:` - Test updates
   - `refactor:` - Code refactoring
   - `chore:` - Build/config changes

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** from your fork to the main repository

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Add unit tests for new functions in `tests/unit/`
- Add integration tests for workflows in `tests/integration/`
- Use the mock implementations in `tests/mocks/`
- Aim for >80% code coverage

Example test:
```typescript
describe('MyFeature', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

## Code Style

- **TypeScript**: Use strict TypeScript with proper types
- **Formatting**: Run `npm run format` before committing
- **Linting**: Run `npm run lint` to check for issues
- **Comments**: Add JSDoc comments for public APIs
- **Naming**: Use descriptive variable and function names

## Pull Request Guidelines

### Before Submitting

- [ ] Tests pass (`npm test`)
- [ ] Linter passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if applicable)
- [ ] Changelog entry added (if significant change)

### PR Description

Include:
- **Summary** of changes
- **Motivation** for the change
- **Testing** performed
- **Breaking changes** (if any)
- **Related issues** (link with #issue_number)

### Review Process

1. CI checks must pass
2. At least one maintainer review required
3. Address review feedback
4. Squash commits if requested
5. Merge after approval

## Project Structure

```
doc-bot/
├── src/
│   ├── platform/       # Platform adapters (GitLab, GitHub)
│   ├── webhook/        # Webhook server and routing
│   ├── agent/          # Claude agent orchestration
│   ├── workflows/      # Business logic workflows
│   ├── git/            # Git operations
│   ├── queue/          # Task queue
│   └── util/           # Utilities
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── mocks/          # Mock implementations
└── docs/               # Documentation
```

## Common Tasks

### Adding a New Platform

1. Create adapter in `src/platform/yourplatform/`
2. Implement the `Platform` interface
3. Add webhook parsing and validation
4. Add tests in `tests/unit/`
5. Update documentation

### Adding a New Workflow

1. Create workflow file in `src/workflows/`
2. Implement workflow function
3. Add to router in `src/webhook/router.ts`
4. Add tests in `tests/integration/`
5. Update slash command documentation

### Adding a New Slash Command

1. Add command type to `SlashCommand` in `router.ts`
2. Implement handler in `EventRouter`
3. Add to help text
4. Add tests
5. Update README

## Documentation

- **README.md**: User-facing documentation
- **Code comments**: Technical documentation
- **Examples**: Add examples for new features
- **API docs**: Document public APIs

## Release Process

Releases are automated via GitHub Actions:

1. Version bump: Update `package.json`
2. Create tag: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. GitHub Actions will:
   - Run tests
   - Build Docker image
   - Publish to Docker Hub
   - Create GitHub release

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues and PRs first

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
