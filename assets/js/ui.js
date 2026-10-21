export function initUI() {
    window.toggleThemeMode = () => {
        const html = document.documentElement;
        const btn = document.getElementById('themeToggleBtn');
        if(html.classList.contains('dark')) {
            html.classList.replace('dark', 'light');
            btn.innerText = '🌙 ليلي';
        } else {
            html.classList.replace('light', 'dark');
            btn.innerText = '☀️ فاتح';
        }
    };

    window.showSection = (sectionId) => {
        ['welcomeSection', 'authSection', 'activationSection', 'onboardingSection', 'userDashboard', 'adminDashboard']
            .forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById(sectionId)?.classList.remove('hidden');
        
        const isUserMain = sectionId === 'userDashboard';
        document.getElementById('bottomNavBar')?.classList.toggle('hidden', !isUserMain);
        document.getElementById('logoutBtn')?.classList.toggle('hidden', sectionId === 'welcomeSection' || sectionId === 'authSection');
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
        if(tabId === 'tabChat') document.getElementById('navBtnChat')?.classList.add('active');
    };

    window.switchAdminTab = (tabId) => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
        document.getElementById(tabId)?.classList.remove('hidden');
        
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
        document.getElementById('subTab' + (sub === 'nutrition' ? 'Nutrition' : 'Workouts'))?.classList.remove('hidden');
        document.getElementById('btnSubNut').className = sub === 'nutrition' ? 'flex-1 bg-accent font-bold py-3.5 rounded-xl text-sm transition-all text-accent-text shadow-sm' : 'flex-1 bg-transparent text-muted font-bold py-3.5 rounded-xl text-sm transition-all';
        document.getElementById('btnSubWork').className = sub === 'workouts' ? 'flex-1 bg-accent font-bold py-3.5 rounded-xl text-sm transition-all text-accent-text shadow-sm' : 'flex-1 bg-transparent text-muted font-bold py-3.5 rounded-xl text-sm transition-all';
    };
}
