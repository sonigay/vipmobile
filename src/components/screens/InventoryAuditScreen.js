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
  MenuItem
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Store as StoreIcon,
  Phone as PhoneIcon,
  SimCard as SimCardIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

function InventoryAuditScreen({ data, onBack, onLogout, screenType }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // 재고실사 통계 계산
  const auditStats = useMemo(() => {
    if (!data) return { total: 0, normal: 0, history: 0, defective: 0, noInventory: 0 };

    let stats = { total: 0, normal: 0, history: 0, defective: 0, noInventory: 0 };

    data.forEach(store => {
      stats.total++;
      
      if (!store.inventory || Object.keys(store.inventory).length === 0) {
        stats.noInventory++;
        return;
      }

      let hasNormal = false;
      let hasHistory = false;
      let hasDefective = false;

      Object.values(store.inventory).forEach(category => {
        Object.values(category).forEach(model => {
          Object.entries(model).forEach(([status, colors]) => {
            const qty = Object.values(colors).reduce((sum, val) => sum + (val || 0), 0);
            if (qty > 0) {
              if (status === '정상') hasNormal = true;
              else if (status === '이력') hasHistory = true;
              else if (status === '불량') hasDefective = true;
            }
          });
        });
      });

      if (hasNormal) stats.normal++;
      if (hasHistory) stats.history++;
      if (hasDefective) stats.defective++;
    });

    return stats;
  }, [data]);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    if (!data) return [];

    return data.filter(store => {
      const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (store.manager && store.manager.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterType === 'all') return true;

      if (!store.inventory || Object.keys(store.inventory).length === 0) {
        return filterType === 'noInventory';
      }

      let hasNormal = false;
      let hasHistory = false;
      let hasDefective = false;

      Object.values(store.inventory).forEach(category => {
        Object.values(category).forEach(model => {
          Object.entries(model).forEach(([status, colors]) => {
            const qty = Object.values(colors).reduce((sum, val) => sum + (val || 0), 0);
            if (qty > 0) {
              if (status === '정상') hasNormal = true;
              else if (status === '이력') hasHistory = true;
              else if (status === '불량') hasDefective = true;
            }
          });
        });
      });

      switch (filterType) {
        case 'normal': return hasNormal;
        case 'history': return hasHistory;
        case 'defective': return hasDefective;
        default: return true;
      }
    });
  }, [data, searchTerm, filterType]);

  // 매장 상태 판단
  const getStoreStatus = (store) => {
    if (!store.inventory || Object.keys(store.inventory).length === 0) {
      return { status: '재고없음', color: 'error', icon: <CancelIcon /> };
    }

    let hasNormal = false;
    let hasHistory = false;
    let hasDefective = false;

    Object.values(store.inventory).forEach(category => {
      Object.values(category).forEach(model => {
        Object.entries(model).forEach(([status, colors]) => {
          const qty = Object.values(colors).reduce((sum, val) => sum + (val || 0), 0);
          if (qty > 0) {
            if (status === '정상') hasNormal = true;
            else if (status === '이력') hasHistory = true;
            else if (status === '불량') hasDefective = true;
          }
        });
      });
    });

    if (hasDefective) {
      return { status: '불량재고', color: 'error', icon: <WarningIcon /> };
    } else if (hasNormal) {
      return { status: '정상재고', color: 'success', icon: <CheckCircleIcon /> };
    } else if (hasHistory) {
      return { status: '이력재고', color: 'warning', icon: <WarningIcon /> };
    } else {
      return { status: '재고없음', color: 'error', icon: <CancelIcon /> };
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={onBack} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <AssignmentIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            재고실사
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
          <Grid item xs={12} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <StoreIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h4">{auditStats.total}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      전체 매장
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircleIcon sx={{ mr: 2, color: 'success.main' }} />
                  <Box>
                    <Typography variant="h4">{auditStats.normal}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      정상재고
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <WarningIcon sx={{ mr: 2, color: 'warning.main' }} />
                  <Box>
                    <Typography variant="h4">{auditStats.history}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      이력재고
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CancelIcon sx={{ mr: 2, color: 'error.main' }} />
                  <Box>
                    <Typography variant="h4">{auditStats.defective}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      불량재고
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CancelIcon sx={{ mr: 2, color: 'grey.main' }} />
                  <Box>
                    <Typography variant="h4">{auditStats.noInventory}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      재고없음
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 검색 및 필터 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="매장명 또는 담당자 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>상태 필터</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  label="상태 필터"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="normal">정상재고</MenuItem>
                  <MenuItem value="history">이력재고</MenuItem>
                  <MenuItem value="defective">불량재고</MenuItem>
                  <MenuItem value="noInventory">재고없음</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">
                검색 결과: {filteredData.length}개 매장
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* 매장 목록 테이블 */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>매장명</TableCell>
                  <TableCell>담당자</TableCell>
                  <TableCell align="center">상태</TableCell>
                  <TableCell>연락처</TableCell>
                  <TableCell>주소</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map((store) => {
                  const status = getStoreStatus(store);
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
                        <Typography variant="body2">
                          {store.manager || '미지정'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={status.icon}
                          label={status.status}
                          color={status.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {store.phone || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200 }}>
                          {store.address || '-'}
                        </Typography>
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

export default InventoryAuditScreen; 