import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip
} from '@mui/material';
import {
  DragIndicator as DragIndicatorIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { getModeConfig } from '../../config/modeConfig';

function SlideOrderEditor({ slides, onReorder, onRemove }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchCurrentIndex, setTouchCurrentIndex] = useState(null);
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newSlides = [...slides];
    [newSlides[index - 1], newSlides[index]] = [newSlides[index], newSlides[index - 1]];
    // 순서 재설정
    newSlides.forEach((slide, idx) => {
      slide.order = idx + 1;
    });
    onReorder(newSlides);
  };

  const handleMoveDown = (index) => {
    if (index === slides.length - 1) return;
    const newSlides = [...slides];
    [newSlides[index], newSlides[index + 1]] = [newSlides[index + 1], newSlides[index]];
    // 순서 재설정
    newSlides.forEach((slide, idx) => {
      slide.order = idx + 1;
    });
    onReorder(newSlides);
  };

  const handleRemove = (index) => {
    const newSlides = slides.filter((_, idx) => idx !== index);
    // 순서 재설정
    newSlides.forEach((slide, idx) => {
      slide.order = idx + 1;
    });
    onReorder(newSlides);
    if (onRemove) {
      onRemove(index);
    }
  };

  // 드래그 시작
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
    // 모바일 터치 지원
    if (e.dataTransfer.setDragImage) {
      const dragImage = document.createElement('div');
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.textContent = '드래그 중...';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  // 드래그 오버
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  // 드래그 리브
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // 드롭
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newSlides = [...slides];
    const draggedSlide = newSlides[draggedIndex];
    
    // 슬라이드 이동
    newSlides.splice(draggedIndex, 1);
    newSlides.splice(dropIndex, 0, draggedSlide);
    
    // 순서 재설정
    newSlides.forEach((slide, idx) => {
      slide.order = idx + 1;
    });
    
    onReorder(newSlides);
    setDraggedIndex(null);
  };

  // 드래그 종료
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 모바일 터치 시작
  const handleTouchStart = (e, index) => {
    setTouchStartY(e.touches[0].clientY);
    setTouchCurrentIndex(index);
    setDraggedIndex(index);
  };

  // 모바일 터치 이동
  const handleTouchMove = (e) => {
    if (touchStartY === null || touchCurrentIndex === null) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY;
    
    // 드래그 중인 아이템의 위치 계산
    const itemHeight = 80; // 대략적인 아이템 높이
    const newIndex = Math.round(touchCurrentIndex + (deltaY / itemHeight));
    
    if (newIndex >= 0 && newIndex < slides.length && newIndex !== touchCurrentIndex) {
      setDragOverIndex(newIndex);
    }
  };

  // 모바일 터치 종료
  const handleTouchEnd = (e) => {
    if (touchCurrentIndex === null || dragOverIndex === null) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setTouchStartY(null);
      setTouchCurrentIndex(null);
      return;
    }

    if (touchCurrentIndex !== dragOverIndex) {
      const newSlides = [...slides];
      const draggedSlide = newSlides[touchCurrentIndex];
      
      // 슬라이드 이동
      newSlides.splice(touchCurrentIndex, 1);
      newSlides.splice(dragOverIndex, 0, draggedSlide);
      
      // 순서 재설정
      newSlides.forEach((slide, idx) => {
        slide.order = idx + 1;
      });
      
      onReorder(newSlides);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTouchStartY(null);
    setTouchCurrentIndex(null);
  };

  const getSlideLabel = (slide) => {
    if (slide.type === 'main') {
      return '회의 메인 화면';
    } else if (slide.type === 'toc') {
      return '회의 목차';
    } else if (slide.type === 'ending') {
      return '회의 종료';
    } else if (slide.type === 'custom') {
      return slide.title || '커스텀 화면';
    } else if (slide.type === 'mode-only') {
      const modeConfig = getModeConfig(slide.mode);
      return modeConfig?.title || slide.mode;
    } else {
      const modeConfig = getModeConfig(slide.mode);
      const modeName = modeConfig?.title || slide.mode;
      const tabName = slide.tabLabel || slide.tab || '';
      const subTabName = slide.subTabLabel || slide.subTab || '';
      if (subTabName) {
        return `${modeName} > ${tabName} > ${subTabName}`;
      }
      return `${modeName} > ${tabName}`;
    }
  };

  if (slides.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          선택된 슬라이드가 없습니다. 모드/탭을 선택해주세요.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        슬라이드 순서 ({slides.length}개)
      </Typography>

      <List sx={{ maxHeight: '600px', overflowY: 'auto', minHeight: '200px' }}>
        {slides.map((slide, index) => (
          <Paper
            key={slide.slideId || slide.id || index}
            variant="outlined"
            sx={{
              mb: 1,
              cursor: 'grab',
              opacity: draggedIndex === index ? 0.5 : 1,
              transform: dragOverIndex === index ? 'translateY(-4px)' : 'translateY(0)',
              transition: 'transform 0.2s, opacity 0.2s',
              border: dragOverIndex === index ? '2px solid #3949AB' : '1px solid rgba(0, 0, 0, 0.12)',
              boxShadow: dragOverIndex === index ? '0 4px 8px rgba(57, 73, 171, 0.3)' : 'none',
              '&:active': {
                cursor: 'grabbing'
              }
            }}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onTouchStart={(e) => handleTouchStart(e, index)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            sx={{
              ...(draggedIndex === index && {
                touchAction: 'none'
              })
            }}
          >
            <ListItem
              secondaryAction={
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    edge="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveUp(index);
                    }}
                    disabled={index === 0}
                    size="small"
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveDown(index);
                    }}
                    disabled={index === slides.length - 1}
                    size="small"
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(index);
                    }}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              <DragIndicatorIcon 
                sx={{ 
                  mr: 2, 
                  color: 'text.secondary',
                  cursor: 'grab',
                  '&:active': {
                    cursor: 'grabbing'
                  }
                }} 
              />
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={slide.order || index + 1}
                      size="small"
                      color="primary"
                      sx={{ minWidth: 40 }}
                    />
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {getSlideLabel(slide)}
                    </Typography>
                    {slide.type === 'custom' && (
                      <Chip label="커스텀" size="small" variant="outlined" />
                    )}
                  </Box>
                }
                secondary={
                  slide.type === 'custom' && slide.content
                    ? slide.content.substring(0, 50) + (slide.content.length > 50 ? '...' : '')
                    : null
                }
              />
            </ListItem>
          </Paper>
        ))}
      </List>
    </Box>
  );
}

export default SlideOrderEditor;

