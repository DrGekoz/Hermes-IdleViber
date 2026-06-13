import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())

# Open Google Cloud Console credentials page
req = urllib.request.Request(
    "http://127.0.0.1:9222/json/new?https://console.cloud.google.com/apis/credentials?project=hermes-idleviber&authuser=0",
    method="PUT")
resp = urllib.request.urlopen(req)
tab = json.loads(resp.read())
ws_url = tab['webSocketDebuggerUrl']
print("Opened GCP credentials page")

ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

time.sleep(12)

# Get page content
result = cdp("Runtime.evaluate", {
    "expression": "document.body ? document.body.innerText.substring(0, 4000) : 'loading'",
    "returnByValue": True
})
text = result.get('result',{}).get('result',{}).get('value','')
print("Page content:")
print(text[:3000])

ws.close()
