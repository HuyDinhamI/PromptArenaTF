const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const AIService = require('./aiService');

class GameManager {
    constructor(io) {
        this.io = io; // WebSocket instance for emitting events
        this.players = new Map(); // playerId -> player info
        this.gameState = 'waiting'; // waiting, tournament-active, round-playing, round-scoring, round-results, waiting-host-continue, tournament-finished
        this.currentReferenceImage = null;
        this.gameStartTime = null;
        this.submissions = new Map(); // playerId -> submission info
        this.scores = new Map(); // playerId -> score info
        this.aiService = new AIService();
        this.gameTimer = null;

        // Lưu trữ prompts để xử lý đồng thời khi tất cả đã submit
        this.pendingPrompts = new Map(); // playerId -> prompt info

        // Tournament properties
        this.currentRound = 1;
        this.maxRounds = 4;
        this.tournamentActive = false;
        this.waitingForHostContinue = false;
        this.roundResults = new Map(); // roundNumber -> results
        this.eliminatedPlayers = new Map(); // playerId -> elimination info
        this.usedImages = new Set(); // Track used reference images

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
            return { success: false, message: 'Phòng đã đầy (50/50)' };
        }

        // Chỉ cho join khi tournament chưa bắt đầu
        if (this.tournamentActive || this.currentRound > 1) {
            return { success: false, message: 'Tournament đang diễn ra hoặc đã bắt đầu' };
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
            status: 'waiting',
            // Tournament fields
            eliminated: false,
            eliminatedInRound: null,
            eliminationReason: "",
            eliminationScore: null,
            eliminationCutoff: null,
            roundScores: new Map(),
            allTimeRank: null
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

    // Lấy ảnh ngẫu nhiên từ thư mục images (không trùng với round trước)
    getRandomReferenceImageForRound(roundNumber) {
        try {
            const imagesDir = path.resolve(config.GAME.IMAGES_FOLDER);
            if (!fs.existsSync(imagesDir)) {
                throw new Error(`Thư mục images không tồn tại: ${imagesDir}`);
            }

            const imageFiles = fs.readdirSync(imagesDir)
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                })
                .filter(file => !this.usedImages.has(file)); // Không dùng lại ảnh đã dùng

            if (imageFiles.length === 0) {
                // Nếu hết ảnh mới, reset và dùng lại
                this.usedImages.clear();
                const allImageFiles = fs.readdirSync(imagesDir)
                    .filter(file => {
                        const ext = path.extname(file).toLowerCase();
                        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                    });
                
                if (allImageFiles.length === 0) {
                    throw new Error('Không có ảnh nào trong thư mục images');
                }
                imageFiles.push(...allImageFiles);
            }

            const randomImage = imageFiles[Math.floor(Math.random() * imageFiles.length)];
            const imagePath = path.join(imagesDir, randomImage);
            
            // Đánh dấu ảnh đã dùng
            this.usedImages.add(randomImage);
            
            console.log(`🎯 Round ${roundNumber} - Selected reference image: ${randomImage}`);
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

    // Compatibility method - dùng cho single round mode
    getRandomReferenceImage() {
        return this.getRandomReferenceImageForRound(this.currentRound);
    }

    // Lấy danh sách người chơi đang hoạt động (chưa bị loại)
    getActivePlayers() {
        return Array.from(this.players.values()).filter(player => !player.eliminated);
    }

    // Lấy danh sách người chơi đã bị loại
    getEliminatedPlayers() {
        return Array.from(this.eliminatedPlayers.values());
    }

    // Validate có thể bắt đầu round không
    canStartRound(roundNumber) {
        const roundConfig = config.TOURNAMENT.ROUNDS[roundNumber];
        const activePlayers = this.getActivePlayers();
        
        if (!roundConfig) {
            return { valid: false, message: `Round ${roundNumber} không tồn tại` };
        }

        if (activePlayers.length === 0) {
            return { valid: false, message: 'Không có người chơi nào' };
        }

        // Có thể chơi với ít người hơn maxPlayers
        return { 
            valid: true, 
            message: `Round ${roundNumber}: ${activePlayers.length} người chơi` 
        };
    }

    // Check có thể tiếp tục round tiếp theo không
    canAdvanceToNextRound() {
        if (this.currentRound >= this.maxRounds) {
            return { valid: false, message: 'Đã là round cuối' };
        }

        const nextRound = this.currentRound + 1;
        const activePlayers = this.getActivePlayers();
        const nextRoundConfig = config.TOURNAMENT.ROUNDS[nextRound];

        if (activePlayers.length === 0) {
            return { valid: false, message: 'Không có người chơi nào còn lại' };
        }

        return { 
            valid: true, 
            nextRound: nextRound,
            playerCount: activePlayers.length,
            roundName: nextRoundConfig.name
        };
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

    // Người chơi submit prompt (lưu vào pending, xử lý đồng thời khi đủ)
    async submitPrompt(playerId, prompt) {
        // Check game state - tournament mode uses 'round-playing'
        if (this.gameState !== 'playing' && this.gameState !== 'round-playing') {
            return { success: false, message: 'Game không trong phase nhập prompt' };
        }

        const player = this.players.get(playerId);
        if (!player) {
            return { success: false, message: 'Người chơi không tồn tại' };
        }

        // Check if player is eliminated in tournament
        if (this.tournamentActive && player.eliminated) {
            return { success: false, message: 'Bạn đã bị loại khỏi tournament' };
        }

        if (this.pendingPrompts.has(playerId)) {
            return { success: false, message: 'Bạn đã submit prompt rồi' };
        }

        console.log(`📝 ${player.name} submitted prompt: "${prompt}"`);

        // Lưu prompt vào pending
        this.pendingPrompts.set(playerId, {
            playerId,
            prompt,
            playerName: player.name,
            playerEmail: player.email,
            submittedAt: new Date()
        });

        player.status = 'submitted';

        // Check nếu tất cả active players đã submit prompt
        const expectedPlayerCount = this.tournamentActive 
            ? this.getActivePlayers().length 
            : this.players.size;
            
        if (this.pendingPrompts.size === expectedPlayerCount) {
            clearTimeout(this.gameTimer);
            await this.processAllPromptsSimultaneously();
        }

        return { success: true, message: 'Prompt đã được ghi nhận!' };
    }

    // Xử lý tất cả prompts theo batch (tối đa 9/lần để tránh rate limit)
    async processAllPromptsSimultaneously() {
        const totalPrompts = this.pendingPrompts.size;
        const batchSize = 9; // Tối đa 9 để tránh rate limit Leonardo AI
        
        console.log(`🚀 Processing ${totalPrompts} prompts in batches of ${batchSize}...`);

        // Chuyển Map thành Array để dễ chia batch
        const promptInfos = Array.from(this.pendingPrompts.values());
        
        // Chia thành các batch
        const batches = [];
        for (let i = 0; i < promptInfos.length; i += batchSize) {
            batches.push(promptInfos.slice(i, i + batchSize));
        }

        console.log(`📦 Split into ${batches.length} batches`);

        // Xử lý từng batch tuần tự
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`\n🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} people)...`);

            await this.processSingleBatch(batch, batchIndex + 1, batches.length);
        }

        // Clear pending prompts
        this.pendingPrompts.clear();

        // Chuyển sang phase chấm điểm
        this.endPromptPhase();
    }

    // Xử lý một batch (sinh ảnh song song, trả kết quả ngay khi xong)
    async processSingleBatch(batch, batchNumber, totalBatches) {
        console.log(`📋 Batch ${batchNumber}/${totalBatches}: Processing ${batch.length} prompts...`);

        // Tạo promises cho tất cả trong batch
        const batchPromises = batch.map((promptInfo, index) => 
            this.processSinglePromptWithProgress(promptInfo, index + 1, batch.length, batchNumber)
        );

        // Xử lý song song trong batch
        const results = await Promise.allSettled(batchPromises);

        // Log kết quả batch
        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        const failed = results.length - successful;
        console.log(`✅ Batch ${batchNumber} completed: ${successful} success, ${failed} failed`);
    }

    // Xử lý một prompt với thông tin progress
    async processSinglePromptWithProgress(promptInfo, itemIndex, batchSize, batchNumber) {
        const player = this.players.get(promptInfo.playerId);
        
        try {
            console.log(`📝 [Batch ${batchNumber}][${itemIndex}/${batchSize}] Processing: ${promptInfo.playerName}`);

            // Step 1: Translate prompt to English (if enabled)
            const translatedPrompt = await this.aiService.translateToEnglish(promptInfo.prompt);

            if (config.TRANSLATION.ENABLED && translatedPrompt !== promptInfo.prompt) {
                console.log(`🌐 [${promptInfo.playerName}] Translation: "${promptInfo.prompt}" → "${translatedPrompt}"`);
            }

            // Step 2: Generate image using translated prompt
            const generatedImageUrl = await this.aiService.generateImage(translatedPrompt);

            // Step 3: Create submission
            const submission = {
                playerId: promptInfo.playerId,
                playerName: promptInfo.playerName,
                playerEmail: promptInfo.playerEmail,
                prompt: promptInfo.prompt,
                translatedPrompt: translatedPrompt,
                generatedImageUrl: generatedImageUrl,
                submittedAt: promptInfo.submittedAt
            };

            // Step 4: Lưu submission
            this.submissions.set(promptInfo.playerId, submission);

            // Step 5: Emit success to client ngay lập tức
            if (this.io && player) {
                this.io.to(player.socketId).emit('submit-success', {
                    generatedImageUrl: generatedImageUrl,
                    message: 'Ảnh đã được tạo thành công!'
                });
            }

            // Step 6: Bắt đầu chấm điểm ngay cho người này
            this.scoreIndividualSubmissionImmediate(promptInfo.playerId, submission);

            console.log(`✅ [${promptInfo.playerName}] Image generated and scoring started`);
            return { success: true, submission };

        } catch (error) {
            console.error(`❌ [${promptInfo.playerName}] Failed:`, error.message);

            if (this.io && player) {
                this.io.to(player.socketId).emit('submit-error', {
                    message: 'Lỗi tạo ảnh: ' + (error?.message || 'Unknown error')
                });
            }

            return { success: false, error };
        }
    }

    // Chấm điểm ngay lập tức cho từng người (không đợi tất cả)
    async scoreIndividualSubmissionImmediate(playerId, submission) {
        try {
            console.log(`🔍 [Immediate] Scoring ${submission.playerName}'s submission...`);
            
            const result = await this.aiService.compareImages(
                this.currentReferenceImage.path,
                submission.generatedImageUrl
            );

            const scoreData = {
                playerId: playerId,
                playerName: submission.playerName,
                playerEmail: submission.playerEmail,
                prompt: submission.prompt,
                generatedImageUrl: submission.generatedImageUrl,
                similarityScore: result.similarity_score,
                explanation: result.explanation,
                scoredAt: new Date()
            };

            this.scores.set(playerId, scoreData);

            console.log(`✅ [${submission.playerName}] Scored: ${result.similarity_score}% - ${result.explanation}`);

            // Emit kết quả chấm điểm cho người chơi ngay lập tức
            const player = this.players.get(playerId);
            if (this.io && player) {
                this.io.to(player.socketId).emit('scoring-complete', {
                    score: result.similarity_score,
                    explanation: result.explanation,
                    generatedImageUrl: submission.generatedImageUrl,
                    message: `Điểm của bạn: ${result.similarity_score}%`
                });
            }

            // Cập nhật trạng thái game cho host
            if (this.io) {
                this.io.emit('player-scored', {
                    playerId: playerId,
                    playerName: submission.playerName,
                    score: result.similarity_score
                });
            }

        } catch (error) {
            console.error(`❌ [Immediate] Lỗi chấm điểm ${submission.playerName}:`, error.message);
            
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

            const player = this.players.get(playerId);
            if (this.io && player) {
                this.io.to(player.socketId).emit('scoring-complete', {
                    score: 0,
                    explanation: 'Lỗi chấm điểm',
                    generatedImageUrl: submission.generatedImageUrl,
                    message: 'Lỗi chấm điểm: 0%'
                });
            }
        }
    }

    // Xử lý một prompt đơn lẻ
    async processSinglePrompt(promptInfo) {
        try {
            console.log(`📝 [Simultaneous] Processing: ${promptInfo.playerName} - "${promptInfo.prompt}"`);

            // Step 1: Translate prompt to English (if enabled)
            const translatedPrompt = await this.aiService.translateToEnglish(promptInfo.prompt);

            if (config.TRANSLATION.ENABLED && translatedPrompt !== promptInfo.prompt) {
                console.log(`🌐 Translation: "${promptInfo.prompt}" → "${translatedPrompt}"`);
            }

            // Step 2: Generate image using translated prompt
            const generatedImageUrl = await this.aiService.generateImage(translatedPrompt);

            // Step 3: Create submission
            const submission = {
                playerId: promptInfo.playerId,
                playerName: promptInfo.playerName,
                playerEmail: promptInfo.playerEmail,
                prompt: promptInfo.prompt,
                translatedPrompt: translatedPrompt,
                generatedImageUrl: generatedImageUrl,
                submittedAt: promptInfo.submittedAt
            };

            return { success: true, submission };
        } catch (error) {
            console.error(`❌ [Simultaneous] Error processing ${promptInfo.playerName}:`, error.message);
            return { success: false, error };
        }
    }

    // Kết thúc phase nhập prompt và chờ tất cả chấm điểm xong
    async endPromptPhase() {
        if (this.gameState !== 'playing') return;

        console.log(`⏰ Prompt phase ended. Submissions: ${this.submissions.size}/${this.players.size}`);
        
        this.gameState = 'scoring';
        
        // Update player status
        for (let [id, player] of this.players) {
            player.status = 'scoring';
        }

        // Đợi tất cả người chấm điểm xong (chấm điểm đã được thực hiện trong scoreIndividualSubmissionImmediate)
        await this.waitForAllScoringComplete();
    }

    // Đợi tất cả chấm điểm hoàn thành
    async waitForAllScoringComplete() {
        console.log('🏆 Waiting for all scoring to complete...');
        
        // Đợi cho đến khi tất cả đã có điểm
        const checkInterval = setInterval(() => {
            if (this.scores.size === this.submissions.size) {
                clearInterval(checkInterval);
                this.finalizeScoringPhase();
            }
        }, 1000);

        // Timeout sau 5 phút nếu vẫn chưa xong
        setTimeout(() => {
            clearInterval(checkInterval);
            this.finalizeScoringPhase();
        }, 300000);
    }

    // Hoàn thành phase chấm điểm
    async finalizeScoringPhase() {
        // Tính toán leaderboard
        this.calculateLeaderboard();
        
        console.log('🎉 Scoring completed!');
        
        // Check if tournament mode or single game mode
        if (this.tournamentActive) {
            // Tournament mode: Handle round completion
            await this.handleRoundCompletion();
        } else {
            // Single game mode: Original behavior
            this.gameState = 'finished';
            
            // Emit results to all clients
            if (this.io) {
                console.log('📡 Broadcasting final results to all clients...');
                this.io.emit('results', this.getLeaderboard());
                this.io.emit('game-status', this.getGameStatus());
            }

            // Auto-kick tất cả players sau 60 giây để xem kết quả
            setTimeout(() => {
                this.kickAllPlayers();
            }, 60000);
        }
    }

    // Handle tournament round completion
    async handleRoundCompletion() {
        this.gameState = 'round-results';
        
        console.log(`🏁 Round ${this.currentRound} completed`);
        
        // Emit round scoring complete
        if (this.io) {
            this.io.emit('round-scoring-complete', {
                round: this.currentRound,
                roundName: config.TOURNAMENT.ROUNDS[this.currentRound].name,
                leaderboard: this.getLeaderboard()
            });
        }

        // Wait a moment for players to see results
        setTimeout(async () => {
            // Eliminate players and advance
            await this.eliminatePlayersAfterRound();
            
            // Check if tournament should continue or end
            if (this.currentRound >= this.maxRounds) {
                // Tournament finished
                await this.endTournament();
            } else {
                // Wait for host to continue to next round
                this.gameState = 'waiting-host-continue';
                this.waitingForHostContinue = true;
                
                const canAdvance = this.canAdvanceToNextRound();
                
                if (this.io) {
                    this.io.emit('waiting-for-host', {
                        message: `Round ${this.currentRound} hoàn thành. Host có thể tiếp tục round tiếp theo.`,
                        currentRound: this.currentRound,
                        nextRound: canAdvance.valid ? canAdvance.nextRound : null,
                        nextRoundName: canAdvance.valid ? canAdvance.roundName : null,
                        currentPlayers: this.getActivePlayers().length,
                        canContinue: canAdvance.valid
                    });
                }
                
                console.log(`⏸️ Waiting for host to continue to Round ${canAdvance.valid ? canAdvance.nextRound : 'N/A'}`);
            }
        }, config.TOURNAMENT.RESULT_DISPLAY_TIME);
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

    // =============== TOURNAMENT METHODS ===============

    // Bắt đầu tournament
    startTournament() {
        if (this.tournamentActive) {
            return { success: false, message: 'Tournament đã bắt đầu rồi' };
        }

        if (this.players.size === 0) {
            return { success: false, message: 'Không có người chơi nào' };
        }

        // Reset tournament state
        this.currentRound = 1;
        this.tournamentActive = true;
        this.waitingForHostContinue = false;
        this.roundResults.clear();
        this.eliminatedPlayers.clear();
        this.usedImages.clear();

        console.log(`🏆 Tournament started with ${this.players.size} players`);
        
        // Bắt đầu Round 1
        const result = this.startRound(1);
        
        if (result.success) {
            // Emit tournament started event
            if (this.io) {
                this.io.emit('tournament-started', {
                    totalRounds: this.maxRounds,
                    currentRound: this.currentRound,
                    totalPlayers: this.players.size
                });
            }
        }

        return result;
    }

    // Bắt đầu một round cụ thể
    startRound(roundNumber) {
        const validation = this.canStartRound(roundNumber);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }

        const roundConfig = config.TOURNAMENT.ROUNDS[roundNumber];
        const activePlayers = this.getActivePlayers();

        try {
            // Set current round
            this.currentRound = roundNumber;
            this.gameState = 'round-playing';
            this.waitingForHostContinue = false;

            // Get new reference image for this round
            this.currentReferenceImage = this.getRandomReferenceImageForRound(roundNumber);
            this.gameStartTime = new Date();
            
            // Clear previous round data
            this.submissions.clear();
            this.scores.clear();
            this.pendingPrompts.clear();

            // Update player status
            activePlayers.forEach(player => {
                player.status = 'round-playing';
            });

            // Set timer cho round
            this.gameTimer = setTimeout(() => {
                this.endPromptPhase();
            }, config.GAME.PROMPT_TIME_LIMIT * 1000);

            console.log(`🚀 Round ${roundNumber} (${roundConfig.name}) started with ${activePlayers.length} players`);
            console.log(`🎯 Round ${roundNumber} reference image: ${this.currentReferenceImage.filename}`);

            // Emit round started event
            if (this.io) {
                this.io.emit('round-started', {
                    round: roundNumber,
                    roundName: roundConfig.name,
                    participantCount: activePlayers.length,
                    topCount: roundConfig.topCount,
                    referenceImage: this.currentReferenceImage,
                    timeLimit: config.GAME.PROMPT_TIME_LIMIT
                });
            }

            return { 
                success: true, 
                round: roundNumber,
                roundName: roundConfig.name,
                participants: activePlayers.length,
                referenceImage: this.currentReferenceImage,
                timeLimit: config.GAME.PROMPT_TIME_LIMIT
            };

        } catch (error) {
            console.error(`❌ Lỗi bắt đầu Round ${roundNumber}:`, error.message);
            return { success: false, message: error.message };
        }
    }

    // Host tiếp tục sang round tiếp theo
    hostContinueRound() {
        if (!this.waitingForHostContinue) {
            return { success: false, message: 'Không trong trạng thái chờ host continue' };
        }

        const canAdvance = this.canAdvanceToNextRound();
        if (!canAdvance.valid) {
            return { success: false, message: canAdvance.message };
        }

        console.log(`🎮 Host continuing to Round ${canAdvance.nextRound}`);
        
        // Bắt đầu round tiếp theo
        return this.startRound(canAdvance.nextRound);
    }

    // Tính toán xếp hạng round với tie-breaking
    calculateRoundRanking() {
        const submissions = Array.from(this.submissions.values());
        const scores = Array.from(this.scores.values());
        
        // Combine submission data với scores
        const playersWithScores = scores.map(scoreData => {
            const submission = submissions.find(sub => sub.playerId === scoreData.playerId);
            return {
                playerId: scoreData.playerId,
                playerName: scoreData.playerName,
                playerEmail: scoreData.playerEmail,
                score: scoreData.similarityScore,
                explanation: scoreData.explanation,
                submittedAt: submission?.submittedAt || new Date(),
                prompt: scoreData.prompt,
                generatedImageUrl: scoreData.generatedImageUrl
            };
        });

        // Sắp xếp: Score cao trước, submit time sớm trước (tie-breaking)
        const ranking = playersWithScores.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score; // Score cao hơn = rank tốt hơn
            }
            return a.submittedAt - b.submittedAt; // Submit sớm hơn = rank tốt hơn
        });

        // Thêm rank number
        ranking.forEach((player, index) => {
            player.rank = index + 1;
        });

        console.log(`📊 Round ${this.currentRound} ranking calculated:`, 
            ranking.slice(0, 5).map(p => `${p.rank}. ${p.playerName}: ${p.score}%`)
        );

        return ranking;
    }

    // Loại bỏ players sau round
    async eliminatePlayersAfterRound() {
        const ranking = this.calculateRoundRanking();
        const roundConfig = config.TOURNAMENT.ROUNDS[this.currentRound];
        const survivorCount = roundConfig.topCount;
        
        // Top players được giữ lại
        const survivors = ranking.slice(0, survivorCount);
        
        // Những người bị loại
        const eliminated = ranking.slice(survivorCount);
        
        // Cutoff score là điểm của người cuối cùng được giữ lại
        const cutoffScore = survivors.length > 0 ? survivors[survivors.length - 1].score : 0;

        console.log(`🔥 Round ${this.currentRound}: Eliminating ${eliminated.length} players, keeping ${survivors.length}`);
        console.log(`📊 Cutoff score: ${cutoffScore}%`);

        // Kick những người bị loại ngay lập tức
        for (const eliminatedPlayer of eliminated) {
            await this.kickPlayerImmediately(eliminatedPlayer.playerId, {
                round: this.currentRound,
                roundName: roundConfig.name,
                reason: `Không đạt top ${survivorCount}`,
                score: eliminatedPlayer.score,
                rank: eliminatedPlayer.rank,
                cutoffScore: cutoffScore
            });
        }

        // Lưu kết quả round
        this.roundResults.set(this.currentRound, {
            roundNumber: this.currentRound,
            roundName: roundConfig.name,
            totalParticipants: ranking.length,
            survivors: survivors.length,
            eliminated: eliminated.length,
            cutoffScore: cutoffScore,
            ranking: ranking
        });

        // Emit round results
        if (this.io) {
            this.io.emit('round-results', {
                round: this.currentRound,
                roundName: roundConfig.name,
                ranking: ranking,
                survivors: survivors.length,
                eliminated: eliminated.length,
                cutoffScore: cutoffScore
            });
        }

        return {
            survivors: survivors.length,
            eliminated: eliminated.length,
            cutoffScore: cutoffScore
        };
    }

    // Kick người chơi ngay lập tức với thông tin chi tiết
    async kickPlayerImmediately(playerId, eliminationInfo) {
        const player = this.players.get(playerId);
        
        if (!player) {
            console.log(`⚠️ Player ${playerId} not found for elimination`);
            return;
        }

        console.log(`🚪 Eliminating ${player.name}: Round ${eliminationInfo.round}, Rank ${eliminationInfo.rank}, Score ${eliminationInfo.score}%`);

        // 1. Mark player as eliminated
        player.eliminated = true;
        player.eliminatedInRound = eliminationInfo.round;
        player.eliminationReason = eliminationInfo.reason;
        player.eliminationScore = eliminationInfo.score;
        player.eliminationCutoff = eliminationInfo.cutoffScore;

        // 2. Save round score
        player.roundScores.set(eliminationInfo.round, {
            score: eliminationInfo.score,
            rank: eliminationInfo.rank,
            advanced: false,
            eliminated: true
        });

        // 3. Send elimination notification
        if (this.io) {
            this.io.to(player.socketId).emit('eliminated', {
                round: eliminationInfo.round,
                roundName: eliminationInfo.roundName,
                reason: eliminationInfo.reason,
                yourScore: eliminationInfo.score,
                yourRank: eliminationInfo.rank,
                cutoffScore: eliminationInfo.cutoffScore,
                totalParticipants: this.getActivePlayers().length + 1,
                message: `Bạn bị loại ở ${eliminationInfo.roundName}. Điểm: ${eliminationInfo.score}% (Rank ${eliminationInfo.rank}). Cảm ơn bạn đã chơi!`
            });

            // Delay một chút để message được gửi
            setTimeout(() => {
                // 4. Disconnect player
                const socket = Array.from(this.io.sockets.sockets.values())
                    .find(s => s.id === player.socketId);
                if (socket) {
                    socket.disconnect();
                }
            }, 2000);
        }

        // 5. Move to eliminated players
        this.eliminatedPlayers.set(playerId, {
            ...player,
            eliminatedAt: new Date(),
            eliminationInfo: eliminationInfo
        });

        // 6. Remove from active players
        this.players.delete(playerId);
        this.submissions.delete(playerId);
        this.scores.delete(playerId);
        this.pendingPrompts.delete(playerId);

        console.log(`✅ ${player.name} eliminated and disconnected`);
    }

    // Kết thúc tournament
    async endTournament() {
        console.log('🏆 Tournament ended!');
        
        const finalRanking = this.calculateFinalRanking();
        const winner = finalRanking.length > 0 ? finalRanking[0] : null;

        this.gameState = 'tournament-finished';
        this.tournamentActive = false;

        // Emit final results
        if (this.io) {
            this.io.emit('tournament-finished', {
                winner: winner,
                finalRanking: finalRanking,
                allRoundResults: Array.from(this.roundResults.values()),
                totalRounds: this.currentRound
            });
        }

        console.log(`🥇 Tournament Winner: ${winner ? winner.playerName : 'No winner'}`);

        // Auto-kick remaining players sau delay
        setTimeout(() => {
            this.kickAllPlayers();
        }, config.TOURNAMENT.AUTO_KICK_DELAY);
    }

    // Tính final ranking cho tournament
    calculateFinalRanking() {
        // Lấy current round ranking làm final ranking
        const currentRanking = this.calculateRoundRanking();
        
        return currentRanking.map((player, index) => ({
            ...player,
            finalRank: index + 1,
            tournamentWinner: index === 0
        }));
    }

    // Reset tournament hoàn toàn
    resetTournament() {
        console.log('🔄 Resetting tournament...');
        
        clearTimeout(this.gameTimer);
        
        // Reset tournament state
        this.currentRound = 1;
        this.tournamentActive = false;
        this.waitingForHostContinue = false;
        this.roundResults.clear();
        this.eliminatedPlayers.clear();
        this.usedImages.clear();
        
        // Reset game state
        this.players.clear();
        this.submissions.clear();
        this.scores.clear();
        this.pendingPrompts.clear();
        this.gameState = 'waiting';
        this.currentReferenceImage = null;
        this.gameStartTime = null;
        this.leaderboard = null;
        this.gameTimer = null;
        
        console.log('✅ Tournament reset complete');
        return { success: true, message: 'Tournament đã được reset' };
    }

    // Host eliminate player cụ thể
    hostEliminatePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            return { success: false, message: 'Người chơi không tồn tại' };
        }

        console.log(`🎮 Host eliminating ${player.name}`);
        
        this.kickPlayerImmediately(playerId, {
            round: this.currentRound,
            roundName: config.TOURNAMENT.ROUNDS[this.currentRound]?.name || `Round ${this.currentRound}`,
            reason: 'Bị host loại',
            score: 0,
            rank: 'N/A',
            cutoffScore: 'N/A'
        });

        return { success: true, message: `${player.name} đã bị loại` };
    }

    // Lấy thông tin trạng thái tournament
    getTournamentStatus() {
        return {
            tournamentActive: this.tournamentActive,
            currentRound: this.currentRound,
            maxRounds: this.maxRounds,
            waitingForHostContinue: this.waitingForHostContinue,
            activePlayers: this.getActivePlayers().length,
            eliminatedPlayers: this.eliminatedPlayers.size,
            canAdvanceToNextRound: this.canAdvanceToNextRound(),
            roundResults: Array.from(this.roundResults.values())
        };
    }

    // =============== END TOURNAMENT METHODS ===============

    // Lấy thông tin trạng thái game (updated với tournament info)
    getGameStatus() {
        const baseStatus = {
            state: this.gameState,
            playersCount: this.players.size,
            maxPlayers: config.GAME.MAX_PLAYERS,
            timeLimit: config.GAME.PROMPT_TIME_LIMIT,
            currentReferenceImage: this.currentReferenceImage,
            gameStartTime: this.gameStartTime,
            submissionsCount: this.submissions.size,
            leaderboard: this.getLeaderboard()
        };

        // Thêm tournament info
        if (this.tournamentActive) {
            return {
                ...baseStatus,
                tournament: this.getTournamentStatus()
            };
        }

        return baseStatus;
    }
}

module.exports = GameManager;
