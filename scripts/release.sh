#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: npm run release -- <version|patch|minor|major>"
  exit 1
fi

if ! git diff --quiet; then
  echo "Working tree is dirty. Commit or stash changes first."
  exit 1
fi

echo "Releasing version: $VERSION"

# Creates commit + tag (vX.Y.Z)
npm version "$VERSION" -m "chore: bump version to %s"

git push
git push --tags

echo "Release complete."
