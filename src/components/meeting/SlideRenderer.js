import React, { useState, useEffect, useRef } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import { getModeConfig } from '../../config/modeConfig';
import ChartMode from '../ChartMode';
import { getAvailableTabsForMode } from '../../config/modeTabConfig';

/**
 * 슬라이드를 렌더링하는 컴포넌트
 * presentation mode로 렌더링하여 헤더 없이 콘텐츠만 표시
 */
function SlideRenderer({ slide, loggedInStore, onReady }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    console.log('🔍 [SlideRenderer] 슬라이드 렌더링 시작:', slide);
    setLoading(true);
    setContentReady(false);
    
    // 데이터 로딩 완료 대기 함수 - 매우 확실한 방법
    const waitForDataLoad = () => {
      return new Promise((resolve) => {
        let stableCount = 0; // 연속으로 안정적인 상태가 유지된 횟수
        const requiredStableCount = 50; // 5초 동안 안정적이어야 함 (50 * 100ms)
        let checkStartTime = null;
        let lastStableTime = null;
        
        // MutationObserver로 DOM 변화 감지
        const observer = new MutationObserver(() => {
          // DOM이 변경되면 안정성 카운터 리셋
          if (stableCount > 0) {
            console.log(`🔄 [SlideRenderer] DOM 변화 감지, 안정성 카운터 리셋 (이전: ${stableCount})`);
            stableCount = 0;
            lastStableTime = null;
          }
        });
        
        const checkLoading = () => {
          if (!checkStartTime) {
            checkStartTime = Date.now();
          }
          
          const timeSinceStart = Date.now() - checkStartTime;
          
          // 로딩 인디케이터가 있는지 확인 (더 엄격하게)
          const loadingIndicators = containerRef.current?.querySelectorAll(
            '.MuiCircularProgress-root, .MuiLinearProgress-root, [class*="loading"], [class*="Loading"], [class*="spinner"], [class*="Loading"]'
          );
          
          // data-loading 속성이 있는 요소 확인
          const dataLoadingElements = containerRef.current?.querySelectorAll('[data-loading="true"]');
          
          // 데이터 로딩 상태 확인
          const dataLoaded = containerRef.current?.querySelector('[data-loaded="true"]') !== null;
          const dataLoading = dataLoadingElements && dataLoadingElements.length > 0;
          
          // "로딩 중", "불러오는 중" 등의 텍스트가 있는지 확인 (더 엄격하게)
          const allText = containerRef.current?.textContent || '';
          const hasLoadingText = 
            allText.includes('로딩') || 
            allText.includes('불러오는 중') || 
            allText.includes('데이터를 불러오는 중') || 
            allText.includes('마감장표 데이터 로딩 중') ||
            allText.includes('데이터 로딩 중');
          
          // 로딩 인디케이터가 없고, data-loading이 false이고, 로딩 텍스트가 없어야 함
          const hasAnyLoadingIndicator = (loadingIndicators && loadingIndicators.length > 0) || dataLoading;
          const isLoading = hasAnyLoadingIndicator || hasLoadingText;
          
          // data-loaded가 true이고 data-loading이 false여야 완료
          const isDataReady = dataLoaded && !dataLoading;
          
          // 실제 데이터가 렌더링되었는지 확인 (더 엄격하게)
          // 테이블 행이 실제로 존재하는지 확인 (최소 1개 이상)
          const tableRows = containerRef.current?.querySelectorAll('table tbody tr, .MuiTableBody-root tr, tbody tr') || [];
          const hasTableRows = tableRows.length > 0;
          
          // 차트나 SVG가 실제로 렌더링되었는지 확인
          const chartElements = containerRef.current?.querySelectorAll('[class*="Chart"], canvas, svg, [class*="chart"]') || [];
          const hasChartContent = chartElements.length > 0;
          
          // Paper 컴포넌트가 있고 내용이 있는지 확인
          const paperElements = containerRef.current?.querySelectorAll('.MuiPaper-root') || [];
          const hasPaperContent = paperElements.length > 0;
          
          // 실제 데이터가 있는지 확인 (텍스트 내용이 "로딩", "불러오는 중" 등이 아닌 실제 데이터)
          const hasRealData = hasTableRows || hasChartContent || hasPaperContent;
          
          // 추가 검증: 테이블이 있으면 최소 1개 이상의 데이터 행이 있어야 함
          const hasValidTableData = hasTableRows && tableRows.length > 0;
          
          // 로딩이 완전히 없고, 데이터가 준비되었고, 실제 콘텐츠가 있어야 완료
          // 테이블이 있으면 유효한 데이터 행이 있어야 함
          const isContentReady = !isLoading && isDataReady && hasRealData && (hasTableRows ? hasValidTableData : true);
          
          if (isContentReady) {
            if (lastStableTime === null) {
              lastStableTime = Date.now();
            }
            stableCount++;
            
            const stableDuration = (Date.now() - lastStableTime) / 1000;
            console.log(`✅ [SlideRenderer] 안정적인 상태 확인 (${stableCount}/${requiredStableCount}, ${stableDuration.toFixed(1)}초 유지):`, {
              hasLoadingIndicator: loadingIndicators?.length > 0,
              dataLoading,
              dataLoaded,
              hasLoadingText,
              hasRealData,
              hasTableRows: tableRows.length,
              hasValidTableData,
              hasChartContent: chartElements.length,
              hasPaperContent: paperElements.length,
              timeSinceStart: Math.round(timeSinceStart / 1000) + '초'
            });
            
            // 연속으로 안정적인 상태가 5초 이상 유지되면 완료
            if (stableCount >= requiredStableCount) {
              console.log('✅ [SlideRenderer] 데이터 로딩 완료 (5초 이상 안정적인 상태 유지됨)');
              observer.disconnect();
              resolve();
              return;
            }
          } else {
            // 안정적이지 않으면 카운터 리셋
            if (stableCount > 0) {
              console.log(`⚠️ [SlideRenderer] 안정적인 상태가 깨짐, 카운터 리셋 (이전: ${stableCount})`);
              stableCount = 0;
              lastStableTime = null;
            }
            
            console.log(`🔍 [SlideRenderer] 데이터 로딩 확인 (${Math.round(timeSinceStart / 1000)}초 경과):`, {
              hasLoadingIndicator: loadingIndicators?.length > 0,
              dataLoading,
              dataLoaded,
              hasLoadingText,
              hasRealData,
              hasTableRows: tableRows.length,
              hasValidTableData,
              hasChartContent: chartElements.length,
              hasPaperContent: paperElements.length,
              isLoading,
              isDataReady,
              isContentReady
            });
          }
          
          // 최대 30초 대기
          if (timeSinceStart >= 30000) {
            if (isContentReady) {
              console.warn('⚠️ [SlideRenderer] 타임아웃 (30초), 하지만 콘텐츠 준비됨 - 진행');
            } else {
              console.warn('⚠️ [SlideRenderer] 타임아웃 (30초), 강제 진행');
            }
            observer.disconnect();
            resolve();
            return;
          }
          
          setTimeout(checkLoading, 100);
        };
        
        // MutationObserver 시작
        if (containerRef.current) {
          observer.observe(containerRef.current, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-loading', 'data-loaded', 'class']
          });
        }
        
        // 최소 15초 대기 후 체크 시작 (데이터 로딩 시간 충분히 고려)
        console.log('⏳ [SlideRenderer] 초기 대기 시작 (15초)');
        setTimeout(() => {
          console.log('⏳ [SlideRenderer] 데이터 로딩 체크 시작');
          checkLoading();
        }, 15000);
      });
    };
    
    // 최소 15초 대기 후 데이터 로딩 완료 확인 (더 긴 대기 시간)
    const timer = setTimeout(async () => {
      console.log('⏳ [SlideRenderer] 데이터 로딩 대기 시작 (15초 초기 대기 완료)');
      await waitForDataLoad();
      console.log('✅ [SlideRenderer] 데이터 로딩 완료 확인됨, 추가 안정화 대기 (10초)');
      
      // 추가로 10초 대기하여 완전히 안정화
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // 최종 확인: data-loaded 속성이 여전히 true인지 확인
      const finalCheck = containerRef.current?.querySelector('[data-loaded="true"]') !== null;
      const finalLoadingIndicators = containerRef.current?.querySelectorAll('.MuiCircularProgress-root, .MuiLinearProgress-root, [class*="loading"]');
      const finalProgressBars = containerRef.current?.querySelectorAll('.MuiLinearProgress-root, [class*="progress"]');
      const finalHasNoLoading = finalLoadingIndicators.length === 0 && finalProgressBars.length === 0;
      
      // 최종 테이블 행 확인 (최소 3개 이상)
      const finalTableRows = containerRef.current?.querySelectorAll('table tbody tr, .MuiTableBody-root tr, tbody tr') || [];
      const finalHasTableRows = finalTableRows.length >= 3;
      
      if (!finalCheck || !finalHasNoLoading || !finalHasTableRows) {
        console.warn('⚠️ [SlideRenderer] 최종 확인 실패:', {
          dataLoaded: finalCheck,
          hasNoLoading: finalHasNoLoading,
          hasTableRows: finalTableRows.length,
          required: '>= 3'
        });
        console.warn('⚠️ [SlideRenderer] 추가 대기 (5초)');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 재확인
        const retryCheck = containerRef.current?.querySelector('[data-loaded="true"]') !== null;
        const retryTableRows = containerRef.current?.querySelectorAll('table tbody tr, .MuiTableBody-root tr, tbody tr') || [];
        if (!retryCheck || retryTableRows.length < 3) {
          console.error('❌ [SlideRenderer] 재확인 실패, 로딩 화면일 가능성 높음');
          // 그래도 진행 (타임아웃 방지)
        }
      }
      
      console.log('✅ [SlideRenderer] 안정화 완료, onReady 호출 준비');
      setLoading(false);
      setContentReady(true);
      
      // 추가 대기 후 onReady 호출 (렌더링 완료 보장)
      setTimeout(() => {
        if (onReady) {
          console.log('✅ [SlideRenderer] onReady 콜백 호출');
          onReady();
        }
      }, 2000); // 1초에서 2초로 증가
    }, 15000); // 10초에서 15초로 증가

    return () => clearTimeout(timer);
  }, [slide, onReady]);

  const renderSlideContent = () => {
    if (slide.type === 'custom') {
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: slide.backgroundColor || '#ffffff',
            p: 4,
            overflow: 'auto'
          }}
        >
          <Box sx={{ textAlign: 'center', maxWidth: 1200, width: '100%' }}>
            {slide.imageUrl && (
              <Box
                component="img"
                src={slide.imageUrl}
                alt={slide.title || '커스텀 이미지'}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '60vh',
                  objectFit: 'contain',
                  mb: 3,
                  borderRadius: 1
                }}
              />
            )}
            <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>
              {slide.title || '커스텀 화면'}
            </h1>
            {slide.content && (
              <p style={{ fontSize: '1.5rem', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {slide.content}
              </p>
            )}
          </Box>
        </Box>
      );
    }

    // mode-tab 타입
    const modeConfig = getModeConfig(slide.mode);
    if (!modeConfig) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="error">모드를 찾을 수 없습니다: {slide.mode}</Alert>
        </Box>
      );
    }

    // 장표 모드인 경우 실제 컴포넌트 렌더링
    if (slide.mode === 'chart') {
      const availableTabs = getAvailableTabsForMode('chart', loggedInStore);
      const tabIndex = availableTabs.findIndex(t => t.key === slide.tab);
      
      // 하부 탭이 있는 경우 처리
      let subTabIndex = undefined;
      if (slide.subTab && availableTabs[tabIndex]?.subTabs) {
        const foundIndex = availableTabs[tabIndex].subTabs.findIndex(st => st.key === slide.subTab);
        if (foundIndex >= 0) {
          subTabIndex = foundIndex;
          console.log(`🔍 [SlideRenderer] 하부 탭 인덱스 계산: ${slide.subTab} -> ${subTabIndex}`);
        } else {
          console.warn(`⚠️ [SlideRenderer] 하부 탭을 찾을 수 없음: ${slide.subTab}`);
        }
      }
      
      console.log(`🔍 [SlideRenderer] ChartMode 렌더링:`, {
        tab: slide.tab,
        tabIndex,
        subTab: slide.subTab,
        subTabIndex,
        slideId: slide.slideId
      });
      
      return (
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          position: 'relative',
          overflow: 'auto',
          backgroundColor: '#ffffff',
          '& .MuiAppBar-root': { display: 'none' }, // 헤더 숨기기
          '& .MuiTabs-root': { display: 'none' } // 탭 네비게이션 숨기기
        }}
      >
        <ChartMode
          loggedInStore={loggedInStore}
          onLogout={() => {}}
          onModeChange={() => {}}
          availableModes={[]}
          presentationMode={true}
          initialTab={tabIndex >= 0 ? tabIndex : 0}
          initialSubTab={subTabIndex}
        />
      </Box>
      );
    }

    // 다른 모드는 임시로 메시지 표시 (추후 구현)
    return (
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f5f5f5',
          p: 4
        }}
      >
        <Alert severity="info" sx={{ maxWidth: 600 }}>
          {modeConfig.title} > {slide.tabLabel || slide.tab}
          {slide.subTabLabel && ` > ${slide.subTabLabel}`}
          <br />
          <small>Presentation mode 렌더링 준비 중...</small>
        </Alert>
      </Box>
    );
  };

  return (
    <Box
      ref={containerRef}
      data-slide-id={slide.slideId || slide.id}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        backgroundColor: '#ffffff',
        overflow: 'auto'
      }}
    >
      {/* 로딩 중이어도 콘텐츠를 먼저 렌더링하여 사용자가 볼 수 있도록 함 */}
      {renderSlideContent()}
      
      {/* 로딩 중일 때 반투명 오버레이 표시 */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            pointerEvents: 'none' // 클릭 이벤트는 아래 콘텐츠로 전달
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={60} />
            <Box sx={{ mt: 2, color: '#666', fontSize: '1.1rem', fontWeight: 500 }}>
              데이터 로딩 중...
            </Box>
          </Box>
        </Box>
      )}
      
      {/* 에러 표시 */}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10001,
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
          }}
        >
          <Alert severity="error" sx={{ maxWidth: 600 }}>
            {error}
          </Alert>
        </Box>
      )}
    </Box>
  );
}

export default SlideRenderer;

