class PlayerGame {
    constructor() {
        this.socket = io();
        this.playerId = null;
        this.gameTimer = null;
        this.timeLeftValue = 120; // Renamed to avoid conflict with DOM element
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
    }

    initializeElements() {
        // Sections
        this.joinSection = document.getElementById('joinSection');
        this.waitingSection = document.getElementById('waitingSection');
        this.gameSection = document.getElementById('gameSection');
        this.scoringSection = document.getElementById('scoringSection');
        this.resultsSection = document.getElementById('resultsSection');
        
        // Form elements
        this.joinForm = document.getElementById('joinForm');
        this.playerName = document.getElementById('playerName');
        this.playerEmail = document.getElementById('playerEmail');
        
        // Game elements
        this.playerCount = document.getElementById('playerCount');
        this.playersGrid = document.getElementById('playersGrid');
        this.timer = document.getElementById('timer');
        this.timeLeft = document.getElementById('timeLeft');
        this.referenceImg = document.getElementById('referenceImg');
        this.promptInput = document.getElementById('promptInput');
        this.submitBtn = document.getElementById('submitBtn');
        this.generatedSection = document.getElementById('generatedSection');
        this.generatedImg = document.getElementById('generatedImg');
        this.leaderboard = document.getElementById('leaderboard');
        this.messages = document.getElementById('messages');
    }

    setupEventListeners() {
        // Join form
        this.joinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinGame();
        });

        // Submit prompt
        this.submitBtn.addEventListener('click', () => {
            this.submitPrompt();
        });

        // Enter key in prompt input
        this.promptInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.submitPrompt();
            }
        });
    }

    setupSocketListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showMessage('Mất kết nối với server', 'error');
        });

        // Join events
        this.socket.on('join-success', (data) => {
            this.playerId = data.playerId;
            this.showMessage(data.message, 'success');
            this.showWaitingRoom();
        });

        this.socket.on('join-error', (data) => {
            this.showMessage(data.message, 'error');
        });

        // Game state updates
        this.socket.on('players-updated', (players) => {
            this.updatePlayersList(players);
        });

        this.socket.on('game-status', (status) => {
            this.handleGameStatus(status);
        });

        // Game events
        this.socket.on('game-started', (data) => {
            this.startGame(data);
        });

        this.socket.on('submit-success', (data) => {
            this.handleSubmitSuccess(data);
        });

        this.socket.on('submit-error', (data) => {
            this.showMessage(data.message, 'error');
            this.submitBtn.disabled = false;
            this.submitBtn.textContent = '🎨 Tạo ảnh';
        });

        // Special events
        this.socket.on('kicked', (data) => {
            this.showMessage(data.message, 'error');
            this.resetToJoin();
        });

        this.socket.on('game-reset', (data) => {
            this.showMessage(data.message, 'info');
            setTimeout(() => {
                this.resetToJoin();
            }, 3000);
        });

        // Results event - show final leaderboard
        this.socket.on('results', (leaderboard) => {
            console.log('📊 Received results from server:', leaderboard);
            this.showResults(leaderboard);
        });
    }

    joinGame() {
        const name = this.playerName.value.trim();
        const email = this.playerEmail.value.trim();

        if (!name || !email) {
            this.showMessage('Vui lòng nhập đầy đủ thông tin', 'error');
            return;
        }

        this.socket.emit('join-game', { name, email });
    }

    showWaitingRoom() {
        this.hideAllSections();
        this.waitingSection.classList.remove('hidden');
    }

    updatePlayersList(players) {
        this.playerCount.textContent = players.length;
        
        this.playersGrid.innerHTML = '';
        players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.innerHTML = `
                <h4>${player.name}</h4>
                <p>${player.email}</p>
                <div class="status status-${player.status}">${this.getStatusText(player.status)}</div>
            `;
            this.playersGrid.appendChild(playerCard);
        });
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

    handleGameStatus(status) {
        switch(status.state) {
            case 'waiting':
                // Already handled by players-updated
                break;
            case 'playing':
                // Already handled by game-started
                break;
            case 'scoring':
                this.showScoringPhase();
                break;
            case 'finished':
                this.showResults(status.leaderboard);
                break;
        }
    }

    startGame(data) {
        this.hideAllSections();
        this.gameSection.classList.remove('hidden');
        
        // Set reference image
        this.referenceImg.src = data.referenceImage.url;
        
        // Reset prompt area to be visible for new game
        if (this.promptInput.parentElement.parentElement) {
            this.promptInput.parentElement.parentElement.style.display = '';
        }
        this.promptInput.disabled = false;
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = '🎨 Tạo ảnh';
        this.generatedSection.classList.add('hidden');
        
        // Start timer with proper variable names
        this.timeLeftValue = data.timeLimit;
        this.updateTimer();
        this.gameTimer = setInterval(() => {
            this.timeLeftValue--;
            this.updateTimer();
            if (this.timeLeftValue <= 0) {
                clearInterval(this.gameTimer);
                this.showMessage('Hết thời gian!', 'info');
            }
        }, 1000);

        this.showMessage('Game đã bắt đầu! Hãy tạo prompt để sinh ảnh giống nhất có thể!', 'info');
    }

    updateTimer() {
        // Update DOM element with current time value
        this.timeLeft.textContent = this.timeLeftValue;
        
        // Change color based on time left
        if (this.timeLeftValue <= 30) {
            this.timer.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
        } else if (this.timeLeftValue <= 60) {
            this.timer.style.background = 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)';
        }
    }

    submitPrompt() {
        const prompt = this.promptInput.value.trim();
        
        if (!prompt) {
            this.showMessage('Vui lòng nhập prompt', 'error');
            return;
        }

        if (prompt.length < 10) {
            this.showMessage('Prompt quá ngắn, hãy mô tả chi tiết hơn', 'error');
            return;
        }

        this.submitBtn.disabled = true;
        this.submitBtn.textContent = '🔄 Đang tạo ảnh...';
        this.promptInput.disabled = true;

        this.socket.emit('submit-prompt', { prompt });
    }

    handleSubmitSuccess(data) {
        this.showMessage(data.message, 'success');
        
        // Show generated image
        this.generatedImg.src = data.generatedImageUrl;
        this.generatedSection.classList.remove('hidden');
        
        // Hide prompt area
        this.promptInput.parentElement.parentElement.style.display = 'none';
        
        // Clear timer
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
    }

    showScoringPhase() {
        this.hideAllSections();
        this.scoringSection.classList.remove('hidden');
    }

    showResults(leaderboard) {
        this.hideAllSections();
        this.resultsSection.classList.remove('hidden');
        
        this.leaderboard.innerHTML = '';
        
        if (leaderboard && leaderboard.length > 0) {
            leaderboard.forEach((item, index) => {
                const leaderboardItem = document.createElement('div');
                leaderboardItem.className = 'leaderboard-item';
                
                let rankClass = '';
                if (index === 0) rankClass = 'first';
                else if (index === 1) rankClass = 'second';
                else if (index === 2) rankClass = 'third';
                
                // Check if this is current player
                const isCurrentPlayer = item.playerId === this.playerId;
                if (isCurrentPlayer) {
                    leaderboardItem.style.border = '2px solid #667eea';
                    leaderboardItem.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
                }
                
                leaderboardItem.innerHTML = `
                    <div class="rank ${rankClass}">${item.rank}</div>
                    <div class="player-info">
                        <h4>${item.playerName} ${isCurrentPlayer ? '(Bạn)' : ''}</h4>
                        <p><strong>Prompt:</strong> ${item.prompt}</p>
                        <div class="explanation">${item.explanation}</div>
                        <img src="${item.generatedImageUrl}" alt="Generated" style="max-width: 150px; max-height: 150px; border-radius: 5px; margin-top: 10px;">
                    </div>
                    <div class="score">${item.similarityScore}%</div>
                `;
                
                this.leaderboard.appendChild(leaderboardItem);
            });
        } else {
            this.leaderboard.innerHTML = '<p>Không có kết quả</p>';
        }

        // Auto reset after 30 seconds
        setTimeout(() => {
            this.resetToJoin();
        }, 30000);
    }

    hideAllSections() {
        this.joinSection.classList.add('hidden');
        this.waitingSection.classList.add('hidden');
        this.gameSection.classList.add('hidden');
        this.scoringSection.classList.add('hidden');
        this.resultsSection.classList.add('hidden');
    }

    resetToJoin() {
        // Clear data
        this.playerId = null;
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
        
        // Reset form
        this.playerName.value = '';
        this.playerEmail.value = '';
        this.promptInput.value = '';
        this.promptInput.disabled = false;
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = '🎨 Tạo ảnh';
        
        // Reset UI elements
        this.generatedSection.classList.add('hidden');
        
        // Show prompt area again (fix for hidden prompt input)
        if (this.promptInput.parentElement.parentElement) {
            this.promptInput.parentElement.parentElement.style.display = '';
        }
        
        this.hideAllSections();
        this.joinSection.classList.remove('hidden');
        
        // Clear messages
        this.messages.innerHTML = '';
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

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new PlayerGame();
});
