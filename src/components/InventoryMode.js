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
  Divider
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Store as StoreIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { fetchData } from '../api';

function InventoryMode({ onLogout, loggedInStore }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const response = await fetchData();
        if (response.success) {
          setData(response.data);
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

  // 재고 통계 계산
  const calculateStats = () => {
    if (!data) return { totalStores: 0, totalInventory: 0, storesWithInventory: 0 };

    let totalInventory = 0;
    let storesWithInventory = 0;

    data.forEach(store => {
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
      totalStores: data.length,
      totalInventory,
      storesWithInventory
    };
  };

  // 매장별 재고 정보 정리
  const getStoreInventorySummary = (store) => {
    if (!store.inventory) return { total: 0, models: [] };

    const models = Object.entries(store.inventory).map(([model, colors]) => {
      const total = Object.values(colors).reduce((sum, qty) => sum + (qty || 0), 0);
      return { model, total, colors };
    });

    const total = models.reduce((sum, item) => sum + item.total, 0);

    return { total, models };
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
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 콘텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
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
                      전체 매장
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
          <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>매장명</TableCell>
                  <TableCell>담당자</TableCell>
                  <TableCell>연락처</TableCell>
                  <TableCell>주소</TableCell>
                  <TableCell align="center">총 재고</TableCell>
                  <TableCell>모델별 재고</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((store) => {
                  const inventorySummary = getStoreInventorySummary(store);
                  
                  return (
                    <TableRow key={store.id} hover>
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
                      <TableCell>
                        {store.phone ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PhoneIcon sx={{ mr: 1, fontSize: 16 }} />
                            {store.phone}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {store.address ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <LocationIcon sx={{ mr: 1, fontSize: 16 }} />
                            <Typography variant="body2" sx={{ maxWidth: 200 }}>
                              {store.address}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
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
                          {inventorySummary.models
                            .filter(item => item.total > 0)
                            .map((item) => (
                              <Chip
                                key={item.model}
                                label={`${item.model}: ${item.total}`}
                                size="small"
                                variant="outlined"
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