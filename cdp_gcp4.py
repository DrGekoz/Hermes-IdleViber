import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())

# Navigate directly to the API key edit page
key_id = "AIzaSyCvfXv2nOmfZ_h8mvSkiWepddc1vKynWCE"
url = f"https://console.cloud.google.com/apis/credentials/key/{key_id}?project=hermes-idleviber&authuser=0"

req = urllib.request.Request(
    f"http://127.0.0.1:9222/json/new?{url}",
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

# Get page content
result = cdp("Runtime.evaluate", {
    "expression": "document.body.innerText",
    "returnByValue": True
})
text = result.get('result',{}).get('result',{}).get('value','')

# Look for restriction info
for term in ['HTTP referrer', 'Application restrictions', 'API restrictions', 'None', 'Website']:
    idx = text.lower().find(term.lower())
    if idx >= 0:
        print(f"Found '{term}' at {idx}:")
        print(text[max(0,idx-100):idx+500])
        print("---")

# Also check if there's a way to modify restrictions
result = cdp("Runtime.evaluate", {
    "expression": "document.title",
    "returnByValue": True
})
title = result.get('result',{}).get('result',{}).get('value','')
print(f"Page title: {title}")

ws.close()
