/**
 * 프론트엔드 및 백엔드 서버 응답 검증 스크립트
 * 브라우저 테스트 불가 시 대체 수단
 */

const http = require('http');

const checkUrl = (url) => {
    return new Promise((resolve) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const titleMatch = data.match(/<title>(.*?)<\/title>/);
                const title = titleMatch ? titleMatch[1] : 'No Title';
                resolve({
                    url,
                    statusCode: res.statusCode,
                    title: title.substring(0, 100), // 너무 길면 자름
                    success: res.statusCode >= 200 && res.statusCode < 400
                });
            });
        }).on('error', (err) => {
            resolve({
                url,
                statusCode: 'ERROR',
                error: err.message,
                success: false
            });
        });
    });
};

async function verify() {
    console.log('🔍 웹 서버 응답 상태 확인 중...\n');

    // 1. Frontend (React Dev Server)
    const frontend = await checkUrl('http://localhost:3000');
    if (frontend.success) {
        console.log(`✅ Frontend (3000): 정상 [${frontend.statusCode}]`);
        console.log(`   Page Title: "${frontend.title}"`);
    } else {
        console.log(`❌ Frontend (3000): 실패 [${frontend.statusCode}]`);
        console.log(`   Error: ${frontend.error}`);
    }

    console.log('');

    // 2. Backend (API Server Health)
    // index.js에서 /health 라우트가 마운트 여부 확인이 어려웠지만, 보통 루트나 /health에 둠
    // 없을 수도 있으니 루트도 체크
    const backend = await checkUrl('http://localhost:4000/');
    if (backend.success || backend.statusCode === 404) { // 404라도 뜨면 서버는 살아있는 것
        console.log(`✅ Backend (4000): 정상 [${backend.statusCode}]`);
        // API 서버라 HTML 타이틀은 없을 수 있음
    } else {
        console.log(`❌ Backend (4000): 실패 [${backend.statusCode}]`);
        console.log(`   Error: ${backend.error}`);
    }
}

verify();
