/**
 * DATA_MAP_CONFIG
 * 
 * 어플리케이션의 모든 모드, 탭, 시트 및 Supabase 테이블 매핑 정보
 * 시트명은 index.js.backup.original에서 정확히 추출됨
 * - range: 구글 시트 데이터 범위
 * - headerRow: 헤더가 위치한 행 번호 (1-indexed)
 * - supabaseTable: 대응하는 Supabase 테이블명
 */

const DATA_MAP_CONFIG = {
    // ==================== 직영점 모드 ====================
    'directStore': {
        tabs: {
            'sales': { label: '판매일보', sheet: '직영점_판매일보', range: 'A:AB', headerRow: 1, supabaseTable: 'direct_store_sales_daily' },
            'today': { label: '오늘의휴대폰', sheet: '직영점_오늘의휴대폰', range: 'A:Z', headerRow: 1, supabaseTable: 'direct_store_todays_mobiles' },
            'settings': { label: '설정', sheet: '직영점_설정', range: 'A:Z', headerRow: 1, supabaseTable: 'direct_store_settings' },
            'images': { label: '모델이미지', sheet: '직영점_모델이미지', range: 'A:K', headerRow: 1, supabaseTable: 'direct_store_model_images' },
            'devices': { label: '단말마스터', sheet: '직영점_단말마스터', range: 'A:R', headerRow: 1, supabaseTable: 'direct_store_device_master' },
            'margin': { label: '정책마진', sheet: '직영점_정책_마진', range: 'A:Z', headerRow: 1, supabaseTable: 'direct_store_policy_margin' },
            'addon': { label: '부가서비스', sheet: '직영점_정책_부가서비스', range: 'A:Z', headerRow: 1, supabaseTable: 'direct_store_policy_addon' },
            'special': { label: '별도정책', sheet: '직영점_정책_별도', range: 'A:Z', headerRow: 1, supabaseTable: 'direct_store_policy_special' }
        }
    },

    // ==================== 정책 모드 ====================
    'policy': {
        tabs: {
            'basic': { label: '기본정보', sheet: '정책_기본정보 ', range: 'A:AC', headerRow: 1, supabaseTable: 'policy_basic_info' },
            'approval': { label: '승인이력', sheet: '정책_승인이력 ', range: 'A:G', headerRow: 1, supabaseTable: 'policy_approval_history' },
            'notification': { label: '알림관리', sheet: '정책_알림관리', range: 'A:Z', headerRow: 1, supabaseTable: 'policy_notifications' },
            'category': { label: '카테고리', sheet: '정책_카테고리', range: 'A:Z', headerRow: 1, supabaseTable: 'policy_categories' },
            'notice': { label: '공지사항', sheet: '정책모드공지사항', range: 'A:I', headerRow: 2, supabaseTable: 'policy_notices' }
        }
    },

    // ==================== OB 관리 모드 ====================
    'obManagement': {
        tabs: {
            'results': { label: '정산결과', sheet: 'OB_결과', range: 'A:M', headerRow: 1, supabaseTable: 'ob_results' },
            'discounts': { label: '할인데이터', sheet: 'OB_할인', range: 'A:F', headerRow: 1, supabaseTable: 'ob_discounts' },
            'segments': { label: '세그먼트', sheet: 'OB_세그', range: 'A:C', headerRow: 1, supabaseTable: 'ob_segments' },
            'plans': { label: '요금제', sheet: '무선요금제군', range: 'A:B', headerRow: 1, supabaseTable: 'ob_plans' },
            'links': { label: '링크관리', sheet: 'OB정산관리링크관리', range: 'A:L', headerRow: 1, supabaseTable: 'ob_links' },
            'exclusions': { label: '제외인원', sheet: '제외인원', range: 'A:I', headerRow: 2, supabaseTable: 'ob_exclusions' },
            'targetOutlets': { label: '대상점관리', sheet: '대상점', range: 'A:H', headerRow: 2, supabaseTable: 'ob_target_outlets' }
        }
    },

    // ==================== 어플종합관리 모드 (퀵서비스 관리) ====================
    // 실제 UI 탭: 퀵서비스관리(quickService), 데이터베이스관리(database), 버그관리(bugs)
    'quickServiceManagement': {
        tabs: {
            'quickService': {
                label: '퀵서비스관리',
                description: '퀵서비스 업체 통계 및 견적 관리',
                apiEndpoint: '/api/quick-cost/companies'
            },
            'database': {
                label: '데이터베이스관리',
                description: 'Supabase/구글시트 데이터 소스 관리'
            },
            'bugs': {
                label: '버그관리',
                description: '앱 작동 상태 진단 및 버그 관리'
            }
        }
    },

    // ==================== 예산 모드 ====================
    'budget': {
        tabs: {
            'faceValue': { label: '액면예산', sheet: '액면예산', range: 'A:AG', headerRow: 1, supabaseTable: 'budget_face_value' },
            'policyGroup': { label: '정책그룹관리', sheet: '예산_정책그룹관리', range: 'A:B', headerRow: 1, supabaseTable: 'budget_policy_groups' },
            'userSheet': { label: '사용자시트관리', sheet: '예산_사용자시트관리', range: 'A:G', headerRow: 1, supabaseTable: 'budget_user_sheets' },
            'targetMonth': { label: '대상월관리', sheet: '예산_대상월관리', range: 'A:Z', headerRow: 1, supabaseTable: 'budget_target_month' }
        }
    },

    // ==================== 관리자 모드 ====================
    'agent': {
        tabs: {
            'stores': { label: '대리점관리', sheet: '대리점아이디관리', range: 'A:AF', headerRow: 1, supabaseTable: 'admin_stores' },
            'updates': { label: '어플업데이트', sheet: '어플업데이트', range: 'A:Z', headerRow: 1, supabaseTable: 'admin_updates' },
            'storeData': { label: '출고처데이터', sheet: '폰클출고처데이터', range: 'A:AM', headerRow: 4, supabaseTable: 'admin_store_data' }
        }
    },

    // ==================== 재고 관리 모드 ====================
    'inventory': {
        tabs: {
            'price-discrepancy': {
                label: '폰클입고가상이값',
                sheet: '폰클재고데이터, 폰클개통데이터',
                range: 'A:Z',
                headerRow: 4,
                supabaseTable: 'inventory_price_discrepancies',
                apiEndpoint: '/api/price-discrepancies',
                description: '모델명별 입고가 비교'
            },
            'duplicate': {
                label: '폰클중복값',
                sheet: '폰클개통데이터, 폰클재고데이터',
                range: 'A4:BZ',
                headerRow: 4,
                supabaseTable: 'inventory_duplicates',
                apiEndpoint: '/api/phone-duplicates',
                description: '일련번호 중복 검사'
            },
            'master': {
                label: '마스터재고검수',
                sheet: '마스터재고',
                range: 'A:Z',
                headerRow: 1,
                supabaseTable: 'inventory_audit_master',
                apiEndpoint: '/api/master-inventory',
                spreadsheetId: '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q',
                description: '별도 스프레드시트 - 마스터재고 데이터'
            },
            'assignment': {
                label: '재고배정',
                sheet: '사전예약사이트, 폰클재고데이터, 폰클출고처데이터, 폰클개통데이터, 정규화작업',
                range: 'A:Z',
                headerRow: 1,
                supabaseTable: 'inventory_assignment_settings',
                apiEndpoint: '/api/inventory/assignment-status',
                description: '재고 배정 상태 계산'
            }
        }
    },

    // ==================== 회의 모드 ====================
    'meeting': {
        tabs: {
            'list': { label: '회의목록', sheet: '회의목록', range: 'A:W', headerRow: 1, supabaseTable: 'meeting_list', apiEndpoint: '/api/meetings' }
        }
    },

    // ==================== 사전예약 모드 ====================
    'reservation': {
        tabs: {
            'site': { label: '사전예약', sheet: '사전예약사이트', range: 'A:Z', headerRow: 1, supabaseTable: 'reservation_site', apiEndpoint: '/api/reservation-site' },
            'cancel': { label: '취소데이터', sheet: '사전예약사이트취소데이터', range: 'A:Z', headerRow: 1, supabaseTable: 'reservation_cancel' }
        }
    },

    // ==================== 기본 모드 ====================
    'basicMode': {
        tabs: {
            'reservation': { label: '사전예약', sheet: '사전예약사이트', range: 'A:Z', headerRow: 1, supabaseTable: 'basic_reservation' },
            'madang': { label: '마당접수', sheet: '마당접수', range: 'A:Z', headerRow: 1, supabaseTable: 'basic_madang' },
            'onsale': { label: '온세일', sheet: '온세일', range: 'A:Z', headerRow: 1, supabaseTable: 'basic_onsale' },
            'mobile': { label: '모바일가입', sheet: '모바일가입내역', range: 'A:Z', headerRow: 1, supabaseTable: 'basic_mobile' },
            'posCode': { label: 'POS코드설정', sheet: 'POS코드변경설정', range: 'A:Z', headerRow: 1, supabaseTable: 'basic_pos_code' }
        }
    },

    // ==================== 영업 모드 ====================
    'sales': {
        tabs: {
            'target': { label: '영업사원목표', sheet: '영업사원목표', range: 'A:Z', headerRow: 1, supabaseTable: 'sales_target', apiEndpoint: '/api/sales-target' },
            'activation': { label: '개통데이터', sheet: '폰클개통데이터', range: 'A:BZ', headerRow: 4, supabaseTable: 'sales_activation' },
            'stores': { label: '출고처데이터', sheet: '폰클출고처데이터', range: 'A:AM', headerRow: 4, supabaseTable: 'sales_stores' },
            'customer': { label: '거래처정보', sheet: '거래처정보', range: 'A:Z', headerRow: 1, supabaseTable: 'sales_customer' },
            'model': { label: '운영모델', sheet: '운영모델', range: 'A:Z', headerRow: 1, supabaseTable: 'sales_model' },
            'home': { label: '폰클홈데이터', sheet: '폰클홈데이터', range: 'A:Z', headerRow: 1, supabaseTable: 'sales_home' }
        }
    },

    // ==================== 온세일관리 모드 ====================
    'onSaleManagement': {
        tabs: {
            'links': { label: '온세일링크', sheet: '온세일링크관리', range: 'A:Z', headerRow: 1, supabaseTable: 'onsale_links', apiEndpoint: '/api/onsale/active-links' },
            'data': { label: '온세일', sheet: '온세일', range: 'A:Z', headerRow: 1, supabaseTable: 'onsale_data', apiEndpoint: '/api/onsale' }
        }
    },

    // ==================== 온세일접수 모드 ====================
    'onSaleReception': {
        tabs: {
            'reception': { label: '온세일접수', sheet: '온세일', range: 'A:Z', headerRow: 1, supabaseTable: 'onsale_reception' }
        }
    },

    // ==================== 일반정책 모드 ====================
    'generalPolicy': {
        tabs: {
            'basic': { label: '기본정보', sheet: '정책_기본정보 ', range: 'A:AC', headerRow: 1, supabaseTable: 'general_policy_basic', apiEndpoint: '/api/policy/list' },
            'notice': { label: '공지사항', sheet: '정책모드공지사항', range: 'A:I', headerRow: 2, supabaseTable: 'general_policy_notice', apiEndpoint: '/api/policy-notices' }
        }
    },

    // ==================== 정산 모드 (엑셀 업로드 처리) ====================
    'settlement': {
        tabs: {
            'upload': { label: '정산업로드', description: '엑셀 파일 업로드 처리', supabaseTable: 'settlement_upload' }
        }
    },

    // ==================== 검수 모드 ====================
    'inspection': {
        tabs: {
            'master': { label: '마스터재고', sheet: '마스터재고', range: 'A:Z', headerRow: 1, supabaseTable: 'inspection_master', apiEndpoint: '/api/master-inventory', spreadsheetId: '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q' }
        }
    },

    // ==================== 장표 모드 (OCR 처리) ====================
    'chart': {
        tabs: {
            'ocr': { label: '채권장표', description: 'OCR 처리', supabaseTable: 'chart_ocr' }
        }
    },

    // ==================== 재고회수 모드 ====================
    'inventoryRecovery': {
        tabs: {
            'recovery': { label: '재고회수', sheet: '폰클재고데이터', range: 'A:Z', headerRow: 4, supabaseTable: 'inventory_recovery', apiEndpoint: '/api/inventory/recovery' }
        }
    },

    // ==================== 정보수집 모드 ====================
    'dataCollection': {
        tabs: {
            'collection': { label: '데이터수집', description: '현장 데이터 수집', supabaseTable: 'data_collection' }
        }
    },

    // ==================== 고객 모드 ====================
    'customerMode': {
        tabs: {
            'queue': { label: '구매대기열', sheet: '사전예약사이트', range: 'A:Z', headerRow: 1, supabaseTable: 'customer_queue', apiEndpoint: '/api/customer/queue' }
        }
    },

    // ==================== 직영점 관리 모드 ====================
    'directStoreManagement': {
        tabs: {
            'sales': { label: '판매일보', sheet: '직영점_판매일보', range: 'A:AB', headerRow: 1, supabaseTable: 'direct_mgmt_sales', apiEndpoint: '/api/direct/sales' },
            'today': { label: '오늘의휴대폰', sheet: '직영점_오늘의휴대폰', range: 'A:Z', headerRow: 1, supabaseTable: 'direct_mgmt_today', apiEndpoint: '/api/direct/todays-mobiles' },
            'settings': { label: '설정', sheet: '직영점_설정', range: 'A:Z', headerRow: 1, supabaseTable: 'direct_mgmt_settings', apiEndpoint: '/api/direct/settings' },
            'images': { label: '모델이미지', sheet: '직영점_모델이미지', range: 'A:K', headerRow: 1, supabaseTable: 'direct_mgmt_images', apiEndpoint: '/api/direct/model-images' },
            'devices': { label: '단말마스터', sheet: '직영점_단말마스터', range: 'A:R', headerRow: 1, supabaseTable: 'direct_mgmt_devices', apiEndpoint: '/api/direct/device-master' },
            'policy': { label: '정책관리', sheet: '직영점_정책_마진, 직영점_정책_부가서비스, 직영점_정책_별도', range: 'A:Z', headerRow: 1, supabaseTable: 'direct_mgmt_policy', apiEndpoint: '/api/direct/management/policy' }
        }
    }
};

// CommonJS Export (for Backend)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DATA_MAP_CONFIG };
}

// ESM Export (for Frontend)
export { DATA_MAP_CONFIG };
