// ============================================================
// ECDSA-signed packets, Firestore signaling, 15-min cloud backup
// ============================================================

// ---- ECDSA P-256 key (fresh per page load — avoids cross-tab collision entirely) ----
async function loadOrGenKeys() {
    const pair = await crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify']);
    return { ...pair, cached:false };
}
async function keyId(pub) {
    const s = await crypto.subtle.exportKey('spki', pub);
    return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/[+/=]/g, '').substring(0, 16);
}

// ---- Binary packet (81 bytes) ----
function encode(seq, score, vps, pp, prestige, ts, sig) {
    const b = new ArrayBuffer(100), d = new DataView(b);
    d.setUint32(0, seq, true); d.setFloat64(4, score, true); d.setUint32(12, ts, true);
    d.setFloat64(16, vps, true); d.setFloat64(24, pp, true); d.setUint32(32, prestige, true);
    new Uint8Array(b, 36, 64).set(new Uint8Array(sig)); return b;
}
function decode(b) {
    const d = new DataView(b);
    return { seq: d.getUint32(0,true), score: d.getFloat64(4,true), ts: d.getUint32(12,true),
             vps: d.getFloat64(16,true), pp: d.getFloat64(24,true), prestige: d.getUint32(32,true),
             sig: new Uint8Array(b, 36, 64) };
}
async function signPkt(priv, seq, score, vps, pp, prestige, ts) {
    const msg = `${seq}:${score}:${vps}:${pp}:${prestige}:${ts}`;
    return crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, priv, new TextEncoder().encode(msg));
}
async function verifyPkt(pub, seq, score, vps, pp, prestige, ts, sig) {
    const msg = `${seq}:${score}:${vps}:${pp}:${prestige}:${ts}`;
    return crypto.subtle.verify({ name:'ECDSA', hash:'SHA-256' }, pub, sig, new TextEncoder().encode(msg));
}

// ---- In-memory sorted ledger ----
class Ledger {
    constructor() { this.m = new Map(); }
    set(k,v) { this.m.set(k,v); }
    del(k) { this.m.delete(k); }
    sorted() { return [...this.m.values()].sort((a,b)=>b.score-a.score); }
}

// ---- Determine offerer: deterministic tiebreaker that ALWAYS picks one ----
function decideOfferer(myKid, myNonce, peerKid, peerNonce, myUser, peerUser) {
    // 1) Compare keyId strings (base64 — ASCII compare works)
    if (myKid !== peerKid) return myKid < peerKid;
    // 2) Fallback: random nonce (lower wins)
    if (myNonce !== peerNonce) return myNonce < peerNonce;
    // 3) Final tiebreak: username alphabetically
    return myUser < peerUser;
    // One side WILL be true, the other false — guaranteed
}

// ============================================================
class P2PLeaderboardManager {
    constructor(firestore, username, onUpdate, syncFn) {
        this.fs = firestore; this.username = username; this.onUpdate = onUpdate;
        this.syncFn = syncFn; this.ledger = new Ledger();
        this.peers = new Map(); this.kp = null; this.kid = null;
        this.seq = 0; this._uploadTimer = null; this._pingTimer = null;
        this._nonce = Math.floor(Math.random() * 2147483647);
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
                // If first time seeing this peer, set up connection
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
                const pk = ch.doc.id; // doc ID = peer's username (set in _connect/_onOffer)
                console.log('📨 P2P signaling doc detected:', pk, 'type:', d.t);
                if (d.t === 'offer') this._onOffer(pk, d.s);
                else if (d.t === 'answer') this._onAnswer(pk, d.s);
            });
        });
        const iceRef = collection(db, 'sig', this.username, 'ice');
        this._unsubIce = onSnapshot(iceRef, snap => {
            snap.docChanges().forEach(ch => {
                if (ch.type !== 'added') return;
                const d = ch.doc.data(); const pk = ch.doc.id; // doc ID = peer's username
                const peer = this.peers.get(pk);
                if (peer?.pc && d.c) {
                    peer.pc.addIceCandidate(new RTCIceCandidate(d.c)).catch(() => {});
                }
            });
        });

        // ---- 5-second ping: refresh sig doc to show we're alive, then check peers ----
        this._pingTimer = setInterval(() => {
            const { doc, setDoc, Timestamp } = this.fs;
            setDoc(myRef, { ts: Timestamp.now(), on: 1 }, { merge: true }).catch(() => {});
        }, 5000);

        if (!this._uploadTimer) this._uploadTimer = setInterval(() => this._uploadIfElected(), 900000);
    }

    async _connect(pk, peerKid, peerNonce) {
        // Use the deterministic tiebreaker
        const iAmOfferer = decideOfferer(this.kid, this._nonce, peerKid, peerNonce, this.username, pk);
        console.log('🔗 P2P connecting to peer:', pk, 'kid:', peerKid, 'nonce:', peerNonce,
            '→ iAmOfferer:', iAmOfferer, '(myKid:', this.kid, 'myNonce:', this._nonce, ')');

        const pc = new RTCPeerConnection({ iceServers: [{ urls:'stun:stun.l.google.com:19302' }] });
        const p = this.peers.get(pk); p.pc = pc;

        pc.onicecandidate = e => {
            if (!e.candidate) return;
            const { doc, setDoc } = this.fs;
            // Use self username as doc ID so peer can look up by name
            setDoc(doc(this.fs.db, 'sig', pk, 'ice', this.username), { c: e.candidate.toJSON() }).catch(err => console.warn('❄️ ICE write fail:', err));
        };
        pc.ondatachannel = e => {
            console.log('📥 P2P inbound channel from', pk);
            p.ch = e.channel;
            e.channel.onopen = () => console.log('📡 P2P channel open with', pk, '(answerer side)');
            e.channel.onclose = () => console.log('🔌 P2P channel closed', pk);
            e.channel.onmessage = ev => { try { this._onMsg(pk, decode(ev.data)); } catch (_) {} };
        };

        if (iAmOfferer) {
            const ch = pc.createDataChannel('l', { ordered:false, maxRetransmits:0 });
            p.ch = ch;
            ch.onopen = () => console.log('📡 P2P channel open with', pk, '(offerer side)');
            ch.onclose = () => console.log('🔌 P2P channel closed', pk);
            ch.onmessage = ev => { try { this._onMsg(pk, decode(ev.data)); } catch (_) {} };
            const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
            const { doc, setDoc } = this.fs;
            console.log('📤 P2P sending offer to', pk);
            // Use peer's username as doc ID so the answerer can look up by name
            await setDoc(doc(this.fs.db, 'sig', pk, 'offers', this.username), { t:'offer', s: pc.localDescription.toJSON() });
        }
        // BOTH sides retry connection if signaling stalls
        const check = () => {
            if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') return;
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                console.log('🔄 P2P connection to', pk, 'failed, retrying in 2s');
                pc.close();
                setTimeout(() => {
                    // Clean up old entries so onSnapshot triggers re-connect
                    this._onPeerGone(pk);
                    // Re-fetch peer's doc and reconnect
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
        // Monitor connection state changes
        pc.onconnectionstatechange = check;
        setTimeout(check, 10000); // Also check after 10s as a backup
    }

    async _onOffer(pk, sdp) {
        const p = this.peers.get(pk);
        if (!p) { console.log('🧹 _onOffer stale doc from unknown peer, deleting:', pk); this._cleanSigDoc(pk, 'offer').catch(()=>{}); return; }
        if (!p.pc) { console.log('⏳ _onOffer waiting for PC from', pk); setTimeout(() => this._onOffer(pk, sdp), 200); return; }
        if (p.pc.signalingState !== 'stable') { console.log('⏳ _onOffer waiting stable state from', pk, 'state:', p.pc.signalingState); setTimeout(() => this._onOffer(pk, sdp), 200); return; }
        console.log('📩 P2P received offer from', pk, '— creating answer...');
        try {
            await p.pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const ans = await p.pc.createAnswer(); await p.pc.setLocalDescription(ans);
            const { doc, setDoc, deleteDoc } = this.fs;
            // Delete the offer doc so it won't re-trigger, then write answer keyed by our username
            await deleteDoc(doc(this.fs.db, 'sig', this.username, 'offers', pk)).catch(() => {});
            await setDoc(doc(this.fs.db, 'sig', pk, 'offers', this.username), { t:'answer', s: p.pc.localDescription.toJSON() });
            console.log('📤 P2P answer sent to', pk);
        } catch (e) { console.warn('❌ _onOffer error:', e); }
    }

    async _onAnswer(pk, sdp) {
        const p = this.peers.get(pk);
        if (!p) { console.log('🧹 _onAnswer stale doc from unknown peer, deleting:', pk); this._cleanSigDoc(pk, 'answer').catch(()=>{}); return; }
        if (!p.pc || p.pc.signalingState !== 'have-local-offer') { console.log('⏳ _onAnswer waiting from', pk, 'state:', p?.pc?.signalingState); setTimeout(() => this._onAnswer(pk, sdp), 200); return; }
        console.log('📩 P2P received answer from', pk, '— completing connection...');
        try {
            await p.pc.setRemoteDescription(new RTCSessionDescription(sdp));
            console.log('✅ P2P connection established with', pk);
        } catch (e) { console.warn('❌ _onAnswer error:', e); }
    }

    _cleanSigDoc(pk, type) {
        const { doc, deleteDoc } = this.fs;
        return deleteDoc(doc(this.fs.db, 'sig', this.username, 'offers', pk)).catch(() => {});
    }

    async _onMsg(pk, pkt) {
        const p = this.peers.get(pk); if (!p) { console.warn('📩 _onMsg unknown peer:', pk); return; }
        if (pkt.seq <= p.seq) return;
        // Floor + cap to match sender's integer signing
        const score = isFinite(pkt.score) ? Math.floor(pkt.score) : 0;
        const vps = isFinite(pkt.vps) ? Math.floor(pkt.vps) : 0;
        const pp = isFinite(pkt.pp) ? Math.floor(pkt.pp) : 0;
        const prestige = isFinite(pkt.prestige) ? Math.min(Math.floor(pkt.prestige), 1e9) : 0;
        const ok = await verifyPkt(p.pub, pkt.seq, score, vps, pp, prestige, pkt.ts, pkt.sig);
        if (!ok) { console.warn('❌ _onMsg sig fail from', pk, 'seq:', pkt.seq, 'vals:',`${pkt.seq}:${score}:${vps}:${pp}:${prestige}:${pkt.ts}`); return; }
        if (p.seq === 0) console.log('📩 P2P first msg from', pk, 'score:', score, 'vps:', vps, 'pp:', pp, 'prestige:', prestige);
        p.seq = pkt.seq;
        this.ledger.set(pk, { username:p.name, score, prestige, vps, pp });
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

    async broadcast(score, prestige, vps, pp) {
        this.seq++;
        const ts = Math.floor(Date.now()/1000);
        // Floor + cap all values to safe integer range for uint32 storage and string signing
        score = isFinite(score) ? Math.floor(score) : 0;
        vps = isFinite(vps) ? Math.floor(vps) : 0;
        pp = isFinite(pp) ? Math.floor(pp) : 0;
        prestige = isFinite(prestige) ? Math.min(Math.floor(prestige), 1e9) : 0;
        this.ledger.set('self', { username:this.username, score, prestige, vps, pp });
        const sig = await signPkt(this.kp.privateKey, this.seq, score, vps, pp, prestige, ts);
        const buf = encode(this.seq, score, vps, pp, prestige, ts, sig);
        let sent = 0;
        for (const [, p] of this.peers) {
            if (p.ch?.readyState === 'open') try { p.ch.send(buf); sent++; } catch (_) {}
        }
        if (this.seq % 50 === 0) console.log('📡 P2P broadcast #', this.seq, 'sent to', sent, 'peers, score:', score, 'vps:', vps, 'pp:', pp, 'prestige:', prestige);
    }

    _elect() {
        let h = this.username;
        for (const k of this.peers.keys()) { if (k > h) h = k; }
        return h === this.username;
    }
    _uploadIfElected() {
        if (!this._elect() || !this.syncFn) return;
        const me = this.ledger.m.get('self');
        if (me) this.syncFn(me.username, [me.score||0,0], me.prestige||0, me.pp||0, me.username, me.vps||0).catch(()=>{});
        for (const [, e] of this.peers) {
            const le = this.ledger.m.get(e.name);
            if (le) this.syncFn(le.username, [le.score||0,0], le.prestige||0, le.pp||0, le.username, le.vps||0).catch(()=>{});
        }
    }

    destroy() {
        clearInterval(this._uploadTimer);
        clearInterval(this._pingTimer);
        for (const [k] of this.peers) this._onPeerGone(k);
        if (this._unsubPeers) this._unsubPeers();
        if (this._unsubOffers) this._unsubOffers();
        if (this._unsubIce) this._unsubIce();
    }
}

export { P2PLeaderboardManager };
