import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";


// Custom Toast Notification System
window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-rose-500' : 'bg-slate-800';
    const icon = type === 'error' ? 'error' : 'check_circle';
    
    toast.className = `${bgColor} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto`;
    toast.innerHTML = `<span class="material-icons-round text-[20px]">${icon}</span> <p class="text-sm font-medium">${message}</p>`;
    
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

const firebaseConfig = {
  apiKey: "AIzaSyAVZHO-avENaKejMjAUexsaem-Dusljvzo",
  authDomain: "hope-homeo-care.firebaseapp.com",
  projectId: "hope-homeo-care",
  storageBucket: "hope-homeo-care.firebasestorage.app",
  messagingSenderId: "962992614809",
  appId: "1:962992614809:web:8d61d27c8881588c59f708"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Logic
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        // Close menu on link click
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }

    const dateInput = document.getElementById('patient-date');
    if (dateInput) {
        flatpickr(dateInput, {
            minDate: "today",
            disable: [
                function(date) { return (date.getDay() === 0); } // Disable Sundays
            ],
            dateFormat: "Y-m-d",
            static: true, // MAGIC BULLET: Embeds the calendar into the layout flow
            disableMobile: "true" 
        });
    }

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
    const openModal = (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
    };

    const closeModal = () => {
        modal.classList.add('hidden');
    };

    triggers.forEach(btn => btn.addEventListener('click', openModal));
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
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
                setTimeout(() => closeModal(), 1000);
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
                    closeModal();
                    submitBtn.innerText = "Submit Request";
                    submitBtn.disabled = false;
                }, 2000);
            } catch (error) {
                console.error("Error adding document: ", error);
                window.showToast("There was an error sending your request. Please try again.", "error");
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});

async function loadBloggerFeed() {
    const blogUrl = 'https://hopehomeocare.blogspot.com/feeds/posts/default?alt=json&max-results=3';
    const grid = document.getElementById('blog-grid');
    if (!grid) return;

    grid.innerHTML = '<p class="text-center text-teal-700 font-semibold col-span-3">Loading latest articles...</p>';

    try {
        const response = await fetch(blogUrl);
        const data = await response.json();

        if (!data.feed || !data.feed.entry || data.feed.entry.length === 0) {
            grid.innerHTML = '<p class="text-center text-slate-500 col-span-3">Unable to load latest articles at this time.</p>';
            return;
        }

        const posts = data.feed.entry.map(entry => {
            const title = entry.title.$t;
            
            let href = '#';
            const alternateLink = entry.link.find(l => l.rel === 'alternate');
            if (alternateLink) href = alternateLink.href;

            const publishedDate = new Date(entry.published.$t).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            
            const contentHtml = entry.content ? entry.content.$t : '';
            const imgMatch = contentHtml.match(/<img[^>]+src="([^">]+)"/);
            const imageSrc = imgMatch ? imgMatch[1] : './assets/images/blog-placeholder.webp';

            return `
                <div class="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow flex flex-col h-full group border border-slate-100">
                    <div class="relative w-full h-56 overflow-hidden">
                        <img src="${imageSrc}" alt="${title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 bg-slate-100">
                        <div class="absolute top-4 right-4 bg-white/90 backdrop-blur text-teal-800 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                            ${publishedDate}
                        </div>
                    </div>
                    <div class="p-6 flex flex-col flex-grow">
                        <h3 class="font-bold text-lg text-slate-800 mb-4 line-clamp-2 leading-snug">${title}</h3>
                        <div class="mt-auto pt-5 border-t border-slate-100">
                            <a href="${href}" class="inline-flex items-center gap-2 text-teal-700 font-semibold hover:text-teal-900 transition-colors" target="_blank" rel="noopener noreferrer">
                                Read Article
                                <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = posts.join('');
    } catch (error) {
        console.error('Blogger Feed Error:', error);
        grid.innerHTML = '<p class="text-center text-slate-500 col-span-3">Unable to load latest articles at this time.</p>';
    }
}

async function loadGoogleReviews() {
    const grid = document.getElementById('testimonials-grid');
    const modalList = document.getElementById('modal-reviews-list');
    if (!grid) return;

    const fallbackHTML = '<div class="text-center w-full py-8 text-slate-500 shrink-0">Real patient reviews are currently being synced from Google.</div>';

    try {
        const response = await fetch('./assets/data/reviews.json');
        if (!response.ok) {
            grid.innerHTML = fallbackHTML;
            if(modalList) modalList.innerHTML = fallbackHTML;
            return;
        }
        
        const reviews = await response.json();
        if (!reviews || reviews.length === 0) {
            grid.innerHTML = fallbackHTML;
            if(modalList) modalList.innerHTML = fallbackHTML;
            return;
        }

        const starSvg = `<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;

        // Render first 4 to Grid (Horizontal Snap Carousel)
        const carouselCards = reviews.slice(0, 4).map(review => `
            <div class="testimonial-card w-[85vw] md:w-[400px] shrink-0 snap-center bg-white border border-gray-100 p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div class="flex mb-4">
                    ${Array(review.rating).fill(starSvg).join('')}
                </div>
                <p class="text-gray-600 mb-6 italic text-sm">"${review.text}"</p>
                <div class="flex items-center gap-3">
                    ${review.profile_photo_url ? `<img src="${review.profile_photo_url}" class="w-10 h-10 rounded-full" alt="${review.author_name}">` : ''}
                    <div>
                        <div class="font-bold text-gray-900">${review.author_name}</div>
                        <div class="text-xs text-gray-400">${review.relative_time_description}</div>
                    </div>
                </div>
            </div>
        `);
        grid.innerHTML = carouselCards.join('');

        // Render all to Modal List (Full Width list)
        if(modalList) {
            const modalCards = reviews.map(review => `
                <div class="testimonial-card w-full bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex mb-3">
                        ${Array(review.rating).fill(starSvg).join('')}
                    </div>
                    <p class="text-gray-600 mb-4 italic text-sm">"${review.text}"</p>
                    <div class="flex items-center gap-3">
                        ${review.profile_photo_url ? `<img src="${review.profile_photo_url}" class="w-10 h-10 rounded-full" alt="${review.author_name}">` : ''}
                        <div>
                            <div class="font-bold text-gray-900">${review.author_name}</div>
                            <div class="text-xs text-gray-400">${review.relative_time_description}</div>
                        </div>
                    </div>
                </div>
            `);
            modalList.innerHTML = modalCards.join('');
        }
    } catch (error) {
        console.error("Reviews load error:", error);
        grid.innerHTML = fallbackHTML;
        if(modalList) modalList.innerHTML = fallbackHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const viewAllBtn = document.getElementById('view-all-reviews-btn');
    const reviewsModal = document.getElementById('reviews-modal');
    const closeReviewsBtn = document.getElementById('close-reviews-modal');

    // Toggle Review Modal
    if (viewAllBtn && reviewsModal) {
        viewAllBtn.addEventListener('click', () => {
            reviewsModal.classList.remove('hidden');
        });
    }

    if (closeReviewsBtn && reviewsModal) {
        closeReviewsBtn.addEventListener('click', () => {
            reviewsModal.classList.add('hidden');
        });
    }

    // Close on overlay click
    if (reviewsModal) {
        reviewsModal.addEventListener('click', (e) => {
            if (e.target === reviewsModal) {
                reviewsModal.classList.add('hidden');
            }
        });
    }

    // Close on Escape key (handled globally for both modals if needed)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (reviewsModal && !reviewsModal.classList.contains('hidden')) {
                reviewsModal.classList.add('hidden');
            }
        }
    });
});

async function loadActiveCampaign() {
    // UX Check: Don't show again if they already closed it this session
    if (sessionStorage.getItem('campaignSeen')) return;

    try {
        // Fetch campaigns marked as active to prevent scanning old data
        const q = query(collection(db, "campaigns"), where("status", "==", "active"));
        const snapshot = await getDocs(q);
        
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
loadBloggerFeed();
loadGoogleReviews();
loadActiveCampaign();

async function loadDynamicGallery() {
    const carousel = document.getElementById('gallery-carousel');
    if (!carousel) return;

    try {
        // Fetch live images from Firestore, ordered by their custom index
        const q = query(collection(db, "gallery"), orderBy("orderIndex", "asc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            carousel.innerHTML = '<div class="w-full text-center text-slate-500 py-12">Clinic gallery coming soon.</div>';
            return;
        }

        let galleryHTML = '';
        snapshot.forEach(doc => {
            const img = doc.data();
            galleryHTML += `
                <a href="${img.imageUrl}" class="glightbox shrink-0 snap-center relative aspect-square w-[70vw] md:w-[300px] rounded-2xl overflow-hidden shadow-sm group cursor-pointer bg-white/40 backdrop-blur-md border border-white/60" data-gallery="clinic-gallery" data-title="${img.title || ''}">
                    <div class="absolute inset-0 bg-teal-900/0 group-hover:bg-teal-900/20 transition-colors duration-300 z-10 flex items-center justify-center">
                        <span class="material-icons-round text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300 drop-shadow-md">zoom_out_map</span>
                    </div>
                    <img src="${img.imageUrl}" alt="${img.title || 'Clinic View'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy">
                </a>
            `;
        });
        
        carousel.innerHTML = galleryHTML;

        // Initialize Premium Lightbox
        const lightbox = GLightbox({
            selector: '.glightbox',
            touchNavigation: true,
            loop: true,
            zoomable: true
        });

        document.getElementById('view-all-gallery-btn')?.addEventListener('click', () => { lightbox.open(); });

        // Smooth Marquee Auto-Scroll
        let scrollAmount = 0;
        let isHovered = false;
        
        carousel.addEventListener('mouseenter', () => isHovered = true);
        carousel.addEventListener('mouseleave', () => isHovered = false);
        carousel.addEventListener('touchstart', () => isHovered = true);
        carousel.addEventListener('touchend', () => { setTimeout(() => isHovered = false, 2000); });

        setInterval(() => {
            if (!isHovered && carousel.scrollWidth > carousel.clientWidth) {
                if (carousel.scrollLeft >= (carousel.scrollWidth - carousel.clientWidth - 1)) {
                    carousel.scrollLeft = 0; 
                } else {
                    carousel.scrollLeft += 1;
                }
            }
        }, 30);

    } catch (error) {
        console.error("Gallery load error:", error);
        carousel.innerHTML = '<div class="w-full text-center text-slate-500 py-12">Unable to load gallery securely.</div>';
    }
}

// Call it on load
loadDynamicGallery();


