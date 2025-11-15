import React, { useState, useRef, useEffect } from 'react';
import { captureElement, generateImageFilename } from '../../utils/screenCapture';
import { api } from '../../api';
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
        console.log(`🔄 [MeetingCaptureManager] 회의 상태를 completed로 업데이트 시작: ${meeting.meetingId}`);
        await api.updateMeeting(meeting.meetingId, {
          status: 'completed'
        });
        console.log(`✅ [MeetingCaptureManager] 회의 상태 업데이트 완료`);
      } catch (err) {
        console.error('❌ [MeetingCaptureManager] 회의 상태 업데이트 오류:', err);
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
        console.error(`❌ [MeetingCaptureManager] 슬라이드 요소를 찾을 수 없습니다.`, {
          slideId: currentSlide.slideId,
          index: index,
          totalSlides: slidesState.length,
          foundElements: Array.from(allSlideElements).map(el => el.getAttribute('data-slide-id'))
        });
        throw new Error(`슬라이드 요소를 찾을 수 없습니다. (slideId: ${currentSlide.slideId}, index: ${index})`);
      }

      // 캡처 (data-slide-id를 가진 요소 내부의 콘텐츠만 캡처)
      // 헤더와 탭 네비게이션은 이미 숨겨져 있으므로, slideElement 자체를 캡처
      const slideType = currentSlide.type || 'mode-tab';
      const backgroundColor = slideType === 'custom' 
        ? (currentSlide.backgroundColor || '#ffffff')
        : slideType === 'main' || slideType === 'toc' || slideType === 'ending'
        ? '#ffffff' // 배경색은 그라데이션이므로 흰색으로 설정
        : '#ffffff';
        
      const blob = await captureElement(slideElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: backgroundColor,
        // 스크롤 영역 전체 캡처
        scrollX: 0,
        scrollY: 0
      });

      // Discord에 업로드
      const filename = generateImageFilename(meeting.meetingId, index + 1);
      console.log(`📸 [MeetingCaptureManager] 슬라이드 ${index + 1} 캡처 완료, 업로드 시작`);
      const formData = new FormData();
      formData.append('image', blob, filename);
      formData.append('meetingId', meeting.meetingId);
      formData.append('meetingDate', meeting.meetingDate);
      formData.append('slideOrder', index + 1);

      // 재시도 로직이 포함된 업로드 함수
      const uploadWithRetry = async (retries = 3, delay = 1000) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const uploadResponse = await fetch(`${process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app'}/api/meetings/${meeting.meetingId}/upload-image`, {
              method: 'POST',
              body: formData
            });

            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              throw new Error(`이미지 업로드 실패 (HTTP ${uploadResponse.status}): ${errorText}`);
            }

            return uploadResponse;
          } catch (error) {
            if (attempt === retries) {
              throw new Error(`이미지 업로드 실패 (${retries}회 시도): ${error.message}`);
            }
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ [MeetingCaptureManager] 슬라이드 ${index + 1} 업로드 재시도 ${attempt}/${retries}:`, error.message);
            }
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
          }
        }
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
          console.warn(`⚠️ [MeetingCaptureManager] 슬라이드 ${idx + 1}에 slideId가 없습니다.`, slide);
          slide.slideId = slide.slideId || `slide-${slide.order || idx + 1}`;
        }
        if (slide.order === undefined || slide.order === null) {
          console.warn(`⚠️ [MeetingCaptureManager] 슬라이드 ${idx + 1}에 order가 없습니다.`, slide);
          slide.order = slide.order || idx + 1;
        }
        return slide;
      });
      
      // 전체 슬라이드 배열을 한 번에 저장 (이전 슬라이드 URL 유지)
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log(`💾 [MeetingCaptureManager] 슬라이드 ${index + 1} 저장 시작, 검증된 슬라이드 수: ${validatedSlides.length}`);
        }
        await api.saveMeetingConfig(meeting.meetingId, {
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
      if (error.message.includes('업로드')) {
        userFriendlyMessage += ': 이미지 업로드 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.';
      } else if (error.message.includes('캡처')) {
        userFriendlyMessage += ': 화면 캡처 중 오류가 발생했습니다.';
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
            
            // 비동기로 저장 (await 없이)
            api.saveMeetingConfig(meeting.meetingId, {
              slides: validatedSlides
            }).catch(err => {
              console.error(`❌ [MeetingCaptureManager] 슬라이드 상태 저장 실패:`, err);
            });
            
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
      />

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

