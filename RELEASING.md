# Releasing Gym Tracker

This guide explains how to create a new release with automatic changelog generation.

## Prerequisites

- Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) format:
  - `feat(scope): description` → Features section
  - `fix(scope): description` → Bug Fixes section
  - `perf(scope): description` → Performance section
  - `docs(scope): description` → Documentation section
  - `refactor(scope): description` → Refactoring section
  - `test`, `chore`, `style` → Hidden from changelog

Example:
```
feat(ai): add Anthropic provider support
fix(plan): correct exercise ordering on load
docs(setup): clarify AWS region requirements
```

## Creating a Release

The project uses [standard-version](https://github.com/conventional-changelog/standard-version) for automated versioning and changelog generation.

### Patch Release (1.0.0 → 1.0.1)
```bash
npm run release
```

### Minor Release (1.0.0 → 1.1.0)
```bash
npm run release:minor
```

### Major Release (1.0.0 → 2.0.0)
```bash
npm run release:major
```

### What Happens Automatically
1. Analyzes all commits since the last tag using Conventional Commits
2. Bumps the version number (patch/minor/major) in package.json
3. Updates CHANGELOG.md with new entries
4. Creates a git commit with the version bump and changelog
5. Creates a git tag (e.g., `v1.0.1`)

### After Running Release

Push the changes to GitHub:
```bash
git push origin main --follow-tags
```

Then create a GitHub Release:
1. Go to https://github.com/nambaf/gym-tracker-oss/releases
2. Click "Draft a new release"
3. Select the tag you just created
4. Copy the changelog entries from CHANGELOG.md
5. Publish the release

## Tips

- **Enforce Conventional Commits**: Consider adding a pre-commit hook with `commitlint` to enforce commit message format before release.
- **Review before releasing**: Always review the generated changelog before pushing to ensure it's accurate.
- **Tag format**: Tags are created as `v{version}` (e.g., `v1.0.1`).
