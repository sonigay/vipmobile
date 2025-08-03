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
  Snackbar
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
  Calculate as CalculateIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';

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

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // 컴포넌트 마운트 시 업데이트 팝업 표시
  useEffect(() => {
    setShowUpdatePopup(true);
    
    // 권한 레벨 확인
    const userLevel = loggedInStore?.level || '';
    setCanEditSheetId(userLevel === 'SS');
  }, [loggedInStore]);

  // 대상월 변경 시 시트 ID 자동 업데이트 (예시)
  const handleMonthChange = (event) => {
    const month = event.target.value;
    setTargetMonth(month);
    
    // TODO: 실제로는 월별 시트 ID 매핑 로직 구현
    if (month && canEditSheetId) {
      // 예시: 2025-06 -> 특정 시트 ID로 매핑
      setSheetId(`sheet_${month.replace('-', '_')}`);
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
  const calculateBudget = () => {
    // TODO: 실제 예산 계산 로직 구현
    setSnackbar({ open: true, message: '예산 계산이 완료되었습니다.', severity: 'success' });
  };

  // 데이터 저장
  const saveData = () => {
    // TODO: 구글시트에 데이터 저장 로직 구현
    setSnackbar({ open: true, message: '데이터가 저장되었습니다.', severity: 'success' });
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
            ⚙️ 설정
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
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
          </Grid>
          {!canEditSheetId && (
            <Alert severity="info" sx={{ mt: 1 }}>
              현재 사용자 권한: {loggedInStore?.level || 'Unknown'} - 시트 ID 수정 권한이 없습니다.
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
          <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
            구글시트에서 T6:AL37 영역을 복사한 후 아래 영역에 붙여넣기 하세요.
          </Typography>
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
          onClick={saveData}
          disabled={budgetData.length === 0}
          sx={{ backgroundColor: '#795548' }}
        >
          저장
        </Button>
        <Button
          variant="contained"
          startIcon={<CalculateIcon />}
          onClick={calculateBudget}
          disabled={budgetData.length === 0}
          sx={{ backgroundColor: '#795548' }}
        >
          예산 계산
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
            onClick={() => setShowUpdatePopup(true)}
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