// ============================================================
// Hermes IdleViber — P2P Leaderboard (Firestore Signaling)
// Real-time score sharing via WebRTC mesh, Firestore as backup.
// ============================================================

// ---- Identity (Ed25519 keypair in localStorage) ----
const P2P_ID_KEY = 'hermes_idleviber_p2p_id';

function p2pGenerateId() {
    // Simple UUID v4 as player ID (crypto.subtle Ed25519 is
    // not available in all browsers, UUID is sufficient for
    // identity within a gaming context)
    return crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
}

function p2pGetOrCreateId(username) {
    // Scope P2P identity by account so different accounts on the same browser
    // get unique IDs (two browser tabs playing different accounts can P2P connect)
    const suffix = username ? '_' + username.replace(/[^a-zA-Z0-9]/g, '') : '';
    const key = P2P_ID_KEY + suffix;
    let id = localStorage.getItem(key);
    if (!id) {
        id = p2pGenerateId();
        localStorage.setItem(key, id);
    }
    return id;
}

// ---- WebRTC Configuration ----
const P2P_STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

const P2P_CONNECT_TIMEOUT = 5000; // 5s timeout for WebRTC connection
const P2P_POLL_INTERVAL = 30000;  // 30s fallback polling

// ---- Signaling via Firestore ----
// Documents:
//   signaling/{playerId}                — player metadata
//   signaling/{playerId}/offers/{peerId} — incoming WebRTC offers
//   signaling/{playerId}/answers/{peerId}— outgoing WebRTC answers

let p2pState = {
    playerId: null,
    username: null,
    db: null,           // Firestore db ref (set by init)
    peers: new Map(),   // peerId → { pc, channel, playerId, username }
    entries: new Map(), // peerId → latest ScoreEntry
    listeners: [],      // callback(entries[]) for leaderboard updates
    onlinePeers: new Set(), // peerIds currently in signaling
    unsubOffers: null,  // Firestore unsubscribe for incoming offers
    unsubPeers: null,   // Firestore unsubscribe for peer list
    lastEntry: null,    // our last broadcast entry
    entryCounter: 0,    // monotonic counter
    isFallback: false,  // true when P2P failed, using Firestore polling
    pollTimer: null,
    fbGetLeaderboard: null, // reference to firebase.js getLeaderboard
    fallbackEntries: [],
    fallbackUnsub: null,
};

// ---- PUBLIC API ----

function p2pInit(db, username, fbGetLeaderboard, firestoreApi) {
    p2pState.playerId = p2pGetOrCreateId(username);
    p2pState.username = username || 'Player';
    p2pState.db = db;
    p2pState.fbGetLeaderboard = fbGetLeaderboard;
    p2pState.entryCounter = 0;
    p2pState.lastEntry = null;
    p2pState.peers.clear();
    p2pState.entries.clear();
    p2pState.onlinePeers.clear();
    p2pState.isFallback = false;

    // Store Firestore API for signaling use
    if (firestoreApi) {
        window._p2p_firestore = firestoreApi;
    }

    // Clean up any existing listeners
    p2pCleanup();
}

function p2pStart() {
    if (!p2pState.db) return;

    console.log('📡 P2P: starting with ID', p2pState.playerId.substr(0, 8) + '...');

    // Start listening for incoming offers
    p2pStartSignalingListener();

    // Discover and connect to online peers
    p2pDiscoverPeers();

    // Set a timeout — if no peers connect within 5s, fall back to polling
    setTimeout(() => {
        if (p2pState.peers.size === 0 && !p2pState.isFallback) {
            p2pEnableFallback();
        }
    }, P2P_CONNECT_TIMEOUT + 1000);
}

function p2pCleanup() {
    // Close all peer connections
    for (const [peerId, peer] of p2pState.peers) {
        try { peer.pc.close(); } catch (_) {}
    }
    p2pState.peers.clear();

    // Unsubscribe Firestore listeners
    if (p2pState.unsubOffers) { p2pState.unsubOffers(); p2pState.unsubOffers = null; }
    if (p2pState.unsubPeers) { p2pState.unsubPeers(); p2pState.unsubPeers = null; }
    if (p2pState.fallbackUnsub) { p2pState.fallbackUnsub(); p2pState.fallbackUnsub = null; }

    if (p2pState.pollTimer) { clearInterval(p2pState.pollTimer); p2pState.pollTimer = null; }

    p2pState.isFallback = false;
    p2pState.onlinePeers.clear();
}

// Broadcast a score update to all connected peers
function p2pBroadcastScore(score, prestigeLevel, vps, totalPp) {
    p2pState.entryCounter++;
    const entry = {
        playerId: p2pState.playerId,
        username: p2pState.username,
        score: Array.isArray(score) ? score : [Math.floor(score) || 0, 0],
        prestigeLevel: prestigeLevel || 0,
        vps: Array.isArray(vps) ? vps : [vps || 0, 0],
        totalPp: Array.isArray(totalPp) ? totalPp : [totalPp || 0, 0],
        counter: p2pState.entryCounter,
        timestamp: Date.now(),
    };
    p2pState.lastEntry = entry;
    // Update our own entry in the leaderboard
    p2pState.entries.set(p2pState.playerId, entry);
    p2pNotifyListeners();

    // Broadcast to all connected peers via DataChannel
    const msg = JSON.stringify({ type: 'score', entry });
    for (const [peerId, peer] of p2pState.peers) {
        if (peer.channel && peer.channel.readyState === 'open') {
            try { peer.channel.send(msg); } catch (_) {}
        }
    }
}

// Subscribe to leaderboard updates
function p2pSubscribe(callback) {
    p2pState.listeners.push(callback);
    // Fire immediately with current data
    callback(p2pGetLeaderboard());
    return () => {
        p2pState.listeners = p2pState.listeners.filter(f => f !== callback);
    };
}

// Get current merged leaderboard (from P2P + Firestore fallback)
function p2pGetLeaderboard() {
    const entries = [];

    // P2P entries
    for (const [id, entry] of p2pState.entries) {
        if (id === p2pState.playerId) continue; // skip self (added after)
        entries.push({
            playerId: id,
            username: entry.username || 'Unknown',
            score: entry.score || [0, 0],
            prestigeLevel: entry.prestigeLevel || 0,
            vps: entry.vps || [0, 0],
            totalPp: entry.totalPp || [0, 0],
            timestamp: entry.timestamp || 0,
        });
    }

    // Fallback Firestore entries (only if no P2P data for that player)
    if (p2pState.isFallback) {
        for (const fe of p2pState.fallbackEntries) {
            if (!p2pState.entries.has(fe.uid)) {
                entries.push({
                    playerId: fe.uid,
                    username: fe.username,
                    score: fe.score_full || [fe.score || 0, 0],
                    prestigeLevel: fe.prestige_level || 0,
                    vps: fe.vps_full || [fe.vps || 0, 0],
                    totalPp: fe.pp_full || [fe.total_pp || 0, 0],
                    timestamp: 0,
                });
            }
        }
    }

    // Add self
    if (p2pState.lastEntry) {
        entries.push({
            playerId: p2pState.playerId,
            username: p2pState.lastEntry.username,
            score: p2pState.lastEntry.score,
            prestigeLevel: p2pState.lastEntry.prestigeLevel,
            vps: p2pState.lastEntry.vps,
            totalPp: p2pState.lastEntry.totalPp,
            timestamp: p2pState.lastEntry.timestamp,
        });
    }

    // Sort: prestigeLevel desc, then totalPp desc, then score desc
    entries.sort((a, b) => {
        if (b.prestigeLevel !== a.prestigeLevel) return b.prestigeLevel - a.prestigeLevel;
        const ppCmp = p2pBNCompare(b.totalPp, a.totalPp);
        if (ppCmp !== 0) return ppCmp;
        return p2pBNCompare(b.score, a.score);
    });

    // Assign ranks
    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}

// ---- INTERNAL ----

function p2pStartSignalingListener() {
    if (!p2pState.db || !p2pState.playerId) return;

    // Write our presence to signaling
    const { doc, setDoc, deleteDoc, collection, query, onSnapshot, Timestamp } = window._p2p_firestore || {};

    if (!doc || !setDoc) {
        // Firestore not loaded yet, try again in 1s
        setTimeout(p2pStartSignalingListener, 1000);
        return;
    }

    const myRef = doc(p2pState.db, 'signaling', p2pState.playerId);

    // Write our presence
    setDoc(myRef, {
        username: p2pState.username,
        online: true,
        last_seen: Timestamp.now(),
    }, { merge: true }).catch(() => {});

    // Listen for incoming offers from other peers
    const offersRef = collection(p2pState.db, 'signaling', p2pState.playerId, 'offers');
    p2pState.unsubOffers = onSnapshot(offersRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const offerData = change.doc.data();
                const peerId = change.doc.id;
                if (peerId === p2pState.playerId) return; // skip self
                if (p2pState.peers.has(peerId)) return; // already connected
                if (offerData.type === 'offer' && offerData.sdp) {
                    // Incoming WebRTC offer — answer it
                    p2pHandleIncomingOffer(peerId, offerData.sdp);
                }
            }
        });
    }, (err) => {
        console.warn('📡 P2P offers listener error:', err.message);
    });

    // Listen for peer presence changes (who's online)
    const allPeersQuery = query(collection(p2pState.db, 'signaling'));
    p2pState.unsubPeers = onSnapshot(allPeersQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const peerId = change.doc.id;
            if (peerId === p2pState.playerId) return;
            const data = change.doc.data();
            if (change.type === 'added' || change.type === 'modified') {
                if (data.online) {
                    p2pState.onlinePeers.add(peerId);
                    // Try to connect to this peer if we're not already
                    if (!p2pState.peers.has(peerId)) {
                        p2pInitiateConnection(peerId);
                    }
                } else {
                    p2pState.onlinePeers.delete(peerId);
                }
            } else if (change.type === 'removed') {
                p2pState.onlinePeers.delete(peerId);
                p2pRemovePeer(peerId);
            }
        });
    }, (err) => {
        console.warn('📡 P2P peers listener error:', err.message);
    });
}

function p2pDiscoverPeers() {
    if (!p2pState.db) return;
    const { collection, getDocs } = window._p2p_firestore || {};
    if (!collection || !getDocs) return;

    // Get all online peers and initiate connections
    getDocs(collection(p2pState.db, 'signaling')).then((snapshot) => {
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (doc.id === p2pState.playerId) continue;
            if (data.online && !p2pState.peers.has(doc.id)) {
                p2pState.onlinePeers.add(doc.id);
                p2pInitiateConnection(doc.id);
            }
        }
    }).catch(() => {});
}

function p2pInitiateConnection(peerId) {
    if (p2pState.peers.has(peerId)) return;

    try {
        const pc = new RTCPeerConnection(P2P_STUN_SERVERS);
        const channel = pc.createDataChannel('leaderboard');

        const peer = { pc, channel, peerId, connected: false };

        channel.onopen = () => {
            peer.connected = true;
            console.log('📡 P2P: connected to peer', peerId.substr(0, 8) + '...');
            // Send our current score to the new peer
            if (p2pState.lastEntry) {
                channel.send(JSON.stringify({ type: 'score', entry: p2pState.lastEntry }));
            }
        };

        channel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                p2pHandleMessage(peerId, msg);
            } catch (_) {}
        };

        channel.onclose = () => {
            peer.connected = false;
            p2pRemovePeer(peerId);
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                p2pRemovePeer(peerId);
            }
        };

        p2pState.peers.set(peerId, peer);

        // Create offer and send via Firestore
        pc.createOffer().then((offer) => {
            return pc.setLocalDescription(offer);
        }).then(() => {
            // Write our offer to the peer's Firestore signaling doc
            const { doc, setDoc } = window._p2p_firestore || {};
            if (doc && setDoc) {
                const offerRef = doc(p2pState.db, 'signaling', peerId, 'offers', p2pState.playerId);
                setDoc(offerRef, {
                    type: 'offer',
                    sdp: pc.localDescription,
                    from: p2pState.playerId,
                    from_username: p2pState.username,
                    timestamp: Date.now(),
                }).catch(() => {});
            }
        }).catch((err) => {
            console.warn('📡 P2P offer creation failed:', err.message);
            p2pRemovePeer(peerId);
        });

        // Connection timeout
        setTimeout(() => {
            const p = p2pState.peers.get(peerId);
            if (p && !p.connected) {
                // Failed to connect — clean up and try fallback
                p2pRemovePeer(peerId);
            }
        }, P2P_CONNECT_TIMEOUT);

    } catch (e) {
        console.warn('📡 P2P initiate failed:', e.message);
        p2pRemovePeer(peerId);
    }
}

function p2pHandleIncomingOffer(peerId, sdp) {
    if (p2pState.peers.has(peerId)) return;

    try {
        const pc = new RTCPeerConnection(P2P_STUN_SERVERS);
        const channel = pc.createDataChannel('leaderboard');

        const peer = { pc, channel, peerId, connected: false };

        channel.onopen = () => {
            peer.connected = true;
            if (p2pState.lastEntry) {
                channel.send(JSON.stringify({ type: 'score', entry: p2pState.lastEntry }));
            }
        };

        channel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                p2pHandleMessage(peerId, msg);
            } catch (_) {}
        };

        channel.onclose = () => {
            peer.connected = false;
            p2pRemovePeer(peerId);
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                p2pRemovePeer(peerId);
            }
        };

        p2pState.peers.set(peerId, peer);

        // Set remote description and create answer
        pc.setRemoteDescription(new RTCSessionDescription(sdp)).then(() => {
            return pc.createAnswer();
        }).then((answer) => {
            return pc.setLocalDescription(answer);
        }).then(() => {
            // Write answer back via Firestore
            const { doc, setDoc } = window._p2p_firestore || {};
            if (doc && setDoc) {
                const answerRef = doc(p2pState.db, 'signaling', peerId, 'offers', p2pState.playerId);
                setDoc(answerRef, {
                    type: 'answer',
                    sdp: pc.localDescription,
                    from: p2pState.playerId,
                    from_username: p2pState.username,
                    timestamp: Date.now(),
                }).catch(() => {});
                // Clean up the offer doc after answering
                setTimeout(() => {
                    const { deleteDoc } = window._p2p_firestore || {};
                    if (deleteDoc) {
                        deleteDoc(answerRef).catch(() => {});
                    }
                }, 2000);
            }
        }).catch((err) => {
            console.warn('📡 P2P answer creation failed:', err.message);
            p2pRemovePeer(peerId);
        });

        setTimeout(() => {
            const p = p2pState.peers.get(peerId);
            if (p && !p.connected) {
                p2pRemovePeer(peerId);
            }
        }, P2P_CONNECT_TIMEOUT);

    } catch (e) {
        console.warn('📡 P2P handle offer failed:', e.message);
        p2pRemovePeer(peerId);
    }
}

function p2pHandleMessage(peerId, msg) {
    switch (msg.type) {
        case 'score':
            if (msg.entry && msg.entry.playerId && msg.entry.counter) {
                const existing = p2pState.entries.get(msg.entry.playerId);
                if (!existing || msg.entry.counter > existing.counter) {
                    p2pState.entries.set(msg.entry.playerId, msg.entry);
                    p2pNotifyListeners();
                }
            }
            break;
    }
}

function p2pRemovePeer(peerId) {
    const peer = p2pState.peers.get(peerId);
    if (peer) {
        try { peer.channel.close(); } catch (_) {}
        try { peer.pc.close(); } catch (_) {}
        p2pState.peers.delete(peerId);
    }
    // Don't remove from entries — keep last known score
}

function p2pNotifyListeners() {
    const board = p2pGetLeaderboard();
    for (const cb of p2pState.listeners) {
        try { cb(board); } catch (_) {}
    }
}

// ---- FALLBACK: Firestore Polling (when P2P fails) ----

function p2pEnableFallback() {
    if (p2pState.isFallback) return;
    p2pState.isFallback = true;
    console.log('📡 P2P: using Firestore polling fallback');

    // Try Firestore onSnapshot for live updates (works for everyone)
    if (p2pState.db && window._p2p_firestore) {
        const { collection, query, orderBy, limit, onSnapshot } = window._p2p_firestore;
        const q = query(
            collection(p2pState.db, 'leaderboard'),
            orderBy('score', 'desc'),
            limit(50)
        );
        p2pState.fallbackUnsub = onSnapshot(q, (snapshot) => {
            p2pState.fallbackEntries = snapshot.docs.map((d, i) => ({
                uid: d.id,
                username: d.data().display_name || d.data().username || 'Unknown',
                score: d.data().score || 0,
                prestige_level: d.data().prestige_level || 0,
                total_pp: d.data().total_pp || 0,
                vps: d.data().vps || 0,
                score_full: d.data().score_full || null,
                pp_full: d.data().pp_full || null,
                vps_full: d.data().vps_full || null,
            }));
            // Only notify if we have no P2P peers
            if (p2pState.peers.size === 0) {
                // Fallback shows Firestore entries directly
                const entries = p2pState.fallbackEntries.map((e, i) => ({
                    playerId: e.uid,
                    username: e.username,
                    score: e.score_full || [e.score || 0, 0],
                    prestigeLevel: e.prestige_level || 0,
                    vps: e.vps_full || [e.vps || 0, 0],
                    totalPp: e.pp_full || [e.total_pp || 0, 0],
                    rank: i + 1,
                }));

                // Add self
                if (p2pState.lastEntry) {
                    entries.push({
                        playerId: p2pState.playerId,
                        username: p2pState.lastEntry.username,
                        score: p2pState.lastEntry.score,
                        prestigeLevel: p2pState.lastEntry.prestigeLevel,
                        vps: p2pState.lastEntry.vps,
                        totalPp: p2pState.lastEntry.totalPp,
                        rank: 0,
                    });
                    // Re-sort
                    entries.sort((a, b) => {
                        if (b.prestigeLevel !== a.prestigeLevel) return b.prestigeLevel - a.prestigeLevel;
                        const ppCmp = p2pBNCompare(b.totalPp, a.totalPp);
                        if (ppCmp !== 0) return ppCmp;
                        return p2pBNCompare(b.score, a.score);
                    });
                    entries.forEach((e, i) => e.rank = i + 1);
                }

                for (const cb of p2pState.listeners) {
                    try { cb(entries); } catch (_) {}
                }
            }
        }, (err) => {
            console.warn('📡 P2P fallback listener error:', err.message);
            // If onSnapshot fails too, use polling
            p2pStartPolling();
        });
    } else {
        p2pStartPolling();
    }
}

function p2pStartPolling() {
    if (p2pState.pollTimer) return;
    p2pState.pollTimer = setInterval(async () => {
        if (!p2pState.fbGetLeaderboard) return;
        try {
            const fbEntries = await p2pState.fbGetLeaderboard(50);
            if (fbEntries && fbEntries.length > 0) {
                p2pState.fallbackEntries = fbEntries;
                const entries = fbEntries.map((e, i) => ({
                    playerId: e.uid,
                    username: e.username,
                    score: e.score_full || [e.score || 0, 0],
                    prestigeLevel: e.prestige_level || 0,
                    vps: e.vps_full || [e.vps || 0, 0],
                    totalPp: e.pp_full || [e.total_pp || 0, 0],
                    rank: i + 1,
                }));
                for (const cb of p2pState.listeners) {
                    try { cb(entries); } catch (_) {}
                }
            }
        } catch (_) {}
    }, P2P_POLL_INTERVAL);
}

// ---- UTILITY ----

function p2pBNCompare(a, b) {
    if (!a || !b) return 0;
    const aArr = Array.isArray(a) ? a : [a, 0];
    const bArr = Array.isArray(b) ? b : [b, 0];
    if (aArr[0] === 0 && bArr[0] === 0) return 0;
    if (aArr[0] === 0) return -1;
    if (bArr[0] === 0) return 1;
    if (aArr[1] > bArr[1]) return 1;
    if (aArr[1] < bArr[1]) return -1;
    return aArr[0] > bArr[0] ? 1 : aArr[0] < bArr[0] ? -1 : 0;
}

// ---- EXPORT ----
export {
    p2pInit,
    p2pStart,
    p2pCleanup,
    p2pBroadcastScore,
    p2pSubscribe,
    p2pGetLeaderboard,
    p2pEnableFallback,
};
