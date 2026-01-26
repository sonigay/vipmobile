/**
 * JWT 키 검증 스크립트
 * 
 * 사용법:
 * node verify-jwt.js "여기에_키_붙여넣기"
 */

const key = process.argv[2];

if (!key) {
  console.log('사용법: node verify-jwt.js "여기에_키_붙여넣기"');
  process.exit(1);
}

console.log('='.repeat(80));
console.log('JWT 키 검증');
console.log('='.repeat(80));

// JWT 구조 확인
const parts = key.split('.');

console.log(`\n📊 JWT 구조:`);
console.log(`   - 전체 길이: ${key.length}자`);
console.log(`   - 부분 개수: ${parts.length}개 (정상: 3개)`);

if (parts.length !== 3) {
  console.log('\n❌ 오류: JWT는 3개 부분으로 구성되어야 합니다!');
  console.log('   형식: Header.Payload.Signature');
  process.exit(1);
}

console.log(`\n📝 각 부분 길이:`);
console.log(`   - Header: ${parts[0].length}자`);
console.log(`   - Payload: ${parts[1].length}자`);
console.log(`   - Signature: ${parts[2].length}자`);

// Signature 길이 확인
if (parts[2].length < 40) {
  console.log(`\n⚠️ 경고: Signature가 너무 짧습니다! (${parts[2].length}자)`);
  console.log('   정상적인 Signature는 보통 43자 이상입니다.');
  console.log('   키가 잘렸을 가능성이 있습니다.');
}

// Payload 디코딩
try {
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  
  console.log(`\n🔍 Payload 내용:`);
  console.log(JSON.stringify(payload, null, 2));
  
  // Role 확인
  if (payload.role === 'service_role') {
    console.log('\n✅ 올바른 키 타입: service_role (서버용)');
  } else if (payload.role === 'anon') {
    console.log('\n❌ 잘못된 키 타입: anon (프론트엔드용)');
    console.log('   서버에서는 service_role 키를 사용해야 합니다!');
  } else {
    console.log(`\n⚠️ 알 수 없는 role: ${payload.role}`);
  }
  
  // 만료 시간 확인
  if (payload.exp) {
    const expDate = new Date(payload.exp * 1000);
    const now = new Date();
    
    console.log(`\n⏰ 만료 시간:`);
    console.log(`   - 만료일: ${expDate.toISOString()}`);
    
    if (expDate > now) {
      const daysLeft = Math.floor((expDate - now) / (1000 * 60 * 60 * 24));
      console.log(`   - 상태: ✅ 유효 (${daysLeft}일 남음)`);
    } else {
      console.log(`   - 상태: ❌ 만료됨`);
    }
  }
  
} catch (error) {
  console.log('\n❌ Payload 디코딩 실패:', error.message);
}

console.log('\n' + '='.repeat(80));

// 최종 판정
if (parts.length === 3 && parts[2].length >= 40) {
  console.log('✅ 키 형식이 올바른 것으로 보입니다.');
  console.log('   .env 파일에 이 키를 사용하세요.');
} else {
  console.log('❌ 키에 문제가 있습니다.');
  console.log('   Supabase 대시보드에서 키를 다시 복사하세요.');
}

console.log('='.repeat(80));
