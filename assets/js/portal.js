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

window.velocityFollowUp = (caseId) => {
    if (typeof window.openInternalBooking === 'function') {
        window.openInternalBooking();
        const symptomsInput = document.getElementById('int-book-symptoms');
        if (symptomsInput) {
            symptomsInput.value = `Follow-up for previous Case: ${caseId}`;
        }
    }
};

const checkVelocityBanner = () => {
    const remedyCard = document.getElementById('current-remedy-card');
    const expiryStr = localStorage.getItem('lastRemedyExpiry');
    const caseId = localStorage.getItem('lastRemedyCaseId');
    
    if (remedyCard && expiryStr && caseId) {
        const diffHours = (parseInt(expiryStr) - new Date().getTime()) / 3600000;
        if (diffHours <= 48 && diffHours > -168) {
            remedyCard.classList.remove('hidden');
            remedyCard.classList.remove('border-teal-200');
            remedyCard.classList.add('border-amber-400', 'border-2');
            
            let banner = document.getElementById('velocity-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'velocity-banner';
                banner.className = 'mt-6 bg-amber-50 rounded-xl p-4 border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full';
                banner.innerHTML = `
                    <p class="text-amber-800 font-bold flex items-center gap-2"><span class="material-icons-round text-amber-500">timer</span> Medicine finishing in 48 hours. Schedule follow-up to maintain progress?</p>
                    <button onclick="window.velocityFollowUp('${caseId}')" class="shrink-0 bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                        <span class="material-icons-round text-[18px]">event_available</span> Quick Follow-up
                    </button>
                `;
                remedyCard.appendChild(banner);
            }
        }
    }
};

// Check immediately from localStorage for state persistence
document.addEventListener('DOMContentLoaded', checkVelocityBanner);
checkVelocityBanner();


// Toast System
window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-rose-500' : 'bg-slate-800';
    const icon = type === 'error' ? 'error' : 'check_circle';
    toast.className = `${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto z-[100]`;
    toast.innerHTML = `<span class="material-icons-round text-[20px]" aria-hidden="true">${icon}</span> <p class="text-sm font-medium">${message}</p>`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// Auth & Family Selector Logic
const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (!user.phoneNumber) {
            console.warn("Unauthorized Access: Patient Portal requires Phone Auth. Found:", user.email);
            window.showToast("Please login using your Mobile Number to access the portal.", "error");
            setTimeout(() => {
                signOut(auth).then(() => window.location.replace('index.html'));
            }, 2500);
            return;
        }

        currentCleanPhone = window.sanitizePhone(user.phoneNumber);
        document.getElementById('logout-btn')?.classList.remove('hidden');
        
        try {
            // SEQUENTIAL FETCH ENGINE
            const rawPhoneQuery = query(collection(db, "patients"), where("phone", "==", user.phoneNumber));
            let snapshot = await getDocs(rawPhoneQuery);
            
            if (snapshot.empty) {
                console.log("No exact match. Trying sanitized fallback...");
                const cleanPhoneQuery = query(collection(db, "patients"), where("phone", "==", currentCleanPhone));
                snapshot = await getDocs(cleanPhoneQuery);
            }
            
            if (snapshot.empty) {
                console.log("No existing profile found for:", currentCleanPhone);
                window.selectProfile(null, currentCleanPhone);
            } else if (snapshot.size === 1) {
                let pName = snapshot.docs[0].data().name;
                window.selectProfile(pName, currentCleanPhone);
            } else {
                const container = document.getElementById('family-profiles-container');
                let html = '';
                snapshot.forEach(doc => {
                    const p = doc.data();
                    html += `
                        <button onclick="window.selectProfile('${p.name}', '${currentCleanPhone}')" 
                            class="flex flex-col items-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-teal-500 hover:shadow-md transition-all w-32 md:w-36 group">
                            <div class="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-2xl font-bold mb-3 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                                ${p.name.charAt(0).toUpperCase()}
                            </div>
                            <span class="font-semibold text-slate-700 truncate w-full text-center leading-tight">${p.name}</span>
                        </button>`;
                });
                container.innerHTML = html;
                document.getElementById('profile-selector-view').classList.remove('hidden');
                document.getElementById('clinical-feed-view').classList.add('hidden');
            }
        } catch (err) {
            console.error("Firestore Registry Error - Details:", err);
            const container = document.getElementById('family-profiles-container');
            if (container) {
                container.innerHTML = `
                    <div class="col-span-full bg-rose-50 border border-rose-200 p-6 rounded-2xl text-rose-600">
                        <p class="font-bold">Could not load profiles.</p>
                        <p class="text-sm">Please refresh the page to try again.</p>
                    </div>`;
                document.getElementById('profile-selector-view').classList.remove('hidden');
            }
        }

        applyDynamicValidation('int-book-date', 'int-time-slots-container', 'int-book-time', 'int-time-fade');
        
        const bookingForm = document.getElementById('internal-booking-form');
        if (bookingForm) {
            const newBookingForm = bookingForm.cloneNode(true);
            bookingForm.parentNode.replaceChild(newBookingForm, bookingForm);
            
            newBookingForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('int-book-submit');
                btn.innerText = "Submitting..."; btn.disabled = true;
                
                try {
                    await addDoc(collection(db, "appointments"), {
                        name: currentPatientName || "Unknown",
                        phone: currentCleanPhone,
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
                    loadClinicalFeed();
                } catch(err) {
                    console.error("Internal booking failed:", err);
                    window.showToast("Failed to book appointment. Please check your connection.", "error");
                } finally {
                    btn.innerText = "Submit Request"; btn.disabled = false;
                }
            });
        }
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            const newLogoutBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            newLogoutBtn.addEventListener('click', () => {
                if (confirm("Are you sure you want to log out of the Patient Portal?")) {
                    newLogoutBtn.innerText = "Logging out...";
                    newLogoutBtn.disabled = true;
                    
                    currentCleanPhone = null;
                    currentPatientName = null;
                    currentCompositeId = null;
                    
                    signOut(auth).catch(err => {
                        console.error("Sign out error:", err);
                        window.location.reload();
                    });
                }
            });
        }

    } else {
        console.log("No active session found. Redirecting to login...");
        currentCleanPhone = null;
        currentPatientName = null;
        currentCompositeId = null;
        window.location.replace('index.html');
    }
});

// Selection Handler
window.selectProfile = (name, phone) => {
    currentPatientName = name;
    currentCompositeId = name ? `${phone}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}` : null;
    
    document.getElementById('profile-selector-view').classList.add('hidden');
    document.getElementById('clinical-feed-view').classList.remove('hidden');
    
    document.getElementById('switch-profile-btn')?.classList.remove('hidden');

    loadClinicalFeed();
};

document.getElementById('switch-profile-btn')?.addEventListener('click', () => {
    document.getElementById('clinical-feed-view')?.classList.add('hidden');
    
    currentCompositeId = null;
    currentPatientName = null;
    document.getElementById('profile-selector-view').classList.remove('hidden');
});

// --- Unified Clinical Timeline Engine ---
const loadClinicalFeed = async () => {
    const feed = document.getElementById('clinical-feed');
    const remedyCard = document.getElementById('current-remedy-card');
    const remedyDetails = document.getElementById('current-remedy-details');
    if (!feed) return;
    
    feed.innerHTML = '<p class="text-slate-500 animate-pulse relative -left-4 font-bold">Syncing your clinical timeline...</p>';
    remedyCard.classList.add('hidden');
    
    try {
        const user = auth.currentUser;
        let feedItems = [];

        // 1. Fetch Appointments
        let aptSnap;
        if (user && user.phoneNumber) {
            const rawPhoneQuery = query(collection(db, "appointments"), where("phone", "==", user.phoneNumber));
            aptSnap = await getDocs(rawPhoneQuery);
        }
        if (!aptSnap || aptSnap.empty) {
            if (currentCleanPhone) {
                const cleanPhoneQuery = query(collection(db, "appointments"), where("phone", "==", currentCleanPhone));
                aptSnap = await getDocs(cleanPhoneQuery);
            }
        }
        
        if (aptSnap && !aptSnap.empty) {
            aptSnap.forEach(doc => {
                const data = doc.data();
                if (currentPatientName) {
                    const dbName = (data.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const currName = currentPatientName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (dbName === currName) feedItems.push({ _type: 'appointment', id: doc.id, ...data });
                } else {
                    feedItems.push({ _type: 'appointment', id: doc.id, ...data });
                }
            });
        }

        // 2. Fetch Medical Records (Logs)
        if (currentCompositeId) {
            const logsQuery = query(collection(db, "patients", currentCompositeId, "logs"));
            const logsSnap = await getDocs(logsQuery).catch(err => {
                console.error("Logs fetch error:", err);
            });
            if (logsSnap && !logsSnap.empty) {
                logsSnap.forEach(doc => {
                    feedItems.push({ _type: 'log', id: doc.id, ...doc.data() });
                });
            }
        }

        // 3. Sort globally by timestamp descending
        feedItems.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
            return timeB - timeA;
        });

        if (feedItems.length === 0) {
            feed.innerHTML = `
                <div class="bg-white p-12 text-center rounded-3xl border border-dashed border-slate-200 flex flex-col items-center relative -left-4 shadow-sm">
                    <span aria-hidden="true" class="material-icons-round text-slate-200 text-6xl mb-4">timeline</span>
                    <h3 class="text-xl font-bold text-slate-800 mb-2">No Records Found</h3>
                    <p class="text-slate-500 max-w-sm mx-auto">When your session is completed, your unified timeline, prescriptions, and notes will appear here.</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        let activeRemedySet = false;

        feedItems.forEach(item => {
            // Case Numbering Generator
            const dateObj = item.timestamp ? item.timestamp.toDate() : new Date();
            const yyyymmdd = dateObj.toISOString().split('T')[0].replace(/-/g, '');
            const shortId = item.id.substring(item.id.length - 4).toUpperCase();
            const caseId = `HHC-${yyyymmdd}-${shortId}`;

            if (item._type === 'appointment') {
                const isAddressed = item.status === 'addressed';
                const statusColor = isAddressed ? 'text-teal-600 bg-teal-50 border-teal-100' : 'text-amber-600 bg-amber-50 border-amber-100';
                const statusText = isAddressed ? 'Confirmed / Addressed' : 'Pending Review';
                
                // Privacy Guard
                let privateNote = '';
                if (isAddressed) {
                    if (item.remedy || item.notes) {
                        privateNote = `
                        <div class="mt-4 p-4 bg-teal-50 border border-teal-100 rounded-xl text-teal-900 text-sm">
                            <p class="font-bold mb-1 flex items-center gap-1"><span class="material-icons-round text-[16px]">health_and_safety</span> Clinical Notes:</p>
                            <p class="whitespace-pre-wrap">${item.notes || 'Remedy prescribed: ' + (item.remedy || 'Check active dosage.')}</p>
                        </div>`;
                    }
                    
                    // Set Remedy Card if applicable
                    if (!activeRemedySet && (item.remedy || item.dosage || item.diet)) {
                        remedyDetails.innerHTML = `
                            <div><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Medicine</p><p class="font-bold text-teal-800 text-xl">${item.remedy || '--'}</p></div>
                            <div><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Dosage</p><p class="font-bold text-teal-800 text-xl">${item.dosage || '--'}</p></div>
                            <div><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Dietary Rules</p><p class="font-bold text-rose-500 text-base leading-snug">${item.diet || 'No specific restrictions'}</p></div>
                        `;
                        remedyCard.classList.remove('hidden');
                        activeRemedySet = true;

                        // Expiry Algorithm & Velocity UI Shift
                        let durationDays = item.durationDays || item.duration;
                        if (!durationDays && item.dosage) {
                            const docMatch = item.dosage.match(/for\s+(\d+)\s+(day|days|wk|wks|week|weeks|month|months)/i);
                            if (docMatch) {
                                let amt = parseInt(docMatch[1]);
                                let unit = docMatch[2].toLowerCase();
                                if (unit.startsWith('w')) amt *= 7;
                                else if (unit.startsWith('m')) amt *= 30;
                                durationDays = amt;
                            }
                        }
                        if (!durationDays) durationDays = 14; // Default standard treatment cycle

                        const expiryDate = new Date(dateObj.getTime() + durationDays * 86400000);
                        localStorage.setItem('lastRemedyExpiry', expiryDate.getTime().toString());
                        localStorage.setItem('lastRemedyCaseId', caseId);

                        const diffHours = (expiryDate - new Date()) / 3600000;
                        if (diffHours <= 48 && diffHours > -168) {
                            remedyCard.classList.remove('border-teal-200');
                            remedyCard.classList.add('border-amber-400', 'border-2');
                            
                            let banner = document.getElementById('velocity-banner');
                            if (!banner) {
                                banner = document.createElement('div');
                                banner.id = 'velocity-banner';
                                banner.className = 'mt-6 bg-amber-50 rounded-xl p-4 border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full';
                                banner.innerHTML = `
                                    <p class="text-amber-800 font-bold flex items-center gap-2"><span class="material-icons-round text-amber-500">timer</span> Medicine finishing in 48 hours. Schedule follow-up to maintain progress?</p>
                                    <button onclick="window.velocityFollowUp('${caseId}')" class="shrink-0 bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                                        <span class="material-icons-round text-[18px]">event_available</span> Quick Follow-up
                                    </button>
                                `;
                                remedyCard.appendChild(banner);
                            }
                        } else {
                            remedyCard.classList.remove('border-amber-400', 'border-2');
                            remedyCard.classList.add('border-teal-200');
                            const banner = document.getElementById('velocity-banner');
                            if (banner) banner.remove();
                        }
                    }
                } else {
                    privateNote = `<div class="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide bg-slate-50 p-3 rounded-xl border border-slate-100 w-max">
                        <span class="material-icons-round text-[14px]">lock</span> Awaiting Doctor's Review for clinical notes
                    </div>`;
                }

                html += `
                    <div class="relative group">
                        <!-- Timeline Dot -->
                        <div class="absolute -left-[41px] top-6 w-4 h-4 bg-white border-4 border-slate-200 rounded-full group-hover:border-teal-500 transition-colors z-10 box-content"></div>
                        
                        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-default relative overflow-hidden">
                            <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-3">
                                <div>
                                    <div class="flex items-center gap-3 mb-2 flex-wrap">
                                        <span class="text-xs font-extrabold text-slate-400 uppercase tracking-wider">${caseId}</span>
                                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColor}">${statusText}</span>
                                    </div>
                                    <h4 class="font-bold text-slate-800 text-lg mb-1">${item.date || dateObj.toDateString()} at ${item.time || 'N/A'}</h4>
                                    <p class="text-sm text-slate-600 font-medium">Reason: ${item.symptoms || 'N/A'}</p>
                                </div>
                                <button onclick="window.openInternalBooking()" class="shrink-0 text-teal-600 bg-teal-50 hover:bg-teal-600 hover:text-white border border-teal-100 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1 w-max h-max">
                                    <span class="material-icons-round text-[16px]">event_repeat</span> Follow-up
                                </button>
                            </div>
                            ${privateNote}
                        </div>
                    </div>
                `;
            } else if (item._type === 'log') {
                // Thread Response Log
                const imageHtml = item.attachment ? `<div class="mt-4"><p class="text-xs font-bold text-slate-500 uppercase mb-2">Attached Prescription</p><img src="${item.attachment}" class="rounded-xl border border-slate-200 w-full object-contain max-h-[400px] shadow-sm cursor-pointer hover:opacity-90 transition-opacity" onclick="window.open('${item.attachment}')" title="Click to view full image"></div>` : '';
                
                // Fallback active remedy
                if (!activeRemedySet && (item.remedy || item.dosage || item.diet)) {
                    remedyDetails.innerHTML = `
                        <div><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Medicine</p><p class="font-bold text-teal-800 text-xl">${item.remedy || '--'}</p></div>
                        <div><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Dosage</p><p class="font-bold text-teal-800 text-xl">${item.dosage || '--'}</p></div>
                        <div><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Dietary Rules</p><p class="font-bold text-rose-500 text-base leading-snug">${item.diet || 'No specific restrictions'}</p></div>
                    `;
                    remedyCard.classList.remove('hidden');
                    activeRemedySet = true;

                    // Expiry Algorithm & Velocity UI Shift (For Logs)
                    let durationDays = item.durationDays || item.duration;
                    if (!durationDays && item.dosage) {
                        const docMatch = item.dosage.match(/for\s+(\d+)\s+(day|days|wk|wks|week|weeks|month|months)/i);
                        if (docMatch) {
                            let amt = parseInt(docMatch[1]);
                            let unit = docMatch[2].toLowerCase();
                            if (unit.startsWith('w')) amt *= 7;
                            else if (unit.startsWith('m')) amt *= 30;
                            durationDays = amt;
                        }
                    }
                    if (!durationDays) durationDays = 14; 

                    const expiryDate = new Date(dateObj.getTime() + durationDays * 86400000);
                    localStorage.setItem('lastRemedyExpiry', expiryDate.getTime().toString());
                    localStorage.setItem('lastRemedyCaseId', caseId);

                    const diffHours = (expiryDate - new Date()) / 3600000;
                    if (diffHours <= 48 && diffHours > -168) {
                        remedyCard.classList.remove('border-teal-200');
                        remedyCard.classList.add('border-amber-400', 'border-2');
                        
                        let banner = document.getElementById('velocity-banner');
                        if (!banner) {
                            banner = document.createElement('div');
                            banner.id = 'velocity-banner';
                            banner.className = 'mt-6 bg-amber-50 rounded-xl p-4 border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full';
                            banner.innerHTML = `
                                <p class="text-amber-800 font-bold flex items-center gap-2"><span class="material-icons-round text-amber-500">timer</span> Medicine finishing in 48 hours. Schedule follow-up to maintain progress?</p>
                                <button onclick="window.velocityFollowUp('${caseId}')" class="shrink-0 bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                                    <span class="material-icons-round text-[18px]">event_available</span> Quick Follow-up
                                </button>
                            `;
                            remedyCard.appendChild(banner);
                        }
                    } else {
                        remedyCard.classList.remove('border-amber-400', 'border-2');
                        remedyCard.classList.add('border-teal-200');
                        const banner = document.getElementById('velocity-banner');
                        if (banner) banner.remove();
                    }
                }

                html += `
                    <div class="relative ml-8 group">
                        <!-- Thread connecting line -->
                        <div class="absolute -left-[30px] top-8 w-6 h-px bg-slate-300 group-hover:bg-teal-300 transition-colors"></div>
                        <!-- Thread Dot -->
                        <div class="absolute -left-[33px] top-[29px] w-1.5 h-1.5 bg-slate-400 rounded-full box-content border-[3px] border-slate-50 group-hover:bg-teal-400 transition-colors z-10"></div>
                        
                        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group-hover:border-teal-300 transition-colors">
                            <div class="absolute left-0 top-0 w-1.5 h-full bg-teal-400"></div>
                            <div class="flex items-center gap-2 mb-3">
                                <span class="material-icons-round text-teal-500 text-[18px]">speaker_notes</span>
                                <p class="text-[10px] font-bold text-teal-700 uppercase tracking-widest">${item.dateStr || dateObj.toDateString()} • ${item.author || 'Dr. K. Nikhil Joshua'}</p>
                                <span class="ml-auto text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">${caseId}</span>
                            </div>
                            <p class="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm font-medium">${item.text}</p>
                            ${imageHtml}
                        </div>
                    </div>
                `;
            }
        });

        feed.innerHTML = html;

    } catch (e) {
        console.error("Firestore error in loadClinicalFeed:", e);
        feed.innerHTML = '<div class="bg-rose-50 text-rose-600 p-6 rounded-xl border border-rose-100 text-center relative -left-4"><p class="font-bold">Failed to sync feed.</p><p class="text-sm opacity-80">Check your internet and try again.</p></div>';
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
const applyDynamicValidation = (dateInputId, timeContainerId, hiddenInputId, fadeId) => {
    const morningSlots = ["10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM"];
    const eveningSlots = ["05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM"];
    
    const dateInput = document.getElementById(dateInputId);
    const container = document.getElementById(timeContainerId);
    const hiddenInput = document.getElementById(hiddenInputId);
    const fade = document.getElementById(fadeId);
    let fp = null;
    let blockedSlots = []; 

    if (!dateInput || !container || !hiddenInput) return;

    const renderPills = (dateStr) => {
        const allSlots = [...morningSlots, ...eveningSlots];
        let html = '';
        allSlots.forEach(slot => {
            const isMorning = morningSlots.includes(slot);
            const isEvening = eveningSlots.includes(slot);
            let isBlocked = false;
            if (dateStr) {
                if (blockedSlots.includes(`${dateStr}|All`)) isBlocked = true;
                if (isMorning && blockedSlots.includes(`${dateStr}|Morning`)) isBlocked = true;
                if (isEvening && blockedSlots.includes(`${dateStr}|Evening`)) isBlocked = true;
                if (blockedSlots.includes(`${dateStr}|${slot}`)) isBlocked = true;
            }
            const disabledAttr = isBlocked ? 'disabled' : '';
            const disabledClass = isBlocked ? 'opacity-30 cursor-not-allowed border-slate-100 bg-slate-50 grayscale' : 'hover:border-teal-500 hover:bg-teal-50 border-slate-300 bg-white text-slate-700 cursor-pointer';
            const activeClass = hiddenInput.value === slot ? 'border-teal-600 bg-teal-600 text-white' : '';
            html += `<button type="button" ${disabledAttr} onclick="window.selectTimeSlot('${slot}', '${hiddenInputId}', '${timeContainerId}')" class="snap-start shrink-0 px-4 py-2 rounded-full border-2 font-bold text-[11px] transition-all ${disabledClass} ${activeClass}">${slot}</button>`;
        });
        container.innerHTML = html;
        container.onscroll = () => {
            if (container.scrollWidth - container.scrollLeft <= container.clientWidth + 20) { fade.style.opacity = '0'; } else { fade.style.opacity = '1'; }
        };
    };

    window.selectTimeSlot = (slot, inputId, contId) => {
        const input = document.getElementById(inputId);
        input.value = slot;
        document.querySelectorAll(`#${contId} button`).forEach(btn => {
            btn.classList.remove('border-teal-600', 'bg-teal-600', 'text-white');
            if (btn.innerText.trim() === slot) btn.classList.add('border-teal-600', 'bg-teal-600', 'text-white');
        });
    };

    renderPills();

    if (typeof flatpickr !== 'undefined') {
        fp = flatpickr(dateInput, {
            minDate: "today",
            disable: [ (date) => (date.getDay() === 0 || blockedSlots.includes(date.toISOString().split('T')[0] + '|All')) ],
            dateFormat: "Y-m-d",
            static: true,
            disableMobile: "true",
            onChange: (selectedDates, dateStr) => { hiddenInput.value = ""; renderPills(dateStr); }
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
        } catch (err) {
            console.error("Failed to fetch slots calendar data:", err); 
        }
    };
    fetchSlots();
};

// Accessibility Hotkeys
document.addEventListener('keydown', (e) => {
    // Escape to close internal booking
    if (e.key === 'Escape') {
        const intModal = document.getElementById('internal-booking-modal');
        if (intModal && !intModal.classList.contains('hidden')) {
            window.closeInternalBooking();
        }
        // Escape to close family selector
        if (currentCompositeId && !document.getElementById('profile-selector-view').classList.contains('hidden')) {
            window.selectProfile(currentPatientName, currentCleanPhone); 
        }
    }

    // Alt Modifiers
    if (e.altKey && auth.currentUser && currentCompositeId) {
        if (e.key.toLowerCase() === 'b') {
            e.preventDefault(); 
            if (typeof window.openInternalBooking === 'function') window.openInternalBooking();
        }
    }
});
