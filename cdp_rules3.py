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

# Try clicking on Firestore in the nav
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const items = document.querySelectorAll('a, span, div[role=\"button\"]');
            for (const el of items) {
                if (el.textContent.trim() === 'Firestore' && el.offsetParent !== null) {
                    const rect = el.getBoundingClientRect();
                    return JSON.stringify({x: rect.left+rect.width/2, y: rect.top+rect.height/2, tag: el.tagName});
                }
            }
            return JSON.stringify({found: false});
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
data = json.loads(res)
print("Firestore nav:", data)

if 'x' in data:
    x, y = data['x'], data['y']
    cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":x,"y":y,"button":"left","clickCount":1})
    cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":x,"y":y,"button":"left","clickCount":1})
    print(f"Clicked at ({x:.0f}, {y:.0f})")
    time.sleep(5)
    
    # Check what page we're on
    result = cdp("Runtime.evaluate", {
        "expression": "document.title",
        "returnByValue": True
    })
    title = result.get('result',{}).get('result',{}).get('value','')
    print(f"Title after click: {title}")
    
    # Look for Rules tab
    result = cdp("Runtime.evaluate", {
        "expression": """
            (() => {
                const tabs = document.querySelectorAll('a, button, div[role=\"tab\"]');
                for (const t of tabs) {
                    const txt = t.textContent.trim().toLowerCase();
                    if (txt === 'rules' || txt.includes('rules')) {
                        const rect = t.getBoundingClientRect();
                        return JSON.stringify({x: rect.left+rect.width/2, y: rect.top+rect.height/2});
                    }
                }
                return JSON.stringify({found: false});
            })()
        """,
        "returnByValue": True
    })
    res2 = result.get('result',{}).get('result',{}).get('value','{}')
    data2 = json.loads(res2)
    print("Rules tab:", data2)
    
    if 'x' in data2:
        x2, y2 = data2['x'], data2['y']
        cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":x2,"y":y2,"button":"left","clickCount":1})
        cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":x2,"y":y2,"button":"left","clickCount":1})
        print(f"Clicked Rules at ({x2:.0f}, {y2:.0f})")
        time.sleep(5)
        
        # Get page content
        result = cdp("Runtime.evaluate", {
            "expression": "document.body.innerText.substring(0, 2000)",
            "returnByValue": True
        })
        text = result.get('result',{}).get('result',{}).get('value','')
        print("Rules page content:")
        print(text)

ws.close()
