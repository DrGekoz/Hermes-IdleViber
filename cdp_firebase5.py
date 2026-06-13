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

# Click "Add domain" button
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const btns = document.querySelectorAll('button, a, span[role="button"]');
            for (const btn of btns) {
                if (btn.textContent.trim() === 'Add domain') {
                    const rect = btn.getBoundingClientRect();
                    return JSON.stringify({x: rect.left + rect.width/2, y: rect.top + rect.height/2, text: btn.textContent.trim()});
                }
            }
            return 'NOT FOUND';
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
print("Add domain btn:", res)

data = json.loads(res)
if isinstance(data, dict) and 'x' in data:
    x, y = data['x'], data['y']
    cdp("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
    cdp("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})
    print(f"Clicked Add domain at ({x:.0f}, {y:.0f})")
    time.sleep(3)

# Check if a dialog opened
result = cdp("Runtime.evaluate", {
    "expression": "document.body.innerText.substring(0, 2000)",
    "returnByValue": True
})
text = result.get('result',{}).get('result',{}).get('value','')
print("After click content:")
print(text)

ws.close()
