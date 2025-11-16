const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

// 🔑 FAIL-SAFE CHECK: Agar environment variables load nahi hue hain (jaisa ki error bata raha hai), 
// toh unhe yahan manually load karein. Yeh Cloudinary API key missing error ko theek karta hai.
if (!process.env.CLOUDINARY_API_KEY) {
    dotenv.config();
    console.log("Cloudinary Config: Environment variables loaded via fail-safe.");
}

// Configuration: process.env se values uthakar Cloudinary SDK ko configure karein.
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Cloudinary par Base64 string ko upload karta hai.
 * Agar input ek HTTP URL hai, toh use wapas bhej deta hai (no re-upload).
 * @param {string} fileString - Base64 string, Data URL, ya existing Cloudinary URL.
 * @returns {Promise<string|null>} Secure URL of the uploaded image or null on failure.
 */
const uploadToCloudinary = async (fileString) => {
    // 1. Agar data hi nahi hai, toh null wapas karein.
    if (!fileString) {
        return null; 
    }
    
    // 2. Agar yeh pehle se hi Cloudinary URL hai (Edit case mein Base64 se bachne ke liye)
    if (fileString.startsWith('http')) {
        return fileString; 
    }
    
    // 3. Agar yeh Base64 Data URL nahi hai (Safety)
    if (!fileString.startsWith('data:image/')) {
        console.error('Cloudinary: Received string is neither a URL nor a valid Base64 Data URL. Skipping upload.');
        return null; 
    }

    // 4. Base64 hai, toh upload karein.
    try {
        const result = await cloudinary.uploader.upload(fileString, {
            folder: "art_gallery_products", // Files ko ek specific folder mein organize karein.
        });
        return result.secure_url;
    } catch (error) {
        // 'Main image upload failed' error ko trigger karne ke liye, specific error message log karein.
        console.error('Cloudinary upload failure details:', error.message);
        // Error ko throw karein taaki route handler use catch kar sake.
        throw new Error('Cloudinary upload failed: ' + error.message);
    }
};

module.exports = {
    cloudinary,
    uploadToCloudinary
};