import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  LocalShipping as ShippingIcon,
  Warning as WarningIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  FlashOn as FlashOnIcon,
  AccessTime as AccessTimeIcon,
  SlowMotionVideo as SlowMotionIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { api } from '../api';

const EstimatedQuickCost = ({ fromStoreId, toStoreId, fromStoreName, toStoreName, refreshKey }) => {
  const [estimatedData, setEstimatedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [speedFilter, setSpeedFilter] = useState('all');
  const [favorites, setFavorites] = useState([]);

  // 즐겨찾기 로드
  useEffect(() => {
    const savedFavorites = localStorage.getItem('quick-cost-favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('즐겨찾기 로드 실패:', e);
      }
    }
  }, []);

  // 예상퀵비 조회
  useEffect(() => {
    if (!fromStoreId || !toStoreId) {
      setEstimatedData([]);
      setError(null);
      return;
    }

    // 매장이 변경되면 이전 데이터 초기화
    setEstimatedData([]);
    setError(null);
    setLoading(true);

    const fetchEstimatedCost = async () => {
      try {
        // refreshKey가 0보다 클 때만 캐시를 무시하고 새로 조회 (초기값 0은 캐시 사용)
        // fromStoreId나 toStoreId가 변경되면 캐시 키가 달라지므로 자동으로 새로 조회됨
        const skipCache = refreshKey !== undefined && refreshKey !== null && refreshKey > 0;
        const result = await api.getEstimatedQuickCost(fromStoreId, toStoreId, skipCache);
        if (result.success) {
          setEstimatedData(result.data || []);
        } else {
          setError(result.error || '예상퀵비 조회에 실패했습니다.');
        }
      } catch (err) {
        console.error('예상퀵비 조회 오류:', err);
        setError(err.message || '예상퀵비 조회에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchEstimatedCost();
  }, [fromStoreId, toStoreId, refreshKey]);

  // 즐겨찾기 토글
  const toggleFavorite = (companyName, phoneNumber) => {
    const key = `${companyName}-${phoneNumber}`;
    const newFavorites = favorites.includes(key)
      ? favorites.filter(f => f !== key)
      : [...favorites, key];
    
    setFavorites(newFavorites);
    localStorage.setItem('quick-cost-favorites', JSON.stringify(newFavorites));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('quick-cost-favorites-changed', {
        detail: { favorites: newFavorites }
      }));
    }
  };

  // 속도 아이콘 및 색상
  const getSpeedIcon = (speed) => {
    switch (speed) {
      case '빠름':
        return <FlashOnIcon sx={{ color: '#4CAF50', fontSize: '1.2rem' }} />;
      case '중간':
        return <AccessTimeIcon sx={{ color: '#FFC107', fontSize: '1.2rem' }} />;
      case '느림':
        return <SlowMotionIcon sx={{ color: '#F44336', fontSize: '1.2rem' }} />;
      default:
        return <AccessTimeIcon sx={{ color: '#9E9E9E', fontSize: '1.2rem' }} />;
    }
  };

  // 필터링된 데이터
  const filteredData = estimatedData.filter(item => {
    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!item.companyName.toLowerCase().includes(query) &&
          !item.phoneNumber.includes(query)) {
        return false;
      }
    }

    // 속도 필터
    if (speedFilter !== 'all') {
      if (speedFilter === 'fast') {
        const isFast = [item.dispatchSpeed, item.pickupSpeed, item.arrivalSpeed].some(speed => speed === '빠름');
        if (!isFast) return false;
      }
    }

    return true;
  });

  // 즐겨찾기 우선 정렬
  const sortedData = [...filteredData].sort((a, b) => {
    const aKey = `${a.companyName}-${a.phoneNumber}`;
    const bKey = `${b.companyName}-${b.phoneNumber}`;
    const aIsFavorite = favorites.includes(aKey);
    const bIsFavorite = favorites.includes(bKey);
    
    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;
    return a.averageCost - b.averageCost; // 가격 순
  });

  let bodyContent = null;

  if (loading) {
    bodyContent = (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  } else if (error) {
    bodyContent = (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  } else {
    bodyContent = (
      <>
        {/* 검색 및 필터 */}
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                placeholder="업체명 또는 전화번호 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>속도</InputLabel>
                <Select
                  value={speedFilter}
                  label="속도"
                  onChange={(e) => setSpeedFilter(e.target.value)}
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="fast">빠름만</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {/* 업체 목록 */}
        {sortedData.length === 0 ? (
          <Alert severity="info" sx={{ m: 2 }}>
            등록된 퀵비용 정보가 없습니다.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {sortedData.map((item, index) => {
              const isFavorite = favorites.includes(`${item.companyName}-${item.phoneNumber}`);
              const isFirst = index === 0;

              return (
                <Card
                  key={`${item.companyName}-${item.phoneNumber}`}
                  sx={{
                    border: isFirst ? '2px solid #4CAF50' : '1px solid #e0e0e0',
                    backgroundColor: isFirst ? '#f1f8e9' : 'white',
                    position: 'relative'
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        {isFirst && (
                          <Chip
                            label="1순위"
                            color="success"
                            size="small"
                            sx={{ mb: 1, fontWeight: 'bold' }}
                          />
                        )}
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {item.companyName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {item.phoneNumber}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => toggleFavorite(item.companyName, item.phoneNumber)}
                        sx={{ color: isFavorite ? '#FFC107' : '#9E9E9E' }}
                      >
                        {isFavorite ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                        {item.averageCost.toLocaleString()}원
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ({item.entryCount}건)
                      </Typography>
                      {item.hasOutliers && (
                        <Tooltip title={`이상치 데이터 ${item.outlierCount}건 포함`}>
                          <WarningIcon sx={{ color: '#FF9800', fontSize: '1.2rem' }} />
                        </Tooltip>
                      )}
                    </Box>

                    {/* 서비스 품질 정보 */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getSpeedIcon(item.dispatchSpeed)}
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          배차: {item.dispatchSpeed}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getSpeedIcon(item.pickupSpeed)}
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          픽업: {item.pickupSpeed}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getSpeedIcon(item.arrivalSpeed)}
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          도착: {item.arrivalSpeed}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: collapsed ? 0 : 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          예상 퀵비용
        </Typography>
        <IconButton size="small" onClick={() => setCollapsed(prev => !prev)}>
          {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Box>
      {!collapsed && bodyContent}
    </Box>
  );
};

export default EstimatedQuickCost;

