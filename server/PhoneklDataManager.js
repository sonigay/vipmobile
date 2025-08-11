/**
 * 폰클개통데이터 안전 업데이트 관리 클래스
 * 기존 데이터 보존, 공백 부분만 새 데이터 입력
 */
class PhoneklDataManager {
  constructor(sheets, spreadsheetId) {
    this.sheets = sheets;
    this.spreadsheetId = spreadsheetId;
    this.phoneklSheetName = '폰클개통데이터';
    
    // 간단한 캐시 시스템
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5분
  }

  /**
   * 액면예산 타입에 따른 컬럼 매핑 반환
   */
  getColumnMapping(budgetType) {
    if (budgetType === 'Ⅱ') {
      return {
        remainingBudget: 'I', // 예산잔액
        securedBudget: 'J',   // 확보예산  
        usedBudget: 'K',      // 사용예산
        owner: 'B',           // 입력자(Ⅱ)
        timestamp: 'C'        // 입력일시(Ⅱ)
      };
    } else {
      // 기본값: 액면예산(Ⅰ)
      return {
        remainingBudget: 'L', // 예산잔액
        securedBudget: 'M',   // 확보예산
        usedBudget: 'N',      // 사용예산
        owner: 'D',           // 입력자(Ⅰ)
        timestamp: 'E'        // 입력일시(Ⅰ)
      };
    }
  }

  /**
   * 폰클개통데이터에서 현재 데이터 읽기 (소유권 정보 포함)
   */
  async readCurrentData(sheetId, budgetType) {
    console.log(`📱 [PhoneklDataManager] 현재 데이터 읽기 시작: ${budgetType}`);
    
    const columns = this.getColumnMapping(budgetType);
    // B열부터 P열까지 읽기 (B,C: 소유권정보(Ⅱ), D,E: 소유권정보(Ⅰ), I,J,K: 예산데이터(Ⅱ), L,M,N: 예산데이터(Ⅰ))
    const range = `${this.phoneklSheetName}!B:P`;
    
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range
    });
    
    const data = response.data.values || [];
    console.log(`📱 [PhoneklDataManager] 읽기 완료: ${data.length}행 (소유권 정보 포함)`);
    
    return data;
  }

  /**
   * 안전한 데이터 업데이트 (기존 데이터 보존)
   */
  async safeUpdateData(sheetId, budgetType, newDataMap, userInfo, dateRange = null) {
    console.log(`🔒 [PhoneklDataManager] 안전 업데이트 시작: ${budgetType}, 사용자: ${userInfo.userName}`);
    
    try {
      // 1. 현재 데이터 읽기
      const currentData = await this.readCurrentData(sheetId, budgetType);
      const columns = this.getColumnMapping(budgetType);
      
      // 2. 날짜 필터링을 위한 전체 데이터 한 번만 읽기 (캐시 활용)
      let fullData = null;
      if (dateRange) {
        console.log(`📅 [PhoneklDataManager] 날짜 필터링을 위한 전체 데이터 읽기 시작`);
        
        // 캐시 키 생성
        const cacheKey = `phonekl_full_data_${sheetId}`;
        
        // 캐시에서 먼저 확인
        const cachedData = this.getFromCache(cacheKey);
        if (cachedData) {
          fullData = cachedData;
          console.log(`📅 [PhoneklDataManager] 캐시에서 데이터 로드: ${fullData.length}행`);
        } else {
          const fullRange = `${this.phoneklSheetName}!A:AG`;
          const fullResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: fullRange
          });
          fullData = fullResponse.data.values || [];
          console.log(`📅 [PhoneklDataManager] 전체 데이터 읽기 완료: ${fullData.length}행`);
          
          // 캐시에 저장
          this.setToCache(cacheKey, fullData);
        }
      }
      
      // 3. 업데이트할 요청들 준비
      const updateRequests = [];
      let preservedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let dateFilteredCount = 0;
      
      // 4. 헤더 행 건너뛰고 데이터 시작 행부터 처리 (5행부터)
      const dataStartRow = 4; // 0-based index로 4 (실제 5행)
      
      console.log(`📊 [CRITICAL] PhoneklDataManager 처리 시작: 신규 매핑 데이터=${Object.keys(newDataMap).length}개`);
      
      for (let rowIndex = dataStartRow; rowIndex < currentData.length; rowIndex++) {
        const currentRow = currentData[rowIndex];
        const actualRowNumber = rowIndex + 1; // Google Sheets 행 번호 (1-based)
        
        // 날짜 필터링 적용 (계산 로직과 동일)
        let isInDateRange = true;
        if (dateRange && fullData && fullData[rowIndex] && fullData[rowIndex].length >= 23) {
          const receptionDate = this.normalizeReceptionDate(fullData[rowIndex][16]); // Q열: 접수일
          const activationDate = this.normalizeActivationDate(fullData[rowIndex][20], fullData[rowIndex][21], fullData[rowIndex][22]); // U, V, W열: 개통일
          
          // 접수일 적용이 체크되어 있고, 접수일 범위가 설정되어 있으면 접수일 조건 확인
          if (dateRange.applyReceiptDate && dateRange.receiptStartDate && dateRange.receiptEndDate) {
            const receptionInRange = receptionDate ? this.isDateInRange(receptionDate, dateRange.receiptStartDate, dateRange.receiptEndDate) : false;
            isInDateRange = isInDateRange && receptionInRange;
          }
          
          // 개통일 범위가 설정되어 있으면 개통일 조건 확인 (항상 확인)
          if (dateRange.activationStartDate && dateRange.activationEndDate) {
            const activationInRange = activationDate ? this.isDateInRange(activationDate, dateRange.activationStartDate, dateRange.activationEndDate) : false;
            isInDateRange = isInDateRange && activationInRange;
          }
          
          // 디버깅: 처음 몇 행만 로그 출력
          if (rowIndex < 5) {
            console.log(`🔍 [Row ${actualRowNumber}] 날짜 필터링: 접수일=${receptionDate}, 개통일=${activationDate}, 범위내=${isInDateRange}`);
          }
        }
        
        // 날짜 범위에 포함되지 않는 경우 건너뛰기
        if (!isInDateRange) {
          dateFilteredCount++;
          continue;
        }
        
        // B열부터 읽었으므로 인덱스 조정
        // 예산타입에 따른 소유권 정보 컬럼 결정 (B열부터 0-based)
        let existingOwner, existingTimestamp;
        if (budgetType === 'Ⅱ') {
          existingOwner = currentRow?.[0] || ''; // B열: 입력자(Ⅱ) (B열부터 0번째)
          existingTimestamp = currentRow?.[1] || ''; // C열: 입력일시(Ⅱ) (B열부터 1번째)
        } else {
          existingOwner = currentRow?.[2] || ''; // D열: 입력자(Ⅰ) (B열부터 2번째)
          existingTimestamp = currentRow?.[3] || ''; // E열: 입력일시(Ⅰ) (B열부터 3번째)
        }
        
        // 예산타입에 따른 예산 데이터 컬럼 결정 (B열부터 0-based)
        let existingRemainingBudget, existingSecuredBudget, existingUsedBudget;
        if (budgetType === 'Ⅱ') {
          existingRemainingBudget = currentRow?.[7] || ''; // I열: 예산잔액 (B열부터 7번째)
          existingSecuredBudget = currentRow?.[8] || ''; // J열: 확보예산 (B열부터 8번째)
          existingUsedBudget = currentRow?.[9] || ''; // K열: 사용예산 (B열부터 9번째)
        } else {
          existingRemainingBudget = currentRow?.[10] || ''; // L열: 예산잔액 (B열부터 10번째)
          existingSecuredBudget = currentRow?.[11] || ''; // M열: 확보예산 (B열부터 11번째)
          existingUsedBudget = currentRow?.[12] || ''; // N열: 사용예산 (B열부터 12번째)
        }
        
        // 해당 행에 매핑된 새 데이터가 있는지 확인
        const newData = newDataMap[actualRowNumber];
        
        if (newData) {
          // 예산타입을 포함한 소유권 식별자 생성
          const currentOwnerWithType = `${userInfo.userName}(${userInfo.budgetType})`;
          
          // 소유권 확인: 해당 예산타입의 셀들이 비어있거나 같은 사용자+예산타입인 경우만 업데이트
          const budgetCellsEmpty = this.isEmpty(existingRemainingBudget) && 
                                   this.isEmpty(existingSecuredBudget) && 
                                   this.isEmpty(existingUsedBudget);
          const sameOwner = existingOwner === currentOwnerWithType;
          const canUpdate = budgetCellsEmpty || sameOwner;
          
          if (canUpdate) {
            const updates = [];
            const currentTime = new Date().toISOString();
            
            // 예산잔액 업데이트
            if (!this.isEmpty(newData.remainingBudget)) {
              updates.push({
                range: `${this.phoneklSheetName}!${columns.remainingBudget}${actualRowNumber}`,
                values: [[newData.remainingBudget]]
              });
            }
            
            // 확보예산 업데이트
            if (!this.isEmpty(newData.securedBudget)) {
              updates.push({
                range: `${this.phoneklSheetName}!${columns.securedBudget}${actualRowNumber}`,
                values: [[newData.securedBudget]]
              });
            }
            
            // 사용예산 업데이트
            if (!this.isEmpty(newData.usedBudget)) {
              updates.push({
                range: `${this.phoneklSheetName}!${columns.usedBudget}${actualRowNumber}`,
                values: [[newData.usedBudget]]
              });
            }
            
            // 소유권 정보 업데이트 (사용자명+예산타입)
            if (updates.length > 0) {
              const timestampWithType = `${currentTime} (${userInfo.budgetType})`;
              
              updates.push({
                range: `${this.phoneklSheetName}!${columns.owner}${actualRowNumber}`,
                values: [[currentOwnerWithType]]
              });
              updates.push({
                range: `${this.phoneklSheetName}!${columns.timestamp}${actualRowNumber}`,
                values: [[timestampWithType]]
              });
              
              updateRequests.push(...updates);
              updatedCount += updates.length;
            }
          } else {
            // 다른 사용자 또는 다른 예산타입의 데이터이므로 보존
            preservedCount++;
            console.log(`🔒 [Row ${actualRowNumber}] 다른 사용자/타입 데이터 보존: ${existingOwner} vs ${currentOwnerWithType}`);
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
        dateFilteredRows: dateFilteredCount,
        budgetType,
        userInfo,
        message: `업데이트: ${updateRequests.length}개 셀, 보존: ${preservedCount}개 셀, 건너뜀: ${skippedCount}행, 날짜필터: ${dateFilteredCount}행`
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
   * 캐시에서 데이터 가져오기
   */
  getFromCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    const now = Date.now();
    if (now > item.timestamp + this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  /**
   * 캐시에 데이터 저장하기
   */
  setToCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 접수일 정규화 (계산 로직과 동일)
   */
  normalizeReceptionDate(dateValue) {
    if (!dateValue || typeof dateValue !== 'string') return null;
    
    // 다양한 날짜 형식 처리
    const dateStr = dateValue.toString().trim();
    
    // 2025-01-16 형식
    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // 2025/01/16 형식
    const slashMatch = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (slashMatch) {
      const [, year, month, day] = slashMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // 01/16 형식 (현재 연도 가정)
    const shortMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})/);
    if (shortMatch) {
      const [, month, day] = shortMatch;
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, parseInt(month) - 1, parseInt(day));
    }
    
    return null;
  }

  /**
   * 개통일 정규화 (계산 로직과 동일)
   */
  normalizeActivationDate(dateValue, timeValue, timezoneValue) {
    if (!dateValue || typeof dateValue !== 'string') return null;
    
    const dateStr = dateValue.toString().trim();
    
    // 2025-01-16 형식
    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // 2025/01/16 형식
    const slashMatch = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (slashMatch) {
      const [, year, month, day] = slashMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // 01/16 형식 (현재 연도 가정)
    const shortMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})/);
    if (shortMatch) {
      const [, month, day] = shortMatch;
      return new Date(currentYear, parseInt(month) - 1, parseInt(day));
    }
    
    return null;
  }

  /**
   * 날짜가 범위 내에 있는지 확인 (계산 로직과 동일)
   */
  isDateInRange(targetDate, startDate, endDate) {
    if (!targetDate || !startDate || !endDate) return false;
    
    try {
      const target = new Date(targetDate);
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // 시간 정보 제거하고 날짜만 비교
      target.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      const result = target >= start && target <= end;
      
      // 디버깅: 처음 몇 번만 로그 출력
      if (Math.random() < 0.01) { // 1% 확률로 로그 출력
        console.log(`📅 [isDateInRange] target=${targetDate}(${target.toISOString()}), start=${startDate}(${start.toISOString()}), end=${endDate}(${end.toISOString()}), result=${result}`);
      }
      
      return result;
    } catch (error) {
      console.error('날짜 범위 확인 오류:', error);
      return false;
    }
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
