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

  useEffect(() => {
    console.log(`📋 [MeetingCaptureManager] 슬라이드 초기화: ${slides.length}개`);
    setSlidesState(slides);
  }, [slides]);

  useEffect(() => {
    if (slidesState.length > 0 && !capturing) {
      startCapture();
    }
  }, [slidesState]);

  const startCapture = async () => {
    if (slidesState.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    setCapturing(true);
    setCurrentSlideIndex(0);
    setCompleted(0);
    setFailed([]);

    // 첫 번째 슬라이드 렌더링 시작
    await captureNextSlide(0);
  };

  const captureNextSlide = async (index) => {
    if (index >= slidesState.length) {
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
        const maxAttempts = 100; // 10초 (100 * 100ms)
        const checkReady = () => {
          attempts++;
          console.log(`🔍 [MeetingCaptureManager] 슬라이드 준비 확인 (${attempts}/${maxAttempts}):`, slideReady);
          if (slideReady) {
            console.log('✅ [MeetingCaptureManager] 슬라이드 준비 완료');
            resolve();
          } else if (attempts >= maxAttempts) {
            console.warn('⚠️ [MeetingCaptureManager] 슬라이드 준비 타임아웃, 강제 진행');
            resolve(); // 타임아웃 시에도 진행
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    };

    // 최소 2초 대기 (데이터 로딩 및 렌더링 시간)
    await new Promise(resolve => setTimeout(resolve, 2000));
    await waitForReady();

    try {
      // 현재 슬라이드 DOM 요소 찾기 (data-slide-id 속성을 가진 요소만)
      const slideElement = document.querySelector(`[data-slide-id="${slidesState[index].slideId}"]`);
      
      if (!slideElement) {
        throw new Error('슬라이드 요소를 찾을 수 없습니다.');
      }

      // 캡처 (data-slide-id를 가진 요소 내부의 콘텐츠만 캡처)
      // 헤더와 탭 네비게이션은 이미 숨겨져 있으므로, slideElement 자체를 캡처
      const blob = await captureElement(slideElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: slidesState[index].type === 'custom' 
          ? (slidesState[index].backgroundColor || '#ffffff')
          : '#ffffff',
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

      const uploadResponse = await fetch(`${process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app'}/api/meetings/${meeting.meetingId}/upload-image`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('이미지 업로드 실패');
      }

      const uploadResult = await uploadResponse.json();
      console.log(`✅ [MeetingCaptureManager] 슬라이드 ${index + 1} 업로드 완료:`, uploadResult.imageUrl);

      // 현재 상태를 기반으로 슬라이드 배열 업데이트 (이전 슬라이드 정보 유지)
      setSlidesState(prevSlides => {
        const updatedSlides = prevSlides.map((s, i) => 
          i === index ? {
            ...s,
            imageUrl: uploadResult.imageUrl,
            capturedAt: new Date().toISOString(),
            discordPostId: uploadResult.postId || '',
            discordThreadId: uploadResult.threadId || ''
          } : s // 이전 슬라이드는 그대로 유지
        );
        
        console.log(`💾 [MeetingCaptureManager] 슬라이드 ${index + 1} 상태 업데이트, 전체 슬라이드 수: ${updatedSlides.length}`);
        console.log(`💾 [MeetingCaptureManager] 저장할 슬라이드 URL들:`, updatedSlides.map(s => ({ 
          order: s.order, 
          slideId: s.slideId,
          url: s.imageUrl || '없음',
          hasUrl: !!s.imageUrl
        })));
        
        // 전체 슬라이드 배열을 한 번에 저장 (이전 슬라이드 URL 유지)
        // setState 외부에서 저장하여 최신 상태 보장
        setTimeout(async () => {
          try {
            await api.saveMeetingConfig(meeting.meetingId, {
              slides: updatedSlides
            });
            console.log(`✅ [MeetingCaptureManager] 슬라이드 ${index + 1} 저장 완료`);
          } catch (err) {
            console.error(`❌ [MeetingCaptureManager] 슬라이드 ${index + 1} 저장 실패:`, err);
          }
        }, 0);
        
        return updatedSlides;
      });

      setCompleted(prev => prev + 1);
      
      // 다음 슬라이드로 이동
      setTimeout(() => {
        captureNextSlide(index + 1);
      }, 500);
    } catch (error) {
      console.error(`슬라이드 ${index + 1} 캡처 오류:`, error);
      setFailed(prev => [...prev, index + 1]);
      
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

  if (!capturing) {
    return null;
  }

  return (
    <>
      <CaptureProgress
        open={capturing}
        total={slidesState.length}
        current={currentSlideIndex + 1}
        completed={completed}
        failed={failed}
        onCancel={handleCancel}
      />

      {slidesState[currentSlideIndex] && (
        <SlideRenderer
          key={slidesState[currentSlideIndex].slideId}
          slide={slidesState[currentSlideIndex]}
          loggedInStore={loggedInStore}
          onReady={handleSlideReady}
        />
      )}
    </>
  );
}

export default MeetingCaptureManager;

