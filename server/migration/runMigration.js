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
      transformFn: (data) => ({
        "통신사": data["통신사"],
        "마진": parseFloat(data["마진"]) || null
      })
    },
    {
      sheetName: '직영점_정책_부가서비스',
      tableName: 'direct_store_policy_addon_services',
      transformFn: (data) => ({
        "통신사": data["통신사"],
        "서비스명": data["서비스명"],
        "월요금": parseFloat(data["월요금"]) || null,
        "유치추가금액": parseFloat(data["유치추가금액"]) || null,
        "미유치차감금액": parseFloat(data["미유치차감금액"]) || null,
        "상세설명": data["상세설명"] || null,
        "공식사이트URL": data["공식사이트URL"] || null
      })
    },
    {
      sheetName: '직영점_정책_보험상품',
      tableName: 'direct_store_policy_insurance'
    },
    {
      sheetName: '직영점_정책_별도',
      tableName: 'direct_store_policy_special',
      transformFn: (data) => ({
        "통신사": data["통신사"],
        "정책명": data["정책명"],
        "정책타입": data["정책타입"] || null,
        "금액": parseFloat(data["금액"]) || null,
        "적용여부": data["적용여부"] === 'O' || data["적용여부"] === true,
        "조건JSON": data["조건JSON"] ? JSON.parse(data["조건JSON"]) : null
      })
    },
    {
      sheetName: '직영점_설정',
      tableName: 'direct_store_settings',
      transformFn: (data) => ({
        "통신사": data["통신사"],
        "설정유형": data["설정유형"],
        "시트ID": data["시트ID"] || null,
        "시트URL": data["시트URL"] || null,
        "설정값JSON": data["설정값JSON"] ? JSON.parse(data["설정값JSON"]) : null
      })
    },
    {
      sheetName: '직영점_메인페이지문구',
      tableName: 'direct_store_main_page_texts'
    },
    {
      sheetName: '직영점_요금제마스터',
      tableName: 'direct_store_plan_master',
      transformFn: (data) => ({
        "통신사": data["통신사"],
        "요금제명": data["요금제명"],
        "요금제군": data["요금제군"] || null,
        "기본료": parseFloat(data["기본료"]) || null,
        "요금제코드": data["요금제코드"] || null,
        "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
        "비고": data["비고"] || null
      })
    },
    {
      sheetName: '직영점_단말마스터',
      tableName: 'direct_store_device_master',
      transformFn: (data) => ({
        "통신사": data["통신사"],
        "모델ID": data["모델ID"],
        "모델명": data["모델명"],
        "펫네임": data["펫네임"] || null,
        "제조사": data["제조사"] || null,
        "출고가": parseFloat(data["출고가"]) || null,
        "기본요금제군": data["기본요금제군"] || null,
        "isPremium": data["isPremium"] === 'O' || data["isPremium"] === true,
        "isBudget": data["isBudget"] === 'O' || data["isBudget"] === true,
        "isPopular": data["isPopular"] === 'O' || data["isPopular"] === true,
        "isRecommended": data["isRecommended"] === 'O' || data["isRecommended"] === true,
        "isCheap": data["isCheap"] === 'O' || data["isCheap"] === true,
        "이미지URL": data["이미지URL"] || null,
        "사용여부": data["사용여부"] === 'O' || data["사용여부"] === true,
        "비고": data["비고"] || null,
        "Discord메시지ID": data["Discord메시지ID"] || null,
        "Discord포스트ID": data["Discord포스트ID"] || null,
        "Discord스레드ID": data["Discord스레드ID"] || null
      })
    },
    {
      sheetName: '직영점_단말요금정책',
      tableName: 'direct_store_device_pricing_policy'
    },
    {
      sheetName: '직영점_모델이미지',
      tableName: 'direct_store_model_images'
    },
    {
      sheetName: '직영점_오늘의휴대폰',
      tableName: 'direct_store_todays_mobiles'
    },
    {
      sheetName: '직영점_대중교통위치',
      tableName: 'direct_store_transit_locations'
    },
    {
      sheetName: '직영점_매장사진',
      tableName: 'direct_store_photos'
    },
    {
      sheetName: '직영점_판매일보',
      tableName: 'direct_store_sales_daily'
    }
  ],

  // 정책 모드 (10개)
  policy: [
    {
      sheetName: '정책모드_정책표설정',
      tableName: 'policy_table_settings'
    },
    {
      sheetName: '정책모드_정책표목록',
      tableName: 'policy_table_list'
    },
    {
      sheetName: '정책모드_일반사용자그룹',
      tableName: 'policy_user_groups'
    },
    {
      sheetName: '정책표목록_탭순서',
      tableName: 'policy_tab_order'
    },
    {
      sheetName: '정책모드_정책영업그룹_변경이력',
      tableName: 'policy_group_change_history'
    },
    {
      sheetName: '정책모드_기본정책영업그룹',
      tableName: 'policy_default_groups'
    },
    {
      sheetName: '정책모드_기타정책목록',
      tableName: 'policy_other_types'
    },
    {
      sheetName: '예산모드_예산채널설정',
      tableName: 'budget_channel_settings'
    },
    {
      sheetName: '예산모드_기본예산설정',
      tableName: 'budget_basic_settings'
    },
    {
      sheetName: '예산모드_기본데이터설정',
      tableName: 'budget_basic_data_settings'
    }
  ],

  // 고객 모드 (7개)
  customer: [
    {
      sheetName: '고객정보',
      tableName: 'customer_info'
    },
    {
      sheetName: '구매대기',
      tableName: 'purchase_queue',
      transformFn: (data) => ({
        "고객명": data["고객명"],
        "연락처": data["연락처"],
        "매장명": data["매장명"] || null,
        "매장POS코드": data["매장POS코드"] || null,
        "통신사": data["통신사"] || null,
        "모델명": data["모델명"] || null,
        "펫네임": data["펫네임"] || null,
        "개통유형": data["개통유형"] || null,
        "요금제명": data["요금제명"] || null,
        "출고가": parseFloat(data["출고가"]) || null,
        "이통사지원금": parseFloat(data["이통사지원금"]) || null,
        "대리점지원금": parseFloat(data["대리점지원금"]) || null,
        "예상구매가": parseFloat(data["예상구매가"]) || null,
        "상태": data["상태"] || '구매대기',
        "등록일시": data["등록일시"] ? new Date(data["등록일시"]).toISOString() : new Date().toISOString(),
        "처리일시": data["처리일시"] ? new Date(data["처리일시"]).toISOString() : null,
        "처리자": data["처리자"] || null,
        "비고": data["비고"] || null
      })
    },
    {
      sheetName: '게시판',
      tableName: 'board'
    },
    {
      sheetName: '직영점_사전승낙서마크',
      tableName: 'direct_store_pre_approval_marks'
    },
    {
      sheetName: '예약판매전체고객',
      tableName: 'reservation_all_customers'
    },
    {
      sheetName: '예약판매고객',
      tableName: 'reservation_customers'
    },
    {
      sheetName: '미매칭고객',
      tableName: 'unmatched_customers'
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
