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
      setSlidesState(slides);
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [MeetingCaptureManager] slides가 배열이 아닙니다:`, slides);
      }
      setSlidesState([]);
    }
  }, [slides]);

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

      // 특정 상세옵션 선택 시: 섹션 펼치기 및 타겟 요소만 캡처
      // 메인/목차는 헤더 포함 전체 슬라이드를 캡처 (공백은 autoCropCanvas로 처리)
      let captureTargetElement = slideElement;
      try {
        // csDetailType이 배열인 경우 첫 번째 값 사용, 단일 값인 경우 그대로 사용
        const csDetailTypeRaw = currentSlide?.detailOptions?.csDetailType;
        const csDetailType = Array.isArray(csDetailTypeRaw) ? csDetailTypeRaw[0] : csDetailTypeRaw;
        if (currentSlide?.mode === 'chart' && csDetailType && csDetailType !== 'all') {
          // 모든 '펼치기' 버튼 클릭 시도 (중복 클릭은 안전)
          Array.from(document.querySelectorAll('button, .MuiButton-root'))
            .filter(el => typeof el.textContent === 'string' && el.textContent.includes('펼치기'))
            .forEach(el => el.click());
          
          const findHeader = (startsWithList) => {
            const candidates = Array.from(document.querySelectorAll('h6, .MuiTypography-h6, .MuiBox-root, div'));
            for (const el of candidates) {
              const txt = (el.textContent || '').trim();
              if (!txt) continue;
              for (const s of (Array.isArray(startsWithList) ? startsWithList : [startsWithList])) {
                if (txt.startsWith(s)) return el;
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
          
          if (csDetailType === 'cs') {
            // CS 개통 실적: 헤더 + 카드들 + 직원 랭킹 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaper('📞 CS 개통 실적');
            if (!paperElement) {
              const errorMsg = 'CS 개통 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailType, slideId: currentSlide.slideId });
              }
              captureTargetElement = slideElement;
            } else {
              // Paper 전체를 캡처 (헤더 + 카드들 + 직원 랭킹 모두 포함)
              captureTargetElement = paperElement;
            }
          } else if (csDetailType === 'code') {
            // 코드별 실적: 헤더 + 테이블 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaper('📊 코드별 실적');
            if (!paperElement) {
              const errorMsg = '코드별 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailType, slideId: currentSlide.slideId });
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
          } else if (csDetailType === 'office') {
            // 사무실별 실적: 헤더 + 테이블 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaper('🏢 사무실별 실적');
            if (!paperElement) {
              const errorMsg = '사무실별 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailType, slideId: currentSlide.slideId });
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
          } else if (csDetailType === 'department') {
            // 소속별 실적: 헤더 + 테이블 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaper('👥 소속별 실적');
            if (!paperElement) {
              const errorMsg = '소속별 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailType, slideId: currentSlide.slideId });
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
          } else if (csDetailType === 'agent') {
            // 담당자별 실적: 헤더 + 테이블 전체를 포함하는 Paper 컴포넌트 캡처
            const paperElement = findSectionPaperArray(['🧑 담당자별 실적', '👤 담당자별 실적']);
            if (!paperElement) {
              const errorMsg = '담당자별 실적 섹션을 찾을 수 없습니다.';
              if (process.env.NODE_ENV === 'development') {
                console.error(`❌ [MeetingCaptureManager] ${errorMsg}`, { csDetailType, slideId: currentSlide.slideId });
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

        // 재고장표: "총계" 헤더부터 스크롤 밑단까지 모든 데이터 캡처
        if (
          (currentSlide?.mode === 'inventoryChart') ||
          (currentSlide?.mode === 'chart' && (currentSlide?.tab === 'inventoryChart' || currentSlide?.subTab === 'inventoryChart'))
        ) {
          // 모든 '펼치기' 버튼 클릭
          Array.from(document.querySelectorAll('button, .MuiButton-root'))
            .filter(el => typeof el.textContent === 'string' && el.textContent.includes('펼치기'))
            .forEach(el => el.click());
          
          await new Promise(r => setTimeout(r, 300)); // 펼치기 후 렌더링 대기

          // "총계" 헤더를 찾아서 그 테이블 컨테이너 찾기
          const totalHeader = Array.from(slideElement.querySelectorAll('th, .MuiTableCell-head'))
            .find(el => {
              const text = (el.textContent || '').trim();
              return text === '총계';
            });
          
          let tableContainer = null;
          
          if (totalHeader) {
            // "총계" 헤더가 속한 테이블 컨테이너 찾기
            let current = totalHeader.parentElement; // TableRow
            while (current && current !== slideElement) {
              // TableHead 또는 TableContainer 찾기
              if (current.classList.contains('MuiTableContainer-root') || 
                  current.querySelector('.MuiTableContainer-root')) {
                tableContainer = current.classList.contains('MuiTableContainer-root') 
                  ? current 
                  : current.querySelector('.MuiTableContainer-root');
                break;
              }
              // TableHead의 부모인 Table 찾기
              if (current.tagName === 'TABLE' || current.classList.contains('MuiTable-root')) {
                // Table의 부모인 TableContainer 찾기
                let parent = current.parentElement;
                while (parent && parent !== slideElement) {
                  if (parent.classList.contains('MuiTableContainer-root')) {
                    tableContainer = parent;
                    break;
                  }
                  parent = parent.parentElement;
                }
                if (tableContainer) break;
              }
              current = current.parentElement;
            }
          }
          
          // "총계" 헤더를 찾지 못한 경우, 일반 테이블 컨테이너 찾기
          if (!tableContainer) {
            tableContainer = slideElement.querySelector('.MuiTableContainer-root') || slideElement.querySelector('table');
          }
          
          if (tableContainer) {
            // 스크롤 가능한 테이블의 경우, 전체 스크롤 영역 캡처를 위해 스타일 조정
            if (tableContainer.classList.contains('MuiTableContainer-root')) {
              // 스크롤을 없애고 전체 높이로 확장하여 모든 데이터 표시
              const originalMaxHeight = tableContainer.style.maxHeight;
              const originalOverflow = tableContainer.style.overflow;
              
              tableContainer.style.maxHeight = 'none';
              tableContainer.style.overflow = 'visible';
              
              // 스타일 변경 후 렌더링 대기
              await new Promise(r => setTimeout(r, 300));
              
              // "총계" 헤더로 스크롤
              if (totalHeader) {
                try {
                  totalHeader.scrollIntoView({ block: 'start', behavior: 'instant' });
                  await new Promise(r => setTimeout(r, 200));
                } catch {}
              }
              
              captureTargetElement = tableContainer;
              
              // 캡처 후 원래 스타일 복원 (선택사항)
              // tableContainer.style.maxHeight = originalMaxHeight;
              // tableContainer.style.overflow = originalOverflow;
            } else {
              captureTargetElement = tableContainer;
              try { 
                if (totalHeader) {
                  totalHeader.scrollIntoView({ block: 'start', behavior: 'instant' });
                } else {
                  tableContainer.scrollIntoView({ block: 'center', behavior: 'instant' });
                }
              } catch {}
              await new Promise(r => setTimeout(r, 400));
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
          try {
            const maxWait = 7000; // 대기 시간 증가 (5초 → 7초)
            const start = Date.now();
            let chartCount = 0;
            let barChartFound = false;
            let lineChartFound = false;
            
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
                  }
                }
                // 선 그래프 확인 (Line 차트는 "조회 월 선택" 텍스트가 있는 Paper에 있음)
                if (paperText.includes('조회 월 선택')) {
                  const lineChart = paper.querySelector('canvas, svg, [class*="recharts"], [class*="Line"]');
                  if (lineChart) {
                    lineChartFound = true;
                  }
                }
              }
              
              // 막대 그래프와 선 그래프가 모두 렌더링되었는지 확인
              if (barChartFound && lineChartFound && chartCount >= 2) {
                if (process.env.NODE_ENV === 'development') {
                  console.log('✅ [MeetingCaptureManager] 재초담초채권 그래프 모두 렌더링 완료');
                }
                break;
              }
              
              // 선 그래프 Paper로 스크롤하여 강제 렌더링 유도
              if (!lineChartFound) {
                try { 
                  const linePaper = Array.from(papers).find(p => (p.textContent || '').includes('조회 월 선택'));
                  if (linePaper) {
                    linePaper.scrollIntoView({ block: 'center', behavior: 'instant' });
                    // 스크롤 후 잠시 대기
                    await new Promise(r => setTimeout(r, 300));
                  }
                } catch {}
              }
              
              await new Promise(r => setTimeout(r, 200));
            }
            
            // 최종 확인: 선 그래프가 없으면 추가 대기 및 경고
            if (!lineChartFound) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ [MeetingCaptureManager] 재초담초채권 선 그래프를 찾을 수 없습니다. 추가 대기 중...');
              }
              // 선 그래프 Paper로 다시 스크롤하고 추가 대기
              const papers = slideElement.querySelectorAll('.MuiPaper-root');
              const linePaper = Array.from(papers).find(p => (p.textContent || '').includes('조회 월 선택'));
              if (linePaper) {
                linePaper.scrollIntoView({ block: 'center', behavior: 'instant' });
                await new Promise(r => setTimeout(r, 1500));
              } else {
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 재초담초채권 그래프 대기 중 경고:', e?.message);
            }
          }
        }

        // 채권장표 > 가입자증감: '년단위' 토글 + 최신 연도 선택 (이 부분은 캡처 타겟 선택에만 사용)
        if (
          currentSlide?.mode === 'chart' &&
          (currentSlide?.tab === 'bondChart' || currentSlide?.tab === 'bond') &&
          (currentSlide?.subTab === 'subscriberIncrease')
        ) {
          // 1) '년단위' 토글 보장
          try {
            const yearBtn = Array.from(document.querySelectorAll('button, [role="button"]'))
              .find(el => (el.textContent || '').includes('년단위'));
            if (yearBtn && yearBtn.getAttribute('aria-pressed') !== 'true') {
              (yearBtn instanceof HTMLElement) && yearBtn.click();
              await new Promise(r => setTimeout(r, 300));
            }
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 년단위 토글 중 경고:', e?.message);
            }
          }
          
          // 2) 대상 년도 선택 (더 정확한 선택)
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
                selectElement = Array.from(document.querySelectorAll('[role="combobox"], .MuiSelect-select'))
                  .find(el => {
                    const parentText = (el.closest('.MuiFormControl-root')?.textContent || '') + 
                                     (el.parentElement?.textContent || '');
                    return parentText.includes('대상') && parentText.includes('년도');
                  });
              }
              
              if (selectElement && selectElement instanceof HTMLElement) {
                selectElement.click();
                await new Promise(r => setTimeout(r, 300));
                
                // 첫 번째 옵션 선택 (가장 최근 연도)
                const listbox = document.querySelector('[role="listbox"]');
                if (listbox) {
                  const firstOpt = listbox.querySelector('[role="option"]');
                  if (firstOpt && firstOpt instanceof HTMLElement) {
                    selectedYearText = (firstOpt.textContent || '').trim();
                    firstOpt.click();
                    await new Promise(r => setTimeout(r, 800)); // 데이터 로드 대기
                    
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`✅ [MeetingCaptureManager] 가입자증감 연도 선택 완료: ${selectedYearText}`);
                    }
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
          
          // 이 부분은 캡처 타겟 선택에만 사용 (실제 캡처는 아래 compositeBlob 부분에서 처리)
          // captureTargetElement는 아래에서 설정하지 않음 (compositeBlob 사용)
        }
      } catch (e) {
        console.warn('⚠️ [MeetingCaptureManager] 상세옵션 타겟 선택 중 경고:', e?.message);
      }

      // 재고장표 특수 처리: 모든 '펼치기' 확장 및 표 전체 보이도록 스타일 조정
      try {
        if (currentSlide?.mode === 'inventoryChart') {
          Array.from(document.querySelectorAll('button, .MuiButton-root'))
            .filter(el => typeof el.textContent === 'string' && el.textContent.includes('펼치기'))
            .forEach(el => el.click());
          // 표 컨테이너 찾기
          const invTable = slideElement.querySelector('.MuiTableContainer-root') || slideElement.querySelector('table');
          if (invTable) {
            captureTargetElement = invTable;
            // 스크롤을 없애고 전체 높이로 확장
            invTable.style.maxHeight = 'none';
            invTable.style.overflow = 'visible';
          }
          // 확장 후 렌더 안정화 짧게 대기
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (e) {
        console.warn('⚠️ [MeetingCaptureManager] 재고장표 확장 처리 중 경고:', e?.message);
      }

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
            
            const commonAncestor = findCommonAncestor(tables);
            
            if (commonAncestor && commonAncestor !== slideElement) {
              // 공통 조상이 있으면 전체를 한 번에 캡처 (슬라이드 헤더 포함)
              commonAncestor.scrollIntoView({ block: 'start', behavior: 'instant' });
              await new Promise(r => setTimeout(r, 500));
              
              monthlyAwardCompositeBlob = await captureElement(commonAncestor, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0
              });
              
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ [MeetingCaptureManager] 월간시상 전체 영역 캡처 완료 (슬라이드 헤더 포함)');
              }
            } else {
              // 공통 조상을 찾지 못한 경우, 각 테이블을 개별 캡처 후 합치기
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
                    backgroundColor: '#ffffff',
                    scrollX: 0,
                    scrollY: 0
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
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [MeetingCaptureManager] 월간시상 테이블을 찾을 수 없습니다.');
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
          if (tablePaper) {
            tablePaper.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 500));
            
            tableBlob = await captureElement(tablePaper, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              scrollX: 0,
              scrollY: 0
            });
            
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
          const chartPapersAll = Array.from(slideElement.querySelectorAll('.MuiPaper-root, .MuiCardContent-root'));
          const chartPapers = chartPapersAll.filter(paper => {
            const text = paper.textContent || '';
            return (text.includes('가입자수 추이') || text.includes('관리수수료 추이')) &&
                   !text.includes('대상 년도') && 
                   !text.includes('시간 단위') &&
                   !text.includes('표시 모드') &&
                   !text.includes('가입자증감 관리'); // 중복 헤더 제외
          });
          
          let graphBlob = null;
          if (chartPapers.length >= 2) {
            // 두 그래프 Paper의 공통 조상 찾기
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
              return common.find(el => el !== document.body && slideElement.contains(el)) || slideElement;
            };
            
            const graphAncestor = findCommonAncestor(chartPapers);
            
            if (graphAncestor) {
              // 그래프 영역으로 스크롤
              graphAncestor.scrollIntoView({ block: 'center', behavior: 'instant' });
              await new Promise(r => setTimeout(r, 500));
              
              graphBlob = await captureElement(graphAncestor, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0
              });
              
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ [MeetingCaptureManager] 가입자증감 그래프 캡처 완료');
              }
            } else {
              // 공통 조상을 찾지 못한 경우, 두 Paper를 각각 캡처 후 합치기
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ [MeetingCaptureManager] 공통 조상을 찾지 못해 각각 캡처합니다.');
              }
              
              const chart1Blob = await captureElement(chartPapers[0], {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0
              });
              
              chartPapers[1].scrollIntoView({ block: 'center', behavior: 'instant' });
              await new Promise(r => setTimeout(r, 500));
              
              const chart2Blob = await captureElement(chartPapers[1], {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0
              });
              
              const img1 = await blobToImage(chart1Blob);
              const img2 = await blobToImage(chart2Blob);
              const gap = 16;
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(img1.width, img2.width);
              canvas.height = img1.height + gap + img2.height;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img1, 0, 0);
              ctx.drawImage(img2, 0, img1.height + gap);
              
              graphBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ [MeetingCaptureManager] 가입자증감 그래프 Paper를 찾을 수 없습니다. (찾은 개수: ${chartPapers.length})`);
            }
          }
          
          // 3) 테이블과 그래프를 세로로 합치기
          if (tableBlob && graphBlob) {
            const imgTable = await blobToImage(tableBlob);
            const imgGraph = await blobToImage(graphBlob);
            const gap = 16;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(imgTable.width, imgGraph.width);
            canvas.height = imgTable.height + gap + imgGraph.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imgTable, 0, 0);
            ctx.drawImage(imgGraph, 0, imgTable.height + gap);
            
            compositeBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [MeetingCaptureManager] 가입자증감 테이블+그래프 합성 완료');
            }
          } else if (tableBlob) {
            // 테이블만 있는 경우
            compositeBlob = tableBlob;
          } else if (graphBlob) {
            // 그래프만 있는 경우
            compositeBlob = graphBlob;
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
        
      const blob = monthlyAwardCompositeBlob || compositeBlob || await captureElement(captureTargetElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: backgroundColor,
        // 스크롤 영역 전체 캡처
        scrollX: 0,
        scrollY: 0
      });
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
        
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            // 타임아웃 설정 (30초)
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 30000);
            
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
          slides: validatedSlides
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

