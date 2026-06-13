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

# Enable Network domain to capture request headers
cdp("Network.enable")

# Trigger a page reload to capture the auth headers during API calls
cdp("Runtime.evaluate", {
    "expression": "window.location.reload()",
    "returnByValue": True
})

# Wait for page to load and API calls to happen
print("Waiting for API calls...")
time.sleep(10)

# Try to get the token from Auth state
result = cdp("Runtime.evaluate", {
    "expression": """
        (async () => {
            try {
                // After page reload, try to get token from various sources
                // Firebase Auth stores its state in IndexedDB
                // Try to get it from the Firebase SDK
                
                // Check if firebase is initialized in this page
                const fbModules = Object.keys(window).filter(k => k.startsWith('_') && window[k]?.INTERNAL);
                if (fbModules.length > 0) {
                    const fb = window[fbModules[0]];
                    if (fb.auth && fb.auth().currentUser) {
                        const token = await fb.auth().currentUser.getIdToken();
                        return 'FIREBASE_TOKEN: ' + token.substring(0, 50);
                    }
                }
                
                // Try to find Firebase Auth instance in the Angular app
                const appEl = document.querySelector('[ng-version]') || document.querySelector('app-root');
                if (appEl) {
                    const ng = appEl.__ngContext__;
                    // Deep inspect Angular context for auth token
                    return 'Angular app found, ngContext: ' + (ng ? ng.length : 'no context');
                }
                
                return 'No auth source found';
            } catch(e) {
                return 'Error: ' + e.message;
            }
        })()
    """,
    "awaitPromise": True,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','')
print("Auth after reload:", res)

# Also try to navigate to a page where we can get the token
cdp("Runtime.evaluate", {
    "expression": "window.location.href = 'https://console.firebase.google.com/project/hermes-idleviber/firestore/rules'",
    "returnByValue": True
})
time.sleep(8)

cdp("Runtime.evaluate", {
    "expression": "window.location.reload()",
    "returnByValue": True
})
time.sleep(10)

# Check if we're on rules page
result = cdp("Runtime.evaluate", {
    "expression": "document.body.innerText.indexOf('rules_version') >= 0 ? 'ON RULES PAGE' : document.title",
    "returnByValue": True
})
print("Check:", result.get('result',{}).get('result',{}).get('value',''))

ws.close()
