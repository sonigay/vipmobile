import React, { useState, useEffect, useRef } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import { getModeConfig } from '../../config/modeConfig';

// 각 모드 컴포넌트 import (presentation mode 지원 필요)
// TODO: 각 모드 컴포넌트에 presentationMode prop 추가 필요

/**
 * 슬라이드를 렌더링하는 컴포넌트
 * presentation mode로 렌더링하여 헤더 없이 콘텐츠만 표시
 */
function SlideRenderer({ slide, loggedInStore, onReady }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 데이터 로딩 완료 대기
    const timer = setTimeout(() => {
      setLoading(false);
      if (onReady) {
        onReady();
      }
    }, 1000); // 최소 1초 대기 (데이터 로딩 시간 고려)

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

    // TODO: 각 모드 컴포넌트를 presentation mode로 렌더링
    // 현재는 임시로 메시지 표시
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

