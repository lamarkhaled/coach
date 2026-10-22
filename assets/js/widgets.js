import { auth, db } from './firebase-config.js';
import { ref, update, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

export function initWidgets() {

    function buildNativeVideoPlayer(url) {
        if(!url) return '';
        const lower = url.toLowerCase();
        if(lower.match(/\.(mp4|webm|mov)$/)) return `<video src="${url}" controls playsinline class="w-full rounded-2xl my-4 border border-theme bg-black shadow-md"></video>`;
        if(lower.includes('youtube.com/watch?v=') || lower.includes('youtu.be/')) {
            let vidId = lower.includes('youtu.be/') ? url.split('youtu.be/')[1] : url.split('v=')[1].split('&')[0];
            return `<div class="rounded-2xl overflow-hidden my-4 border border-theme shadow-md"><iframe src="https://www.youtube.com/embed/${vidId}?rel=0" class="w-full h-56 sm:h-72" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        }
        if(lower.match(/\.(jpeg|jpg|gif|png|webp)$/)) return `<img src="${url}" class="w-full rounded-2xl my-4 border border-theme shadow-md">`;
        return `<a href="${url}" target="_blank" class="block w-full bg-input text-accent text-center py-4 rounded-xl text-sm font-bold my-4 border border-theme shadow-sm transition-transform active:scale-95">فتح الرابط المرفق</a>`;
    }

    window.openSubscriptionModal = () => {
        if(!window.activeUserData || !window.activeUserData.endDate) return;
        const start = new Date(window.activeUserData.startDate || Date.now());
        const end = new Date(window.activeUserData.endDate);
        const now = new Date();

        const totalMs = end - start;
        const elapsedMs = now - start;
        const leftMs = end - now;

        const totalDays = Math.max(1, Math.ceil(totalMs / 86400000));
        const elapsedDays = Math.max(0, Math.floor(elapsedMs / 86400000));
        const leftDays = Math.max(0, Math.ceil(leftMs / 86400000));

        let progressPercent = (elapsedDays / totalDays) * 100;
        if(progressPercent > 100) progressPercent = 100;
        if(progressPercent < 0) progressPercent = 0;

        document.getElementById('subEndDateTxt').innerText = end.toLocaleDateString('ar-SA');
        document.getElementById('subElapsedTxt').innerText = elapsedDays;
        document.getElementById('subLeftTxt').innerText = leftDays;
        document.getElementById('subProgressBar').style.width = `${progressPercent}%`;

        document.getElementById('subscriptionModal').classList.remove('hidden');
    };

    const subDetailsBtn = document.getElementById('subDetailsBtn');
    if(subDetailsBtn) {
        subDetailsBtn.onclick = window.openSubscriptionModal;
    }

    const renewEarlyBtn = document.getElementById('renewEarlyBtn');
    if(renewEarlyBtn) {
        renewEarlyBtn.onclick = () => {
            document.getElementById('subscriptionModal').classList.add('hidden');
            window.showSection('activationSection');
            document.getElementById('cancelActivationBtn').classList.remove('hidden');
        };
    }

    const cancelActivationBtn = document.getElementById('cancelActivationBtn');
    if(cancelActivationBtn) {
        cancelActivationBtn.onclick = () => {
            window.showSection('userDashboard');
        };
    }

    window.renderUserDashboard = (data) => {
        window.activeUserData = data; const todayStr = window.getTodayStr(); const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if(document.getElementById('currentDayBanner')) document.getElementById('currentDayBanner').innerText = new Date().toLocaleDateString('ar-SA', dateOptions);

        if(data.profile?.height && document.getElementById('userHeightInput')) document.getElementById('userHeightInput').value = data.profile.height;
        if(data.progress?.currentWeight && document.getElementById('userCurrentWeight')) {
            document.getElementById('userCurrentWeight').value = data.progress.currentWeight;
            if(data.profile?.height) {
                const hM = data.profile.height / 100; const bmi = (data.progress.currentWeight / (hM * hM)).toFixed(1);
                let bmiStatus = bmi < 18.5 ? "نحافة" : bmi < 25 ? "وزن مثالي" : bmi < 30 ? "زيادة وزن" : "سمنة"; let avatarEmoji = bmi < 18.5 ? "🏃‍♀️" : bmi < 25 ? "💃" : bmi < 30 ? "👩‍🦰" : "🧘‍♀️";
                document.getElementById('bmiResultCard')?.classList.remove('hidden');
                if(document.getElementById('bmiValueText')) document.getElementById('bmiValueText').innerText = bmi;
                if(document.getElementById('bmiStatusText')) document.getElementById('bmiStatusText').innerText = bmiStatus;
                if(document.getElementById('bodyVisualAvatar')) document.getElementById('bodyVisualAvatar').innerText = avatarEmoji;
                if(document.getElementById('bodyVisualStatus')) document.getElementById('bodyVisualStatus').innerText = `حالة الجسم: ${bmiStatus}`;
            }
        }

        const badgesArr = Array.isArray(data.badges) ? data.badges : Object.values(data.badges || {}).filter(b => b != null && b.title);
        const customTimeline = Array.isArray(data.plan?.timeline) ? data.plan?.timeline : Object.values(data.plan?.timeline || {}).filter(x => x != null && x.title);
        renderUserBadges(badgesArr); 
        renderDetailedGoalTimeline(data.goalPlan, data.progress?.currentWeight, customTimeline);

        if(!window.leaderboardListenerAttached) { loadLeaderboardAuto(); window.leaderboardListenerAttached = true; }

        const allMeals = Array.isArray(data.plan?.meals || data.meals) ? (data.plan?.meals || data.meals) : Object.values(data.plan?.meals || data.meals || {}).filter(x => x != null && x.title);
        const todayMeals = allMeals.map((m, i) => ({...m, _idx: i})).filter(m => !m.date || m.date === todayStr);

        const allExercises = Array.isArray(data.plan?.exercises || data.exercises) ? (data.plan?.exercises || data.exercises) : Object.values(data.plan?.exercises || data.exercises || {}).filter(x => x != null && x.title);
        window.todayExercisesList = allExercises.map((ex, i) => ({...ex, _idx: i})).filter(ex => !ex.date || ex.date === todayStr);

        renderUserNutritionCourse(todayMeals, data.progress?.meals, data.progress?.swaps, data.targets);
        renderUserWorkoutSummary(window.todayExercisesList, data.progress?.workouts);
    };

    function renderUserBadges(badges) {
        const container = document.getElementById('userBadgesContainer'); if(!container) return;
        if(!badges || badges.length === 0) { container.innerHTML = '<p class="text-xs text-muted w-full text-center py-4">لم تحصلي على أوسمة بعد، استمري بالإنجاز! 💪</p>'; return; }
        container.innerHTML = badges.map(b => `<div class="flex flex-col items-center justify-center bg-input border border-theme p-4 rounded-2xl w-24 text-center shadow-md fade-in hover:scale-105 transition-transform"><span class="text-3xl mb-2 filter drop-shadow-md">${b.icon || '🏅'}</span><span class="text-[10px] font-bold text-primary leading-tight">${b.title}</span></div>`).join('');
    }

    function renderDetailedGoalTimeline(goalPlan, currentWeight, customTimeline) {
        const card = document.getElementById('goalTimelineCard'); const container = document.getElementById('timelineContainerArea');
        if(!card || !container) return;
        card.classList.remove('hidden');

        const startW = goalPlan?.startWeight || 0; 
        const targetW = goalPlan?.targetWeight || 0; 
        const curW = currentWeight || startW; 
        const isGaining = targetW > startW;

        const historyObj = window.activeUserData?.progress?.weightHistory || {};
        const historyVals = Object.values(historyObj).map(Number);
        let bestW = curW;
        if(historyVals.length > 0) {
            bestW = isGaining ? Math.max(...historyVals) : Math.min(...historyVals);
        }

        let steps = [];
        if(customTimeline && customTimeline.length > 0) { steps = [...customTimeline]; }

        if(targetW > 0) {
            const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
            if(!lastStep || lastStep.targetWeight !== targetW) {
                steps.push({
                    title: 'الهدف',
                    targetWeight: targetW,
                    preNote: 'الهدف النهائي! هانت يا بطلة لا توقفين 🚀',
                    postNote: 'مبروك وصلتي لنهاية مشوارك حافظي على وزنك',
                    isFinal: true
                });
            } else if (lastStep && lastStep.targetWeight === targetW) {
                steps[steps.length - 1].title = 'الهدف';
                steps[steps.length - 1].isFinal = true;
                if(!steps[steps.length - 1].postNote) steps[steps.length - 1].postNote = 'مبروك وصلتي لنهاية مشوارك حافظي على وزنك';
            }
        }

        if(steps.length > 0) {
            let passedCount = 0; 
            steps.forEach(m => { if((!isGaining && curW <= m.targetWeight) || (isGaining && curW >= m.targetWeight)) passedCount++; });
            let progressPercent = steps.length > 0 ? (passedCount / steps.length) * 100 : 0; 
            if(progressPercent > 100) progressPercent = 100;

            let htmlStr = `<div class="timeline-wrapper fade-in"><div class="timeline-line"></div><div class="timeline-line-progress" style="height: ${progressPercent}%;"></div>`;
            
            steps.forEach((m) => {
                const isPassed = (!isGaining && curW <= m.targetWeight) || (isGaining && curW >= m.targetWeight);
                const wasPassed = (!isGaining && bestW <= m.targetWeight) || (isGaining && bestW >= m.targetWeight);
                
                let iconClass = isPassed ? 'timeline-icon-unlocked' : 'timeline-icon-locked'; 
                let iconSymbol = m.isFinal ? '🎯' : (isPassed ? '🔓' : '🔒'); 
                
                let noteHtml = '';
                let clickAttr = '';

                if (isPassed) {
                    const postNoteText = m.postNote || 'ألف مبروك! إنجاز رائع واصلي يا بطلة 💪';
                    const safePostNote = postNoteText.replace(/'/g, "\\'");
                    clickAttr = `onclick="window.openMilestone('${m.title}', '${safePostNote}')"`;
                    noteHtml = `<div class="mt-3 p-3 bg-accent bg-opacity-10 border border-accent rounded-xl text-center"><p class="text-[11px] text-primary leading-relaxed font-bold">${postNoteText}</p><span class="text-[10px] text-primary mt-2 block font-bold underline cursor-pointer hover:text-accent transition-colors">اضغطي هنا للاحتفال 🎉</span></div>`;
                } else if (wasPassed && !isPassed) {
                    iconClass = 'timeline-icon-locked border-red-500 text-red-500 bg-red-500 bg-opacity-10';
                    iconSymbol = '🔒';
                    noteHtml = `<div class="mt-3 p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded-xl text-center"><p class="text-[11px] text-red-500 leading-relaxed font-bold">ترا رجعتي للوراء! يلا شدي حيلك عشان نرجع نفتحها 💪</p></div>`;
                } else {
                    const preNoteText = m.preNote || m.note || 'استمري، أنتِ في طريقك لتحقيق هذا الهدف!';
                    noteHtml = `<div class="mt-3 p-4 bg-input rounded-xl border border-theme text-center"><p class="text-[11px] text-primary leading-relaxed font-bold">🔒 ${preNoteText}</p></div>`;
                }

                htmlStr += `
                <div class="timeline-step-pro">
                    <div class="timeline-icon-pro ${iconClass}" ${clickAttr}>${iconSymbol}</div>
                    <div class="bg-card p-5 rounded-2xl border ${isPassed ? 'border-accent shadow-lg cursor-pointer active:scale-95 transition-transform' : 'border-theme shadow-sm'}" ${clickAttr}>
                        <div class="flex justify-between items-center mb-1">
                            <h4 class="text-sm font-black ${isPassed ? 'text-accent' : 'text-primary'}">${m.title}</h4>
                            <span class="text-[11px] bg-input border border-theme text-primary px-3 py-1 rounded-lg font-bold shadow-inner">${m.targetWeight} كج</span>
                        </div>
                        ${noteHtml}
                    </div>
                </div>`;
            });
            htmlStr += `</div>`; container.innerHTML = htmlStr;
        } else {
            container.innerHTML = '<p class="text-xs text-muted text-center py-4">لم يتم بناء خطة المراحل بعد.</p>';
        }

        let isFinalGoalReached = false;
        if(targetW > 0) { isFinalGoalReached = (!isGaining && curW <= targetW) || (isGaining && curW >= targetW); }
        const badge = document.getElementById('goalStatusBadge');
        if(badge) {
            if(isFinalGoalReached) { badge.innerText = 'أتممت الهدف 👑'; badge.className = 'text-[10px] bg-accent text-accent-text px-3 py-1.5 rounded-lg font-bold shadow-sm'; } 
            else { badge.innerText = 'مستمر 🔥'; badge.className = 'text-[10px] bg-blue-500/20 text-blue-500 border border-blue-500/30 px-3 py-1.5 rounded-lg font-bold shadow-sm'; }
        }
    }

    window.saveWeightUpdate = async () => {
        const btnUpdateW = document.getElementById('updateProgressBtn');
        const newW = parseFloat(document.getElementById('userCurrentWeight').value); 
        const newH = parseFloat(document.getElementById('userHeightInput').value) || window.activeUserData?.profile?.height || 160;
        
        if(isNaN(newW)) return window.showMsg("أدخلي الوزن بشكل صحيح");
        
        if (btnUpdateW) {
            btnUpdateW.innerText = 'جاري الحفظ...';
            btnUpdateW.disabled = true;
        }

        try {
            const uid = auth.currentUser.uid; 
            const weightHistory = window.activeUserData.progress?.weightHistory || {}; 
            const dates = Object.keys(weightHistory);
            let lastWeight = window.activeUserData.profile?.weight || newW; 
            if(dates.length > 0) lastWeight = weightHistory[dates[dates.length - 1]];
            
            const d = new Date();
            const timestamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            
            weightHistory[timestamp] = newW;
            
            window.activeUserData.progress = window.activeUserData.progress || {}; 
            window.activeUserData.progress.weightHistory = weightHistory; 
            window.activeUserData.progress.currentWeight = newW;
            window.activeUserData.profile = window.activeUserData.profile || {}; 
            window.activeUserData.profile.height = newH; 
            window.activeUserData.profile.weight = newW;
            
            await update(ref(db, `users/${uid}/progress`), window.activeUserData.progress); 
            await update(ref(db, `users/${uid}/profile`), window.activeUserData.profile);
            
            if (btnUpdateW) {
                btnUpdateW.innerText = 'تم الحفظ ✔️';
                btnUpdateW.classList.remove('bg-accent', 'text-accent-text');
                btnUpdateW.classList.add('bg-green-500', 'text-white');
                
                setTimeout(() => {
                    btnUpdateW.innerText = 'حفظ التحديث';
                    btnUpdateW.classList.remove('bg-green-500', 'text-white');
                    btnUpdateW.classList.add('bg-accent', 'text-accent-text');
                    btnUpdateW.disabled = false;
                }, 3000);
            }

            const roastBanner = document.getElementById('weightRoastBanner'); 
            if (roastBanner) {
                roastBanner.classList.remove('hidden');
                if(newW > lastWeight) { 
                    roastBanner.className = 'bg-red-500 text-white p-4 rounded-xl text-sm font-bold mb-3 shadow-sm fade-in'; 
                    roastBanner.innerText = 'يا ويلك! 😡 وزنك زاد عن القياس السابق.. شدي حيلك عشان نرجع نفتح الخطة!'; 
                    window.showMsg("الوزن زاد! انتبهي ⚠️", true); 
                } else if (newW < lastWeight) { 
                    roastBanner.className = 'bg-accent text-accent-text p-4 rounded-xl text-sm font-bold mb-3 shadow-sm fade-in'; 
                    roastBanner.innerText = 'شطووورة! 🎉 نزلتي وزنك.. استمري يا بطلة فخورة فيك!'; 
                    window.showMsg("عاش بطلتنا! نزول ممتاز 🌟", false); 
                } else { 
                    roastBanner.className = 'bg-yellow-500 text-black p-4 rounded-xl text-sm font-bold mb-3 shadow-sm fade-in'; 
                    roastBanner.innerText = 'وزنك ثابت! مو مشكلة أهم شيء الالتزام.'; 
                    window.showMsg("تم حفظ القياس بنجاح 🌟", false); 
                }
            }
            
            window.renderUserDashboard(window.activeUserData);
        } catch (e) {
            console.error(e);
            window.showMsg("حدث خطأ أثناء الحفظ", true);
            if (btnUpdateW) {
                btnUpdateW.innerText = 'حفظ التحديث';
                btnUpdateW.classList.remove('bg-green-500', 'text-white');
                btnUpdateW.classList.add('bg-accent', 'text-accent-text');
                btnUpdateW.disabled = false;
            }
        }
    };

    function loadLeaderboardAuto() {
        onValue(ref(db, 'users'), (snap) => {
            const container = document.getElementById('leaderboardContainer'); if(!container) return;
            if(!snap.exists()) { container.innerHTML = '<p class="text-sm text-muted text-center py-4">لا توجد منافسة حالياً.</p>'; return; }
            let usersArr = [];
            snap.forEach(u => {
                const val = u.val(); if(val.email === window.adminEmail) return; 
                let score = 0; const today = window.getTodayStr();
                const wDone = val.progress?.workouts?.[today] || {}; const mDone = val.progress?.meals?.[today] || {};
                score += Object.keys(wDone).length * 10 + Object.keys(mDone).length * 5;
                if(val.badges) { const bList = Array.isArray(val.badges) ? val.badges : Object.values(val.badges); score += bList.filter(b=>b!=null&&b.title).length * 50; }
                usersArr.push({ email: val.email.split('@')[0], score });
            });
            usersArr.sort((a,b) => b.score - a.score); container.innerHTML = '';
            usersArr.slice(0, 3).forEach((usr, idx) => {
                let medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'; let bg = idx === 0 ? 'bg-gradient-to-r from-accent/20 to-transparent border-accent/30' : 'bg-input border-theme';
                container.innerHTML += `<div class="flex justify-between items-center ${bg} px-4 py-4 rounded-xl border text-sm shadow-sm fade-in"><div class="flex items-center gap-3"><span class="font-bold text-2xl drop-shadow-sm">${medal}</span><span class="font-bold text-primary text-base">${usr.email}</span></div><span class="bg-card border border-theme px-3 py-1.5 rounded-lg text-primary text-xs font-bold shadow-sm">${usr.score} نقطة</span></div>`;
            });
        });
    }

    function renderUserNutritionCourse(meals, progress, swaps, targets) {
        const area = document.getElementById('userNutritionCourse'); if(!area) return;
        area.innerHTML = ''; const today = window.getTodayStr(); const doneMeals = progress?.[today] || {}; const todaySwaps = swaps?.[today] || [];
        const userTargets = targets || { cal: 2000, pro: 150, carb: 200, fat: 60 };
        let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
        if(meals) meals.forEach((m) => { if(doneMeals[m._idx]) { totalCal += Number(m.cal || 0); totalPro += Number(m.pro || 0); totalCarb += Number(m.carb || 0); totalFat += Number(m.fat || 0); } });
        todaySwaps.forEach(sw => { totalCal += Number(sw.cal || 0); totalPro += Number(sw.pro || 0); totalCarb += Number(sw.carb || 0); totalFat += Number(sw.fat || 0); });

        if(document.getElementById('targetCalVal')) document.getElementById('targetCalVal').innerText = userTargets.cal;
        if(document.getElementById('macroCalVal')) document.getElementById('macroCalVal').innerText = totalCal;
        const warningBadge = document.getElementById('macroWarningBadge');
        if(warningBadge) { if(totalCal > Number(userTargets.cal)) warningBadge.classList.remove('hidden'); else warningBadge.classList.add('hidden'); }

        let html = '';
        if(meals && meals.length > 0) {
            meals.forEach((m, displayIdx) => {
                const realIdx = m._idx; const isDone = doneMeals[realIdx];
                let ingredientsHtml = '';
                if(m.ingredients && m.ingredients.length > 0) {
                    ingredientsHtml = `<div class="mt-4 space-y-2 text-xs bg-input p-4 rounded-xl border border-theme shadow-inner"><strong class="text-primary block mb-3 text-sm">مكونات الوجبة (قائمة مهام):</strong><div class="space-y-2">${m.ingredients.map(ing => `<label class="flex items-center gap-3 p-3 bg-card rounded-xl border border-theme cursor-pointer transition-colors active:scale-95 shadow-sm"><input type="checkbox" onchange="this.nextElementSibling.classList.toggle('line-through'); this.nextElementSibling.classList.toggle('text-muted');"><span class="text-sm font-bold text-primary transition-all">${ing.name} <span class="text-accent ml-1">${ing.amount}</span></span></label>`).join('')}</div></div>`;
                }
                const periodBadge = m.period ? `<span class="text-[10px] bg-card border border-theme text-primary px-3 py-1 rounded-md font-bold absolute top-5 left-5 shadow-sm">${m.period}</span>` : '';
                html += `<div class="bg-card p-6 rounded-ios-lg border border-theme space-y-4 shadow-sm fade-in relative">${periodBadge}<div class="flex flex-col gap-4"><div><span class="text-[11px] text-accent font-bold block mb-1">وجبة ${displayIdx+1}</span><h3 class="font-bold text-lg text-primary w-4/5">${m.title}</h3></div><button onclick="window.toggleMealDone(${realIdx})" class="w-full py-3.5 rounded-xl text-sm font-bold border border-theme shadow-sm transition-transform active:scale-95 ${isDone ? 'bg-accent text-accent-text' : 'bg-input text-primary'}">${isDone ? 'تم تناولها ✔️' : 'تسجيل التناول'}</button></div>${ingredientsHtml}<div class="grid grid-cols-4 gap-2 text-[11px] font-bold bg-input p-3 rounded-xl border border-theme text-center shadow-inner"><div><strong class="text-sm text-primary block">${m.cal || 0}</strong> سعرة</div><div><strong class="text-sm text-accent block">${m.pro || 0}g</strong> برو</div><div><strong class="text-sm text-blue-500 block">${m.carb || 0}g</strong> كارب</div><div><strong class="text-sm text-yellow-500 block">${m.fat || 0}g</strong> دهون</div></div><button onclick="window.openMealDetail(${realIdx})" class="w-full bg-input text-primary text-sm font-bold py-4 rounded-xl border border-theme shadow-sm transition-transform active:scale-95">📖 عرض الوصفة والتحضير</button></div>`;
            });
        } else { html = '<p class="text-sm text-muted bg-input p-6 rounded-xl text-center border border-theme shadow-inner">لا توجد وجبات مخصصة لليوم.</p>'; }
        area.innerHTML = html;
    }

    function renderUserWorkoutSummary(exercises, progress) {
        const area = document.getElementById('userWorkoutCourseSummary'); if(!area) return;
        if(!exercises || exercises.length === 0) { area.innerHTML = '<p class="text-sm text-muted text-center py-8">لا توجد تمارين مخصصة لليوم.</p>'; return; }
        area.innerHTML = `<div class="text-center py-6"><div class="text-6xl mb-4 filter drop-shadow-lg">💪</div><h3 class="font-black text-2xl mb-3 text-primary">جلسة تمارين اليوم جاهزة</h3><p class="text-sm text-muted mb-8">الجلسة تتضمن ${exercises.length} تمارين مخصصة لكِ.</p><button onclick="window.startCoursePlayer()" class="w-full bg-accent text-accent-text font-bold py-4 rounded-xl text-lg shadow-lg transition-transform active:scale-95">بدء التمرين 🔥</button></div>`;
    }

    window.openWeightHistoryModal = () => {
        const listContainer = document.getElementById('modalWeightHistoryList'); const history = window.activeUserData.progress?.weightHistory || {}; listContainer.innerHTML = '';
        if(Object.keys(history).length === 0) { listContainer.innerHTML = '<p class="text-sm text-muted text-center py-6">لا يوجد قياسات.</p>'; }
        else { Object.entries(history).reverse().forEach(([timeTag, weightVal]) => { listContainer.innerHTML += `<div class="bg-input p-4 rounded-xl border border-theme flex justify-between items-center text-sm shadow-sm fade-in"><span class="text-primary font-bold">${timeTag}</span><span class="bg-accent text-accent-text px-3 py-1.5 rounded-lg font-bold shadow-sm">${weightVal} كج</span></div>`; }); }
        document.getElementById('weightHistoryModal').classList.remove('hidden');
    };

    window.openGroceryList = () => {
        const allMeals = Array.isArray(window.activeUserData.plan?.meals || window.activeUserData.meals) ? (window.activeUserData.plan?.meals || window.activeUserData.meals) : Object.values(window.activeUserData.plan?.meals || window.activeUserData.meals || {}).filter(x => x != null && x.title);
        let allIngs = []; allMeals.forEach(m => { if(m.ingredients) m.ingredients.forEach(ing => { if(ing.name) allIngs.push(`${ing.name} <span class="text-accent text-xs">(${ing.amount})</span> <span class="text-[10px] text-muted block mt-1">من: ${m.title}</span>`); }); });
        let html = allIngs.map((ingText) => `<label class="flex items-center gap-3 p-4 bg-input rounded-xl border border-theme cursor-pointer transition-colors active:scale-95 shadow-sm"><input type="checkbox" onchange="this.nextElementSibling.classList.toggle('line-through'); this.nextElementSibling.classList.toggle('opacity-50');"><div class="text-sm font-bold text-primary transition-all">${ingText}</div></label>`).join('');
        if(allIngs.length === 0) html = '<p class="text-sm text-muted text-center py-4">القائمة فارغة، لا يوجد مقاضي مسجلة.</p>';
        document.getElementById('groceryModalBody').innerHTML = html; document.getElementById('groceryListModal').classList.remove('hidden');
    };

    window.toggleMealDone = async (realIdx) => {
        const today = window.getTodayStr(); const uid = auth.currentUser.uid; const doneMeals = window.activeUserData.progress?.meals?.[today] || {}; doneMeals[realIdx] = !doneMeals[realIdx];
        await update(ref(db, `users/${uid}/progress/meals`), { [today]: doneMeals }); window.activeUserData.progress = window.activeUserData.progress || {}; window.activeUserData.progress.meals = window.activeUserData.progress.meals || {};
        window.activeUserData.progress.meals[today] = doneMeals; window.renderUserDashboard(window.activeUserData);
    };

    window.openMealDetail = (realIdx) => {
        const allMeals = Array.isArray(window.activeUserData.plan?.meals || window.activeUserData.meals) ? (window.activeUserData.plan?.meals || window.activeUserData.meals) : Object.values(window.activeUserData.plan?.meals || window.activeUserData.meals || {}).filter(x => x != null && x.title);
        const m = allMeals[realIdx]; document.getElementById('modalMealTitle').innerText = m.title; let ingHtml = '';
        if(m.ingredients && m.ingredients.length > 0) { ingHtml = `<div class="mb-4"><strong class="text-primary text-sm block mb-3 font-bold">المكونات (علمي على اللي جهزتيه):</strong><div class="space-y-2">${m.ingredients.map(ing => `<label class="flex items-center gap-3 p-3 bg-input rounded-xl border border-theme cursor-pointer transition-colors active:scale-95 shadow-sm"><input type="checkbox" onchange="this.nextElementSibling.classList.toggle('line-through'); this.nextElementSibling.classList.toggle('text-muted');"><span class="text-sm font-bold text-primary transition-all">${ing.name} <span class="text-accent ml-1">${ing.amount}</span></span></label>`).join('')}</div></div>`; }
        document.getElementById('modalMealBody').innerHTML = `${m.image ? `<img src="${m.image}" class="w-full rounded-2xl mb-4 border border-theme shadow-sm">` : ''}${ingHtml}<div class="bg-input p-5 rounded-xl border border-theme shadow-inner"><strong class="text-primary text-sm block mb-3 font-bold">طريقة التحضير:</strong><p class="text-muted text-sm leading-relaxed">${m.recipe || 'لا يوجد وصف.'}</p></div>${buildNativeVideoPlayer(m.media)}`;
        document.getElementById('mealDetailModal').classList.remove('hidden');
    };

    window.openSwapModal = () => document.getElementById('mealSwapModal').classList.remove('hidden');
    window.saveSwapMeal = async () => {
        const name = document.getElementById('swapMealName').value.trim() || 'وجبة بديلة'; const cal = parseInt(document.getElementById('swapCal').value) || 0; const pro = parseInt(document.getElementById('swapPro').value) || 0; const carb = parseInt(document.getElementById('swapCarb').value) || 0; const fat = parseInt(document.getElementById('swapFat').value) || 0;
        const today = window.getTodayStr(); const uid = auth.currentUser.uid; window.activeUserData.progress = window.activeUserData.progress || {}; window.activeUserData.progress.swaps = window.activeUserData.progress.swaps || {}; window.activeUserData.progress.swaps[today] = window.activeUserData.progress.swaps[today] || [];
        window.activeUserData.progress.swaps[today].push({ name, cal, pro, carb, fat });
        await update(ref(db, `users/${uid}/progress/swaps`), window.activeUserData.progress.swaps); document.getElementById('mealSwapModal').classList.add('hidden'); window.renderUserDashboard(window.activeUserData);
    };

    window.startCoursePlayer = () => {
        window.playerActiveIndex = 0; const today = window.getTodayStr(); const progress = window.activeUserData.progress?.workouts?.[today] || {};
        for(let i=0; i<window.todayExercisesList.length; i++) {
            let ex = window.todayExercisesList[i]; let rIdx = ex._idx;
            if(ex.type === 'timer') { if(!progress[rIdx]?.completed) { window.playerActiveIndex = i; break; } } else { if((progress[rIdx] || 0) < ex.sets) { window.playerActiveIndex = i; break; } }
        }
        document.getElementById('bottomNavBar')?.classList.add('hidden'); document.getElementById('userWorkoutCourseSummary')?.classList.add('hidden');
        document.getElementById('inlinePlayerView')?.classList.remove('hidden'); window.renderPlayerStep();
    };

    window.saveAndExitCoursePlayer = () => {
        if(window.exerciseTimerInterval) clearInterval(window.exerciseTimerInterval);
        document.getElementById('inlinePlayerView')?.classList.add('hidden'); document.getElementById('userWorkoutCourseSummary')?.classList.remove('hidden');
        document.getElementById('bottomNavBar')?.classList.remove('hidden'); window.renderUserDashboard(window.activeUserData);
    };

    window.playerPrevStep = () => { if(window.exerciseTimerInterval) clearInterval(window.exerciseTimerInterval); if(window.playerActiveIndex > 0) { window.playerActiveIndex--; window.renderPlayerStep(); } };
    window.playerNextStep = () => { if(window.exerciseTimerInterval) clearInterval(window.exerciseTimerInterval); if(window.playerActiveIndex < window.todayExercisesList.length - 1) { window.playerActiveIndex++; window.renderPlayerStep(); } else { window.saveAndExitCoursePlayer(); window.showMsg("أتممتِ جلسة التمارين يا بطلة! 🎉", false); } };

    window.renderPlayerStep = () => {
        if(window.exerciseTimerInterval) clearInterval(window.exerciseTimerInterval); const area = document.getElementById('playerContentArea'); const ex = window.todayExercisesList[window.playerActiveIndex]; if(!ex) return;
        document.getElementById('workoutTimerDisplay').innerText = `تمرين ${window.playerActiveIndex + 1} / ${window.todayExercisesList.length}`;
        const today = window.getTodayStr(); const todayProg = window.activeUserData.progress?.workouts?.[today] || {}; const realIdx = ex._idx; const periodBadge = ex.period ? `<span class="text-[10px] bg-card border border-theme text-primary px-3 py-1 rounded-md font-bold mb-3 inline-block shadow-sm mr-2">${ex.period}</span>` : '';
        if(ex.type === 'timer') {
            let totalSecs = (ex.timerMins || 1) * 60; window.exerciseRemainingSeconds = todayProg[realIdx]?.secondsLeft !== undefined ? todayProg[realIdx].secondsLeft : totalSecs;
            area.innerHTML = `<div class="fade-in flex flex-col flex-grow"><div class="mb-4 text-right"><span class="text-[10px] bg-input border border-theme text-primary px-3 py-1.5 rounded-lg font-bold mb-3 inline-block shadow-sm">نظام مؤقت</span>${periodBadge}<h2 class="text-3xl font-black text-primary">${ex.title}</h2></div>${buildNativeVideoPlayer(ex.media)}<div class="bg-input p-6 rounded-2xl border border-theme mb-6 mt-2 shadow-inner"><div id="exerciseCountdown" class="text-6xl font-black text-accent mb-6 drop-shadow-md tracking-wider">--:--</div><div class="flex gap-3 justify-center"><button onclick="window.toggleExerciseTimer(${totalSecs})" id="timerToggleBtn" class="flex-grow bg-accent text-accent-text font-bold px-4 py-4 rounded-xl text-base shadow-sm transition-transform active:scale-95">بدء التايمر</button><button onclick="window.resetExerciseTimer(${totalSecs})" class="bg-card border border-theme text-primary px-4 py-4 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95">إعادة</button></div></div><div class="flex gap-3 w-full mt-auto"><button onclick="window.playerPrevStep()" class="w-1/3 bg-input border border-theme text-primary py-4 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95">السابق</button><button onclick="window.playerNextStep()" class="w-2/3 bg-primary text-black bg-white py-4 rounded-xl text-base font-bold shadow-md transition-transform active:scale-95">${window.playerActiveIndex === window.todayExercisesList.length - 1 ? 'إنهاء الجلسة ✔️' : 'التالي ➔'}</button></div></div>`;
            window.updateTimerDisplay();
        } else {
            const doneSets = todayProg[realIdx] || 0; let setsHtml = ''; for(let i=1; i<=ex.sets; i++) { const isActive = i <= doneSets ? 'done' : ''; setsHtml += `<button onclick="window.markPlayerSet(${realIdx}, ${i})" class="set-pill ${isActive}">${i}</button>`; }
            area.innerHTML = `<div class="fade-in flex flex-col flex-grow"><div class="mb-4 text-right"><span class="text-[10px] bg-input border border-theme text-primary px-3 py-1.5 rounded-lg font-bold mb-3 inline-block shadow-sm">نظام جولات</span>${periodBadge}<h2 class="text-3xl font-black text-primary">${ex.title}</h2></div>${buildNativeVideoPlayer(ex.media)}<div class="bg-input p-6 rounded-2xl border border-theme mb-6 mt-2 shadow-inner"><p class="text-sm text-muted mb-5 font-bold">اضغطي على رقم الجولة بعد إتمامها:</p><div class="flex gap-4 justify-center flex-wrap">${setsHtml}</div></div><div class="flex gap-3 w-full mt-auto"><button onclick="window.playerPrevStep()" class="w-1/3 bg-input border border-theme text-primary py-4 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95">السابق</button><button onclick="window.playerNextStep()" class="w-2/3 bg-primary text-black bg-white py-4 rounded-xl text-base font-bold shadow-md transition-transform active:scale-95">${window.playerActiveIndex === window.todayExercisesList.length - 1 ? 'إنهاء الجلسة ✔️' : 'التالي ➔'}</button></div></div>`;
        }
    };

    window.updateTimerDisplay = () => {
        const m = String(Math.floor(window.exerciseRemainingSeconds / 60)).padStart(2, '0'); const s = String(window.exerciseRemainingSeconds % 60).padStart(2, '0');
        const el = document.getElementById('exerciseCountdown'); if(el) el.innerText = `${m}:${s}`;
    };

    window.toggleExerciseTimer = (defaultSecs) => {
        const btn = document.getElementById('timerToggleBtn');
        if(window.isTimerRunning) {
            clearInterval(window.exerciseTimerInterval); window.isTimerRunning = false; btn.innerText = 'استئناف التايمر'; btn.className = 'flex-grow bg-accent font-bold px-4 py-4 rounded-xl text-base text-accent-text shadow-sm';
        } else {
            window.isTimerRunning = true; btn.innerText = 'إيقاف مؤقت'; btn.className = 'flex-grow bg-red-500 text-white font-bold px-4 py-4 rounded-xl text-base shadow-sm';
            window.exerciseTimerInterval = setInterval(async () => {
                if(window.exerciseRemainingSeconds > 0) { window.exerciseRemainingSeconds--; window.updateTimerDisplay(); window.saveTimerProgress(false); } 
                else { clearInterval(window.exerciseTimerInterval); window.isTimerRunning = false; btn.innerText = 'انتهى الوقت'; btn.className = 'flex-grow bg-card border border-theme text-primary font-bold px-4 py-4 rounded-xl text-base shadow-sm'; window.saveTimerProgress(true); }
            }, 1000);
        }
    };

    window.resetExerciseTimer = (defaultSecs) => {
        if(window.exerciseTimerInterval) clearInterval(window.exerciseTimerInterval); window.isTimerRunning = false; window.exerciseRemainingSeconds = defaultSecs; window.updateTimerDisplay();
        const btn = document.getElementById('timerToggleBtn'); if(btn) { btn.innerText = 'بدء التايمر'; btn.className = 'flex-grow bg-accent font-bold px-4 py-4 rounded-xl text-base text-accent-text shadow-sm'; }
        window.saveTimerProgress(false);
    };

    window.saveTimerProgress = async (isCompleted) => {
        const today = window.getTodayStr(); const uid = auth.currentUser.uid; const realIdx = window.todayExercisesList[window.playerActiveIndex]._idx;
        window.activeUserData.progress = window.activeUserData.progress || {}; window.activeUserData.progress.workouts = window.activeUserData.progress.workouts || {}; window.activeUserData.progress.workouts[today] = window.activeUserData.progress.workouts[today] || {}; window.activeUserData.progress.workouts[today][realIdx] = { secondsLeft: window.exerciseRemainingSeconds, completed: isCompleted };
        await update(ref(db, `users/${uid}/progress/workouts`), window.activeUserData.progress.workouts);
    };

    window.markPlayerSet = async (realIdx, setNum) => {
        const today = window.getTodayStr(); const uid = auth.currentUser.uid;
        window.activeUserData.progress = window.activeUserData.progress || {}; window.activeUserData.progress.workouts = window.activeUserData.progress.workouts || {}; window.activeUserData.progress.workouts[today] = window.activeUserData.progress.workouts[today] || {}; window.activeUserData.progress.workouts[today][realIdx] = setNum;
        await update(ref(db, `users/${uid}/progress/workouts`), window.activeUserData.progress.workouts); window.renderPlayerStep();
    };

    window.checkAndSendAutoReply = () => {
        const now = new Date(); const currentMins = now.getHours() * 60 + now.getMinutes(); let isOutside = false;
        if(window.globalWorkHours && window.globalWorkHours.start && window.globalWorkHours.end) {
            const [sH, sM] = window.globalWorkHours.start.split(':').map(Number); const [eH, eM] = window.globalWorkHours.end.split(':').map(Number);
            const startMins = sH * 60 + sM; const endMins = eH * 60 + eM;
            if (startMins <= endMins) { if (currentMins < startMins || currentMins >= endMins) isOutside = true; } else { if (currentMins < startMins && currentMins >= endMins) isOutside = true; }
        }
        if(isOutside && (Date.now() - window.lastAutoReplyTime > 5 * 60 * 1000)) {
            window.lastAutoReplyTime = Date.now(); setTimeout(() => { push(ref(db, `chats/${auth.currentUser.uid}`), { text: "عذراً، كوتش صحة خارج أوقات العمل حالياً 🌙. سيتم الرد عليك فور عودتنا خلال أوقات العمل الرسمية 💛.", type: 'text', sender: 'admin', time: Date.now() }); }, 1500);
        }
    };

    window.handleImageUpload = (event, uid, sender) => {
        const file = event.target.files[0]; if(!file) return; const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas'); const MAX_WIDTH = 500; const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.5);
                push(ref(db, `chats/${uid}`), { text: base64, type: 'image', sender: sender, time: Date.now() });
                if(sender === 'user') { update(ref(db, `users/${uid}`), { hasUnread: true }); window.checkAndSendAutoReply(); }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    window.loadChat = function(uid, areaId) {
        const area = document.getElementById(areaId); if(!area) return;
        const isAdminContext = areaId === 'adminChatArea';
        onValue(ref(db, `chats/${uid}`), (snap) => {
            area.innerHTML = '';
            if(snap.exists()){
                snap.forEach(c => {
                    const m = c.val(); const isMe = isAdminContext ? (m.sender === 'admin') : (m.sender === 'user'); const css = isMe ? 'msg-me' : 'msg-other';
                    let timeStr = m.time ? new Date(m.time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';
                    area.innerHTML += `<div class="chat-bubble ${css} fade-in"><div>${m.type === 'image' ? `<img src="${m.text}" class="chat-img">` : m.text}</div><div class="chat-meta"><span>${timeStr}</span></div></div>`;
                });
                setTimeout(() => area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' }), 100);
            }
        });
    };

    const userSendChatBtn = document.getElementById('userSendChatBtn');
    if(userSendChatBtn) {
        userSendChatBtn.onclick = () => {
            const inp = document.getElementById('userChatInput'); const text = inp.value.trim();
            if(text){ 
                push(ref(db, `chats/${auth.currentUser.uid}`), { text: text, type: 'text', sender: 'user', time: Date.now() }); 
                update(ref(db, `users/${auth.currentUser.uid}`), { hasUnread: true });
                inp.value = ''; window.checkAndSendAutoReply(); 
            }
        };
        document.getElementById('userChatInput').addEventListener('keypress', function (e) { if (e.key === 'Enter') userSendChatBtn.click(); });
        document.getElementById('userChatFile').onchange = (e) => window.handleImageUpload(e, auth.currentUser.uid, 'user');
    }
}
