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
  Delete as DeleteIcon
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
        
        // 매칭 결과 업데이트
        const hasReservationData = updatedItem.reservationSite.p || updatedItem.reservationSite.q || updatedItem.reservationSite.r;
        const hasPhoneklData = updatedItem.phonekl.f || updatedItem.phonekl.g;
        
        if (hasReservationData && hasPhoneklData) {
          updatedItem.normalizedModel = `${updatedItem.reservationSite.p || ''} ${updatedItem.reservationSite.q || ''} ${updatedItem.reservationSite.r || ''}`.trim();
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
      // 각 항목을 개별적으로 저장
      for (const item of normalizationItems) {
        if (item.isMatched) { // 매칭된 항목만 저장
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
            throw new Error('저장 실패');
          }
        }
      }
      
      setMessage({ type: 'success', text: '정규화 설정이 성공적으로 저장되었습니다.' });
      await loadSavedNormalizationList();
    } catch (error) {
      console.error('저장 오류:', error);
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
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
                      label={`전체 정규화율: ${normalizedData.stats.reservationSiteTotal + normalizedData.stats.phoneklTotal > 0 ? 
                        Math.round(((normalizedData.stats.reservationSiteNormalized + normalizedData.stats.phoneklNormalized) / 
                        (normalizedData.stats.reservationSiteTotal + normalizedData.stats.phoneklTotal)) * 100) : 0}%`}
                      color="secondary"
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
                  <TableCell>매칭 결과</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>P열</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Q열</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>R열</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>F열</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>G열</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>정규화된 값</Typography>
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
                      <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                        <Autocomplete
                          size="small"
                          options={reservationSiteData.pColumn || []}
                          value={item.reservationSite.p}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'reservationSite.p', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="P열 선택" />}
                          freeSolo
                        />
                        <Autocomplete
                          size="small"
                          options={reservationSiteData.qColumn || []}
                          value={item.reservationSite.q}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'reservationSite.q', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="Q열 선택" />}
                          freeSolo
                        />
                        <Autocomplete
                          size="small"
                          options={reservationSiteData.rColumn || []}
                          value={item.reservationSite.r}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'reservationSite.r', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="R열 선택" />}
                          freeSolo
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                        <Autocomplete
                          size="small"
                          options={phoneklData.fColumn || []}
                          value={item.phonekl.f}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'phonekl.f', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="F열 선택" />}
                          freeSolo
                        />
                        <Autocomplete
                          size="small"
                          options={phoneklData.gColumn || []}
                          value={item.phonekl.g}
                          onChange={(event, newValue) => updateNormalizationItem(item.id, 'phonekl.g', newValue || '')}
                          renderInput={(params) => <TextField {...params} placeholder="G열 선택" />}
                          freeSolo
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Chip
                          label={item.normalizedModel || '정규화된 값 없음'}
                          color={item.isMatched ? 'success' : 'default'}
                          icon={item.isMatched ? <CheckCircleIcon /> : <WarningIcon />}
                          size="small"
                        />
                        <Chip
                          label={item.matchingStatus || '대기 중'}
                          color={item.isMatched ? 'success' : 'warning'}
                          size="small"
                          variant="outlined"
                        />
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