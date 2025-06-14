const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameManager = require('./gameManager');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const gameManager = new GameManager(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve images từ thư mục images
app.use('/images', express.static(path.join(__dirname, '..', 'images')));

// Routes API
app.get('/api/status', (req, res) => {
    res.json(gameManager.getGameStatus());
});

app.get('/api/players', (req, res) => {
    res.json(gameManager.getPlayersList());
});

app.get('/api/leaderboard', (req, res) => {
    res.json(gameManager.getLeaderboard());
});

// Leonardo AI test endpoint
app.get('/api/test-leonardo', async (req, res) => {
    try {
        console.log('🧪 Manual Leonardo API test requested...');
        const AIService = require('./aiService');
        const aiService = new AIService();
        
        const testResult = await aiService.testLeonardoAPI();
        
        res.json({
            success: testResult,
            message: testResult ? 'Leonardo AI API test passed!' : 'Leonardo AI API test failed',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Manual Leonardo test error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Leonardo AI test failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Socket.IO Events
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Player join game
    socket.on('join-game', (playerInfo) => {
        console.log(`👤 Join request from ${playerInfo.name} (${playerInfo.email})`);
        
        const result = gameManager.addPlayer(socket.id, playerInfo);
        
        if (result.success) {
            socket.playerId = result.playerId;
            socket.emit('join-success', {
                playerId: result.playerId,
                message: result.message
            });
            
            // Broadcast updated players list
            io.emit('players-updated', gameManager.getPlayersList());
            io.emit('game-status', gameManager.getGameStatus());
        } else {
            socket.emit('join-error', { message: result.message });
        }
    });

    // Host start game
    socket.on('start-game', async () => {
        console.log(`🚀 Start game request from ${socket.id}`);
        
        const result = gameManager.startGame();
        
        if (result.success) {
            // Broadcast game started to all clients
            io.emit('game-started', {
                referenceImage: result.referenceImage,
                timeLimit: result.timeLimit
            });
            io.emit('game-status', gameManager.getGameStatus());
            
            console.log('📢 Game started broadcast sent to all clients');
        } else {
            socket.emit('start-game-error', { message: result.message });
        }
    });

    // Player submit prompt
    socket.on('submit-prompt', async (data) => {
        if (!socket.playerId) {
            socket.emit('submit-error', { message: 'Bạn chưa join game' });
            return;
        }

        console.log(`📝 Prompt submission from ${socket.playerId}: "${data.prompt}"`);
        
        try {
            const result = await gameManager.submitPrompt(socket.playerId, data.prompt);
            
            if (result.success) {
                socket.emit('submit-success', {
                    generatedImageUrl: result.generatedImageUrl,
                    message: result.message
                });
                
                // Broadcast updated game status
                io.emit('game-status', gameManager.getGameStatus());
                io.emit('players-updated', gameManager.getPlayersList());
            } else {
                socket.emit('submit-error', { message: result.message });
            }
        } catch (error) {
            console.error('❌ Error in submit-prompt:', error);
            socket.emit('submit-error', { message: 'Lỗi server: ' + error.message });
        }
    });

    // Host kick player
    socket.on('kick-player', (data) => {
        console.log(`👢 Kick player request: ${data.playerId}`);
        
        const success = gameManager.kickPlayer(data.playerId);
        
        if (success) {
            // Find and disconnect the kicked player
            const clientSockets = io.sockets.sockets;
            for (let [socketId, clientSocket] of clientSockets) {
                if (clientSocket.playerId === data.playerId) {
                    clientSocket.emit('kicked', { message: 'Bạn đã bị kick khỏi game' });
                    clientSocket.disconnect();
                    break;
                }
            }
            
            // Update all clients
            io.emit('players-updated', gameManager.getPlayersList());
            io.emit('game-status', gameManager.getGameStatus());
        }
    });

    // Host kick all players
    socket.on('kick-all-players', () => {
        console.log(`👥 Kick all players request from ${socket.id}`);
        
        const result = gameManager.kickAllPlayers();
        
        if (result.success) {
            // Disconnect all player sockets (kicked event already sent by GameManager)
            const clientSockets = io.sockets.sockets;
            for (let [socketId, clientSocket] of clientSockets) {
                if (clientSocket.playerId) {
                    clientSocket.disconnect();
                }
            }
            
            // Update game status for hosts
            io.emit('game-status', gameManager.getGameStatus());
        }
    });

    // Host reset game
    socket.on('reset-game', () => {
        console.log(`🔄 Reset game request from ${socket.id}`);
        
        const result = gameManager.resetGame();
        
        // Disconnect all players
        const clientSockets = io.sockets.sockets;
        for (let [socketId, clientSocket] of clientSockets) {
            if (clientSocket.playerId) {
                clientSocket.emit('game-reset', { message: 'Game đã được reset' });
                clientSocket.disconnect();
            }
        }
        
        // Broadcast reset to hosts
        io.emit('game-status', gameManager.getGameStatus());
        io.emit('players-updated', gameManager.getPlayersList());
    });

    // Client disconnect
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        
        if (socket.playerId) {
            gameManager.removePlayer(socket.playerId);
            
            // Update all clients
            io.emit('players-updated', gameManager.getPlayersList());
            io.emit('game-status', gameManager.getGameStatus());
        }
    });

    // Get current game status
    socket.on('get-status', () => {
        socket.emit('game-status', gameManager.getGameStatus());
    });

    // Get players list
    socket.on('get-players', () => {
        socket.emit('players-updated', gameManager.getPlayersList());
    });
});

// Lắng nghe game events từ GameManager
// (Có thể extend để handle các events như scoring-complete, etc.)

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
server.listen(PORT, async () => {
    console.log(`🚀 PromptArena Server running on port ${PORT}`);
    console.log(`🎮 Game URL: http://localhost:${PORT}`);
    console.log(`🏠 Host URL: http://localhost:${PORT}/host.html`);
    console.log('================================');
    
    // Test Leonardo AI API on startup
    console.log('\n🧪 Running Leonardo AI API tests...');
    try {
        const aiService = new (require('./aiService'))();
        const testResult = await aiService.testLeonardoAPI();
        
        if (testResult) {
            console.log('✅ Leonardo AI API is ready!');
        } else {
            console.log('❌ Leonardo AI API test failed - check configuration');
        }
    } catch (error) {
        console.error('🚨 Leonardo AI API test error:', error.message);
        console.error('💡 Please check your API key and configuration');
    }
    
    console.log('\n🎯 Server ready for connections!\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Export for testing
module.exports = { app, server, io };
