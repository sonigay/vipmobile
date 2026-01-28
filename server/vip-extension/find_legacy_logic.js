const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '서버 index 예전로직참고용');
const keywords = [
    'api/closing-chart',
    'api/rechotancho-bond',
    '레초탄초',
    '채권',
    'inventory/assignment-status',
    'api/assignment'
];

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log(`File read successfully. Total lines: ${lines.length}`);

    keywords.forEach(keyword => {
        console.log(`\n--- Searching for: ${keyword} ---`);
        let count = 0;
        lines.forEach((line, index) => {
            if (line.includes(keyword)) {
                console.log(`Line ${index + 1}: ${line.trim().substring(0, 100)}...`);
                count++;
                if (count > 5) return; // Limit output per keyword
            }
        });
        if (count === 0) console.log('Not found');
    });

} catch (err) {
    console.error('Error reading file:', err);
}
