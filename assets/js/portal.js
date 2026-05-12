import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { auth, db } from './firebase-init.js';

let currentCleanPhone = '';
let currentPatientName = '';
let globalAppointments = [];

window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-rose-500' : 'bg-slate-800';
    const icon = type === 'error' ? 'error' : 'check_circle';
    toast.className = `${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto z-[100]`;
    toast.innerHTML = `<span class="material-icons-round text-[20px]" aria-hidden="true">${icon}</span> <p class="text-sm font-medium">${message}</p>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// --- GOOGLE CALENDAR SYNC ENGINE ---
const generateGoogleCalendarUrl = (dateStr, timeStr) => {
    if (!dateStr || dateStr.includes('N/A') || !timeStr || timeStr.includes('Requested')) return null;

    try {
        // Parse DD/MM/YYYY
        const [day, month, year] = dateStr.split('/');
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        
        hours = parseInt(hours);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        const startDate = new Date(year, month - 1, day, hours, minutes);
        const endDate = new Date(startDate.getTime() + 30 * 60000); // Default 30 mins

        // Format to Google's required YYYYMMDDTHHmmss (Local Timezone Agnostic)
        const pad = (n) => n < 10 ? '0' + n : n;
        const formatGoogleDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

        const title = encodeURIComponent("Dr. Joshua Appointment - Hope Homeo Care");
        const details = encodeURIComponent("Homeopathy Consultation with Dr. K. Nikhil Joshua.\\nPlease bring any previous medical reports.");
        const location = encodeURIComponent("Hope Homeo Care, Mangalagiri, Andhra Pradesh");

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${details}&location=${location}`;
    } catch (e) {
        console.error("Calendar URL Error", e);
        return null;
    }
};

// --- STATE MANAGEMENT ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentCleanPhone = user.phoneNumber.replace('+91', '');
        document.getElementById('logout-btn').classList.remove('hidden');
        document.getElementById('switch-profile-btn').classList.remove('hidden');
        
        await fetchFamilyProfiles(currentCleanPhone);
    } else {
        window.location.href = 'index.html';
    }
});

// --- PROFILE GENERATOR ---
const fetchFamilyProfiles = async (phone) => {
    try {
        // Query only by phone (Rule will allow this because of .endsWith() bridge)
        const q = query(collection(db, "appointments"), where("phone", "==", phone));
        const snapshot = await getDocs(q);
        
        globalAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Mathematically extract unique names to serve as profiles
        const uniqueNames = [...new Set(globalAppointments.map(app => app.name).filter(Boolean))];

        const selectorView = document.getElementById('profile-selector-view');
        const feedView = document.getElementById('clinical-feed-view');
        const container = document.getElementById('family-profiles-container');

        if (uniqueNames.length === 0) {
            // NEW USER: First Time Booking UI
            selectorView.classList.remove('hidden');
            feedView.classList.add('hidden');
            container.innerHTML = `
                <div class="col-span-full text-center py-10 w-full">
                    <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-navy-100 text-navy-600 mb-4">
                        <span class="material-icons-round text-3xl">waving_hand</span>
                    </div>
                    <h3 class="text-2xl font-bold text-slate-800 mb-2">Welcome!</h3>
                    <p class="text-slate-500 mb-8">It looks like you don't have any records yet.</p>
                    <div class="max-w-xs mx-auto text-left">
                        <label for="new-user-name" class="block text-xs font-bold text-slate-500 uppercase mb-1">Patient Name</label>
                        <input type="text" id="new-user-name" name="name" autocomplete="name" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl mb-4 outline-none" placeholder="e.g., John Doe">
                        <button onclick="window.startFirstBooking()" class="w-full bg-navy-900 text-white font-bold py-3 rounded-xl">Start Booking</button>
                    </div>
                </div>
            `;
        } else if (uniqueNames.length === 1 && !currentPatientName) {
            // Auto-load single profile
            window.loadTimeline(uniqueNames[0]);
        } else {
            // Netflix-style Multi-Profile UI
            selectorView.classList.remove('hidden');
            feedView.classList.add('hidden');
            container.innerHTML = uniqueNames.map(name => `
                <button onclick="window.loadTimeline('${name}')" class="flex flex-col items-center group transition-transform hover:scale-105">
                    <div class="w-24 h-24 rounded-full bg-navy-50 border-4 border-white shadow-lg flex items-center justify-center text-navy-900 text-3xl font-black mb-3 group-hover:bg-navy-900 group-hover:text-white transition-colors">
                        ${name.charAt(0).toUpperCase()}
                    </div>
                    <span class="text-lg font-bold text-slate-700">${name}</span>
                </button>
            `).join('');
        }
    } catch (e) {
        console.error("Profile Fetch Error:", e);
        window.showToast("Security Link Error. Please check Firestore Rules.", "error");
    }
};

window.startFirstBooking = () => {
    const nameInput = document.getElementById('new-user-name');
    if (!nameInput || !nameInput.value.trim()) return window.showToast('Please enter a name.', 'error');
    currentPatientName = nameInput.value.trim();
    document.getElementById('booking-for-name').innerText = currentPatientName;
    document.getElementById('book-appointment-view').classList.remove('hidden');
    setTimeout(() => document.getElementById('book-appointment-view').classList.remove('opacity-0'), 10);
};

// --- TIMELINE RENDERER ---
window.loadTimeline = (targetName) => {
    currentPatientName = targetName;
    document.getElementById('profile-selector-view').classList.add('hidden');
    document.getElementById('clinical-feed-view').classList.remove('hidden');

    document.getElementById('profile-name').innerText = targetName;
    document.getElementById('profile-avatar').innerText = targetName.charAt(0).toUpperCase();

    // Filter and Sort in-memory to prevent multiple permission checks
    const patientHistory = globalAppointments
        .filter(app => app.name === targetName)
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    const feedContainer = document.getElementById('clinical-feed');
    
    if (patientHistory.length > 0) {
        const oldest = patientHistory[patientHistory.length - 1];
        document.getElementById('profile-member-since').innerText = `Patient Since: ${oldest.date}`;
    } else {
        document.getElementById('profile-member-since').innerText = `New Patient`;
    }

    if (patientHistory.length === 0) {
        feedContainer.innerHTML = '<div class="p-10 text-center text-slate-400">No medical records found.</div>';
        return;
    }

    feedContainer.innerHTML = '';
    patientHistory.forEach(app => {
        const statusConfig = {
            'pending': { color: 'amber', icon: 'schedule', label: 'Processing' },
            'confirmed': { color: 'blue', icon: 'event_available', label: 'Upcoming' },
            'completed': { color: 'emerald', icon: 'task_alt', label: 'Completed' }
        }[app.status] || { color: 'slate', icon: 'info', label: app.status };

        const dateStr = app.date || 'N/A';
        const timeStr = app.time || 'Requested';
        const calUrl = (app.status === 'confirmed') ? generateGoogleCalendarUrl(dateStr, timeStr) : null;

        let medicalAdviceHTML = '';
        if (app.medicalAdvice && app.medicalAdvice.trim() !== '') {
            medicalAdviceHTML = `
                <div class="mt-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <p class="text-xs font-bold text-navy-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <span class="material-icons-round text-[14px]">medical_services</span> Clinical Notes
                    </p>
                    <p class="text-sm text-slate-700 whitespace-pre-wrap">${app.medicalAdvice}</p>
                </div>
            `;
        }

        feedContainer.innerHTML += `
            <div class="relative">
                <div class="absolute -left-10 md:-left-12 mt-1.5 w-4 h-4 rounded-full bg-${statusConfig.color}-500 ring-4 ring-slate-50"></div>
                <div class="bg-white border border-slate-100 p-5 md:p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="text-lg font-bold text-slate-800 mb-1">${app.symptoms}</h3>
                            <div class="flex items-center gap-4 text-sm font-bold text-slate-800">
                                <span class="flex items-center gap-1.5"><span class="material-icons-round text-teal-500 text-[18px]">calendar_today</span> ${dateStr}</span>
                                <span class="flex items-center gap-1.5"><span class="material-icons-round text-teal-500 text-[18px]">schedule</span> ${timeStr}</span>
                            </div>
                        </div>
                        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-${statusConfig.color}-100 text-${statusConfig.color}-700 flex items-center gap-1">
                            <span class="material-icons-round text-[12px]">${statusConfig.icon}</span> ${statusConfig.label}
                        </span>
                    </div>

                    ${calUrl ? `
                    <div class="mt-4">
                        <a href="${calUrl}" target="_blank" class="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition-colors border border-slate-200 shadow-sm">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" class="w-4 h-4" alt="Google Calendar">
                            Add to Google Calendar
                        </a>
                    </div>
                    ` : ''}

                    ${medicalAdviceHTML}
                </div>
            </div>
        `;
    });
};

// --- NAVIGATION & BOOKING ---
document.getElementById('switch-profile-btn')?.addEventListener('click', () => {
    document.getElementById('clinical-feed-view').classList.add('hidden');
    document.getElementById('book-appointment-view').classList.add('hidden');
    document.getElementById('profile-selector-view').classList.remove('hidden');
});

document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));

window.openInternalBooking = () => {
    document.getElementById('booking-for-name').innerText = currentPatientName;
    document.getElementById('book-appointment-view').classList.remove('hidden');
    setTimeout(() => document.getElementById('book-appointment-view').classList.remove('opacity-0'), 10);
};

window.closeInternalBooking = () => {
    document.getElementById('book-appointment-view').classList.add('opacity-0');
    setTimeout(() => document.getElementById('book-appointment-view').classList.add('hidden'), 300);
};


// --- TIME SLOT LOGIC ---
const sessionSlots = {
    morning: { start: 9, end: 12 },
    afternoon: { start: 12, end: 17 },
    evening: { start: 17, end: 21 }
};

const generateSlots = (startHour, endHour) => {
    const slots = [];
    for (let h = startHour; h < endHour; h++) {
        for (let m of ["00", "15", "30", "45"]) {
            const period = h >= 12 ? "PM" : "AM";
            const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            slots.push(`${displayH}:${m} ${period}`);
        }
    }
    return slots;
};

window.toggleAccordion = (id) => {
    ['morning', 'afternoon', 'evening'].forEach(s => {
        const content = document.getElementById(`content-${s}`);
        const chevron = document.getElementById(`chevron-${s}`);
        if (!content) return;
        if (s === id) {
            const isOpen = content.classList.contains('max-h-96');
            if (isOpen) {
                content.classList.replace('max-h-96', 'max-h-0');
                chevron?.classList.remove('rotate-180');
            } else {
                content.classList.replace('max-h-0', 'max-h-96');
                chevron?.classList.add('rotate-180');
            }
        } else {
            content.classList.replace('max-h-96', 'max-h-0');
            chevron?.classList.remove('rotate-180');
        }
    });
};

window.selectSlot = (e, slot) => {
    if (e) e.preventDefault();
    const input = document.getElementById('int-book-time');
    if (input) input.value = slot;
    document.querySelectorAll('.chip-time-int').forEach(c => {
        c.classList.remove('bg-navy-900', 'text-white', 'border-navy-900');
        if (c.innerText.trim() === slot) c.classList.add('bg-navy-900', 'text-white', 'border-navy-900');
    });
};

const renderSlots = async (dateStr) => {
    try {
        const calendarSnap = await getDoc(doc(db, "settings", "calendar"));
        const blockedSlots = calendarSnap.exists() ? (calendarSnap.data().blockedSlots || []) : [];

        ['morning', 'afternoon', 'evening'].forEach(session => {
            const container = document.getElementById(`slots-${session}`);
            if (!container) return;

            const { start, end } = sessionSlots[session];
            const slots = generateSlots(start, end);

            container.innerHTML = slots.map(slot => {
                const isBlocked = blockedSlots.includes(`${dateStr}|${slot}`) ||
                    blockedSlots.includes(`${dateStr}|${session.charAt(0).toUpperCase() + session.slice(1)}`) ||
                    blockedSlots.includes(`${dateStr}|All`);

                return `
                    <button type="button" 
                        ${isBlocked ? 'disabled' : ''}
                        onclick="window.selectSlot(event, '${slot}')" 
                        class="chip-time-int h-10 w-full border border-slate-200 rounded-lg text-[10px] font-bold transition-all ${isBlocked ? 'bg-slate-50 text-slate-400 line-through cursor-not-allowed opacity-50' : 'hover:border-navy-900 hover:bg-slate-50'}">
                        ${slot}
                    </button>
                `;
            }).join('');
        });
        window.toggleAccordion('morning');
    } catch (e) {
        console.error("Slot Render Error:", e);
    }
};

document.getElementById('internal-booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('int-book-submit');
    const date = document.getElementById('int-book-date').value;
    const time = document.getElementById('int-book-time').value;
    const symptoms = document.getElementById('int-book-symptoms').value;

    if (!time) return window.showToast("Please select a time slot.", "error");

    submitBtn.disabled = true;
    submitBtn.innerHTML = "Processing...";

    try {
        await addDoc(collection(db, "appointments"), {
            name: currentPatientName,
            phone: currentCleanPhone,
            date: date,
            time: time,
            symptoms: symptoms,
            consent: true, // Required by security rules
            timestamp: serverTimestamp(),
            status: 'pending',
            medicalAdvice: ''
        });
        window.showToast("Appointment requested successfully!");
        setTimeout(async () => {
            // Reset the UI Form visually
            document.getElementById('internal-booking-form').reset();
            document.getElementById('int-time-slot-column').classList.add('hidden', 'opacity-0');
            
            // Re-fetch the data from Firebase silently in the background
            await fetchFamilyProfiles(currentCleanPhone); // Re-fetch all
            await window.loadTimeline(currentPatientName);
            
            // Switch back to the Timeline View seamlessly
            document.getElementById('book-appointment-view').classList.add('hidden');
            document.getElementById('clinical-feed-view').classList.remove('hidden');
            
            // Reset the button
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Submit Request";
        }, 1500);
    } catch (error) {
        console.error(error);
        window.showToast("Submission failed.", "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Submit Request";
    }
});

// --- INITIALIZATION ---
if (typeof flatpickr !== 'undefined') {
    const internalDatePicker = flatpickr("#int-book-date", {
        minDate: "today",
        disableMobile: true, // Prevent native mobile bypass
        disable: [(date) => date.getDay() === 0],
        dateFormat: "d/m/Y",
        onChange: (selectedDates, dateStr) => {
            document.getElementById('int-time-slot-column').classList.remove('hidden', 'opacity-0');
            document.getElementById('book-appointment-view-content').classList.replace('max-w-md', 'max-w-4xl');
            renderSlots(dateStr);
        }
    });

    // Fetch and disable fully blocked dates
    async function syncInternalBlockedDates() {
        try {
            const settingsDoc = await getDoc(doc(db, "settings", "calendar"));
            if (settingsDoc.exists()) {
                const blockedSlots = settingsDoc.data().blockedSlots || [];
                const dateMap = {};
                blockedSlots.forEach(slot => {
                    const [date, time] = slot.split('_');
                    if (!dateMap[date]) dateMap[date] = [];
                    dateMap[date].push(time);
                });

                const fullyBlockedDates = Object.keys(dateMap).filter(date => 
                    dateMap[date].includes('morning') && dateMap[date].includes('evening')
                );

                if (fullyBlockedDates.length > 0) {
                    internalDatePicker.set('disable', [
                        (date) => date.getDay() === 0,
                        ...fullyBlockedDates
                    ]);
                }
            }
        } catch (error) { console.error("Failed to sync internal calendar blocks:", error); }
    }
    syncInternalBlockedDates();
}