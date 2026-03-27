#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

run_check() {
  local label="$1"
  shift
  local output
  if output=$("$@" 2>&1); then
    printf '%s: OK\n' "$label"
  else
    printf '%s: FAILED\n%s\n' "$label" "$output"
  fi
}

CONTEXT=$(
  run_check "Formatting" npm run format
  run_check "Type checking" npm run typecheck
  run_check "Tests" npm test -- run
)

printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":%s}}' "$(printf '%s' "$CONTEXT" | jq -Rs .)"
