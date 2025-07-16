// Load environment variables from parent directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// API Keys Configuration
module.exports = {
    LEONARDO_API_KEY: process.env.LEONARDO_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    
    // Leonardo AI Settings
    LEONARDO: {
        BASE_URL: "https://cloud.leonardo.ai/api/rest/v1",
        DEFAULT_MODEL_ID: process.env.LEONARDO_DEFAULT_MODEL_ID,
        IMAGE_WIDTH: 512,
        IMAGE_HEIGHT: 512
    },
    
    // OpenAI Settings
    OPENAI: {
        BASE_URL: "https://api.openai.com/v1",
        MODEL: "gpt-4o-mini",
        MAX_TOKENS: 1000
    },
    
    // Gemini Settings
    GEMINI: {
        BASE_URL: process.env.GEMINI_BASE_URL,
        API_KEY: process.env.GEMINI_API_KEY,
        MODEL: "gemini-1.5-flash"
    },
    
    // Scoring Configuration
    SCORING: {
        MODEL: 'openai', // 'openai' hoặc 'gemini' - switch ở đây
    },
    
    // Translation Configuration
    TRANSLATION: {
        ENABLED: false, // true/false - tắt bật translation
        MODEL: 'gemini'
    },
    
    // Game Settings
    GAME: {
        MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS) || 50,
        PROMPT_TIME_LIMIT: parseInt(process.env.PROMPT_TIME_LIMIT) || 120, // seconds
        IMAGES_FOLDER: "./images"
    }
};
