class HostDashboard {
    constructor() {
        this.socket = io();
        this.gameTimer = null;
        this.timeLeft = 120;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        
        // Load initial data
        this.refreshData();
    }

    initializeElements() {
        // Status elements
        this.gameStatus = document.getElementById('gameStatus');
        this.gameState = document.getElementById('gameState');
        this.playerCount = document.getElementById('playerCount');
        this.maxPlayers = document.getElementById('maxPlayers');
        this.timerInfo = document.getElementById('timerInfo');
        this.gameTimer = document.getElementById('gameTimer');
        
        // Control buttons
        this.startBtn = document.getElementById('startBtn');
        this.kickAllBtn = document.getElementById('kickAllBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        
        // Cards
        this.imageCard = document.getElementById('imageCard');
        this.progressCard = document.getElementById('progressCard');
        this.leaderboardCard = document.getElementById('leaderboardCard');
        
        // Players
        this.playersGrid = document.getElementById('playersGrid');
        
        // Game info
        this.currentReferenceImg = document.getElementById('currentReferenceImg');
        this.imageName = document.getElementById('imageName');
        this.submissionCount = document.getElementById('submissionCount');
        this.totalPlayers = document.getElementById('totalPlayers');
        this.currentPhase = document.getElementById('currentPhase');
        this.hostLeaderboard = document.getElementById('hostLeaderboard');
        
        // Messages
        this.messages = document.getElementById('messages');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => {
            this.startGame();
        });

        this.kickAllBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn kick tất cả người chơi?')) {
                this.kickAllPlayers();
            }
        });

        this.resetBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn reset game? Tất cả dữ liệu sẽ bị xóa.')) {
                this.resetGame();
            }
        });

        this.refreshBtn.addEventListener('click', () => {
            this.refreshData();
        });
    }

    setupSocketListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Host connected to server');
            this.showMessage('Kết nối thành công với server', 'success');
        });

        this.socket.on('disconnect', () => {
            console.log('Host disconnected from server');
            this.showMessage('Mất kết nối với server', 'error');
        });

        // Game state updates
        this.socket.on('players-updated', (players) => {
            this.updatePlayersList(players);
        });

        this.socket.on('game-status', (status) => {
            this.updateGameStatus(status);
        });

        this.socket.on('game-started', (data) => {
            this.handleGameStarted(data);
        });

        this.socket.on('start-game-error', (data) => {
            this.showMessage(data.message, 'error');
        });
    }

    refreshData() {
        this.socket.emit('get-status');
        this.socket.emit('get-players');
    }

    startGame() {
        this.startBtn.disabled = true;
        this.startBtn.textContent = '🔄 Đang bắt đầu...';
        
        this.socket.emit('start-game');
    }

    resetGame() {
        this.socket.emit('reset-game');
        this.showMessage('Đã gửi lệnh reset game', 'info');
    }

    updatePlayersList(players) {
        this.playerCount.textContent = players.length;
        
        if (players.length === 0) {
            this.playersGrid.innerHTML = `
                <div style="text-align: center; color: #666; grid-column: 1/-1;">
                    Chưa có người chơi nào
                </div>
            `;
        } else {
            this.playersGrid.innerHTML = '';
            players.forEach(player => {
                const playerCard = document.createElement('div');
                playerCard.className = 'player-card';
                playerCard.innerHTML = `
                    <button class="kick-btn" onclick="hostDashboard.kickPlayer('${player.id}')" title="Kick player">×</button>
                    <h4>${player.name}</h4>
                    <p>${player.email}</p>
                    <div class="status status-${player.status}">${this.getStatusText(player.status)}</div>
                `;
                this.playersGrid.appendChild(playerCard);
            });
        }

        // Update start button
        this.updateStartButton(players.length);
    }

    updateStartButton(playerCount) {
        if (playerCount > 0) {
            this.startBtn.disabled = false;
            this.startBtn.textContent = `🚀 Bắt đầu game (${playerCount} người)`;
        } else {
            this.startBtn.disabled = true;
            this.startBtn.textContent = '🚀 Bắt đầu game';
        }
    }

    getStatusText(status) {
        const statusTexts = {
            waiting: 'Đang chờ',
            playing: 'Đang chơi',
            submitted: 'Đã nộp',
            scoring: 'Chấm điểm'
        };
        return statusTexts[status] || status;
    }

    getStateText(state) {
        const stateTexts = {
            waiting: 'Đang chờ người chơi',
            playing: 'Đang chơi',
            scoring: 'Đang chấm điểm',
            finished: 'Hoàn thành'
        };
        return stateTexts[state] || state;
    }

    updateGameStatus(status) {
        // Update game state
        this.gameState.textContent = this.getStateText(status.state);
        this.gameStatus.className = `status status-${status.state}`;
        
        // Update player count
        this.playerCount.textContent = status.playersCount;
        this.maxPlayers.textContent = status.maxPlayers;
        
        // Update progress info
        if (status.state !== 'waiting') {
            this.progressCard.classList.remove('hidden');
            this.submissionCount.textContent = status.submissionsCount || 0;
            this.totalPlayers.textContent = status.playersCount;
            this.currentPhase.textContent = this.getStateText(status.state);
        } else {
            this.progressCard.classList.add('hidden');
        }
        
        // Update reference image
        if (status.currentReferenceImage) {
            this.imageCard.classList.remove('hidden');
            this.currentReferenceImg.src = status.currentReferenceImage.url;
            this.imageName.textContent = status.currentReferenceImage.filename;
        } else {
            this.imageCard.classList.add('hidden');
        }
        
        // Update timer
        if (status.state === 'playing' && status.timeLimit) {
            this.timerInfo.classList.remove('hidden');
            this.startGameTimer(status.timeLimit);
        } else {
            this.timerInfo.classList.add('hidden');
            if (this.gameTimer) {
                clearInterval(this.gameTimer);
                this.gameTimer = null;
            }
        }
        
        // Update leaderboard
        if (status.state === 'finished' && status.leaderboard && status.leaderboard.length > 0) {
            this.leaderboardCard.classList.remove('hidden');
            this.displayLeaderboard(status.leaderboard);
        } else if (status.state === 'waiting') {
            this.leaderboardCard.classList.add('hidden');
        }
        
        // Update start button state
        if (status.state === 'waiting') {
            this.startBtn.disabled = status.playersCount === 0;
            this.startBtn.textContent = status.playersCount > 0 ? 
                `🚀 Bắt đầu game (${status.playersCount} người)` : 
                '🚀 Bắt đầu game';
        } else {
            this.startBtn.disabled = true;
            this.startBtn.textContent = '🎮 Game đang diễn ra';
        }
    }

    handleGameStarted(data) {
        this.showMessage('Game đã bắt đầu thành công!', 'success');
        
        // Show reference image
        this.imageCard.classList.remove('hidden');
        this.currentReferenceImg.src = data.referenceImage.url;
        this.imageName.textContent = data.referenceImage.filename;
        
        // Start timer
        this.startGameTimer(data.timeLimit);
    }

    startGameTimer(timeLimit) {
        this.timeLeft = timeLimit;
        this.gameTimer.textContent = this.timeLeft;
        
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        this.gameTimer = setInterval(() => {
            this.timeLeft--;
            this.gameTimer.textContent = this.timeLeft;
            
            if (this.timeLeft <= 0) {
                clearInterval(this.gameTimer);
                this.gameTimer = null;
            }
        }, 1000);
    }

    displayLeaderboard(leaderboard) {
        this.hostLeaderboard.innerHTML = '';
        
        leaderboard.forEach((item, index) => {
            const leaderboardItem = document.createElement('div');
            leaderboardItem.className = 'leaderboard-item';
            
            let rankClass = '';
            if (index === 0) rankClass = 'first';
            else if (index === 1) rankClass = 'second';
            else if (index === 2) rankClass = 'third';
            
            leaderboardItem.innerHTML = `
                <div class="rank ${rankClass}">${item.rank}</div>
                <div class="player-info">
                    <h4>${item.playerName}</h4>
                    <p><strong>Email:</strong> ${item.playerEmail}</p>
                    <p><strong>Prompt:</strong> ${item.prompt}</p>
                    <div class="explanation">${item.explanation}</div>
                    <img src="${item.generatedImageUrl}" alt="Generated" style="max-width: 120px; max-height: 120px; border-radius: 5px; margin-top: 5px;">
                </div>
                <div class="score">${item.similarityScore}%</div>
            `;
            
            this.hostLeaderboard.appendChild(leaderboardItem);
        });
    }

    kickPlayer(playerId) {
        if (confirm('Bạn có chắc muốn kick người chơi này?')) {
            this.socket.emit('kick-player', { playerId });
            this.showMessage('Đã kick người chơi', 'info');
        }
    }

    kickAllPlayers() {
        this.socket.emit('kick-all-players');
        this.showMessage('Đã kick tất cả người chơi', 'info');
    }

    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        this.messages.appendChild(messageEl);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 5000);
        
        // Scroll to show message
        messageEl.scrollIntoView({ behavior: 'smooth' });
    }
}

// Global instance for onclick handlers
let hostDashboard;

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    hostDashboard = new HostDashboard();
});
