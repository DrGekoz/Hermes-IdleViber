import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    u = t.get('url','')
    if 'firebase' in u and 'project/hermes-idleviber' in u:
        ws_url = t['webSocketDebuggerUrl']
        print("Using tab:", u[:80])
        break
else:
    # Open new tab to Firebase
    req = urllib.request.Request("http://127.0.0.1:9222/json/new?https://console.firebase.google.com/project/hermes-idleviber/overview", method="PUT")
    tab = json.loads(urllib.request.urlopen(req).read())
    ws_url = tab['webSocketDebuggerUrl']
    print("New tab created")
    time.sleep(5)

ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Step 1: Click "Firestore" in the sidebar navigation
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const navs = document.querySelectorAll('a, span, div[role=\"button\"], fire-major-selector-item');
            for (const el of navs) {
                if (el.textContent.trim().includes('Firestore') && el.offsetParent !== null) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 30 && rect.height > 20) {
                        return JSON.stringify({x: rect.left+rect.width/2, y: rect.top+rect.height/2, text: el.textContent.trim().substring(0,30)});
                    }
                }
            }
            return JSON.stringify({found: false});
        })()
    """,
    "returnByValue": True
})
res = json.loads(result.get('result',{}).get('result',{}).get('value','{}'))
print("Firestore nav:", res.get('text','not found'))

if 'x' in res:
    # Click Firestore
    cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":res['x'],"y":res['y'],"button":"left","clickCount":1})
    cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":res['x'],"y":res['y'],"button":"left","clickCount":1})
    print("Clicked Firestore")
    time.sleep(5)
    
    # Step 2: Now click the "Rules" tab
    result = cdp("Runtime.evaluate", {
        "expression": """
            (() => {
                const tabs = document.querySelectorAll('a, button, div[role=\"tab\"], fire-major-selector-item, .fire-tab');
                for (const el of tabs) {
                    if (el.textContent.trim().toLowerCase() === 'rules' && el.offsetParent !== null) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 20 && rect.height > 15) {
                            return JSON.stringify({x: rect.left+rect.width/2, y: rect.top+rect.height/2});
                        }
                    }
                }
                // Try containing "Rules"
                for (const el of tabs) {
                    if (el.textContent.trim() === 'Rules' && el.offsetParent !== null) {
                        const rect = el.getBoundingClientRect();
                        return JSON.stringify({x: rect.left+rect.width/2, y: rect.top+rect.height/2, w: rect.width, h: rect.height});
                    }
                }
                return JSON.stringify({found: false});
            })()
        """,
        "returnByValue": True
    })
    res2 = json.loads(result.get('result',{}).get('result',{}).get('value','{}'))
    print("Rules tab:", res2.get('found', 'found'))
    
    if 'x' in res2:
        cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":res2['x'],"y":res2['y'],"button":"left","clickCount":1})
        cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":res2['x'],"y":res2['y'],"button":"left","clickCount":1})
        print("Clicked Rules")
        time.sleep(5)
        
        # Step 3: Get the page content to verify we're on the rules page
        result = cdp("Runtime.evaluate", {
            "expression": "document.body.innerText.substring(0, 1500)",
            "returnByValue": True
        })
        text = result.get('result',{}).get('result',{}).get('value','')
        print("Current page content shows rules_version:", 'rules_version' in text)
        
        # Step 4: Try to set the rules via the editor textarea
        # Monaco editor in Firebase stores its value in a hidden textarea or model
        result = cdp("Runtime.evaluate", {
            "expression": """
                (() => {
                    const textareas = document.querySelectorAll('textarea');
                    for (const ta of textareas) {
                        if (ta.offsetParent !== null || ta.style.display !== 'none') {
                            return 'textarea found: class=' + (ta.className || '').substring(0,50) + ' display=' + ta.style.display;
                        }
                    }
                    // Look for the actual editor content area
                    const lines = document.querySelectorAll('.view-line');
                    return 'view-lines: ' + lines.length + ' first=' + (lines[0]?.textContent?.substring(0,30) || 'none');
                })()
            """,
            "returnByValue": True
        })
        editor_state = result.get('result',{}).get('result',{}).get('value','')
        print("Editor state:", editor_state)
        
        # Step 5: Try to set the editor content via JavaScript
        # The Firebase Console uses Angular + Monaco. Try to access the component
        result = cdp("Runtime.evaluate", {
            "expression": """
                (() => {
                    // Try to access the Angular component that holds the rules
                    const rootEl = document.querySelector('app-firestore-root') || document.querySelector('fire-rules');
                    if (rootEl) {
                        const ng = rootEl.__ngContext__ || rootEl._ngContext;
                        return 'found firestore root: ngContext=' + (ng ? 'yes' : 'no');
                    }
                    // Look for any Angular component with rules
                    const all = document.querySelectorAll('*');
                    let composer = null;
                    for (const el of all) {
                        if (el.tagName.toLowerCase().includes('composer') || el.tagName.toLowerCase().includes('rules')) {
                            composer = el.tagName;
                        }
                    }
                    return 'composer-like: ' + (composer || 'none');
                })()
            """,
            "returnByValue": True
        })
        angular_state = result.get('result',{}).get('result',{}).get('value','')
        print("Angular state:", angular_state)

ws.close()
