# start-claude-auto.ps1 — launch Claude Code on the BitRunners mega-batch.
# Usage:  pwsh -File .\start-claude-auto.ps1
#
# Refuses to start on a dirty tree (autonomous mode + uncommitted local work
# is a bad time). Cuts a fresh dated branch, runs a frozen install, then
# hands off to Claude Code in bypass-permissions mode with the contents of
# launch-prompt.md as the initial message.

# Native-command stderr quirks on PowerShell 7.4+:
#   * `$ErrorActionPreference = "Stop"` will throw on ANY stderr write from a
#     native command (git prints lots of informational text there).
#   * `$PSNativeCommandUseErrorActionPreference = $false` is SUPPOSED to
#     suppress that, but precedence with Stop is unreliable across builds.
#
# Safest pattern: leave $ErrorActionPreference at the default ("Continue"),
# and check `$LASTEXITCODE` explicitly after every git call. That makes
# control flow predictable on every PS version we'll plausibly see.
$PSNativeCommandUseErrorActionPreference = $false

function Assert-Git {
    param([string]$Action)
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ $Action failed (exit $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
}

# ── 1. Set repo path ────────────────────────────────────────────────────────
Set-Location "C:\dev\BitRunners"   # ← EDIT THIS to your local clone
if (-not $?) {
    Write-Host "❌ Repo path doesn't exist — edit line 31 of this script." -ForegroundColor Red
    exit 1
}

# ── 2. Refuse to run from a dirty tree ──────────────────────────────────────
# Exclude the two launcher files themselves — the user is expected to edit
# the repo path in this script and may iterate on the prompt locally; those
# edits shouldn't block the launcher from running.
$dirty = git status --porcelain 2>&1 |
    Where-Object { $_ -notmatch '\s(start-claude-auto\.ps1|launch-prompt\.md)$' }
if ($dirty) {
    Write-Host "❌ Working tree dirty (outside the launcher files):" -ForegroundColor Red
    Write-Host $dirty
    Write-Host "Commit or stash, then re-run."
    exit 1
}

# ── 3. Sync with origin/main and cut a fresh dated working branch ───────────
git fetch origin main 2>&1 | Out-Null
Assert-Git "git fetch origin main"

git checkout main 2>&1 | Out-Null
Assert-Git "git checkout main"

git pull --ff-only origin main 2>&1 | Out-Null
Assert-Git "git pull --ff-only origin main"

$branch = "claude/mega-batch-$(Get-Date -Format yyyy-MM-dd)"
# Try to create the branch. If it already exists from an earlier run today,
# `git checkout -b` exits non-zero — that's fine, just switch to it.
git checkout -b $branch 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ℹ Branch $branch already exists — switching to it." -ForegroundColor Yellow
    git checkout $branch 2>&1 | Out-Null
    Assert-Git "git checkout $branch"
}
Write-Host "✅ On branch $branch" -ForegroundColor Green

# ── 4. Sanity-check toolchain ───────────────────────────────────────────────
# Project is tested on Node 22 (CI pin) but the build is fine on any modern
# major. Accept v22+ so a host with v24/v26 installed isn't blocked. Below
# v22 (v20/v18) is too old — esbuild + Vite features the repo uses won't
# work there.
$node = (node --version)
$pnpm = (pnpm --version)
Write-Host "Node: $node  (need v22 or newer)"
Write-Host "pnpm: $pnpm  (need 10.33.0)"
$nodeMajor = [int]($node -replace '^v(\d+)\..*$', '$1')
if ($nodeMajor -lt 22) {
    Write-Host "❌ Node $node is too old — need v22 or newer." -ForegroundColor Red
    exit 1
}
if ($pnpm -ne "10.33.0") {
    Write-Host "❌ Wrong pnpm version" -ForegroundColor Red
    exit 1
}

# ── 5. Green install before handing the wheel over ──────────────────────────
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ pnpm install failed" -ForegroundColor Red
    exit 1
}

# ── 6. Verify the launch prompt is present ──────────────────────────────────
if (-not (Test-Path .\launch-prompt.md)) {
    Write-Host "❌ launch-prompt.md missing — both files must live next to each other." -ForegroundColor Red
    exit 1
}

# ── 7. Hand off to Claude Code in fully-autonomous mode ─────────────────────
#
# --permission-mode bypassPermissions  — autonomous (skip every prompt).
#                                        Aliased as --dangerously-skip-permissions
#                                        on older builds; swap if your CLI rejects.
#
# The path in .claude/settings.json still blocks pushes to main, deletes of
# protected files, etc., so "bypass" here means "don't ask me to confirm
# every edit", NOT "ignore the safety rails".
#
# MAX_THINKING_TOKENS maxes the extended-thinking budget for the session —
# pairs with the `ultrathink` keyword in launch-prompt.md (max effort).
$env:MAX_THINKING_TOKENS = "31999"
Write-Host ""
Write-Host "🚀 Launching Claude Code in autonomous mode (max effort)…" -ForegroundColor Cyan
# Claude Code takes the initial prompt as a positional arg, not a flag.
# (`--print` exists but is for non-interactive one-shot; we want an
# interactive session that opens with the prompt as the first message.)
$prompt = Get-Content .\launch-prompt.md -Raw
claude --permission-mode bypassPermissions $prompt
