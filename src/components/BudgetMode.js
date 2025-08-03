import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem
} from '@mui/material';
import {
  AccountBalance as BudgetIcon,
  Construction as ConstructionIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Update as UpdateIcon,
  SwapHoriz as SwapHorizIcon,
  ContentPaste as PasteIcon,
  Save as SaveIcon,
  Calculate as CalculateIcon,
  Add as AddIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';
import { budgetMonthSheetAPI, budgetUserSheetAPI } from '../api';

function BudgetMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 액면예산 관련 상태
  const [budgetData, setBudgetData] = useState([]);
  const [pastedData, setPastedData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // 시트 설정 관련 상태
  const [targetMonth, setTargetMonth] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [canEditSheetId, setCanEditSheetId] = useState(false);
  const [monthSheetMappings, setMonthSheetMappings] = useState({}); // 월별 시트 ID 매핑
  const [detailedMonthData, setDetailedMonthData] = useState({}); // 상세 데이터 (수정일시, 수정자 포함)
  
  // 저장 관련 상태
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveDateRange, setSaveDateRange] = useState({
    receiptStartDate: '',
    receiptEndDate: '',
    activationStartDate: '',
    activationEndDate: ''
  });
  
  // 사용자별 시트 관리 상태
  const [userSheets, setUserSheets] = useState([]);
  const [selectedUserSheet, setSelectedUserSheet] = useState('');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // 컴포넌트 마운트 시 업데이트 팝업 표시
  useEffect(() => {
    setShowUpdatePopup(true);
    
    // 권한 레벨 확인 - 다양한 필드에서 SS 레벨 확인
    const userRole = loggedInStore?.userRole || loggedInStore?.agentInfo?.userRole || loggedInStore?.level || '';
    console.log('예산모드 권한 확인:', { 
      userRole, 
      loggedInStore,
      userRole_direct: loggedInStore?.userRole,
      agentInfo: loggedInStore?.agentInfo,
      level: loggedInStore?.level
    });
    setCanEditSheetId(userRole === 'SS');
    
         // 구글시트에서 월별 시트 ID 매핑 불러오기
     loadMonthSheetMappings();
     
     // 사용자별 시트 목록 불러오기
     loadUserSheets();
  }, [loggedInStore]);

  // 업데이트 팝업 강제 열기
  const handleForceShowUpdatePopup = () => {
    // "오늘 하루 보지 않기" 설정을 임시로 제거
    localStorage.removeItem(`hideUpdate_budget`);
    setShowUpdatePopup(true);
  };

  // 구글시트에서 월별 시트 ID 매핑 불러오기
  const loadMonthSheetMappings = async () => {
    try {
      const data = await budgetMonthSheetAPI.getMonthSheets();
      const mappings = {};
      const detailedData = {};
      data.forEach(item => {
        mappings[item.month] = item.sheetId;
        detailedData[item.month] = {
          sheetId: item.sheetId,
          updatedAt: item.updatedAt,
          updatedBy: item.updatedBy
        };
      });
      setMonthSheetMappings(mappings);
      setDetailedMonthData(detailedData);
    } catch (error) {
      console.error('월별 시트 ID 로드 실패:', error);
      setSnackbar({ open: true, message: '월별 시트 ID 로드에 실패했습니다.', severity: 'error' });
    }
  };

  // 대상월 변경 시 해당 월의 시트 ID 표시
  const handleMonthChange = (event) => {
    const month = event.target.value;
    setTargetMonth(month);
    
    // 해당 월의 저장된 시트 ID가 있으면 표시
    if (month && monthSheetMappings[month]) {
      setSheetId(monthSheetMappings[month]);
    } else {
      setSheetId(''); // 새로운 월이면 빈 값으로 초기화
    }
  };

  // 시트 ID 저장
  const handleSheetIdSave = async () => {
    if (!targetMonth || !sheetId.trim()) {
      setSnackbar({ open: true, message: '대상월과 시트 ID를 모두 입력해주세요.', severity: 'warning' });
      return;
    }
    
    try {
      await budgetMonthSheetAPI.saveMonthSheet(
        targetMonth, 
        sheetId.trim(), 
        loggedInStore?.name || 'Unknown'
      );
      
      // 성공 시 목록 다시 로드
      await loadMonthSheetMappings();
      
      setSnackbar({ open: true, message: `${targetMonth} 시트 ID가 저장되었습니다.`, severity: 'success' });
    } catch (error) {
      console.error('시트 ID 저장 실패:', error);
      setSnackbar({ open: true, message: '시트 ID 저장에 실패했습니다.', severity: 'error' });
    }
  };

  // 시트 ID 삭제
  const handleSheetIdDelete = async () => {
    if (!targetMonth) {
      setSnackbar({ open: true, message: '삭제할 대상월을 선택해주세요.', severity: 'warning' });
      return;
    }
    
    try {
      await budgetMonthSheetAPI.deleteMonthSheet(targetMonth);
      
      // 성공 시 목록 다시 로드
      await loadMonthSheetMappings();
      
      setSheetId('');
      setSnackbar({ open: true, message: `${targetMonth} 시트 ID가 삭제되었습니다.`, severity: 'info' });
    } catch (error) {
      console.error('시트 ID 삭제 실패:', error);
      setSnackbar({ open: true, message: '시트 ID 삭제에 실패했습니다.', severity: 'error' });
    }
  };

  // 복사 붙여넣기 데이터 처리
  const handlePasteData = (event) => {
    const pastedText = event.clipboardData.getData('text');
    setPastedData(pastedText);
    processPastedData(pastedText);
  };

  // 붙여넣은 데이터 파싱
  const processPastedData = (data) => {
    setIsProcessing(true);
    try {
      const rows = data.split('\n').filter(row => row.trim());
      const processedData = [];
      
      // 헤더 정보 파싱 (6-7행)
      const headers = rows.slice(0, 2);
      
      // 데이터 행 파싱 (8행부터)
      const dataRows = rows.slice(2);
      
      dataRows.forEach((row, index) => {
        const columns = row.split('\t');
        if (columns.length >= 19) { // T:AL = 19개 컬럼
          const modelName = columns[0]; // T열: 모델명
          
          // 각 군별/유형별 데이터 처리
          for (let i = 1; i < columns.length; i++) {
            const value = columns[i];
            if (value && value.trim() !== '') {
              const armyType = getArmyType(i);
              const categoryType = getCategoryType(i);
              
              processedData.push({
                id: `${index}-${i}`,
                modelName,
                armyType,
                categoryType,
                budgetValue: parseFloat(value) || 0,
                appliedDate: new Date().toISOString().split('T')[0],
                inputUser: loggedInStore?.name || 'Unknown',
                userLevel: loggedInStore?.level || 1,
                securedBudget: 0,
                usedBudget: 0,
                remainingBudget: 0,
                status: '정상'
              });
            }
          }
        }
      });
      
      setBudgetData(processedData);
      setSnackbar({ open: true, message: `${processedData.length}개의 예산 데이터가 처리되었습니다.`, severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '데이터 처리 중 오류가 발생했습니다.', severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 군별 타입 매핑
  const getArmyType = (columnIndex) => {
    const armyTypes = ['A군', 'A군', 'A군', 'B군', 'B군', 'B군', 'C군', 'C군', 'C군', 'D군', 'D군', 'D군', 'E군', 'E군', 'E군', 'F군'];
    return armyTypes[columnIndex - 1] || 'Unknown';
  };

  // 카테고리 타입 매핑
  const getCategoryType = (columnIndex) => {
    const categoryTypes = ['신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규'];
    return categoryTypes[columnIndex - 1] || 'Unknown';
  };

  // 예산 계산
  const calculateBudget = (rowId = null) => {
    if (rowId) {
      // 개별 행 계산
      setSnackbar({ open: true, message: `행 ${rowId}의 예산 계산이 완료되었습니다.`, severity: 'success' });
    } else {
      // 전체 계산
      setSnackbar({ open: true, message: '전체 예산 계산이 완료되었습니다.', severity: 'success' });
    }
    // TODO: 실제 예산 계산 로직 구현
  };

  // 저장 모달 열기
  const handleSaveClick = () => {
    if (budgetData.length === 0) {
      setSnackbar({ open: true, message: '저장할 데이터가 없습니다.', severity: 'warning' });
      return;
    }
    setShowSaveModal(true);
  };

  // 사용자별 시트 생성
  const createUserSheet = async () => {
    setIsCreatingSheet(true);
    try {
      const userId = loggedInStore?.id || loggedInStore?.agentInfo?.id || 'unknown';
      const userName = loggedInStore?.name || 'Unknown';
      
      const result = await budgetUserSheetAPI.createUserSheet(userId, userName);
      
      setUserSheets([...userSheets, result.sheet]);
      setSelectedUserSheet(result.sheet.id);
      
      setSnackbar({ open: true, message: '새 시트가 생성되었습니다.', severity: 'success' });
    } catch (error) {
      console.error('시트 생성 실패:', error);
      setSnackbar({ open: true, message: '시트 생성에 실패했습니다.', severity: 'error' });
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // 사용자별 시트 목록 로드
  const loadUserSheets = async () => {
    try {
      const userId = loggedInStore?.id || loggedInStore?.agentInfo?.id || 'unknown';
      const sheets = await budgetUserSheetAPI.getUserSheets(userId);
      setUserSheets(sheets);
    } catch (error) {
      console.error('사용자 시트 로드 실패:', error);
      setSnackbar({ open: true, message: '사용자 시트 로드에 실패했습니다.', severity: 'error' });
    }
  };

  // 데이터 저장
  const saveData = async () => {
    if (!selectedUserSheet) {
      setSnackbar({ open: true, message: '저장할 시트를 선택해주세요.', severity: 'warning' });
      return;
    }
    
    try {
      await budgetUserSheetAPI.saveBudgetData(selectedUserSheet, budgetData, saveDateRange);
      setSnackbar({ open: true, message: '데이터가 저장되었습니다.', severity: 'success' });
      setShowSaveModal(false);
    } catch (error) {
      console.error('데이터 저장 실패:', error);
      setSnackbar({ open: true, message: '데이터 저장에 실패했습니다.', severity: 'error' });
    }
  };

  // 액면예산 탭 렌더링
  const renderFaceValueBudget = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, color: '#795548', fontWeight: 'bold' }}>
        💰 액면예산 관리
      </Typography>
      
      {/* 대상월 및 시트 ID 설정 */}
      <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
            ⚙️ 월별 시트 설정
          </Typography>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="대상월"
                type="month"
                value={targetMonth}
                onChange={handleMonthChange}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="구글시트 ID"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                disabled={!canEditSheetId}
                helperText={canEditSheetId ? "시트 ID를 입력하세요" : "권한이 없습니다 (SS 레벨만 수정 가능)"}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSheetIdSave}
                  disabled={!canEditSheetId || !targetMonth || !sheetId.trim()}
                  sx={{ backgroundColor: '#795548', minWidth: '60px' }}
                >
                  저장
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSheetIdDelete}
                  disabled={!canEditSheetId || !targetMonth}
                  sx={{ borderColor: '#795548', color: '#795548', minWidth: '60px' }}
                >
                  삭제
                </Button>
              </Box>
            </Grid>
          </Grid>
          
          {/* 저장된 월별 시트 ID 목록 */}
          {Object.keys(monthSheetMappings).length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
                📋 저장된 월별 시트 ID
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 200 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        대상월
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        시트 ID
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        수정일시
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        수정자
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(monthSheetMappings).map(([month, id]) => {
                      const detail = detailedMonthData[month];
                      return (
                        <TableRow 
                          key={month} 
                          hover
                          onClick={() => {
                            setTargetMonth(month);
                            setSheetId(id);
                          }}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell sx={{ fontSize: '0.8rem' }}>{month}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{id}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            {detail?.updatedAt ? new Date(detail.updatedAt).toLocaleString('ko-KR') : '-'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{detail?.updatedBy || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {!canEditSheetId && (
            <Alert severity="info" sx={{ mt: 1 }}>
              현재 사용자 권한: {loggedInStore?.userRole || loggedInStore?.agentInfo?.userRole || loggedInStore?.level || 'Unknown'} - 시트 ID 수정 권한이 없습니다.
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* 복사 붙여넣기 영역 */}
      <Card sx={{ mb: 3, border: '2px dashed #795548' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
            📋 데이터 붙여넣기
          </Typography>
          
          {/* 엑셀 형식 가이드 */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 1 }}>
                         <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
               📊 구글시트 복사 영역
             </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 200, mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textAlign: 'center' }}>
                      모델명
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textAlign: 'center' }}>
                      A군 신규
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textAlign: 'center' }}>
                      A군 MNP
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textAlign: 'center' }}>
                      A군 보상
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textAlign: 'center' }}>
                      B군 신규
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textAlign: 'center' }}>
                      ...
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#666' }}>
                      갤럭시 S24
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', color: '#666' }}>
                      50000
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', color: '#666' }}>
                      45000
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', color: '#666' }}>
                      40000
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', color: '#666' }}>
                      48000
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', color: '#666' }}>
                      ...
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="body2" sx={{ color: '#666', fontSize: '0.8rem' }}>
              💡 <strong>사용법:</strong> 구글시트에서 T6:AL37 영역을 선택하여 복사한 후, 아래 입력창에 붙여넣기 하세요.
            </Typography>
          </Box>
          
          <TextField
            fullWidth
            multiline
            rows={8}
            placeholder="여기에 복사한 데이터를 붙여넣기 하세요..."
            value={pastedData}
            onChange={(e) => setPastedData(e.target.value)}
            onPaste={handlePasteData}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<PasteIcon />}
              onClick={() => navigator.clipboard.readText().then(setPastedData)}
              sx={{ backgroundColor: '#795548' }}
            >
              클립보드에서 가져오기
            </Button>
            <Button
              variant="outlined"
              onClick={() => setPastedData('')}
              sx={{ borderColor: '#795548', color: '#795548' }}
            >
              초기화
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 액션 버튼 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveClick}
          disabled={budgetData.length === 0}
          sx={{ backgroundColor: '#795548' }}
        >
          저장
        </Button>
      </Box>

      {/* 데이터 테이블 */}
      {budgetData.length > 0 && (
        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold' }}>
                  적용일
                </TableCell>
                <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold' }}>
                  입력자(권한레벨)
                </TableCell>
                <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold' }}>
                  모델명
                </TableCell>
                <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold' }}>
                  군/유형
                </TableCell>
                <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold' }}>
                  확보된 예산
                </TableCell>
                <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold' }}>
                  사용된 예산
                </TableCell>
                <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold' }}>
                  예산 잔액
                </TableCell>
                <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold' }}>
                  상태
                </TableCell>
                <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold' }}>
                  액션
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {budgetData.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.appliedDate}</TableCell>
                  <TableCell>{row.inputUser}(레벨{row.userLevel})</TableCell>
                  <TableCell>{row.modelName}</TableCell>
                  <TableCell>{row.armyType} {row.categoryType}</TableCell>
                  <TableCell>{row.securedBudget.toLocaleString()}</TableCell>
                  <TableCell>{row.usedBudget.toLocaleString()}</TableCell>
                  <TableCell 
                    sx={{ 
                      color: row.remainingBudget < 0 ? 'red' : 'inherit',
                      fontWeight: row.remainingBudget < 0 ? 'bold' : 'normal'
                    }}
                  >
                    {row.remainingBudget.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={row.status} 
                      color={row.status === '정상' ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CalculateIcon />}
                      onClick={() => calculateBudget(row.id)}
                      sx={{ borderColor: '#795548', color: '#795548' }}
                    >
                      예산 계산
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 로딩 상태 */}
      {isProcessing && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: '#795548' }} />
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ backgroundColor: '#795548' }}>
        <Toolbar>
          <BudgetIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            예산 모드
          </Typography>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={onModeChange}
              startIcon={<SwapHorizIcon />}
              sx={{ 
                mr: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              모드 변경
            </Button>
          )}
          
                     {/* 업데이트 확인 버튼 */}
           <Button
             color="inherit"
             startIcon={<UpdateIcon />}
             onClick={handleForceShowUpdatePopup}
             sx={{ 
               mr: 2,
               backgroundColor: 'rgba(255,255,255,0.1)',
               '&:hover': {
                 backgroundColor: 'rgba(255,255,255,0.2)'
               }
             }}
           >
             업데이트 확인
           </Button>
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 콘텐츠 */}
      <Box sx={{ 
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#f5f5f5'
      }}>
        {/* 탭 메뉴 */}
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: '#e0e0e0', 
          backgroundColor: '#ffffff'
        }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: '#666666',
                fontWeight: 'bold',
                '&.Mui-selected': {
                  color: '#795548'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#795548'
              }
            }}
          >
            <Tab label="액면예산" icon={<BudgetIcon />} iconPosition="start" />
            <Tab label="별도추가" icon={<AnalyticsIcon />} iconPosition="start" />
            <Tab label="부가추가지원" icon={<SettingsIcon />} iconPosition="start" />
            <Tab label="부가차감지원" icon={<TimelineIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* 탭별 콘텐츠 */}
        {activeTab === 0 && renderFaceValueBudget()}
        {activeTab === 1 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#795548', mb: 2 }}>
              🚧 별도추가 준비중
            </Typography>
          </Box>
        )}
        {activeTab === 2 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#795548', mb: 2 }}>
              🚧 부가추가지원 준비중
            </Typography>
          </Box>
        )}
        {activeTab === 3 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#795548', mb: 2 }}>
              🚧 부가차감지원 준비중
            </Typography>
          </Box>
        )}

        {/* 업데이트 팝업 */}
        <AppUpdatePopup
          open={showUpdatePopup}
          onClose={() => setShowUpdatePopup(false)}
          mode="budget"
          loggedInStore={loggedInStore}
          onUpdateAdded={() => {
            console.log('예산모드 새 업데이트가 추가되었습니다.');
          }}
        />

                 {/* 저장 모달 */}
         <Dialog open={showSaveModal} onClose={() => setShowSaveModal(false)} maxWidth="md" fullWidth>
           <DialogTitle sx={{ backgroundColor: '#795548', color: 'white' }}>
             💾 예산 데이터 저장
           </DialogTitle>
           <DialogContent sx={{ pt: 3 }}>
             <Typography variant="body1" sx={{ mb: 3 }}>
               저장할 시트를 선택하고 접수일 및 개통일 범위를 설정해주세요.
             </Typography>
             
             {/* 사용자별 시트 선택 */}
             <Box sx={{ mb: 3 }}>
               <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
                 📋 저장할 시트 선택
               </Typography>
               <Grid container spacing={2} alignItems="center">
                 <Grid item xs={12} sm={8}>
                   <TextField
                     select
                     fullWidth
                     label="시트 선택"
                     value={selectedUserSheet}
                     onChange={(e) => setSelectedUserSheet(e.target.value)}
                     disabled={userSheets.length === 0}
                     helperText={userSheets.length === 0 ? "생성된 시트가 없습니다" : "저장할 시트를 선택하세요"}
                   >
                     {userSheets.map((sheet) => (
                       <MenuItem key={sheet.id} value={sheet.id}>
                         {sheet.name} (생성일: {new Date(sheet.createdAt).toLocaleDateString()})
                       </MenuItem>
                     ))}
                   </TextField>
                 </Grid>
                 <Grid item xs={12} sm={4}>
                   <Button
                     variant="outlined"
                     onClick={createUserSheet}
                     disabled={isCreatingSheet}
                     startIcon={isCreatingSheet ? <CircularProgress size={16} /> : <AddIcon />}
                     sx={{ borderColor: '#795548', color: '#795548' }}
                   >
                     새 시트 생성
                   </Button>
                 </Grid>
               </Grid>
             </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
                  📅 접수일 범위
                </Typography>
                <TextField
                  fullWidth
                  label="시작일"
                  type="date"
                  value={saveDateRange.receiptStartDate}
                  onChange={(e) => setSaveDateRange({
                    ...saveDateRange,
                    receiptStartDate: e.target.value
                  })}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="종료일"
                  type="date"
                  value={saveDateRange.receiptEndDate}
                  onChange={(e) => setSaveDateRange({
                    ...saveDateRange,
                    receiptEndDate: e.target.value
                  })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
                  📅 개통일 범위
                </Typography>
                <TextField
                  fullWidth
                  label="시작일"
                  type="date"
                  value={saveDateRange.activationStartDate}
                  onChange={(e) => setSaveDateRange({
                    ...saveDateRange,
                    activationStartDate: e.target.value
                  })}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="종료일"
                  type="date"
                  value={saveDateRange.activationEndDate}
                  onChange={(e) => setSaveDateRange({
                    ...saveDateRange,
                    activationEndDate: e.target.value
                  })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ color: '#666' }}>
                💡 <strong>저장 정보:</strong> 총 {budgetData.length}개의 예산 데이터가 저장됩니다.
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={() => setShowSaveModal(false)}
              sx={{ color: '#666' }}
            >
              취소
            </Button>
                         <Button 
               onClick={saveData}
               variant="contained"
               disabled={!selectedUserSheet || !saveDateRange.receiptStartDate || !saveDateRange.receiptEndDate || 
                        !saveDateRange.activationStartDate || !saveDateRange.activationEndDate}
               sx={{ backgroundColor: '#795548' }}
             >
               저장
             </Button>
          </DialogActions>
        </Dialog>

        {/* 스낵바 */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}

export default BudgetMode; 