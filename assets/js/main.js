document.addEventListener('DOMContentLoaded', () => {
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
});

async function loadBloggerFeed() {
    const blogUrl = 'https://Blogger-Blog-Name-Here.blogspot.com/feeds/posts/default?alt=json&max-results=3';
    const grid = document.getElementById('blog-grid');
    if (!grid) return;

    try {
        const response = await fetch(blogUrl);
        const data = await response.json();

        if (!data.feed || !data.feed.entry || data.feed.entry.length === 0) {
            grid.innerHTML = '<p class="text-center text-slate-500 col-span-3">Unable to load latest articles at this time.</p>';
            return;
        }

        const htmlStrings = data.feed.entry.map(entry => {
            const title = entry.title.$t;
            let href = '#';
            if (entry.link) {
                const linkObj = entry.link.find(l => l.rel === 'alternate');
                if (linkObj) href = linkObj.href;
            }
            
            const thumbnail = entry.media$thumbnail ? entry.media$thumbnail.url : 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

            return `
                <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                    <img src="${thumbnail}" alt="Blog Image" class="w-full h-48 object-cover">
                    <div class="p-6">
                        <h3 class="font-bold text-lg text-slate-800 mb-3">${title}</h3>
                        <a href="${href}" class="text-teal-700 font-semibold hover:underline" target="_blank">Read More</a>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = htmlStrings.join('');
    } catch (error) {
        console.error('Blogger Feed Error:', error);
        grid.innerHTML = '<p class="text-center text-slate-500 col-span-3">Unable to load latest articles at this time.</p>';
    }
}

loadBloggerFeed();
