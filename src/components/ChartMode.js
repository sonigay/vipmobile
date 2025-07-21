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
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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



function ChartMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  const [activeTab, setActiveTab] = useState(0);




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
  const [isAgentTableExpanded, setIsAgentTableExpanded] = useState(true);
  const [isOfficeTableExpanded, setIsOfficeTableExpanded] = useState(true);
  const [isDepartmentTableExpanded, setIsDepartmentTableExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState(0); // 셋팅 다이얼로그에서 현재 탭 상태 관리
  
  // 추가 전략상품 상태
  const [newStrategicProduct, setNewStrategicProduct] = useState({
    subCategory: '',
    serviceName: '',
    points: 0
  });

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

  // 성과 아이콘 계산 (시트에서 로드된 기준값 사용)
  const getPerformanceIcon = (percentage, indicator) => {
    if (!data?.matrixCriteria) return '⚠️';
    
    // 해당 지표의 최고 점수 기준값 찾기
    const maxCriteria = data.matrixCriteria
      .filter(c => c.indicator === indicator)
      .sort((a, b) => b.score - a.score)[0];
    
    if (!maxCriteria) return '⚠️';
    
    if (percentage >= maxCriteria.percentage) return '🏆';
    if (percentage >= maxCriteria.percentage * 0.8) return '👍';
    return '⚠️';
  };

  // 달성 상태 텍스트 생성
  const getAchievementText = (percentage, indicator) => {
    if (!data?.matrixCriteria) return '미달';
    
    // 해당 지표의 최고 점수 기준값 찾기
    const maxCriteria = data.matrixCriteria
      .filter(c => c.indicator === indicator)
      .sort((a, b) => b.score - a.score)[0];
    
    if (!maxCriteria) return '미달';
    
    if (percentage >= maxCriteria.percentage) {
      return '달성';
    } else {
      const gap = (maxCriteria.percentage - percentage).toFixed(1);
      return `${gap}% 부족`;
    }
  };

  // 점수 계산 함수
  const calculateScore = (percentage, criteria, maxScore) => {
    if (!criteria || criteria.length === 0) return 0;
    
    // 기준값을 내림차순으로 정렬 (높은 점수부터 확인)
    const sortedCriteria = [...criteria].sort((a, b) => b.score - a.score);
    
    for (let i = 0; i < sortedCriteria.length; i++) {
      if (percentage >= sortedCriteria[i].percentage) {
        return sortedCriteria[i].score;
      }
    }
    return 0; // 기준 미달 시 0점
  };

  // 추가 전략상품 핸들러
  const handleAddStrategicProduct = async () => {
    if (!newStrategicProduct.subCategory || !newStrategicProduct.serviceName || newStrategicProduct.points <= 0) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    try {
      const updatedProducts = [
        ...(data.strategicProductsList || []),
        {
          subCategory: newStrategicProduct.subCategory,
          serviceCode: '', // 빈 값으로 설정
          serviceName: newStrategicProduct.serviceName,
          points: newStrategicProduct.points
        }
      ];

      await api.saveMonthlyAwardSettings('strategic_products', updatedProducts);
      
      // 데이터 새로고침
      const result = await api.getMonthlyAwardData();
      setData(result);
      
      // 입력 필드 초기화
      setNewStrategicProduct({
        subCategory: '',
        serviceName: '',
        points: 0
      });
      
      alert('전략상품이 추가되었습니다.');
    } catch (error) {
      alert('전략상품 추가 중 오류가 발생했습니다: ' + error.message);
    }
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
      <Collapse in={isExpanded}>
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
                  <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>{data.totalMaxScore || 21}점</Typography>
                  <Typography variant="body2" color="text.secondary">총점</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e8f5e8', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>{data.maxScores?.upsell || 6}점</Typography>
                  <Typography variant="body2" color="text.secondary">업셀기변</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fff3e0', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>{data.maxScores?.change105 || 6}점</Typography>
                  <Typography variant="body2" color="text.secondary">기변105이상</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#f3e5f5', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>{data.maxScores?.strategic || 6}점</Typography>
                  <Typography variant="body2" color="text.secondary">전략상품</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fce4ec', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 'bold' }}>{data.maxScores?.internet || 3}점</Typography>
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
                    {getPerformanceIcon(data.indicators.upsellChange.percentage, 'upsell')}
                    {calculateScore(parseFloat(data.indicators.upsellChange.percentage), data.matrixCriteria?.filter(c => c.indicator === 'upsell') || [], data.maxScores?.upsell || 6)}점
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    업셀기변
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    color: parseFloat(data.indicators.upsellChange.percentage) >= 92.0 ? '#2e7d32' : '#d32f2f',
                    fontWeight: 'bold',
                    fontSize: '0.7rem'
                  }}>
                    {getAchievementText(parseFloat(data.indicators.upsellChange.percentage), 'upsell')}
                  </Typography>
                </Box>
              </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fff3e0', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.change105Above.percentage, 'change105')}
                  {calculateScore(parseFloat(data.indicators.change105Above.percentage), data.matrixCriteria?.filter(c => c.indicator === 'change105') || [], data.maxScores?.change105 || 6)}점
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  기변105이상
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: parseFloat(data.indicators.change105Above.percentage) >= 88.0 ? '#2e7d32' : '#d32f2f',
                  fontWeight: 'bold',
                  fontSize: '0.7rem'
                }}>
                  {getAchievementText(parseFloat(data.indicators.change105Above.percentage), 'change105')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#f3e5f5', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.strategicProducts.percentage, 'strategic')}
                  {calculateScore(parseFloat(data.indicators.strategicProducts.percentage), data.matrixCriteria?.filter(c => c.indicator === 'strategic') || [], data.maxScores?.strategic || 6)}점
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  전략상품
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: parseFloat(data.indicators.strategicProducts.percentage) >= 90.0 ? '#2e7d32' : '#d32f2f',
                  fontWeight: 'bold',
                  fontSize: '0.7rem'
                }}>
                  {getAchievementText(parseFloat(data.indicators.strategicProducts.percentage), 'strategic')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fce4ec', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.internetRatio.percentage, 'internet')}
                  {calculateScore(parseFloat(data.indicators.internetRatio.percentage), data.matrixCriteria?.filter(c => c.indicator === 'internet') || [], data.maxScores?.internet || 3)}점
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  인터넷 비중 ({data.indicators.internetRatio.percentage}%)
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: parseFloat(data.indicators.internetRatio.percentage) >= 7.0 ? '#2e7d32' : '#d32f2f',
                  fontWeight: 'bold',
                  fontSize: '0.7rem'
                }}>
                  {getAchievementText(parseFloat(data.indicators.internetRatio.percentage), 'internet')}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Matrix 테이블 */}
        <Collapse in={isExpanded}>
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
                {[6, 5, 4, 3, 2, 1].map((score) => {
                  const upsellCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'upsell');
                  const change105Criteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'change105');
                  const strategicCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'strategic');
                  const internetCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'internet');
                  
                  const isUpsellAchieved = upsellCriteria && parseFloat(data.indicators.upsellChange.percentage) >= upsellCriteria.percentage;
                  const isChange105Achieved = change105Criteria && parseFloat(data.indicators.change105Above.percentage) >= change105Criteria.percentage;
                  const isStrategicAchieved = strategicCriteria && parseFloat(data.indicators.strategicProducts.percentage) >= strategicCriteria.percentage;
                  const isInternetAchieved = internetCriteria && parseFloat(data.indicators.internetRatio.percentage) >= internetCriteria.percentage;
                  
                  return (
                    <TableRow key={score}>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{score}점</TableCell>
                      <TableCell sx={{ textAlign: 'center', bgcolor: isUpsellAchieved ? '#e8f5e8' : 'transparent' }}>
                        {upsellCriteria?.percentage || 0}%
                        {isUpsellAchieved && <span style={{ marginLeft: '8px', color: '#2e7d32' }}>✓</span>}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', bgcolor: isChange105Achieved ? '#fff3e0' : 'transparent' }}>
                        {change105Criteria?.percentage || 0}%
                        {isChange105Achieved && <span style={{ marginLeft: '8px', color: '#f57c00' }}>✓</span>}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', bgcolor: isStrategicAchieved ? '#f3e5f5' : 'transparent' }}>
                        {strategicCriteria?.percentage || 0}%
                        {isStrategicAchieved && <span style={{ marginLeft: '8px', color: '#7b1fa2' }}>✓</span>}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', bgcolor: isInternetAchieved ? '#fce4ec' : 'transparent' }}>
                        {internetCriteria?.percentage || 0}%
                        {isInternetAchieved && <span style={{ marginLeft: '8px', color: '#c2185b' }}>✓</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>
        </Collapse>

      {/* 상세 데이터 테이블 */}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
            채널별 성과 현황
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setIsAgentTableExpanded(!isAgentTableExpanded)}
            startIcon={isAgentTableExpanded ? <CloseIcon /> : <ShowChartIcon />}
          >
            {isAgentTableExpanded ? '축소' : '확대'}
          </Button>
        </Box>
        <Collapse in={isAgentTableExpanded}>
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
                {data.agentDetails && data.agentDetails.length > 0 ? (
                  data.agentDetails.map((agent, index) => (
                    <TableRow key={index}>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{agent.name}</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {agent.upsellChange.percentage}%
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            color: parseFloat(agent.upsellChange.percentage) >= 92.0 ? '#2e7d32' : '#d32f2f',
                            fontWeight: 'bold',
                            fontSize: '0.7rem'
                          }}>
                            {getAchievementText(parseFloat(agent.upsellChange.percentage), 'upsell')}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {agent.change105Above.percentage}%
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            color: parseFloat(agent.change105Above.percentage) >= 88.0 ? '#2e7d32' : '#d32f2f',
                            fontWeight: 'bold',
                            fontSize: '0.7rem'
                          }}>
                            {getAchievementText(parseFloat(agent.change105Above.percentage), 'change105')}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {agent.strategicProducts.percentage}%
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            color: parseFloat(agent.strategicProducts.percentage) >= 90.0 ? '#2e7d32' : '#d32f2f',
                            fontWeight: 'bold',
                            fontSize: '0.7rem'
                          }}>
                            {getAchievementText(parseFloat(agent.strategicProducts.percentage), 'strategic')}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {agent.internetRatio.percentage}%
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            color: parseFloat(agent.internetRatio.percentage) >= 7.0 ? '#2e7d32' : '#d32f2f',
                            fontWeight: 'bold',
                            fontSize: '0.7rem'
                          }}>
                            {getAchievementText(parseFloat(agent.internetRatio.percentage), 'internet')}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        담당자 데이터가 없습니다. 업체 매핑을 확인해주세요.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>

      {/* 사무실별 성과 테이블 */}
      {data.officeGroups && data.officeGroups.length > 0 && (
        <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
              사무실별 성과 현황
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsOfficeTableExpanded(!isOfficeTableExpanded)}
              startIcon={isOfficeTableExpanded ? <CloseIcon /> : <ShowChartIcon />}
            >
              {isOfficeTableExpanded ? '축소' : '확대'}
            </Button>
          </Box>
          <Collapse in={isOfficeTableExpanded}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>사무실</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>업셀기변</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>기변105이상</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>전략상품</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>인터넷 비중</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.officeGroups.map((group, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{group.office}</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalUpsellChange.percentage}%
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: parseFloat(group.totalUpsellChange.percentage) >= 92.0 ? '#2e7d32' : '#d32f2f',
                          fontWeight: 'bold',
                          fontSize: '0.7rem'
                        }}>
                          {getAchievementText(parseFloat(group.totalUpsellChange.percentage), 'upsell')}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalChange105Above.percentage}%
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: parseFloat(group.totalChange105Above.percentage) >= 88.0 ? '#2e7d32' : '#d32f2f',
                          fontWeight: 'bold',
                          fontSize: '0.7rem'
                        }}>
                          {getAchievementText(parseFloat(group.totalChange105Above.percentage), 'change105')}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalStrategicProducts.percentage}%
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: parseFloat(group.totalStrategicProducts.percentage) >= 90.0 ? '#2e7d32' : '#d32f2f',
                          fontWeight: 'bold',
                          fontSize: '0.7rem'
                        }}>
                          {getAchievementText(parseFloat(group.totalStrategicProducts.percentage), 'strategic')}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalInternetRatio.percentage}%
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: parseFloat(group.totalInternetRatio.percentage) >= 7.0 ? '#2e7d32' : '#d32f2f',
                          fontWeight: 'bold',
                          fontSize: '0.7rem'
                        }}>
                          {getAchievementText(parseFloat(group.totalInternetRatio.percentage), 'internet')}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>
      )}

      {/* 소속별 성과 테이블 */}
      {data.departmentGroups && data.departmentGroups.length > 0 && (
        <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
              소속별 성과 현황
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsDepartmentTableExpanded(!isDepartmentTableExpanded)}
              startIcon={isDepartmentTableExpanded ? <CloseIcon /> : <ShowChartIcon />}
            >
              {isDepartmentTableExpanded ? '축소' : '확대'}
            </Button>
          </Box>
          <Collapse in={isDepartmentTableExpanded}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>소속</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>업셀기변</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>기변105이상</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>전략상품</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>인터넷 비중</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.departmentGroups.map((group, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{group.department}</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalUpsellChange.percentage}%
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: parseFloat(group.totalUpsellChange.percentage) >= 92.0 ? '#2e7d32' : '#d32f2f',
                          fontWeight: 'bold',
                          fontSize: '0.7rem'
                        }}>
                          {getAchievementText(parseFloat(group.totalUpsellChange.percentage), 'upsell')}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalChange105Above.percentage}%
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: parseFloat(group.totalChange105Above.percentage) >= 88.0 ? '#2e7d32' : '#d32f2f',
                          fontWeight: 'bold',
                          fontSize: '0.7rem'
                        }}>
                          {getAchievementText(parseFloat(group.totalChange105Above.percentage), 'change105')}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalStrategicProducts.percentage}%
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: parseFloat(group.totalStrategicProducts.percentage) >= 90.0 ? '#2e7d32' : '#d32f2f',
                          fontWeight: 'bold',
                          fontSize: '0.7rem'
                        }}>
                          {getAchievementText(parseFloat(group.totalStrategicProducts.percentage), 'strategic')}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalInternetRatio.percentage}%
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: parseFloat(group.totalInternetRatio.percentage) >= 7.0 ? '#2e7d32' : '#d32f2f',
                          fontWeight: 'bold',
                          fontSize: '0.7rem'
                        }}>
                          {getAchievementText(parseFloat(group.totalInternetRatio.percentage), 'internet')}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>
      )}

      {/* 셋팅 다이얼로그 */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="lg" fullWidth>
        <DialogTitle>월간시상 셋팅</DialogTitle>
        <DialogContent>
          <Tabs value={settingsTab} onChange={(e, newValue) => setSettingsTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Matrix 기준값" />
            <Tab label="전략상품 관리" />
            <Tab label="업체 매핑" />
            <Tab label="요금제 매핑" />
            <Tab label="담당자 관리" />
          </Tabs>

          {/* Matrix 기준값 탭 */}
          {settingsTab === 0 && (
            <Box>
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
            </Box>
          )}

          {/* 전략상품 관리 탭 */}
          {settingsTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>전략상품 포인트 설정</Typography>
              
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>매칭 규칙</Typography>
                <Typography variant="body2" color="text.secondary">
                  • 1순위: 부가서비스명과 정확히 일치하는 경우<br/>
                  • 2순위: 소분류와 일치하는 경우<br/>
                  • 소분류와 부가서비스명을 모두 설정할 수 있습니다
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>기본 전략상품</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="보험(폰교체) 포인트"
                    type="number"
                    defaultValue={data.strategicProductsList?.find(p => p.serviceName === '보험(폰교체)')?.points || 0}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="유플릭스 포인트"
                    type="number"
                    defaultValue={data.strategicProductsList?.find(p => p.serviceName === '유플릭스')?.points || 0}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="통화연결음 포인트"
                    type="number"
                    defaultValue={data.strategicProductsList?.find(p => p.serviceName === '통화연결음')?.points || 0}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="뮤직류 포인트"
                    type="number"
                    defaultValue={data.strategicProductsList?.find(p => p.serviceName === '뮤직류')?.points || 0}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>추가 전략상품</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="소분류"
                    placeholder="예: 보험(폰교체)"
                    value={newStrategicProduct.subCategory}
                    onChange={(e) => setNewStrategicProduct(prev => ({
                      ...prev,
                      subCategory: e.target.value
                    }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="부가서비스명"
                    placeholder="예: 폰교체슬림"
                    value={newStrategicProduct.serviceName}
                    onChange={(e) => setNewStrategicProduct(prev => ({
                      ...prev,
                      serviceName: e.target.value
                    }))}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="포인트"
                    type="number"
                    placeholder="0"
                    value={newStrategicProduct.points}
                    onChange={(e) => setNewStrategicProduct(prev => ({
                      ...prev,
                      points: parseFloat(e.target.value) || 0
                    }))}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={1}>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    sx={{ height: 56 }}
                    onClick={handleAddStrategicProduct}
                    disabled={!newStrategicProduct.subCategory || !newStrategicProduct.serviceName || newStrategicProduct.points <= 0}
                  >
                    추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>현재 설정된 전략상품 목록</Typography>
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {data.strategicProductsList && data.strategicProductsList.length > 0 ? (
                    data.strategicProductsList.map((product, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2">
                          <strong>소분류:</strong> {product.subCategory} | 
                          <strong>부가서비스명:</strong> {product.serviceName} | 
                          <strong>포인트:</strong> {product.points}
                        </Typography>
                      </Box>
                    ))
                  ) : (
                    "설정된 전략상품이 없습니다."
                  )}
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>매칭되지 않은 전략상품</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                {data.unmatchedItems?.strategicProducts && data.unmatchedItems.strategicProducts.length > 0 ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      다음 전략상품들이 설정된 목록과 매칭되지 않았습니다. 위의 전략상품 목록에 추가해주세요.
                    </Typography>
                    {data.unmatchedItems.strategicProducts.map((product, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffeaa7' }}>
                        <Typography variant="body2" color="warning.dark">
                          <strong>매칭되지 않은 전략상품:</strong> {product}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    매칭되지 않은 전략상품이 없습니다.
                  </Typography>
                )}
              </Paper>
            </Box>
          )}

          {/* 업체 매핑 탭 */}
          {settingsTab === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>인터넷 비중 업체명 매핑</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                개통데이터/홈데이터의 업체명과 폰클출고처데이터의 업체명이 일치하지 않는 경우를 관리합니다.
              </Typography>
              
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>매핑 규칙</Typography>
                <Typography variant="body2" color="text.secondary">
                  • 개통데이터/홈데이터 G열(업체명) ↔ 폰클출고처데이터 C열(출고처 업체명)<br/>
                  • 정확한 업체명 매칭이 필요한 경우에만 사용합니다<br/>
                  • 매칭되지 않은 업체는 인터넷 비중 계산에서 제외됩니다
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>매핑되지 않은 업체 목록</Typography>
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                {data.unmatchedItems?.companies && data.unmatchedItems.companies.length > 0 ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      다음 업체명들이 폰클출고처데이터와 매칭되지 않았습니다. 각 업체명에 대해 정확한 매핑을 설정해주세요.
                    </Typography>
                    {data.unmatchedItems.companies.map((company, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffeaa7' }}>
                        <Typography variant="body2" color="warning.dark">
                          <strong>매칭되지 않은 업체명:</strong> {company}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    매칭되지 않은 업체가 없습니다.
                  </Typography>
                )}
              </Paper>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="개통데이터/홈데이터 업체명"
                    placeholder="예: (주)본앤코리아(원주단계)"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="폰클출고처데이터 업체명"
                    placeholder="예: (주)본앤코리아"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button variant="outlined" fullWidth sx={{ height: 56 }}>
                    매핑 추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>현재 매핑 목록</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  설정된 매핑이 없습니다. 위에서 매핑을 추가하면 여기에 표시됩니다.
                </Typography>
              </Paper>
            </Box>
          )}

          {/* 업체 매핑 탭 */}
          {settingsTab === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>인터넷 비중 업체명 매핑</Typography>
              
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>매핑 규칙</Typography>
                <Typography variant="body2" color="text.secondary">
                  • 개통데이터/홈데이터 G열(업체명) ↔ 폰클출고처데이터 C열(출고처 업체명)<br/>
                  • 정확한 업체명 매칭이 필요한 경우에만 사용합니다<br/>
                  • 매칭되지 않은 업체는 인터넷 비중 계산에서 제외됩니다
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>매핑되지 않은 업체 목록</Typography>
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                {data.unmatchedItems?.companies && data.unmatchedItems.companies.length > 0 ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      다음 업체명들이 폰클출고처데이터와 매칭되지 않았습니다. 각 업체명에 대해 정확한 매핑을 설정해주세요.
                    </Typography>
                    {data.unmatchedItems.companies.map((company, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffeaa7' }}>
                        <Typography variant="body2" color="warning.dark">
                          <strong>매칭되지 않은 업체명:</strong> {company}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    매칭되지 않은 업체가 없습니다.
                  </Typography>
                )}
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>업체명 매핑 추가</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="개통데이터/홈데이터 업체명"
                    placeholder="예: (주)본앤코리아(원주단계)"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="폰클출고처데이터 업체명"
                    placeholder="예: (주)본앤코리아"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button variant="outlined" fullWidth sx={{ height: 56 }}>
                    매핑 추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>현재 매핑 목록</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  설정된 매핑이 없습니다. 위에서 매핑을 추가하면 여기에 표시됩니다.
                </Typography>
              </Paper>
            </Box>
          )}

          {/* 요금제 매핑 탭 */}
          {settingsTab === 3 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>요금제 매핑 설정</Typography>
              
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>매핑 규칙</Typography>
                <Typography variant="body2" color="text.secondary">
                  • 수기초에 있는 요금제명이 무선요금제군에 없을 때 매핑 설정<br/>
                  • 요금제군과 기본료를 설정하여 업셀기변, 기변105이상 계산에 사용<br/>
                  • 매핑되지 않은 요금제는 계산에서 제외됩니다
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>매핑되지 않은 요금제 목록</Typography>
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                {data.unmatchedItems?.plans && data.unmatchedItems.plans.length > 0 ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      다음 요금제명들이 무선요금제군과 매칭되지 않았습니다. 각 요금제에 대해 요금제군과 기본료를 설정해주세요.
                    </Typography>
                    {data.unmatchedItems.plans.map((plan, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffeaa7' }}>
                        <Typography variant="body2" color="warning.dark">
                          <strong>매칭되지 않은 요금제명:</strong> {plan}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    매칭되지 않은 요금제가 없습니다.
                  </Typography>
                )}
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>요금제 매핑 추가</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="요금제명"
                    placeholder="예: 5G 프리미어 레귤러"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="요금제군"
                    placeholder="예: 115군"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="기본료"
                    type="number"
                    placeholder="118"
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button variant="outlined" fullWidth sx={{ height: 56 }}>
                    매핑 추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>현재 매핑 목록</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  설정된 매핑이 없습니다. 위에서 매핑을 추가하면 여기에 표시됩니다.
                </Typography>
              </Paper>
            </Box>
          )}

          {/* 담당자 관리 탭 */}
          {settingsTab === 4 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>담당자별 설정</Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="담당자명"
                    placeholder="담당자 이름"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>활성화 상태</InputLabel>
                    <Select defaultValue="active">
                      <MenuItem value="active">활성</MenuItem>
                      <MenuItem value="inactive">비활성</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="목표 달성률 (%)"
                    type="number"
                    placeholder="100"
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Button variant="outlined" fullWidth sx={{ height: 56 }}>
                    담당자 추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>담당자 목록</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  담당자 매핑 테이블에서 관리됩니다. Google Sheets에서 직접 수정하거나<br/>
                  위의 매핑 기능을 통해 자동으로 관리할 수 있습니다.
                </Typography>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>취소</Button>
          <Button onClick={async () => {
            try {
              // 현재 탭에 따른 저장 로직
              if (settingsTab === 0) {
                // Matrix 기준값 저장
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
                await api.saveMonthlyAwardSettings('matrix_criteria', matrixCriteria);
              } else if (settingsTab === 1) {
                // 전략상품 포인트 저장
                const strategicProducts = [
                  { serviceName: '보험(폰교체)', points: parseFloat(document.querySelector('input[label*="보험"]')?.value || 0) },
                  { serviceName: '유플릭스', points: parseFloat(document.querySelector('input[label*="유플릭스"]')?.value || 0) },
                  { serviceName: '통화연결음', points: parseFloat(document.querySelector('input[label*="통화연결음"]')?.value || 0) },
                  { serviceName: '뮤직류', points: parseFloat(document.querySelector('input[label*="뮤직류"]')?.value || 0) }
                ];
                await api.saveMonthlyAwardSettings('strategic_products', strategicProducts);
              } else if (settingsTab === 2) {
                // 업체 매핑 저장
                const companyMappings = [];
                // 업체 매핑 데이터 수집 (실제 구현 시 입력 필드에서 데이터 가져오기)
                await api.saveMonthlyAwardSettings('company_mapping', companyMappings);
              } else if (settingsTab === 3) {
                // 요금제 매핑 저장
                const planMappings = [];
                // 요금제 매핑 데이터 수집 (실제 구현 시 입력 필드에서 데이터 가져오기)
                await api.saveMonthlyAwardSettings('plan_mapping', planMappings);
              } else if (settingsTab === 4) {
                // 담당자 관리 저장
                const managerSettings = [];
                // 담당자 관리 데이터 수집 (실제 구현 시 입력 필드에서 데이터 가져오기)
                await api.saveMonthlyAwardSettings('manager_settings', managerSettings);
              }
              
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