import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { api } from '../../api';
import ModeSelector from './ModeSelector';
import SlideOrderEditor from './SlideOrderEditor';
import CustomSlideEditor from './CustomSlideEditor';
import { getAvailableTabsForMode } from '../../config/modeTabConfig';
import { getModeConfig } from '../../config/modeConfig';

function MeetingEditor({ open, meeting, loggedInStore, onClose, onSuccess }) {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    meetingName: '',
    meetingDate: '',
    meetingNumber: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 모드/탭 선택 관련
  const [selectedModes, setSelectedModes] = useState([]);
  const [selectedTabs, setSelectedTabs] = useState([]);
  const [slides, setSlides] = useState([]);
  const [customSlideOpen, setCustomSlideOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (meeting) {
        // 수정 모드 - 기존 정보 로드
        setFormData({
          meetingName: meeting.meetingName || '',
          meetingDate: meeting.meetingDate || '',
          meetingNumber: meeting.meetingNumber || ''
        });
        setActiveStep(0);
      } else {
        // 생성 모드 - 초기화
        const today = new Date().toISOString().split('T')[0];
        setFormData({
          meetingName: '',
          meetingDate: today,
          meetingNumber: ''
        });
        setActiveStep(0);
        setSelectedModes([]);
        setSelectedTabs([]);
        setSlides([]);
      }
      setErrors({});
      setError(null);
    }
  }, [open, meeting]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    // 에러 초기화
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.meetingName.trim()) {
      newErrors.meetingName = '회의 이름을 입력해주세요.';
    }
    
    if (!formData.meetingDate) {
      newErrors.meetingDate = '회의 날짜를 선택해주세요.';
    }
    
    if (!formData.meetingNumber || parseInt(formData.meetingNumber) <= 0) {
      newErrors.meetingNumber = '차수를 입력해주세요. (1 이상)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // 첫 번째 단계: 모드/탭 선택 검증
      if (slides.length === 0) {
        setError('최소 1개 이상의 슬라이드를 선택해주세요.');
        return;
      }
      setError(null);
      setActiveStep(1);
    }
  };

  const handleBack = () => {
    setActiveStep(0);
  };

  const handleModeToggle = (modeKey) => {
    if (selectedModes.includes(modeKey)) {
      setSelectedModes(selectedModes.filter(m => m !== modeKey));
      setSelectedTabs(selectedTabs.filter(t => !t.startsWith(`${modeKey}-`)));
      setSlides(slides.filter(s => s.type !== 'mode-tab' || s.mode !== modeKey));
    } else {
      setSelectedModes([...selectedModes, modeKey]);
    }
  };

  const handleTabToggle = (modeKey, tabKey) => {
    const tabId = `${modeKey}-${tabKey}`;
    
    if (selectedTabs.includes(tabId)) {
      setSelectedTabs(selectedTabs.filter(t => t !== tabId));
      setSlides(slides.filter(s => 
        !(s.type === 'mode-tab' && s.mode === modeKey && s.tab === tabKey)
      ));
    } else {
      setSelectedTabs([...selectedTabs, tabId]);
      
      const availableTabs = getAvailableTabsForMode(modeKey, loggedInStore);
      const tabConfig = availableTabs.find(t => t.key === tabKey);
      
      const newSlide = {
        slideId: `slide-${Date.now()}-${Math.random()}`,
        type: 'mode-tab',
        mode: modeKey,
        tab: tabKey,
        tabLabel: tabConfig?.label || tabKey,
        order: slides.length + 1
      };
      
      setSlides([...slides, newSlide]);
    }
  };

  const handleSlideReorder = (newSlides) => {
    setSlides(newSlides);
  };

  const handleAddCustomSlide = () => {
    setCustomSlideOpen(true);
  };

  const handleCustomSlideSave = (customSlide) => {
    const newSlide = {
      ...customSlide,
      slideId: customSlide.slideId || `slide-${Date.now()}-${Math.random()}`,
      type: 'custom',
      order: slides.length + 1
    };
    setSlides([...slides, newSlide]);
    setCustomSlideOpen(false);
  };

  const handleSubmit = async () => {
    if (activeStep === 0) {
      // 첫 번째 단계: 다음 단계로 이동
      handleNext();
      return;
    }

    // 두 번째 단계: 회의 정보 검증 및 생성
    if (!validate()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const meetingData = {
        meetingName: formData.meetingName.trim(),
        meetingDate: formData.meetingDate,
        meetingNumber: parseInt(formData.meetingNumber),
        createdBy: loggedInStore?.name || loggedInStore?.target || 'Unknown'
      };

      if (meeting) {
        // 수정: 회의 정보만 업데이트
        await api.updateMeeting(meeting.meetingId, meetingData);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        // 생성: 회의 생성 + 설정 저장
        const result = await api.createMeeting(meetingData);
        const createdMeeting = result.meeting;
        
        // 설정 저장
        await api.saveMeetingConfig(createdMeeting.meetingId, { slides });
        
        // 회의 상태를 capturing으로 변경
        await api.updateMeeting(createdMeeting.meetingId, {
          status: 'capturing'
        });

        if (onSuccess) {
          // 생성된 회의 정보와 슬라이드를 전달 (캡처 시작을 위해)
          onSuccess({ ...createdMeeting, slides });
        }
      }
    } catch (err) {
      console.error('회의 저장 오류:', err);
      setError(err.message || '회의 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const steps = meeting ? ['회의 정보'] : ['모드/탭 선택', '회의 정보'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {meeting ? '회의 수정' : '새 회의 생성'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {!meeting && (
            <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {activeStep === 0 && !meeting && (
            <Box>
              <ModeSelector
                loggedInStore={loggedInStore}
                selectedModes={selectedModes}
                onModeToggle={handleModeToggle}
                selectedTabs={selectedTabs}
                onTabToggle={handleTabToggle}
              />

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  슬라이드 순서
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleAddCustomSlide}
                >
                  커스텀 화면 추가
                </Button>
              </Box>
              <SlideOrderEditor
                slides={slides}
                onReorder={handleSlideReorder}
              />

              <Alert severity="info" sx={{ mt: 2 }}>
                다음 단계에서 회의 정보를 입력하세요.
              </Alert>
            </Box>
          )}

          {(activeStep === 1 || (activeStep === 0 && meeting)) && (
            <Box>
              <TextField
                fullWidth
                label="회의 이름"
                value={formData.meetingName}
                onChange={handleChange('meetingName')}
                error={!!errors.meetingName}
                helperText={errors.meetingName}
                margin="normal"
                required
              />

              <TextField
                fullWidth
                label="회의 날짜"
                type="date"
                value={formData.meetingDate}
                onChange={handleChange('meetingDate')}
                error={!!errors.meetingDate}
                helperText={errors.meetingDate}
                margin="normal"
                required
                InputLabelProps={{
                  shrink: true
                }}
              />

              <TextField
                fullWidth
                label="차수"
                type="number"
                value={formData.meetingNumber}
                onChange={handleChange('meetingNumber')}
                error={!!errors.meetingNumber}
                helperText={errors.meetingNumber || '같은 날짜에 동일 차수가 이미 존재하면 생성할 수 없습니다.'}
                margin="normal"
                required
                inputProps={{ min: 1 }}
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          취소
        </Button>
        {activeStep > 0 && !meeting && (
          <Button onClick={handleBack} disabled={loading}>
            이전
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          sx={{ backgroundColor: '#3949AB', '&:hover': { backgroundColor: '#303F9F' } }}
        >
          {loading ? (
            <CircularProgress size={20} />
          ) : activeStep === 0 && !meeting ? (
            '다음'
          ) : (
            meeting ? '수정' : '생성 및 저장'
          )}
        </Button>
      </DialogActions>

      <CustomSlideEditor
        open={customSlideOpen}
        onClose={() => setCustomSlideOpen(false)}
        onSave={handleCustomSlideSave}
      />
    </Dialog>
  );
}

export default MeetingEditor;

