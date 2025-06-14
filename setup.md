# 🚀 PromptArena Setup Guide

## 📋 Checklist Setup

### ✅ 1. Dependencies đã cài đặt
- [x] Node.js packages đã được cài đặt thành công

### ⚙️ 2. Cấu hình API Keys
Mở file `server/config.js` và thay thế các API keys:

```javascript
// Thay thế dòng này:
LEONARDO_API_KEY: "YOUR_LEONARDO_API_KEY",
OPENAI_API_KEY: "YOUR_OPENAI_API_KEY",

// Bằng API keys thật của bạn:
LEONARDO_API_KEY: "sk-leo-xxxxxxxxxxxxx",
OPENAI_API_KEY: "sk-proj-xxxxxxxxxxxxx",
```

**Cách lấy API Keys:**

📸 **Leonardo AI API Key:**
1. Truy cập: https://leonardo.ai
2. Đăng ký/Đăng nhập
3. Vào Profile → API Keys
4. Tạo API key mới
5. Copy và paste vào config.js

🤖 **OpenAI API Key:**
1. Truy cập: https://platform.openai.com
2. Đăng ký/Đăng nhập
3. Vào API Keys
4. Tạo API key mới
5. Copy và paste vào config.js

### 🖼️ 3. Thêm ảnh tham khảo
Thêm ít nhất 1 file ảnh vào thư mục `images/`:

```bash
# Ví dụ:
images/
├── sunset.jpg     # Ảnh hoàng hôn
├── cat.png        # Ảnh mèo
├── mountain.jpeg  # Ảnh núi
└── city.webp      # Ảnh thành phố
```

**Yêu cầu ảnh:**
- Format: .jpg, .jpeg, .png, .gif, .webp
- Kích thước: Không quá lớn (< 5MB)
- Nội dung: Rõ ràng, dễ mô tả

### 🎮 4. Chạy ứng dụng

```bash
# Development mode (khuyến nghị)
npm run dev

# Hoặc production mode
npm start
```

### 🌐 5. Truy cập game

- **Người chơi**: http://localhost:3000
- **Host**: http://localhost:3000/host.html

### 🧪 6. Test thử game

1. Mở 2 tab browser:
   - Tab 1: http://localhost:3000/host.html (Host)
   - Tab 2: http://localhost:3000 (Player)

2. Ở tab Player: Nhập tên + email và join

3. Ở tab Host: Bấm "Bắt đầu game"

4. Test flow: Player tạo prompt → AI sinh ảnh → Chấm điểm → Leaderboard

## 🔧 Troubleshooting

### ❌ Lỗi "Không có ảnh nào trong thư mục images"
**Giải pháp:** Thêm ít nhất 1 file ảnh vào thư mục `images/`

### ❌ Lỗi Leonardo AI API
**Nguyên nhân:** API key sai hoặc hết credits
**Giải pháp:** 
- Kiểm tra API key trong `server/config.js`
- Kiểm tra credits trong tài khoản Leonardo AI

### ❌ Lỗi OpenAI API
**Nguyên nhân:** API key sai hoặc hết credits
**Giải pháp:** 
- Kiểm tra API key trong `server/config.js`
- Kiểm tra credits trong tài khoản OpenAI

### ❌ Server không chạy được
**Giải pháp:**
```bash
# Kiểm tra port có bị chiếm không
netstat -tulpn | grep :3000

# Thử chạy lại
npm run dev
```

### ❌ Game không bắt đầu được
**Giải pháp:** 
- Đảm bảo có ít nhất 1 người chơi join
- Kiểm tra console logs (F12)
- Kiểm tra API keys

## 📱 Demo Script

Để demo game nhanh:

1. **Setup nhanh:**
   ```bash
   # Thêm ảnh mẫu (download từ internet)
   # Cấu hình API keys
   npm run dev
   ```

2. **Mở demo:**
   - Host: http://localhost:3000/host.html
   - Player 1: http://localhost:3000 (tab ẩn danh)
   - Player 2: http://localhost:3000 (tab ẩn danh khác)

3. **Flow demo:**
   - Players join với tên khác nhau
   - Host start game
   - Players tạo prompt giống ảnh gốc
   - Xem kết quả chấm điểm

## 🎯 Tips cho game hay

**Chọn ảnh tham khảo tốt:**
- Có đối tượng chính rõ ràng
- Màu sắc đặc trưng
- Dễ mô tả bằng từ ngữ

**Prompt tốt:**
- Mô tả chi tiết màu sắc, đối tượng
- Sử dụng từ khóa nghệ thuật (oil painting, digital art, etc.)
- Mô tả style và mood

**Ví dụ prompt hay:**
- "A beautiful orange sunset over snow-capped mountains, digital painting style"
- "A fluffy orange cat sitting on a wooden table, photorealistic"
- "Modern city skyline at night with bright lights, cinematic style"

Chúc bạn có game vui vẻ! 🎉
