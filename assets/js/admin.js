import { db, firebaseConfig } from './firebase-config.js';
import { ref, set, get, child, update, remove, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

export function initAdmin() {
    window.extendSub = async (days) => {
        if(!window.activeUserData) return; let end = new Date(window.activeUserData.endDate); if(isNaN(end.getTime()) || end < new Date()) end = new Date();
        end.setDate(end.getDate() + days); await update(ref(db, `users/${window.currentAdminViewUid}`), { endDate: end.toISOString() });
        window.activeUserData.endDate = end.toISOString();
        document.getElementById('adminSubEndText').innerText = end.toLocaleDateString('ar-SA'); document.getElementById('adminSubEndText').className = 'text-primary text-sm bg-input px-3 py-1 rounded-lg border border-theme inline-block mr-2 ml-2';
        window.showMsg(`تم التمديد بنجاح لـ ${days} أيام 📅`, false);
    };

    window.endSub = async () => {
        if(!confirm("هل أنت متأكدة من إنهاء الاشتراك الآن؟ سيتم إغلاق حساب المتدربة فوراً.")) return;
        const end = new Date(); end.setDate(end.getDate() - 1); await update(ref(db, `users/${window.currentAdminViewUid}`), { endDate: end.toISOString() });
        if(window.activeUserData) window.activeUserData.endDate = end.toISOString();
        document.getElementById('adminSubEndText').innerText = 'منتهي (مغلق)'; document.getElementById('adminSubEndText').className = 'text-red-500 font-black text-sm bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/30 inline-block mr-2 ml-2';
        window.showMsg("تم إنهاء الاشتراك وأغلق الحساب 🔒", false);
    };

    window.deleteUser = async () => {
        if(!confirm("⚠️ تحذير: هل أنت متأكدة من حذف المتدربة نهائياً؟ سيتم مسح كل بياناتها!")) return;
        await remove(ref(db, `users/${window.currentAdminViewUid}`)); window.showMsg("تم حذف المتدربة نهائياً 🗑️", false);
        document.getElementById('backToAdminMainBtn').click();
    };

    window.loadAdminCodes = async () => {
        const list = document.getElementById('adminCodesList'); const snap = await get(child(ref(db), 'codes')); list.innerHTML = '';
        if(!snap.exists()) return list.innerHTML = '<p class="text-xs text-muted">لا يوجد أكواد</p>';
        snap.forEach(cSnap => { const c = cSnap.val(); list.innerHTML += `<div class="bg-input p-4 rounded-xl border border-theme flex justify-between items-center text-sm shadow-sm fade-in"><div><strong class="text-primary">${c.code}</strong> <span class="text-xs text-muted">(${c.days} يوم)</span></div><span class="text-[11px] px-2 py-1 bg-card rounded-md border border-theme font-bold ${c.used ? 'text-red-500' : 'text-accent'}">${c.used ? 'مُستخدم' : 'متاح'}</span></div>`; });
    };

    window.loadAdminUsers = async () => {
        const list = document.getElementById('usersList'); const snap = await get(child(ref(db), 'users')); list.innerHTML = '';
        if(!snap.exists()) return list.innerHTML = '<p class="text-center py-8 text-sm text-muted">لا يوجد متدربات</p>';
        snap.forEach(uSnap => { 
            const uid = uSnap.key; const d = uSnap.val(); 
            if(d.email === window.adminEmail) return;
            const name = d.profile?.name || 'بدون اسم';
            const unreadBadge = d.hasUnread ? `<span class="absolute -top-1 -right-2 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>` : '';
            list.innerHTML += `<div class="p-5 flex justify-between items-center cursor-pointer hover:bg-input border-b border-theme transition-colors" onclick="window.openUserDetail('${uid}')"><div class="relative"><p class="font-bold text-primary text-sm">${name} <span class="text-[10px] text-muted font-normal ml-2">(${d.email})</span></p>${unreadBadge}<span class="text-[11px] text-accent font-bold mt-1 inline-block">${d.usedCode || 'بدون كود'}</span></div><span class="text-xl text-muted font-bold">›</span></div>`; 
        });
    };

    window.openUserDetail = async (uid) => {
        window.currentAdminViewUid = uid; const snap = await get(child(ref(db), `users/${uid}`)); const d = snap.val(); window.activeUserData = d; 
        
        await update(ref(db, `users/${uid}`), { hasUnread: false }); 

        document.getElementById('adminMainView').classList.add('hidden'); document.getElementById('adminUserDetailView').classList.remove('hidden'); 
        document.getElementById('detailUserEmail').innerText = d.profile?.name ? `${d.profile.name} (${d.email})` : d.email;
        
        if(d.endDate) { const isExpired = new Date(d.endDate) < new Date(); const endTxt = document.getElementById('adminSubEndText'); endTxt.innerText = new Date(d.endDate).toLocaleDateString('ar-SA'); endTxt.className = isExpired ? 'text-red-500 font-black text-sm bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/30 inline-block mr-2 ml-2' : 'text-primary text-sm bg-input px-3 py-1 rounded-lg border border-theme inline-block mr-2 ml-2'; }
        
        const targets = d.targets || { cal: 2000, pro: 150, carb: 200, fat: 60 };
        document.getElementById('targetCalInput').value = targets.cal; document.getElementById('targetProInput').value = targets.pro; document.getElementById('targetCarbInput').value = targets.carb; document.getElementById('targetFatInput').value = targets.fat;
        document.getElementById('admCurrentW').innerText = d.profile?.weight || d.goalPlan?.startWeight || '--'; document.getElementById('admTargetW').innerText = d.goalPlan?.targetWeight || '--';

        const todayStr = window.getTodayStr();
        const doneMeals = d.progress?.meals?.[todayStr] || {};
        const todaySwaps = d.progress?.swaps?.[todayStr] || [];
        const allMeals = Array.isArray(d.plan?.meals || d.meals) ? (d.plan?.meals || d.meals) : Object.values(d.plan?.meals || d.meals || {});
        const todayMeals = allMeals.map((m, i) => ({...m, _idx: i})).filter(m => (!m.date || m.date === todayStr) && m.title);
        
        let totalCal = 0;
        todayMeals.forEach(m => { if(doneMeals[m._idx]) totalCal += Number(m.cal||0); });
        todaySwaps.forEach(sw => { totalCal += Number(sw.cal||0); });

        const isExceeded = totalCal > targets.cal;
        const allMealsDone = todayMeals.length > 0 && todayMeals.every(m => doneMeals[m._idx]);

        const doneWorkouts = d.progress?.workouts?.[todayStr] || {};
        const allEx = Array.isArray(d.plan?.exercises || d.exercises) ? (d.plan?.exercises || d.exercises) : Object.values(d.plan?.exercises || d.exercises || {});
        const todayEx = allEx.map((ex, i) => ({...ex, _idx: i})).filter(ex => (!ex.date || ex.date === todayStr) && ex.title);

        let allExDone = todayEx.length > 0;
        if(todayEx.length > 0) {
            todayEx.forEach(ex => {
                if(ex.type === 'timer') { if(!doneWorkouts[ex._idx]?.completed) allExDone = false; } 
                else { if((doneWorkouts[ex._idx] || 0) < ex.sets) allExDone = false; }
            });
        } else { allExDone = false; }

        const sumHTML = `
            <div class="bg-input p-4 rounded-xl border border-theme shadow-inner">
                <span class="text-xl block mb-2">${allExDone ? '✅' : '⏳'}</span><span class="text-[11px] font-bold text-muted block mb-1">التمارين</span><span class="text-xs font-black ${allExDone ? 'text-green-500' : 'text-yellow-500'}">${allExDone ? 'مكتملة' : 'غير مكتملة'}</span>
            </div>
            <div class="bg-input p-4 rounded-xl border border-theme shadow-inner">
                <span class="text-xl block mb-2">${allMealsDone ? '✅' : '⏳'}</span><span class="text-[11px] font-bold text-muted block mb-1">الوجبات</span><span class="text-xs font-black ${allMealsDone ? 'text-green-500' : 'text-yellow-500'}">${allMealsDone ? 'مكتملة' : 'غير مكتملة'}</span>
            </div>
            <div class="bg-input p-4 rounded-xl border border-theme shadow-inner">
                <span class="text-xl block mb-2">${isExceeded ? '⚠️' : '👌'}</span><span class="text-[11px] font-bold text-muted block mb-1">السعرات</span><span class="text-xs font-black ${isExceeded ? 'text-red-500' : 'text-accent'}">${isExceeded ? 'متجاوزة' : 'بالسليم'}</span>
            </div>`;
        document.getElementById('adminUserDailySummary').innerHTML = sumHTML;

        window.currentAdminExercises = Array.isArray(d.plan?.exercises || d.exercises) ? (d.plan?.exercises || d.exercises) : Object.values(d.plan?.exercises || d.exercises || {});
        window.currentAdminMeals = Array.isArray(d.plan?.meals || d.meals) ? (d.plan?.meals || d.meals) : Object.values(d.plan?.meals || d.meals || {});
        window.currentAdminBadges = Array.isArray(d.badges) ? d.badges : Object.values(d.badges || {}); window.currentAdminTimeline = Array.isArray(d.plan?.timeline) ? d.plan?.timeline : Object.values(d.plan?.timeline || {});

        window.currentAdminExercises = window.currentAdminExercises.filter(x => x != null && x.title); window.currentAdminMeals = window.currentAdminMeals.filter(x => x != null && x.title);
        window.currentAdminBadges = window.currentAdminBadges.filter(x => x != null && x.title); window.currentAdminTimeline = window.currentAdminTimeline.filter(x => x != null && x.title);
        
        window.renderAdminExercises(); window.renderAdminMeals(); window.renderAdminBadges(); window.renderAdminTimeline();
        window.switchAdminTab('adminTabMacros'); window.loadChat(uid, 'adminChatArea');
    };

    window.addMilestone = () => {
        const title = document.getElementById('msTitle').value.trim(); 
        const weight = parseFloat(document.getElementById('msWeight').value) || 0; 
        const preNote = document.getElementById('msPreNote').value.trim();
        const postNote = document.getElementById('msPostNote').value.trim();

        if(!title || !weight) return window.showMsg("أدخلي اسم المرحلة والوزن المستهدف", true);
        window.currentAdminTimeline.push({ title, targetWeight: weight, preNote, postNote });
        
        document.getElementById('msTitle').value = ''; 
        document.getElementById('msWeight').value = ''; 
        document.getElementById('msPreNote').value = ''; 
        document.getElementById('msPostNote').value = '';
        window.renderAdminTimeline();
    };

    window.renderAdminTimeline = () => {
        const list = document.getElementById('adminTimelineList'); list.innerHTML = '';
        if(window.currentAdminTimeline.length === 0) { list.innerHTML = '<p class="text-xs text-muted py-4 text-center">لم يتم بناء خطة مخصصة بعد. ستظهر الخطة التلقائية للمتدربة.</p>'; return; }
        
        window.currentAdminTimeline.forEach((m, idx) => { 
            const preHtml = m.preNote ? `<div class="text-[11px] text-primary font-bold bg-input p-3 rounded-lg border border-theme mt-2 opacity-90">قبل: ${m.preNote}</div>` : '';
            const postHtml = m.postNote ? `<div class="text-[11px] text-accent font-bold bg-input p-3 rounded-lg border border-theme mt-1 text-accent">بعد: ${m.postNote}</div>` : '';
            
            list.innerHTML += `<div class="bg-card p-4 rounded-xl border border-theme flex flex-col gap-2 relative shadow-sm fade-in"><button onclick="window.remMilestone(${idx})" class="absolute left-3 top-3 text-red-500 font-bold px-2 py-1 text-lg leading-none">✕</button><div class="flex items-center gap-3"><span class="text-sm font-bold text-primary">${m.title}</span><span class="text-[10px] bg-accent text-accent-text px-3 py-1 rounded-md font-bold shadow-sm">${m.targetWeight} كج</span></div>${preHtml}${postHtml}</div>`; 
        });
    };
    window.remMilestone = (idx) => { window.currentAdminTimeline.splice(idx, 1); window.renderAdminTimeline(); };

    window.addExercise = () => { window.currentAdminExercises.push({title:'تمرين جديد', media:'', type:'sets', sets:3, timerMins:5, period:'', date:''}); window.renderAdminExercises(); };
    window.addMeal = () => { window.currentAdminMeals.push({title:'وجبة جديدة', image:'', recipe:'', media:'', cal:400, pro:30, carb:40, fat:10, period:'', date:'', ingredients:[{name:'', amount:''}]}); window.renderAdminMeals(); };
    window.addBadge = () => { window.currentAdminBadges.push({icon:'🏆', title:'إنجاز جديد'}); window.renderAdminBadges(); };

    window.renderAdminBadges = () => {
        const list = document.getElementById('adminBadgesList'); list.innerHTML = '';
        if(window.currentAdminBadges.length === 0) list.innerHTML = '<p class="text-xs text-muted text-center py-4">لا يوجد أوسمة ممنوحة حالياً.</p>';
        window.currentAdminBadges.forEach((b, idx) => { list.innerHTML += `<div class="flex items-center gap-3 bg-input p-4 rounded-xl border border-theme relative shadow-sm fade-in"><button onclick="window.remBadge(${idx})" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500 font-bold px-2 py-1 text-lg">✕</button><select onchange="window.updateBadgeIcon(${idx}, this.value)" class="bg-card px-3 py-3 rounded-xl text-2xl border border-theme shadow-inner"><option value="🏆" ${b.icon==='🏆'?'selected':''}>🏆</option><option value="🌟" ${b.icon==='🌟'?'selected':''}>🌟</option><option value="🔥" ${b.icon==='🔥'?'selected':''}>🔥</option><option value="👑" ${b.icon==='👑'?'selected':''}>👑</option><option value="🎯" ${b.icon==='🎯'?'selected':''}>🎯</option><option value="💪" ${b.icon==='💪'?'selected':''}>💪</option><option value="🏅" ${b.icon==='🏅'?'selected':''}>🏅</option><option value="💯" ${b.icon==='💯'?'selected':''}>💯</option></select><input type="text" onchange="window.updateBadgeTitle(${idx}, this.value)" value="${b.title||''}" class="flex-grow bg-card px-4 py-3 rounded-xl text-sm text-primary shadow-inner" placeholder="اسم الوسام"></div>`; });
    };
    window.remBadge = (idx) => { window.currentAdminBadges.splice(idx, 1); window.renderAdminBadges(); }; window.updateBadgeIcon = (idx, val) => { window.currentAdminBadges[idx].icon = val; }; window.updateBadgeTitle = (idx, val) => { window.currentAdminBadges[idx].title = val; };

    window.renderAdminExercises = () => {
        const list = document.getElementById('adminExercisesList'); list.innerHTML = '';
        window.currentAdminExercises.forEach((ex, idx) => {
            const isTimer = ex.type === 'timer';
            list.innerHTML += `<div class="bg-input p-5 rounded-ios-lg border border-theme relative text-sm space-y-4 shadow-sm fade-in"><button onclick="window.remEx(${idx})" class="absolute top-4 left-4 text-red-500 font-bold px-2 py-1 text-lg leading-none z-10">✕</button><input type="text" onchange="window.updateExTitle(${idx}, this.value)" value="${ex.title}" class="w-full bg-card px-4 py-3 rounded-xl font-bold text-primary shadow-inner pr-12" placeholder="اسم التمرين"><div class="grid grid-cols-2 gap-3"><div><label class="text-[10px] text-muted font-bold block mb-1">تاريخ العرض (فارغ = دائم)</label><input type="date" onchange="window.updateExDate(${idx}, this.value)" value="${ex.date||''}" class="w-full bg-card px-3 py-2 rounded-lg text-primary text-xs shadow-inner"></div><div><label class="text-[10px] text-muted font-bold block mb-1">الفترة (توضيحي)</label><input type="text" onchange="window.updateExPeriod(${idx}, this.value)" value="${ex.period||''}" class="w-full bg-card px-3 py-2 rounded-lg text-primary text-xs shadow-inner" placeholder="مثال: الأسبوع الأول"></div></div><input type="text" onchange="window.updateExMedia(${idx}, this.value)" value="${ex.media}" class="w-full bg-card px-4 py-3 rounded-xl text-accent font-medium text-xs shadow-inner" placeholder="رابط فيديو"><div class="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-xl border border-theme shadow-inner"><select onchange="window.toggleExType(${idx}, this.value)" class="bg-input px-3 py-3 rounded-lg text-primary font-bold text-sm border border-theme sm:w-1/2"><option value="sets" ${!isTimer?'selected':''}>جولات</option><option value="timer" ${isTimer?'selected':''}>مؤقت زمني</option></select>${isTimer ? `<div class="flex items-center justify-between sm:justify-start gap-3 sm:w-1/2 sm:border-r border-theme sm:pr-4"><span class="text-xs text-muted font-bold">المدة (دقائق):</span><input type="number" onchange="window.updateExTimer(${idx}, this.value)" value="${ex.timerMins||5}" class="w-20 bg-input px-2 py-2 text-center rounded-lg text-primary font-bold border border-theme shadow-inner"></div>` : `<div class="flex items-center justify-between sm:justify-start gap-3 sm:w-1/2 sm:border-r border-theme sm:pr-4"><span class="text-xs text-muted font-bold">عدد الجولات:</span><input type="number" onchange="window.updateExSets(${idx}, this.value)" value="${ex.sets||3}" class="w-20 bg-input px-2 py-2 text-center rounded-lg text-primary font-bold border border-theme shadow-inner"></div>`}</div></div>`;
        });
    };
    window.remEx = (idx) => { window.currentAdminExercises.splice(idx, 1); window.renderAdminExercises(); }; window.toggleExType = (idx, val) => { window.currentAdminExercises[idx].type = val; window.renderAdminExercises(); }; window.updateExTitle = (idx, val) => { window.currentAdminExercises[idx].title = val; }; window.updateExDate = (idx, val) => { window.currentAdminExercises[idx].date = val; }; window.updateExPeriod = (idx, val) => { window.currentAdminExercises[idx].period = val; }; window.updateExMedia = (idx, val) => { window.currentAdminExercises[idx].media = val; }; window.updateExTimer = (idx, val) => { window.currentAdminExercises[idx].timerMins = parseInt(val); }; window.updateExSets = (idx, val) => { window.currentAdminExercises[idx].sets = parseInt(val); };

    window.renderAdminMeals = () => {
        const list = document.getElementById('adminMealsList'); list.innerHTML = '';
        window.currentAdminMeals.forEach((m, idx) => {
            let ingredientsHtml = (m.ingredients || []).map((ing, iIdx) => `<div class="flex gap-2 mb-3 items-center"><input type="text" onchange="window.updateIngName(${idx}, ${iIdx}, this.value)" value="${ing.name}" class="flex-grow bg-card px-3 py-2.5 rounded-lg text-xs text-primary shadow-inner" placeholder="المكون"><input type="text" onchange="window.updateIngAmount(${idx}, ${iIdx}, this.value)" value="${ing.amount}" class="w-24 bg-card px-3 py-2.5 rounded-lg text-xs text-center text-primary shadow-inner" placeholder="الكمية"><button onclick="window.remIng(${idx}, ${iIdx})" class="text-red-500 font-bold px-2 py-1 text-lg">✕</button></div>`).join('');
            list.innerHTML += `<div class="bg-input p-5 rounded-ios-lg border border-theme relative text-sm space-y-4 shadow-sm fade-in"><button onclick="window.remMeal(${idx})" class="absolute top-4 left-4 text-red-500 font-bold px-2 py-1 text-lg leading-none z-10">✕</button><input type="text" onchange="window.updateMealTitle(${idx}, this.value)" value="${m.title}" class="w-full bg-card px-4 py-3.5 rounded-xl font-bold text-primary pr-12 shadow-inner" placeholder="اسم الوجبة"><div class="grid grid-cols-2 gap-3"><div><label class="text-[10px] text-muted font-bold block mb-1">تاريخ العرض (فارغ = دائم)</label><input type="date" onchange="window.updateMealDate(${idx}, this.value)" value="${m.date||''}" class="w-full bg-card px-3 py-2 rounded-lg text-primary text-xs shadow-inner"></div><div><label class="text-[10px] text-muted font-bold block mb-1">الفترة (توضيحي)</label><input type="text" onchange="window.updateMealPeriod(${idx}, this.value)" value="${m.period||''}" class="w-full bg-card px-3 py-2 rounded-lg text-primary text-xs shadow-inner" placeholder="مثال: الإفطار"></div></div><div class="grid grid-cols-4 gap-3 bg-card p-3 rounded-xl border border-theme text-center shadow-inner"><div><label class="text-[10px] text-muted block mb-2 font-bold">سعرات</label><input type="number" onchange="window.updateMealCal(${idx}, this.value)" value="${m.cal||0}" class="w-full bg-transparent font-bold text-primary text-base outline-none text-center"></div><div><label class="text-[10px] text-muted block mb-2 font-bold">بروتين</label><input type="number" onchange="window.updateMealPro(${idx}, this.value)" value="${m.pro||0}" class="w-full bg-transparent font-bold text-accent text-base outline-none text-center"></div><div><label class="text-[10px] text-muted block mb-2 font-bold">كارب</label><input type="number" onchange="window.updateMealCarb(${idx}, this.value)" value="${m.carb||0}" class="w-full bg-transparent font-bold text-blue-500 text-base outline-none text-center"></div><div><label class="text-[10px] text-muted block mb-2 font-bold">دهون</label><input type="number" onchange="window.updateMealFat(${idx}, this.value)" value="${m.fat||0}" class="w-full bg-transparent font-bold text-yellow-500 text-base outline-none text-center"></div></div><div class="p-4 border border-theme rounded-xl bg-card shadow-sm"><span class="text-sm text-primary font-bold block mb-3">المكونات:</span>${ingredientsHtml}<button onclick="window.addIng(${idx})" class="w-full text-xs bg-input text-primary font-bold py-3 rounded-lg mt-2 border border-theme shadow-sm transition-transform active:scale-95">+ إضافة مكون</button></div><input type="text" onchange="window.updateMealImage(${idx}, this.value)" value="${m.image||''}" class="w-full bg-card px-4 py-3 rounded-xl text-xs text-accent shadow-inner" placeholder="رابط الصورة (اختياري)"><textarea onchange="window.updateMealRecipe(${idx}, this.value)" rows="3" class="w-full bg-card px-4 py-3 rounded-xl text-sm text-primary leading-relaxed shadow-inner" placeholder="طريقة التحضير...">${m.recipe||''}</textarea><input type="text" onchange="window.updateMealMedia(${idx}, this.value)" value="${m.media||''}" class="w-full bg-card px-4 py-3 rounded-xl text-xs text-accent shadow-inner" placeholder="رابط فيديو (اختياري)"></div>`;
        });
    };
    window.remMeal = (idx) => { window.currentAdminMeals.splice(idx, 1); window.renderAdminMeals(); }; window.addIng = (mIdx) => { window.currentAdminMeals[mIdx].ingredients = window.currentAdminMeals[mIdx].ingredients || []; window.currentAdminMeals[mIdx].ingredients.push({name:'', amount:''}); window.renderAdminMeals(); }; window.remIng = (mIdx, iIdx) => { window.currentAdminMeals[mIdx].ingredients.splice(iIdx, 1); window.renderAdminMeals(); };
    window.updateIngName = (mIdx, iIdx, val) => { window.currentAdminMeals[mIdx].ingredients[iIdx].name = val; }; window.updateIngAmount = (mIdx, iIdx, val) => { window.currentAdminMeals[mIdx].ingredients[iIdx].amount = val; }; window.updateMealTitle = (idx, val) => { window.currentAdminMeals[idx].title = val; }; window.updateMealDate = (idx, val) => { window.currentAdminMeals[idx].date = val; }; window.updateMealPeriod = (idx, val) => { window.currentAdminMeals[idx].period = val; }; window.updateMealCal = (idx, val) => { window.currentAdminMeals[idx].cal = parseInt(val) || 0; }; window.updateMealPro = (idx, val) => { window.currentAdminMeals[idx].pro = parseInt(val) || 0; }; window.updateMealCarb = (idx, val) => { window.currentAdminMeals[idx].carb = parseInt(val) || 0; }; window.updateMealFat = (idx, val) => { window.currentAdminMeals[idx].fat = parseInt(val) || 0; }; window.updateMealImage = (idx, val) => { window.currentAdminMeals[idx].image = val; }; window.updateMealRecipe = (idx, val) => { window.currentAdminMeals[idx].recipe = val; }; window.updateMealMedia = (idx, val) => { window.currentAdminMeals[idx].media = val; };

    const btnGenCode = document.getElementById('generateCodeBtn');
    if(btnGenCode) btnGenCode.onclick = async () => {
        const code = document.getElementById('adminNewCode').value.trim().toUpperCase(); const days = parseInt(document.getElementById('codeDays').value) || 0; const hours = parseInt(document.getElementById('codeHours').value) || 0; const mins = parseInt(document.getElementById('codeMins').value) || 0;
        if(code && (days||hours||mins)) { await set(ref(db, `codes/${code}`), { code, days, hours, mins, used: false }); window.showMsg("تم حفظ الكود", false); document.getElementById('adminNewCode').value = ''; window.loadAdminCodes(); }
    };
    
    const btnSaveHrs = document.getElementById('saveWorkHoursBtn');
    if(btnSaveHrs) btnSaveHrs.onclick = async () => { const start = document.getElementById('workStart').value; const end = document.getElementById('workEnd').value; await set(ref(db, 'admin_settings/workHours'), { start, end }); window.showMsg("تم حفظ أوقات العمل بنجاح ⏰", false); };
    
    const btnRefUsers = document.getElementById('refreshUsersBtn'); if(btnRefUsers) btnRefUsers.onclick = window.loadAdminUsers;
    const btnBackAdm = document.getElementById('backToAdminMainBtn'); if(btnBackAdm) btnBackAdm.onclick = () => { document.getElementById('adminUserDetailView').classList.add('hidden'); document.getElementById('adminMainView').classList.remove('hidden'); window.loadAdminUsers(); };
    
    const btnSaveAll = document.getElementById('adminSaveAllBtn');
    if(btnSaveAll) btnSaveAll.onclick = async () => {
        const targets = { cal: parseInt(document.getElementById('targetCalInput').value) || 2000, pro: parseInt(document.getElementById('targetProInput').value) || 150, carb: parseInt(document.getElementById('targetCarbInput').value) || 200, fat: parseInt(document.getElementById('targetFatInput').value) || 60 };
        btnSaveAll.innerText = 'جاري الحفظ...';
        const cleanBadges = window.currentAdminBadges.filter(b => b != null && b.title && b.title.trim() !== ''); const cleanTimeline = window.currentAdminTimeline.filter(t => t != null && t.title && t.title.trim() !== '');
        const cleanExercises = window.currentAdminExercises.filter(e => e != null && e.title && e.title.trim() !== ''); const cleanMeals = window.currentAdminMeals.filter(m => m != null && m.title && m.title.trim() !== '');
        await update(ref(db, `users/${window.currentAdminViewUid}`), { targets: targets, 'plan/exercises': cleanExercises.length > 0 ? cleanExercises : null, 'plan/meals': cleanMeals.length > 0 ? cleanMeals : null, 'plan/timeline': cleanTimeline.length > 0 ? cleanTimeline : null, badges: cleanBadges.length > 0 ? cleanBadges : null });
        window.showMsg("تم الحفظ والنشر بنجاح!", false); btnSaveAll.innerText = 'حفظ ونشر الكل ✔️';
    };
    
    const btnAddEx = document.getElementById('addExerciseBtn'); if(btnAddEx) btnAddEx.onclick = window.addExercise; 
    const btnAddMl = document.getElementById('addMealBtn'); if(btnAddMl) btnAddMl.onclick = window.addMeal; 
    const btnAddBg = document.getElementById('addBadgeBtn'); if(btnAddBg) btnAddBg.onclick = window.addBadge;

    const btnAdmCreate = document.getElementById('adminCreateUserBtn');
    if(btnAdmCreate) {
        btnAdmCreate.onclick = async () => {
            const name = document.getElementById('adminAddUserName').value.trim();
            const email = document.getElementById('adminAddUserEmail').value.trim();
            const pass = document.getElementById('adminAddUserPass').value.trim();

            if(!name || !email || !pass) return window.showMsg("الرجاء تعبئة جميع الحقول", true);

            btnAdmCreate.innerText = 'جاري الإنشاء...';
            try {
                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
                const { getAuth, createUserWithEmailAndPassword, signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
                const { firebaseConfig } = await import('./firebase-config.js');
                
                let secApp;
                try { secApp = initializeApp(firebaseConfig, "SecondaryApp" + Date.now()); } catch(e) {}
                const secAuth = getAuth(secApp);

                const userCred = await createUserWithEmailAndPassword(secAuth, email, pass);
                const newUid = userCred.user.uid;

                const d = new Date(); 
                const timestamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

                await set(ref(db, `users/${newUid}`), {
                    email: email,
                    onboardingCompleted: true,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 30*86400000).toISOString(),
                    usedCode: 'إضافة يدوية',
                    profile: { name: name, weight: 0, height: 0, goal: '' },
                    progress: { currentWeight: 0, weightHistory: { [timestamp]: 0 } }
                });

                await signOut(secAuth);
                window.showMsg("تم إنشاء حساب المتدربة بنجاح ✔️", false);
                document.getElementById('adminAddUserName').value = ''; document.getElementById('adminAddUserEmail').value = ''; document.getElementById('adminAddUserPass').value = '';
                btnAdmCreate.innerText = 'إنشاء وتفعيل الحساب';
                window.loadAdminUsers();
            } catch(e) { window.showMsg(e.message, true); btnAdmCreate.innerText = 'إنشاء وتفعيل الحساب'; }
        };
    }

    const btnAdmSend = document.getElementById('adminSendChatBtn');
    if(btnAdmSend) {
        btnAdmSend.onclick = () => { const inp = document.getElementById('adminChatInput'); if(inp.value.trim() && window.currentAdminViewUid){ push(ref(db, `chats/${window.currentAdminViewUid}`), { text: inp.value, type: 'text', sender: 'admin', time: Date.now() }); inp.value = ''; update(ref(db, `users/${window.currentAdminViewUid}`), { hasUnread: false }); } };
        document.getElementById('adminChatInput').addEventListener('keypress', function (e) { if (e.key === 'Enter') btnAdmSend.click(); });
        document.getElementById('adminChatFile').onchange = (e) => window.handleImageUpload(e, window.currentAdminViewUid, 'admin');
    }
}
