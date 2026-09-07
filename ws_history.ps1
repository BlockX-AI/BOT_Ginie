param(
    [string]$ChatId
)

$uri = "wss://web-production-7fc87.up.railway.app/ws/status/$ChatId"
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$cts = New-Object System.Threading.CancellationTokenSource
$ws.ConnectAsync([Uri]$uri, $cts.Token).Wait()

$buffer = New-Object byte[] 65536
$seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
$recvTask = $ws.ReceiveAsync($seg, $cts.Token)
$recvTask.Wait(15000) | Out-Null
$result = $recvTask.Result
$msg = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
Write-Host $msg
try { $ws.Dispose() } catch {}
