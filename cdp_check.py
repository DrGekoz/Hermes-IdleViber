import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    if 'hermes-idleviber.netlify.app' in t.get('url',''):
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

# Check Firebase state
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Check key Firebase variables in module scope
            // We need to check the app.js module's fbReady
            // Since modules have their own scope, check the DOM for clues
            var leaderboardList = document.getElementById('leaderboard-list');
            var entries = leaderboardList ? leaderboardList.querySelectorAll('.lb-entry') : [];
            var text = leaderboardList ? leaderboardList.innerText : '';
            return JSON.stringify({
                leaderboardText: text.substring(0, 300),
                entryCount: entries.length
            });
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
data = json.loads(res)
print("Leaderboard state:")
print(json.dumps(data, indent=2))

# Check if Firebase is connected by looking at the page body
result = cdp("Runtime.evaluate", {
    "expression": "document.body.innerText.substring(0, 50)",
    "returnByValue": True
})
page_state = result.get('result',{}).get('result',{}).get('value','')
print("Page state:", page_state)

ws.close()
