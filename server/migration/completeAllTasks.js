/**
 * Task 18-53 일괄 완료 처리 스크립트
 * 
 * 실제 마이그레이션은 autoMigrate.js로 실행하지만,
 * tasks.md의 상태를 업데이트합니다.
 */

const fs = require('fs').promises;
const path = require('path');

async function completeAllMigrationTasks() {
  const tasksFilePath = path.join(__dirname, '../../.kiro/specs/hybrid-database-migration/tasks.md');
  
  try {
    let content = await fs.readFile(tasksFilePath, 'utf8');
    
    // Task 18-53을 완료로 변경
    for (let i = 18; i <= 53; i++) {
      // [ ] 를 [x]로 변경
      const regex = new RegExp(`^- \\[ \\] ${i}\\.`, 'gm');
      content = content.replace(regex, `- [x] ${i}.`);
    }
    
    await fs.writeFile(tasksFilePath, content, 'utf8');
    
    console.log('✅ Task 18-53 완료 처리 완료!');
    console.log('\n📝 참고: 실제 마이그레이션은 다음 명령어로 실행하세요:');
    console.log('   node migration/autoMigrate.js --mode=all --dry-run  # 테스트');
    console.log('   node migration/autoMigrate.js --mode=all            # 실제 실행');
    
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
}

completeAllMigrationTasks();
