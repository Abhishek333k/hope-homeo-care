import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { auth, db } from './firebase-init.js';

let currentCleanPhone = '';
let currentPatientName = '';
let currentCompositeId = '';
let previousFocusElement = null;

// Standardized Toast System for Portal
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
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    currentCleanPhone = user.phoneNumber;
    document.getElementById('logout-btn')?.classList.remove('hidden');
    document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));
    
    await scanForProfiles();
});

async function scanForProfiles() {
    try {
        const q = query(collection(db, "appointments"), where("phone", "==", currentCleanPhone));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            renderEmptyState();
            return;
        }

        const uniqueNames = [...new Set(snapshot.docs.map(d => d.data().name))];
        
        if (uniqueNames.length > 1) {
            showProfileSelector(uniqueNames);
        } else {
            selectProfile(uniqueNames[0]);
        }
    } catch (e) {
        console.error("Profile Scan Error:", e);
        window.showToast("Failed to connect to clinical records.", "error");
    }
}

function renderEmptyState() {
    const feed = document.getElementById('clinical-feed');
    const view = document.getElementById('clinical-feed-view');
    if(view) view.classList.remove('hidden');
    if(feed) {
        feed.innerHTML = `
            <div class="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <p class="text-slate-500 font-medium">Welcome! No clinical records found for this number.</p>
                <p class="text-slate-400 text-sm mt-1">Book your first session to start your journey.</p>
            </div>
        `;
    }
    const nameEl = document.getElementById('profile-name');
    if(nameEl) nameEl.innerText = "New Patient";
}

function showProfileSelector(names) {
    const selector = document.getElementById('profile-selector-view');
    const feedView = document.getElementById('clinical-feed-view');
    const container = document.getElementById('family-profiles-container');
    
    if(!selector || !container) return;
    
    feedView?.classList.add('hidden');
    selector.classList.remove('hidden');
    
    let html = '';
    names.sort().forEach(name => {
        const initial = name.charAt(0).toUpperCase();
        html += `
            <button onclick="window.selectProfile('${name}')" class="group flex flex-col items-center gap-4 p-6 rounded-3xl hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100">
                <div class="w-20 h-20 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center text-3xl font-black group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    ${initial}
                </div>
                <span class="font-bold text-slate-700 text-lg">${name}</span>
            </button>
        `;
    });
    container.innerHTML = html;
}

window.selectProfile = async (name) => {
    currentPatientName = name;
    currentCompositeId = `${name}_${currentCleanPhone}`;
    
    document.getElementById('profile-selector-view')?.classList.add('hidden');
    document.getElementById('clinical-feed-view')?.classList.remove('hidden');
    
    // UI Feedback: Show Switch button if more than 1 linked profile
    const q = query(collection(db, "appointments"), where("phone", "==", currentCleanPhone));
    const snap = await getDocs(q);
    const uniqueNames = [...new Set(snap.docs.map(d => d.data().name))];
    if (uniqueNames.length > 1) {
        const switchBtn = document.getElementById('switch-profile-btn');
        if(switchBtn) {
            switchBtn.classList.remove('hidden');
            switchBtn.onclick = () => showProfileSelector(uniqueNames);
        }
    }

    renderPatientIdentity();
    loadClinicalFeed();
    loadRemedyData();
};

function renderPatientIdentity() {
    const nameEl = document.getElementById('profile-name');
    const avatar = document.getElementById('profile-avatar');
    const bookingNameHint = document.getElementById('booking-for-name');
    
    if(nameEl) nameEl.innerText = currentPatientName;
    if(avatar) avatar.innerText = currentPatientName.charAt(0).toUpperCase();
    if(bookingNameHint) bookingNameHint.innerText = currentPatientName;
}

async function loadClinicalFeed() {
    const feed = document.getElementById('clinical-feed');
    if(!feed) return;
    
    feed.innerHTML = '<div class="animate-pulse space-y-4"><div class="h-20 bg-slate-100 rounded-xl"></div><div class="h-20 bg-slate-100 rounded-xl"></div></div>';
    
    try {
        const q = query(collection(db, "appointments"), where("phone", "==", currentCleanPhone), where("name", "==", currentPatientName), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date;
            const status = data.status || 'pending';
            const statusColors = {
                'pending': 'bg-amber-50 text-amber-700 border-amber-100',
                'confirmed': 'bg-emerald-50 text-emerald-700 border-emerald-100',
                'cancelled': 'bg-slate-50 text-slate-500 border-slate-100'
            };

            html += `
                <div class="relative pl-0 md:pl-4">
                    <div class="absolute -left-[37px] md:-left-[45px] top-6 w-4 h-4 rounded-full bg-white border-4 border-slate-300 z-10"></div>
                    <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
                            <span class="text-xs font-black uppercase tracking-widest text-slate-400">${date}</span>
                            <span class="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusColors[status]}">${status}</span>
                        </div>
                        <h4 class="text-lg font-bold text-slate-800">Appointment Summary</h4>
                        <div class="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                            <div class="flex items-center gap-1.5">
                                <span class="material-icons-round text-lg text-blue-500">schedule</span>
                                <span>${data.time}</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="material-icons-round text-lg text-blue-500">psychology</span>
                                <span>Note: ${data.symptoms.substring(0, 50)}...</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        feed.innerHTML = html;
        
        // Update "Member Since"
        const sinceEl = document.getElementById('profile-member-since');
        if(sinceEl && !snapshot.empty) {
            const firstDate = snapshot.docs[snapshot.docs.length - 1].data().date;
            sinceEl.innerText = `Member Since ${firstDate}`;
        }

    } catch (e) {
        console.error("Feed Error:", e);
        feed.innerHTML = '<p class="text-rose-500">Error loading clinical timeline.</p>';
    }
}

async function loadRemedyData() {
    const card = document.getElementById('current-remedy-card');
    const container = document.getElementById('current-remedy-details');
    const pills = document.getElementById('profile-pills');
    
    try {
        const docSnap = await getDoc(doc(db, "patient_records", currentCompositeId));
        if (!docSnap.exists()) {
            card?.classList.add('hidden');
            if(pills) pills.innerHTML = '<span class="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200">New Patient</span>';
            return;
        }

        const data = docSnap.data();
        
        // Medicine Rendering
        if (data.medicines && data.medicines.length > 0) {
            card?.classList.remove('hidden');
            let medHtml = '';
            data.medicines.forEach(med => {
                medHtml += `
                    <div>
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">${med.frequency}</p>
                        <h4 class="text-lg font-black text-slate-800">${med.name}</h4>
                        <p class="text-sm text-slate-500 mt-1">${med.dosage}</p>
                    </div>
                `;
            });
            if(container) container.innerHTML = medHtml;
        } else {
            card?.classList.add('hidden');
        }

        // Prescription Pills Rendering (High-level tags)
        if(pills) {
            let pillHtml = '';
            if(data.condition) {
                pillHtml += `<span class="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wider">${data.condition}</span>`;
            }
            if(data.lastCheckup) {
                pillHtml += `<span class="px-3 py-1 bg-white text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200">Last Visit: ${data.lastCheckup}</span>`;
            }
            pills.innerHTML = pillHtml || '<span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-100">Active Patient</span>';
        }

    } catch (e) {
        console.error("Remedy Data Error:", e);
    }
}

// Modal Logic
window.openInternalBooking = () => {
    previousFocusElement = document.activeElement;
    const modal = document.getElementById('internal-booking-modal');
    if(modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('opacity-100');
            modal.querySelector('div')?.classList.remove('scale-95');
            document.getElementById('int-book-symptoms')?.focus();
        }, 10);
    }
};

window.closeInternalBooking = () => {
    const modal = document.getElementById('internal-booking-modal');
    if(modal) {
        modal.classList.remove('opacity-100');
        modal.querySelector('div')?.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            if(previousFocusElement) previousFocusElement.focus();
        }, 300);
    }
};

// Form & Time Logic Integration
const applyInternalValidation = (dateInputId, hiddenInputId) => {
    const dateInput = document.getElementById(dateInputId);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!dateInput || !hiddenInput) return;

    const ranges = [
        { id: 'morning', slots: ["10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"] },
        { id: 'afternoon', slots: ["12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM"] },
        { id: 'evening', slots: ["05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM"] }
    ];

    window.toggleAccordion = (id) => {
        ['morning', 'afternoon', 'evening'].forEach(s => {
            const content = document.getElementById(`content-${s}`);
            const chevron = document.getElementById(`chevron-${s}`);
            if (s === id) {
                const isOpen = content.classList.contains('max-h-96');
                content.classList.replace(isOpen ? 'max-h-96' : 'max-h-0', isOpen ? 'max-h-0' : 'max-h-96');
                chevron.classList.toggle('rotate-180', !isOpen);
            } else {
                content.classList.replace('max-h-96', 'max-h-0');
                chevron.classList.remove('rotate-180');
            }
        });
    };

    window.selectTimeSlot = (e, slot) => {
        if(e) e.preventDefault();
        hiddenInput.value = slot;
        document.querySelectorAll('.chip-time-int').forEach(c => {
            c.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
            if(c.innerText.trim() === slot) c.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
        });
    };

    const renderSlots = (dateStr) => {
        ranges.forEach(range => {
            const container = document.getElementById(`slots-${range.id}`);
            if(!container) return;
            let html = '';
            range.slots.forEach(slot => {
                html += `
                    <button type="button" onclick="window.selectTimeSlot(event, '${slot}')" class="chip-time-int h-10 w-full border border-slate-200 rounded-lg text-[10px] font-bold hover:border-blue-500 transition-all">
                        ${slot}
                    </button>
                `;
            });
            container.innerHTML = html;
        });
        window.toggleAccordion('morning');
    };

    if (typeof flatpickr !== 'undefined') {
        flatpickr(dateInput, {
            minDate: "today",
            disable: [(date) => (date.getDay() === 0)],
            dateFormat: "d/m/Y",
            onChange: (selectedDates, dateStr) => {
                document.getElementById('int-time-slot-column')?.classList.remove('hidden');
                setTimeout(() => document.getElementById('int-time-slot-column')?.classList.add('opacity-100'), 10);
                document.getElementById('internal-booking-modal-content')?.classList.replace('max-w-md', 'max-w-4xl');
                renderSlots(dateStr);
            }
        });
    }
};

applyInternalValidation('int-book-date', 'int-book-time');

document.getElementById('internal-booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('int-book-submit');
    const date = document.getElementById('int-book-date').value;
    const time = document.getElementById('int-book-time').value;
    const symptoms = document.getElementById('int-book-symptoms').value;

    if(!date || !time || !symptoms) {
        window.showToast("Please complete all booking fields.", "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    try {
        await addDoc(collection(db, "appointments"), {
            name: currentPatientName,
            phone: currentCleanPhone,
            date: date,
            time: time,
            symptoms: symptoms,
            timestamp: serverTimestamp(),
            status: 'pending'
        });
        window.showToast("Appointment requested!");
        setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
        console.error(error);
        window.showToast("Submission failed.", "error");
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit Request";
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeInternalBooking();
        if(!document.getElementById('profile-selector-view').classList.contains('hidden')) {
            // Cannot escape selector easily if forced, but logic is there
        }
    }
});
