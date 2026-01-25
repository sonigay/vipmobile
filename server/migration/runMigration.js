/**
 * 마이그레이션 실행 스크립트
 * 
 * 31개 시트를 Supabase로 마이그레이션합니다.
 * 
 * 사용법:
 *   node migration/runMigration.js --dry-run          # 테스트 실행
 *   node migration/runMigration.js --mode direct      # 직영점 모드만
 *   node migration/runMigration.js --mode policy      # 정책 모드만
 *   node migration/runMigration.js --mode customer    # 고객 모드만
 *   node migration/runMigration.js --all              # 전체 실행
 */

const MigrationScript = require('./MigrationScript');

// 마이그레이션 정의
const MIGRATIONS = {
  // 직영점 모드 (14개)
  direct: [
    {
      sheetName: '직영점_정책_마진',
      tableName: 'direct_store_policy_margin',
      transformFn: (data) => {
        // 필수 필드 체크 (빈 문자열 처리)
        const 통신사 = (data["통신사"] || '').trim();
        if (!통신사) return null; // 필수 필드가 비어있으면 스킵
        
        return {
          "통신사": 통신사,
          "마진": parseFloat(data["마진"]) || null
        };
      }
    },
    {
      sheetName: '직영점_정책_부가서비스',
      tableName: 'direct_store_policy_addon_services',
      transformFn: (data) => {
        // 필수 필드 체크
        const 통신사 = (data["통신사"] || '').trim();
        const 서비스명 = (data["서비스명"] || '').trim();
        if (!통신사 || !서비스명) return null;
        
        return {
          "통신사": 통신사,
          "서비스명": 서비스명,
          "월요금": parseFloat(data["월요금"]) || null,
          "유치추가금액": parseFloat(data["유치추가금액"]) || null,
          "미유치차감금액": parseFloat(data["미유치차감금액"]) || null,
          "상세설명": (data["상세설명"] || '').trim() || null,
          "공식사이트URL": (data["공식사이트URL"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '직영점_정책_보험상품',
      tableName: 'direct_store_policy_insurance',
      transformFn: (data) => {
        // 필수 필드 체크
        const 통신사 = (data["통신사"] || '').trim();
        const 보험상품명 = (data["보험상품명"] || '').trim();
        if (!통신사 || !보험상품명) return null;
        
        return {
          "통신사": 통신사,
          "보험상품명": 보험상품명,
          "출고가최소": parseFloat(data["출고가최소"]) || null,
          "출고가최대": parseFloat(data["출고가최대"]) || null,
          "월요금": parseFloat(data["월요금"]) || null,
          "유치추가금액": parseFloat(data["유치추가금액"]) || null,
          "미유치차감금액": parseFloat(data["미유치차감금액"]) || null,
          "상세설명": (data["상세설명"] || '').trim() || null,
          "공식사이트URL": (data["공식사이트URL"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '직영점_정책_별도',
      tableName: 'direct_store_policy_special',
      transformFn: (data) => {
        // 필수 필드 체크
        const 통신사 = (data["통신사"] || '').trim();
        const 정책명 = (data["정책명"] || '').trim();
        if (!통신사 || !정책명) return null;
        
        return {
          "통신사": 통신사,
          "정책명": 정책명,
          "정책타입": (data["정책타입"] || '').trim() || null,
          "금액": parseFloat(data["금액"]) || null,
          "적용여부": data["적용여부"] === 'O' || data["적용여부"] === true,
          "조건JSON": data["조건JSON"] ? JSON.parse(data["조건JSON"]) : null
        };
      }
    },
    {
      sheetName: '직영점_설정',
      tableName: 'direct_store_settings',
      transformFn: (data) => {
        // 필수 필드 체크
        const 통신사 = (data["통신사"] || '').trim();
        const 설정유형 = (data["설정유형"] || '').trim();
        if (!통신사 || !설정유형) return null;
        
        return {
          "통신사": 통신사,
          "설정유형": 설정유형,
          "시트ID": (data["시트ID"] || '').trim() || null,
          "시트URL": (data["시트URL"] || '').trim() || null,
          "설정값JSON": data["설정값JSON"] ? JSON.parse(data["설정값JSON"]) : null
        };
      }
    },
    {
      sheetName: '직영점_메인페이지문구',
      tableName: 'direct_store_main_page_texts',
      transformFn: (data) => {
        // Google Sheets 실제 컬럼: 통신사, 카테고리, 설정유형, 문구내용, 이미지URL, 수정일시
        const 문구내용 = (data["문구내용"] || '').trim();
        if (!문구내용) return null;
        
        return {
          "통신사": (data["통신사"] || '').trim() || null,
          "카테고리": (data["카테고리"] || '').trim() || null,
          "설정유형": (data["설정유형"] || '').trim() || null,
          "문구내용": 문구내용,
          "이미지URL": (data["이미지URL"] || '').trim() || null,
          "수정일시": data["수정일시"] ? new Date(data["수정일시"]).toISOString() : null
        };
      }
    },
    {
      sheetName: '직영점_요금제마스터',
      tableName: 'direct_store_plan_master',
      transformFn: (data) => {
        // 필수 필드 체크
        const 통신사 = (data["통신사"] || '').trim();
        const 요금제명 = (data["요금제명"] || '').trim();
        if (!통신사 || !요금제명) return null;
        
        return {
          "통신사": 통신사,
          "요금제명": 요금제명,
          "요금제군": (data["요금제군"] || '').trim() || null,
          "기본료": parseFloat(data["기본료"]) || null,
          "요금제코드": (data["요금제코드"] || '').trim() || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '직영점_단말마스터',
      tableName: 'direct_store_device_master',
      transformFn: (data) => {
        // 필수 필드 체크
        const 통신사 = (data["통신사"] || '').trim();
        const 모델ID = (data["모델ID"] || '').trim();
        const 모델명 = (data["모델명"] || '').trim();
        if (!통신사 || !모델ID || !모델명) return null;
        
        return {
          "통신사": 통신사,
          "모델ID": 모델ID,
          "모델명": 모델명,
          "펫네임": (data["펫네임"] || '').trim() || null,
          "제조사": (data["제조사"] || '').trim() || null,
          "출고가": parseFloat(data["출고가"]) || null,
          "기본요금제군": (data["기본요금제군"] || '').trim() || null,
          "isPremium": data["isPremium"] === 'O' || data["isPremium"] === true,
          "isBudget": data["isBudget"] === 'O' || data["isBudget"] === true,
          "isPopular": data["isPopular"] === 'O' || data["isPopular"] === true,
          "isRecommended": data["isRecommended"] === 'O' || data["isRecommended"] === true,
          "isCheap": data["isCheap"] === 'O' || data["isCheap"] === true,
          "이미지URL": (data["이미지URL"] || '').trim() || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null,
          "Discord메시지ID": (data["Discord메시지ID"] || '').trim() || null,
          "Discord포스트ID": (data["Discord포스트ID"] || '').trim() || null,
          "Discord스레드ID": (data["Discord스레드ID"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '직영점_단말요금정책',
      tableName: 'direct_store_device_pricing_policy',
      transformFn: (data) => {
        // Google Sheets 실제 컬럼: 통신사, 모델ID, 모델명, 요금제군, 요금제코드, 개통유형, 출고가, 이통사지원금, 대리점추가지원금_부가유치, 정책마진, 정책ID, 기준일자
        const 통신사 = (data["통신사"] || '').trim();
        const 모델ID = (data["모델ID"] || '').trim();
        if (!통신사 || !모델ID) return null;
        
        return {
          "통신사": 통신사,
          "모델ID": 모델ID,
          "모델명": (data["모델명"] || '').trim() || null,
          "요금제군": (data["요금제군"] || '').trim() || null,
          "요금제코드": (data["요금제코드"] || '').trim() || null,
          "개통유형": (data["개통유형"] || '').trim() || null,
          "출고가": parseFloat(data["출고가"]) || null,
          "이통사지원금": parseFloat(data["이통사지원금"]) || null,
          "대리점추가지원금_부가유치": parseFloat(data["대리점추가지원금_부가유치"]) || null,
          "정책마진": parseFloat(data["정책마진"]) || null,
          "정책ID": (data["정책ID"] || '').trim() || null,
          "기준일자": data["기준일자"] ? new Date(data["기준일자"]) : null,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '직영점_모델이미지',
      tableName: 'direct_store_model_images',
      transformFn: (data) => {
        // 필수 필드 체크
        const 통신사 = (data["통신사"] || '').trim();
        const 모델ID = (data["모델ID"] || '').trim();
        const 이미지URL = (data["이미지URL"] || '').trim();
        if (!통신사 || !모델ID || !이미지URL) return null;
        
        return {
          "통신사": 통신사,
          "모델ID": 모델ID,
          "모델명": (data["모델명"] || '').trim() || null,
          "펫네임": (data["펫네임"] || '').trim() || null,
          "제조사": (data["제조사"] || '').trim() || null,
          "이미지URL": 이미지URL,
          "비고": (data["비고"] || '').trim() || null,
          "색상": (data["색상"] || '').trim() || null,
          "Discord메시지ID": (data["Discord메시지ID"] || '').trim() || null,
          "Discord포스트ID": (data["Discord포스트ID"] || '').trim() || null,
          "Discord스레드ID": (data["Discord스레드ID"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '직영점_오늘의휴대폰',
      tableName: 'direct_store_todays_mobiles',
      transformFn: (data) => {
        // 필수 필드 체크
        const 통신사 = (data["통신사"] || '').trim();
        const 모델ID = (data["모델ID"] || '').trim();
        const 모델명 = (data["모델명"] || '').trim();
        if (!통신사 || !모델ID || !모델명) return null;
        
        return {
          "통신사": 통신사,
          "모델ID": 모델ID,
          "모델명": 모델명,
          "펫네임": (data["펫네임"] || '').trim() || null,
          "제조사": (data["제조사"] || '').trim() || null,
          "출고가": parseFloat(data["출고가"]) || null,
          "이미지URL": (data["이미지URL"] || '').trim() || null,
          "순서": parseInt(data["순서"]) || null,
          "표시여부": data["표시여부"] === 'O' || data["표시여부"] === true,
          "등록일시": data["등록일시"] ? new Date(data["등록일시"]).toISOString() : null
        };
      }
    },
    {
      sheetName: '직영점_대중교통위치',
      tableName: 'direct_store_transit_locations',
      transformFn: (data) => {
        // 필수 필드 체크
        const 타입 = (data["타입"] || '').trim();
        const 이름 = (data["이름"] || '').trim();
        if (!타입 || !이름) return null;
        
        return {
          "타입": 타입,
          "이름": 이름,
          "주소": (data["주소"] || '').trim() || null,
          "위도": parseFloat(data["위도"]) || null,
          "경도": parseFloat(data["경도"]) || null,
          "수정일시": data["수정일시"] ? new Date(data["수정일시"]).toISOString() : null
        };
      }
    },
    {
      sheetName: '직영점_매장사진',
      tableName: 'direct_store_photos',
      transformFn: (data) => {
        // 필수 필드 체크
        const 매장명 = (data["매장명"] || '').trim();
        const 사진URL = (data["사진URL"] || '').trim();
        if (!매장명 || !사진URL) return null;
        
        return {
          "매장명": 매장명,
          "POS코드": (data["POS코드"] || '').trim() || null,
          "사진URL": 사진URL,
          "사진타입": (data["사진타입"] || '').trim() || null,
          "설명": (data["설명"] || '').trim() || null,
          "촬영일시": data["촬영일시"] ? new Date(data["촬영일시"]).toISOString() : null,
          "등록일시": data["등록일시"] ? new Date(data["등록일시"]).toISOString() : null
        };
      }
    },
    {
      sheetName: '직영점_판매일보',
      tableName: 'direct_store_sales_daily',
      transformFn: (data) => {
        // 필수 필드 체크
        const 매장명 = (data["매장명"] || '').trim();
        const 판매일자 = data["판매일자"];
        if (!매장명 || !판매일자) return null;
        
        return {
          "매장명": 매장명,
          "POS코드": (data["POS코드"] || '').trim() || null,
          "판매일자": new Date(판매일자),
          "통신사": (data["통신사"] || '').trim() || null,
          "모델명": (data["모델명"] || '').trim() || null,
          "개통유형": (data["개통유형"] || '').trim() || null,
          "요금제명": (data["요금제명"] || '').trim() || null,
          "고객명": (data["고객명"] || '').trim() || null,
          "연락처": (data["연락처"] || '').trim() || null,
          "출고가": parseFloat(data["출고가"]) || null,
          "이통사지원금": parseFloat(data["이통사지원금"]) || null,
          "대리점지원금": parseFloat(data["대리점지원금"]) || null,
          "실구매가": parseFloat(data["실구매가"]) || null,
          "판매자": (data["판매자"] || '').trim() || null,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    }
  ],

  // 정책 모드 (10개)
  policy: [
    {
      sheetName: '정책모드_정책표설정',
      tableName: 'policy_table_settings',
      transformFn: (data) => {
        const 정책표ID = (data["정책표ID"] || '').trim();
        const 정책표명 = (data["정책표명"] || '').trim();
        if (!정책표ID || !정책표명) return null;
        
        return {
          "정책표ID": 정책표ID,
          "정책표명": 정책표명,
          "시트ID": (data["시트ID"] || '').trim() || null,
          "시트URL": (data["시트URL"] || '').trim() || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '정책모드_정책표목록',
      tableName: 'policy_table_list',
      transformFn: (data) => {
        const 정책표ID = (data["정책표ID"] || '').trim();
        const 정책명 = (data["정책명"] || '').trim();
        if (!정책표ID || !정책명) return null;
        
        return {
          "정책표ID": 정책표ID,
          "정책명": 정책명,
          "정책내용": (data["정책내용"] || '').trim() || null,
          "표시순서": parseInt(data["표시순서"]) || 0,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '정책모드_일반사용자그룹',
      tableName: 'policy_user_groups',
      transformFn: (data) => {
        const 그룹ID = (data["그룹ID"] || '').trim();
        const 그룹명 = (data["그룹명"] || '').trim();
        if (!그룹ID || !그룹명) return null;
        
        return {
          "그룹ID": 그룹ID,
          "그룹명": 그룹명,
          "그룹설명": (data["그룹설명"] || '').trim() || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '정책표목록_탭순서',
      tableName: 'policy_tab_order',
      transformFn: (data) => {
        const 정책표ID = (data["정책표ID"] || '').trim();
        const 탭명 = (data["탭명"] || '').trim();
        if (!정책표ID || !탭명) return null;
        
        return {
          "정책표ID": 정책표ID,
          "탭명": 탭명,
          "표시순서": parseInt(data["표시순서"]) || 0,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '정책모드_정책영업그룹_변경이력',
      tableName: 'policy_group_change_history',
      transformFn: (data) => {
        const 변경일시 = data["변경일시"] ? new Date(data["변경일시"]).toISOString() : new Date().toISOString();
        const 변경자 = (data["변경자"] || '').trim();
        if (!변경자) return null;
        
        return {
          "변경일시": 변경일시,
          "변경자": 변경자,
          "변경내용": (data["변경내용"] || '').trim() || null,
          "이전그룹ID": (data["이전그룹ID"] || '').trim() || null,
          "신규그룹ID": (data["신규그룹ID"] || '').trim() || null,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '정책모드_기본정책영업그룹',
      tableName: 'policy_default_groups',
      transformFn: (data) => {
        const 그룹ID = (data["그룹ID"] || '').trim();
        const 그룹명 = (data["그룹명"] || '').trim();
        if (!그룹ID || !그룹명) return null;
        
        return {
          "그룹ID": 그룹ID,
          "그룹명": 그룹명,
          "그룹설명": (data["그룹설명"] || '').trim() || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '정책모드_기타정책목록',
      tableName: 'policy_other_types',
      transformFn: (data) => {
        const 정책타입 = (data["정책타입"] || '').trim();
        const 정책명 = (data["정책명"] || '').trim();
        if (!정책타입 || !정책명) return null;
        
        return {
          "정책타입": 정책타입,
          "정책명": 정책명,
          "정책내용": (data["정책내용"] || '').trim() || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '예산모드_예산채널설정',
      tableName: 'budget_channel_settings',
      transformFn: (data) => {
        const 채널명 = (data["채널명"] || '').trim();
        if (!채널명) return null;
        
        return {
          "채널명": 채널명,
          "채널설명": (data["채널설명"] || '').trim() || null,
          "예산금액": parseFloat(data["예산금액"]) || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '예산모드_기본예산설정',
      tableName: 'budget_basic_settings',
      transformFn: (data) => {
        const 예산항목 = (data["예산항목"] || '').trim();
        if (!예산항목) return null;
        
        return {
          "예산항목": 예산항목,
          "예산금액": parseFloat(data["예산금액"]) || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '예산모드_기본데이터설정',
      tableName: 'budget_basic_data_settings',
      transformFn: (data) => {
        const 데이터항목 = (data["데이터항목"] || '').trim();
        if (!데이터항목) return null;
        
        return {
          "데이터항목": 데이터항목,
          "데이터값": (data["데이터값"] || '').trim() || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    }
  ],

  // 고객 모드 (7개)
  customer: [
    {
      sheetName: '사전예약사이트',  // 실제 시트 이름
      tableName: 'customer_info',
      transformFn: (data) => {
        const 고객명 = (data["고객명"] || data["성명"] || '').trim();
        const 연락처 = (data["연락처"] || data["고객전화번호"] || '').trim();
        if (!고객명 || !연락처) return null;
        
        return {
          "고객명": 고객명,
          "연락처": 연락처,
          "이메일": (data["이메일"] || '').trim() || null,
          "생년월일": data["생년월일"] ? new Date(data["생년월일"]) : null,
          "주소": (data["주소"] || '').trim() || null,
          "선호매장": (data["선호매장"] || '').trim() || null,
          "선호매장POS코드": (data["선호매장POS코드"] || '').trim() || null,
          "가입일시": data["가입일시"] ? new Date(data["가입일시"]).toISOString() : null,
          "최근방문일시": data["최근방문일시"] ? new Date(data["최근방문일시"]).toISOString() : null,
          "총구매횟수": parseInt(data["총구매횟수"]) || 0,
          "회원등급": (data["회원등급"] || '').trim() || null,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '직영점_구매대기',  // 실제 시트 이름
      tableName: 'purchase_queue',
      transformFn: (data) => {
        const 고객명 = (data["고객명"] || '').trim();
        const 연락처 = (data["연락처"] || '').trim();
        if (!고객명 || !연락처) return null;
        
        return {
          "고객명": 고객명,
          "연락처": 연락처,
          "매장명": (data["매장명"] || '').trim() || null,
          "매장POS코드": (data["매장POS코드"] || '').trim() || null,
          "통신사": (data["통신사"] || '').trim() || null,
          "모델명": (data["모델명"] || '').trim() || null,
          "펫네임": (data["펫네임"] || '').trim() || null,
          "개통유형": (data["개통유형"] || '').trim() || null,
          "요금제명": (data["요금제명"] || '').trim() || null,
          "출고가": parseFloat(data["출고가"]) || null,
          "이통사지원금": parseFloat(data["이통사지원금"]) || null,
          "대리점지원금": parseFloat(data["대리점지원금"]) || null,
          "예상구매가": parseFloat(data["예상구매가"]) || null,
          "상태": (data["상태"] || '').trim() || '구매대기',
          "등록일시": data["등록일시"] ? new Date(data["등록일시"]).toISOString() : new Date().toISOString(),
          "처리일시": data["처리일시"] ? new Date(data["처리일시"]).toISOString() : null,
          "처리자": (data["처리자"] || '').trim() || null,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '직영점_게시판',  // 실제 시트 이름
      tableName: 'board',
      transformFn: (data) => {
        const 제목 = (data["제목"] || '').trim();
        const 내용 = (data["내용"] || '').trim();
        const 작성자 = (data["작성자"] || '').trim();
        if (!제목 || !내용 || !작성자) return null;
        
        return {
          "제목": 제목,
          "내용": 내용,
          "작성자": 작성자,
          "작성일시": data["작성일시"] ? new Date(data["작성일시"]).toISOString() : new Date().toISOString(),
          "조회수": parseInt(data["조회수"]) || 0,
          "공지여부": data["공지여부"] === 'O' || data["공지여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '직영점_사전승낙서마크',
      tableName: 'direct_store_pre_approval_marks',
      transformFn: (data) => {
        const 마크명 = (data["마크명"] || '').trim();
        if (!마크명) return null;
        
        return {
          "마크명": 마크명,
          "마크설명": (data["마크설명"] || '').trim() || null,
          "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '사전예약사이트',  // 예약판매전체고객도 사전예약사이트에서 가져옴
      tableName: 'reservation_all_customers',
      transformFn: (data) => {
        const 고객명 = (data["고객명"] || data["성명"] || '').trim();
        const 연락처 = (data["연락처"] || data["고객전화번호"] || '').trim();
        if (!고객명 || !연락처) return null;
        
        return {
          "고객명": 고객명,
          "연락처": 연락처,
          "예약모델명": (data["예약모델명"] || data["모델명"] || '').trim() || null,
          "예약통신사": (data["예약통신사"] || data["통신사"] || '').trim() || null,
          "예약매장": (data["예약매장"] || '').trim() || null,
          "예약매장POS코드": (data["예약매장POS코드"] || '').trim() || null,
          "예약일시": data["예약일시"] ? new Date(data["예약일시"]).toISOString() : new Date().toISOString(),
          "예약상태": (data["예약상태"] || data["개통상태"] || '').trim() || '예약대기',
          "예약금": parseFloat(data["예약금"]) || null,
          "예약금입금여부": data["예약금입금여부"] === 'O' || data["예약금입금여부"] === true,
          "비고": (data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '사전예약사이트',  // 예약판매고객도 사전예약사이트에서 가져옴
      tableName: 'reservation_customers',
      transformFn: (data) => {
        const 고객명 = (data["고객명"] || data["성명"] || '').trim();
        const 연락처 = (data["연락처"] || data["고객전화번호"] || '').trim();
        if (!고객명 || !연락처) return null;
        
        return {
          "고객명": 고객명,
          "연락처": 연락처,
          "예약모델명": (data["예약모델명"] || data["모델명"] || '').trim() || null,
          "예약통신사": (data["예약통신사"] || data["통신사"] || '').trim() || null,
          "예약매장": (data["예약매장"] || '').trim() || null,
          "예약매장POS코드": (data["예약매장POS코드"] || '').trim() || null,
          "예약일시": data["예약일시"] ? new Date(data["예약일시"]).toISOString() : new Date().toISOString(),
          "희망개통일": data["희망개통일"] ? new Date(data["희망개통일"]) : null,
          "예약상태": (data["예약상태"] || data["개통상태"] || '').trim() || '예약대기',
          "예약금": parseFloat(data["예약금"]) || null,
          "예약금입금일시": data["예약금입금일시"] ? new Date(data["예약금입금일시"]).toISOString() : null,
          "예약금환불일시": data["예약금환불일시"] ? new Date(data["예약금환불일시"]).toISOString() : null,
          "구매완료일시": data["구매완료일시"] ? new Date(data["구매완료일시"]).toISOString() : null,
          "담당자": (data["담당자"] || '').trim() || null,
          "상세메모": (data["상세메모"] || data["비고"] || '').trim() || null
        };
      }
    },
    {
      sheetName: '마당접수',  // 미매칭고객은 마당접수, 온세일, 모바일가입내역에서 추출
      tableName: 'unmatched_customers',
      transformFn: (data) => {
        const 고객명 = (data["고객명"] || data["성명"] || '').trim();
        const 연락처 = (data["연락처"] || data["전화번호"] || '').trim();
        if (!고객명 || !연락처) return null;
        
        return {
          "고객명": 고객명,
          "연락처": 연락처,
          "매장명": (data["매장명"] || '').trim() || null,
          "매장POS코드": (data["매장POS코드"] || '').trim() || null,
          "문의내용": (data["문의내용"] || '').trim() || null,
          "문의일시": data["문의일시"] ? new Date(data["문의일시"]).toISOString() : new Date().toISOString(),
          "매칭상태": (data["매칭상태"] || '').trim() || '미매칭',
          "매칭일시": data["매칭일시"] ? new Date(data["매칭일시"]).toISOString() : null,
          "매칭담당자": (data["매칭담당자"] || '').trim() || null,
          "처리메모": (data["처리메모"] || '').trim() || null
        };
      }
    }
  ]
};

/**
 * 명령줄 인자 파싱
 */
function parseArgs() {
  const args = process.argv.slice(2);
  
  return {
    dryRun: args.includes('--dry-run'),
    mode: args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 
          (args.includes('--all') ? 'all' : null),
    help: args.includes('--help') || args.includes('-h')
  };
}

/**
 * 도움말 출력
 */
function printHelp() {
  console.log(`
마이그레이션 실행 스크립트

사용법:
  node migration/runMigration.js [옵션]

옵션:
  --dry-run              테스트 실행 (실제 저장 안 함)
  --mode=direct          직영점 모드만 마이그레이션 (14개 시트)
  --mode=policy          정책 모드만 마이그레이션 (10개 시트)
  --mode=customer        고객 모드만 마이그레이션 (7개 시트)
  --all                  전체 마이그레이션 (31개 시트)
  --help, -h             도움말 출력

예시:
  # 테스트 실행 (직영점 모드)
  node migration/runMigration.js --mode=direct --dry-run

  # 실제 실행 (정책 모드)
  node migration/runMigration.js --mode=policy

  # 전체 마이그레이션 (테스트)
  node migration/runMigration.js --all --dry-run

  # 전체 마이그레이션 (실제)
  node migration/runMigration.js --all
  `);
}

/**
 * 메인 실행 함수
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  if (!options.mode) {
    console.error('❌ 모드를 지정하세요: --mode=direct, --mode=policy, --mode=customer, 또는 --all');
    console.log('\n도움말: node migration/runMigration.js --help');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('🚀 VIP Map - Database Migration');
  console.log('='.repeat(70));
  console.log(`모드: ${options.mode}`);
  console.log(`실행 타입: ${options.dryRun ? 'DRY RUN (테스트)' : 'LIVE (실제 저장)'}`);
  console.log('='.repeat(70));

  // 마이그레이션 목록 선택
  let migrations = [];
  
  if (options.mode === 'all') {
    migrations = [
      ...MIGRATIONS.direct,
      ...MIGRATIONS.policy,
      ...MIGRATIONS.customer
    ];
  } else if (MIGRATIONS[options.mode]) {
    migrations = MIGRATIONS[options.mode];
  } else {
    console.error(`❌ 알 수 없는 모드: ${options.mode}`);
    process.exit(1);
  }

  console.log(`\n📋 ${migrations.length}개 시트 마이그레이션 예정\n`);

  // 확인 메시지 (LIVE 모드일 때만)
  if (!options.dryRun) {
    console.log('⚠️  경고: 실제 데이터가 Supabase에 저장됩니다!');
    console.log('   계속하려면 5초 기다리세요...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 마이그레이션 실행
  const migrator = new MigrationScript({ dryRun: options.dryRun });
  
  try {
    const results = await migrator.migrateAll(migrations);
    
    // 에러 로그 저장
    await migrator.saveErrorLog(`migration-errors-${options.mode}-${Date.now()}.json`);
    
    console.log('\n✅ 마이그레이션 완료!');
    
  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { MIGRATIONS };
