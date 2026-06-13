import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    u = t.get('url','')
    if 'firebase' in u and 'project/hermes-idleviber' in u:
        ws_url = t['webSocketDebuggerUrl']
        break
else:
    exit(1)

ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Direct URL approach - use the full URL with the fragment path
cdp("Runtime.evaluate", {
    "expression": "window.location.assign('https://console.firebase.google.com/u/0/project/hermes-idleviber/firestore/rules')",
    "returnByValue": True
})
time.sleep(12)

result = cdp("Runtime.evaluate", {
    "expression": "document.title + ' | ' + window.location.href",
    "returnByValue": True
})
print("After navigate:", result.get('result',{}).get('result',{}).get('value',''))

result = cdp("Runtime.evaluate", {
    "expression": "document.body.innerText.substring(0, 2000)",
    "returnByValue": True
})
text = result.get('result',{}).get('result',{}).get('value','')
if 'rules_version' in text:
    print("ON RULES PAGE!")
    # Find the exact rules text
    idx = text.find('rules_version')
    print(text[idx:idx+300])
else:
    print("Not on rules page. Content:")
    print(text[:1000])

ws.close()
