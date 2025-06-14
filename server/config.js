// Load environment variables
require('dotenv').config();

// API Keys Configuration
module.exports = {
    LEONARDO_API_KEY: process.env.LEONARDO_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    
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
        MAX_TOKENS: 500
    },
    
    // Game Settings
    GAME: {
        MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS) || 20,
        PROMPT_TIME_LIMIT: parseInt(process.env.PROMPT_TIME_LIMIT) || 120, // seconds
        IMAGES_FOLDER: "./images"
    }
};
