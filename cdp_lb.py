import json, urllib.request, websocket, time

# Open game page
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

time.sleep(8)

# Click guest to enter game
cdp("Runtime.evaluate", {
    "expression": "var btn = document.getElementById('guest-btn'); if(btn) { btn.click(); 'clicked'; } else { 'no btn'; }",
    "returnByValue": True
})
time.sleep(5)

# Check the leaderboard panel content
result = cdp("Runtime.evaluate", {
    "expression": "var lb = document.getElementById('leaderboard-list'); lb ? lb.innerText.substring(0, 500) : 'no leaderboard'",
    "returnByValue": True
})
lb_text = result.get('result',{}).get('result',{}).get('value','')
print("Leaderboard content:")
print(lb_text)

# Also check if the leaderboard has entries
result = cdp("Runtime.evaluate", {
    "expression": "var lb = document.getElementById('leaderboard-list'); lb ? lb.querySelectorAll('.lb-entry').length : 0",
    "returnByValue": True
})
count = result.get('result',{}).get('result',{}).get('value',0)
print(f"Leaderboard entries: {count}")

# Check console for Firebase logs
result = cdp("Runtime.evaluate", {
    "expression": "typeof G !== 'undefined' ? 'prestige_points=' + G.prestige_points : 'G not loaded'",
    "returnByValue": True
})
print(result.get('result',{}).get('result',{}).get('value',''))

ws.close()
