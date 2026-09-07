param(
    [string]$ChatId,
    [int]$Seconds = 180
)

$uri = "wss://web-production-7fc87.up.railway.app/ws/status/$ChatId"
Write-Host "Connecting to $uri"

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$cts = New-Object System.Threading.CancellationTokenSource
$connectTask = $ws.ConnectAsync([Uri]$uri, $cts.Token)
$connectTask.Wait()
Write-Host "Connected. State: $($ws.State)"

$deadline = (Get-Date).AddSeconds($Seconds)
$buffer = New-Object byte[] 8192

while ((Get-Date) -lt $deadline -and $ws.State -eq 'Open') {
    try {
        $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
        $recvTask = $ws.ReceiveAsync($seg, $cts.Token)
        if (-not $recvTask.Wait(15000)) {
            continue
        }
        $result = $recvTask.Result
        if ($result.MessageType -eq 'Close') {
            Write-Host "Server closed connection: $($ws.CloseStatusDescription)"
            break
        }
        $msg = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
        $ts = (Get-Date).ToString("HH:mm:ss")
        Write-Host "[$ts] $msg"
    } catch {
        Write-Host "Recv error: $($_.Exception.Message)"
        break
    }
}

Write-Host "Done listening. Final state: $($ws.State)"
try { $ws.Dispose() } catch {}
