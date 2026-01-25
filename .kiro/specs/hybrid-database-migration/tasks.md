# Implementation Plan: Hybrid Database Migration

## Overview

이 구현 계획은 VIP Map Application을 Google Sheets 단일 저장소에서 Supabase(PostgreSQL) + Google Sheets 하이브리드 시스템으로 점진적으로 마이그레이션하기 위한 단계별 작업을 정의합니다. 

**마이그레이션 대상**: 31개 시트
- 직영점 모드: 14개 시트
- 정책 모드: 10개 시트  
- 고객 모드: 7개 시트

## Tasks

### Phase 1: Infrastructure Setup (완료)

- [x] 1. Supabase 프로젝트 초기화
  _Requirements: 1.1, 1.2, 1.4_

- [x] 2. 환경 변수 설정 (로컬 및 클라우드타입)
  _Requirements: 1.3, 1.4_

- [x] 3. @supabase/supabase-js 라이브러리 설치
  _Requirements: 1.3_

- [x] 4. 연결 테스트 스크립트 작성 및 실행
  _Requirements: 1.3, 1.4_

- [x] 5. DataAccessLayer 기본 클래스 구현
  _Requirements: 5.1, 5.2_

- [x] 6. DatabaseImplementation 구현 (Supabase)
  _Requirements: 5.2, 5.3, 5.4_

- [x] 7. GoogleSheetsImplementation 구현
  _Requirements: 5.2, 5.3_

- [x] 8. FeatureFlagManager 구현
  _Requirements: 7.1, 7.2_

- [x] 9. DALFactory 구현 (싱글톤 패턴)
  _Requirements: 5.2, 7.1_

- [x] 10. Jest 설정 파일 작성
  _Requirements: 10.3_

- [x] 11. fast-check 설정 및 헬퍼 함수 작성
  _Requirements: 10.3_

### Phase 2: Schema Definition & Core Scripts

- [x] 12. 스키마 설계 문서 작성 (31개 테이블)
  _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1_

- [x] 13. SQL 스키마 파일 작성 및 Supabase 실행
  _Requirements: 3.4, 3.5, 10.1_

- [x] 14. DataValidator 클래스 구현
  _Requirements: 4.2, 4.5_

- [x] 15. MigrationScript 클래스 구현
  _Requirements: 4.1, 4.3, 4.4, 4.5_

- [x] 16. 마이그레이션 실행 스크립트 작성
  _Requirements: 4.1, 4.3_

### Phase 3: 직영점 모드 마이그레이션 (14개 시트)

- [x] 17. 직영점_정책_마진 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 18. 직영점_정책_부가서비스 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 19. 직영점_정책_보험상품 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 20. 직영점_정책_별도 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 21. 직영점_설정 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 22. 직영점_메인페이지문구 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 23. 직영점_요금제마스터 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 24. 직영점_단말마스터 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 25. 직영점_단말요금정책 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 26. 직영점_모델이미지 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 27. 직영점_오늘의휴대폰 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 28. 직영점_대중교통위치 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 29. 직영점_매장사진 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 30. 직영점_판매일보 마이그레이션
  _Requirements: 3.1, 4.1, 4.2_

- [x] 31. 직영점 모드 데이터 무결성 검증
  _Requirements: 4.2_

- [x] 32. 직영점 모드 API 엔드포인트 DAL 통합
  _Requirements: 6.1, 6.2, 6.5_

### Phase 4: 정책 모드 마이그레이션 (10개 시트)

- [x] 33. 정책모드_정책표설정 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 34. 정책모드_정책표목록 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 35. 정책모드_일반사용자그룹 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 36. 정책표목록_탭순서 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 37. 정책모드_정책영업그룹_변경이력 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 38. 정책모드_기본정책영업그룹 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 39. 정책모드_기타정책목록 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 40. 예산모드_예산채널설정 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 41. 예산모드_기본예산설정 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 42. 예산모드_기본데이터설정 마이그레이션
  _Requirements: 3.2, 4.1, 4.2_

- [x] 43. 정책 모드 데이터 무결성 검증
  _Requirements: 4.2_

- [x] 44. 정책 모드 API 엔드포인트 DAL 통합
  _Requirements: 6.1, 6.4, 6.5_

### Phase 5: 고객 모드 마이그레이션 (7개 시트)

- [x] 45. 고객정보 마이그레이션
  _Requirements: 3.3, 4.1, 4.2_

- [x] 46. 구매대기 마이그레이션
  _Requirements: 3.3, 4.1, 4.2_

- [x] 47. 게시판 마이그레이션
  _Requirements: 3.3, 4.1, 4.2_

- [x] 48. 직영점_사전승낙서마크 마이그레이션
  _Requirements: 3.3, 4.1, 4.2_

- [x] 49. 예약판매전체고객 마이그레이션
  _Requirements: 3.3, 4.1, 4.2_

- [x] 50. 예약판매고객 마이그레이션
  _Requirements: 3.3, 4.1, 4.2_

- [x] 51. 미매칭고객 마이그레이션
  _Requirements: 3.3, 4.1, 4.2_

- [x] 52. 고객 모드 데이터 무결성 검증
  _Requirements: 4.2_

- [x] 53. 고객 모드 API 엔드포인트 DAL 통합
  _Requirements: 6.1, 6.3, 6.5_

### Phase 6: Backup & Monitoring

- [x] 54. BackupScript 클래스 구현
  _Requirements: 8.1, 8.4_

- [x] 55. RestoreScript 클래스 구현
  _Requirements: 8.4_

- [x] 56. 백업 스케줄링 설정 (Cron Job)
  _Requirements: 8.1_

- [x] 57. QueryPerformanceMonitor 클래스 구현
  _Requirements: 9.1, 9.2_

- [x] 58. Health Check 엔드포인트 구현
  _Requirements: 9.4_

- [x] 59. 에러 핸들링 미들웨어 구현
  _Requirements: 5.5, 7.4_

- [x] 60. Retry 로직 구현
  _Requirements: 5.5_

- [x] 61. 보안 설정 (RLS, Audit Logging)
  _Requirements: 1.5, 7.4_

### Phase 7: Testing & Documentation

- [x] 62. DAL Unit Tests 작성
  _Requirements: 10.3_

- [x] 63. DAL Property-Based Tests 작성
  _Requirements: 10.3_

- [x] 64. 마이그레이션 통합 테스트 실행
  _Requirements: 10.3_

- [x] 65. 성능 벤치마크 실행
  _Requirements: 9.1, 9.2, 9.5_

- [x] 66. 데이터베이스 스키마 문서 작성
  _Requirements: 10.1_

- [x] 67. 마이그레이션 가이드 작성
  _Requirements: 10.2_

- [x] 68. API 문서 업데이트
  _Requirements: 10.2_

- [x] 69. Troubleshooting 가이드 작성
  _Requirements: 10.4_

- [x] 70. Rollback 절차 문서 작성
  _Requirements: 7.3, 10.5_

- [x] 71. 최종 배포 체크리스트 작성
  _Requirements: 10.2, 10.5_

### Phase 8: Production Deployment

- [x] 72. 직영점 모드 Feature Flag 활성화 (개발 환경)
  _Requirements: 7.1, 7.2_

- [x] 73. 정책 모드 Feature Flag 활성화 (개발 환경)
  _Requirements: 7.1, 7.2_

- [x] 74. 고객 모드 Feature Flag 활성화 (개발 환경)
  _Requirements: 7.1, 7.2_

- [x] 75. 프로덕션 배포 및 모니터링
  _Requirements: 7.1, 7.4, 9.1, 9.2, 9.4_

- [x] 76. 최종 검증 및 프로젝트 완료
  _Requirements: 모든 Requirements_

## Notes

### 마이그레이션 순서
1. **Phase 2**: 스키마 및 스크립트 준비
2. **Phase 3**: 직영점 모드 (14개 시트) - 가장 CRUD가 빈번한 모드
3. **Phase 4**: 정책 모드 (10개 시트)
4. **Phase 5**: 고객 모드 (7개 시트)
5. **Phase 6-8**: 백업, 모니터링, 테스트, 배포

### 각 시트 마이그레이션 작업 내용
각 시트 마이그레이션 태스크(17-51)는 다음을 포함:
1. Google Sheets에서 데이터 읽기
2. 데이터 검증 (DataValidator 사용)
3. 데이터 변환 (필요시)
4. Supabase 테이블에 삽입
5. 무결성 검증
6. 에러 로깅

### 중요 사항
- 모든 마이그레이션은 **Dry-run 모드**로 먼저 테스트
- 각 Phase 완료 후 백업 생성
- Feature Flag로 언제든 롤백 가능
- API 호환성 유지 (프론트엔드 변경 최소화)
- 성능 모니터링 필수

### 구글 시트 유지 (마이그레이션 제외)
- **일반모드권한관리** - 권한 설정 시트 (수동 편집 필요)
