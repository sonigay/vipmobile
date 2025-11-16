import React, { useState, useRef, useEffect } from 'react';
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

  useEffect(() => {
    if (slidesState && Array.isArray(slidesState) && slidesState.length > 0 && !capturing) {
      startCapture();
    }
  }, [slidesState]);

  const startCapture = async () => {
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
  };

  const captureNextSlide = async (index) => {
    // 일시정지 상태면 대기
    while (isPaused) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!slidesState || !Array.isArray(slidesState) || index >= slidesState.length) {
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
      // 슬라이드 데이터 검증
      if (!slidesState || !Array.isArray(slidesState) || !slidesState[index]) {
        throw new Error(`슬라이드 데이터가 없습니다. (index: ${index}, slidesState: ${slidesState ? 'exists' : 'null'})`);
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
      let captureTargetElement = slideElement;
      try {
        const csDetailType = currentSlide?.detailOptions?.csDetailType;
        if (currentSlide?.mode === 'chart' && csDetailType) {
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
          
          if (csDetailType === 'cs') {
            const header = findHeader('📞 CS 개통 실적');
            const metricsBox = header?.nextElementSibling;
            captureTargetElement = (metricsBox || header?.parentElement || captureTargetElement);
          } else if (csDetailType === 'code') {
            const header = findHeader('📊 코드별 실적');
            // 표 컨테이너(.MuiTableContainer-root)가 뒤따름
            const table = header
              ? header.parentElement?.querySelector('.MuiTableContainer-root') ||
                header.nextElementSibling?.classList?.contains('MuiTableContainer-root') ? header.nextElementSibling : null
              : null;
            if (table) captureTargetElement = table;
          } else if (csDetailType === 'office') {
            const header = findHeader('🏢 사무실별 실적');
            const table = header
              ? header.parentElement?.querySelector('.MuiTableContainer-root') ||
                header.nextElementSibling?.classList?.contains('MuiTableContainer-root') ? header.nextElementSibling : null
              : null;
            if (table) captureTargetElement = table;
          } else if (csDetailType === 'department') {
            const header = findHeader('👥 소속별 실적');
            const table = header
              ? header.parentElement?.querySelector('.MuiTableContainer-root') ||
                header.nextElementSibling?.classList?.contains('MuiTableContainer-root') ? header.nextElementSibling : null
              : null;
            if (table) captureTargetElement = table;
          } else if (csDetailType === 'agent') {
            // 환경에 따라 아이콘이 '🧑' 또는 '👤'로 표시됨
            const header = findHeader(['🧑 담당자별 실적', '👤 담당자별 실적']);
            const table = header
              ? header.parentElement?.querySelector('.MuiTableContainer-root') ||
                header.nextElementSibling?.classList?.contains('MuiTableContainer-root') ? header.nextElementSibling : null
              : null;
            if (table) captureTargetElement = table;
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

        // 지표장표 > 월간시상: '확대' 후 가장 큰 테이블만 캡쳐하고 여백 최소화
        if (
          currentSlide?.mode === 'chart' &&
          (currentSlide?.tab === 'indicatorChart' || currentSlide?.subTab === 'monthlyAward')
        ) {
          try {
            const expandBtn = Array.from(document.querySelectorAll('button, .MuiButton-root')).find(
              (el) => typeof el.textContent === 'string' && el.textContent.trim() === '확대'
            );
            if (expandBtn) {
              expandBtn.click();
              await new Promise(r => setTimeout(r, 600));
            }
          } catch {}

          const tables = Array.from(slideElement.querySelectorAll('.MuiTableContainer-root, table'));
          if (tables.length > 0) {
            let biggest = tables[0];
            let maxArea = 0;
            tables.forEach(t => {
              const rect = t.getBoundingClientRect();
              const area = rect.width * rect.height;
              if (area > maxArea) { maxArea = area; biggest = t; }
            });
            captureTargetElement = biggest || captureTargetElement;
            try { captureTargetElement.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch {}
            await new Promise(r => setTimeout(r, 300));
          }
        }

        // 재고장표: 헤더/검색영역 제외하고 실제 테이블만 캡쳐
        if (
          (currentSlide?.mode === 'inventoryChart') ||
          (currentSlide?.mode === 'chart' && (currentSlide?.tab === 'inventoryChart' || currentSlide?.subTab === 'inventoryChart'))
        ) {
          // 모든 '펼치기' 버튼 클릭
          Array.from(document.querySelectorAll('button, .MuiButton-root'))
            .filter(el => typeof el.textContent === 'string' && el.textContent.includes('펼치기'))
            .forEach(el => el.click());

          // 가장 먼저 보이는 테이블 컨테이너를 타겟
          const tableContainer = slideElement.querySelector('.MuiTableContainer-root') || slideElement.querySelector('table');
          if (tableContainer) {
            captureTargetElement = tableContainer;
            try { tableContainer.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch {}
            await new Promise(r => setTimeout(r, 400));
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

          // 그래프 2개가 모두 렌더링될 때까지 대기 (최대 3초), 필요시 두 번째 그래프로 스크롤하여 강제 렌더
          try {
            const maxWait = 3000;
            const start = Date.now();
            let chartCount = 0;
            while (Date.now() - start < maxWait) {
              const charts = slideElement.querySelectorAll('canvas, svg, [class*="recharts"]');
              chartCount = charts.length;
              if (chartCount >= 2) break;
              // 두 번째 그래프가 아래에 있을 수 있으니 하단으로 한번 스크롤 유도
              if (charts.length === 1) {
                try { charts[0].scrollIntoView({ block: 'center', behavior: 'instant' }); } catch {}
              }
              await new Promise(r => setTimeout(r, 150));
            }
          } catch {}
        }

        // 채권장표 > 가입자증감: '년단위' 토글 + 최신 연도 선택 + 필요한 3개 섹션만 포함 캡처
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
              await new Promise(r => setTimeout(r, 200));
            }
          } catch (e) {
            console.warn('⚠️ [MeetingCaptureManager] 년단위 토글 중 경고:', e?.message);
          }
          // 2) 최근 연도 선택 (콤보박스 첫 옵션)
          let selectedYearText = '';
          try {
            const yearCombo = Array.from(document.querySelectorAll('[role="combobox"], .MuiSelect-select'))
              .find(el => (el.textContent || '').includes('년'));
            if (yearCombo) {
              (yearCombo instanceof HTMLElement) && yearCombo.click();
              await new Promise(r => setTimeout(r, 200));
              const firstOpt = document.querySelector('[role="listbox"] [role="option"]');
              if (firstOpt && firstOpt instanceof HTMLElement) {
                selectedYearText = (firstOpt.textContent || '').trim();
                firstOpt.click();
                await new Promise(r => setTimeout(r, 600));
              }
            }
          } catch (e) {
            console.warn('⚠️ [MeetingCaptureManager] 연도 선택 중 경고:', e?.message);
          }
          // 3) 필요한 섹션들 찾기
          const hasText = (el, t) => el && typeof el.textContent === 'string' && el.textContent.includes(t);
          const candidates = Array.from(slideElement.querySelectorAll('.MuiCardContent-root, .MuiBox-root, div'));
          const monthlyInput = candidates.find(el => hasText(el, '월별 데이터 입력'));
          const chart1 = candidates.find(el => hasText(el, '가입자수 추이'));
          const chart2 = candidates.find(el => hasText(el, '관리수수료 추이'));
          const targets = [monthlyInput, chart1, chart2].filter(Boolean);
          // 4) 공통 상위 컨테이너 계산
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
            // slideElement 내부의 가장 가까운 공통 조상 선택
            return common.find(el => el !== document.body && slideElement.contains(el)) || slideElement;
          };
          const ancestor = findCommonAncestor(targets) || slideElement;
          captureTargetElement = ancestor;
          // 5) 우상단에 선택 연도 배지 표시
          try {
            if (selectedYearText) {
              captureTargetElement.style.position = captureTargetElement.style.position || 'relative';
              var yBadge = document.createElement('div');
              yBadge.textContent = `선택 연도: ${selectedYearText}`;
              yBadge.style.position = 'absolute';
              yBadge.style.top = '8px';
              yBadge.style.right = '16px';
              yBadge.style.background = 'rgba(0,0,0,0.6)';
              yBadge.style.color = '#fff';
              yBadge.style.padding = '6px 10px';
              yBadge.style.borderRadius = '8px';
              yBadge.style.fontSize = '12px';
              yBadge.style.fontWeight = '700';
              yBadge.style.zIndex = '20';
              yBadge.style.pointerEvents = 'none';
              captureTargetElement.appendChild(yBadge);
              captureTargetElement.__tempYearBadge = yBadge;
            }
          } catch (e) {
            console.warn('⚠️ [MeetingCaptureManager] 연도 배지 표시 중 경고:', e?.message);
          }
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

      // 가입자증감(특수): 숫자형식 테이블 + 그래프형식 2개를 각각 캡처 후 하나로 세로 합치기
      let compositeBlob = null;
      if (
        currentSlide?.mode === 'chart' &&
        (currentSlide?.tab === 'bondChart' || currentSlide?.tab === 'bond') &&
        (currentSlide?.subTab === 'subscriberIncrease')
      ) {
        try {
          // 표시 모드: 숫자형식 토글 보장
          const numBtn = Array.from(document.querySelectorAll('button, [role="button"]'))
            .find(el => (el.getAttribute?.('value') === 'table') || (el.textContent || '').includes('숫자형식'));
          if (numBtn && numBtn.getAttribute('aria-pressed') !== 'true') {
            (numBtn instanceof HTMLElement) && numBtn.click();
            await new Promise(r => setTimeout(r, 300));
          }

          // 숫자형식 테이블 섹션 찾기
          const candidatesNum = Array.from(slideElement.querySelectorAll('.MuiCardContent-root, .MuiBox-root, div'));
          const monthlyInputNum = candidatesNum.find(el => (el.textContent || '').includes('월별 데이터 입력'));
          const numberTarget = monthlyInputNum || slideElement;

          const numberBlob = await captureElement(numberTarget, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0
          });

          // 표시 모드: 그래프형식으로 전환
          const chartBtn = Array.from(document.querySelectorAll('button, [role="button"]'))
            .find(el => (el.getAttribute?.('value') === 'chart') || (el.textContent || '').includes('그래프형식'));
          if (chartBtn && chartBtn.getAttribute('aria-pressed') !== 'true') {
            (chartBtn instanceof HTMLElement) && chartBtn.click();
            await new Promise(r => setTimeout(r, 500));
          }
          // 그래프 두 개가 렌더될 때까지 대기
          {
            const maxWait = 3000;
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              const graphs = Array.from(slideElement.querySelectorAll('canvas, svg, [class*="recharts"]'));
              if (graphs.length >= 2) break;
              await new Promise(r => setTimeout(r, 150));
            }
          }
          // 그래프 영역 공통 조상 찾기
          const candidatesChart = Array.from(slideElement.querySelectorAll('.MuiCardContent-root, .MuiBox-root, div'));
          const chart1Node = candidatesChart.find(el => (el.textContent || '').includes('가입자수 추이'));
          const chart2Node = candidatesChart.find(el => (el.textContent || '').includes('관리수수료 추이'));
          const graphTargets = [chart1Node, chart2Node].filter(Boolean);
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
          const graphAncestor = findCommonAncestor(graphTargets) || slideElement;

          const graphBlob = await captureElement(graphAncestor, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0
          });

          // 두 이미지를 하나로 합치기 (세로 병합)
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

          const imgNum = await blobToImage(numberBlob);
          const imgGraph = await blobToImage(graphBlob);
          const gap = 16;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(imgNum.width, imgGraph.width);
          canvas.height = imgNum.height + gap + imgGraph.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imgNum, 0, 0);
          ctx.drawImage(imgGraph, 0, imgNum.height + gap);

          compositeBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        } catch (e) {
          console.error('❌ [MeetingCaptureManager] 가입자증감 합성 캡처 실패:', e);
        }
      }

      // 캡처 (선정된 타겟 요소만 캡처)
      const slideType = currentSlide.type || 'mode-tab';
      const backgroundColor = slideType === 'custom' 
        ? (currentSlide.backgroundColor || '#ffffff')
        : slideType === 'main' || slideType === 'toc' || slideType === 'ending'
        ? '#ffffff' // 배경색은 그라데이션이므로 흰색으로 설정
        : '#ffffff';
        
      const blob = compositeBlob || await captureElement(captureTargetElement, {
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

      // 재시도 로직이 포함된 업로드 함수 (지수 백오프 적용)
      const uploadWithRetry = async (retries = 3, baseDelay = 1000) => {
        let lastError = null;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const uploadResponse = await fetch(`${API_BASE_URL}/api/meetings/${meeting.meetingId}/upload-image`, {
              method: 'POST',
              body: formData
            });

            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              const error = new Error(`이미지 업로드 실패 (HTTP ${uploadResponse.status}): ${errorText}`);
              error.status = uploadResponse.status;
              error.isNetworkError = false;
              throw error;
            }

            return uploadResponse;
          } catch (error) {
            lastError = error;
            
            // 네트워크 에러인지 확인
            const isNetworkError = error.message.includes('fetch') || 
                                   error.message.includes('network') || 
                                   error.message.includes('Failed to fetch') ||
                                   !error.status;
            
            if (attempt === retries) {
              // 마지막 시도 실패 시 상세한 에러 메시지
              if (isNetworkError) {
                throw new Error(`네트워크 연결 오류로 이미지 업로드에 실패했습니다. (${retries}회 시도) 인터넷 연결을 확인해주세요.`);
              } else if (error.status === 413) {
                throw new Error(`이미지 파일이 너무 큽니다. 파일 크기를 줄여주세요.`);
              } else if (error.status === 500) {
                throw new Error(`서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`);
              } else {
                throw new Error(`이미지 업로드 실패 (${retries}회 시도): ${error.message}`);
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
        // 저장 재시도 래퍼
        const saveWithRetry = async (payload, retries = 3, baseDelay = 800) => {
          let lastErr = null;
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              return await api.saveMeetingConfig(meeting.meetingId, payload);
            } catch (e) {
              lastErr = e;
              // 5xx 또는 네트워크 계열만 백오프 재시도
              const msg = (e && e.message) ? e.message : '';
              const isNetworkOr5xx = /Failed to fetch|network|5\d\d|서버 오류|저장 실패/i.test(msg);
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

      setCompleted(prev => prev + 1);
      
      // 다음 슬라이드로 이동
      setTimeout(() => {
        captureNextSlide(index + 1);
      }, 500);
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
      
      // 실패해도 다음 슬라이드로 진행
      setTimeout(() => {
        captureNextSlide(index + 1);
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
    if (slideIndex < 0 || slideIndex >= (slidesState?.length || 0)) {
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
            const slide = slidesState?.[slideIndex];
            if (!slide) return;
            await api.updateSlideImageUrl(meeting.meetingId, slide.slideId, newUrl);
            // 로컬 상태 갱신
            setSlidesState(prev => prev.map((s, i) => i === slideIndex ? { ...s, imageUrl: newUrl } : s));
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

