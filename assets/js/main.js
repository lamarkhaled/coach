import { auth, db } from './firebase-config.js';
import { initUI } from './ui.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// إدارة الحالة العامة (Global State) للتواصل بين الملفات
window.AppState = {
    adminEmail: "lm6p12@gmail.com",
    activeUserData: null,
    currentAdminViewUid: null,
    todayExercisesList: [],
    // ... يمكن إضافة المزيد هنا
};

document.addEventListener('DOMContentLoaded', () => {
    // تشغيل دوال الواجهة
    initUI();
    
    // إعداد أزرار الترحيب والتنقل
    document.getElementById('showLoginBtn').onclick = () => { window.AppState.isRegisterMode = false; document.getElementById('authTitle').innerText = 'تسجيل الدخول'; showSection('authSection'); };
    document.getElementById('showRegisterBtn').onclick = () => { window.AppState.isRegisterMode = true; document.getElementById('authTitle').innerText = 'حساب جديد'; showSection('authSection'); };
    document.getElementById('backToWelcomeBtn').onclick = () => showSection('welcomeSection');

    // مراقبة حالة تسجيل الدخول
    onAuthStateChanged(auth, async (user) => {
        if (!user) return showSection('welcomeSection');
        
        if (user.email === window.AppState.adminEmail) {
            showSection('adminDashboard');
            document.getElementById('adminMainView').classList.remove('hidden');
            // استدعاء ملف المشرف مستقبلاً (loadAdminUsers)
            return;
        }

        // استدعاء بيانات المتدربة وعرضها
        // (سيتم الربط مع widgets.js و auth.js لاستكمال العمليات)
    });
});
