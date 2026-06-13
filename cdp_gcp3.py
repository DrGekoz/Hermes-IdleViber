import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
gcp_tab = None
for t in tabs:
    if 'google' in t.get('url','') and 'credentials' in t.get('url',''):
        gcp_tab = t
        break
if not gcp_tab:
    print("GCP tab not found")
    exit(1)

ws_url = gcp_tab['webSocketDebuggerUrl']
ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Click on the API key name to open edit page
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const all = document.querySelectorAll('a, span, div, td');
            for (const el of all) {
                if (el.textContent.trim().includes('Browser key') && el.textContent.trim().includes('auto created by Firebase')) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 50) {
                        return JSON.stringify({x: rect.left + rect.width/2, y: rect.top + rect.height/2});
                    }
                }
            }
            // Try clicking the whole row
            const rows = document.querySelectorAll('tr, div[role="row"]');
            for (const row of rows) {
                if (row.textContent.includes('Browser key')) {
                    const rect = row.getBoundingClientRect();
                    if (rect.width > 100) {
                        return JSON.stringify({x: rect.left + 50, y: rect.top + rect.height/2});
                    }
                }
            }
            return JSON.stringify({found: false});
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
print("Click result:", res)
data = json.loads(res)

if 'x' in data:
    x, y = data['x'], data['y']
    cdp("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
    cdp("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})
    print(f"Clicked at ({x:.0f}, {y:.0f})")
    time.sleep(5)
    
    # Get page content
    result = cdp("Runtime.evaluate", {
        "expression": "document.body.innerText",
        "returnByValue": True
    })
    text = result.get('result',{}).get('result',{}).get('value','')
    # Check for restrictions info
    if 'Application restrictions' in text or 'HTTP referrers' in text or 'API restrictions' in text:
        idx = text.find('Application restrictions')
        if idx < 0: idx = text.find('HTTP referrers')
        if idx < 0: idx = text.find('API restrictions')
        if idx >= 0:
            print("Restrictions section:")
            print(text[max(0,idx-100):idx+800])
    else:
        print("No restrictions info found. Page content around 'restrict':")
        idx = text.lower().find('restrict')
        if idx >= 0:
            print(text[max(0,idx-200):idx+800])
        else:
            print("First 2000 chars:")
            print(text[:2000])

ws.close()
