import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())

# Navigate to the deployed game
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

time.sleep(6)

# Check the browser console logs
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Check if Firebase loaded
            const scripts = document.querySelectorAll('script');
            let fbLoaded = false;
            for (const s of scripts) {
                if (s.src && s.src.includes('firebase')) {
                    fbLoaded = true;
                }
            }
            return JSON.stringify({
                title: document.title,
                url: window.location.href,
                firebaseScripts: fbLoaded,
                bodyText: (document.body ? document.body.innerText.substring(0, 1000) : 'no body')
            });
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
print("Page state:", res)

# Try to trigger a login to see the error
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Find the guest button and click it to test
            const guestBtn = document.getElementById('guest-btn');
            if (guestBtn) {
                guestBtn.click();
                return 'clicked guest';
            }
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
                if (b.textContent.includes('GUEST')) {
                    b.click();
                    return 'clicked guest via text';
                }
            }
            return 'guest button not found';
        })()
    """,
    "returnByValue": True
})
res2 = result.get('result',{}).get('result',{}).get('value','')
print("Guest click:", res2)

time.sleep(3)

# Now check for console errors
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Check if any Firebase or error messages on the page
            const body = document.body ? document.body.innerText : '';
            const lines = body.split('\\n').filter(l => l.includes('Error') || l.includes('error') || l.includes('Firebase') || l.includes('auth'));
            return lines.join('\\n').substring(0, 2000);
        })()
    """,
    "returnByValue": True
})
res3 = result.get('result',{}).get('result',{}).get('value','')
print("Error messages:")
print(res3)

ws.close()
