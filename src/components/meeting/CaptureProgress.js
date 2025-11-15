import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';

function CaptureProgress({ open, total, current, completed, failed, onCancel, slides = [], startTime, onRetryFailed, isPaused, onPause, onResume }) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  
  // 예상 소요 시간 계산
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [estimatedTime, setEstimatedTime] = React.useState(0);
  
  React.useEffect(() => {
    if (!open || !startTime) return;
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
      
      // 완료된 슬라이드가 있으면 평균 시간을 계산하여 예상 시간 추정
      if (completed > 0 && current > 0) {
        const avgTimePerSlide = elapsed / completed;
        const remainingSlides = total - completed;
        const estimated = Math.ceil(avgTimePerSlide * remainingSlides);
        setEstimatedTime(estimated);
      } else {
        // 아직 완료된 슬라이드가 없으면 기본 예상 시간 (슬라이드당 평균 30초)
        setEstimatedTime((total - completed) * 30);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [open, startTime, completed, current, total]);
  
  // 시간 포맷팅
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}초`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}분 ${secs}초`;
  };
  
  // 슬라이드 정보 가져오기 헬퍼 함수
  const getSlideInfo = (index) => {
    if (slides && slides[index]) {
      const slide = slides[index];
      if (slide.type === 'main') return '회의 메인 화면';
      if (slide.type === 'toc') return '회의 목차';
      if (slide.type === 'ending') return '회의 종료';
      if (slide.type === 'custom') return slide.title || '커스텀 화면';
      if (slide.type === 'mode-only') {
        const { getModeConfig } = require('../../config/modeConfig');
        const modeConfig = getModeConfig(slide.mode);
        return modeConfig?.title || slide.mode;
      }
      // mode-tab 타입
      const { getModeConfig } = require('../../config/modeConfig');
      const { getAvailableTabsForMode } = require('../../config/modeTabConfig');
      const modeConfig = getModeConfig(slide.mode);
      const modeName = modeConfig?.title || slide.mode;
      const tabName = slide.tabLabel || slide.tab || '';
      const subTabName = slide.subTabLabel || slide.subTab || '';
      
      // 세부 옵션 정보 가져오기
      let detailOptionLabel = '';
      if (slide.detailOptions) {
        const availableTabs = getAvailableTabsForMode(slide.mode, {});
        const tabConfig = availableTabs.find(t => t.key === slide.tab);
        const subTabConfig = tabConfig?.subTabs?.find(st => st.key === slide.subTab);
        
        if (subTabConfig?.detailOptions) {
          const detailOptions = subTabConfig.detailOptions;
          const detailOptionLabels = [];
          
          // csDetailType 옵션 처리
          if (slide.detailOptions.csDetailType && slide.detailOptions.csDetailType !== 'all') {
            const csDetailTypeOption = detailOptions.options?.find(opt => opt.key === 'csDetailType');
            if (csDetailTypeOption) {
              const selectedValue = csDetailTypeOption.values?.find(v => v.key === slide.detailOptions.csDetailType);
              if (selectedValue) {
                detailOptionLabels.push(selectedValue.label);
              }
            }
          }
          
          // csDetailCriteria 옵션 처리
          if (slide.detailOptions.csDetailCriteria && slide.detailOptions.csDetailCriteria !== 'performance') {
            const csDetailCriteriaOption = detailOptions.options?.find(opt => opt.key === 'csDetailCriteria');
            if (csDetailCriteriaOption) {
              const selectedValue = csDetailCriteriaOption.values?.find(v => v.key === slide.detailOptions.csDetailCriteria);
              if (selectedValue) {
                detailOptionLabels.push(selectedValue.label);
              }
            }
          }
          
          // 다른 세부 옵션들도 처리
          Object.keys(slide.detailOptions).forEach(key => {
            if (key !== 'csDetailType' && key !== 'csDetailCriteria') {
              const option = detailOptions.options?.find(opt => opt.key === key);
              if (option) {
                const selectedValue = option.values?.find(v => v.key === slide.detailOptions[key]);
                if (selectedValue && selectedValue.key !== 'all' && selectedValue.key !== option.defaultValue) {
                  detailOptionLabels.push(selectedValue.label);
                }
              }
            }
          });
          
          if (detailOptionLabels.length > 0) {
            detailOptionLabel = ` > ${detailOptionLabels.join(', ')}`;
          }
        }
      }
      
      if (subTabName) {
        return `${modeName} > ${tabName} > ${subTabName}${detailOptionLabel}`;
      }
      return `${modeName} > ${tabName}${detailOptionLabel}`;
    }
    return '';
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth sx={{ zIndex: 10000 }}>
      <DialogTitle>
        화면 캡처 진행 중...
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {completed} / {total} 완료 ({Math.round(progress)}%)
            </Typography>
            {startTime && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  경과: {formatTime(elapsedTime)}
                </Typography>
                {estimatedTime > 0 && current < total && (
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                    예상 남은 시간: {formatTime(estimatedTime)}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
          {current > 0 && current <= total && (
            <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block', fontWeight: 500 }}>
              현재 캡처 중: {getSlideInfo(current - 1) || `슬라이드 ${current}`}
            </Typography>
          )}
        </Box>

        <List dense>
          {Array.from({ length: total }, (_, index) => {
            const slideIndex = index + 1;
            const isCompleted = slideIndex <= completed;
            // failed가 객체 배열인 경우와 숫자 배열인 경우 모두 처리
            const failedItem = Array.isArray(failed) && failed.length > 0 
              ? (typeof failed[0] === 'object' 
                  ? failed.find(f => f.slideIndex === slideIndex)
                  : failed.includes(slideIndex) ? { slideIndex, error: '캡처 실패' } : null)
              : null;
            const isFailed = !!failedItem;
            const isCurrent = slideIndex === current;

            return (
              <ListItem key={slideIndex}>
                <ListItemIcon>
                  {isCompleted ? (
                    <CheckCircleIcon color="success" />
                  ) : isFailed ? (
                    <ErrorIcon color="error" />
                  ) : isCurrent ? (
                    <RadioButtonUncheckedIcon color="primary" />
                  ) : (
                    <RadioButtonUncheckedIcon />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={`슬라이드 ${slideIndex}${getSlideInfo(index) ? ` - ${getSlideInfo(index)}` : ''}`}
                  secondary={isFailed ? (failedItem?.error || '캡처 실패') : isCompleted ? '완료' : isCurrent ? '캡처 중...' : '대기 중'}
                />
                {isFailed && onRetryFailed && (
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={() => onRetryFailed(slideIndex - 1)}
                    variant="outlined"
                    color="primary"
                    sx={{ ml: 2 }}
                  >
                    재시도
                  </Button>
                )}
              </ListItem>
            );
          })}
        </List>
        {failed && failed.length > 0 && completed === total && onRetryFailed && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={() => {
                // 모든 실패한 슬라이드 재시도
                const failedIndices = failed
                  .map(f => typeof f === 'object' ? f.slideIndex - 1 : f - 1)
                  .filter(idx => idx >= 0);
                failedIndices.forEach(idx => onRetryFailed(idx));
              }}
              color="primary"
            >
              모든 실패 항목 재시도
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {onPause && onResume && current < total && (
          <Button
            onClick={isPaused ? onResume : onPause}
            startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
            variant="outlined"
          >
            {isPaused ? '재개' : '일시정지'}
          </Button>
        )}
        <Button onClick={onCancel} disabled={completed === total || isPaused}>
          취소
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CaptureProgress;

