import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Close as CloseIcon
} from '@mui/icons-material';

function ImageSlideViewer({ slides, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 이미지 preload
  useEffect(() => {
    const preloadImages = async () => {
      const imagesToLoad = slides.slice(0, Math.min(3, slides.length)); // 처음 3개만 preload
      
      const loadPromises = imagesToLoad.map((slide, index) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            setLoadedImages(prev => new Set([...prev, index]));
            resolve();
          };
          img.onerror = () => resolve(); // 실패해도 계속 진행
          img.src = slide.imageUrl;
        });
      });

      await Promise.all(loadPromises);
      setLoading(false);
    };

    if (slides.length > 0) {
      preloadImages();
    }
  }, [slides]);

  // 다음 이미지 preload
  useEffect(() => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      if (!loadedImages.has(nextIndex)) {
        const img = new Image();
        img.onload = () => {
          setLoadedImages(prev => new Set([...prev, nextIndex]));
        };
        img.src = slides[nextIndex].imageUrl;
      }
    }
  }, [currentIndex, slides, loadedImages]);

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight' || event.key === ' ') {
        handleNext();
      } else if (event.key === 'ArrowLeft' || event.key === 'Backspace') {
        handlePrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, slides.length]);

  const handleNext = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, slides.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleClick = useCallback(() => {
    handleNext();
  }, [handleNext]);

  if (slides.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="info">표시할 슬라이드가 없습니다.</Alert>
      </Box>
    );
  }

  const currentSlide = slides[currentIndex];

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      }}
      onClick={handleClick}
    >
      {/* 종료 버튼 */}
      <IconButton
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.7)'
          },
          zIndex: 10001
        }}
      >
        <CloseIcon />
      </IconButton>

      {/* 이전 버튼 */}
      {currentIndex > 0 && (
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
          sx={{
            position: 'absolute',
            left: 16,
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.7)'
            },
            zIndex: 10001
          }}
        >
          <ArrowBackIcon />
        </IconButton>
      )}

      {/* 다음 버튼 */}
      {currentIndex < slides.length - 1 && (
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          sx={{
            position: 'absolute',
            right: 16,
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.7)'
            },
            zIndex: 10001
          }}
        >
          <ArrowForwardIcon />
        </IconButton>
      )}

      {/* 진행 상태 표시 */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '8px 16px',
          borderRadius: 1,
          zIndex: 10001
        }}
      >
        <Typography variant="body2">
          {currentIndex + 1} / {slides.length}
        </Typography>
      </Box>

      {/* 이미지 표시 */}
      {loading && !loadedImages.has(currentIndex) ? (
        <CircularProgress sx={{ color: 'white' }} />
      ) : error ? (
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          {error}
        </Alert>
      ) : (
        <Box
          component="img"
          src={currentSlide.imageUrl}
          alt={`슬라이드 ${currentIndex + 1}`}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            opacity: loadedImages.has(currentIndex) ? 1 : 0.5,
            transition: 'opacity 0.3s'
          }}
          onError={() => setError('이미지를 불러올 수 없습니다.')}
        />
      )}
    </Box>
  );
}

export default ImageSlideViewer;

