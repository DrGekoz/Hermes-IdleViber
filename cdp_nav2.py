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

# Step 1: Click Firestore in nav
cdp("Runtime.evaluate", {"expression":"""
var el = document.querySelector('[aria-label=\"Firestore\"]') || 
  Array.from(document.querySelectorAll('span, a, div')).find(e => e.textContent.trim()==='Firestore' && e.offsetParent);
if(el){var r=el.getBoundingClientRect(); JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2})}else 'NOTFOUND'
""","returnByValue":True})
time.sleep(6)

# Look for Rules tab
result = cdp("Runtime.evaluate", {"expression":"document.querySelectorAll('a,button,div[role=tab]').length + ' elements'","returnByValue":True})
print("Elements:", result.get('result',{}).get('result',{}).get('value',''))

# Click Firestore via direct gmp selector
cdp("Runtime.evaluate", {"expression":"""
var el = document.querySelector('[data-fire-style=\"firestore\"]') ||
  document.querySelector('a[href*=\"firestore\"]') ||
  document.evaluate('//span[text()=\"Firestore\"]',document,null,9).singleNodeValue;
if(el){var r=el.getBoundingClientRect();JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2})}else'NOTFOUND'
""","returnByValue":True})
time.sleep(6)

result = cdp("Runtime.evaluate", {"expression":"document.title + ' | ' + document.querySelectorAll('.view-line').length + ' lines'","returnByValue":True})
print("Result:", result.get('result',{}).get('result',{}).get('value',''))

ws.close()
