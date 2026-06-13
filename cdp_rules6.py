import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    u = t.get('url','')
    if 'firebase' in u and 'project/hermes-idleviber' in u:
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

# Navigate to the rules page properly
cdp("Runtime.evaluate", {
    "expression": "window.location.href = 'https://console.firebase.google.com/project/hermes-idleviber/firestore/rules'",
    "returnByValue": True
})
time.sleep(8)

# Try to inject the rules via the Firebase SDK's REST API using the page's cookies
result = cdp("Runtime.evaluate", {
    "expression": """
        (async () => {
            // First, try to get the rules data from the firestore REST API
            // using credentials from the page session
            try {
                const resp = await fetch(
                    'https://firestore.googleapis.com/v1/projects/hermes-idleviber/databases/(default)/documents:runQuery',
                    {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        credentials: 'include',
                        body: JSON.stringify({
                            structuredQuery: {
                                from: [{collectionId: 'leaderboard'}],
                                limit: 1
                            }
                        })
                    }
                );
                const data = await resp.json();
                return 'API test: ' + (data.length ? 'has data' : 'empty') + ' status=' + resp.status;
            } catch(e) {
                return 'API test error: ' + e.message;
            }
        })()
    """,
    "awaitPromise": true,
    "returnByValue": true
})
api_test = result.get('result',{}).get('result',{}).get('value','')
print("API test:", api_test)

# Check if we can access the rules API
result = cdp("Runtime.evaluate", {
    "expression": """
        (async () => {
            try {
                const resp = await fetch(
                    'https://firebaserules.googleapis.com/v1/projects/hermes-idleviber/rulesets',
                    {credentials: 'include', headers: {'Content-Type': 'application/json'}}
                );
                const data = await resp.json();
                return 'Rules API: ' + JSON.stringify(data).substring(0, 300);
            } catch(e) {
                return 'Rules API error: ' + e.message;
            }
        })()
    """,
    "awaitPromise": true,
    "returnByValue": true
})
rules_test = result.get('result',{}).get('result',{}).get('value','')
print("Rules test:", rules_test)

ws.close()
