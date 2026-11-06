#requires -Version 7.0
$ErrorActionPreference = 'Stop'
$sha = 'a' * 40
$global:SsoGateTestScenario = ''
function git {
    $global:LASTEXITCODE = 0
    if ($args -contains 'rev-parse') {
        if ($global:SsoGateTestScenario -eq 'wrong-commit') { return ('b' * 40) }
        return $sha
    }
    if ($global:SsoGateTestScenario -eq 'dirty') { return ' M lib/main.dart' }
}
function gh {
    $global:LASTEXITCODE = 0
    if ($global:SsoGateTestScenario -eq 'api-error') { $global:LASTEXITCODE = 1; return '{}' }
    if ($global:SsoGateTestScenario -eq 'missing') { return '{"workflow_runs":[]}' }
    $run = @{ head_sha = $sha; event = 'push'; head_branch = 'main'; created_at = '2026-09-09'; status = 'completed'; conclusion = 'success'; id = 1 }
    switch ($global:SsoGateTestScenario) {
        'failed' { $run.conclusion = 'failure' }
        'cancelled' { $run.conclusion = 'cancelled' }
        'pending' { $run.status = 'in_progress'; $run.conclusion = $null }
        'wrong-sha' { $run.head_sha = 'b' * 40 }
        'wrong-branch' { $run.head_branch = 'other' }
        'pull-request' { $run.event = 'pull_request' }
    }
    return @{ workflow_runs = @($run) } | ConvertTo-Json -Depth 4
}
foreach ($case in @('wrong-commit', 'dirty', 'api-error', 'missing', 'failed', 'cancelled', 'pending', 'wrong-sha', 'wrong-branch', 'pull-request', 'success')) {
    $global:SsoGateTestScenario = $case
    $blocked = $false
    try { & "$PSScriptRoot/Assert-SsoRelease.ps1" -Commit $sha | Out-Null }
    catch { $blocked = $true }
    if ($blocked -eq ($case -eq 'success')) { throw "Gate behaved incorrectly: $case" }
    Write-Output "PASS gate: $case"
}
