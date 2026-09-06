"""Test only the WebBuilder frontend generation — skips EVI contract generation."""
import requests
import websocket
import json
import time
import sys
import threading

WEBBUILDER_URL = "http://localhost:8000"

def get_auth_token():
    test_email = f"bot_test_{int(time.time())}@botchain.ai"
    resp = requests.post(
        f"{WEBBUILDER_URL}/auth/register",
        json={"name": "BOT Chain User", "email": test_email, "password": "botchain123"},
        timeout=10
    )
    if resp.status_code == 400:
        resp = requests.post(
            f"{WEBBUILDER_URL}/auth/login",
            json={"email": test_email, "password": "botchain123"},
            timeout=10
        )
    data = resp.json()
    token = data.get("access_token") or data.get("token")
    print(f"✅ Authenticated. Token: {token[:30]}...")
    return token


def create_frontend_dapp(token, prompt, network="botchain"):
    """Create DApp via WebBuilder orchestrator (frontend only, using existing contract)."""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "prompt": prompt,
        "network": network,
        "contract_only": False,
    }
    resp = requests.post(
        f"{WEBBUILDER_URL}/dapp/create",
        json=payload,
        headers=headers,
        timeout=30
    )
    if resp.status_code != 200:
        print(f"❌ Failed: {resp.status_code} - {resp.text}")
        return None
    data = resp.json()
    chat_id = data.get("chat_id") or data.get("id")
    print(f"✅ DApp creation started! Chat ID: {chat_id}")
    return chat_id


def monitor_dapp(token, chat_id):
    ws_url = f"ws://localhost:8000/ws/{chat_id}?token={token}"
    events = []
    files_created = []
    last_activity = time.time()

    def on_message(ws, message):
        nonlocal last_activity, files_created
        try:
            data = json.loads(message)
            event = data.get("e", "unknown")
            msg = data.get("message", "")
            print(f"📡 {event} | {msg}")
            events.append(data)
            if event in ("file_created", "file_updated"):
                last_activity = time.time()
                fname = data.get("filename", "")
                if fname:
                    files_created.append(fname)
            elif event in ("tool_started", "tool_completed", "command_started", "command_executed"):
                last_activity = time.time()
            # Print contract milestones but DON'T close — pipeline continues to frontend
            if event in ("contract_deployed", "contract_verified", "contract_verify_failed"):
                print(f"   📋 milestone: {event} — {msg}")
                last_activity = time.time()
            # True terminal events for the full pipeline (after frontend build)
            if event in ("error", "dapp_complete", "build_complete", "build_failed", "completed", "server_started", "deployment_skipped", "app_url"):
                print(f"🎉 Terminal event: {event}")
                ws.close()
        except:
            print(f"📡 Raw: {message[:200]}")

    def on_error(ws, error):
        print(f"❌ WS error: {error}")

    def on_close(ws, code, msg):
        print(f"🔌 WS closed: {code} {msg}")

    def on_open(ws):
        print(f"✅ WebSocket connected")

    ws = websocket.WebSocketApp(ws_url, on_open=on_open, on_message=on_message, on_error=on_error, on_close=on_close)
    
    def run_ws():
        ws.run_forever()
    
    ws_thread = threading.Thread(target=run_ws, daemon=True)
    ws_thread.start()
    
    timeout = 900  # 15 min
    idle_timeout = 360  # 6 min idle
    start = time.time()
    while time.time() - start < timeout:
        time.sleep(2)
        if not ws_thread.is_alive():
            break
        if files_created and (time.time() - last_activity) > idle_timeout:
            print(f"ℹ️  No activity for {idle_timeout}s after {len(files_created)} files")
            try:
                ws.close()
            except:
                pass
            break
    
    if ws_thread.is_alive():
        print("⏰ Timeout reached")
        try:
            ws.close()
        except:
            pass
    
    return events, files_created


def main():
    prompt = (
        "Create an ERC20 token contract called BotToken with symbol BOT. "
        "Initial supply of 1,000,000 tokens minted to the deployer. "
        "Include standard ERC20 functions: transfer, approve, transferFrom, balanceOf, allowance, totalSupply. "
        "Add a public mint function that allows anyone to mint up to 100 tokens per call (with a require check). "
        "Emit Transfer and Approval events. Make it gas-efficient and follow OpenZeppelin standards."
    )
    network = "botchain"
    
    print("=" * 60)
    print(f"🧪 Testing DApp on BOT Chain MAINNET (chain ID 677)")
    print("=" * 60)
    
    token = get_auth_token()
    if not token:
        sys.exit(1)
    
    chat_id = create_frontend_dapp(token, prompt, network)
    if not chat_id:
        sys.exit(1)
    
    events, files_created = monitor_dapp(token, chat_id)
    
    print("\n" + "=" * 60)
    print("📊 Results")
    print("=" * 60)
    print(f"Files created: {len(files_created)}")
    for f in files_created:
        print(f"  - {f}")

    # Extract key artifacts for the final announcement
    import re
    contract_address = None
    explorer_url = None
    frontend_url = None
    verified = False
    for e in events:
        ev = e.get("e", "")
        msg = e.get("message", "") or ""
        url = e.get("url", "")
        if ev == "contract_deployed":
            m = re.search(r"0x[a-fA-F0-9]{40}", msg)
            if m:
                contract_address = m.group(0)
        if ev == "contract_verified":
            verified = True
            m = re.search(r"https?://\S+", msg)
            if m:
                explorer_url = m.group(0).rstrip("#code").rstrip("/")
        if ev in ("app_url", "server_started", "dapp_complete", "completed") and url:
            frontend_url = url
        # Some events carry url in message
        if not frontend_url and ("vercel.app" in msg or "http" in msg) and ev in ("app_url", "server_started"):
            m = re.search(r"https?://\S+", msg)
            if m:
                frontend_url = m.group(0)

    if not explorer_url and contract_address:
        explorer_url = f"https://scan.botchain.ai/address/{contract_address}"

    print("\n" + "=" * 60)
    print("🔑 KEY ARTIFACTS")
    print("=" * 60)
    print(f"Contract address : {contract_address}")
    print(f"Verified         : {verified}")
    print(f"Explorer URL     : {explorer_url}")
    print(f"Frontend URL     : {frontend_url}")

    if files_created:
        print(f"\n✅ Frontend generated with {len(files_created)} files")
    elif not contract_address:
        print("\n⚠️ No files created and no contract deployed")


if __name__ == "__main__":
    main()
