# Requirements Document

## Introduction

VIP Map Application은 현재 Google Sheets API를 주요 데이터 저장소로 사용하고 있습니다. 시스템이 성장하면서 애플리케이션 내에서 빈번한 CRUD 작업이 발생하는 데이터에 대해서는 전통적인 데이터베이스가 더 적합한 것으로 판단되었습니다. 본 프로젝트는 Google Sheets와 전통 DB를 병행 사용하는 하이브리드 시스템으로 점진적으로 전환하는 것을 목표로 합니다.

## Glossary

- **System**: VIP Map Application의 백엔드 서버
- **Hybrid_Storage**: Google Sheets와 전통 DB를 동시에 사용하는 데이터 저장 방식
- **Priority_Modes**: 우선 마이그레이션 대상 모드 (직영점, 고객, 정책)
- **Legacy_Modes**: 단계적으로 천천히 마이그레이션할 나머지 모드들
- **DB_Layer**: 데이터베이스 접근을 추상화하는 계층
- **Migration_Script**: Google Sheets 데이터를 DB로 이전하는 스크립트
- **Data_Sync**: Google Sheets와 DB 간 데이터 동기화 메커니즘

## Requirements

### Requirement 1: Database Solution Selection

**User Story:** As a system administrator, I want to use a free database solution, so that I can reduce operational costs while maintaining system reliability.

#### Acceptance Criteria

1. THE System SHALL use Supabase (PostgreSQL-based) as the primary database solution
2. THE System SHALL use Supabase free tier which provides 500MB database storage and unlimited API requests
3. THE System SHALL use @supabase/supabase-js official Node.js client library for database operations
4. THE System SHALL provide step-by-step setup documentation including:
   - Supabase account creation (https://supabase.com)
   - Project creation and configuration
   - Connection credentials (SUPABASE_URL and SUPABASE_KEY) setup
   - Web dashboard usage guide for data management
5. THE System SHALL leverage Supabase's automatic backup feature included in the free tier

### Requirement 2: Data Classification

**User Story:** As a system architect, I want clear criteria for data classification, so that I can determine which data stays in Google Sheets and which migrates to the database.

#### Acceptance Criteria

1. WHEN data requires manual editing by non-technical users THEN THE System SHALL keep it in Google Sheets
2. WHEN data undergoes frequent CRUD operations through the application THEN THE System SHALL migrate it to the database
3. WHEN data serves as configuration or reference data THEN THE System SHALL keep it in Google Sheets
4. THE System SHALL document the classification criteria for all 20+ operational modes

### Requirement 3: Priority Mode Data Schema

**User Story:** As a developer, I want well-defined database schemas for priority modes, so that I can implement data migration and API updates correctly.

#### Acceptance Criteria

1. THE System SHALL define database schemas for the following Direct Store mode Google Sheets:
   - 직영점_정책_마진 (Policy Margin)
   - 직영점_정책_부가서비스 (Policy Add-on Services)
   - 직영점_정책_보험상품 (Policy Insurance Products)
   - 직영점_정책_별도 (Policy Special)
   - 직영점_설정 (Settings)
   - 직영점_메인페이지문구 (Main Page Texts)
   - 직영점_요금제마스터 (Plan Master)
   - 직영점_단말마스터 (Device Master)
   - 직영점_단말요금정책 (Device Pricing Policy)
   - 직영점_모델이미지 (Model Images)
   - 직영점_오늘의휴대폰 (Today's Mobiles)
   - 직영점_대중교통위치 (Transit Locations)
   - 직영점_매장사진 (Store Photos)

2. THE System SHALL define database schemas for the following Policy mode Google Sheets:
   - 정책모드_정책표설정 (Policy Table Settings)
   - 정책모드_정책표목록 (Policy Table List)
   - 정책모드_일반사용자그룹 (User Groups)
   - 정책표목록_탭순서 (Tab Order)
   - 정책모드_정책영업그룹_변경이력 (Group Change History)
   - 정책모드_기본정책영업그룹 (Default Groups)
   - 정책모드_기타정책목록 (Other Policy Types)
   - 예산모드_예산채널설정 (Budget Channel Settings)
   - 예산모드_기본예산설정 (Basic Budget Settings)
   - 예산모드_기본데이터설정 (Basic Data Settings)

3. THE System SHALL define database schemas for Customer mode data (to be determined during design phase based on actual usage patterns)

4. THE System SHALL use appropriate PostgreSQL data types, constraints, and indexes for each schema

5. THE System SHALL define foreign key relationships between related entities to maintain referential integrity

### Requirement 4: Data Migration Strategy

**User Story:** As a system administrator, I want a safe data migration process, so that I can transfer existing Google Sheets data to the database without data loss.

#### Acceptance Criteria

1. THE Migration_Script SHALL read all existing data from Google Sheets for priority modes
2. THE Migration_Script SHALL validate data integrity before inserting into the database
3. THE Migration_Script SHALL log all migration operations including success and failure counts
4. THE Migration_Script SHALL support dry-run mode to preview migration without making changes
5. WHEN migration fails for a record THEN THE Migration_Script SHALL continue processing remaining records and report errors at the end

### Requirement 5: Database Abstraction Layer

**User Story:** As a developer, I want a database abstraction layer, so that I can switch between Google Sheets and database implementations without changing business logic.

#### Acceptance Criteria

1. THE DB_Layer SHALL provide a unified interface for data access operations (create, read, update, delete)
2. THE DB_Layer SHALL support both Google Sheets and database implementations through a common interface
3. THE DB_Layer SHALL handle connection pooling and error handling internally
4. THE DB_Layer SHALL provide transaction support for database operations
5. WHEN a database operation fails THEN THE DB_Layer SHALL throw descriptive errors with context

### Requirement 6: API Endpoint Updates

**User Story:** As a developer, I want updated API endpoints for priority modes, so that the frontend can interact with the new database backend.

#### Acceptance Criteria

1. WHEN priority mode APIs are updated THEN THE System SHALL maintain backward compatibility with existing request/response formats
2. THE System SHALL update Direct Store API endpoints to use the database instead of Google Sheets
3. THE System SHALL update Customer mode API endpoints to use the database instead of Google Sheets
4. THE System SHALL update Policy mode API endpoints to use the database instead of Google Sheets
5. THE System SHALL maintain existing authentication and authorization logic for all updated endpoints

### Requirement 7: Gradual Rollout Strategy

**User Story:** As a system administrator, I want a gradual rollout strategy, so that I can minimize risk and ensure system stability during migration.

#### Acceptance Criteria

1. THE System SHALL support feature flags to enable/disable database usage per mode
2. THE System SHALL allow running priority modes in database mode while Legacy_Modes continue using Google Sheets
3. WHEN a mode is in migration THEN THE System SHALL provide a rollback mechanism to revert to Google Sheets
4. THE System SHALL log all data access operations during migration period for audit purposes
5. THE System SHALL monitor error rates and performance metrics for migrated modes

### Requirement 8: Data Synchronization and Backup

**User Story:** As a system administrator, I want data synchronization and backup mechanisms, so that I can ensure data consistency and recoverability.

#### Acceptance Criteria

1. THE System SHALL perform automated daily backups of the database
2. THE System SHALL retain database backups for at least 30 days
3. WHEN critical data changes occur THEN THE System SHALL create point-in-time snapshots
4. THE System SHALL provide a backup restoration script with validation
5. THE System SHALL document the backup and restoration procedures

### Requirement 9: Performance Monitoring

**User Story:** As a system administrator, I want performance monitoring for database operations, so that I can identify and resolve performance issues.

#### Acceptance Criteria

1. THE System SHALL log query execution times for all database operations
2. WHEN a query exceeds 1000ms THEN THE System SHALL log a performance warning
3. THE System SHALL track database connection pool utilization
4. THE System SHALL provide a health check endpoint that includes database connectivity status
5. THE System SHALL monitor database storage usage and alert when approaching limits

### Requirement 10: Documentation and Training

**User Story:** As a team member, I want comprehensive documentation, so that I can understand and maintain the hybrid storage system.

#### Acceptance Criteria

1. THE System SHALL provide documentation for database schema design and relationships
2. THE System SHALL provide documentation for the migration process with step-by-step instructions
3. THE System SHALL provide documentation for the database abstraction layer API
4. THE System SHALL provide troubleshooting guides for common database issues
5. THE System SHALL provide documentation for rollback procedures in case of migration failures
