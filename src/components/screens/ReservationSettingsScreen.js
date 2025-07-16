import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

function ReservationSettingsScreen({ loggedInStore }) {
  // 상태 관리
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 사전예약사이트 데이터
  const [reservationSiteData, setReservationSiteData] = useState({
    pColumn: [],
    qColumn: [],
    rColumn: []
  });

  // 폰클 데이터
  const [phoneklData, setPhoneklData] = useState({
    fColumn: [],
    gColumn: []
  });

  // 선택된 값들
  const [selectedValues, setSelectedValues] = useState({
    reservationSite: {
      p: '',
      q: '',
      r: ''
    },
    phonekl: {
      f: '',
      g: ''
    }
  });

  // 매칭 결과
  const [matchingResult, setMatchingResult] = useState({
    normalizedModel: '',
    matchingStatus: '',
    isMatched: false
  });

  // 검색어
  const [searchTerms, setSearchTerms] = useState({
    reservationSite: { p: '', q: '', r: '' },
    phonekl: { f: '', g: '' }
  });

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-settings/data`);
      if (response.ok) {
        const data = await response.json();
        setReservationSiteData(data.reservationSite);
        setPhoneklData(data.phonekl);
        setMessage({ type: 'success', text: '데이터를 성공적으로 로드했습니다.' });
      } else {
        throw new Error('데이터 로드 실패');
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      setMessage({ type: 'error', text: '데이터 로드 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 저장된 설정 불러오기
  const loadSavedSettings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-settings/load`);
      if (response.ok) {
        const data = await response.json();
        setSelectedValues(data.selectedValues);
        setMatchingResult(data.matchingResult);
        setMessage({ type: 'success', text: '저장된 설정을 불러왔습니다.' });
      }
    } catch (error) {
      console.error('설정 불러오기 오류:', error);
    }
  };

  // 설정 저장
  const saveSettings = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-settings/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedValues,
          matchingResult
        })
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: '설정이 성공적으로 저장되었습니다.' });
      } else {
        throw new Error('저장 실패');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  // 초기화
  const resetSettings = () => {
    setSelectedValues({
      reservationSite: { p: '', q: '', r: '' },
      phonekl: { f: '', g: '' }
    });
    setMatchingResult({
      normalizedModel: '',
      matchingStatus: '',
      isMatched: false
    });
    setSearchTerms({
      reservationSite: { p: '', q: '', r: '' },
      phonekl: { f: '', g: '' }
    });
    setMessage({ type: 'info', text: '설정이 초기화되었습니다.' });
  };

  // 매칭 실행
  const runMatching = () => {
    const { reservationSite, phonekl } = selectedValues;
    
    // 간단한 매칭 로직 (실제로는 더 복잡한 로직이 필요)
    const hasReservationData = reservationSite.p || reservationSite.q || reservationSite.r;
    const hasPhoneklData = phonekl.f || phonekl.g;
    
    if (hasReservationData && hasPhoneklData) {
      const normalizedModel = `${reservationSite.p || ''} ${reservationSite.q || ''} ${reservationSite.r || ''}`.trim();
      setMatchingResult({
        normalizedModel,
        matchingStatus: '매칭 완료',
        isMatched: true
      });
      setMessage({ type: 'success', text: '매칭이 완료되었습니다.' });
    } else {
      setMatchingResult({
        normalizedModel: '',
        matchingStatus: '데이터 부족',
        isMatched: false
      });
      setMessage({ type: 'warning', text: '매칭을 위해 더 많은 데이터가 필요합니다.' });
    }
  };

  // 필터링된 옵션 생성
  const getFilteredOptions = (data, searchTerm) => {
    if (!searchTerm) return data;
    return data.filter(item => 
      item.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadData();
    loadSavedSettings();
  }, []);

  // 선택된 값이 변경될 때마다 매칭 실행
  useEffect(() => {
    if (Object.values(selectedValues.reservationSite).some(v => v) || 
        Object.values(selectedValues.phonekl).some(v => v)) {
      runMatching();
    }
  }, [selectedValues]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold', color: '#ff9a9e' }}>
        사전예약정리 셋팅
      </Typography>

      {/* 메시지 표시 */}
      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}

      {/* 액션 버튼들 */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={saveSettings}
          disabled={saving}
          sx={{ backgroundColor: '#ff9a9e', '&:hover': { backgroundColor: '#f48fb1' } }}
        >
          {saving ? <CircularProgress size={20} /> : '저장'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : '새로고침'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<ClearIcon />}
          onClick={resetSettings}
          color="warning"
        >
          초기화
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* 사전예약사이트 모델명형식 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
                사전예약사이트 모델명형식
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="P열 검색"
                  value={searchTerms.reservationSite.p}
                  onChange={(e) => setSearchTerms(prev => ({
                    ...prev,
                    reservationSite: { ...prev.reservationSite, p: e.target.value }
                  }))}
                  size="small"
                  sx={{ mb: 1 }}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>P열 선택</InputLabel>
                  <Select
                    value={selectedValues.reservationSite.p}
                    onChange={(e) => setSelectedValues(prev => ({
                      ...prev,
                      reservationSite: { ...prev.reservationSite, p: e.target.value }
                    }))}
                    label="P열 선택"
                  >
                    {getFilteredOptions(reservationSiteData.pColumn, searchTerms.reservationSite.p).map((item, index) => (
                      <MenuItem key={index} value={item}>{item}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Q열 검색"
                  value={searchTerms.reservationSite.q}
                  onChange={(e) => setSearchTerms(prev => ({
                    ...prev,
                    reservationSite: { ...prev.reservationSite, q: e.target.value }
                  }))}
                  size="small"
                  sx={{ mb: 1 }}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Q열 선택</InputLabel>
                  <Select
                    value={selectedValues.reservationSite.q}
                    onChange={(e) => setSelectedValues(prev => ({
                      ...prev,
                      reservationSite: { ...prev.reservationSite, q: e.target.value }
                    }))}
                    label="Q열 선택"
                  >
                    {getFilteredOptions(reservationSiteData.qColumn, searchTerms.reservationSite.q).map((item, index) => (
                      <MenuItem key={index} value={item}>{item}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="R열 검색"
                  value={searchTerms.reservationSite.r}
                  onChange={(e) => setSearchTerms(prev => ({
                    ...prev,
                    reservationSite: { ...prev.reservationSite, r: e.target.value }
                  }))}
                  size="small"
                  sx={{ mb: 1 }}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>R열 선택</InputLabel>
                  <Select
                    value={selectedValues.reservationSite.r}
                    onChange={(e) => setSelectedValues(prev => ({
                      ...prev,
                      reservationSite: { ...prev.reservationSite, r: e.target.value }
                    }))}
                    label="R열 선택"
                  >
                    {getFilteredOptions(reservationSiteData.rColumn, searchTerms.reservationSite.r).map((item, index) => (
                      <MenuItem key={index} value={item}>{item}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 폰클 모델명형식 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
                폰클 모델명형식
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="F열 검색"
                  value={searchTerms.phonekl.f}
                  onChange={(e) => setSearchTerms(prev => ({
                    ...prev,
                    phonekl: { ...prev.phonekl, f: e.target.value }
                  }))}
                  size="small"
                  sx={{ mb: 1 }}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>F열 선택</InputLabel>
                  <Select
                    value={selectedValues.phonekl.f}
                    onChange={(e) => setSelectedValues(prev => ({
                      ...prev,
                      phonekl: { ...prev.phonekl, f: e.target.value }
                    }))}
                    label="F열 선택"
                  >
                    {getFilteredOptions(phoneklData.fColumn, searchTerms.phonekl.f).map((item, index) => (
                      <MenuItem key={index} value={item}>{item}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="G열 검색"
                  value={searchTerms.phonekl.g}
                  onChange={(e) => setSearchTerms(prev => ({
                    ...prev,
                    phonekl: { ...prev.phonekl, g: e.target.value }
                  }))}
                  size="small"
                  sx={{ mb: 1 }}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>G열 선택</InputLabel>
                  <Select
                    value={selectedValues.phonekl.g}
                    onChange={(e) => setSelectedValues(prev => ({
                      ...prev,
                      phonekl: { ...prev.phonekl, g: e.target.value }
                    }))}
                    label="G열 선택"
                  >
                    {getFilteredOptions(phoneklData.gColumn, searchTerms.phonekl.g).map((item, index) => (
                      <MenuItem key={index} value={item}>{item}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 매칭 결과 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
                매칭 결과
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  정규화된 모델명:
                </Typography>
                <Chip
                  label={matchingResult.normalizedModel || '선택된 값이 없습니다'}
                  color={matchingResult.isMatched ? 'success' : 'default'}
                  icon={matchingResult.isMatched ? <CheckCircleIcon /> : <WarningIcon />}
                />
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  매칭 상태:
                </Typography>
                <Chip
                  label={matchingResult.matchingStatus || '대기 중'}
                  color={matchingResult.isMatched ? 'success' : 'warning'}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

export default ReservationSettingsScreen; 