import json, urllib.request, websocket, time

# Get existing first tab
tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
# Find the Firebase tab
fb_tab = None
for t in tabs:
    url = t.get('url', '')
    if 'firebase' in url and 'authentication' in url:
        fb_tab = t
        break
if not fb_tab:
    print("Firebase tab not found!")
    exit(1)

ws_url = fb_tab['webSocketDebuggerUrl']
ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Scroll down to find authorized domains section
result = cdp("Runtime.evaluate", {
    "expression": "window.scrollTo(0, document.body.scrollHeight); 'scrolled';",
    "returnByValue": True
})
time.sleep(2)

# Check the full page content for authorized domains
result = cdp("Runtime.evaluate", {
    "expression": "document.body.innerText",
    "returnByValue": True
})
text = result.get('result',{}).get('result',{}).get('value','')
# Find the authorized domains section
idx = text.find('Authorized domains')
if idx >= 0:
    print("Found 'Authorized domains' at position", idx)
    print(text[idx:idx+500])
else:
    print("'Authorized domains' not found in text")

# Try to find and click the "Add domain" button
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Look for buttons/links containing "Add domain"
            const all = document.querySelectorAll('button, a, span, div[role="button"]');
            for (const el of all) {
                if (el.textContent.includes('Add domain') || el.textContent.includes('add domain')) {
                    return 'FOUND: ' + el.tagName + ' class=' + (el.className || '') + ' text=' + el.textContent.trim();
                }
            }
            return 'NOT FOUND';
        })()
    """,
    "returnByValue": True
})
print("Button search:", result.get('result',{}).get('result',{}).get('value',''))

# Also get the HTML around authorized domains
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Find text node containing "Authorized domains" and get parent
            const walker = document.createTreeWalker(document.body, 4, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes('Authorized domains')) {
                    const parent = node.parentElement;
                    return parent.outerHTML.substring(0, 2000);
                }
            }
            return 'not found in DOM';
        })()
    """,
    "returnByValue": True
})
html = result.get('result',{}).get('result',{}).get('value','')
print("HTML around 'Authorized domains':")
print(html[:1500])

ws.close()
