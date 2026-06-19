// ============================================================
// ECDSA-signed JSON packets over WebRTC data channel, Firestore signaling
// ============================================================

// ---- ECDSA P-256 key (fresh per page load) ----
async function loadOrGenKeys() {
    return await crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify']);
}
async function keyId(pub) {
    const s = await crypto.subtle.exportKey('spki', pub);
    return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/[+/=]/g, '').substring(0, 16);
}

// ---- JSON packet helpers ----
function _arrBufToB64(buf) {
    const b = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return btoa(bin);
}
function _b64ToArrBuf(b64) {
    const bin = atob(b64);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b.buffer;
}

// ---- Sign and verify JSON messages ----
async function signPayload(payload, priv) {
    const str = JSON.stringify(payload);
    const sig = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, priv, new TextEncoder().encode(str));
    return JSON.stringify({ d: payload, s: _arrBufToB64(sig) });
}
async function verifyMsg(jsonStr, pub) {
    let msg;
    try { msg = JSON.parse(jsonStr); } catch (_) { return null; }
    if (!msg || !msg.d || !msg.s) return null;
    const sig = _b64ToArrBuf(msg.s);
    const payloadStr = JSON.stringify(msg.d);
    const ok = await crypto.subtle.verify({ name:'ECDSA', hash:'SHA-256' }, pub, sig, new TextEncoder().encode(payloadStr));
    return ok ? msg.d : null;
}

// ---- In-memory sorted ledger ----
class Ledger {
    constructor() { this.m = new Map(); }
    set(k,v) { this.m.set(k,v); }
    del(k) { this.m.delete(k); }
    sorted() { return [...this.m.values()].sort((a,b)=>{
        const sa = Array.isArray(a.score) ? a.score[0]*Math.pow(10,a.score[1]) : a.score;
        const sb = Array.isArray(b.score) ? b.score[0]*Math.pow(10,b.score[1]) : b.score;
        return sb - sa;
    }); }
}

// ---- Determine offerer ----
function decideOfferer(myKid, myNonce, peerKid, peerNonce, myUser, peerUser) {
    if (myKid !== peerKid) return myKid < peerKid;
    if (myNonce !== peerNonce) return myNonce < peerNonce;
    return myUser < peerUser;
}

// ============================================================
class P2PLeaderboardManager {
    constructor(firestore, username, onUpdate, syncFn) {
        this.fs = firestore; this.username = username; this.onUpdate = onUpdate;
        this.syncFn = syncFn; this.ledger = new Ledger();
        this.peers = new Map(); this.kp = null; this.kid = null;
        this.seq = 0; this._uploadTimer = null; this._pingTimer = null; this._reconnectTimer = null;
        this._nonce = Math.floor(Math.random() * 2147483647);
        this._retryPending = null;
    }

    async init() {
        this.kp = await loadOrGenKeys();
        this.kid = await keyId(this.kp.publicKey);
        console.log('🔑 P2P keyId:', this.kid, 'nonce:', this._nonce, '(fresh)');
    }

    join() {
        const { db, doc, setDoc, collection, onSnapshot, deleteDoc, Timestamp } = this.fs;
        if (!db || !doc || !setDoc) { console.warn('🌀 P2P join missing Firestore API'); return; }
        console.log('🌀 P2P joining mesh as', this.username);
        const myRef = doc(db, 'sig', this.username.replace(/[.#$\/\[\]]/g, '_'));
        crypto.subtle.exportKey('jwk', this.kp.publicKey).then(jwk => {
            setDoc(myRef, { u: this.username, k: jwk, kid: this.kid, nonce: this._nonce, on: 1, ts: Timestamp.now() }, { merge: true });
        });
        window.addEventListener('beforeunload', () => { deleteDoc(myRef).catch(() => {}); });

        const peersRef = collection(db, 'sig');
        this._unsubPeers = onSnapshot(peersRef, snap => {
            snap.docChanges().forEach(async ch => {
                const k = ch.doc.id; if (k === this.username) return;
                if (ch.type === 'removed') { this._onPeerGone(k); return; }
                const d = ch.doc.data(); if (!d?.k) return;
                const existing = this.peers.get(k);
                // If peer changed keys (page refresh), remove old entry so fresh key is used
                if (existing && (d.kid || k) !== (existing.keyId || k)) {
                    console.log('🔄 P2P peer key changed for', k, '— reconnecting');
                    this._onPeerGone(k);
                }
                if (!this.peers.has(k)) {
                    const pub = await crypto.subtle.importKey('jwk', d.k, { name:'ECDSA', namedCurve:'P-256' }, true, ['verify']);
                    this.peers.set(k, { pc:null, ch:null, pub, name: d.u||'?', seq:0, keyId: d.kid||k, nonce: d.nonce||0 });
                    this._connect(k, d.kid, d.nonce||0);
                }
            });
        });

        const mySigRef = collection(db, 'sig', this.username, 'offers');
        this._unsubOffers = onSnapshot(mySigRef, snap => {
            snap.docChanges().forEach(ch => {
                if (ch.type !== 'added') return;
                const d = ch.doc.data();
                if (!d || !d.t) return;
                const pk = ch.doc.id;
                console.log('📨 P2P signaling doc detected:', pk, 'type:', d.t);
                if (d.t === 'offer') this._onOffer(pk, d.s);
                else if (d.t === 'answer') this._onAnswer(pk, d.s);
            });
        });
        const iceRef = collection(db, 'sig', this.username, 'ice');
        this._unsubIce = onSnapshot(iceRef, snap => {
            snap.docChanges().forEach(ch => {
                if (ch.type !== 'added') return;
                const d = ch.doc.data(); const pk = ch.doc.id;
                const peer = this.peers.get(pk);
                if (peer?.pc && d.c) {
                    peer.pc.addIceCandidate(new RTCIceCandidate(d.c)).catch(() => {});
                }
            });
        });

        this._pingTimer = setInterval(() => {
            const { doc, setDoc, Timestamp } = this.fs;
            setDoc(myRef, { ts: Timestamp.now(), on: 1 }, { merge: true }).catch(() => {});
        }, 5000);

        this._reconnectTimer = setInterval(() => {
            this._rescanPeers();
        }, 15000);

        // Peer discovery failsafe: actively scan when few peers
        this._scanTimer = setInterval(() => {
            if (this.peers.size === 0) this._rescanPeers();
        }, 30000);

        if (!this._uploadTimer) this._uploadTimer = setInterval(() => this._uploadIfElected(), 900000);
    }

    async _connect(pk, peerKid, peerNonce) {
        const iAmOfferer = decideOfferer(this.kid, this._nonce, peerKid, peerNonce, this.username, pk);
        console.log('🔗 P2P connecting to peer:', pk, '→ iAmOfferer:', iAmOfferer);

        const pc = new RTCPeerConnection({ iceServers: [{ urls:'stun:stun.l.google.com:19302' }] });
        const p = this.peers.get(pk); p.pc = pc;

        pc.onicecandidate = e => {
            if (!e.candidate) return;
            const { doc, setDoc } = this.fs;
            setDoc(doc(this.fs.db, 'sig', pk, 'ice', this.username), { c: e.candidate.toJSON() }).catch(() => {});
        };
        pc.ondatachannel = e => {
            console.log('📥 P2P inbound channel from', pk);
            p.ch = e.channel;
            e.channel.onopen = () => console.log('📡 P2P channel open with', pk, '(answerer)');
            e.channel.onclose = () => console.log('🔌 P2P channel closed', pk);
            e.channel.onmessage = ev => { this._onMsg(pk, ev.data); };
        };

        if (iAmOfferer) {
            const ch = pc.createDataChannel('l', { ordered:false, maxRetransmits:0 });
            p.ch = ch;
            ch.onopen = () => console.log('📡 P2P channel open with', pk, '(offerer)');
            ch.onclose = () => console.log('🔌 P2P channel closed', pk);
            ch.onmessage = ev => { this._onMsg(pk, ev.data); };
            const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
            const { doc, setDoc } = this.fs;
            console.log('📤 P2P sending offer to', pk);
            await setDoc(doc(this.fs.db, 'sig', pk, 'offers', this.username), { t:'offer', s: pc.localDescription.toJSON() });
        }
        const check = () => {
            if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') return;
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                console.log('🔄 P2P connection failed, retry in 2s');
                pc.close();
                setTimeout(() => {
                    this._onPeerGone(pk);
                    const { doc:fdoc, getDoc } = this.fs;
                    getDoc(fdoc(this.fs.db, 'sig', pk)).then(snap => {
                        if (!snap.exists()) return;
                        const d = snap.data();
                        crypto.subtle.importKey('jwk', d.k, { name:'ECDSA', namedCurve:'P-256' }, true, ['verify']).then(pub => {
                            this.peers.set(pk, { pc:null, ch:null, pub, name: d.u||'?', seq:0, keyId: d.kid||pk, nonce: d.nonce||0 });
                            this._connect(pk, d.kid, d.nonce||0);
                        });
                    }).catch(() => {});
                }, 2000);
            }
        };
        pc.onconnectionstatechange = check;
        setTimeout(check, 10000);
    }

    async _onOffer(pk, sdp) {
        const p = this.peers.get(pk);
        if (!p) { console.log('🧹 _onOffer stale, delete:', pk); this._cleanSigDoc(pk).catch(()=>{}); return; }
        if (!p.pc) { console.log('⏳ _onOffer wait PC', pk); setTimeout(() => this._onOffer(pk, sdp), 200); return; }
        if (p.pc.signalingState !== 'stable') { setTimeout(() => this._onOffer(pk, sdp), 200); return; }
        console.log('📩 P2P offer from', pk);
        try {
            await p.pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const ans = await p.pc.createAnswer(); await p.pc.setLocalDescription(ans);
            const { doc, setDoc, deleteDoc } = this.fs;
            await deleteDoc(doc(this.fs.db, 'sig', this.username, 'offers', pk)).catch(() => {});
            await setDoc(doc(this.fs.db, 'sig', pk, 'offers', this.username), { t:'answer', s: p.pc.localDescription.toJSON() });
            console.log('📤 P2P answer sent to', pk);
        } catch (e) { console.warn('❌ _onOffer err:', e); }
    }

    async _onAnswer(pk, sdp) {
        const p = this.peers.get(pk);
        if (!p) { console.log('🧹 _onAnswer stale, delete:', pk); this._cleanSigDoc(pk).catch(()=>{}); return; }
        if (!p.pc || p.pc.signalingState !== 'have-local-offer') { setTimeout(() => this._onAnswer(pk, sdp), 200); return; }
        console.log('📩 P2P answer from', pk);
        try {
            await p.pc.setRemoteDescription(new RTCSessionDescription(sdp));
            console.log('✅ P2P connected with', pk);
        } catch (e) { console.warn('❌ _onAnswer err:', e); }
    }

    _cleanSigDoc(pk) {
        const { doc, deleteDoc } = this.fs;
        return deleteDoc(doc(this.fs.db, 'sig', this.username, 'offers', pk)).catch(() => {});
    }

    async _onMsg(pk, data) {
        const p = this.peers.get(pk); if (!p) { console.warn('📩 _onMsg unknown:', pk); return; }
        const payload = await verifyMsg(data, p.pub);
        if (!payload) { console.warn('❌ _onMsg verify fail', pk, 'data:', data); return; }
        // Chat message
        if (payload.type === 'chat') {
            if (window._onChatMessage) window._onChatMessage(payload.user || pk, payload.text || '');
            return;
        }
        if (payload.seq <= p.seq) return;
        if (p.seq === 0) console.log('📩 P2P first msg from', pk, 'score:', payload.s, 'vps:', payload.v, 'pp:', payload.p);
        p.seq = payload.seq;
        this.ledger.set(pk, { username:p.name, score:payload.s, prestige:payload.pr, vps:payload.v, pp:payload.p });
        this.onUpdate(this.ledger.sorted());
    }

    _onPeerGone(pk) {
        const p = this.peers.get(pk);
        if (p) {
            console.log('🔌 P2P peer left:', pk);
            try { p.ch?.close(); } catch (_) {} try { p.pc?.close(); } catch (_) {}
        }
        this.peers.delete(pk); this.ledger.del(pk);
    }

    async broadcast(score, prestige, vps, pp, ts) {
        this.seq++;
        // Build payload with full BN arrays — no float64 conversion needed
        const payload = { seq: this.seq, s: score, v: vps, p: pp, pr: prestige, ts: ts || Math.floor(Date.now()/1000) };
        const msg = await signPayload(payload, this.kp.privateKey);
        this.ledger.set('self', { username:this.username, score, prestige, vps, pp });
        let sent = 0;
        for (const [, peer] of this.peers) {
            if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); sent++; } catch (_) {}
        }
        if (this.seq % 50 === 0) console.log('📡 P2P bcast #', this.seq, 'sent', sent, 'score:', score, 'vps:', vps, 'pp:', pp, 'prestige:', prestige);
        // Aggressive retry when nothing gets through
        if (sent === 0) {
            // Immediate full peer scan + reconnect
            this._rescanPeers(true);
            // Retry broadcast after a short delay to give channels time to open
            if (!this._retryPending) {
                this._retryPending = setTimeout(() => {
                    this._retryPending = null;
                    // Re-sign with same seq so duplicates are ignored by peers
                    const retryMsg = this.seq;
                    let retrySent = 0;
                    for (const [, peer] of this.peers) {
                        if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); retrySent++; } catch (_) {}
                    }
                    if (retrySent === 0 && this.peers.size > 0) {
                        // Still nothing — hard-rescan and retry once more
                        this._rescanPeers(true);
                        setTimeout(() => {
                            let retry2 = 0;
                            for (const [, peer] of this.peers) {
                                if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); retry2++; } catch (_) {}
                            }
                        }, 2000);
                    }
                }, 1500);
            }
        }
    }

    // Broadcast a chat message to all connected peers
    async broadcastChat(text) {
        const payload = { type: 'chat', text, user: this.username, ts: Math.floor(Date.now()/1000) };
        const msg = await signPayload(payload, this.kp.privateKey);
        for (const [, peer] of this.peers) {
            if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
        }
    }

    // Scan signaling collection for online peers and initiate connections
    async _rescanPeers(forceScan) {
        const { db, doc:fdoc, getDoc, getDocs, collection } = this.fs;
        if (!db || !getDocs) return;
        try {
            // Check existing peers for reconnect
            for (const [k, p] of this.peers) {
                if (p.ch?.readyState === 'open') continue;
                if (!p.pc || p.pc.connectionState === 'failed' || p.pc.connectionState === 'disconnected') {
                    console.log('🔄 P2P reconnecting to', k);
                    this._onPeerGone(k);
                    const snap = await getDoc(fdoc(db, 'sig', k));
                    if (!snap.exists()) continue;
                    const d = snap.data();
                    if (!d?.k) continue;
                    const pub = await crypto.subtle.importKey('jwk', d.k, { name:'ECDSA', namedCurve:'P-256' }, true, ['verify']);
                    this.peers.set(k, { pc:null, ch:null, pub, name: d.u||'?', seq:0, keyId: d.kid||k, nonce: d.nonce||0 });
                    this._connect(k, d.kid, d.nonce||0);
                }
            }
            // Always scan for new/online peers when forced, otherwise scan when none known
            if (forceScan || this.peers.size === 0) {
                const snap = await getDocs(collection(db, 'sig'));
                for (const s of snap.docs) {
                    const k = s.id;
                    if (k === this.username) continue;
                    if (this.peers.has(k)) continue;
                    const d = s.data();
                    if (!d?.k || !d?.on) continue;
                    console.log('📡 P2P discovered peer via scan:', k);
                    const pub = await crypto.subtle.importKey('jwk', d.k, { name:'ECDSA', namedCurve:'P-256' }, true, ['verify']);
                    this.peers.set(k, { pc:null, ch:null, pub, name: d.u||'?', seq:0, keyId: d.kid||k, nonce: d.nonce||0 });
                    this._connect(k, d.kid, d.nonce||0);
                }
            }
        } catch (e) {
            console.warn('📡 P2P rescan error:', e.message);
        }
    }

    _elect() {
        let h = this.username;
        for (const k of this.peers.keys()) { if (k > h) h = k; }
        return h === this.username;
    }
    _uploadIfElected() {
        if (!this._elect() || !this.syncFn) return;
        const me = this.ledger.m.get('self');
        if (me) this.syncFn(me.username, me.score, me.prestige||0, me.pp, me.username, me.vps).catch(()=>{});
        for (const [, e] of this.peers) {
            const le = this.ledger.m.get(e.name);
            if (le) this.syncFn(le.username, le.score, le.prestige||0, le.pp, le.username, le.vps).catch(()=>{});
        }
    }

    destroy() {
        clearInterval(this._uploadTimer);
        clearInterval(this._pingTimer);
        clearInterval(this._reconnectTimer);
        clearInterval(this._scanTimer);
        if (this._retryPending) { clearTimeout(this._retryPending); this._retryPending = null; }
        for (const [k] of this.peers) this._onPeerGone(k);
        if (this._unsubPeers) this._unsubPeers();
        if (this._unsubOffers) this._unsubOffers();
        if (this._unsubIce) this._unsubIce();
    }
}

export { P2PLeaderboardManager };
