/**
 * DATA_MAP_CONFIG
 * 
 * 어플리케이션의 모든 모드, 탭, 시트 및 Supabase 테이블 매핑 정보
 * - range: 구글 시트 데이터 범위 (예: 'A:Z')
 * - headerRow: 헤더가 위치한 행 번호 (1-indexed)
 * - supabaseTable: 대응하는 Supabase 테이블명
 */

const DATA_MAP_CONFIG = {
    'directStore': {
        tabs: {
            'plans': { label: '요금제 마스터', sheet: '직영점_요금제마스터', range: 'A:G', headerRow: 1, supabaseTable: 'direct_store_plan_master' },
            'devices': { label: '단말기 마스터', sheet: '직영점_단말마스터', range: 'A:S', headerRow: 1, supabaseTable: 'direct_store_device_master' },
            'pricing': { label: '단말 요금정책', sheet: '직영점_단말요금정책', range: 'A:M', headerRow: 1, supabaseTable: 'direct_store_device_pricing_policy' },
            'images': { label: '모델 이미지', sheet: '직영점_모델이미지', range: 'A:K', headerRow: 1, supabaseTable: 'direct_store_model_images' },
            'today': { label: '오늘의 휴대폰', sheet: '직영점_오늘의휴대폰', range: 'A:J', headerRow: 1, supabaseTable: 'direct_store_todays_mobiles' },
            'margin': { label: '정책 마진', sheet: '직영점_정책_마진', range: 'A:B', headerRow: 1, supabaseTable: 'direct_store_policy_margin' },
            'addon': { label: '부가서비스', sheet: '직영점_정책_부가서비스', range: 'A:G', headerRow: 1, supabaseTable: 'direct_store_policy_addon_services' },
            'insurance': { label: '보험 상품', sheet: '직영점_정책_보험상품', range: 'A:I', headerRow: 1, supabaseTable: 'direct_store_policy_insurance' },
            'special': { label: '별도 정책', sheet: '직영점_정책_별도', range: 'A:F', headerRow: 1, supabaseTable: 'direct_store_policy_special' },
            'mainText': { label: '메인 문구', sheet: '직영점_메인페이지문구', range: 'A:F', headerRow: 1, supabaseTable: 'direct_store_main_page_texts' },
            'settings': { label: '직영점 설정', sheet: '직영점_설정', range: 'A:E', headerRow: 1, supabaseTable: 'direct_store_settings' },
            'locations': { label: '교통 위치', sheet: '직영점_대중교통위치', range: 'A:F', headerRow: 1, supabaseTable: 'direct_store_transit_locations' },
            'photos': { label: '매장 사진', sheet: '직영점_매장사진', range: 'A:G', headerRow: 1, supabaseTable: 'direct_store_photos' },
            'sales': { label: '판매 일보', sheet: '직영점_판매일보', range: 'A:O', headerRow: 1, supabaseTable: 'direct_store_sales_daily' }
        }
    },
    'policy': {
        tabs: {
            'tableSettings': { label: '정책표 설정', sheet: '정책모드_정책표설정', range: 'A:J', headerRow: 1, supabaseTable: 'policy_table_settings' },
            'tableList': { label: '정책표 목록', sheet: '정책모드_정책표목록', range: 'A:I', headerRow: 1, supabaseTable: 'policy_table_list' },
            'userGroups': { label: '사용자 그룹', sheet: '정책모드_일반사용자그룹', range: 'A:G', headerRow: 1, supabaseTable: 'policy_user_groups' },
            'tabOrder': { label: '탭 순서', sheet: '정책표목록_탭순서', range: 'A:E', headerRow: 1, supabaseTable: 'policy_tab_order' },
            'history': { label: '변경 이력', sheet: '정책모드_정책영업그룹_변경이력', range: 'A:G', headerRow: 1, supabaseTable: 'policy_group_change_history' },
            'defaultGroups': { label: '기본 그룹', sheet: '정책모드_기본정책영업그룹', range: 'A:G', headerRow: 1, supabaseTable: 'policy_default_groups' },
            'other': { label: '기타 정책', sheet: '정책모드_기타정책목록', range: 'A:G', headerRow: 1, supabaseTable: 'policy_other_types' }
        }
    },
    'obManagement': {
        tabs: {
            'results': { label: '정산 결과', sheet: 'OB_결과', range: 'A:M', headerRow: 1, supabaseTable: 'ob_results' },
            'discounts': { label: '할인 데이터', sheet: 'OB_할인', range: 'A:F', headerRow: 1, supabaseTable: 'ob_discounts' },
            'segments': { label: '세그먼트', sheet: 'OB_세그', range: 'A:C', headerRow: 1, supabaseTable: 'ob_segments' },
            'plans': { label: '요금제', sheet: '무선요금제군', range: 'A:B', headerRow: 1, supabaseTable: 'ob_plans' },
            'links': { label: '링크 관리', sheet: 'OB정산관리링크관리', range: 'A:L', headerRow: 1, supabaseTable: 'ob_settlement_links' },
            'exclusions': { label: '제외 인원', sheet: '제외인원', range: 'A:I', headerRow: 2, supabaseTable: 'ob_exclusions' },
            'targetOutlets': { label: '대상점 관리', sheet: '대상점', range: 'A:H', headerRow: 2, supabaseTable: 'ob_target_outlets' }
        }
    },
    'quickServiceManagement': {
        tabs: {
            'history': { label: '견적 이력', sheet: '퀵비용관리', range: 'A:Z', headerRow: 1, supabaseTable: 'quick_service_history' },
            'companies': { label: '업체 통계', sheet: '퀵비용관리', range: 'A:Z', headerRow: 1, supabaseTable: 'quick_service_companies' }
        }
    },
    'budget': {
        tabs: {
            'channels': { label: '채널 설정', sheet: '예산모드_예산채널설정', range: 'A:I', headerRow: 1, supabaseTable: 'budget_channel_settings' },
            'basic': { label: '기본 설정', sheet: '예산모드_기본예산설정', range: 'A:G', headerRow: 1, supabaseTable: 'budget_basic_settings' },
            'data': { label: '기본 데이터', sheet: '예산모드_기본데이터설정', range: 'A:F', headerRow: 1, supabaseTable: 'budget_basic_data_settings' }
        }
    },
    'agent': {
        tabs: {
            'stores': { label: '매장 관리', sheet: '대리점아이디관리', range: 'A:AF', headerRow: 1, supabaseTable: 'admin_stores' },
            'updates': { label: '어플 업데이트', sheet: '어플업데이트', range: 'A:Z', headerRow: 1, supabaseTable: 'admin_updates' }
        }
    },
    'inventory': {
        tabs: {
            'data': { label: '재고 데이터', sheet: '폰클재고데이터', range: 'A:Z', headerRow: 1, supabaseTable: 'inventory_data' },
            'master': { label: '재고 마스터', sheet: '재고감사_마스터', range: 'A:Z', headerRow: 1, supabaseTable: 'inventory_audit_master' }
        }
    }
};

// CommonJS Export (for Backend)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DATA_MAP_CONFIG };
}

// ESM Export (for Frontend)
export { DATA_MAP_CONFIG };
