/**
 * DATA_MAP_CONFIG
 * 
 * 어플리케이션의 모든 모드, 탭, 시트 매핑 정보
 * 
 * 목적:
 * 1. 데이터베이스관리 탭: Supabase/구글시트 토글 기능을 위해 정확한 시트명 필요
 * 2. 버그관리 탭: 탭명만 있으면 프론트엔드/백엔드 로그 확인 가능
 * 
 * 규칙:
 * - sheet: index.js.backup.original에서 확인된 정확한 시트 이름만 기재
 * - disabled: true - 시트 정보가 미확인된 모드 (회색 미활성화)
 * - apiEndpoint: 해당 탭의 API 엔드포인트 (확인된 것만)
 */

const DATA_MAP_CONFIG = {
    // ==================== 직영점 모드 ====================
    // 시트: 직영점_판매일보, 직영점_오늘의휴대폰, 직영점_설정, 직영점_모델이미지, 
    //       직영점_단말마스터, 직영점_정책_마진, 직영점_정책_부가서비스, 직영점_정책_별도
    'directStore': {
        tabs: {
            'sales': { label: '판매일보', group: '일보관리', sheet: '직영점_판매일보', range: 'A:AB', headerRow: 1, apiEndpoint: '/api/direct/sales' },
            'today': { label: '오늘의휴대폰', group: '일보관리', sheet: '직영점_오늘의휴대폰', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/direct/todays-mobiles' },
            'queue': { label: '구매대기', group: '고객관리', sheet: '직영점_구매대기', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/member/queue/all' },
            'board': { label: '게시판', group: '커뮤니티', sheet: '직영점_게시판', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/member/board' },
            'settings': { label: '설정', group: '설정', sheet: '직영점_설정', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/direct/settings' },
            'images': { label: '모델이미지', group: '기준정보', sheet: '직영점_모델이미지', range: 'A:K', headerRow: 1, apiEndpoint: '/api/direct/mobiles-master' },
            'devices': { label: '단말마스터', group: '기준정보', sheet: '직영점_단말마스터', range: 'A:R', headerRow: 1, apiEndpoint: '/api/direct/mobiles-master' },
            'margin': { label: '정책마진', group: '휴대폰시세표', sheet: '직영점_정책_마진', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/direct/mobiles-pricing' },
            'addon': { label: '부가서비스', group: '휴대폰시세표', sheet: '직영점_정책_부가서비스', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/direct/mobiles-pricing' },
            'special': { label: '별도정책', group: '휴대폰시세표', sheet: '직영점_정책_별도', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/direct/mobiles-pricing' }
        }
    },

    // ==================== 정책 모드 ====================
    // 실제 UI 탭: 추가정책, 정책표목록, 정책표생성, 정책표생성설정
    // 시트: 정책_기본정보 , 정책_승인이력 , 정책모드공지사항
    'policy': {
        tabs: {
            'additional': { label: '추가정책', sheet: '정책_기본정보 ', range: 'A:AC', headerRow: 1, apiEndpoint: '/api/policies' },
            'policyList': { label: '정책표목록', sheet: '정책_기본정보 ', range: 'A:AC', headerRow: 1, apiEndpoint: '/api/policies' },
            'policyCreate': { label: '정책표생성', sheet: '정책_기본정보 ', range: 'A:AC', headerRow: 1, apiEndpoint: '/api/policies' },
            'policySettings': { label: '정책표생성설정', sheet: '정책_기본정보 ', range: 'A:AC', headerRow: 1, apiEndpoint: '/api/policies' },
            'notice': { label: '공지사항', sheet: '정책모드공지사항', range: 'A:I', headerRow: 2, apiEndpoint: '/api/policy-notices' }
        }
    },

    // ==================== 예산 모드 ====================
    // 시트: 액면예산, 예산_정책그룹관리, 예산_사용자시트관리, 예산_대상월관리
    'budget': {
        tabs: {
            'faceValue': { label: '액면예산', sheet: '액면예산', range: 'A:AG', headerRow: 1 },
            'policyGroup': { label: '정책그룹관리', sheet: '예산_정책그룹관리', range: 'A:B', headerRow: 1, apiEndpoint: '/api/budget/policy-groups' },
            'userSheet': { label: '사용자시트관리', sheet: '예산_사용자시트관리', range: 'A:G', headerRow: 1, apiEndpoint: '/api/budget/user-sheets-v2' },
            'targetMonth': { label: '대상월관리', sheet: '예산_대상월관리', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/budget/month-sheets' }
        }
    },

    // ==================== 관리자 모드 ====================
    // UI 구조: 탭 없음, 메인헤더에 버튼/메뉴 방식
    // - 지도 재고노출옵션 설정 버튼
    // - 매장색상설정 버튼  
    // - 점세개 메뉴: 전체재고확인, 담당재고확인, 담당개통확인
    // 시트: 대리점아이디관리, 어플업데이트, 폰클출고처데이터, 폰클재고데이터, 폰클개통데이터
    'agent': {
        uiType: 'headerMenu', // 탭이 아닌 헤더 메뉴 방식
        tabs: {
            'allInventory': { label: '전체재고확인', sheet: '폰클재고데이터', range: 'A:Z', headerRow: 4 },
            'assignedInventory': { label: '담당재고확인', sheet: '폰클재고데이터', range: 'A:Z', headerRow: 4 },
            'assignedActivation': { label: '담당개통확인', sheet: '폰클개통데이터', range: 'A:BZ', headerRow: 4 },
            'storeSettings': { label: '대리점관리', sheet: '대리점아이디관리', range: 'A:AF', headerRow: 1 },
            'updates': { label: '어플업데이트', sheet: '어플업데이트', range: 'A:Z', headerRow: 1 },
            'mapDisplayOption': {
                label: '지도 재고 노출 옵션 설정',
                sheet: '지도재고노출옵션',
                range: 'A:F',
                headerRow: 1,
                apiEndpoint: '/api/map-display-option/users'
            },
            'markerColorSettings': {
                label: '매장 색상 설정',
                sheet: '관리자모드_마커색상설정',
                range: 'A:F',
                headerRow: 1,
                apiEndpoint: '/api/marker-color-settings'
            }
        }
    },

    // ==================== 재고 관리 모드 ====================
    // 시트: 폰클재고데이터, 폰클개통데이터, 마스터재고, 사전예약사이트, 정규화작업
    'inventory': {
        tabs: {
            'price-discrepancy': {
                label: '폰클입고가상이값',
                sheet: '폰클재고데이터, 폰클개통데이터',
                range: 'A:Z',
                headerRow: 4,
                apiEndpoint: '/api/price-discrepancies'
            },
            'duplicate': {
                label: '폰클중복값',
                sheet: '폰클개통데이터, 폰클재고데이터',
                range: 'A4:BZ',
                headerRow: 4,
                apiEndpoint: '/api/phone-duplicates'
            },
            'master': {
                label: '마스터재고검수',
                sheet: '마스터재고',
                range: 'A:Z',
                headerRow: 1,
                apiEndpoint: '/api/master-inventory',
                spreadsheetId: '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q'
            },
            'assignment': {
                label: '재고배정',
                sheet: '사전예약사이트, 폰클재고데이터, 폰클출고처데이터, 폰클개통데이터, 정규화작업',
                range: 'A:Z',
                headerRow: 1,
                apiEndpoint: '/api/inventory/assignment-status'
            }
        }
    },

    // ==================== 어플종합관리 모드 ====================
    // UI 탭: 퀵서비스관리, 데이터베이스관리, 버그관리
    'quickServiceManagement': {
        tabs: {
            'quickService': {
                label: '퀵서비스관리',
                apiEndpoint: '/api/quick-cost/companies'
            },
            'database': {
                label: '데이터베이스관리'
                // 데이터베이스관리 탭은 다른 모드들의 시트 정보를 참조하여 사용
            },
            'bugs': {
                label: '버그관리',
                description: '앱 작동 상태 진단 및 버그 관리',
                supabaseTable: 'error_logs',
                apiEndpoint: '/api/errors'
            }
        }
    },

    // ==================== 회의 모드 ====================
    // 시트: 회의목록
    'meeting': {
        tabs: {
            'list': { label: '회의목록', sheet: '회의목록', range: 'A:W', headerRow: 1, apiEndpoint: '/api/meetings' }
        }
    },

    // ==================== 사전예약 모드 ====================
    // 시트: 사전예약사이트, 사전예약사이트취소데이터
    'reservation': {
        tabs: {
            'site': { label: '사전예약', sheet: '사전예약사이트', range: 'A:Z', headerRow: 1 },
            'cancel': { label: '취소데이터', sheet: '사전예약사이트취소데이터', range: 'A:Z', headerRow: 1 }
        }
    },

    // ==================== 기본 모드 ====================
    // 시트: 사전예약사이트, 마당접수, 온세일, 모바일가입내역, POS코드변경설정
    'basicMode': {
        tabs: {
            'mapData': {
                label: '지도 데이터 (매장+재고)',
                sheet: '폰클출고처데이터 / 폰클재고데이터',
                range: 'A:Z',
                headerRow: 1,
                apiEndpoint: '/api/stores'
            },
            'mapOptions': {
                label: '지도 노출 옵션',
                sheet: '지도재고노출옵션',
                range: 'A:F',
                headerRow: 1,
                apiEndpoint: '/api/map-display-option/users'
            }
        }
    },

    // ==================== 영업 모드 ====================
    // 시트: 영업사원목표, 폰클개통데이터, 폰클출고처데이터, 거래처정보, 운영모델, 폰클홈데이터
    'sales': {
        tabs: {
            'target': { label: '영업사원목표', sheet: '영업사원목표', range: 'A:Z', headerRow: 1 },
            'activation': { label: '개통데이터', sheet: '폰클개통데이터', range: 'A:BZ', headerRow: 4 },
            'stores': { label: '출고처데이터', sheet: '폰클출고처데이터', range: 'A:AM', headerRow: 4 },
            'customer': { label: '거래처정보', sheet: '거래처정보', range: 'A:Z', headerRow: 1 },
            'model': { label: '운영모델', sheet: '운영모델', range: 'A:Z', headerRow: 1 },
            'home': { label: '폰클홈데이터', sheet: '폰클홈데이터', range: 'A:Z', headerRow: 1 }
        }
    },

    // ==================== 온세일관리 모드 ====================
    // 시트: 온세일링크관리, 온세일
    'onSaleManagement': {
        tabs: {
            'links': { label: '온세일링크', sheet: '온세일링크관리', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/onsale/active-links' },
            'data': { label: '온세일', sheet: '온세일', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/onsale/active-links' }
        }
    },

    // ==================== 온세일접수 모드 ====================
    // 시트: 온세일
    'onSaleReception': {
        tabs: {
            'reception': { label: '온세일접수', sheet: '온세일', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/onsale/active-links' }
        }
    },

    // ==================== 일반정책 모드 ====================
    // 시트: 정책_기본정보 , 정책모드공지사항
    'generalPolicy': {
        tabs: {
            'basic': { label: '기본정보', sheet: '정책_기본정보 ', range: 'A:AC', headerRow: 1, apiEndpoint: '/api/policies' },
            'notice': { label: '공지사항', sheet: '정책모드공지사항', range: 'A:I', headerRow: 2, apiEndpoint: '/api/policy-notices' }
        }
    },

    // ==================== 직영점 관리 모드 ====================
    // 시트: 직영점_* (directStore와 동일한 시트 사용)
    'directStoreManagement': {
        tabs: {
            'sales': { label: '판매일보', group: '일보관리', sheet: '직영점_판매일보', range: 'A:AB', headerRow: 1, apiEndpoint: '/api/direct/sales' },
            'today': { label: '오늘의휴대폰', group: '일보관리', sheet: '직영점_오늘의휴대폰', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/direct/todays-mobiles' },
            'queue': { label: '구매대기', group: '고객관리', sheet: '직영점_구매대기', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/member/queue/all' },
            'board': { label: '게시판', group: '커뮤니티', sheet: '직영점_게시판', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/member/board' },
            'settings': { label: '설정', group: '설정', sheet: '직영점_설정', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/direct/settings' },
            'images': { label: '모델이미지', group: '기준정보', sheet: '직영점_모델이미지', range: 'A:K', headerRow: 1, apiEndpoint: '/api/direct/mobiles-master' },
            'devices': { label: '단말마스터', group: '기준정보', sheet: '직영점_단말마스터', range: 'A:R', headerRow: 1, apiEndpoint: '/api/direct/mobiles-master' },
            'policy': { label: '정책관리', group: '정책', sheet: '직영점_정책_마진, 직영점_정책_부가서비스, 직영점_정책_별도', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/direct/management/policy' }
        }
    },

    // ==================== 아래 모드들은 시트 정보 미확인 (회색 비활성화) ====================

    // OB 관리 모드 - 시트 정보 미확인
    'obManagement': {
        disabled: true,
        tabs: {
            'results': { label: '정산결과' },
            'discounts': { label: '할인데이터' },
            'segments': { label: '세그먼트' },
            'plans': { label: '요금제' },
            'links': { label: '링크관리' },
            'exclusions': { label: '제외인원' },
            'targetOutlets': { label: '대상점관리' }
        }
    },

    // 정산 모드 - 엑셀 업로드 처리, 시트 정보 없음
    'settlement': {
        disabled: true,
        tabs: {
            'upload': { label: '정산업로드' }
        }
    },

    // 검수 모드 - 마스터재고 외부 시트 사용
    'inspection': {
        disabled: true,
        tabs: {
            'master': { label: '마스터재고', apiEndpoint: '/api/master-inventory' }
        }
    },

    // 장표 모드 - OCR 처리, 시트 없음
    'chart': {
        disabled: true,
        tabs: {
            'ocr': { label: '채권장표', apiEndpoint: '/api/rechotancho-bond/all-data' }
        }
    },

    // 재고회수 모드 - 시트 정보 미확인
    'inventoryRecovery': {
        disabled: true,
        tabs: {
            'recovery': { label: '재고회수' }
        }
    },

    // 정보수집 모드 - 시트 정보 없음
    'dataCollection': {
        disabled: true,
        tabs: {
            'collection': { label: '데이터수집' }
        }
    },

    // SMS 관리 모드 - 시트 정보 미확인
    'smsManagement': {
        disabled: true,
        tabs: {
            'messages': { label: 'SMS목록' },
            'rules': { label: '전달규칙' },
            'history': { label: '전달이력' },
            'autoReply': { label: '자동응답' }
        }
    },

    // 식대 모드 - 시트 정보 없음
    'mealAllowance': {
        disabled: true,
        tabs: {
            'allowance': { label: '식대관리' }
        }
    },

    // 근퇴 모드 - 시트 정보 없음
    'attendance': {
        disabled: true,
        tabs: {
            'records': { label: '근태기록' }
        }
    },

    // 리스크 관리 모드 - 시트 정보 없음
    'riskManagement': {
        disabled: true,
        tabs: {
            'risk': { label: '리스크관리' }
        }
    },

    // 장표 모드
    'chart': {
        tabs: {
            'closing': { label: '마감장표', sheet: '폰클개통데이터', range: 'A:Z', headerRow: 3, apiEndpoint: '/api/closing-chart' },
            'bond_overdue': { label: '채권장표-연체', sheet: '채권장표', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/bond/overdue' },
            'bond_rechotancho': { label: '채권장표-재초담초', sheet: '재초담초채권_내역', range: 'A:G', headerRow: 1, apiEndpoint: '/api/rechotancho-bond/all-data' },
            'bond_increase': { label: '채권장표-가입자증감', sheet: '가입자증감', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/subscriber-increase/data' },
            'indicator_award': { label: '지표장표-월간시상', sheet: '수기초', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/monthly-award/data' },
            'inventory': { label: '재고장표', sheet: '폰클재고데이터', range: 'A:Z', headerRow: 1, apiEndpoint: '/api/inventory-analysis' }
        }
    },

    // 고객 모드 - 시트 정보 미확인
    'customerMode': {
        disabled: true,
        tabs: {
            'queue': { label: '구매대기열', apiEndpoint: '/api/member/queue/all' }
        }
    }
};

// CommonJS Export (for Backend)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DATA_MAP_CONFIG };
}

// ESM Export (for Frontend)
export { DATA_MAP_CONFIG };
