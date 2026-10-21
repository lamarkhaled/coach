import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, get, child, update, remove, onValue, push, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const adminEmail = "lm6p12@gmail.com";
let isRegisterMode = false;
let currentAdminViewUid = null; 

let currentAdminExercises = [];
let currentAdminMeals = [];
let currentAdminBadges = []; 
let currentAdminTimeline = []; 
let activeUserData = null;

let todayExercisesList = [];
let playerActiveIndex = 0;

let exerciseTimerInterval = null;
let exerciseRemainingSeconds = 0;
let isTimerRunning = false;
let leaderboardListenerAttached = false; 

let globalWorkHours = { start: '09:00', end: '17:00' };
let lastAutoReplyTime = 0;

function getTodayStr() { 
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

window.fireConfetti = () => {
    const colors = ['#C6F432', '#ff4b4b', '#4CAF50', '#2196F3', '#FFC107', '#E91E63', '#9C27B0'];
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '99999';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);
    
    for(let i=0; i<90; i++) {
        const conf = document.createElement('div');
        conf.style.position = 'absolute';
        conf.style.width = (Math.random() * 8 + 6) + 'px';
        conf.style.height = (Math.random() * 16 + 8) + 'px';
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.left = (Math.random() * 100) + 'vw';
        conf.style.top = '-20px';
        conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        container.appendChild(conf);

        const duration = Math.random() * 2000 + 2000;
        const delay = Math.random() * 400;
        
        conf.animate([
            { transform: `translate3d(0,0,0) rotate(0deg)`, opacity: 1 },
            { transform: `translate3d(${Math.random()*300 - 150}px, 110vh, 0) rotate(${Math.random()*1080}deg)`, opacity: 1 }
        ], { duration: duration, delay: delay, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'forwards' });
    }
    setTimeout(() => container.remove(), 4500);
};

window.openMilestone = (title, note) => {
    document.getElementById('milestoneModalTitle').innerText = title;
    document.getElementById('milestoneModalNote').innerText = note || 'ألف مبروك! إنجاز رائع واصلي يا بطلة 💪';
    document.getElementById('milestoneModal').classList.remove('hidden');
    window.fireConfetti();
    if(navigator.vibrate) navigator.vibrate([100, 50, 100]); 
};

window.toggleThemeMode = () => {
    const html = document.documentElement;
    const btn = document.getElementById('themeToggleBtn');
    if(html.classList.contains('dark')) {
        html.classList.remove('dark');
        html.classList.add('light');
        btn.innerText = '🌙 ليلي';
    } else {
        html.classList.remove('light');
        html.classList.add('dark');
        btn.innerText = '☀️ فاتح';
    }
};

window.showSection = (sectionId) => {
    ['welcomeSection', 'authSection', 'activationSection', 'onboardingSection', 'userDashboard', 'adminDashboard'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    
    const isUserMain = sectionId === 'userDashboard';
    document.getElementById('bottomNavBar').classList.toggle('hidden', !isUserMain);
    document.getElementById('logoutBtn').classList.toggle('hidden', sectionId === 'welcomeSection' || sectionId === 'authSection');
};

window.showMsg = (text, isError=true) => {
    const m = document.getElementById('globalMessage');
    m.textContent = text;
    m.className = `fixed top-24 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-2xl text-sm font-bold text-center shadow-2xl block w-max max-w-[90%] border fade-in ${isError ? 'bg-red-500 text-white border-red-600' : 'bg-card text-primary border-theme'}`;
    setTimeout(() => { m.classList.add('hidden'); m.classList.remove('fade-in'); }, 4000);
};

window.switchTab = (tabId) => {
    document.querySelectorAll('.user-tab').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(tabId === 'tabHome') document.getElementById('navBtnHome').classList.add('active');
    if(tabId === 'tabPlan') document.getElementById('navBtnPlan').classList.add('active');
    if(tabId === 'tabChat') {
        document.getElementById('navBtnChat').classList.add('active');
        if(auth.currentUser) loadChat(auth.currentUser.uid, 'userChatArea');
    }
};

window.switchAdminTab = (tabId) => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    ['btnAdmTabMacros', 'btnAdmTabMeals', 'btnAdmTabWorkouts', 'btnAdmTabTimeline', 'btnAdmTabChat', 'btnAdmTabBadges'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) btn.className = 'flex-1 min-w-[30%] py-3.5 text-[11px] font-bold rounded-xl text-muted border border-transparent transition-all';
    });
    
    const activeMap = { 'adminTabMacros': 'btnAdmTabMacros', 'adminTabMeals': 'btnAdmTabMeals', 'adminTabWorkouts': 'btnAdmTabWorkouts', 'adminTabTimeline': 'btnAdmTabTimeline', 'adminTabChat': 'btnAdmTabChat', 'adminTabBadges': 'btnAdmTabBadges' };
    if(activeMap[tabId]) {
        document.getElementById(activeMap[tabId]).className = 'flex-1 min-w-[30%] py-3.5 text-[11px] font-bold rounded-xl bg-card text-primary shadow-sm border border-theme transition-all';
    }
};

window.switchPlanSubTab = (sub) => {
    document.querySelectorAll('.plan-sub-tab').forEach(t => t.classList.add('hidden'));
    document.getElementById('subTab' + (sub === 'nutrition' ? 'Nutrition' : 'Workouts')).classList.remove('hidden');
    
    document.getElementById('btnSubNut').className = sub === 'nutrition' ? 'flex-1 bg-accent font-bold py-3.5 rounded-xl text-sm transition-all text-accent-text shadow-sm' : 'flex-1 bg-transparent text-muted font-bold py-3.5 rounded-xl text-sm transition-all';
    document.getElementById('btnSubWork').className = sub === 'workouts' ? 'flex-1 bg-accent font-bold py-3.5 rounded-xl text-sm transition-all text-accent-text shadow-sm' : 'flex-1 bg-transparent text-muted font-bold py-3.5 rounded-xl text-sm transition-all';
};

function handleImageUpload(event, uid, sender) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.5);
            push(ref(db, `chats/${uid}`), { text: base64, type: 'image', sender: sender, time: Date.now() });
            if(sender === 'user') checkAndSendAutoReply();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

document.getElementById('showLoginBtn').onclick = () => { isRegisterMode = false; document.getElementById('authTitle').innerText = 'تسجيل الدخول'; showSection('authSection'); };
document.getElementById('showRegisterBtn').onclick = () => { isRegisterMode = true; document.getElementById('authTitle').innerText = 'حساب جديد'; showSection('authSection'); };
document.getElementById('backToWelcomeBtn').onclick = () => showSection('welcomeSection');

document.getElementById('logoutBtn').onclick = async () => {
    if(auth.currentUser && auth.currentUser.email === adminEmail) {
        await set(ref(db, 'admin_status'), { online: false, lastSeen: serverTimestamp() });
    }
    signOut(auth);
};

document.getElementById('mainAuthBtn').onclick = async () => {
    const email = document.getElementById('emailInput').value.trim();
    const pass = document.getElementById('passwordInput').value.trim();
    if(!email || !pass) return showMsg("أدخلي الإيميل وكلمة المرور");
    try {
        const btn = document.getElementById('mainAuthBtn');
        btn.innerText = 'جاري التحميل...';
        if(isRegisterMode) await createUserWithEmailAndPassword(auth, email, pass);
        else await signInWithEmailAndPassword(auth, email, pass);
    } catch(e) { 
        showMsg(e.message); 
        document.getElementById('mainAuthBtn').innerText = 'متابعة';
    }
};

onValue(ref(db, 'admin_status'), (snap) => {
    const statusText = document.getElementById('userChatStatusText');
    const statusDot = document.getElementById('userChatStatusDot');
    if(snap.exists()) {
        const data = snap.val();
        if(data.online) {
            if(statusText) { statusText.innerText = 'متصلة الآن 🟢'; statusText.className = 'text-[11px] font-bold text-green-500 mt-0.5'; }
            if(statusDot) statusDot.className = 'absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full transition-colors duration-300';
        } else {
            let timeStr = 'سابقاً';
            if(data.lastSeen) {
                timeStr = new Date(data.lastSeen).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
            }
            if(statusText) { statusText.innerText = `آخر ظهور عند ${timeStr} ⚪`; statusText.className = 'text-[11px] font-bold text-muted mt-0.5'; }
            if(statusDot) statusDot.className = 'absolute bottom-0 right-0 w-3 h-3 bg-gray-500 border-2 border-card rounded-full transition-colors duration-300';
        }
    }
});

onValue(ref(db, 'admin_settings/workHours'), (snap) => {
    if(snap.exists()) {
        globalWorkHours = snap.val();
        if(document.getElementById('workStart')) document.getElementById('workStart').value = globalWorkHours.start;
        if(document.getElementById('workEnd')) document.getElementById('workEnd').value = globalWorkHours.end;
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) return showSection('welcomeSection');
    if (user.email === adminEmail) {
        showSection('adminDashboard');
        document.getElementById('adminMainView').classList.remove('hidden');
        document.getElementById('adminUserDetailView').classList.add('hidden');
        
        const adminStatusRef = ref(db, 'admin_status');
        onDisconnect(adminStatusRef).set({ online: false, lastSeen: serverTimestamp() });
        set(adminStatusRef, { online: true, lastSeen: serverTimestamp() });

        loadAdminCodes();
        loadAdminUsers();
        return;
    }
    onValue(ref(db, `users/${user.uid}`), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            activeUserData = data;
            if (data.endDate && new Date() > new Date(data.endDate)) {
                showSection('activationSection');
            } else if (!data.onboardingCompleted) {
                showSection('onboardingSection');
            } else {
                if(document.getElementById('userDashboard').classList.contains('hidden')) {
                    showSection('userDashboard');
                }
                renderUserDashboard(data);
            }
        }
    });
});

document.getElementById('activateSubscriptionBtn').onclick = async () => {
    const code = document.getElementById('activationCodeInput').value.trim().toUpperCase();
    if(!code) return showMsg("أدخلي الكود");
    try {
        const snap = await get(child(ref(db), `codes/${code}`));
        if(!snap.exists() || snap.val().used) throw new Error("كود غير صالح أو مستخدم");
        const c = snap.val();
        const ms = ((c.days||0)*86400000) + ((c.hours||0)*3600000) + ((c.mins||0)*60000);
        const end = new Date(Date.now() + ms);
        
        await update(ref(db, `users/${auth.currentUser.uid}`), {
            email: auth.currentUser.email,
            startDate: activeUserData?.startDate || new Date().toISOString(),
            endDate: end.toISOString(),
            onboardingCompleted: activeUserData?.onboardingCompleted || false,
            usedCode: code
        });
        await update(ref(db, `codes/${code}`), { used: true, usedBy: auth.currentUser.email });
        if(activeUserData?.onboardingCompleted) {
            showSection('userDashboard');
        } else {
            showSection('onboardingSection');
        }
    } catch(e) { showMsg(e.message); }
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
        goalPlan: {
            startWeight: weight,
            targetWeight: targetKg,
            startDate: new Date().toISOString(),
            targetDate: targetDate.toISOString()
        },
        progress: {
            weightHistory: initialHistory,
            currentWeight: weight
        }
    });
    const snap = await get(child(ref(db), `users/${auth.currentUser.uid}`));
    renderUserDashboard(snap.val());
    showSection('userDashboard');
};

document.getElementById('updateProgressBtn').onclick = async () => {
    const newW = parseFloat(document.getElementById('userCurrentWeight').value);
    const newH = parseFloat(document.getElementById('userHeightInput').value) || activeUserData.profile?.height || 160;
    if(isNaN(newW)) return showMsg("أدخلي الوزن بشكل صحيح");

    const uid = auth.currentUser.uid;
    const weightHistory = activeUserData.progress?.weightHistory || {};
    const dates = Object.keys(weightHistory);
    let lastWeight = activeUserData.profile?.weight || newW;
    if(dates.length > 0) {
        lastWeight = weightHistory[dates[dates.length - 1]];
    }

    const timestamp = new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    weightHistory[timestamp] = newW;

    activeUserData.progress = activeUserData.progress || {};
    activeUserData.progress.weightHistory = weightHistory;
    activeUserData.progress.currentWeight = newW;
    activeUserData.profile = activeUserData.profile || {};
    activeUserData.profile.height = newH;
    activeUserData.profile.weight = newW;

    const heightM = newH / 100;
    const bmi = (newW / (heightM * heightM)).toFixed(1);
    let bmiStatus = "";
    let avatarEmoji = "🧍‍♀️";
    if (bmi < 18.5) { bmiStatus = "نحافة"; avatarEmoji = "🏃‍♀️"; }
    else if (bmi >= 18.5 && bmi < 25) { bmiStatus = "وزن مثالي"; avatarEmoji = "💃"; }
    else if (bmi >= 25 && bmi < 30) { bmiStatus = "زيادة وزن"; avatarEmoji = "👩‍🦰"; }
    else { bmiStatus = "سمنة"; avatarEmoji = "🧘‍♀️"; }

    document.getElementById('bmiResultCard').classList.remove('hidden');
    document.getElementById('bmiValueText').innerText = bmi;
    document.getElementById('bmiStatusText').innerText = bmiStatus;
    document.getElementById('bodyVisualAvatar').innerText = avatarEmoji;
    document.getElementById('bodyVisualStatus').innerText = `حالة الجسم: ${bmiStatus}`;

    await update(ref(db, `users/${uid}/progress`), activeUserData.progress);
    await update(ref(db, `users/${uid}/profile`), activeUserData.profile);

    const roastBanner = document.getElementById('weightRoastBanner');
    roastBanner.classList.remove('hidden');

    if(newW > lastWeight) {
        roastBanner.className = 'bg-red-500 text-white p-4 rounded-xl text-sm font-bold mb-3 shadow-sm fade-in';
        roastBanner.innerText = 'يا ويلك! 😡 وزنك زاد عن القياس السابق.. وين الالتزام بالخطة؟ شدي حيلك!';
        showMsg("الوزن زاد! انتبهي ⚠️", true);
    } else if (newW < lastWeight) {
        roastBanner.className = 'bg-accent text-accent-text p-4 rounded-xl text-sm font-bold mb-3 shadow-sm fade-in';
        roastBanner.innerText = 'شطووورة! 🎉 نزلتي وزنك.. استمري يا بطلة فخورة فيك!';
        showMsg("عاش بطلتنا! نزول ممتاز 🌟", false);
    } else {
        roastBanner.className = 'bg-yellow-500 text-black p-4 rounded-xl text-sm font-bold mb-3 shadow-sm fade-in';
        roastBanner.innerText = 'وزنك ثابت! مو مشكلة أهم شيء الالتزام، راجعي وجباتك وتمرينك.';
        showMsg("تم حفظ القياس بنجاح 🌟", false);
    }
    
    renderUserDashboard(activeUserData);
};

window.openWeightHistoryModal = () => {
    const listContainer = document.getElementById('modalWeightHistoryList');
    const history = activeUserData.progress?.weightHistory || {};
    listContainer.innerHTML = '';
    if(Object.keys(history).length === 0) {
        listContainer.innerHTML = '<p class="text-sm text-muted text-center py-6">لا يوجد قياسات.</p>';
    } else {
        Object.entries(history).reverse().forEach(([timeTag, weightVal]) => {
            listContainer.innerHTML += `
                <div class="bg-input p-4 rounded-xl border border-theme flex justify-between items-center text-sm shadow-sm fade-in">
                    <span class="text-primary font-bold">${timeTag}</span>
                    <span class="bg-accent text-accent-text px-3 py-1.5 rounded-lg font-bold shadow-sm">${weightVal} كج</span>
                </div>
            `;
        });
    }
    document.getElementById('weightHistoryModal').classList.remove('hidden');
};

function buildNativeVideoPlayer(url) {
    if(!url) return '';
    const lower = url.toLowerCase();
    if(lower.match(/\.(mp4|webm|mov)$/)) {
        return `<video src="${url}" controls playsinline class="w-full rounded-2xl my-4 border border-theme bg-black shadow-md"></video>`;
    }
    if(lower.includes('youtube.com/watch?v=') || lower.includes('youtu.be/')) {
        let vidId = lower.includes('youtu.be/') ? url.split('youtu.be/')[1] : url.split('v=')[1].split('&')[0];
        return `<div class="rounded-2xl overflow-hidden my-4 border border-theme shadow-md"><iframe src="https://www.youtube.com/embed/${vidId}?rel=0" class="w-full h-56 sm:h-72" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    if(lower.match(/\.(jpeg|jpg|gif|png|webp)$/)) {
        return `<img src="${url}" class="w-full rounded-2xl my-4 border border-theme shadow-md">`;
    }
    return `<a href="${url}" target="_blank" class="block w-full bg-input text-accent text-center py-4 rounded-xl text-sm font-bold my-4 border border-theme shadow-sm transition-transform active:scale-95">فتح الرابط المرفق</a>`;
}

function renderUserDashboard(data) {
    activeUserData = data;
    
    const todayStr = getTodayStr();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDayBanner').innerText = new Date().toLocaleDateString('ar-SA', dateOptions);

    if(data.profile?.height) {
        document.getElementById('userHeightInput').value = data.profile.height;
    }
    if(data.progress?.currentWeight) {
        document.getElementById('userCurrentWeight').value = data.progress.currentWeight;
        if(data.profile?.height) {
            const hM = data.profile.height / 100;
            const bmi = (data.progress.currentWeight / (hM * hM)).toFixed(1);
            let bmiStatus = bmi < 18.5 ? "نحافة" : bmi < 25 ? "وزن مثالي" : bmi < 30 ? "زيادة وزن" : "سمنة";
            let avatarEmoji = bmi < 18.5 ? "🏃‍♀️" : bmi < 25 ? "💃" : bmi < 30 ? "👩‍🦰" : "🧘‍♀️";
            document.getElementById('bmiResultCard').classList.remove('hidden');
            document.getElementById('bmiValueText').innerText = bmi;
            document.getElementById('bmiStatusText').innerText = bmiStatus;
            document.getElementById('bodyVisualAvatar').innerText = avatarEmoji;
            document.getElementById('bodyVisualStatus').innerText = `حالة الجسم: ${bmiStatus}`;
        }
    }

    const badgesArr = Array.isArray(data.badges) ? data.badges : Object.values(data.badges || {}).filter(b => b != null && b.title);
    const customTimeline = Array.isArray(data.plan?.timeline) ? data.plan?.timeline : Object.values(data.plan?.timeline || {}).filter(x => x != null && x.title);

    renderUserBadges(badgesArr);
    renderDetailedGoalTimeline(data.goalPlan, data.progress?.currentWeight, customTimeline);

    if(!leaderboardListenerAttached) {
        loadLeaderboardAuto();
        leaderboardListenerAttached = true;
    }

    const allMeals = Array.isArray(data.plan?.meals || data.meals) ? (data.plan?.meals || data.meals) : Object.values(data.plan?.meals || data.meals || {}).filter(x => x != null);
    const todayMeals = allMeals.map((m, i) => ({...m, _idx: i})).filter(m => !m.date || m.date === todayStr);

    const allExercises = Array.isArray(data.plan?.exercises || data.exercises) ? (data.plan?.exercises || data.exercises) : Object.values(data.plan?.exercises || data.exercises || {}).filter(x => x != null);
    todayExercisesList = allExercises.map((ex, i) => ({...ex, _idx: i})).filter(ex => !ex.date || ex.date === todayStr);

    renderUserNutritionCourse(todayMeals, data.progress?.meals, data.progress?.swaps, data.targets);
    renderUserWorkoutSummary(todayExercisesList, data.progress?.workouts);
}

function renderDetailedGoalTimeline(goalPlan, currentWeight, customTimeline) {
    const card = document.getElementById('goalTimelineCard');
    const container = document.getElementById('timelineContainerArea');
    if(!goalPlan) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');

    const startW = goalPlan.startWeight;
    const targetW = goalPlan.targetWeight;
    const curW = currentWeight || startW;
    const isGaining = targetW > startW;
    
    let isGoalReached = false;
    if((!isGaining && curW <= targetW) || (isGaining && curW >= targetW)) {
        isGoalReached = true;
    }

    const badge = document.getElementById('goalStatusBadge');
    if(isGoalReached) {
        badge.innerText = 'أتممت الهدف 👑';
        badge.className = 'text-[10px] bg-accent text-accent-text px-3 py-1.5 rounded-lg font-bold shadow-sm';
    } else {
        badge.innerText = 'مستمر 🔥';
        badge.className = 'text-[10px] bg-blue-500/20 text-blue-500 border border-blue-500/30 px-3 py-1.5 rounded-lg font-bold shadow-sm';
    }

    let passedCount = 0;
    let totalSteps = customTimeline && customTimeline.length ? customTimeline.length : 1; 

    if(customTimeline && customTimeline.length > 0) {
        customTimeline.forEach(m => {
            if((!isGaining && curW <= m.targetWeight) || (isGaining && curW >= m.targetWeight)) passedCount++;
        });
        
        let progressPercent = totalSteps > 0 ? (passedCount / totalSteps) * 100 : 0;
        if(progressPercent > 100) progressPercent = 100;

        let htmlStr = `
            <div class="timeline-wrapper fade-in">
                <div class="timeline-line"></div>
                <div class="timeline-line-progress" style="height: ${progressPercent}%;"></div>
        `;

        customTimeline.forEach((m) => {
            const isPassed = (!isGaining && curW <= m.targetWeight) || (isGaining && curW >= m.targetWeight);
            const iconClass = isPassed ? 'timeline-icon-unlocked' : 'timeline-icon-locked';
            const iconSymbol = isPassed ? '🔓' : '🔒';
            const safeTitle = m.title ? m.title.replace(/'/g, "\\'") : '';
            const safeNote = m.note ? m.note.replace(/'/g, "\\'") : '';
            const clickAttr = isPassed ? `onclick="window.openMilestone('${safeTitle}', '${safeNote}')"` : '';

            htmlStr += `
                <div class="timeline-step-pro">
                    <div class="timeline-icon-pro ${iconClass}" ${clickAttr}>${iconSymbol}</div>
                    <div class="bg-card p-5 rounded-2xl border ${isPassed ? 'border-accent shadow-lg' : 'border-theme shadow-sm'} ${isPassed ? 'cursor-pointer active:scale-95 transition-transform' : ''}" ${clickAttr}>
                        <div class="flex justify-between items-center mb-1">
                            <h4 class="text-sm font-black ${isPassed ? 'text-accent' : 'text-primary'}">${m.title}</h4>
                            <span class="text-[11px] bg-input border border-theme px-3 py-1 rounded-lg font-bold">${m.targetWeight} كج</span>
                        </div>
                        ${isPassed ? '<span class="text-[11px] text-accent font-bold mt-2 block">اضغطي لفتح القفل واستلام رسالتك 🎁</span>' : '<span class="text-[10px] text-muted block mt-2">مقفلة حتى الوصول للوزن الهدف</span>'}
                    </div>
                </div>
            `;
        });

        htmlStr += `</div>`;
        container.innerHTML = htmlStr;
    } else {
        let remaining = Math.abs(curW - targetW).toFixed(1);
        let reached = Math.abs(startW - curW).toFixed(1);
        if(isGoalReached) remaining = 0;

        container.innerHTML = `
            <div class="timeline-wrapper fade-in">
                <div class="timeline-line"></div>
                <div class="timeline-line-progress" style="height: ${isGoalReached ? '100' : '50'}%;"></div>
                
                <div class="timeline-step-pro">
                    <div class="timeline-icon-pro timeline-icon-unlocked">✅</div>
                    <div class="bg-card p-4 rounded-xl border border-accent shadow-sm">
                        <h4 class="text-[11px] text-muted font-bold mb-1">الوضع الحالي</h4>
                        <div class="flex justify-between items-center">
                            <span class="text-base font-black text-accent">${curW} كج</span>
                            <span class="text-[10px] text-primary bg-input px-3 py-1 rounded-lg shadow-sm">قطعتِ: ${reached} كج</span>
                        </div>
                    </div>
                </div>

                <div class="timeline-step-pro">
                    <div class="timeline-icon-pro ${isGoalReached ? 'timeline-icon-unlocked' : 'timeline-icon-locked'}">${isGoalReached ? '👑' : '🎯'}</div>
                    <div class="bg-card p-4 rounded-xl border ${isGoalReached ? 'border-accent shadow-md' : 'border-theme shadow-sm'}">
                        <h4 class="text-[11px] text-muted font-bold mb-1">الهدف النهائي</h4>
                        <div class="flex justify-between items-center">
                            <span class="text-base font-black text-primary">${targetW} كج</span>
                            <span class="text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg font-bold">المتبقي: ${remaining} كج</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

function renderUserBadges(badges) {
    const container = document.getElementById('userBadgesContainer');
    if(!badges || badges.length === 0) {
        container.innerHTML = '<p class="text-xs text-muted w-full text-center py-4">لم تحصلي على أوسمة بعد، استمري بالإنجاز! 💪</p>';
        return;
    }
    container.innerHTML = badges.map(b => `
        <div class="flex flex-col items-center justify-center bg-input border border-theme p-4 rounded-2xl w-24 text-center shadow-md fade-in hover:scale-105 transition-transform">
            <span class="text-3xl mb-2 filter drop-shadow-md">${b.icon || '🏅'}</span>
            <span class="text-[10px] font-bold text-primary leading-tight">${b.title}</span>
        </div>
    `).join('');
}

function loadLeaderboardAuto() {
    onValue(ref(db, 'users'), (snap) => {
        const container = document.getElementById('leaderboardContainer');
        if(!snap.exists()) { container.innerHTML = '<p class="text-sm text-muted text-center py-4">لا توجد منافسة حالياً.</p>'; return; }
        
        let usersArr = [];
        snap.forEach(u => {
            const val = u.val();
            if(val.email === adminEmail) return; 
            let score = 0;
            const today = getTodayStr();
            const wDone = val.progress?.workouts?.[today] || {};
            const mDone = val.progress?.meals?.[today] || {};
            score += Object.keys(wDone).length * 10 + Object.keys(mDone).length * 5;
            if(val.badges) {
                const bList = Array.isArray(val.badges) ? val.badges : Object.values(val.badges);
                score += bList.filter(b=>b!=null).length * 50; 
            }

            usersArr.push({ email: val.email.split('@')[0], score });
        });

        usersArr.sort((a,b) => b.score - a.score);
        container.innerHTML = '';
        
        usersArr.slice(0, 3).forEach((usr, idx) => {
            let medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
            let bg = idx === 0 ? 'bg-gradient-to-r from-accent/20 to-transparent border-accent/30' : 'bg-input border-theme';
            container.innerHTML += `
                <div class="flex justify-between items-center ${bg} px-4 py-4 rounded-xl border text-sm shadow-sm fade-in">
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-2xl drop-shadow-sm">${medal}</span>
                        <span class="font-bold text-primary text-base">${usr.email}</span>
                    </div>
                    <span class="bg-card border border-theme px-3 py-1.5 rounded-lg text-primary text-xs font-bold shadow-sm">${usr.score} نقطة</span>
                </div>
            `;
        });
    });
}

function renderUserNutritionCourse(meals, progress, swaps, targets) {
    const area = document.getElementById('userNutritionCourse');
    area.innerHTML = '';
    const today = getTodayStr();
    const doneMeals = progress?.[today] || {};
    const todaySwaps = swaps?.[today] || [];
    const userTargets = targets || { cal: 2000, pro: 150, carb: 200, fat: 60 };

    let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
    if(meals) {
        meals.forEach((m) => {
            if(doneMeals[m._idx]) {
                totalCal += Number(m.cal || 0);
                totalPro += Number(m.pro || 0);
                totalCarb += Number(m.carb || 0);
                totalFat += Number(m.fat || 0);
            }
        });
    }
    todaySwaps.forEach(sw => {
        totalCal += Number(sw.cal || 0);
        totalPro += Number(sw.pro || 0);
        totalCarb += Number(sw.carb || 0);
        totalFat += Number(sw.fat || 0);
    });

    document.getElementById('targetCalVal').innerText = userTargets.cal;
    document.getElementById('targetProVal').innerText = userTargets.pro + 'g';
    document.getElementById('targetCarbVal').innerText = userTargets.carb + 'g';
    document.getElementById('targetFatVal').innerText = userTargets.fat + 'g';

    document.getElementById('macroCalVal').innerText = totalCal;
    document.getElementById('macroProVal').innerText = totalPro + 'g';
    document.getElementById('macroCarbVal').innerText = totalCarb + 'g';
    document.getElementById('macroFatVal').innerText = totalFat + 'g';

    const warningBadge = document.getElementById('macroWarningBadge');
    if(totalCal > Number(userTargets.cal)) {
        warningBadge.classList.remove('hidden');
    } else {
        warningBadge.classList.add('hidden');
    }

    let html = '';
    if(meals && meals.length > 0) {
        meals.forEach((m, displayIdx) => {
            const realIdx = m._idx;
            const isDone = doneMeals[realIdx];
            let ingredientsHtml = '';
            if(m.ingredients && m.ingredients.length > 0) {
                ingredientsHtml = `<div class="mt-4 space-y-2 text-xs bg-input p-4 rounded-xl border border-theme shadow-inner">
                    <strong class="text-primary block mb-3 text-sm">مكونات الوجبة (قائمة مهام):</strong>
                    <div class="space-y-2">
                    ${m.ingredients.map(ing => `
                        <label class="flex items-center gap-3 p-3 bg-card rounded-xl border border-theme cursor-pointer transition-colors active:scale-95 shadow-sm">
                            <input type="checkbox" onchange="this.nextElementSibling.classList.toggle('line-through'); this.nextElementSibling.classList.toggle('text-muted');">
                            <span class="text-sm font-bold text-primary transition-all">${ing.name} <span class="text-accent ml-1">${ing.amount}</span></span>
                        </label>
                    `).join('')}
                    </div>
                </div>`;
            }

            const periodBadge = m.period ? `<span class="text-[10px] bg-card border border-theme text-primary px-3 py-1 rounded-md font-bold absolute top-5 left-5 shadow-sm">${m.period}</span>` : '';

            html += `
                <div class="bg-card p-6 rounded-ios-lg border border-theme space-y-4 shadow-sm fade-in relative">
                    ${periodBadge}
                    <div class="flex flex-col gap-4">
                        <div>
                            <span class="text-[11px] text-accent font-bold block mb-1">وجبة ${displayIdx+1}</span>
                            <h3 class="font-bold text-lg text-primary w-4/5">${m.title}</h3>
                        </div>
                        <button onclick="window.toggleMealDone(${realIdx})" class="w-full py-3.5 rounded-xl text-sm font-bold border border-theme shadow-sm transition-transform active:scale-95 ${isDone ? 'bg-accent text-accent-text' : 'bg-input text-primary'}">
                            ${isDone ? 'تم تناولها ✔️' : 'تسجيل التناول'}
                        </button>
                    </div>
                    ${ingredientsHtml}
                    <div class="grid grid-cols-4 gap-2 text-[11px] font-bold bg-input p-3 rounded-xl border border-theme text-center shadow-inner">
                        <div><strong class="text-sm text-primary block">${m.cal || 0}</strong> سعرة</div>
                        <div><strong class="text-sm text-accent block">${m.pro || 0}g</strong> برو</div>
                        <div><strong class="text-sm text-blue-500 block">${m.carb || 0}g</strong> كارب</div>
                        <div><strong class="text-sm text-yellow-500 block">${m.fat || 0}g</strong> دهون</div>
                    </div>
                    <button onclick="window.openMealDetail(${realIdx})" class="w-full bg-input text-primary text-sm font-bold py-4 rounded-xl border border-theme shadow-sm transition-transform active:scale-95">
                        📖 عرض الوصفة والتحضير
                    </button>
                </div>
            `;
        });
    } else {
        html = '<p class="text-sm text-muted bg-input p-6 rounded-xl text-center border border-theme shadow-inner">لا توجد وجبات مخصصة لليوم.</p>';
    }
    area.innerHTML = html;
}

window.openGroceryList = () => {
    const allMeals = Array.isArray(activeUserData.plan?.meals || activeUserData.meals) ? (activeUserData.plan?.meals || activeUserData.meals) : Object.values(activeUserData.plan?.meals || activeUserData.meals || {}).filter(x => x != null);
    let allIngs = [];
    allMeals.forEach(m => {
        if(m.ingredients) {
            m.ingredients.forEach(ing => {
                if(ing.name) allIngs.push(`${ing.name} <span class="text-accent text-xs">(${ing.amount})</span> <span class="text-[10px] text-muted block mt-1">من: ${m.title}</span>`);
            });
        }
    });

    let html = allIngs.map((ingText) => `
        <label class="flex items-center gap-3 p-4 bg-input rounded-xl border border-theme cursor-pointer transition-colors active:scale-95 shadow-sm">
            <input type="checkbox" onchange="this.nextElementSibling.classList.toggle('line-through'); this.nextElementSibling.classList.toggle('opacity-50');">
            <div class="text-sm font-bold text-primary transition-all">${ingText}</div>
        </label>
    `).join('');

    if(allIngs.length === 0) html = '<p class="text-sm text-muted text-center py-4">القائمة فارغة، لا يوجد مقاضي مسجلة.</p>';
    
    document.getElementById('groceryModalBody').innerHTML = html;
    document.getElementById('groceryListModal').classList.remove('hidden');
};

window.toggleMealDone = async (realIdx) => {
    const today = getTodayStr();
    const uid = auth.currentUser.uid;
    const doneMeals = activeUserData.progress?.meals?.[today] || {};
    doneMeals[realIdx] = !doneMeals[realIdx];
    await update(ref(db, `users/${uid}/progress/meals`), { [today]: doneMeals });
    activeUserData.progress = activeUserData.progress || {};
    activeUserData.progress.meals = activeUserData.progress.meals || {};
    activeUserData.progress.meals[today] = doneMeals;
    renderUserDashboard(activeUserData);
};

window.openMealDetail = (realIdx) => {
    const allMeals = Array.isArray(activeUserData.plan?.meals || activeUserData.meals) ? (activeUserData.plan?.meals || activeUserData.meals) : Object.values(activeUserData.plan?.meals || activeUserData.meals || {}).filter(x => x != null);
    const m = allMeals[realIdx];
    document.getElementById('modalMealTitle').innerText = m.title;

    let ingHtml = '';
    if(m.ingredients && m.ingredients.length > 0) {
        ingHtml = `
            <div class="mb-4">
                <strong class="text-primary text-sm block mb-3 font-bold">المكونات (علمي على اللي جهزتيه):</strong>
                <div class="space-y-2">
                ${m.ingredients.map(ing => `
                    <label class="flex items-center gap-3 p-3 bg-input rounded-xl border border-theme cursor-pointer transition-colors active:scale-95 shadow-sm">
                        <input type="checkbox" onchange="this.nextElementSibling.classList.toggle('line-through'); this.nextElementSibling.classList.toggle('text-muted');">
                        <span class="text-sm font-bold text-primary transition-all">${ing.name} <span class="text-accent ml-1">${ing.amount}</span></span>
                    </label>
                `).join('')}
                </div>
            </div>
        `;
    }

    document.getElementById('modalMealBody').innerHTML = `
        ${m.image ? `<img src="${m.image}" class="w-full rounded-2xl mb-4 border border-theme shadow-sm">` : ''}
        ${ingHtml}
        <div class="bg-input p-5 rounded-xl border border-theme shadow-inner">
            <strong class="text-primary text-sm block mb-3 font-bold">طريقة التحضير:</strong>
            <p class="text-muted text-sm leading-relaxed">${m.recipe || 'لا يوجد وصف.'}</p>
        </div>
        ${buildNativeVideoPlayer(m.media)}
    `;
    document.getElementById('mealDetailModal').classList.remove('hidden');
};

window.openSwapModal = () => { document.getElementById('mealSwapModal').classList.remove('hidden'); };
window.saveSwapMeal = async () => {
    const name = document.getElementById('swapMealName').value.trim() || 'وجبة بديلة';
    const cal = parseInt(document.getElementById('swapCal').value) || 0;
    const pro = parseInt(document.getElementById('swapPro').value) || 0;
    const carb = parseInt(document.getElementById('swapCarb').value) || 0;
    const fat = parseInt(document.getElementById('swapFat').value) || 0;

    const today = getTodayStr();
    const uid = auth.currentUser.uid;
    activeUserData.progress = activeUserData.progress || {};
    activeUserData.progress.swaps = activeUserData.progress.swaps || {};
    activeUserData.progress.swaps[today] = activeUserData.progress.swaps[today] || [];
    activeUserData.progress.swaps[today].push({ name, cal, pro, carb, fat });

    await update(ref(db, `users/${uid}/progress/swaps`), activeUserData.progress.swaps);
    document.getElementById('mealSwapModal').classList.add('hidden');
    renderUserDashboard(activeUserData);
};

function renderUserWorkoutSummary(exercises, progress) {
    const area = document.getElementById('userWorkoutCourseSummary');
    if(!exercises || exercises.length === 0) {
        area.innerHTML = '<p class="text-sm text-muted text-center py-8">لا توجد تمارين مخصصة لليوم.</p>';
        return;
    }
    area.innerHTML = `
        <div class="text-center py-6">
            <div class="text-6xl mb-4 filter drop-shadow-lg">💪</div>
            <h3 class="font-black text-2xl mb-3 text-primary">جلسة تمارين اليوم جاهزة</h3>
            <p class="text-sm text-muted mb-8">الجلسة تتضمن ${exercises.length} تمارين مخصصة لكِ.</p>
            <button onclick="window.startCoursePlayer()" class="w-full bg-accent text-accent-text font-bold py-4 rounded-xl text-lg shadow-lg transition-transform active:scale-95">بدء التمرين 🔥</button>
        </div>
    `;
}

window.startCoursePlayer = () => {
    playerActiveIndex = 0;
    const today = getTodayStr();
    const progress = activeUserData.progress?.workouts?.[today] || {};
    
    for(let i=0; i<todayExercisesList.length; i++) {
        let ex = todayExercisesList[i];
        let rIdx = ex._idx;
        if(ex.type === 'timer') {
            if(!progress[rIdx]?.completed) { playerActiveIndex = i; break; }
        } else {
            if((progress[rIdx] || 0) < ex.sets) { playerActiveIndex = i; break; }
        }
    }
    
    document.getElementById('bottomNavBar').classList.add('hidden');
    document.getElementById('userWorkoutCourseSummary').classList.add('hidden');
    document.getElementById('inlinePlayerView').classList.remove('hidden');
    
    renderPlayerStep();
};

window.saveAndExitCoursePlayer = () => {
    if(exerciseTimerInterval) clearInterval(exerciseTimerInterval);
    document.getElementById('inlinePlayerView').classList.add('hidden');
    document.getElementById('userWorkoutCourseSummary').classList.remove('hidden');
    document.getElementById('bottomNavBar').classList.remove('hidden');
    renderUserDashboard(activeUserData);
};

window.playerPrevStep = () => {
    if(exerciseTimerInterval) clearInterval(exerciseTimerInterval);
    if(playerActiveIndex > 0) {
        playerActiveIndex--;
        renderPlayerStep();
    }
};

window.playerNextStep = () => {
    if(exerciseTimerInterval) clearInterval(exerciseTimerInterval);
    if(playerActiveIndex < todayExercisesList.length - 1) {
        playerActiveIndex++;
        renderPlayerStep();
    } else {
        saveAndExitCoursePlayer();
        showMsg("أتممتِ جلسة التمارين يا بطلة! 🎉", false);
    }
};

function renderPlayerStep() {
    if(exerciseTimerInterval) clearInterval(exerciseTimerInterval);
    const area = document.getElementById('playerContentArea');
    const ex = todayExercisesList[playerActiveIndex];
    if(!ex) return;

    document.getElementById('workoutTimerDisplay').innerText = `تمرين ${playerActiveIndex + 1} / ${todayExercisesList.length}`;
    const today = getTodayStr();
    const todayProg = activeUserData.progress?.workouts?.[today] || {};
    const realIdx = ex._idx;

    const periodBadge = ex.period ? `<span class="text-[10px] bg-card border border-theme text-primary px-3 py-1 rounded-md font-bold mb-3 inline-block shadow-sm mr-2">${ex.period}</span>` : '';

    if(ex.type === 'timer') {
        let totalSecs = (ex.timerMins || 1) * 60;
        exerciseRemainingSeconds = todayProg[realIdx]?.secondsLeft !== undefined ? todayProg[realIdx].secondsLeft : totalSecs;

        area.innerHTML = `
            <div class="fade-in flex flex-col flex-grow">
                <div class="mb-4 text-right">
                    <span class="text-[10px] bg-input border border-theme text-primary px-3 py-1.5 rounded-lg font-bold mb-3 inline-block shadow-sm">نظام مؤقت</span>
                    ${periodBadge}
                    <h2 class="text-3xl font-black text-primary">${ex.title}</h2>
                </div>
                ${buildNativeVideoPlayer(ex.media)}
                
                <div class="bg-input p-6 rounded-2xl border border-theme mb-6 mt-2 shadow-inner">
                    <div id="exerciseCountdown" class="text-6xl font-black text-accent mb-6 drop-shadow-md tracking-wider">--:--</div>
                    <div class="flex gap-3 justify-center">
                        <button onclick="window.toggleExerciseTimer(${totalSecs})" id="timerToggleBtn" class="flex-grow bg-accent text-accent-text font-bold px-4 py-4 rounded-xl text-base shadow-sm transition-transform active:scale-95">بدء التايمر</button>
                        <button onclick="window.resetExerciseTimer(${totalSecs})" class="bg-card border border-theme text-primary px-4 py-4 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95">إعادة</button>
                    </div>
                </div>

                <div class="flex gap-3 w-full mt-auto">
                    <button onclick="window.playerPrevStep()" class="w-1/3 bg-input border border-theme text-primary py-4 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95">السابق</button>
                    <button onclick="window.playerNextStep()" class="w-2/3 bg-primary text-black bg-white py-4 rounded-xl text-base font-bold shadow-md transition-transform active:scale-95">${playerActiveIndex === todayExercisesList.length - 1 ? 'إنهاء الجلسة ✔️' : 'التالي ➔'}</button>
                </div>
            </div>
        `;
        updateTimerDisplay();
    } else {
        const doneSets = todayProg[realIdx] || 0;
        let setsHtml = '';
        for(let i=1; i<=ex.sets; i++) {
            const isActive = i <= doneSets ? 'done' : '';
            setsHtml += `<button onclick="window.markPlayerSet(${realIdx}, ${i})" class="set-pill ${isActive}">${i}</button>`;
        }

        area.innerHTML = `
            <div class="fade-in flex flex-col flex-grow">
                <div class="mb-4 text-right">
                    <span class="text-[10px] bg-input border border-theme text-primary px-3 py-1.5 rounded-lg font-bold mb-3 inline-block shadow-sm">نظام جولات</span>
                    ${periodBadge}
                    <h2 class="text-3xl font-black text-primary">${ex.title}</h2>
                </div>
                ${buildNativeVideoPlayer(ex.media)}
                
                <div class="bg-input p-6 rounded-2xl border border-theme mb-6 mt-2 shadow-inner">
                    <p class="text-sm text-muted mb-5 font-bold">اضغطي على رقم الجولة بعد إتمامها:</p>
                    <div class="flex gap-4 justify-center flex-wrap">${setsHtml}</div>
                </div>
                
                <div class="flex gap-3 w-full mt-auto">
                    <button onclick="window.playerPrevStep()" class="w-1/3 bg-input border border-theme text-primary py-4 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95">السابق</button>
                    <button onclick="window.playerNextStep()" class="w-2/3 bg-primary text-black bg-white py-4 rounded-xl text-base font-bold shadow-md transition-transform active:scale-95">${playerActiveIndex === todayExercisesList.length - 1 ? 'إنهاء الجلسة ✔️' : 'التالي ➔'}</button>
                </div>
            </div>
        `;
    }
}

window.updateTimerDisplay = () => {
    const m = String(Math.floor(exerciseRemainingSeconds / 60)).padStart(2, '0');
    const s = String(exerciseRemainingSeconds % 60).padStart(2, '0');
    const el = document.getElementById('exerciseCountdown');
    if(el) el.innerText = `${m}:${s}`;
};

window.toggleExerciseTimer = (defaultSecs) => {
    const btn = document.getElementById('timerToggleBtn');
    if(isTimerRunning) {
        clearInterval(exerciseTimerInterval);
        isTimerRunning = false;
        btn.innerText = 'استئناف التايمر';
        btn.className = 'flex-grow bg-accent font-bold px-4 py-4 rounded-xl text-base text-accent-text shadow-sm';
    } else {
        isTimerRunning = true;
        btn.innerText = 'إيقاف مؤقت';
        btn.className = 'flex-grow bg-red-500 text-white font-bold px-4 py-4 rounded-xl text-base shadow-sm';
        exerciseTimerInterval = setInterval(async () => {
            if(exerciseRemainingSeconds > 0) {
                exerciseRemainingSeconds--;
                updateTimerDisplay();
                saveTimerProgress(false);
            } else {
                clearInterval(exerciseTimerInterval);
                isTimerRunning = false;
                btn.innerText = 'انتهى الوقت';
                btn.className = 'flex-grow bg-card border border-theme text-primary font-bold px-4 py-4 rounded-xl text-base shadow-sm';
                saveTimerProgress(true);
            }
        }, 1000);
    }
};

window.resetExerciseTimer = (defaultSecs) => {
    if(exerciseTimerInterval) clearInterval(exerciseTimerInterval);
    isTimerRunning = false;
    exerciseRemainingSeconds = defaultSecs;
    updateTimerDisplay();
    const btn = document.getElementById('timerToggleBtn');
    if(btn) { btn.innerText = 'بدء التايمر'; btn.className = 'flex-grow bg-accent font-bold px-4 py-4 rounded-xl text-base text-accent-text shadow-sm'; }
    saveTimerProgress(false);
};

async function saveTimerProgress(isCompleted) {
    const today = getTodayStr();
    const uid = auth.currentUser.uid;
    const realIdx = todayExercisesList[playerActiveIndex]._idx;
    
    activeUserData.progress = activeUserData.progress || {};
    activeUserData.progress.workouts = activeUserData.progress.workouts || {};
    activeUserData.progress.workouts[today] = activeUserData.progress.workouts[today] || {};
    activeUserData.progress.workouts[today][realIdx] = {
        secondsLeft: exerciseRemainingSeconds,
        completed: isCompleted
    };
    await update(ref(db, `users/${uid}/progress/workouts`), activeUserData.progress.workouts);
}

window.markPlayerSet = async (realIdx, setNum) => {
    const today = getTodayStr();
    const uid = auth.currentUser.uid;
    activeUserData.progress = activeUserData.progress || {};
    activeUserData.progress.workouts = activeUserData.progress.workouts || {};
    activeUserData.progress.workouts[today] = activeUserData.progress.workouts[today] || {};
    activeUserData.progress.workouts[today][realIdx] = setNum;

    await update(ref(db, `users/${uid}/progress/workouts`), activeUserData.progress.workouts);
    renderPlayerStep();
};

// ================= ADMIN CODES & USERS =================
window.extendSub = async (days) => {
    if(!activeUserData) return;
    let end = new Date(activeUserData.endDate);
    if(isNaN(end.getTime()) || end < new Date()) end = new Date();
    end.setDate(end.getDate() + days);
    await update(ref(db, `users/${currentAdminViewUid}`), { endDate: end.toISOString() });
    activeUserData.endDate = end.toISOString();
    document.getElementById('adminSubEndText').innerText = end.toLocaleDateString('ar-SA');
    document.getElementById('adminSubEndText').className = 'text-primary text-sm bg-input px-3 py-1 rounded-lg border border-theme inline-block mr-2 ml-2';
    showMsg(`تم التمديد بنجاح لـ ${days} أيام 📅`, false);
};

window.endSub = async () => {
    if(!confirm("هل أنت متأكدة من إنهاء الاشتراك الآن؟ سيتم إغلاق حساب المتدربة فوراً.")) return;
    const end = new Date();
    end.setDate(end.getDate() - 1); 
    await update(ref(db, `users/${currentAdminViewUid}`), { endDate: end.toISOString() });
    if(activeUserData) activeUserData.endDate = end.toISOString();
    document.getElementById('adminSubEndText').innerText = 'منتهي (مغلق)';
    document.getElementById('adminSubEndText').className = 'text-red-500 font-black text-sm bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/30 inline-block mr-2 ml-2';
    showMsg("تم إنهاء الاشتراك وأغلق الحساب 🔒", false);
};

window.deleteUser = async () => {
    if(!confirm("⚠️ تحذير: هل أنت متأكدة من حذف المتدربة نهائياً؟ سيتم مسح كل بياناتها!")) return;
    await remove(ref(db, `users/${currentAdminViewUid}`));
    showMsg("تم حذف المتدربة نهائياً 🗑️", false);
    document.getElementById('backToAdminMainBtn').click();
};

document.getElementById('generateCodeBtn').onclick = async () => {
    const code = document.getElementById('adminNewCode').value.trim().toUpperCase();
    const days = parseInt(document.getElementById('codeDays').value) || 0;
    const hours = parseInt(document.getElementById('codeHours').value) || 0;
    const mins = parseInt(document.getElementById('codeMins').value) || 0;
    if(code && (days||hours||mins)) {
        await set(ref(db, `codes/${code}`), { code, days, hours, mins, used: false });
        showMsg("تم حفظ الكود", false);
        document.getElementById('adminNewCode').value = '';
        loadAdminCodes();
    }
};

document.getElementById('saveWorkHoursBtn').onclick = async () => {
    const start = document.getElementById('workStart').value;
    const end = document.getElementById('workEnd').value;
    await set(ref(db, 'admin_settings/workHours'), { start, end });
    showMsg("تم حفظ أوقات العمل بنجاح ⏰", false);
};

async function loadAdminCodes() {
    const list = document.getElementById('adminCodesList');
    const snap = await get(child(ref(db), 'codes'));
    list.innerHTML = '';
    if(!snap.exists()) return list.innerHTML = '<p class="text-xs text-muted">لا يوجد أكواد</p>';
    snap.forEach(cSnap => {
        const c = cSnap.val();
        list.innerHTML += `
            <div class="bg-input p-4 rounded-xl border border-theme flex justify-between items-center text-sm shadow-sm fade-in">
                <div><strong class="text-primary">${c.code}</strong> <span class="text-xs text-muted">(${c.days} يوم)</span></div>
                <span class="text-[11px] px-2 py-1 bg-card rounded-md border border-theme font-bold ${c.used ? 'text-red-500' : 'text-accent'}">${c.used ? 'مُستخدم' : 'متاح'}</span>
            </div>`;
    });
}

async function loadAdminUsers() {
    const list = document.getElementById('usersList');
    const snap = await get(child(ref(db), 'users'));
    list.innerHTML = '';
    if(!snap.exists()) return list.innerHTML = '<p class="text-center py-8 text-sm text-muted">لا يوجد متدربات</p>';
    snap.forEach(uSnap => {
        const uid = uSnap.key;
        const d = uSnap.val();
        list.innerHTML += `
            <div class="p-5 flex justify-between items-center cursor-pointer hover:bg-input border-b border-theme transition-colors" onclick="window.openUserDetail('${uid}')">
                <div>
                    <p class="font-bold text-primary text-sm">${d.email}</p>
                    <span class="text-[11px] text-accent font-bold mt-1 inline-block">${d.usedCode || 'بدون كود'}</span>
                </div>
                <span class="text-xl text-muted font-bold">›</span>
            </div>`;
    });
}
document.getElementById('refreshUsersBtn').onclick = loadAdminUsers;

window.openUserDetail = async (uid) => {
    currentAdminViewUid = uid;
    const snap = await get(child(ref(db), `users/${uid}`));
    const d = snap.val();
    activeUserData = d; 
    
    document.getElementById('adminMainView').classList.add('hidden');
    document.getElementById('adminUserDetailView').classList.remove('hidden');
    document.getElementById('detailUserEmail').innerText = d.email;
    
    if(d.endDate) {
        const isExpired = new Date(d.endDate) < new Date();
        const endTxt = document.getElementById('adminSubEndText');
        endTxt.innerText = new Date(d.endDate).toLocaleDateString('ar-SA');
        endTxt.className = isExpired ? 'text-red-500 font-black text-sm bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/30 inline-block mr-2 ml-2' : 'text-primary text-sm bg-input px-3 py-1 rounded-lg border border-theme inline-block mr-2 ml-2';
    }

    const targets = d.targets || { cal: 2000, pro: 150, carb: 200, fat: 60 };
    document.getElementById('targetCalInput').value = targets.cal;
    document.getElementById('targetProInput').value = targets.pro;
    document.getElementById('targetCarbInput').value = targets.carb;
    document.getElementById('targetFatInput').value = targets.fat;

    document.getElementById('admCurrentW').innerText = d.profile?.weight || d.goalPlan?.startWeight || '--';
    document.getElementById('admTargetW').innerText = d.goalPlan?.targetWeight || '--';

    currentAdminExercises = Array.isArray(d.plan?.exercises || d.exercises) ? (d.plan?.exercises || d.exercises) : Object.values(d.plan?.exercises || d.exercises || {});
    currentAdminMeals = Array.isArray(d.plan?.meals || d.meals) ? (d.plan?.meals || d.meals) : Object.values(d.plan?.meals || d.meals || {});
    currentAdminBadges = Array.isArray(d.badges) ? d.badges : Object.values(d.badges || {});
    currentAdminTimeline = Array.isArray(d.plan?.timeline) ? d.plan?.timeline : Object.values(d.plan?.timeline || {});

    currentAdminExercises = currentAdminExercises.filter(x => x != null);
    currentAdminMeals = currentAdminMeals.filter(x => x != null);
    currentAdminBadges = currentAdminBadges.filter(x => x != null);
    currentAdminTimeline = currentAdminTimeline.filter(x => x != null);
    
    renderAdminExercises();
    renderAdminMeals();
    renderAdminBadges();
    renderAdminTimeline();
    window.switchAdminTab('adminTabMacros');
    loadChat(uid, 'adminChatArea');
};

document.getElementById('backToAdminMainBtn').onclick = () => {
    document.getElementById('adminUserDetailView').classList.add('hidden');
    document.getElementById('adminMainView').classList.remove('hidden');
    loadAdminUsers();
};

window.addMilestone = () => {
    const title = document.getElementById('msTitle').value.trim();
    const weight = parseFloat(document.getElementById('msWeight').value) || 0;
    const note = document.getElementById('msNote').value.trim();

    if(!title || !weight) {
        showMsg("أدخلي اسم المرحلة والوزن المستهدف", true);
        return;
    }

    currentAdminTimeline.push({ title, targetWeight: weight, note });
    
    document.getElementById('msTitle').value = '';
    document.getElementById('msWeight').value = '';
    document.getElementById('msNote').value = '';
    
    renderAdminTimeline();
};

function renderAdminTimeline() {
    const list = document.getElementById('adminTimelineList');
    list.innerHTML = '';
    if(currentAdminTimeline.length === 0) {
        list.innerHTML = '<p class="text-xs text-muted py-4 text-center">لم يتم بناء خطة مخصصة بعد. ستظهر الخطة التلقائية للمتدربة.</p>';
    }
    currentAdminTimeline.forEach((m, idx) => {
        list.innerHTML += `
            <div class="bg-card p-4 rounded-xl border border-theme flex flex-col gap-3 relative shadow-sm fade-in">
                <button onclick="window.remMilestone(${idx})" class="absolute left-3 top-3 text-red-500 font-bold px-2 py-1 text-lg leading-none">✕</button>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-bold text-primary">${m.title}</span>
                    <span class="text-[10px] bg-accent text-accent-text px-3 py-1 rounded-md font-bold shadow-sm">${m.targetWeight} كج</span>
                </div>
                ${m.note ? `<span class="text-[11px] text-muted font-bold bg-input p-2 rounded-lg border border-theme border-opacity-50">${m.note}</span>` : ''}
            </div>
        `;
    });
}

window.remMilestone = (idx) => {
    currentAdminTimeline.splice(idx, 1);
    renderAdminTimeline();
};

document.getElementById('addExerciseBtn').onclick = () => { currentAdminExercises.push({title:'', media:'', type:'sets', sets:3, timerMins:5, period:'', date:''}); renderAdminExercises(); };
document.getElementById('addMealBtn').onclick = () => { currentAdminMeals.push({title:'', image:'', recipe:'', media:'', cal:400, pro:30, carb:40, fat:10, period:'', date:'', ingredients:[{name:'', amount:''}]}); renderAdminMeals(); };

document.getElementById('addBadgeBtn').onclick = () => { 
    currentAdminBadges.push({icon:'🏆', title:''}); 
    renderAdminBadges(); 
};

function renderAdminBadges() {
    const list = document.getElementById('adminBadgesList');
    list.innerHTML = '';
    if(currentAdminBadges.length === 0) {
        list.innerHTML = '<p class="text-xs text-muted text-center py-4">لا يوجد أوسمة ممنوحة حالياً.</p>';
    }
    currentAdminBadges.forEach((b, idx) => {
        list.innerHTML += `
            <div class="flex items-center gap-3 bg-input p-4 rounded-xl border border-theme relative shadow-sm fade-in">
                <button onclick="window.remBadge(${idx})" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500 font-bold px-2 py-1 text-lg">✕</button>
                <select onchange="window.updateBadgeIcon(${idx}, this.value)" class="bg-card px-3 py-3 rounded-xl text-2xl border border-theme shadow-inner">
                    <option value="🏆" ${b.icon==='🏆'?'selected':''}>🏆</option>
                    <option value="🌟" ${b.icon==='🌟'?'selected':''}>🌟</option>
                    <option value="🔥" ${b.icon==='🔥'?'selected':''}>🔥</option>
                    <option value="👑" ${b.icon==='👑'?'selected':''}>👑</option>
                    <option value="🎯" ${b.icon==='🎯'?'selected':''}>🎯</option>
                    <option value="💪" ${b.icon==='💪'?'selected':''}>💪</option>
                    <option value="🏅" ${b.icon==='🏅'?'selected':''}>🏅</option>
                    <option value="💯" ${b.icon==='💯'?'selected':''}>💯</option>
                </select>
                <input type="text" onchange="window.updateBadgeTitle(${idx}, this.value)" value="${b.title||''}" class="flex-grow bg-card px-4 py-3 rounded-xl text-sm text-primary shadow-inner" placeholder="اسم الوسام">
            </div>
        `;
    });
}
window.remBadge = (idx) => { currentAdminBadges.splice(idx, 1); renderAdminBadges(); };
window.updateBadgeIcon = (idx, val) => { currentAdminBadges[idx].icon = val; };
window.updateBadgeTitle = (idx, val) => { currentAdminBadges[idx].title = val; };

function renderAdminExercises() {
    const list = document.getElementById('adminExercisesList');
    list.innerHTML = '';
    currentAdminExercises.forEach((ex, idx) => {
        const isTimer = ex.type === 'timer';
        list.innerHTML += `
            <div class="bg-input p-5 rounded-ios-lg border border-theme relative text-sm space-y-4 shadow-sm fade-in">
                <button onclick="window.remEx(${idx})" class="absolute top-4 left-4 text-red-500 font-bold px-2 py-1 text-lg leading-none z-10">✕</button>
                <input type="text" onchange="currentAdminExercises[${idx}].title=this.value" value="${ex.title}" class="w-full bg-card px-4 py-3 rounded-xl font-bold text-primary shadow-inner pr-12" placeholder="اسم التمرين">
                
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[10px] text-muted font-bold block mb-1">تاريخ العرض (فارغ = دائم)</label>
                        <input type="date" onchange="currentAdminExercises[${idx}].date=this.value" value="${ex.date||''}" class="w-full bg-card px-3 py-2 rounded-lg text-primary text-xs shadow-inner">
                    </div>
                    <div>
                        <label class="text-[10px] text-muted font-bold block mb-1">الفترة (توضيحي)</label>
                        <input type="text" onchange="currentAdminExercises[${idx}].period=this.value" value="${ex.period||''}" class="w-full bg-card px-3 py-2 rounded-lg text-primary text-xs shadow-inner" placeholder="مثال: الأسبوع الأول">
                    </div>
                </div>

                <input type="text" onchange="currentAdminExercises[${idx}].media=this.value" value="${ex.media}" class="w-full bg-card px-4 py-3 rounded-xl text-accent font-medium text-xs shadow-inner" placeholder="رابط فيديو">
                
                <div class="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-xl border border-theme shadow-inner">
                    <select onchange="window.toggleExType(${idx}, this.value)" class="bg-input px-3 py-3 rounded-lg text-primary font-bold text-sm border border-theme sm:w-1/2">
                        <option value="sets" ${!isTimer?'selected':''}>جولات</option>
                        <option value="timer" ${isTimer?'selected':''}>مؤقت زمني</option>
                    </select>

                    ${isTimer ? `
                        <div class="flex items-center justify-between sm:justify-start gap-3 sm:w-1/2 sm:border-r border-theme sm:pr-4"><span class="text-xs text-muted font-bold">المدة (دقائق):</span><input type="number" onchange="currentAdminExercises[${idx}].timerMins=parseInt(this.value)" value="${ex.timerMins||5}" class="w-20 bg-input px-2 py-2 text-center rounded-lg text-primary font-bold border border-theme shadow-inner"></div>
                    ` : `
                        <div class="flex items-center justify-between sm:justify-start gap-3 sm:w-1/2 sm:border-r border-theme sm:pr-4"><span class="text-xs text-muted font-bold">عدد الجولات:</span><input type="number" onchange="currentAdminExercises[${idx}].sets=parseInt(this.value)" value="${ex.sets||3}" class="w-20 bg-input px-2 py-2 text-center rounded-lg text-primary font-bold border border-theme shadow-inner"></div>
                    `}
                </div>
            </div>`;
    });
}
window.remEx = (idx) => { currentAdminExercises.splice(idx, 1); renderAdminExercises(); };
window.toggleExType = (idx, val) => { currentAdminExercises[idx].type = val; renderAdminExercises(); };

function renderAdminMeals() {
    const list = document.getElementById('adminMealsList');
    list.innerHTML = '';
    currentAdminMeals.forEach((m, idx) => {
        let ingredientsHtml = (m.ingredients || []).map((ing, iIdx) => `
            <div class="flex gap-2 mb-3 items-center">
                <input type="text" onchange="currentAdminMeals[${idx}].ingredients[${iIdx}].name=this.value" value="${ing.name}" class="flex-grow bg-card px-3 py-2.5 rounded-lg text-xs text-primary shadow-inner" placeholder="المكون">
                <input type="text" onchange="currentAdminMeals[${idx}].ingredients[${iIdx}].amount=this.value" value="${ing.amount}" class="w-24 bg-card px-3 py-2.5 rounded-lg text-xs text-center text-primary shadow-inner" placeholder="الكمية">
                <button onclick="window.remIng(${idx}, ${iIdx})" class="text-red-500 font-bold px-2 py-1 text-lg">✕</button>
            </div>
        `).join('');

        list.innerHTML += `
            <div class="bg-input p-5 rounded-ios-lg border border-theme relative text-sm space-y-4 shadow-sm fade-in">
                <button onclick="window.remMeal(${idx})" class="absolute top-4 left-4 text-red-500 font-bold px-2 py-1 text-lg leading-none z-10">✕</button>
                
                <input type="text" onchange="currentAdminMeals[${idx}].title=this.value" value="${m.title}" class="w-full bg-card px-4 py-3.5 rounded-xl font-bold text-primary pr-12 shadow-inner" placeholder="اسم الوجبة">
                
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[10px] text-muted font-bold block mb-1">تاريخ العرض (فارغ = دائم)</label>
                        <input type="date" onchange="currentAdminMeals[${idx}].date=this.value" value="${m.date||''}" class="w-full bg-card px-3 py-2 rounded-lg text-primary text-xs shadow-inner">
                    </div>
                    <div>
                        <label class="text-[10px] text-muted font-bold block mb-1">الفترة (توضيحي)</label>
                        <input type="text" onchange="currentAdminMeals[${idx}].period=this.value" value="${m.period||''}" class="w-full bg-card px-3 py-2 rounded-lg text-primary text-xs shadow-inner" placeholder="مثال: الإفطار">
                    </div>
                </div>
                
                <div class="grid grid-cols-4 gap-3 bg-card p-3 rounded-xl border border-theme text-center shadow-inner">
                    <div><label class="text-[10px] text-muted block mb-2 font-bold">سعرات</label><input type="number" onchange="currentAdminMeals[${idx}].cal=this.value" value="${m.cal||0}" class="w-full bg-transparent font-bold text-primary text-base outline-none text-center"></div>
                    <div><label class="text-[10px] text-muted block mb-2 font-bold">بروتين</label><input type="number" onchange="currentAdminMeals[${idx}].pro=this.value" value="${m.pro||0}" class="w-full bg-transparent font-bold text-accent text-base outline-none text-center"></div>
                    <div><label class="text-[10px] text-muted block mb-2 font-bold">كارب</label><input type="number" onchange="currentAdminMeals[${idx}].carb=this.value" value="${m.carb||0}" class="w-full bg-transparent font-bold text-blue-500 text-base outline-none text-center"></div>
                    <div><label class="text-[10px] text-muted block mb-2 font-bold">دهون</label><input type="number" onchange="currentAdminMeals[${idx}].fat=this.value" value="${m.fat||0}" class="w-full bg-transparent font-bold text-yellow-500 text-base outline-none text-center"></div>
                </div>

                <div class="p-4 border border-theme rounded-xl bg-card shadow-sm">
                    <span class="text-sm text-primary font-bold block mb-3">المكونات:</span>
                    ${ingredientsHtml}
                    <button onclick="window.addIng(${idx})" class="w-full text-xs bg-input text-primary font-bold py-3 rounded-lg mt-2 border border-theme shadow-sm transition-transform active:scale-95">+ إضافة مكون</button>
                </div>

                <input type="text" onchange="currentAdminMeals[${idx}].image=this.value" value="${m.image||''}" class="w-full bg-card px-4 py-3 rounded-xl text-xs text-accent shadow-inner" placeholder="رابط الصورة (اختياري)">
                <textarea onchange="currentAdminMeals[${idx}].recipe=this.value" rows="3" class="w-full bg-card px-4 py-3 rounded-xl text-sm text-primary leading-relaxed shadow-inner" placeholder="طريقة التحضير...">${m.recipe||''}</textarea>
                <input type="text" onchange="currentAdminMeals[${idx}].media=this.value" value="${m.media||''}" class="w-full bg-card px-4 py-3 rounded-xl text-xs text-accent shadow-inner" placeholder="رابط فيديو (اختياري)">
            </div>`;
    });
}
window.remMeal = (idx) => { currentAdminMeals.splice(idx, 1); renderAdminMeals(); };
window.addIng = (mIdx) => { currentAdminMeals[mIdx].ingredients = currentAdminMeals[mIdx].ingredients || []; currentAdminMeals[mIdx].ingredients.push({name:'', amount:''}); renderAdminMeals(); };
window.remIng = (mIdx, iIdx) => { currentAdminMeals[mIdx].ingredients.splice(iIdx, 1); renderAdminMeals(); };

document.getElementById('adminSaveAllBtn').onclick = async () => {
    const targets = {
        cal: parseInt(document.getElementById('targetCalInput').value) || 2000,
        pro: parseInt(document.getElementById('targetProInput').value) || 150,
        carb: parseInt(document.getElementById('targetCarbInput').value) || 200,
        fat: parseInt(document.getElementById('targetFatInput').value) || 60
    };
    const btn = document.getElementById('adminSaveAllBtn');
    btn.innerText = 'جاري الحفظ...';

    const cleanBadges = currentAdminBadges.filter(b => b != null && b.title && b.title.trim() !== '');

    await update(ref(db, `users/${currentAdminViewUid}`), { 
        targets: targets,
        'plan/exercises': currentAdminExercises.length ? currentAdminExercises : null, 
        'plan/meals': currentAdminMeals.length ? currentAdminMeals : null,
        'plan/timeline': currentAdminTimeline.length ? currentAdminTimeline : null,
        badges: cleanBadges.length > 0 ? cleanBadges : null
    });
    showMsg("تم الحفظ والنشر بنجاح!", false);
    btn.innerText = 'حفظ ونشر الكل ✔️';
};

// ================= CHAT SYSTEM =================
function formatChatMsg(m, isAdminContext) {
    const isMe = isAdminContext ? (m.sender === 'admin') : (m.sender === 'user');
    const css = isMe ? 'msg-me' : 'msg-other';
    let content = m.type === 'image' ? `<img src="${m.text}" class="chat-img">` : m.text;
    
    let timeStr = "";
    if (m.time) {
        const d = new Date(m.time);
        timeStr = d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }

    let ticks = isMe ? `<span class="chat-ticks">✔✔</span>` : '';

    return `
    <div class="chat-bubble ${css} fade-in">
        <div>${content}</div>
        <div class="chat-meta">
            <span>${timeStr}</span>
            ${ticks}
        </div>
    </div>`;
}

function loadChat(uid, areaId) {
    const area = document.getElementById(areaId);
    const isAdminContext = areaId === 'adminChatArea';
    onValue(ref(db, `chats/${uid}`), (snap) => {
        area.innerHTML = '';
        if(snap.exists()){
            snap.forEach(c => {
                area.innerHTML += formatChatMsg(c.val(), isAdminContext);
            });
            setTimeout(() => area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' }), 100);
        }
    });
}

window.checkAndSendAutoReply = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const currentMins = h * 60 + m;
    let isOutside = false;
    
    if(globalWorkHours && globalWorkHours.start && globalWorkHours.end) {
        const [sH, sM] = globalWorkHours.start.split(':').map(Number);
        const [eH, eM] = globalWorkHours.end.split(':').map(Number);
        const startMins = sH * 60 + sM;
        const endMins = eH * 60 + eM;
        
        if (startMins <= endMins) {
            if (currentMins < startMins || currentMins >= endMins) isOutside = true;
        } else {
            if (currentMins < startMins && currentMins >= endMins) isOutside = true;
        }
    }

    if(isOutside && (Date.now() - lastAutoReplyTime > 5 * 60 * 1000)) {
        lastAutoReplyTime = Date.now();
        setTimeout(() => {
            push(ref(db, `chats/${auth.currentUser.uid}`), { 
                text: "عذراً، كوتش صحة خارج أوقات العمل حالياً 🌙. سيتم الرد عليك فور عودتنا خلال أوقات العمل الرسمية 💛.", 
                type: 'text', 
                sender: 'admin', 
                time: Date.now() 
            });
        }, 1500);
    }
};

document.getElementById('userSendChatBtn').onclick = () => {
    const inp = document.getElementById('userChatInput');
    const text = inp.value.trim();
    if(text){ 
        push(ref(db, `chats/${auth.currentUser.uid}`), { text: text, type: 'text', sender: 'user', time: Date.now() }); 
        inp.value = ''; 
        window.checkAndSendAutoReply();
    }
};

document.getElementById('adminSendChatBtn').onclick = () => {
    const inp = document.getElementById('adminChatInput');
    if(inp.value.trim() && currentAdminViewUid){ push(ref(db, `chats/${currentAdminViewUid}`), { text: inp.value, type: 'text', sender: 'admin', time: Date.now() }); inp.value = ''; }
};

document.getElementById('userChatInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') document.getElementById('userSendChatBtn').click();
});
document.getElementById('adminChatInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') document.getElementById('adminSendChatBtn').click();
});

document.getElementById('userChatFile').onchange = (e) => handleImageUpload(e, auth.currentUser.uid, 'user');
document.getElementById('adminChatFile').onchange = (e) => handleImageUpload(e, currentAdminViewUid, 'admin');
