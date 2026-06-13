import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
fb_tab = None
for t in tabs:
    u = t.get('url','')
    if 'firebase' in u and 'firestore.google.com' not in u:
        fb_tab = t
        break

if not fb_tab:
    print("Creating new tab")
    req = urllib.request.Request("http://127.0.0.1:9222/json/new?https://console.firebase.google.com/project/hermes-idleviber/firestore/rules", method="PUT")
    resp = urllib.request.urlopen(req)
    tab = json.loads(resp.read())
    ws_url = tab['webSocketDebuggerUrl']
else:
    ws_url = fb_tab['webSocketDebuggerUrl']
    # Navigate
    print("Using existing tab")

ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Navigate to firestore rules
cdp("Runtime.evaluate", {
    "expression": "window.location.href = 'https://console.firebase.google.com/project/hermes-idleviber/firestore/rules'",
    "returnByValue": True
})
time.sleep(10)

result = cdp("Runtime.evaluate", {
    "expression": "document.body ? document.body.innerText.substring(0, 3000) : 'loading'",
    "returnByValue": True
})
text = result.get('result',{}).get('result',{}).get('value','')
print("Firestore Rules page:")
print(text)

ws.close()
