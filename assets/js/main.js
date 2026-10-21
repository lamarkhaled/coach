import { auth, db } from './firebase-config.js';
import { initUI } from './ui.js';
import { initAuth } from './auth.js';
import { initWidgets } from './widgets.js';
import { initAdmin } from './admin.js';

// تعريف المتغيرات المشتركة عالمياً لتتعرف عليها كل الملفات والأزرار
window.adminEmail = "lm6p12@gmail.com";
window.activeUserData = null;
window.currentAdminViewUid = null;
window.currentAdminExercises = [];
window.currentAdminMeals = [];
window.currentAdminBadges = [];
window.currentAdminTimeline = [];
window.todayExercisesList = [];
window.playerActiveIndex = 0;
window.exerciseTimerInterval = null;
window.exerciseRemainingSeconds = 0;
window.isTimerRunning = false;
window.leaderboardListenerAttached = false;
window.globalWorkHours = { start: '09:00', end: '17:00' };
window.lastAutoReplyTime = 0;

// دالة مشتركة لمعرفة تاريخ اليوم
window.getTodayStr = () => { 
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// تشغيل النظام بعد تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initWidgets();
    initAdmin();
    initAuth(); // المصادقة تكون آخر شيء عشان تعتمد على الدوال اللي قبلها
});
