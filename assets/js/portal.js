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

// --- Core Engine: Unified Timeline Feed ---
const loadFeed = async () => {
    const stream = document.getElementById('feed-stream');
    if (!stream) return;
    stream.innerHTML = '<div class="p-8 text-center"><p class="text-slate-400 animate-pulse font-medium">Syncing clinical history...</p></div>';

    try {
        const fullPhone = "+91" + currentCleanPhone;
        const timelineEvents = [];

        // 1. Fetch Appointments (Sequential Fallback)
        let aptQuery = query(collection(db, "appointments"), where("phone", "==", currentCleanPhone));
        let aptSnap = await getDocs(aptQuery);
        
        if (aptSnap.empty) {
            aptQuery = query(collection(db, "appointments"), where("phone", "==", fullPhone));
            aptSnap = await getDocs(aptQuery);
        }
        
        aptSnap.forEach(snap => {
            const data = snap.data();
            const dbName = (data.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const currName = currentPatientName.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            if (dbName === currName) {
                timelineEvents.push({
                    type: 'appointment',
                    timestamp: data.timestamp ? data.timestamp.toMillis() : 0,
                    dateStr: data.date,
                    data: data
                });
            }
        });

        // 2. Fetch Medical Logs
        if (currentCompositeId) {
            const logsQuery = query(collection(db, "patients", currentCompositeId, "logs"), orderBy("timestamp", "desc"));
            const logsSnap = await getDocs(logsQuery);
            logsSnap.forEach(snap => {
                const data = snap.data();
                timelineEvents.push({
                    type: 'log',
                    timestamp: data.timestamp ? data.timestamp.toMillis() : 0,
                    dateStr: data.dateStr,
                    data: data
                });
            });
        }

        // 3. Sort Chronologically (Newest First)
        timelineEvents.sort((a, b) => b.timestamp - a.timestamp);

        if (timelineEvents.length === 0) {
            stream.innerHTML = `
                <div class="bg-white p-12 text-center rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <span class="material-icons-round text-slate-200 text-6xl mb-4">history_toggle_off</span>
                    <p class="text-slate-500 font-medium">Your medical timeline is empty.<br><span class="text-sm opacity-60">Future visits and prescriptions will appear here.</span></p>
                </div>`;
            return;
        }

        // 4. Render Unified Feed
        let html = '';
        timelineEvents.forEach(event => {
            if (event.type === 'appointment') {
                const isAddressed = event.data.status === 'addressed';
                const theme = isAddressed ? 'teal' : 'amber';
                const statusLabel = isAddressed ? 'Confirmed' : 'Reviewing';
                const icon = isAddressed ? 'event_available' : 'schedule';
                
                html += `
                    <div class="relative group">
                        <div class="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-${theme}-500 shadow-sm z-10"></div>
                        <div class="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${event.dateStr}</span>
                                    <h4 class="font-bold text-slate-800">Clinic Appointment</h4>
                                </div>
                                <span class="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-${theme}-50 text-${theme}-600 border border-${theme}-100">
                                    <span class="material-icons-round text-[12px]">${icon}</span> ${statusLabel}
                                </span>
                            </div>
                            <p class="text-sm text-slate-500 leading-relaxed">Consultation scheduled for the ${event.data.time} session. Reason: ${event.data.symptoms || 'General Checkup'}</p>
                        </div>
                    </div>`;
            } else {
                const imageHtml = event.data.attachment ? `
                    <div class="mt-4 rounded-2xl overflow-hidden border border-slate-100 shadow-inner">
                        <img src="${event.data.attachment}" class="w-full object-contain max-h-[500px]" loading="lazy">
                    </div>` : '';
                
                html += `
                    <div class="relative group">
                        <div class="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-blue-500 shadow-sm z-10"></div>
                        <div class="bg-blue-50/30 border border-blue-100 p-6 rounded-3xl shadow-sm">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">${event.dateStr}</span>
                                    <h4 class="font-bold text-blue-900">Medical Prescription</h4>
                                </div>
                                <span class="material-icons-round text-blue-500 opacity-20">clinical_notes</span>
                            </div>
                            <p class="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">${event.data.text}</p>
                            ${imageHtml}
                            <div class="mt-4 flex items-center gap-2">
                                <div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold">NJ</div>
                                <span class="text-[11px] font-medium text-blue-600/60 uppercase">Dr. K. Nikhil Joshua</span>
                            </div>
                        </div>
                    </div>`;
            }
        });
        stream.innerHTML = html;
    } catch (err) {
        console.error("Feed Load Error:", err);
        stream.innerHTML = '<p class="text-rose-500 text-center font-medium">Failed to sync clinical history.</p>';
    }
};

// --- Dynamic Session Validation (30-min Slots) ---
let blockedSlots = [];
const applyDynamicValidation = (dateInputId, timeSelectId) => {
    const dateInput = document.getElementById(dateInputId);
    const timeSelect = document.getElementById(timeSelectId);
    let fp = null;

    if (!dateInput || !timeSelect) return;

    if (typeof flatpickr !== 'undefined') {
        fp = flatpickr(dateInput, {
            minDate: "today",
            disable: [
                function(date) { 
                    if (date.getDay() === 0) return true; // Disable Sunday
                    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    return blockedSlots.includes(`${localDate}|All`);
                }
            ],
            dateFormat: "d/m/Y",
            static: true, 
            disableMobile: "true",
            onChange: function(selectedDates, dateStr, instance) {
                const parts = dateStr.split('/');
                const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                
                document.querySelectorAll('.slot-pill').forEach(pill => {
                    const time = pill.dataset.value;
                    const isBlocked = blockedSlots.includes(`${isoDate}|${time}`);
                    pill.disabled = isBlocked;
                    if (isBlocked) {
                        pill.classList.add('opacity-40', 'cursor-not-allowed', 'bg-slate-100');
                        pill.classList.remove('bg-teal-600', 'text-white', 'border-teal-600');
                    } else {
                        pill.classList.remove('opacity-40', 'cursor-not-allowed', 'bg-slate-100');
                    }
                });
                document.getElementById('int-book-time').value = "";
            }
        });
    }

    const fetchSlots = async () => {
        try {
            const docSnap = await getDoc(doc(db, "settings", "calendar"));
            if (docSnap.exists() && docSnap.data().blockedSlots) {
                blockedSlots = docSnap.data().blockedSlots;
                if (fp) fp.redraw();
            }
        } catch (error) {
            console.error("Calendar Load Error:", error);
        }
    };
    fetchSlots();
};

applyDynamicValidation('int-book-date', 'int-book-time');

// Pill Interaction
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('slot-pill') && !e.target.disabled) {
        document.querySelectorAll('.slot-pill').forEach(p => {
            p.classList.remove('bg-teal-600', 'text-white', 'border-teal-600');
            p.classList.add('bg-slate-50', 'text-slate-600', 'border-slate-200');
        });
        e.target.classList.add('bg-teal-600', 'text-white', 'border-teal-600');
        e.target.classList.remove('bg-slate-50', 'text-slate-600', 'border-slate-200');
        document.getElementById('int-book-time').value = e.target.dataset.value;
    }
});

// --- Auth & Profile Management ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentCleanPhone = window.sanitizePhone(user.phoneNumber);
        const fullPhone = "+91" + currentCleanPhone;
        document.getElementById('logout-btn')?.classList.remove('hidden');
        
        try {
            let q = query(collection(db, "patients"), where("phone", "==", currentCleanPhone));
            let snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                q = query(collection(db, "patients"), where("phone", "==", fullPhone));
                snapshot = await getDocs(q);
            }
            
            if (snapshot.size === 0 || snapshot.size === 1) {
                let pName = snapshot.size === 1 ? snapshot.docs[0].data().name : null;
                window.selectProfile(pName, currentCleanPhone);
            } else {
                const container = document.getElementById('family-profiles-container');
                let html = '';
                snapshot.forEach(doc => {
                    const p = doc.data();
                    html += `
                        <button onclick="window.selectProfile('${p.name}', '${currentCleanPhone}')" class="flex flex-col items-center p-6 bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm hover:border-teal-500 transition-all w-40 group">
                            <div class="w-20 h-20 rounded-3xl bg-slate-50 text-slate-400 flex items-center justify-center text-3xl font-bold mb-4 group-hover:bg-teal-600 group-hover:text-white transition-all transform group-hover:rotate-6">${p.name.charAt(0).toUpperCase()}</div>
                            <span class="font-bold text-slate-700 truncate w-full text-center leading-tight">${p.name}</span>
                        </button>`;
                });
                container.innerHTML = html;
                document.getElementById('profile-selector-view').classList.remove('hidden');
                document.getElementById('unified-feed-view').classList.add('hidden');
            }
        } catch (err) {
            console.error("Auth Engine Error:", err);
            window.showToast("Connection Interrupted. Please refresh.", "error");
        }
    } else {
        window.location.replace('index.html');
    }
});

window.selectProfile = (name, phone) => {
    currentPatientName = name;
    currentCompositeId = name ? `${phone}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}` : null;
    
    // UI Transitions
    document.getElementById('profile-selector-view').classList.add('hidden');
    document.getElementById('unified-feed-view').classList.remove('hidden');
    document.getElementById('switch-profile-btn')?.classList.remove('hidden');
    
    // Header Updates
    if (name) {
        document.getElementById('feed-patient-name').innerText = name;
        document.getElementById('feed-patient-phone').innerText = `+91 ${phone}`;
        const avatar = document.getElementById('feed-avatar');
        if (avatar) avatar.innerText = name.charAt(0).toUpperCase();
    }

    loadFeed();
};

document.getElementById('switch-profile-btn')?.addEventListener('click', () => {
    document.getElementById('unified-feed-view').classList.add('hidden');
    document.getElementById('profile-selector-view').classList.remove('hidden');
    currentCompositeId = null;
    currentPatientName = null;
});

// --- Modal & Form Logic ---
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

document.getElementById('internal-booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('int-book-submit');
    btn.innerText = "Submitting Request..."; btn.disabled = true;
    
    try {
        await addDoc(collection(db, "appointments"), {
            name: currentPatientName || "Unknown",
            phone: "+91" + currentCleanPhone,
            date: document.getElementById('int-book-date').value,
            time: document.getElementById('int-book-time').value,
            symptoms: document.getElementById('int-book-symptoms').value,
            consent: true,
            status: "pending",
            timestamp: serverTimestamp()
        });
        
        window.showToast("Your appointment request has been sent!");
        window.closeInternalBooking();
        document.getElementById('internal-booking-form').reset();
        loadFeed();
    } catch(err) {
        console.error(err);
        window.showToast("Failed to book. Try again later.", "error");
    } finally {
        btn.innerText = "Submit Request"; btn.disabled = false;
    }
});

// Logout Handler
document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (confirm("Log out of Patient Portal?")) signOut(auth);
});

// Support for Escape Key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeInternalBooking();
        if (currentPatientName && !document.getElementById('profile-selector-view').classList.contains('hidden')) {
            window.selectProfile(currentPatientName, currentCleanPhone);
        }
    }
});
