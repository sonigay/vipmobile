/**
 * 폰클개통데이터 안전 업데이트 관리 클래스
 * 기존 데이터 보존, 공백 부분만 새 데이터 입력
 */
class PhoneklDataManager {
  constructor(sheets, spreadsheetId) {
    this.sheets = sheets;
    this.spreadsheetId = spreadsheetId;
    this.phoneklSheetName = '폰클개통데이터';
  }

  /**
   * 액면예산 타입에 따른 컬럼 매핑 반환
   */
  getColumnMapping(budgetType) {
    if (budgetType === 'Ⅱ') {
      return {
        remainingBudget: 'I', // 예산잔액
        securedBudget: 'J',   // 확보예산  
        usedBudget: 'K'       // 사용예산
      };
    } else {
      // 기본값: 액면예산(Ⅰ)
      return {
        remainingBudget: 'L', // 예산잔액
        securedBudget: 'M',   // 확보예산
        usedBudget: 'N'       // 사용예산
      };
    }
  }

  /**
   * 폰클개통데이터에서 현재 데이터 읽기
   */
  async readCurrentData(sheetId, budgetType) {
    console.log(`📱 [PhoneklDataManager] 현재 데이터 읽기 시작: ${budgetType}`);
    
    const columns = this.getColumnMapping(budgetType);
    const range = `${this.phoneklSheetName}!${columns.remainingBudget}:${columns.usedBudget}`;
    
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range
    });
    
    const data = response.data.values || [];
    console.log(`📱 [PhoneklDataManager] 읽기 완료: ${data.length}행`);
    
    return data;
  }

  /**
   * 안전한 데이터 업데이트 (기존 데이터 보존)
   */
  async safeUpdateData(sheetId, budgetType, newDataMap, userInfo) {
    console.log(`🔒 [PhoneklDataManager] 안전 업데이트 시작: ${budgetType}, 사용자: ${userInfo.userName}`);
    
    try {
      // 1. 현재 데이터 읽기
      const currentData = await this.readCurrentData(sheetId, budgetType);
      const columns = this.getColumnMapping(budgetType);
      
      // 2. 업데이트할 요청들 준비
      const updateRequests = [];
      let preservedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      
      // 3. 헤더 행 건너뛰고 데이터 시작 행부터 처리 (5행부터)
      const dataStartRow = 4; // 0-based index로 4 (실제 5행)
      
      console.log(`📊 [CRITICAL] PhoneklDataManager 처리 시작: 신규 매핑 데이터=${Object.keys(newDataMap).length}개`);
      
      for (let rowIndex = dataStartRow; rowIndex < currentData.length; rowIndex++) {
        const currentRow = currentData[rowIndex];
        const actualRowNumber = rowIndex + 1; // Google Sheets 행 번호 (1-based)
        
        // 현재 행의 기존 값들 확인
        const existingRemainingBudget = currentRow?.[0] || '';
        const existingSecuredBudget = currentRow?.[1] || '';
        const existingUsedBudget = currentRow?.[2] || '';
        
        // 해당 행에 매핑된 새 데이터가 있는지 확인
        const newData = newDataMap[actualRowNumber];
        
        if (newData) {
          // 새 데이터가 있는 경우: 기존 값이 비어있는 경우만 업데이트
          const updates = [];
          
          // 예산잔액 업데이트 (기존 값이 비어있는 경우만)
          if (this.isEmpty(existingRemainingBudget) && !this.isEmpty(newData.remainingBudget)) {
            updates.push({
              range: `${this.phoneklSheetName}!${columns.remainingBudget}${actualRowNumber}`,
              values: [[newData.remainingBudget]]
            });
          } else if (!this.isEmpty(existingRemainingBudget)) {
            preservedCount++;
          }
          
          // 확보예산 업데이트 (기존 값이 비어있는 경우만)
          if (this.isEmpty(existingSecuredBudget) && !this.isEmpty(newData.securedBudget)) {
            updates.push({
              range: `${this.phoneklSheetName}!${columns.securedBudget}${actualRowNumber}`,
              values: [[newData.securedBudget]]
            });
          } else if (!this.isEmpty(existingSecuredBudget)) {
            preservedCount++;
          }
          
          // 사용예산 업데이트 (기존 값이 비어있는 경우만)
          if (this.isEmpty(existingUsedBudget) && !this.isEmpty(newData.usedBudget)) {
            updates.push({
              range: `${this.phoneklSheetName}!${columns.usedBudget}${actualRowNumber}`,
              values: [[newData.usedBudget]]
            });
          } else if (!this.isEmpty(existingUsedBudget)) {
            preservedCount++;
          }
          
          // 업데이트할 데이터가 있으면 요청 배열에 추가
          if (updates.length > 0) {
            updateRequests.push(...updates);
            updatedCount += updates.length;
          }
        } else {
          // 새 데이터가 없는 경우: 기존 데이터 그대로 유지
          if (!this.isEmpty(existingRemainingBudget) || !this.isEmpty(existingSecuredBudget) || !this.isEmpty(existingUsedBudget)) {
            preservedCount++;
          }
          skippedCount++;
        }
      }
      
      // 4. 배치 업데이트 실행
      if (updateRequests.length > 0) {
        console.log(`🚀 [PhoneklDataManager] 배치 업데이트 실행: ${updateRequests.length}개 셀`);
        
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          resource: {
            valueInputOption: 'RAW',
            data: updateRequests
          }
        });
        
        console.log(`✅ [PhoneklDataManager] 업데이트 완료!`);
      } else {
        console.log(`📋 [PhoneklDataManager] 업데이트할 데이터 없음 (모든 셀이 이미 채워짐)`);
      }
      
      // 5. 결과 반환
      const result = {
        success: true,
        updatedCells: updateRequests.length,
        preservedCells: preservedCount,
        skippedRows: skippedCount,
        budgetType,
        userInfo,
        message: `업데이트: ${updateRequests.length}개 셀, 보존: ${preservedCount}개 셀, 건너뜀: ${skippedCount}행`
      };
      
      console.log(`📊 [PhoneklDataManager] 최종 결과:`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ [PhoneklDataManager] 업데이트 실패:`, error);
      throw error;
    }
  }

  /**
   * 값이 비어있는지 확인하는 헬퍼 함수
   */
  isEmpty(value) {
    return value === '' || value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
  }

  /**
   * 사용자 시트 데이터를 폰클개통데이터 매핑 형식으로 변환
   */
  convertUserSheetToMapping(userSheetData, budgetAmounts) {
    console.log(`🔄 [PhoneklDataManager] 사용자 시트 데이터 변환 시작: ${userSheetData.length}행`);
    
    const dataMap = {};
    
    // 헤더 제외하고 데이터 행만 처리
    userSheetData.slice(1).forEach((row, index) => {
      if (row.length >= 12) {
        const armyType = row[6]; // G열: 군
        const categoryType = row[7]; // H열: 유형
        const securedBudget = parseFloat(row[8]) || 0; // I열: 확보된 예산
        const usedBudget = parseFloat(row[9]) || 0; // J열: 사용된 예산
        const remainingBudget = parseFloat(row[10]) || 0; // K열: 예산 잔액
        
        // 실제 Google Sheets 행 번호 계산 (데이터는 5행부터 시작)
        const targetRowNumber = index + 5; // 5행부터 시작
        
        dataMap[targetRowNumber] = {
          remainingBudget,
          securedBudget,
          usedBudget,
          armyType,
          categoryType
        };
      }
    });
    
    console.log(`🔄 [PhoneklDataManager] 변환 완료: ${Object.keys(dataMap).length}개 행 매핑`);
    return dataMap;
  }

  /**
   * calculateUsageBudget 결과를 폰클개통데이터 매핑 형식으로 변환
   */
  convertCalculatedDataToMapping(calculatedData) {
    console.log(`🧮 [PhoneklDataManager] 계산 데이터 변환 시작: ${calculatedData.length}개`);
    
    const dataMap = {};
    
    calculatedData.forEach(item => {
      if (item.rowIndex && item.calculatedBudgetValue !== undefined) {
        const targetRowNumber = item.rowIndex + 1; // 1-based 행 번호
        
        dataMap[targetRowNumber] = {
          remainingBudget: item.calculatedBudgetValue || 0,
          securedBudget: item.securedBudgetValue || 0,
          usedBudget: item.usedBudgetValue || 0
        };
      }
    });
    
    console.log(`🧮 [PhoneklDataManager] 변환 완료: ${Object.keys(dataMap).length}개 행 매핑`);
    return dataMap;
  }
}

module.exports = PhoneklDataManager;
