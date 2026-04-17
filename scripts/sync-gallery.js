const fs = require('fs');
const path = require('path');

const galleryDir = path.resolve(__dirname, '../assets/images/gallery');
const outputDir = path.resolve(__dirname, '../assets/data');
const outputFile = path.join(outputDir, 'gallery.json');

// Ensure directories exist
if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

try {
    const files = fs.readdirSync(galleryDir);
    const images = files.filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file));
    
    const galleryData = images.map(file => ({
        filename: file,
        path: `./assets/images/gallery/${file}`
    }));

    fs.writeFileSync(outputFile, JSON.stringify(galleryData, null, 2));
    console.log(`Success: Synced ${images.length} images to gallery.json`);
} catch (error) {
    console.error("Failed to sync gallery:", error);
}
