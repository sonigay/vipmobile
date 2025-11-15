import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);
  const containerRef = useRef(null);

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
      onClick={(e) => {
        // 확대된 상태에서는 클릭으로 다음 슬라이드로 이동하지 않음
        if (scale === 1 && position.x === 0 && position.y === 0) {
          handleNext();
        }
      }}
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

      {/* 이미지 표시 - 모바일 확대/축소 지원 */}
      {loading && !loadedImages.has(currentIndex) ? (
        <CircularProgress sx={{ color: 'white' }} />
      ) : error ? (
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          {error}
        </Alert>
      ) : (
        <Box
          ref={containerRef}
          sx={{
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            touchAction: 'none' // 모바일 기본 제스처 비활성화
          }}
          onWheel={(e) => {
            // 데스크톱: 마우스 휠로 확대/축소
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
          }}
          onTouchStart={(e) => {
            // 모바일: 두 손가락 핀치 제스처
            if (e.touches.length === 2) {
              const touch1 = e.touches[0];
              const touch2 = e.touches[1];
              const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
              );
              setDragStart({ distance, scale });
            } else if (e.touches.length === 1) {
              // 한 손가락: 드래그
              setIsDragging(true);
              setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y
              });
            }
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            if (e.touches.length === 2) {
              // 핀치 제스처
              const touch1 = e.touches[0];
              const touch2 = e.touches[1];
              const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
              );
              const scaleChange = distance / dragStart.distance;
              setScale(dragStart.scale * scaleChange);
            } else if (e.touches.length === 1 && isDragging) {
              // 드래그
              setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
              });
            }
          }}
          onTouchEnd={() => {
            setIsDragging(false);
          }}
        >
          <Box
            ref={imageRef}
            component="img"
            src={currentSlide.imageUrl}
            alt={`슬라이드 ${currentIndex + 1}`}
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              opacity: loadedImages.has(currentIndex) ? 1 : 0.5,
              transition: scale !== 1 ? 'none' : 'opacity 0.3s',
              display: 'block',
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transformOrigin: 'center center',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'none'
            }}
            onError={() => setError('이미지를 불러올 수 없습니다.')}
            onLoad={() => {
              // 이미지 로드 시 초기화
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
          />
        </Box>
      )}
      
      {/* 확대/축소 컨트롤 (모바일용) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 1,
          zIndex: 10002
        }}
      >
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            setScale(prev => Math.max(0.5, prev - 0.2));
          }}
          sx={{
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' }
          }}
        >
          <Typography variant="h6">−</Typography>
        </IconButton>
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            setScale(1);
            setPosition({ x: 0, y: 0 });
          }}
          sx={{
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' }
          }}
        >
          <Typography variant="body2">리셋</Typography>
        </IconButton>
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            setScale(prev => Math.min(3, prev + 0.2));
          }}
          sx={{
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' }
          }}
        >
          <Typography variant="h6">+</Typography>
        </IconButton>
      </Box>
    </Box>
  );
}

export default ImageSlideViewer;

