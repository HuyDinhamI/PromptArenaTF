# 🎨 PromptArena - AI Image Challenge Game

Một game thú vị kiểu Kahoot nhưng với AI! Người chơi tạo prompt để sinh ảnh giống với ảnh tham khảo nhất có thể.

## ✨ Tính năng

- 🎮 **Multiplayer**: Tối đa 20 người chơi mỗi game
- 🤖 **AI-Powered**: Sử dụng Leonardo AI để sinh ảnh và OpenAI để chấm điểm
- ⏰ **Real-time**: WebSocket cho trải nghiệm real-time
- 🏆 **Leaderboard**: Xếp hạng dựa trên độ tương đồng với ảnh gốc
- 👨‍💼 **Host Dashboard**: Quản lý game và người chơi
- 📱 **Responsive**: Hoạt động tốt trên mọi thiết bị

## 🚀 Cài đặt

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Cấu hình API Keys
Mở file `server/config.js` và thay thế các API keys:

```javascript
LEONARDO_API_KEY: "your_leonardo_api_key_here",
OPENAI_API_KEY: "your_openai_api_key_here",
```

**Cách lấy API Keys:**
- **Leonardo AI**: Đăng ký tại [leonardo.ai](https://leonardo.ai) → Profile → API Keys
- **OpenAI**: Đăng ký tại [platform.openai.com](https://platform.openai.com) → API Keys

### 3. Thêm ảnh tham khảo
Thêm các file ảnh vào thư mục `images/` (hỗ trợ .jpg, .jpeg, .png, .gif, .webp)

Ví dụ:
```
images/
├── sunset.jpg
├── mountain.png
├── cat.jpeg
└── city.webp
```

### 4. Chạy server
```bash
# Development mode (với nodemon)
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: http://localhost:3000

## 🎮 Cách chơi

### Cho người chơi:
1. Truy cập: http://localhost:3000
2. Nhập tên và email để join game
3. Chờ host bắt đầu game
4. Xem ảnh tham khảo và tạo prompt
5. Chờ AI sinh ảnh và chấm điểm
6. Xem kết quả trên leaderboard

### Cho host:
1. Truy cập: http://localhost:3000/host.html
2. Quản lý người chơi (kick nếu cần)
3. Bấm "Bắt đầu game" khi sẵn sàng
4. Theo dõi tiến trình game
5. Xem kết quả và reset cho game tiếp theo

## 🏗️ Cấu trúc dự án

```
PromptArena/
├── server/
│   ├── app.js              # Server chính
│   ├── gameManager.js      # Logic quản lý game
│   ├── aiService.js        # Tích hợp Leonardo AI & OpenAI
│   └── config.js           # Cấu hình API keys
├── public/
│   ├── index.html          # Trang người chơi
│   ├── host.html           # Trang host
│   ├── styles.css          # CSS chung
│   ├── player.js           # JavaScript cho người chơi
│   └── host.js             # JavaScript cho host
├── images/                 # Thư mục chứa ảnh tham khảo
├── package.json
└── README.md
```

## ⚙️ Cấu hình

Các thiết lập trong `server/config.js`:

```javascript
GAME: {
    MAX_PLAYERS: 20,        // Số người chơi tối đa
    PROMPT_TIME_LIMIT: 120, // Thời gian nhập prompt (giây)
    IMAGES_FOLDER: "./images"
}
```

## 🔧 Troubleshooting

### Lỗi thường gặp:

1. **"Không có ảnh nào trong thư mục images"**
   - Thêm ít nhất 1 file ảnh vào thư mục `images/`

2. **"Lỗi API Leonardo AI"**
   - Kiểm tra API key Leonardo AI trong `config.js`
   - Đảm bảo có đủ credits trong tài khoản

3. **"Lỗi API OpenAI"**
   - Kiểm tra API key OpenAI trong `config.js`
   - Đảm bảo có đủ credits trong tài khoản

4. **Game không bắt đầu được**
   - Đảm bảo có ít nhất 1 người chơi
   - Kiểm tra console để xem lỗi

### Debug mode:
Mở Developer Tools (F12) để xem console logs chi tiết.

## 🌟 Tính năng nâng cao

- **Auto Reset**: Game tự động reset sau mỗi round
- **Real-time Updates**: Tất cả thay đổi được cập nhật real-time
- **Responsive Design**: Hoạt động tốt trên mobile và desktop
- **Error Handling**: Xử lý lỗi graceful cho trải nghiệm mượt mà

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra console logs
2. Đảm bảo API keys hợp lệ
3. Kiểm tra kết nối internet
4. Restart server nếu cần

## 🎯 Demo Flow

1. **Setup**: Cấu hình API keys và thêm ảnh
2. **Host**: Mở host dashboard
3. **Players**: Người chơi join vào game
4. **Start**: Host bắt đầu game
5. **Play**: Người chơi tạo prompt, AI sinh ảnh
6. **Score**: AI chấm điểm và hiển thị leaderboard
7. **Reset**: Tự động reset cho game tiếp theo

Chúc bạn có những giây phút vui vẻ với PromptArena! 🎉
