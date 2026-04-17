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
const loadDashboard = async (user) => {
    const list = document.getElementById('patient-appointments-list');
    if (!list) return;
    list.innerHTML = '<p class="text-slate-500 animate-pulse">Loading history...</p>';
    
    // Ensure the phone number matches exactly how it was saved in the DB (usually 10 digits without +91)
    const localPhone = user.phoneNumber.replace('+91', ''); 
    
    try {
        const q = query(collection(db, "appointments"), where("phone", "==", localPhone));
        const snapshot = await getDocs(q);
        
        if(snapshot.empty) {
            list.innerHTML = '<div class="bg-white p-6 rounded-2xl border border-slate-200 text-center"><p class="text-slate-500">You have no appointment history.</p></div>';
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
                    <div class="shrink-0">
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

// Auth State Guard (The Bouncer)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is allowed in
        dashboardView?.classList.remove('hidden');
        logoutBtn?.classList.remove('hidden');
        loadDashboard(user);
    } else {
        // User is not logged in. Kick them back to index.html immediately.
        window.location.replace('index.html');
    }
});

// Logout
logoutBtn?.addEventListener('click', () => {
    signOut(auth); // The onAuthStateChanged listener will catch this and kick them out
});
