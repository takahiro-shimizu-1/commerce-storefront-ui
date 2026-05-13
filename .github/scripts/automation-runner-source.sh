#!/usr/bin/env bash
set -euo pipefail

repo_url="https://github.com/takahiro-shimizu-1/automation-hub.git"
runner_ref="${AUTOMATION_RUNNER_SOURCE_REF:-main}"
runner_base="${RUNNER_TEMP:-$PWD/.miyabi}"
runner_dir="$runner_base/automation-hub-runner"

if [ ! -d "$runner_dir/.git" ]; then
  rm -rf "$runner_dir"
  git init "$runner_dir" >&2
  git -C "$runner_dir" remote add origin "$repo_url" >&2
fi

git -C "$runner_dir" fetch --depth 1 origin "$runner_ref" >&2
git -C "$runner_dir" checkout --detach FETCH_HEAD >&2

if [ ! -x "$runner_dir/node_modules/.bin/tsx" ]; then
  npm ci --prefix "$runner_dir" --no-audit --no-fund >&2
fi

node "$runner_dir/bin/automation-runner.mjs" "$@"
