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

# Scroll to the authorized domains title element
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const walker = document.createTreeWalker(document.body, 4, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes('Authorized domains')) {
                    const title = node.parentElement;
                    title.scrollIntoView({behavior:'instant', block:'center'});
                    return 'Scrolled to: ' + title.outerHTML.substring(0, 300);
                }
            }
            return 'not found';
        })()
    """,
    "returnByValue": True
})
print("Scroll result:", result.get('result',{}).get('result',{}).get('value',''))
time.sleep(2)

# Now get the full DOM around that area
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Get full outer HTML of the component containing authorized domains
            const walker = document.createTreeWalker(document.body, 4, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes('Authorized domains')) {
                    let parent = node.parentElement;
                    // Walk up to find a meaningful container
                    for(let i=0; i<5; i++) {
                        if(parent && parent.parentElement) parent = parent.parentElement;
                    }
                    return parent.outerHTML.substring(0, 4000);
                }
            }
            return 'not found';
        })()
    """,
    "returnByValue": True
})
html = result.get('result',{}).get('result',{}).get('value','')
print("DOM around authorized domains:")
print(html[:3000])

ws.close()
