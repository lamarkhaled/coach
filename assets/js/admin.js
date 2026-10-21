import { db } from './firebase-config.js';
import { ref, set, get, child, update, remove, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

export function initAdmin() {
    
    // إنشاء كود جديد
    document.getElementById('generateCodeBtn').onclick = async () => {
        const code = document.getElementById('adminNewCode').value.trim().toUpperCase();
        const days = parseInt(document.getElementById('codeDays').value) || 0;
        if(code && days) {
            await set(ref(db, `codes/${code}`), { code, days, used: false });
            window.showMsg("تم حفظ الكود", false);
            document.getElementById('adminNewCode').value = '';
            window.loadAdminCodes();
        }
    };

    // جلب المشتركات
    window.loadAdminUsers = async () => {
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
    };
    document.getElementById('refreshUsersBtn').onclick = window.loadAdminUsers;

    // فتح ملف المتدربة
    window.openUserDetail = async (uid) => {
        window.currentAdminViewUid = uid;
        const snap = await get(child(ref(db), `users/${uid}`));
        const d = snap.val();
        window.activeUserData = d; 
        
        document.getElementById('adminMainView').classList.add('hidden');
        document.getElementById('adminUserDetailView').classList.remove('hidden');
        document.getElementById('detailUserEmail').innerText = d.email;
        
        window.currentAdminExercises = Array.isArray(d.plan?.exercises || d.exercises) ? (d.plan?.exercises || d.exercises) : Object.values(d.plan?.exercises || d.exercises || {});
        window.currentAdminMeals = Array.isArray(d.plan?.meals || d.meals) ? (d.plan?.meals || d.meals) : Object.values(d.plan?.meals || d.meals || {});
        
        // استدعاء دوال الرندر اللي سويتيها في كودك هنا
        // window.renderAdminExercises();
        // window.renderAdminMeals();

        window.switchAdminTab('adminTabMacros');
        window.loadChat(uid, 'adminChatArea');
    };

    document.getElementById('backToAdminMainBtn').onclick = () => {
        document.getElementById('adminUserDetailView').classList.add('hidden');
        document.getElementById('adminMainView').classList.remove('hidden');
        window.loadAdminUsers();
    };

    // حفظ كل تعديلات الأدمن
    document.getElementById('adminSaveAllBtn').onclick = async () => {
        const btn = document.getElementById('adminSaveAllBtn');
        btn.innerText = 'جاري الحفظ...';
        
        const cleanExercises = window.currentAdminExercises.filter(e => e != null && e.title && e.title.trim() !== '');
        const cleanMeals = window.currentAdminMeals.filter(m => m != null && m.title && m.title.trim() !== '');

        await update(ref(db, `users/${window.currentAdminViewUid}`), { 
            'plan/exercises': cleanExercises.length > 0 ? cleanExercises : null, 
            'plan/meals': cleanMeals.length > 0 ? cleanMeals : null
            // يمكنك إضافة badges و timeline هنا
        });
        window.showMsg("تم الحفظ والنشر بنجاح!", false);
        btn.innerText = 'حفظ ونشر الكل ✔️';
    };

    // شات الأدمن
    document.getElementById('adminSendChatBtn').onclick = () => {
        const inp = document.getElementById('adminChatInput');
        if(inp.value.trim() && window.currentAdminViewUid){ 
            push(ref(db, `chats/${window.currentAdminViewUid}`), { text: inp.value, type: 'text', sender: 'admin', time: Date.now() }); 
            inp.value = ''; 
        }
    };
}
