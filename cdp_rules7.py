import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    u = t.get('url','')
    if 'firebase' in u and 'project/hermes-idleviber' in u:
        ws_url = t['webSocketDebuggerUrl']
        print("Using tab:", u[:80])
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

# Navigate to rules editor page
cdp("Runtime.evaluate", {
    "expression": "window.location.href = 'https://console.firebase.google.com/project/hermes-idleviber/firestore/rules'",
    "returnByValue": True
})
time.sleep(10)

# Try to find the Monaco editor instance and set the value
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Look for the monaco editor in the page
            // Monaco stores its models in monaco.editor.getModels()
            if (typeof monaco !== 'undefined' && monaco.editor) {
                const models = monaco.editor.getModels();
                if (models && models.length > 0) {
                    // Find the Firestore rules model
                    for (const m of models) {
                        if (m.uri && (m.uri.path || '').includes('firestore') || (m.getValue().includes('rules_version'))) {
                            return 'monaco found: ' + m.uri.toString();
                        }
                    }
                    return 'monaco models: ' + models.length;
                }
                return 'monaco no models';
            }
            // Check for firebase-rules-editor component
            const editors = document.querySelectorAll('fire-rules-editor, .fire-rules-editor, monaco-editor');
            if (editors.length > 0) return 'found editor elements: ' + editors.length;
            
            // Check Angular component
            const app = document.querySelector('app-firestore-root, app-firestore');
            if (app) return 'found firestore app component';
            
            return JSON.stringify({
                monacoGlobal: typeof monaco !== 'undefined',
                hasEditors: document.querySelectorAll('[class*=\"monaco\"]').length,
                hasTextarea: document.querySelectorAll('textarea').length,
                bodyClasses: document.body.className.substring(0, 100)
            });
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','')
print("Editor search:", res)

ws.close()
