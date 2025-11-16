import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { Event as EventIcon, LocationOn as LocationIcon, People as PeopleIcon } from '@mui/icons-material';
import { getModeConfig } from '../../config/modeConfig';
import ChartMode from '../ChartMode';
import InspectionMode from '../InspectionMode';
import BudgetMode from '../BudgetMode';
import ObManagementMode from '../ObManagementMode';
import { getAvailableTabsForMode } from '../../config/modeTabConfig';
import { getProxyImageUrl } from '../../api';
import { logger } from '../../utils/logger';

/**
 * 슬라이드를 렌더링하는 컴포넌트
 * presentation mode로 렌더링하여 헤더 없이 콘텐츠만 표시
 */
/**
 * 세부 옵션 중 마지막 항목의 라벨을 반환하는 헬퍼 함수
 * detailOptions가 없으면 subTab의 label을 반환
 */
const getLastDetailOptionLabel = (slide, loggedInStore) => {
  const availableTabs = getAvailableTabsForMode(slide.mode, loggedInStore || {});
  const tabConfig = availableTabs.find(t => t.key === slide.tab);
  
  // 하부 탭 정보 가져오기
  let subTabConfig = null;
  if (slide.subTab && tabConfig?.subTabs) {
    subTabConfig = tabConfig.subTabs.find(st => st.key === slide.subTab);
  }
  
  // detailOptions가 있는 경우 처리
  if (slide?.detailOptions) {
    let detailOptions = null;
    let allOptionLabels = [];
    
    // 탭에 detailOptions가 있는 경우 (검수 모드 등)
    if (tabConfig?.detailOptions) {
      detailOptions = tabConfig.detailOptions;
    } else if (subTabConfig?.detailOptions) {
      // 하부 탭에 detailOptions가 있는 경우 (장표 모드 등)
      detailOptions = subTabConfig.detailOptions;
    }
    
    if (detailOptions) {
      // 모든 세부 옵션 라벨 수집
      detailOptions.options?.forEach(option => {
        const value = slide.detailOptions[option.key];
        // multiple 옵션인 경우 배열로 처리
        if (Array.isArray(value)) {
          value.forEach(v => {
            if (v && v !== 'all' && v !== option.defaultValue) {
              const selectedValue = option.values?.find(val => val.key === v);
              if (selectedValue) {
                allOptionLabels.push(selectedValue.label);
              }
            }
          });
        } else if (value && value !== 'all' && value !== option.defaultValue) {
          const selectedValue = option.values?.find(v => v.key === value);
          if (selectedValue) {
            allOptionLabels.push(selectedValue.label);
          }
        }
      });
      
      // 마지막 항목만 반환
      if (allOptionLabels.length > 0) {
        return allOptionLabels[allOptionLabels.length - 1];
      }
    }
  }
  
  // detailOptions가 없거나 값이 없으면 subTab의 label 반환
  if (subTabConfig?.label) {
    return subTabConfig.label;
  }
  
  return null;
};

// 통합 슬라이드 제목 생성기: 모든 슬라이드에서 동일한 규칙으로 제목을 구성
const getUnifiedTitle = (slide, loggedInStore) => {
  try {
    if (!slide) return '슬라이드';
    if (slide.type === 'main') return '회의 메인 화면';
    if (slide.type === 'toc') return '회의 목차';
    if (slide.type === 'ending') return '회의 종료';
    if (slide.type === 'custom') return slide.title || '커스텀 화면';
    const modeCfg = getModeConfig(slide.mode);
    const modeName = modeCfg?.title || slide.mode || '';
    const availableTabs = getAvailableTabsForMode(slide.mode, loggedInStore || {});
    const tabCfg = availableTabs?.find(t => t.key === slide.tab);
    const tabName = slide.tabLabel || tabCfg?.label || slide.tab || '';
    
    // 세부항목옵션(detailLabel)이 있으면 우선 사용
    if (slide.detailLabel) {
      const parts = [modeName, tabName, slide.detailLabel].filter(Boolean);
      return parts.join(' > ') || (slide.title || '슬라이드');
    }
    
    // detailLabel이 없으면 기존 로직 사용
    const subTabName = slide.subTab
      ? (slide.subTabLabel || (tabCfg?.subTabs?.find(st => st.key === slide.subTab)?.label) || slide.subTab)
      : '';
    const lastDetail = getLastDetailOptionLabel(slide, loggedInStore);
    const parts = [modeName, tabName, subTabName || lastDetail].filter(Boolean);
    return parts.join(' > ') || (slide.title || '슬라이드');
  } catch {
    return slide?.title || '슬라이드';
  }
};

// 헤더 그라데이션 오른쪽 색상 결정 (커스텀 슬라이드는 배경색 선택값을 사용)
// 컴포넌트 외부로 이동하여 초기화 순서 문제 완전 해결
const getHeaderGradient = (s) => {
  try {
    if (!s) {
      return 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 35%, #868e96 100%)';
    }
    const right = (s?.type === 'custom' && s?.backgroundColor) ? s.backgroundColor : '#868e96';
    return `linear-gradient(90deg, #f8f9fa 0%, #e9ecef 35%, ${right} 100%)`;
  } catch (err) {
    // logger는 컴포넌트 외부에서 사용 불가하므로 console 사용
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [SlideRenderer] getHeaderGradient 에러:', err);
    }
    return 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 35%, #868e96 100%)';
  }
};

const SlideRenderer = React.memo(function SlideRenderer({ slide, loggedInStore, onReady }) {
  // 디버깅: 컴포넌트 초기화 시작
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [SlideRenderer] 컴포넌트 초기화 시작', {
        slideId: slide?.slideId,
        slideType: slide?.type,
        hasSlide: !!slide,
        hasLoggedInStore: !!loggedInStore
      });
    }
  } catch (err) {
    console.error('❌ [SlideRenderer] 컴포넌트 초기화 단계 에러:', err);
  }
  
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contentReady, setContentReady] = useState(false);
  const isMountedRef = useRef(true); // 컴포넌트 마운트 상태 추적
  
  useEffect(() => {
    // 컴포넌트 마운트 상태 초기화
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  useEffect(() => {
    // slide가 변경되면 완전히 리셋
    if (slide) {
      logger.debug('🔍 [SlideRenderer] 슬라이드 렌더링 시작', {
        slideId: slide.slideId,
        mode: slide.mode,
        tab: slide.tab,
        subTab: slide.subTab,
        type: slide.type
      });
    }
    setLoading(true);
    setContentReady(false);
    setError(null);
    
    // 모드별 최소 대기 시간 설정 (초) - 빠른 시작을 위해 단축
    const getModeWaitTime = () => {
      if (!slide || !slide.mode) return 5; // 기본값: 5초
      
      // 모드별 대기 시간 설정
      const modeWaitTimes = {
        'chart': 12, // 마감장표: 12초
        'inventoryChart': 10, // 재고장표: 10초
        'custom': 2, // 커스텀: 2초
        'main': 1, // 메인 슬라이드: 1초
        'toc': 1, // 목차: 1초
        'ending': 1 // 엔딩: 1초
      };
      // 특정 상세옵션(코드별 실적)은 로딩이 길어 추가 여유를 준다
      const isCodeDetail =
        slide?.mode === 'chart' &&
        (slide?.tab === 'closingChart' || slide?.tab === 'closing') &&
        (slide?.subTab === 'totalClosing' || !slide?.subTab) &&
        slide?.detailOptions?.csDetailType === 'code';
      const base = modeWaitTimes[slide.mode] || modeWaitTimes[slide.type] || 6;
      return isCodeDetail ? base + 8 : base; // 코드별 실적은 +8초
    };
    
    const modeWaitTime = getModeWaitTime();
    // 안정성 확인 횟수 감소 (체크 간격을 늘리는 대신 횟수 절감)
    const requiredStableCount = 8; // 8회 연속 안정 (체크 간격 300ms → 약 2.4초)
    // 최대 대기 시간(밀리초) - 코드별 실적은 40초로, 기본은 25초
    const maxWaitMs = (() => {
      const isCodeDetail =
        slide?.mode === 'chart' &&
        (slide?.tab === 'closingChart' || slide?.tab === 'closing') &&
        (slide?.subTab === 'totalClosing' || !slide?.subTab) &&
        slide?.detailOptions?.csDetailType === 'code';
      return isCodeDetail ? 40000 : 25000;
    })();
    
    // cleanup을 위해 외부에서 접근 가능한 변수들
    let observer = null;
    let checkLoadingTimer = null;
    let mainTimer = null;
    let onReadyTimer = null;
    
    // 데이터 로딩 완료 대기 함수 - 매우 확실한 방법
    const waitForDataLoad = () => {
      return new Promise((resolve) => {
        // 이미 언마운트되었으면 즉시 resolve
        if (!isMountedRef.current) {
          resolve();
          return;
        }
        
        let stableCount = 0; // 연속으로 안정적인 상태가 유지된 횟수
        let checkStartTime = null;
        let lastStableTime = null;
        
        // MutationObserver로 DOM 변화 감지
        observer = new MutationObserver(() => {
          // 언마운트 체크
          if (!isMountedRef.current) {
            observer?.disconnect();
            return;
          }
          
          // DOM이 변경되면 안정성 카운터 리셋
          if (stableCount > 0) {
            logger.debug('🔄 [SlideRenderer] DOM 변화 감지, 안정성 카운터 리셋', { previousStableCount: stableCount });
            stableCount = 0;
            lastStableTime = null;
          }
        });
        
        const checkLoading = () => {
          // 언마운트 체크
          if (!isMountedRef.current) {
            observer?.disconnect();
            if (checkLoadingTimer) {
              clearTimeout(checkLoadingTimer);
            }
            return;
          }
          
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
            allText.includes('데이터 로딩 중') ||
            allText.includes('Loading') ||
            allText.includes('loading');
          
          // data-capture-exclude 속성이 있는 로딩 요소 확인
          const excludedLoadingElements = containerRef.current?.querySelectorAll('[data-capture-exclude="true"]');
          const hasExcludedLoading = excludedLoadingElements && excludedLoadingElements.length > 0;
          
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
          
          // 권한 에러 메시지가 있는지 확인 (권한이 없어서 데이터가 없는 경우)
          const hasPermissionError = allText.includes('권한') && 
                                    (allText.includes('없습니다') || allText.includes('없음') || allText.includes('접근'));
          
          // 권한 에러가 있으면 완료로 간주하지 않음 (다시 시도 필요)
          const hasNoPermissionError = !hasPermissionError;
          
          // 로딩이 완전히 없고, 데이터가 준비되었고, 실제 콘텐츠가 있고, 권한 에러가 없어야 완료
          // 테이블이 있으면 유효한 데이터 행이 있어야 함
          const isContentReady = !isLoading && isDataReady && hasRealData && hasNoPermissionError && (hasTableRows ? hasValidTableData : true);
          
          if (isContentReady) {
            if (lastStableTime === null) {
              lastStableTime = Date.now();
            }
            stableCount++;
            
            const stableDuration = (Date.now() - lastStableTime) / 1000;
            logger.debug('✅ [SlideRenderer] 안정적인 상태 확인', {
              stableCount,
              requiredStableCount,
              stableDuration: `${stableDuration.toFixed(1)}s`,
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
              logger.info('✅ [SlideRenderer] 데이터 로딩 완료 (안정 상태 누적 충족)');
              observer.disconnect();
              resolve();
              return;
            }
          } else {
            // 안정적이지 않으면 카운터 리셋
            if (stableCount > 0) {
              logger.debug('⚠️ [SlideRenderer] 안정적인 상태가 깨짐, 카운터 리셋', { previousStableCount: stableCount });
              stableCount = 0;
              lastStableTime = null;
            }
            
            logger.debug('🔍 [SlideRenderer] 데이터 로딩 확인', {
              secondsElapsed: Math.round(timeSinceStart / 1000),
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
          
          // 최대 대기 시간 도달 시 진행
          if (timeSinceStart >= maxWaitMs) {
            if (isContentReady) {
              logger.warn('⚠️ [SlideRenderer] 타임아웃, 하지만 콘텐츠 준비됨 - 진행', { timeoutSec: Math.round(maxWaitMs/1000) });
            } else {
              logger.warn('⚠️ [SlideRenderer] 타임아웃, 강제 진행', { timeoutSec: Math.round(maxWaitMs/1000) });
            }
            observer.disconnect();
            resolve();
            return;
          }
          
          // 체크 주기 완화 (로그/타이머 부하 감소)
          checkLoadingTimer = setTimeout(checkLoading, 300);
        };
        
        // MutationObserver 시작
        if (containerRef.current && isMountedRef.current) {
          observer.observe(containerRef.current, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-loading', 'data-loaded', 'class']
          });
        }
        
        // 모드별 최소 대기 시간 후 체크 시작
        logger.debug('⏳ [SlideRenderer] 초기 대기 시작', { waitSec: modeWaitTime, mode: slide?.mode || slide?.type || 'unknown' });
        const initialTimer = setTimeout(() => {
          if (!isMountedRef.current) {
            observer?.disconnect();
            return;
          }
          logger.debug('⏳ [SlideRenderer] 데이터 로딩 체크 시작');
          checkLoading();
        }, modeWaitTime * 1000);
        
        // cleanup 함수: Promise가 resolve되기 전에 언마운트될 경우를 대비
        return () => {
          clearTimeout(initialTimer);
        };
      });
    };
    
    // 모드별 최소 대기 시간 후 데이터 로딩 완료 확인
    mainTimer = setTimeout(async () => {
      // 언마운트 체크
      if (!isMountedRef.current) {
        return;
      }
      logger.debug('⏳ [SlideRenderer] 데이터 로딩 대기 시작 (초기 대기 완료)', { waitSec: modeWaitTime, mode: slide?.mode || slide?.type || 'unknown' });
      await waitForDataLoad();
      
      // 언마운트 체크
      if (!isMountedRef.current) {
        return;
      }
      
      // 특수 처리: 월간시상 화면 확대 버튼 자동 클릭 (데이터량이 많아 가독성 확보)
      try {
        if (!isMountedRef.current) {
          return;
        }
        const expandBtn = Array.from(document.querySelectorAll('button, .MuiButton-root')).find(
          (el) => typeof el.textContent === 'string' && el.textContent.trim() === '확대'
        );
        if (expandBtn) {
          logger.info('🔎 [SlideRenderer] 월간시상 확대 버튼 발견 → 자동 클릭');
          expandBtn.click();
          // 클릭 후 렌더링 안정화 대기
          await new Promise((r) => setTimeout(r, 600));
        }
      } catch (e) {
        logger.warn('⚠️ [SlideRenderer] 확대 버튼 자동 클릭 중 오류', { error: e?.message });
      }
      
      // 언마운트 체크
      if (!isMountedRef.current) {
        return;
      }
      
      // 추가 안정화 대기 시간 (고정 2초)
      const additionalWaitTime = 2;
      logger.debug('✅ [SlideRenderer] 데이터 로딩 완료 확인됨, 추가 안정화 대기', { waitSec: additionalWaitTime });
      
      // 추가로 대기하여 완전히 안정화
      await new Promise(resolve => setTimeout(resolve, additionalWaitTime * 1000));
      
      // 언마운트 체크
      if (!isMountedRef.current) {
        return;
      }
      
      // 최종 확인: data-loaded 속성이 여전히 true인지 확인
      const finalCheck = containerRef.current?.querySelector('[data-loaded="true"]') !== null;
      const finalLoadingIndicators = containerRef.current?.querySelectorAll('.MuiCircularProgress-root, .MuiLinearProgress-root, [class*="loading"]') || [];
      const finalProgressBars = containerRef.current?.querySelectorAll('.MuiLinearProgress-root, [class*="progress"]') || [];
      const finalHasNoLoading = (finalLoadingIndicators?.length || 0) === 0 && (finalProgressBars?.length || 0) === 0;
      
      // 최종 테이블 행 확인 (최소 3개 이상)
      const finalTableRows = containerRef.current?.querySelectorAll('table tbody tr, .MuiTableBody-root tr, tbody tr') || [];
      const finalHasTableRows = (finalTableRows?.length || 0) >= 3;
      
      // 차트나 SVG 요소 확인 (차트 기반 슬라이드의 경우)
      const finalChartElements = containerRef.current?.querySelectorAll('[class*="Chart"], canvas, svg, [class*="chart"], [class*="recharts"]') || [];
      const finalHasChartContent = (finalChartElements?.length || 0) > 0;
      
      // Paper나 Box 컴포넌트 확인 (일반 콘텐츠)
      const finalPaperElements = containerRef.current?.querySelectorAll('.MuiPaper-root, .MuiBox-root') || [];
      const finalHasPaperContent = (finalPaperElements?.length || 0) > 0;
      
      // 실제 콘텐츠가 있는지 확인 (테이블, 차트, 또는 Paper 중 하나라도 있으면 OK)
      const hasAnyContent = finalHasTableRows || finalHasChartContent || finalHasPaperContent;
      
      // 로딩 인디케이터가 없고, 콘텐츠가 있으면 OK (data-loaded는 선택사항)
      const isReady = finalHasNoLoading && hasAnyContent;
      
      if (!isReady) {
        logger.debug('⚠️ [SlideRenderer] 최종 확인 실패', {
          dataLoaded: finalCheck,
          hasNoLoading: finalHasNoLoading,
          hasTableRows: finalTableRows.length,
          hasChartContent: finalChartElements.length,
          hasPaperContent: finalPaperElements.length,
          hasAnyContent
        });
        logger.debug('⚠️ [SlideRenderer] 추가 대기 (3초)');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 언마운트 체크
        if (!isMountedRef.current) {
          return;
        }
        
        // 재확인
        const retryCheck = containerRef.current?.querySelector('[data-loaded="true"]') !== null;
        const retryTableRows = containerRef.current?.querySelectorAll('table tbody tr, .MuiTableBody-root tr, tbody tr') || [];
        const retryChartElements = containerRef.current?.querySelectorAll('[class*="Chart"], canvas, svg, [class*="chart"], [class*="recharts"]') || [];
        const retryPaperElements = containerRef.current?.querySelectorAll('.MuiPaper-root, .MuiBox-root') || [];
        const retryLoadingIndicators = containerRef.current?.querySelectorAll('.MuiCircularProgress-root, .MuiLinearProgress-root, [class*="loading"]') || [];
        const retryHasNoLoading = (retryLoadingIndicators?.length || 0) === 0;
        const retryHasContent = (retryTableRows?.length || 0) >= 3 || (retryChartElements?.length || 0) > 0 || (retryPaperElements?.length || 0) > 0;
        
        if (!retryHasNoLoading || !retryHasContent) {
          logger.debug('⚠️ [SlideRenderer] 재확인 실패, 하지만 로딩 인디케이터가 없으므로 진행', {
            hasNoLoading: retryHasNoLoading,
            hasContent: retryHasContent,
            tableRows: retryTableRows.length,
            chartElements: retryChartElements.length,
            paperElements: retryPaperElements.length
          });
          // 그래도 진행 (로딩 인디케이터가 없으면 데이터가 준비된 것으로 간주)
        }
      }
      
      // 언마운트 체크
      if (!isMountedRef.current) {
        return;
      }
      
      logger.info('✅ [SlideRenderer] 안정화 완료, onReady 호출 준비');
      setLoading(false);
      setContentReady(true);
      
      // 추가 대기 후 onReady 호출 (렌더링 완료 보장)
      onReadyTimer = setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }
        if (onReady) {
          logger.debug('✅ [SlideRenderer] onReady 콜백 호출');
          onReady();
        }
      }, 1200); // 1.2초 대기
    }, modeWaitTime * 1000); // 모드별 최소 대기 시간

    // cleanup 함수: 모든 타이머와 observer 정리
    return () => {
      // observer 정리
      if (observer) {
        observer.disconnect();
      }
      
      // 모든 타이머 정리
      if (mainTimer) {
        clearTimeout(mainTimer);
      }
      if (checkLoadingTimer) {
        clearTimeout(checkLoadingTimer);
      }
      if (onReadyTimer) {
        clearTimeout(onReadyTimer);
      }
    };
  }, [slide]); // onReady는 의존성에서 제거 (초기화 순서 문제 방지)

  // 디버깅: getHeaderGradientLocal 정의 전
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [SlideRenderer] getHeaderGradientLocal 정의 전');
    }
  } catch (err) {
    console.error('❌ [SlideRenderer] getHeaderGradientLocal 정의 전 에러:', err);
  }

  // getHeaderGradient를 useCallback 외부로 이동하여 초기화 순서 문제 완전 해결
  let getHeaderGradientLocal;
  try {
    getHeaderGradientLocal = useCallback((s) => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 [SlideRenderer] getHeaderGradientLocal 호출됨', { slideType: s?.type });
        }
        if (!s) {
          return 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 35%, #868e96 100%)';
        }
        const right = (s?.type === 'custom' && s?.backgroundColor) ? s.backgroundColor : '#868e96';
        return `linear-gradient(90deg, #f8f9fa 0%, #e9ecef 35%, ${right} 100%)`;
      } catch (err) {
        console.error('❌ [SlideRenderer] getHeaderGradientLocal 내부 에러:', err);
        return 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 35%, #868e96 100%)';
      }
    }, []);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [SlideRenderer] getHeaderGradientLocal 정의 완료');
    }
  } catch (err) {
    console.error('❌ [SlideRenderer] getHeaderGradientLocal 정의 중 에러:', err);
    // 폴백 함수
    getHeaderGradientLocal = (s) => {
      const right = (s?.type === 'custom' && s?.backgroundColor) ? s.backgroundColor : '#868e96';
      return `linear-gradient(90deg, #f8f9fa 0%, #e9ecef 35%, ${right} 100%)`;
    };
  }

  // 디버깅: renderSlideContent 정의 전
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [SlideRenderer] renderSlideContent 정의 전', {
        hasGetHeaderGradientLocal: typeof getHeaderGradientLocal === 'function',
        slideId: slide?.slideId
      });
    }
  } catch (err) {
    console.error('❌ [SlideRenderer] renderSlideContent 정의 전 에러:', err);
  }

  // renderSlideContent를 useCallback으로 메모이제이션하여 불필요한 재렌더링 방지
  let renderSlideContent;
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [SlideRenderer] renderSlideContent useCallback 시작');
    }
    renderSlideContent = useCallback(() => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 [SlideRenderer] renderSlideContent 호출됨', {
            slideId: slide?.slideId,
            slideType: slide?.type,
            hasSlide: !!slide,
            hasGetHeaderGradientLocal: typeof getHeaderGradientLocal === 'function'
          });
        }
        
        logger.debug('🔍 [SlideRenderer] renderSlideContent 시작', {
          slideId: slide?.slideId,
          slideType: slide?.type,
          hasSlide: !!slide
        });
      
      // slide가 없으면 빈 화면 반환
      if (!slide) {
        logger.warn('⚠️ [SlideRenderer] renderSlideContent: slide가 없습니다');
        return (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="warning">슬라이드 데이터가 없습니다.</Alert>
          </Box>
        );
      }
      
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
      
      const participantsList = (slide?.participants && typeof slide.participants === 'string')
        ? slide.participants.split(',').map(p => p.trim()).filter(p => p)
        : [];
      
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)', // 전문적인 그라데이션
            color: '#212529', // 어두운 계열 글자색
            p: { xs: 3, md: 6 },
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {/* 상단바: 좌→우 그라데이션, 좌측 로고/회사명 + 우측 슬라이드 제목(흰색) */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 15,
              background: getHeaderGradientLocal(slide),
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: { xs: 2.5, md: 4 },
              py: { xs: 1.6, md: 2 },
              pointerEvents: 'none', // 상단바가 UI 선택을 가리지 않도록
              height: { xs: 56, md: 68 } // 헤더 높이 명시적 설정
            }}
          >
            {/* 왼쪽: 로고와 회사 이름 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                component="img"
                src="/logo512.png"
                alt="회사 로고"
                sx={{
                  width: { xs: 48, md: 60 },
                  height: { xs: 48, md: 60 },
                  filter: 'brightness(0) invert(0)'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.25rem', md: '1.6rem' },
                  color: '#212529',
                  letterSpacing: '0.2px',
                  fontFamily: '"Noto Sans KR","Roboto",sans-serif'
                }}
              >
                (주)브이아이피플러스
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: { xs: '1rem', md: '1.25rem' },
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                letterSpacing: '0.2px'
              }}
            >
              {getUnifiedTitle(slide, loggedInStore)}
            </Typography>
          </Box>

          {/* 작성자 정보: 상단 헤더 바로 밑 */}
          {slide.createdBy && (
            <Box sx={{ 
              position: 'absolute',
              top: { xs: 56, md: 68 }, // 헤더 높이 바로 아래
              right: { xs: 2.5, md: 4 },
              zIndex: 14,
              textAlign: 'right'
            }}>
              <Typography variant="body2" sx={{ 
                color: '#6c757d', 
                fontSize: { xs: '0.75rem', md: '0.85rem' },
                fontWeight: 500,
                fontFamily: '"Noto Sans KR", sans-serif',
                opacity: 0.8
              }}>
                작성자: {slide.createdBy}
              </Typography>
            </Box>
          )}

          {/* 상단 정렬: 회의 정보 */}
          <Box sx={{ 
            textAlign: 'center', 
            maxWidth: 1000, 
            width: '100%', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            pt: { xs: 10, md: 12 },
            mt: { xs: 2, md: 3 } // 헤더와 작성자 아래 여백
          }}>
            {/* 차수 배지 - 전문적인 디자인 */}
            {slide.meetingNumber && (
              <Box
                sx={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: { xs: 3, md: 4 },
                  py: { xs: 1.2, md: 1.5 },
                  borderRadius: '50px',
                  mb: 4,
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                  transform: 'translateY(0)',
                  transition: 'transform 0.3s ease'
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1.3rem', md: '1.8rem' },
                    color: '#ffffff',
                    letterSpacing: '1px',
                    fontFamily: '"Noto Sans KR", "Roboto", sans-serif'
                  }}
                >
                  {slide.meetingNumber}차 회의
                </Typography>
              </Box>
            )}

            {/* 회의 제목 - 전문적인 타이포그래피 */}
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontSize: { xs: '2.5rem', md: '4rem' },
                fontWeight: 800,
                mb: 5,
                lineHeight: 1.1,
                color: '#212529',
                letterSpacing: '-0.5px',
                fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
                backgroundColor: 'transparent', // 배경색 제거
                background: 'none' // 그라데이션 배경 완전 제거
              }}
            >
              {slide.title || '회의'}
            </Typography>
            
            {/* 회의 정보 카드 - 전문적인 카드 디자인 */}
            <Box
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                p: { xs: 3, md: 4.5 },
                mb: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.06)',
                maxWidth: '800px',
                mx: 'auto',
                width: '100%'
              }}
            >
              <Box sx={{ mb: 3.5, pb: 3, borderBottom: '1px solid #e9ecef' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1.5 }}>
                  <Box sx={{ 
                    backgroundColor: '#667eea', 
                    borderRadius: '8px', 
                    p: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <EventIcon sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, color: '#ffffff' }} />
                  </Box>
                  <Typography variant="h5" sx={{ 
                    fontWeight: 700, 
                    fontSize: { xs: '1.1rem', md: '1.4rem' },
                    color: '#212529',
                    fontFamily: '"Noto Sans KR", sans-serif'
                  }}>
                    일시
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ 
                  fontWeight: 500, 
                  fontSize: { xs: '1rem', md: '1.25rem' }, 
                  pl: { xs: 5.5, md: 6 },
                  color: '#495057',
                  fontFamily: '"Noto Sans KR", sans-serif'
                }}>
                  {formattedDate}
                </Typography>
              </Box>
              
              {slide.meetingLocation && (
                <Box sx={{ mb: 3.5, pb: 3, borderBottom: '1px solid #e9ecef' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1.5 }}>
                    <Box sx={{ 
                      backgroundColor: '#764ba2', 
                      borderRadius: '8px', 
                      p: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <LocationIcon sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, color: '#ffffff' }} />
                    </Box>
                    <Typography variant="h5" sx={{ 
                      fontWeight: 700, 
                      fontSize: { xs: '1.1rem', md: '1.4rem' },
                      color: '#212529',
                      fontFamily: '"Noto Sans KR", sans-serif'
                    }}>
                      장소
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 500, 
                    fontSize: { xs: '1rem', md: '1.25rem' }, 
                    pl: { xs: 5.5, md: 6 },
                    color: '#495057',
                    fontFamily: '"Noto Sans KR", sans-serif'
                  }}>
                    {slide.meetingLocation}
                  </Typography>
                </Box>
              )}
              
              {participantsList && participantsList.length > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1.5 }}>
                    <Box sx={{ 
                      backgroundColor: '#f5576c', 
                      borderRadius: '8px', 
                      p: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <PeopleIcon sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, color: '#ffffff' }} />
                    </Box>
                    <Typography variant="h5" sx={{ 
                      fontWeight: 700, 
                      fontSize: { xs: '1.1rem', md: '1.4rem' },
                      color: '#212529',
                      fontFamily: '"Noto Sans KR", sans-serif'
                    }}>
                      참석자
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.5, pl: { xs: 5.5, md: 6 } }}>
                    {participantsList.map((participant, index) => (
                      <Box
                        key={index}
                        sx={{
                          backgroundColor: '#f8f9fa',
                          px: { xs: 2, md: 2.5 },
                          py: { xs: 1, md: 1.2 },
                          borderRadius: '8px',
                          fontSize: { xs: '0.9rem', md: '1.05rem' },
                          fontWeight: 500,
                          border: '1px solid #e9ecef',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                          color: '#495057',
                          fontFamily: '"Noto Sans KR", sans-serif',
                          transition: 'all 0.2s ease',
                          '&:hover': { 
                            backgroundColor: '#e9ecef',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.08)'
                          }
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

          {/* 하단 푸터 제거: 로고/회사명은 상단바에 표시 */}
        </Box>
      );
    }
    
    // 목차 슬라이드 타입
    if (slide.type === 'toc') {
      const modeGroups = slide?.modeGroups || {};
      const modeKeys = Array.isArray(Object.keys(modeGroups)) ? Object.keys(modeGroups).filter(key => key !== 'custom') : [];
      const customSlides = Array.isArray(modeGroups['custom']) ? modeGroups['custom'] : [];
      
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)', // 전문적인 그라데이션
            color: '#212529', // 어두운 계열 글자색
            p: { xs: 3, md: 6 },
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {/* 상단바: 좌→우 그라데이션, 좌측 로고/회사명 + 우측 제목(흰색) */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 15,
              background: getHeaderGradientLocal(slide),
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: { xs: 2.5, md: 4 },
              py: { xs: 1.6, md: 2 },
              pointerEvents: 'none', // 상단바가 UI 선택을 가리지 않도록
              height: { xs: 56, md: 68 } // 헤더 높이 명시적 설정
            }}
          >
            {/* 왼쪽: 로고와 회사 이름 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                component="img"
                src="/logo512.png"
                alt="회사 로고"
                sx={{
                  width: { xs: 48, md: 60 },
                  height: { xs: 48, md: 60 },
                  filter: 'brightness(0) invert(0)'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.25rem', md: '1.6rem' },
                  color: '#212529',
                  letterSpacing: '0.2px',
                  fontFamily: '"Noto Sans KR","Roboto",sans-serif'
                }}
              >
                (주)브이아이피플러스
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: { xs: '1rem', md: '1.25rem' },
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                letterSpacing: '0.2px'
              }}
            >
              {getUnifiedTitle(slide, loggedInStore)}
            </Typography>
          </Box>

          {/* 작성자 정보: 상단 헤더 바로 밑 */}
          {slide.createdBy && (
            <Box sx={{ 
              position: 'absolute',
              top: { xs: 56, md: 68 }, // 헤더 높이 바로 아래
              right: { xs: 2.5, md: 4 },
              zIndex: 14,
              textAlign: 'right'
            }}>
              <Typography variant="body2" sx={{ 
                color: '#6c757d', 
                fontSize: { xs: '0.75rem', md: '0.85rem' },
                fontWeight: 500,
                fontFamily: '"Noto Sans KR", sans-serif',
                opacity: 0.8
              }}>
                작성자: {slide.createdBy}
              </Typography>
            </Box>
          )}

          {/* 상단 정렬: 목차 내용 */}
          <Box sx={{ 
            textAlign: 'center', 
            maxWidth: 1200, 
            width: '100%', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'flex-start',
            overflowY: 'auto',
            py: 2,
            pt: { xs: 10, md: 12 },
            mt: { xs: 2, md: 3 } // 헤더와 작성자 아래 여백
          }}>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontSize: { xs: '2.5rem', md: '4rem' },
                fontWeight: 800,
                mb: 5,
                lineHeight: 1.1,
                color: '#212529',
                letterSpacing: '-0.5px',
                fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
                backgroundColor: 'transparent',
                background: 'none'
              }}
            >
              회의 목차
            </Typography>
            
            <Box
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                p: { xs: 3, md: 4.5 },
                boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.06)',
                maxHeight: '60vh',
                overflowY: 'auto',
                maxWidth: '1000px',
                mx: 'auto',
                width: '100%'
              }}
            >
              {(!modeKeys || modeKeys.length === 0) && (!customSlides || customSlides.length === 0) ? (
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
                            fontWeight: 700,
                            fontSize: { xs: '1.3rem', md: '1.6rem' },
                            mb: 2.5,
                            color: '#212529',
                            borderBottom: '3px solid #667eea',
                            pb: 1.5,
                            fontFamily: '"Noto Sans KR", sans-serif',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5
                          }}
                        >
                          <Box sx={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#667eea'
                          }} />
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
                                    fontSize: { xs: '1rem', md: '1.2rem' },
                                    fontWeight: 600,
                                    color: '#495057',
                                    fontFamily: '"Noto Sans KR", sans-serif',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    pl: 1
                                  }}
                                >
                                  <Box sx={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: '#764ba2'
                                  }} />
                                  {modeTitle} 전체
                                </Typography>
                              </Box>
                            );
                          }
                          
                          // 탭 정보 가져오기
                          const availableTabs = getAvailableTabsForMode(modeKey, null);
                          const tabConfig = availableTabs.find(t => t.key === tabKey);
                          // slide에 저장된 tabLabel을 우선 사용, 없으면 tabConfig에서 가져오기
                          const tabLabel = tabSlides[0]?.tabLabel || tabConfig?.label || tabKey;
                          
                          // 서브탭이 있는지 확인
                          const hasSubTabs = tabSlides.some(s => s.subTab);
                          
                          // 탭에 detailOptions가 있는 경우 세부 옵션 정보 가져오기 (검수 모드 등)
                          let tabDetailOptionLabel = '';
                          if (tabConfig?.detailOptions && tabSlides[0]?.detailOptions) {
                            const detailOptions = tabConfig.detailOptions;
                            const detailOptionLabels = [];
                            
                            // selectedField 옵션 처리 (검수 모드)
                            if (tabSlides[0].detailOptions.selectedField && tabSlides[0].detailOptions.selectedField !== 'all') {
                              const selectedFieldOption = detailOptions.options?.find(opt => opt.key === 'selectedField');
                              if (selectedFieldOption) {
                                const selectedValue = selectedFieldOption.values?.find(v => v.key === tabSlides[0].detailOptions.selectedField);
                                if (selectedValue) {
                                  detailOptionLabels.push(selectedValue.label);
                                }
                              }
                            }
                            
                            // 다른 세부 옵션들도 처리
                            Object.keys(tabSlides[0].detailOptions).forEach(key => {
                              if (key !== 'selectedField') {
                                const option = detailOptions.options?.find(opt => opt.key === key);
                                if (option) {
                                  const selectedValue = option.values?.find(v => v.key === tabSlides[0].detailOptions[key]);
                                  if (selectedValue && selectedValue.key !== 'all' && selectedValue.key !== option.defaultValue) {
                                    detailOptionLabels.push(selectedValue.label);
                                  }
                                }
                              }
                            });
                            
                            if (detailOptionLabels.length > 0) {
                              tabDetailOptionLabel = ` > ${detailOptionLabels.join(', ')}`;
                            }
                          }
                          
                          return (
                            <Box key={tabKey} sx={{ ml: 2, mb: 1.5 }}>
                              <Typography
                                variant="body1"
                                sx={{
                                  fontSize: { xs: '1rem', md: '1.2rem' },
                                  fontWeight: 600,
                                  color: '#495057',
                                  mb: hasSubTabs ? 1 : 0.5,
                                  fontFamily: '"Noto Sans KR", sans-serif',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  pl: 1
                                }}
                              >
                                <Box sx={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: '#764ba2'
                                }} />
                                {modeIndex + 1}.{tabIndex + 1} {tabLabel}{tabDetailOptionLabel}
                              </Typography>
                              
                              {/* 서브탭 목록 */}
                              {hasSubTabs && (
                                <Box sx={{ ml: 2, mt: 0.5 }}>
                                  {tabSlides
                                    .filter(s => s.subTab)
                                    .map((subSlide, subIndex) => {
                                      const subTabConfig = tabConfig?.subTabs?.find(st => st.key === subSlide.subTab);
                                      // slide에 저장된 subTabLabel을 우선 사용, 없으면 subTabConfig에서 가져오기
                                      const subTabLabel = subSlide.subTabLabel || subTabConfig?.label || subSlide.subTab;
                                      
                                      // 세부 옵션 정보 가져오기
                                      let detailOptionLabel = '';
                                      if (subSlide.detailOptions && subTabConfig?.detailOptions) {
                                        const detailOptions = subTabConfig.detailOptions;
                                        const detailOptionLabels = [];
                                        
                                        // csDetailType 옵션 처리
                                        if (subSlide.detailOptions.csDetailType && subSlide.detailOptions.csDetailType !== 'all') {
                                          const csDetailTypeOption = detailOptions.options?.find(opt => opt.key === 'csDetailType');
                                          if (csDetailTypeOption) {
                                            const selectedValue = csDetailTypeOption.values?.find(v => v.key === subSlide.detailOptions.csDetailType);
                                            if (selectedValue) {
                                              detailOptionLabels.push(selectedValue.label);
                                            }
                                          }
                                        }
                                        
                                        // csDetailCriteria 옵션 처리
                                        if (subSlide.detailOptions.csDetailCriteria && subSlide.detailOptions.csDetailCriteria !== 'performance') {
                                          const csDetailCriteriaOption = detailOptions.options?.find(opt => opt.key === 'csDetailCriteria');
                                          if (csDetailCriteriaOption) {
                                            const selectedValue = csDetailCriteriaOption.values?.find(v => v.key === subSlide.detailOptions.csDetailCriteria);
                                            if (selectedValue) {
                                              detailOptionLabels.push(selectedValue.label);
                                            }
                                          }
                                        }
                                        
                                        // 다른 세부 옵션들도 처리
                                        Object.keys(subSlide.detailOptions).forEach(key => {
                                          if (key !== 'csDetailType' && key !== 'csDetailCriteria') {
                                            const option = detailOptions.options?.find(opt => opt.key === key);
                                            if (option) {
                                              const selectedValue = option.values?.find(v => v.key === subSlide.detailOptions[key]);
                                              if (selectedValue && selectedValue.key !== 'all' && selectedValue.key !== option.defaultValue) {
                                                detailOptionLabels.push(selectedValue.label);
                                              }
                                            }
                                          }
                                        });
                                        
                                        if (detailOptionLabels.length > 0) {
                                          detailOptionLabel = ` > ${detailOptionLabels.join(', ')}`;
                                        }
                                      }
                                      
                                      return (
                                        <Typography
                                          key={subSlide.slideId}
                                          variant="body2"
                                          sx={{
                                            fontSize: { xs: '0.9rem', md: '1.05rem' },
                                            color: '#6c757d',
                                            mb: 0.5,
                                            fontFamily: '"Noto Sans KR", sans-serif',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.8,
                                            pl: 2
                                          }}
                                        >
                                          <Box sx={{
                                            width: '4px',
                                            height: '4px',
                                            borderRadius: '50%',
                                            backgroundColor: '#adb5bd'
                                          }} />
                                          {subTabLabel}{detailOptionLabel}
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
                  {customSlides && customSlides.length > 0 && (
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

          {/* 하단 푸터 제거: 로고/회사명은 상단바에 표시 */}
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
            justifyContent: 'flex-start',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)', // 전문적인 그라데이션
            color: '#212529', // 어두운 계열 글자색
            p: { xs: 3, md: 6 },
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {/* 상단바: 좌→우 그라데이션, 좌측 로고/회사명 + 우측 제목(흰색) */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 15,
              background: getHeaderGradientLocal(slide),
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: { xs: 2.5, md: 4 },
              py: { xs: 1.6, md: 2 },
              pointerEvents: 'none',
              height: { xs: 56, md: 68 } // 헤더 높이 명시적 설정
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                component="img"
                src="/logo512.png"
                alt="회사 로고"
                sx={{
                  width: { xs: 48, md: 60 },
                  height: { xs: 48, md: 60 },
                  filter: 'brightness(0) invert(0)'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.25rem', md: '1.6rem' },
                  color: '#212529',
                  letterSpacing: '0.2px',
                  fontFamily: '"Noto Sans KR","Roboto",sans-serif'
                }}
              >
                (주)브이아이피플러스
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: { xs: '1rem', md: '1.25rem' },
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                letterSpacing: '0.2px'
              }}
            >
              {getUnifiedTitle(slide, loggedInStore)}
            </Typography>
          </Box>

          {/* 작성자 정보: 상단 헤더 바로 밑 */}
          {slide.createdBy && (
            <Box sx={{ 
              position: 'absolute',
              top: { xs: 56, md: 68 }, // 헤더 높이 바로 아래
              right: { xs: 2.5, md: 4 },
              zIndex: 14,
              textAlign: 'right'
            }}>
              <Typography variant="body2" sx={{ 
                color: '#6c757d', 
                fontSize: { xs: '0.75rem', md: '0.85rem' },
                fontWeight: 500,
                fontFamily: '"Noto Sans KR", sans-serif',
                opacity: 0.8
              }}>
                작성자: {slide.createdBy}
              </Typography>
            </Box>
          )}

          {/* 상단 정렬: 종료 메시지 */}
          <Box sx={{ 
            textAlign: 'center', 
            maxWidth: 1000, 
            width: '100%', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'flex-start',
            alignItems: 'center',
            pt: { xs: 10, md: 12 },
            mt: { xs: 2, md: 3 } // 헤더와 작성자 아래 여백
          }}>
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontSize: { xs: '4rem', md: '6rem' },
                fontWeight: 800,
                mb: 5,
                lineHeight: 1.1,
                color: '#212529',
                letterSpacing: '-1px',
                fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
                backgroundColor: 'transparent',
                background: 'none'
              }}
            >
              감사합니다
            </Typography>
            
            <Box
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                p: { xs: 3, md: 4.5 },
                mb: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.06)',
                maxWidth: 700,
                width: '100%',
                mx: 'auto'
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontSize: { xs: '2rem', md: '2.8rem' },
                  fontWeight: 800,
                  mb: 2.5,
                  color: '#212529',
                  letterSpacing: '-0.5px',
                  fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
                  backgroundColor: 'transparent',
                  background: 'none'
                }}
              >
                {slide.meetingName || '회의'}
              </Typography>
              
              <Typography
                variant="h6"
                sx={{
                  fontSize: { xs: '1.1rem', md: '1.4rem' },
                  fontWeight: 500,
                  color: '#495057',
                  mb: 1.5,
                  fontFamily: '"Noto Sans KR", sans-serif'
                }}
              >
                {formattedDate}
              </Typography>
              
              {Number(slide.meetingNumber) > 0 && (
                <Box sx={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: { xs: 2.5, md: 3 },
                  py: { xs: 1, md: 1.2 },
                  borderRadius: '50px',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)'
                }}>
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: { xs: '0.9rem', md: '1.05rem' },
                      fontWeight: 600,
                      color: '#ffffff',
                      fontFamily: '"Noto Sans KR", sans-serif'
                    }}
                  >
                    {slide.meetingNumber}차 회의
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Box sx={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              p: { xs: 3, md: 4 },
              boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid rgba(0,0,0,0.06)',
              maxWidth: '600px',
              mx: 'auto',
              mt: 4
            }}>
              <Typography
                variant="h4"
                sx={{
                  fontSize: { xs: '1.3rem', md: '1.8rem' },
                  fontWeight: 600,
                  color: '#495057',
                  fontFamily: '"Noto Sans KR", sans-serif',
                  textAlign: 'center'
                }}
              >
                회의가 종료되었습니다
              </Typography>
            </Box>
          </Box>

          {/* 하단 푸터 제거: 작성자 정보는 상단 헤더 오른쪽 밑으로 이동 */}
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
            justifyContent: 'flex-start',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)', // 전문적인 그라데이션
            color: '#212529', // 어두운 계열 글자색
            p: { xs: 3, md: 6 },
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {/* 상단바: 좌→우 그라데이션, 좌측 로고/회사명 + 우측 제목(흰색) */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 15,
              background: getHeaderGradientLocal(slide),
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: { xs: 2.5, md: 4 },
              py: { xs: 1.6, md: 2 },
              pointerEvents: 'none',
              height: { xs: 56, md: 68 } // 헤더 높이 명시적 설정
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                component="img"
                src="/logo512.png"
                alt="회사 로고"
                sx={{
                  width: { xs: 48, md: 60 },
                  height: { xs: 48, md: 60 },
                  filter: 'brightness(0) invert(0)'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.25rem', md: '1.6rem' },
                  color: '#212529',
                  letterSpacing: '0.2px',
                  fontFamily: '"Noto Sans KR","Roboto",sans-serif'
                }}
              >
                (주)브이아이피플러스
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: { xs: '1rem', md: '1.25rem' },
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                letterSpacing: '0.2px'
              }}
            >
              {getUnifiedTitle(slide, loggedInStore)}
            </Typography>
          </Box>

          {/* 작성자 정보: 상단 헤더 바로 밑 */}
          {slide.createdBy && (
            <Box sx={{ 
              position: 'absolute',
              top: { xs: 56, md: 68 }, // 헤더 높이 바로 아래
              right: { xs: 2.5, md: 4 },
              zIndex: 14,
              textAlign: 'right'
            }}>
              <Typography variant="body2" sx={{ 
                color: '#6c757d', 
                fontSize: { xs: '0.75rem', md: '0.85rem' },
                fontWeight: 500,
                fontFamily: '"Noto Sans KR", sans-serif',
                opacity: 0.8
              }}>
                작성자: {slide.createdBy}
              </Typography>
            </Box>
          )}

          {/* 상단 정렬: 커스텀 콘텐츠 */}
          <Box sx={{ 
            textAlign: 'center', 
            maxWidth: 1200, 
            width: '100%', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'flex-start',
            alignItems: 'center',
            pt: { xs: 10, md: 12 },
            mt: { xs: 2, md: 3 } // 헤더와 작성자 아래 여백
          }}>
            <Box
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                p: { xs: 3, md: 4.5 },
                boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.06)',
                width: '100%',
                maxWidth: 1000,
                textAlign: 'left'
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontSize: { xs: '2rem', md: '3rem' },
                  fontWeight: 800,
                  mb: 2,
                  color: '#212529',
                  letterSpacing: '-0.5px',
                  fontFamily: '"Noto Sans KR", "Roboto", sans-serif'
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
                    color: '#1a1a1a',
                    mb: 3
                  }}
                >
                  {slide.content}
                </Typography>
              )}
              {slide.imageUrl && (
                <Box
                  component="img"
                  src={getProxyImageUrl(slide.imageUrl)}
                  alt={slide.title || '커스텀 이미지'}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '50vh',
                    objectFit: 'contain',
                    borderRadius: 2,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                  }}
                  onError={(e) => {
                    // 프록시 실패 시 원본 URL로 폴백
                    try {
                      const original = slide.imageUrl;
                      if (original && e.currentTarget.src !== original) {
                        e.currentTarget.src = original;
                      }
                    } catch {}
                  }}
                />
              )}
            </Box>
          </Box>

          {/* 하단 푸터 제거: 작성자 정보는 상단 헤더 오른쪽 밑으로 이동 */}
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

    // 검수 모드인 경우 실제 컴포넌트 렌더링
    if (slide.mode === 'inspection') {
      const availableTabs = getAvailableTabsForMode('inspection', loggedInStore);
      const tabIndex = availableTabs.findIndex(t => t.key === slide.tab);
      
      // 세부 옵션 중 마지막 항목만 가져오기
      const lastDetailOption = getLastDetailOptionLabel(slide, loggedInStore);
      
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)',
            color: '#212529',
            p: { xs: 2, md: 3 },
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* 상단바: 좌→우 그라데이션, 좌측 로고/회사명 + 우측 제목(흰색) */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 15,
              background: getHeaderGradientLocal(slide),
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: { xs: 2.5, md: 4 },
              py: { xs: 1.6, md: 2 },
              pointerEvents: 'none'
            }}
          >
            {/* 왼쪽: 로고와 회사 이름 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                component="img"
                src="/logo512.png"
                alt="회사 로고"
                sx={{
                  width: { xs: 48, md: 60 },
                  height: { xs: 48, md: 60 },
                  filter: 'brightness(0) invert(0)'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.25rem', md: '1.6rem' },
                  color: '#212529',
                  letterSpacing: '0.2px',
                  fontFamily: '"Noto Sans KR","Roboto",sans-serif'
                }}
              >
                (주)브이아이피플러스
              </Typography>
            </Box>
            
            {/* 오른쪽: 통합 제목 */}
            <Typography
              sx={{
                fontSize: { xs: '1rem', md: '1.25rem' },
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                letterSpacing: '0.2px'
              }}
            >
              {getUnifiedTitle(slide, loggedInStore)}
            </Typography>
          </Box>

          {/* 작성자 정보: 상단 헤더 오른쪽 바로 밑 */}
          {slide.createdBy && (
            <Box sx={{ 
              position: 'absolute',
              top: { xs: 56, md: 68 }, // 헤더 높이만큼 아래
              right: { xs: 2.5, md: 4 },
              zIndex: 14,
              textAlign: 'right'
            }}>
              <Typography variant="body2" sx={{ 
                color: '#6c757d', 
                fontSize: { xs: '0.75rem', md: '0.85rem' },
                fontWeight: 500,
                fontFamily: '"Noto Sans KR", sans-serif',
                opacity: 0.8
              }}>
                작성자: {slide.createdBy}
              </Typography>
            </Box>
          )}

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
              pt: { xs: 8, md: 10 }
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                overflow: 'auto',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.06)',
                '& .MuiAppBar-root': { display: 'none' },
                '& .MuiTabs-root': { display: 'none' }
              }}
            >
              <InspectionMode
                loggedInStore={loggedInStore}
                onLogout={() => {}}
                onModeChange={() => {}}
                availableModes={[]}
                presentationMode={true}
                initialTab={tabIndex >= 0 ? tabIndex : 0}
                detailOptions={slide.detailOptions}
              />
            </Box>
          </Box>
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
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 [SlideRenderer] 하부 탭 인덱스 계산: ${slide.subTab} -> ${subTabIndex}`);
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ [SlideRenderer] 하부 탭을 찾을 수 없음: ${slide.subTab}`);
          }
        }
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 [SlideRenderer] ChartMode 렌더링:`, {
          tab: slide.tab,
          tabIndex,
          subTab: slide.subTab,
          subTabIndex,
          slideId: slide.slideId
        });
      }
      
      // 모드/탭 제목 구성 (역순으로)
      const modeTitle = modeConfig?.title || slide.mode;
      const tabConfig = availableTabs[tabIndex];
      const tabTitle = tabConfig?.label || slide.tab;
      const subTabTitle = slide.subTab && tabConfig?.subTabs
        ? tabConfig.subTabs.find(st => st.key === slide.subTab)?.label || slide.subTab
        : null;
      
      // 세부 옵션 중 마지막 항목만 가져오기
      const lastDetailOption = getLastDetailOptionLabel(slide, loggedInStore);
      
      return (
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)', // 전문적인 그라데이션
            color: '#212529', // 어두운 계열 글자색
            p: { xs: 2, md: 3 },
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* 상단바: 좌→우 그라데이션, 좌측 로고/회사명 + 우측 통합 제목(흰색) */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 15,
              background: getHeaderGradientLocal(slide),
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: { xs: 2.5, md: 4 },
              py: { xs: 1.6, md: 2 },
              pointerEvents: 'none'
            }}
          >
            {/* 왼쪽: 로고와 회사 이름 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                component="img"
                src="/logo512.png"
                alt="회사 로고"
                sx={{
                  width: { xs: 48, md: 60 },
                  height: { xs: 48, md: 60 },
                  filter: 'brightness(0) invert(0)'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.25rem', md: '1.6rem' },
                  color: '#212529',
                  letterSpacing: '0.2px',
                  fontFamily: '"Noto Sans KR","Roboto",sans-serif'
                }}
              >
                (주)브이아이피플러스
              </Typography>
            </Box>
            {/* 오른쪽: 통합 제목 */}
            <Typography
              sx={{
                fontSize: { xs: '1rem', md: '1.25rem' },
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                letterSpacing: '0.2px'
              }}
            >
              {getUnifiedTitle(slide, loggedInStore)}
            </Typography>
          </Box>

          {/* 작성자 정보: 상단 헤더 오른쪽 바로 밑 */}
          {slide.createdBy && (
            <Box sx={{ 
              position: 'absolute',
              top: { xs: 56, md: 68 }, // 헤더 높이만큼 아래
              right: { xs: 2.5, md: 4 },
              zIndex: 14,
              textAlign: 'right'
            }}>
              <Typography variant="body2" sx={{ 
                color: '#6c757d', 
                fontSize: { xs: '0.75rem', md: '0.85rem' },
                fontWeight: 500,
                fontFamily: '"Noto Sans KR", sans-serif',
                opacity: 0.8
              }}>
                작성자: {slide.createdBy}
              </Typography>
            </Box>
          )}

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
                backgroundColor: '#ffffff', // 전문적인 흰색 카드 배경
                borderRadius: '16px',
                overflow: 'auto',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.06)',
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
        </Box>
      );
    }

    // mode-only 타입 슬라이드 렌더링
    if (slide.type === 'mode-only' && slide.mode) {
      const modeConfig = getModeConfig(slide.mode);
      // 세부 옵션 중 마지막 항목만 가져오기
      const lastDetailOption = getLastDetailOptionLabel(slide, loggedInStore);
      
      // Budget 모드 지원
      if (slide.mode === 'budget') {
        return (
          <Box
            sx={{
              width: '100vw',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)',
              color: '#212529',
              p: { xs: 2, md: 3 },
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* 상단: 회사 로고 및 슬라이드 제목 */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                width: '100%',
                backgroundColor: '#ffffff',
                px: { xs: 3, md: 4 },
                py: { xs: 2.5, md: 3 },
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                    fontWeight: 700,
                    fontSize: { xs: '1.1rem', md: '1.3rem' },
                    color: '#212529',
                    letterSpacing: '0.5px',
                    fontFamily: '"Noto Sans KR", "Roboto", "Helvetica", "Arial", sans-serif'
                  }}
                >
                  (주)브이아이피플러스
                </Typography>
              </Box>
              
              {/* 오른쪽: 세부 옵션 마지막 항목만 표시 */}
              {lastDetailOption && (
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 900,
                    fontSize: { xs: '1.4rem', md: '1.8rem' },
                    color: '#212529',
                    textAlign: 'right',
                    fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
                    letterSpacing: '0.3px',
                    backgroundColor: 'transparent',
                    background: 'none'
                  }}
                >
                  {lastDetailOption}
                </Typography>
              )}
            </Box>

            {/* 작성자 정보: 상단 헤더 오른쪽 바로 밑 */}
            {slide.createdBy && (
              <Box sx={{ 
                position: 'absolute',
                top: { xs: 56, md: 68 }, // 헤더 높이만큼 아래
                right: { xs: 2.5, md: 4 },
                zIndex: 14,
                textAlign: 'right'
              }}>
                <Typography variant="body2" sx={{ 
                  color: '#6c757d', 
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  fontWeight: 500,
                  fontFamily: '"Noto Sans KR", sans-serif',
                  opacity: 0.8
                }}>
                  작성자: {slide.createdBy}
                </Typography>
              </Box>
            )}

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
                pt: { xs: 8, md: 10 }
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  overflow: 'auto',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  '& .MuiAppBar-root': { display: 'none' },
                  '& .MuiTabs-root': { display: 'none' }
                }}
              >
                <BudgetMode
                  loggedInStore={loggedInStore}
                  onLogout={() => {}}
                  onModeChange={() => {}}
                  availableModes={[]}
                />
              </Box>
            </Box>
          </Box>
        );
      }
      
      // OB Management 모드 지원
      if (slide.mode === 'obManagement') {
        return (
          <Box
            sx={{
              width: '100vw',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)',
              color: '#212529',
              p: { xs: 2, md: 3 },
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* 상단: 회사 로고 및 슬라이드 제목 */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                width: '100%',
                backgroundColor: '#ffffff',
                px: { xs: 3, md: 4 },
                py: { xs: 2.5, md: 3 },
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                    fontWeight: 700,
                    fontSize: { xs: '1.1rem', md: '1.3rem' },
                    color: '#212529',
                    letterSpacing: '0.5px',
                    fontFamily: '"Noto Sans KR", "Roboto", "Helvetica", "Arial", sans-serif'
                  }}
                >
                  (주)브이아이피플러스
                </Typography>
              </Box>
              
              {/* 오른쪽: 세부 옵션 마지막 항목만 표시 */}
              {lastDetailOption && (
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 900,
                    fontSize: { xs: '1.4rem', md: '1.8rem' },
                    color: '#212529',
                    textAlign: 'right',
                    fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
                    letterSpacing: '0.3px',
                    backgroundColor: 'transparent',
                    background: 'none'
                  }}
                >
                  {lastDetailOption}
                </Typography>
              )}
            </Box>

            {/* 작성자 정보: 상단 헤더 오른쪽 바로 밑 */}
            {slide.createdBy && (
              <Box sx={{ 
                position: 'absolute',
                top: { xs: 56, md: 68 }, // 헤더 높이만큼 아래
                right: { xs: 2.5, md: 4 },
                zIndex: 14,
                textAlign: 'right'
              }}>
                <Typography variant="body2" sx={{ 
                  color: '#6c757d', 
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  fontWeight: 500,
                  fontFamily: '"Noto Sans KR", sans-serif',
                  opacity: 0.8
                }}>
                  작성자: {slide.createdBy}
                </Typography>
              </Box>
            )}

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
                pt: { xs: 8, md: 10 }
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  overflow: 'auto',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  '& .MuiAppBar-root': { display: 'none' },
                  '& .MuiTabs-root': { display: 'none' }
                }}
              >
                <ObManagementMode
                  loggedInStore={loggedInStore}
                  onLogout={() => {}}
                  onModeChange={() => {}}
                  availableModes={[]}
                />
              </Box>
            </Box>
          </Box>
        );
      }
      
      // 지원되는 모드인지 확인
      const supportedModes = ['chart', 'inspection', 'budget', 'obManagement'];
      if (!supportedModes.includes(slide.mode)) {
        // 지원되지 않는 모드는 PlaceholderModeScreen 사용
        const PlaceholderModeScreen = require('../PlaceholderModeScreen').default;
        return (
          <Box
            sx={{
              width: '100vw',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)',
              color: '#212529',
              p: { xs: 2, md: 3 },
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* 상단: 회사 로고 및 슬라이드 제목 */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                backgroundColor: '#ffffff',
                px: { xs: 3, md: 4 },
                py: { xs: 2.5, md: 3 },
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                    fontWeight: 700,
                    fontSize: { xs: '0.95rem', md: '1.1rem' },
                    color: '#212529',
                    letterSpacing: '0.5px',
                    fontFamily: '"Noto Sans KR", "Roboto", "Helvetica", "Arial", sans-serif'
                  }}
                >
                  (주)브이아이피플러스
                </Typography>
              </Box>
              
              {/* 오른쪽: 세부 옵션 마지막 항목만 표시 */}
              {lastDetailOption && (
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 900,
                    fontSize: { xs: '1.4rem', md: '1.8rem' },
                    color: '#212529',
                    textAlign: 'right',
                    fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
                    letterSpacing: '0.3px',
                    backgroundColor: 'transparent',
                    background: 'none'
                  }}
                >
                  {lastDetailOption}
                </Typography>
              )}
            </Box>

            {/* 작성자 정보: 상단 헤더 오른쪽 바로 밑 */}
            {slide.createdBy && (
              <Box sx={{ 
                position: 'absolute',
                top: { xs: 56, md: 68 }, // 헤더 높이만큼 아래
                right: { xs: 2.5, md: 4 },
                zIndex: 14,
                textAlign: 'right'
              }}>
                <Typography variant="body2" sx={{ 
                  color: '#6c757d', 
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  fontWeight: 500,
                  fontFamily: '"Noto Sans KR", sans-serif',
                  opacity: 0.8
                }}>
                  작성자: {slide.createdBy}
                </Typography>
              </Box>
            )}

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
                pt: { xs: 8, md: 10 }
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  overflow: 'auto',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  '& .MuiAppBar-root': { display: 'none' },
                  '& .MuiTabs-root': { display: 'none' }
                }}
              >
                <PlaceholderModeScreen
                  modeKey={slide.mode}
                  onLogout={() => {}}
                  onModeChange={() => {}}
                  availableModes={[]}
                  loggedInStore={loggedInStore}
                />
              </Box>
            </Box>
          </Box>
        );
      }
      
    }

    // 지원되지 않는 모드 타입: 빈 화면 반환 (캡처되지 않도록)
    console.warn(`⚠️ [SlideRenderer] 지원되지 않는 슬라이드 타입: ${slide.type || 'unknown'}, 모드: ${slide.mode || 'unknown'}`);
    return (
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          position: 'relative'
        }}
        data-capture-exclude="true"
      >
        <Typography variant="body2" sx={{ color: '#999', opacity: 0.5 }}>
          지원되지 않는 슬라이드 타입입니다.
        </Typography>
      </Box>
    );
    } catch (err) {
      console.error('❌ [SlideRenderer] renderSlideContent 내부 에러:', err, {
        slideId: slide?.slideId,
        slideType: slide?.type,
        errorMessage: err?.message,
        errorStack: err?.stack
      });
      logger.error('❌ [SlideRenderer] renderSlideContent 에러:', err, {
        slideId: slide?.slideId,
        slideType: slide?.type,
        errorMessage: err?.message,
        errorStack: err?.stack
      });
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="error">
            슬라이드 렌더링 중 오류가 발생했습니다: {err.message || '알 수 없는 오류'}
          </Alert>
        </Box>
      );
    }
  }, [slide, loggedInStore, getHeaderGradientLocal]);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [SlideRenderer] renderSlideContent useCallback 완료');
    }
  } catch (err) {
    console.error('❌ [SlideRenderer] renderSlideContent useCallback 정의 중 에러:', err);
    // 폴백 함수
    renderSlideContent = () => (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="error">
          렌더링 함수 초기화 오류: {err.message || '알 수 없는 오류'}
        </Alert>
      </Box>
    );
  }
  
  // 디버깅: renderSlideContent 정의 후
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [SlideRenderer] renderSlideContent 정의 완료', {
        hasRenderSlideContent: typeof renderSlideContent === 'function'
      });
    }
  } catch (err) {
    console.error('❌ [SlideRenderer] renderSlideContent 정의 후 에러:', err);
  }

  // 디버깅: return 전
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [SlideRenderer] return 전', {
        hasSlide: !!slide,
        hasRenderSlideContent: typeof renderSlideContent === 'function',
        slideId: slide?.slideId
      });
    }
  } catch (err) {
    console.error('❌ [SlideRenderer] return 전 에러:', err);
  }

  // renderSlideContent가 없으면 에러 표시
  if (!renderSlideContent) {
    console.error('❌ [SlideRenderer] renderSlideContent가 정의되지 않았습니다!');
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="error">
          렌더링 함수가 초기화되지 않았습니다.
        </Alert>
      </Box>
    );
  }

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
      {slide && renderSlideContent ? (() => {
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 [SlideRenderer] renderSlideContent 호출 시도');
          }
          return renderSlideContent();
        } catch (err) {
          console.error('❌ [SlideRenderer] renderSlideContent 호출 중 에러:', err);
          return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Alert severity="error">
                렌더링 중 오류 발생: {err.message || '알 수 없는 오류'}
              </Alert>
            </Box>
          );
        }
      })() : (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      )}
      
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
}, (prevProps, nextProps) => {
  // React.memo 비교 함수: slide와 loggedInStore가 변경되지 않으면 재렌더링 방지
  return prevProps.slide?.slideId === nextProps.slide?.slideId &&
         prevProps.loggedInStore?.storeId === nextProps.loggedInStore?.storeId &&
         prevProps.onReady === nextProps.onReady;
});

export default SlideRenderer;

