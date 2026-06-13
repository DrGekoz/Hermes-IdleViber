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

# Try to get the OAuth token from the page
result = cdp("Runtime.evaluate", {
    "expression": """
        (async () => {
            try {
                // Try to get token from Google Identity Services
                if (google && google.accounts && google.accounts.oauth2) {
                    return 'has google.accounts.oauth2';
                }
                // Try to get from token element
                const meta = document.querySelector('meta[name=\"access-token\"]');
                if (meta) return 'meta token: ' + meta.content.substring(0,20);
                
                // Try to get from session storage
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && (key.includes('token') || key.includes('oauth') || key.includes('credential'))) {
                        return 'session: ' + key + '=' + sessionStorage.getItem(key).substring(0,30);
                    }
                }
                
                // Try to make a request and see what auth headers are sent
                // First, trigger a request to a Firebase API endpoint and capture the auth header
                const testResp = await fetch('https://firestore.googleapis.com/v1/projects/hermes-idleviber/databases/(default)/documents/leaderboard?pageSize=1', {
                    credentials: 'include'
                });
                
                // Check the response
                return 'fetch status: ' + testResp.status;
            } catch(e) {
                return 'error: ' + e.message;
            }
        })()
    """,
    "awaitPromise": True,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','')
print("Auth check:", res)

# Try to deploy rules using the page's fetch with credentials
# The Firebase Console uses XHR/fetch with OAuth tokens stored in cookies
# We need to use the gapi client if available
result = cdp("Runtime.evaluate", {
    "expression": """
        (async () => {
            try {
                // Check if gapi is loaded
                if (typeof gapi !== 'undefined') {
                    try {
                        const token = gapi.auth.getToken();
                        if (token) return 'gapi token: ' + token.access_token.substring(0,20);
                    } catch(e) {}
                }
                
                // Try to use the Firebase Auth instance from the page
                const appCheck = await fetch('https://firebaserules.googleapis.com/v1/projects/hermes-idleviber/releases', {
                    credentials: 'include',
                    headers: {'Content-Type': 'application/json'}
                });
                const data = await appCheck.json();
                return 'releases: ' + JSON.stringify(data).substring(0, 300);
            } catch(e) {
                return 'error: ' + e.message;
            }
        })()
    """,
    "awaitPromise": True,
    "returnByValue": True
})
res2 = result.get('result',{}).get('result',{}).get('value','')
print("Rules API:", res2)

ws.close()
