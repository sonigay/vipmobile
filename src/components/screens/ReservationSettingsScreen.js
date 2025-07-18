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
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Autocomplete
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  List as ListIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
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

  // 정규화 항목들 (여러 개 추가 가능)
  const [normalizationItems, setNormalizationItems] = useState([
    {
      id: 1,
      reservationSite: { p: '', q: '', r: '' },
      phonekl: { f: '', g: '' },
      normalizedModel: '',
      matchingStatus: '',
      isMatched: false
    }
  ]);

  // 저장된 정규화 목록
  const [savedNormalizationList, setSavedNormalizationList] = useState([]);
  const [showSavedList, setShowSavedList] = useState(false);

  // 정규화된 데이터
  const [normalizedData, setNormalizedData] = useState({
    reservationSiteData: [],
    phoneklData: [],
    stats: {}
  });
  const [showNormalizedData, setShowNormalizedData] = useState(false);
  const [loadingNormalizedData, setLoadingNormalizedData] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInput, setManualInput] = useState({
    reservationSite: { p: '', q: '', r: '' },
    phonekl: { f: '', g: '' },
    normalizedModel: ''
  });

  // POS코드변경설정 관련 상태
  const [posCodeMappings, setPosCodeMappings] = useState([]);
  const [loadingPosCodeMappings, setLoadingPosCodeMappings] = useState(false);
  const [showPosCodeMappingSection, setShowPosCodeMappingSection] = useState(true);

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

  // 저장된 정규화 목록 불러오기
  const loadSavedNormalizationList = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-settings/list`);
      if (response.ok) {
        const data = await response.json();
        setSavedNormalizationList(data.normalizationList);
      }
    } catch (error) {
      console.error('정규화 목록 불러오기 오류:', error);
    }
  };

  // 정규화된 데이터 불러오기
  const loadNormalizedData = async () => {
    setLoadingNormalizedData(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-settings/normalized-data`);
      if (response.ok) {
        const data = await response.json();
        setNormalizedData(data);
        setMessage({ type: 'success', text: '정규화된 데이터를 성공적으로 불러왔습니다.' });
      } else {
        throw new Error('정규화된 데이터 로드 실패');
      }
    } catch (error) {
      console.error('정규화된 데이터 불러오기 오류:', error);
      setMessage({ type: 'error', text: '정규화된 데이터 로드 중 오류가 발생했습니다.' });
    } finally {
      setLoadingNormalizedData(false);
    }
  };

  // POS코드변경설정 데이터 불러오기
  const loadPosCodeMappings = async () => {
    setLoadingPosCodeMappings(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/pos-code-mappings`);
      if (response.ok) {
        const data = await response.json();
        setPosCodeMappings(data.mappings || []);
        setMessage({ type: 'success', text: 'POS코드변경설정을 성공적으로 불러왔습니다.' });
      } else {
        throw new Error('POS코드변경설정 로드 실패');
      }
    } catch (error) {
      console.error('POS코드변경설정 불러오기 오류:', error);
      setMessage({ type: 'error', text: 'POS코드변경설정 로드 중 오류가 발생했습니다.' });
    } finally {
      setLoadingPosCodeMappings(false);
    }
  };

  // POS코드변경설정 저장
  const savePosCodeMappings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/pos-code-mappings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mappings: posCodeMappings })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessage({ type: 'success', text: 'POS코드변경설정을 성공적으로 저장했습니다.' });
      } else {
        throw new Error('POS코드변경설정 저장 실패');
      }
    } catch (error) {
      console.error('POS코드변경설정 저장 오류:', error);
      setMessage({ type: 'error', text: 'POS코드변경설정 저장 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  // POS코드 매핑 추가
  const addPosCodeMapping = () => {
    setPosCodeMappings(prev => [...prev, {
      id: Date.now(),
      originalCode: '',
      receiverCode: '',
      mappedCode: '',
      descriptionCode: '',
      originalName: '',
      receiverName: '',
      mappedName: '',
      descriptionName: ''
    }]);
  };

  // POS코드 매핑 삭제
  const removePosCodeMapping = (id) => {
    setPosCodeMappings(prev => prev.filter(mapping => mapping.id !== id));
  };

  // POS코드 매핑 업데이트
  const updatePosCodeMapping = (id, field, value) => {
    setPosCodeMappings(prev => prev.map(mapping => 
      mapping.id === id ? { ...mapping, [field]: value } : mapping
    ));
  };

  // 정규화 항목 추가
  const addNormalizationItem = () => {
    const newId = Math.max(...normalizationItems.map(item => item.id), 0) + 1;
    setNormalizationItems(prev => [...prev, {
      id: newId,
      reservationSite: { p: '', q: '', r: '' },
      phonekl: { f: '', g: '' },
      normalizedModel: '',
      matchingStatus: '',
      isMatched: false
    }]);
  };

  // 정규화 항목 삭제
  const removeNormalizationItem = (id) => {
    if (normalizationItems.length > 1) {
      setNormalizationItems(prev => prev.filter(item => item.id !== id));
    }
  };

  // 정규화 항목 업데이트
  const updateNormalizationItem = (id, field, value) => {
    setNormalizationItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item };
        
        if (field.startsWith('reservationSite.')) {
          const subField = field.split('.')[1];
          updatedItem.reservationSite = { ...updatedItem.reservationSite, [subField]: value };
        } else if (field.startsWith('phonekl.')) {
          const subField = field.split('.')[1];
          updatedItem.phonekl = { ...updatedItem.phonekl, [subField]: value };
        } else {
          updatedItem[field] = value;
        }
        
        // 매칭 결과 업데이트 - 조건 완화
        const hasReservationData = updatedItem.reservationSite.p || updatedItem.reservationSite.q || updatedItem.reservationSite.r;
        const hasPhoneklData = updatedItem.phonekl.f || updatedItem.phonekl.g;
        
        // 하나라도 데이터가 있으면 매칭 완료로 처리
        if (hasReservationData || hasPhoneklData) {
          const reservationText = `${updatedItem.reservationSite.p || ''} ${updatedItem.reservationSite.q || ''} ${updatedItem.reservationSite.r || ''}`.trim();
          const phoneklText = `${updatedItem.phonekl.f || ''} ${updatedItem.phonekl.g || ''}`.trim();
          
          updatedItem.normalizedModel = `${reservationText} ${phoneklText}`.trim();
          updatedItem.matchingStatus = '매칭 완료';
          updatedItem.isMatched = true;
        } else {
          updatedItem.normalizedModel = '';
          updatedItem.matchingStatus = '데이터 부족';
          updatedItem.isMatched = false;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  // 모든 정규화 항목 저장
  const saveAllNormalizationItems = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      console.log('저장할 항목들:', normalizationItems);
      
      let savedCount = 0;
      let skippedCount = 0;
      
      // 각 항목을 개별적으로 저장
      for (const item of normalizationItems) {
        console.log(`항목 ${item.id} 매칭 상태:`, item.isMatched);
        console.log(`항목 ${item.id} 데이터:`, item.reservationSite, item.phonekl);
        
        // 데이터가 입력된 항목은 모두 저장 (매칭 여부와 관계없이)
        const hasReservationData = item.reservationSite.p || item.reservationSite.q || item.reservationSite.r;
        const hasPhoneklData = item.phonekl.f || item.phonekl.g;
        
        if (hasReservationData || hasPhoneklData) {
          console.log(`항목 ${item.id} 저장 시도...`);
          
          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-settings/save`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              selectedValues: {
                reservationSite: item.reservationSite,
                phonekl: item.phonekl
              },
              matchingResult: {
                normalizedModel: item.normalizedModel,
                matchingStatus: item.matchingStatus,
                isMatched: item.isMatched
              }
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`항목 ${item.id} 저장 실패:`, errorText);
            throw new Error(`저장 실패: ${errorText}`);
          }
          
          console.log(`항목 ${item.id} 저장 성공`);
          savedCount++;
        } else {
          console.log(`항목 ${item.id} 데이터가 없어 저장 건너뜀`);
          skippedCount++;
        }
      }
      
      console.log(`저장 완료: ${savedCount}개 저장, ${skippedCount}개 건너뜀`);
      
      if (savedCount > 0) {
        setMessage({ type: 'success', text: `${savedCount}개의 정규화 설정이 성공적으로 저장되었습니다.` });
      } else {
        setMessage({ type: 'warning', text: '저장할 데이터가 없습니다. 사전예약사이트 또는 폰클 데이터를 입력해주세요.' });
      }
      
      await loadSavedNormalizationList();
    } catch (error) {
      console.error('저장 오류:', error);
      setMessage({ type: 'error', text: `저장 중 오류가 발생했습니다: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  // 초기화
  const resetSettings = () => {
    setNormalizationItems([
      {
        id: 1,
        reservationSite: { p: '', q: '', r: '' },
        phonekl: { f: '', g: '' },
        normalizedModel: '',
        matchingStatus: '',
        isMatched: false
      }
    ]);
    setMessage({ type: 'info', text: '설정이 초기화되었습니다.' });
  };

  // 수기 입력 저장
  const saveManualInput = async () => {
    if (!manualInput.normalizedModel.trim()) {
      setMessage({ type: 'warning', text: '정규화된 모델명을 입력해주세요.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-settings/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedValues: {
            reservationSite: manualInput.reservationSite,
            phonekl: manualInput.phonekl
          },
          matchingResult: {
            normalizedModel: manualInput.normalizedModel,
            matchingStatus: '수기 입력',
            isMatched: true
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`저장 실패: ${errorText}`);
      }

      setMessage({ type: 'success', text: '수기 입력이 성공적으로 저장되었습니다.' });
      
      // 입력 필드 초기화
      setManualInput({
        reservationSite: { p: '', q: '', r: '' },
        phonekl: { f: '', g: '' },
        normalizedModel: ''
      });
      
      // 저장된 목록 새로고침
      await loadSavedNormalizationList();
    } catch (error) {
      console.error('수기 입력 저장 오류:', error);
      setMessage({ type: 'error', text: `저장 중 오류가 발생했습니다: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  // 날짜 포맷팅
  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('ko-KR');
    } catch (error) {
      return timestamp;
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadData();
    loadSavedNormalizationList();
    loadPosCodeMappings();
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
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
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={saveAllNormalizationItems}
          disabled={saving}
          sx={{ backgroundColor: '#ff9a9e', '&:hover': { backgroundColor: '#f48fb1' } }}
        >
          {saving ? <CircularProgress size={20} /> : '정규화 저장'}
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
        <Button
          variant="outlined"
          startIcon={<ListIcon />}
          onClick={() => {
            setShowSavedList(!showSavedList);
            if (!showSavedList) {
              loadSavedNormalizationList();
            }
          }}
          color="info"
        >
          {showSavedList ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          저장된 정규화 목록 ({savedNormalizationList.length})
        </Button>
        <Button
          variant="outlined"
          startIcon={<ListIcon />}
          onClick={() => {
            setShowNormalizedData(!showNormalizedData);
            if (!showNormalizedData) {
              loadNormalizedData();
            }
          }}
          color="secondary"
          disabled={loadingNormalizedData}
        >
          {loadingNormalizedData ? <CircularProgress size={20} /> : (showNormalizedData ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
          정규화된 데이터 조회
        </Button>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => setShowManualInput(!showManualInput)}
          color="warning"
        >
          {showManualInput ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          수기 입력
        </Button>
      </Box>

      {/* 저장된 정규화 목록 */}
      <Collapse in={showSavedList}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              저장된 정규화 목록
            </Typography>
            
            {savedNormalizationList.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>저장일시</TableCell>
                      <TableCell>사전예약사이트</TableCell>
                      <TableCell>폰클</TableCell>
                      <TableCell>정규화된 모델명</TableCell>
                      <TableCell>상태</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {savedNormalizationList.map((item, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{formatDate(item.timestamp)}</TableCell>
                        <TableCell>{item.reservationSite}</TableCell>
                        <TableCell>{item.phonekl}</TableCell>
                        <TableCell>
                          <Chip
                            label={item.normalizedModel}
                            color={item.isCompleted ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.isCompleted ? '완료' : '미완료'}
                            color={item.isCompleted ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                저장된 정규화 기록이 없습니다.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Collapse>

      {/* 수기 입력 */}
      <Collapse in={showManualInput}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              수기 입력 (폰클재고데이터에 없는 모델용)
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              사전예약사이트에 있는 모델이 폰클재고데이터에 없어서 매칭이 안 되는 경우, 수기로 입력하여 정규화작업을 완료할 수 있습니다.
            </Alert>
            
            <Grid container spacing={2}>
              {/* 사전예약사이트 입력 */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  사전예약사이트 데이터
                </Typography>
                <TextField
                  fullWidth
                  label="P열 (모델명)"
                  value={manualInput.reservationSite.p}
                  onChange={(e) => setManualInput(prev => ({
                    ...prev,
                    reservationSite: { ...prev.reservationSite, p: e.target.value }
                  }))}
                  size="small"
                  sx={{ mb: 1 }}
                />
                <TextField
                  fullWidth
                  label="Q열 (용량)"
                  value={manualInput.reservationSite.q}
                  onChange={(e) => setManualInput(prev => ({
                    ...prev,
                    reservationSite: { ...prev.reservationSite, q: e.target.value }
                  }))}
                  size="small"
                  sx={{ mb: 1 }}
                />
                <TextField
                  fullWidth
                  label="R열 (색상)"
                  value={manualInput.reservationSite.r}
                  onChange={(e) => setManualInput(prev => ({
                    ...prev,
                    reservationSite: { ...prev.reservationSite, r: e.target.value }
                  }))}
                  size="small"
                />
              </Grid>
              
              {/* 폰클 입력 */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  폰클 데이터 (선택사항)
                </Typography>
                <TextField
                  fullWidth
                  label="F열 (모델명&용량)"
                  value={manualInput.phonekl.f}
                  onChange={(e) => setManualInput(prev => ({
                    ...prev,
                    phonekl: { ...prev.phonekl, f: e.target.value }
                  }))}
                  size="small"
                  sx={{ mb: 1 }}
                />
                <TextField
                  fullWidth
                  label="G열 (색상)"
                  value={manualInput.phonekl.g}
                  onChange={(e) => setManualInput(prev => ({
                    ...prev,
                    phonekl: { ...prev.phonekl, g: e.target.value }
                  }))}
                  size="small"
                />
              </Grid>
              
              {/* 정규화된 모델명 입력 */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  정규화된 모델명 *
                </Typography>
                <TextField
                  fullWidth
                  label="정규화된 모델명을 입력하세요"
                  value={manualInput.normalizedModel}
                  onChange={(e) => setManualInput(prev => ({
                    ...prev,
                    normalizedModel: e.target.value
                  }))}
                  placeholder="예: iPhone 15 Pro Max 256GB 블랙타이타늄"
                  required
                  sx={{ mb: 2 }}
                />
              </Grid>
              
              {/* 저장 버튼 */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={saveManualInput}
                    disabled={saving || !manualInput.normalizedModel.trim()}
                    sx={{ backgroundColor: '#ff9a9e', '&:hover': { backgroundColor: '#f48fb1' } }}
                  >
                    {saving ? <CircularProgress size={20} /> : '수기 입력 저장'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setManualInput({
                      reservationSite: { p: '', q: '', r: '' },
                      phonekl: { f: '', g: '' },
                      normalizedModel: ''
                    })}
                  >
                    초기화
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Collapse>

      {/* 정규화된 데이터 조회 */}
      <Collapse in={showNormalizedData}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              정규화된 데이터 조회
            </Typography>
            
            {/* 통계 정보 */}
            {normalizedData.stats && Object.keys(normalizedData.stats).length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  정규화 통계
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Chip
                      label={`총 규칙: ${normalizedData.stats.totalRules || 0}`}
                      color="primary"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Chip
                      label={`사전예약사이트: ${normalizedData.stats.reservationSiteNormalized || 0}/${normalizedData.stats.reservationSiteTotal || 0}`}
                      color="success"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Chip
                      label={`폰클: ${normalizedData.stats.phoneklNormalized || 0}/${normalizedData.stats.phoneklTotal || 0}`}
                      color="info"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Chip
                      label={`사전예약사이트 완료율: ${normalizedData.stats.completionRate || 0}%`}
                      color={normalizedData.stats.isCompleted ? 'success' : 'secondary'}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Chip
                      label={`정규화 상태: ${normalizedData.stats.isCompleted ? '완료' : '진행중'}`}
                      color={normalizedData.stats.isCompleted ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* 사전예약사이트 정규화된 데이터 */}
            {normalizedData.reservationSiteData && normalizedData.reservationSiteData.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  사전예약사이트 정규화된 데이터 (최대 10개 표시)
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>행 번호</TableCell>
                        <TableCell>원본 P열</TableCell>
                        <TableCell>원본 Q열</TableCell>
                        <TableCell>원본 R열</TableCell>
                        <TableCell>정규화된 모델명</TableCell>
                        <TableCell>적용된 규칙</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {normalizedData.reservationSiteData.slice(0, 10).map((item, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{item.rowIndex}</TableCell>
                          <TableCell>{item.originalP}</TableCell>
                          <TableCell>{item.originalQ}</TableCell>
                          <TableCell>{item.originalR}</TableCell>
                          <TableCell>
                            <Chip
                              label={item.normalizedModel || '미정규화'}
                              color={item.normalizedModel ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {item.appliedRule ? (
                              <Chip
                                label={item.appliedRule.normalizedModel}
                                color="primary"
                                size="small"
                                variant="outlined"
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                규칙 없음
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {normalizedData.reservationSiteData.length > 10 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    총 {normalizedData.reservationSiteData.length}개 중 10개만 표시됩니다.
                  </Typography>
                )}
              </Box>
            )}

            {/* 폰클 정규화된 데이터 */}
            {normalizedData.phoneklData && normalizedData.phoneklData.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  폰클 정규화된 데이터 (최대 10개 표시)
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>행 번호</TableCell>
                        <TableCell>원본 F열</TableCell>
                        <TableCell>원본 G열</TableCell>
                        <TableCell>정규화된 모델명</TableCell>
                        <TableCell>적용된 규칙</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {normalizedData.phoneklData.slice(0, 10).map((item, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{item.rowIndex}</TableCell>
                          <TableCell>{item.originalF}</TableCell>
                          <TableCell>{item.originalG}</TableCell>
                          <TableCell>
                            <Chip
                              label={item.normalizedModel || '미정규화'}
                              color={item.normalizedModel ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {item.appliedRule ? (
                              <Chip
                                label={item.appliedRule.normalizedModel}
                                color="primary"
                                size="small"
                                variant="outlined"
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                규칙 없음
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {normalizedData.phoneklData.length > 10 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    총 {normalizedData.phoneklData.length}개 중 10개만 표시됩니다.
                  </Typography>
                )}
              </Box>
            )}

            {(!normalizedData.reservationSiteData || normalizedData.reservationSiteData.length === 0) && 
             (!normalizedData.phoneklData || normalizedData.phoneklData.length === 0) && (
              <Alert severity="info">
                정규화된 데이터가 없습니다. 먼저 정규화 규칙을 설정하고 저장해주세요.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Collapse>

      {/* POS코드변경설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
              🔧 POS코드변경설정 (NEW!)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={showPosCodeMappingSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setShowPosCodeMappingSection(!showPosCodeMappingSection)}
              >
                {showPosCodeMappingSection ? '접기' : '펼치기'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={loadPosCodeMappings}
                disabled={loadingPosCodeMappings}
              >
                {loadingPosCodeMappings ? <CircularProgress size={16} /> : '새로고침'}
              </Button>
            </Box>
          </Box>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>💡 POS코드 매칭 실패 문제 해결!</strong><br/>
              사전예약사이트의 POS코드와 폰클출고처데이터의 매장코드 매칭을 위한 설정입니다.
              접수자별로 다른 POS코드를 사용하는 경우 접수자명도 함께 설정할 수 있습니다.
            </Typography>
          </Alert>

          <Collapse in={showPosCodeMappingSection}>
            <Box sx={{ mt: 2 }}>
              {/* 매핑 목록 */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    POS코드 매핑 목록 ({posCodeMappings.length}개)
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addPosCodeMapping}
                    sx={{ backgroundColor: '#ff9a9e', '&:hover': { backgroundColor: '#f48fb1' } }}
                  >
                    매핑 추가
                  </Button>
                </Box>
                
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width="60px" align="center">순번</TableCell>
                        <TableCell width="120px">원본 POS코드</TableCell>
                        <TableCell width="100px">접수자명</TableCell>
                        <TableCell width="120px">변경될 POS코드</TableCell>
                        <TableCell width="150px">설명</TableCell>
                        <TableCell width="120px">원본 POS명</TableCell>
                        <TableCell width="100px">접수자명</TableCell>
                        <TableCell width="120px">변경될 POS명</TableCell>
                        <TableCell width="150px">설명</TableCell>
                        <TableCell width="80px" align="center">작업</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {posCodeMappings.map((mapping, index) => (
                        <TableRow key={mapping.id} hover>
                          <TableCell align="center">
                            <Chip
                              label={index + 1}
                              size="small"
                              color="default"
                              sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}
                            />
                          </TableCell>
                          {/* POS코드 변환 */}
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={mapping.originalCode}
                              onChange={(e) => updatePosCodeMapping(mapping.id, 'originalCode', e.target.value)}
                              placeholder="예: 306891"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={mapping.receiverCode}
                              onChange={(e) => updatePosCodeMapping(mapping.id, 'receiverCode', e.target.value)}
                              placeholder="예: 홍길동"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={mapping.mappedCode}
                              onChange={(e) => updatePosCodeMapping(mapping.id, 'mappedCode', e.target.value)}
                              placeholder="예: 306891(경수)"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={mapping.descriptionCode}
                              onChange={(e) => updatePosCodeMapping(mapping.id, 'descriptionCode', e.target.value)}
                              placeholder="예: 경수대리점 POS코드 매핑"
                            />
                          </TableCell>
                          {/* POS명 변환 */}
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={mapping.originalName}
                              onChange={(e) => updatePosCodeMapping(mapping.id, 'originalName', e.target.value)}
                              placeholder="예: LG사업자폰"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={mapping.receiverName}
                              onChange={(e) => updatePosCodeMapping(mapping.id, 'receiverName', e.target.value)}
                              placeholder="예: 홍길동"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={mapping.mappedName}
                              onChange={(e) => updatePosCodeMapping(mapping.id, 'mappedName', e.target.value)}
                              placeholder="예: LG사업자폰(경수)"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={mapping.descriptionName}
                              onChange={(e) => updatePosCodeMapping(mapping.id, 'descriptionName', e.target.value)}
                              placeholder="예: 경수대리점 POS명 매핑"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removePosCodeMapping(mapping.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* 저장 버튼 */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={savePosCodeMappings}
                  disabled={saving}
                  sx={{ backgroundColor: '#ff9a9e', '&:hover': { backgroundColor: '#f48fb1' } }}
                >
                  {saving ? <CircularProgress size={20} /> : 'POS코드변경설정 저장'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setPosCodeMappings([])}
                >
                  초기화
                </Button>
              </Box>

              {/* 사용법 안내 */}
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>사용법:</strong><br/>
                  1. <strong>POS코드 변환:</strong> 사전예약사이트의 POS코드를 폰클출고처데이터의 매장코드로 변환합니다.<br/>
                  2. <strong>POS명 변환:</strong> 사전예약사이트의 POS명을 폰클출고처데이터의 매장명으로 변환합니다.<br/>
                  3. <strong>일반 매핑:</strong> 접수자명을 비워두면 모든 접수자에 적용됩니다.<br/>
                  4. <strong>접수자별 매핑:</strong> 접수자명을 입력하면 해당 접수자에게만 적용됩니다.<br/>
                  5. <strong>우선순위:</strong> 접수자별 매핑이 일반 매핑보다 우선 적용됩니다.
                </Typography>
              </Alert>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* 정규화 설정 테이블 */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
              정규화 설정
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addNormalizationItem}
              size="small"
            >
              항목 추가
            </Button>
          </Box>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="50px">삭제</TableCell>
                  <TableCell width="200px">사전예약사이트</TableCell>
                  <TableCell width="200px">폰클</TableCell>
                  <TableCell width="150px">매칭 결과</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>P열(모델명)</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Q열(용량)</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>R열(색상)</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>F열(모델명&용량)</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>G열(색상)</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>정규화된 값</Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {normalizationItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => removeNormalizationItem(item.id)}
                        disabled={normalizationItems.length === 1}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Autocomplete
                          size="small"
                          options={reservationSiteData.pColumn || []}
                          value={item.reservationSite.p}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'reservationSite.p', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="P열(모델명)" size="small" sx={{ width: '120px' }} />}
                          freeSolo
                          sx={{ width: '120px' }}
                        />
                        <Autocomplete
                          size="small"
                          options={reservationSiteData.qColumn || []}
                          value={item.reservationSite.q}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'reservationSite.q', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="Q열(용량)" size="small" sx={{ width: '120px' }} />}
                          freeSolo
                          sx={{ width: '120px' }}
                        />
                        <Autocomplete
                          size="small"
                          options={reservationSiteData.rColumn || []}
                          value={item.reservationSite.r}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'reservationSite.r', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="R열(색상)" size="small" sx={{ width: '120px' }} />}
                          freeSolo
                          sx={{ width: '120px' }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Autocomplete
                          size="small"
                          options={phoneklData.fColumn || []}
                          value={item.phonekl.f}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'phonekl.f', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="F열(모델명&용량)" size="small" sx={{ width: '120px' }} />}
                          freeSolo
                          sx={{ width: '120px' }}
                        />
                        <Autocomplete
                          size="small"
                          options={phoneklData.gColumn || []}
                          value={item.phonekl.g}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'phonekl.g', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="G열(색상)" size="small" sx={{ width: '120px' }} />}
                          freeSolo
                          sx={{ width: '120px' }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Chip
                          label={item.normalizedModel || '정규화된 값 없음'}
                          color={item.isMatched ? 'success' : 'default'}
                          icon={item.isMatched ? <CheckCircleIcon /> : <WarningIcon />}
                          size="small"
                          sx={{ fontSize: '0.7rem', height: '20px' }}
                        />
                        <Typography 
                          variant="caption" 
                          color={item.isMatched ? 'success.main' : 'warning.main'}
                          sx={{ fontSize: '0.65rem', fontWeight: 'bold' }}
                        >
                          {item.matchingStatus || '대기 중'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Container>
  );
}

export default ReservationSettingsScreen; 