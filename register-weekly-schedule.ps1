$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FetcherPath = Join-Path $ScriptDir 'fetch-weekly-sports.js'
$TaskName = 'NellyMcsWeeklySportsFetch'

$NodeCmd = (Get-Command node -ErrorAction Stop).Source
$ActionArg = "`"$FetcherPath`" --bump"

Write-Host "Registering Windows Scheduled Task '$TaskName' for every Monday at 06:00..."

$Action = New-ScheduledTaskAction -Execute $NodeCmd -Argument $ActionArg -WorkingDirectory $ScriptDir
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 06:00
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "Fetches weekly Nelly Mc's sports fixtures and bumps the HTML poster version every Monday at 06:00." `
  -Force | Out-Null

$Task = Get-ScheduledTask -TaskName $TaskName
$Info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "Registered '$($Task.TaskName)' | State: $($Task.State) | NextRunTime: $($Info.NextRunTime)"
