import json, urllib.request, websocket, time

# Fresh tab approach
req = urllib.request.Request("http://127.0.0.1:9222/json/new?https://console.firebase.google.com/project/hermes-idleviber/overview", method="PUT")
tab = json.loads(urllib.request.urlopen(req).read())
ws_url = tab['webSocketDebuggerUrl']
ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

time.sleep(8)

# Step 1: Click Firestore in nav
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const all = document.querySelectorAll('a, span, div, fire-major-selector-item');
            for (const el of all) {
                if (el.textContent.trim() === 'Firestore' && el.offsetParent) {
                    const r = el.getBoundingClientRect();
                    return JSON.stringify({x: r.left+r.width/2, y: r.top+r.height/2});
                }
            }
            return 'NF';
        })()
    """,
    "returnByValue": True
})
res = json.loads(result.get('result',{}).get('result',{}).get('value','""'))
print("Firestore:", str(res)[:50])
time.sleep(5)

if 'x' in res:
    cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":res['x'],"y":res['y'],"button":"left","clickCount":1})
    cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":res['x'],"y":res['y'],"button":"left","clickCount":1})
    time.sleep(5)
    
    # Step 2: Click Rules tab
    result = cdp("Runtime.evaluate", {
        "expression": """
            (() => {
                const all = document.querySelectorAll('a, button, div[role=\"tab\"], fire-major-selector-item');
                for (const el of all) {
                    if (el.textContent.trim() === 'Rules' && el.offsetParent) {
                        const r = el.getBoundingClientRect();
                        return JSON.stringify({x: r.left+r.width/2, y: r.top+r.height/2});
                    }
                }
                return 'NF';
            })()
        """,
        "returnByValue": True
    })
    res2 = json.loads(result.get('result',{}).get('result',{}).get('value','""'))
    print("Rules:", str(res2)[:50])
    
    if 'x' in res2:
        cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":res2['x'],"y":res2['y'],"button":"left","clickCount":1})
        cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":res2['x'],"y":res2['y'],"button":"left","clickCount":1})
        time.sleep(5)
        
        # Step 3: Verify we're on rules page
        result = cdp("Runtime.evaluate", {
            "expression": "document.body.innerText.indexOf('rules_version') >= 0 ? 'YES_ON_RULES' : 'NOT_ON_RULES'",
            "returnByValue": True
        })
        print("On rules page?", result.get('result',{}).get('result',{}).get('value',''))
        
        # Step 4: Try to modify the editor content directly
        # The Monaco editor can be accessed via JS
        result = cdp("Runtime.evaluate", {
            "expression": """
                (() => {
                    // Try to find the Monaco editor instance
                    if (typeof monaco !== 'undefined') {
                        const models = monaco.editor.getModels();
                        return 'monaco found, models: ' + models.length;
                    }
                    // Try to access the editor iframe or shadow DOM
                    const editors = document.querySelectorAll('.monaco-editor, .monaco-editor iframe');
                    if (editors.length > 0) return 'monaco DOM found: ' + editors.length;
                    
                    // Check for textarea inside the editor
                    const textareas = document.querySelectorAll('textarea');
                    for (const ta of textareas) {
                        if (ta.offsetParent !== null) {
                            return 'vis textarea: class=' + (ta.className || '').substring(0,40);
                        }
                    }
                    return 'no visible textarea';
                })()
            """,
            "returnByValue": True
        })
        print("Editor:", result.get('result',{}).get('result',{}).get('value',''))

ws.close()
