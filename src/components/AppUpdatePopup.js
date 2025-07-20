import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  TextField,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  Close as CloseIcon,
  Update as UpdateIcon,
  Add as AddIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { 
  getLatestUpdateForMode, 
  getUpdatesForMode, 
  getAvailableDates, 
  checkAdminPermission, 
  addNewUpdate 
} from '../utils/appUpdateService';

// 모드별 색상 설정
const MODE_COLORS = {
  'general': '#757575',    // 회색
  'agent': '#1976d2',      // 파란색
  'inventory': '#2e7d32',  // 초록색
  'settlement': '#d32f2f', // 빨간색
  'inspection': '#7b1fa2', // 보라색
  'policy': '#00bcd4',     // 청록색
  'meeting': '#667eea',    // 보라파란색
  'reservation': '#ff9a9e', // 핑크색
  'chart': '#ff9800'       // 주황색
};

// 모드별 제목
const MODE_TITLES = {
  'general': '일반 모드',
  'agent': '관리자 모드',
  'inventory': '재고 관리 모드',
  'settlement': '정산 모드',
  'inspection': '검수 모드',
  'policy': '정책 모드',
  'meeting': '회의 모드',
  'reservation': '사전예약 모드',
  'chart': '장표 모드'
};

function AppUpdatePopup({ 
  open, 
  onClose, 
  mode, 
  loggedInStore,
  onUpdateAdded 
}) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hideToday, setHideToday] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUpdate, setNewUpdate] = useState({
    date: new Date().toISOString().split('T')[0],
    content: ''
  });

  const modeColor = MODE_COLORS[mode] || '#757575';
  const modeTitle = MODE_TITLES[mode] || '알 수 없는 모드';

  // 업데이트 데이터 로드
  const loadUpdates = async (showAll = false) => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`업데이트 로드 시작: ${mode} 모드, showAll: ${showAll}`);
      let updateData;
      if (showAll) {
        updateData = await getUpdatesForMode(mode);
      } else {
        updateData = await getLatestUpdateForMode(mode, 1);
      }
      console.log(`업데이트 로드 완료: ${mode} 모드, 데이터 개수: ${updateData.length}`);
      setUpdates(updateData);
    } catch (error) {
      console.error('업데이트 로드 오류:', error);
      setError('업데이트 내용을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 사용 가능한 날짜 로드
  const loadAvailableDates = async () => {
    try {
      const dates = await getAvailableDates(mode);
      setAvailableDates(dates);
    } catch (error) {
      console.error('날짜 목록 로드 오류:', error);
    }
  };

  // 관리자 권한 확인
  const checkAdmin = async () => {
    if (loggedInStore?.id) {
      const adminStatus = await checkAdminPermission(loggedInStore.id);
      setIsAdmin(adminStatus);
    }
  };

  // 날짜별 업데이트 필터링
  const handleDateChange = async (date) => {
    setSelectedDate(date);
    if (date) {
      setLoading(true);
      try {
        const filteredUpdates = await getUpdatesForMode(mode);
        const dateFiltered = filteredUpdates.filter(update => 
          update.date.includes(date)
        );
        setUpdates(dateFiltered);
      } catch (error) {
        console.error('날짜별 필터링 오류:', error);
        setError('날짜별 필터링에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    } else {
      loadUpdates(showHistory);
    }
  };

  // 새 업데이트 추가
  const handleAddUpdate = async () => {
    if (!newUpdate.content.trim()) {
      setError('업데이트 내용을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await addNewUpdate({
        mode,
        date: newUpdate.date,
        content: newUpdate.content
      });

      // 성공 시 폼 초기화 및 업데이트 목록 새로고침
      setNewUpdate({
        date: new Date().toISOString().split('T')[0],
        content: ''
      });
      setShowAddForm(false);
      loadUpdates(showHistory);
      
      if (onUpdateAdded) {
        onUpdateAdded();
      }

      alert('업데이트가 성공적으로 추가되었습니다.');
    } catch (error) {
      console.error('업데이트 추가 오류:', error);
      setError('업데이트 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 팝업 닫기
  const handleClose = () => {
    if (hideToday) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      localStorage.setItem(`hideUpdate_${mode}`, tomorrow.toISOString());
    }
    onClose();
  };

  // 초기화
  useEffect(() => {
    console.log('AppUpdatePopup useEffect:', { open, mode, showHistory });
    if (open && mode) {
      loadUpdates(showHistory);
      loadAvailableDates();
      checkAdmin();
      
      // 오늘 하루 보지 않기 설정 확인
      const hideUntil = localStorage.getItem(`hideUpdate_${mode}`);
      if (hideUntil && new Date() < new Date(hideUntil)) {
        console.log(`팝업 숨김 설정됨: ${mode} 모드`);
        onClose();
        return;
      }
    }
  }, [open, mode, showHistory]);

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          background: `linear-gradient(135deg, ${modeColor} 0%, ${modeColor}dd 100%)`,
          color: 'white',
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UpdateIcon />
          <Typography variant="h6" component="div">
            {modeTitle} 업데이트
          </Typography>
        </Box>
        <IconButton 
          onClick={handleClose} 
          sx={{ color: 'white' }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 관리자 추가 버튼 */}
        {isAdmin && (
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" color="text.secondary">
              관리자 권한으로 업데이트를 추가할 수 있습니다.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowAddForm(!showAddForm)}
              sx={{ 
                borderColor: modeColor, 
                color: modeColor,
                '&:hover': { borderColor: modeColor, backgroundColor: `${modeColor}10` }
              }}
            >
              업데이트 추가
            </Button>
          </Box>
        )}

        {/* 새 업데이트 추가 폼 */}
        {showAddForm && isAdmin && (
          <Card sx={{ mb: 3, border: `1px solid ${modeColor}20` }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: modeColor }}>
                새 업데이트 추가
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="날짜"
                    type="date"
                    value={newUpdate.date}
                    onChange={(e) => setNewUpdate(prev => ({ ...prev, date: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="업데이트 내용"
                    multiline
                    rows={3}
                    value={newUpdate.content}
                    onChange={(e) => setNewUpdate(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="업데이트 내용을 입력하세요..."
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={handleAddUpdate}
                      disabled={loading}
                      sx={{ 
                        backgroundColor: modeColor,
                        '&:hover': { backgroundColor: modeColor }
                      }}
                    >
                      {loading ? <CircularProgress size={20} /> : '추가'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => setShowAddForm(false)}
                    >
                      취소
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* 필터 및 옵션 */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant={showHistory ? "contained" : "outlined"}
              startIcon={<HistoryIcon />}
              onClick={() => {
                setShowHistory(!showHistory);
                setSelectedDate('');
              }}
              size="small"
              sx={{ 
                ...(showHistory && {
                  backgroundColor: modeColor,
                  '&:hover': { backgroundColor: modeColor }
                })
              }}
            >
              지난 업데이트 보기
            </Button>
            
            {showHistory && availableDates.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>날짜 선택</InputLabel>
                <Select
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  label="날짜 선택"
                >
                  <MenuItem value="">전체</MenuItem>
                  {availableDates.map((date) => (
                    <MenuItem key={date} value={date}>
                      {date}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={hideToday}
                onChange={(e) => setHideToday(e.target.checked)}
                size="small"
              />
            }
            label="오늘 하루 보지 않기"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 업데이트 목록 */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : updates.length > 0 ? (
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {updates.map((update, index) => (
              <Card 
                key={index} 
                sx={{ 
                  mb: 2, 
                  border: `1px solid ${modeColor}20`,
                  '&:hover': { boxShadow: `0 4px 12px ${modeColor}20` }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Chip 
                      label={update.date} 
                      size="small" 
                      sx={{ 
                        backgroundColor: modeColor, 
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    />
                    {index === 0 && !showHistory && (
                      <Chip 
                        icon={<CheckCircleIcon />}
                        label="최신" 
                        size="small" 
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6
                    }}
                  >
                    {update.content}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <Typography variant="body1" color="text.secondary">
              {showHistory ? '해당 날짜의 업데이트가 없습니다.' : '최신 업데이트가 없습니다.'}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={handleClose}
          variant="contained"
          sx={{ 
            backgroundColor: modeColor,
            '&:hover': { backgroundColor: modeColor }
          }}
        >
          확인
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AppUpdatePopup; 