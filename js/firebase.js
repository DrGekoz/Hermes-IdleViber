// ============================================================
// Hermes IdleViber — Firebase Integration
// Auth (Email/Password + Google + GitHub) + Firestore
// ============================================================

import { FIREBASE_CONFIG } from '../firebase-config.js';

// Load Firebase SDKs from CDN
const FB_BASE = 'https://www.gstatic.com/firebasejs/10.14.1/';

let app = null;
let auth = null;
let db = null;
let firebaseLoaded = false;
let currentUser = null;
let unsubLeaderboard = null;
let authListeners = [];

// ---- INIT ----
async function initFirebase() {
    if (firebaseLoaded) return true;

    // Check config
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
        console.warn('🔥 Firebase not configured — fill in firebase-config.js');
        return false;
    }

    try {
        const { initializeApp } = await import(`${FB_BASE}firebase-app.js`);
        const { getAuth, connectAuthEmulator } = await import(`${FB_BASE}firebase-auth.js`);
        const { getFirestore, connectFirestoreEmulator } = await import(`${FB_BASE}firebase-firestore.js`);

        app = initializeApp(FIREBASE_CONFIG);
        auth = getAuth(app);
        db = getFirestore(app);

        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            currentUser = user;
            for (const fn of authListeners) fn(user);
        });

        firebaseLoaded = true;
        console.log('🔥 Firebase initialized');
        return true;
    } catch (e) {
        console.error('🔥 Firebase init failed:', e);
        return false;
    }
}

function onAuthChanged(fn) {
    authListeners.push(fn);
    if (currentUser !== null) fn(currentUser); // fire immediately if already signed in
    return () => { authListeners = authListeners.filter(f => f !== fn); };
}

function getCurrentUser() { return currentUser; }
function isConfigured() { return firebaseLoaded && !!auth; }

// ---- AUTH HELPERS ----
function usernameToEmail(username) {
    return `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@idleviber.hermes`;
}

// ---- AUTH: Email/Password ----
async function registerWithEmail(username, password) {
    // Reserved: DrGekoz is the game dev
    if (/^drgekoz$/i.test(username)) {
        return { error: 'That username is reserved' };
    }
    const { createUserWithEmailAndPassword, updateProfile } = await import(`${FB_BASE}firebase-auth.js`);
    try {
        const email = usernameToEmail(username);
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: username });
        return { success: true, user: cred.user, uid: cred.user.uid };
    } catch (e) {
        let msg = e.message;
        if (e.code === 'auth/email-already-in-use') msg = 'Username already taken';
        else if (e.code === 'auth/weak-password') msg = 'Password too weak (min 6 chars)';
        return { error: msg };
    }
}

async function loginWithEmail(username, password) {
    const { signInWithEmailAndPassword } = await import(`${FB_BASE}firebase-auth.js`);
    try {
        const email = usernameToEmail(username);
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: cred.user, uid: cred.user.uid };
    } catch (e) {
        let msg = e.message;
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
            msg = 'Invalid username or password';
        }
        return { error: msg };
    }
}

// ---- AUTH: Google ----
async function loginWithGoogle() {
    const { signInWithPopup, GoogleAuthProvider } = await import(`${FB_BASE}firebase-auth.js`);
    try {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        return { success: true, user: cred.user, uid: cred.user.uid };
    } catch (e) {
        if (e.code === 'auth/popup-closed-by-user') return { error: 'Sign-in cancelled' };
        return { error: e.message };
    }
}

// ---- AUTH: GitHub ----
async function loginWithGitHub() {
    const { signInWithPopup, GithubAuthProvider } = await import(`${FB_BASE}firebase-auth.js`);
    try {
        const provider = new GithubAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        return { success: true, user: cred.user, uid: cred.user.uid };
    } catch (e) {
        if (e.code === 'auth/popup-closed-by-user') return { error: 'Sign-in cancelled' };
        return { error: e.message };
    }
}

// ---- AUTH: Logout ----
async function logout() {
    const { signOut } = await import(`${FB_BASE}firebase-auth.js`);
    try {
        await signOut(auth);
        currentUser = null;
        if (unsubLeaderboard) { unsubLeaderboard(); unsubLeaderboard = null; }
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

// ---- LEADERBOARD ----
async function submitScoreToLeaderboard(username, score, prestigeLevel, totalPp, displayName) {
    if (!currentUser || !db) {
        console.warn('🔥 LB submit skipped: no user/db', {hasUser:!!currentUser, hasDb:!!db});
        return { error: 'Not logged in' };
    }
    const { doc, setDoc, Timestamp } = await import(`${FB_BASE}firebase-firestore.js`);
    try {
        const ref = doc(db, 'leaderboard', currentUser.uid);
        await setDoc(ref, {
            username: displayName || username || currentUser.displayName || 'Player',
            score: Math.floor(score) || 0,
            prestige_level: prestigeLevel || 0,
            total_pp: totalPp || 0,
            display_name: displayName || '',
            updated_at: Timestamp.now(),
        }, { merge: true });
        return { success: true };
    } catch (e) {
        console.error('🔥 LB submit FAILED:', e.message);
        return { error: e.message };
    }
}

async function getLeaderboard(limitCount = 50) {
    if (!db) return [];
    const { collection, query, orderBy, limit, getDocs } = await import(`${FB_BASE}firebase-firestore.js`);
    try {
        const q = query(
            collection(db, 'leaderboard'),
            orderBy('score', 'desc'),
            limit(limitCount)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d, i) => ({
            uid: d.id,
            rank: i + 1,
            username: d.data().display_name || d.data().username || 'Unknown',
            score: d.data().score || 0,
            prestige_level: d.data().prestige_level || 0,
            total_pp: d.data().total_pp || 0,
        }));
    } catch (e) {
        console.warn('Leaderboard fetch error:', e.message);
        return [];
    }
}

// Real-time leaderboard listener (for live updates)
// Returns unsubscribe function
function subscribeLeaderboard(callback, limitCount = 50) {
    if (!db) return null;
    let unsub = () => {};
    import(`${FB_BASE}firebase-firestore.js`).then(({ collection, query, orderBy, limit, onSnapshot }) => {
        if (!db) return;
        const q = query(
            collection(db, 'leaderboard'),
            orderBy('score', 'desc'),
            limit(limitCount)
        );
        const realUnsub = onSnapshot(q, (snapshot) => {
            const entries = snapshot.docs.map((d, i) => ({
                uid: d.id,
                rank: i + 1,
                username: d.data().display_name || d.data().username || 'Unknown',
                score: d.data().score || 0,
                prestige_level: d.data().prestige_level || 0,
                total_pp: d.data().total_pp || 0,
            }));
            try { callback(entries); } catch (_) {}
        }, (err) => {
            console.warn('🔥 Leaderboard listener error:', err.message);
        });
        unsub = realUnsub;
    }).catch(err => {
        console.error('🔥 Failed to load Firestore:', err);
    });
    return () => unsub();
}

// ---- SAVES ----
async function savePlayerData(gameState) {
    if (!currentUser || !db) return { error: 'Not logged in' };
    const { doc, setDoc, Timestamp } = await import(`${FB_BASE}firebase-firestore.js`);
    try {
        const ref = doc(db, 'saves', currentUser.uid);
        // Store the full game state (omit functions and large temp data)
        const saveData = {};
        const state = gameState || {};
        // Whitelist what to save
        const saveKeys = [
            'vibes', 'lifetime_vibes', 'prestige_points', 'total_pp_earned',
            'total_prestiges', 'autoclickers', 'gateway_upgrades', 'decor',
            'current_room', 'unlocked_rooms', 'owned_decor', 'active_decor',

            'gateway_history', 'placed_decor', 'gateway_bonus_active',
            'total_clicks', 'total_gateway_pings', 'achievements', 'settings',
            'displayName', 'display_name_last_changed',
            'last_save', 'prestige_upgrades',
        ];
        for (const key of saveKeys) {
            if (state[key] !== undefined) saveData[key] = state[key];
        }
        await setDoc(ref, {
            game_state: saveData,
            updated_at: Timestamp.now(),
        }, { merge: true });
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

async function loadPlayerData() {
    if (!currentUser || !db) return null;
    const { doc, getDoc } = await import(`${FB_BASE}firebase-firestore.js`);
    try {
        const ref = doc(db, 'saves', currentUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return snap.data().game_state || null;
        }
        return null;
    } catch (e) {
        console.warn('Cloud load failed:', e.message);
        return null;
    }
}

// ---- DISPLAY NAME UNIQUENESS ----
// Checks if a display name is available (not claimed by another user)
async function checkDisplayNameAvailable(name) {
    if (!db || !currentUser) return { available: false, error: 'Not logged in' };
    const { collection, query, where, getDocs } = await import(`${FB_BASE}firebase-firestore.js`);
    try {
        const q = query(collection(db, 'display_names'), where('name', '==', name));
        const snap = await getDocs(q);
        if (snap.empty) return { available: true };
        // Check if it belongs to current user
        const match = snap.docs.find(d => d.data().uid === currentUser.uid);
        return { available: !!match, owner: match ? null : snap.docs[0].data().uid };
    } catch (e) {
        return { available: true, error: e.message }; // Fail open
    }
}

// Claim a display name (releases old one if owned by current user)
async function claimDisplayName(name, oldName) {
    if (!db || !currentUser) return { success: false, error: 'Not logged in' };
    const { doc, setDoc, deleteDoc, getDocs, collection, query, where, Timestamp } = await import(`${FB_BASE}firebase-firestore.js`);
    try {
        // Release old name if owned by current user
        if (oldName && oldName !== name) {
            const oldQ = query(collection(db, 'display_names'), where('name', '==', oldName));
            const oldSnap = await getDocs(oldQ);
            for (const d of oldSnap.docs) {
                if (d.data().uid === currentUser.uid) {
                    await deleteDoc(doc(db, 'display_names', d.id));
                }
            }
        }
        // Claim new name
        await setDoc(doc(db, 'display_names', `${currentUser.uid}_${name}`), {
            name,
            uid: currentUser.uid,
            claimed_at: Timestamp.now(),
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ---- EXPORTS ----
export {
    initFirebase,
    onAuthChanged,
    getCurrentUser,
    isConfigured,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    loginWithGitHub,
    logout,
    submitScoreToLeaderboard,
    getLeaderboard,
    subscribeLeaderboard,
    savePlayerData,
    loadPlayerData,
    checkDisplayNameAvailable,
    claimDisplayName,
};
