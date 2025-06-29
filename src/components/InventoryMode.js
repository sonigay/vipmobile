import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Store as StoreIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Help as HelpIcon,
  SimCard as SimCardIcon,
  PhoneAndroid as PhoneAndroidIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  PersonAdd as PersonAddIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Compare as CompareIcon,
  ExpandMore as ExpandMoreIcon2
} from '@mui/icons-material';
import { fetchData } from '../api';

function InventoryMode({ onLogout, loggedInStore }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMenu, setSelectedMenu] = useState(null);
  
  // 검색 관련 상태
  const [searchType, setSearchType] = useState('store'); // 'store' 또는 'manager'
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState(null);
  
  // 체크박스 선택 관련 상태
  const [selectedStores, setSelectedStores] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const response = await fetchData();
        if (response.success) {
          setData(response.data);
          setFilteredData(response.data);
        } else {
          setError('데이터를 불러오는데 실패했습니다.');
        }
      } catch (error) {
        console.error('데이터 로딩 오류:', error);
        setError('서버 연결에 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // 검색 필터링
  useEffect(() => {
    if (!data) return;

    if (!searchTerm.trim()) {
      setFilteredData(data);
      return;
    }

    const filtered = data.filter(store => {
      const term = searchTerm.toLowerCase();
      
      if (searchType === 'store') {
        return store.name.toLowerCase().includes(term);
      } else if (searchType === 'manager') {
        return store.manager && store.manager.toLowerCase().includes(term);
      }
      
      return false;
    });

    setFilteredData(filtered);
  }, [data, searchTerm, searchType]);

  // 재고 통계 계산
  const calculateStats = () => {
    if (!filteredData) return { totalStores: 0, totalInventory: 0, storesWithInventory: 0 };

    let totalInventory = 0;
    let storesWithInventory = 0;

    filteredData.forEach(store => {
      if (store.inventory) {
        const storeInventory = Object.entries(store.inventory).reduce((sum, [model, colors]) => {
          return sum + Object.values(colors).reduce((modelSum, qty) => modelSum + (qty || 0), 0);
        }, 0);
        
        totalInventory += storeInventory;
        if (storeInventory > 0) {
          storesWithInventory++;
        }
      }
    });

    return {
      totalStores: filteredData.length,
      totalInventory,
      storesWithInventory
    };
  };

  // 매장별 재고 정보 정리
  const getStoreInventorySummary = (store) => {
    if (!store.inventory) return { total: 0, models: [], phones: [], sims: [] };

    const phones = [];
    const sims = [];

    Object.entries(store.inventory).forEach(([model, colors]) => {
      const total = Object.values(colors).reduce((sum, qty) => sum + (qty || 0), 0);
      
      // 모델명으로 단말기와 유심 구분 (임시 로직)
      if (model.toLowerCase().includes('sim') || model.toLowerCase().includes('유심')) {
        sims.push({ model, total, colors });
      } else {
        phones.push({ model, total, colors });
      }
    });

    const total = phones.reduce((sum, item) => sum + item.total, 0) + 
                  sims.reduce((sum, item) => sum + item.total, 0);

    return { total, phones, sims };
  };

  // 매장 상태 판단
  const getStoreStatus = (store) => {
    const inventorySummary = getStoreInventorySummary(store);
    
    if (inventorySummary.total === 0) {
      return { status: '재고없음', color: 'error', icon: <CancelIcon /> };
    } else if (inventorySummary.total > 10) {
      return { status: '재고충분', color: 'success', icon: <CheckCircleIcon /> };
    } else {
      return { status: '재고부족', color: 'warning', icon: <HelpIcon /> };
    }
  };

  // 체크박스 핸들러
  const handleStoreSelect = (storeId) => {
    setSelectedStores(prev => {
      if (prev.includes(storeId)) {
        return prev.filter(id => id !== storeId);
      } else {
        if (prev.length >= 5) {
          alert('최대 5개 매장까지만 선택할 수 있습니다.');
          return prev;
        }
        return [...prev, storeId];
      }
    });
  };

  // 메뉴 핸들러
  const handleMenuClick = (event, menuType) => {
    setAnchorEl(event.currentTarget);
    setSelectedMenu(menuType);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMenu(null);
  };

  const handleSubMenuClick = (subMenu) => {
    console.log(`${selectedMenu} - ${subMenu} 메뉴 클릭`);
    // 여기에 각 서브메뉴별 화면 전환 로직 추가
    handleMenuClose();
  };

  const stats = calculateStats();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <InventoryIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            재고 관리 시스템
          </Typography>
          
          {/* 2차 메뉴 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              color="inherit" 
              onClick={(e) => handleMenuClick(e, 'inventory')}
              endIcon={<ExpandMoreIcon />}
            >
              재고실사
            </Button>
            
            <Button 
              color="inherit" 
              onClick={(e) => handleMenuClick(e, 'master')}
              endIcon={<ExpandMoreIcon />}
            >
              마스터재고매칭
            </Button>
            
            <Button 
              color="inherit" 
              onClick={(e) => handleMenuClick(e, 'duplicate')}
              endIcon={<ExpandMoreIcon />}
            >
              폰클중복건
            </Button>
            
            <Button 
              color="inherit" 
              onClick={(e) => handleMenuClick(e, 'assignment')}
              endIcon={<ExpandMoreIcon />}
            >
              재고배정
            </Button>
          </Box>
          
          <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 드롭다운 메뉴 */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {selectedMenu === 'master' && (
          <>
            <MenuItem onClick={() => handleSubMenuClick('phone')}>
              <ListItemIcon>
                <PhoneAndroidIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>단말기</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleSubMenuClick('sim')}>
              <ListItemIcon>
                <SimCardIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>유심</ListItemText>
            </MenuItem>
          </>
        )}
        
        {selectedMenu === 'duplicate' && (
          <>
            <MenuItem onClick={() => handleSubMenuClick('phone')}>
              <ListItemIcon>
                <PhoneAndroidIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>단말기</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleSubMenuClick('sim')}>
              <ListItemIcon>
                <SimCardIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>유심</ListItemText>
            </MenuItem>
          </>
        )}
        
        {selectedMenu === 'assignment' && (
          <>
            <MenuItem onClick={() => handleSubMenuClick('office')}>
              <ListItemIcon>
                <BusinessIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>사무실배정</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleSubMenuClick('sales')}>
              <ListItemIcon>
                <PersonAddIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>영업사원배정</ListItemText>
            </MenuItem>
          </>
        )}
        
        {selectedMenu === 'inventory' && (
          <MenuItem onClick={() => handleSubMenuClick('inventory')}>
            <ListItemIcon>
              <AssignmentIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>재고실사</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* 메인 콘텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        {/* 검색 및 필터 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>검색 유형</InputLabel>
                <Select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  label="검색 유형"
                >
                  <MenuItem value="store">매장명</MenuItem>
                  <MenuItem value="manager">담당자</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                placeholder={`${searchType === 'store' ? '매장명' : '담당자'}을 입력하세요`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedStores([]);
                    setShowComparison(false);
                  }}
                  size="small"
                >
                  초기화
                </Button>
                {selectedStores.length > 0 && (
                  <Button
                    variant="contained"
                    startIcon={<CompareIcon />}
                    onClick={() => setShowComparison(!showComparison)}
                    size="small"
                  >
                    비교 ({selectedStores.length}/5)
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* 선택된 매장 비교 */}
        {showComparison && selectedStores.length > 0 && (
          <Accordion sx={{ mb: 3 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon2 />}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <CompareIcon sx={{ mr: 1 }} />
                선택된 매장 비교 ({selectedStores.length}개)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {selectedStores.map(storeId => {
                  const store = filteredData?.find(s => s.id === storeId);
                  if (!store) return null;
                  
                  const inventorySummary = getStoreInventorySummary(store);
                  const status = getStoreStatus(store);
                  
                  return (
                    <Grid item xs={12} md={6} lg={4} key={storeId}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {store.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            담당자: {store.manager || '미지정'}
                          </Typography>
                          <Chip
                            icon={status.icon}
                            label={status.status}
                            color={status.color}
                            size="small"
                            sx={{ mb: 1 }}
                          />
                          <Typography variant="body2">
                            총 재고: {inventorySummary.total}개
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            단말기: {inventorySummary.phones.reduce((sum, item) => sum + item.total, 0)}개
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            유심: {inventorySummary.sims.reduce((sum, item) => sum + item.total, 0)}개
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* 통계 카드 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <StoreIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h4">{stats.totalStores}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {searchTerm ? '검색된 매장' : '전체 매장'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <InventoryIcon sx={{ mr: 2, color: 'success.main' }} />
                  <Box>
                    <Typography variant="h4">{stats.totalInventory}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      총 재고량
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <InventoryIcon sx={{ mr: 2, color: 'warning.main' }} />
                  <Box>
                    <Typography variant="h4">{stats.storesWithInventory}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      재고 보유 매장
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 매장 목록 테이블 */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedStores.length > 0 && selectedStores.length < filteredData?.length}
                      checked={selectedStores.length === filteredData?.length && filteredData?.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allIds = filteredData?.map(store => store.id).slice(0, 5) || [];
                          setSelectedStores(allIds);
                        } else {
                          setSelectedStores([]);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>매장명</TableCell>
                  <TableCell>담당자</TableCell>
                  <TableCell align="center">상태</TableCell>
                  <TableCell align="center">총 재고</TableCell>
                  <TableCell>단말기 재고</TableCell>
                  <TableCell>유심 재고</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData?.map((store) => {
                  const inventorySummary = getStoreInventorySummary(store);
                  const status = getStoreStatus(store);
                  const isSelected = selectedStores.includes(store.id);
                  
                  return (
                    <TableRow key={store.id} hover selected={isSelected}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleStoreSelect(store.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <StoreIcon sx={{ mr: 1, fontSize: 20 }} />
                          <Typography variant="body2" fontWeight="medium">
                            {store.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {store.manager ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                            {store.manager}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            미지정
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={status.icon}
                          label={status.status}
                          color={status.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${inventorySummary.total}개`}
                          color={inventorySummary.total > 0 ? 'success' : 'default'}
                          variant={inventorySummary.total > 0 ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {inventorySummary.phones
                            .filter(item => item.total > 0)
                            .map((item) => (
                              <Chip
                                key={item.model}
                                label={`${item.model}: ${item.total}`}
                                size="small"
                                variant="outlined"
                                icon={<PhoneAndroidIcon />}
                              />
                            ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {inventorySummary.sims
                            .filter(item => item.total > 0)
                            .map((item) => (
                              <Chip
                                key={item.model}
                                label={`${item.model}: ${item.total}`}
                                size="small"
                                variant="outlined"
                                icon={<SimCardIcon />}
                              />
                            ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
}

export default InventoryMode; 