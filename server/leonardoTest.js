// Script test gửi đồng thời 10 request sinh ảnh và chấm điểm với Leonardo AI

const path = require('path');
const fs = require('fs');
const AIService = require('./aiService');

const LOG_FILE = path.resolve(__dirname, '../leonardo_test_log.txt');
function logToFile(msg) {
    fs.appendFileSync(LOG_FILE, msg + '\n', 'utf8');
}

async function testLeonardoBatch() {
    const aiService = new AIService();
    await aiService.initializeClients();

    const prompt = 'sinh ảnh một cô gái với mái tóc nâu, môi màu đỏ'; // Prompt test
    const referenceImagePath = path.resolve(__dirname, '../images/aenh-chan-dung.jpg'); // Ảnh reference bất kỳ

    // Clear log file at start
    fs.writeFileSync(LOG_FILE, `=== Leonardo AI Batch Test Log (${new Date().toISOString()}) ===\n`, 'utf8');

    // Gửi 10 request generateImage đồng thời
    const requests = [];
    for (let i = 0; i < 10; i++) {
        requests.push(aiService.generateImage(prompt));
    }

    let results = [];
    try {
        results = await Promise.allSettled(requests);
    } catch (err) {
        logToFile('Lỗi khi gửi batch request: ' + err.message);
    }

    // Chấm điểm từng ảnh sinh ra (nếu thành công)
    for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === 'fulfilled') {
            const imageUrl = res.value;
            try {
                const score = await aiService.compareImages(referenceImagePath, imageUrl);
                const msg = `[${i + 1}] ✅ Success | Image: ${imageUrl} | Score: ${score.similarity_score} | ${score.explanation}`;
                logToFile(msg);
                console.log(msg);
            } catch (err) {
                const msg = `[${i + 1}] ❌ Error scoring image: ${err.message}`;
                logToFile(msg);
                console.error(msg);
            }
        } else {
            const msg = `[${i + 1}] ❌ Error generating image: ${res.reason?.message || res.reason}`;
            logToFile(msg);
            console.error(msg);
        }
    }
}

testLeonardoBatch();
