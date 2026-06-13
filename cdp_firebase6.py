import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
fb_tab = None
for t in tabs:
    if 'firebase' in t.get('url','') and 'authentication' in t.get('url',''):
        fb_tab = t
        break
if not fb_tab:
    print("Tab not found")
    exit(1)

ws_url = fb_tab['webSocketDebuggerUrl']
ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Find the domain input field
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Find input fields in dialogs/modals
            const inputs = document.querySelectorAll('input[type="text"], input:not([type]), input');
            for (const inp of inputs) {
                const rect = inp.getBoundingClientRect();
                if (rect.width > 100 && rect.height > 20) {
                    // Check if it's visible
                    const style = window.getComputedStyle(inp);
                    if (style.display !== 'none' && style.visibility !== 'hidden') {
                        return JSON.stringify({
                            found: true,
                            x: rect.left + rect.width/2,
                            y: rect.top + rect.height/2,
                            placeholder: inp.placeholder || '',
                            id: inp.id,
                            className: inp.className.substring(0, 100)
                        });
                    }
                }
            }
            return JSON.stringify({found: false});
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
print("Input field:", res)
data = json.loads(res)

if data.get('found'):
    # Click the input to focus it
    x, y = data['x'], data['y']
    cdp("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
    cdp("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})
    time.sleep(0.5)
    
    # Type the domain
    domain = "hermes-idleviber.netlify.app"
    for ch in domain:
        cdp("Input.dispatchKeyEvent", {"type": "keyDown", "text": ch, "key": ch})
        cdp("Input.dispatchKeyEvent", {"type": "keyUp", "key": ch})
    print(f"Typed: {domain}")
    time.sleep(1)
    
    # Find and click the "Add" button in the dialog
    result = cdp("Runtime.evaluate", {
        "expression": """
            (() => {
                const btns = document.querySelectorAll('button, span[role="button"], .dialog-button');
                for (const btn of btns) {
                    if (btn.textContent.trim() === 'Add' && btn.offsetParent !== null) {
                        const rect = btn.getBoundingClientRect();
                        return JSON.stringify({x: rect.left + rect.width/2, y: rect.top + rect.height/2});
                    }
                }
                // Try with aria-label or other attributes
                const all = document.querySelectorAll('*');
                for (const el of all) {
                    const t = el.textContent.trim();
                    if (t === 'Add' && el.offsetParent !== null && el.tagName !== 'BODY') {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 20 && rect.height > 20) {
                            return JSON.stringify({x: rect.left + rect.width/2, y: rect.top + rect.height/2});
                        }
                    }
                }
                return JSON.stringify({found: false});
            })()
        """,
        "returnByValue": True
    })
    res2 = result.get('result',{}).get('result',{}).get('value','{}')
    print("Add button:", res2)
    data2 = json.loads(res2)
    
    if 'x' in data2:
        x, y = data2['x'], data2['y']
        cdp("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
        cdp("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})
        print(f"Clicked Add at ({x:.0f}, {y:.0f})")
        time.sleep(3)
        
        # Verify the domain was added
        result = cdp("Runtime.evaluate", {
            "expression": "document.body.innerText.substring(0, 3000)",
            "returnByValue": True
        })
        text = result.get('result',{}).get('result',{}).get('value','')
        if 'hermes-idleviber.netlify.app' in text:
            print("SUCCESS: Domain added!")
        print("Content:")
        print(text[text.find('Authorized domains'):text.find('Authorized domains')+800])
    else:
        print("Could not find Add button")
else:
    print("Could not find input field")

ws.close()
