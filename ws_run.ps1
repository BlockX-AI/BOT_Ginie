param(
    [int]$Seconds = 240
)

$base = "https://web-production-7fc87.up.railway.app"
$body = '{"prompt":"Create an on-chain counter DApp: increment, decrement, and read the current count.","model":"gpt-4o"}'
$resp = Invoke-RestMethod -Uri "$base/demo/chat" -Method Post -Body $body -ContentType "application/json"
$chatId = $resp.chat_id
Write-Host "CHAT_ID=$chatId"

$log = Join-Path $PSScriptRoot "pipeline_log.txt"
"CHAT_ID=$chatId" | Out-File -FilePath $log -Encoding utf8

$uri = "wss://web-production-7fc87.up.railway.app/ws/status/$chatId"
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$cts = New-Object System.Threading.CancellationTokenSource
$ws.ConnectAsync([Uri]$uri, $cts.Token).Wait()
Write-Host "Connected: $($ws.State)"

$deadline = (Get-Date).AddSeconds($Seconds)
$buffer = New-Object byte[] 65536

while ((Get-Date) -lt $deadline -and $ws.State -eq 'Open') {
    try {
        $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
        $recvTask = $ws.ReceiveAsync($seg, $cts.Token)
        if (-not $recvTask.Wait(20000)) { continue }
        $result = $recvTask.Result
        if ($result.MessageType -eq 'Close') { "SERVER_CLOSE: $($ws.CloseStatusDescription)" | Out-File -FilePath $log -Append -Encoding utf8; break }
        $msg = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
        $ts = (Get-Date).ToString("HH:mm:ss")
        "[$ts] $msg" | Out-File -FilePath $log -Append -Encoding utf8
    } catch {
        "RECV_ERROR: $($_.Exception.Message)" | Out-File -FilePath $log -Append -Encoding utf8
        break
    }
}
"DONE state=$($ws.State)" | Out-File -FilePath $log -Append -Encoding utf8
try { $ws.Dispose() } catch {}
