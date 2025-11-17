import React, { useState, useRef, useEffect, useCallback } from 'react';
import { captureElement, generateImageFilename } from '../../utils/screenCapture';
import { api } from '../../api';
import { API_BASE_URL } from '../../api';
import CaptureProgress from './CaptureProgress';
import SlideRenderer from './SlideRenderer';

/**
 * 회의 캡처를 관리하는 컴포넌트
 * 회의 생성 시 모든 슬라이드를 자동으로 캡처
 */
function MeetingCaptureManager({ meeting, slides, loggedInStore, onComplete, onCancel }) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState([]);
  const [capturing, setCapturing] = useState(false);
  const slideRefs = useRef([]);
  const [slideReady, setSlideReady] = useState(false);
  const [slidesState, setSlidesState] = useState(slides); // 슬라이드 상태 관리
  const [startTime, setStartTime] = useState(null); // 캡처 시작 시간
  const [retryingSlides, setRetryingSlides] = useState(new Set()); // 재시도 중인 슬라이드
  const [isPaused, setIsPaused] = useState(false); // 일시정지 상태 (캡처 일시정지/재개용)
  const isMountedRef = useRef(true); // 컴포넌트 마운트 상태 추적

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (slides && Array.isArray(slides)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📋 [MeetingCaptureManager] 슬라이드 초기화: ${slides.length}개`);
      }
      // 엔딩/메인 슬라이드에 meeting 필드가 누락되어 저장된 케이스 보정
      const normalized = slides.map(s => {
        if (!s || !s.type) return s;
        if (s.type === 'ending' || s.type === 'main') {
          return {
            ...s,
            meetingName: s.meetingName != null ? s.meetingName : (meeting?.meetingName),
            meetingDate: s.meetingDate != null ? s.meetingDate : (meeting?.meetingDate),
            meetingNumber: s.meetingNumber != null ? s.meetingNumber : (meeting?.meetingNumber)
          };
        }
        return s;
      });
      setSlidesState(normalized);
      try {
        if (typeof window !== 'undefined') {
          window.__MEETING_NUMBER = meeting?.meetingNumber ?? normalized.find(sl=>sl.type==='main')?.meetingNumber ?? null;
        }
      } catch {}
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [MeetingCaptureManager] slides가 배열이 아닙니다:`, slides);
      }
      setSlidesState([]);
    }
  }, [slides, meeting]);

  // startCapture를 useCallback으로 메모이제이션하여 의존성 문제 해결
  const startCapture = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    if (!slidesState || !Array.isArray(slidesState) || slidesState.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    setCapturing(true);
    setCurrentSlideIndex(0);
    setCompleted(0);
    setFailed([]);
    setStartTime(Date.now()); // 캡처 시작 시간 기록

    // 첫 번째 슬라이드 렌더링 시작
    await captureNextSlide(0);
  }, [slidesState, onComplete]);

  useEffect(() => {
    if (slidesState && Array.isArray(slidesState) && slidesState.length > 0 && !capturing) {
      startCapture();
    }
  }, [slidesState, capturing, startCapture]);

  const captureNextSlide = async (index) => {
    // 언마운트 체크
    if (!isMountedRef.current) {
      return;
    }

    // 배열 인덱스 범위 체크
    if (!slidesState || !Array.isArray(slidesState) || index < 0 || index >= slidesState.length) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [MeetingCaptureManager] 유효하지 않은 인덱스: ${index}, 배열 길이: ${slidesState?.length || 0}`);
      }
      // 모든 슬라이드 캡처 완료
      if (isMountedRef.current) {
        setCapturing(false);
        
        // 회의 상태를 completed로 업데이트
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔄 [MeetingCaptureManager] 회의 상태를 completed로 업데이트 시작: ${meeting.meetingId}`);
          }
          await api.updateMeeting(meeting.meetingId, {
            status: 'completed'
          });
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ [MeetingCaptureManager] 회의 상태 업데이트 완료`);
          }
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ [MeetingCaptureManager] 회의 상태 업데이트 오류:', err);
          }
        }

        if (onComplete) {
          onComplete();
        }
      }
      return;
    }

    // 일시정지 상태면 대기 (언마운트 체크 포함)
    while (isPaused && isMountedRef.current) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 언마운트 체크 (일시정지 대기 중 언마운트될 수 있음)
    if (!isMountedRef.current) {
      return;
    }

    if (index >= slidesState.length) {
      // 모든 슬라이드 캡처 완료
      setCapturing(false);
      
      // 회의 상태를 completed로 업데이트
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 [MeetingCaptureManager] 회의 상태를 completed로 업데이트 시작: ${meeting.meetingId}`);
        }
        await api.updateMeeting(meeting.meetingId, {
          status: 'completed'
        });
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ [MeetingCaptureManager] 회의 상태 업데이트 완료`);
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ [MeetingCaptureManager] 회의 상태 업데이트 오류:', err);
        }
      }

      if (onComplete) {
        onComplete();
      }
      return;
    }

    setCurrentSlideIndex(index);
    setSlideReady(false);

    // 슬라이드가 준비될 때까지 대기 (최대 10초)
    const waitForReady = () => {
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // 5초 (50 * 100ms) - 최적화: 10초 -> 5초
        const checkReady = () => {
          attempts++;
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 [MeetingCaptureManager] 슬라이드 준비 확인 (${attempts}/${maxAttempts}):`, slideReady);
          }
          if (slideReady) {
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [MeetingCaptureManager] 슬라이드 준비 완료');
            }
            resolve();
          } else if (attempts >= maxAttempts) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ [MeetingCaptureManager] 슬라이드 ${index + 1} 준비 타임아웃, 강제 진행`);
            }
            resolve(); // 타임아웃 시에도 진행
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    };

    // 최소 1초 대기 (데이터 로딩 및 렌더링 시간) - 최적화: 2초 -> 1초
    await new Promise(resolve => setTimeout(resolve, 1000));
    await waitForReady();

    try {
      // 언마운트 체크
      if (!isMountedRef.current) {
        return;
      }

      // 슬라이드 데이터 검증 및 배열 범위 체크
      if (!slidesState || !Array.isArray(slidesState) || index < 0 || index >= slidesState.length || !slidesState[index]) {
        throw new Error(`슬라이드 데이터가 없습니다. (index: ${index}, slidesState: ${slidesState ? 'exists' : 'null'}, length: ${slidesState?.length || 0})`);
      }
      
      const currentSlide = slidesState[index];
      if (!currentSlide.slideId) {
        throw new Error(`슬라이드 ID가 없습니다. (index: ${index}, slide: ${JSON.stringify(currentSlide)})`);
      }
      
      // 현재 슬라이드 DOM 요소 찾기 (data-slide-id 속성을 가진 요소만)
      // 여러 번 시도하여 DOM이 마운트될 때까지 대기
      let slideElement = null;
      let attempts = 0;
      const maxAttempts = 20; // 2초 동안 시도
      
      while (!slideElement && attempts < maxAttempts) {
        slideElement = document.querySelector(`[data-slide-id="${currentSlide.slideId}"]`);
        if (!slideElement) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }
      
      if (!slideElement) {
        // 모든 슬라이드 요소 확인 (디버깅용)
        const allSlideElements = document.querySelectorAll('[data-slide-id]');
        if (process.env.NODE_ENV === 'development') {
          console.error(`❌ [MeetingCaptureManager] 슬라이드 요소를 찾을 수 없습니다.`, {
            slideId: currentSlide.slideId,
            index: index,
            totalSlides: slidesState.length,
            foundElements: Array.from(allSlideElements).map(el => el.getAttribute('data-slide-id'))
          });
        }
        throw new Error(`슬라이드 요소를 찾을 수 없습니다. (slideId: ${currentSlide.slideId}, index: ${index})`);
      }

      // 동영상 슬라이드는 캡처/업로드를 건너뛰고 비주얼은 재생 단계에서 처리
      if ((currentSlide.type === 'custom' || currentSlide.type === 'mode-tab' || currentSlide.type === 'video') && currentSlide.videoUrl && !currentSlide.imageUrl) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⏭️ [MeetingCaptureManager] 동영상 슬라이드 캡처 생략: ${currentSlide.slideId}`);
        }
        // 슬라이드 상태만 저장하고 다음으로 진행
        try {
          const toSave = slidesState.map((s, i) => (i === index ? { ...s, capturedAt: new Date().toISOString() } : s));
          await api.saveMeetingConfig(meeting.meetingId, { slides: toSave });
          setSlidesState(toSave);
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ [MeetingCaptureManager] 동영상 슬라이드 저장 중 경고:', e?.message);
          }
        }
        // 완료 카운트 업데이트 및 다음 슬라이드로
        setCompleted(prev => prev + 1);
        setTimeout(() => {
          if (isMountedRef.current) {
            captureNextSlide(index + 1);
          }
        }, 300);
        return;
      }

      // 특정 상세옵션 선택 시: 섹션 펼치기 및 타겟 요소만 캡처
      // 메인/목차는 헤더 포함 전체 슬라이드를 캡처 (공백은 autoCropCanvas로 처리)
      let captureTargetElement = slideElement;
      try {
        // 전체총마감 슬라이드: 모든 섹션 펼치기 및 전체 슬라이드 캡처
        if (currentSlide?.mode === 'chart' && currentSlide?.tab === 'closingChart' && currentSlide?.subTab === 'totalClosing') {
          // 1단계: data-loaded="true" 속성이 설정될 때까지 대기 (데이터 로드 완료 대기)
          if (process.env.NODE_ENV === 'development') {
            console.log(`⏳ [MeetingCaptureManager] 전체총마감: 데이터 로드 완료 대기 시작...`);
          }
          
          let dataLoaded = false;
          let loadWaitAttempts = 0;
          const maxLoadWaitAttempts = 100; // 최대 20초 (100 * 200ms)
          
          while (!dataLoaded && loadWaitAttempts < maxLoadWaitAttempts) {
            // data-loaded 속성이 있는 요소 찾기
            const dataLoadedElement = slideElement.querySelector('[data-loaded="true"]');
            if (dataLoadedElement) {
              dataLoaded = true;
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [MeetingCaptureManager] 전체총마감: 데이터 로드 완료 확인 (${loadWaitAttempts * 200}ms 대기)`);
              }
              break;
            }
            await new Promise(r => setTimeout(r, 200));
            loadWaitAttempts++;
          }
          
          if (!dataLoaded) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ [MeetingCaptureManager] 전체총마감: 데이터 로드 완료 확인 실패, 계속 진행...`);
            }
          }
          
          // 2단계: 추가 안정화 대기 (데이터 렌더링 완료 보장)
          await new Promise(r => setTimeout(r, 1000));
          
          // 3단계: 섹션별 헤더 텍스트와 해당 섹션의 테이블 확인
          const sectionHeaders = [
            { text: 'CS 개통 실적', key: 'cs' },
            { text: '코드별 실적', key: 'code' },
            { text: '사무실별 실적', key: 'office' },
            { text: '소속별 실적', key: 'department' },
            { text: '담당자별 실적', key: 'agent' }
          ];
          
          // 각 섹션별로 펼치기 버튼 찾기 및 클릭
          const expandedSections = new Set();
          
          for (const section of sectionHeaders) {
            // 섹션 헤더 찾기 (더 정확한 선택자 사용)
            const headerElements = Array.from(slideElement.querySelectorAll('h6, .MuiTypography-h6, .MuiBox-root, div, span'))
              .filter(el => {
                const text = (el.textContent || '').trim();
                return text.includes(section.text);
              });
            
            if (headerElements.length === 0) {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`⚠️ [MeetingCaptureManager] 전체총마감: "${section.text}" 섹션 헤더를 찾을 수 없습니다.`);
              }
              continue;
            }
            
            // 헤더가 속한 Paper 컴포넌트 찾기
            let paperElement = headerElements[0].parentElement;
            while (paperElement && paperElement !== slideElement && !paperElement.classList.contains('MuiPaper-root')) {
              paperElement = paperElement.parentElement;
            }
            
            if (!paperElement || !paperElement.classList.contains('MuiPaper-root')) {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`⚠️ [MeetingCaptureManager] 전체총마감: "${section.text}" 섹션의 Paper를 찾을 수 없습니다.`);
              }
              continue;
            }
            
            // 해당 Paper 내부의 "펼치기" 버튼 찾기
            const expandButton = Array.from(paperElement.querySelectorAll('button, .MuiButton-root'))
              .find(btn => {
                const text = (btn.textContent || '').trim();
                return text === '펼치기';
              });
            
            if (expandButton) {
              // 펼치기 버튼 클릭
              expandButton.click();
              await new Promise(r => setTimeout(r, 800)); // 각 버튼 클릭 후 충분한 대기 (800ms)
              
              // 해당 섹션의 테이블이 나타날 때까지 대기 (최대 10초)
              let tableFound = false;
              let attempts = 0;
              while (attempts < 50) {
                const table = paperElement.querySelector('.MuiTableContainer-root, table');
                if (table) {
                  // 테이블에 실제 데이터가 있는지 확인 (최소 1개 행)
                  const rows = table.querySelectorAll('tbody tr, .MuiTableBody-root tr, tbody > tr');
                  if (rows.length > 0) {
                    tableFound = true;
                    expandedSections.add(section.key);
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`✅ [MeetingCaptureManager] 전체총마감: "${section.text}" 섹션 펼치기 완료 (${rows.length}개 행)`);
                    }
                    break;
                  }
                }
                await new Promise(r => setTimeout(r, 200));
                attempts++;
              }
              
              if (!tableFound) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn(`⚠️ [MeetingCaptureManager] 전체총마감: "${section.text}" 섹션 테이블을 찾을 수 없습니다.`);
                }
              }
            } else {
              // 이미 펼쳐져 있는지 확인 (접기 버튼이 있으면 펼쳐진 상태)
              const collapseButton = Array.from(paperElement.querySelectorAll('button, .MuiButton-root'))
                .find(btn => {
                  const text = (btn.textContent || '').trim();
                  return text === '접기';
                });
              
              if (collapseButton) {
                // 이미 펼쳐져 있음 - 테이블 데이터 확인
                const table = paperElement.querySelector('.MuiTableContainer-root, table');
                if (table) {
                  const rows = table.querySelectorAll('tbody tr, .MuiTableBody-root tr, tbody > tr');
                  if (rows.length > 0) {
                    expandedSections.add(section.key);
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`✅ [MeetingCaptureManager] 전체총마감: "${section.text}" 섹션 이미 펼쳐져 있음 (${rows.length}개 행)`);
                    }
                  } else {
                    // 펼쳐져 있지만 데이터가 없음 - 추가 대기
                    await new Promise(r => setTimeout(r, 1000));
                    const retryRows = table.querySelectorAll('tbody tr, .MuiTableBody-root tr, tbody > tr');
                    if (retryRows.length > 0) {
                      expandedSections.add(section.key);
                      if (process.env.NODE_ENV === 'development') {
                        console.log(`✅ [MeetingCaptureManager] 전체총마감: "${section.text}" 섹션 재확인 완료 (${retryRows.length}개 행)`);
                      }
                    }
                  }
                }
              }
            }
          }
          
          // 4단계: 모든 섹션이 펼쳐지고 데이터가 로드될 때까지 추가 대기 (최대 5초)
          const maxWait = 5000;
          const start = Date.now();
          while (Date.now() - start < maxWait) {
            const allTables = slideElement.querySelectorAll('.MuiTableContainer-root, table');
            let tablesWithData = 0;
            allTables.forEach(table => {
              const rows = table.querySelectorAll('tbody tr, .MuiTableBody-root tr, tbody > tr');
              if (rows.length > 0) tablesWithData++;
            });
            
            if (tablesWithData >= 5) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [MeetingCaptureManager] 전체총마감: 모든 섹션 펼치기 완료 (${tablesWithData}개 테이블)`);
              }
              break;
            }
            await new Promise(r => setTimeout(r, 200));
          }
          
          // 5단계: 최종 확인 및 안정화 대기
          const finalTables = slideElement.querySelectorAll('.MuiTableContainer-root, table');
          let finalTablesWithData = 0;
          finalTables.forEach(table => {
            const rows = table.querySelectorAll('tbody tr, .MuiTableBody-root tr, tbody > tr');
            if (rows.length > 0) finalTablesWithData++;
          });
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`📊 [MeetingCaptureManager] 전체총마감: 최종 확인 - ${finalTablesWithData}개 테이블 (데이터 포함)`);
          }
          
          // 최종 안정화 대기 (모든 렌더링 완료 보장)
          await new Promise(r => setTimeout(r, 1500));
          
          // 전체 슬라이드 캡처
          captureTargetElement = slideElement;
          
          // 타겟 가시성/높이 확보까지 대기
          const ensureVisible = async (el) => {
            if (!el || !(el instanceof HTMLElement)) return;
            el.scrollIntoView({ block: 'start', behavior: 'instant' });
            const maxWait = 3000;
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              const rect = el.getBoundingClientRect();
              const hasSize = rect.height > 200 && rect.width > 200;
              const allTables = el.querySelectorAll('.MuiTableContainer-root');
              let tablesWithData = 0;
              allTables.forEach(table => {
                const rows = table.querySelectorAll('tbody tr, tbody > tr');
                if (rows.length > 0) tablesWithData++;
              });
              if (hasSize && tablesWithData >= 5) break;
              await new Promise(r => setTimeout(r, 200));
            }
          };
          await ensureVisible(captureTargetElement);
          
          // 전체총마감 슬라이드: 실제 콘텐츠 높이 측정 및 불필요한 여백 제거 (월간시상 슬라이드와 유사한 로직)
          // 전체총마감 슬라이드가 아닌 경우 이 로직을 건너뛰기
          const isTotalClosingSlide = currentSlide?.mode === 'chart' && 
                                     currentSlide?.tab === 'closingChart' && 
                                     currentSlide?.subTab === 'totalClosing';
          
          if (isTotalClosingSlide) {
          try {
            const rect = captureTargetElement.getBoundingClientRect();
            const allChildren = captureTargetElement.querySelectorAll('*');
            let maxRelativeBottom = 0;
            let actualContentHeight = captureTargetElement.scrollHeight || rect.height;
            
            // 모든 자식 요소의 실제 렌더링 위치 확인
            for (const child of allChildren) {
              try {
                const childRect = child.getBoundingClientRect();
                const relativeBottom = childRect.bottom - rect.top;
                if (relativeBottom > 0 && relativeBottom < actualContentHeight * 3) {
                  maxRelativeBottom = Math.max(maxRelativeBottom, relativeBottom);
                }
              } catch (e) {
                // 무시
              }
            }
            
            // 실제 콘텐츠 높이에 맞춰서 설정 (불필요한 여백 제거)
            // 모든 섹션(5개 테이블)의 높이를 제대로 고려하기 위해 110% 제한 제거
            // maxRelativeBottom + 100px 여유공간과 scrollHeight 중 더 큰 값 사용
            const measuredHeight = Math.max(
              maxRelativeBottom + 100, // 모든 섹션을 포함하기 위해 충분한 여유공간 (100px)
              actualContentHeight // scrollHeight도 고려
            );
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`📐 [MeetingCaptureManager] 전체총마감: 실제 콘텐츠 높이 측정`, {
                maxRelativeBottom,
                actualContentHeight,
                measuredHeight,
                scrollHeight: captureTargetElement.scrollHeight,
                offsetHeight: captureTargetElement.offsetHeight
              });
            }
            
            // 요소의 높이를 실제 콘텐츠 높이로 제한하여 불필요한 여백 제거
            const originalHeight = captureTargetElement.style.height;
            const originalMaxHeight = captureTargetElement.style.maxHeight;
            captureTargetElement.style.height = `${measuredHeight}px`;
            captureTargetElement.style.maxHeight = `${measuredHeight}px`;
            captureTargetElement.style.overflow = 'visible';
            
            // 높이 제한을 위해 restoreStylesFunction에 추가
            if (restoreStylesFunction) {
              const originalRestore = restoreStylesFunction;
              restoreStylesFunction = () => {
                originalRestore();
                if (originalHeight) {
                  captureTargetElement.style.height = originalHeight;
                } else {
                  captureTargetElement.style.removeProperty('height');
                }
                if (originalMaxHeight) {
                  captureTargetElement.style.maxHeight = originalMaxHeight;
                } else {
                  captureTargetElement.style.removeProperty('max-height');
                }
                captureTargetElement.style.removeProperty('overflow');
              };
            } else {
              restoreStylesFunction = () => {
                if (originalHeight) {
                  captureTargetElement.style.height = originalHeight;
                } else {
                  captureTargetElement.style.removeProperty('height');
                }
                if (originalMaxHeight) {
                  captureTargetElement.style.maxHeight = originalMaxHeight;
                } else {
                  captureTargetElement.style.removeProperty('max-height');
                }
                captureTargetElement.style.removeProperty('overflow');
              };
            }
            
            await new Promise(r => setTimeout(r, 300)); // 스타일 변경 후 렌더링 대기
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 전체총마감 높이 측정 중 경고:', e?.message);
            }
          }
          } // isTotalClosingSlide 체크 종료
        }
        
        // csDetailType: 단일 값 또는 배열(복수 결합) 지원
        const csDetailTypeRaw = currentSlide?.detailOptions?.csDetailType;
        const csDetailTypes = Array.isArray(csDetailTypeRaw)
          ? csDetailTypeRaw
          : (csDetailTypeRaw ? [csDetailTypeRaw] : []);
        // csDetailCriteria: "performance" 또는 "fee"
        const csDetailCriteria = currentSlide?.detailOptions?.csDetailCriteria || 'performance';
        
        if (currentSlide?.mode === 'chart' && csDetailTypes.length > 0 && !csDetailTypes.includes('all')) {
          // 1단계: 랭킹 기준 탭 선택 (실적 기준 또는 수수료 기준)
          // 랭킹 기준 탭은 "실적 기준" 또는 "수수료 기준" 텍스트를 가진 Tab 버튼
          const rankingTabs = Array.from(document.querySelectorAll('button[role="tab"]'));
          const targetRankingTab = rankingTabs.find(tab => {
            const text = (tab.textContent || '').trim();
            if (csDetailCriteria === 'performance') {
              return text === '실적 기준';
            } else if (csDetailCriteria === 'fee') {
              return text === '수수료 기준';
            }
            return false;
          });
          
          if (targetRankingTab) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ [MeetingCaptureManager] 랭킹 기준 탭 선택: ${csDetailCriteria}`, {
                slideId: currentSlide.slideId,
                csDetailTypes,
                tabText: targetRankingTab.textContent
              });
            }
            targetRankingTab.click();
            // 랭킹 기준 변경 후 데이터 업데이트 대기
            await new Promise(r => setTimeout(r, 500));
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ [MeetingCaptureManager] 랭킹 기준 탭을 찾을 수 없습니다.`, {
                slideId: currentSlide.slideId,
                csDetailCriteria,
                foundTabs: rankingTabs.map(t => t.textContent)
              });
            }
          }
          
          // 2단계: CS 개통 실적 요약 섹션의 "펼치기" 버튼 클릭 (csDetailType === 'cs'일 때만)
          if (csDetailTypes.includes('cs')) {
            const csSummaryButtons = Array.from(document.querySelectorAll('button'))
              .filter(btn => {
                const text = (btn.textContent || '').trim();
                // CS 개통 실적 섹션 내의 "펼치기" 버튼 찾기
                const parent = btn.closest('[class*="MuiPaper-root"]');
                if (!parent) return false;
                const parentText = (parent.textContent || '').trim();
                return parentText.includes('CS 개통 실적') && text === '펼치기';
              });
            
            if (csSummaryButtons.length > 0) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [MeetingCaptureManager] CS 개통 실적 요약 섹션 펼치기`, {
                  slideId: currentSlide.slideId
                });
              }
              csSummaryButtons[0].click();
              await new Promise(r => setTimeout(r, 300));
            }
          }
          
          // 3단계: 각 테이블 섹션의 "펼치기" 버튼 클릭 (선택된 모든 타입에 대해)
          const tableSectionMap = {
            'code': '📊 코드별 실적',
            'office': '🏢 사무실별 실적',
            'department': '👥 소속별 실적',
            'agent': ['🧑 담당자별 실적', '👤 담당자별 실적']
          };
          
          const expandSection = async (headerKey) => {
            const headerTexts = Array.isArray(headerKey) ? headerKey : [headerKey];
            let targetPaper = null;
            for (const headerText of headerTexts) {
              const headers = Array.from(document.querySelectorAll('h6, .MuiTypography-h6, .MuiBox-root, div'))
                .filter(el => {
                  const txt = (el.textContent || '').trim();
                  return txt.includes(headerText);
                });
              if (headers.length > 0) {
                let paperElement = headers[0].parentElement;
                while (paperElement && !paperElement.classList.contains('MuiPaper-root')) {
                  paperElement = paperElement.parentElement;
                }
                if (paperElement) {
                  targetPaper = paperElement;
                  break;
                }
              }
            }
            if (!targetPaper) return;
            const expandButton = targetPaper.querySelector('button')
              ? Array.from(targetPaper.querySelectorAll('button')).find(btn => {
                  const text = (btn.textContent || '').trim();
                  return text === '펼치기';
                })
              : null;
            if (expandButton) {
              expandButton.click();
              await new Promise(r => setTimeout(r, 500));
            }
          };
          
          for (const t of csDetailTypes) {
            if (t === 'code') await expandSection(tableSectionMap['code']);
            if (t === 'office') await expandSection(tableSectionMap['office']);
            if (t === 'department') await expandSection(tableSectionMap['department']);
            if (t === 'agent') await expandSection(tableSectionMap['agent']);
          }
          
          const findHeader = (includesList) => {
            const candidates = Array.from(document.querySelectorAll('h6, .MuiTypography-h6, .MuiBox-root, div'));
            for (const el of candidates) {
              const txt = (el.textContent || '').trim();
              if (!txt) continue;
              for (const s of (Array.isArray(includesList) ? includesList : [includesList])) {
                if (txt.includes(s)) return el;
              }
            }
            return null;
          };
          
          // 공통 헬퍼 함수: 헤더를 찾아 해당 섹션의 Paper 컴포넌트 전체를 반환
          const findSectionPaper = (headerText) => {
            const header = findHeader(headerText);
            if (!header) return null;
            
            // 헤더가 속한 Paper 컴포넌트 찾기
            let paperElement = header.parentElement;
            while (paperElement && !paperElement.classList.contains('MuiPaper-root')) {
              paperElement = paperElement.parentElement;
            }
            return paperElement;
          };
          
          // 배열을 받을 수 있도록 오버로드
          const findSectionPaperArray = (headerTexts) => {
            const header = findHeader(headerTexts);
            if (!header) return null;
            
            let paperElement = header.parentElement;
            while (paperElement && !paperElement.classList.contains('MuiPaper-root')) {
              paperElement = paperElement.parentElement;
            }
            return paperElement;
          };
          
          // 단일 선택이면 해당 Paper만 캡처, 복수 선택이면 전체 슬라이드 캡처
          if (csDetailTypes.length === 1 && csDetailTypes[0] !== 'all' && csDetailTypes[0] === 'cs') {
            // CS 개통 실적: 헤더 + 카드들 + 직원 랭킹 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaper('📞 CS 개통 실적');
            if (!paperElement) {
              const errorMsg = 'CS 개통 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailTypes, slideId: currentSlide.slideId });
              }
              captureTargetElement = slideElement;
            } else {
              // Paper 전체를 캡처 (헤더 + 카드들 + 직원 랭킹 모두 포함)
              captureTargetElement = paperElement;
            }
          } else if (csDetailTypes.length === 1 && csDetailTypes[0] !== 'all' && csDetailTypes[0] === 'code') {
            // 코드별 실적: 헤더 + 테이블 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaper('📊 코드별 실적');
            if (!paperElement) {
              const errorMsg = '코드별 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailTypes, slideId: currentSlide.slideId });
              }
              captureTargetElement = slideElement;
            } else {
              // 테이블이 렌더링될 때까지 대기 후 Paper 전체 캡처
              let table = null;
              let attempts = 0;
              while (!table && attempts < 20) {
                table = paperElement.querySelector('.MuiTableContainer-root');
                if (!table) {
                  await new Promise(r => setTimeout(r, 100));
                  attempts++;
                }
              }
              // Paper 전체를 캡처 (헤더 + 테이블 모두 포함)
              captureTargetElement = paperElement;
            }
          } else if (csDetailTypes.length === 1 && csDetailTypes[0] !== 'all' && csDetailTypes[0] === 'office') {
            // 사무실별 실적: 헤더 + 테이블 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaper('🏢 사무실별 실적');
            if (!paperElement) {
              const errorMsg = '사무실별 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailTypes, slideId: currentSlide.slideId });
              }
              captureTargetElement = slideElement;
            } else {
              // 테이블이 렌더링될 때까지 대기 후 Paper 전체 캡처
              let table = null;
              let attempts = 0;
              while (!table && attempts < 20) {
                table = paperElement.querySelector('.MuiTableContainer-root');
                if (!table) {
                  await new Promise(r => setTimeout(r, 100));
                  attempts++;
                }
              }
              // Paper 전체를 캡처 (헤더 + 테이블 모두 포함)
              captureTargetElement = paperElement;
            }
          } else if (csDetailTypes.length === 1 && csDetailTypes[0] !== 'all' && csDetailTypes[0] === 'department') {
            // 소속별 실적: 헤더 + 테이블 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaper('👥 소속별 실적');
            if (!paperElement) {
              const errorMsg = '소속별 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailTypes, slideId: currentSlide.slideId });
              }
              captureTargetElement = slideElement;
            } else {
              // 테이블이 렌더링될 때까지 대기 후 Paper 전체 캡처
              let table = null;
              let attempts = 0;
              while (!table && attempts < 20) {
                table = paperElement.querySelector('.MuiTableContainer-root');
                if (!table) {
                  await new Promise(r => setTimeout(r, 100));
                  attempts++;
                }
              }
              // Paper 전체를 캡처 (헤더 + 테이블 모두 포함)
              captureTargetElement = paperElement;
            }
          } else if (csDetailTypes.length === 1 && csDetailTypes[0] !== 'all' && csDetailTypes[0] === 'agent') {
            // 담당자별 실적: 헤더 + 테이블 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaperArray(['🧑 담당자별 실적', '👤 담당자별 실적']);
            if (!paperElement) {
              const errorMsg = '담당자별 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailTypes, slideId: currentSlide.slideId });
              }
              captureTargetElement = slideElement;
            } else {
              // 테이블이 렌더링될 때까지 대기 후 Paper 전체 캡처
              let table = null;
              let attempts = 0;
              while (!table && attempts < 20) {
                table = paperElement.querySelector('.MuiTableContainer-root');
                if (!table) {
                  await new Promise(r => setTimeout(r, 100));
                  attempts++;
                }
              }
              // Paper 전체를 캡처 (헤더 + 테이블 모두 포함)
              captureTargetElement = paperElement;
            }
          } else {
            // 복수 선택 또는 all: 확장된 섹션들이 포함되도록 전체 슬라이드 캡처
            captureTargetElement = slideElement;
          }

          // 타겟 가시성/높이 확보까지 대기
          const ensureVisible = async (el) => {
            if (!el || !(el instanceof HTMLElement)) return;
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            const maxWait = 2000;
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              const rect = el.getBoundingClientRect();
              const hasSize = rect.height > 80 && rect.width > 200;
              const hasText = (el.textContent || '').trim().length > 0 || el.querySelector('table,tbody,tr');
              if (hasSize && hasText) break;
              await new Promise(r => setTimeout(r, 100));
            }
          };
          await ensureVisible(captureTargetElement);
        }

        // 지표장표 > 월간시상: '확대' 후 5개 테이블 모두 캡처 (슬라이드 헤더 포함)
        if (
          currentSlide?.mode === 'chart' &&
          (currentSlide?.tab === 'indicatorChart' || currentSlide?.subTab === 'monthlyAward')
        ) {
          // 이 부분은 캡처 타겟 선택에만 사용 (실제 캡처는 아래 compositeBlob 부분에서 처리)
          // captureTargetElement는 아래에서 설정하지 않음 (compositeBlob 사용)
        }

        // 재고장표: 테이블 컨테이너만 캡처 (로딩 화면 및 불필요한 부분 제외)
        if (
          (currentSlide?.mode === 'inventoryChart') ||
          (currentSlide?.mode === 'chart' && (currentSlide?.tab === 'inventoryChart' || currentSlide?.subTab === 'inventoryChart'))
        ) {
          let inventoryCompositeBlob = null;
          // 로딩 화면이 사라질 때까지 대기
          const maxWait = 10000; // 최대 10초 대기
          const start = Date.now();
          while (Date.now() - start < maxWait) {
            const loadingElements = slideElement.querySelectorAll('[data-capture-exclude="true"]');
            const hasLoading = Array.from(loadingElements).some(el => {
              const text = el.textContent || '';
              return text.includes('로딩') || text.includes('불러오는 중') || 
                     el.querySelector('.MuiCircularProgress-root') !== null;
            });
            if (!hasLoading) break;
            await new Promise(r => setTimeout(r, 200));
          }
          
          // 모든 '펼치기' 버튼 클릭
          Array.from(document.querySelectorAll('button, .MuiButton-root'))
            .filter(el => typeof el.textContent === 'string' && el.textContent.includes('펼치기'))
            .forEach(el => el.click());
          
          await new Promise(r => setTimeout(r, 500)); // 펼치기 후 렌더링 대기

          // 테이블 컨테이너 찾기 (data-capture-exclude가 없는 것만)
          let tableContainer = slideElement.querySelector('.MuiTableContainer-root');
          
          // data-capture-exclude가 있는 요소는 제외
          if (tableContainer) {
            let current = tableContainer;
            while (current && current !== slideElement) {
              if (current.getAttribute('data-capture-exclude') === 'true') {
                tableContainer = null;
                break;
              }
              current = current.parentElement;
            }
          }
          
          // 테이블 컨테이너를 찾지 못한 경우, 직접 찾기
          if (!tableContainer) {
            const allContainers = Array.from(slideElement.querySelectorAll('.MuiTableContainer-root'));
            tableContainer = allContainers.find(container => {
              // data-capture-exclude가 없는 컨테이너만 선택
              let current = container;
              while (current && current !== slideElement) {
                if (current.getAttribute('data-capture-exclude') === 'true') {
                  return false;
                }
                current = current.parentElement;
              }
              // "총계" 또는 테이블 데이터가 있는 컨테이너인지 확인
              const text = container.textContent || '';
              return text.includes('총계') || text.includes('모델명') || container.querySelector('table') !== null;
            });
          }
          
          if (tableContainer) {
            // 테이블의 실제 높이만큼만 캡처하기 위해 스타일 조정
            const originalMaxHeight = tableContainer.style.maxHeight;
            const originalOverflow = tableContainer.style.overflow;
            const originalHeight = tableContainer.style.height;
            
            // 스크롤을 없애고 전체 높이로 확장
            tableContainer.style.maxHeight = 'none';
            tableContainer.style.overflow = 'visible';
            tableContainer.style.height = 'auto';
            
            // 테이블 내부의 실제 높이 계산
            const table = tableContainer.querySelector('table');
            if (table) {
              // 테이블의 실제 높이 계산 (마지막 행까지)
              const tableRect = table.getBoundingClientRect();
              const lastRow = table.querySelector('tbody tr:last-child');
              if (lastRow) {
                const lastRowRect = lastRow.getBoundingClientRect();
                const tableTop = tableRect.top;
                const tableBottom = lastRowRect.bottom;
                const actualHeight = tableBottom - tableTop + 20; // 여유 공간 20px
                
                // 컨테이너 높이를 테이블 실제 높이로 설정
                tableContainer.style.height = `${actualHeight}px`;
              }
            }
            
            // 스타일 변경 후 렌더링 대기
            await new Promise(r => setTimeout(r, 500));
            
            // 테이블 상단으로 스크롤
            tableContainer.scrollIntoView({ block: 'start', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 300));
            
            // 1) 테이블만 우선 캡처
            let tableOnlyBlob = null;
            try {
              // 데이터가 실제 채워질 때까지 추가 대기 (최대 5초)
              try {
                const maxWait = 5000;
                const start = Date.now();
                let hasData = false;
                
                while (Date.now() - start < maxWait) {
                  // 가로 스크롤을 좌우로 움직여 가상 렌더링/고정열(sticky) 강제 갱신
                  const scrollable = tableContainer;
                  if (scrollable && typeof scrollable.scrollLeft === 'number') {
                    const original = scrollable.scrollLeft;
                    // 오른쪽 끝으로 스크롤하여 모든 컬럼 렌더링 유도
                    scrollable.scrollLeft = scrollable.scrollWidth;
                    await new Promise(r => setTimeout(r, 150));
                    // 왼쪽 끝으로 스크롤하여 구분 컬럼 노출
                    scrollable.scrollLeft = 0;
                    await new Promise(r => setTimeout(r, 300)); // 구분 컬럼 데이터 로딩 대기 시간 증가
                  }
                  
                  // 첫 번째 열(구분 컬럼)에 실제 데이터가 있는지 확인
                  const tbody = tableContainer.querySelector('tbody');
                  if (tbody) {
                    const firstRowCells = tbody.querySelectorAll('tr:first-child td');
                    const firstColumnHasData = Array.from(firstRowCells).some(cell => {
                      const text = (cell.textContent || '').trim();
                      // 제조사명이나 숫자가 있는지 확인
                      return text && (
                        text.includes('삼성') || 
                        text.includes('애플') || 
                        text.includes('LG') || 
                        text.includes('샤오미') ||
                        /^\d+$/.test(text) || // 숫자만 있는 경우
                        /[가-힣]/.test(text) // 한글이 있는 경우
                      );
                    });
                    
                    // 최소 행 수 확인 (10개 이상)
                    const rowCount = tbody.querySelectorAll('tr').length;
                    
                    // 첫 번째 열에 데이터가 있고, 최소 10개 행이 있으면 로드 완료
                    if (firstColumnHasData && rowCount >= 10) {
                      hasData = true;
                      // 한 번 더 스크롤하여 모든 데이터 렌더링 보장
                      if (scrollable && typeof scrollable.scrollLeft === 'number') {
                        scrollable.scrollLeft = scrollable.scrollWidth;
                        await new Promise(r => setTimeout(r, 100));
                        scrollable.scrollLeft = 0;
                        await new Promise(r => setTimeout(r, 200));
                      }
                      break;
                    }
                  }
                  
                  await new Promise(r => setTimeout(r, 300));
                }
                
                if (!hasData && process.env.NODE_ENV === 'development') {
                  console.warn('⚠️ [MeetingCaptureManager] 재고장표 구분 컬럼 데이터 로딩 시간 초과');
                }
              } catch (e) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('⚠️ [MeetingCaptureManager] 재고장표 데이터 로딩 확인 중 오류:', e);
                }
              }

              tableOnlyBlob = await captureElement(tableContainer, {
                scale: 2,
                useCORS: true,
                fixedBottomPaddingPx: 0,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0
              });
            } catch (e) {
              // 실패 시 fallback 으로 테이블 컨테이너를 최종 타겟으로 사용
              captureTargetElement = tableContainer;
            }
            
            // 2) 슬라이드 상단 헤더 캡처 시도 (회사 로고/이름 + 경로 타이틀)
            let headerBlob = null;
            try {
              let headerElement = null;
              const allElements = Array.from(slideElement.querySelectorAll('*'));
              for (const el of allElements) {
                const style = window.getComputedStyle(el);
                const text = (el.textContent || '').trim();
                if (style.position === 'absolute' &&
                    (parseInt(style.top) === 0 || style.top === '0px') &&
                    text.includes('(주)브이아이피플러스')) {
                  headerElement = el;
                  break;
                }
              }
              if (!headerElement) {
                for (const child of Array.from(slideElement.children)) {
                  const style = window.getComputedStyle(child);
                  const text = (child.textContent || '').trim();
                  if (style.position === 'absolute' &&
                      (parseInt(style.top) === 0 || style.top === '0px') &&
                      text.includes('(주)브이아이피플러스')) {
                    headerElement = child;
                    break;
                  }
                }
              }
              if (headerElement) {
                headerElement.scrollIntoView({ block: 'start', behavior: 'instant' });
                await new Promise(r => setTimeout(r, 200));
                headerBlob = await captureElement(headerElement, {
                  scale: 2,
                  useCORS: true,
                  fixedBottomPaddingPx: 0,
                  backgroundColor: 'transparent',
                  scrollX: 0,
                  scrollY: 0
                });
              }
            } catch (_) {}
            
            // 3) 헤더 + 테이블 합성 (가능 시)
            try {
              if (headerBlob && tableOnlyBlob) {
                const blobToImage = (blob) => new Promise((resolve, reject) => {
                  const url = URL.createObjectURL(blob);
                  const img = new Image();
                  img.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve(img);
                  };
                  img.onerror = reject;
                  img.src = url;
                });
                const imgHeader = await blobToImage(headerBlob);
                const imgTable = await blobToImage(tableOnlyBlob);
                const gap = 8;
                const extraBottom = 96; // 요청된 얇은 하단 여백
                // 캔버스 너비는 헤더와 테이블 중 더 넓은 것을 기준으로 하되, 최소 1280px
                const BASE_CAPTURE_WIDTH = 1280;
                const canvasWidth = Math.max(BASE_CAPTURE_WIDTH, Math.max(imgHeader.width, imgTable.width));
                const canvas = document.createElement('canvas');
                canvas.width = canvasWidth;
                canvas.height = imgHeader.height + gap + imgTable.height + extraBottom;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // 헤더는 좌측 정렬 (보통 전체 폭)
                ctx.drawImage(imgHeader, 0, 0);
                // 테이블을 수평 중앙 정렬 (캔버스 너비 기준)
                // 테이블이 캔버스보다 넓은 경우에도 중앙 정렬 유지
                const tableX = Math.max(0, Math.floor((canvasWidth - imgTable.width) / 2));
                // 테이블이 캔버스보다 넓으면 캔버스 너비로 제한하지 않고 그대로 중앙 정렬
                ctx.drawImage(imgTable, tableX, imgHeader.height + gap);
                inventoryCompositeBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
              } else if (tableOnlyBlob) {
                // 헤더를 못 찾으면 테이블만 사용
                inventoryCompositeBlob = tableOnlyBlob;
              }
            } catch (_) {
              // 합성 실패 시 테이블만 캡처 대상으로
              captureTargetElement = tableContainer;
            }
            
            // 합성이 성공했으면 이후 최종 업로드 단계에서 사용
            if (inventoryCompositeBlob) {
              // 업로드 단계에서 사용하기 위해 임시 저장
              slideElement.__inventoryCompositeBlob = inventoryCompositeBlob;
            } else {
              captureTargetElement = tableContainer;
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [MeetingCaptureManager] 재고장표 테이블 컨테이너 캡처 준비 완료');
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 재고장표 테이블 컨테이너를 찾을 수 없습니다.');
            }
          }
        }

        // 채권장표 > 재초담초채권: 저장 시점 콤보박스를 최신 시점으로 자동 선택
        if (
          currentSlide?.mode === 'chart' &&
          (currentSlide?.tab === 'bondChart' || currentSlide?.tab === 'bond') &&
          (currentSlide?.subTab === 'rechotanchoBond')
        ) {
          let selectedTimestampText = '';
          const desiredTs = (currentSlide?.detailOptions?.bondHistoryTimestamp || '').trim();
          
          // 선 그래프를 렌더링하기 위해 "조회 월 선택" Paper가 있는지 확인
          // 없으면 allData가 로드되지 않았을 수 있으므로 추가 대기
          const checkLineChartPaper = () => {
            const papers = slideElement.querySelectorAll('.MuiPaper-root');
            return Array.from(papers).find(p => {
              const text = p.textContent || '';
              return text.includes('조회 월 선택');
            });
          };
          
          // 선 그래프 Paper가 없으면 allData 로드를 기다림 (최대 5초)
          if (!checkLineChartPaper()) {
            let waitCount = 0;
            while (!checkLineChartPaper() && waitCount < 25) {
              await new Promise(r => setTimeout(r, 200));
              waitCount++;
            }
          }
          
          // 선 그래프 Paper 내부에 실제 차트가 렌더링되었는지 확인
          const checkLineChartRendered = () => {
            const linePaper = checkLineChartPaper();
            if (!linePaper) return false;
            // Line 차트는 보통 canvas나 svg로 렌더링됨
            const chart = linePaper.querySelector('canvas, svg, [class*="recharts"], [class*="Line"]');
            return !!chart;
          };
          
          // 선 그래프가 실제로 렌더링될 때까지 대기 (최대 3초)
          if (checkLineChartPaper() && !checkLineChartRendered()) {
            let waitCount = 0;
            while (!checkLineChartRendered() && waitCount < 15) {
              await new Promise(r => setTimeout(r, 200));
              waitCount++;
            }
          }
          
          // 콤보박스 열기
          const combo = Array.from(document.querySelectorAll('[role="combobox"], .MuiSelect-select'))
            .find(el => {
              // 주변 텍스트에 '저장 시점' 문구가 있는지 대략적으로 판단
              const parentText = (el.closest('.MuiFormControl-root')?.textContent || '') + (el.parentElement?.textContent || '');
              return parentText.includes('저장 시점') || parentText.includes('저장 시점 선택');
            }) || document.querySelector('[aria-haspopup="listbox"]');
          if (combo) {
            (combo instanceof HTMLElement) && combo.click();
            await new Promise(r => setTimeout(r, 200));
            const listbox = document.querySelector('[role="listbox"]');
            let targetOption = null;
            if (desiredTs && listbox) {
              targetOption = Array.from(listbox.querySelectorAll('[role="option"]'))
                .find(opt => (opt.textContent || '').includes(desiredTs));
            }
            if (!targetOption) {
              targetOption = document.querySelector('[role="listbox"] [role="option"]');
            }
            if (targetOption && targetOption instanceof HTMLElement) {
              selectedTimestampText = (targetOption.textContent || '').trim();
              targetOption.click();
              await new Promise(r => setTimeout(r, 800)); // 데이터 갱신 대기
            }
          }
          // 이 화면은 상단 그래프 2개 + 하단 입력 테이블 모두 포함해야 하므로 슬라이드 전체 캡쳐 유지
          // 하지만 그래프와 테이블의 크기를 맞추기 위해 임시로 스타일 조정
          try {
            // 그래프 Paper와 테이블 Paper 찾기
            const allPapers = Array.from(slideElement.querySelectorAll('.MuiPaper-root'));
            const barPaper = allPapers.find(p => (p.textContent || '').includes('대리점별 채권 현황') || (p.textContent || '').includes('대리점별 현재 채권 현황'));
            const linePaper = allPapers.find(p => (p.textContent || '').includes('조회 월 선택'));
            const tablePaper = allPapers.find(p => (p.textContent || '').includes('데이터 입력') || (p.querySelector('table')));
            
            // 통일된 너비 결정 (최소 1200px)
            const targetWidth = 1200;
            
            // 막대 그래프 크기 조정 (선 그래프와 동일한 방식으로 단순화)
            if (barPaper) {
              const barCanvas = barPaper.querySelector('canvas');
              const barRect = barPaper.getBoundingClientRect();
              const originalBarStyle = {
                width: barPaper.style.width,
                minWidth: barPaper.style.minWidth,
                maxWidth: barPaper.style.maxWidth
              };
              
              // Paper 너비 조정 (선 그래프와 동일)
              barPaper.style.width = `${targetWidth}px`;
              barPaper.style.minWidth = `${targetWidth}px`;
              barPaper.style.maxWidth = 'none';
              
              // canvas가 있으면 높이도 조정 (선 그래프와 동일한 방식)
              if (barCanvas) {
                const canvasBox = barCanvas.closest('[style*="height"]') || barPaper.querySelector('[style*="height"]');
                if (canvasBox) {
                  canvasBox.style.height = '400px';
                  canvasBox.style.minHeight = '400px';
                }
              }
            }
            
            // 선 그래프 크기 조정
            if (linePaper) {
              const lineCanvas = linePaper.querySelector('canvas');
              const lineRect = linePaper.getBoundingClientRect();
              const originalLineStyle = {
                width: linePaper.style.width,
                minWidth: linePaper.style.minWidth,
                maxWidth: linePaper.style.maxWidth
              };
              
              linePaper.style.width = `${targetWidth}px`;
              linePaper.style.minWidth = `${targetWidth}px`;
              linePaper.style.maxWidth = 'none';
              
              // canvas가 있으면 높이도 조정
              if (lineCanvas) {
                const canvasBox = lineCanvas.closest('[style*="height"]') || linePaper.querySelector('[style*="height"]');
                if (canvasBox) {
                  canvasBox.style.height = '500px';
                  canvasBox.style.minHeight = '500px';
                }
              }
            }
            
            // 테이블 크기 조정
            if (tablePaper) {
              const originalTableStyle = {
                width: tablePaper.style.width,
                minWidth: tablePaper.style.minWidth,
                maxWidth: tablePaper.style.maxWidth
              };
              
              tablePaper.style.width = `${targetWidth}px`;
              tablePaper.style.minWidth = `${targetWidth}px`;
              tablePaper.style.maxWidth = 'none';
              
              // 테이블 컨테이너도 조정
              const tableContainer = tablePaper.querySelector('.MuiTableContainer-root, table');
              if (tableContainer) {
                const originalTableContainerStyle = {
                  width: tableContainer.style.width,
                  minWidth: tableContainer.style.minWidth,
                  maxWidth: tableContainer.style.maxWidth
                };
                tableContainer.style.width = '100%';
                tableContainer.style.minWidth = `${targetWidth}px`;
                tableContainer.style.maxWidth = 'none';
              }
            }
            
            // 크기 조정 후 렌더링 대기 (Chart.js가 재렌더링할 시간)
            await new Promise(r => setTimeout(r, 500));
            
            // window resize 이벤트를 한 번 더 트리거하여 모든 차트가 재렌더링되도록
            window.dispatchEvent(new Event('resize'));
            
            // 추가 렌더링 대기
            await new Promise(r => setTimeout(r, 800));
            
            // 캡처 후 원래 스타일 복원을 위한 참조 저장
            slideElement.__restoreStyles = () => {
              if (barPaper) {
                barPaper.style.width = originalBarStyle.width;
                barPaper.style.minWidth = originalBarStyle.minWidth;
                barPaper.style.maxWidth = originalBarStyle.maxWidth;
                
                // canvas 스타일 복원
                const barCanvas = barPaper.querySelector('canvas');
                if (barCanvas && barPaper.__originalCanvasStyle) {
                  barCanvas.style.width = barPaper.__originalCanvasStyle.width || '';
                  barCanvas.style.height = barPaper.__originalCanvasStyle.height || '';
                  barCanvas.style.minWidth = barPaper.__originalCanvasStyle.minWidth || '';
                  barCanvas.style.maxWidth = barPaper.__originalCanvasStyle.maxWidth || '';
                  
                  // 원본 픽셀 크기도 복원
                  if (barPaper.__originalCanvasWidth) {
                    barCanvas.width = barPaper.__originalCanvasWidth;
                  }
                  if (barPaper.__originalCanvasHeight) {
                    barCanvas.height = barPaper.__originalCanvasHeight;
                  }
                  
                  delete barPaper.__originalCanvasStyle;
                  delete barPaper.__originalCanvasWidth;
                  delete barPaper.__originalCanvasHeight;
                }
              }
              if (linePaper) {
                linePaper.style.width = originalLineStyle.width;
                linePaper.style.minWidth = originalLineStyle.minWidth;
                linePaper.style.maxWidth = originalLineStyle.maxWidth;
              }
              if (tablePaper) {
                tablePaper.style.width = originalTableStyle.width;
                tablePaper.style.minWidth = originalTableStyle.minWidth;
                tablePaper.style.maxWidth = originalTableStyle.maxWidth;
              }
            };
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 재초담초채권 크기 조정 중 경고:', e?.message);
            }
          }
          
          captureTargetElement = slideElement;

          // 우상단 배지로 선택된 시점 표시 (캡쳐에 포함되도록 임시로 DOM 추가)
          try {
            if (selectedTimestampText) {
              slideElement.style.position = slideElement.style.position || 'relative';
              var tsBadge = document.createElement('div');
              tsBadge.textContent = `저장 시점: ${selectedTimestampText}`;
              tsBadge.style.position = 'absolute';
              tsBadge.style.top = '8px';
              tsBadge.style.right = '16px';
              tsBadge.style.background = 'rgba(0,0,0,0.6)';
              tsBadge.style.color = '#fff';
              tsBadge.style.padding = '6px 10px';
              tsBadge.style.borderRadius = '8px';
              tsBadge.style.fontSize = '12px';
              tsBadge.style.fontWeight = '700';
              tsBadge.style.zIndex = '20';
              tsBadge.style.pointerEvents = 'none';
              slideElement.appendChild(tsBadge);
              // 캡쳐 후 제거를 위해 참조 보관
              captureTargetElement.__tempTsBadge = tsBadge;
            }
          } catch (e) {
            console.warn('⚠️ [MeetingCaptureManager] 시점 배지 표시 중 경고:', e?.message);
          }

          // 그래프 2개가 모두 렌더링될 때까지 대기 (최대 7초)
          // 막대 그래프(Bar)와 선 그래프(Line) 모두 포함
          // 그래프가 잘리지 않았는지 확인 (너비와 높이가 0이 아닌지)
          try {
            const maxWait = 7000; // 대기 시간 증가 (5초 → 7초)
            const start = Date.now();
            let chartCount = 0;
            let barChartFound = false;
            let lineChartFound = false;
            let barChartValid = false;
            let lineChartValid = false;
            
            while (Date.now() - start < maxWait) {
              // 모든 차트 요소 찾기 (canvas, svg, recharts)
              const charts = slideElement.querySelectorAll('canvas, svg, [class*="recharts"], [class*="Chart"]');
              chartCount = charts.length;
              
              // 막대 그래프 확인 (첫 번째 Paper에 있음)
              const papers = slideElement.querySelectorAll('.MuiPaper-root');
              for (const paper of papers) {
                const paperText = paper.textContent || '';
                // 막대 그래프는 "대리점별 채권 현황" 텍스트가 있는 Paper에 있음
                if (paperText.includes('대리점별 채권 현황') || paperText.includes('대리점별 현재 채권 현황')) {
                  const barChart = paper.querySelector('canvas, svg, [class*="recharts"], [class*="Bar"]');
                  if (barChart) {
                    barChartFound = true;
                    // 그래프가 잘리지 않았는지 확인 (너비와 높이가 0이 아닌지)
                    const rect = barChart.getBoundingClientRect();
                    barChartValid = rect.width > 100 && rect.height > 100;
                  }
                }
                // 선 그래프 확인 (Line 차트는 "조회 월 선택" 텍스트가 있는 Paper에 있음)
                if (paperText.includes('조회 월 선택')) {
                  const lineChart = paper.querySelector('canvas, svg, [class*="recharts"], [class*="Line"]');
                  if (lineChart) {
                    lineChartFound = true;
                    // 그래프가 잘리지 않았는지 확인 (너비와 높이가 0이 아닌지)
                    const rect = lineChart.getBoundingClientRect();
                    lineChartValid = rect.width > 100 && rect.height > 100;
                  }
                }
              }
              
              // 막대 그래프와 선 그래프가 모두 렌더링되었고, 잘리지 않았는지 확인
              if (barChartFound && lineChartFound && barChartValid && lineChartValid && chartCount >= 2) {
                if (process.env.NODE_ENV === 'development') {
                  console.log('✅ [MeetingCaptureManager] 재초담초채권 그래프 모두 렌더링 완료 (잘림 없음)');
                }
                break;
              }
              
              // 선 그래프 Paper로 스크롤하여 강제 렌더링 유도
              if (!lineChartFound || !lineChartValid) {
                try { 
                  const linePaper = Array.from(papers).find(p => (p.textContent || '').includes('조회 월 선택'));
                  if (linePaper) {
                    linePaper.scrollIntoView({ block: 'center', behavior: 'instant' });
                    // 스크롤 후 잠시 대기
                    await new Promise(r => setTimeout(r, 300));
                  }
                } catch {}
              }
              
              // 막대 그래프 Paper로 스크롤하여 강제 렌더링 유도
              if (!barChartFound || !barChartValid) {
                try {
                  const barPaper = Array.from(papers).find(p => 
                    (p.textContent || '').includes('대리점별 채권 현황') || 
                    (p.textContent || '').includes('대리점별 현재 채권 현황')
                  );
                  if (barPaper) {
                    barPaper.scrollIntoView({ block: 'center', behavior: 'instant' });
                    await new Promise(r => setTimeout(r, 300));
                  }
                } catch {}
              }
              
              await new Promise(r => setTimeout(r, 200));
            }
            
            // 최종 확인: 그래프가 없거나 잘렸으면 추가 대기 및 경고
            if (!barChartFound || !barChartValid || !lineChartFound || !lineChartValid) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ [MeetingCaptureManager] 재초담초채권 그래프 렌더링 문제:', {
                  barChartFound,
                  barChartValid,
                  lineChartFound,
                  lineChartValid
                });
              }
              // 모든 Paper로 스크롤하고 추가 대기
              const papers = slideElement.querySelectorAll('.MuiPaper-root');
              for (const paper of papers) {
                paper.scrollIntoView({ block: 'center', behavior: 'instant' });
                await new Promise(r => setTimeout(r, 200));
              }
              await new Promise(r => setTimeout(r, 1000));
            }
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 재초담초채권 그래프 대기 중 경고:', e?.message);
            }
          }
        }

        // 채권장표 > 가입자증감: '년단위' 토글 + 2025년 우선 선택 (없으면 최신) (이 부분은 캡처 타겟 선택에만 사용)
        if (
          currentSlide?.mode === 'chart' &&
          (currentSlide?.tab === 'bondChart' || currentSlide?.tab === 'bond') &&
          (currentSlide?.subTab === 'subscriberIncrease')
        ) {
          // 선택 옵션 반영
          const desiredPeriod = (currentSlide?.detailOptions?.subscriberPeriod || 'year').toLowerCase();
          const desiredYear = (currentSlide?.detailOptions?.targetYear || '').trim();

          // 1) 표시 단위 토글 보장 (년단위/월단위)
          try {
            const findYearToggle = () => {
              const cands = Array.from(document.querySelectorAll('button, [role="button"], .MuiToggleButton-root, .MuiTab-root'));
              return cands.find(el => {
                const t = (el.textContent || '').trim();
                return t.includes('년단위') || t.includes('년 단위') || t.includes('연단위');
              });
            };
            const yearBtn = findYearToggle();
            if (yearBtn) {
              const pressed = yearBtn.getAttribute('aria-pressed');
              // 년단위가 목표일 때는 눌린 상태가 되도록, 월단위가 목표면 꺼지도록
              const shouldBePressed = desiredPeriod === 'year';
              if ((shouldBePressed && pressed !== 'true') || (!shouldBePressed && pressed === 'true')) {
                (yearBtn instanceof HTMLElement) && yearBtn.click();
                await new Promise(r => setTimeout(r, 500));
              }
            } else {
              const fallback = Array.from(document.querySelectorAll('*')).find(el => (el.textContent || '').includes('년단위'));
              if (fallback && fallback instanceof HTMLElement) {
                fallback.click();
                await new Promise(r => setTimeout(r, 500));
              }
            }
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 년단위 토글 중 경고:', e?.message);
            }
          }
          
          // 2) 대상 년도 선택 (사용자 지정 > 2025 우선 > 최신)
          let selectedYearText = '';
          try {
            // "대상 년도:" 텍스트를 찾고 그 근처의 Select 찾기
            const allTexts = Array.from(document.querySelectorAll('*'));
            const targetYearLabel = allTexts.find(el => {
              const text = el.textContent || '';
              return text.includes('대상 년도') || text.includes('대상년도');
            });
            
            if (targetYearLabel) {
              // Label 근처의 Select 찾기
              let selectElement = null;
              let current = targetYearLabel.parentElement;
              let attempts = 0;
              while (current && attempts < 5) {
                const select = current.querySelector('[role="combobox"], .MuiSelect-select, select');
                if (select) {
                  selectElement = select;
                  break;
                }
                current = current.parentElement;
                attempts++;
              }
              
              // 직접 찾기 시도
              if (!selectElement) {
                // 1순위: 가입자증감 화면 내부의 printable-content 컨테이너 기준으로 검색
                const printable = document.querySelector('#printable-content');
                if (printable) {
                  selectElement = printable.querySelector('div[role="combobox"][aria-haspopup="listbox"], .MuiSelect-select[role="combobox"]');
                }
                // 2순위: 화면 전체에서 combobox / MuiSelect-select 검색
                if (!selectElement) {
                  selectElement = Array.from(document.querySelectorAll('[role="combobox"], .MuiSelect-select, select'))
                    .find(el => {
                      const parentText = (el.closest('.MuiFormControl-root')?.textContent || '') + 
                                       (el.parentElement?.textContent || '');
                      return parentText.includes('대상') && parentText.includes('년도');
                    });
                }
              }
              
              if (selectElement && selectElement instanceof HTMLElement) {
                selectElement.click();
                await new Promise(r => setTimeout(r, 300));
                
                // 2025년 우선 선택, 없으면 최신(첫 번째)
                const listbox = document.querySelector('[role="listbox"]');
                if (listbox) {
                  const options = Array.from(listbox.querySelectorAll('[role="option"], li, div'));
                  let targetOpt = null;
                  if (desiredYear && /\d{4}/.test(desiredYear)) {
                    targetOpt = options.find(opt => (opt.textContent || '').includes(desiredYear));
                  }
                  if (!targetOpt) {
                    targetOpt = options.find(opt => (opt.textContent || '').includes('2025'));
                  }
                  if (!targetOpt) targetOpt = options[0];
                  if (targetOpt && targetOpt instanceof HTMLElement) {
                    selectedYearText = (targetOpt.textContent || '').trim();
                    targetOpt.click();
                    await new Promise(r => setTimeout(r, 1000)); // 데이터 로드 대기
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`✅ [MeetingCaptureManager] 가입자증감 연도 선택 완료: ${selectedYearText}`);
                    }
                  }
                } else if (selectElement.tagName.toLowerCase() === 'select') {
                  const opts = Array.from(selectElement.querySelectorAll('option'));
                  let target = null;
                  if (desiredYear && /\d{4}/.test(desiredYear)) {
                    target = opts.find(o => (o.textContent || '').includes(desiredYear));
                  }
                  if (!target) target = opts.find(o => (o.textContent || '').includes('2025'));
                  if (!target) target = opts[0];
                  if (target) {
                    selectElement.value = target.value;
                    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                    selectedYearText = (target.textContent || '').trim();
                    await new Promise(r => setTimeout(r, 1000));
                  }
                }
              } else {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('⚠️ [MeetingCaptureManager] 대상 년도 Select를 찾을 수 없습니다.');
                }
              }
            }
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 연도 선택 중 경고:', e?.message);
            }
          }

          // 3) 페이지 텍스트에 선택 연도(또는 2025)가 나타날 때까지 대기
          try {
            const want = (selectedYearText && /\d{4}/.test(selectedYearText))
              ? selectedYearText.match(/\d{4}/)[0]
              : ((desiredYear && /\d{4}/.test(desiredYear)) ? desiredYear.match(/\d{4}/)[0] : '2025');
            const maxWait = 4000;
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              const pageText = (document.body.textContent || '').replace(/\s+/g, ' ');
              if (pageText.includes(want)) break;
              await new Promise(r => setTimeout(r, 200));
            }
          } catch {}

          // 선택된 단위/연도 배지를 우상단에 임시 표시(캡쳐 포함)
          try {
            slideElement.style.position = slideElement.style.position || 'relative';
            const badge = document.createElement('div');
            const yearText = (selectedYearText && /\d{4}/.test(selectedYearText))
              ? selectedYearText.match(/\d{4}/)[0]
              : (desiredYear || '');
            badge.textContent = `${desiredPeriod === 'year' ? '년단위' : '월단위'}${yearText ? ` • ${yearText}` : ''}`;
            badge.style.position = 'absolute';
            badge.style.top = '8px';
            badge.style.right = '16px';
            badge.style.background = 'rgba(0,0,0,0.6)';
            badge.style.color = '#fff';
            badge.style.padding = '6px 10px';
            badge.style.borderRadius = '8px';
            badge.style.fontSize = '12px';
            badge.style.fontWeight = '700';
            badge.style.zIndex = '20';
            badge.style.pointerEvents = 'none';
            slideElement.appendChild(badge);
            captureTargetElement.__tempYearBadge = badge;
          } catch {}
          
          // 이 부분은 캡처 타겟 선택에만 사용 (실제 캡처는 아래 compositeBlob 부분에서 처리)
          // captureTargetElement는 아래에서 설정하지 않음 (compositeBlob 사용)
        }
      } catch (e) {
        console.warn('⚠️ [MeetingCaptureManager] 상세옵션 타겟 선택 중 경고:', e?.message);
      }

      // 재고장표 특수 처리: 위에서 헤더+테이블 합성 결과가 있으면 사용
      let inventoryCompositeBlob = slideElement && slideElement.__inventoryCompositeBlob ? slideElement.__inventoryCompositeBlob : null;

      // 지표장표 > 월간시상: 확대 후 5개 테이블 모두 캡처 (슬라이드 헤더 포함)
      let monthlyAwardCompositeBlob = null;
      if (
        currentSlide?.mode === 'chart' &&
        (currentSlide?.tab === 'indicatorChart' || currentSlide?.subTab === 'monthlyAward')
      ) {
        try {
          // 1) 확대 버튼 클릭
          const expandBtn = Array.from(document.querySelectorAll('button, .MuiButton-root')).find(
            (el) => typeof el.textContent === 'string' && el.textContent.trim() === '확대'
          );
          if (expandBtn) {
            expandBtn.click();
            await new Promise(r => setTimeout(r, 800)); // 확대 후 렌더링 대기
          }
          
          const blobToImage = (blob) => new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve(img);
            };
            img.onerror = (e) => reject(e);
            img.src = url;
          });
          
          // 2) 5개 테이블 찾기
          const allElements = Array.from(slideElement.querySelectorAll('.MuiPaper-root, .MuiBox-root'));
          
          // Paper 1: "월간시상 현황 확대 셋팅" (상단 통계)
          const statsPaper = allElements.find(el => {
            const text = el.textContent || '';
            return text.includes('월간시상 현황') && 
                   text.includes('확대') &&
                   (text.includes('셋팅') || text.includes('업셀기변') || text.includes('기변105이상'));
          });
          
          // Paper 2: "월간시상 Matrix 만점기준" (매트릭스 테이블)
          const matrixPaper = allElements.find(el => {
            const text = el.textContent || '';
            return (text.includes('월간시상 Matrix') || text.includes('만점기준')) && 
                   text.includes('총점') && 
                   text.includes('달성상황');
          });
          
          // Box 3: "채널별 성과 현황 축소" (채널별 테이블)
          const channelBox = allElements.find(el => {
            const text = el.textContent || '';
            return text.includes('채널별 성과 현황') && text.includes('축소');
          });
          
          // Box 4: "사무실별 성과 현황 축소" (사무실별 테이블)
          const officeBox = allElements.find(el => {
            const text = el.textContent || '';
            return text.includes('사무실별 성과 현황') && text.includes('축소');
          });
          
          // Box 5: "소속별 성과 현황 축소" (소속별 테이블)
          const departmentBox = allElements.find(el => {
            const text = el.textContent || '';
            return text.includes('소속별 성과 현황') && text.includes('축소');
          });
          
          const tables = [statsPaper, matrixPaper, channelBox, officeBox, departmentBox].filter(Boolean);
          
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 [MeetingCaptureManager] 월간시상 테이블 찾기:', {
              statsPaper: !!statsPaper,
              matrixPaper: !!matrixPaper,
              channelBox: !!channelBox,
              officeBox: !!officeBox,
              departmentBox: !!departmentBox,
              tablesFound: tables.length,
              allElementsCount: allElements.length
            });
          }
          
          // 테이블을 찾지 못했거나, commonAncestor를 찾지 못한 경우 slideElement 전체를 캡처
          let commonAncestor = slideElement; // 기본값: 전체 슬라이드
          
          if (tables.length > 0) {
            // 5개 테이블의 공통 조상을 찾아서 슬라이드 헤더 포함
            const findCommonAncestor = (elements) => {
              if (!elements || elements.length === 0) return null;
              const getAncestors = (el) => {
                const list = [];
                let cur = el;
                while (cur) { list.push(cur); cur = cur.parentElement; }
                return list;
              };
              let common = getAncestors(elements[0]);
              for (let i = 1; i < elements.length; i++) {
                const ancestors = new Set(getAncestors(elements[i]));
                common = common.filter(a => ancestors.has(a));
              }
              // slideElement 내부의 가장 가까운 공통 조상 선택 (슬라이드 헤더 포함)
              return common.find(el => el !== document.body && slideElement.contains(el)) || slideElement;
            };
            
            const foundAncestor = findCommonAncestor(tables);
            
            if (process.env.NODE_ENV === 'development') {
              console.log('🔍 [MeetingCaptureManager] 월간시상 commonAncestor 찾기:', {
                commonAncestor: foundAncestor ? '찾음' : '없음',
                isSlideElement: foundAncestor === slideElement,
                tablesFound: tables.length,
                tables: tables.map(t => t?.textContent?.substring(0, 50))
              });
            }
            
            // commonAncestor를 찾았으면 사용, 없으면 slideElement 사용
            if (foundAncestor) {
              commonAncestor = foundAncestor;
            }
          }
          
          // commonAncestor가 있으면 캡처 진행 (slideElement이든 아니든)
          if (commonAncestor) {
            // 공통 조상이 있으면 전체를 한 번에 캡처 (슬라이드 헤더 포함)
            commonAncestor.scrollIntoView({ block: 'start', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 500));
            
            // 실제 콘텐츠 높이 측정 (모든 자식 요소의 최대 bottom 위치 확인)
            const rect = commonAncestor.getBoundingClientRect();
            const allChildren = commonAncestor.querySelectorAll('*');
            let maxRelativeBottom = 0;
            let actualContentHeight = commonAncestor.scrollHeight || rect.height;
            
            // 모든 자식 요소의 실제 렌더링 위치 확인
            for (const child of allChildren) {
              const childRect = child.getBoundingClientRect();
              const relativeBottom = childRect.bottom - rect.top;
              if (relativeBottom > 0 && relativeBottom < actualContentHeight * 3) {
                maxRelativeBottom = Math.max(maxRelativeBottom, relativeBottom);
              }
            }
            
            // 실제 콘텐츠 높이에 맞춰서 설정 (불필요한 여백 제거)
            // scrollHeight와 실제 렌더링된 최대 위치 중 작은 값 사용 (불필요한 여백 제거)
            const measuredHeight = Math.min(
              Math.max(maxRelativeBottom + 20, actualContentHeight), // 최소 20px 여유공간
              actualContentHeight * 1.1 // scrollHeight의 110%를 넘지 않도록 제한
            );
            
            // 요소의 높이를 실제 콘텐츠 높이로 제한하여 불필요한 여백 제거
            const originalHeight = commonAncestor.style.height;
            const originalMaxHeight = commonAncestor.style.maxHeight;
            commonAncestor.style.height = `${measuredHeight}px`;
            commonAncestor.style.maxHeight = `${measuredHeight}px`;
            commonAncestor.style.overflow = 'visible';
            
            await new Promise(r => setTimeout(r, 300)); // 스타일 변경 후 렌더링 대기
            
            monthlyAwardCompositeBlob = await captureElement(commonAncestor, {
              scale: 2,
              useCORS: true,
              fixedBottomPaddingPx: 0, // 핑크 바 제거
              backgroundColor: '#ffffff',
              scrollX: 0,
              scrollY: 0,
              skipAutoCrop: true, // 크롭 로직 제거 (실제 높이로만 캡처)
              height: measuredHeight * 2 // scale 고려
            });
            
            // 원본 스타일 복원
            if (originalHeight) {
              commonAncestor.style.height = originalHeight;
            } else {
              commonAncestor.style.removeProperty('height');
            }
            if (originalMaxHeight) {
              commonAncestor.style.maxHeight = originalMaxHeight;
            } else {
              commonAncestor.style.removeProperty('max-height');
            }
            commonAncestor.style.removeProperty('overflow');
            
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [MeetingCaptureManager] 월간시상 전체 영역 캡처 완료 (슬라이드 헤더 포함)');
            }
          } else if (tables.length > 0) {
            // commonAncestor를 찾지 못했지만 테이블이 있는 경우, 각 테이블을 개별 캡처 후 합치기
            const tableBlobs = [];
            
            // 각 테이블을 순서대로 캡처
            for (let i = 0; i < tables.length; i++) {
              const table = tables[i];
              if (table) {
                table.scrollIntoView({ block: 'center', behavior: 'instant' });
                await new Promise(r => setTimeout(r, 400));
                
                const blob = await captureElement(table, {
                  scale: 2,
                  useCORS: true,
                  fixedBottomPaddingPx: 0, // 핑크 바 제거
                  backgroundColor: '#ffffff',
                  scrollX: 0,
                  scrollY: 0,
                  skipAutoCrop: false // 크롭 로직 사용 (일정 하단 여유공간 제외하고 크롭)
                });
                tableBlobs.push(blob);
                
                if (process.env.NODE_ENV === 'development') {
                  console.log(`✅ [MeetingCaptureManager] 월간시상 테이블 ${i + 1}/${tables.length} 캡처 완료`);
                }
              }
            }
            
            // 모든 테이블을 세로로 합치기
            if (tableBlobs.length > 0) {
              const images = await Promise.all(tableBlobs.map(blobToImage));
              const gap = 16;
              
              let totalHeight = images.reduce((sum, img) => sum + img.height, 0) + (gap * (images.length - 1));
              let maxWidth = Math.max(...images.map(img => img.width));
              
              const canvas = document.createElement('canvas');
              canvas.width = maxWidth;
              canvas.height = totalHeight;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              let currentY = 0;
              images.forEach((img, index) => {
                ctx.drawImage(img, 0, currentY);
                currentY += img.height + gap;
              });
              
              monthlyAwardCompositeBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
              
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [MeetingCaptureManager] 월간시상 ${tables.length}개 테이블 합성 완료`);
              }
            }
          } else {
            // commonAncestor도 없고 테이블도 없는 경우 경고
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 월간시상: commonAncestor와 테이블을 모두 찾지 못했습니다.');
            }
          }
        } catch (e) {
          console.error('❌ [MeetingCaptureManager] 월간시상 캡처 실패:', e);
        }
      }

      // 가입자증감(특수): 숫자형식 테이블 + 그래프형식 그래프 2개를 각각 캡처 후 합치기 (헤더/필터 제외)
      let compositeBlob = null;
      if (
        currentSlide?.mode === 'chart' &&
        (currentSlide?.tab === 'bondChart' || currentSlide?.tab === 'bond') &&
        (currentSlide?.subTab === 'subscriberIncrease')
      ) {
        try {
          const blobToImage = (blob) => new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve(img);
            };
            img.onerror = (e) => reject(e);
            img.src = url;
          });
          
          // 1) 숫자형식으로 전환하여 월별 데이터 입력 테이블 캡처
          const numBtn = Array.from(document.querySelectorAll('button, [role="button"]'))
            .find(el => (el.getAttribute?.('value') === 'table') || (el.textContent || '').includes('숫자형식'));
          if (numBtn && numBtn.getAttribute('aria-pressed') !== 'true') {
            (numBtn instanceof HTMLElement) && numBtn.click();
            await new Promise(r => setTimeout(r, 500));
          }
          
          // 월별 데이터 입력 테이블 찾기 (필터와 중복 헤더 제외, 슬라이드 헤더는 유지)
          const papers = Array.from(slideElement.querySelectorAll('.MuiPaper-root, .MuiCardContent-root'));
          const tablePaper = papers.find(paper => {
            const text = paper.textContent || '';
            return (text.includes('월별 데이터 입력') || text.includes('년간 데이터 일괄 저장')) &&
                   !text.includes('대상 년도') && 
                   !text.includes('시간 단위') &&
                   !text.includes('표시 모드') &&
                   !text.includes('가입자증감 관리'); // 중복 헤더 제외
          });
          
          let tableBlob = null;
          let tableWidth = 1200; // 기본값 설정 (그래프 캡처 시 참조용)
          if (tablePaper) {
            tablePaper.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 500));
            
            // 테이블의 실제 크기 측정 및 조정
            const tableContainer = tablePaper.querySelector('.MuiTableContainer-root, [style*="overflow"]') || tablePaper;
            const actualTable = tablePaper.querySelector('table');
            
            // 테이블의 실제 scrollWidth 측정 (12월까지 포함한 전체 너비)
            // 각 셀의 실제 너비를 확인하여 충분한 너비 확보
            let actualScrollWidth = 1200; // 기본값
            if (actualTable) {
              // 모든 셀의 너비를 확인하여 가장 넓은 셀 기준으로 계산
              const allCells = actualTable.querySelectorAll('td, th');
              let maxCellWidth = 0;
              let totalWidth = 0;
              
              // 첫 번째 행의 셀 너비 확인 (헤더)
              const firstRowCells = actualTable.querySelectorAll('thead tr:first-child th, thead tr:first-child td, tbody tr:first-child td');
              firstRowCells.forEach(cell => {
                const cellRect = cell.getBoundingClientRect();
                const cellWidth = cellRect.width;
                maxCellWidth = Math.max(maxCellWidth, cellWidth);
                totalWidth += cellWidth;
              });
              
              // 숫자가 큰 셀을 고려하여 최소 셀 너비 보장 (예: 113,635,306 같은 큰 숫자)
              const minCellWidth = 120; // 최소 셀 너비 (큰 숫자를 표시하기 위해)
              const estimatedWidth = Math.max(totalWidth, maxCellWidth * (firstRowCells.length || 13)); // 13개 컬럼 (코드, 대리점, 1월~12월)
              
              // scrollWidth와 비교하여 더 큰 값 사용
              if (tableContainer && tableContainer.scrollWidth) {
                actualScrollWidth = Math.max(tableContainer.scrollWidth, estimatedWidth, 1200);
              } else if (actualTable.scrollWidth) {
                actualScrollWidth = Math.max(actualTable.scrollWidth, estimatedWidth, 1200);
              } else {
                actualScrollWidth = Math.max(estimatedWidth, 1200);
              }
            } else if (tableContainer && tableContainer.scrollWidth) {
              actualScrollWidth = Math.max(tableContainer.scrollWidth, 1200);
            } else {
              const tableRect = tablePaper.getBoundingClientRect();
              actualScrollWidth = Math.max(tableRect.width, 1200);
            }
            
            // 테이블 Paper 너비를 실제 scrollWidth로 확장
            const originalTablePaperStyle = {
              width: tablePaper.style.width,
              minWidth: tablePaper.style.minWidth,
              maxWidth: tablePaper.style.maxWidth
            };
            tablePaper.style.width = `${actualScrollWidth}px`;
            tablePaper.style.minWidth = `${actualScrollWidth}px`;
            tablePaper.style.maxWidth = 'none';
            tablePaper.style.setProperty('width', `${actualScrollWidth}px`, 'important');
            tablePaper.style.setProperty('min-width', `${actualScrollWidth}px`, 'important');
            tablePaper.style.setProperty('max-width', 'none', 'important');
            
            // 테이블 컨테이너도 너비 확장
            if (tableContainer && tableContainer !== tablePaper) {
              tableContainer.style.width = `${actualScrollWidth}px`;
              tableContainer.style.minWidth = `${actualScrollWidth}px`;
              tableContainer.style.maxWidth = 'none';
              tableContainer.style.setProperty('width', `${actualScrollWidth}px`, 'important');
              tableContainer.style.setProperty('min-width', `${actualScrollWidth}px`, 'important');
              tableContainer.style.setProperty('max-width', 'none', 'important');
              tableContainer.style.setProperty('overflow-x', 'visible', 'important');
              tableContainer.style.setProperty('overflow', 'visible', 'important');
            }
            
            // 실제 테이블 요소도 너비 확장
            if (actualTable) {
              actualTable.style.width = `${actualScrollWidth}px`;
              actualTable.style.minWidth = `${actualScrollWidth}px`;
              actualTable.style.setProperty('width', `${actualScrollWidth}px`, 'important');
              actualTable.style.setProperty('min-width', `${actualScrollWidth}px`, 'important');
              
              // 각 셀의 너비도 충분히 확보 (숫자가 잘리지 않도록)
              const allCells = actualTable.querySelectorAll('td, th');
              const originalCellStyles = new Map();
              allCells.forEach(cell => {
                // 원본 스타일 저장
                originalCellStyles.set(cell, {
                  minWidth: cell.style.minWidth,
                  maxWidth: cell.style.maxWidth,
                  width: cell.style.width,
                  whiteSpace: cell.style.whiteSpace
                });
                
                // 셀의 현재 너비 확인
                const cellRect = cell.getBoundingClientRect();
                const cellText = (cell.textContent || '').trim();
                
                // maxWidth 제거 (ChartMode.js에서 maxWidth: 70으로 제한되어 있어서 큰 숫자가 잘림)
                cell.style.maxWidth = 'none';
                cell.style.setProperty('max-width', 'none', 'important');
                
                // 큰 숫자가 있는 셀은 최소 너비 보장
                if (cellText && /[\d,]+/.test(cellText)) {
                  // 숫자 길이에 따라 최소 너비 계산 (예: 113,635,306 -> 약 120px 필요)
                  const numLength = cellText.replace(/,/g, '').length;
                  const minCellWidth = Math.max(100, numLength * 8); // 숫자 1개당 약 8px
                  if (cellRect.width < minCellWidth) {
                    cell.style.minWidth = `${minCellWidth}px`;
                    cell.style.setProperty('min-width', `${minCellWidth}px`, 'important');
                  }
                } else {
                  // 일반 셀도 최소 너비 보장
                  const minCellWidth = 60;
                  if (cellRect.width < minCellWidth) {
                    cell.style.minWidth = `${minCellWidth}px`;
                    cell.style.setProperty('min-width', `${minCellWidth}px`, 'important');
                  }
                }
                
                // 셀의 white-space를 nowrap로 설정하여 텍스트가 잘리지 않도록
                cell.style.whiteSpace = 'nowrap';
                cell.style.setProperty('white-space', 'nowrap', 'important');
              });
              
              // 원본 셀 스타일 복원 함수 저장 (나중에 복원하기 위해)
              if (!tablePaper.__originalCellStyles) {
                tablePaper.__originalCellStyles = originalCellStyles;
              }
            }
            
            // 스크롤을 맨 왼쪽으로 이동 (앞부분이 보이도록)
            if (tableContainer && tableContainer.scrollLeft !== undefined) {
              tableContainer.scrollLeft = 0;
            }
            
            // 스타일 변경 후 렌더링 대기 (셀 너비 조정을 위해 더 긴 대기 시간)
            await new Promise(r => setTimeout(r, 800));
            
            // 최종 scrollWidth 재확인 (확장 후)
            // 셀 너비 조정 후 실제 테이블 너비 재측정
            if (actualTable) {
              // 모든 셀의 실제 렌더링된 너비 확인
              const allCells = actualTable.querySelectorAll('td, th');
              let totalCellWidth = 0;
              allCells.forEach(cell => {
                const cellRect = cell.getBoundingClientRect();
                totalCellWidth = Math.max(totalCellWidth, cellRect.right - cellRect.left);
              });
              
              // 첫 번째 행의 모든 셀 너비 합계로 전체 테이블 너비 추정
              const firstRowCells = actualTable.querySelectorAll('thead tr:first-child th, thead tr:first-child td, tbody tr:first-child td');
              if (firstRowCells.length > 0) {
                let firstRowTotalWidth = 0;
                firstRowCells.forEach(cell => {
                  const cellRect = cell.getBoundingClientRect();
                  firstRowTotalWidth += cellRect.width;
                });
                // 첫 번째 행 너비 합계와 scrollWidth 중 더 큰 값 사용
                actualScrollWidth = Math.max(actualScrollWidth, firstRowTotalWidth, tableContainer?.scrollWidth || 0, actualTable.scrollWidth || 0);
              }
            }
            
            if (tableContainer && tableContainer.scrollWidth > actualScrollWidth) {
              actualScrollWidth = tableContainer.scrollWidth;
            }
            if (actualTable && actualTable.scrollWidth > actualScrollWidth) {
              actualScrollWidth = actualTable.scrollWidth;
            }
            
            // 재확인된 너비로 다시 설정
            if (actualScrollWidth > tablePaper.getBoundingClientRect().width) {
              tablePaper.style.width = `${actualScrollWidth}px`;
              tablePaper.style.minWidth = `${actualScrollWidth}px`;
              if (tableContainer !== tablePaper) {
                tableContainer.style.width = `${actualScrollWidth}px`;
                tableContainer.style.minWidth = `${actualScrollWidth}px`;
              }
              if (actualTable) {
                actualTable.style.width = `${actualScrollWidth}px`;
                actualTable.style.minWidth = `${actualScrollWidth}px`;
              }
              await new Promise(r => setTimeout(r, 300));
            }
            
            // tableWidth 업데이트 (그래프와 동일한 너비로 맞추기)
            tableWidth = actualScrollWidth;
            
            // 테이블 높이 측정
            const tableHeight = tablePaper.scrollHeight || tablePaper.offsetHeight || tablePaper.getBoundingClientRect().height;
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`📊 [MeetingCaptureManager] 가입자증감 테이블 크기 조정: ${actualScrollWidth}px (높이: ${tableHeight}px)`);
            }
            
            // 테이블 캡처 (스크롤 위치 0으로, 확장된 전체 너비)
            tableBlob = await captureElement(tablePaper, {
              scale: 2,
              useCORS: true,
              fixedBottomPaddingPx: 0, // 핑크 바 제거
              backgroundColor: '#ffffff',
              scrollX: 0, // 왼쪽 끝에서 캡처 (앞부분이 보이도록)
              scrollY: 0,
              width: actualScrollWidth * 2, // scale 고려
              height: tableHeight * 2 // fixedBottomPadding 제거
            });
            
            // 원본 스타일 복원
            if (originalTablePaperStyle.width) {
              tablePaper.style.width = originalTablePaperStyle.width;
            } else {
              tablePaper.style.removeProperty('width');
            }
            if (originalTablePaperStyle.minWidth) {
              tablePaper.style.minWidth = originalTablePaperStyle.minWidth;
            } else {
              tablePaper.style.removeProperty('min-width');
            }
            if (originalTablePaperStyle.maxWidth) {
              tablePaper.style.maxWidth = originalTablePaperStyle.maxWidth;
            } else {
              tablePaper.style.removeProperty('max-width');
            }
            
            // 셀 스타일 복원
            if (actualTable && tablePaper.__originalCellStyles) {
              const originalCellStyles = tablePaper.__originalCellStyles;
              const allCells = actualTable.querySelectorAll('td, th');
              allCells.forEach(cell => {
                const originalStyle = originalCellStyles.get(cell);
                if (originalStyle) {
                  if (originalStyle.minWidth) {
                    cell.style.minWidth = originalStyle.minWidth;
                  } else {
                    cell.style.removeProperty('min-width');
                  }
                  if (originalStyle.maxWidth) {
                    cell.style.maxWidth = originalStyle.maxWidth;
                  } else {
                    cell.style.removeProperty('max-width');
                  }
                  if (originalStyle.width) {
                    cell.style.width = originalStyle.width;
                  } else {
                    cell.style.removeProperty('width');
                  }
                  if (originalStyle.whiteSpace) {
                    cell.style.whiteSpace = originalStyle.whiteSpace;
                  } else {
                    cell.style.removeProperty('white-space');
                  }
                }
              });
              delete tablePaper.__originalCellStyles;
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [MeetingCaptureManager] 가입자증감 테이블 캡처 완료');
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ [MeetingCaptureManager] 가입자증감 테이블을 찾을 수 없습니다.');
          }
        }
          
          // 2) 그래프형식으로 전환하여 그래프 2개 캡처
          const chartBtn = Array.from(document.querySelectorAll('button, [role="button"]'))
            .find(el => (el.getAttribute?.('value') === 'chart') || (el.textContent || '').includes('그래프형식'));
          if (chartBtn && chartBtn.getAttribute('aria-pressed') !== 'true') {
            (chartBtn instanceof HTMLElement) && chartBtn.click();
            await new Promise(r => setTimeout(r, 500));
          }
          
          // 그래프 두 개가 렌더될 때까지 대기 (최대 5초)
          {
            const maxWait = 5000;
            const start = Date.now();
            let graphCount = 0;
            while (Date.now() - start < maxWait) {
              const graphs = Array.from(slideElement.querySelectorAll('canvas, svg, [class*="recharts"]'));
              graphCount = graphs.length;
              if (graphCount >= 2) {
                // 각 그래프가 실제로 렌더링되었는지 확인
                let chart1Found = false;
                let chart2Found = false;
                const allPapers = slideElement.querySelectorAll('.MuiPaper-root');
                for (const paper of allPapers) {
                  const text = paper.textContent || '';
                  if (text.includes('가입자수 추이')) {
                    const chart = paper.querySelector('canvas, svg, [class*="recharts"]');
                    if (chart) chart1Found = true;
                  }
                  if (text.includes('관리수수료 추이')) {
                    const chart = paper.querySelector('canvas, svg, [class*="recharts"]');
                    if (chart) chart2Found = true;
                  }
                }
                if (chart1Found && chart2Found) break;
              }
              await new Promise(r => setTimeout(r, 200));
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ [MeetingCaptureManager] 가입자증감 그래프 렌더링 확인: ${graphCount}개`);
            }
          }
          
          // 그래프 Paper만 찾기 (필터와 중복 헤더 제외, 슬라이드 헤더는 유지) - 그래프형식으로 전환 후 다시 찾기
          // 더 정확한 선택: Card 컴포넌트를 직접 찾기
          const chartPapersAll = Array.from(slideElement.querySelectorAll('.MuiPaper-root, .MuiCard-root, .MuiCardContent-root'));
          const chartPapers = chartPapersAll.filter(paper => {
            const text = paper.textContent || '';
            // 가입자수 추이 또는 관리수수료 추이를 포함하고, 그래프(canvas 또는 svg)가 있는 Paper만 선택
            const hasChart = paper.querySelector('canvas, svg, [class*="recharts"]');
            return hasChart && 
                   (text.includes('가입자수 추이') || text.includes('관리수수료 추이')) &&
                   !text.includes('대상 년도') && 
                   !text.includes('시간 단위') &&
                   !text.includes('표시 모드') &&
                   !text.includes('가입자증감 관리'); // 중복 헤더 제외
          });
          
          // 정확히 2개의 그래프 Paper가 있는지 확인 (가입자수 추이 1개, 관리수수료 추이 1개)
          const subscriberChartPaper = chartPapers.find(p => p.textContent?.includes('가입자수 추이'));
          const feeChartPaper = chartPapers.find(p => p.textContent?.includes('관리수수료 추이'));
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 [MeetingCaptureManager] 가입자증감 그래프 찾기: 전체 ${chartPapersAll.length}개, 필터링 후 ${chartPapers.length}개`);
            console.log(`🔍 [MeetingCaptureManager] 가입자수 추이: ${subscriberChartPaper ? '찾음' : '없음'}`);
            console.log(`🔍 [MeetingCaptureManager] 관리수수료 추이: ${feeChartPaper ? '찾음' : '없음'}`);
          }
          
          let graphBlob = null;
          // 가입자수 추이와 관리수수료 추이 그래프가 모두 있는지 확인
          if (subscriberChartPaper && feeChartPaper) {
            // 안전을 위해 항상 개별 캡처 후 합성 (조상 캡처 시 월별 테이블이 포함될 수 있음)
            subscriberChartPaper.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 500));
            
            // 가입자수 추이 그래프의 가로 스크롤 처리
            const chart1Container = subscriberChartPaper.querySelector('.MuiTableContainer-root, [style*="overflow"], .recharts-wrapper');
            let chart1ScrollX = 0;
            if (chart1Container && chart1Container.scrollWidth > chart1Container.clientWidth) {
              chart1Container.scrollLeft = chart1Container.scrollWidth;
              await new Promise(r => setTimeout(r, 300));
              chart1ScrollX = chart1Container.scrollLeft;
            }
            
            // 가입자수 추이 그래프의 실제 크기 측정 및 조정
            const chart1Rect = subscriberChartPaper.getBoundingClientRect();
            const chart1Canvas = subscriberChartPaper.querySelector('canvas');
            // 테이블과 정확히 동일한 너비로 맞추기 (tableWidth는 테이블 캡처 시 업데이트됨)
            let chart1Width = tableWidth; // 테이블과 정확히 동일한 너비 사용
            let chart1Height = chart1Rect.height;
            
            // canvas 크기 확인 및 조정
            if (chart1Canvas) {
              chart1Height = Math.max(chart1Height, 400);
              // 그래프가 잘리지 않도록 충분한 높이 보장
              if (chart1Height < 400) chart1Height = 400;
            }
            
            // 그래프 Paper 크기 임시 조정 (캡처를 위해) - 테이블과 동일한 너비로
            const originalChart1Style = {
              width: subscriberChartPaper.style.width,
              minWidth: subscriberChartPaper.style.minWidth,
              maxWidth: subscriberChartPaper.style.maxWidth,
              height: subscriberChartPaper.style.height,
              minHeight: subscriberChartPaper.style.minHeight
            };
            subscriberChartPaper.style.width = `${chart1Width}px`;
            subscriberChartPaper.style.minWidth = `${chart1Width}px`;
            subscriberChartPaper.style.maxWidth = 'none';
            subscriberChartPaper.style.setProperty('width', `${chart1Width}px`, 'important');
            subscriberChartPaper.style.setProperty('min-width', `${chart1Width}px`, 'important');
            subscriberChartPaper.style.setProperty('max-width', 'none', 'important');
            subscriberChartPaper.style.height = 'auto';
            subscriberChartPaper.style.minHeight = `${chart1Height}px`;
            
            // 그래프가 렌더링될 때까지 대기
            await new Promise(r => setTimeout(r, 500));
            
            const chart1Blob = await captureElement(subscriberChartPaper, {
              scale: 2,
              useCORS: true,
              fixedBottomPaddingPx: 0, // 핑크 바 제거
              backgroundColor: '#ffffff',
              scrollX: chart1ScrollX,
              scrollY: 0,
              width: chart1Width * 2, // scale 고려
              height: chart1Height * 2 // fixedBottomPadding 제거
            });
            
            // 원래 스타일 복원
            subscriberChartPaper.style.width = originalChart1Style.width;
            subscriberChartPaper.style.minWidth = originalChart1Style.minWidth;
            subscriberChartPaper.style.maxWidth = originalChart1Style.maxWidth;
            subscriberChartPaper.style.height = originalChart1Style.height;
            subscriberChartPaper.style.minHeight = originalChart1Style.minHeight;
            
            feeChartPaper.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 500));
            
            // 관리수수료 추이 그래프의 가로 스크롤 처리
            const chart2Container = feeChartPaper.querySelector('.MuiTableContainer-root, [style*="overflow"], .recharts-wrapper');
            let chart2ScrollX = 0;
            if (chart2Container && chart2Container.scrollWidth > chart2Container.clientWidth) {
              chart2Container.scrollLeft = chart2Container.scrollWidth;
              await new Promise(r => setTimeout(r, 300));
              chart2ScrollX = chart2Container.scrollLeft;
            }
            
            // 관리수수료 추이 그래프의 실제 크기 측정 및 조정
            const chart2Rect = feeChartPaper.getBoundingClientRect();
            const chart2Canvas = feeChartPaper.querySelector('canvas');
            // 테이블과 정확히 동일한 너비로 맞추기 (tableWidth와 동일)
            let chart2Width = tableWidth; // 테이블과 정확히 동일한 너비 사용
            let chart2Height = chart2Rect.height;
            
            // canvas 크기 확인 및 조정
            if (chart2Canvas) {
              chart2Height = Math.max(chart2Height, 400);
              // 그래프가 잘리지 않도록 충분한 높이 보장
              if (chart2Height < 400) chart2Height = 400;
            }
            
            // 그래프 Paper 크기 임시 조정 (캡처를 위해) - 테이블과 동일한 너비로
            const originalChart2Style = {
              width: feeChartPaper.style.width,
              minWidth: feeChartPaper.style.minWidth,
              maxWidth: feeChartPaper.style.maxWidth,
              height: feeChartPaper.style.height,
              minHeight: feeChartPaper.style.minHeight
            };
            feeChartPaper.style.width = `${chart2Width}px`;
            feeChartPaper.style.minWidth = `${chart2Width}px`;
            feeChartPaper.style.maxWidth = 'none';
            feeChartPaper.style.setProperty('width', `${chart2Width}px`, 'important');
            feeChartPaper.style.setProperty('min-width', `${chart2Width}px`, 'important');
            feeChartPaper.style.setProperty('max-width', 'none', 'important');
            feeChartPaper.style.height = 'auto';
            feeChartPaper.style.minHeight = `${chart2Height}px`;
            
            // 그래프가 렌더링될 때까지 대기
            await new Promise(r => setTimeout(r, 500));
            
            const chart2Blob = await captureElement(feeChartPaper, {
              scale: 2,
              useCORS: true,
              fixedBottomPaddingPx: 0, // 핑크 바 제거
              backgroundColor: '#ffffff',
              scrollX: chart2ScrollX,
              scrollY: 0,
              width: chart2Width * 2, // scale 고려
              height: chart2Height * 2 // fixedBottomPadding 제거
            });
            
            // 원래 스타일 복원
            feeChartPaper.style.width = originalChart2Style.width;
            feeChartPaper.style.minWidth = originalChart2Style.minWidth;
            feeChartPaper.style.maxWidth = originalChart2Style.maxWidth;
            feeChartPaper.style.height = originalChart2Style.height;
            feeChartPaper.style.minHeight = originalChart2Style.minHeight;
            const img1 = await blobToImage(chart1Blob);
            const img2 = await blobToImage(chart2Blob);
            const gap = 24; // 간격 증가 (16 → 24)
            const maxWidth = Math.max(img1.width, img2.width);
            const canvas = document.createElement('canvas');
            canvas.width = maxWidth;
            canvas.height = img1.height + gap + img2.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 가운데 정렬로 그리기
            const img1X = (maxWidth - img1.width) / 2;
            const img2X = (maxWidth - img2.width) / 2;
            ctx.drawImage(img1, img1X, 0);
            ctx.drawImage(img2, img2X, img1.height + gap);
            graphBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ [MeetingCaptureManager] 가입자증감 그래프 Paper를 찾을 수 없습니다.`);
              console.warn(`  - 가입자수 추이: ${subscriberChartPaper ? '찾음' : '없음'}`);
              console.warn(`  - 관리수수료 추이: ${feeChartPaper ? '찾음' : '없음'}`);
              console.warn(`  - 전체 Paper 수: ${chartPapersAll.length}`);
            }
          }
          
          // 3) 테이블과 그래프를 세로로 합치기 (가운데 정렬)
          let contentBlob = null;
          if (tableBlob && graphBlob) {
            const imgTable = await blobToImage(tableBlob);
            const imgGraph = await blobToImage(graphBlob);
            const gap = 24; // 간격 증가 (16 → 24)
            const maxWidth = Math.max(imgTable.width, imgGraph.width);
            const canvas = document.createElement('canvas');
            canvas.width = maxWidth;
            canvas.height = imgTable.height + gap + imgGraph.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 가운데 정렬로 그리기
            const tableX = (maxWidth - imgTable.width) / 2;
            const graphX = (maxWidth - imgGraph.width) / 2;
            ctx.drawImage(imgTable, tableX, 0);
            ctx.drawImage(imgGraph, graphX, imgTable.height + gap);
            
            contentBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [MeetingCaptureManager] 가입자증감 테이블+그래프 합성 완료');
            }
          } else if (tableBlob) {
            // 테이블만 있는 경우
            contentBlob = tableBlob;
          } else if (graphBlob) {
            // 그래프만 있는 경우
            contentBlob = graphBlob;
          }
          
          // 4) 슬라이드 헤더 캡처 및 합성
          if (contentBlob) {
            try {
              // 슬라이드 헤더 찾기 (SlideRenderer에서 렌더링된 헤더)
              // 헤더는 position: absolute, top: 0, 그리고 (주)브이아이피플러스 텍스트를 포함
              let headerElement = null;
              
              // 방법 1: 모든 요소를 순회하며 헤더 찾기
              const allElements = Array.from(slideElement.querySelectorAll('*'));
              for (const el of allElements) {
                const style = window.getComputedStyle(el);
                const text = el.textContent || '';
                if (style.position === 'absolute' && 
                    (parseInt(style.top) === 0 || style.top === '0px') &&
                    text.includes('(주)브이아이피플러스')) {
                  headerElement = el;
                  break;
                }
              }
              
              // 방법 2: slideElement의 직접 자식 중에서 찾기
              if (!headerElement) {
                for (const child of Array.from(slideElement.children)) {
                  const style = window.getComputedStyle(child);
                  const text = child.textContent || '';
                  if (style.position === 'absolute' && 
                      (parseInt(style.top) === 0 || style.top === '0px') &&
                      text.includes('(주)브이아이피플러스')) {
                    headerElement = child;
                    break;
                  }
                }
              }
              
              if (headerElement) {
                headerElement.scrollIntoView({ block: 'start', behavior: 'instant' });
                await new Promise(r => setTimeout(r, 300));
                
                const headerBlob = await captureElement(headerElement, {
                  scale: 2,
                  useCORS: true,
                  fixedBottomPaddingPx: 0, // 핑크 바 제거
                  backgroundColor: 'transparent',
                  scrollX: 0,
                  scrollY: 0
                });
                
                const imgHeader = await blobToImage(headerBlob);
                const imgContent = await blobToImage(contentBlob);
                const gap = 0; // 헤더와 콘텐츠 사이 간격 없음
                // 헤더 크기를 테이블(콘텐츠) 너비에 맞춰서 스케일링
                const targetWidth = imgContent.width; // 콘텐츠 너비에 맞춤
                const headerScale = targetWidth / imgHeader.width; // 헤더 스케일 비율
                const scaledHeaderHeight = imgHeader.height * headerScale; // 비율 유지하며 높이 계산
                const maxWidth = targetWidth; // 콘텐츠 너비 사용
                const canvas = document.createElement('canvas');
                canvas.width = maxWidth;
                canvas.height = scaledHeaderHeight + gap + imgContent.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // 헤더를 테이블 너비에 맞춰서 스케일링하여 그리기 (가운데 정렬)
                const headerX = 0; // 전체 너비를 사용하므로 0
                const contentX = 0; // 전체 너비를 사용하므로 0
                ctx.drawImage(imgHeader, headerX, 0, targetWidth, scaledHeaderHeight);
                ctx.drawImage(imgContent, contentX, scaledHeaderHeight + gap);
                
                compositeBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                
                if (process.env.NODE_ENV === 'development') {
                  console.log('✅ [MeetingCaptureManager] 가입자증감 헤더+콘텐츠 합성 완료');
                }
              } else {
                // 헤더를 찾지 못한 경우 콘텐츠만 사용
                compositeBlob = contentBlob;
                if (process.env.NODE_ENV === 'development') {
                  console.warn('⚠️ [MeetingCaptureManager] 슬라이드 헤더를 찾을 수 없습니다.');
                }
              }
            } catch (e) {
              // 헤더 캡처 실패 시 콘텐츠만 사용
              compositeBlob = contentBlob;
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ [MeetingCaptureManager] 헤더 캡처 실패:', e?.message);
              }
            }
          }
        } catch (e) {
          console.error('❌ [MeetingCaptureManager] 가입자증감 캡처 실패:', e);
        }
      }

      // 캡처 (선정된 타겟 요소만 캡처)
      const slideType = currentSlide.type || 'mode-tab';
      const backgroundColor = slideType === 'custom' 
        ? (currentSlide.backgroundColor || '#ffffff')
        : slideType === 'main' || slideType === 'toc' || slideType === 'ending'
        ? '#ffffff' // 배경색은 그라데이션이므로 흰색으로 설정
        : '#ffffff';
      
      // 메인/목차/엔딩 슬라이드의 경우 캡처 전에 실제 DOM 스타일을 변경하여 높이 확보
      const isMainTocEnding = slideType === 'main' || slideType === 'toc' || slideType === 'ending';
      let restoreStylesFunction = null;
      
      if (isMainTocEnding && captureTargetElement) {
        try {
          // 스크롤을 맨 위로 이동
          captureTargetElement.scrollTop = 0;
          if (captureTargetElement.parentElement) {
            captureTargetElement.parentElement.scrollTop = 0;
          }
          
          // 모든 자식 요소의 스크롤 제약 제거
          const allElements = captureTargetElement.querySelectorAll('*');
          const originalStyles = new Map();
          
          allElements.forEach(el => {
            if (!el || !el.style) return;
            
            // 원본 스타일 저장
            const styles = {
              overflow: el.style.overflow,
              overflowY: el.style.overflowY,
              overflowX: el.style.overflowX,
              maxHeight: el.style.maxHeight,
              height: el.style.height,
              minHeight: el.style.minHeight
            };
            originalStyles.set(el, styles);
            
            // computed styles 확인
            const computed = window.getComputedStyle(el);
            const hasMaxHeight = computed.maxHeight && computed.maxHeight !== 'none' && computed.maxHeight !== 'auto';
            const hasOverflow = computed.overflow === 'auto' || computed.overflow === 'scroll' || computed.overflow === 'hidden';
            const hasOverflowY = computed.overflowY === 'auto' || computed.overflowY === 'scroll' || computed.overflowY === 'hidden';
            const hasVhHeight = computed.height && (computed.height.includes('vh') || computed.height.includes('%'));
            
            // 스크롤 제약 제거
            if (hasOverflow || hasOverflowY || el.style.overflow || el.style.overflowY) {
              el.style.setProperty('overflow', 'visible', 'important');
              el.style.setProperty('overflow-y', 'visible', 'important');
              el.style.setProperty('overflow-x', 'visible', 'important');
            }
            
            if (hasMaxHeight || el.style.maxHeight) {
              el.style.setProperty('max-height', 'none', 'important');
            }
            
            if (hasVhHeight || (el.style.height && (el.style.height.includes('vh') || el.style.height.includes('%')))) {
              el.style.setProperty('height', 'auto', 'important');
            }
            
            // 스크롤 가능한 컨테이너는 실제 스크롤 높이로 확장
            if (el.scrollHeight && el.scrollHeight > el.clientHeight) {
              el.style.setProperty('height', `${el.scrollHeight}px`, 'important');
              el.style.setProperty('max-height', 'none', 'important');
              el.style.setProperty('overflow', 'visible', 'important');
            }
          });
          
          // 메인 컨테이너의 스크롤 제약만 제거 (높이 확장하지 않음)
          const mainComputed = window.getComputedStyle(captureTargetElement);
          const mainHasMaxHeight = mainComputed.maxHeight && mainComputed.maxHeight !== 'none' && mainComputed.maxHeight !== 'auto';
          const mainHasOverflow = mainComputed.overflow === 'auto' || mainComputed.overflow === 'scroll' || mainComputed.overflow === 'hidden';
          const mainOriginalStyle = {
            overflow: captureTargetElement.style.overflow,
            overflowY: captureTargetElement.style.overflowY,
            overflowX: captureTargetElement.style.overflowX,
            maxHeight: captureTargetElement.style.maxHeight
          };
          
          if (mainHasOverflow || captureTargetElement.style.overflow) {
            captureTargetElement.style.setProperty('overflow', 'visible', 'important');
            captureTargetElement.style.setProperty('overflow-y', 'visible', 'important');
            captureTargetElement.style.setProperty('overflow-x', 'visible', 'important');
          }
          if (mainHasMaxHeight || captureTargetElement.style.maxHeight) {
            captureTargetElement.style.setProperty('max-height', 'none', 'important');
          }
          
          // 복원 함수 생성 (스타일만 복원, 높이는 변경하지 않음)
          restoreStylesFunction = () => {
            // 자식 요소 스타일 복원
            originalStyles.forEach((styles, el) => {
              if (!el || !el.style) return;
              Object.keys(styles).forEach(key => {
                if (styles[key]) {
                  el.style[key] = styles[key];
                } else {
                  el.style.removeProperty(key);
                }
              });
            });
            
            // 메인 컨테이너 스타일 복원
            Object.keys(mainOriginalStyle).forEach(key => {
              if (mainOriginalStyle[key]) {
                captureTargetElement.style[key] = mainOriginalStyle[key];
              } else {
                captureTargetElement.style.removeProperty(key);
              }
            });
          };
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`📏 [MeetingCaptureManager] ${slideType} 슬라이드 스크롤 제약 제거 완료 (높이 확장 없음)`);
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ [MeetingCaptureManager] ${slideType} 슬라이드 스타일 조정 중 경고:`, e?.message);
          }
        }
      }
        
      // 최종 Blob 결정
      // 재초담초채권 슬라이드의 경우 그래프와 테이블 크기를 충분히 확보
      const isRechotancho = currentSlide?.mode === 'chart' &&
        (currentSlide?.tab === 'bondChart' || currentSlide?.tab === 'bond') &&
        (currentSlide?.subTab === 'rechotanchoBond');
      
      const captureOptions = {
        scale: 2,
        useCORS: true,
        fixedBottomPaddingPx: 96,
        backgroundColor: backgroundColor,
        // 스크롤 영역 전체 캡처
        scrollX: 0,
        scrollY: 0
      };
      
      // 메인/목차/엔딩 슬라이드의 경우: 실제 콘텐츠 크기로 정확히 캡처
      if (isMainTocEnding && captureTargetElement) {
        // 실제 콘텐츠 크기 측정 (모든 자식 요소 포함)
        const elementRect = captureTargetElement.getBoundingClientRect();
        const allChildren = captureTargetElement.querySelectorAll('*');
        let maxBottom = elementRect.height;
        let maxRight = elementRect.width;
        
        allChildren.forEach(child => {
          try {
            const childRect = child.getBoundingClientRect();
            const relativeBottom = childRect.bottom - elementRect.top;
            const relativeRight = childRect.right - elementRect.left;
            maxBottom = Math.max(maxBottom, relativeBottom);
            maxRight = Math.max(maxRight, relativeRight);
          } catch (e) {
            // 무시
          }
        });
        
        // 실제 콘텐츠 크기 사용 (최소 여유공간만 추가)
        const actualContentHeight = Math.max(maxBottom, captureTargetElement.scrollHeight || elementRect.height);
        // scrollWidth를 우선 사용하여 정확한 콘텐츠 너비 측정 (오른쪽 공백 제거)
        const actualContentWidth = Math.max(
          maxRight, 
          captureTargetElement.scrollWidth || elementRect.width,
          elementRect.width // 최소한 현재 보이는 너비는 보장
        );
        
        // 목차 슬라이드처럼 적당한 높이: 실제 콘텐츠 높이만 사용 (여유공간 최소화)
        // 목차 슬라이드가 적당하다고 하였으므로 메인/엔딩도 동일한 로직 사용
        const targetHeight = Math.max(actualContentHeight, 400); // 실제 콘텐츠 높이만, 최소 400px
        // 너비는 1280px로 고정 (BASE_CAPTURE_WIDTH) - 너비에 맞춰서 캡처하면 오른쪽 공백 제거
        const BASE_CAPTURE_WIDTH = 1280;
        const targetWidth = BASE_CAPTURE_WIDTH;
        
        // 요소의 너비를 1280px로 명시적으로 설정하여 너비에 맞춰지도록 함
        const originalWidth = captureTargetElement.style.width;
        const originalMaxWidth = captureTargetElement.style.maxWidth;
        captureTargetElement.style.setProperty('width', `${targetWidth}px`, 'important');
        captureTargetElement.style.setProperty('max-width', `${targetWidth}px`, 'important');
        
        // 렌더링 대기
        await new Promise(r => setTimeout(r, 200));
        
        // scale은 html2canvas에서 처리하므로 원본 크기만 전달
        captureOptions.width = targetWidth;
        captureOptions.height = targetHeight;
        captureOptions.windowWidth = targetWidth; // windowWidth도 1280px로 설정하여 너비에 맞춰짐
        captureOptions.windowHeight = targetHeight;
        captureOptions.skipAutoCrop = true; // 자동 크롭 건너뛰기
        captureOptions.fixedBottomPaddingPx = 0; // 핑크색 바 제거
        
        // 너비 복원 함수에 추가
        if (restoreStylesFunction) {
          const originalRestore = restoreStylesFunction;
          restoreStylesFunction = () => {
            originalRestore();
            if (originalWidth) {
              captureTargetElement.style.width = originalWidth;
            } else {
              captureTargetElement.style.removeProperty('width');
            }
            if (originalMaxWidth) {
              captureTargetElement.style.maxWidth = originalMaxWidth;
            } else {
              captureTargetElement.style.removeProperty('max-width');
            }
          };
        } else {
          restoreStylesFunction = () => {
            if (originalWidth) {
              captureTargetElement.style.width = originalWidth;
            } else {
              captureTargetElement.style.removeProperty('width');
            }
            if (originalMaxWidth) {
              captureTargetElement.style.maxWidth = originalMaxWidth;
            } else {
              captureTargetElement.style.removeProperty('max-width');
            }
          };
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`📐 [MeetingCaptureManager] ${slideType} 슬라이드 캡처 옵션 (크롭 제거, 정확한 크기):`, {
            actualContentHeight,
            actualContentWidth,
            targetHeight,
            targetWidth,
            captureHeight: captureOptions.height,
            captureWidth: captureOptions.width,
            skipAutoCrop: true
          });
        }
      }
      
      // 재초담초채권 슬라이드의 경우 충분한 너비와 높이 보장
      if (isRechotancho && captureTargetElement) {
        const elementRect = captureTargetElement.getBoundingClientRect();
        const elementScrollHeight = captureTargetElement.scrollHeight || elementRect.height;
        const targetWidth = Math.max(elementRect.width, 1200);
        const targetHeight = Math.max(elementScrollHeight, 2000); // 최소 2000px 높이 보장
        
        captureOptions.width = targetWidth * 2; // scale 고려
        captureOptions.height = (targetHeight + 96) * 2; // fixedBottomPadding 포함
      }
      
      // 전체총마감 슬라이드: 실제 콘텐츠 높이에 맞춰 크롭 (월간시상 슬라이드와 유사)
      const isTotalClosing = currentSlide?.mode === 'chart' && 
                             currentSlide?.tab === 'closingChart' && 
                             currentSlide?.subTab === 'totalClosing';
      if (isTotalClosing && captureTargetElement) {
        try {
          // 위에서 설정된 높이 사용 (measuredHeight가 style.height에 설정됨)
          const measuredHeight = parseFloat(captureTargetElement.style.height);
          
          if (measuredHeight && measuredHeight > 0) {
            // 측정된 높이 사용하여 불필요한 여백 제거
            captureOptions.skipAutoCrop = true; // 크롭 로직 제거 (실제 높이로만 캡처)
            captureOptions.fixedBottomPaddingPx = 0; // 핑크 바 제거
            captureOptions.height = measuredHeight * 2; // scale 고려
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`📐 [MeetingCaptureManager] 전체총마감: 크롭 옵션 설정`, {
                measuredHeight,
                captureHeight: captureOptions.height,
                skipAutoCrop: true,
                fixedBottomPaddingPx: 0
              });
            }
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ [MeetingCaptureManager] 전체총마감 크롭 옵션 설정 중 경고:', e?.message);
          }
        }
      }
      
      let blob = monthlyAwardCompositeBlob || inventoryCompositeBlob || compositeBlob || await captureElement(captureTargetElement, captureOptions);
      
      // 스타일 복원
      if (restoreStylesFunction) {
        try {
          restoreStylesFunction();
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ [MeetingCaptureManager] ${slideType} 슬라이드 스타일 복원 중 경고:`, e?.message);
          }
        }
      }

      // 안전 장치: 메인/목차/엔딩 슬라이드가 아닌 경우에만 하단 여백 패딩 적용
      // (메인/목차/엔딩 슬라이드는 크롭 및 패딩 로직 제거)
      // 월간 시상 슬라이드는 핑크 바 제거 및 크롭 로직 사용하므로 패딩 제거
      // 가입자 증감 슬라이드는 핑크 바 제거하므로 패딩 제거
      const isMonthlyAward = currentSlide?.mode === 'chart' && 
                             (currentSlide?.tab === 'indicatorChart' || currentSlide?.subTab === 'monthlyAward');
      const isSubscriberIncrease = currentSlide?.mode === 'chart' && 
                                   (currentSlide?.tab === 'bondChart' || currentSlide?.tab === 'bond') &&
                                   (currentSlide?.subTab === 'subscriberIncrease');
      if (!isMainTocEnding && !isMonthlyAward && !isSubscriberIncrease) {
        try {
          const ensureBottomPadding = async (srcBlob, padding = 96) => {
            if (!srcBlob || padding <= 0) return srcBlob;
            const img = await blobToImage(srcBlob);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height + padding;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          };
          blob = await ensureBottomPadding(blob, 96);
        } catch (e) {
          // 패딩 보강 실패 시 원본 blob 사용
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ [MeetingCaptureManager] 하단 여백 보강 실패, 원본 사용:', e?.message);
          }
        }
      }
      // 임시 배지 제거
      try {
        if (captureTargetElement && captureTargetElement.__tempTsBadge) {
          captureTargetElement.__tempTsBadge.remove();
          delete captureTargetElement.__tempTsBadge;
        }
        if (captureTargetElement && captureTargetElement.__tempYearBadge) {
          captureTargetElement.__tempYearBadge.remove();
          delete captureTargetElement.__tempYearBadge;
        }
        // 재초담초채권 스타일 복원
        if (captureTargetElement && captureTargetElement.__restoreStyles) {
          captureTargetElement.__restoreStyles();
          delete captureTargetElement.__restoreStyles;
        }
      } catch (_) {}

      // Discord에 업로드
      const filename = generateImageFilename(meeting.meetingId, index + 1);
      console.log(`📸 [MeetingCaptureManager] 슬라이드 ${index + 1} 캡처 완료, 업로드 시작`);
      const formData = new FormData();
      formData.append('image', blob, filename);
      formData.append('meetingId', meeting.meetingId);
      formData.append('meetingDate', meeting.meetingDate);
      formData.append('slideOrder', index + 1);

      // 재시도 로직이 포함된 업로드 함수 (지수 백오프 적용, CORS 에러 처리 개선)
      const uploadWithRetry = async (retries = 3, baseDelay = 1000) => {
        let lastError = null;
        
        // 전체총마감 슬라이드는 이미지가 크므로 타임아웃을 더 길게 설정
        const isTotalClosing = currentSlide?.mode === 'chart' && 
                               currentSlide?.tab === 'closingChart' && 
                               currentSlide?.subTab === 'totalClosing';
        const uploadTimeout = isTotalClosing ? 120000 : 30000; // 전체총마감: 120초, 기타: 30초
        
        if (process.env.NODE_ENV === 'development' && isTotalClosing) {
          console.log(`⏱️ [MeetingCaptureManager] 전체총마감 슬라이드: 업로드 타임아웃 ${uploadTimeout / 1000}초로 설정`);
        }
        
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            // 타임아웃 설정 (전체총마감 슬라이드는 더 긴 타임아웃)
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), uploadTimeout);
            
            // FormData를 사용할 때는 Content-Type 헤더를 설정하지 않음 (브라우저가 자동으로 설정)
            const uploadResponse = await fetch(`${API_BASE_URL}/api/meetings/${meeting.meetingId}/upload-image`, {
              method: 'POST',
              body: formData,
              // CORS 에러 방지를 위한 옵션
              mode: 'cors',
              credentials: 'omit',
              signal: abortController.signal
            }).catch((fetchError) => {
              clearTimeout(timeoutId);
              // 네트워크 에러를 명시적으로 처리
              if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
                const timeoutError = new Error('요청 시간이 초과되었습니다.');
                timeoutError.status = 504;
                timeoutError.isNetworkError = true;
                throw timeoutError;
              }
              const networkError = new Error(`네트워크 오류: ${fetchError.message}`);
              networkError.isNetworkError = true;
              networkError.originalError = fetchError;
              throw networkError;
            });
            
            clearTimeout(timeoutId);

            // 응답이 없거나 CORS 에러인 경우
            if (!uploadResponse || uploadResponse.type === 'opaque' || uploadResponse.type === 'opaqueredirect') {
              const corsError = new Error('CORS 정책으로 인해 요청이 차단되었습니다.');
              corsError.isNetworkError = true;
              throw corsError;
            }

            if (!uploadResponse.ok) {
              // 502, 503, 504는 재시도 가능한 에러
              if ([502, 503, 504].includes(uploadResponse.status)) {
                const serverError = new Error(`서버 오류 (HTTP ${uploadResponse.status})`);
                serverError.status = uploadResponse.status;
                serverError.isNetworkError = false;
                throw serverError;
              }
              
              const errorText = await uploadResponse.text().catch(() => '알 수 없는 오류');
              const error = new Error(`이미지 업로드 실패 (HTTP ${uploadResponse.status}): ${errorText}`);
              error.status = uploadResponse.status;
              error.isNetworkError = false;
              throw error;
            }

            return uploadResponse;
          } catch (error) {
            lastError = error;
            
            // 네트워크 에러 또는 CORS 에러인지 확인
            const isNetworkError = error.isNetworkError || 
                                   error.message.includes('fetch') || 
                                   error.message.includes('network') || 
                                   error.message.includes('Failed to fetch') ||
                                   error.message.includes('CORS') ||
                                   error.message.includes('시간이 초과') ||
                                   (!error.status && error.name !== 'AbortError');
            
            // 재시도 가능한 에러인지 확인 (502, 503, 504 또는 네트워크 에러)
            const isRetryableError = isNetworkError || 
                                     (error.status && [502, 503, 504].includes(error.status));
            
            if (attempt === retries || !isRetryableError) {
              // 마지막 시도 실패 시 상세한 에러 메시지
              if (isNetworkError || error.message.includes('CORS')) {
                throw new Error(`네트워크 연결 오류로 이미지 업로드에 실패했습니다. (${attempt}회 시도) 인터넷 연결을 확인해주세요.`);
              } else if (error.status === 413) {
                throw new Error(`이미지 파일이 너무 큽니다. 파일 크기를 줄여주세요.`);
              } else if (error.status === 502) {
                throw new Error(`서버 게이트웨이 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`);
              } else if (error.status === 503) {
                throw new Error(`서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.`);
              } else if (error.status === 504) {
                throw new Error(`서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.`);
              } else if (error.status === 500) {
                throw new Error(`서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`);
              } else {
                throw new Error(`이미지 업로드 실패 (${attempt}회 시도): ${error.message}`);
              }
            }
            
            // 지수 백오프: delay * 2^(attempt-1)
            const delay = baseDelay * Math.pow(2, attempt - 1);
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ [MeetingCaptureManager] 슬라이드 ${index + 1} 업로드 재시도 ${attempt}/${retries} (${delay}ms 대기):`, error.message);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        // 이 코드는 실행되지 않아야 하지만 타입 안전성을 위해
        throw lastError || new Error('알 수 없는 오류가 발생했습니다.');
      };

      const uploadResponse = await uploadWithRetry();

      const uploadResult = await uploadResponse.json();
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ [MeetingCaptureManager] 슬라이드 ${index + 1} 업로드 완료:`, uploadResult.imageUrl);
      }

      // 현재 상태를 기반으로 슬라이드 배열 업데이트 (이전 슬라이드 정보 유지)
      // setState의 함수형 업데이트를 사용하여 최신 상태 보장
      let updatedSlides = null;
      
      setSlidesState(prevSlides => {
        updatedSlides = prevSlides.map((s, i) => 
          i === index ? {
            ...s,
            imageUrl: uploadResult.imageUrl,
            capturedAt: new Date().toISOString(),
            discordPostId: uploadResult.postId || '',
            discordThreadId: uploadResult.threadId || ''
          } : s // 이전 슬라이드는 그대로 유지
        );
        
        console.log(`💾 [MeetingCaptureManager] 슬라이드 ${index + 1} 상태 업데이트, 전체 슬라이드 수: ${updatedSlides?.length || 0}`);
        if (updatedSlides && Array.isArray(updatedSlides)) {
          console.log(`💾 [MeetingCaptureManager] 저장할 슬라이드 URL들:`, updatedSlides.map(s => ({ 
            order: s.order, 
            slideId: s.slideId,
            url: s.imageUrl || '없음',
            hasUrl: !!s.imageUrl
          })));
        }
        
        return updatedSlides;
      });
      
      // setState가 완료될 때까지 대기 (다음 이벤트 루프에서 실행)
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // updatedSlides가 null이면 다시 가져오기
      if (!updatedSlides) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ [MeetingCaptureManager] updatedSlides가 null, 재시도...`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        // 최신 상태를 다시 가져오기
        setSlidesState(prevSlides => {
          updatedSlides = prevSlides.map((s, i) => 
            i === index ? {
              ...s,
              imageUrl: uploadResult.imageUrl,
              capturedAt: new Date().toISOString(),
              discordPostId: uploadResult.postId || '',
              discordThreadId: uploadResult.threadId || ''
            } : s
          );
          return updatedSlides;
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // 검증: updatedSlides가 배열인지 확인
      if (!Array.isArray(updatedSlides)) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`❌ [MeetingCaptureManager] updatedSlides가 배열이 아닙니다:`, typeof updatedSlides, updatedSlides);
        }
        throw new Error('슬라이드 배열을 생성할 수 없습니다.');
      }
      
      // 각 슬라이드에 필수 필드가 있는지 확인
      const validatedSlides = updatedSlides.map((slide, idx) => {
        if (!slide.slideId) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ [MeetingCaptureManager] 슬라이드 ${idx + 1}에 slideId가 없습니다.`, slide);
          }
          slide.slideId = slide.slideId || `slide-${slide.order || idx + 1}`;
        }
        if (slide.order === undefined || slide.order === null) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ [MeetingCaptureManager] 슬라이드 ${idx + 1}에 order가 없습니다.`, slide);
          }
          slide.order = slide.order || idx + 1;
        }
        return slide;
      });
      
      // 전체 슬라이드 배열을 한 번에 저장 (이전 슬라이드 URL 유지)
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log(`💾 [MeetingCaptureManager] 슬라이드 ${index + 1} 저장 시작, 검증된 슬라이드 수: ${validatedSlides.length}`);
        }
        // 메인/엔딩 슬라이드는 항상 현재 회의 차수로 덮어쓰기 (차수 누락/불일치 방지)
        const slidesToSave = validatedSlides.map(s => {
          if (s && (s.type === 'main' || s.type === 'ending')) {
            return {
              ...s,
              meetingNumber: s.meetingNumber != null ? s.meetingNumber : (meeting?.meetingNumber ?? null)
            };
          }
          return s;
        });
        // 저장 재시도 래퍼 (api.saveMeetingConfig에 이미 재시도 로직이 있지만, 추가 안전장치)
        const saveWithRetry = async (payload, retries = 3, baseDelay = 800) => {
          let lastErr = null;
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              // api.saveMeetingConfig는 이미 내부적으로 재시도 로직을 가지고 있음
              // 하지만 여기서도 추가 재시도를 제공하여 더 안정적인 저장 보장
              return await api.saveMeetingConfig(meeting.meetingId, payload, 2, baseDelay);
            } catch (e) {
              lastErr = e;
              // 5xx 또는 네트워크 계열만 백오프 재시도
              const msg = (e && e.message) ? e.message : '';
              const isNetworkOr5xx = /Failed to fetch|network|5\d\d|서버 오류|저장 실패|CORS|게이트웨이|일시적으로|응답 시간/i.test(msg);
              if (attempt === retries || !isNetworkOr5xx) break;
              const delay = baseDelay * Math.pow(2, attempt - 1);
              if (process.env.NODE_ENV === 'development') {
                console.warn(`⚠️ [MeetingCaptureManager] 슬라이드 저장 재시도 ${attempt}/${retries} (${delay}ms 대기):`, msg);
              }
              await new Promise(r => setTimeout(r, delay));
            }
          }
          throw lastErr || new Error('회의 설정 저장 실패');
        };

        await saveWithRetry({
          slides: slidesToSave
        });
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ [MeetingCaptureManager] 슬라이드 ${index + 1} 저장 완료`);
        }
      } catch (err) {
        console.error(`❌ [MeetingCaptureManager] 슬라이드 ${index + 1} 저장 실패:`, err);
        if (process.env.NODE_ENV === 'development') {
          console.error(`❌ [MeetingCaptureManager] 저장 시도한 슬라이드 데이터:`, validatedSlides);
        }
        throw err; // 에러를 다시 throw하여 상위에서 처리할 수 있도록
      }

      // 언마운트 체크 후 상태 업데이트
      if (isMountedRef.current) {
        setCompleted(prev => prev + 1);
        
        // 다음 슬라이드로 이동
        setTimeout(() => {
          if (isMountedRef.current) {
            captureNextSlide(index + 1);
          }
        }, 500);
      }
    } catch (error) {
      console.error(`❌ [MeetingCaptureManager] 슬라이드 ${index + 1} 캡처 오류:`, error);
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ [MeetingCaptureManager] 오류 상세:`, {
          slideId: slidesState && slidesState[index] ? slidesState[index].slideId : 'unknown',
          index: index,
          errorMessage: error.message,
          errorStack: error.stack,
          slideType: slidesState && slidesState[index] ? slidesState[index].type : 'unknown',
          slideMode: slidesState && slidesState[index] ? slidesState[index].mode : 'unknown'
        });
      }
      
      // 사용자 친화적인 에러 메시지 생성
      let userFriendlyMessage = `슬라이드 ${index + 1} 캡처 실패`;
      
      if (error.message.includes('네트워크') || error.message.includes('연결')) {
        userFriendlyMessage += ': 네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
      } else if (error.message.includes('업로드')) {
        if (error.message.includes('너무 큽니다')) {
          userFriendlyMessage += ': 이미지 파일이 너무 큽니다. 파일 크기를 줄여주세요.';
        } else if (error.message.includes('서버 오류')) {
          userFriendlyMessage += ': 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else {
          userFriendlyMessage += ': 이미지 업로드 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.';
        }
      } else if (error.message.includes('캡처') || error.message.includes('요소를 찾을 수 없습니다')) {
        userFriendlyMessage += ': 화면 캡처 중 오류가 발생했습니다. 페이지를 새로고침하고 다시 시도해주세요.';
      } else if (error.message.includes('슬라이드 데이터가 없습니다')) {
        userFriendlyMessage += ': 슬라이드 데이터를 찾을 수 없습니다. 회의 설정을 확인해주세요.';
      } else {
        userFriendlyMessage += `: ${error.message}`;
      }
      
      setFailed(prev => {
        // 기존 실패 항목 제거 (같은 슬라이드가 다시 실패한 경우)
        const filtered = prev.filter(f => {
          if (typeof f === 'object') {
            return f.slideIndex !== index + 1;
          }
          return f !== index + 1;
        });
        return [...filtered, {
          slideIndex: index + 1,
          slideId: slidesState && slidesState[index] ? slidesState[index].slideId : 'unknown',
          error: userFriendlyMessage,
          timestamp: new Date().toISOString()
        }];
      });
      
      // 오류가 발생해도 슬라이드 상태는 저장 (imageUrl은 없지만)
      try {
        if (slidesState && Array.isArray(slidesState) && slidesState[index]) {
          const currentSlide = slidesState[index];
          setSlidesState(prevSlides => {
            const updatedSlides = prevSlides.map((s, i) => 
              i === index ? {
                ...s,
                // imageUrl은 업데이트하지 않음 (오류 발생)
                capturedAt: new Date().toISOString()
              } : s
            );
            return updatedSlides;
          });
          
          // 슬라이드 상태 저장 (imageUrl 없이)
          await new Promise(resolve => setTimeout(resolve, 100));
          setSlidesState(prevSlides => {
            const validatedSlides = prevSlides.map((slide, idx) => {
              if (!slide.slideId) {
                slide.slideId = slide.slideId || `slide-${slide.order || idx + 1}`;
              }
              if (slide.order === undefined || slide.order === null) {
                slide.order = slide.order || idx + 1;
              }
              return slide;
            });
            
            // 비동기로 저장 (await 없이) + 간단 재시도
            (async () => {
              const max = 3;
              for (let a = 1; a <= max; a++) {
                try {
                  await api.saveMeetingConfig(meeting.meetingId, { slides: validatedSlides });
                  break;
                } catch (err) {
                  const delay = 600 * Math.pow(2, a - 1);
                  console.error(`❌ [MeetingCaptureManager] 슬라이드 상태 저장 실패 (재시도 ${a}/${max}):`, err?.message || err);
                  if (a === max) break;
                  await new Promise(r => setTimeout(r, delay));
                }
              }
            })();
            
            return prevSlides;
          });
        }
      } catch (saveError) {
        console.error(`❌ [MeetingCaptureManager] 오류 처리 중 저장 실패:`, saveError);
      }
      
      // 실패해도 다음 슬라이드로 진행 (언마운트 체크 포함)
      setTimeout(() => {
        if (isMountedRef.current) {
          captureNextSlide(index + 1);
        }
      }, 1000);
    }
  };

  const handleSlideReady = () => {
    setSlideReady(true);
  };

  const handleCancel = () => {
    setCapturing(false);
    if (onCancel) {
      onCancel();
    }
  };

  // 일시정지/재개
  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  // 실패한 슬라이드 재시도
  const handleRetryFailed = async (slideIndex) => {
    // 배열 범위 체크 강화
    if (!slidesState || !Array.isArray(slidesState) || slideIndex < 0 || slideIndex >= slidesState.length) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [MeetingCaptureManager] 유효하지 않은 재시도 인덱스: ${slideIndex}, 배열 길이: ${slidesState?.length || 0}`);
      }
      return;
    }

    // 재시도 중인 슬라이드에 추가
    setRetryingSlides(prev => new Set([...prev, slideIndex]));

    // 실패 목록에서 제거
    setFailed(prev => prev.filter(f => {
      if (typeof f === 'object') {
        return f.slideIndex !== slideIndex + 1;
      }
      return f !== slideIndex + 1;
    }));

    // 해당 슬라이드 재캡처
    try {
      await captureNextSlide(slideIndex);
    } catch (error) {
      console.error(`❌ [MeetingCaptureManager] 슬라이드 ${slideIndex + 1} 재시도 실패:`, error);
      // 재시도 실패 시 다시 실패 목록에 추가
      setFailed(prev => {
        const filtered = prev.filter(f => {
          if (typeof f === 'object') {
            return f.slideIndex !== slideIndex + 1;
          }
          return f !== slideIndex + 1;
        });
        return [...filtered, {
          slideIndex: slideIndex + 1,
          slideId: slidesState && slidesState[slideIndex] ? slidesState[slideIndex].slideId : 'unknown',
          error: `재시도 실패: ${error.message}`,
          timestamp: new Date().toISOString()
        }];
      });
    } finally {
      // 재시도 완료
      setRetryingSlides(prev => {
        const next = new Set(prev);
        next.delete(slideIndex);
        return next;
      });
    }
  };

  if (!capturing) {
    return null;
  }

  return (
    <>
      <CaptureProgress
        open={capturing}
        total={slidesState && Array.isArray(slidesState) ? slidesState.length : 0}
        current={currentSlideIndex + 1}
        completed={completed}
        failed={failed}
        onCancel={handleCancel}
        slides={slidesState || []}
        startTime={startTime}
        onRetryFailed={handleRetryFailed}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
        onEditImageLink={async (slideIndex, newUrl) => {
          try {
            // 배열 범위 체크
            if (!slidesState || !Array.isArray(slidesState) || slideIndex < 0 || slideIndex >= slidesState.length) {
              alert('유효하지 않은 슬라이드 인덱스입니다.');
              return;
            }
            
            const slide = slidesState[slideIndex];
            if (!slide) return;
            
            await api.updateSlideImageUrl(meeting.meetingId, slide.slideId, newUrl);
            
            // 언마운트 체크 후 상태 갱신
            if (isMountedRef.current) {
              setSlidesState(prev => prev.map((s, i) => i === slideIndex ? { ...s, imageUrl: newUrl } : s));
            }
          } catch (e) {
            alert(`링크 수정 실패: ${e.message}`);
          }
        }}
      />

      {/* 현재 슬라이드만 렌더링 (메모리 최적화) */}
      {slidesState && Array.isArray(slidesState) && slidesState[currentSlideIndex] && (
        <SlideRenderer
          key={`slide-${currentSlideIndex}-${slidesState[currentSlideIndex].slideId || currentSlideIndex}`}
          slide={slidesState[currentSlideIndex]}
          loggedInStore={loggedInStore}
          onReady={handleSlideReady}
        />
      )}
      
    </>
  );
}

export default MeetingCaptureManager;

