const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { OpenAI } = require('openai');

class AIService {
    constructor() {
        this.leonardoApiKey = config.LEONARDO_API_KEY;
        this.openaiApiKey = config.OPENAI_API_KEY;
        this.geminiApiKey = config.GEMINI_API_KEY;
        
        this.initializeClients();
    }

    async initializeClients() {
        // Dynamic import for node-fetch (ES module)
        const fetch = await import('node-fetch');
        const fetchFn = fetch.default;
        const { Headers, Blob, FormData } = fetch;
        
        // Polyfill Web APIs globally if not exists
        if (!globalThis.Headers) {
            globalThis.Headers = Headers;
        }
        if (!globalThis.Blob) {
            globalThis.Blob = Blob;
        }
        if (!globalThis.FormData) {
            globalThis.FormData = FormData;
        }
        
        // Initialize OpenAI client
        this.openaiClient = new OpenAI({
            apiKey: this.openaiApiKey,
            baseURL: config.OPENAI.BASE_URL,
            fetch: fetchFn
        });
        
        // Initialize Gemini client (using OpenAI-compatible API)
        this.geminiClient = new OpenAI({
            apiKey: this.geminiApiKey,
            baseURL: config.GEMINI.BASE_URL,
            fetch: fetchFn
        });
        
        console.log('✅ AI clients initialized with Web APIs polyfill support');
    }

    // Test Leonardo AI API connection và model
    async testLeonardoAPI() {
        console.log('🧪 ========== LEONARDO API TEST ==========');
        
        try {
            // Test 1: Check user info
            const userUrl = `${config.LEONARDO.BASE_URL}/me`;
            const headers = {
                "accept": "application/json",
                "authorization": `Bearer ${this.leonardoApiKey}`
            };
            
            console.log('👤 Testing user authentication...');
            const userResponse = await axios.get(userUrl, { headers });
            console.log('✅ User info retrieved successfully:');
            console.log(`   🆔 User ID: ${userResponse.data.user_details?.[0]?.user?.id}`);
            console.log(`   👤 Username: ${userResponse.data.user_details?.[0]?.user?.username}`);
            console.log(`   🪙 Tokens remaining: ${userResponse.data.user_details?.[0]?.subscriptionTokens}`);
            
            // Skip model validation for now - will test during actual image generation
            console.log('\n🎯 Skipping model validation - will test during image generation');
            console.log(`🎯 Using configured model: ${config.LEONARDO.DEFAULT_MODEL_ID}`);
            
            console.log('\n✅ Leonardo API test completed successfully!');
            console.log('==========================================');
            return true;
            
        } catch (error) {
            console.error('❌ Leonardo API test failed:');
            console.error(`   🚨 Error: ${error.message}`);
            
if (error.response) {
    console.error(`   📡 Status: ${error.response.status}`);
    console.error(`   📝 Response:`, JSON.stringify(error.response.data, null, 2));
    console.error(`   📋 Response Headers:`, JSON.stringify(error.response.headers, null, 2));
    console.error(`   📦 Request Headers:`, JSON.stringify(error.config?.headers, null, 2));
    if (error.response.status === 401) {
        console.error('🔑 Invalid API key or expired token');
    } else if (error.response.status === 403) {
        console.error('🚫 Access forbidden - check permissions');
    } else if (error.response.status === 429) {
        console.error('🚦 Rate limit exceeded');
    }
}
            
            console.error('==========================================');
            return false;
        }
    }

    // Leonardo AI - Sinh ảnh từ prompt
    async generateImage(prompt) {
        try {
            const url = `${config.LEONARDO.BASE_URL}/generations`;
            const headers = {
                "accept": "application/json",
                "authorization": `Bearer ${this.leonardoApiKey}`,
                "content-type": "application/json"
            };
            
            const payload = {
                height: config.LEONARDO.IMAGE_HEIGHT,
                width: config.LEONARDO.IMAGE_WIDTH,
                modelId: config.LEONARDO.DEFAULT_MODEL_ID,
                prompt: prompt,
                num_images: 1
            };

            console.log('🎨 ========== LEONARDO AI GENERATION REQUEST ==========');
            console.log(`📝 Prompt: "${prompt}"`);
            console.log(`🔗 URL: ${url}`);
            console.log(`🎯 Model ID: ${config.LEONARDO.DEFAULT_MODEL_ID}`);
            console.log(`📐 Dimensions: ${config.LEONARDO.IMAGE_WIDTH}x${config.LEONARDO.IMAGE_HEIGHT}`);
            console.log(`🔑 API Key: ${this.leonardoApiKey.substring(0, 10)}...`);
            console.log('📦 Payload:', JSON.stringify(payload, null, 2));

            const response = await axios.post(url, payload, { headers });
            
            console.log('📡 ========== LEONARDO API RESPONSE ==========');
            console.log(`✅ Status: ${response.status} ${response.statusText}`);
            console.log('📋 Headers:', JSON.stringify(response.headers, null, 2));
            console.log('🗂️ Full Response Data:', JSON.stringify(response.data, null, 2));
            
            const generationId = response.data?.sdGenerationJob?.generationId;
            if (!generationId) {
                console.error('❌ Generation ID không tìm thấy trong response');
                console.error('🔍 Response structure:', Object.keys(response.data));
                throw new Error(`Không lấy được generation ID từ Leonardo AI. Response: ${JSON.stringify(response.data)}`);
            }

            console.log(`✅ Generation ID: ${generationId}`);
            console.log('================================================');
            
            return await this.getGeneratedImage(generationId);
        } catch (error) {
            console.error('❌ ========== LEONARDO AI ERROR ==========');
            console.error('🚨 Error Type:', error.constructor.name);
            console.error('📝 Error Message:', error.message);
            
            if (error.response) {
                console.error('📡 HTTP Status:', error.response.status);
                console.error('📋 Response Headers:', JSON.stringify(error.response.headers, null, 2));
                console.error('🗂️ Response Data:', JSON.stringify(error.response.data, null, 2));
            } else if (error.request) {
                console.error('📡 No Response Received');
                console.error('🔗 Request Details:', error.request);
            }
            console.error('==========================================');
            throw error;
        }
    }

    // Lấy ảnh đã sinh từ Leonardo AI
    async getGeneratedImage(generationId) {
        const url = `${config.LEONARDO.BASE_URL}/generations/${generationId}`;
        const headers = {
            "accept": "application/json",
            "authorization": `Bearer ${this.leonardoApiKey}`
        };

        console.log('🔍 ========== LEONARDO IMAGE POLLING ==========');
        console.log(`🆔 Generation ID: ${generationId}`);
        console.log(`🔗 Polling URL: ${url}`);
        console.log(`⏰ Max attempts: 20 (60 seconds total)`);

        // Tăng thời gian timeout lên 60 giây (20 attempts x 3 seconds)
        for (let attempt = 0; attempt < 20; attempt++) {
            try {
                const startTime = Date.now();
                console.log(`\n🔄 Attempt ${attempt + 1}/20: Checking generation status...`);
                
                const response = await axios.get(url, { headers });
                const data = response.data;
                const responseTime = Date.now() - startTime;
                
                console.log(`📡 Response Time: ${responseTime}ms`);
                console.log(`✅ HTTP Status: ${response.status}`);
                
                // Log full response structure for debugging
                console.log('🗂️ Full Response:', JSON.stringify(data, null, 2));
                
                // Check if generation exists
                if (!data?.generations_by_pk) {
                    console.log('❌ No generations_by_pk found in response');
                    console.log('🔍 Available keys:', Object.keys(data || {}));
                } else {
                    const generation = data.generations_by_pk;
                    console.log('📊 Generation Status Info:');
                    console.log(`   🏷️  ID: ${generation.id}`);
                    console.log(`   📝 Status: ${generation.status || 'UNKNOWN'}`);
                    console.log(`   🎯 Model ID: ${generation.modelId}`);
                    console.log(`   📐 Width: ${generation.imageWidth}, Height: ${generation.imageHeight}`);
                    console.log(`   🕐 Created: ${generation.createdAt}`);
                    console.log(`   ⏱️  Updated: ${generation.updatedAt}`);
                    
                    // Check generated images
                    if (generation.generated_images && generation.generated_images.length > 0) {
                        console.log(`🎨 Found ${generation.generated_images.length} generated image(s)!`);
                        generation.generated_images.forEach((img, index) => {
                            console.log(`   Image ${index + 1}:`);
                            console.log(`     🔗 URL: ${img.url}`);
                            console.log(`     🆔 ID: ${img.id}`);
                            console.log(`     📏 Dimensions: ${img.width}x${img.height}`);
                            console.log(`     🎨 NSFW: ${img.nsfw}`);
                        });
                        
                        const imageUrls = generation.generated_images.map(img => img.url);
                        console.log('✅ SUCCESS! Returning first image URL:', imageUrls[0]);
                        console.log('================================================');
                        return imageUrls[0];
                    } else {
                        console.log('⏳ No generated images yet');
                        console.log(`   🔄 Current status: ${generation.status || 'UNKNOWN'}`);
                        
                        // Check if generation failed
                        if (generation.status === 'FAILED') {
                            console.error('❌ Generation FAILED!');
                            throw new Error(`Leonardo AI generation failed. Status: FAILED`);
                        }
                    }
                }

                // Exponential backoff: wait longer on later attempts
                const waitTime = Math.min(3000 + (attempt * 500), 10000);
                console.log(`⏳ Waiting ${waitTime}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
            } catch (error) {
                console.error(`❌ Error on attempt ${attempt + 1}:`);
                console.error(`   🚨 Type: ${error.constructor.name}`);
                console.error(`   📝 Message: ${error.message}`);
                
                if (error.response) {
                    console.error(`   📡 HTTP Status: ${error.response.status}`);
                    console.error(`   🗂️ Response Data:`, JSON.stringify(error.response.data, null, 2));
                    
                    // If it's an auth error, don't retry
                    if (error.response.status === 401 || error.response.status === 403) {
                        console.error('🚫 Authentication/Authorization error - stopping retries');
                        throw new Error(`Leonardo AI authentication error: ${error.response.status}`);
                    }
                }
                
                // Wait before retry even on error
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.error('❌ ========== LEONARDO TIMEOUT ==========');
        console.error(`⏰ Timeout after 20 attempts (60+ seconds)`);
        console.error(`🆔 Generation ID: ${generationId}`);
        console.error('💡 Possible causes:');
        console.error('   - Leonardo AI is experiencing high load');
        console.error('   - Model is slow to generate');
        console.error('   - Generation job failed silently');
        console.error('   - API rate limiting');
        console.error('==========================================');
        
        throw new Error(`Timeout: Không thể lấy ảnh từ Leonardo AI sau 60+ giây. Generation ID: ${generationId}`);
    }

    // Encode ảnh thành base64
    encodeImageToBase64(filePath) {
        try {
            const imageBuffer = fs.readFileSync(filePath);
            return imageBuffer.toString('base64');
        } catch (error) {
            console.error('❌ Lỗi encode ảnh:', error.message);
            throw error;
        }
    }

    // Download ảnh từ URL về base64
    async downloadImageToBase64(imageUrl) {
        try {
            console.log(`📥 Downloading image from: ${imageUrl}`);
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const base64 = Buffer.from(response.data).toString('base64');
            console.log(`✅ Downloaded image, base64 length: ${base64.length} characters`);
            return base64;
        } catch (error) {
            console.error('❌ Lỗi download ảnh:', error.message);
            throw error;
        }
    }

    // Gemini - Dịch prompt từ tiếng Việt sang tiếng Anh
    async translateToEnglish(vietnamesePrompt) {
        if (!config.TRANSLATION.ENABLED) {
            console.log('🔄 Translation disabled, returning original prompt');
            return vietnamesePrompt;
        }

        try {
            console.log(`🌐 Translating prompt: "${vietnamesePrompt}"`);
            
            const response = await this.geminiClient.chat.completions.create({
                model: config.GEMINI.MODEL,
                messages: [
                    {
                        role: "system", 
                        content: "Bạn hãy dịch câu sau sang tiếng anh"
                    },
                    {
                        role: "user",
                        content: vietnamesePrompt
                    }
                ]
            });

            const translatedPrompt = response.choices[0].message.content.trim();
            console.log(`✅ Translated: "${vietnamesePrompt}" → "${translatedPrompt}"`);
            return translatedPrompt;
            
        } catch (error) {
            console.error('❌ Translation error:', error.message);
            console.log('⚠️ Fallback: Using original prompt');
            return vietnamesePrompt; // Fallback to original prompt
        }
    }

    // Switch giữa OpenAI và Gemini cho image comparison
    async compareImages(originalImagePath, generatedImageUrl) {
        console.log(`🔍 Image comparison using: ${config.SCORING.MODEL.toUpperCase()}`);
        
        if (config.SCORING.MODEL === 'gemini') {
            return await this.compareImagesGemini(originalImagePath, generatedImageUrl);
        } else {
            return await this.compareImagesOpenAI(originalImagePath, generatedImageUrl);
        }
    }

    // OpenAI - Chấm điểm so sánh 2 ảnh
    async compareImagesOpenAI(originalImagePath, generatedImageUrl) {
        try {
            console.log(`🔍 OpenAI comparing images: ${originalImagePath} vs ${generatedImageUrl}`);
            
            // Encode ảnh gốc
            const originalBase64 = this.encodeImageToBase64(originalImagePath);
            console.log(`✅ Original image base64 length: ${originalBase64.length} characters`);
            
            // Download và encode ảnh sinh ra
            const generatedBase64 = await this.downloadImageToBase64(generatedImageUrl);
            
            // Detect MIME types
            const originalMimeType = originalImagePath.toLowerCase().includes('.jpg') || originalImagePath.toLowerCase().includes('.jpeg') ? 'image/jpeg' : 'image/png';
            const generatedMimeType = generatedImageUrl.toLowerCase().includes('.jpg') || generatedImageUrl.toLowerCase().includes('.jpeg') ? 'image/jpeg' : 'image/png';
            
            console.log(`🎭 Original image MIME type: ${originalMimeType}`);
            console.log(`🎭 Generated image MIME type: ${generatedMimeType}`);

            const messages = [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Bạn sẽ được hiển thị hai hình ảnh. Hình ảnh đầu tiên là hình ảnh tham khảo (bản gốc), và hình ảnh thứ hai là hình ảnh thử nghiệm. Đánh giá mức độ giống nhau của hình ảnh thứ hai với hình ảnh đầu tiên theo tỷ lệ phần trăm (0% đến 100%). Ngoài ra, hãy giải thích ngắn gọn lý do của bạn. Trả về kết quả dưới dạng JSON với format: {\"similarity_score\": số, \"explanation\": \"giải thích\"}"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${originalMimeType};base64,${originalBase64}`
                            }
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${generatedMimeType};base64,${generatedBase64}`
                            }
                        }
                    ]
                }
            ];

            const response = await this.openaiClient.chat.completions.create({
                model: config.OPENAI.MODEL,
                messages: messages,
                max_tokens: config.OPENAI.MAX_TOKENS
            });

            const content = response.choices[0].message.content;
            console.log("🤖 OpenAI Response:", content);
            
            // Clean response to remove markdown code blocks if present
            let cleanContent = content.trim();
            
            // Remove markdown code blocks (```json ... ```)
            cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
            
            console.log("🧹 Cleaned content:", cleanContent);
            
            // Parse JSON response
            try {
                const result = JSON.parse(cleanContent);
                return {
                    similarity_score: parseFloat(result.similarity_score),
                    explanation: result.explanation
                };
            } catch (parseError) {
                console.log("❌ JSON parse failed, trying fallback extraction...");
                
                // Fallback 1: Extract from JSON pattern in text
                const jsonMatch = cleanContent.match(/\{[^}]*"similarity_score"\s*:\s*(\d+(?:\.\d+)?)[^}]*"explanation"\s*:\s*"([^"]+)"[^}]*\}/);
                if (jsonMatch) {
                    console.log("✅ Extracted via regex pattern");
                    return {
                        similarity_score: parseFloat(jsonMatch[1]),
                        explanation: jsonMatch[2]
                    };
                }
                
                // Fallback 2: Extract score from percentage and use full content as explanation
                const scoreMatch = cleanContent.match(/(\d+(?:\.\d+)?)\s*%/);
                const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
                
                console.log("⚠️ Using fallback: score extraction + full content");
                return {
                    similarity_score: score,
                    explanation: cleanContent
                };
            }
        } catch (error) {
            console.error('❌ Lỗi chấm điểm OpenAI:', error.message);
            throw error;
        }
    }

    // Gemini - Chấm điểm so sánh 2 ảnh
    async compareImagesGemini(originalImagePath, generatedImageUrl) {
        try {
            console.log(`🔍 Gemini comparing images: ${originalImagePath} vs ${generatedImageUrl}`);
            
            // Encode ảnh gốc
            const originalBase64 = this.encodeImageToBase64(originalImagePath);
            console.log(`✅ Original image base64 length: ${originalBase64.length} characters`);
            
            // Download và encode ảnh sinh ra
            const generatedBase64 = await this.downloadImageToBase64(generatedImageUrl);
            
            // Detect MIME types
            const originalMimeType = originalImagePath.toLowerCase().includes('.jpg') || originalImagePath.toLowerCase().includes('.jpeg') ? 'image/jpeg' : 'image/png';
            const generatedMimeType = generatedImageUrl.toLowerCase().includes('.jpg') || generatedImageUrl.toLowerCase().includes('.jpeg') ? 'image/jpeg' : 'image/png';
            
            console.log(`🎭 Original image MIME type: ${originalMimeType}`);
            console.log(`🎭 Generated image MIME type: ${generatedMimeType}`);

            const messages = [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Bạn sẽ được hiển thị hai hình ảnh. Hình ảnh đầu tiên là hình ảnh tham khảo (bản gốc), và hình ảnh thứ hai là hình ảnh thử nghiệm. Đánh giá mức độ giống nhau của hình ảnh thứ hai với hình ảnh đầu tiên theo tỷ lệ phần trăm (0% đến 100%). Ngoài ra, hãy giải thích ngắn gọn lý do của bạn. Trả về kết quả dưới dạng JSON với format: {\"similarity_score\": số, \"explanation\": \"giải thích\"}"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${originalMimeType};base64,${originalBase64}`
                            }
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${generatedMimeType};base64,${generatedBase64}`
                            }
                        }
                    ]
                }
            ];

            const response = await this.geminiClient.chat.completions.create({
                model: config.GEMINI.MODEL,
                messages: messages
            });

            const content = response.choices[0].message.content;
            console.log("🤖 Gemini Response:", content);
            
            // Clean response to remove markdown code blocks if present
            let cleanContent = content.trim();
            
            // Remove markdown code blocks (```json ... ```)
            cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
            
            console.log("🧹 Cleaned content:", cleanContent);
            
            // Parse JSON response
            try {
                const result = JSON.parse(cleanContent);
                return {
                    similarity_score: parseFloat(result.similarity_score),
                    explanation: result.explanation
                };
            } catch (parseError) {
                console.log("❌ JSON parse failed, trying fallback extraction...");
                
                // Fallback 1: Extract from JSON pattern in text
                const jsonMatch = cleanContent.match(/\{[^}]*"similarity_score"\s*:\s*(\d+(?:\.\d+)?)[^}]*"explanation"\s*:\s*"([^"]+)"[^}]*\}/);
                if (jsonMatch) {
                    console.log("✅ Extracted via regex pattern");
                    return {
                        similarity_score: parseFloat(jsonMatch[1]),
                        explanation: jsonMatch[2]
                    };
                }
                
                // Fallback 2: Extract score from percentage and use full content as explanation
                const scoreMatch = cleanContent.match(/(\d+(?:\.\d+)?)\s*%/);
                const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
                
                console.log("⚠️ Using fallback: score extraction + full content");
                return {
                    similarity_score: score,
                    explanation: cleanContent
                };
            }
        } catch (error) {
            console.error('❌ Lỗi chấm điểm Gemini:', error.message);
            throw error;
        }
    }
}

module.exports = AIService;
