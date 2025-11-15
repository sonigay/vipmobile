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
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup
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
    meetingNumber: '',
    meetingLocation: '',
    participants: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 모드/탭 선택 관련
  const [selectedModes, setSelectedModes] = useState([]);
  const [selectedTabs, setSelectedTabs] = useState([]);
  const [selectedSubTabs, setSelectedSubTabs] = useState([]);
  const [slides, setSlides] = useState([]);
  const [customSlideOpen, setCustomSlideOpen] = useState(false);
  
  // 세부 옵션 선택 모달 (일반화)
  const [detailOptionOpen, setDetailOptionOpen] = useState(false);
  const [detailOptionConfig, setDetailOptionConfig] = useState(null);
  const [detailOptionValues, setDetailOptionValues] = useState({});
  const [detailOptionMultipleSelections, setDetailOptionMultipleSelections] = useState({}); // 여러 개 선택을 위한 상태
  const [pendingSubTab, setPendingSubTab] = useState(null);
  const [pendingTab, setPendingTab] = useState(null); // 탭 선택 시 세부 옵션이 있는 경우 대기

  useEffect(() => {
    if (open) {
      if (meeting) {
        // 수정 모드 - 기존 정보 로드
        setFormData({
          meetingName: meeting.meetingName || '',
          meetingDate: meeting.meetingDate || '',
          meetingNumber: meeting.meetingNumber || '',
          meetingLocation: meeting.meetingLocation || '',
          participants: meeting.participants || ''
        });
        setActiveStep(0);
      } else {
        // 생성 모드 - 초기화
        const today = new Date().toISOString().split('T')[0];
        setFormData({
          meetingName: '',
          meetingDate: today,
          meetingNumber: '',
          meetingLocation: '',
          participants: ''
        });
        setActiveStep(0);
        setSelectedModes([]);
        setSelectedTabs([]);
        setSelectedSubTabs([]);
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
      // 탭 제거 시 하부 탭도 함께 제거
      setSelectedTabs(selectedTabs.filter(t => t !== tabId));
      setSelectedSubTabs(selectedSubTabs.filter(st => !st.startsWith(`${modeKey}-${tabKey}-`)));
      setSlides(slides.filter(s => 
        !(s.type === 'mode-tab' && s.mode === modeKey && s.tab === tabKey)
      ));
    } else {
      setSelectedTabs([...selectedTabs, tabId]);
      
      // 탭 추가 시 슬라이드 생성 (하부 탭이 없는 경우)
      const availableTabs = getAvailableTabsForMode(modeKey, loggedInStore);
      const tabConfig = availableTabs.find(t => t.key === tabKey);
      
      // 하부 탭이 있는 경우는 하부 탭 선택 시 슬라이드가 생성되므로 여기서는 생성하지 않음
      if (!tabConfig?.subTabs || tabConfig.subTabs.length === 0) {
        // 탭에 세부 옵션이 있는 경우 모달 표시
        if (tabConfig?.detailOptions) {
          setDetailOptionConfig(tabConfig.detailOptions);
          setDetailOptionValues({});
          setDetailOptionMultipleSelections({});
          // 기본값 설정
          tabConfig.detailOptions.options.forEach(option => {
            setDetailOptionValues(prev => ({
              ...prev,
              [option.key]: option.defaultValue || ''
            }));
            // 여러 개 선택 가능한 옵션인 경우 배열로 초기화
            if (option.multiple) {
              setDetailOptionMultipleSelections(prev => ({
                ...prev,
                [option.key]: []
              }));
            }
          });
          setPendingTab({ modeKey, tabKey, tabId });
          setDetailOptionOpen(true);
          return;
        }
        
        // 세부 옵션이 없는 경우 바로 슬라이드 생성
        const newSlide = {
          slideId: `slide-${modeKey}-${tabKey}-${Date.now()}`,
          type: 'mode-tab',
          mode: modeKey,
          tab: tabKey,
          tabLabel: tabConfig?.label || tabKey,
          order: slides.length + 1
        };
        setSlides([...slides, newSlide]);
      }
    }
  };
  
  const addTabSlide = (modeKey, tabKey, tabId, detailOptions = {}) => {
    const availableTabs = getAvailableTabsForMode(modeKey, loggedInStore);
    const tabConfig = availableTabs.find(t => t.key === tabKey);
    
    const newSlide = {
      slideId: `slide-${modeKey}-${tabKey}-${Date.now()}`,
      type: 'mode-tab',
      mode: modeKey,
      tab: tabKey,
      tabLabel: tabConfig?.label || tabKey,
      // 세부 옵션 (모든 옵션을 detailOptions 객체에 저장)
      detailOptions: Object.keys(detailOptions).length > 0 ? detailOptions : undefined,
      order: slides.length + 1
    };
    
    setSlides([...slides, newSlide]);
  };

  const handleSubTabToggle = (modeKey, tabKey, subTabKey) => {
    const subTabId = `${modeKey}-${tabKey}-${subTabKey}`;
    
    if (selectedSubTabs.includes(subTabId)) {
      // 하부 탭 제거
      setSelectedSubTabs(selectedSubTabs.filter(st => st !== subTabId));
      setSlides(slides.filter(s => 
        !(s.type === 'mode-tab' && s.mode === modeKey && s.tab === tabKey && s.subTab === subTabKey)
      ));
    } else {
      // 하부 탭의 세부 옵션 확인
      const availableTabs = getAvailableTabsForMode(modeKey, loggedInStore);
      const tabConfig = availableTabs.find(t => t.key === tabKey);
      const subTabConfig = tabConfig?.subTabs?.find(st => st.key === subTabKey);
      
      // 세부 옵션이 있는 경우 모달 표시
      if (subTabConfig?.detailOptions) {
        setDetailOptionConfig(subTabConfig.detailOptions);
        setDetailOptionValues({});
        setDetailOptionMultipleSelections({});
        // 기본값 설정
        subTabConfig.detailOptions.options.forEach(option => {
          setDetailOptionValues(prev => ({
            ...prev,
            [option.key]: option.defaultValue || ''
          }));
          // 여러 개 선택 가능한 옵션인 경우 배열로 초기화
          if (option.multiple) {
            setDetailOptionMultipleSelections(prev => ({
              ...prev,
              [option.key]: []
            }));
          }
        });
        setPendingSubTab({ modeKey, tabKey, subTabKey, subTabId });
        setDetailOptionOpen(true);
        return;
      }
      
      // 세부 옵션이 없는 경우 바로 추가
      addSubTabSlide(modeKey, tabKey, subTabKey, subTabId);
    }
  };

  const addSubTabSlide = (modeKey, tabKey, subTabKey, subTabId, detailOptions = {}) => {
    setSelectedSubTabs([...selectedSubTabs, subTabId]);
    
    const availableTabs = getAvailableTabsForMode(modeKey, loggedInStore);
    const tabConfig = availableTabs.find(t => t.key === tabKey);
    const subTabConfig = tabConfig?.subTabs?.find(st => st.key === subTabKey);
    
    const newSlide = {
      slideId: `slide-${modeKey}-${tabKey}-${subTabKey}-${Date.now()}`,
      type: 'mode-tab',
      mode: modeKey,
      tab: tabKey,
      subTab: subTabKey,
      tabLabel: tabConfig?.label || tabKey,
      subTabLabel: subTabConfig?.label || subTabKey,
      // 세부 옵션 (모든 옵션을 detailOptions 객체에 저장)
      detailOptions: Object.keys(detailOptions).length > 0 ? detailOptions : undefined,
      order: slides.length + 1
    };
    
    setSlides([...slides, newSlide]);
  };

  const handleModeOnlyToggle = (modeKey) => {
    // 탭이 없는 모드의 경우 모드 전체를 슬라이드로 추가
    const existingSlide = slides.find(s => s.type === 'mode-only' && s.mode === modeKey);
    
    if (existingSlide) {
      // 제거
      setSlides(slides.filter(s => !(s.type === 'mode-only' && s.mode === modeKey)));
    } else {
      // 추가
      const modeConfig = getModeConfig(modeKey);
      const newSlide = {
        slideId: `slide-${modeKey}-mode-${Date.now()}`,
        type: 'mode-only',
        mode: modeKey,
        tabLabel: modeConfig?.title || modeKey,
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
        meetingLocation: formData.meetingLocation.trim(),
        participants: formData.participants.trim(),
        createdBy: loggedInStore?.name || loggedInStore?.target || 'Unknown'
      };
      
      // 회의 메인 화면 슬라이드 생성 (첫 번째 슬라이드로 자동 추가)
      const mainSlide = {
        slideId: `main-slide-${Date.now()}`,
        type: 'main',
        order: 0, // 첫 번째 슬라이드
        title: formData.meetingName.trim(),
        meetingDate: formData.meetingDate,
        meetingNumber: parseInt(formData.meetingNumber),
        meetingLocation: formData.meetingLocation.trim(),
        participants: formData.participants.trim(),
        createdBy: loggedInStore?.name || loggedInStore?.target || 'Unknown'
      };
      
      // 목차 슬라이드 생성 (두 번째 슬라이드로 자동 추가)
      // mode-tab 타입의 슬라이드들을 모드별로 그룹화
      const modeGroups = {};
      slides.forEach(slide => {
        if (slide.type === 'mode-tab' && slide.mode) {
          const modeKey = slide.mode;
          if (!modeGroups[modeKey]) {
            modeGroups[modeKey] = [];
          }
          modeGroups[modeKey].push(slide);
        } else if (slide.type === 'mode-only' && slide.mode) {
          const modeKey = slide.mode;
          if (!modeGroups[modeKey]) {
            modeGroups[modeKey] = [];
          }
          modeGroups[modeKey].push(slide);
        } else if (slide.type === 'custom') {
          // 커스텀 슬라이드도 별도로 표시
          if (!modeGroups['custom']) {
            modeGroups['custom'] = [];
          }
          modeGroups['custom'].push(slide);
        }
      });
      
      const tocSlide = {
        slideId: `toc-slide-${Date.now()}`,
        type: 'toc',
        order: 1, // 두 번째 슬라이드
        title: '회의 목차',
        meetingName: formData.meetingName.trim(),
        modeGroups: modeGroups, // 모드별 그룹화된 슬라이드 정보
        createdBy: loggedInStore?.name || loggedInStore?.target || 'Unknown'
      };
      
      // 기존 슬라이드들의 order를 2씩 증가시키고 메인 슬라이드와 목차 슬라이드를 맨 앞에 추가
      const updatedSlides = slides.map(slide => ({
        ...slide,
        order: slide.order + 2
      }));
      
      // 엔딩 슬라이드 생성 (마지막 슬라이드로 자동 추가)
      const maxOrder = updatedSlides.length > 0 
        ? Math.max(...updatedSlides.map(s => s.order))
        : 1;
      
      const endingSlide = {
        slideId: `ending-slide-${Date.now()}`,
        type: 'ending',
        order: maxOrder + 1, // 마지막 슬라이드
        title: '회의 종료',
        meetingName: formData.meetingName.trim(),
        meetingDate: formData.meetingDate,
        meetingNumber: parseInt(formData.meetingNumber),
        createdBy: loggedInStore?.name || loggedInStore?.target || 'Unknown'
      };
      
      const finalSlides = [mainSlide, tocSlide, ...updatedSlides, endingSlide];

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
        
        // 설정 저장 (메인 슬라이드 포함)
        await api.saveMeetingConfig(createdMeeting.meetingId, { slides: finalSlides });
        
        // 회의 상태를 capturing으로 변경
        await api.updateMeeting(createdMeeting.meetingId, {
          status: 'capturing'
        });

        if (onSuccess) {
          // 생성된 회의 정보와 슬라이드를 전달 (캡처 시작을 위해)
          onSuccess({ ...createdMeeting, slides: finalSlides });
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('회의 저장 오류:', err);
      }
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
      <DialogContent sx={{ maxHeight: '80vh', overflowY: 'auto' }}>
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
                onModeOnlyToggle={handleModeOnlyToggle}
                selectedSubTabs={selectedSubTabs}
                onSubTabToggle={handleSubTabToggle}
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

              <TextField
                fullWidth
                label="회의 장소"
                value={formData.meetingLocation}
                onChange={handleChange('meetingLocation')}
                error={!!errors.meetingLocation}
                helperText={errors.meetingLocation}
                margin="normal"
                placeholder="예: 본사 회의실, 온라인 등"
              />

              <TextField
                fullWidth
                label="참석자"
                value={formData.participants}
                onChange={handleChange('participants')}
                error={!!errors.participants}
                helperText={errors.participants || '참석자 이름을 쉼표로 구분하여 입력하세요'}
                margin="normal"
                placeholder="예: 홍길동, 김철수, 이영희"
                multiline
                rows={3}
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
        meetingDate={formData.meetingDate || new Date().toISOString().split('T')[0]}
        meetingNumber={formData.meetingNumber ? parseInt(formData.meetingNumber) : null}
      />

      {/* 세부 옵션 선택 모달 (일반화) */}
      <Dialog open={detailOptionOpen} onClose={() => setDetailOptionOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>세부 옵션 선택</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            {detailOptionConfig?.options?.map((option) => {
              // 여러 개 선택 가능한 옵션인 경우 체크박스로 표시
              if (option.multiple) {
                const selectedValues = detailOptionMultipleSelections[option.key] || [];
                return (
                  <FormControl key={option.key} fullWidth>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>{option.label}</Typography>
                    <FormGroup>
                      {option.values?.filter(v => v.key !== 'all').map((value) => (
                        <FormControlLabel
                          key={value.key}
                          control={
                            <Checkbox
                              checked={selectedValues.includes(value.key)}
                              onChange={(e) => {
                                const newValues = e.target.checked
                                  ? [...selectedValues, value.key]
                                  : selectedValues.filter(v => v !== value.key);
                                setDetailOptionMultipleSelections(prev => ({
                                  ...prev,
                                  [option.key]: newValues
                                }));
                              }}
                            />
                          }
                          label={value.label}
                        />
                      ))}
                    </FormGroup>
                  </FormControl>
                );
              }
              // 단일 선택 옵션
              return (
                <FormControl key={option.key} fullWidth>
                  <InputLabel>{option.label}</InputLabel>
                  <Select
                    value={detailOptionValues[option.key] || option.defaultValue || ''}
                    onChange={(e) => {
                      setDetailOptionValues(prev => ({
                        ...prev,
                        [option.key]: e.target.value
                      }));
                    }}
                    label={option.label}
                  >
                    {option.values?.map((value) => (
                      <MenuItem key={value.key} value={value.key}>
                        {value.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetailOptionOpen(false);
            setDetailOptionConfig(null);
            setDetailOptionValues({});
            setDetailOptionMultipleSelections({});
            setPendingSubTab(null);
            setPendingTab(null);
          }}>취소</Button>
          <Button
            variant="contained"
            onClick={() => {
              // 탭 선택 시 세부 옵션 처리
              if (pendingTab) {
                // 탭의 경우 여러 개 선택 옵션이 없으므로 바로 슬라이드 생성
                addTabSlide(
                  pendingTab.modeKey,
                  pendingTab.tabKey,
                  pendingTab.tabId,
                  detailOptionValues
                );
                setPendingTab(null);
              } else if (pendingSubTab) {
                // 여러 개 선택 가능한 옵션이 있는 경우 각각 슬라이드 생성
                const multipleOptionKeys = detailOptionConfig?.options
                  ?.filter(opt => opt.multiple)
                  .map(opt => opt.key) || [];
                
                if (multipleOptionKeys.length > 0) {
                  // 여러 개 선택된 값이 있는 경우 각각 슬라이드 생성
                  const firstMultipleOption = detailOptionConfig.options.find(opt => opt.multiple);
                  if (firstMultipleOption) {
                    const selectedValues = detailOptionMultipleSelections[firstMultipleOption.key] || [];
                    if (selectedValues.length > 0) {
                      // 각 선택값에 대해 슬라이드 생성
                      selectedValues.forEach(selectedValue => {
                        const combinedOptions = {
                          ...detailOptionValues,
                          [firstMultipleOption.key]: selectedValue
                        };
                        // 다른 여러 개 선택 옵션도 처리
                        multipleOptionKeys.forEach(key => {
                          if (key !== firstMultipleOption.key) {
                            const otherSelected = detailOptionMultipleSelections[key] || [];
                            if (otherSelected.length > 0) {
                              combinedOptions[key] = otherSelected[0]; // 첫 번째 값 사용
                            }
                          }
                        });
                        // csDetailType이 여러 개 선택된 경우, 각 선택값을 csDetailType으로 명시적으로 설정
                        if (firstMultipleOption.key === 'csDetailType') {
                          combinedOptions.csDetailType = selectedValue;
                        }
                        addSubTabSlide(
                          pendingSubTab.modeKey,
                          pendingSubTab.tabKey,
                          pendingSubTab.subTabKey,
                          `${pendingSubTab.subTabId}-${selectedValue}-${Date.now()}`,
                          combinedOptions
                        );
                      });
                    } else {
                      // 선택된 값이 없으면 기본값으로 슬라이드 생성
                      addSubTabSlide(
                        pendingSubTab.modeKey,
                        pendingSubTab.tabKey,
                        pendingSubTab.subTabKey,
                        pendingSubTab.subTabId,
                        detailOptionValues
                      );
                    }
                  }
                } else {
                  // 여러 개 선택 옵션이 없는 경우 기존대로 처리
                  addSubTabSlide(
                    pendingSubTab.modeKey,
                    pendingSubTab.tabKey,
                    pendingSubTab.subTabKey,
                    pendingSubTab.subTabId,
                    detailOptionValues
                  );
                }
                setPendingSubTab(null);
              }
              setDetailOptionOpen(false);
              setDetailOptionConfig(null);
              setDetailOptionValues({});
              setDetailOptionMultipleSelections({});
            }}
            disabled={!pendingTab && !pendingSubTab}
          >
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export default MeetingEditor;

