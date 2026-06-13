import json, urllib.request, websocket, time

# Find the Firebase tab
tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
for t in tabs:
    u = t.get('url','')
    if 'firebase' in u and '/firestore' in u:
        ws_url = t['webSocketDebuggerUrl']
        break
else:
    print("Rules tab not found")
    exit(1)

ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
msg_id = 0
def cdp(method, params=None):
    global msg_id
    if params is None: params = {}
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
    return json.loads(ws.recv())

# Focus the textarea
result = cdp("Runtime.evaluate", {
    "expression": """
        (() => {
            const tas = document.querySelectorAll('textarea');
            for (const ta of tas) {
                if (ta.offsetParent !== null) {
                    ta.focus();
                    ta.select();
                    const r = ta.getBoundingClientRect();
                    return JSON.stringify({x: r.left+r.width/2, y: r.top+r.height/2, val: ta.value.substring(0,50)});
                }
            }
            return 'NF';
        })()
    """,
    "returnByValue": True
})
res = json.loads(result.get('result',{}).get('result',{}).get('value','""'))
print("Textarea:", str(res)[:80])

# Click on the textarea
if 'x' in res:
    cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":res['x'],"y":res['y'],"button":"left","clickCount":3})
    cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":res['x'],"y":res['y'],"button":"left","clickCount":3})
    time.sleep(1)
    
    # Ctrl+A to select all
    cdp("Input.dispatchKeyEvent", {"type":"rawKeyDown","key":"Control","windowsKey":True,"code":"ControlLeft"})
    cdp("Input.dispatchKeyEvent", {"type":"rawKeyDown","key":"a","code":"KeyA"})
    cdp("Input.dispatchKeyEvent", {"type":"keyUp","key":"a","code":"KeyA"})
    cdp("Input.dispatchKeyEvent", {"type":"keyUp","key":"Control","windowsKey":False,"code":"ControlLeft"})
    time.sleep(0.5)
    
    # Delete
    cdp("Input.dispatchKeyEvent", {"type":"rawKeyDown","key":"Delete"})
    cdp("Input.dispatchKeyEvent", {"type":"keyUp","key":"Delete"})
    time.sleep(0.5)
    
    # Type the new rules line by line using insertText
    rules_lines = [
        "rules_version = '2';",
        "service cloud.firestore {",
        "  match /databases/{database}/documents {",
        "    match /leaderboard/{userId} {",
        "      allow read: if true;",
        "      allow write: if request.auth != null && request.auth.uid == userId;",
        "    }",
        "    match /saves/{userId} {",
        "      allow read, write: if request.auth != null && request.auth.uid == userId;",
        "    }",
        "    match /display_names/{docId} {",
        "      allow read: if true;",
        "      allow write: if request.auth != null && request.resource.data.uid == request.auth.uid;",
        "    }",
        "    match /{document=**} {",
        "      allow read, write: if false;",
        "    }",
        "  }",
        "}"
    ]
    
    for line in rules_lines:
        cdp("Input.dispatchKeyEvent", {"type":"rawKeyDown","key":line,"text":line})
        time.sleep(0.02)
        # Press Enter
        cdp("Input.dispatchKeyEvent", {"type":"rawKeyDown","key":"Enter","text":"\r"})
        cdp("Input.dispatchKeyEvent", {"type":"keyUp","key":"Enter"})
        time.sleep(0.05)
    
    print("Typed new rules")
    time.sleep(2)
    
    # Find and click Publish
    result = cdp("Runtime.evaluate", {
        "expression": """
            (() => {
                const btns = document.querySelectorAll('button');
                for (const b of btns) {
                    if (b.textContent.trim() === 'Publish' && b.offsetParent) {
                        const r = b.getBoundingClientRect();
                        return JSON.stringify({x: r.left+r.width/2, y: r.top+r.height/2});
                    }
                }
                return 'NF';
            })()
        """,
        "returnByValue": True
    })
    pub = json.loads(result.get('result',{}).get('result',{}).get('value','""'))
    print("Publish btn:", str(pub)[:50])
    
    if 'x' in pub:
        cdp("Input.dispatchMouseEvent", {"type":"mousePressed","x":pub['x'],"y":pub['y'],"button":"left","clickCount":1})
        cdp("Input.dispatchMouseEvent", {"type":"mouseReleased","x":pub['x'],"y":pub['y'],"button":"left","clickCount":1})
        print("Clicked Publish!")
        time.sleep(3)
        
        # Verify
        result = cdp("Runtime.evaluate", {
            "expression": "document.body.innerText.substring(0, 1000)",
            "returnByValue": True
        })
        text = result.get('result',{}).get('result',{}).get('value','')
        if 'leaderboard' in text and 'display_names' in text:
            print("SUCCESS: Rules deployed!")
        else:
            print("Checking...")
            # Look for success message
            if 'Published' in text or 'saved' in text.lower():
                print("Rules published successfully!")
            print(text[text.find('rules_version'):text.find('rules_version')+350] if 'rules_version' in text else text[:400])

ws.close()
