import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Stack
} from '@mui/material';
import {
  Save as SaveIcon,
  Add as AddIcon
} from '@mui/icons-material';
import ModeSelector from './ModeSelector';
import SlideOrderEditor from './SlideOrderEditor';
import CustomSlideEditor from './CustomSlideEditor';
import MeetingCaptureManager from './MeetingCaptureManager';
// api import - named export와 default export 모두 지원
import apiObj, { api as namedApi } from '../../api';
const api = namedApi || apiObj.default || apiObj.api || apiObj;
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

  // 회의 설정 불러오기
  useEffect(() => {
    if (meeting?.meetingId) {
      loadMeetingConfig();
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
      console.error('회의 설정 조회 오류:', err);
      setError('회의 설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
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
      console.error('회의 설정 저장 오류:', err);
      setError('회의 설정 저장에 실패했습니다.');
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
          <Button onClick={onCancel} disabled={saving}>
            취소
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || slides.length === 0}
            sx={{ backgroundColor: '#3949AB', '&:hover': { backgroundColor: '#303F9F' } }}
          >
            저장
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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

