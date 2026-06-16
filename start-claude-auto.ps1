# start-claude-auto.ps1 — launch Claude Code on the BitRunners mega-batch.
# Usage:  pwsh -File .\start-claude-auto.ps1
#
# Refuses to start on a dirty tree (autonomous mode + uncommitted local work
# is a bad time). Cuts a fresh dated branch, runs a frozen install, then
# hands off to Claude Code in bypass-permissions mode with the contents of
# launch-prompt.md as the initial message.

$ErrorActionPreference = "Stop"
# PowerShell treats native-command stderr as a script-terminating error
# when $ErrorActionPreference = "Stop" on PS 7.4+ (with PSNativeCommandUseErrorActionPreference).
# Git writes a lot of informational text to stderr ("Switched to a new branch",
# etc.) that is NOT an actual error. Disable that interception so we can
# control flow via $LASTEXITCODE explicitly.
$PSNativeCommandUseErrorActionPreference = $false

# ── 1. Set repo path ────────────────────────────────────────────────────────
Set-Location "C:\dev\BitRunners"   # ← EDIT THIS to your local clone

# ── 2. Refuse to run from a dirty tree ──────────────────────────────────────
# Exclude the two launcher files themselves — the user is expected to edit
# the repo path in this script and may iterate on the prompt locally; those
# edits shouldn't block the launcher from running.
$dirty = git status --porcelain |
    Where-Object { $_ -notmatch '\s(start-claude-auto\.ps1|launch-prompt\.md)$' }
if ($dirty) {
    Write-Error "Working tree dirty (outside the launcher files) — commit or stash before launching:`n$dirty"
    exit 1
}

# ── 3. Sync with origin/main and cut a fresh dated working branch ───────────
git fetch origin main
git checkout main
git pull --ff-only origin main

$branch = "claude/mega-batch-$(Get-Date -Format yyyy-MM-dd)"
# Merge stderr → stdout and pipe to Out-Null. Git's "Switched to a new branch"
# message goes to stderr; we want the visible output suppressed but the exit
# code preserved.
git checkout -b $branch 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    # Branch already exists from an earlier run today — switch to it.
    git checkout $branch 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Could not check out branch $branch"
        exit 1
    }
}

# ── 4. Sanity-check toolchain (project requires these exact majors) ─────────
$node = (node --version)
$pnpm = (pnpm --version)
Write-Host "Node: $node  (need v22.x)"
Write-Host "pnpm: $pnpm  (need 10.33.0)"
if (-not $node.StartsWith("v22.")) { Write-Error "Wrong Node version"; exit 1 }
if ($pnpm -ne "10.33.0")           { Write-Error "Wrong pnpm version"; exit 1 }

# ── 5. Green install before handing the wheel over ──────────────────────────
pnpm install --frozen-lockfile

# ── 6. Verify the launch prompt is present ──────────────────────────────────
if (-not (Test-Path .\launch-prompt.md)) {
    Write-Error "launch-prompt.md missing — both files must live next to each other."
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
$prompt = Get-Content .\launch-prompt.md -Raw
claude --permission-mode bypassPermissions --prompt $prompt
