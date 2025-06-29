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
  Business as BusinessIcon,
  PersonAdd as PersonAddIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

function InventoryAssignmentScreen({ data, onBack, onLogout, screenType }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);

  const isOfficeScreen = screenType === 'assignment_office';
  const isSalesScreen = screenType === 'assignment_sales';

  // 배정 데이터 분석
  const assignmentData = useMemo(() => {
    if (!data) return { 
      office: { total: 0, assigned: 0, unassigned: 0, stores: [] },
      sales: { total: 0, assigned: 0, unassigned: 0, stores: [] }
    };

    const office = { total: 0, assigned: 0, unassigned: 0, stores: [] };
    const sales = { total: 0, assigned: 0, unassigned: 0, stores: [] };

    data.forEach(store => {
      const hasInventory = store.inventory && Object.keys(store.inventory).length > 0;
      const hasManager = store.manager && store.manager.trim() !== '';

      // 사무실 배정 분석
      office.total++;
      if (hasInventory) {
        if (hasManager) {
          office.assigned++;
        } else {
          office.unassigned++;
        }
        office.stores.push({
          ...store,
          assignmentType: hasManager ? 'assigned' : 'unassigned'
        });
      }

      // 영업사원 배정 분석
      sales.total++;
      if (hasInventory) {
        if (hasManager) {
          sales.assigned++;
        } else {
          sales.unassigned++;
        }
        sales.stores.push({
          ...store,
          assignmentType: hasManager ? 'assigned' : 'unassigned'
        });
      }
    });

    return { office, sales };
  }, [data]);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    const targetData = isOfficeScreen ? assignmentData.office : assignmentData.sales;
    
    if (!searchTerm.trim()) {
      return targetData.stores;
    }

    const term = searchTerm.toLowerCase();
    return targetData.stores.filter(store => 
      store.name.toLowerCase().includes(term) ||
      (store.manager && store.manager.toLowerCase().includes(term))
    );
  }, [assignmentData, searchTerm, isOfficeScreen]);

  // 통계 계산
  const stats = useMemo(() => {
    const targetData = isOfficeScreen ? assignmentData.office : assignmentData.sales;
    return {
      total: targetData.total,
      assigned: targetData.assigned,
      unassigned: targetData.unassigned,
      assignmentRate: targetData.total > 0 ? Math.round((targetData.assigned / targetData.total) * 100) : 0
    };
  }, [assignmentData, isOfficeScreen]);

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  const getAssignmentStatus = (store) => {
    if (!store.manager || store.manager.trim() === '') {
      return { status: '미배정', color: 'error', icon: <WarningIcon /> };
    }
    return { status: '배정완료', color: 'success', icon: <CheckCircleIcon /> };
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={onBack} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          {isOfficeScreen ? <BusinessIcon sx={{ mr: 2 }} /> : <PersonAddIcon sx={{ mr: 2 }} />}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            재고배정 - {isOfficeScreen ? '사무실배정' : '영업사원배정'}
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
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <StoreIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h4">{stats.total}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      전체 매장
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircleIcon sx={{ mr: 2, color: 'success.main' }} />
                  <Box>
                    <Typography variant="h4">{stats.assigned}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      배정완료
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <WarningIcon sx={{ mr: 2, color: 'warning.main' }} />
                  <Box>
                    <Typography variant="h4">{stats.unassigned}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      미배정
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AssignmentIcon sx={{ mr: 2, color: 'info.main' }} />
                  <Box>
                    <Typography variant="h4">{stats.assignmentRate}%</Typography>
                    <Typography variant="body2" color="text.secondary">
                      배정률
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
                label="매장명 또는 담당자 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                검색 결과: {filteredData.length}개 매장
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* 탭 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={selectedTab} onChange={handleTabChange} centered>
            <Tab label="전체 매장" />
            <Tab label="배정완료" />
            <Tab label="미배정" />
          </Tabs>
        </Paper>

        {/* 매장 목록 테이블 */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 500px)' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>매장명</TableCell>
                  <TableCell>담당자</TableCell>
                  <TableCell align="center">배정상태</TableCell>
                  <TableCell>연락처</TableCell>
                  <TableCell>주소</TableCell>
                  <TableCell align="center">재고수량</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData
                  .filter(store => {
                    if (selectedTab === 0) return true; // 전체
                    if (selectedTab === 1) return store.assignmentType === 'assigned'; // 배정완료
                    if (selectedTab === 2) return store.assignmentType === 'unassigned'; // 미배정
                    return true;
                  })
                  .map((store) => {
                    const status = getAssignmentStatus(store);
                    const inventoryCount = store.inventory ? 
                      Object.values(store.inventory).reduce((total, category) => {
                        return total + Object.values(category).reduce((catTotal, model) => {
                          return catTotal + Object.values(model).reduce((modelTotal, status) => {
                            return modelTotal + Object.values(status).reduce((statusTotal, qty) => statusTotal + (qty || 0), 0);
                          }, 0);
                        }, 0);
                      }, 0) : 0;

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
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                            <Typography variant="body2">
                              {store.manager || '미지정'}
                            </Typography>
                          </Box>
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
                        <TableCell align="center">
                          <Chip
                            label={`${inventoryCount}개`}
                            color={inventoryCount > 0 ? 'primary' : 'default'}
                            size="small"
                            variant="outlined"
                          />
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

export default InventoryAssignmentScreen; 