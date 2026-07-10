# setup-perf-pass.ps1 -- one-shot environment bootstrap + Claude Code launch
# for the BitRunners performance pass.
#
# RUN AS ADMINISTRATOR. Usage:
#   pwsh -ExecutionPolicy Bypass -File .\setup-perf-pass.ps1
# (or right-click -> Run with PowerShell from an elevated window)
#
# What it does, in order:
#   1. Verifies elevation.
#   2. Updates PowerShell 7, Git, and Node LTS via winget (installs if absent).
#   3. Re-execs itself under pwsh 7 if launched from Windows PowerShell 5.1.
#   4. Activates the repo-pinned pnpm via corepack.
#   5. Installs/updates the Claude Code CLI to latest.
#   6. Syncs C:\dev\BitRunners to origin/main and runs a frozen install.
#   7. Launches Claude Code on model claude-fable-5, bypass permissions,
#      max thinking budget, seeded with perf-pass-prompt.md (whose first
#      word, "ultracode", opts the session into multi-agent orchestration).
#
# ASCII-only on purpose: PS 5.1 misparses UTF-8 without a BOM (see PR #101).

$RepoPath = "C:\dev\BitRunners"   # <- edit if your clone lives elsewhere
$PromptFile = "perf-pass-prompt.md"

function Fail([string]$msg) {
  Write-Host ""
  Write-Host "XX $msg" -ForegroundColor Red
  exit 1
}
function Step([string]$msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Ok([string]$msg) { Write-Host "OK $msg" -ForegroundColor Green }

# -- 1. elevation ------------------------------------------------------------
$principal = New-Object Security.Principal.WindowsPrincipal(
  [Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Fail "Not elevated. Right-click PowerShell -> Run as administrator, then re-run."
}
Ok "running elevated"

# -- 2. winget upgrades ------------------------------------------------------
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Fail "winget not found. Install 'App Installer' from the Microsoft Store, then re-run."
}
# id => friendly name. Installs when missing, upgrades when present.
$pkgs = [ordered]@{
  "Microsoft.PowerShell" = "PowerShell 7"
  "Git.Git"              = "Git"
  "OpenJS.NodeJS.LTS"    = "Node.js LTS"
}
foreach ($id in $pkgs.Keys) {
  Step "winget: ensuring $($pkgs[$id]) is installed + current"
  winget install --id $id --exact --silent --accept-source-agreements --accept-package-agreements 2>&1 | Out-Null
  winget upgrade --id $id --exact --silent --accept-source-agreements --accept-package-agreements 2>&1 | Out-Null
  Ok "$($pkgs[$id]) done (exit $LASTEXITCODE ignored: 'no upgrade available' is fine)"
}
# Refresh PATH so tools installed a moment ago resolve in THIS session.
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [Environment]::GetEnvironmentVariable("Path", "User")

# -- 3. hop to pwsh 7 if we are on Windows PowerShell 5.1 --------------------
if ($PSVersionTable.PSVersion.Major -lt 7) {
  $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
  if ($null -eq $pwsh) { Fail "pwsh 7 not on PATH after install. Open a NEW admin window and re-run." }
  Step "re-launching under PowerShell 7..."
  & $pwsh.Source -ExecutionPolicy Bypass -File $PSCommandPath
  exit $LASTEXITCODE
}
Ok "PowerShell $($PSVersionTable.PSVersion)"

# -- 4. node + pnpm ----------------------------------------------------------
$node = node --version 2>$null
if (-not $node) { Fail "node not on PATH. Open a NEW admin window and re-run (PATH refresh)." }
$major = [int]($node -replace '^v(\d+)\..*$', '$1')
if ($major -lt 22) { Fail "Node $node too old; need v22+. winget upgrade may need a new shell." }
Ok "node $node"
corepack enable 2>&1 | Out-Null
Set-Location $RepoPath
if (-not (Test-Path .git)) { Fail "Repo path '$RepoPath' is not a git clone. Edit line 22." }
corepack prepare --activate 2>&1 | Out-Null   # activates the packageManager pin
Ok "pnpm $(pnpm --version)"

# -- 5. claude code ----------------------------------------------------------
if (Get-Command claude -ErrorAction SilentlyContinue) {
  Step "updating Claude Code"
  claude update 2>&1 | Out-Null
} else {
  Step "installing Claude Code CLI"
  npm install -g @anthropic-ai/claude-code 2>&1 | Out-Null
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Fail "claude CLI still not on PATH after install. Open a new admin window and re-run."
  }
}
Ok "claude $(claude --version 2>$null)"

# -- 6. repo sync + frozen install -------------------------------------------
$dirty = git status --porcelain 2>&1 |
  Where-Object { $_ -notmatch '\s(setup-perf-pass\.ps1|perf-pass-prompt\.md)$' }
if ($dirty) {
  Write-Host $dirty
  Fail "Working tree dirty (outside this kit). Commit or stash, then re-run."
}
git fetch origin main 2>&1 | Out-Null
git checkout main 2>&1 | Out-Null
git pull --ff-only origin main 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "git pull failed (exit $LASTEXITCODE)" }
Ok "repo at origin/main $(git rev-parse --short HEAD)"

$branch = "claude/perf-pass-$(Get-Date -Format yyyy-MM-dd)"
git checkout -b $branch 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "-- branch $branch exists, switching to it" -ForegroundColor Yellow
  git checkout $branch 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "could not check out $branch" }
}
Ok "on branch $branch"

pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed" }
Ok "dependencies installed"

# Baseline build so the perf session starts from a known-green state and has
# dist/ output to measure chunk sizes against.
pnpm build
if ($LASTEXITCODE -ne 0) { Fail "baseline build failed -- fix before the perf pass" }
Ok "baseline build green"

# -- 7. launch ----------------------------------------------------------------
if (-not (Test-Path ".\$PromptFile")) { Fail "$PromptFile missing next to this script." }
$env:MAX_THINKING_TOKENS = "31999"   # max extended-thinking budget
Write-Host ""
Write-Host ">> launching Claude Code -- model claude-fable-5, ultracode, bypass permissions" -ForegroundColor Cyan
$prompt = Get-Content ".\$PromptFile" -Raw
claude --model claude-fable-5 --permission-mode bypassPermissions $prompt
