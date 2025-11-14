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
    
    // 데이터 로딩 완료 대기 함수
    const waitForDataLoad = () => {
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // 최대 5초 (50 * 100ms)
        
        const checkLoading = () => {
          attempts++;
          
          // 로딩 인디케이터가 있는지 확인
          const loadingIndicators = containerRef.current?.querySelectorAll(
            '.MuiCircularProgress-root, .MuiLinearProgress-root, [class*="loading"], [class*="Loading"], [class*="spinner"]'
          );
          
          // 데이터 로딩 상태 확인 (data-loaded와 data-loading 속성)
          const dataLoaded = containerRef.current?.querySelector('[data-loaded="true"]') !== null;
          const dataLoading = containerRef.current?.querySelector('[data-loading="true"]') !== null;
          
          // "로딩 중", "불러오는 중" 등의 텍스트가 있는지 확인
          const loadingTexts = containerRef.current?.querySelectorAll(
            '*:not(script):not(style)'
          );
          let hasLoadingText = false;
          if (loadingTexts) {
            Array.from(loadingTexts).forEach(el => {
              const text = el.textContent || '';
              if (text.includes('로딩') || text.includes('불러오는 중') || text.includes('데이터를 불러오는 중')) {
                hasLoadingText = true;
              }
            });
          }
          
          // 로딩 인디케이터가 없고, data-loading이 false이고, data-loaded가 true이면 완료
          const isLoading = (loadingIndicators && loadingIndicators.length > 0) || dataLoading || hasLoadingText;
          
          // data-loaded가 true이고 data-loading이 false여야 완료
          const isDataReady = dataLoaded && !dataLoading;
          
          // 추가 확인: 실제 데이터가 렌더링되었는지 확인 (테이블, 차트 등)
          const hasDataContent = containerRef.current?.querySelector(
            'table, [class*="Table"], [class*="Chart"], [class*="Grid"], .MuiTable-root, .MuiDataGrid-root'
          ) !== null;
          
          // 로딩 텍스트가 없고, 데이터 콘텐츠가 있으면 완료로 간주
          const isContentReady = !hasLoadingText && (hasDataContent || isDataReady);
          
          console.log(`🔍 [SlideRenderer] 데이터 로딩 확인 (${attempts}/${maxAttempts}):`, {
            hasLoadingIndicator: loadingIndicators?.length > 0,
            dataLoading,
            dataLoaded,
            hasLoadingText,
            hasDataContent,
            isLoading,
            isDataReady,
            isContentReady,
            loadingCount: loadingIndicators?.length || 0
          });
          
          // 데이터가 준비되었고 로딩이 완료되었을 때만 진행
          // 최소 3초는 대기 (데이터 로딩 시간 고려)
          if (attempts >= 30 && isContentReady && !isLoading) {
            console.log('✅ [SlideRenderer] 데이터 로딩 완료');
            resolve();
          } else if (attempts >= maxAttempts) {
            // 타임아웃 시에도 최소한의 확인 후 진행
            if (isContentReady || !hasLoadingText) {
              console.warn('⚠️ [SlideRenderer] 데이터 로딩 타임아웃, 하지만 콘텐츠 준비됨 - 진행');
              resolve();
            } else {
              console.warn('⚠️ [SlideRenderer] 데이터 로딩 타임아웃, 강제 진행');
              resolve(); // 타임아웃 시에도 진행
            }
          } else {
            setTimeout(checkLoading, 100);
          }
        };
        
        // 최소 3초 대기 후 체크 시작 (데이터 로딩 시간 고려)
        setTimeout(checkLoading, 3000);
      });
    };
    
    // 최소 4초 대기 후 데이터 로딩 완료 확인
    const timer = setTimeout(async () => {
      console.log('⏳ [SlideRenderer] 데이터 로딩 대기 시작 (최소 4초)');
      await waitForDataLoad();
      console.log('✅ [SlideRenderer] 데이터 로딩 완료 확인됨, onReady 호출 준비');
      setLoading(false);
      setContentReady(true);
      // 추가 대기 후 onReady 호출 (렌더링 완료 보장)
      setTimeout(() => {
        if (onReady) {
          console.log('✅ [SlideRenderer] onReady 콜백 호출');
          onReady();
        }
      }, 1500); // 1.5초 추가 대기
    }, 4000); // 최소 4초 대기

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
            p: 4
          }}
        >
          <Box sx={{ textAlign: 'center', maxWidth: 1200 }}>
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
      let subTabIndex = 0;
      if (slide.subTab && availableTabs[tabIndex]?.subTabs) {
        subTabIndex = availableTabs[tabIndex].subTabs.findIndex(st => st.key === slide.subTab);
      }
      
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
          initialSubTab={slide.subTab ? subTabIndex : undefined}
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
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : (
        renderSlideContent()
      )}
    </Box>
  );
}

export default SlideRenderer;

