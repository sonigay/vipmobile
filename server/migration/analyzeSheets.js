/**
 * Google Sheets 구조 분석 스크립트
 * 
 * 31개 시트의 실제 구조를 분석하여 스키마 설계에 필요한 정보를 수집합니다.
 * - 컬럼명 (헤더)
 * - 샘플 데이터 (처음 10행)
 * - 데이터 타입 추론
 * - NULL 값 비율
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');
const fs = require('fs').promises;
const path = require('path');

// 분석할 시트 목록 (31개)
const SHEETS_TO_ANALYZE = {
  '직영점 모드 (14개)': [
    '직영점_정책_마진',
    '직영점_정책_부가서비스',
    '직영점_정책_보험상품',
    '직영점_정책_별도',
    '직영점_설정',
    '직영점_메인페이지문구',
    '직영점_요금제마스터',
    '직영점_단말마스터',
    '직영점_단말요금정책',
    '직영점_모델이미지',
    '직영점_오늘의휴대폰',
    '직영점_대중교통위치',
    '직영점_매장사진',
    '직영점_판매일보'
  ],
  '정책 모드 (10개)': [
    '정책모드_정책표설정',
    '정책모드_정책표목록',
    '정책모드_일반사용자그룹',
    '정책표목록_탭순서',
    '정책모드_정책영업그룹_변경이력',
    '정책모드_기본정책영업그룹',
    '정책모드_기타정책목록',
    '예산모드_예산채널설정',
    '예산모드_기본예산설정',
    '예산모드_기본데이터설정'
  ],
  '고객 모드 (7개)': [
    '고객정보',
    '구매대기',
    '게시판',
    '직영점_사전승낙서마크',
    '예약판매전체고객',
    '예약판매고객',
    '미매칭고객'
  ]
};

class SheetAnalyzer {
  constructor() {
    this.doc = null;
    this.results = {};
  }

  /**
   * Google Sheets 초기화
   */
  async initialize() {
    try {
      const sheetId = process.env.SHEET_ID;
      const credentials = {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      };

      if (!sheetId || !credentials.client_email || !credentials.private_key) {
        throw new Error('Google Sheets credentials not configured');
      }

      this.doc = new GoogleSpreadsheet(sheetId);
      await this.doc.useServiceAccountAuth(credentials);
      await this.doc.loadInfo();

      console.log(`✅ Google Sheets 연결 성공: ${this.doc.title}`);
    } catch (error) {
      console.error('❌ Google Sheets 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 데이터 타입 추론
   */
  inferDataType(columnName, sampleValues) {
    // NULL 값 제거
    const nonNullValues = sampleValues.filter(v => v !== null && v !== undefined && v !== '');
    
    if (nonNullValues.length === 0) {
      return { type: 'TEXT', nullable: true, reason: 'All values are null' };
    }

    const sample = nonNullValues[0];

    // 숫자 체크
    if (!isNaN(sample) && sample !== '') {
      const numValue = Number(sample);
      if (Number.isInteger(numValue)) {
        return { type: 'INTEGER', nullable: sampleValues.length !== nonNullValues.length };
      }
      return { type: 'NUMERIC', nullable: sampleValues.length !== nonNullValues.length };
    }

    // 날짜 체크
    if (this.isValidDate(sample)) {
      return { type: 'TIMESTAMP WITH TIME ZONE', nullable: sampleValues.length !== nonNullValues.length };
    }

    // 불리언 체크 (O/X, true/false, 1/0, Y/N)
    const booleanValues = ['O', 'X', 'true', 'false', '1', '0', 'Y', 'N', 'yes', 'no'];
    if (nonNullValues.every(v => booleanValues.includes(String(v).trim()))) {
      return { type: 'BOOLEAN', nullable: sampleValues.length !== nonNullValues.length };
    }

    // URL 체크
    if (nonNullValues.every(v => String(v).startsWith('http://') || String(v).startsWith('https://'))) {
      return { type: 'TEXT', nullable: sampleValues.length !== nonNullValues.length, note: 'URL' };
    }

    // 긴 텍스트 체크 (500자 이상)
    const avgLength = nonNullValues.reduce((sum, v) => sum + String(v).length, 0) / nonNullValues.length;
    if (avgLength > 500) {
      return { type: 'TEXT', nullable: sampleValues.length !== nonNullValues.length, note: 'Long text' };
    }

    // 기본값: TEXT
    return { type: 'TEXT', nullable: sampleValues.length !== nonNullValues.length };
  }

  /**
   * 날짜 유효성 검사
   */
  isValidDate(value) {
    if (!value) return false;
    
    const date = new Date(value);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * 단일 시트 분석
   */
  async analyzeSheet(sheetName) {
    try {
      console.log(`\n📊 분석 중: ${sheetName}`);

      const sheet = this.doc.sheetsByTitle[sheetName];
      if (!sheet) {
        console.warn(`⚠️ 시트를 찾을 수 없음: ${sheetName}`);
        return null;
      }

      // 헤더 로드
      await sheet.loadHeaderRow();
      const headers = sheet.headerValues;

      if (!headers || headers.length === 0) {
        console.warn(`⚠️ 헤더가 없음: ${sheetName}`);
        return null;
      }

      // 샘플 데이터 로드 (최대 20행)
      const rows = await sheet.getRows({ limit: 20 });
      const rowCount = sheet.rowCount - 1; // 헤더 제외

      console.log(`   - 컬럼 수: ${headers.length}`);
      console.log(`   - 전체 행 수: ${rowCount}`);
      console.log(`   - 샘플 행 수: ${rows.length}`);

      // 컬럼별 분석
      const columns = {};
      headers.forEach(header => {
        const sampleValues = rows.map(row => row.get(header));
        const typeInfo = this.inferDataType(header, sampleValues);

        columns[header] = {
          type: typeInfo.type,
          nullable: typeInfo.nullable,
          note: typeInfo.note || null,
          sampleValues: sampleValues.slice(0, 3), // 처음 3개만 저장
          uniqueCount: new Set(sampleValues.filter(v => v !== null && v !== '')).size
        };
      });

      return {
        sheetName,
        headers,
        rowCount,
        columnCount: headers.length,
        columns,
        sampleData: rows.slice(0, 3).map(row => row.toObject())
      };

    } catch (error) {
      console.error(`❌ 시트 분석 실패 [${sheetName}]:`, error.message);
      return null;
    }
  }

  /**
   * 모든 시트 분석
   */
  async analyzeAll() {
    await this.initialize();

    const allSheets = [];
    for (const [category, sheets] of Object.entries(SHEETS_TO_ANALYZE)) {
      allSheets.push(...sheets);
    }

    console.log(`\n🔍 총 ${allSheets.length}개 시트 분석 시작...\n`);

    for (const sheetName of allSheets) {
      const result = await this.analyzeSheet(sheetName);
      if (result) {
        this.results[sheetName] = result;
      }
      
      // API 제한 방지를 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return this.results;
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  async saveResults(outputPath) {
    try {
      await fs.writeFile(
        outputPath,
        JSON.stringify(this.results, null, 2),
        'utf8'
      );
      console.log(`\n✅ 분석 결과 저장: ${outputPath}`);
    } catch (error) {
      console.error('❌ 결과 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 결과를 Markdown 문서로 저장
   */
  async saveMarkdown(outputPath) {
    try {
      let markdown = '# Google Sheets 구조 분석 결과\n\n';
      markdown += `분석 일시: ${new Date().toISOString()}\n\n`;
      markdown += `총 시트 수: ${Object.keys(this.results).length}\n\n`;

      for (const [category, sheets] of Object.entries(SHEETS_TO_ANALYZE)) {
        markdown += `## ${category}\n\n`;

        for (const sheetName of sheets) {
          const result = this.results[sheetName];
          if (!result) {
            markdown += `### ❌ ${sheetName} (분석 실패)\n\n`;
            continue;
          }

          markdown += `### ${sheetName}\n\n`;
          markdown += `- **전체 행 수**: ${result.rowCount}\n`;
          markdown += `- **컬럼 수**: ${result.columnCount}\n\n`;

          markdown += `#### 컬럼 정보\n\n`;
          markdown += `| 컬럼명 | 데이터 타입 | Nullable | 고유값 수 | 비고 |\n`;
          markdown += `|--------|------------|----------|-----------|------|\n`;

          for (const [colName, colInfo] of Object.entries(result.columns)) {
            const note = colInfo.note || '-';
            markdown += `| ${colName} | ${colInfo.type} | ${colInfo.nullable ? 'Yes' : 'No'} | ${colInfo.uniqueCount} | ${note} |\n`;
          }

          markdown += `\n#### 샘플 데이터 (처음 3행)\n\n`;
          markdown += '```json\n';
          markdown += JSON.stringify(result.sampleData, null, 2);
          markdown += '\n```\n\n';
        }
      }

      await fs.writeFile(outputPath, markdown, 'utf8');
      console.log(`✅ Markdown 문서 저장: ${outputPath}`);
    } catch (error) {
      console.error('❌ Markdown 저장 실패:', error);
      throw error;
    }
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Google Sheets 구조 분석 스크립트');
  console.log('='.repeat(60));

  const analyzer = new SheetAnalyzer();

  try {
    // 분석 실행
    await analyzer.analyzeAll();

    // 결과 저장
    const outputDir = path.join(__dirname, '../database');
    await fs.mkdir(outputDir, { recursive: true });

    const jsonPath = path.join(outputDir, 'sheets-analysis.json');
    const mdPath = path.join(outputDir, 'SHEETS_ANALYSIS.md');

    await analyzer.saveResults(jsonPath);
    await analyzer.saveMarkdown(mdPath);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 분석 완료!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 분석 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SheetAnalyzer };
