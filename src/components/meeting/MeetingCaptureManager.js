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

  useEffect(() => {
    if (slides.length > 0 && !capturing) {
      startCapture();
    }
  }, [slides]);

  const startCapture = async () => {
    if (slides.length === 0) {
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
    if (index >= slides.length) {
      // 모든 슬라이드 캡처 완료
      setCapturing(false);
      
      // 회의 상태를 completed로 업데이트
      try {
        await api.updateMeeting(meeting.meetingId, {
          status: 'completed'
        });
      } catch (err) {
        console.error('회의 상태 업데이트 오류:', err);
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
      // 현재 슬라이드 DOM 요소 찾기
      const slideElement = document.querySelector(`[data-slide-id="${slides[index].slideId}"]`);
      
      if (!slideElement) {
        throw new Error('슬라이드 요소를 찾을 수 없습니다.');
      }

      // 캡처
      const blob = await captureElement(slideElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: slides[index].type === 'custom' 
          ? (slides[index].backgroundColor || '#ffffff')
          : '#ffffff'
      });

      // Discord에 업로드
      const filename = generateImageFilename(meeting.meetingId, index + 1);
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

      // 구글시트에 URL 저장
      const updatedSlide = {
        ...slides[index],
        imageUrl: uploadResult.imageUrl,
        capturedAt: new Date().toISOString(),
        discordPostId: uploadResult.postId || '',
        discordThreadId: uploadResult.threadId || ''
      };

      await api.saveMeetingConfig(meeting.meetingId, {
        slides: slides.map((s, i) => i === index ? updatedSlide : s)
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
        total={slides.length}
        current={currentSlideIndex + 1}
        completed={completed}
        failed={failed}
        onCancel={handleCancel}
      />

      {slides[currentSlideIndex] && (
        <SlideRenderer
          key={slides[currentSlideIndex].slideId}
          slide={slides[currentSlideIndex]}
          loggedInStore={loggedInStore}
          onReady={handleSlideReady}
        />
      )}
    </>
  );
}

export default MeetingCaptureManager;

