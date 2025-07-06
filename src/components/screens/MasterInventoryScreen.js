import React, { useState, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import {
  PhoneAndroid as PhoneAndroidIcon,
  SimCard as SimCardIcon,
  Store as StoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

function MasterInventoryScreen({ data, onBack, onLogout, screenType }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);

  // 화면 타입에 따른 탭 설정
  const isPhoneScreen = screenType === 'master_phone';
  const isSimScreen = screenType === 'master_sim';

  // 마스터 재고 데이터 계산
  const masterInventory = useMemo(() => {
    if (!data) return { phones: {}, sims: {} };

    const master = { phones: {}, sims: {} };

    data.forEach(store => {
      if (!store.inventory) return;

      // 단말기 재고
      if (store.inventory.phones) {
        Object.entries(store.inventory.phones).forEach(([model, statusData]) => {
          if (!master.phones[model]) {
            master.phones[model] = { total: 0, stores: [], normal: 0, history: 0, defective: 0 };
          }

          Object.entries(statusData).forEach(([status, colors]) => {
            const qty = Object.values(colors).reduce((sum, val) => {
              // val이 객체인 경우 quantity 필드 확인
              if (typeof val === 'object' && val !== null && val.quantity !== undefined) {
                return sum + (val.quantity || 0);
              } else if (typeof val === 'number') {
                return sum + (val || 0);
              }
              return sum;
            }, 0);
            master.phones[model].total += qty;
            
            if (status === '정상') master.phones[model].normal += qty;
            else if (status === '이력') master.phones[model].history += qty;
            else if (status === '불량') master.phones[model].defective += qty;

            if (qty > 0) {
              master.phones[model].stores.push({
                storeName: store.name,
                storeId: store.id,
                status,
                qty,
                colors: Object.keys(colors).filter(color => colors[color] > 0)
              });
            }
          });
        });
      }

      // 유심 재고
      if (store.inventory.sims) {
        Object.entries(store.inventory.sims).forEach(([model, statusData]) => {
          if (!master.sims[model]) {
            master.sims[model] = { total: 0, stores: [], normal: 0, history: 0, defective: 0 };
          }

          Object.entries(statusData).forEach(([status, colors]) => {
            const qty = Object.values(colors).reduce((sum, val) => {
              // val이 객체인 경우 quantity 필드 확인
              if (typeof val === 'object' && val !== null && val.quantity !== undefined) {
                return sum + (val.quantity || 0);
              } else if (typeof val === 'number') {
                return sum + (val || 0);
              }
              return sum;
            }, 0);
            master.sims[model].total += qty;
            
            if (status === '정상') master.sims[model].normal += qty;
            else if (status === '이력') master.sims[model].history += qty;
            else if (status === '불량') master.sims[model].defective += qty;

            if (qty > 0) {
              master.sims[model].stores.push({
                storeName: store.name,
                storeId: store.id,
                status,
                qty,
                colors: Object.keys(colors).filter(color => colors[color] > 0)
              });
            }
          });
        });
      }
    });

    return master;
  }, [data]);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    const targetData = isPhoneScreen ? masterInventory.phones : masterInventory.sims;
    
    if (!searchTerm.trim()) {
      return Object.entries(targetData).sort(([,a], [,b]) => b.total - a.total);
    }

    const term = searchTerm.toLowerCase();
    return Object.entries(targetData)
      .filter(([model]) => model.toLowerCase().includes(term))
      .sort(([,a], [,b]) => b.total - a.total);
  }, [masterInventory, searchTerm, isPhoneScreen]);

  // 통계 계산
  const stats = useMemo(() => {
    const targetData = isPhoneScreen ? masterInventory.phones : masterInventory.sims;
    
    let totalModels = 0;
    let totalQuantity = 0;
    let totalStores = 0;

    Object.values(targetData).forEach(model => {
      totalModels++;
      totalQuantity += model.total;
      totalStores += model.stores.length;
    });

    return { totalModels, totalQuantity, totalStores };
  }, [masterInventory, isPhoneScreen]);

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={onBack} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          {isPhoneScreen ? <PhoneAndroidIcon sx={{ mr: 2 }} /> : <SimCardIcon sx={{ mr: 2 }} />}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            마스터재고매칭 - {isPhoneScreen ? '단말기' : '유심'}
          </Typography>
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        {/* 통계 카드 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {isPhoneScreen ? <PhoneAndroidIcon sx={{ mr: 2, color: 'primary.main' }} /> : <SimCardIcon sx={{ mr: 2, color: 'primary.main' }} />}
                  <Box>
                    <Typography variant="h4">{stats.totalModels}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {isPhoneScreen ? '단말기' : '유심'} 모델 수
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
                  <StoreIcon sx={{ mr: 2, color: 'success.main' }} />
                  <Box>
                    <Typography variant="h4">{stats.totalStores}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      보유 매장 수
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
                  <CheckCircleIcon sx={{ mr: 2, color: 'warning.main' }} />
                  <Box>
                    <Typography variant="h4">{stats.totalQuantity}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      총 재고 수량
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 검색 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={`${isPhoneScreen ? '단말기' : '유심'} 모델명 검색`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                검색 결과: {filteredData.length}개 모델
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* 탭 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={selectedTab} onChange={handleTabChange} centered>
            <Tab label="모델별 요약" />
            <Tab label="상세 정보" />
          </Tabs>
        </Paper>

        {/* 모델별 요약 탭 */}
        {selectedTab === 0 && (
          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 500px)' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>모델명</TableCell>
                    <TableCell align="center">총 재고</TableCell>
                    <TableCell align="center">정상</TableCell>
                    <TableCell align="center">이력</TableCell>
                    <TableCell align="center">불량</TableCell>
                    <TableCell align="center">보유 매장</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredData.map(([model, info]) => (
                    <TableRow key={model} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {model}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${info.total}개`}
                          color={info.total > 0 ? 'primary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${info.normal}개`}
                          color={info.normal > 0 ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${info.history}개`}
                          color={info.history > 0 ? 'warning' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${info.defective}개`}
                          color={info.defective > 0 ? 'error' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${info.stores.length}개`}
                          color="info"
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* 상세 정보 탭 */}
        {selectedTab === 1 && (
          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 500px)' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>모델명</TableCell>
                    <TableCell>매장명</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="center">수량</TableCell>
                    <TableCell>색상</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredData.flatMap(([model, info]) =>
                    info.stores.map((store, index) => (
                      <TableRow key={`${model}-${store.storeId}-${index}`} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {model}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <StoreIcon sx={{ mr: 1, fontSize: 16 }} />
                            <Typography variant="body2">
                              {store.storeName}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={store.status}
                            color={
                              store.status === '정상' ? 'success' :
                              store.status === '이력' ? 'warning' : 'error'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">
                            {store.qty}개
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {store.colors.map((color, colorIndex) => (
                              <Chip
                                key={colorIndex}
                                label={color}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Box>
    </Box>
  );
}

export default MasterInventoryScreen; 