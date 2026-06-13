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

# Click "Show key" on the Firebase API key row
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Find all cells containing "Browser key"
            const cells = document.querySelectorAll('td, div, span');
            for (const cell of cells) {
                if (cell.textContent.includes('Browser key') || cell.textContent.includes('auto created by Firebase')) {
                    // Find the "Show key" link near it
                    const row = cell.closest('tr') || cell.closest('div[role="row"]') || cell.parentElement;
                    if (row) {
                        const showLinks = row.querySelectorAll('a, span[role="button"], button');
                        for (const link of showLinks) {
                            const t = link.textContent.trim().toLowerCase();
                            if (t === 'show key' || t === 'show' || link.innerText.includes('Show')) {
                                const rect = link.getBoundingClientRect();
                                return JSON.stringify({x: rect.left + rect.width/2, y: rect.top + rect.height/2});
                            }
                        }
                    }
                }
            }
            return JSON.stringify({found: false});
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
print("Show key result:", res)
data = json.loads(res)

if 'x' in data:
    x, y = data['x'], data['y']
    cdp("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
    cdp("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})
    print(f"Clicked Show key at ({x:.0f}, {y:.0f})")
    time.sleep(3)
    
    # Get the page content to see if key details opened
    result = cdp("Runtime.evaluate", {
        "expression": "document.body.innerText",
        "returnByValue": True
    })
    text = result.get('result',{}).get('result',{}).get('value','')
    # Find the API key section
    idx = text.find('AIzaSy')
    if idx >= 0:
        print("API key section:")
        print(text[idx:idx+800])
    else:
        print("API key not found in text, showing around 'Restrictions':")
        idx2 = text.find('Restrictions')
        if idx2 >= 0:
            print(text[idx2-200:idx2+1000])

ws.close()
