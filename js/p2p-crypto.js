     1|// ============================================================
     2|// ECDSA-signed JSON packets over WebRTC data channel, Firestore signaling
     3|// Star topology: single host (DrGekoz) relays scores to all peers
     4|// ============================================================
     5|
     6|// ---- ECDSA P-256 key (fresh per page load) ----
     7|async function loadOrGenKeys() {
     8|    return await crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify']);
     9|}
    10|async function keyId(pub) {
    11|    const s = await crypto.subtle.exportKey('spki', pub);
    12|    return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/[+/=]/g, '').substring(0, 16);
    13|}
    14|
    15|// ---- JSON packet helpers ----
    16|function _arrBufToB64(buf) {
    17|    const b = new Uint8Array(buf);
    18|    let bin = '';
    19|    for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    20|    return btoa(bin);
    21|}
    22|function _b64ToArrBuf(b64) {
    23|    const bin = atob(b64);
    24|    const b = new Uint8Array(bin.length);
    25|    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    26|    return b.buffer;
    27|}
    28|
    29|// ---- Sign and verify JSON messages ----
    30|async function signPayload(payload, priv) {
    31|    const str = JSON.stringify(payload);
    32|    const sig = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, priv, new TextEncoder().encode(str));
    33|    return JSON.stringify({ d: payload, s: _arrBufToB64(sig) });
    34|}
    35|async function verifyMsg(jsonStr, pub) {
    36|    let msg;
    37|    try { msg = JSON.parse(jsonStr); } catch (_) { return null; }
    38|    if (!msg || !msg.d || !msg.s) return null;
    39|    const sig = _b64ToArrBuf(msg.s);
    40|    const payloadStr = JSON.stringify(msg.d);
    41|    const ok = await crypto.subtle.verify({ name:'ECDSA', hash:'SHA-256' }, pub, sig, new TextEncoder().encode(payloadStr));
    42|    return ok ? msg.d : null;
    43|}
    44|
    45|// ---- In-memory sorted ledger ----
    46|class Ledger {
    47|    constructor() { this.m = new Map(); }
    48|    set(k,v) { this.m.set(k,v); }
    49|    del(k) { this.m.delete(k); }
    50|    sorted() { return [...this.m.values()].sort((a,b)=>{
    51|        const sa = Array.isArray(a.score) ? a.score[0]*Math.pow(10,a.score[1]) : a.score;
    52|        const sb = Array.isArray(b.score) ? b.score[0]*Math.pow(10,b.score[1]) : b.score;
    53|        return sb - sa;
    54|    }); }
    55|}
    56|
    57|// ---- Star-topology host detection ----
    58|// DrGekoz is ALWAYS the host when online; otherwise alphabetically first
    59|const DEV_HOST = 'DrGekoz';
    60|
    61|// ============================================================
    62|class P2PLeaderboardManager {
    63|    constructor(firestore, username, onUpdate, syncFn) {
    64|        this.fs = firestore; this.username = username; this.onUpdate = onUpdate;
    65|        this.syncFn = syncFn; this.ledger = new Ledger();
    66|        this.peers = new Map(); this.kp = null; this.kid = null;
    67|        this.seq = 0; this._uploadTimer = null; this._pingTimer = null; this._reconnectTimer = null; this._signalTimer = null;
    68|        this._nonce = Math.floor(Math.random() * 2147483647);
    69|        this._retryPending = null; this._connecting = new Set();
    70|        this._onlineUsernames = new Set();
    71|        this._isHost = false;
    72|        this._lastLeaderboardHash = '';
    73|        this._myScore = 0; this._myPrestige = 0; this._myVps = 0; this._myPp = 0; this._myTierIcon = 0;
    74|    }
    75|
    76|    async init() {
    77|        this.kp = await loadOrGenKeys();
    78|        this.kid = await keyId(this.kp.publicKey);
    79|        console.log('🔑 P2P keyId:', this.kid, 'nonce:', this._nonce, '(fresh)');
    80|    }
    81|
    82|    // ---- Host detection ----
    83|    _computeHost(onlineSet) {
    84|        if (!onlineSet) return null;
    85|        // Always include self so DEV_HOST detection works
    86|        const all = new Set(onlineSet);
    87|        all.add(this.username);
    88|        if (all.size === 0) return null;
    89|        if (all.has(DEV_HOST)) return DEV_HOST;
    90|        return [...all].sort()[0];
    91|    }
    92|
    93|    _amHost() { return this._isHost; }
    94|
    95|    join() {
    96|        const { db, doc, setDoc, collection, onSnapshot, deleteDoc, Timestamp } = this.fs;
    97|        if (!db || !doc || !setDoc) { console.warn('🌀 P2P join missing Firestore API'); return; }
    98|        console.log('[P2P] Joining star network as', this.username);
    99|        const myRef = doc(db, 'sig', this.username.replace(/[.#$\/\[\]]/g, '_'));
   100|        crypto.subtle.exportKey('jwk', this.kp.publicKey).then(jwk => {
   101|            setDoc(myRef, { u: this.username, k: jwk, kid: this.kid, nonce: this._nonce, on: 1, ts: Timestamp.now() }, { merge: true });
   102|        });
   103|        window.addEventListener('beforeunload', () => { deleteDoc(myRef).catch(() => {}); });
   104|
   105|        // ---- Track all online peers and detect host changes ----
   106|        const peersRef = collection(db, 'sig');
   107|        this._unsubPeers = onSnapshot(peersRef, snap => {
   108|            const newOnline = new Set();
   109|            snap.docs.forEach(s => { const id = s.id; if (id !== this.username) newOnline.add(id); });
   110|            // Detect peers that went offline
   111|            for (const k of this._onlineUsernames) {
   112|                if (!newOnline.has(k)) this._onPeerGone(k);
   113|            }
   114|            this._onlineUsernames = newOnline;
   115|            const oldHost = this._computeHost(this._onlineUsernames);
   116|            const wasHost = this._isHost;
   117|            this._isHost = (this._computeHost(newOnline) === this.username);
   118|            if (!wasHost && this._isHost) {
   119|                console.log('[P2P] Elected Host = true — I am now the HOST');
   120|                // If we just became host (DrGekoz logged in), broadcast migration
   121|                this._broadcastHostMigration();
   122|            } else if (wasHost && !this._isHost) {
   123|                console.log('[P2P] Elected Host = false — host changed to:', this._computeHost(newOnline));
   124|                // Host changed (DrGekoz came online), I'm no longer host — disconnect all and reconnect to DrGekoz
   125|                this._disconnectAll();
   126|            }
   127|            // Connect to the current host (or to everyone if I'm the host)
   128|            snap.docChanges().forEach(async ch => {
   129|                const k = ch.doc.id; if (k === this.username) return;
   130|                if (ch.type === 'removed') { /* handled above */ return; }
   131|                const d = ch.doc.data(); if (!d?.k) return;
   132|                const existing = this.peers.get(k);
   133|                if (existing && (d.kid || k) !== (existing.keyId || k)) {
   134|                    console.log('🔄 P2P peer key changed for', k, '— reconnecting');
   135|                    this._onPeerGone(k);
   136|                }
   137|                if (!this.peers.has(k)) {
   138|                    if (this._connecting.has(k)) return;
   139|                    // Only connect: if I'm host (connect to everyone) OR if this peer is the host
   140|                    const host = this._computeHost(newOnline);
   141|                    const shouldConnect = this._isHost || (host === k);
   142|                    if (!shouldConnect) return; // skip — not host, not connecting to
   143|                    this._connecting.add(k);
   144|                    const pub = await crypto.subtle.importKey('jwk', d.k, { name:'ECDSA', namedCurve:'P-256' }, true, ['verify']);
   145|                    this.peers.set(k, { pc:null, ch:null, pub, name: d.u||'?', seq:0, keyId: d.kid||k, nonce: d.nonce||0 });
   146|                    this._connect(k, d.kid, d.nonce||0);
   147|                }
   148|            });
   149|        });
   150|
   151|        // ---- Offer/answer signaling ----
   152|        const mySigRef = collection(db, 'sig', this.username, 'offers');
   153|        this._unsubOffers = onSnapshot(mySigRef, snap => {
   154|            snap.docChanges().forEach(ch => {
   155|                if (ch.type === 'removed') return;
   156|                const d = ch.doc.data();
   157|                if (!d || !d.t) return;
   158|                const pk = ch.doc.id;
   159|                console.log('📨 P2P signaling doc detected:', pk, 'type:', d.t);
   160|                if (d.t === 'offer') this._onOffer(pk, d.s);
   161|                else if (d.t === 'answer') this._onAnswer(pk, d.s);
   162|            });
   163|        });
   164|        const iceRef = collection(db, 'sig', this.username, 'ice');
   165|        this._unsubIce = onSnapshot(iceRef, snap => {
   166|            snap.docChanges().forEach(ch => {
   167|                if (ch.type === 'removed') return;
   168|                const d = ch.doc.data(); const pk = ch.doc.id;
   169|                const peer = this.peers.get(pk);
   170|                if (peer?.pc && d.c) {
   171|                    peer.pc.addIceCandidate(new RTCIceCandidate(d.c)).catch(() => {});
   172|                }
   173|            });
   174|        });
   175|
   176|        this._pingTimer = setInterval(() => {
   177|            const { doc, setDoc, Timestamp } = this.fs;
   178|            setDoc(myRef, { ts: Timestamp.now(), on: 1 }, { merge: true }).catch(() => {});
   179|        }, 5000);
   180|
   181|        this._reconnectTimer = setInterval(() => {
   182|            this._rescanPeers();
   183|        }, 15000);
   184|
   185|        if (!this._signalTimer) {
   186|            this._signalTimer = setInterval(() => this._runSignaling(), 1000);
   187|        }
   188|
   189|        this._scanTimer = setInterval(() => {
   190|            if (this.peers.size === 0) this._rescanPeers();
   191|        }, 30000);
   192|
        if (!this._uploadTimer) this._uploadTimer = setInterval(() => this._uploadIfElected(), 900000);

        // Log initial host status
        setTimeout(() => console.log('[P2P] Elected Host =', this._isHost, '—', this._isHost ? 'I am the HOST' : 'Host is', this._computeHost(this._onlineUsernames)), 500);
    }
   195|
   196|    // Disconnect all peers (used on host migration)
   197|    _disconnectAll() {
   198|        console.log('[P2P] Elected Host = false — disconnecting for host migration');
   199|        for (const [k] of this.peers) this._onPeerGone(k);
   200|        this._connecting.clear();
   201|    }
   202|
   203|    // Broadcast host migration message to all connected peers
   204|    _broadcastHostMigration() {
   205|        const host = this._computeHost(this._onlineUsernames);
   206|        if (!host) return;
   207|        console.log('[P2P] Broadcasting host migration to:', host);
   208|        const payload = { type: 'host_migrate', host, ts: Math.floor(Date.now()/1000) };
   209|        // Sign and send to all connected peers
   210|        signPayload(payload, this.kp.privateKey).then(msg => {
   211|            for (const [, peer] of this.peers) {
   212|                if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
   213|            }
   214|        });
   215|    }
   216|
   217|    async _connect(pk, peerKid, peerNonce) {
   218|        // In star topology, the host ALWAYS makes the offer
   219|        const iAmOfferer = this._amHost();
   220|        console.log('[P2P] Connecting to peer:', pk, '| Host is offerer:', iAmOfferer);
   221|
   222|        const pc = new RTCPeerConnection({ iceServers: [{ urls:'stun:stun.l.google.com:19302' }] });
   223|        const p = this.peers.get(pk); p.pc = pc;
   224|
   225|        pc.onicecandidate = e => {
   226|            if (!e.candidate) return;
   227|            const { doc, setDoc, deleteDoc } = this.fs;
   228|            deleteDoc(doc(this.fs.db, 'sig', pk, 'ice', this.username)).catch(() => {});
   229|            setDoc(doc(this.fs.db, 'sig', pk, 'ice', this.username), { c: e.candidate.toJSON() }).catch(() => {});
   230|        };
   231|        pc.ondatachannel = e => {
   232|            console.log('📥 P2P inbound channel from', pk);
   233|            p.ch = e.channel;
   234|            e.channel.onopen = () => console.log('[P2P] Channel open — guest:', pk);
   235|            e.channel.onclose = () => console.log('🔌 P2P channel closed', pk);
   236|            e.channel.onmessage = ev => { this._onMsg(pk, ev.data); };
   237|            if (e.channel.readyState === 'open') {
   238|                console.log('[P2P] Channel already open — guest:', pk);
   239|            }
   240|        };
   241|
   242|        if (iAmOfferer) {
   243|            const ch = pc.createDataChannel('l', { ordered:false, maxRetransmits:0 });
   244|            p.ch = ch;
   245|            ch.onopen = () => console.log('[P2P] Channel open — host → guest:', pk);
   246|            ch.onclose = () => console.log('🔌 P2P channel closed', pk);
   247|            ch.onmessage = ev => { this._onMsg(pk, ev.data); };
   248|            if (ch.readyState === 'open') console.log('[P2P] Channel already open — host → guest:', pk);
   249|            const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
   250|            const { doc, setDoc, deleteDoc } = this.fs;
   251|            console.log('[P2P] Host sending offer to', pk);
   252|            await deleteDoc(doc(this.fs.db, 'sig', pk, 'offers', this.username)).catch(() => {});
   253|            await setDoc(doc(this.fs.db, 'sig', pk, 'offers', this.username), { t:'offer', s: pc.localDescription.toJSON() });
   254|        }
   255|        const check = () => {
   256|            if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') return;
   257|            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
   258|                console.log('🔄 P2P connection failed, retry in 2s');
   259|                pc.close();
   260|                setTimeout(() => {
   261|                    this._onPeerGone(pk);
   262|                    const { doc:fdoc, getDoc } = this.fs;
   263|                    getDoc(fdoc(this.fs.db, 'sig', pk)).then(snap => {
   264|                        if (!snap.exists()) return;
   265|                        const d = snap.data();
   266|                        crypto.subtle.importKey('jwk', d.k, { name:'ECDSA', namedCurve:'P-256' }, true, ['verify']).then(pub => {
   267|                            this.peers.set(pk, { pc:null, ch:null, pub, name: d.u||'?', seq:0, keyId: d.kid||pk, nonce: d.nonce||0 });
   268|                            this._connect(pk, d.kid, d.nonce||0);
   269|                        });
   270|                    }).catch(() => {});
   271|                }, 2000);
   272|            }
   273|        };
   274|        pc.onconnectionstatechange = check;
   275|        setTimeout(check, 10000);
   276|    }
   277|
   278|    async _onOffer(pk, sdp) {
   279|        const p = this.peers.get(pk);
   280|        if (!p) { console.log('🧹 _onOffer stale, delete:', pk); this._cleanSigDoc(pk).catch(()=>{}); return; }
   281|        if (!p.pc) {
   282|            setTimeout(() => this._onOffer(pk, sdp), 200); return;
   283|        }
   284|        if (p.pc.signalingState !== 'stable') {
   285|            if (p.pc.connectionState === 'connected' || p.pc.connectionState === 'connecting') return;
   286|            setTimeout(() => this._onOffer(pk, sdp), 200); return;
   287|        }
   288|        console.log('📩 P2P offer from', pk);
   289|        try {
   290|            await p.pc.setRemoteDescription(new RTCSessionDescription(sdp));
   291|            const ans = await p.pc.createAnswer(); await p.pc.setLocalDescription(ans);
   292|            const { doc, setDoc, deleteDoc } = this.fs;
   293|            await deleteDoc(doc(this.fs.db, 'sig', pk, 'offers', this.username)).catch(() => {});
   294|            await deleteDoc(doc(this.fs.db, 'sig', this.username, 'offers', pk)).catch(() => {});
   295|            await setDoc(doc(this.fs.db, 'sig', pk, 'offers', this.username), { t:'answer', s: p.pc.localDescription.toJSON() });
   296|            console.log('📤 P2P answer sent to', pk);
   297|        } catch (e) { console.warn('❌ _onOffer err:', e); }
   298|    }
   299|
   300|    async _onAnswer(pk, sdp) {
   301|        const p = this.peers.get(pk);
   302|        if (!p) { console.log('🧹 _onAnswer stale, delete:', pk); this._cleanSigDoc(pk).catch(()=>{}); return; }
   303|        if (!p.pc || p.pc.signalingState !== 'have-local-offer') {
   304|            if (p.pc && (p.pc.connectionState === 'connected' || p.pc.connectionState === 'connecting')) return;
   305|            setTimeout(() => this._onAnswer(pk, sdp), 200); return;
   306|        }
   307|        console.log('📩 P2P answer from', pk);
   308|        try {
   309|            await p.pc.setRemoteDescription(new RTCSessionDescription(sdp));
   310|            console.log('✅ P2P connected with', pk);
   311|            // If I'm the host and just connected to a guest, send current leaderboard immediately
   312|            if (this._amHost()) {
   313|                setTimeout(() => this._hostSendLeaderboard(), 500);
   314|            }
   315|        } catch (e) { console.warn('❌ _onAnswer err:', e); }
   316|    }
   317|
   318|    _cleanSigDoc(pk) {
   319|        const { doc, deleteDoc } = this.fs;
   320|        return deleteDoc(doc(this.fs.db, 'sig', this.username, 'offers', pk)).catch(() => {});
   321|    }
   322|
   323|    // ---- Message routing ----
   324|    async _onMsg(pk, data) {
   325|        const p = this.peers.get(pk); if (!p) { console.warn('📩 _onMsg unknown:', pk); return; }
   326|        const payload = await verifyMsg(data, p.pub);
   327|        if (!payload) { console.warn('❌ _onMsg verify fail', pk, 'data:', data); return; }
   328|
   329|        // Chat message — host relays to everyone, guest just displays
   330|        if (payload.type === 'chat') {
   331|            if (window._onChatMessage) window._onChatMessage(payload.user || pk, payload.text || '');
   332|            // Host relays guest chat to all other connected peers
   333|            if (this._amHost() && payload.user && payload.user !== this.username) {
   334|                this._relayChat(payload);
   335|            }
   336|            return;
   337|        }
   338|
   339|        // Host migration — this peer told us to switch to a new host
   340|        if (payload.type === 'host_migrate') {
   341|            console.log('👑 P2P host migration to:', payload.host);
   342|            if (payload.host !== this.username) {
   343|                // I'm not the new host, disconnect everything and reconnect to new host
   344|                this._disconnectAll();
   345|            }
   346|            return;
   347|        }
   348|
   349|        // ---- GUEST → HOST: score update ----
   350|        if (payload.type === 'score') {
   351|            // Host receives score update from a guest
   352|            if (!this._amHost()) {
   353|                // Non-host receiving a score update — ignore (relay only)
   354|                return;
   355|            }
   356|            const guestName = payload.user || pk;
   357|            this.ledger.set(guestName, { username:guestName, score:payload.s, prestige:payload.pr, vps:payload.v, pp:payload.p, tierIcon:payload.ti });
   358|            this.ledger.set('self', { username:this.username, score:this._myScore, prestige:this._myPrestige, vps:this._myVps, pp:this._myPp, tierIcon:this._myTierIcon });
   359|            this.onUpdate(this.ledger.sorted());
   360|            // Relay full leaderboard to all guests
   361|            this._hostSendLeaderboard();
   362|            return;
   363|        }
   364|
   365|        // ---- HOST → GUEST: full leaderboard sync ----
   366|        if (payload.type === 'leaderboard') {
   367|            if (this._amHost()) return; // host doesn't consume its own leaderboard
   368|            // Guest receives authoritative leaderboard from host
   369|            const entries = payload.entries || [];
   370|            for (const e of entries) {
   371|                this.ledger.set(e.user, { username:e.user, score:e.s, prestige:e.pr, vps:e.v, pp:e.p, tierIcon:e.ti });
   372|            }
   373|            this.ledger.set('self', { username:this.username, score:this._myScore, prestige:this._myPrestige, vps:this._myVps, pp:this._myPp, tierIcon:this._myTierIcon });
   374|            this.onUpdate(this.ledger.sorted());
   375|            return;
   376|        }
   377|    }
   378|
   379|    // Host sends full sorted leaderboard to all connected guests
   380|    _hostSendLeaderboard() {
   381|        const entries = this.ledger.sorted().map(e => ({
   382|            user: e.username, s: e.score, pr: e.prestige, v: e.vps, p: e.pp, ti: e.tierIcon
   383|        }));
   384|        const hash = JSON.stringify(entries);
   385|        if (hash === this._lastLeaderboardHash) return; // skip if no change
   386|        this._lastLeaderboardHash = hash;
   387|        const payload = { type: 'leaderboard', entries, ts: Math.floor(Date.now()/1000) };
   388|        signPayload(payload, this.kp.privateKey).then(msg => {
   389|            for (const [, peer] of this.peers) {
   390|                if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
   391|            }
   392|        });
   393|    }
   394|
   395|    _onPeerGone(pk) {
   396|        const p = this.peers.get(pk);
   397|        if (p) {
   398|            console.log('🔌 P2P peer left:', pk);
   399|            try { p.ch?.close(); } catch (_) {} try { p.pc?.close(); } catch (_) {}
   400|        }
   401|        this.peers.delete(pk); this.ledger.del(pk); this._connecting.delete(pk);
   402|        // If host, remove from ledger and rebroadcast
   403|        if (this._amHost()) {
   404|            this.onUpdate(this.ledger.sorted());
   405|            setTimeout(() => this._hostSendLeaderboard(), 100);
   406|        }
   407|    }
   408|
   409|    // ---- GUEST: send score to host; HOST: store locally and broadcast to all ----
   410|    async broadcast(score, prestige, vps, pp, ts, tierIcon) {
   411|        // Store locally
   412|        this._myScore = score;
   413|        this._myPrestige = prestige;
   414|        this._myVps = vps;
   415|        this._myPp = pp;
   416|        this._myTierIcon = tierIcon || 0;
   417|        this.ledger.set('self', { username:this.username, score, prestige, vps, pp, tierIcon: tierIcon || 0 });
   418|
   419|        if (this._amHost()) {
   420|            // Host: update own score and rebroadcast leaderboard to all guests
   421|            this.onUpdate(this.ledger.sorted());
   422|            this._hostSendLeaderboard();
   423|        } else {
   424|            // Guest: send score update to host only
   425|            const payload = { type: 'score', user: this.username, s: score, pr: prestige, v: vps, p: pp, ti: tierIcon || 0, ts: ts || Math.floor(Date.now()/1000) };
   426|            const msg = await signPayload(payload, this.kp.privateKey);
   427|            let sent = 0;
   428|            for (const [, peer] of this.peers) {
   429|                if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); sent++; } catch (_) {}
   430|            }
   431|            if (sent === 0 && !this._retryPending) {
   432|                this._retryPending = setTimeout(() => {
   433|                    this._retryPending = null;
   434|                    for (const [, peer] of this.peers) {
   435|                        if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
   436|                    }
   437|                }, 1500);
   438|            }
   439|        }
   440|    }
   441|
   442|    // Broadcast a chat message — guests send to host, host relays to all
   443|    async broadcastChat(text) {
   444|        const payload = { type: 'chat', text, user: this.username, ts: Math.floor(Date.now()/1000) };
   445|        const msg = await signPayload(payload, this.kp.privateKey);
   446|        for (const [, peer] of this.peers) {
   447|            if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
   448|        }
   449|    }
   450|
   451|    // Host re-signs and relays a guest's chat to all OTHER connected peers (skip sender)
   452|    _relayChat(original) {
   453|        const relayPayload = { type: 'chat', text: original.text, user: original.user, ts: Math.floor(Date.now()/1000) };
   454|        signPayload(relayPayload, this.kp.privateKey).then(msg => {
   455|            for (const [k, peer] of this.peers) {
   456|                if (k === original.user) continue; // skip original sender
   457|                if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
   458|            }
   459|        });
   460|    }
   461|
   462|    // ---- Signaling retry — 1-second heartbeat ----
   463|    async _runSignaling() {
   464|        const { db, getDocs, collection, doc:fdoc, getDoc } = this.fs;
   465|        if (!db || !getDocs) return;
   466|        try {
   467|            const snap = await getDocs(collection(db, 'sig'));
   468|            const onlinePeers = [];
   469|            for (const s of snap.docs) {
   470|                const k = s.id;
   471|                if (k === this.username) continue;
   472|                const d = s.data();
   473|                if (!d?.k || !d?.on) continue;
   474|                onlinePeers.push({ id: k, data: d });
   475|            }
   476|            // Recompute host status
   477|            const newOnline = new Set(onlinePeers.map(p => p.id));
   478|            this._onlineUsernames = newOnline;
   479|            const wasHost = this._isHost;
   480|            this._isHost = (this._computeHost(newOnline) === this.username);
   481|            if (!wasHost && this._isHost) {
   482|                console.log('[P2P] Elected Host = true (signaling retry)');
   483|                this._broadcastHostMigration();
   484|            } else if (wasHost && !this._isHost) {
   485|                console.log('[P2P] Elected Host = false (signaling retry) — reconnecting');
   486|                this._disconnectAll();
   487|                return;
   488|            }
   489|
   490|            const host = this._computeHost(newOnline);
   491|            for (const { id: k, data: d } of onlinePeers) {
   492|                // Skip: only connect to host (if I'm not host) OR to everyone (if I am host)
   493|                if (!this._isHost && host !== k) continue;
   494|
   495|                let p = this.peers.get(k);
   496|                if (!p) {
   497|                    this._initPeer(k, d);
   498|                    continue;
   499|                }
   500|                if (p.ch?.readyState === 'open') continue;
   501|