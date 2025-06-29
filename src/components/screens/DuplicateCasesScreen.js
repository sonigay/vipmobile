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
  Alert
} from '@mui/material';
import {
  PhoneAndroid as PhoneAndroidIcon,
  SimCard as SimCardIcon,
  Store as StoreIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

function DuplicateCasesScreen({ data, onBack, onLogout, screenType }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const isPhoneScreen = screenType === 'duplicate_phone';
  const isSimScreen = screenType === 'duplicate_sim';

  // 중복 케이스 분석
  const duplicateCases = useMemo(() => {
    if (!data) return { cases: [], stats: { total: 0, high: 0, medium: 0, low: 0 } };

    const modelMap = new Map();
    const cases = [];

    data.forEach(store => {
      if (!store.inventory) return;

      const targetCategory = isPhoneScreen ? store.inventory.phones : store.inventory.sims;
      if (!targetCategory) return;

      Object.entries(targetCategory).forEach(([model, statusData]) => {
        if (!modelMap.has(model)) {
          modelMap.set(model, []);
        }

        Object.entries(statusData).forEach(([status, colors]) => {
          Object.entries(colors).forEach(([color, qty]) => {
            if (qty > 0) {
              modelMap.get(model).push({
                storeId: store.id,
                storeName: store.name,
                manager: store.manager,
                model,
                color,
                status,
                qty
              });
            }
          });
        });
      });
    });

    // 중복 케이스 찾기
    modelMap.forEach((items, model) => {
      if (items.length > 1) {
        // 같은 모델/색상/상태 조합이 여러 매장에 있는지 확인
        const colorStatusMap = new Map();
        
        items.forEach(item => {
          const key = `${item.color}_${item.status}`;
          if (!colorStatusMap.has(key)) {
            colorStatusMap.set(key, []);
          }
          colorStatusMap.get(key).push(item);
        });

        colorStatusMap.forEach((duplicates, key) => {
          if (duplicates.length > 1) {
            const [color, status] = key.split('_');
            const totalQty = duplicates.reduce((sum, item) => sum + item.qty, 0);
            
            // 중복 심각도 판단
            let severity = 'low';
            if (duplicates.length >= 5) severity = 'high';
            else if (duplicates.length >= 3) severity = 'medium';

            cases.push({
              model,
              color,
              status,
              duplicates,
              totalQty,
              severity,
              storeCount: duplicates.length
            });
          }
        });
      }
    });

    // 통계 계산
    const stats = {
      total: cases.length,
      high: cases.filter(c => c.severity === 'high').length,
      medium: cases.filter(c => c.severity === 'medium').length,
      low: cases.filter(c => c.severity === 'low').length
    };

    return { cases: cases.sort((a, b) => b.storeCount - a.storeCount), stats };
  }, [data, isPhoneScreen]);

  // 필터링된 데이터
  const filteredCases = useMemo(() => {
    let filtered = duplicateCases.cases;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(case_ => 
        case_.model.toLowerCase().includes(term) ||
        case_.color.toLowerCase().includes(term)
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(case_ => case_.severity === filterType);
    }

    return filtered;
  }, [duplicateCases.cases, searchTerm, filterType]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return <CancelIcon />;
      case 'medium': return <WarningIcon />;
      case 'low': return <CheckCircleIcon />;
      default: return <CheckCircleIcon />;
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
          {isPhoneScreen ? <PhoneAndroidIcon sx={{ mr: 2 }} /> : <SimCardIcon sx={{ mr: 2 }} />}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            폰클중복건 - {isPhoneScreen ? '단말기' : '유심'}
          </Typography>
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        {/* 경고 메시지 */}
        {duplicateCases.stats.total > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            총 {duplicateCases.stats.total}개의 중복 케이스가 발견되었습니다. 
            {duplicateCases.stats.high > 0 && ` 높은 심각도: ${duplicateCases.stats.high}개,`}
            {duplicateCases.stats.medium > 0 && ` 중간 심각도: ${duplicateCases.stats.medium}개,`}
            {duplicateCases.stats.low > 0 && ` 낮은 심각도: ${duplicateCases.stats.low}개`}
          </Alert>
        )}

        {/* 통계 카드 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <WarningIcon sx={{ mr: 2, color: 'error.main' }} />
                  <Box>
                    <Typography variant="h4">{duplicateCases.stats.high}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      높은 심각도
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
                    <Typography variant="h4">{duplicateCases.stats.medium}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      중간 심각도
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
                  <CheckCircleIcon sx={{ mr: 2, color: 'info.main' }} />
                  <Box>
                    <Typography variant="h4">{duplicateCases.stats.low}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      낮은 심각도
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
                  <StoreIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h4">{duplicateCases.stats.total}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      총 중복 케이스
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
                label="모델명 또는 색상 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>심각도 필터</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  label="심각도 필터"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="high">높은 심각도</MenuItem>
                  <MenuItem value="medium">중간 심각도</MenuItem>
                  <MenuItem value="low">낮은 심각도</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">
                검색 결과: {filteredCases.length}개 케이스
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* 중복 케이스 테이블 */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 500px)' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>모델명</TableCell>
                  <TableCell>색상</TableCell>
                  <TableCell align="center">상태</TableCell>
                  <TableCell align="center">중복 매장 수</TableCell>
                  <TableCell align="center">총 수량</TableCell>
                  <TableCell align="center">심각도</TableCell>
                  <TableCell>보유 매장</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCases.map((case_, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {case_.model}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={case_.color}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={case_.status}
                        color={
                          case_.status === '정상' ? 'success' :
                          case_.status === '이력' ? 'warning' : 'error'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${case_.storeCount}개`}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {case_.totalQty}개
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={getSeverityIcon(case_.severity)}
                        label={case_.severity === 'high' ? '높음' : case_.severity === 'medium' ? '중간' : '낮음'}
                        color={getSeverityColor(case_.severity)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {case_.duplicates.slice(0, 3).map((item, idx) => (
                          <Chip
                            key={idx}
                            label={item.storeName}
                            size="small"
                            variant="outlined"
                            icon={<StoreIcon />}
                          />
                        ))}
                        {case_.duplicates.length > 3 && (
                          <Chip
                            label={`+${case_.duplicates.length - 3}개`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
}

export default DuplicateCasesScreen; 