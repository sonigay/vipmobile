import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  IconButton,
  Collapse
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  SwapHoriz as SwapHorizIcon,
  AccountBalance as AccountBalanceIcon,
  Image as ImageIcon,
  TableChart as TableChartIcon,
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  ShowChart as ShowChartIcon,
  PieChart as PieChartIcon
} from '@mui/icons-material';
import { createWorker } from 'tesseract.js';
import { hasNewDeployment, performAutoLogout, shouldCheckForUpdates, setLastUpdateCheck } from '../utils/updateDetection';
import UpdateProgressPopup from './UpdateProgressPopup';

function ChartMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  const [activeTab, setActiveTab] = useState(0);
  const [showUpdateProgressPopup, setShowUpdateProgressPopup] = useState(false);

  // 새로운 배포 감지
  useEffect(() => {
    const checkForNewDeployment = async () => {
      // 새로운 배포가 있는지 확인
      if (shouldCheckForUpdates()) {
        const hasNew = await hasNewDeployment();
        if (hasNew) {
          console.log('새로운 배포 감지 - 자동 로그아웃 실행');
          await performAutoLogout();
          // 업데이트 진행 팝업 표시
          setShowUpdateProgressPopup(true);
          return;
        }
        setLastUpdateCheck();
      }
    };

    // 새로운 배포 체크
    checkForNewDeployment();
  }, []);

  // Service Worker 메시지 리스너
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'AUTO_LOGOUT_REQUIRED') {
          console.log('Service Worker에서 자동 로그아웃 요청 받음');
          performAutoLogout();
          setShowUpdateProgressPopup(true);
        }
      });
    }
  }, []);

  const handleBackToMain = () => {
    // 메인 화면으로 돌아가기 (모드 선택 팝업 표시)
    window.location.reload();
  };

  const handleTabChange = (event, newValue) => {
    // 채권장표 탭(0번)에 접근할 때 권한 체크
    if (newValue === 0 && !loggedInStore?.modePermissions?.bondChart) {
      alert('채권장표 메뉴에 대한 권한이 없습니다.');
      return;
    }
    setActiveTab(newValue);
  };

  // 탭 구성 (권한에 따라 조건부 렌더링)
  const tabs = [
    {
      label: '채권장표',
      icon: <AccountBalanceIcon />,
      component: <BondChartComingSoonTab />,
      hasPermission: loggedInStore?.modePermissions?.bondChart
    },
    {
      label: '지표장표',
      icon: <BarChartIcon />,
      component: <IndicatorChartTab />,
      hasPermission: true // 지표장표 탭은 모든 사용자에게 표시
    },
    {
      label: '준비 중',
      icon: <TableChartIcon />,
      component: <ComingSoonTab />,
      hasPermission: true // 준비 중 탭은 모든 사용자에게 표시
    }
  ];

  // 권한이 있는 탭만 필터링
  const availableTabs = tabs.filter(tab => tab.hasPermission);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            장표 모드
          </Typography>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={() => {
                console.log('ChartMode 모드 전환 버튼 클릭됨');
                console.log('onModeChange 존재:', !!onModeChange);
                console.log('availableModes:', availableModes);
                onModeChange();
              }}
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
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'white' }}>
        <Container maxWidth="lg">
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                fontSize: '1rem',
                fontWeight: 'bold',
                color: '#666',
                '&.Mui-selected': {
                  color: '#f5576c',
                  fontWeight: 'bold'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#f5576c',
                height: 3
              }
            }}
          >
            {availableTabs.map((tab, index) => (
              <Tab
                key={index}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                sx={{ 
                  textTransform: 'none',
                  minHeight: 64,
                  py: 1
                }}
              />
            ))}
          </Tabs>
        </Container>
      </Box>
      
      {/* 탭 컨텐츠 */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 3, overflow: 'auto' }}>
        {availableTabs[activeTab].component}
      </Container>

      {/* 업데이트 진행 팝업 */}
      <UpdateProgressPopup
        open={showUpdateProgressPopup}
        onClose={() => setShowUpdateProgressPopup(false)}
      />
    </Box>
  );
}

// 채권장표 탭 컴포넌트
function BondChartTab() {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  // 이미지 업로드 처리
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setMessage({ type: 'error', text: '이미지 파일만 업로드 가능합니다.' });
      return;
    }

    const newImages = imageFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      preview: URL.createObjectURL(file),
      status: 'pending' // pending, processing, completed, error
    }));

    setUploadedImages(prev => [...prev, ...newImages]);
    setMessage({ type: 'success', text: `${imageFiles.length}개의 이미지가 업로드되었습니다.` });
  };

  // OCR 처리
  const processImageWithOCR = async (imageData) => {
    try {
      const worker = await createWorker('kor+eng');
      const { data: { text } } = await worker.recognize(imageData.file);
      await worker.terminate();
      
      return text;
    } catch (error) {
      console.error('OCR 처리 오류:', error);
      throw new Error('OCR 처리 중 오류가 발생했습니다.');
    }
  };

  // 텍스트에서 채권 데이터 파싱
  const parseBondData = (text) => {
    const data = {
      date: new Date().toISOString().split('T')[0],
      terminalBonds: [],
      inventoryBonds: [],
      collateralBonds: [],
      totalAmount: 0,
      notes: ''
    };

    // 날짜 추출 (YYYY-MM-DD, YYYY/MM/DD, MM/DD 등)
    const datePatterns = [
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g,
      /(\d{1,2})[-/](\d{1,2})/g
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        data.date = match[0];
        break;
      }
    }

    // 단말기채권 추출
    const terminalPattern = /단말기[^\d]*(\d+)[^\d]*(\d{1,3}(?:,\d{3})*)/g;
    let match;
    while ((match = terminalPattern.exec(text)) !== null) {
      data.terminalBonds.push({
        terminal: match[1],
        amount: parseInt(match[2].replace(/,/g, ''))
      });
    }

    // 재고초과채권 추출
    const inventoryPattern = /재고[^\d]*(\d+)[^\d]*(\d{1,3}(?:,\d{3})*)/g;
    while ((match = inventoryPattern.exec(text)) !== null) {
      data.inventoryBonds.push({
        quantity: parseInt(match[1]),
        amount: parseInt(match[2].replace(/,/g, ''))
      });
    }

    // 담보초과채권 추출
    const collateralPattern = /담보[^\d]*(\d{1,3}(?:,\d{3})*)/g;
    while ((match = collateralPattern.exec(text)) !== null) {
      data.collateralBonds.push({
        amount: parseInt(match[1].replace(/,/g, ''))
      });
    }

    // 총액 계산
    const allAmounts = [
      ...data.terminalBonds.map(b => b.amount),
      ...data.inventoryBonds.map(b => b.amount),
      ...data.collateralBonds.map(b => b.amount)
    ];
    data.totalAmount = allAmounts.reduce((sum, amount) => sum + amount, 0);

    return data;
  };

  // 이미지 처리 시작
  const startProcessing = async () => {
    if (uploadedImages.length === 0) {
      setMessage({ type: 'warning', text: '처리할 이미지가 없습니다.' });
      return;
    }

    setIsProcessing(true);
    setMessage({ type: 'info', text: '이미지 처리 중입니다...' });

    try {
      const results = [];
      
      for (const image of uploadedImages) {
        // 이미지 상태 업데이트
        setUploadedImages(prev => 
          prev.map(img => 
            img.id === image.id 
              ? { ...img, status: 'processing' }
              : img
          )
        );

        try {
          // OCR 처리
          const ocrText = await processImageWithOCR(image);
          
          // 데이터 파싱
          const parsedData = parseBondData(ocrText);
          
          results.push({
            id: image.id,
            imageName: image.name,
            ocrText,
            parsedData,
            status: 'completed'
          });

          // 이미지 상태 업데이트
          setUploadedImages(prev => 
            prev.map(img => 
              img.id === image.id 
                ? { ...img, status: 'completed' }
                : img
            )
          );

        } catch (error) {
          console.error(`이미지 ${image.name} 처리 오류:`, error);
          
          setUploadedImages(prev => 
            prev.map(img => 
              img.id === image.id 
                ? { ...img, status: 'error' }
                : img
            )
          );
        }
      }

      setProcessedData(results);
      setMessage({ type: 'success', text: '이미지 처리가 완료되었습니다.' });
      
    } catch (error) {
      console.error('처리 오류:', error);
      setMessage({ type: 'error', text: '이미지 처리 중 오류가 발생했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 데이터 편집
  const handleEditData = (data) => {
    setEditingData(data);
    setShowDataDialog(true);
  };

  // 데이터 저장
  const handleSaveData = () => {
    if (!editingData) return;

    setProcessedData(prev => 
      prev.map(item => 
        item.id === editingData.id 
          ? { ...item, parsedData: editingData.parsedData }
          : item
      )
    );

    setShowDataDialog(false);
    setEditingData(null);
    setMessage({ type: 'success', text: '데이터가 저장되었습니다.' });
  };

  // 이미지 삭제
  const handleDeleteImage = (imageId) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
    setProcessedData(prev => prev.filter(data => data.id !== imageId));
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold', color: '#f5576c' }}>
        채권장표
      </Typography>
      
      <Typography variant="h6" sx={{ mb: 2, color: '#666' }}>
        이미지 업로드를 통한 채권 데이터 수집 및 관리
      </Typography>

      {/* 메시지 표시 */}
      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* 이미지 업로드 카드 */}
        <Grid item xs={12} md={6}>
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ImageIcon sx={{ fontSize: 32, color: '#f5576c', mr: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  이미지 업로드
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                채권 관련 이미지를 업로드하여 OCR로 데이터를 추출합니다.
              </Typography>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              
              <Button
                variant="contained"
                fullWidth
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #e085e8 0%, #e04a5f 100%)'
                  }
                }}
              >
                이미지 선택
              </Button>

              {/* 업로드된 이미지 목록 */}
              {uploadedImages.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    업로드된 이미지 ({uploadedImages.length})
                  </Typography>
                  {uploadedImages.map((image) => (
                    <Box key={image.id} sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      p: 1, 
                      mb: 1, 
                      border: '1px solid #ddd',
                      borderRadius: 1,
                      backgroundColor: '#f9f9f9'
                    }}>
                      <img 
                        src={image.preview} 
                        alt={image.name}
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, marginRight: 8 }}
                      />
                      <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>
                        {image.name}
                      </Typography>
                      <Chip 
                        label={image.status === 'pending' ? '대기' : 
                               image.status === 'processing' ? '처리중' :
                               image.status === 'completed' ? '완료' : '오류'}
                        color={image.status === 'completed' ? 'success' : 
                               image.status === 'error' ? 'error' : 'default'}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteImage(image.id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={startProcessing}
                    disabled={isProcessing || uploadedImages.length === 0}
                    startIcon={isProcessing ? <CircularProgress size={16} /> : null}
                    sx={{ mt: 2 }}
                  >
                    {isProcessing ? '처리 중...' : 'OCR 처리 시작'}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 데이터 관리 카드 */}
        <Grid item xs={12} md={6}>
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TableChartIcon sx={{ fontSize: 32, color: '#f5576c', mr: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  데이터 관리
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                추출된 데이터를 확인하고 편집할 수 있습니다.
              </Typography>
              
              {processedData.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    처리된 데이터 ({processedData.length})
                  </Typography>
                  {processedData.map((data) => (
                    <Box key={data.id} sx={{ 
                      p: 2, 
                      mb: 1, 
                      border: '1px solid #ddd',
                      borderRadius: 1,
                      backgroundColor: '#f9f9f9'
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {data.imageName}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={() => handleEditData(data)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        총액: {data.parsedData.totalAmount?.toLocaleString()}원
                      </Typography>
                    </Box>
                  ))}
                  
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => setShowDataDialog(true)}
                    sx={{ mt: 2 }}
                  >
                    전체 데이터 보기
                  </Button>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  fullWidth
                  disabled
                  sx={{
                    borderColor: '#f5576c',
                    color: '#f5576c',
                    '&:hover': {
                      borderColor: '#e04a5f',
                      backgroundColor: 'rgba(245, 87, 108, 0.04)'
                    }
                  }}
                >
                  데이터 없음
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 기능 설명 */}
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}>
            주요 기능
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                📸 이미지 OCR
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • 단말기채권, 재고초과채권, 담보초과채권 이미지 업로드<br/>
                • 무료 OCR 기술로 텍스트 자동 추출<br/>
                • 다중 이미지 동시 처리 지원
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                📊 자동 표 생성
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • 추출된 데이터를 깔끔한 표로 자동 정리<br/>
                • 일자별 데이터 그룹핑 및 관리<br/>
                • 통계 및 분석 기능 제공
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 데이터 편집 다이얼로그 */}
      <Dialog 
        open={showDataDialog} 
        onClose={() => setShowDataDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">데이터 편집</Typography>
            <IconButton onClick={() => setShowDataDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {editingData && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                {editingData.imageName}
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="날짜"
                    value={editingData.parsedData.date || ''}
                    onChange={(e) => setEditingData(prev => ({
                      ...prev,
                      parsedData: { ...prev.parsedData, date: e.target.value }
                    }))}
                    fullWidth
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="총액"
                    value={editingData.parsedData.totalAmount?.toLocaleString() || ''}
                    fullWidth
                    sx={{ mb: 2 }}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </Grid>

              {/* 단말기채권 */}
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                단말기채권
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>단말기</TableCell>
                      <TableCell>금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editingData.parsedData.terminalBonds?.map((bond, index) => (
                      <TableRow key={index}>
                        <TableCell>{bond.terminal}</TableCell>
                        <TableCell>{bond.amount?.toLocaleString()}원</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* 재고초과채권 */}
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                재고초과채권
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>수량</TableCell>
                      <TableCell>금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editingData.parsedData.inventoryBonds?.map((bond, index) => (
                      <TableRow key={index}>
                        <TableCell>{bond.quantity}</TableCell>
                        <TableCell>{bond.amount?.toLocaleString()}원</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* 담보초과채권 */}
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                담보초과채권
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editingData.parsedData.collateralBonds?.map((bond, index) => (
                      <TableRow key={index}>
                        <TableCell>{bond.amount?.toLocaleString()}원</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TextField
                label="메모"
                value={editingData.parsedData.notes || ''}
                onChange={(e) => setEditingData(prev => ({
                  ...prev,
                  parsedData: { ...prev.parsedData, notes: e.target.value }
                }))}
                fullWidth
                multiline
                rows={3}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDataDialog(false)}>취소</Button>
          <Button onClick={handleSaveData} variant="contained" startIcon={<SaveIcon />}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// 지표장표 탭 컴포넌트
function IndicatorChartTab() {
  const [activeSubTab, setActiveSubTab] = useState(0);

  const subTabs = [
    { label: '월간시상', icon: <TrendingUpIcon /> },
    { label: '매출지표', icon: <AssessmentIcon /> },
    { label: '판매량', icon: <ShowChartIcon /> },
    { label: '구조정책', icon: <PieChartIcon /> }
  ];

  const handleSubTabChange = (event, newValue) => {
    setActiveSubTab(newValue);
  };

  return (
    <Box>
      {/* 서브 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeSubTab} 
          onChange={handleSubTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              minHeight: 56,
              fontSize: '0.9rem',
              fontWeight: 'bold',
              color: '#666',
              '&.Mui-selected': {
                color: '#f5576c',
                fontWeight: 'bold'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#f5576c',
              height: 3
            }
          }}
        >
          {subTabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              sx={{ 
                textTransform: 'none',
                minHeight: 56,
                py: 1
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* 서브 탭 컨텐츠 */}
      {activeSubTab === 0 && <MonthlyAwardTab />}
      {activeSubTab === 1 && <SalesIndicatorTab />}
      {activeSubTab === 2 && <SalesVolumeTab />}
      {activeSubTab === 3 && <StructurePolicyTab />}
    </Box>
  );
}

// 월간시상 탭 컴포넌트
function MonthlyAwardTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const result = await api.getMonthlyAwardData();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Matrix 셀 색상 계산
  const getMatrixCellColor = (score, percentage) => {
    if (!data?.matrixCriteria) return '#ffffff';
    
    const criteria = data.matrixCriteria.find(c => c.score === score);
    if (!criteria) return '#ffffff';
    
    const targetPercentage = criteria.percentage;
    if (percentage >= targetPercentage) return '#4caf50'; // 녹색
    if (percentage >= targetPercentage * 0.8) return '#ff9800'; // 주황색
    return '#f44336'; // 빨간색
  };

  // 성과 아이콘 계산
  const getPerformanceIcon = (percentage, targetPercentage) => {
    if (percentage >= targetPercentage) return '🏆';
    if (percentage >= targetPercentage * 0.8) return '👍';
    return '⚠️';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        데이터가 없습니다.
      </Alert>
    );
  }

  return (
    <Box>
      {/* 헤더 정보 */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
            {data.date} 월간시상 현황
          </Typography>
          <Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsExpanded(!isExpanded)}
              startIcon={isExpanded ? <CloseIcon /> : <ShowChartIcon />}
              sx={{ mr: 1 }}
            >
              {isExpanded ? '축소' : '확대'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowSettings(true)}
              startIcon={<EditIcon />}
            >
              셋팅
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                {data.indicators.upsellChange.percentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">업셀기변</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                {data.indicators.change105Above.percentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">기변105이상</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                {data.indicators.strategicProducts.percentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">전략상품</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                {data.indicators.internetRatio.percentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">인터넷 비중</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 월간시상 Matrix */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}>
          월간시상 Matrix
        </Typography>
        
        {/* 만점기준 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
            만점기준
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e3f2fd', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>21점</Typography>
                <Typography variant="body2" color="text.secondary">총점</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e8f5e8', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>6점</Typography>
                <Typography variant="body2" color="text.secondary">업셀기변</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fff3e0', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>6점</Typography>
                <Typography variant="body2" color="text.secondary">기변105이상</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#f3e5f5', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>3점</Typography>
                <Typography variant="body2" color="text.secondary">전략상품</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fce4ec', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 'bold' }}>6점</Typography>
                <Typography variant="body2" color="text.secondary">인터넷 비중</Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* 달성상황 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
            달성상황
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e3f2fd', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>{data.totalScore}점</Typography>
                <Typography variant="body2" color="text.secondary">총점</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e8f5e8', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.upsellChange.percentage, 92.0)}
                  {Math.round(data.indicators.upsellChange.percentage / 92.0 * 6)}점
                </Typography>
                <Typography variant="body2" color="text.secondary">업셀기변</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fff3e0', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.change105Above.percentage, 88.0)}
                  {Math.round(data.indicators.change105Above.percentage / 88.0 * 6)}점
                </Typography>
                <Typography variant="body2" color="text.secondary">기변105이상</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#f3e5f5', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.strategicProducts.percentage, 40.0)}
                  {Math.round(data.indicators.strategicProducts.percentage / 40.0 * 3)}점
                </Typography>
                <Typography variant="body2" color="text.secondary">전략상품</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fce4ec', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.internetRatio.percentage, 60.0)}
                  {Math.round(data.indicators.internetRatio.percentage / 60.0 * 6)}점
                </Typography>
                <Typography variant="body2" color="text.secondary">인터넷 비중</Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Matrix 테이블 */}
        <Collapse in={!isExpanded}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>점수</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>업셀기변</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>기변105이상</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>전략상품</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>인터넷 비중</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[6, 5, 4, 3, 2, 1].map((score) => (
                  <TableRow key={score}>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{score}점</TableCell>
                    <TableCell 
                      sx={{ 
                        textAlign: 'center',
                        backgroundColor: getMatrixCellColor(score, data.indicators.upsellChange.percentage)
                      }}
                    >
                      {data.matrixCriteria?.find(c => c.score === score && c.indicator === 'upsell')?.percentage || 0}%
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        textAlign: 'center',
                        backgroundColor: getMatrixCellColor(score, data.indicators.change105Above.percentage)
                      }}
                    >
                      {data.matrixCriteria?.find(c => c.score === score && c.indicator === 'change105')?.percentage || 0}%
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        textAlign: 'center',
                        backgroundColor: getMatrixCellColor(score, data.indicators.strategicProducts.percentage)
                      }}
                    >
                      {data.matrixCriteria?.find(c => c.score === score && c.indicator === 'strategic')?.percentage || 0}%
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        textAlign: 'center',
                        backgroundColor: getMatrixCellColor(score, data.indicators.internetRatio.percentage)
                      }}
                    >
                      {data.matrixCriteria?.find(c => c.score === score && c.indicator === 'internet')?.percentage || 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>

      {/* 상세 데이터 테이블 */}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>채널</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>업셀기변</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>기변105이상</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>전략상품</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>인터넷 비중</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.agentDetails?.map((agent, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{agent.name}</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {agent.upsellChange.denominator > 0 
                        ? (agent.upsellChange.numerator / agent.upsellChange.denominator * 100).toFixed(2)
                        : '0.00'}%
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {agent.change105Above.denominator > 0 
                        ? (agent.change105Above.numerator / agent.change105Above.denominator * 100).toFixed(2)
                        : '0.00'}%
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {agent.strategicProducts.denominator > 0 
                        ? (agent.strategicProducts.numerator / agent.strategicProducts.denominator * 100).toFixed(2)
                        : '0.00'}%
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {agent.internetRatio.denominator > 0 
                        ? (agent.internetRatio.numerator / agent.internetRatio.denominator * 100).toFixed(2)
                        : '0.00'}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

      {/* 셋팅 다이얼로그 */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="lg" fullWidth>
        <DialogTitle>월간시상 셋팅</DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Matrix 기준값 설정</Typography>
          
          {/* 업셀기변 기준값 */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#2e7d32' }}>업셀기변 기준값</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[6, 5, 4, 3, 2, 1].map((score) => (
              <Grid item xs={12} md={4} key={`upsell-${score}`}>
                <TextField
                  fullWidth
                  label={`${score}점 기준 (%)`}
                  type="number"
                  defaultValue={data.matrixCriteria?.find(c => c.score === score && c.indicator === 'upsell')?.percentage || 0}
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                  sx={{ mb: 1 }}
                />
              </Grid>
            ))}
          </Grid>

          {/* 기변105이상 기준값 */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#f57c00' }}>기변105이상 기준값</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[6, 5, 4, 3, 2, 1].map((score) => (
              <Grid item xs={12} md={4} key={`change105-${score}`}>
                <TextField
                  fullWidth
                  label={`${score}점 기준 (%)`}
                  type="number"
                  defaultValue={data.matrixCriteria?.find(c => c.score === score && c.indicator === 'change105')?.percentage || 0}
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                  sx={{ mb: 1 }}
                />
              </Grid>
            ))}
          </Grid>

          {/* 전략상품 기준값 */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#7b1fa2' }}>전략상품 기준값</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[6, 5, 4, 3, 2, 1].map((score) => (
              <Grid item xs={12} md={4} key={`strategic-${score}`}>
                <TextField
                  fullWidth
                  label={`${score}점 기준 (%)`}
                  type="number"
                  defaultValue={data.matrixCriteria?.find(c => c.score === score && c.indicator === 'strategic')?.percentage || 0}
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                  sx={{ mb: 1 }}
                />
              </Grid>
            ))}
          </Grid>

          {/* 인터넷 비중 기준값 */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#c2185b' }}>인터넷 비중 기준값</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[6, 5, 4, 3, 2, 1].map((score) => (
              <Grid item xs={12} md={4} key={`internet-${score}`}>
                <TextField
                  fullWidth
                  label={`${score}점 기준 (%)`}
                  type="number"
                  defaultValue={data.matrixCriteria?.find(c => c.score === score && c.indicator === 'internet')?.percentage || 0}
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                  sx={{ mb: 1 }}
                />
              </Grid>
            ))}
          </Grid>

          {/* 전략상품 포인트 설정 */}
          <Typography variant="h6" sx={{ mb: 2, mt: 4 }}>전략상품 포인트 설정</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="보험(폰교체) 포인트"
                type="number"
                defaultValue={data.strategicProductsList?.find(p => p.serviceName === '보험(폰교체)')?.points || 0}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="유플릭스 포인트"
                type="number"
                defaultValue={data.strategicProductsList?.find(p => p.serviceName === '유플릭스')?.points || 0}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="통화연결음 포인트"
                type="number"
                defaultValue={data.strategicProductsList?.find(p => p.serviceName === '통화연결음')?.points || 0}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="뮤직류 포인트"
                type="number"
                defaultValue={data.strategicProductsList?.find(p => p.serviceName === '뮤직류')?.points || 0}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>취소</Button>
          <Button onClick={async () => {
            try {
              // Matrix 기준값 수집
              const matrixCriteria = [];
              ['upsell', 'change105', 'strategic', 'internet'].forEach(indicator => {
                [6, 5, 4, 3, 2, 1].forEach(score => {
                  const input = document.querySelector(`input[type="number"][key*="${indicator}-${score}"]`);
                  if (input) {
                    matrixCriteria.push({
                      score,
                      indicator,
                      percentage: parseFloat(input.value || 0)
                    });
                  }
                });
              });

              // 전략상품 포인트 수집
              const strategicProducts = [
                { serviceName: '보험(폰교체)', points: parseFloat(document.querySelector('input[label*="보험"]')?.value || 0) },
                { serviceName: '유플릭스', points: parseFloat(document.querySelector('input[label*="유플릭스"]')?.value || 0) },
                { serviceName: '통화연결음', points: parseFloat(document.querySelector('input[label*="통화연결음"]')?.value || 0) },
                { serviceName: '뮤직류', points: parseFloat(document.querySelector('input[label*="뮤직류"]')?.value || 0) }
              ];

              // 설정 저장
              await api.saveMonthlyAwardSettings('matrix_criteria', matrixCriteria);
              await api.saveMonthlyAwardSettings('strategic_products', strategicProducts);
              
              alert('설정이 저장되었습니다.');
              setShowSettings(false);
              // 데이터 다시 로드
              window.location.reload();
            } catch (error) {
              alert('설정 저장 중 오류가 발생했습니다.');
            }
          }} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// 매출지표 탭 컴포넌트
function SalesIndicatorTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <AssessmentIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        매출지표
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        매출 관련 지표 및 분석 기능이 개발 중입니다.<br />
        빠른 시일 내에 서비스를 제공하겠습니다.
      </Typography>
    </Paper>
  );
}

// 판매량 탭 컴포넌트
function SalesVolumeTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <ShowChartIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        판매량
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        판매량 관련 차트 및 분석 기능이 개발 중입니다.<br />
        빠른 시일 내에 서비스를 제공하겠습니다.
      </Typography>
    </Paper>
  );
}

// 구조정책 탭 컴포넌트
function StructurePolicyTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <PieChartIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        구조정책
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        구조정책 관련 분석 및 차트 기능이 개발 중입니다.<br />
        빠른 시일 내에 서비스를 제공하겠습니다.
      </Typography>
    </Paper>
  );
}

// 채권장표 준비 중 탭 컴포넌트
function BondChartComingSoonTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <AccountBalanceIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        채권장표
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        기존 OCR 기능 등을 새로운 형태로 재개발 중입니다.<br />
        더 나은 사용자 경험을 제공하기 위해 준비하고 있습니다.
      </Typography>
    </Paper>
  );
}

// 준비 중 탭 컴포넌트
function ComingSoonTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <BarChartIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        준비 중입니다
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        새로운 형태로 개발 예정
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        기존 OCR 기능 등을 새로운 형태로 재개발 중입니다.<br />
        더 나은 사용자 경험을 제공하기 위해 준비하고 있습니다.
      </Typography>
    </Paper>
  );
}

export default ChartMode; 