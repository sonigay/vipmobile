import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

function InventoryRecoveryTable({ data, tabIndex, onStatusUpdate, onRefresh, priorityModels }) {
  const [copySuccess, setCopySuccess] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState({});
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const dataCacheRef = useRef(new Map());
  const renderQueueRef = useRef([]);
  const isRenderingRef = useRef(false);

  // 캐시 키 생성 함수
  const generateCacheKey = useCallback((data, tabIndex) => {
    if (!data || data.length === 0) return `empty-${tabIndex}`;
    
    const dataHash = data.length + '-' + 
      data.slice(0, 3).map(item => 
        `${item.manager}-${item.storeName}-${item.modelName}`
      ).join('-');
    
    return `${tabIndex}-${dataHash}`;
  }, []);

  // 우선순위 확인 함수
  const getPriorityLevel = (modelName) => {
    try {
      if (!priorityModels || !modelName || typeof priorityModels !== 'object') return null;
      
      const entries = Object.entries(priorityModels);
      for (const [priority, model] of entries) {
        if (model === modelName) {
          return priority;
        }
      }
      return null;
    } catch (error) {
      console.error('❌ [InventoryRecoveryTable] getPriorityLevel 에러:', error);
      return null;
    }
  };

  // 색상별 배경색 반환 함수
  const getColorBackground = (color) => {
    const colorMap = {
      // 기본 색상들
      '검정': '#000000',
      '검은색': '#000000',
      '흰색': '#ffffff',
      '화이트': '#ffffff',
      'White': '#ffffff',
      '파랑': '#1976d2',
      '블루': '#1976d2',
      'Blue': '#1976d2',
      '빨강': '#d32f2f',
      '레드': '#d32f2f',
      'Red': '#d32f2f',
      '초록': '#2e7d32',
      '그린': '#2e7d32',
      'Green': '#2e7d32',
      
      // 밝은 색상들
      '노랑': '#f57c00',
      '옐로우': '#f57c00',
      'Yellow': '#f57c00',
      '주황': '#ff9800',
      '오렌지': '#ff9800',
      'Orange': '#ff9800',
      '골드': '#ffd700',
      'Gold': '#ffd700',
      '크림': '#fff8e1',
      'Cream': '#fff8e1',
      '베이지': '#d7ccc8',
      'Beige': '#d7ccc8',
      
      // 중간 톤 색상들
      '보라': '#9c27b0',
      '퍼플': '#9c27b0',
      'Purple': '#9c27b0',
      '핑크': '#e91e63',
      'Pink': '#e91e63',
      '갈색': '#795548',
      '브라운': '#795548',
      'Brown': '#795548',
      '라벤더': '#e1bee7',
      'Lavender': '#e1bee7',
      '코랄': '#ff5722',
      'Coral': '#ff5722',
      
      // 회색 계열
      '회색': '#808080',
      '그레이': '#808080',
      'Gray': '#808080',
      '실버': '#c0c0c0',
      'Silver': '#c0c0c0',
      '실버쉐도우': '#c0c0c0',
      'SilverShadow': '#c0c0c0',
      '다크그레이': '#424242',
      'DarkGray': '#424242',
      
      // 특수 색상들
      '라이트그린': '#90ee90',
      'LightGreen': '#90ee90',
      '아이스블루': '#03a9f4',
      'IceBlue': '#03a9f4',
      '라이트블루': '#03a9f4',
      'LightBlue': '#03a9f4',
      '네이비': '#3f51b5',
      'Navy': '#3f51b5',
      '올리브': '#827717',
      'Olive': '#827717',
      '마린': '#00695c',
      'Marine': '#00695c',
      
      // 티타늄 계열 색상들
      '블랙': '#000000',
      'Black': '#000000',
      '티타늄': '#c0c0c0',
      'Titanium': '#c0c0c0',
      '블랙티타늄': '#2c2c2c',
      'BlackTitanium': '#2c2c2c',
      '티타늄블랙': '#2c2c2c',
      'TitaniumBlack': '#2c2c2c',
      '화이트티타늄': '#f0f0f0',
      'WhiteTitanium': '#f0f0f0',
      '티타늄화이트': '#f0f0f0',
      'TitaniumWhite': '#f0f0f0'
    };
    
    // 색상이 매핑되지 않은 경우 기본값 반환
    if (!colorMap[color]) {
      console.log(`⚠️ 매핑되지 않은 색상: "${color}" - 기본값 사용`);
      return '#e0e0e0'; // 밝은 회색 (검은 글씨가 잘 보임)
    }
    
    return colorMap[color];
  };

  // 색상별 텍스트 색상 반환 함수
  const getColorText = (color) => {
    // 밝은 색상들 (어두운 글씨 필요)
    const lightColors = [
      '흰색', '화이트', 'White', 
      '노랑', '옐로우', 'Yellow', 
      '주황', '오렌지', 'Orange', 
      '실버', 'Silver', '실버쉐도우', 'SilverShadow',
      '골드', 'Gold',
      '크림', 'Cream',
      '베이지', 'Beige',
      '라이트그린', 'LightGreen',
      '아이스블루', 'IceBlue', '라이트블루', 'LightBlue',
      '티타늄', 'Titanium',
      '화이트티타늄', 'WhiteTitanium',
      '티타늄화이트', 'TitaniumWhite'
    ];
    
    // 중간 톤 색상들 (검은 글씨 필요)
    const mediumColors = [
      '라벤더', 'Lavender',
      '코랄', 'Coral'
    ];
    
    // 어두운 색상들 (흰 글씨 필요)
    const darkColors = [
      '블랙', 'Black',
      '블랙티타늄', 'BlackTitanium',
      '티타늄블랙', 'TitaniumBlack',
      '검정', '검은색',
      '그레이', 'Gray', '회색'
    ];
    
    if (lightColors.includes(color)) {
      return '#000000'; // 검은 글씨
    } else if (mediumColors.includes(color)) {
      return '#000000'; // 검은 글씨
    } else if (darkColors.includes(color)) {
      return '#ffffff'; // 흰 글씨
    } else {
      return '#ffffff'; // 기본값: 흰 글씨
    }
  };

  // 색상별 테두리 반환 함수
  const getColorBorder = (color) => {
    const lightColors = ['흰색', '화이트', 'White', '실버', 'Silver', '골드', 'Gold'];
    return lightColors.includes(color) ? '1px solid #ccc' : 'none';
  };

  // 실시간 반영을 위한 최적화된 데이터 그룹화
  const groupedData = useMemo(() => {
    const cacheKey = generateCacheKey(data, tabIndex);
    
    // 실시간 상태 변경이 있는 경우 캐시 무효화
    const hasRealTimeChanges = data.some(item => 
      item.recoveryTargetSelected || item.recoveryCompleted
    );
    
    // 캐시된 데이터가 있고 실시간 변경이 없는 경우에만 사용
    if (!hasRealTimeChanges && dataCacheRef.current.has(cacheKey)) {
      const cached = dataCacheRef.current.get(cacheKey);
      if (Date.now() - cached.timestamp < 5000) { // 5초로 단축 (실시간성 향상)
        return cached.data;
      }
    }
    
    // 새로운 데이터 그룹화 (실시간 반영 우선)
    const groups = {};
    const batchSize = 50; // 배치 크기 축소로 빠른 반영
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      batch.forEach(item => {
        const manager = item.manager || '담당자 미지정';
        if (!groups[manager]) {
          groups[manager] = [];
        }
        groups[manager].push(item);
      });
      
      // 실시간 반영을 위한 최소 지연
      if (i + batchSize < data.length) {
        setTimeout(() => {}, 1);
      }
    }
    
    // 각 담당자별 데이터 정렬: 업체명 → 모델명 → 색상 순으로 오름차순
    Object.keys(groups).forEach(manager => {
      groups[manager].sort((a, b) => {
        // 1순위: 업체명 (storeName) 오름차순
        const storeCompare = (a.storeName || '').localeCompare(b.storeName || '', 'ko-KR');
        if (storeCompare !== 0) return storeCompare;
        
        // 2순위: 모델명 (modelName) 오름차순
        const modelCompare = (a.modelName || '').localeCompare(b.modelName || '', 'ko-KR');
        if (modelCompare !== 0) return modelCompare;
        
        // 3순위: 색상 (color) 오름차순
        return (a.color || '').localeCompare(b.color || '', 'ko-KR');
      });
    });
    
    // 캐시에 저장 (실시간 데이터 우선)
    dataCacheRef.current.set(cacheKey, {
      data: groups,
      timestamp: Date.now(),
      hasRealTimeChanges
    });
    
    return groups;
  }, [data, tabIndex, generateCacheKey]);

  // 테이블 헤더
  const tableHeaders = [
    '담당자',
    '업체명',
    '모델명',
    '색상',
    '일련번호',
    '출고일',
    '상태'
  ];

  // 위경도좌표없는곳 탭일 때만 주소 컬럼 추가
  const getTableHeaders = () => {
    if (tabIndex === 3) { // 위경도좌표없는곳
      return [...tableHeaders, '주소'];
    }
    return tableHeaders;
  };

  // 가상화된 테이블 렌더링을 위한 청크 분할
  const chunkedItems = useMemo(() => {
    const chunks = [];
    const chunkSize = 50; // 한 번에 렌더링할 아이템 수
    
    Object.entries(groupedData).forEach(([manager, items]) => {
      for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push({
          manager,
          items: items.slice(i, i + chunkSize),
          chunkIndex: Math.floor(i / chunkSize),
          totalChunks: Math.ceil(items.length / chunkSize)
        });
      }
    });
    
    return chunks;
  }, [groupedData]);

  // 클립보드 복사 함수 (메모이제이션)
  const handleCopyToClipboard = useCallback(async (manager, items) => {
    let copyText = '';
    
    // 탭별로 다른 형식으로 복사
    if (tabIndex === 0) { // 총 회수대상
      copyText = `📦 총 회수대상 - ${manager}\n`;
      copyText += `담당자명/업체명/모델명/색상/일련번호\n`;
      copyText += `─`.repeat(50) + '\n';
    } else if (tabIndex === 1) { // 금일 회수대상
      copyText = `🎯 금일 회수대상 - ${manager}\n`;
      copyText += `담당자명/업체명/모델명/색상/일련번호\n`;
      copyText += `─`.repeat(50) + '\n';
    } else if (tabIndex === 2) { // 금일 회수완료
      copyText = `✅ 금일 회수완료 - ${manager}\n`;
      copyText += `담당자명/업체명/모델명/색상/일련번호\n`;
      copyText += `─`.repeat(50) + '\n';
    } else if (tabIndex === 3) { // 위경도좌표없는곳
      copyText = `⚠️ 위경도좌표없는곳 - ${manager}\n`;
      copyText += `담당자명/업체명/모델명/색상/일련번호\n`;
      copyText += `─`.repeat(50) + '\n';
    }

    // 데이터 추가
    items.forEach(item => {
      if (tabIndex === 3) { // 위경도좌표없는곳
        copyText += `${item.manager}/${item.storeName}/${item.modelName}/${item.color}/${item.serialNumber}/${item.address || '주소없음'}\n`;
      } else {
        copyText += `${item.manager}/${item.storeName}/${item.modelName}/${item.color}/${item.serialNumber}\n`;
      }
    });

    try {
      await navigator.clipboard.writeText(copyText);
      
      setCopySuccess(prev => ({ ...prev, [manager]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [manager]: false }));
      }, 2000);
      
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      // 폴백: 텍스트 영역 생성 후 복사
      const textArea = document.createElement('textarea');
      textArea.value = copyText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopySuccess(prev => ({ ...prev, [manager]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [manager]: false }));
      }, 2000);
    }
  }, [tabIndex]);

  // 실시간 반영을 위한 강제 새로고침 함수
  const handleForceRefresh = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    const startTime = Date.now();
    
    try {
      // 모든 캐시 강제 무효화
      dataCacheRef.current.clear();
      setCachedData({});
      
      // 즉시 새로고침 실행
      await onRefresh();
      
      setLastRefreshTime(Date.now());
      console.log(`⚡ 강제 새로고침 완료: ${Date.now() - startTime}ms`);
      
    } catch (error) {
      console.error('강제 새로고침 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onRefresh]);

  // 최적화된 새로고침 함수 (기본)
  const handleOptimizedRefresh = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    const startTime = Date.now();
    
    try {
      // 선택적 캐시 무효화
      const cacheKey = generateCacheKey(data, tabIndex);
      dataCacheRef.current.delete(cacheKey);
      
      await onRefresh();
      
      setLastRefreshTime(Date.now());
      console.log(`🔄 최적화 새로고침 완료: ${Date.now() - startTime}ms`);
      
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onRefresh, data, tabIndex, generateCacheKey]);

  // 상태 업데이트 핸들러 (메모이제이션)
  const handleStatusChange = useCallback(async (item, column, value) => {
    try {
      await onStatusUpdate(item.rowIndex, column, value);
    } catch (error) {
      console.error('❌ 상태 업데이트 실패:', error);
      
      // CORS 오류인 경우 사용자에게 안내
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
        alert('⚠️ 서버 연결 오류가 발생했습니다.\n\n원인: CORS 정책 또는 서버 연결 문제\n\n해결방법:\n1. 페이지 새로고침\n2. 잠시 후 다시 시도\n3. 관리자에게 문의');
      } else {
        alert(`❌ 상태 업데이트 실패: ${error.message}`);
      }
    }
  }, [onStatusUpdate]);

  // 실시간 상태 변경 감지 및 성능 모니터링
  useEffect(() => {
    const startTime = performance.now();
    
    // 실시간 상태 변경 감지 (1초마다)
    const realtimeCheckInterval = setInterval(() => {
      const hasChanges = data.some(item => 
        item.recoveryTargetSelected || item.recoveryCompleted
      );
      
      if (hasChanges) {
        // 실시간 변경사항이 있으면 캐시 무효화
        dataCacheRef.current.clear();
        console.log('🔄 실시간 변경사항 감지 - 캐시 무효화');
      }
    }, 1000);
    
    // 주기적 캐시 정리 (2분마다 - 실시간성 향상)
    const cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of dataCacheRef.current.entries()) {
        if (now - value.timestamp > 120000) { // 2분
          dataCacheRef.current.delete(key);
        }
      }
    }, 120000);
    
    return () => {
      const endTime = performance.now();
      console.log(`📊 테이블 렌더링 시간: ${endTime - startTime}ms`);
      clearInterval(realtimeCheckInterval);
      clearInterval(cacheCleanupInterval);
    };
  }, [data]);

  // 데이터가 없는 경우
  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          {tabIndex === 0 && '총 회수대상 데이터가 없습니다.'}
          {tabIndex === 1 && '금일 회수대상 데이터가 없습니다.'}
          {tabIndex === 2 && '금일 회수완료 데이터가 없습니다.'}
          {tabIndex === 3 && '위경도좌표없는곳 데이터가 없습니다.'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* 새로고침 버튼 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          {tabIndex === 0 && '📦 총 회수대상'}
          {tabIndex === 1 && '🎯 금일 회수대상'}
          {tabIndex === 2 && '✅ 금일 회수완료'}
          {tabIndex === 3 && '⚠️ 위경도좌표없는곳'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastRefreshTime > 0 && (
            <Typography variant="caption" color="text.secondary">
              마지막 업데이트: {new Date(lastRefreshTime).toLocaleTimeString()}
            </Typography>
          )}
          <Button
            variant="outlined"
            startIcon={isLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleOptimizedRefresh}
            disabled={isLoading}
            title="최적화된 새로고침"
          >
            {isLoading ? '새로고침 중...' : '새로고침'}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={isLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleForceRefresh}
            disabled={isLoading}
            title="강제 새로고침 (실시간 반영)"
            size="small"
          >
            {isLoading ? '강제 새로고침 중...' : '⚡ 강제'}
          </Button>
        </Box>
      </Box>

      {/* 담당자별 테이블 */}
      {Object.entries(groupedData).map(([manager, items], managerIndex) => (
        <Box key={manager} sx={{ mb: 4 }}>
          {/* 담당자 헤더 */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 2,
            p: 2,
            backgroundColor: '#f5f5f5',
            borderRadius: 1
          }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
              👤 {manager} ({items.length}건)
            </Typography>
            
            {/* 복사 버튼 */}
            <Button
              variant={copySuccess[manager] ? 'contained' : 'outlined'}
              color={copySuccess[manager] ? 'success' : 'primary'}
              startIcon={copySuccess[manager] ? <CheckIcon /> : <CopyIcon />}
              onClick={() => handleCopyToClipboard(manager, items)}
              size="small"
            >
              {copySuccess[manager] ? '복사완료!' : '복사하기'}
            </Button>
          </Box>

          {/* 테이블 */}
          <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                  {getTableHeaders().map((header, index) => (
                    <TableCell 
                      key={index}
                      sx={{ 
                        fontWeight: 'bold',
                        textAlign: index === 0 ? 'left' : 'center',
                        width: tabIndex === 3 && header === '주소' ? '25%' : '10.7%' // 위경도좌표없는곳 탭에서 주소 컬럼만 넓게
                      }}
                    >
                      {header}
                    </TableCell>
                  ))}
                  {/* 액션 컬럼 */}
                  {tabIndex === 0 && (
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                      회수대상선정
                    </TableCell>
                  )}
                  {tabIndex === 1 && (
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                      회수완료
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, itemIndex) => (
                  <TableRow 
                    key={itemIndex}
                    sx={{ 
                      '&:nth-of-type(odd)': { backgroundColor: '#fafafa' },
                      '&:hover': { backgroundColor: '#f0f8ff' }
                    }}
                  >
                    <TableCell sx={{ 
                      fontWeight: 'bold',
                      width: '10.7%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.manager}
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center',
                      width: '18%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.storeName}
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center',
                      width: '10.7%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {item.modelName}
                        </Typography>
                        {getPriorityLevel(item.modelName) && (
                          <Chip
                            label={getPriorityLevel(item.modelName)}
                            size="small"
                            color="primary"
                            variant="filled"
                            sx={{ 
                              fontSize: '0.7rem',
                              height: '20px',
                              fontWeight: 'bold'
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center',
                      width: '10.7%'
                    }}>
                      <Chip 
                        label={item.color} 
                        size="small" 
                        sx={{ 
                          backgroundColor: getColorBackground(item.color),
                          color: getColorText(item.color),
                          border: getColorBorder(item.color),
                          fontWeight: 'bold',
                          minWidth: '60px'
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center',
                      width: '10.7%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.serialNumber}
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center',
                      width: '10.7%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.recentShipmentDate || '출고일 정보 없음'}
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center',
                      width: '10.7%'
                    }}>
                      <Chip 
                        label={item.deviceStatus} 
                        size="small"
                        color={item.deviceStatus === '정상' ? 'success' : 'warning'}
                      />
                    </TableCell>
                                         
                    {/* 주소 컬럼 - 위경도좌표없는곳 탭에서만 표시 */}
                    {tabIndex === 3 && (
                      <TableCell sx={{ 
                        textAlign: 'center',
                        width: '25%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        <Typography variant="body2" sx={{ 
                          wordBreak: 'break-word',
                          fontSize: '0.875rem'
                        }}>
                          {item.address || '주소 정보 없음'}
                        </Typography>
                      </TableCell>
                    )}
                    
                                         {/* 액션 컬럼 */}
                     {tabIndex === 0 && (
                       <TableCell sx={{ 
                         textAlign: 'center',
                         width: '10.7%'
                       }}>
                         {item.recoveryCompleted ? (
                           // 회수완료 상태일 때는 회수대상점 선정 취소 불가
                           <Tooltip title="회수완료 상태입니다. 회수완료를 먼저 취소해주세요.">
                             <span>
                               <Button
                                 variant="contained"
                                 color="success"
                                 size="small"
                                 disabled
                                 sx={{ opacity: 0.7 }}
                               >
                                 회수완료됨
                               </Button>
                             </span>
                           </Tooltip>
                         ) : (
                           <Button
                             variant={item.recoveryTargetSelected ? 'contained' : 'outlined'}
                             color={item.recoveryTargetSelected ? 'success' : 'primary'}
                             size="small"
                             onClick={() => {
                               const newValue = item.recoveryTargetSelected ? '' : 'O';
                               // 회수대상선정 취소 시 회수완료도 함께 취소
                               if (!newValue && item.recoveryCompleted) {
                                 // 회수대상선정 취소 시 회수완료도 취소
                                 handleStatusChange(item, 'recoveryCompleted', '');
                               }
                               handleStatusChange(item, 'recoveryTargetSelected', newValue);
                             }}
                           >
                             {item.recoveryTargetSelected ? '선정됨' : '선정하기'}
                           </Button>
                         )}
                       </TableCell>
                     )}
                    
                                         {tabIndex === 1 && (
                       <TableCell sx={{ 
                         textAlign: 'center',
                         width: '10.7%'
                       }}>
                         {!item.recoveryTargetSelected ? (
                           // 회수대상점 선정이 안된 상태일 때는 회수완료 불가
                           <Tooltip title="회수대상점 선정이 필요합니다. 먼저 선정해주세요.">
                             <span>
                               <Button
                                 variant="outlined"
                                 color="default"
                                 size="small"
                                 disabled
                                 sx={{ opacity: 0.7 }}
                               >
                                 선정 필요
                               </Button>
                             </span>
                           </Tooltip>
                         ) : (
                           <Button
                             variant={item.recoveryCompleted ? 'contained' : 'outlined'}
                             color={item.recoveryCompleted ? 'success' : 'primary'}
                             size="small"
                             onClick={() => handleStatusChange(
                               item, 
                               'recoveryCompleted', 
                               item.recoveryCompleted ? '' : 'O'
                             )}
                           >
                             {item.recoveryCompleted ? '완료됨' : '완료하기'}
                           </Button>
                         )}
                       </TableCell>
                     )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      {/* 복사 성공 알림 */}
      {Object.values(copySuccess).some(success => success) && (
        <Alert severity="success" sx={{ mt: 2 }}>
          클립보드에 복사되었습니다! 카톡 등에 붙여넣기하여 사용하세요.
        </Alert>
      )}
    </Box>
  );
}

export default InventoryRecoveryTable;
