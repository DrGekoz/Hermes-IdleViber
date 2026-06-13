import json, urllib.request, websocket, time

# Open fresh tab to the game
tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
req = urllib.request.Request(
    "http://127.0.0.1:9222/json/new?https://hermes-idleviber.netlify.app/",
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

time.sleep(10)

result = cdp("Runtime.evaluate", {
    "expression": "document.body.innerText",
    "returnByValue": True
})
text = result.get('result',{}).get('result',{}).get('value','')

if 'auth/internal-error' in text:
    print("STILL HAS ERROR")
    # Extract the error lines
    for line in text.split('\n'):
        if 'Error' in line or 'error' in line or 'Firebase' in line:
            print(f"  ERR: {line}")
else:
    print("NO AUTH ERROR - Firebase is working!")

# Check for any error on the page
error_lines = [l for l in text.split('\n') if 'Error' in l or 'error' in l]
if error_lines:
    print("Other errors:")
    for l in error_lines[:5]:
        print(f"  {l}")

# Also check if Firebase loaded
result = cdp("Runtime.evaluate", {
    "expression": "typeof initializeApp !== 'undefined' || (typeof firebase !== 'undefined')",
    "returnByValue": True
})
fb_loaded = result.get('result',{}).get('result',{}).get('value', False)
print(f"Firebase loaded: {fb_loaded}")

ws.close()
