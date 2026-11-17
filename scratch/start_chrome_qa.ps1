$profileDir = "C:\Users\nilay\AppData\Local\Temp\chrome_dev_qa"
if (Test-Path $profileDir) {
    Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $profileDir -Force | Out-Null

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$args = @(
    "--remote-debugging-port=9222",
    "--remote-allow-origins=*",
    "--user-data-dir=$profileDir",
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "http://localhost:3000"
)

$proc = Start-Process -FilePath $chromePath -ArgumentList $args -PassThru
Write-Host "Started Chrome with PID $($proc.Id)"

Start-Sleep -Seconds 2

try {
    $versionJson = Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/version"
    Write-Host "Connected to Chrome: $($versionJson.'Browser')"
    $wsPath = $versionJson.webSocketDebuggerUrl
    Write-Host "WebSocket URL: $wsPath"
    
    # DevToolsActivePort format:
    # Line 1: Port
    # Line 2: Browser target path (e.g. /devtools/browser/<guid>)
    $targetPath = $wsPath.Substring($wsPath.IndexOf("/devtools/browser/"))
    $activePortContent = "9222`n$targetPath"
    Set-Content -Path "C:\Users\nilay\AppData\Local\Google\Chrome\User Data\DevToolsActivePort" -Value $activePortContent -Force
    Write-Host "DevToolsActivePort successfully written!"
} catch {
    Write-Error "Failed to query Chrome on 9222: $_"
}

