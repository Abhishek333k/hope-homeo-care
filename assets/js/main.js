import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { auth, db } from './firebase-init.js';


// Custom Toast Notification System
window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-rose-500' : 'bg-slate-800';
    const icon = type === 'error' ? 'error' : 'check_circle';
    
    // Standardized z-index: Toasts are z-100
    toast.className = `${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto z-[100]`;
    toast.innerHTML = `<span class="material-icons-round text-[20px]" aria-hidden="true">${icon}</span> <p class="text-sm font-medium">${message}</p>`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    container.appendChild(toast);
    
    // Animate In
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    });
    
    // Animate Out & Remove
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// Symptom Appender & Auto-Resize Engine
window.appendSymptom = (text, targetId) => {
    const textarea = document.getElementById(targetId);
    if (!textarea) return;
    
    if (textarea.value.trim() === "") {
        textarea.value = text;
    } else {
        textarea.value += ", " + text;
    }
    
    // Trigger auto-resize after appending
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

const initAutoResize = () => {
    const textareas = document.querySelectorAll('#patient-symptoms, #int-book-symptoms');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            const newHeight = Math.min(textarea.scrollHeight, 120);
            textarea.style.height = newHeight + 'px';
            textarea.style.overflowY = textarea.scrollHeight > 120 ? 'auto' : 'hidden';
        });
    });
};



document.addEventListener('DOMContentLoaded', () => {
    initAutoResize();
    
    // Setup Phone Input Numeric Keystroke Masking
    const phoneInput = document.getElementById('patient-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 10);
        });
    }
    // Mobile Menu Logic
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            const isOpen = mobileMenu.classList.contains('max-h-[500px]');
            if (isOpen) {
                mobileMenu.classList.replace('max-h-[500px]', 'max-h-0');
                mobileMenu.classList.replace('opacity-100', 'opacity-0');
            } else {
                mobileMenu.classList.replace('max-h-0', 'max-h-[500px]');
                mobileMenu.classList.replace('opacity-0', 'opacity-100');
            }
        });

        // Close menu on link click
        const mobileLinks = mobileMenu.querySelectorAll('a, button');
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                const isOpen = mobileMenu.classList.contains('max-h-[500px]');
                if (isOpen) {
                    mobileMenu.classList.replace('max-h-[500px]', 'max-h-0');
                    mobileMenu.classList.replace('opacity-100', 'opacity-0');
                }
            });
        });
    }

    const applyDynamicValidation = (dateInputId, hiddenInputId) => {
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
                content.classList.replace('max-h-96', 'max-h-0');
                chevron.classList.remove('rotate-180');
            });

            // Skeletons
            const skeleton = `<div class="h-10 bg-slate-100 rounded-lg animate-pulse"></div>`.repeat(3);
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

                // 1. Prediction Engine: Find recommended slot
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
                                class="h-10 w-full font-bold text-[10px] transition-all duration-200 flex items-center justify-center chip-time relative ${chipClass}">
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
            
            // Isolate State Mutation
            const chips = document.querySelectorAll('.chip-time');
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
                    const modalContent = document.getElementById('booking-modal-content');
                    const timeColumn = document.getElementById('time-slot-column');
                    
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
            } catch (error) { 
                console.error("Firestore error in fetchSlots:", error);
            }
        };
        fetchSlots();
    };

    applyDynamicValidation('patient-date', 'patient-time');

    const modal = document.getElementById('booking-modal');
    if (!modal) return;

    // Get all links/buttons
    const triggerElements = document.querySelectorAll('a, button');
    const triggers = Array.from(triggerElements).filter(el => {
        const text = el.textContent.trim();
        return text === 'Book Appointment' || text === 'Book Consultation';
    });

    const closeBtn = document.getElementById('close-modal-btn');
    
    // Toggle Modal
    window.openBookingModal = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        modal.classList.remove('hidden');
    };

    window.closeBookingModal = () => {
        modal.classList.add('hidden');
        const modalContent = document.getElementById('booking-modal-content');
        if (modalContent) modalContent.classList.replace('max-w-4xl', 'max-w-md');
        const timeColumn = document.getElementById('time-slot-column');
        if (timeColumn) timeColumn.classList.add('hidden', 'opacity-0');
        const form = document.querySelector('#public-booking-form, form');
        if (form) form.reset();
    };

    triggers.forEach(btn => btn.addEventListener('click', window.openBookingModal));
    
    if (closeBtn) closeBtn.addEventListener('click', window.closeBookingModal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            window.closeBookingModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            window.closeBookingModal();
        }
    });

    const submitBtn = document.getElementById('booking-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const nameInput = document.getElementById('patient-name');
            const phoneInput = document.getElementById('patient-phone');
            const dateInput = document.getElementById('patient-date');
            const timeInput = document.getElementById('patient-time');
            const symptomsInput = document.getElementById('patient-symptoms');
            const consentInput = document.getElementById('patient-consent');

            if (!nameInput.value || !phoneInput.value || !dateInput.value || !timeInput.value || !symptomsInput.value || !consentInput.checked) {
                window.showToast("Please fill out all fields and accept the legal disclaimer.", "error");
                return;
            }

            if (!/^\d{10}$/.test(phoneInput.value)) {
                window.showToast("Please enter a valid 10-digit mobile number.", "error");
                return;
            }

            const originalText = submitBtn.innerText;

            // 1. Honeypot check
            if (document.getElementById('patient-fax').value) {
                console.log("Spam detected via honeypot.");
                submitBtn.innerText = "Request Sent!";
                setTimeout(() => window.closeBookingModal(), 1000);
                return;
            }

            // 2. Cooldown check
            const lastSubmitTime = localStorage.getItem('lastSubmitTime');
            if (lastSubmitTime && Date.now() - parseInt(lastSubmitTime) < 60000) {
                window.showToast("Please wait a minute before submitting another request.", "error");
                return;
            }

            submitBtn.innerText = "Sending Request...";
            submitBtn.disabled = true;

            try {
                const phoneVal = phoneInput.value.trim();
                const formattedPhone = "+91" + phoneVal;

                await addDoc(collection(db, "appointments"), {
                    name: nameInput.value,
                    phone: formattedPhone,
                    date: dateInput.value,
                    time: timeInput.value,
                    symptoms: symptomsInput.value,
                    consent: consentInput.checked,
                    timestamp: serverTimestamp(),
                    status: 'pending'
                }).catch(err => {
                    console.error("Failed to add appointment:", err);
                    throw err;
                });
                
                // Update cooldown timer on success
                localStorage.setItem('lastSubmitTime', Date.now());
                
                window.showToast("Appointment requested successfully!");
                submitBtn.innerText = "Request Sent!";
                setTimeout(() => {
                    nameInput.value = '';
                    phoneInput.value = '';
                    dateInput.value = '';
                    timeInput.value = '';
                    symptomsInput.value = '';
                    consentInput.checked = false;
                    if (typeof window.closeBookingModal === 'function') window.closeBookingModal();
                    
                    // Progressive disclosure reset
                    const modalContent = document.getElementById('booking-modal-content');
                    const timeColumn = document.getElementById('time-slot-column');
                    
                    if (modalContent) modalContent.classList.replace('max-w-4xl', 'max-w-md');
                    if (timeColumn) timeColumn.classList.add('hidden', 'opacity-0');

                    submitBtn.innerText = "Submit Request";
                    submitBtn.disabled = false;
                }, 2000);
            } catch (error) {
                console.error("Error adding document: ", error);
                window.showToast("Network error: Could not send request. Please check your connection.", "error");
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    const fetchHeroImage = async () => {
        const heroImg = document.getElementById('dynamic-hero-image');
        if (!heroImg) return;
        
        // Set a default fallback image first
        const fallbackSrc = "./assets/images/hero.jpeg"; 
        
        try {
            const docSnap = await getDoc(doc(db, "settings", "branding")).catch(err => {
                console.error("Hero branding fetch error:", err);
                throw err;
            });
            if (docSnap.exists() && docSnap.data().heroImageUrl) {
                heroImg.src = docSnap.data().heroImageUrl;
            } else {
                heroImg.src = fallbackSrc;
            }
        } catch (e) {
            console.error("Failed to load dynamic hero image, using fallback.", e);
            heroImg.src = fallbackSrc;
        }
    };
    fetchHeroImage();
});

const fetchBlogPosts = () => {
    const blogContainer = document.getElementById('blogger-feed-container');
    if (!blogContainer) return;

    // Define the global callback that Blogger will execute
    window.handleBloggerFeed = (data) => {
        const posts = data.feed.entry || [];
        
        if (posts.length === 0) {
            blogContainer.innerHTML = '<p class="col-span-full text-center text-slate-500">No articles published yet. Check back soon!</p>';
            return;
        }

        let html = '';
        posts.forEach(post => {
            const title = post.title ? post.title.$t : 'Untitled Update';
            
            let link = '#';
            if (post.link) {
                const altLink = post.link.find(l => l.rel === 'alternate');
                if (altLink) link = altLink.href;
            }
            
            let rawSnippet = '';
            if (post.summary) rawSnippet = post.summary.$t;
            else if (post.content) rawSnippet = post.content.$t;
            
            const cleanSnippet = rawSnippet.replace(/(<([^>]+)>)/gi, "").substring(0, 120) + '...';
            
            const dateStr = post.published ? post.published.$t : new Date().toISOString();
            const date = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            html += `
                <a href="${link}" target="_blank" class="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col group">
                    <div class="mb-4">
                        <span class="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full">${date}</span>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-3 leading-snug group-hover:text-blue-600 transition-colors">${title}</h3>
                    <p class="text-slate-500 text-sm mb-6 flex-1">${cleanSnippet}</p>
                    <div class="pt-4 border-t border-slate-100 mt-auto flex items-center text-blue-600 font-bold text-sm">
                        Read Article <span class="material-icons-round text-lg ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                </a>
            `;
        });
        
        blogContainer.innerHTML = html;
    };

    // Injecting JSONP script to fetch the feed
    const script = document.createElement('script');
    script.src = 'https://hopehomeocare.blogspot.com/feeds/posts/default?alt=json-in-script&callback=handleBloggerFeed&max-results=3';
    document.head.appendChild(script);
};

async function loadGoogleReviews() {
    const track = document.getElementById('testimonials-grid');
    const modalList = document.getElementById('modal-reviews-list');
    
    try {
        const response = await fetch('./assets/data/reviews.json');
        if (!response.ok) throw new Error("JSON file not found.");
        const reviews = await response.json();

        if (!reviews || reviews.length === 0) {
            if(track) track.innerHTML = '<p class="text-slate-500">Awaiting review sync...</p>';
            return;
        }

        const renderStars = (rating) => {
            let stars = '';
            for(let i=0; i<5; i++) {
                stars += `<span class="material-icons-round text-[18px] ${i < rating ? 'text-amber-400' : 'text-slate-600'}">star</span>`;
            }
            return `<div class="flex mb-3">${stars}</div>`;
        };

        const createReviewCard = (review) => {
            // Teal background for auto-generated avatars to match logo
            const photo = review.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.author_name)}&background=0f766e&color=fff`;

            return `
                <div class="w-80 md:w-96 p-6 rounded-2xl bg-white border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] shrink-0 flex flex-col h-full transform transition-transform hover:-translate-y-1 hover:shadow-xl hover:border-blue-200">
                    ${renderStars(review.rating || 5)}
                    <p class="text-slate-600 text-sm leading-relaxed mb-6 flex-1">"${review.text}"</p>
                    <div class="flex items-center gap-3 mt-auto pt-4 border-t border-slate-100">
                        <img src="${photo}" alt="Patient" class="w-10 h-10 rounded-full object-cover shrink-0">
                        <div>
                            <p class="font-bold text-sm text-slate-900 flex items-center gap-1">
                                ${review.author_name} 
                                <span class="material-icons-round text-[14px] text-blue-600" title="Google Review">verified</span>
                            </p>
                            <p class="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">${review.relative_time_description}</p>
                        </div>
                    </div>
                </div>
            `;
        };

        let cardsHtml = '';
        reviews.forEach(r => {
            cardsHtml += createReviewCard(r); 
        });

        // Inject into Marquee (Duplicate for seamless loop)
        if (track) {
            track.innerHTML = cardsHtml + cardsHtml;
        }
        
        // Inject into Modal
        if (modalList) {
            modalList.innerHTML = cardsHtml;
        }

    } catch (error) {
        console.error("Google Reviews Sync Failed:", error);
        if(track) track.innerHTML = '<p class="text-rose-500">Currently syncing live reviews...</p>';
    }
}

// Modal Controllers
window.openReviewsModal = () => {
    const modal = document.getElementById('reviews-modal');
    if(modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
        setTimeout(() => modal.classList.remove('opacity-0'), 10);
    }
};
window.closeReviewsModal = () => {
    const modal = document.getElementById('reviews-modal');
    if(modal) {
        modal.classList.add('opacity-0');
        document.body.style.overflow = ''; 
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

async function loadActiveCampaign() {
    // UX Check: Don't show again if they already closed it this session
    if (sessionStorage.getItem('campaignSeen')) return;

    try {
        // Fetch campaigns marked as active to prevent scanning old data
        const q = query(collection(db, "campaigns"), where("status", "==", "active"));
        const snapshot = await getDocs(q).catch(err => {
            console.error("Campaign query failed:", err);
            throw err;
        });
        
        if (snapshot.empty) return;

        const now = new Date();
        let activeCampaign = null;

        // Check which campaign falls exactly within the current time window
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.startTime && data.endTime) {
                const start = data.startTime.toDate();
                const end = data.endTime.toDate();
                
                if (now >= start && now <= end) {
                    activeCampaign = data;
                }
            }
        });

        // Render the campaign if a valid one exists
        if (activeCampaign && activeCampaign.imageUrl) {
            const modal = document.getElementById('campaign-modal');
            const img = document.getElementById('campaign-image');
            const box = document.getElementById('campaign-box');
            const closeBtn = document.getElementById('close-campaign-btn');

            img.src = activeCampaign.imageUrl;
            
            // Smooth fade-in animation
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                box.classList.remove('scale-95');
            }, 50);

            // Close logic
            const closeModal = () => {
                modal.classList.add('opacity-0');
                box.classList.add('scale-95');
                setTimeout(() => modal.classList.add('hidden'), 300);
                sessionStorage.setItem('campaignSeen', 'true'); // Lock it for this session
            };

            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
    } catch (error) {
        console.error("Failed to load campaign:", error);
    }
}

// Call functions on load
fetchBlogPosts();
loadGoogleReviews();
loadActiveCampaign();

let globalGalleryData = [];
let currentGalleryIndex = 0;

const loadPublicGallery = async () => {
    const previewGrid = document.getElementById('gallery-preview-grid');
    if (!previewGrid) return;

    try {
        const q = query(collection(db, "gallery"), orderBy("orderIndex", "asc"));
        const snapshot = await getDocs(q).catch(err => {
            console.error("Gallery query failed:", err);
            throw err;
        });
        
        if (snapshot.empty) {
            previewGrid.innerHTML = '<div class="col-span-full text-center text-slate-500 py-12">Gallery updating soon...</div>';
            return;
        }

        globalGalleryData = [];
        snapshot.forEach(doc => globalGalleryData.push(doc.data().imageUrl));

        // 1. Populate Compact Preview (Max 3 images)
        let previewHtml = '';
        for(let i=0; i < Math.min(3, globalGalleryData.length); i++) {
            const hideClass = i > 0 ? 'hidden md:block' : '';
            previewHtml += `
                <div onclick="window.openFullGallery(${i})" class="${hideClass} rounded-2xl overflow-hidden cursor-pointer group relative shadow-sm">
                    <img src="${globalGalleryData[i]}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center">
                        <span class="material-icons-round text-white text-4xl opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">zoom_out_map</span>
                    </div>
                </div>
            `;
        }
        previewGrid.innerHTML = previewHtml;

        // 2. Populate Thumbnails in Modal
        const thumbContainer = document.getElementById('gallery-thumbnails');
        if (thumbContainer) {
            let thumbHtml = '';
            globalGalleryData.forEach((url, idx) => {
                thumbHtml += `
                    <img onclick="window.setGalleryImage(${idx})" id="thumb-${idx}" src="${url}" 
                         class="h-full aspect-video object-cover rounded-lg cursor-pointer opacity-50 hover:opacity-100 transition-all border-2 border-transparent snap-center">
                `;
            });
            thumbContainer.innerHTML = thumbHtml;
        }

    } catch (error) {
        console.error("Gallery fetch error:", error);
        previewGrid.innerHTML = '<div class="col-span-full text-center text-rose-500 py-12">Failed to load gallery.</div>';
    }
};

// Slider Logic
window.openFullGallery = (startIndex = 0) => {
    if (globalGalleryData.length === 0) return;
    const modal = document.getElementById('advanced-gallery-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    window.setGalleryImage(startIndex);
};

window.closeFullGallery = () => {
    const modal = document.getElementById('advanced-gallery-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.setGalleryImage = (index) => {
    if (index < 0) index = globalGalleryData.length - 1;
    if (index >= globalGalleryData.length) index = 0;
    currentGalleryIndex = index;
    
    const mainImg = document.getElementById('gallery-main-view');
    if (!mainImg) return;
    mainImg.style.opacity = 0; // Fade out
    setTimeout(() => {
        mainImg.src = globalGalleryData[currentGalleryIndex];
        mainImg.style.opacity = 1; // Fade in
    }, 150);

    // Highlight active thumbnail
    globalGalleryData.forEach((_, idx) => {
        const thumb = document.getElementById(`thumb-${idx}`);
        if (thumb) {
            if (idx === currentGalleryIndex) {
                thumb.classList.remove('opacity-50', 'border-transparent');
                thumb.classList.add('opacity-100', 'border-blue-500');
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                thumb.classList.add('opacity-50', 'border-transparent');
                thumb.classList.remove('opacity-100', 'border-blue-500');
            }
        }
    });
};

window.nextGalleryImage = () => window.setGalleryImage(currentGalleryIndex + 1);
window.prevGalleryImage = () => window.setGalleryImage(currentGalleryIndex - 1);

// Add Keyboard controls for the Slider
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('advanced-gallery-modal');
    if (modal && !modal.classList.contains('hidden')) {
        if (e.key === 'ArrowRight') window.nextGalleryImage();
        if (e.key === 'ArrowLeft') window.prevGalleryImage();
        if (e.key === 'Escape') window.closeFullGallery();
    }
});

loadPublicGallery();

// --- Patient Portal Login Engine ---
const loginModal = document.getElementById('login-modal');
const openPortalBtns = document.querySelectorAll('#nav-portal-btn, #mobile-portal-btn');
const closeLoginBtn = document.getElementById('close-login-btn');

let isUserLoggedIn = false;
// Memory Management: Assign listener to unsubscription variable
const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    isUserLoggedIn = !!user;
    // Change button text if logged in to provide UX feedback
    openPortalBtns.forEach(btn => {
        if (isUserLoggedIn && btn.tagName !== 'A') {
            btn.innerHTML = `<span class="material-icons-round text-[18px]" aria-hidden="true">account_circle</span> Go to Portal`;
        }
    });
});

if (loginModal && openPortalBtns.length > 0) {
    const openLogin = () => {
        loginModal.classList.remove('hidden');
        setTimeout(() => {
            loginModal.classList.remove('opacity-0');
            loginModal.querySelector('div').classList.remove('scale-95');
        }, 10);

        // Memory Management: Ensure RecaptchaVerifier is only initialized ONCE
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible'
            });
        }
    };

    const closeLogin = () => {
        loginModal.classList.add('opacity-0');
        loginModal.querySelector('div').classList.add('scale-95');
        setTimeout(() => loginModal.classList.add('hidden'), 300);
    };

    openPortalBtns.forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isUserLoggedIn) {
            window.location.href = "patient-portal.html";
        } else {
            openLogin();
        }
    }));
    closeLoginBtn?.addEventListener('click', closeLogin);

    // Global Escape Handler for Login Modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const loginModal = document.getElementById('login-modal');
            if (loginModal && !loginModal.classList.contains('hidden')) {
                closeLogin();
            }
        }
    });

    // OTP Flow
    const sendOtpBtn = document.getElementById('send-otp-btn');
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    const phoneInput = document.getElementById('login-phone');
    const otpInput = document.getElementById('login-otp');
    const backToPhoneBtn = document.getElementById('login-back-btn');
    let confirmationResult = null;

    backToPhoneBtn?.addEventListener('click', () => {
        document.getElementById('login-otp-step').classList.add('hidden');
        document.getElementById('login-phone-step').classList.remove('hidden');
        otpInput.value = ''; // Clear OTP field
    });

    sendOtpBtn?.addEventListener('click', async () => {
        const phone = phoneInput.value.trim();
        if (!/^\d{10}$/.test(phone)) return window.showToast("Enter a valid 10-digit number", "error");

        sendOtpBtn.innerText = "Sending...";
        sendOtpBtn.disabled = true;

        try {
            const formattedPhone = "+91" + phone;
            confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier).catch(err => {
                console.error("Sign in failed:", err);
                throw err;
            });
            document.getElementById('login-phone-step').classList.add('hidden');
            document.getElementById('login-otp-step').classList.remove('hidden');
            window.showToast("OTP sent to your phone");
        } catch (error) {
            console.error(error);
            window.showToast("Rate limit exceeded or invalid number", "error");
            sendOtpBtn.innerText = "Send OTP";
            sendOtpBtn.disabled = false;
        }
    });

    verifyOtpBtn?.addEventListener('click', async () => {
        const otp = otpInput.value.trim();
        if (otp.length !== 6) return window.showToast("Enter 6-digit OTP", "error");

        verifyOtpBtn.innerText = "Verifying...";
        verifyOtpBtn.disabled = true;

        try {
            await confirmationResult.confirm(otp).catch(err => {
                console.error("OTP confirmation failed:", err);
                throw err;
            });
            window.showToast("Login successful!");
            window.location.href = "patient-portal.html";
        } catch (error) {
            console.error(error);
            window.showToast("Invalid OTP. Try again.", "error");
            verifyOtpBtn.innerText = "Verify & Login";
            verifyOtpBtn.disabled = false;
        }
    });
}
