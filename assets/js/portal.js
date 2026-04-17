import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, query, where, getDocs, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { auth, db } from './firebase-init.js';

// Global State
window.sanitizePhone = (rawPhone) => {
    if (!rawPhone) return "";
    let clean = rawPhone.replace('+91', '').replace(/[\s\-()]/g, '');
    if (clean.length === 12 && clean.startsWith('91')) clean = clean.substring(2);
    return clean;
};

let currentCleanPhone = null;
let currentCompositeId = null;
let currentPatientName = null;

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

// Tab Switching Engine
const setupTabs = () => {
    const tabs = ['dashboard', 'records', 'profile'];
    tabs.forEach(tab => {
        document.getElementById(`tab-${tab}`)?.addEventListener('click', (e) => {
            // Reset all buttons
            tabs.forEach(t => {
                const btn = document.getElementById(`tab-${t}`);
                if (btn) {
                    btn.classList.remove('border-teal-600', 'text-teal-700', 'font-bold');
                    btn.classList.add('border-transparent', 'text-slate-500', 'font-medium');
                }
                const viewId = t === 'dashboard' ? 'dashboard-view' : `view-${t}`;
                document.getElementById(viewId)?.classList.add('hidden');
            });
            
            // Activate clicked tab
            e.target.classList.remove('border-transparent', 'text-slate-500', 'font-medium');
            e.target.classList.add('border-teal-600', 'text-teal-700', 'font-bold');
            
            // Show view and load data
            if (tab === 'dashboard') {
                document.getElementById('dashboard-view').classList.remove('hidden');
                loadAppointments();
            } else if (tab === 'records') {
                document.getElementById('view-records').classList.remove('hidden');
                loadMedicalRecords();
            } else if (tab === 'profile') {
                document.getElementById('view-profile').classList.remove('hidden');
                loadProfileDetails();
            }
        });
    });
};

// Auth & Family Selector Logic
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentCleanPhone = window.sanitizePhone(user.phoneNumber);
        document.getElementById('logout-btn')?.classList.remove('hidden');
        
        try {
            const q = query(collection(db, "patients"), where("phone", "==", currentCleanPhone));
            const snapshot = await getDocs(q);
            
            if (snapshot.size === 0 || snapshot.size === 1) {
                let pName = snapshot.size === 1 ? snapshot.docs[0].data().name : null;
                window.selectProfile(pName, currentCleanPhone);
            } else {
                const container = document.getElementById('family-profiles-container');
                let html = '';
                snapshot.forEach(doc => {
                    const p = doc.data();
                    html += `
                        <button onclick="window.selectProfile('${p.name}', '${currentCleanPhone}')" class="flex flex-col items-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-teal-500 hover:shadow-md transition-all w-32 group">
                            <div class="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-2xl font-bold mb-3 group-hover:bg-teal-600 group-hover:text-white transition-colors">${p.name.charAt(0).toUpperCase()}</div>
                            <span class="font-semibold text-slate-700 truncate w-full">${p.name}</span>
                        </button>
                    `;
                });
                container.innerHTML = html;
                document.getElementById('profile-selector-view').classList.remove('hidden');
            }
        } catch (err) {
            console.error("Auth process error:", err);
            window.location.replace('index.html');
        }
    } else {
        window.location.replace('index.html');
    }
});

// Selection Handler
window.selectProfile = (name, phone) => {
    currentPatientName = name;
    currentCompositeId = name ? `${phone}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}` : null;
    
    document.getElementById('profile-selector-view').classList.add('hidden');
    document.getElementById('portal-nav').classList.remove('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    
    setupTabs();
    loadAppointments();
};

const loadAppointments = async () => {
    const list = document.getElementById('patient-appointments-list');
    if (!list) return;
    list.innerHTML = '<p class="text-slate-500 animate-pulse">Loading appointments...</p>';
    
    try {
        let aptQuery = query(collection(db, "appointments"), where("phone", "==", currentCleanPhone));
        if (currentPatientName) {
            aptQuery = query(collection(db, "appointments"), where("phone", "==", currentCleanPhone), where("name", "==", currentPatientName));
        }
        
        const snapshot = await getDocs(aptQuery);
        if (snapshot.empty) {
            list.innerHTML = `<div class="bg-white p-6 rounded-2xl border border-slate-200 text-center"><p class="text-slate-500">No appointments found.</p></div>`;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const statusColor = data.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700';
            const statusText = data.status === 'pending' ? 'Pending' : 'Confirmed';
            html += `
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-teal-300 transition-colors">
                    <div>
                        <p class="font-bold text-slate-800 text-lg">${data.date} <span class="text-sm font-normal text-slate-500 ml-2">| ${data.time || 'Time TBD'}</span></p>
                        <p class="text-sm text-slate-600 mt-1 italic">"${data.symptoms}"</p>
                    </div>
                    <div class="shrink-0 flex items-center gap-3">
                        ${!currentPatientName ? `<span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 px-2 py-1 rounded">${data.name}</span>` : ''}
                        <span class="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor}">${statusText}</span>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p class="text-rose-500">Error loading appointments.</p>';
    }
};

const loadMedicalRecords = async () => {
    const list = document.getElementById('records-list');
    if (!list) return;
    
    if (!currentCompositeId) {
        list.innerHTML = '<div class="bg-white p-8 text-center rounded-2xl border border-slate-200"><p class="text-slate-500">No medical records found. The clinic will update this after your visit.</p></div>';
        return;
    }
    
    list.innerHTML = '<p class="text-slate-500 animate-pulse">Fetching medical history...</p>';
    try {
        const q = query(collection(db, "patients", currentCompositeId, "logs"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="bg-white p-8 text-center rounded-2xl border border-slate-200"><p class="text-slate-500">No prescriptions or records on file yet.</p></div>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const log = doc.data();
            const imageHtml = log.attachment ? `<div class="mt-4"><p class="text-xs font-bold text-slate-500 uppercase mb-2">Attached Prescription</p><img src="${log.attachment}" class="rounded-xl border border-slate-200 w-full object-contain max-h-[600px] shadow-sm"></div>` : '';
            html += `
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div class="absolute left-0 top-0 w-1.5 h-full bg-teal-500"></div>
                    <p class="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">${log.dateStr || 'Recent'} • ${log.author || 'Clinic'}</p>
                    <p class="text-slate-800 whitespace-pre-wrap leading-relaxed">${log.text}</p>
                    ${imageHtml}
                </div>
            `;
        });
        list.innerHTML = `<div class="border-l-2 border-slate-100 ml-4 pl-6 space-y-6 py-2">${html}</div>`;
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p class="text-rose-500">Failed to load records.</p>';
    }
};

const loadProfileDetails = async () => {
    const container = document.getElementById('profile-details');
    if (!container || !currentCompositeId) return;
    
    try {
        const docSnap = await getDoc(doc(db, "patients", currentCompositeId));
        if (docSnap.exists()) {
            const p = docSnap.data();
            container.innerHTML = `
                <div class="grid grid-cols-2 gap-8">
                    <div>
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</p>
                        <p class="font-semibold text-slate-800 text-lg">${p.name}</p>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Number</p>
                        <p class="font-semibold text-slate-800 text-lg">+91 ${p.phone}</p>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Age / Gender</p>
                        <p class="font-semibold text-slate-800 text-lg">${p.age || '--'} / ${p.gender || '--'}</p>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Blood Group</p>
                        <p class="font-semibold text-slate-800 text-lg">${p.bloodGroup || 'Not specified'}</p>
                    </div>
                    <div class="col-span-2 p-4 bg-rose-50 rounded-xl border border-rose-100">
                        <p class="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">Known Allergies</p>
                        <p class="font-bold text-rose-600">${p.allergies || 'None reported'}</p>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        console.error(e);
    }
};

const logoutBtn = document.getElementById('logout-btn');
logoutBtn?.addEventListener('click', () => signOut(auth));
