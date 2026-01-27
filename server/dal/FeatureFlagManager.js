const fs = require('fs');
const path = require('path');

class FeatureFlagManager {
  constructor() {
    this.configPath = path.join(__dirname, '../../config/feature-flags.json');
    this.flags = {};
    this.loadFlags();
  }

  /**
   * 플래그 로드 (JSON 파일 -> 환경 변수 순)
   */
  loadFlags() {
    // 1. 기본값 (환경 변수 또는 기본 false)
    // 모드 목록은 modeConfig.js의 MODE_ORDER를 따르지만, 서버에서는 동적으로 모든 키를 수용합니다.
    const defaultFlags = {
      'directStore': process.env.USE_DB_DIRECT_STORE === 'true',
      'policy': process.env.USE_DB_POLICY === 'true',
      'customerMode': process.env.USE_DB_CUSTOMER === 'true',
      'onsale': process.env.USE_DB_ONSALE === 'true',
      'budget': process.env.USE_DB_BUDGET === 'true',
      'quickServiceManagement': process.env.USE_DB_QUICK_SERVICE === 'true',
      'agent': process.env.USE_DB_AGENT === 'true',
      'inventory': process.env.USE_DB_INVENTORY === 'true',
      'settlement': process.env.USE_DB_SETTLEMENT === 'true',
      'inspection': process.env.USE_DB_INSPECTION === 'true',
      'chart': process.env.USE_DB_CHART === 'true',
      'meeting': process.env.USE_DB_MEETING === 'true',
      'reservation': process.env.USE_DB_RESERVATION === 'true',
      'sales': process.env.USE_DB_SALES === 'true',
      'smsManagement': process.env.USE_DB_SMS === 'true',
      'obManagement': process.env.USE_DB_OB === 'true'
    };

    // 2. 저장된 파일 로드
    try {
      if (fs.existsSync(this.configPath)) {
        const savedFlags = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.flags = { ...defaultFlags, ...savedFlags };
      } else {
        this.flags = defaultFlags;
        this.saveFlags(); // 초기 파일 생성
      }
    } catch (error) {
      console.warn('[FeatureFlagManager] Failed to load saved flags:', error.message);
      this.flags = defaultFlags;
    }

    console.log('[FeatureFlagManager] Initialized flags:', this.flags);
  }

  /**
   * 플래그 저장
   */
  saveFlags() {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.flags, null, 2));
    } catch (error) {
      console.error('[FeatureFlagManager] Failed to save flags:', error);
    }
  }

  /**
   * 특정 모드/탭의 Feature Flag 확인
   * 계층 구조 지원 (ex: "quick-service:history")
   */
  isEnabled(key) {
    if (!key) return false;

    // 1. 구체적인 키 확인 (ex: "quick-service:list")
    if (this.flags[key] !== undefined) {
      return this.flags[key];
    }

    // 2. 상위 모드 수준의 키 확인 (ex: "quick-service")
    const parentMode = key.split(':')[0];
    return this.flags[parentMode] || false;
  }

  /**
   * Feature Flag 설정
   */
  setFlag(key, enabled) {
    if (!key) throw new Error('Key is required');
    this.flags[key] = !!enabled;
    this.saveFlags();
    console.log(`[FeatureFlagManager] Flag "${key}" set to ${enabled}`);
  }

  /**
   * 여러 플래그 일괄 설정
   */
  setFlags(flagsToSet) {
    if (!flagsToSet || typeof flagsToSet !== 'object') {
      throw new Error('Flags must be an object');
    }

    Object.entries(flagsToSet).forEach(([key, enabled]) => {
      if (typeof enabled === 'boolean') {
        this.flags[key] = enabled;
      }
    });

    this.saveFlags();
    console.log('[FeatureFlagManager] Updated flags:', this.flags);
  }

  getAllFlags() {
    return { ...this.flags };
  }

  reload() {
    this.loadFlags();
  }
}

module.exports = FeatureFlagManager;
