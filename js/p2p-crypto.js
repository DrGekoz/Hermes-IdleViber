// ============================================================
// ECDSA-signed JSON packets over WebRTC data channel, Firestore signaling
// Star topology: single host (DrGekoz) relays scores to all peers
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
    try {
        const ok = await crypto.subtle.verify({ name:'ECDSA', hash:'SHA-256' }, pub, sig, new TextEncoder().encode(payloadStr));
        return ok ? msg.d : null;
    } catch (_) { return null; }
}

// ---- In-memory sorted ledger ----
class Ledger {
constructor() { this.m = new Map(); }
set(k,v) { this.m.set(k,v); }
del(k) { this.m.delete(k); }
sorted() { return [...this.m.values()].sort((a,b)=>{
const _n = v => Array.isArray(v) ? Number(v[0])*Math.pow(10,Number(v[1])) : Number(v||0);
const ap = Number(a.prestige||0), bp = Number(b.prestige||0);
if (bp !== ap) return bp - ap;         // Prestige desc
const app = _n(a.pp), bpp = _n(b.pp);
if (bpp !== app) return bpp - app;     // PP desc
const av = _n(a.vps), bv = _n(b.vps);
if (bv !== av) return bv - av;         // VPS desc
const sa = _n(a.score), sb = _n(b.score);
return sb - sa;                         // VIBES desc
}); }
}

// ---- Star-topology host detection ----
// Alphabetical first peer ID wins — simple, stable, no special treatment
const DEV_HOST = 'DrGekoz';

// ============================================================
class P2PLeaderboardManager {
    constructor(firestore, username, onUpdate, syncFn, peerId) {
        this.fs = firestore; this.username = username; this.onUpdate = onUpdate;
        this.syncFn = syncFn; this.ledger = new Ledger();
        this.peers = new Map(); this.kp = null; this.kid = null;
        this.seq = 0; this._uploadTimer = null; this._pingTimer = null; this._reconnectTimer = null; this._signalTimer = null;
        this._nonce = Math.floor(Math.random() * 2147483647);
        this._retryPending = null; this._connecting = new Set();
this._onlineUsernames = new Set();
this._onlineNames = {}; // peerId -> display name for host detection
this._isHost = false;
        this._lastLeaderboardHash = '';
        this._myScore = 0; this._myPrestige = 0; this._myVps = 0; this._myPp = 0; this._myTierIcon = 0;
        // Stable peer ID — never changes, used as ledger key instead of display name
        this.peerId = peerId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
    }

async init() {
this.kp = await loadOrGenKeys();
this.kid = await keyId(this.kp.publicKey);
console.log('🔑 P2P keyId:', this.kid, 'nonce:', this._nonce, '(fresh)');
}

// ---- Host detection ----
    _computeHost(onlineSet) {
        if (!onlineSet || onlineSet.size === 0) return this.peerId;
        // Alphabetical first — simple, stable, no special treatment for anyone
        const sorted = [...onlineSet].sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        return sorted[0];
    }

_amHost() { return this._isHost; }

join() {
const { db, doc, setDoc, collection, onSnapshot, deleteDoc, Timestamp } = this.fs;
if (!db || !doc || !setDoc) { console.warn('🌀 P2P join missing Firestore API'); return; }
console.log('[P2P] Joining star network as', this.username);
        const myRef = doc(db, 'sig', this.peerId);
        crypto.subtle.exportKey('jwk', this.kp.publicKey).then(jwk => {
            setDoc(myRef, { u: this.username, pid: this.peerId, k: jwk, kid: this.kid, nonce: this._nonce, on: 1, ts: Timestamp.now() }, { merge: true });
        });
window.addEventListener('beforeunload', () => { deleteDoc(myRef).catch(() => {}); });

// ---- Track all online peers and detect host changes ----
const peersRef = collection(db, 'sig');
this._unsubPeers = onSnapshot(peersRef, snap => {
const newOnline = new Set();
snap.docs.forEach(s => { const id = s.id; if (id === this.peerId) return; const sd = s.data(); if (!sd?.on) return; newOnline.add(id); this._onlineNames[id] = sd.u || id; });
// Detect peers that went offline
for (const k of this._onlineUsernames) {
if (!newOnline.has(k)) this._onPeerGone(k);
}
this._onlineUsernames = newOnline;
            const oldHost = this._computeHost(this._onlineUsernames);
            const wasHost = this._isHost;
            this._isHost = (this._computeHost(newOnline) === this.peerId);
            if (!wasHost && this._isHost) {
                console.log('[P2P] Elected Host = true — I am now the HOST');
// If we just became host (DrGekoz logged in), broadcast migration
this._broadcastHostMigration();
} else if (wasHost && !this._isHost) {
console.log('[P2P] Elected Host = false — host changed to:', this._computeHost(newOnline));
// Host changed (DrGekoz came online), I'm no longer host — disconnect all and reconnect to DrGekoz
this._disconnectAll();
}
// Connect to the current host (or to everyone if I'm the host)
            snap.docChanges().forEach(async ch => {
                const k = ch.doc.id; if (k === this.peerId) return;
if (ch.type === 'removed') { /* handled above */ return; }
const d = ch.doc.data(); if (!d?.k || !d?.on) return;
const existing = this.peers.get(k);
if (existing && (d.kid || k) !== (existing.keyId || k)) {
console.log('🔄 P2P peer key changed for', k, '— reconnecting');
this._onPeerGone(k);
}
if (!this.peers.has(k)) {
if (this._connecting.has(k)) return;
                    // Only connect: if I'm host (connect to everyone) OR if this peer is the host
                    const host = this._computeHost(newOnline);
                    const shouldConnect = this._isHost || (host && host.toLowerCase() === k.toLowerCase());
if (!shouldConnect) return; // skip — not host, not connecting to
                    this._connecting.add(k);
                    try {
                        const pub = await crypto.subtle.importKey('jwk', d.k, { name:'ECDSA', namedCurve:'P-256' }, true, ['verify']);
                        this.peers.set(k, { pc:null, ch:null, pub, name: d.u||'?', seq:0, keyId: d.kid||k, nonce: d.nonce||0 });
                        this._connect(k, d.kid, d.nonce||0);
                    } catch(e) { this._connecting.delete(k); console.warn('P2P key import failed for', k); }
}
});
});

// ---- Offer/answer signaling ----
const mySigRef = collection(db, 'sig', this.peerId, 'offers');
this._unsubOffers = onSnapshot(mySigRef, snap => {
snap.docChanges().forEach(ch => {
if (ch.type === 'removed') return;
const d = ch.doc.data();
if (!d || !d.t) return;
const pk = ch.doc.id;
console.log('📨 P2P signaling doc detected:', pk, 'type:', d.t);
if (d.t === 'offer') this._onOffer(pk, d.s);
else if (d.t === 'answer') this._onAnswer(pk, d.s);
});
});
const iceRef = collection(db, 'sig', this.peerId, 'ice');
this._unsubIce = onSnapshot(iceRef, snap => {
snap.docChanges().forEach(ch => {
if (ch.type === 'removed') return;
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

if (!this._signalTimer) {
this._signalTimer = setInterval(() => this._runSignaling(), 1000);
}

this._scanTimer = setInterval(() => {
if (this.peers.size === 0) this._rescanPeers();
}, 30000);

if (!this._uploadTimer) this._uploadTimer = setInterval(() => this._uploadIfElected(), 900000);

        // Log initial host status
        setTimeout(() => {
            const host = this._computeHost(this._onlineUsernames);
            console.log('[P2P] Elected Host =', this._isHost, '—', this._isHost ? 'I am the HOST' : 'Host is', host);
            if (!this._isHost && host) console.log('[P2P] Connecting to host:', host);
        }, 500);
}

// Disconnect all peers (used on host migration)
_disconnectAll() {
console.log('[P2P] Elected Host = false — disconnecting for host migration');
for (const k of [...this.peers.keys()]) this._onPeerGone(k, true);
this._connecting.clear();
}

// Broadcast host migration message to all connected peers
_broadcastHostMigration() {
const host = this._computeHost(this._onlineUsernames);
if (!host) return;
console.log('[P2P] Broadcasting host migration to:', host);
const payload = { type: 'host_migrate', host, ts: Math.floor(Date.now()/1000) };
// Sign and send to all connected peers
signPayload(payload, this.kp.privateKey).then(msg => {
for (const [, peer] of this.peers) {
if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
}
});
}

async _connect(pk, peerKid, peerNonce) {
// In star topology, the host ALWAYS makes the offer
const iAmOfferer = this._amHost();
console.log('[P2P] Connecting to peer:', pk, '| Host is offerer:', iAmOfferer);

const pc = new RTCPeerConnection({ iceServers: [{ urls:'stun:stun.l.google.com:19302' }] });
const p = this.peers.get(pk); p.pc = pc;

pc.onicecandidate = e => {
if (!e.candidate) return;
const { doc, setDoc } = this.fs;
// Write each ICE candidate to a unique doc so all candidates are available
const cid = 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
setDoc(doc(this.fs.db, 'sig', pk, 'ice', cid), { c: e.candidate.toJSON(), by: this.peerId }).catch(() => {});
};
pc.ondatachannel = e => {
console.log('📥 P2P inbound channel from', pk);
p.ch = e.channel;
e.channel.onopen = () => console.log('[P2P] Channel open — guest:', pk);
e.channel.onclose = () => console.log('🔌 P2P channel closed', pk);
e.channel.onmessage = ev => { this._onMsg(pk, ev.data); };
if (e.channel.readyState === 'open') {
console.log('[P2P] Channel already open — guest:', pk);
}
};

if (iAmOfferer) {
const ch = pc.createDataChannel('l', { ordered:false, maxRetransmits:0 });
p.ch = ch;
ch.onopen = () => console.log('[P2P] Channel open — host → guest:', pk);
ch.onclose = () => console.log('🔌 P2P channel closed', pk);
ch.onmessage = ev => { this._onMsg(pk, ev.data); };
if (ch.readyState === 'open') console.log('[P2P] Channel already open — host → guest:', pk);
const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
const { doc, setDoc, deleteDoc } = this.fs;
console.log('[P2P] Host sending offer to', pk);
            await deleteDoc(doc(this.fs.db, 'sig', pk, 'offers', this.peerId)).catch(() => {});
            await setDoc(doc(this.fs.db, 'sig', pk, 'offers', this.peerId), { t:'offer', s: pc.localDescription.toJSON() });
            if (p) { p._offerTime = Date.now(); p._offerSent = true; }
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
if (!p) {
    if (!this._offerRetries) this._offerRetries = {};
    if (!this._offerRetries[pk]) this._offerRetries[pk] = 0;
    if (++this._offerRetries[pk] > 30) { delete this._offerRetries[pk]; return; }
    setTimeout(() => this._onOffer(pk, sdp), 500); return; // wait for peer entry to be created
}
delete (this._offerRetries || {})[pk];
if (!p.pc) {
setTimeout(() => this._onOffer(pk, sdp), 200); return;
}
if (p.pc.signalingState !== 'stable') {
if (p.pc.connectionState === 'connected' || p.pc.connectionState === 'connecting') return;
setTimeout(() => this._onOffer(pk, sdp), 200); return;
}
console.log('📩 P2P offer from', pk);
try {
await p.pc.setRemoteDescription(new RTCSessionDescription(sdp));
const ans = await p.pc.createAnswer(); await p.pc.setLocalDescription(ans);
const { doc, setDoc, deleteDoc } = this.fs;
            await deleteDoc(doc(this.fs.db, 'sig', pk, 'offers', this.peerId)).catch(() => {});
            await deleteDoc(doc(this.fs.db, 'sig', this.peerId, 'offers', pk)).catch(() => {});
            await setDoc(doc(this.fs.db, 'sig', pk, 'offers', this.peerId), { t:'answer', s: p.pc.localDescription.toJSON() });
console.log('📤 P2P answer sent to', pk);
} catch (e) { console.warn('❌ _onOffer err:', e); }
}

    async _onAnswer(pk, sdp) {
        const p = this.peers.get(pk);
        if (!p) { this._cleanSigDoc(pk).catch(()=>{}); return; }
        if (!p.pc || p.pc.signalingState !== 'have-local-offer') {
            if (p.pc && (p.pc.connectionState === 'connected' || p.pc.connectionState === 'connecting' || p.pc.connectionState === 'closed')) return;
            if (!p._answerRetries) p._answerRetries = 0;
            if (++p._answerRetries > 75) { console.warn('⏱ _onAnswer timeout for', pk); return; } // ~15s max retry
            setTimeout(() => this._onAnswer(pk, sdp), 200); return;
        }
        p._answerRetries = 0;
console.log('📩 P2P answer from', pk);
try {
await p.pc.setRemoteDescription(new RTCSessionDescription(sdp));
if (p) { p._offerSent = false; }
console.log('✅ P2P connected with', pk);
// If I'm the host and just connected to a guest, send current leaderboard immediately
if (this._amHost()) {
this._lastLeaderboardHash = ''; // force send for newly connected peer
setTimeout(() => this._hostSendLeaderboard(), 500);
}
} catch (e) { console.warn('❌ _onAnswer err:', e); }
}

_cleanSigDoc(pk) {
const { doc, deleteDoc } = this.fs;
return deleteDoc(doc(this.fs.db, 'sig', this.peerId, 'offers', pk)).catch(() => {});
}

// ---- Message routing ----
async _onMsg(pk, data) {
    const p = this.peers.get(pk); if (!p) { console.warn('📩 _onMsg unknown:', pk); return; }
    const payload = await verifyMsg(data, p.pub);
    if (!payload) {
        // Stale message from previous key rotation or mismatch — log briefly
        if (Math.random() < 0.01) console.log('[P2P] verify fail from', pk, '(stale key — normal during reconnect)');
        return;
    }

// Chat message — host relays to everyone, guest just displays
if (payload.type === 'chat') {
if (window._onChatMessage) window._onChatMessage(payload.user || pk, payload.text || '');
// Host relays guest chat to all other connected peers
if (this._amHost() && payload.user && payload.user !== this.username) {
this._relayChat(payload);
}
return;
}

// Host migration — this peer told us to switch to a new host
if (payload.type === 'host_migrate') {
console.log('👑 P2P host migration to:', payload.host);
if (payload.host !== this.peerId) {
// I'm not the new host, disconnect everything and reconnect to new host
this._disconnectAll();
}
return;
}

// ---- GUEST → HOST: score update ----
if (payload.type === 'score') {
// Host receives score update from a guest
if (!this._amHost()) {
// Non-host receiving a score update — ignore (relay only)
return;
}
const guestName = payload.id || payload.user || pk;
console.log('[P2P] Score from', payload.user || guestName, '→', payload.s ? payload.s[0].toFixed(2)+'e'+payload.s[1] : '0');
this.ledger.set(guestName, { id: payload.id, username: payload.user || guestName, score:payload.s, prestige:payload.pr, vps:payload.v, pp:payload.p, tierIcon:payload.ti });
this.ledger.set('self', { username:this.username, score:this._myScore, prestige:this._myPrestige, vps:this._myVps, pp:this._myPp, tierIcon:this._myTierIcon });
try { this.onUpdate(this.ledger.sorted()); } catch(e) { console.warn('P2P onUpdate err:', e); }
// Relay full leaderboard to all guests
this._hostSendLeaderboard();
return;
}

// ---- HOST → GUEST: full leaderboard sync ----
if (payload.type === 'leaderboard') {
if (this._amHost()) return; // host doesn't consume its own leaderboard
// Guest receives authoritative leaderboard from host
const entries = payload.entries || [];
// Score reconciliation: for self entry, keep whichever is higher (local vs host)
for (const e of entries) {
const key = e.id || e.user;
if (e.user === this.username) {
// Compare host's view of our score with local — keep higher
const hostScore = Array.isArray(e.s) ? Number(e.s[0])*Math.pow(10,Number(e.s[1])) : Number(e.s||0);
const localScore = Array.isArray(this._myScore) ? Number(this._myScore[0])*Math.pow(10,Number(this._myScore[1])) : Number(this._myScore||0);
if (hostScore > localScore) {
this._myScore = e.s;
this._myPrestige = Math.max(this._myPrestige, e.pr||0);
this._myVps = e.v;
this._myPp = e.p;
this._myTierIcon = e.ti || this._myTierIcon;
this.ledger.set('self', { username:this.username, score:this._myScore, prestige:this._myPrestige, vps:this._myVps, pp:this._myPp, tierIcon:this._myTierIcon });
}
continue; // skip setting as peer entry — 'self' handled below
}
this.ledger.set(key, { id: e.id, username: e.user, score:e.s, prestige:e.pr, vps:e.v, pp:e.p, tierIcon:e.ti });
}
this.ledger.set('self', { username:this.username, score:this._myScore, prestige:this._myPrestige, vps:this._myVps, pp:this._myPp, tierIcon:this._myTierIcon });
try { this.onUpdate(this.ledger.sorted()); } catch(e) { console.warn('P2P onUpdate err:', e); }
return;
}
}

// Host sends full sorted leaderboard to all connected guests
_hostSendLeaderboard() {
const entries = this.ledger.sorted().map(e => ({
id: e.id || e.username, user: e.username, s: e.score, pr: e.prestige, v: e.vps, p: e.pp, ti: e.tierIcon
}));
const hash = JSON.stringify(entries);
if (hash === this._lastLeaderboardHash) return; // skip if no change
this._lastLeaderboardHash = hash;
const payload = { type: 'leaderboard', entries, ts: Math.floor(Date.now()/1000) };
signPayload(payload, this.kp.privateKey).then(msg => {
for (const [, peer] of this.peers) {
if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
}
});
}

_onPeerGone(pk, immediate) {
const p = this.peers.get(pk);
if (p) {
console.log('🔌 P2P peer left:', pk);
try { p.ch?.close(); } catch (_) {} try { p.pc?.close(); } catch (_) {}
}
this.peers.delete(pk); this._connecting.delete(pk);
delete (this._offerRetries || {})[pk];
// Cancel any pending stale-deletion timer
if (this._staleTimers && this._staleTimers[pk]) { clearTimeout(this._staleTimers[pk]); delete this._staleTimers[pk]; }
if (immediate) {
this.ledger.del(pk);
} else {
// Stale buffer: keep entry visible for 30s in case of brief disconnect
if (!this._staleTimers) this._staleTimers = {};
this._staleTimers[pk] = setTimeout(() => {
delete this._staleTimers[pk];
this.ledger.del(pk);
if (this._amHost()) {
try { this.onUpdate(this.ledger.sorted()); } catch(e) { console.warn('P2P onUpdate err:', e); }
setTimeout(() => this._hostSendLeaderboard(), 100);
}
}, 30000);
}
// If host, update UI and rebroadcast immediately (but entry stays due to stale buffer)
if (this._amHost()) {
try { this.onUpdate(this.ledger.sorted()); } catch(e) { console.warn('P2P onUpdate err:', e); }
setTimeout(() => this._hostSendLeaderboard(), 100);
}
}

// ---- GUEST: send score to host; HOST: store locally and broadcast to all ----
async broadcast(score, prestige, vps, pp, ts, tierIcon) {
// Store locally
this._myScore = score;
this._myPrestige = prestige;
this._myVps = vps;
this._myPp = pp;
this._myTierIcon = tierIcon || 0;
this.ledger.set('self', { username:this.username, score, prestige, vps, pp, tierIcon: tierIcon || 0 });

if (this._amHost()) {
// Host: update own score and rebroadcast leaderboard to all guests
try { this.onUpdate(this.ledger.sorted()); } catch(e) { console.warn('P2P onUpdate err:', e); }
this._hostSendLeaderboard();
} else {
// Guest: update local ledger immediately, then send score to host
try { this.onUpdate(this.ledger.sorted()); } catch(e) { console.warn('P2P onUpdate err:', e); }
// Guest: send score update to host only
const payload = { type: 'score', id: this.peerId, user: this.username, s: score, pr: prestige, v: vps, p: pp, ti: tierIcon || 0, ts: ts || Math.floor(Date.now()/1000) };
const msg = await signPayload(payload, this.kp.privateKey);
let sent = 0;
for (const [, peer] of this.peers) {
if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); sent++; } catch (_) {}
}
if (sent === 0 && !this._retryPending) {
this._retryPending = setTimeout(() => {
this._retryPending = null;
for (const [, peer] of this.peers) {
if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
}
}, 1500);
}
}
}

// Broadcast a chat message — guests send to host, host relays to all
async broadcastChat(text) {
const payload = { type: 'chat', text, user: this.username, ts: Math.floor(Date.now()/1000) };
const msg = await signPayload(payload, this.kp.privateKey);
for (const [, peer] of this.peers) {
if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
}
}

// Host re-signs and relays a guest's chat to all OTHER connected peers (skip sender)
_relayChat(original) {
const relayPayload = { type: 'chat', text: original.text, user: original.user, ts: Math.floor(Date.now()/1000) };
signPayload(relayPayload, this.kp.privateKey).then(msg => {
for (const [k, peer] of this.peers) {
if (peer.name === original.user) continue; // skip original sender (match by display name, not UUID peerId)
if (peer.ch?.readyState === 'open') try { peer.ch.send(msg); } catch (_) {}
}
});
}

// ---- Signaling retry — 1-second heartbeat ----
async _runSignaling() {
const { db, getDocs, collection, doc:fdoc, getDoc } = this.fs;
if (!db || !getDocs) return;
try {
const snap = await getDocs(collection(db, 'sig'));
const onlinePeers = [];
for (const s of snap.docs) {
const k = s.id;
if (k === this.peerId) continue;
const d = s.data();
if (!d?.k || !d?.on) continue;
this._onlineNames[k] = d.u || k;
onlinePeers.push({ id: k, data: d });
}
// Recompute host status
const newOnline = new Set(onlinePeers.map(p => p.id));
this._onlineUsernames = newOnline;
            const wasHost = this._isHost;
            this._isHost = (this._computeHost(newOnline) === this.peerId);
            if (!wasHost && this._isHost) {
                console.log('[P2P] Elected Host = true (signaling retry)');
this._broadcastHostMigration();
} else if (wasHost && !this._isHost) {
console.log('[P2P] Elected Host = false (signaling retry) — reconnecting');
this._disconnectAll();
return;
}

const host = this._computeHost(newOnline);
for (const { id: k, data: d } of onlinePeers) {
// Skip: only connect to host (if I'm not host) OR to everyone (if I am host)
if (!this._isHost && host !== k) continue;

let p = this.peers.get(k);
if (!p) {
this._initPeer(k, d);
                    continue;
                }
                if (p.ch?.readyState === 'open') continue;
                if (!p.pc || p.pc.connectionState === 'failed' || p.pc.connectionState === 'disconnected' || p.pc.connectionState === 'closed') {
                    console.log('🔄 P2P reconnecting to', k, '(state:', p.pc?.connectionState, ')');
                    this._onPeerGone(k);
                    this._initPeer(k, d);
                    continue;
                }
                // Host always offers — retry sending offer if needed (only in 'new' state, not 'connecting')
                if (this._amHost() && p._offerSent && p.pc.signalingState === 'stable' && p.pc.connectionState === 'new') {
                    // Check if we've been waiting too long for answer — resend offer
                    const elapsed = p._offerTime ? Date.now() - p._offerTime : 9999;
                    if (elapsed < 3000) continue; // wait at least 3s before resending
                    try {
                        if (p.pc.signalingState !== 'stable') continue;
                        const offer = await p.pc.createOffer();
                        if (p.pc.signalingState !== 'stable') continue;
                        await p.pc.setLocalDescription(offer);
                        const { doc:fd, setDoc, deleteDoc } = this.fs;
                        await deleteDoc(fd(this.fs.db, 'sig', k, 'offers', this.peerId)).catch(() => {});
                        await setDoc(fd(this.fs.db, 'sig', k, 'offers', this.peerId), { t:'offer', s: p.pc.localDescription.toJSON() });
                        console.log('[P2P] 1s-retry — host offer sent to', k);
                    } catch (e) { console.warn('⚠️ P2P 1s-retry offer failed for', k, ':', e.message); }
                }
                // Guest waiting for host offer — check Firestore for pending offers (only in 'new' state)
                if (!this._amHost() && p.pc.signalingState === 'stable' && p.pc.connectionState === 'new') {
                    try {
                        const offerSnap = await getDoc(fdoc(this.fs.db, 'sig', this.peerId, 'offers', k));
                        if (offerSnap.exists()) {
                            const od = offerSnap.data();
                            if (od.t === 'offer') {
                                console.log('[P2P] 1s-retry — detected pending offer from host', k);
                                this._onOffer(k, od.s);
                            }
                        }
                    } catch (_) {}
                }
            }
        } catch (_) {}
    }

    _initPeer(k, d) {
        if (this._connecting.has(k)) return;
        // Cancel pending stale-deletion timer — peer is reconnecting
        if (this._staleTimers && this._staleTimers[k]) { clearTimeout(this._staleTimers[k]); delete this._staleTimers[k]; }
        this._connecting.add(k);
        crypto.subtle.importKey('jwk', d.k, { name:'ECDSA', namedCurve:'P-256' }, true, ['verify']).then(pub => {
            // Guard: another path may have already connected this peer
            if (this.peers.has(k) && this.peers.get(k)?.pc) { this._connecting.delete(k); return; }
            this.peers.set(k, { pc:null, ch:null, pub, name: d.u||'?', seq:0, keyId: d.kid||k, nonce: d.nonce||0, tierIcon: d.ti||0 });
            this._connect(k, d.kid, d.nonce||0);
        }).catch(() => { this._connecting.delete(k); });
    }

    async _rescanPeers(forceScan) {
        const { db, doc:fdoc, getDoc, getDocs, collection } = this.fs;
        if (!db || !getDocs) return;
        try {
            const host = this._computeHost(this._onlineUsernames);
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
            if (forceScan || this.peers.size === 0) {
                const snap = await getDocs(collection(db, 'sig'));
                for (const s of snap.docs) {
                    const k = s.id;
if (k === this.peerId) continue;
if (this.peers.has(k)) continue;
if (!this._isHost && host !== k) continue;
                    const d = s.data();
                    if (!d?.k || !d?.on) continue;
                    console.log('📡 P2P discovered peer via scan:', k);
                    const pub = await crypto.subtle.importKey('jwk', d.k, { name:'ECDSA', namedCurve:'P-256' }, true, ['verify']);
                    this.peers.set(k, { pc:null, ch:null, pub, name: d.u||'?', seq:0, keyId: d.kid||k, nonce: d.nonce||0 });
                    this._connect(k, d.kid, d.nonce||0);
                }
            }
        } catch (e) { console.warn('📡 P2P rescan error:', e.message); }
    }

    _elect() {
        return this._amHost();
    }
    _uploadIfElected() {
        if (!this._amHost() || !this.syncFn) return;
        for (const [, e] of this.ledger.m) {
            if (e.username && e.username !== 'self') {
                this.syncFn(e.username, e.score, e.prestige||0, e.pp, e.username, e.vps).catch(()=>{});
            }
        }
    }

    destroy() {
        clearInterval(this._uploadTimer);
        clearInterval(this._pingTimer);
        clearInterval(this._reconnectTimer);
        clearInterval(this._scanTimer);
        clearInterval(this._signalTimer);
        if (this._retryPending) { clearTimeout(this._retryPending); this._retryPending = null; }
        // Clear any pending stale-deletion timers
        if (this._staleTimers) { for (const k of Object.keys(this._staleTimers)) { clearTimeout(this._staleTimers[k]); } this._staleTimers = {}; }
        for (const k of [...this.peers.keys()]) this._onPeerGone(k, true);
        if (this._unsubPeers) this._unsubPeers();
        if (this._unsubOffers) this._unsubOffers();
        if (this._unsubIce) this._unsubIce();
    }
}

export { P2PLeaderboardManager };
