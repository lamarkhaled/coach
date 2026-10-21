import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateEmail, updatePassword, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, get, child, update, onValue, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

export function initAuth() {
    let isRegisterMode = false;

    const translateErr = (e) => {
        const msg = e.code || e.message || "";
        if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
        if (msg.includes('email-already-in-use')) return 'هذا البريد الإلكتروني مسجل مسبقاً.';
        if (msg.includes('weak-password')) return 'كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل.';
        if (msg.includes('invalid-email')) return 'صيغة البريد الإلكتروني غير صحيحة.';
        if (msg.includes('network-request-failed')) return 'تأكدي من اتصالك بالإنترنت.';
        if (msg.includes('too-many-requests')) return 'تم حظر الحساب مؤقتاً لكثرة المحاولات، جربي بعد قليل.';
        return 'حدث خطأ، يرجى المحاولة لاحقاً.';
    };

    const btnLogin = document.getElementById('showLoginBtn');
    if(btnLogin) btnLogin.onclick = () => { 
        isRegisterMode = false; 
        document.getElementById('authTitle').innerText = 'تسجيل الدخول'; 
        document.getElementById('nameInput').classList.add('hidden');
        document.getElementById('authLinks').classList.remove('hidden');
        window.showSection('authSection'); 
    };
    
    const btnReg = document.getElementById('showRegisterBtn');
    if(btnReg) btnReg.onclick = () => { 
        isRegisterMode = true; 
        document.getElementById('authTitle').innerText = 'حساب جديد'; 
        document.getElementById('nameInput').classList.remove('hidden');
        document.getElementById('authLinks').classList.add('hidden');
        window.showSection('authSection'); 
    };
    
    const btnBack = document.getElementById('backToWelcomeBtn');
    if(btnBack) btnBack.onclick = () => window.showSection('welcomeSection');
    
    const btnOut = document.getElementById('logoutBtn');
    if(btnOut) btnOut.onclick = async () => {
        if(auth.currentUser && auth.currentUser.email === window.adminEmail) { await set(ref(db, 'admin_status'), { online: false, lastSeen: serverTimestamp() }); }
        signOut(auth);
    };

    const btnProf = document.getElementById('profileBtn');
    if(btnProf) btnProf.onclick = () => { 
        document.getElementById('updateNameInput').value = window.activeUserData?.profile?.name || '';
        document.getElementById('updateEmailInput').value = auth.currentUser.email || '';
        document.getElementById('updatePassInput').value = '';
        document.getElementById('profileModal').classList.remove('hidden'); 
    };

    const forgotPassBtn = document.getElementById('forgotPassBtn');
    if(forgotPassBtn) {
        forgotPassBtn.onclick = async () => {
            const email = document.getElementById('emailInput').value.trim();
            if(!email) return window.showMsg("اكتبي إيميلك أولاً في الخانة فوق ☝️", true);
            try {
                await sendPasswordResetEmail(auth, email);
                window.showMsg("تم إرسال رابط استعادة كلمة المرور لإيميلك ✔️", false);
            } catch(e) { window.showMsg(translateErr(e), true); }
        };
    }

    const resendVerifyEmailBtn = document.getElementById('resendVerifyEmailBtn');
    if(resendVerifyEmailBtn) {
        resendVerifyEmailBtn.onclick = async () => {
            if(auth.currentUser) {
                try {
                    await sendEmailVerification(auth.currentUser);
                    window.showMsg("تم إرسال رابط التفعيل مرة أخرى! شيكي إيميلك ✔️", false);
                } catch(e) { window.showMsg(translateErr(e), true); }
            }
        };
    }

    const verifyDoneBtn = document.getElementById('verifyDoneBtn');
    if(verifyDoneBtn) {
        verifyDoneBtn.onclick = async () => {
            if(auth.currentUser) {
                await auth.currentUser.reload();
                if(auth.currentUser.emailVerified) {
                    window.showMsg("تم التفعيل بنجاح! جاري الدخول...", false);
                    window.location.reload();
                } else {
                    window.showMsg("الحساب لا زال غير مفعل، شيكي إيميلك واضغطي الرابط.", true);
                }
            }
        };
    }

    window.saveProfileUpdate = async () => {
        const newNm = document.getElementById('updateNameInput').value.trim();
        const newEm = document.getElementById('updateEmailInput').value.trim();
        const newPw = document.getElementById('updatePassInput').value.trim();
        if(!newEm && !newPw && !newNm) return window.showMsg("لا توجد تعديلات");
        try {
            if(newNm) {
                await update(ref(db, `users/${auth.currentUser.uid}/profile`), { name: newNm });
                if(window.activeUserData) {
                    window.activeUserData.profile = window.activeUserData.profile || {};
                    window.activeUserData.profile.name = newNm;
                }
                document.getElementById('userEmailDisplay').innerText = newNm;
            }
            if(newEm && newEm !== auth.currentUser.email) {
                await updateEmail(auth.currentUser, newEm);
                await update(ref(db, `users/${auth.currentUser.uid}`), { email: newEm });
                if(!newNm) document.getElementById('userEmailDisplay').innerText = newEm;
            }
            if(newPw) {
                await updatePassword(auth.currentUser, newPw);
            }
            window.showMsg("تم تحديث البيانات بنجاح ✔️", false);
            document.getElementById('updateEmailInput').value = ''; document.getElementById('updatePassInput').value = '';
            document.getElementById('profileModal').classList.add('hidden');
        } catch(e) {
            if(e.code === 'auth/requires-recent-login') {
                window.showMsg("يرجى تسجيل الخروج والدخول مجدداً لتأكيد التعديل للأمان", true);
            } else { window.showMsg(translateErr(e), true); }
        }
    };

    const mainAuthBtn = document.getElementById('mainAuthBtn');
    if(mainAuthBtn) mainAuthBtn.onclick = async () => {
        const email = document.getElementById('emailInput').value.trim();
        const pass = document.getElementById('passwordInput').value.trim();
        const name = document.getElementById('nameInput').value.trim();
        
        if(!email || !pass) return window.showMsg("أدخلي الإيميل وكلمة المرور");
        if(isRegisterMode && !name) return window.showMsg("أدخلي اسمك عشان نعرفك 😊");

        try {
            mainAuthBtn.innerText = 'جاري التحميل...';
            if(isRegisterMode) {
                const cred = await createUserWithEmailAndPassword(auth, email, pass);
                window.tempRegisterName = name; // نخزن الاسم مؤقتاً عشان نحفظه بالداتا بيز بعدين
                await sendEmailVerification(cred.user);
                window.showMsg("تم إنشاء الحساب! شيكي إيميلك لتفعيل الحساب قبل الدخول.", false);
                window.showSection('verifyEmailSection');
            } else {
                const cred = await signInWithEmailAndPassword(auth, email, pass);
                if (!cred.user.emailVerified && cred.user.email !== window.adminEmail) {
                    window.showSection('verifyEmailSection');
                }
            }
        } catch(e) { window.showMsg(translateErr(e), true); mainAuthBtn.innerText = 'متابعة'; }
    };

    const btnActivate = document.getElementById('activateSubscriptionBtn');
    if(btnActivate) btnActivate.onclick = async () => {
        const code = document.getElementById('activationCodeInput').value.trim().toUpperCase();
        if(!code) return window.showMsg("أدخلي الكود");
        try {
            const snap = await get(child(ref(db), `codes/${code}`));
            if(!snap.exists() || snap.val().used) throw new Error("كود غير صالح أو مستخدم");
            const c = snap.val(); const ms = ((c.days||0)*86400000) + ((c.hours||0)*3600000) + ((c.mins||0)*60000); const end = new Date(Date.now() + ms);
            await update(ref(db, `users/${auth.currentUser.uid}`), { email: auth.currentUser.email, startDate: window.activeUserData?.startDate || new Date().toISOString(), endDate: end.toISOString(), onboardingCompleted: window.activeUserData?.onboardingCompleted || false, usedCode: code });
            await update(ref(db, `codes/${code}`), { used: true, usedBy: auth.currentUser.email });
            if(window.activeUserData?.onboardingCompleted) { window.showSection('userDashboard'); } else { window.showSection('onboardingSection'); }
        } catch(e) { window.showMsg(translateErr(e), true); }
    };

    const btnSaveOnb = document.getElementById('saveOnboardingBtn');
    if(btnSaveOnb) btnSaveOnb.onclick = async () => {
        const goal = document.getElementById('qGoal').value; const weight = parseFloat(document.getElementById('qWeight').value) || 0;
        const height = parseFloat(document.getElementById('qHeight').value) || 0; const targetKg = parseFloat(document.getElementById('qTargetKg').value) || 0;
        const targetDays = parseInt(document.getElementById('qTargetDays').value) || 30; const notes = document.getElementById('qNotes').value;
        const targetDate = new Date(); targetDate.setDate(targetDate.getDate() + targetDays);
        const d = new Date(); const timestamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const initialHistory = {}; initialHistory[timestamp] = weight;
        
        let storedName = window.tempRegisterName || auth.currentUser.email.split('@')[0];
        if(window.activeUserData && window.activeUserData.profile && window.activeUserData.profile.name) {
            storedName = window.activeUserData.profile.name;
        }

        await update(ref(db, `users/${auth.currentUser.uid}`), { onboardingCompleted: true, profile: { name: storedName, goal, weight, height, notes }, goalPlan: { startWeight: weight, targetWeight: targetKg, startDate: new Date().toISOString(), targetDate: targetDate.toISOString() }, progress: { weightHistory: initialHistory, currentWeight: weight } });
        const snap = await get(child(ref(db), `users/${auth.currentUser.uid}`)); window.renderUserDashboard(snap.val()); window.showSection('userDashboard');
    };

    onValue(ref(db, 'admin_settings/workHours'), (snap) => {
        if(snap.exists()) {
            window.globalWorkHours = snap.val();
            const wStart = document.getElementById('workStart'); if(wStart) wStart.value = window.globalWorkHours.start;
            const wEnd = document.getElementById('workEnd'); if(wEnd) wEnd.value = window.globalWorkHours.end;
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (!user) return window.showSection('welcomeSection');
        window.currentUserUid = user.uid;
        
        if (user.email === window.adminEmail) {
            const emailDisp = document.getElementById('userEmailDisplay'); if(emailDisp) emailDisp.innerText = 'لوحة التحكم';
            window.showSection('adminDashboard'); document.getElementById('adminMainView')?.classList.remove('hidden'); document.getElementById('adminUserDetailView')?.classList.add('hidden');
            const adminStatusRef = ref(db, 'admin_status'); onDisconnect(adminStatusRef).set({ online: false, lastSeen: serverTimestamp() }); set(adminStatusRef, { online: true, lastSeen: serverTimestamp() });
            if(window.loadAdminCodes) window.loadAdminCodes(); if(window.loadAdminUsers) window.loadAdminUsers();
            const profBtn = document.getElementById('profileBtn'); if(profBtn) profBtn.classList.add('hidden'); 
            return;
        }

        if (!user.emailVerified) {
            window.showSection('verifyEmailSection');
            return;
        }
        
        const profBtn = document.getElementById('profileBtn'); if(profBtn) profBtn.classList.remove('hidden'); 
        
        onValue(ref(db, `users/${user.uid}`), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val(); window.activeUserData = data;
                const emailDisp = document.getElementById('userEmailDisplay'); if(emailDisp) emailDisp.innerText = data.profile?.name || user.email;

                if (data.endDate && new Date() > new Date(data.endDate)) { window.showSection('activationSection'); } 
                else if (!data.onboardingCompleted) { window.showSection('onboardingSection'); } 
                else {
                    if(document.getElementById('userDashboard')?.classList.contains('hidden')) window.showSection('userDashboard');
                    if(window.renderUserDashboard) window.renderUserDashboard(data);
                }
            } else {
                // إذا حساب جديد توه مفعل يدخل قسم البداية مباشرة
                window.showSection('onboardingSection');
            }
        });
    });
}
