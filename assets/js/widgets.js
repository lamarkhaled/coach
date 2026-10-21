import { auth, db } from './firebase-config.js';
import { ref, update, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

export function initWidgets() {
    window.renderUserDashboard = (data) => {
        window.activeUserData = data;
        const todayStr = window.getTodayStr(); 
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const banner = document.getElementById('currentDayBanner');
        if(banner) banner.innerText = new Date().toLocaleDateString('ar-SA', dateOptions);

        if(data.profile?.height) document.getElementById('userHeightInput').value = data.profile.height;
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

        if(!window.leaderboardListenerAttached) {
            loadLeaderboardAuto();
            window.leaderboardListenerAttached = true;
        }

        const allMeals = Array.isArray(data.plan?.meals || data.meals) ? (data.plan?.meals || data.meals) : Object.values(data.plan?.meals || data.meals || {}).filter(x => x != null && x.title);
        const todayMeals = allMeals.map((m, i) => ({...m, _idx: i})).filter(m => !m.date || m.date === todayStr);

        const allExercises = Array.isArray(data.plan?.exercises || data.exercises) ? (data.plan?.exercises || data.exercises) : Object.values(data.plan?.exercises || data.exercises || {}).filter(x => x != null && x.title);
        window.todayExercisesList = allExercises.map((ex, i) => ({...ex, _idx: i})).filter(ex => !ex.date || ex.date === todayStr);

        renderUserNutritionCourse(todayMeals, data.progress?.meals, data.progress?.swaps, data.targets);
        renderUserWorkoutSummary(window.todayExercisesList, data.progress?.workouts);
    };

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

    function renderDetailedGoalTimeline(goalPlan, currentWeight, customTimeline) {
        const card = document.getElementById('goalTimelineCard');
        const container = document.getElementById('timelineContainerArea');
        if(!goalPlan) { card.classList.add('hidden'); return; }
        card.classList.remove('hidden');

        const startW = goalPlan.startWeight;
        const targetW = goalPlan.targetWeight;
        const curW = currentWeight || startW;
        const isGaining = targetW > startW;
        let isGoalReached = (!isGaining && curW <= targetW) || (isGaining && curW >= targetW);

        const badge = document.getElementById('goalStatusBadge');
        if(isGoalReached) {
            badge.innerText = 'أتممت الهدف 👑';
            badge.className = 'text-[10px] bg-accent text-accent-text px-3 py-1.5 rounded-lg font-bold shadow-sm';
        } else {
            badge.innerText = 'مستمر 🔥';
            badge.className = 'text-[10px] bg-blue-500/20 text-blue-500 border border-blue-500/30 px-3 py-1.5 rounded-lg font-bold shadow-sm';
        }

        if(customTimeline && customTimeline.length > 0) {
            let passedCount = 0;
            customTimeline.forEach(m => {
                if((!isGaining && curW <= m.targetWeight) || (isGaining && curW >= m.targetWeight)) passedCount++;
            });
            let progressPercent = customTimeline.length > 0 ? (passedCount / customTimeline.length) * 100 : 0;
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
                const clickAttr = isPassed ? `onclick="window.openMilestone('${m.title}', '${m.note || ''}')"` : '';

                htmlStr += `
                    <div class="timeline-step-pro">
                        <div class="timeline-icon-pro ${iconClass}" ${clickAttr}>${iconSymbol}</div>
                        <div class="bg-card p-5 rounded-2xl border ${isPassed ? 'border-accent shadow-lg cursor-pointer active:scale-95 transition-transform' : 'border-theme shadow-sm'}" ${clickAttr}>
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

    // تحديث القياسات
    document.getElementById('updateProgressBtn').onclick = async () => {
        const newW = parseFloat(document.getElementById('userCurrentWeight').value);
        const newH = parseFloat(document.getElementById('userHeightInput').value) || window.activeUserData.profile?.height || 160;
        if(isNaN(newW)) return window.showMsg("أدخلي الوزن بشكل صحيح");

        const uid = auth.currentUser.uid;
        const weightHistory = window.activeUserData.progress?.weightHistory || {};
        const timestamp = new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
        weightHistory[timestamp] = newW;

        window.activeUserData.progress = window.activeUserData.progress || {};
        window.activeUserData.progress.weightHistory = weightHistory;
        window.activeUserData.progress.currentWeight = newW;
        window.activeUserData.profile = window.activeUserData.profile || {};
        window.activeUserData.profile.height = newH;
        window.activeUserData.profile.weight = newW;

        await update(ref(db, `users/${uid}/progress`), window.activeUserData.progress);
        await update(ref(db, `users/${uid}/profile`), window.activeUserData.profile);
        window.showMsg("تم حفظ القياس بنجاح 🌟", false);
        window.renderUserDashboard(window.activeUserData);
    };

    function loadLeaderboardAuto() {
        onValue(ref(db, 'users'), (snap) => {
            const container = document.getElementById('leaderboardContainer');
            if(!snap.exists()) { container.innerHTML = '<p class="text-sm text-muted text-center py-4">لا توجد منافسة حالياً.</p>'; return; }
            let usersArr = [];
            snap.forEach(u => {
                const val = u.val();
                if(val.email === window.adminEmail) return; 
                let score = 0;
                const today = window.getTodayStr();
                const wDone = val.progress?.workouts?.[today] || {};
                const mDone = val.progress?.meals?.[today] || {};
                score += Object.keys(wDone).length * 10 + Object.keys(mDone).length * 5;
                if(val.badges) {
                    const bList = Array.isArray(val.badges) ? val.badges : Object.values(val.badges);
                    score += bList.filter(b=>b!=null&&b.title).length * 50; 
                }
                usersArr.push({ email: val.email.split('@')[0], score });
            });
            usersArr.sort((a,b) => b.score - a.score);
            container.innerHTML = usersArr.slice(0, 3).map((usr, idx) => `
                <div class="flex justify-between items-center ${idx===0 ? 'bg-gradient-to-r from-accent/20 to-transparent border-accent/30' : 'bg-input border-theme'} px-4 py-4 rounded-xl border text-sm shadow-sm fade-in">
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-2xl drop-shadow-sm">${idx===0?'🥇':idx===1?'🥈':'🥉'}</span>
                        <span class="font-bold text-primary text-base">${usr.email}</span>
                    </div>
                    <span class="bg-card border border-theme px-3 py-1.5 rounded-lg text-primary text-xs font-bold shadow-sm">${usr.score} نقطة</span>
                </div>
            `).join('');
        });
    }

    // الوجبات
    function renderUserNutritionCourse(meals, progress, swaps, targets) {
        const area = document.getElementById('userNutritionCourse');
        area.innerHTML = '';
        const today = window.getTodayStr();
        const doneMeals = progress?.[today] || {};
        const todaySwaps = swaps?.[today] || [];
        const userTargets = targets || { cal: 2000, pro: 150, carb: 200, fat: 60 };

        let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
        meals?.forEach((m) => {
            if(doneMeals[m._idx]) {
                totalCal += Number(m.cal || 0); totalPro += Number(m.pro || 0); totalCarb += Number(m.carb || 0); totalFat += Number(m.fat || 0);
            }
        });
        todaySwaps.forEach(sw => {
            totalCal += Number(sw.cal || 0); totalPro += Number(sw.pro || 0); totalCarb += Number(sw.carb || 0); totalFat += Number(sw.fat || 0);
        });

        document.getElementById('targetCalVal').innerText = userTargets.cal;
        document.getElementById('macroCalVal').innerText = totalCal;
        // يتم تطبيق الباقي للبروتين والكارب والدهون بنفس الطريقة (راجع كودك الأصلي للماكروز لتحديث النصوص)
        
        let html = '';
        if(meals && meals.length > 0) {
            meals.forEach((m, displayIdx) => {
                const realIdx = m._idx;
                const isDone = doneMeals[realIdx];
                html += `
                    <div class="bg-card p-6 rounded-ios-lg border border-theme space-y-4 shadow-sm fade-in">
                        <h3 class="font-bold text-lg text-primary">${m.title}</h3>
                        <button onclick="window.toggleMealDone(${realIdx})" class="w-full py-3.5 rounded-xl text-sm font-bold border border-theme shadow-sm transition-transform active:scale-95 ${isDone ? 'bg-accent text-accent-text' : 'bg-input text-primary'}">
                            ${isDone ? 'تم تناولها ✔️' : 'تسجيل التناول'}
                        </button>
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

    // التمارين
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

    // الشات وإرسال رسائل المستخدم
    document.getElementById('userSendChatBtn').onclick = () => {
        const inp = document.getElementById('userChatInput');
        const text = inp.value.trim();
        if(text){ 
            push(ref(db, `chats/${auth.currentUser.uid}`), { text: text, type: 'text', sender: 'user', time: Date.now() }); 
            inp.value = ''; 
        }
    };
}
