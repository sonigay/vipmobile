/**
 * Policy Routes - 원본 로직 복사
 * 정책 관리 관련 API 엔드포인트
 * 
 * 원본 파일: server/index.js.backup.original (27159-30100줄)
 */

const express = require('express');
const router = express.Router();
const dalFactory = require('../dal/DALFactory');

function createPolicyRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  // Google Sheets 클라이언트 확인
  const requireSheetsClient = (res) => {
    if (!sheetsClient || !sheetsClient.sheets || !sheetsClient.SPREADSHEET_ID) {
      res.status(503).json({ success: false, error: 'Google Sheets client not available' });
      return false;
    }
    return true;
  };

  const sheets = sheetsClient?.sheets;
  const SPREADSHEET_ID = sheetsClient?.SPREADSHEET_ID;
  const STORE_SHEET_NAME = '폰클출고처데이터';
  const UPDATE_SHEET_NAME = '어플업데이트';

  // 캐시 없이 시트 데이터 가져오기
  async function getSheetValuesWithoutCache(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:AZ`
      })
    );
    return response.data.values || [];
  }

  // 캐시 사용하여 시트 데이터 가져오기
  async function getSheetValues(sheetName) {
    const cacheKey = `sheet_${sheetName}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    const values = await getSheetValuesWithoutCache(sheetName);
    cacheManager.set(cacheKey, values, 5 * 60 * 1000); // 5분 캐시
    return values;
  }

  // 시트 ID 가져오기
  async function getSheetIdByName(sheetName) {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : null;
  }

  // 정책 알림 생성 (간단한 버전)
  async function createPolicyNotification(policyId, userId, type) {
    // 알림 로직은 필요시 구현
    console.log('정책 알림 생성:', { policyId, userId, type });
  }

  // 캐시 유틸리티
  const cacheUtils = {
    delete: (key) => {
      cacheManager.delete(key);
    }
  };

  // ============================================================================
  // GET /api/policies - 정책 목록 조회
  // ============================================================================
  router.get('/policies', async (req, res) => {
    try {
      console.log('정책 목록 조회 요청:', req.query);

      const { yearMonth, policyType, category, userId, approvalStatus } = req.query;

      // 🔥 DAL 사용: Feature Flag에 따라 Supabase 또는 Google Sheets 자동 전환
      const dal = dalFactory.getDAL('policy');
      let dataRows = [];

      try {
        // Supabase에서 조회 시도
        const policies = await dal.read('policy_basic_info', {});
        
        // Supabase 데이터를 Google Sheets 형식으로 변환 (기존 로직 재사용)
        dataRows = policies.map(p => [
          p["정책ID"], p["정책명"], p["정책적용일"], p["정책적용점"], p["정책내용"],
          p["금액"], p["정책유형"], p["무선유선"], p["하위카테고리"], p["입력자ID"],
          p["입력자명"], p["입력일시"], p["승인상태_총괄"], p["승인상태_정산팀"], p["승인상태_소속팀"],
          p["정책상태"], p["취소사유"], p["취소일시"], p["취소자명"], p["정산반영상태"],
          p["정산반영자명"], p["정산반영일시"], p["정산반영자ID"], p["대상년월"], p["복수점명"],
          p["업체명"], p["개통유형"], p["95군이상금액"], p["95군미만금액"], p["소속팀"],
          p["부가미유치금액"], p["보험미유치금액"], p["연결음미유치금액"], p["부가유치시조건"], p["보험유치시조건"],
          p["연결음유치시조건"], p["유플레이프리미엄유치금액"], p["폰교체패스유치금액"], p["음악감상유치금액"], p["지정번호필터링유치금액"],
          p["VAS2종동시유치조건"], p["VAS2종중1개유치조건"], p["부가3종모두유치조건"], p["요금제유형별정책JSON"], p["정산입금처"],
          p["연합대상하부점JSON"], p["조건JSON"], p["적용대상JSON"], p["개통유형_개별"], p["담당자명"], p["직접입력여부"]
        ]);
        
        console.log(`📊 [정책조회] Supabase에서 가져온 데이터: ${dataRows.length}개`);
      } catch (dalError) {
        console.warn('[정책조회] DAL 조회 실패, Google Sheets 폴백:', dalError.message);
        
        // Google Sheets 폴백
        if (!requireSheetsClient(res)) return;
        const values = await getSheetValuesWithoutCache('정책_기본정보 ');
        dataRows = values.length > 1 ? values.slice(1) : values;
      }

      console.log(`📊 [정책조회] 시트에서 가져온 데이터:`, {
        totalRows: dataRows ? dataRows.length : 0,
        firstRow: dataRows && dataRows.length > 0 ? dataRows[0] : null,
        lastRow: dataRows && dataRows.length > 1 ? dataRows[dataRows.length - 1] : null
      });

      if (!dataRows || dataRows.length === 0) {
        console.log('정책 데이터가 없습니다.');
        return res.json({ success: true, policies: [] });
      }

      // 필터링 적용
      let filteredPolicies = dataRows.filter(row => {
        if (row.length < 24) return false; // 최소 컬럼 수 확인 (A~X열, 기존 데이터 호환성)

        const policyYearMonth = row[23] || ''; // X열: 대상년월
        const policyTypeData = row[6];   // G열: 정책유형
        const categoryData = row[7];     // H열: 무선/유선
        const subCategory = row[8];      // I열: 하위카테고리
        const inputUserId = row[9];      // J열: 입력자ID
        const totalApproval = row[12];   // M열: 승인상태_총괄
        const settlementApproval = row[13]; // N열: 승인상태_정산팀
        const teamApproval = row[14];    // O열: 승인상태_소속팀

        // 년월 필터
        if (yearMonth && policyYearMonth && policyYearMonth !== yearMonth) {
          return false;
        }

        // 년월 필터 통과 로그
        if (yearMonth && policyYearMonth && policyYearMonth === yearMonth) {
          console.log(`✅ [정책필터] yearMonth 일치: ${policyYearMonth} === ${yearMonth}`);
        }

        // 정책유형 필터 (URL 디코딩 및 처리)
        if (policyType) {
          const decodedPolicyType = decodeURIComponent(policyType);
          // "무선:1" 형태에서 "무선" 부분만 추출
          const cleanPolicyType = decodedPolicyType.split(':')[0];
          if (policyTypeData !== cleanPolicyType) {
            return false;
          }
        }

        // 카테고리 필터
        if (category && subCategory !== category) {
          return false;
        }

        // 사용자 필터
        if (userId && inputUserId !== userId) {
          return false;
        }

        // 승인상태 필터
        if (approvalStatus) {
          const hasApprovalStatus = [totalApproval, settlementApproval, teamApproval].includes(approvalStatus);
          if (!hasApprovalStatus) {
            return false;
          }
        }

        return true;
      });

      // 매장 데이터 가져오기 (업체명 매핑용)
      let storeData = [];
      try {
        const storeValues = await getSheetValuesWithoutCache(STORE_SHEET_NAME);
        if (storeValues && storeValues.length > 1) {
          const storeRows = storeValues.slice(1);
          storeData = storeRows
            .filter(row => {
              const name = (row[14] || '').toString().trim();  // O열: 업체명 (14인덱스)
              const status = row[12];                          // M열: 거래상태 (12번째 컬럼)
              return name && status === "사용";
            })
            .map(row => ({
              id: row[15],                        // P열: 매장코드 (15인덱스)
              name: row[14].toString().trim()   // O열: 업체명 (14인덱스)
            }));
        }
      } catch (error) {
        console.warn('매장 데이터 가져오기 실패:', error.message);
      }

      // 매장 ID로 업체명을 찾는 함수
      const getStoreNameById = (storeId) => {
        if (!storeId || !storeData.length) return '';
        const store = storeData.find(s => s.id && s.id.toString() === storeId.toString());
        return store ? store.name : '';
      };

      // 정책 데이터 변환 (매우 긴 로직이므로 계속...)
      const policies = filteredPolicies.map(row => {
        const policyStore = row[3]; // D열: 정책적용점
        const storeName = getStoreNameById(policyStore);

        return {
          id: row[0],                    // A열: 정책ID
          policyName: row[1],            // B열: 정책명
          policyDate: row[2],            // C열: 정책적용일 (시작일~종료일)
          policyStore: policyStore,      // D열: 정책적용점 (코드)
          policyStoreName: storeName,    // 매장명 (매핑된 업체명)
          policyContent: row[4],         // E열: 정책내용
          policyAmount: (() => {         // F열: 금액 (금액 + 유형)
            const amountStr = row[5] || '';
            // "100,000원 (총금액)" 형식에서 숫자만 추출
            const match = amountStr.match(/^([\d,]+)원/);
            if (match) {
              return match[1].replace(/,/g, ''); // 쉼표 제거하고 숫자만 반환
            }
            return amountStr;
          })(),
          amountType: (() => {           // F열에서 금액 유형 추출
            const amountStr = row[5] || '';
            if (amountStr.includes('총금액')) return 'total';
            if (amountStr.includes('건당금액')) return 'per_case';
            if (amountStr.includes('내용에 직접입력')) return 'in_content';
            return 'total';
          })(),
          policyType: row[6],            // G열: 정책유형
          wirelessWired: row[7],         // H열: 무선/유선
          category: row[8],              // I열: 하위카테고리
          inputUserId: row[9],           // J열: 입력자ID
          inputUserName: row[10],        // K열: 입력자명
          inputDateTime: row[11],        // L열: 입력일시
          approvalStatus: {
            total: row[12] || '대기',     // M열: 승인상태_총괄
            settlement: row[13] || '대기', // N열: 승인상태_정산팀
            team: row[14] || '대기'       // O열: 승인상태_소속팀
          },
          // 취소 관련 정보 추가
          policyStatus: row[15] || '활성', // P열: 정책상태
          cancelReason: row[16] || '',    // Q열: 취소사유
          cancelDateTime: row[17] || '',  // R열: 취소일시
          cancelUserName: row[18] || '',  // S열: 취소자명
          // 정산 반영 관련 정보 추가
          settlementStatus: row[19] || '미반영', // T열: 정산반영상태
          settlementUserName: row[20] || '',     // U열: 정산반영자명
          settlementDateTime: row[21] || '',     // V열: 정산반영일시
          settlementUserId: row[22] || '',       // W열: 정산반영자ID
          yearMonth: row[23] || '',               // X열: 대상년월
          multipleStoreName: row[24] || null,     // Y열: 복수점명
          isMultiple: (row[24] && row[24].trim()) ? true : false, // 복수점명이 있으면 복수점
          storeNameFromSheet: row[25] || '',       // Z열: 업체명 (시트에서 직접 읽은 값)
          activationTypeFromSheet: row[26] || '',   // AA열: 개통유형 (시트에서 직접 읽은 값)
          amount95Above: row[27] || '',            // AB열: 95군이상금액
          amount95Below: row[28] || '',            // AC열: 95군미만금액
          team: (() => {
            const teamValue = row[29];
            // 기존 정책들 (24개 컬럼)은 소속팀 정보가 없으므로 '미지정'
            if (row.length < 30) {
              return '미지정';
            }
            // JSON 문자열인지 확인 (잘못 저장된 데이터 처리)
            if (teamValue && typeof teamValue === 'string') {
              if (teamValue.trim().startsWith('{') && teamValue.trim().endsWith('}')) {
                console.warn('⚠️ [정책목록] AD열에 JSON 문자열이 저장되어 있음:', teamValue, '정책ID:', row[0]);
                return '미지정';
              }
            }
            return teamValue || '미지정';
          })(),         // AD열: 소속팀
          teamName: (() => {
            const teamValue = row[29];
            if (row.length < 30) {
              return '미지정';
            }
            if (teamValue && typeof teamValue === 'string') {
              if (teamValue.trim().startsWith('{') && teamValue.trim().endsWith('}')) {
                return '미지정';
              }
            }
            return teamValue || '미지정';
          })(),         // 팀 이름
          // 부가차감지원정책 관련 데이터
          deductSupport: {
            addServiceAmount: row[30] || '',        // AE열: 부가미유치금액
            insuranceAmount: row[31] || '',         // AF열: 보험미유치금액
            connectionAmount: row[32] || ''         // AG열: 연결음미유치금액
          },
          conditionalOptions: {
            addServiceAcquired: row[33] === 'Y',    // AH열: 부가유치시조건
            insuranceAcquired: row[34] === 'Y',     // AI열: 보험유치시조건
            connectionAcquired: row[35] === 'Y'     // AJ열: 연결음유치시조건
          },
          // 부가추가지원정책 관련 데이터
          addSupport: {
            uplayPremiumAmount: row[36] || '',      // AK열: 유플레이(프리미엄) 유치금액
            phoneExchangePassAmount: row[37] || '', // AL열: 폰교체패스 유치금액
            musicAmount: row[38] || '',             // AM열: 음악감상 유치금액
            numberFilteringAmount: row[39] || ''    // AN열: 지정번호필터링 유치금액
          },
          supportConditionalOptions: {
            vas2Both: row[40] === 'Y',              // AO열: VAS 2종 동시유치 조건
            vas2Either: row[41] === 'Y',            // AP열: VAS 2종중 1개유치 조건
            addon3All: row[42] === 'Y'              // AQ열: 부가3종 모두유치 조건
          },
          // 요금제유형별정책 관련 데이터
          rateSupports: (() => {
            try {
              return JSON.parse(row[43] || '[]');  // AR열: 요금제유형별정책 지원사항 (JSON)
            } catch (error) {
              return [];
            }
          })(),
          // isDirectInput: AY열에서 읽거나, 없으면 rateSupports와 policyContent로 판단
          isDirectInput: (() => {
            // AY열이 있으면 Y/N을 boolean으로 변환
            if (row.length >= 51 && row[50] !== undefined && row[50] !== null && row[50] !== '') {
              const ayValue = row[50].toString().trim();
              return ayValue === 'Y' || ayValue === 'true';
            }
            // 기존 데이터는 AY열이 없으므로 rateSupports와 policyContent로 판단
            const category = row[8]; // I열: 하위카테고리
            if (category === 'wireless_rate' || category === 'wired_rate') {
              try {
                const rateSupports = JSON.parse(row[43] || '[]');
                const hasRateSupports = Array.isArray(rateSupports) && rateSupports.length > 0;
                const hasPolicyContent = row[4] && row[4].toString().trim(); // E열: 정책내용
                return !hasRateSupports && !!hasPolicyContent;
              } catch (error) {
                const hasPolicyContent = row[4] && row[4].toString().trim();
                return !!hasPolicyContent;
              }
            }
            return false;
          })(),
          // 연합정책 관련 데이터
          unionSettlementStore: row[44] || '',  // AS열: 정산 입금처
          unionTargetStores: (() => {
            try {
              return JSON.parse(row[45] || '[]');  // AT열: 연합대상하부점 (JSON)
            } catch (error) {
              return [];
            }
          })(),
          unionConditions: (() => {
            try {
              return JSON.parse(row[46] || '{}');  // AU열: 조건 (JSON)
            } catch (error) {
              return {};
            }
          })(),
          // 개별소급정책 관련 데이터
          individualTarget: (() => {
            try {
              return JSON.parse(row[47] || '{}');  // AV열: 적용대상 (JSON)
            } catch (error) {
              return {};
            }
          })(),
          individualActivationType: row[48] || '',  // AW열: 개통유형
          manager: row[49] || '',  // AX열: 담당자명
          // activationType을 객체로 파싱
          activationType: (() => {
            const activationTypeStr = row[26] || '';
            if (!activationTypeStr) return { new010: false, mnp: false, change: false };

            const hasNew010 = activationTypeStr.includes('010신규');
            const hasMnp = activationTypeStr.includes('MNP');
            const hasChange = activationTypeStr.includes('기변');

            return {
              new010: hasNew010,
              mnp: hasMnp,
              change: hasChange
            };
          })()
        };
      });

      // 복수점 정책 그룹화 및 복수점명 추가
      const policyGroups = new Map();
      const processedPolicies = [];

      policies.forEach(policy => {
        // 정책명과 입력자ID로 그룹화
        const groupKey = `${policy.policyName}_${policy.inputUserId}_${policy.inputDateTime}`;

        if (!policyGroups.has(groupKey)) {
          policyGroups.set(groupKey, {
            policies: [],
            groupName: policy.policyName
          });
        }

        policyGroups.get(groupKey).policies.push(policy);
      });

      // 각 그룹에서 복수점명 추가
      policyGroups.forEach((group, groupKey) => {
        if (group.policies.length > 1) {
          // 복수점 정책인 경우
          const multipleStoreName = group.policies[0].multipleStoreName || '복수점';

          group.policies.forEach(policy => {
            processedPolicies.push({
              ...policy,
              isMultiple: true,
              multipleStoreName: multipleStoreName
            });
          });
        } else {
          // 단일 그룹이지만 복수점명이 있는 경우
          group.policies.forEach(policy => {
            const hasMultipleStoreName = policy.multipleStoreName && policy.multipleStoreName.trim();
            processedPolicies.push({
              ...policy,
              isMultiple: hasMultipleStoreName ? true : false,
              multipleStoreName: hasMultipleStoreName ? policy.multipleStoreName : null
            });
          });
        }
      });

      console.log(`정책 목록 조회 완료: ${processedPolicies.length}건`);

      res.json({ success: true, policies: processedPolicies });

    } catch (error) {
      console.error('정책 목록 조회 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });


  // ============================================================================
  // 나머지 정책 API 엔드포인트들 (간단한 버전)
  // 원본 로직이 매우 복잡하므로 필요시 추가 작업 필요
  // ============================================================================

  // POST /api/policies - 정책 생성 (원본 로직 복사 - 약 500줄)
  router.post('/policies', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      console.log('새 정책 생성 요청:', req.body);

      const {
        policyName,
        policyStartDate,
        policyEndDate,
        policyStore,
        policyContent,
        policyAmount,
        amountType,
        policyType,
        category,
        yearMonth,
        inputUserId,
        inputUserName,
        policyTeam
      } = req.body;

      // 구두정책 여부 확인
      const isShoePolicy = category === 'wireless_shoe' || category === 'wired_shoe';
      const isAddDeductPolicy = category === 'wireless_add_deduct' || category === 'wired_add_deduct';

      // 필수 필드 검증
      const missingFields = [];
      if (!policyName) missingFields.push('policyName');
      if (!policyStartDate) missingFields.push('policyStartDate');
      if (!policyEndDate) missingFields.push('policyEndDate');
      
      // 연합정책이 아닐 때만 policyStore 검증
      const isUnionPolicy = category === 'wireless_union' || category === 'wired_union';
      if (!isUnionPolicy && !policyStore) missingFields.push('policyStore');
      if (!policyTeam || !policyTeam.trim()) missingFields.push('policyTeam');

      // 구두정책이나 부가차감지원정책이 아닌 경우에만 policyContent 필수
      const isAddSupportPolicyForValidation = category === 'wireless_add_support' || category === 'wired_add_support';
      const isRatePolicyForValidation = category === 'wireless_rate' || category === 'wired_rate';
      if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicyForValidation && !isRatePolicyForValidation && !policyContent) {
        missingFields.push('policyContent');
      }

      // 구두정책 전용 검증
      if (isShoePolicy) {
        if (!req.body.amount95Above && !req.body.amount95Below && !policyContent) {
          missingFields.push('amount95Above 또는 amount95Below 또는 policyContent');
        }
      }

      // 부가차감지원정책 전용 검증
      if (isAddDeductPolicy) {
        const deductSupport = req.body.deductSupport || {};
        const hasAnyAmount = (deductSupport.addServiceAmount && deductSupport.addServiceAmount.trim()) ||
          (deductSupport.insuranceAmount && deductSupport.insuranceAmount.trim()) ||
          (deductSupport.connectionAmount && deductSupport.connectionAmount.trim());
        if (!hasAnyAmount) missingFields.push('차감지원 금액');
      }

      // 부가추가지원정책 전용 검증
      const isAddSupportPolicy = category === 'wireless_add_support' || category === 'wired_add_support';
      if (isAddSupportPolicy) {
        const addSupport = req.body.addSupport || {};
        const hasAnyAmount = (addSupport.uplayPremiumAmount && addSupport.uplayPremiumAmount.trim()) ||
          (addSupport.phoneExchangePassAmount && addSupport.phoneExchangePassAmount.trim()) ||
          (addSupport.musicAmount && addSupport.musicAmount.trim()) ||
          (addSupport.numberFilteringAmount && addSupport.numberFilteringAmount.trim());
        if (!hasAnyAmount) missingFields.push('추가지원 금액');
      }

      // 요금제유형별정책 전용 검증
      const isRatePolicy = category === 'wireless_rate' || category === 'wired_rate';
      if (isRatePolicy) {
        const rateSupports = req.body.rateSupports || [];
        const isDirectInput = req.body.isDirectInput === true || req.body.isDirectInput === 'true';
        if (!isDirectInput && rateSupports.length === 0) {
          missingFields.push('지원사항');
        }
      }

      // 일반 정책 검증
      if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicy) {
        if (!amountType) missingFields.push('amountType');
      }

      if (missingFields.length > 0) {
        const fieldNames = {
          'policyName': '정책명',
          'policyStartDate': '정책 시작일',
          'policyEndDate': '정책 종료일',
          'policyStore': '정책적용점',
          'policyContent': '정책내용',
          'amountType': '금액 유형',
          'policyTeam': '소속팀',
          'amount95Above 또는 amount95Below 또는 policyContent': '95군이상/미만 금액 또는 정책내용',
          '차감지원 금액': '차감지원 금액',
          '추가지원 금액': '추가지원 금액',
          '지원사항': '지원사항'
        };
        const missingFieldNames = missingFields.map(field => fieldNames[field] || field);
        return res.status(400).json({
          success: false,
          error: `다음 필수 항목이 누락되었습니다: ${missingFieldNames.join(', ')}`
        });
      }

      // amountType이 'in_content'가 아닐 때만 policyAmount 필수
      if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicy && 
          amountType !== 'in_content' && !policyAmount) {
        return res.status(400).json({
          success: false,
          error: '금액이 입력되지 않았습니다.'
        });
      }

      // 정책 ID 생성
      const policyId = `POL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 정책 적용일을 시작일~종료일 형태로 변환
      const startDate = new Date(policyStartDate).toLocaleDateString('ko-KR');
      const endDate = new Date(policyEndDate).toLocaleDateString('ko-KR');
      const policyDateRange = `${startDate} ~ ${endDate}`;

      // 금액 정보에 유형 추가
      const amountWithType = amountType === 'in_content'
        ? '내용에 직접입력'
        : `${policyAmount}원 (${amountType === 'total' ? '총금액' : '건당금액'})`;

      // 시트 데이터 확인
      const existingData = await getSheetValues('정책_기본정보 ');

      // 헤더 정의
      const headerRow = [
        '정책ID', '정책명', '정책적용일', '정책적용점', '정책내용', '금액', '정책유형', '무선/유선', '하위카테고리',
        '입력자ID', '입력자명', '입력일시', '승인상태_총괄', '승인상태_정산팀', '승인상태_소속팀', '정책상태',
        '취소사유', '취소일시', '취소자명', '정산반영상태', '정산반영자명', '정산반영일시', '정산반영자ID',
        '대상년월', '복수점명', '업체명', '개통유형', '95군이상금액', '95군미만금액', '소속팀',
        '부가미유치금액', '보험미유치금액', '연결음미유치금액', '부가유치시조건', '보험유치시조건', '연결음유치시조건',
        '유플레이프리미엄금액', '폰교체패스금액', '음악감상금액', '지정번호필터링금액',
        'VAS2종동시유치', 'VAS2종중1개유치', '부가3종모두유치', '요금제유형별지원사항',
        '연합정산입금처', '연합대상하부점', '연합조건', '개별소급적용대상', '개별소급개통유형', '담당자', '직접입력여부'
      ];

      // 매장명 조회
      let storeName = '';
      try {
        const storeValues = await getSheetValuesWithoutCache(STORE_SHEET_NAME);
        if (storeValues && storeValues.length > 1) {
          const store = storeValues.slice(1).find(row => row[15] && row[15].toString() === policyStore.toString());
          if (store) storeName = store[14] ? store[14].toString().trim() : '';
        }
      } catch (error) {
        console.warn('매장 데이터 조회 실패:', error.message);
      }

      // 새 정책 데이터 생성
      const newPolicyRow = [
        policyId, policyName, policyDateRange, policyStore, policyContent, amountWithType, policyType,
        category.startsWith('wireless') ? '무선' : '유선', category, inputUserId, inputUserName,
        new Date().toISOString(), '대기', '대기', '대기', '활성', '', '', '', '미반영', '', '', '',
        yearMonth, req.body.multipleStoreName || '', storeName,
        (() => {
          if (category === 'wireless_add_deduct' || category === 'wired_add_deduct' ||
              category === 'wireless_add_support' || category === 'wired_add_support' ||
              category === 'wireless_rate' || category === 'wired_rate') return '전유형';
          if (!req.body.activationType) return '';
          const { new010, mnp, change } = req.body.activationType;
          const types = [];
          if (new010) types.push('010신규');
          if (mnp) types.push('MNP');
          if (change) types.push('기변');
          if (types.length === 3) return '전유형';
          return types.join(', ');
        })(),
        (isShoePolicy ? (req.body.amount95Above || '') : ''),
        (isShoePolicy ? (req.body.amount95Below || '') : ''),
        (policyTeam && policyTeam.trim()) || '미지정',
        (isAddDeductPolicy ? (req.body.deductSupport?.addServiceAmount || '') : ''),
        (isAddDeductPolicy ? (req.body.deductSupport?.insuranceAmount || '') : ''),
        (isAddDeductPolicy ? (req.body.deductSupport?.connectionAmount || '') : ''),
        (isAddDeductPolicy ? (req.body.conditionalOptions?.addServiceAcquired ? 'Y' : 'N') : ''),
        (isAddDeductPolicy ? (req.body.conditionalOptions?.insuranceAcquired ? 'Y' : 'N') : ''),
        (isAddDeductPolicy ? (req.body.conditionalOptions?.connectionAcquired ? 'Y' : 'N') : ''),
        (isAddSupportPolicy ? (req.body.addSupport?.uplayPremiumAmount || '') : ''),
        (isAddSupportPolicy ? (req.body.addSupport?.phoneExchangePassAmount || '') : ''),
        (isAddSupportPolicy ? (req.body.addSupport?.musicAmount || '') : ''),
        (isAddSupportPolicy ? (req.body.addSupport?.numberFilteringAmount || '') : ''),
        (isAddSupportPolicy ? (req.body.supportConditionalOptions?.vas2Both ? 'Y' : 'N') : ''),
        (isAddSupportPolicy ? (req.body.supportConditionalOptions?.vas2Either ? 'Y' : 'N') : ''),
        (isAddSupportPolicy ? (req.body.supportConditionalOptions?.addon3All ? 'Y' : 'N') : ''),
        (isRatePolicy ? JSON.stringify(req.body.rateSupports || []) : ''),
        (isUnionPolicy ? (req.body.unionSettlementStore || '') : ''),
        (isUnionPolicy ? JSON.stringify(req.body.unionTargetStores || []) : ''),
        (isUnionPolicy ? JSON.stringify(req.body.unionConditions || {}) : ''),
        ((category === 'wireless_individual' || category === 'wired_individual') ? JSON.stringify(req.body.individualTarget || {}) : ''),
        ((category === 'wireless_individual' || category === 'wired_individual') ? (req.body.individualActivationType || '') : ''),
        req.body.manager || '',
        (req.body.isDirectInput === true || req.body.isDirectInput === 'true') ? 'Y' : 'N'
      ];

      // 시트에 데이터 추가
      if (!existingData || existingData.length === 0) {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: '정책_기본정보 !A:AY',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [headerRow, newPolicyRow] }
          })
        );
      } else {
        const nextRowIndex = existingData.length + 1;
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `정책_기본정보 !A${nextRowIndex}:AY${nextRowIndex}`,
            valueInputOption: 'RAW',
            resource: { values: [newPolicyRow] }
          })
        );
      }

      // 알림 생성
      await createPolicyNotification(policyId, inputUserId, 'new_policy');

      // 캐시 무효화
      cacheManager.delete('sheet_정책_기본정보 ');

      console.log('정책 생성 완료:', policyId);
      res.json({ success: true, message: '정책이 성공적으로 생성되었습니다.', policyId });

    } catch (error) {
      console.error('정책 생성 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policies/:policyId - 정책 수정 (원본 로직)
  router.put('/policies/:policyId', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      console.log('정책 수정:', policyId, req.body);

      const {
        policyName, policyStartDate, policyEndDate, policyStore, policyContent,
        policyAmount, amountType, policyType, category, yearMonth,
        inputUserId, inputUserName
      } = req.body;
      
      const policyTeam = (req.body.policyTeam ?? req.body.team ?? '').toString();

      // 구두정책 여부 확인
      const isShoePolicy = category === 'wireless_shoe' || category === 'wired_shoe';
      const isAddDeductPolicy = category === 'wireless_add_deduct' || category === 'wired_add_deduct';
      const isAddSupportPolicy = category === 'wireless_add_support' || category === 'wired_add_support';
      const isRatePolicy = category === 'wireless_rate' || category === 'wired_rate';
      const isUnionPolicy = category === 'wireless_union' || category === 'wired_union';

      // 필수 필드 검증
      const missingFields = [];
      if (!policyName) missingFields.push('policyName');
      if (!policyStartDate) missingFields.push('policyStartDate');
      if (!policyEndDate) missingFields.push('policyEndDate');
      if (!isUnionPolicy && !policyStore) missingFields.push('policyStore');
      if (!policyTeam || !policyTeam.trim()) missingFields.push('policyTeam');

      if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicy && !policyContent) {
        missingFields.push('policyContent');
      }

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `다음 필수 항목이 누락되었습니다: ${missingFields.join(', ')}`
        });
      }

      // 정책 찾기
      const values = await getSheetValuesWithoutCache('정책_기본정보 ');
      if (!values || values.length <= 1) {
        return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
      }

      const dataRows = values.slice(1);
      const policyIndex = dataRows.findIndex(row => row[0] === policyId);
      if (policyIndex === -1) {
        return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
      }

      const policyRow = dataRows[policyIndex];
      const rowNumber = policyIndex + 2;

      // 정책 적용일 변환
      const startDate = new Date(policyStartDate).toLocaleDateString('ko-KR');
      const endDate = new Date(policyEndDate).toLocaleDateString('ko-KR');
      const policyDateRange = `${startDate} ~ ${endDate}`;

      // 금액 정보
      const amountWithType = amountType === 'in_content'
        ? '내용에 직접입력'
        : `${policyAmount}원 (${amountType === 'total' ? '총금액' : '건당금액'})`;

      // 매장명 조회
      let storeName = '';
      try {
        const storeValues = await getSheetValues(STORE_SHEET_NAME);
        if (storeValues && storeValues.length > 1) {
          const store = storeValues.slice(1).find(row => row[15] && row[15].toString() === policyStore.toString());
          if (store) storeName = store[14] ? store[14].toString().trim() : '';
        }
      } catch (error) {
        console.warn('매장 데이터 조회 실패:', error.message);
      }

      // 기존 행 데이터 유지하면서 수정
      const updatedRow = [...policyRow];
      while (updatedRow.length < 51) updatedRow.push('');

      updatedRow[1] = policyName;
      updatedRow[2] = policyDateRange;
      updatedRow[3] = policyStore;
      updatedRow[4] = policyContent;
      updatedRow[5] = amountWithType;
      updatedRow[6] = policyType;
      updatedRow[7] = (category && category.startsWith('wireless')) ? '무선' : '유선';
      updatedRow[8] = category || '';
      updatedRow[9] = inputUserId;
      updatedRow[10] = inputUserName;
      updatedRow[11] = new Date().toISOString();
      updatedRow[23] = yearMonth;
      updatedRow[24] = req.body.multipleStoreName || '';
      updatedRow[25] = storeName;
      updatedRow[26] = (() => {
        if (isAddDeductPolicy || isAddSupportPolicy || isRatePolicy) return '전유형';
        if (!req.body.activationType) return '';
        const { new010, mnp, change } = req.body.activationType;
        const types = [];
        if (new010) types.push('010신규');
        if (mnp) types.push('MNP');
        if (change) types.push('기변');
        if (types.length === 3) return '전유형';
        return types.join(', ');
      })();
      updatedRow[27] = isShoePolicy ? (req.body.amount95Above || '') : '';
      updatedRow[28] = isShoePolicy ? (req.body.amount95Below || '') : '';
      updatedRow[29] = (policyTeam && policyTeam.trim()) || '미지정';
      updatedRow[30] = isAddDeductPolicy ? (req.body.deductSupport?.addServiceAmount || '') : '';
      updatedRow[31] = isAddDeductPolicy ? (req.body.deductSupport?.insuranceAmount || '') : '';
      updatedRow[32] = isAddDeductPolicy ? (req.body.deductSupport?.connectionAmount || '') : '';
      updatedRow[33] = isAddDeductPolicy ? (req.body.conditionalOptions?.addServiceAcquired ? 'Y' : 'N') : '';
      updatedRow[34] = isAddDeductPolicy ? (req.body.conditionalOptions?.insuranceAcquired ? 'Y' : 'N') : '';
      updatedRow[35] = isAddDeductPolicy ? (req.body.conditionalOptions?.connectionAcquired ? 'Y' : 'N') : '';
      updatedRow[36] = isAddSupportPolicy ? (req.body.addSupport?.uplayPremiumAmount || '') : '';
      updatedRow[37] = isAddSupportPolicy ? (req.body.addSupport?.phoneExchangePassAmount || '') : '';
      updatedRow[38] = isAddSupportPolicy ? (req.body.addSupport?.musicAmount || '') : '';
      updatedRow[39] = isAddSupportPolicy ? (req.body.addSupport?.numberFilteringAmount || '') : '';
      updatedRow[40] = isAddSupportPolicy ? (req.body.supportConditionalOptions?.vas2Both ? 'Y' : 'N') : '';
      updatedRow[41] = isAddSupportPolicy ? (req.body.supportConditionalOptions?.vas2Either ? 'Y' : 'N') : '';
      updatedRow[42] = isAddSupportPolicy ? (req.body.supportConditionalOptions?.addon3All ? 'Y' : 'N') : '';
      updatedRow[43] = isRatePolicy ? JSON.stringify(req.body.rateSupports || []) : '';
      updatedRow[44] = isUnionPolicy ? (req.body.unionSettlementStore || '') : '';
      updatedRow[45] = isUnionPolicy ? JSON.stringify(req.body.unionTargetStores || []) : '';
      updatedRow[46] = isUnionPolicy ? JSON.stringify(req.body.unionConditions || {}) : '';
      updatedRow[47] = (category === 'wireless_individual' || category === 'wired_individual') ? JSON.stringify(req.body.individualTarget || {}) : '';
      updatedRow[48] = (category === 'wireless_individual' || category === 'wired_individual') ? (req.body.individualActivationType || '') : '';
      updatedRow[49] = req.body.manager || '';
      updatedRow[50] = (req.body.isDirectInput === true || req.body.isDirectInput === 'true') ? 'Y' : 'N';

      await rateLimiter.execute(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `정책_기본정보 !A${rowNumber}:AY${rowNumber}`,
          valueInputOption: 'RAW',
          resource: { values: [updatedRow] }
        })
      );

      cacheManager.delete('sheet_정책_기본정보 ');
      console.log('정책 수정 완료:', policyId);
      res.json({ success: true, message: '정책이 성공적으로 수정되었습니다.', policyId });

    } catch (error) {
      console.error('정책 수정 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/policies/:policyId - 정책 삭제 (원본 로직)
  router.delete('/policies/:policyId', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      console.log('정책 삭제:', policyId);

      const values = await getSheetValuesWithoutCache('정책_기본정보 ');
      if (!values || values.length <= 1) {
        return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
      }

      const dataRows = values.slice(1);
      const policyRowIndex = dataRows.findIndex(row => row[0] === policyId);
      if (policyRowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
      }

      const sheetId = await getSheetIdByName('정책_기본정보 ');
      await rateLimiter.execute(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: policyRowIndex + 1,
                  endIndex: policyRowIndex + 2
                }
              }
            }]
          }
        })
      );

      cacheManager.delete('sheet_정책_기본정보 ');
      console.log('정책 삭제 완료:', policyId);
      res.json({ success: true, message: '정책이 삭제되었습니다.' });

    } catch (error) {
      console.error('정책 삭제 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policies/:policyId/approve - 정책 승인
  router.put('/policies/:policyId/approve', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      console.log('정책 승인:', policyId);
      
      res.status(501).json({ 
        success: false, 
        error: '정책 승인 API는 원본 로직 복사가 필요합니다.',
        note: 'server/index.js.backup.original 28961-29166줄 참조'
      });
    } catch (error) {
      console.error('정책 승인 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policies/:policyId/cancel - 정책 취소
  router.put('/policies/:policyId/cancel', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      console.log('정책 취소:', policyId);
      
      res.status(501).json({ 
        success: false, 
        error: '정책 취소 API는 원본 로직 복사가 필요합니다.',
        note: 'server/index.js.backup.original 27160-27241줄 참조'
      });
    } catch (error) {
      console.error('정책 취소 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policies/:policyId/approval-cancel - 승인 취소
  router.put('/policies/:policyId/approval-cancel', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      console.log('승인 취소:', policyId);
      
      res.status(501).json({ 
        success: false, 
        error: '승인 취소 API는 원본 로직 복사가 필요합니다.',
        note: 'server/index.js.backup.original 27242-27356줄 참조'
      });
    } catch (error) {
      console.error('승인 취소 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policies/:policyId/settlement-reflect - 정산 반영
  router.put('/policies/:policyId/settlement-reflect', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      console.log('정산 반영:', policyId);
      
      res.status(501).json({ 
        success: false, 
        error: '정산 반영 API는 원본 로직 복사가 필요합니다.',
        note: 'server/index.js.backup.original 27357-27433줄 참조'
      });
    } catch (error) {
      console.error('정산 반영 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policies/shoe-counting - 구두정책 카운팅
  router.get('/policies/shoe-counting', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      console.log('구두정책 카운팅 요청:', req.query);
      
      res.status(501).json({ 
        success: false, 
        error: '구두정책 카운팅 API는 원본 로직 복사가 필요합니다.',
        note: 'server/index.js.backup.original 27852-28020줄 참조'
      });
    } catch (error) {
      console.error('구두정책 카운팅 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================================================
  // 정책 카테고리 API (원본 로직)
  // ============================================================================

  // 기본 카테고리 초기화 함수
  async function initializeDefaultCategories() {
    const defaultCategories = [
      ['wireless_shoe', '구두정책', 'wireless', '👞', '활성', 1, new Date().toISOString(), new Date().toISOString()],
      ['wireless_union', '연합정책', 'wireless', '🤝', '활성', 2, new Date().toISOString(), new Date().toISOString()],
      ['wireless_rate', '요금제유형별정책', 'wireless', '💰', '활성', 3, new Date().toISOString(), new Date().toISOString()],
      ['wireless_add_support', '부가추가지원정책', 'wireless', '➕', '활성', 4, new Date().toISOString(), new Date().toISOString()],
      ['wireless_add_deduct', '부가차감지원정책', 'wireless', '➖', '활성', 5, new Date().toISOString(), new Date().toISOString()],
      ['wireless_grade', '그레이드정책', 'wireless', '⭐', '활성', 6, new Date().toISOString(), new Date().toISOString()],
      ['wireless_individual', '개별소급정책', 'wireless', '📋', '활성', 7, new Date().toISOString(), new Date().toISOString()],
      ['wired_shoe', '구두정책', 'wired', '👞', '활성', 1, new Date().toISOString(), new Date().toISOString()],
      ['wired_union', '연합정책', 'wired', '🤝', '활성', 2, new Date().toISOString(), new Date().toISOString()],
      ['wired_rate', '요금제유형별정책', 'wired', '💰', '활성', 3, new Date().toISOString(), new Date().toISOString()],
      ['wired_add_support', '부가추가지원정책', 'wired', '➕', '활성', 4, new Date().toISOString(), new Date().toISOString()],
      ['wired_add_deduct', '부가차감지원정책', 'wired', '➖', '활성', 5, new Date().toISOString(), new Date().toISOString()],
      ['wired_grade', '그레이드정책', 'wired', '⭐', '활성', 6, new Date().toISOString(), new Date().toISOString()],
      ['wired_individual', '개별소급정책', 'wired', '📋', '활성', 7, new Date().toISOString(), new Date().toISOString()]
    ];

    const headerRow = [
      '카테고리ID',      // A열
      '카테고리명',      // B열
      '정책타입',        // C열
      '아이콘',          // D열
      '활성화여부',      // E열
      '정렬순서',        // F열
      '생성일시',        // G열
      '수정일시'         // H열
    ];

    await rateLimiter.execute(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '정책_카테고리!A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [headerRow, ...defaultCategories]
        }
      })
    );

    console.log('기본 카테고리 초기화 완료');
  }

  // GET /api/policy-categories - 정책 카테고리 목록 (원본 로직)
  router.get('/policy-categories', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      console.log('카테고리 목록 조회 요청');

      const values = await getSheetValuesWithoutCache('정책_카테고리');

      if (!values || values.length === 0) {
        // 카테고리가 없으면 기본 카테고리 생성
        await initializeDefaultCategories();
        const defaultValues = await getSheetValuesWithoutCache('정책_카테고리');
        const categories = defaultValues.slice(1).map(row => ({
          id: row[0],
          name: row[1],
          policyType: row[2],
          icon: row[3],
          isActive: row[4] === '활성',
          sortOrder: parseInt(row[5]) || 0,
          createdAt: row[6],
          updatedAt: row[7]
        }));

        return res.json({ success: true, categories });
      }

      const categories = values.slice(1).map(row => ({
        id: row[0],
        name: row[1],
        policyType: row[2],
        icon: row[3],
        isActive: row[4] === '활성',
        sortOrder: parseInt(row[5]) || 0,
        createdAt: row[6],
        updatedAt: row[7]
      }));

      console.log(`카테고리 목록 조회 완료: ${categories.length}건`);
      res.json({ success: true, categories });

    } catch (error) {
      console.error('카테고리 목록 조회 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-categories - 정책 카테고리 생성 (원본 로직)
  router.post('/policy-categories', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { name, policyType, icon, sortOrder } = req.body;

      console.log('새 카테고리 생성 요청:', req.body);

      // 필수 필드 검증
      if (!name || !policyType || !icon) {
        return res.status(400).json({
          success: false,
          error: '필수 필드가 누락되었습니다.'
        });
      }

      // 카테고리 ID 생성
      const categoryId = `${policyType}_${name.replace(/\s+/g, '_').toLowerCase()}`;

      // 새 카테고리 데이터 생성
      const newCategoryRow = [
        categoryId,                    // A열: 카테고리ID
        name,                          // B열: 카테고리명
        policyType,                    // C열: 정책타입
        icon,                          // D열: 아이콘
        '활성',                        // E열: 활성화여부
        sortOrder || 0,                // F열: 정렬순서
        new Date().toISOString(),      // G열: 생성일시
        new Date().toISOString()       // H열: 수정일시
      ];

      // 시트에 데이터가 있는지 확인
      const existingData = await getSheetValuesWithoutCache('정책_카테고리');

      // 헤더 정의
      const headerRow = [
        '카테고리ID',      // A열
        '카테고리명',      // B열
        '정책타입',        // C열
        '아이콘',          // D열
        '활성화여부',      // E열
        '정렬순서',        // F열
        '생성일시',        // G열
        '수정일시'         // H열
      ];

      let response;

      // 시트가 비어있거나 헤더가 없으면 헤더와 함께 데이터 추가
      if (!existingData || existingData.length === 0 ||
        !existingData[0] || existingData[0][0] !== '카테고리ID') {
        console.log('📝 [카테고리생성] 시트가 비어있거나 헤더가 없어 헤더와 함께 데이터 추가');
        response = await rateLimiter.execute(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: '정책_카테고리!A:H',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [headerRow, newCategoryRow]
            }
          })
        );
      } else {
        // 기존 데이터가 있으면 카테고리만 추가
        console.log('📝 [카테고리생성] 기존 데이터에 카테고리 추가');
        response = await rateLimiter.execute(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: '정책_카테고리!A:H',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [newCategoryRow]
            }
          })
        );
      }

      // 정책_카테고리 시트 캐시 무효화
      cacheManager.delete('sheet_정책_카테고리');

      console.log('카테고리 생성 완료:', response.data);

      res.json({
        success: true,
        message: '카테고리가 성공적으로 생성되었습니다.',
        categoryId: categoryId
      });

    } catch (error) {
      console.error('카테고리 생성 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createPolicyRoutes;
