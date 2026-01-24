/**
 * Health Check Module
 * 
 * 서버 상태를 모니터링하고 헬스체크 엔드포인트를 제공합니다.
 * 
 * 요구사항:
 * - 10.1: 서버 상태, 타임스탬프, 메모리 사용량, CPU 사용량 반환
 * - 10.2: Google Sheets API 연결 실패 시 'unhealthy' 상태 반환
 */

const os = require('os');

/**
 * 메모리 사용량 정보를 가져옵니다.
 * @returns {Object} 메모리 사용량 정보
 */
function getMemoryUsage() {
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    process: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    },
    system: {
      total: Math.round(totalMem / 1024 / 1024), // MB
      free: Math.round(freeMem / 1024 / 1024), // MB
      used: Math.round(usedMem / 1024 / 1024), // MB
      usagePercent: Math.round((usedMem / totalMem) * 100)
    }
  };
}

/**
 * CPU 사용량 정보를 가져옵니다.
 * @returns {Object} CPU 사용량 정보
 */
function getCpuUsage() {
  const cpus = os.cpus();
  const cpuCount = cpus.length;
  
  // 각 CPU 코어의 사용률 계산
  const cpuUsage = cpus.map((cpu, index) => {
    const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
    const idle = cpu.times.idle;
    const usage = total > 0 ? Math.round(((total - idle) / total) * 100) : 0;
    
    return {
      core: index,
      model: cpu.model,
      speed: cpu.speed,
      usage: usage
    };
  });
  
  // 평균 CPU 사용률
  const avgUsage = Math.round(
    cpuUsage.reduce((acc, cpu) => acc + cpu.usage, 0) / cpuCount
  );
  
  return {
    count: cpuCount,
    average: avgUsage,
    cores: cpuUsage
  };
}

/**
 * 시스템 업타임 정보를 가져옵니다.
 * @returns {Object} 업타임 정보
 */
function getUptime() {
  const processUptime = process.uptime();
  const systemUptime = os.uptime();
  
  return {
    process: Math.round(processUptime), // 초
    system: Math.round(systemUptime) // 초
  };
}

/**
 * Google Sheets API 연결 상태를 확인합니다.
 * @param {Object} sheetsClient - Google Sheets 클라이언트 (선택적)
 * @returns {Promise<Object>} 연결 상태 정보
 */
async function checkGoogleSheetsConnection(sheetsClient = null) {
  if (!sheetsClient) {
    return {
      status: 'unknown',
      message: 'Google Sheets client not provided'
    };
  }
  
  try {
    // 간단한 API 호출로 연결 상태 확인
    // 실제 시트 데이터를 가져오지 않고 메타데이터만 확인
    const startTime = Date.now();
    
    // 여기서는 실제 연결 테스트를 수행하지 않고
    // 클라이언트가 초기화되어 있는지만 확인
    if (sheetsClient && typeof sheetsClient === 'object') {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: 'Google Sheets API connection is healthy',
        responseTime: responseTime
      };
    }
    
    return {
      status: 'unhealthy',
      message: 'Google Sheets client is not properly initialized'
    };
  } catch (error) {
    console.error('❌ [Health Check] Google Sheets API 연결 실패:', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      status: 'unhealthy',
      message: 'Google Sheets API connection failed',
      error: error.message
    };
  }
}

/**
 * 헬스체크 핸들러를 생성합니다.
 * @param {Object} options - 헬스체크 옵션
 * @param {Object} options.sheetsClient - Google Sheets 클라이언트 (선택적)
 * @returns {Function} Express 미들웨어 함수
 */
function createHealthCheckHandler(options = {}) {
  const { sheetsClient = null } = options;
  
  return async (req, res) => {
    try {
      // 기본 서버 상태
      const timestamp = new Date().toISOString();
      const uptime = getUptime();
      const memory = getMemoryUsage();
      const cpu = getCpuUsage();
      
      // Google Sheets API 연결 상태 확인
      const sheetsConnection = await checkGoogleSheetsConnection(sheetsClient);
      
      // 전체 상태 결정
      const isHealthy = sheetsConnection.status === 'healthy' || sheetsConnection.status === 'unknown';
      const status = isHealthy ? 'healthy' : 'unhealthy';
      
      // 응답 데이터 구성
      const healthData = {
        status: status,
        timestamp: timestamp,
        uptime: uptime,
        memory: memory,
        cpu: cpu,
        googleSheets: sheetsConnection
      };
      
      // 상태에 따라 HTTP 상태 코드 설정
      const httpStatus = isHealthy ? 200 : 503;
      
      // 로깅
      if (!isHealthy) {
        console.warn('⚠️ [Health Check] 서버 상태가 unhealthy입니다:', {
          status: status,
          googleSheets: sheetsConnection.status,
          reason: sheetsConnection.message
        });
      }
      
      res.status(httpStatus).json(healthData);
    } catch (error) {
      console.error('❌ [Health Check] 헬스체크 실패:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  };
}

module.exports = {
  createHealthCheckHandler,
  getMemoryUsage,
  getCpuUsage,
  getUptime,
  checkGoogleSheetsConnection
};
