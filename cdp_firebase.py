import json, urllib.request, websocket, time

# Fetch tabs
tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
print("Tabs open: " + str(len(tabs)))

# Create a new tab for Firebase
req = urllib.request.Request(
    "http://127.0.0.1:9222/json/new?https://console.firebase.google.com/project/hermes-idleviber/authentication/settings",
    method="PUT")
resp = urllib.request.urlopen(req)
tab = json.loads(resp.read())
ws_url = tab['webSocketDebuggerUrl']
print("New tab: " + str(tab.get('id','?')))

# Connect via WebSocket
ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Wait for page load
time.sleep(10)

# Get page title
result = cdp("Runtime.evaluate", {
    "expression": "document.title",
    "returnByValue": True
})
title = result.get('result',{}).get('result',{}).get('value','')
print("Page title: " + str(title))

# Get page content
result = cdp("Runtime.evaluate", {
    "expression": "document.body ? document.body.innerText.substring(0, 3000) : 'loading'",
    "returnByValue": True
})
text = result.get('result',{}).get('result',{}).get('value','')
print("Page text:")
print(text[:2000])

ws.close()
