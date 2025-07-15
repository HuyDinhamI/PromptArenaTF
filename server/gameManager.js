const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const AIService = require('./aiService');

class GameManager {
    constructor(io) {
        this.io = io; // WebSocket instance for emitting events
        this.players = new Map(); // playerId -> player info
        this.gameState = 'waiting'; // waiting, playing, scoring, finished
        this.currentReferenceImage = null;
        this.gameStartTime = null;
        this.submissions = new Map(); // playerId -> submission info
        this.scores = new Map(); // playerId -> score info
        this.aiService = new AIService();
        this.gameTimer = null;

        // Queue xử lý submit prompt song song theo batch với retry thông minh
        this.promptQueue = [];
        this.isProcessingQueue = false;
        this.batchSize = 5; // Bắt đầu với 5 người/batch
        this.maxConcurrency = 5; // Concurrency tối đa cho mỗi batch
        this.minConcurrency = 1; // Concurrency tối thiểu (tuần tự)

        // Initialize AI clients
        this.initializeAI();
    }

    async initializeAI() {
        try {
            await this.aiService.initializeClients();
            console.log('✅ GameManager: AI services ready');
        } catch (error) {
            console.error('❌ GameManager: Failed to initialize AI services', error);
        }
    }

    // Thêm người chơi mới
    addPlayer(socketId, playerInfo) {
        if (this.players.size >= config.GAME.MAX_PLAYERS) {
            return { success: false, message: 'Phòng đã đầy (20/20)' };
        }

        if (this.gameState !== 'waiting') {
            return { success: false, message: 'Game đang diễn ra, không thể join' };
        }

        // Check email trùng
        for (let [id, player] of this.players) {
            if (player.email === playerInfo.email) {
                return { success: false, message: 'Email đã được sử dụng' };
            }
        }

        const playerId = uuidv4();
        this.players.set(playerId, {
            id: playerId,
            socketId: socketId,
            name: playerInfo.name,
            email: playerInfo.email,
            joinedAt: new Date(),
            status: 'waiting'
        });

        console.log(`✅ Player joined: ${playerInfo.name} (${playerInfo.email})`);
        return { 
            success: true, 
            playerId: playerId,
            message: `Chào mừng ${playerInfo.name}!` 
        };
    }

    // Xóa người chơi
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            this.players.delete(playerId);
            this.submissions.delete(playerId);
            this.scores.delete(playerId);
            console.log(`❌ Player left: ${player.name}`);
            return true;
        }
        return false;
    }

    // Kick người chơi (từ host)
    kickPlayer(playerId) {
        return this.removePlayer(playerId);
    }

    // Kick tất cả người chơi (auto hoặc manual)
    kickAllPlayers() {
        console.log('👥 Kicking all players...');
        
        // Emit kicked event to all players
        for (let [playerId, player] of this.players) {
            if (this.io) {
                this.io.to(player.socketId).emit('kicked', { 
                    message: 'Game đã kết thúc. Cảm ơn bạn đã chơi!' 
                });
            }
        }
        
        // Clear players (giữ lại scores và leaderboard cho host xem)
        this.players.clear();
        
        // Emit cập nhật players list
        if (this.io) {
            this.io.emit('players-updated', this.getPlayersList());
        }
        
        console.log('✅ All players kicked successfully');
        return { success: true, message: 'Đã kick tất cả người chơi' };
    }

    // Lấy danh sách người chơi
    getPlayersList() {
        return Array.from(this.players.values()).map(player => ({
            id: player.id,
            name: player.name,
            email: player.email,
            status: player.status
        }));
    }

    // Lấy ảnh ngẫu nhiên từ thư mục images
    getRandomReferenceImage() {
        try {
            const imagesDir = path.resolve(config.GAME.IMAGES_FOLDER);
            if (!fs.existsSync(imagesDir)) {
                throw new Error(`Thư mục images không tồn tại: ${imagesDir}`);
            }

            const imageFiles = fs.readdirSync(imagesDir)
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                });

            if (imageFiles.length === 0) {
                throw new Error('Không có ảnh nào trong thư mục images');
            }

            const randomImage = imageFiles[Math.floor(Math.random() * imageFiles.length)];
            const imagePath = path.join(imagesDir, randomImage);
            
            console.log(`🎯 Selected reference image: ${randomImage}`);
            return {
                filename: randomImage,
                path: imagePath,
                url: `/images/${randomImage}`
            };
        } catch (error) {
            console.error('❌ Lỗi lấy ảnh tham khảo:', error.message);
            throw error;
        }
    }

    // Bắt đầu game
    startGame() {
        if (this.gameState !== 'waiting') {
            return { success: false, message: 'Game đã bắt đầu hoặc đang diễn ra' };
        }

        if (this.players.size === 0) {
            return { success: false, message: 'Không có người chơi nào' };
        }

        try {
            this.currentReferenceImage = this.getRandomReferenceImage();
            this.gameState = 'playing';
            this.gameStartTime = new Date();
            this.submissions.clear();
            this.scores.clear();

            // Update tất cả player status
            for (let [id, player] of this.players) {
                player.status = 'playing';
            }

            // Set timer để tự động kết thúc phase nhập prompt
            this.gameTimer = setTimeout(() => {
                this.endPromptPhase();
            }, config.GAME.PROMPT_TIME_LIMIT * 1000);

            console.log(`🚀 Game started with ${this.players.size} players`);
            console.log(`🎯 Reference image: ${this.currentReferenceImage.filename}`);

            return { 
                success: true, 
                referenceImage: this.currentReferenceImage,
                timeLimit: config.GAME.PROMPT_TIME_LIMIT
            };
        } catch (error) {
            console.error('❌ Lỗi bắt đầu game:', error.message);
            return { success: false, message: error.message };
        }
    }

    // Người chơi submit prompt (đưa vào queue)
    async submitPrompt(playerId, prompt) {
        if (this.gameState !== 'playing') {
            return { success: false, message: 'Game không trong phase nhập prompt' };
        }

        const player = this.players.get(playerId);
        if (!player) {
            return { success: false, message: 'Người chơi không tồn tại' };
        }

        if (this.submissions.has(playerId)) {
            return { success: false, message: 'Bạn đã submit prompt rồi' };
        }

        // Đưa request vào queue
        this.promptQueue.push({ playerId, prompt });
        this.processPromptQueue();

        return { success: true, message: 'Prompt đã được đưa vào hàng đợi xử lý!' };
    }

    // Xử lý queue với batch song song và retry thông minh
    async processPromptQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.promptQueue.length > 0) {
            // Lấy batch tiếp theo
            const batch = this.promptQueue.splice(0, this.batchSize);
            console.log(`🚀 Processing batch of ${batch.length} requests`);

            // Xử lý batch với retry thông minh
            await this.handleBatchWithRetry(batch);
        }

        this.isProcessingQueue = false;
    }

    // Xử lý batch với retry thông minh (giảm concurrency nếu lỗi)
    async handleBatchWithRetry(batch) {
        let currentConcurrency = this.maxConcurrency;
        let maxRetry = 3; // Retry tối đa 3 lần với concurrency khác nhau
        let attempt = 0;
        let remainingItems = [...batch];

        while (remainingItems.length > 0 && attempt < maxRetry) {
            attempt++;
            console.log(`📦 Batch attempt ${attempt} with concurrency ${currentConcurrency}`);

            try {
                // Chia batch thành các chunk theo concurrency hiện tại
                const results = await this.processBatchChunks(remainingItems, currentConcurrency);
                
                // Lọc ra các item thành công và thất bại
                const successful = results.filter(r => r.success);
                const failed = results.filter(r => !r.success);

                console.log(`✅ Batch result: ${successful.length} success, ${failed.length} failed`);

                // Cập nhật remainingItems chỉ gồm các item thất bại
                remainingItems = failed.map(r => r.item);

                // Nếu còn item thất bại và còn lần retry, giảm concurrency
                if (remainingItems.length > 0 && attempt < maxRetry) {
                    currentConcurrency = Math.max(this.minConcurrency, Math.floor(currentConcurrency / 2));
                    console.log(`⚠️ Reducing concurrency to ${currentConcurrency} for retry`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Đợi 2s trước retry
                }
            } catch (error) {
                console.error(`❌ Batch attempt ${attempt} failed completely:`, error.message);
                if (attempt < maxRetry) {
                    currentConcurrency = Math.max(this.minConcurrency, Math.floor(currentConcurrency / 2));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        // Xử lý các item còn lại thất bại sau khi hết retry
        for (const item of remainingItems) {
            const player = this.players.get(item.playerId);
            if (player && this.io) {
                this.io.to(player.socketId).emit('submit-error', { 
                    message: 'Lỗi tạo ảnh sau nhiều lần thử lại' 
                });
            }
        }
    }

    // Xử lý batch theo chunks với concurrency
    async processBatchChunks(items, concurrency) {
        const results = [];
        
        // Chia items thành các chunk theo concurrency
        for (let i = 0; i < items.length; i += concurrency) {
            const chunk = items.slice(i, i + concurrency);
            console.log(`🔄 Processing chunk of ${chunk.length} items`);

            // Xử lý song song các item trong chunk
            const chunkPromises = chunk.map(item => this.handleSinglePrompt(item));
            const chunkResults = await Promise.allSettled(chunkPromises);

            // Xử lý kết quả của chunk
            for (let j = 0; j < chunk.length; j++) {
                const result = chunkResults[j];
                if (result.status === 'fulfilled' && result.value.success) {
                    results.push({ success: true, item: chunk[j] });
                } else {
                    const error = result.status === 'rejected' ? result.reason : result.value.error;
                    console.error(`❌ Item failed:`, error?.message || error);
                    results.push({ success: false, item: chunk[j], error });
                }
            }

            // Đợi giữa các chunk để tránh overload
            if (i + concurrency < items.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return results;
    }

    // Xử lý một prompt đơn lẻ
    async handleSinglePrompt(item) {
        const { playerId, prompt } = item;
        const player = this.players.get(playerId);

        try {
            console.log(`📝 [Parallel] ${player.name} processing prompt: "${prompt}"`);

            // Step 1: Translate prompt to English (if enabled)
            const translatedPrompt = await this.aiService.translateToEnglish(prompt);

            if (config.TRANSLATION.ENABLED && translatedPrompt !== prompt) {
                console.log(`🌐 Translation: "${prompt}" → "${translatedPrompt}"`);
            }

            // Step 2: Generate image using translated prompt
            const generatedImageUrl = await this.aiService.generateImage(translatedPrompt);

            // Step 3: Save submission
            this.submissions.set(playerId, {
                playerId: playerId,
                playerName: player.name,
                playerEmail: player.email,
                prompt: prompt,
                translatedPrompt: translatedPrompt,
                generatedImageUrl: generatedImageUrl,
                submittedAt: new Date()
            });

            player.status = 'submitted';

            console.log(`✅ [Parallel] ${player.name} - Image generated: ${generatedImageUrl}`);

            // Emit success to client
            if (this.io) {
                this.io.to(player.socketId).emit('submit-success', {
                    generatedImageUrl: generatedImageUrl,
                    message: 'Ảnh đã được tạo thành công!'
                });
            }

            // Check nếu tất cả đã submit
            if (this.submissions.size === this.players.size) {
                clearTimeout(this.gameTimer);
                this.endPromptPhase();
            }

            return { success: true };
        } catch (error) {
            console.error(`❌ [Parallel] Lỗi xử lý prompt cho ${player.name}:`, error.message);
            return { success: false, error };
        }
    }

    // Kết thúc phase nhập prompt và bắt đầu chấm điểm
    async endPromptPhase() {
        if (this.gameState !== 'playing') return;

        console.log(`⏰ Prompt phase ended. Submissions: ${this.submissions.size}/${this.players.size}`);
        
        this.gameState = 'scoring';
        
        // Update player status
        for (let [id, player] of this.players) {
            player.status = 'scoring';
        }

        // Bắt đầu chấm điểm
        await this.scoreSubmissions();
    }

    // Chấm điểm tất cả submissions
    async scoreSubmissions() {
        console.log('🏆 Starting scoring phase...');

        const scoringPromises = [];
        
        for (let [playerId, submission] of this.submissions) {
            const promise = this.scoreIndividualSubmission(playerId, submission);
            scoringPromises.push(promise);
        }

        // Chờ tất cả việc chấm điểm hoàn thành
        await Promise.allSettled(scoringPromises);

        // Tính toán leaderboard
        this.calculateLeaderboard();
        
        this.gameState = 'finished';
        console.log('🎉 Scoring completed!');
        
        // Emit results to all clients
        if (this.io) {
            console.log('📡 Broadcasting results to all clients...');
            this.io.emit('results', this.getLeaderboard());
            this.io.emit('game-status', this.getGameStatus());
        }

        // Auto-kick tất cả players sau 25 giây
        setTimeout(() => {
            this.kickAllPlayers();
        }, 25000);
    }

    // Chấm điểm một submission
    async scoreIndividualSubmission(playerId, submission) {
        try {
            console.log(`🔍 Scoring ${submission.playerName}'s submission...`);
            
            const result = await this.aiService.compareImages(
                this.currentReferenceImage.path,
                submission.generatedImageUrl
            );

            this.scores.set(playerId, {
                playerId: playerId,
                playerName: submission.playerName,
                playerEmail: submission.playerEmail,
                prompt: submission.prompt,
                generatedImageUrl: submission.generatedImageUrl,
                similarityScore: result.similarity_score,
                explanation: result.explanation,
                scoredAt: new Date()
            });

            console.log(`✅ ${submission.playerName}: ${result.similarity_score}% - ${result.explanation}`);
        } catch (error) {
            console.error(`❌ Lỗi chấm điểm ${submission.playerName}:`, error.message);
            
            // Gán điểm 0 nếu lỗi
            this.scores.set(playerId, {
                playerId: playerId,
                playerName: submission.playerName,
                playerEmail: submission.playerEmail,
                prompt: submission.prompt,
                generatedImageUrl: submission.generatedImageUrl,
                similarityScore: 0,
                explanation: 'Lỗi chấm điểm',
                scoredAt: new Date()
            });
        }
    }

    // Tính toán bảng xếp hạng
    calculateLeaderboard() {
        const leaderboard = Array.from(this.scores.values())
            .sort((a, b) => b.similarityScore - a.similarityScore)
            .map((score, index) => ({
                rank: index + 1,
                ...score
            }));

        this.leaderboard = leaderboard;
        console.log('📊 Leaderboard calculated:', leaderboard.map(item => 
            `${item.rank}. ${item.playerName}: ${item.similarityScore}%`
        ));
    }

    // Lấy bảng xếp hạng
    getLeaderboard() {
        return this.leaderboard || [];
    }

    // Reset game để chơi lại
    resetGame() {
        clearTimeout(this.gameTimer);
        this.players.clear();
        this.submissions.clear();
        this.scores.clear();
        this.gameState = 'waiting';
        this.currentReferenceImage = null;
        this.gameStartTime = null;
        this.leaderboard = null;
        this.gameTimer = null;
        
        console.log('🔄 Game reset - Ready for new players');
        return { success: true, message: 'Game đã được reset' };
    }

    // Lấy thông tin trạng thái game
    getGameStatus() {
        return {
            state: this.gameState,
            playersCount: this.players.size,
            maxPlayers: config.GAME.MAX_PLAYERS,
            timeLimit: config.GAME.PROMPT_TIME_LIMIT,
            currentReferenceImage: this.currentReferenceImage,
            gameStartTime: this.gameStartTime,
            submissionsCount: this.submissions.size,
            leaderboard: this.getLeaderboard()
        };
    }
}

module.exports = GameManager;
