export function initUI() {
    window.fireConfetti = () => {
        const colors = ['#C6F432', '#ff4b4b', '#4CAF50', '#2196F3', '#FFC107', '#E91E63', '#9C27B0'];
        const container = document.createElement('div');
        container.style.position = 'fixed'; container.style.inset = '0';
        container.style.pointerEvents = 'none'; container.style.zIndex = '99999';
        container.style.overflow = 'hidden'; document.body.appendChild(container);
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
            html.classList.remove('dark'); html.classList.add('light');
            btn.innerText = '🌙 ليلي';
        } else {
            html.classList.remove('light'); html.classList.add('dark');
            btn.innerText = '☀️ فاتح';
        }
    };

    window.showSection = (sectionId) => {
        ['welcomeSection', 'authSection', 'activationSection', 'onboardingSection', 'userDashboard', 'adminDashboard', 'verifyEmailSection', 'adminTabRegLog'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });
        
        if (sectionId === 'adminTabRegLog') {
            document.getElementById('adminDashboard')?.classList.remove('hidden');
            document.getElementById('adminMainView')?.classList.add('hidden');
        }
        
        const sectionEl = document.getElementById(sectionId);
        if(sectionEl) sectionEl.classList.remove('hidden');
        
        const isUserMain = sectionId === 'userDashboard';
        const navBar = document.getElementById('bottomNavBar');
        if(navBar) navBar.classList.toggle('hidden', !isUserMain);
        
        const logoutBtn = document.getElementById('logoutBtn');
        if(logoutBtn) logoutBtn.classList.toggle('hidden', sectionId === 'welcomeSection' || sectionId === 'authSection');

        const profileBtn = document.getElementById('profileBtn');
        const subDetailsBtn = document.getElementById('subDetailsBtn');
        if(profileBtn) profileBtn.classList.toggle('hidden', !isUserMain);
        if(subDetailsBtn) subDetailsBtn.classList.toggle('hidden', !isUserMain);
    };

    window.showMsg = (text, isError=true) => {
        const m = document.getElementById('globalMessage');
        if(!m) return;
        m.textContent = text;
        m.className = `fixed top-24 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-2xl text-sm font-bold text-center shadow-2xl block w-max max-w-[90%] border fade-in ${isError ? 'bg-red-500 text-white border-red-600' : 'bg-card text-primary border-theme'}`;
        setTimeout(() => { m.classList.add('hidden'); m.classList.remove('fade-in'); }, 4000);
    };

    window.switchTab = (tabId) => {
        document.querySelectorAll('.user-tab').forEach(t => t.classList.add('hidden'));
        document.getElementById(tabId)?.classList.remove('hidden');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        if(tabId === 'tabHome') document.getElementById('navBtnHome')?.classList.add('active');
        if(tabId === 'tabPlan') document.getElementById('navBtnPlan')?.classList.add('active');
        if(tabId === 'tabChat') {
            document.getElementById('navBtnChat')?.classList.add('active');
            if(window.loadChat && window.currentUserUid) window.loadChat(window.currentUserUid, 'userChatArea');
        }
    };

    window.switchAdminTab = (tabId) => {
        if(tabId === 'adminTabRegLog') {
            window.showSection('adminTabRegLog');
            window.loadAdminRegLog();
            return;
        }
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
        document.getElementById(tabId)?.classList.remove('hidden');
        ['btnAdmTabMacros', 'btnAdmTabMeals', 'btnAdmTabWorkouts', 'btnAdmTabTimeline', 'btnAdmTabChat', 'btnAdmTabBadges', 'btnAdmTabRegLog'].forEach(id => {
            const btn = document.getElementById(id);
            if(btn) btn.className = 'flex-1 min-w-[30%] py-3.5 text-[11px] font-bold rounded-xl text-muted border border-transparent transition-all';
        });
        const activeMap = { 'adminTabMacros': 'btnAdmTabMacros', 'adminTabMeals': 'btnAdmTabMeals', 'adminTabWorkouts': 'btnAdmTabWorkouts', 'adminTabTimeline': 'btnAdmTabTimeline', 'adminTabChat': 'btnAdmTabChat', 'adminTabBadges': 'btnAdmTabBadges', 'adminTabRegLog': 'btnAdmTabRegLog' };
        if(activeMap[tabId] && document.getElementById(activeMap[tabId])) {
            document.getElementById(activeMap[tabId]).className = 'flex-1 min-w-[30%] py-3.5 text-[11px] font-bold rounded-xl bg-card text-primary shadow-sm border border-theme transition-all';
        }
    };

    window.switchPlanSubTab = (sub) => {
        document.querySelectorAll('.plan-sub-tab').forEach(t => t.classList.add('hidden'));
        document.getElementById('subTab' + (sub === 'nutrition' ? 'Nutrition' : 'Workouts'))?.classList.remove('hidden');
        if(document.getElementById('btnSubNut')) document.getElementById('btnSubNut').className = sub === 'nutrition' ? 'flex-1 bg-accent font-bold py-3.5 rounded-xl text-sm transition-all text-accent-text shadow-sm' : 'flex-1 bg-transparent text-muted font-bold py-3.5 rounded-xl text-sm transition-all';
        if(document.getElementById('btnSubWork')) document.getElementById('btnSubWork').className = sub === 'workouts' ? 'flex-1 bg-accent font-bold py-3.5 rounded-xl text-sm transition-all text-accent-text shadow-sm' : 'flex-1 bg-transparent text-muted font-bold py-3.5 rounded-xl text-sm transition-all';
    };
}
