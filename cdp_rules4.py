import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    u = t.get('url','')
    if 'firebase' in u and 'project/hermes-idleviber' in u:
        ws_url = t['webSocketDebuggerUrl']
        break
else:
    print("Tab not found")
    exit(1)

ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# First, try to find and click the code editor
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            // Find the code editor element - usually a textarea or div with role="textbox"
            const editors = document.querySelectorAll('.monaco-editor, .CodeMirror, div[role=\"textbox\"], textarea');
            for (const ed of editors) {
                const rect = ed.getBoundingClientRect();
                if (rect.width > 100 && rect.height > 50) {
                    return JSON.stringify({x: rect.left+20, y: rect.top+20, tag: ed.tagName, cls: ed.className.substring(0,50)});
                }
            }
            // Try clicking the code area directly
            const codeLines = document.querySelectorAll('.view-line, .editor-container, .fire-rules-editor');
            for (const el of codeLines) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 100) {
                    return JSON.stringify({x: rect.left+50, y: rect.top+30, tag: el.tagName, cls: el.className.substring(0,50)});
                }
            }
            // Try the whole rules content area
            const rulesContent = document.querySelector('[aria-label=\"Rules editor\"], .rules-editor, .firebase-rules-editor');
            if (rulesContent) {
                const rect = rulesContent.getBoundingClientRect();
                return JSON.stringify({x: rect.left+50, y: rect.top+30, tag: 'content'});
            }
            return JSON.stringify({found: false});
        })()
    """,
    "returnByValue": True
})
res = result.get('result',{}).get('result',{}).get('value','{}')
data = json.loads(res)
print("Editor:", json.dumps(data))

if 'x' in data and not data.get('found') == False:
    x, y = data['x'], data['y']
    cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":x,"y":y,"button":"left","clickCount":1})
    cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":x,"y":y,"button":"left","clickCount":1})
    print(f"Clicked editor at ({x:.0f}, {y:.0f})")
    time.sleep(2)
    
    # Select all (Ctrl+A)
    cdp("Input.dispatchKeyEvent", {"type":"keyDown", "key":"Control", "windowsKey":true, "code":"ControlLeft"})
    cdp("Input.dispatchKeyEvent", {"type":"keyDown", "key":"a", "code":"KeyA"})
    cdp("Input.dispatchKeyEvent", {"type":"keyUp", "key":"a", "code":"KeyA"})
    cdp("Input.dispatchKeyEvent", {"type":"keyUp", "key":"Control", "windowsKey":false, "code":"ControlLeft"})
    print("Selected all")
    time.sleep(1)
    
    # Delete all content
    cdp("Input.dispatchKeyEvent", {"type":"keyDown", "key":"Delete"})
    cdp("Input.dispatchKeyEvent", {"type":"keyUp", "key":"Delete"})
    print("Deleted")
    time.sleep(1)
    
    # Type the new rules line by line
    rules = """rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /saves/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /display_names/{docId} {
      allow read: if true;
      allow write: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}"""
    
    for ch in rules:
        cdp("Input.dispatchKeyEvent", {"type":"rawKeyDown", "key":ch, "text":ch})
        cdp("Input.dispatchKeyEvent", {"type":"keyUp", "key":ch})
        time.sleep(0.005)
    print("Typed new rules")
    time.sleep(2)
    
    # Find and click Publish button
    result = cdp("Runtime.evaluate", {
        "expression": """
            (() => {
                const btns = document.querySelectorAll('button, a, span[role=\"button\"]');
                for (const btn of btns) {
                    if (btn.textContent.trim() === 'Publish' && btn.offsetParent !== null) {
                        const rect = btn.getBoundingClientRect();
                        return JSON.stringify({x: rect.left+rect.width/2, y: rect.top+rect.height/2});
                    }
                }
                return JSON.stringify({found: false});
            })()
        """,
        "returnByValue": True
    })
    res2 = result.get('result',{}).get('result',{}).get('value','{}')
    data2 = json.loads(res2)
    print("Publish button:", json.dumps(data2))
    
    if 'x' in data2:
        x, y = data2['x'], data2['y']
        cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":x,"y":y,"button":"left","clickCount":1})
        cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":x,"y":y,"button":"left","clickCount":1})
        print(f"Clicked Publish at ({x:.0f}, {y:.0f})")
        time.sleep(3)
        
        # Verify by reading back the page
        result = cdp("Runtime.evaluate", {
            "expression": "document.body.innerText.substring(0, 1000)",
            "returnByValue": True
        })
        text = result.get('result',{}).get('result',{}).get('value','')
        if 'leaderboard' in text:
            print("SUCCESS: Rules deployed!")
        print("Page text:")
        print(text[text.find('rules_version'):text.find('rules_version')+500] if 'rules_version' in text else text[:500])

ws.close()
