import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

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
            const symptomsInput = document.getElementById('patient-symptoms');
            const consentInput = document.getElementById('patient-consent');

            if (!nameInput.value || !phoneInput.value || !dateInput.value || !symptomsInput.value || !consentInput.checked) {
                alert("Please fill out all fields and accept the legal disclaimer.");
                return;
            }

            const originalText = submitBtn.innerText;
            submitBtn.innerText = "Sending Request...";
            submitBtn.disabled = true;

            try {
                await addDoc(collection(db, "appointments"), {
                    name: nameInput.value,
                    phone: phoneInput.value,
                    date: dateInput.value,
                    symptoms: symptomsInput.value,
                    consent: consentInput.checked,
                    timestamp: serverTimestamp(),
                    status: 'pending'
                });
                
                submitBtn.innerText = "Request Sent!";
                setTimeout(() => {
                    nameInput.value = '';
                    phoneInput.value = '';
                    dateInput.value = '';
                    symptomsInput.value = '';
                    consentInput.checked = false;
                    closeModal();
                    submitBtn.innerText = "Submit Request";
                    submitBtn.disabled = false;
                }, 2000);
            } catch (error) {
                console.error("Error adding document: ", error);
                alert("There was an error sending your request. Please try again.");
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
            const imageSrc = imgMatch ? imgMatch[1] : 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

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
    const scroller = document.getElementById('review-scroller');
    if (!scroller) return;

    try {
        const response = await fetch('./assets/data/reviews.json');
        if (!response.ok) return; // Fail silently, keep static reviews
        
        const reviews = await response.json();
        if (!reviews || reviews.length === 0) return;

        const starSvg = `<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;

        const reviewCards = reviews.map(review => {
            return `
                <div class="testimonial-card w-80 flex-shrink-0 bg-white border border-gray-100 p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
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
            `;
        });

        // Duplicate the cards for seamless marquee effect
        scroller.innerHTML = [...reviewCards, ...reviewCards].join('');
    } catch (error) {
        console.error("Reviews load error:", error);
    }
}

loadBloggerFeed();
loadGoogleReviews();
