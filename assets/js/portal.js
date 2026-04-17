import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAVZHO-avENaKejMjAUexsaem-Dusljvzo",
  authDomain: "hope-homeo-care.firebaseapp.com",
  projectId: "hope-homeo-care",
  storageBucket: "hope-homeo-care.firebasestorage.app",
  messagingSenderId: "962992614809",
  appId: "1:962992614809:web:8d61d27c8881588c59f708"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
auth.useDeviceLanguage();

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
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const phoneStep = document.getElementById('login-phone-step');
const otpStep = document.getElementById('login-otp-step');
const logoutBtn = document.getElementById('logout-btn');

let confirmationResult = null;

// Initialize reCAPTCHA
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'send-otp-btn', {
    'size': 'invisible'
});

// Send OTP
document.getElementById('send-otp-btn')?.addEventListener('click', async (e) => {
    const phoneRaw = document.getElementById('login-phone').value.trim();
    if(phoneRaw.length !== 10) return window.showToast("Enter a valid 10-digit number.", "error");
    
    const phoneNumber = "+91" + phoneRaw;
    const btn = e.target;
    btn.innerText = "Sending...";
    
    try {
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
        phoneStep.classList.add('hidden');
        otpStep.classList.remove('hidden');
        window.showToast("OTP Sent!");
    } catch (error) {
        console.error(error);
        window.showToast("Failed to send OTP.", "error");
        if(window.recaptchaVerifier) window.recaptchaVerifier.render().then(id => window.grecaptcha.reset(id));
    } finally {
        btn.innerText = "Send OTP";
    }
});

// Verify OTP
document.getElementById('verify-otp-btn')?.addEventListener('click', async (e) => {
    const code = document.getElementById('login-otp').value.trim();
    if(code.length !== 6) return window.showToast("Enter the 6-digit OTP.", "error");
    
    const btn = e.target;
    btn.innerText = "Verifying...";
    
    try {
        await confirmationResult.confirm(code);
        // onAuthStateChanged will handle the UI switch
    } catch (error) {
        console.error(error);
        window.showToast("Invalid OTP code.", "error");
    } finally {
        btn.innerText = "Verify & Login";
    }
});

// Fetch Appointments
const loadDashboard = async (user) => {
    const list = document.getElementById('patient-appointments-list');
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

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        loadDashboard(user);
    } else {
        authView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        logoutBtn.classList.add('hidden');
        phoneStep.classList.remove('hidden');
        otpStep.classList.add('hidden');
        document.getElementById('login-phone').value = '';
        document.getElementById('login-otp').value = '';
    }
});

// Logout
logoutBtn?.addEventListener('click', () => {
    signOut(auth).then(() => window.showToast("Logged out successfully."));
});
