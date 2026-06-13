import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    u = t.get('url','')
    if 'firebase' in u and 'project/hermes-idleviber' in u:
        ws_url = t['webSocketDebuggerUrl']
        break
else:
    exit(1)

ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Use fetch from within the page to deploy Firestore rules via the Firebase Management API
rules_text = """rules_version = '2';
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
}"""

# Escape properly for JavaScript
rules_escaped = rules_text.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')

result = cdp("Runtime.evaluate", {
    "expression": f"""
        (async () => {{
            try {{
                const resp = await fetch(
                    'https://firebaserules.googleapis.com/v1/projects/hermes-idleviber/rulesets',
                    {{
                        method: 'POST',
                        credentials: 'include',
                        headers: {{'Content-Type': 'application/json'}},
                        body: JSON.stringify({{
                            source: {{
                                files: [{{
                                    name: 'firestore.rules',
                                    content: '{rules_escaped}'
                                }}]
                            }}
                        }})
                    }}
                );
                const data = await resp.json();
                if (data.name) {{
                    // Ruleset created! Now release it
                    const releaseResp = await fetch(
                        'https://firebaserules.googleapis.com/v1/projects/hermes-idleviber/releases/cloud.firestore',
                        {{
                            method: 'PATCH',
                            credentials: 'include',
                            headers: {{'Content-Type': 'application/json'}},
                            body: JSON.stringify({{
                                name: 'projects/hermes-idleviber/releases/cloud.firestore',
                                rulesetName: data.name
                            }})
                        }}
                    );
                    const releaseData = await releaseResp.json();
                    return 'SUCCESS: ' + (releaseData.name || JSON.stringify(releaseData));
                }} else {{
                    return 'FAILED: ' + JSON.stringify(data);
                }}
            }} catch(e) {{
                return 'ERROR: ' + e.message;
            }}
        }})()
    """,
    "awaitPromise": True,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','')
print("Deploy result:", res)

ws.close()
