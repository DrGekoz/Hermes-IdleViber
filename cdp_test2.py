import json, urllib.request, websocket, time

# Refresh the page to see fresh console logs
tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())

# Create a new tab fresh
req = urllib.request.Request(
    "http://127.0.0.1:9222/json/new?about:blank",
    method="PUT")
resp = urllib.request.urlopen(req)
tab = json.loads(resp.read())
ws_url = tab['webSocketDebuggerUrl']
ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)

msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Enable console logging
cdp("Console.enable")
cdp("Log.enable")
cdp("Runtime.enable")

# Navigate to the game
cdp("Runtime.evaluate", {
    "expression": "window.location.href = 'https://hermes-idleviber.netlify.app/';",
    "returnByValue": True
})

time.sleep(8)

# Get all console messages
result = cdp("Runtime.evaluate", {
    "expression": "JSON.stringify(window.__consoleErrors || [])",
    "returnByValue": True
})

# Check the page for the actual error in more detail
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const lines = document.body ? document.body.innerText.split('\\n') : [];
            const errors = lines.filter(l => l.includes('Error') || l.includes('error') || l.includes('Firebase') || l.includes('auth'));
            const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
            return JSON.stringify({
                errorLines: errors,
                scripts: scripts,
                moduleScripts: Array.from(document.querySelectorAll('script[type=\"module\"]')).map(s => s.src || s.innerHTML.substring(0,100))
            });
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
print("Page analysis:")
data = json.loads(res)
print("Error lines:", data.get('errorLines', []))
print("Scripts:", data.get('scripts', [])[:5])
print("Module scripts:")
for s in data.get('moduleScripts', [])[:10]:
    print(f"  {s}")

ws.close()
