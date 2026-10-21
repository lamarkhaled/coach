import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, get, child, update, onValue, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

export function initAuth() {
    let isRegisterMode = false;

    document.getElementById('showLoginBtn').onclick = () => { isRegisterMode = false; document.getElementById('authTitle').innerText = 'تسجيل الدخول'; window.showSection('authSection'); };
    document.getElementById('showRegisterBtn').onclick = () => { isRegisterMode = true; document.getElementById('authTitle').innerText = 'حساب جديد'; window.showSection('authSection'); };
    document.getElementById('backToWelcomeBtn').onclick = () => window.showSection('welcomeSection');
    
    document.getElementById('logoutBtn').onclick = async () => {
        if(auth.currentUser && auth.currentUser.email === window.adminEmail) {
            await set(ref(db, 'admin_status'), { online: false, lastSeen: serverTimestamp() });
        }
        signOut(auth);
    };

    document.getElementById('mainAuthBtn').onclick = async () => {
        const email = document.getElementById('emailInput').value.trim();
        const pass = document.getElementById('passwordInput').value.trim();
        if(!email || !pass) return window.showMsg("أدخلي الإيميل وكلمة المرور");
        try {
            const btn = document.getElementById('mainAuthBtn');
            btn.innerText = 'جاري التحميل...';
            if(isRegisterMode) await createUserWithEmailAndPassword(auth, email, pass);
            else await signInWithEmailAndPassword(auth, email, pass);
        } catch(e) { 
            window.showMsg(e.message); 
            document.getElementById('mainAuthBtn').innerText = 'متابعة';
        }
    };

    document.getElementById('activateSubscriptionBtn').onclick = async () => {
        const code = document.getElementById('activationCodeInput').value.trim().toUpperCase();
        if(!code) return window.showMsg("أدخلي الكود");
        try {
            const snap = await get(child(ref(db), `codes/${code}`));
            if(!snap.exists() || snap.val().used) throw new Error("كود غير صالح أو مستخدم");
            const c = snap.val();
            const ms = ((c.days||0)*86400000) + ((c.hours||0)*3600000) + ((c.mins||0)*60000);
            const end = new Date(Date.now() + ms);
            
            await update(ref(db, `users/${auth.currentUser.uid}`), {
                email: auth.currentUser.email,
                startDate: window.activeUserData?.startDate || new Date().toISOString(),
                endDate: end.toISOString(),
                onboardingCompleted: window.activeUserData?.onboardingCompleted || false,
                usedCode: code
            });
            await update(ref(db, `codes/${code}`), { used: true, usedBy: auth.currentUser.email });
            if(window.activeUserData?.onboardingCompleted) {
                window.showSection('userDashboard');
            } else {
                window.showSection('onboardingSection');
            }
        } catch(e) { window.showMsg(e.message); }
    };

    document.getElementById('saveOnboardingBtn').onclick = async () => {
        const goal = document.getElementById('qGoal').value;
        const weight = parseFloat(document.getElementById('qWeight').value) || 0;
        const height = parseFloat(document.getElementById('qHeight').value) || 0;
        const targetKg = parseFloat(document.getElementById('qTargetKg').value) || 0;
        const targetDays = parseInt(document.getElementById('qTargetDays').value) || 30;
        const notes = document.getElementById('qNotes').value;

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + targetDays);
        const initialHistory = {};
        initialHistory[new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })] = weight;

        await update(ref(db, `users/${auth.currentUser.uid}`), {
            onboardingCompleted: true,
            profile: { goal, weight, height, notes },
            goalPlan: { startWeight: weight, targetWeight: targetKg, startDate: new Date().toISOString(), targetDate: targetDate.toISOString() },
            progress: { weightHistory: initialHistory, currentWeight: weight }
        });
        const snap = await get(child(ref(db), `users/${auth.currentUser.uid}`));
        window.renderUserDashboard(snap.val());
        window.showSection('userDashboard');
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) return window.showSection('welcomeSection');
        if (user.email === window.adminEmail) {
            window.showSection('adminDashboard');
            document.getElementById('adminMainView').classList.remove('hidden');
            document.getElementById('adminUserDetailView').classList.add('hidden');
            
            const adminStatusRef = ref(db, 'admin_status');
            onDisconnect(adminStatusRef).set({ online: false, lastSeen: serverTimestamp() });
            set(adminStatusRef, { online: true, lastSeen: serverTimestamp() });

            if(window.loadAdminCodes) window.loadAdminCodes();
            if(window.loadAdminUsers) window.loadAdminUsers();
            return;
        }
        onValue(ref(db, `users/${user.uid}`), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                window.activeUserData = data;
                if (data.endDate && new Date() > new Date(data.endDate)) {
                    window.showSection('activationSection');
                } else if (!data.onboardingCompleted) {
                    window.showSection('onboardingSection');
                } else {
                    if(document.getElementById('userDashboard').classList.contains('hidden')) {
                        window.showSection('userDashboard');
                    }
                    if(window.renderUserDashboard) window.renderUserDashboard(data);
                }
            }
        });
    });
}
