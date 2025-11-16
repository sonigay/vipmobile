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
import { getProxyImageUrl } from '../../api';

function ImageSlideViewer({ slides, onClose }) {
  // 디버깅: 컴포넌트 초기화 시작
  try {
    console.log('🔍 [ImageSlideViewer] 컴포넌트 초기화 시작', {
      slidesCount: slides?.length || 0,
      hasOnClose: typeof onClose === 'function',
      firstSlideId: slides?.[0]?.slideId,
      firstSlideImageUrl: slides?.[0]?.imageUrl ? '있음' : '없음'
    });
  } catch (err) {
    console.error('❌ [ImageSlideViewer] 컴포넌트 초기화 에러:', err, err?.stack);
  }
  
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

  // 이미지 preload (lazy loading 및 progressive loading 적용)
  useEffect(() => {
    const preloadImages = async () => {
      if (slides.length === 0) {
        setLoading(false);
        return;
      }
      
      // 첫 번째 이미지만 즉시 로드 (progressive loading)
      const firstSlide = slides[0];
      if (firstSlide?.imageUrl) {
        const img = new Image();
        img.onload = () => {
          setLoadedImages(prev => new Set([...prev, 0]));
          setLoading(false);
        };
        img.onerror = () => {
          setLoading(false);
        };
        img.src = getProxyImageUrl(firstSlide.imageUrl);
      } else {
        setLoading(false);
      }
      
      // 나머지 이미지는 지연 로딩 (lazy loading)
      // Intersection Observer를 사용하여 뷰포트에 가까워질 때 로드
    };

    preloadImages();
  }, [slides]);

  // 다음/이전 이미지 preload (lazy loading - 현재 이미지 주변만)
  useEffect(() => {
    const preloadAdjacent = () => {
      // 현재 이미지 주변 ±2 범위만 preload (메모리 최적화)
      const preloadRange = 2;
      const startIndex = Math.max(0, currentIndex - preloadRange);
      const endIndex = Math.min(slides.length - 1, currentIndex + preloadRange);
      
      for (let i = startIndex; i <= endIndex; i++) {
        if (!loadedImages.has(i) && slides[i]?.imageUrl) {
          const img = new Image();
          img.onload = () => {
            setLoadedImages(prev => new Set([...prev, i]));
          };
          img.onerror = () => {}; // 에러 무시
          img.src = slides[i].imageUrl;
        }
      }
      
      // 범위 밖의 이미지는 메모리에서 해제 (브라우저가 자동으로 처리하지만 명시적으로 표시)
      // 실제로는 브라우저가 캐시를 관리하므로 추가 작업 불필요
    };
    
    if (slides.length > 0) {
      preloadAdjacent();
    }
  }, [currentIndex, slides, loadedImages]);

  // handleNext와 handlePrevious를 먼저 정의 (useEffect에서 사용하기 전에)
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
  }, [currentIndex, slides.length, onClose, handleNext, handlePrevious]);

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
        cursor: isDragging ? 'grabbing' : (scale > 1 ? 'grab' : 'pointer'),
      }}
      ref={containerRef}
      onClick={(e) => {
        // 확대된 상태에서는 클릭으로 다음 슬라이드로 이동하지 않음
        if (scale === 1 && position.x === 0 && position.y === 0) {
          handleNext();
        }
      }}
      onMouseDown={(e) => {
        // 데스크톱 드래그로 패닝
        if (scale <= 1) return;
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }}
      onMouseMove={(e) => {
        if (!isDragging) return;
        e.preventDefault();
        const nextX = e.clientX - dragStart.x;
        const nextY = e.clientY - dragStart.y;
        setPosition({ x: nextX, y: nextY });
      }}
      onMouseUp={() => {
        if (isDragging) setIsDragging(false);
      }}
      onMouseLeave={() => {
        if (isDragging) setIsDragging(false);
      }}
      onWheel={(e) => {
        // 휠로 확대/축소 (데스크톱)
        const delta = -e.deltaY;
        if (delta === 0) return;
        const step = delta > 0 ? 0.1 : -0.1;
        setScale(prev => {
          const next = Math.min(3, Math.max(0.5, prev + step));
          return next;
        });
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
            src={getProxyImageUrl(currentSlide.imageUrl)}
            alt={`슬라이드 ${currentIndex + 1}`}
            loading={loadedImages.has(currentIndex) ? 'eager' : 'lazy'} // lazy loading 지원
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
              // 이미지 로드 시 초기화 및 로드 상태 업데이트
              setLoadedImages(prev => new Set([...prev, currentIndex]));
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

