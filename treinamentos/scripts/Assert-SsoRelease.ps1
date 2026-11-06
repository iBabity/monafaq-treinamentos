#requires -Version 7.0
param([Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$Commit)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$head = & git -C $root rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $head -ne $Commit) { throw 'Release bloqueada: HEAD difere do commit informado.' }
$dirty = & git -C $root status --porcelain --untracked-files=all
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Release bloqueada: arquivos fora do commit. Use checkout isolado.' }
$endpoint = 'repos/Monalisa-Sistemas/treinamentos/actions/workflows/sso-regression.yml/runs?head_sha=' + $Commit + '&per_page=100'
$raw = & gh api $endpoint
if ($LASTEXITCODE -ne 0) { throw 'Release bloqueada: nao foi possivel consultar a verificacao SSO.' }
$runs = @(($raw | ConvertFrom-Json).workflow_runs | Where-Object {
    $_.head_sha -eq $Commit -and $_.event -in @('push', 'workflow_dispatch') -and $_.head_branch -eq 'main'
} | Sort-Object created_at -Descending)
if ($runs.Count -eq 0 -or $runs[0].status -ne 'completed' -or $runs[0].conclusion -ne 'success') {
    throw 'Release bloqueada: o ultimo teste SSO deste commit em main nao passou.'
}
Write-Output "PASS SSO: commit $Commit, run $($runs[0].id). Ainda exige aceite autenticado e rollback."

