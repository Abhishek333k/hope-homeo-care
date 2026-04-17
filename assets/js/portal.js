import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { auth, db } from './firebase-init.js';

// Global state
let currentProfile = null; // Stores { phone, name, compositeId }

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

// Tab Switching Logic
const switchTab = (tabId) => {
    const views = ['dashboard-view', 'view-records', 'view-profile'];
    const buttons = ['tab-dashboard', 'tab-records', 'tab-profile'];
    
    views.forEach(v => document.getElementById(v)?.classList.add('hidden'));
    buttons.forEach(b => {
        const btn = document.getElementById(b);
        if (btn) {
            btn.classList.remove('border-teal-600', 'text-teal-700', 'font-bold');
            btn.classList.add('border-transparent', 'text-slate-500', 'font-medium');
        }
    });

    // Active
    const activeViewMap = { 'tab-dashboard': 'dashboard-view', 'tab-records': 'view-records', 'tab-profile': 'view-profile' };
    document.getElementById(activeViewMap[tabId])?.classList.remove('hidden');
    const activeBtn = document.getElementById(tabId);
    if (activeBtn) {
        activeBtn.classList.add('border-teal-600', 'text-teal-700', 'font-bold');
        activeBtn.classList.remove('border-transparent', 'text-slate-500', 'font-medium');
    }

    // Load data if needed
    if (tabId === 'tab-records' && currentProfile?.compositeId) {
        loadMedicalRecords(currentProfile.compositeId);
    }
};

// Tab Listeners
['tab-dashboard', 'tab-records', 'tab-profile'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => switchTab(id));
});

// Fetch Medical Records (EMR Logs)
const loadMedicalRecords = async (compositeId) => {
    const list = document.getElementById('records-list');
    if (!list) return;
    list.innerHTML = '<p class="text-slate-500 animate-pulse">Fetching medical history...</p>';
    
    try {
        const q = query(collection(db, "patients", compositeId, "logs"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="bg-white p-8 text-center rounded-2xl border border-slate-200"><p class="text-slate-500">No medical records or prescriptions found.</p></div>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const log = doc.data();
            const imageHtml = log.attachment ? `<div class="mt-4"><p class="text-xs font-bold text-slate-500 uppercase mb-2">Attached Prescription</p><img src="${log.attachment}" class="rounded-xl border border-slate-200 max-w-full md:max-w-md shadow-sm"></div>` : '';
            
            html += `
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div class="absolute left-0 top-0 w-1 h-full bg-teal-500"></div>
                    <p class="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">${log.dateStr || 'Recent'} • ${log.author || 'Dr. Joshua'}</p>
                    <p class="text-slate-800 whitespace-pre-wrap leading-relaxed">${log.text}</p>
                    ${imageHtml}
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (error) {
        console.error("Error loading records:", error);
        list.innerHTML = '<p class="text-rose-500 text-center py-8">Failed to load medical records. Please try again later.</p>';
    }
};

// Fetch Appointments
const showDashboardView = async (phone, name) => {
    const list = document.getElementById('patient-appointments-list');
    if (!list) return;
    
    document.getElementById('portal-nav').classList.remove('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    list.innerHTML = '<p class="text-slate-500 animate-pulse">Loading history...</p>';
    
    try {
        let aptQuery = query(collection(db, "appointments"), where("phone", "==", phone));
        if (name) {
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
            currentProfile = { phone: localPhone, name: null, compositeId: null };
            showDashboardView(localPhone, null);
        } else if (snapshot.size === 1) {
            const p = snapshot.docs[0].data();
            currentProfile = { phone: localPhone, name: p.name, compositeId: `${localPhone}_${p.name.replace(/\s+/g, '').toLowerCase()}` };
            showDashboardView(localPhone, p.name);
        } else {
            document.getElementById('profile-selector-view').classList.remove('hidden');
            const container = document.getElementById('family-profiles-container');
            
            let html = '';
            snapshot.forEach(doc => {
                const p = doc.data();
                const composite = `${localPhone}_${p.name.replace(/\s+/g, '').toLowerCase()}`;
                html += `
                    <button onclick="window.selectProfile('${p.name}', '${composite}')" class="flex flex-col items-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-teal-500 hover:shadow-md transition-all w-32 group">
                        <div class="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-2xl font-bold mb-3 group-hover:bg-teal-600 group-hover:text-white transition-colors">${p.name.charAt(0).toUpperCase()}</div>
                        <span class="font-semibold text-slate-700 truncate w-full">${p.name}</span>
                    </button>
                `;
            });
            container.innerHTML = html;
        }
    } catch (err) {
        console.error("Profile load error:", err);
        showDashboardView(localPhone, null);
    }
};

window.selectProfile = (name, compositeId) => {
    const phone = auth.currentUser.phoneNumber.replace('+91', '');
    currentProfile = { phone, name, compositeId };
    document.getElementById('profile-selector-view').classList.add('hidden');
    showDashboardView(phone, name);
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('logout-btn')?.classList.remove('hidden');
        loadFamilyProfiles(user);
    } else {
        window.location.replace('index.html');
    }
});

const logoutBtn = document.getElementById('logout-btn');
logoutBtn?.addEventListener('click', () => signOut(auth));
