# Pre-Push Git Hook

This repository includes a comprehensive pre-push git hook that ensures code quality and security before allowing pushes to remote branches.

## Features

The pre-push hook performs the following checks:

1. **Branch Protection**: Prevents direct pushes to the default branch (main/master)
2. **Build Checks**: Runs project build commands to ensure code compiles
3. **Lint Checks**: Runs linting tools to enforce code style and catch potential issues
4. **Test Checks**: Runs test suites to ensure functionality works as expected
5. **Secret Scanning**: Uses trufflehog to scan for potential secrets in code changes

## Supported Project Types

The hook automatically detects and supports:

- **Node.js/JavaScript**: Uses `npm`, `yarn`, or `pnpm` for dependency management
  - Runs `npm run lint`, `npm run build`, `npm run test`
- **Rust**: Uses `cargo` for building and testing
  - Runs `cargo clippy`, `cargo build`, `cargo test`
- **Go**: Uses standard Go toolchain
  - Runs `go vet`, `go build`, `go test`
- **Python**: Supports various Python project structures
  - Runs `flake8`, `black --check`, `pylint`, `pytest`
- **Makefile Projects**: Uses make targets
  - Runs `make lint`, `make build` or `make all`

## Configuration

You can customize the hook behavior by editing the `.pre-push-config` file:

```bash
# Enable/disable specific checks
ENABLE_BUILD_CHECKS=true
ENABLE_LINT_CHECKS=true
ENABLE_TEST_CHECKS=true
ENABLE_SECRET_SCANNING=true

# Skip checks for specific branches
SKIP_BRANCHES="hotfix/*,emergency/*"

# Custom commands
CUSTOM_LINT_COMMAND="your-custom-lint-command"
CUSTOM_BUILD_COMMAND="your-custom-build-command"
CUSTOM_TEST_COMMAND="your-custom-test-command"

# Timeout for checks (seconds)
CHECK_TIMEOUT=300
```

## Bypassing the Hook

In emergency situations, you can bypass the hook using:

```bash
git push --no-verify
```

**⚠️ Use this sparingly and only when absolutely necessary!**

## Secret Scanning

The hook includes trufflehog for secret scanning. You can configure ignored patterns in `.trufflehogignore`:

```
# Example patterns to ignore
test/fixtures/.*
.*\.example$
.*\.template$
```

## Installation

The hook is already installed in this repository. For new repositories, copy the `.git/hooks/pre-push` file and make it executable:

```bash
chmod +x .git/hooks/pre-push
```

## Troubleshooting

### Common Issues

1. **Dependencies not installed**: The hook will automatically install dependencies for Node.js projects
2. **Missing lint/build scripts**: The hook uses `--if-present` flag for npm scripts, so missing scripts won't fail the hook
3. **Timeout issues**: Increase `CHECK_TIMEOUT` in `.pre-push-config` for large projects

### Getting Help

If the hook fails, it will provide specific error messages. Common solutions:

- Fix linting errors: `npm run lint:fix` or similar
- Fix build errors: Check compilation errors and fix them
- Fix test failures: Run tests locally and fix failing tests
- Secret scanning issues: Review detected secrets and either remove them or add to `.trufflehogignore`

## Performance

The hook is designed to be fast and efficient:

- Only scans changed files for secrets
- Skips checks if no relevant files changed
- Uses parallel execution where possible
- Caches dependencies when available

## Contributing

To modify the hook behavior:

1. Edit `.git/hooks/pre-push`
2. Test your changes with a test push
3. Update this README if needed

The hook is designed to be project-agnostic and should work with most common development workflows.

