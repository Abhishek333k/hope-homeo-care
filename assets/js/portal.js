import { RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { auth, db } from './firebase-init.js';



// Toast System
window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-rose-500' : 'bg-slate-800';
    const icon = type === 'error' ? 'error' : 'check_circle';
    toast.className = `${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto`;
    toast.innerHTML = `<span class="material-icons-round text-[20px]">${icon}</span> <p class="text-sm font-medium">${message}</p>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// DOM Elements
const dashboardView = document.getElementById('dashboard-view');
const logoutBtn = document.getElementById('logout-btn');

// Fetch Appointments
const showDashboardView = async (phone, name) => {
    const list = document.getElementById('patient-appointments-list');
    if (!list) return;
    
    document.getElementById('dashboard-view').classList.remove('hidden');
    list.innerHTML = '<p class="text-slate-500 animate-pulse">Loading history...</p>';
    
    try {
        let aptQuery = query(collection(db, "appointments"), where("phone", "==", phone));
        if (name) {
            // If a specific family member was selected, filter by their name too
            aptQuery = query(collection(db, "appointments"), where("phone", "==", phone), where("name", "==", name));
        }
        
        const snapshot = await getDocs(aptQuery);
        
        if(snapshot.empty) {
            list.innerHTML = `<div class="bg-white p-6 rounded-2xl border border-slate-200 text-center"><p class="text-slate-500">No appointment history found${name ? ' for ' + name : ''}.</p></div>`;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const statusColor = data.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700';
            const statusText = data.status === 'pending' ? 'Pending Review' : 'Confirmed';
            html += `
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-teal-300 transition-colors">
                    <div>
                        <p class="font-bold text-slate-800 text-lg">${data.date} <span class="text-sm font-normal text-slate-500 ml-2">| ${data.time || 'Time TBD'}</span></p>
                        <p class="text-sm text-slate-600 mt-1 italic">"${data.symptoms}"</p>
                    </div>
                    <div class="shrink-0 flex items-center gap-3">
                        ${!name ? `<span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 px-2 py-1 rounded">${data.name}</span>` : ''}
                        <span class="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor}">${statusText}</span>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch(err) {
        console.error(err);
        list.innerHTML = '<p class="text-rose-500">Error loading data.</p>';
    }
};

const loadFamilyProfiles = async (user) => {
    const localPhone = user.phoneNumber.replace('+91', '');
    try {
        const q = query(collection(db, "patients"), where("phone", "==", localPhone));
        const snapshot = await getDocs(q);
        
        if (snapshot.size === 0) {
            // No EMR profile found yet. Just load the dashboard based on phone.
            showDashboardView(localPhone, null);
        } else if (snapshot.size === 1) {
            // Only one person. Auto-select them.
            const patientData = snapshot.docs[0].data();
            showDashboardView(localPhone, patientData.name);
        } else {
            // MULTIPLE PROFILES FOUND - Show Family Selector
            document.getElementById('dashboard-view').classList.add('hidden');
            const selectorView = document.getElementById('profile-selector-view');
            const container = document.getElementById('family-profiles-container');
            
            let html = '';
            snapshot.forEach(doc => {
                const p = doc.data();
                html += `
                    <button onclick="window.selectProfile('${p.name}')" class="flex flex-col items-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-teal-500 hover:shadow-md transition-all w-32 group">
                        <div class="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-2xl font-bold mb-3 group-hover:bg-teal-600 group-hover:text-white transition-colors">${p.name.charAt(0).toUpperCase()}</div>
                        <span class="font-semibold text-slate-700 truncate w-full">${p.name}</span>
                    </button>
                `;
            });
            container.innerHTML = html;
            selectorView.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Profile load error:", err);
        showDashboardView(localPhone, null);
    }
};

// Global function to handle profile selection
window.selectProfile = (selectedName) => {
    document.getElementById('profile-selector-view').classList.add('hidden');
    showDashboardView(auth.currentUser.phoneNumber.replace('+91', ''), selectedName);
};

// Auth State Guard (The Bouncer)
onAuthStateChanged(auth, (user) => {
    if (user) {
        logoutBtn?.classList.remove('hidden');
        loadFamilyProfiles(user);
    } else {
        window.location.replace('index.html');
    }
});

// Logout
logoutBtn?.addEventListener('click', () => {
    signOut(auth);
});
