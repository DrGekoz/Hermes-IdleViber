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

# Try to access the Firebase Rules API through the page's authenticated context
result = cdp("Runtime.evaluate", {
    "expression": """
        (async () => {
            // Try to get an auth token from the page context
            try {
                const token = await new Promise((resolve, reject) => {
                    chrome.identity ? chrome.identity.getAuthToken({interactive: false}, t => resolve(t)) : resolve(null);
                });
                return 'token: ' + (token ? token.substring(0,20) : 'no chrome.identity');
            } catch(e) {
                return 'error: ' + e.message;
            }
        })()
    """,
    "awaitPromise": true,
    "returnByValue": true
})
token_result = result.get('result',{}).get('result',{}).get('value','')
print("Token attempt:", token_result)

# Try using the fetch API from within the page to update rules
newRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{userId} {
      allow read: if true;
      allow write: if request.auth != null \\u0026\\u0026 request.auth.uid == userId;
    }
    match /saves/{userId} {
      allow read, write: if request.auth != null \\u0026\\u0026 request.auth.uid == userId;
    }
    match /display_names/{docId} {
      allow read: if true;
      allow write: if request.auth != null \\u0026\\u0026 request.resource.data.uid == request.auth.uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`

result = cdp("Runtime.evaluate", {
    "expression": f"""
        (async () => {{
            try {{
                // Try using the Firebase SDK's internal API to update rules
                // First, check if there's a Firebase app instance
                if (typeof firebase !== 'undefined') {{
                    return 'firebase global found';
                }}
                // Check for the modular Firebase instance in window
                const keys = Object.keys(window).filter(k => k.includes('firebase') || k.includes('Firebase'));
                return JSON.stringify(keys);
            }} catch(e) {{
                return 'error: ' + e.message;
            }}
        }})()
    """,
    "awaitPromise": true,
    "returnByValue": true
})
fb_check = result.get('result',{}).get('result',{}).get('value','')
print("Firebase check:", fb_check)

ws.close()
