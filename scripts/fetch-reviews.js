const fs = require('fs');
const path = require('path');

async function fetchGoogleReviews() {
    try {
        const PLACE_ID = process.env.PLACE_ID;
        const API_KEY = process.env.API_KEY;

        if (!PLACE_ID || !API_KEY) {
            console.error("Error: PLACE_ID and API_KEY environment variables must be provided.");
            process.exit(1);
        }

        const endpoint = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,reviews&key=${API_KEY}`;
        
        console.log(`Fetching reviews for Place ID: ${PLACE_ID}...`);
        
        // fetch is a global standard starting Node.js 18+
        const response = await fetch(endpoint);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK') {
             throw new Error(`Google API returned non-OK status: ${data.status} - ${data.error_message || ''}`);
        }

        const reviews = data.result?.reviews || [];
        
        // Filter out reviews that do not meet the >= 4 rating criteria
        const filteredReviews = reviews.filter(review => review.rating >= 4);

        // Map and extract only the relevant, minimal fields needed
        const formattedReviews = filteredReviews.map(review => ({
            author_name: review.author_name,
            rating: review.rating,
            text: review.text,
            relative_time_description: review.relative_time_description,
            profile_photo_url: review.profile_photo_url
        }));

        // Determine destination file path relative to the script execution block
        // Assuming script runs from root or scripts dir, path mapping is safe
        const dirPath = path.resolve(process.cwd(), './assets/data');
        const filePath = path.join(dirPath, 'reviews.json');

        // Ensure target directory exists before writing
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Output final data layout
        fs.writeFileSync(filePath, JSON.stringify(formattedReviews, null, 2), 'utf-8');
        
        console.log(`Success: Filtered and formatted ${formattedReviews.length} top-rated reviews.`);
        console.log(`Payload securely written to ${filePath}`);

    } catch (error) {
        console.error("Failed executing automated review fetch:", error.message);
        process.exit(1);
    }
}

fetchGoogleReviews();
