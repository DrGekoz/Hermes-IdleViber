import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    u = t.get('url','')
    if 'firebase' in u and '/firestore' in u:
        ws_url = t['webSocketDebuggerUrl']
        break
else:
    print("Rules tab not found - opening")
    req = urllib.request.Request("http://127.0.0.1:9222/json/new?https://console.firebase.google.com/project/hermes-idleviber/firestore/rules", method="PUT")
    tab = json.loads(urllib.request.urlopen(req).read())
    ws_url = tab['webSocketDebuggerUrl']
    time.sleep(10)

ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# The Firebase Console uses internal Angular methods
# Try to directly call the Firestore REST API from the page context with its auth
rules_text = """rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /saves/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /display_names/{docId} {
      allow read: if true;
      allow write: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}"""

# Try using the page's authenticated fetch to make a direct API call
result = cdp("Runtime.evaluate", {
    "expression": f"""
        (async () => {{
            try {{
                // Get the Firebase Auth token from the page's Firebase instance
                // The Firebase Console stores the token internally
                const resp = await fetch(
                    'https://firebaserules.googleapis.com/v1/projects/hermes-idleviber/rulesets',
                    {{
                        method: 'POST',
                        credentials: 'include',
                        headers: {{'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}},
                        body: JSON.stringify({{
                            source: {{
                                files: [{{
                                    name: 'firestore.rules',
                                    content: `{rules_text.replace('`', '\\`')}`
                                }}]
                            }}
                        }})
                    }}
                );
                const data = await resp.json();
                if (resp.ok) {{
                    // Now release it
                    const rel = await fetch(
                        'https://firebaserules.googleapis.com/v1/projects/hermes-idleviber/releases/cloud.firestore',
                        {{
                            method: 'PATCH',
                            credentials: 'include',
                            headers: {{'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}},
                            body: JSON.stringify({{
                                name: 'projects/hermes-idleviber/releases/cloud.firestore',
                                rulesetName: data.name
                            }})
                        }}
                    );
                    const relData = await rel.json();
                    return 'DONE: ' + (relData.name || JSON.stringify(relData));
                }} else {{
                    // Try alternative API endpoint
                    const resp2 = await fetch(
                        'https://firestore.googleapis.com/v1/projects/hermes-idleviber/databases/(default)/documents:commit',
                        {{
                            method: 'POST',
                            credentials: 'include',
                            headers: {{'Content-Type': 'application/json'}},
                            body: JSON.stringify({{writes: []}})
                        }}
                    );
                    return 'Rules API fail: ' + resp.status + ' ' + JSON.stringify(data).substring(0,200) + '\\nTest: ' + resp2.status;
                }}
            }} catch(e) {{
                return 'Error: ' + e.message;
            }}
        }})()
    """,
    "awaitPromise": True,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','')
print("API result:", res[:500])

ws.close()
