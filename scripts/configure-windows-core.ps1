[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$NodePath,
    [Parameter(Mandatory)][string]$CredentialFile,
    [Parameter(Mandatory)][string]$DataDirectory,
    [ValidateRange(1,65535)][int]$Port = 4340
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
foreach ($path in @($NodePath,$CredentialFile,$DataDirectory)) {
    if (-not [IO.Path]::IsPathFullyQualified($path)) { throw 'Absolute paths required' }
}
if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf) -or -not (Test-Path -LiteralPath $CredentialFile -PathType Leaf)) { throw 'Node/credential file missing' }
$nodeVersion = & $NodePath --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.') { throw 'Native Node 24 required' }
$runtime = Join-Path $PSScriptRoot 'runtime'
if (-not (Test-Path -LiteralPath (Join-Path $runtime 'transport/main.ts'))) { throw 'Core runtime missing' }
$definition = Join-Path $PSScriptRoot 'core-service.json'
if (Test-Path -LiteralPath $definition) { throw 'Existing definition: review it instead of overwriting' }
$arguments = @("--env-file=$CredentialFile",'--experimental-strip-types',(Join-Path $runtime 'transport/main.ts'))
# 계정/ACL/SCM을 변경하지 않는다. 비밀은 별도 보호 파일에 남고 JSON에는 경로만 넣는다.
@{
    serviceName='TASTESTUDIO-Core';executable=$NodePath;workingDirectory=$runtime
    startArguments=$arguments+@('start');stopArguments=$arguments+@('stop')
    environment=@{CORE_HOST='127.0.0.1';CORE_PORT="$Port";CORE_DATA_DIR=$DataDirectory;CORE_LOG_DIR=(Join-Path $DataDirectory 'logs')}
    readinessUrl="http://127.0.0.1:$Port/health/ready";startupTimeoutSeconds=30;stopTimeoutSeconds=30
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $definition -Encoding utf8
Write-Output "Definition created: $definition; service not installed"
