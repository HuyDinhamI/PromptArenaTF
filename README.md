# 🎨 PromptArena - AI Image Challenge Game

Một game thú vị kiểu Kahoot nhưng với AI! Người chơi tạo prompt để sinh ảnh giống với ảnh tham khảo nhất có thể.

## ✨ Tính năng

- 🎮 **Multiplayer**: Tối đa 20 người chơi mỗi game
- 🤖 **AI-Powered**: Sử dụng Leonardo AI để sinh ảnh và OpenAI/Gemini để chấm điểm
- ⏰ **Real-time**: WebSocket cho trải nghiệm real-time
- 🏆 **Leaderboard**: Xếp hạng dựa trên độ tương đồng với ảnh gốc
- 👨‍💼 **Host Dashboard**: Quản lý game và người chơi
- 📱 **Responsive**: Hoạt động tốt trên mọi thiết bị

## 🏗️ Cấu trúc dự án

```
PromptArena/
├── server/
│   ├── app.js              # Server chính
│   ├── gameManager.js      # Logic quản lý game
│   ├── aiService.js        # Tích hợp Leonardo AI & OpenAI/Gemini
│   └── config.js           # Cấu hình API keys
├── public/
│   ├── index.html          # Trang người chơi
│   ├── host.html           # Trang host
│   ├── styles.css          # CSS chung
│   ├── player.js           # JavaScript cho người chơi
│   └── host.js             # JavaScript cho host
├── images/                 # Thư mục chứa ảnh tham khảo
├── .env                    # Environment variables
├── package.json
└── README.md
```

---

# 🔧 Development Setup

## 1. Cài đặt dependencies
```bash
git clone https://github.com/your-username/PromptArena.git
cd PromptArena
npm install
```

## 2. Cấu hình API Keys
Tạo file `.env` từ template:
```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:
```env
# Leonardo AI Configuration
LEONARDO_API_KEY=your_leonardo_api_key_here
LEONARDO_DEFAULT_MODEL_ID=your_model_id_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Gemini Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/

# Game Settings
MAX_PLAYERS=20
PROMPT_TIME_LIMIT=120
```

**Cách lấy API Keys:**
- **Leonardo AI**: Đăng ký tại [leonardo.ai](https://leonardo.ai) → Profile → API Keys
- **OpenAI**: Đăng ký tại [platform.openai.com](https://platform.openai.com) → API Keys
- **Gemini**: Đăng ký tại [Google AI Studio](https://makersuite.google.com/app/apikey)

## 3. Thêm ảnh tham khảo
Thêm các file ảnh vào thư mục `images/` (hỗ trợ .jpg, .jpeg, .png, .gif, .webp)

```
images/
├── sunset.jpg
├── mountain.png
├── cat.jpeg
└── city.webp
```

## 4. Chạy development server
```bash
# Development mode (với nodemon)
npm run dev

# Production mode
npm start
```

## 5. Truy cập development
- **Người chơi**: http://localhost:3000
- **Host**: http://localhost:3000/host.html

---

# 🚀 Production Deployment

## Yêu cầu Server

### Minimum Requirements
- **OS**: Ubuntu 20.04+ hoặc CentOS 8+
- **RAM**: 2GB+ (khuyến nghị 4GB)
- **CPU**: 2 vCPU+
- **Storage**: 20GB+ SSD
- **Bandwidth**: Unlimited (do có upload/download ảnh AI)
- **Node.js**: 18.x hoặc cao hơn

### Recommended Providers
- **VPS**: DigitalOcean ($12/tháng), Linode, Vultr
- **Cloud**: AWS EC2, Google Cloud Compute
- **Easy Deploy**: Railway, Render, Heroku

## Setup Production Server

### 1. Chuẩn bị Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Nginx (Reverse Proxy)
sudo apt install nginx -y

# Install Git
sudo apt install git -y

# Install SSL Certificate tool
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Deploy Application
```bash
# Clone repository
sudo mkdir -p /opt
cd /opt
sudo git clone https://github.com/your-username/PromptArena.git
sudo chown -R $USER:$USER /opt/PromptArena
cd /opt/PromptArena

# Install dependencies
npm install --production

# Create production environment file
cp .env.example .env
nano .env  # Chỉnh sửa với API keys thật
```

### 3. Cấu hình Environment Variables
File `.env` production:
```env
# Production Settings
NODE_ENV=production
PORT=3000

# Leonardo AI Configuration
LEONARDO_API_KEY=your_production_leonardo_key
LEONARDO_DEFAULT_MODEL_ID=your_model_id

# OpenAI Configuration
OPENAI_API_KEY=your_production_openai_key

# Gemini Configuration
GEMINI_API_KEY=your_production_gemini_key
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/

# Game Settings
MAX_PLAYERS=20
PROMPT_TIME_LIMIT=120
```

### 4. Setup PM2 Process Manager
```bash
# Start application với PM2
pm2 start server/app.js --name "promptarena"

# Enable auto-restart on system reboot
pm2 startup
pm2 save

# Monitoring commands
pm2 status              # Xem status
pm2 logs promptarena    # Xem logs
pm2 restart promptarena # Restart app
```

### 5. Cấu hình Nginx Reverse Proxy
```bash
sudo nano /etc/nginx/sites-available/promptarena
```

Nội dung file cấu hình:
```nginx
server {
    listen 80;
    server_name promptarena.com www.promptarena.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/promptarena /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Setup SSL Certificate
```bash
# Tự động setup SSL với Let's Encrypt
sudo certbot --nginx -d promptarena.com -d www.promptarena.com

# Auto-renewal
sudo crontab -e
# Thêm dòng: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 7. Setup Firewall
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Git Workflow cho Production

### Initial Setup
```bash
# Trên server production
cd /opt/PromptArena
git remote add origin https://github.com/your-username/PromptArena.git
```

### Deploy Updates
```bash
# Pull latest changes
git pull origin main

# Install new dependencies (nếu có)
npm install --production

# Restart application
pm2 restart promptarena

# Check status
pm2 status
pm2 logs promptarena --lines 50
```

### Automatic Deployment (Optional)
Tạo script `deploy.sh`:
```bash
#!/bin/bash
cd /opt/PromptArena
git pull origin main
npm install --production
pm2 restart promptarena
echo "Deployment completed at $(date)"
```

## Production URLs

### 👥 Người chơi (Players)
**URL**: https://promptarena.com

**Workflow**:
1. Truy cập trang chủ
2. Nhập tên và email
3. Chờ host bắt đầu game
4. Xem ảnh tham khảo
5. Tạo prompt để sinh ảnh
6. Chờ AI chấm điểm
7. Xem kết quả trên leaderboard

### 🎮 Host (Game Master)
**URL**: https://promptarena.com/host.html

**Workflow**:
1. Truy cập host dashboard
2. Theo dõi danh sách người chơi
3. Kick players nếu cần thiết
4. Bấm "Bắt đầu game" khi sẵn sàng
5. Theo dõi tiến trình game real-time
6. Xem kết quả và leaderboard
7. Reset game cho round tiếp theo

---

# 🎮 Cách chơi chi tiết

## Development Mode
- **Người chơi**: http://localhost:3000
- **Host**: http://localhost:3000/host.html

## Production Mode
- **Người chơi**: https://promptarena.com
- **Host**: https://promptarena.com/host.html

## Game Flow
1. **Setup**: Host mở dashboard, người chơi join vào
2. **Start**: Host bắt đầu game khi đủ người
3. **Challenge**: Hệ thống hiển thị ảnh tham khảo
4. **Create**: Người chơi tạo prompt trong thời gian giới hạn
5. **Generate**: AI sinh ảnh từ prompt của mỗi người
6. **Score**: AI chấm điểm độ tương đồng với ảnh gốc
7. **Results**: Hiển thị leaderboard và ảnh sinh ra
8. **Reset**: Host có thể reset để chơi round mới

---

# ⚙️ Cấu hình

## Game Settings
Trong file `server/config.js`:
```javascript
GAME: {
    MAX_PLAYERS: 20,        // Số người chơi tối đa
    PROMPT_TIME_LIMIT: 120, // Thời gian nhập prompt (giây)
    IMAGES_FOLDER: "./images"
}
```

## AI Model Settings
```javascript
// Chuyển đổi giữa OpenAI và Gemini cho scoring
SCORING: {
    MODEL: 'gemini', // 'openai' hoặc 'gemini'
},

// Bật/tắt translation
TRANSLATION: {
    ENABLED: true, // true/false
    MODEL: 'gemini'
}
```

---

# 🔧 Troubleshooting

## Development Issues

### 1. "Không có ảnh nào trong thư mục images"
```bash
# Thêm ít nhất 1 file ảnh vào thư mục images/
cp your-image.jpg images/
```

### 2. "Lỗi API Leonardo AI"
- Kiểm tra API key trong `.env`
- Đảm bảo có đủ credits trong tài khoản Leonardo
- Test API: http://localhost:3000/api/test-leonardo

### 3. "Lỗi API OpenAI/Gemini"
- Kiểm tra API key trong `.env`
- Đảm bảo có đủ credits/quota

### 4. "Port 3000 already in use"
```bash
# Kill process trên port 3000
npm run kill-port
# Hoặc
lsof -ti :3000 | xargs kill -9
```

## Production Issues

### 1. "Service không start được"
```bash
# Check PM2 status
pm2 status
pm2 logs promptarena

# Restart service  
pm2 restart promptarena

# Check system resources
htop
df -h
```

### 2. "SSL Certificate issues"
```bash
# Renew SSL certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

### 3. "Nginx errors"
```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

### 4. "Out of memory"
```bash
# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 5. "High CPU usage"
```bash
# Monitor processes
htop

# Check PM2 processes
pm2 monit

# Restart if needed
pm2 restart promptarena
```

## Monitoring Production

### Health Check Endpoints
- `https://promptarena.com/api/status` - Game status
- `https://promptarena.com/api/players` - Players list
- `https://promptarena.com/api/test-leonardo` - Leonardo API test

### Log Monitoring
```bash
# PM2 logs
pm2 logs promptarena --lines 100

# System logs
sudo journalctl -u nginx -f
sudo tail -f /var/log/nginx/access.log
```

### Performance Monitoring
```bash
# Server resources
htop
iostat 1
free -h

# Application metrics
pm2 monit
```

---

# 🌟 Advanced Features

- **Auto Reset**: Game tự động reset sau mỗi round
- **Real-time Updates**: Tất cả thay đổi được cập nhật real-time qua WebSocket
- **Responsive Design**: Hoạt động tốt trên mobile và desktop
- **Error Handling**: Xử lý lỗi graceful cho trải nghiệm mượt mà
- **Multi-AI Support**: Hỗ trợ cả OpenAI và Gemini cho scoring
- **Translation**: Tự động dịch prompt sang tiếng Anh nếu cần

---

# 📞 Hỗ trợ

## Development
Nếu gặp vấn đề trong development:
1. Kiểm tra console logs (F12)
2. Đảm bảo API keys hợp lệ trong `.env`
3. Kiểm tra kết nối internet
4. Restart server: `npm run dev`

## Production
Nếu gặp vấn đề trong production:
1. Check PM2 status: `pm2 status`
2. Check logs: `pm2 logs promptarena`
3. Check server resources: `htop`, `df -h`
4. Restart application: `pm2 restart promptarena`
5. Check Nginx: `sudo systemctl status nginx`

## API Issues
- **Leonardo AI**: Kiểm tra credits tại [leonardo.ai](https://leonardo.ai)
- **OpenAI**: Kiểm tra usage tại [platform.openai.com](https://platform.openai.com)
- **Gemini**: Kiểm tra quota tại [Google AI Studio](https://makersuite.google.com)

---

# 🎯 Quick Start Commands

## Development
```bash
git clone https://github.com/your-username/PromptArena.git
cd PromptArena
npm install
cp .env.example .env
# Chỉnh sửa .env với API keys
npm run dev
```

## Production Deploy
```bash
# Trên server
git clone https://github.com/your-username/PromptArena.git /opt/PromptArena
cd /opt/PromptArena
npm install --production
cp .env.example .env
# Chỉnh sửa .env với API keys production
pm2 start server/app.js --name promptarena
pm2 startup && pm2 save
```

Chúc bạn có những giây phút vui vẻ với PromptArena! 🎉
