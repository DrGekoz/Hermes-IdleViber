import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    u = t.get('url','')
    if 'hermes-idleviber.netlify.app' in u:
        ws_url = t['webSocketDebuggerUrl']
        break
else:
    print("Tab not found")
    exit(1)

ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Click guest button
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const btn = document.getElementById('guest-btn');
            if (btn) { btn.click(); return 'clicked'; }
            return 'not found';
        })()
    """,
    "returnByValue": True
})
print("Guest click:", result.get('result',{}).get('result',{}).get('value',''))

time.sleep(5)

# Check game state
result = cdp("Runtime.evaluate", {
    "expression": "document.body.innerText.substring(0, 500)",
    "returnByValue": True
})
text = result.get('result',{}).get('result',{}).get('value','')
if 'Player' in text or 'VIBE' in text or 'UPGRADES' in text:
    print("SUCCESS: Game loaded!")
    print(text[:300])
else:
    print("Game state:", text[:300])

ws.close()
