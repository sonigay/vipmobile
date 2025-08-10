const { v4: uuidv4 } = require('uuid');

/**
 * 예산_사용자시트관리 전용 관리 클래스
 * 동시성 보장, 트랜잭션 처리, 데이터 무결성 보장
 */
class UserSheetManager {
  constructor(sheets, spreadsheetId) {
    this.sheets = sheets;
    this.spreadsheetId = spreadsheetId;
    this.sheetName = '예산_사용자시트관리';
    this.isProcessing = false; // 동시 접근 방지용 플래그
    this.pendingOperations = []; // 대기 중인 작업 큐
  }

  /**
   * 동시 접근 방지를 위한 뮤텍스 패턴
   */
  async withLock(operation, operationName = 'Unknown') {
    return new Promise((resolve, reject) => {
      const executeOperation = async () => {
        if (this.isProcessing) {
          // 다른 작업이 진행 중이면 큐에 추가
          this.pendingOperations.push(executeOperation);
          return;
        }

        this.isProcessing = true;
        try {
          console.log(`🔒 [UserSheetManager] 작업 시작: ${operationName}`);
          const result = await operation();
          console.log(`✅ [UserSheetManager] 작업 완료: ${operationName}`);
          resolve(result);
        } catch (error) {
          console.error(`❌ [UserSheetManager] 작업 실패: ${operationName}`, error);
          reject(error);
        } finally {
          this.isProcessing = false;
          
          // 대기 중인 다음 작업 실행
          if (this.pendingOperations.length > 0) {
            const nextOperation = this.pendingOperations.shift();
            setImmediate(nextOperation);
          }
        }
      };

      executeOperation();
    });
  }

  /**
   * 시트 존재 확인 및 헤더 설정
   */
  async ensureSheetExists() {
    const operation = async () => {
      console.log(`📋 [UserSheetManager] 시트 존재 확인: ${this.sheetName}`);
      
      try {
        // 시트 목록 조회
        const spreadsheetResponse = await this.sheets.spreadsheets.get({
          spreadsheetId: this.spreadsheetId
        });
        
        const sheetExists = spreadsheetResponse.data.sheets.some(
          sheet => sheet.properties.title === this.sheetName
        );
        
        if (!sheetExists) {
          console.log(`🔨 [UserSheetManager] 시트 생성: ${this.sheetName}`);
          
          // 시트 생성
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
              requests: [{
                addSheet: {
                  properties: {
                    title: this.sheetName,
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 12 // L열까지
                    }
                  }
                }
              }]
            }
          });
        }
        
        // 헤더 설정 (확장된 구조)
        const headerRow = [
          '사용자ID', '시트ID', '시트명', '생성일시', '생성자', '대상월', '선택된정책그룹',
          '접수시작일', '접수종료일', '개통시작일', '개통종료일', 'UUID'
        ];
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A1:L1`,
          valueInputOption: 'RAW',
          resource: {
            values: [headerRow]
          }
        });
        
        console.log(`✅ [UserSheetManager] 시트 및 헤더 설정 완료`);
        return true;
        
      } catch (error) {
        console.error(`❌ [UserSheetManager] 시트 설정 실패:`, error);
        throw error;
      }
    };

    return this.withLock(operation, 'ensureSheetExists');
  }

  /**
   * 새 사용자 시트 레코드 추가
   */
  async addUserSheet(sheetData) {
    const operation = async () => {
      console.log(`📝 [UserSheetManager] 새 시트 레코드 추가:`, sheetData.userSheetName);
      
      const uuid = uuidv4();
      const currentTime = new Date().toISOString();
      
      const newRow = [
        sheetData.userId,           // A열: 사용자ID
        sheetData.targetSheetId,    // B열: 시트ID
        sheetData.userSheetName,    // C열: 시트명
        currentTime,                // D열: 생성일시
        sheetData.userName,         // E열: 생성자
        sheetData.targetMonth,      // F열: 대상월
        sheetData.selectedPolicyGroups ? sheetData.selectedPolicyGroups.join(',') : '', // G열: 선택된정책그룹
        sheetData.dateRange?.receiptStartDate || '', // H열: 접수시작일
        sheetData.dateRange?.receiptEndDate || '',   // I열: 접수종료일
        sheetData.dateRange?.activationStartDate || '', // J열: 개통시작일
        sheetData.dateRange?.activationEndDate || '',   // K열: 개통종료일
        uuid                        // L열: UUID
      ];
      
      console.log(`🚀 [UserSheetManager] append 실행 - 새 데이터:`, newRow);
      
      const appendResult = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:L`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [newRow]
        }
      });
      
      console.log(`✅ [UserSheetManager] append 완료 - 업데이트된 범위:`, appendResult.data.updates.updatedRange);
      
      return {
        uuid,
        createdAt: currentTime,
        updatedRange: appendResult.data.updates.updatedRange
      };
    };

    return this.withLock(operation, 'addUserSheet');
  }

  /**
   * 사용자별 시트 목록 조회 (권한 기반 필터링)
   */
  async getUserSheets(options = {}) {
    const operation = async () => {
      console.log(`🔍 [UserSheetManager] 사용자 시트 목록 조회:`, options);
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:L`
      });
      
      const rows = response.data.values || [];
      if (rows.length <= 1) {
        console.log(`📋 [UserSheetManager] 데이터 없음`);
        return [];
      }
      
      const headers = rows[0];
      const dataRows = rows.slice(1);
      
      const filteredSheets = dataRows
        .filter(row => {
          if (row.length < 12) return false;
          
          const [userId, sheetId, sheetName] = row;
          
          // 예산 타입별 필터링 (budgetType 파라미터 기준)
          if (options.budgetType) {
            const requestedType = options.budgetType; // 'Ⅰ' 또는 'Ⅱ'
            const hasRequestedType = sheetName.includes(`(${requestedType})`);
            
            if (!hasRequestedType) {
              return false; // 요청된 예산 타입이 아닌 시트 제외
            }
          }
          
          // 소유권 기반 필터링
          const isTypeI = sheetName.includes('(Ⅰ)');
          const isTypeII = sheetName.includes('(Ⅱ)');
          const isOwnSheet = userId === options.userId;
          
          // 액면예산(Ⅰ): 모든 사용자 시트 표시 (필터링 없음)
          // 액면예산(Ⅱ): 본인의 시트만 표시
          if (isTypeII && !isOwnSheet) {
            return false; // 액면예산(Ⅱ)이면서 본인 시트가 아닌 경우 제외
          }
          
          // 대상월 필터링
          if (options.targetMonth && row[5] !== options.targetMonth) {
            return false;
          }
          
          // showAllUsers가 false면 본인 것만
          if (!options.showAllUsers && !isOwnSheet) {
            return false;
          }
          
          return true;
        })
        .map(row => ({
          uuid: row[11],
          userId: row[0],
          sheetId: row[1],
          sheetName: row[2],
          createdAt: row[3],
          createdBy: row[4],
          targetMonth: row[5],
          selectedPolicyGroups: row[6] ? row[6].split(',') : [],
          dateRange: {
            receiptStartDate: row[7] || '',
            receiptEndDate: row[8] || '',
            activationStartDate: row[9] || '',
            activationEndDate: row[10] || ''
          }
        }));
      
      console.log(`📋 [UserSheetManager] 조회 결과: ${filteredSheets.length}개`);
      return filteredSheets;
    };

    return this.withLock(operation, 'getUserSheets');
  }

  /**
   * UUID로 특정 레코드 삭제 (작성자 본인만 가능)
   */
  async deleteUserSheet(uuid, requestUserId) {
    const operation = async () => {
      console.log(`🗑️ [UserSheetManager] 시트 삭제 요청: ${uuid} by ${requestUserId}`);
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:L`
      });
      
      const rows = response.data.values || [];
      const targetRowIndex = rows.findIndex(row => row[11] === uuid);
      
      if (targetRowIndex === -1) {
        throw new Error('삭제할 시트를 찾을 수 없습니다.');
      }
      
      if (targetRowIndex === 0) {
        throw new Error('헤더는 삭제할 수 없습니다.');
      }
      
      const targetRow = rows[targetRowIndex];
      const creatorUserId = targetRow[0];
      
      // 작성자 본인만 삭제 가능
      if (creatorUserId !== requestUserId) {
        throw new Error('본인이 작성한 시트만 삭제할 수 있습니다.');
      }
      
      // 시트 ID 조회하여 실제 Google Sheets에서도 시트 삭제
      const sheetIdToDelete = await this.getSheetIdByName(targetRow[2]); // 시트명으로 ID 조회
      
      // 행 삭제
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: await this.getSheetIdByName(this.sheetName),
                dimension: 'ROWS',
                startIndex: targetRowIndex,
                endIndex: targetRowIndex + 1
              }
            }
          }]
        }
      });
      
      console.log(`✅ [UserSheetManager] 시트 삭제 완료: ${uuid}`);
      return { success: true, deletedSheetName: targetRow[2] };
    };

    return this.withLock(operation, 'deleteUserSheet');
  }

  /**
   * 시트 이름으로 시트 ID 조회 헬퍼
   */
  async getSheetIdByName(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
      return sheet ? sheet.properties.sheetId : null;
    } catch (error) {
      console.error('시트 ID 조회 오류:', error);
      return null;
    }
  }
}

module.exports = UserSheetManager;
