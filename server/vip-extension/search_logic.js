const fs = require('fs');
const readline = require('readline');

const filePath = 'c:\\Users\\82103\\vipmobile\\server\\vip-extension\\서버 index 예전로직참고용';
const keywords = ['재고배정', '배정', 'assign'];

const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
});

let lineNum = 0;
rl.on('line', (line) => {
    lineNum++;
    if (keywords.some(keyword => line.includes(keyword))) {
        console.log(`${lineNum}: ${line.trim()}`);
    }
});
