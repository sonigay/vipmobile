import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Stack,
  TextField,
  Collapse
} from '@mui/material';
import {
  Save as SaveIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import ModeSelector from './ModeSelector';
import SlideOrderEditor from './SlideOrderEditor';
import CustomSlideEditor from './CustomSlideEditor';
import MeetingCaptureManager from './MeetingCaptureManager';
import { api } from '../../api';
import { getModeConfig } from '../../config/modeConfig';
import { getAvailableTabsForMode } from '../../config/modeTabConfig';

function MeetingConfigEditor({ meeting, loggedInStore, onSave, onCancel }) {
  const [selectedModes, setSelectedModes] = useState([]);
  const [selectedTabs, setSelectedTabs] = useState([]);
  const [slides, setSlides] = useState([]);
  const [customSlideOpen, setCustomSlideOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState({
    meetingName: '',
    meetingDate: '',
    meetingNumber: '',
    meetingLocation: '',
    participants: ''
  });
  const [infoErrors, setInfoErrors] = useState({});

  // 회의 설정 불러오기
  useEffect(() => {
    if (meeting?.meetingId) {
      loadMeetingConfig();
      // 회의 정보 초기화
      setMeetingInfo({
        meetingName: meeting.meetingName || '',
        meetingDate: meeting.meetingDate || '',
        meetingNumber: meeting.meetingNumber || '',
        meetingLocation: meeting.meetingLocation || '',
        participants: meeting.participants || ''
      });
    }
  }, [meeting]);

  const loadMeetingConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getMeetingConfig(meeting.meetingId);
      const loadedSlides = response.slides || [];
      
      setSlides(loadedSlides);
      
      // 선택된 모드/탭 추출
      const modes = new Set();
      const tabs = [];
      
      loadedSlides.forEach(slide => {
        if (slide.type === 'mode-tab' && slide.mode) {
          modes.add(slide.mode);
          tabs.push(`${slide.mode}-${slide.tab}`);
        }
      });
      
      setSelectedModes(Array.from(modes));
      setSelectedTabs(tabs);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('회의 설정 조회 오류:', err);
      }
      setError('회의 설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInfoChange = (field) => (event) => {
    const value = event.target.value;
    setMeetingInfo(prev => ({ ...prev, [field]: value }));
    // 에러 초기화
    if (infoErrors[field]) {
      setInfoErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  const validateInfo = () => {
    const newErrors = {};
    
    if (!meetingInfo.meetingName.trim()) {
      newErrors.meetingName = '회의 이름을 입력해주세요.';
    }
    
    if (!meetingInfo.meetingDate) {
      newErrors.meetingDate = '회의 날짜를 선택해주세요.';
    }
    
    if (!meetingInfo.meetingNumber || parseInt(meetingInfo.meetingNumber) <= 0) {
      newErrors.meetingNumber = '차수를 입력해주세요. (1 이상)';
    }
    
    setInfoErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSaveInfo = async () => {
    if (!validateInfo()) {
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      await api.updateMeeting(meeting.meetingId, {
        meetingName: meetingInfo.meetingName,
        meetingDate: meetingInfo.meetingDate,
        meetingNumber: meetingInfo.meetingNumber,
        meetingLocation: meetingInfo.meetingLocation,
        participants: meetingInfo.participants
      });
      
      setEditingInfo(false);
      if (onSave) {
        onSave(); // 목록 새로고침
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('회의 정보 저장 오류:', err);
      }
      setError('회의 정보 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleModeToggle = (modeKey) => {
    if (selectedModes.includes(modeKey)) {
      // 모드 제거 시 해당 모드의 모든 탭도 제거
      setSelectedModes(selectedModes.filter(m => m !== modeKey));
      setSelectedTabs(selectedTabs.filter(t => !t.startsWith(`${modeKey}-`)));
      // 슬라이드에서도 제거
      setSlides(slides.filter(s => s.type !== 'mode-tab' || s.mode !== modeKey));
    } else {
      setSelectedModes([...selectedModes, modeKey]);
    }
  };

  const handleTabToggle = (modeKey, tabKey) => {
    const tabId = `${modeKey}-${tabKey}`;
    
    if (selectedTabs.includes(tabId)) {
      // 탭 제거
      setSelectedTabs(selectedTabs.filter(t => t !== tabId));
      // 슬라이드에서도 제거
      setSlides(slides.filter(s => 
        !(s.type === 'mode-tab' && s.mode === modeKey && s.tab === tabKey)
      ));
    } else {
      // 탭 추가
      setSelectedTabs([...selectedTabs, tabId]);
      
      // 슬라이드에 추가
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

  const handleSave = async () => {
    if (slides.length === 0) {
      setError('최소 1개 이상의 슬라이드를 선택해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 먼저 설정 저장
      await api.saveMeetingConfig(meeting.meetingId, { slides });
      
      // 회의 상태를 capturing으로 변경
      await api.updateMeeting(meeting.meetingId, {
        status: 'capturing'
      });

      // 캡처 시작
      setCapturing(true);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('회의 설정 저장 오류:', err);
      }
      setError('회의 설정 저장에 실패했습니다.');
      setSaving(false);
    }
  };

  const handleRecapture = async () => {
    if (slides.length === 0) {
      setError('최소 1개 이상의 슬라이드를 선택해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 설정 저장 (변경사항이 있을 수 있으므로)
      await api.saveMeetingConfig(meeting.meetingId, { slides });
      
      // 회의 상태를 capturing으로 변경
      await api.updateMeeting(meeting.meetingId, {
        status: 'capturing'
      });

      // 재캡처 시작
      setCapturing(true);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('재캡처 시작 오류:', err);
      }
      setError('재캡처 시작에 실패했습니다.');
      setSaving(false);
    }
  };

  const handleCaptureComplete = () => {
    setCapturing(false);
    setSaving(false);
    if (onSave) {
      onSave();
    }
  };

  const handleCaptureCancel = () => {
    setCapturing(false);
    setSaving(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          회의 설정: {meeting?.meetingName || ''}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button onClick={onCancel} disabled={saving || capturing}>
            취소
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRecapture}
            disabled={saving || capturing || slides.length === 0}
            sx={{ borderColor: '#FB8C00', color: '#FB8C00', '&:hover': { borderColor: '#F57C00', backgroundColor: 'rgba(251, 140, 0, 0.04)' } }}
          >
            재캡처
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || capturing || slides.length === 0}
            sx={{ backgroundColor: '#3949AB', '&:hover': { backgroundColor: '#303F9F' } }}
          >
            저장 및 캡처
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 회의 정보 수정 섹션 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            회의 정보
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={editingInfo ? <ExpandLessIcon /> : <EditIcon />}
            onClick={() => setEditingInfo(!editingInfo)}
            disabled={saving || capturing}
          >
            {editingInfo ? '접기' : '수정'}
          </Button>
        </Stack>
        
        <Collapse in={editingInfo}>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="회의 이름"
              value={meetingInfo.meetingName}
              onChange={handleInfoChange('meetingName')}
              error={!!infoErrors.meetingName}
              helperText={infoErrors.meetingName}
              fullWidth
              required
            />
            <TextField
              label="회의 날짜"
              type="date"
              value={meetingInfo.meetingDate}
              onChange={handleInfoChange('meetingDate')}
              error={!!infoErrors.meetingDate}
              helperText={infoErrors.meetingDate}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="차수"
              type="number"
              value={meetingInfo.meetingNumber}
              onChange={handleInfoChange('meetingNumber')}
              error={!!infoErrors.meetingNumber}
              helperText={infoErrors.meetingNumber}
              fullWidth
              required
              inputProps={{ min: 1 }}
            />
            <TextField
              label="회의 장소"
              value={meetingInfo.meetingLocation}
              onChange={handleInfoChange('meetingLocation')}
              fullWidth
            />
            <TextField
              label="참석자"
              value={meetingInfo.participants}
              onChange={handleInfoChange('participants')}
              fullWidth
              multiline
              rows={2}
              placeholder="참석자 목록을 입력하세요 (쉼표로 구분)"
            />
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => {
                setEditingInfo(false);
                setMeetingInfo({
                  meetingName: meeting.meetingName || '',
                  meetingDate: meeting.meetingDate || '',
                  meetingNumber: meeting.meetingNumber || '',
                  meetingLocation: meeting.meetingLocation || '',
                  participants: meeting.participants || ''
                });
                setInfoErrors({});
              }}>
                취소
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveInfo}
                disabled={saving}
              >
                저장
              </Button>
            </Stack>
          </Stack>
        </Collapse>
        
        {!editingInfo && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              날짜: {meetingInfo.meetingDate || '-'} | 차수: {meetingInfo.meetingNumber || '-'}
            </Typography>
            {meetingInfo.meetingLocation && (
              <Typography variant="body2" color="text.secondary">
                장소: {meetingInfo.meetingLocation}
              </Typography>
            )}
            {meetingInfo.participants && (
              <Typography variant="body2" color="text.secondary">
                참석자: {meetingInfo.participants}
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <ModeSelector
          loggedInStore={loggedInStore}
          selectedModes={selectedModes}
          onModeToggle={handleModeToggle}
          selectedTabs={selectedTabs}
          onTabToggle={handleTabToggle}
        />
      </Paper>

      <Divider sx={{ my: 3 }} />

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            슬라이드 순서
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddCustomSlide}
            size="small"
          >
            커스텀 화면 추가
          </Button>
        </Stack>
        <SlideOrderEditor
          slides={slides}
          onReorder={handleSlideReorder}
        />
      </Paper>

      <CustomSlideEditor
        open={customSlideOpen}
        onClose={() => setCustomSlideOpen(false)}
        onSave={handleCustomSlideSave}
        meetingDate={meeting?.meetingDate || new Date().toISOString().split('T')[0]}
        meetingNumber={meeting?.meetingNumber ? parseInt(meeting.meetingNumber) : null}
      />

      {capturing && (
        <MeetingCaptureManager
          meeting={meeting}
          slides={slides}
          loggedInStore={loggedInStore}
          onComplete={handleCaptureComplete}
          onCancel={handleCaptureCancel}
        />
      )}
    </Box>
  );
}

export default MeetingConfigEditor;

