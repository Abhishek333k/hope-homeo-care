import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { auth, db } from './firebase-init.js';

let currentCleanPhone = '';
let currentPatientName = '';
let currentCompositeId = '';

// Accessibility Focus Tracker
let previousFocusElement = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    
    // Auth Check: Phone number must exist
    if (!user.phoneNumber) {
        console.error("No phone number found for user.");
        signOut(auth);
        window.location.href = "index.html";
        return;
    }

    currentCleanPhone = user.phoneNumber;
    // Patient Portal Logic
    await initializePortal(user);
});

async function initializePortal(user) {
    const welcomeName = document.getElementById('welcome-name');
    const appointmentsList = document.getElementById('appointments-list');
    
    try {
        // Querying based on phone number
        const q = query(collection(db, "appointments"), where("phone", "==", user.phoneNumber), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            welcomeName.innerText = "New Patient";
            appointmentsList.innerHTML = `
                <div class="col-span-full text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <p class="text-slate-500 font-medium">No appointments found for ${user.phoneNumber}</p>
                    <button onclick="window.openInternalBooking()" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition-all">Book First Appointment</button>
                </div>
            `;
            return;
        }

        const latestDoc = snapshot.docs[0].data();
        currentPatientName = latestDoc.name;
        currentCompositeId = `${currentPatientName}_${currentCleanPhone}`;
        welcomeName.innerText = currentPatientName;

        // Render Appointments
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date;
            const time = data.time;
            const status = data.status || 'pending';
            
            const statusColors = {
                'pending': 'bg-amber-50 text-amber-700 border-amber-100',
                'confirmed': 'bg-emerald-50 text-emerald-700 border-emerald-100',
                'cancelled': 'bg-slate-50 text-slate-500 border-slate-100'
            };

            html += `
                <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-4">
                        <div class="bg-blue-50 p-3 rounded-2xl">
                            <span class="material-icons-round text-blue-600">calendar_today</span>
                        </div>
                        <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[status]}">${status}</span>
                    </div>
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Appointment Date</p>
                    <h3 class="text-xl font-bold text-slate-800 mb-4">${date} at ${time}</h3>
                    <div class="flex items-center gap-2 text-slate-500 text-sm">
                        <span class="material-icons-round text-sm">person</span>
                        <span>Patient: ${data.name}</span>
                    </div>
                </div>
            `;
        });
        appointmentsList.innerHTML = html;

        // Load Medicine & Prescription Engine
        loadMedicalRecords(currentCompositeId);

    } catch (error) {
        console.error("Portal Init Error:", error);
        window.showToast("Failed to load portal data. Check connection.", "error");
    }
}

async function loadMedicalRecords(compositeId) {
    const rxContainer = document.getElementById('prescription-container');
    const medicineGrid = document.getElementById('medicine-grid');
    
    try {
        const docRef = doc(db, "patient_records", compositeId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            rxContainer.innerHTML = '<p class="text-slate-400 italic">No medical records uploaded yet.</p>';
            medicineGrid.innerHTML = '<p class="text-slate-400 italic">Medication list will appear here after your first consultation.</p>';
            return;
        }

        const data = docSnap.data();

        // Render Prescription Notes
        if (data.prescriptions && data.prescriptions.length > 0) {
            const latestRx = data.prescriptions[data.prescriptions.length - 1];
            rxContainer.innerHTML = `
                <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p class="text-slate-700 whitespace-pre-line leading-relaxed">${latestRx.notes}</p>
                    <p class="mt-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest">Last Updated: ${latestRx.date}</p>
                </div>
            `;
        } else {
            rxContainer.innerHTML = '<p class="text-slate-400 italic">No prescription notes found.</p>';
        }

        // Render Medicine Grid
        if (data.medicines && data.medicines.length > 0) {
            let medHtml = '';
            data.medicines.forEach(med => {
                medHtml += `
                    <div class="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-200 transition-colors">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                            <h4 class="font-bold text-slate-800">${med.name}</h4>
                        </div>
                        <p class="text-xs text-slate-500 leading-relaxed">${med.dosage}</p>
                        <p class="text-[10px] font-bold text-blue-600 mt-2 uppercase tracking-tighter">${med.frequency}</p>
                    </div>
                `;
            });
            medicineGrid.innerHTML = medHtml;
        } else {
            medicineGrid.innerHTML = '<p class="text-slate-400 italic">No active medications.</p>';
        }

    } catch (error) {
        console.error("Medical Record Error:", error);
    }
}

// Internal Booking Logic
const applyInternalValidation = (dateInputId, hiddenInputId) => {
    const morningRange = ["10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"];
    const afternoonRange = ["12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM"];
    const eveningRange = ["05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM"];
    
    const dateInput = document.getElementById(dateInputId);
    const hiddenInput = document.getElementById(hiddenInputId);
    let fp = null;
    let blockedSlots = [];

    if (!dateInput || !hiddenInput) return;

    window.toggleAccordion = (id) => {
        const sections = ['morning', 'afternoon', 'evening'];
        sections.forEach(s => {
            const content = document.getElementById(`content-${s}`);
            const chevron = document.getElementById(`chevron-${s}`);
            if (!content || !chevron) return;

            if (s === id) {
                const isOpen = content.classList.contains('max-h-96');
                if (isOpen) {
                    content.classList.replace('max-h-96', 'max-h-0');
                    chevron.classList.remove('rotate-180');
                } else {
                    content.classList.replace('max-h-0', 'max-h-96');
                    chevron.classList.add('rotate-180');
                }
            } else {
                content.classList.replace('max-h-96', 'max-h-0');
                chevron.classList.remove('rotate-180');
            }
        });
    };

    const parseTime = (timeStr) => {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        return { hours: parseInt(hours), minutes: parseInt(minutes) };
    };

    const renderPills = (dateStr) => {
        const mCont = document.getElementById('slots-morning');
        const aCont = document.getElementById('slots-afternoon');
        const eCont = document.getElementById('slots-evening');
        if (!mCont || !aCont || !eCont) return;

        // Reset Accordion State
        ['morning', 'afternoon', 'evening'].forEach(s => {
            const content = document.getElementById(`content-${s}`);
            const chevron = document.getElementById(`chevron-${s}`);
            if(content) content.classList.replace('max-h-96', 'max-h-0');
            if(chevron) chevron.classList.remove('rotate-180');
        });

        const skeleton = `<div class="h-10 bg-slate-50 rounded-lg animate-pulse"></div>`.repeat(3);
        mCont.innerHTML = skeleton; aCont.innerHTML = skeleton; eCont.innerHTML = skeleton;

        setTimeout(() => {
            const ranges = [
                { cont: mCont, slots: morningRange, type: 'morning' },
                { cont: aCont, slots: afternoonRange, type: 'afternoon' },
                { cont: eCont, slots: eveningRange, type: 'evening' }
            ];

            let firstAvailableId = null;
            let recommendedSlot = null;
            const now = new Date();
            const parts = dateStr ? dateStr.split('/') : [];
            const selectedDate = dateStr ? new Date(parts[2], parts[1] - 1, parts[0]) : null;
            const isSelectedToday = selectedDate ? selectedDate.toDateString() === now.toDateString() : false;

            for (const range of ranges) {
                for (const slot of range.slots) {
                    let isBlocked = false;
                    if (dateStr) {
                        if (blockedSlots.includes(`${dateStr}|All`)) isBlocked = true;
                        if (range.type === 'morning' && blockedSlots.includes(`${dateStr}|Morning`)) isBlocked = true;
                        if (range.type === 'evening' && blockedSlots.includes(`${dateStr}|Evening`)) isBlocked = true;
                        if (blockedSlots.includes(`${dateStr}|${slot}`)) isBlocked = true;
                    }
                    if (!isBlocked) {
                        if (isSelectedToday) {
                            const st = parseTime(slot);
                            const sd = new Date(now);
                            sd.setHours(st.hours, st.minutes, 0, 0);
                            if ((sd - now) / (1000 * 60) >= 30) {
                                recommendedSlot = slot;
                                break;
                            }
                        } else {
                            recommendedSlot = slot;
                            break;
                        }
                    }
                }
                if (recommendedSlot) break;
            }

            ranges.forEach(range => {
                let html = '';
                range.slots.forEach(slot => {
                    let isBlocked = false;
                    if (dateStr) {
                        if (blockedSlots.includes(`${dateStr}|All`)) isBlocked = true;
                        if (range.type === 'morning' && blockedSlots.includes(`${dateStr}|Morning`)) isBlocked = true;
                        if (range.type === 'evening' && blockedSlots.includes(`${dateStr}|Evening`)) isBlocked = true;
                        if (blockedSlots.includes(`${dateStr}|${slot}`)) isBlocked = true;
                    }

                    if (isSelectedToday) {
                        const st = parseTime(slot);
                        const sd = new Date(now);
                        sd.setHours(st.hours, st.minutes, 0, 0);
                        if ((sd - now) < 0) isBlocked = true;
                    }

                    if (!isBlocked && !firstAvailableId) firstAvailableId = range.type;
                    const active = hiddenInput.value === slot;
                    const isRecommended = slot === recommendedSlot && !active;
                    const chipClass = isBlocked 
                        ? 'bg-slate-50 text-slate-400 line-through cursor-not-allowed border-transparent opacity-60' 
                        : (active 
                            ? 'bg-blue-600 text-white shadow-md border-blue-600 ring-2 ring-blue-200 z-10' 
                            : (isRecommended 
                                ? 'bg-white text-slate-700 border-amber-400 shadow-sm' 
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-500 rounded-lg'));

                    const badge = isRecommended ? `<span class="absolute -top-2 -right-2 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse z-20">NEXT</span>` : '';

                    html += `
                        <button type="button" 
                            ${isBlocked ? 'disabled' : ''}
                            onclick="window.selectTimeSlot(event, '${slot}', '${hiddenInputId}', '${dateStr}')" 
                            class="h-10 w-full font-bold text-[10px] transition-all duration-200 flex items-center justify-center chip-time-int relative ${chipClass}">
                            ${badge}
                            ${slot}
                        </button>
                    `;
                });
                range.cont.innerHTML = html;
            });
            if (firstAvailableId) window.toggleAccordion(firstAvailableId);
            else window.toggleAccordion('morning');
        }, 400);
    };

    window.selectTimeSlot = (event, slot, inputId, dateStr) => {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const input = document.getElementById(inputId);
        input.value = slot;
        
        const chips = document.querySelectorAll('.chip-time-int');
        chips.forEach(chip => {
            chip.classList.remove('bg-blue-600', 'text-white', 'shadow-md', 'border-blue-600', 'ring-2', 'ring-blue-200', 'z-10');
            if (!chip.disabled) {
                chip.classList.add('bg-white', 'text-slate-700', 'border-slate-200', 'hover:border-blue-500');
            }
        });

        if (event && event.currentTarget) {
            const currentChip = event.currentTarget;
            currentChip.classList.remove('bg-white', 'text-slate-700', 'border-slate-200', 'hover:border-blue-500', 'border-amber-400');
            currentChip.classList.add('bg-blue-600', 'text-white', 'shadow-md', 'border-blue-600', 'ring-2', 'ring-blue-200', 'z-10');
            const badge = currentChip.querySelector('span');
            if (badge) badge.remove();
        }
    };

    renderPills();

    if (typeof flatpickr !== 'undefined') {
        fp = flatpickr(dateInput, {
            minDate: "today",
            disable: [ (date) => (date.getDay() === 0) ],
            dateFormat: "d/m/Y",
            static: true,
            disableMobile: "true",
            onChange: (selectedDates, dateStr) => { 
                const modalContent = document.getElementById('internal-booking-modal-content');
                const timeColumn = document.getElementById('int-time-slot-column');
                if (modalContent) modalContent.classList.replace('max-w-md', 'max-w-4xl');
                if (timeColumn) {
                    timeColumn.classList.remove('hidden');
                    setTimeout(() => timeColumn.classList.remove('opacity-0'), 100);
                    timeColumn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                hiddenInput.value = ""; 
                renderPills(dateStr); 
            }
        });
    }

    const fetchSlots = async () => {
        try {
            const docSnap = await getDoc(doc(db, "settings", "calendar"));
            if (docSnap.exists() && docSnap.data().blockedSlots) {
                blockedSlots = docSnap.data().blockedSlots;
                if (fp) fp.redraw();
                renderPills(dateInput.value);
            }
        } catch (err) { console.error("Failed to fetch slots calendar data:", err); }
    };
    fetchSlots();
};

window.openInternalBooking = () => {
    previousFocusElement = document.activeElement;
    document.getElementById('internal-booking-modal')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('int-book-symptoms')?.focus(), 150);
};

window.closeInternalBooking = () => {
    document.getElementById('internal-booking-modal')?.classList.add('hidden');
    const modalContent = document.getElementById('internal-booking-modal-content');
    if (modalContent) modalContent.classList.replace('max-w-4xl', 'max-w-md');
    const timeColumn = document.getElementById('int-time-slot-column');
    if (timeColumn) timeColumn.classList.add('hidden', 'opacity-0');
    
    if (previousFocusElement) {
        previousFocusElement.focus();
        previousFocusElement = null;
    }
};

applyInternalValidation('int-book-date', 'int-book-time');

const intSubmitBtn = document.getElementById('int-book-submit');
if (intSubmitBtn) {
    intSubmitBtn.addEventListener('click', async () => {
        const date = document.getElementById('int-book-date').value;
        const time = document.getElementById('int-book-time').value;
        const symptoms = document.getElementById('int-book-symptoms').value;

        if (!date || !time || !symptoms) {
            window.showToast("Please select date, time, and describe symptoms.", "error");
            return;
        }

        intSubmitBtn.disabled = true;
        intSubmitBtn.innerText = "Booking...";

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
            window.showToast("Appointment requested successfully!");
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            window.showToast("Failed to book appointment. Please check your connection.", "error");
            intSubmitBtn.disabled = false;
            intSubmitBtn.innerText = "Confirm Appointment";
        }
    });
}

// Global Modal Observers
const intModal = document.getElementById('internal-booking-modal');
if (intModal) {
    intModal.addEventListener('click', (e) => {
        if (e.target === intModal) window.closeInternalBooking();
    });
}

// Accessibility Hotkeys
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const intModal = document.getElementById('internal-booking-modal');
        if (intModal && !intModal.classList.contains('hidden')) window.closeInternalBooking();
        
        if (currentCompositeId && !document.getElementById('profile-selector-view').classList.contains('hidden')) {
            window.selectProfile(currentPatientName, currentCleanPhone); 
        }
    }
    if (e.altKey && auth.currentUser && currentCompositeId) {
        if (e.key.toLowerCase() === 'b') {
            e.preventDefault(); 
            window.openInternalBooking();
        }
    }
});

window.logout = () => signOut(auth).then(() => window.location.href = "index.html");
