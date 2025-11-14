import React, { useState, useEffect, useRef } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { Event as EventIcon, LocationOn as LocationIcon, People as PeopleIcon } from '@mui/icons-material';
import { getModeConfig } from '../../config/modeConfig';
import ChartMode from '../ChartMode';
import InspectionMode from '../InspectionMode';
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
  const [renderKey, setRenderKey] = useState(0); // 강제 리렌더링을 위한 key

  useEffect(() => {
    // slide가 변경되면 완전히 리셋
    console.log('🔍 [SlideRenderer] 슬라이드 렌더링 시작:', {
      slideId: slide?.slideId,
      mode: slide?.mode,
      tab: slide?.tab,
      subTab: slide?.subTab,
      type: slide?.type
    });
    setLoading(true);
    setContentReady(false);
    setError(null);
    setRenderKey(prev => prev + 1); // 강제 리렌더링
    
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
    // 회의 메인 화면 타입
    if (slide.type === 'main') {
      const meetingDate = slide.meetingDate || '';
      const dateObj = meetingDate ? new Date(meetingDate + 'T00:00:00') : new Date();
      const formattedDate = dateObj.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
      
      const participantsList = slide.participants 
        ? slide.participants.split(',').map(p => p.trim()).filter(p => p)
        : [];
      
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)',
            color: '#ffffff',
            p: { xs: 3, md: 6 },
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {/* 상단: 회사 로고 및 이름 - 상단 전체 하얀색 배경 */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              width: '100%',
              backgroundColor: '#ffffff',
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.5 },
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10
            }}
          >
            <Box
              component="img"
              src="/logo512.png"
              alt="회사 로고"
              sx={{
                width: { xs: 40, md: 50 },
                height: { xs: 40, md: 50 },
                mr: { xs: 1, md: 1.5 },
                filter: 'brightness(0) invert(0)'
              }}
              onError={(e) => {
                // 로고가 없으면 숨김
                e.target.style.display = 'none';
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '0.9rem', md: '1.1rem' },
                color: '#333',
                letterSpacing: '0.3px'
              }}
            >
              (주)브이아이피플러스
            </Typography>
          </Box>

          {/* 중앙: 회의 정보 */}
          <Box sx={{ textAlign: 'center', maxWidth: 1000, width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', pt: { xs: 10, md: 12 } }}>
            {/* 차수 배지 */}
            {slide.meetingNumber && (
              <Box
                sx={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(10px)',
                  px: 4,
                  py: 1.5,
                  borderRadius: 5,
                  mb: 3,
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 'bold',
                    fontSize: { xs: '1.5rem', md: '2rem' },
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {slide.meetingNumber}차 회의
                </Typography>
              </Box>
            )}

            {/* 회의 제목 */}
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontSize: { xs: '2rem', md: '3.5rem' },
                fontWeight: 'bold',
                mb: 4,
                textShadow: '2px 2px 6px rgba(0,0,0,0.4)',
                lineHeight: 1.2
              }}
            >
              {slide.title || '회의'}
            </Typography>
            
            {/* 회의 정보 카드 */}
            <Box
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: 4,
                p: { xs: 3, md: 4 },
                mb: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                  <EventIcon sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, opacity: 0.9 }} />
                  <Typography variant="h5" sx={{ fontWeight: 600, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    일시
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 400, fontSize: { xs: '1rem', md: '1.3rem' }, pl: 4 }}>
                  {formattedDate}
                </Typography>
              </Box>
              
              {slide.meetingLocation && (
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                    <LocationIcon sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, opacity: 0.9 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                      장소
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 400, fontSize: { xs: '1rem', md: '1.3rem' }, pl: 4 }}>
                    {slide.meetingLocation}
                  </Typography>
                </Box>
              )}
              
              {participantsList.length > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                    <PeopleIcon sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, opacity: 0.9 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                      참석자
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.5 }}>
                    {participantsList.map((participant, index) => (
                      <Box
                        key={index}
                        sx={{
                          backgroundColor: 'rgba(255, 255, 255, 0.25)',
                          backdropFilter: 'blur(5px)',
                          px: 3,
                          py: 1.5,
                          borderRadius: 3,
                          fontSize: { xs: '0.9rem', md: '1.1rem' },
                          fontWeight: 500,
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}
                      >
                        {participant}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* 하단: 생성자 정보 */}
          {slide.createdBy && (
            <Box sx={{ mt: { xs: 2, md: 3 }, width: '100%', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { xs: '0.8rem', md: '0.9rem' } }}>
                생성자: {slide.createdBy}
              </Typography>
            </Box>
          )}
        </Box>
      );
    }
    
    // 목차 슬라이드 타입
    if (slide.type === 'toc') {
      const modeGroups = slide.modeGroups || {};
      const modeKeys = Object.keys(modeGroups).filter(key => key !== 'custom');
      const customSlides = modeGroups['custom'] || [];
      
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)',
            color: '#ffffff',
            p: { xs: 3, md: 6 },
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {/* 상단: 회사 로고 및 이름 - 상단 전체 하얀색 배경 */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              width: '100%',
              backgroundColor: '#ffffff',
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.5 },
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10
            }}
          >
            <Box
              component="img"
              src="/logo512.png"
              alt="회사 로고"
              sx={{
                width: { xs: 40, md: 50 },
                height: { xs: 40, md: 50 },
                mr: { xs: 1, md: 1.5 },
                filter: 'brightness(0) invert(0)'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '0.9rem', md: '1.1rem' },
                color: '#333',
                letterSpacing: '0.3px'
              }}
            >
              (주)브이아이피플러스
            </Typography>
          </Box>

          {/* 중앙: 목차 내용 */}
          <Box sx={{ 
            textAlign: 'center', 
            maxWidth: 1200, 
            width: '100%', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            overflowY: 'auto',
            py: 2,
            pt: { xs: 10, md: 12 }
          }}>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 'bold',
                mb: 4,
                textShadow: '2px 2px 6px rgba(0,0,0,0.4)'
              }}
            >
              회의 목차
            </Typography>
            
            <Box
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: 4,
                p: { xs: 3, md: 4 },
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                maxHeight: '60vh',
                overflowY: 'auto'
              }}
            >
              {modeKeys.length === 0 && customSlides.length === 0 ? (
                <Typography variant="h6" sx={{ opacity: 0.8 }}>
                  등록된 슬라이드가 없습니다.
                </Typography>
              ) : (
                <Box sx={{ textAlign: 'left' }}>
                  {modeKeys.map((modeKey, modeIndex) => {
                    const modeConfig = getModeConfig(modeKey);
                    const modeTitle = modeConfig?.title || modeKey;
                    const modeSlides = modeGroups[modeKey] || [];
                    
                    // 모드별로 탭 그룹화
                    const tabGroups = {};
                    modeSlides.forEach(slide => {
                      if (slide.tab) {
                        const tabKey = slide.tab;
                        if (!tabGroups[tabKey]) {
                          tabGroups[tabKey] = [];
                        }
                        tabGroups[tabKey].push(slide);
                      } else {
                        // mode-only 타입
                        if (!tabGroups['_modeOnly']) {
                          tabGroups['_modeOnly'] = [];
                        }
                        tabGroups['_modeOnly'].push(slide);
                      }
                    });
                    
                    return (
                      <Box key={modeKey} sx={{ mb: 3 }}>
                        {/* 모드 제목 */}
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 'bold',
                            fontSize: { xs: '1.2rem', md: '1.5rem' },
                            mb: 2,
                            color: '#ffffff',
                            borderBottom: '2px solid rgba(255, 255, 255, 0.3)',
                            pb: 1
                          }}
                        >
                          {modeIndex + 1}. {modeTitle}
                        </Typography>
                        
                        {/* 탭 목록 */}
                        {Object.keys(tabGroups).map((tabKey, tabIndex) => {
                          const tabSlides = tabGroups[tabKey];
                          if (tabKey === '_modeOnly') {
                            // mode-only 타입
                            return (
                              <Box key={tabKey} sx={{ ml: 2, mb: 1.5 }}>
                                <Typography
                                  variant="body1"
                                  sx={{
                                    fontSize: { xs: '0.9rem', md: '1.1rem' },
                                    opacity: 0.9
                                  }}
                                >
                                  • {modeTitle} 전체
                                </Typography>
                              </Box>
                            );
                          }
                          
                          // 탭 정보 가져오기
                          const availableTabs = getAvailableTabsForMode(modeKey, null);
                          const tabConfig = availableTabs.find(t => t.key === tabKey);
                          const tabLabel = tabConfig?.label || tabKey;
                          
                          // 서브탭이 있는지 확인
                          const hasSubTabs = tabSlides.some(s => s.subTab);
                          
                          return (
                            <Box key={tabKey} sx={{ ml: 2, mb: 1.5 }}>
                              <Typography
                                variant="body1"
                                sx={{
                                  fontSize: { xs: '0.9rem', md: '1.1rem' },
                                  fontWeight: 600,
                                  opacity: 0.95,
                                  mb: hasSubTabs ? 0.5 : 0
                                }}
                              >
                                {modeIndex + 1}.{tabIndex + 1} {tabLabel}
                              </Typography>
                              
                              {/* 서브탭 목록 */}
                              {hasSubTabs && (
                                <Box sx={{ ml: 2, mt: 0.5 }}>
                                  {tabSlides
                                    .filter(s => s.subTab)
                                    .map((subSlide, subIndex) => {
                                      const subTabConfig = tabConfig?.subTabs?.find(st => st.key === subSlide.subTab);
                                      const subTabLabel = subTabConfig?.label || subSlide.subTab;
                                      return (
                                        <Typography
                                          key={subSlide.slideId}
                                          variant="body2"
                                          sx={{
                                            fontSize: { xs: '0.85rem', md: '1rem' },
                                            opacity: 0.85,
                                            mb: 0.5
                                          }}
                                        >
                                          - {subTabLabel}
                                        </Typography>
                                      );
                                    })}
                                </Box>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    );
                  })}
                  
                  {/* 커스텀 슬라이드 */}
                  {customSlides.length > 0 && (
                    <Box sx={{ mt: 4, pt: 3, borderTop: '2px solid rgba(255, 255, 255, 0.3)' }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 'bold',
                          fontSize: { xs: '1.2rem', md: '1.5rem' },
                          mb: 2,
                          color: '#ffffff'
                        }}
                      >
                        추가 화면
                      </Typography>
                      {customSlides.map((customSlide, index) => (
                        <Box key={customSlide.slideId} sx={{ ml: 2, mb: 1 }}>
                          <Typography
                            variant="body1"
                            sx={{
                              fontSize: { xs: '0.9rem', md: '1.1rem' },
                              opacity: 0.9
                            }}
                          >
                            • {customSlide.title || '커스텀 화면'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>

          {/* 하단: 생성자 정보 */}
          {slide.createdBy && (
            <Box sx={{ mt: { xs: 2, md: 3 }, width: '100%', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { xs: '0.8rem', md: '0.9rem' } }}>
                생성자: {slide.createdBy}
              </Typography>
            </Box>
          )}
        </Box>
      );
    }
    
    // 엔딩 슬라이드 타입
    if (slide.type === 'ending') {
      const meetingDate = slide.meetingDate || '';
      const dateObj = meetingDate ? new Date(meetingDate + 'T00:00:00') : new Date();
      const formattedDate = dateObj.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
      
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)',
            color: '#ffffff',
            p: { xs: 3, md: 6 },
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {/* 상단: 회사 로고 및 이름 - 상단 전체 하얀색 배경 */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              width: '100%',
              backgroundColor: '#ffffff',
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.5 },
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10
            }}
          >
            <Box
              component="img"
              src="/logo512.png"
              alt="회사 로고"
              sx={{
                width: { xs: 40, md: 50 },
                height: { xs: 40, md: 50 },
                mr: { xs: 1, md: 1.5 },
                filter: 'brightness(0) invert(0)'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '0.9rem', md: '1.1rem' },
                color: '#333',
                letterSpacing: '0.3px'
              }}
            >
              (주)브이아이피플러스
            </Typography>
          </Box>

          {/* 중앙: 종료 메시지 */}
          <Box sx={{ 
            textAlign: 'center', 
            maxWidth: 1000, 
            width: '100%', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            alignItems: 'center',
            pt: { xs: 10, md: 12 }
          }}>
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontSize: { xs: '3rem', md: '5rem' },
                fontWeight: 'bold',
                mb: 4,
                textShadow: '3px 3px 8px rgba(0,0,0,0.4)',
                lineHeight: 1.2
              }}
            >
              감사합니다
            </Typography>
            
            <Box
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: 4,
                p: { xs: 3, md: 4 },
                mb: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                maxWidth: 600,
                width: '100%'
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  fontWeight: 600,
                  mb: 2,
                  textShadow: '1px 1px 3px rgba(0,0,0,0.3)'
                }}
              >
                {slide.meetingName || '회의'}
              </Typography>
              
              <Typography
                variant="h6"
                sx={{
                  fontSize: { xs: '1rem', md: '1.3rem' },
                  fontWeight: 400,
                  opacity: 0.9,
                  mb: 1
                }}
              >
                {formattedDate}
              </Typography>
              
              {slide.meetingNumber && (
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: { xs: '0.9rem', md: '1.1rem' },
                    opacity: 0.8
                  }}
                >
                  {slide.meetingNumber}차 회의
                </Typography>
              )}
            </Box>
            
            <Typography
              variant="h5"
              sx={{
                fontSize: { xs: '1.2rem', md: '1.8rem' },
                fontWeight: 500,
                mt: 4,
                opacity: 0.9,
                textShadow: '1px 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              회의가 종료되었습니다
            </Typography>
          </Box>

          {/* 하단: 생성자 정보 */}
          {slide.createdBy && (
            <Box sx={{ mt: { xs: 2, md: 3 }, width: '100%', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { xs: '0.8rem', md: '0.9rem' } }}>
                생성자: {slide.createdBy}
              </Typography>
            </Box>
          )}
        </Box>
      );
    }
    
    // 커스텀 슬라이드 타입
    if (slide.type === 'custom') {
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)',
            color: '#ffffff',
            p: { xs: 3, md: 6 },
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {/* 상단: 회사 로고 및 이름 */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: { xs: 2, md: 3 },
              width: '100%'
            }}
          >
            <Box
              component="img"
              src="/logo512.png"
              alt="회사 로고"
              sx={{
                width: { xs: 60, md: 80 },
                height: { xs: 60, md: 80 },
                mb: 1,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', md: '1.2rem' },
                textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                letterSpacing: '0.5px'
              }}
            >
              (주)브이아이피플러스
            </Typography>
          </Box>

          {/* 중앙: 커스텀 콘텐츠 */}
          <Box sx={{ 
            textAlign: 'center', 
            maxWidth: 1200, 
            width: '100%', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            alignItems: 'center',
            pt: { xs: 10, md: 12 }
          }}>
            <Box
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: 4,
                p: { xs: 3, md: 4 },
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                width: '100%',
                maxWidth: 1000
              }}
            >
              {slide.imageUrl && (
                <Box
                  component="img"
                  src={slide.imageUrl}
                  alt={slide.title || '커스텀 이미지'}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '50vh',
                    objectFit: 'contain',
                    mb: 3,
                    borderRadius: 2,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                  }}
                />
              )}
              <Typography
                variant="h4"
                sx={{
                  fontSize: { xs: '1.8rem', md: '2.5rem' },
                  fontWeight: 'bold',
                  mb: 2,
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                {slide.title || '커스텀 화면'}
              </Typography>
              {slide.content && (
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: { xs: '1rem', md: '1.3rem' },
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                    opacity: 0.95
                  }}
                >
                  {slide.content}
                </Typography>
              )}
            </Box>
          </Box>

          {/* 하단: 생성자 정보 */}
          {slide.createdBy && (
            <Box sx={{ mt: { xs: 2, md: 3 }, width: '100%', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { xs: '0.8rem', md: '0.9rem' } }}>
                생성자: {slide.createdBy}
              </Typography>
            </Box>
          )}
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
      
      // 모드/탭 제목 구성
      const modeTitle = modeConfig?.title || slide.mode;
      const tabConfig = availableTabs[tabIndex];
      const tabTitle = tabConfig?.label || slide.tab;
      const subTabTitle = slide.subTab && tabConfig?.subTabs
        ? tabConfig.subTabs.find(st => st.key === slide.subTab)?.label || slide.subTab
        : null;
      
      const slideTitle = subTabTitle 
        ? `${modeTitle} > ${tabTitle} > ${subTabTitle}`
        : `${modeTitle} > ${tabTitle}`;
      
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)',
            color: '#ffffff',
            p: { xs: 2, md: 3 },
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* 상단: 회사 로고 및 슬라이드 제목 - 상단 전체 하얀색 배경 */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              width: '100%',
              backgroundColor: '#ffffff',
              px: { xs: 2, md: 3 },
              py: { xs: 0.75, md: 1 },
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10
            }}
          >
            <Box
              component="img"
              src="/logo512.png"
              alt="회사 로고"
              sx={{
                width: { xs: 35, md: 45 },
                height: { xs: 35, md: 45 },
                mr: { xs: 1, md: 1.5 },
                filter: 'brightness(0) invert(0)'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '0.85rem', md: '1rem' },
                color: '#333',
                letterSpacing: '0.3px',
                mr: 2
              }}
            >
              (주)브이아이피플러스
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', md: '1.3rem' },
                color: '#333',
                textAlign: 'left'
              }}
            >
              {slideTitle}
            </Typography>
          </Box>

          {/* 중앙: 실제 콘텐츠 */}
          <Box
            sx={{
              flex: 1,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              position: 'relative',
              pt: { xs: 8, md: 10 } // 상단 헤더 공간 확보
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: 2,
                overflow: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                '& .MuiAppBar-root': { display: 'none' },
                '& .MuiTabs-root': { display: 'none' }
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
                detailOptions={slide.detailOptions}
                // 하위 호환성을 위해 기존 필드도 지원
                csDetailType={slide.detailOptions?.csDetailType || slide.csDetailType}
                csDetailCriteria={slide.detailOptions?.csDetailCriteria || slide.csDetailCriteria}
              />
            </Box>
          </Box>

          {/* 하단: 생성자 정보 */}
          {slide.createdBy && (
            <Box sx={{ mt: 1, width: '100%', textAlign: 'center', flexShrink: 0 }}>
              <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { xs: '0.7rem', md: '0.8rem' } }}>
                생성자: {slide.createdBy}
              </Typography>
            </Box>
          )}
        </Box>
      );
    }

    // 다른 모드는 임시로 메시지 표시 (추후 구현)
    const modeTitle = modeConfig?.title || slide.mode;
    const tabTitle = slide.tabLabel || slide.tab || '';
    const subTabTitle = slide.subTabLabel || slide.subTab || '';
    const slideTitle = subTabTitle 
      ? `${modeTitle} > ${tabTitle} > ${subTabTitle}`
      : tabTitle 
      ? `${modeTitle} > ${tabTitle}`
      : modeTitle;
    
    return (
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
            background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)',
          color: '#ffffff',
          p: { xs: 3, md: 6 },
          overflow: 'auto',
          position: 'relative'
        }}
      >
        {/* 상단: 회사 로고 및 슬라이드 제목 - 상단 전체 하얀색 배경 */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
            backgroundColor: '#ffffff',
            px: { xs: 2, md: 3 },
            py: { xs: 0.75, md: 1 },
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10
          }}
        >
          <Box
            component="img"
            src="/logo512.png"
            alt="회사 로고"
            sx={{
              width: { xs: 35, md: 45 },
              height: { xs: 35, md: 45 },
              mr: { xs: 1, md: 1.5 },
              filter: 'brightness(0) invert(0)'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              fontSize: { xs: '0.85rem', md: '1rem' },
              color: '#333',
              letterSpacing: '0.3px',
              mr: 2
            }}
          >
            (주)브이아이피플러스
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              fontSize: { xs: '1.1rem', md: '1.4rem' },
              color: '#333',
              textAlign: 'left'
            }}
          >
            {slideTitle}
          </Typography>
        </Box>

        {/* 중앙: 메시지 */}
        <Box sx={{ 
          textAlign: 'center', 
          maxWidth: 800, 
          width: '100%', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          alignItems: 'center',
          pt: { xs: 10, md: 12 }
        }}>
          <Box
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
              borderRadius: 4,
              p: { xs: 3, md: 4 },
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            <Alert 
              severity="info" 
              sx={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                '& .MuiAlert-icon': { color: '#ffffff' }
              }}
            >
              {modeTitle} 모드는 아직 구현되지 않았습니다.
              <br />
              <small>Presentation mode 렌더링 준비 중...</small>
            </Alert>
          </Box>
        </Box>

        {/* 하단: 생성자 정보 */}
        {slide.createdBy && (
          <Box sx={{ mt: { xs: 2, md: 3 }, width: '100%', textAlign: 'center' }}>
            <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { xs: '0.8rem', md: '0.9rem' } }}>
              생성자: {slide.createdBy}
            </Typography>
          </Box>
        )}
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
      
      {/* 로딩 중일 때 반투명 오버레이 표시 - 캡쳐 시 제외되도록 data-capture-exclude 속성 추가 */}
      {loading && (
        <Box
          data-capture-exclude="true"
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

