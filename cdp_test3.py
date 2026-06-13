import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
# Find the tab with the game loaded
target = None
for t in tabs:
    u = t.get('url','')
    if 'hermes-idleviber.netlify.app' in u and u != 'about:blank':
        target = t
        break
if not target:
    print("Game tab not found")
    # Check what tabs we have
    for t in tabs:
        print(f"  Tab: {t.get('url','')[:80]}")
    exit(1)

ws_url = target['webSocketDebuggerUrl']
ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Enable console
cdp("Console.enable")
cdp("Log.enable")
cdp("Runtime.enable")

time.sleep(2)

# Get JS errors by checking the window
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Check if app.js module loaded
            const modules = document.querySelectorAll('script[type=\"module\"]');
            const regularScripts = document.querySelectorAll('script:not([type=\"module\"])');
            return JSON.stringify({
                moduleCount: modules.length,
                regularCount: regularScripts.length,
                moduleSrcs: Array.from(modules).map(s => s.src || 'inline').filter(s => s),
                pageState: document.readyState
            });
        })()
    """,
    "returnByValue": True,
    "awaitPromise": False
})
res = result.get('result',{}).get('result',{}).get('value','{}')
print("Scripts found:", res)

# Check CSP directly
result = cdp("Runtime.evaluate", {
    "expression": "document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]') ? document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]').content : 'no meta CSP'",
    "returnByValue": True
})
csp_meta = result.get('result',{}).get('result',{}).get('value','')
print("Meta CSP:", csp_meta)

# Check the network for failed requests
result = cdp("Runtime.evaluate", {
    "expression": "performance.getEntriesByType('resource').filter(r => r.entryType === 'resource').map(r => r.name).join('\\n')",
    "returnByValue": True
})
resources = result.get('result',{}).get('result',{}).get('value','')
print("\\nLoaded resources (first 20):")
lines = resources.split('\\n')
for l in lines[:20]:
    print(f"  {l}")

ws.close()
