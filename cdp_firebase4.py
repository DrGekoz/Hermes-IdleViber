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

# Find and click "Authorized domains" nav item
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Find all fire-major-selector-item elements and look for "Authorized domains"
            const items = document.querySelectorAll('fire-major-selector-item');
            for (const item of items) {
                const title = item.querySelector('fire-major-lockup-title');
                if (title && title.textContent.trim() === 'Authorized domains') {
                    // Get its position for clicking
                    const rect = item.getBoundingClientRect();
                    return JSON.stringify({
                        found: true,
                        x: rect.left + rect.width/2,
                        y: rect.top + rect.height/2,
                        text: title.textContent.trim()
                    });
                }
            }
            // Try searching all elements
            const all = document.querySelectorAll('*');
            for (const el of all) {
                if (el.textContent && el.textContent.trim() === 'Authorized domains') {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        return JSON.stringify({
                            found: true,
                            x: rect.left + rect.width/2,
                            y: rect.top + rect.height/2,
                            tag: el.tagName,
                            text: el.textContent.trim().substring(0, 50)
                        });
                    }
                }
            }
            return JSON.stringify({found: false, items: items.length});
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
print("Nav search:", res)
data = json.loads(res)

if data.get('found'):
    # Click the element
    x, y = data['x'], data['y']
    cdp("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
    cdp("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})
    print(f"Clicked at ({x:.0f}, {y:.0f})")
    time.sleep(3)
    
    # Get page content after click
    result = cdp("Runtime.evaluate", {
        "expression": "document.body.innerText.substring(0, 4000)",
        "returnByValue": True
    })
    text = result.get('result',{}).get('result',{}).get('value','')
    print("Page content after click:")
    print(text)

ws.close()
