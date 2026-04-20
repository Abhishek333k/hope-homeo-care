import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, query, where, getDocs, orderBy, doc, getDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
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
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
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
            tabs.forEach(t => {
                const btn = document.getElementById(`tab-${t}`);
                if (btn) {
                    btn.classList.remove('border-teal-600', 'text-teal-700', 'font-bold');
                    btn.classList.add('border-transparent', 'text-slate-500', 'font-medium');
                }
                const viewId = t === 'dashboard' ? 'dashboard-view' : `view-${t}`;
                document.getElementById(viewId)?.classList.add('hidden');
            });
            
            e.target.classList.remove('border-transparent', 'text-slate-500', 'font-medium');
            e.target.classList.add('border-teal-600', 'text-teal-700', 'font-bold');
            
            if (tab === 'dashboard') {
                document.getElementById('dashboard-view').classList.remove('hidden');
                loadAppointments();
            } else if (tab === 'records') {
                document.getElementById('view-records').classList.remove('hidden');
                loadMedicalRecords(); // Task 3: Force refresh every click
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
        const fullPhone = "+91" + currentCleanPhone; // Grab both formats
        document.getElementById('logout-btn')?.classList.remove('hidden');
        
        try {
            // 🎯 THE DATA FIX: Query the DB for BOTH formats using the 'in' operator
            const q = query(collection(db, "patients"), where("phone", "in", [currentCleanPhone, fullPhone]));
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
                            <span class="font-semibold text-slate-700 truncate w-full text-center leading-tight">${p.name}</span>
                        </button>
                    `;
                });
                container.innerHTML = html;
                document.getElementById('profile-selector-view').classList.remove('hidden');
                document.getElementById('dashboard-view').classList.add('hidden');
                document.getElementById('portal-nav').classList.add('hidden');
            }
        } catch (err) {
            console.error("Database permission or fetch error:", err);
            window.showToast("Security Block: Unable to sync data.", "error");
            
            // 🚨 THE UI FIX: Physically remove the 'hidden' classes so the user isn't looking at a white screen
            document.getElementById('portal-nav')?.classList.remove('hidden');
            document.getElementById('dashboard-view')?.classList.remove('hidden');
            
            const appointmentsList = document.getElementById('patient-appointments-list');
            if (appointmentsList) {
                appointmentsList.innerHTML = 
                    `<div class="bg-rose-50 border border-rose-200 p-8 rounded-2xl text-center shadow-sm">
                        <span class="material-icons-round text-rose-500 text-5xl mb-3">gpp_bad</span>
                        <h3 class="text-lg font-bold text-rose-800 mb-2">Access Denied</h3>
                        <p class="text-rose-600">The database security rules blocked this connection. Please verify your Firebase Rules.</p>
                    </div>`;
            }
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
    
    // Task 1: Unhide Switch Profile button
    document.getElementById('switch-profile-btn')?.classList.remove('hidden');

    setupTabs();
    loadAppointments();
};

// Task 1: Switch Profile Event Listener
document.getElementById('switch-profile-btn')?.addEventListener('click', () => {
    // Hide all main views
    ['portal-nav', 'dashboard-view', 'view-records', 'view-profile'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    
    // Reset selection and show selector
    currentCompositeId = null;
    currentPatientName = null;
    document.getElementById('profile-selector-view').classList.remove('hidden');
});

const loadAppointments = async () => {
    const list = document.getElementById('patient-appointments-list');
    if (!list) return;
    list.innerHTML = '<p class="text-slate-500 animate-pulse">Syncing your schedule...</p>';
    
    try {
        const fullPhone = "+91" + currentCleanPhone;
        // 🎯 THE DATA FIX: Fetch appointments regardless of how the phone number was formatted
        const q = query(collection(db, "appointments"), where("phone", "in", [currentCleanPhone, fullPhone]));
        const snapshot = await getDocs(q);
        
        let appointments = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (currentPatientName) {
                const dbName = (data.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const currName = currentPatientName.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (dbName === currName) appointments.push({ id: doc.id, ...data });
            } else {
                appointments.push({ id: doc.id, ...data });
            }
        });

        appointments.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
            return timeB - timeA;
        });

        if (appointments.length === 0) {
            list.innerHTML = `<div class="bg-white p-8 text-center rounded-2xl border border-slate-200"><p class="text-slate-500">No past appointments found.</p></div>`;
            return;
        }
        
        let html = '';
        appointments.forEach(apt => {
            const isAddressed = apt.status === 'addressed';
            const statusColor = isAddressed ? 'text-teal-600 bg-teal-50 border-teal-100' : 'text-amber-600 bg-amber-50 border-amber-100';
            const statusText = isAddressed ? 'Confirmed / Addressed' : 'Pending Review';
            
            let gcalBtn = '';
            if (apt.date) {
                // Support both legacy (YYYY-MM-DD) and new (DD/MM/YYYY) formats
                let normalizedDate = apt.date;
                if (apt.date.includes('/')) {
                    const parts = apt.date.split('/');
                    normalizedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                
                const dateClean = normalizedDate.replace(/-/g, '');
                const nextDayDate = new Date(new Date(normalizedDate).getTime() + 86400000);
                const nextDayStr = nextDayDate.toISOString().split('T')[0].replace(/-/g, '');
                
                const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Clinic+Appointment+-+Dr.+K.+Nikhil+Joshua&dates=${dateClean}/${nextDayStr}&details=Consultation+at+Hope+Homeo+Care.+Reason: ${encodeURIComponent(apt.symptoms || 'General Checkup')}&location=Hope+Homeo+Care,+Mangalagiri`;
                
                gcalBtn = `
                    <a href="${gcalUrl}" target="_blank" class="mt-4 md:mt-0 inline-flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-medium py-2 px-4 rounded-lg transition-colors text-sm shrink-0">
                        <span class="material-icons-round text-[16px]">event</span> Add to Calendar
                    </a>
                `;
            }

            html += `
                <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-teal-300 transition-colors cursor-default">
                    <div>
                        <div class="flex items-center gap-3 mb-1">
                            <h4 class="font-bold text-slate-800">${apt.date}</h4>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor}">${statusText}</span>
                        </div>
                        <p class="text-sm text-slate-500 line-clamp-1">Reason: ${apt.symptoms || 'N/A'}</p>
                    </div>
                    ${gcalBtn}
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p class="text-rose-500">Failed to sync data.</p>';
    }
};

window.openInternalBooking = () => {
    document.getElementById('booking-for-name').innerText = currentPatientName || "You";
    const modal = document.getElementById('internal-booking-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modal.querySelector('div').classList.remove('scale-95'); }, 10);
};

window.closeInternalBooking = () => {
    const modal = document.getElementById('internal-booking-modal');
    if (!modal) return;
    modal.classList.add('opacity-0'); modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

// --- Dynamic Session Validation ---
let blockedSlots = [];

// Function to wire up the dynamic dropdown disable logic
const applyDynamicValidation = (dateInputId, timeSelectId) => {
    const dateInput = document.getElementById(dateInputId);
    const timeSelect = document.getElementById(timeSelectId);
    let fp = null;

    if (!dateInput || !timeSelect) return;

    // 1. Initialize Flatpickr (Only fully disable if "All Day" is blocked)
    if (typeof flatpickr !== 'undefined') {
        fp = flatpickr(dateInput, {
            minDate: "today",
            disable: [
                function(date) { 
                    if (date.getDay() === 0) return true; // Always disable Sunday
                    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    return blockedSlots.includes(`${localDate}|All`);
                }
            ],
            dateFormat: "d/m/Y",
            static: true, 
            disableMobile: "true",
            onChange: function(selectedDates, dateStr, instance) {
                // 2. Dynamically Lock/Unlock the Time Dropdown Options
                Array.from(timeSelect.options).forEach(opt => {
                    opt.disabled = false; // Reset first
                    opt.text = opt.text.replace(' (Unavailable)', '');
                });

                if (blockedSlots.includes(`${dateStr}|Morning`)) {
                    const opt = Array.from(timeSelect.options).find(o => o.value.includes('Morning'));
                    if (opt) { opt.disabled = true; opt.text += ' (Unavailable)'; }
                }
                if (blockedSlots.includes(`${dateStr}|Evening`)) {
                    const opt = Array.from(timeSelect.options).find(o => o.value.includes('Evening'));
                    if (opt) { opt.disabled = true; opt.text += ' (Unavailable)'; }
                }
                
                if (timeSelect.options[timeSelect.selectedIndex]?.disabled) {
                    timeSelect.value = "";
                }
            }
        });
    }

    // Fetch real-time slots
    const fetchSlots = async () => {
        try {
            const docSnap = await getDoc(doc(db, "settings", "calendar"));
            if (docSnap.exists() && docSnap.data().blockedSlots) {
                blockedSlots = docSnap.data().blockedSlots;
                if (fp) fp.redraw();
            }
        } catch (error) {
            console.error("Failed to load calendar settings:", error);
        }
    };
    fetchSlots();
};

// Apply to Internal Portal Booking Form
applyDynamicValidation('int-book-date', 'int-book-time');

document.getElementById('internal-booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('int-book-submit');
    btn.innerText = "Submitting..."; btn.disabled = true;
    
    try {
        await addDoc(collection(db, "appointments"), {
            name: currentPatientName || "Unknown",
            phone: currentFullPhone || ("+91" + currentCleanPhone),
            date: document.getElementById('int-book-date').value,
            time: document.getElementById('int-book-time').value,
            symptoms: document.getElementById('int-book-symptoms').value,
            consent: true,
            status: "pending",
            timestamp: serverTimestamp()
        });
        
        window.showToast("Appointment requested successfully!");
        window.closeInternalBooking();
        document.getElementById('internal-booking-form').reset();
        loadAppointments();
    } catch(err) {
        console.error(err);
        window.showToast("Failed to book appointment.", "error");
    } finally {
        btn.innerText = "Submit Request"; btn.disabled = false;
    }
});

const loadMedicalRecords = async () => {
    const list = document.getElementById('records-list');
    if (!list) return;

    if (!currentCompositeId) {
        console.warn("Attempted to load records without a valid composite ID.");
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
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-100"><p class="text-xs font-bold text-slate-400 uppercase">Full Name</p><p class="font-bold text-slate-800 text-lg">${p.name}</p></div>
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-100"><p class="text-xs font-bold text-slate-400 uppercase">Registered Phone</p><p class="font-bold text-slate-800 text-lg">+91 ${p.phone}</p></div>
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-100"><p class="text-xs font-bold text-slate-400 uppercase">Age / Gender</p><p class="font-bold text-slate-800 text-lg">${p.age || '--'} / ${p.gender || '--'}</p></div>
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-100"><p class="text-xs font-bold text-slate-400 uppercase">Blood Group</p><p class="font-bold text-rose-500 text-lg">${p.bloodGroup || 'Not specified'}</p></div>
                </div>
                <div class="bg-teal-50 border border-teal-100 rounded-xl p-4 flex gap-3 text-teal-800 text-sm">
                    <span class="material-icons-round">info</span>
                    <p><strong>Medical Record Integrity:</strong> To ensure clinical safety, core medical identifiers and contact numbers cannot be edited online. Please contact the clinic directly to request updates to your profile.</p>
                </div>
            `;
        }
    } catch (e) {
        console.error(e);
    }
};

const logoutBtn = document.getElementById('logout-btn');
logoutBtn?.addEventListener('click', () => {
    if (confirm("Are you sure you want to log out of the Patient Portal?")) {
        logoutBtn.innerText = "Logging out...";
        logoutBtn.disabled = true;
        signOut(auth);
    }
});

// Accessibility Hotkeys
document.addEventListener('keydown', (e) => {
    // Escape to close internal booking
    if (e.key === 'Escape') {
        const intModal = document.getElementById('internal-booking-modal');
        if (intModal && !intModal.classList.contains('hidden')) {
            window.closeInternalBooking();
        }
        // Escape to close family selector (if they changed their mind)
        if (currentCompositeId && !document.getElementById('profile-selector-view').classList.contains('hidden')) {
            window.selectProfile(currentPatientName, currentCleanPhone); // Reverts to last selected
        }
    }

    // Alt Modifiers for Logged-In Users
    if (e.altKey && auth.currentUser && currentCompositeId) {
        switch(e.key.toLowerCase()) {
            case '1': e.preventDefault(); document.getElementById('tab-dashboard')?.click(); break;
            case '2': e.preventDefault(); document.getElementById('tab-records')?.click(); break;
            case '3': e.preventDefault(); document.getElementById('tab-profile')?.click(); break;
            case 'b': 
                e.preventDefault(); 
                if (typeof window.openInternalBooking === 'function') window.openInternalBooking();
                break;
        }
    }
});
