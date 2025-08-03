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
  const [isProcessing, setIsProcessing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // 시트 설정 관련 상태
  const [targetMonth, setTargetMonth] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [canEditSheetId, setCanEditSheetId] = useState(false);
  const [monthSheetMappings, setMonthSheetMappings] = useState({}); // 월별 시트 ID 매핑
  const [detailedMonthData, setDetailedMonthData] = useState({}); // 상세 데이터 (수정일시, 수정자 포함)
  
  // 저장된 데이터 목록 관련 상태
  const [userSheets, setUserSheets] = useState([]);
  const [showSheetList, setShowSheetList] = useState(false);
  
  // 날짜/시간 입력 상태
  const [dateRange, setDateRange] = useState({
    receiptStartDate: '',
    receiptStartTime: '10:00',
    receiptEndDate: '',
    receiptEndTime: '23:59',
    activationStartDate: '',
    activationStartTime: '10:00',
    activationEndDate: '',
    activationEndTime: '23:59'
  });
  
  // 접수일 적용 여부
  const [applyReceiptDate, setApplyReceiptDate] = useState(false);

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
    
    // 사용자 시트 목록 불러오기
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

  // 사용자 시트 목록 불러오기
  const loadUserSheets = async () => {
    try {
      const userId = loggedInStore?.id || loggedInStore?.agentInfo?.id || 'unknown';
      const data = await budgetUserSheetAPI.getUserSheets(userId);
      setUserSheets(data);
    } catch (error) {
      console.error('사용자 시트 목록 로드 실패:', error);
      setSnackbar({ open: true, message: '저장된 데이터 목록 로드에 실패했습니다.', severity: 'error' });
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

  // 엑셀 테이블 데이터 처리
  const handleTableDataChange = (rowIndex, colIndex, value) => {
    const newData = [...budgetData];
    if (!newData[rowIndex]) {
      newData[rowIndex] = {
        id: `row-${rowIndex}`,
        modelName: '',
        securedBudget: 0,
        usedBudget: 0,
        remainingBudget: 0,
        status: '정상',
        appliedDate: new Date().toISOString().split('T')[0],
        inputUser: loggedInStore?.name || 'Unknown',
        userLevel: loggedInStore?.level || 1,
        armyType: '',
        categoryType: '',
        budgetValues: Array(18).fill(0) // 18개 컬럼의 개별 값 저장
      };
    }

    if (colIndex === 0) {
      // 모델명
      newData[rowIndex].modelName = value;
    } else {
      // 예산 값 (1-18번 컬럼)
      const budgetValue = parseFloat(value) || 0;
      newData[rowIndex].budgetValues[colIndex - 1] = budgetValue;
      newData[rowIndex].securedBudget = budgetValue;
      
      // 군/유형 매핑
      const armyType = getArmyType(colIndex);
      const categoryType = getCategoryType(colIndex);
      newData[rowIndex].armyType = armyType;
      newData[rowIndex].categoryType = categoryType;
    }

    setBudgetData(newData);
  };

  // 클립보드 붙여넣기 처리
  const handlePaste = async (event, startRowIndex, startColIndex) => {
    event.preventDefault();
    
    try {
      const clipboardData = await navigator.clipboard.readText();
      const rows = clipboardData.trim().split('\n');
      
      const newData = [...budgetData];
      
      rows.forEach((row, rowOffset) => {
        const cells = row.split('\t');
        const currentRowIndex = startRowIndex + rowOffset;
        
        // 행 데이터 초기화
        if (!newData[currentRowIndex]) {
          newData[currentRowIndex] = {
            id: `row-${currentRowIndex}`,
            modelName: '',
            securedBudget: 0,
            usedBudget: 0,
            remainingBudget: 0,
            status: '정상',
            appliedDate: new Date().toISOString().split('T')[0],
            inputUser: loggedInStore?.name || 'Unknown',
            userLevel: loggedInStore?.level || 1,
            armyType: '',
            categoryType: '',
            budgetValues: Array(18).fill(0) // 18개 컬럼의 개별 값 저장
          };
        }
        
        cells.forEach((cell, colOffset) => {
          const currentColIndex = startColIndex + colOffset;
          const value = cell.trim();
          
          if (currentColIndex === 0) {
            // 모델명
            newData[currentRowIndex].modelName = value;
          } else if (currentColIndex >= 1 && currentColIndex <= 18) {
            // 예산 값 (1-18번 컬럼)
            const numValue = parseFloat(value) || 0;
            newData[currentRowIndex].budgetValues[currentColIndex - 1] = numValue;
            newData[currentRowIndex].securedBudget = numValue;
            
            // 군/유형 매핑
            const armyType = getArmyType(currentColIndex);
            const categoryType = getCategoryType(currentColIndex);
            newData[currentRowIndex].armyType = armyType;
            newData[currentRowIndex].categoryType = categoryType;
          }
        });
      });
      
      setBudgetData(newData);
      
      setSnackbar({ 
        open: true, 
        message: `${rows.length}행의 데이터가 붙여넣기되었습니다. 저장 버튼을 클릭하여 저장하세요.`, 
        severity: 'success' 
      });
      
    } catch (error) {
      console.error('붙여넣기 실패:', error);
      setSnackbar({ 
        open: true, 
        message: '붙여넣기에 실패했습니다. 클립보드 접근 권한을 확인해주세요.', 
        severity: 'error' 
      });
    }
  };

  // 수동 저장 함수
  const handleManualSave = async () => {
    if (!targetMonth) {
      setSnackbar({ open: true, message: '대상월을 먼저 선택해주세요.', severity: 'warning' });
      return;
    }
    
    if (budgetData.length === 0 || budgetData.every(row => !row || (!row.modelName && !row.budgetValue))) {
      setSnackbar({ open: true, message: '저장할 데이터가 없습니다.', severity: 'warning' });
      return;
    }
    
    setIsProcessing(true);
    try {
      await autoSaveToUserSheet(budgetData);
      setSnackbar({ open: true, message: '데이터가 성공적으로 저장되었습니다.', severity: 'success' });
      
      // 저장 후 사용자 시트 목록 새로고침
      await loadUserSheets();
    } catch (error) {
      setSnackbar({ open: true, message: '저장에 실패했습니다.', severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 자동 저장 함수
  const autoSaveToUserSheet = async (data) => {
    try {
      const userId = loggedInStore?.id || loggedInStore?.agentInfo?.id || 'unknown';
      const userName = loggedInStore?.name || 'Unknown';
      
      // 대상월이 선택되어 있는지 확인
      if (!targetMonth) {
        setSnackbar({ open: true, message: '대상월을 먼저 선택해주세요.', severity: 'warning' });
        return;
      }
      
      // 항상 새 시트 생성 (기존 시트 확인 로직 제거)
      const result = await budgetUserSheetAPI.createUserSheet(userId, userName, targetMonth);
      const targetSheetId = result.sheet.id;
      setSnackbar({ open: true, message: `시트 "액면_${userName}"에 데이터가 저장되었습니다.`, severity: 'success' });
      
             // 데이터 저장 - 접수일 적용 여부에 따라 설정
       const saveDateRange = {
         receiptStartDate: applyReceiptDate ? `${dateRange.receiptStartDate} ${dateRange.receiptStartTime}` : '',
         receiptEndDate: applyReceiptDate ? `${dateRange.receiptEndDate} ${dateRange.receiptEndTime}` : '',
         activationStartDate: `${dateRange.activationStartDate} ${dateRange.activationStartTime}`,
         activationEndDate: `${dateRange.activationEndDate} ${dateRange.activationEndTime}`,
         applyReceiptDate: applyReceiptDate // 접수일 적용 여부도 함께 저장
       };
      
      await budgetUserSheetAPI.saveBudgetData(targetSheetId, data, saveDateRange, userName);
      
    } catch (error) {
      console.error('자동 저장 실패:', error);
      setSnackbar({ open: true, message: '자동 저장에 실패했습니다.', severity: 'warning' });
    }
  };

  // 군별 타입 매핑
  const getArmyType = (columnIndex) => {
    const armyTypes = ['S군', 'S군', 'S군', 'A군', 'A군', 'A군', 'B군', 'B군', 'B군', 'C군', 'C군', 'C군', 'D군', 'D군', 'D군', 'E군', 'E군', 'E군'];
    return armyTypes[columnIndex - 1] || 'Unknown';
  };

  // 카테고리 타입 매핑
  const getCategoryType = (columnIndex) => {
    const categoryTypes = ['신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상'];
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

             {/* 날짜/시간 입력 영역 */}
       <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
         <CardContent>
           <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
             📅 접수일 및 개통일 범위 설정
           </Typography>
           
           {/* 접수일 적용 여부 체크박스 */}
           <Box sx={{ mb: 3 }}>
             <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
               ⚙️ 접수일 적용 설정
             </Typography>
             <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
               <input
                 type="checkbox"
                 id="applyReceiptDate"
                 checked={applyReceiptDate}
                 onChange={(e) => setApplyReceiptDate(e.target.checked)}
                 style={{ width: '18px', height: '18px' }}
               />
               <label htmlFor="applyReceiptDate" style={{ fontSize: '0.9rem', color: '#666' }}>
                 접수일 기준으로 예산 계산 (미체크 시 개통일 기준으로 자동 계산)
               </label>
             </Box>
           </Box>
           
           <Grid container spacing={3}>
             {/* 접수일 범위 - 체크 시에만 표시 */}
             {applyReceiptDate && (
               <Grid item xs={12} sm={6}>
                 <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
                   📅 접수일 범위
                 </Typography>
                 <Grid container spacing={2}>
                   <Grid item xs={6}>
                     <TextField
                       fullWidth
                       label="시작일"
                       type="date"
                       value={dateRange.receiptStartDate}
                       onChange={(e) => setDateRange({
                         ...dateRange,
                         receiptStartDate: e.target.value
                       })}
                       InputLabelProps={{ shrink: true }}
                     />
                   </Grid>
                   <Grid item xs={6}>
                     <TextField
                       fullWidth
                       label="시작시간"
                       type="time"
                       value={dateRange.receiptStartTime}
                       onChange={(e) => setDateRange({
                         ...dateRange,
                         receiptStartTime: e.target.value
                       })}
                       InputLabelProps={{ shrink: true }}
                     />
                   </Grid>
                   <Grid item xs={6}>
                     <TextField
                       fullWidth
                       label="종료일"
                       type="date"
                       value={dateRange.receiptEndDate}
                       onChange={(e) => setDateRange({
                         ...dateRange,
                         receiptEndDate: e.target.value
                       })}
                       InputLabelProps={{ shrink: true }}
                     />
                   </Grid>
                   <Grid item xs={6}>
                     <TextField
                       fullWidth
                       label="종료시간"
                       type="time"
                       value={dateRange.receiptEndTime}
                       onChange={(e) => setDateRange({
                         ...dateRange,
                         receiptEndTime: e.target.value
                       })}
                       InputLabelProps={{ shrink: true }}
                     />
                   </Grid>
                 </Grid>
               </Grid>
             )}
             
             <Grid item xs={12} sm={applyReceiptDate ? 6 : 12}>
               <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
                 📅 개통일 범위 {!applyReceiptDate && '(기준)'}
               </Typography>
               <Grid container spacing={2}>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="시작일"
                     type="date"
                     value={dateRange.activationStartDate}
                     onChange={(e) => setDateRange({
                       ...dateRange,
                       activationStartDate: e.target.value
                     })}
                     InputLabelProps={{ shrink: true }}
                   />
                 </Grid>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="시작시간"
                     type="time"
                     value={dateRange.activationStartTime}
                     onChange={(e) => setDateRange({
                       ...dateRange,
                       activationStartTime: e.target.value
                     })}
                     InputLabelProps={{ shrink: true }}
                   />
                 </Grid>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="종료일"
                     type="date"
                     value={dateRange.activationEndDate}
                     onChange={(e) => setDateRange({
                       ...dateRange,
                       activationEndDate: e.target.value
                     })}
                     InputLabelProps={{ shrink: true }}
                   />
                 </Grid>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="종료시간"
                     type="time"
                     value={dateRange.activationEndTime}
                     onChange={(e) => setDateRange({
                       ...dateRange,
                       activationEndTime: e.target.value
                     })}
                     InputLabelProps={{ shrink: true }}
                   />
                 </Grid>
               </Grid>
               {!applyReceiptDate && (
                 <Typography variant="caption" sx={{ color: '#666', mt: 1, display: 'block' }}>
                   💡 접수일 미적용 시 개통일 기준으로 자동 계산됩니다.
                 </Typography>
               )}
             </Grid>
           </Grid>
         </CardContent>
       </Card>

             {/* 엑셀형 예산 데이터 테이블 */}
       <Card sx={{ mb: 3, border: '2px solid #795548' }}>
         <CardContent>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
             <Typography variant="h6" sx={{ color: '#795548' }}>
               📊 예산 데이터 입력 (엑셀 형식)
             </Typography>
             <Button
               variant="contained"
               startIcon={<SaveIcon />}
               onClick={handleManualSave}
               disabled={isProcessing || !targetMonth || budgetData.length === 0}
               sx={{ 
                 backgroundColor: '#795548',
                 '&:hover': { backgroundColor: '#5D4037' }
               }}
             >
               {isProcessing ? '저장 중...' : '저장'}
             </Button>
           </Box>
           
           <TableContainer 
             component={Paper} 
             sx={{ maxHeight: 600 }}
             onPaste={(e) => handlePaste(e, 0, 0)}
             tabIndex={0}
           >
            <Table stickyHeader size="small">
              <TableHead>
                {/* 첫 번째 헤더 행: 군별 헤더 */}
                <TableRow>
                  <TableCell 
                    sx={{ 
                      backgroundColor: '#795548', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd',
                      minWidth: 120
                    }}
                  >
                    ㅡ정책모델ㅡ
                  </TableCell>
                  <TableCell 
                    colSpan={3}
                    sx={{ 
                      backgroundColor: '#8D6E63', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}
                  >
                    S군
                  </TableCell>
                  <TableCell 
                    colSpan={3}
                    sx={{ 
                      backgroundColor: '#8D6E63', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}
                  >
                    A군
                  </TableCell>
                  <TableCell 
                    colSpan={3}
                    sx={{ 
                      backgroundColor: '#8D6E63', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}
                  >
                    B군
                  </TableCell>
                  <TableCell 
                    colSpan={3}
                    sx={{ 
                      backgroundColor: '#8D6E63', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}
                  >
                    C군
                  </TableCell>
                  <TableCell 
                    colSpan={3}
                    sx={{ 
                      backgroundColor: '#8D6E63', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}
                  >
                    D군
                  </TableCell>
                  <TableCell 
                    colSpan={3}
                    sx={{ 
                      backgroundColor: '#8D6E63', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}
                  >
                    E군
                  </TableCell>
                </TableRow>
                
                {/* 두 번째 헤더 행: 카테고리 헤더 */}
                <TableRow>
                  <TableCell 
                    sx={{ 
                      backgroundColor: '#795548', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}
                  >
                    모델명
                  </TableCell>
                  {['신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상'].map((category, index) => (
                    <TableCell 
                      key={index}
                      sx={{ 
                        backgroundColor: '#A1887F', 
                        color: 'white', 
                        fontWeight: 'bold',
                        textAlign: 'center',
                        border: '1px solid #ddd',
                        minWidth: 80
                      }}
                    >
                      {category}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              
                             <TableBody>
                 {/* 데이터 행들 (최대 40행) */}
                 {Array.from({ length: 40 }, (_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {/* 모델명 셀 */}
                    <TableCell 
                      sx={{ 
                        border: '1px solid #ddd',
                        padding: '4px'
                      }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        value={budgetData[rowIndex]?.modelName || ''}
                        onChange={(e) => handleTableDataChange(rowIndex, 0, e.target.value)}
                        placeholder="모델명"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            fontSize: '0.8rem',
                            '& fieldset': {
                              border: 'none'
                            }
                          }
                        }}
                      />
                    </TableCell>
                    
                                         {/* 예산 값 셀들 (18개) */}
                     {Array.from({ length: 18 }, (_, colIndex) => (
                       <TableCell 
                         key={colIndex}
                         sx={{ 
                           border: '1px solid #ddd',
                           padding: '4px'
                         }}
                       >
                         <TextField
                           fullWidth
                           size="small"
                           type="number"
                           value={budgetData[rowIndex]?.budgetValues?.[colIndex] || ''}
                           onChange={(e) => handleTableDataChange(rowIndex, colIndex + 1, e.target.value)}
                           placeholder="0"
                           sx={{
                             '& .MuiOutlinedInput-root': {
                               fontSize: '0.8rem',
                               '& fieldset': {
                                 border: 'none'
                               }
                             }
                           }}
                         />
                       </TableCell>
                     ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
                     <Box sx={{ mt: 2, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
             <Typography variant="body2" sx={{ color: '#666', fontSize: '0.8rem' }}>
               💡 <strong>사용법:</strong> 
               <br/>• <strong>직접 입력:</strong> 각 셀을 클릭하여 모델명과 예산 값을 직접 입력할 수 있습니다.
               <br/>• <strong>엑셀 붙여넣기:</strong> 엑셀에서 데이터를 복사한 후 테이블 영역을 클릭하고 Ctrl+V로 붙여넣기하면 한 번에 여러 행의 데이터가 입력됩니다.
               <br/>• <strong>저장:</strong> 데이터 입력 후 상단의 "저장" 버튼을 클릭하여 Google Sheet에 저장합니다.
               <br/>• <strong>데이터 형식:</strong> 첫 번째 열은 모델명, 나머지 18개 열은 각 군별(신규/MNP/보상) 예산 값입니다.
             </Typography>
           </Box>
        </CardContent>
      </Card>

             {/* 저장된 데이터 목록 */}
       <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
         <CardContent>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
             <Typography variant="h6" sx={{ color: '#795548' }}>
               📋 저장된 데이터 목록
             </Typography>
             <Button
               variant="outlined"
               size="small"
               onClick={() => {
                 setShowSheetList(!showSheetList);
                 if (!showSheetList) {
                   loadUserSheets();
                 }
               }}
               sx={{ borderColor: '#795548', color: '#795548' }}
             >
               {showSheetList ? '숨기기' : '보기'}
             </Button>
           </Box>
           
           {showSheetList && (
             <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
               <Table size="small">
                 <TableHead>
                   <TableRow>
                     <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                       시트명
                     </TableCell>
                     <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                       확보예산
                     </TableCell>
                     <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                       사용예산
                     </TableCell>
                     <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                       예산잔액
                     </TableCell>
                     <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                       항목수
                     </TableCell>
                     <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                       마지막수정
                     </TableCell>
                     <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                       작업
                     </TableCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {userSheets.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: '#666' }}>
                         저장된 데이터가 없습니다.
                       </TableCell>
                     </TableRow>
                   ) : (
                     userSheets.map((sheet, index) => (
                       <TableRow key={index} hover>
                         <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                           {sheet.name}
                         </TableCell>
                         <TableCell sx={{ fontSize: '0.8rem', color: '#2E7D32' }}>
                           {sheet.summary?.totalSecuredBudget?.toLocaleString() || '0'}
                         </TableCell>
                         <TableCell sx={{ fontSize: '0.8rem', color: '#D32F2F' }}>
                           {sheet.summary?.totalUsedBudget?.toLocaleString() || '0'}
                         </TableCell>
                         <TableCell sx={{ fontSize: '0.8rem', color: '#1976D2' }}>
                           {sheet.summary?.totalRemainingBudget?.toLocaleString() || '0'}
                         </TableCell>
                         <TableCell sx={{ fontSize: '0.8rem' }}>
                           {sheet.summary?.itemCount || '0'}
                         </TableCell>
                         <TableCell sx={{ fontSize: '0.8rem' }}>
                           {sheet.summary?.lastUpdated ? 
                             new Date(sheet.summary.lastUpdated).toLocaleString('ko-KR') : 
                             new Date(sheet.createdAt).toLocaleString('ko-KR')
                           }
                         </TableCell>
                         <TableCell>
                           <Button
                             size="small"
                             variant="outlined"
                             onClick={() => {
                               // TODO: 데이터 불러오기 기능 구현
                               setSnackbar({ open: true, message: '데이터 불러오기 기능은 준비중입니다.', severity: 'info' });
                             }}
                             sx={{ fontSize: '0.7rem', borderColor: '#795548', color: '#795548' }}
                           >
                             불러오기
                           </Button>
                         </TableCell>
                       </TableRow>
                     ))
                   )}
                 </TableBody>
               </Table>
             </TableContainer>
           )}
         </CardContent>
       </Card>

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