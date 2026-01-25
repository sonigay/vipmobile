/**
 * Feature Flag Manager
 * 
 * 모드별로 데이터 소스를 동적으로 전환합니다.
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

class FeatureFlagManager {
  constructor() {
    // 환경 변수에서 Feature Flags 로드
    this.flags = {
      'direct-store': process.env.USE_DB_DIRECT_STORE === 'true',
      'policy': process.env.USE_DB_POLICY === 'true',
      'customer': process.env.USE_DB_CUSTOMER === 'true',
      'onsale': process.env.USE_DB_ONSALE === 'true',
      'budget': process.env.USE_DB_BUDGET === 'true'
    };

    console.log('[FeatureFlagManager] Initialized with flags:', this.flags);
  }

  /**
   * 특정 모드의 Feature Flag 확인
   * @param {string} mode - 모드 이름
   * @returns {boolean} 활성화 여부
   */
  isEnabled(mode) {
    if (!mode) {
      return false;
    }

    const enabled = this.flags[mode] || false;
    console.log(`[FeatureFlagManager] Mode "${mode}" is ${enabled ? 'enabled' : 'disabled'}`);
    return enabled;
  }

  /**
   * Feature Flag 활성화
   * @param {string} mode - 모드 이름
   */
  enable(mode) {
    if (!mode) {
      throw new Error('Mode name is required');
    }

    this.flags[mode] = true;
    console.log(`[FeatureFlagManager] Enabled mode: ${mode}`);
  }

  /**
   * Feature Flag 비활성화
   * @param {string} mode - 모드 이름
   */
  disable(mode) {
    if (!mode) {
      throw new Error('Mode name is required');
    }

    this.flags[mode] = false;
    console.log(`[FeatureFlagManager] Disabled mode: ${mode}`);
  }

  /**
   * 모든 Feature Flags 조회
   * @returns {Object} 모든 플래그 상태
   */
  getAllFlags() {
    return { ...this.flags };
  }

  /**
   * 여러 모드 일괄 설정
   * @param {Object} flagsToSet - 설정할 플래그 객체
   */
  setFlags(flagsToSet) {
    if (!flagsToSet || typeof flagsToSet !== 'object') {
      throw new Error('Flags must be an object');
    }

    Object.entries(flagsToSet).forEach(([mode, enabled]) => {
      if (typeof enabled === 'boolean') {
        this.flags[mode] = enabled;
      }
    });

    console.log('[FeatureFlagManager] Updated flags:', this.flags);
  }

  /**
   * 환경 변수에서 플래그 다시 로드
   */
  reload() {
    this.flags = {
      'direct-store': process.env.USE_DB_DIRECT_STORE === 'true',
      'policy': process.env.USE_DB_POLICY === 'true',
      'customer': process.env.USE_DB_CUSTOMER === 'true',
      'onsale': process.env.USE_DB_ONSALE === 'true',
      'budget': process.env.USE_DB_BUDGET === 'true'
    };

    console.log('[FeatureFlagManager] Reloaded flags from environment:', this.flags);
  }
}

module.exports = FeatureFlagManager;
