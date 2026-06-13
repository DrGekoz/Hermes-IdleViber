import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
gcp_tab = None
for t in tabs:
    u = t.get('url','')
    if 'google' in u and ('credentials' in u or 'apis' in u):
        gcp_tab = t
        break
if not gcp_tab:
    print("Tab not found")
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

# Try clicking the API key name link
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const links = document.querySelectorAll('a');
            for (const a of links) {
                if (a.textContent.trim().includes('Firebase') && a.href) {
                    return JSON.stringify({href: a.href, text: a.textContent.trim().substring(0,100)});
                }
            }
            // Find the API key row
            const rows = document.querySelectorAll('[role="row"], tr');
            for (const row of rows) {
                if (row.textContent.includes('Browser key')) {
                    const cells = row.querySelectorAll('td, [role="cell"]');
                    for (const cell of cells) {
                        const link = cell.querySelector('a');
                        if (link) {
                            return JSON.stringify({href: link.href, text: link.textContent.trim()});
                        }
                    }
                }
            }
            // Try any link containing 'AIzaSy'
            const all = document.querySelectorAll('a');
            for (const a of all) {
                if (a.href && a.href.includes('AIzaSy')) {
                    return JSON.stringify({href: a.href, text: a.textContent.trim().substring(0,50)});
                }
            }
            return JSON.stringify({found: false});
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
print("Key link result:", res)
data = json.loads(res)

if 'href' in data and data.get('href'):
    # Navigate to that link
    cdp("Runtime.evaluate", {
        "expression": f"window.location.href = '{data['href']}'; 'navigating'",
        "returnByValue": True
    })
    print(f"Navigating to: {data['href']}")
    time.sleep(8)
    
    result = cdp("Runtime.evaluate", {
        "expression": "document.body.innerText",
        "returnByValue": True
    })
    text = result.get('result',{}).get('result',{}).get('value','')
    print("Page text:")
    for term in ['HTTP', 'referrer', 'restrict', 'None', 'Website', 'Application']:
        idx = text.lower().find(term.lower())
        if idx >= 0:
            print(f"  Found '{term}': {text[max(0,idx-50):idx+200]}")
else:
    # Try directly navigating to the edit page
    cdp("Runtime.evaluate", {
        "expression": "window.location.href = 'https://console.cloud.google.com/apis/credentials?project=hermes-idleviber'; 'navigating'",
        "returnByValue": True
    })
    time.sleep(8)
    result = cdp("Runtime.evaluate", {
        "expression": "document.body.innerText.substring(0, 3000)",
        "returnByValue": True
    })
    text = result.get('result',{}).get('result',{}).get('value','')
    print("Navigated back to credentials:")
    print(text[:2000])

ws.close()
