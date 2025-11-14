import React from 'react';
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

      <List sx={{ maxHeight: '500px', overflowY: 'auto' }}>
        {slides.map((slide, index) => (
          <Paper
            key={slide.slideId || slide.id || index}
            variant="outlined"
            sx={{ mb: 1 }}
          >
            <ListItem
              secondaryAction={
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    edge="end"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    size="small"
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === slides.length - 1}
                    size="small"
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={() => handleRemove(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              <DragIndicatorIcon sx={{ mr: 2, color: 'text.secondary' }} />
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

