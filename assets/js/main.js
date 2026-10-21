import { initUI } from './ui.js';
import { initAuth } from './auth.js';
import { initWidgets } from './widgets.js';
import { initAdmin } from './admin.js';
import { db } from './firebase-config.js';
import { onValue, ref } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// تعريف المتغيرات المشتركة عالمياً لتعمل مع الـ HTML OnClick
window.adminEmail = "lm6p12@gmail.com";
window.activeUserData = null;
window.currentAdminViewUid = null;
window.currentAdminExercises = [];
window.currentAdminMeals = [];
window.todayExercisesList = [];
window.leaderboardListenerAttached = false;

// دوال مشتركة
window.getTodayStr = function() { 
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

window.loadChat = function(uid, areaId) {
    const area = document.getElementById(areaId);
    const isAdminContext = areaId === 'adminChatArea';
    onValue(ref(db, `chats/${uid}`), (snap) => {
        area.innerHTML = '';
        if(snap.exists()){
            snap.forEach(c => {
                const m = c.val();
                const isMe = isAdminContext ? (m.sender === 'admin') : (m.sender === 'user');
                const css = isMe ? 'msg-me' : 'msg-other';
                let timeStr = m.time ? new Date(m.time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';
                area.innerHTML += `
                <div class="chat-bubble ${css} fade-in">
                    <div>${m.type === 'image' ? `<img src="${m.text}" class="chat-img">` : m.text}</div>
                    <div class="chat-meta"><span>${timeStr}</span></div>
                </div>`;
            });
            setTimeout(() => area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' }), 100);
        }
    });
};

// بدء تشغيل كل الأقسام
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initAuth();
    initWidgets();
    initAdmin();
});
