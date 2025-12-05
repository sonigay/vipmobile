import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Stack,
  Button,
  Container,
  CardActions,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../api/directStoreApi';

const ProductCard = ({ product, isPremium, onSelect, compact }) => {
  const getCarrierChipColor = (carrier) => {
    switch (carrier) {
      case 'SK': return 'info'; // 하늘색 계열
      case 'KT': return 'success'; // 연두색 계열
      case 'LG': return 'error'; // 핑크/레드 계열
      default: return 'default';
    }
  };

  const tagChips = [];
  if (product.isPremium) tagChips.push({ label: '프리미엄', color: 'primary' });
  if (product.isBudget) tagChips.push({ label: '중저가', color: 'secondary' });
  if (product.isPopular) tagChips.push({ label: '인기', color: 'warning' });
  if (product.isRecommended) tagChips.push({ label: '추천', color: 'success' });
  if (product.isCheap) tagChips.push({ label: '저렴', color: 'info' });

  return (
    <Card
      sx={{
        height: 'auto',  // 내용에 맞게 자동 높이
        minHeight: compact ? 380 : 420,  // 최소 높이만 설정
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'visible',
        cursor: 'pointer',
        transition: 'transform 0.2s',
        '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 }
      }}
      onClick={() => onSelect(product)}
    >
      {tagChips.length > 0 && (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 1
          }}
        >
          {tagChips.map((chip) => (
            <Chip
              key={chip.label}
              label={chip.label}
              color={chip.color}
              size="small"
              sx={{ fontWeight: 'bold', boxShadow: 3 }}
            />
          ))}
        </Stack>
      )}

      <Box sx={{ 
        position: 'relative', 
        pt: compact ? '50%' : '60%',  // 이미지 영역 비율 조정 (사진이 잘리지 않도록)
        minHeight: compact ? 120 : 150,  // 최소 높이 설정
        bgcolor: '#FAFAFA', 
        borderRadius: '16px 16px 0 0', 
        overflow: 'hidden' 
      }}>
        <CardMedia
          component="img"
          image={product.image || 'https://via.placeholder.com/300x300?text=No+Image'}
          alt={product.petName}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',  // contain으로 설정하여 이미지가 잘리지 않도록
            p: compact ? 1.5 : 2,
            transition: 'transform 0.3s',
            '&:hover': { transform: 'scale(1.05)' }
          }}
        />
      </Box>

      <CardContent sx={{ flexGrow: 1, p: compact ? 1.5 : 2 }}>
        <Stack direction="row" spacing={1} mb={1}>
          <Chip
            label={product.carrier}
            color={getCarrierChipColor(product.carrier)}
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center' }}>
            {product.model}
          </Typography>
        </Stack>

        <Typography variant="h6" component="div" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          {product.petName}
        </Typography>

        <Stack spacing={1} sx={{ bgcolor: '#F5F5F5', p: compact ? 1 : 1.5, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">출고가</Typography>
            <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>
              {product.factoryPrice?.toLocaleString()}원
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1" fontWeight="bold" color="primary">구매가</Typography>
            <Typography variant={compact ? 'h6' : 'h5'} fontWeight="bold" color="primary">
              {(product.purchasePrice || product.purchasePriceWithAddon || product.purchasePriceWithoutAddon)?.toLocaleString()}원
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            * 필수부가: {product.addons || product.requiredAddons || '없음'}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ p: compact ? 1.5 : 2, pt: compact ? 0 : 0 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<ShoppingCartIcon />}
          size={compact ? 'medium' : 'large'}
          sx={{ borderRadius: 2 }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(product);
          }}
        >
          구매하기
        </Button>
      </CardActions>
    </Card>
  );
};

const TodaysMobileTab = ({ isFullScreen, onProductSelect }) => {
  const [premiumPhones, setPremiumPhones] = useState([]);
  const [budgetPhones, setBudgetPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [compact, setCompact] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await directStoreApi.getTodaysMobiles();

      if (data && (data.premium || data.budget)) {
        setPremiumPhones(data.premium || []);
        setBudgetPhones(data.budget || []);
      } else {
        setPremiumPhones([]);
        setBudgetPhones([]);
      }
    } catch (err) {
      console.error('오늘의 휴대폰 데이터 로딩 실패:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
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

  // 프리미엄과 중저가를 하나의 배열로 합치기 (프리미엄 먼저, 중저가 나중에)
  const displayPremiumPhones = premiumPhones.slice(0, 6);
  const displayBudgetPhones = budgetPhones.slice(0, 3);
  const allProducts = [...displayPremiumPhones, ...displayBudgetPhones];

  return (
    <Box
      sx={{
        height: isFullScreen ? '100vh' : 'calc(100vh - 64px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        p: isFullScreen ? (compact ? 1 : 1.5) : (compact ? 1.5 : 2),
        bgcolor: 'background.default',
        transition: 'all 0.3s ease'
      }}
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%', maxWidth: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={compact ? 1.5 : 2}>
          <Typography variant="h6" fontWeight="bold">오늘의 휴대폰</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
              disabled={loading}
            >
              새로고침
            </Button>
            <Button
              variant={compact ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setCompact(prev => !prev)}
              sx={{ minWidth: 100 }}
            >
              {compact ? '컴팩트' : '넉넉하게'}
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: compact ? (isFullScreen ? 1 : 1.5) : (isFullScreen ? 1.5 : 2),
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',   // 모바일: 2열
              sm: 'repeat(3, 1fr)',    // 태블릿: 3열
              md: 'repeat(4, 1fr)',    // 작은 PC: 4열
              lg: 'repeat(5, 1fr)',    // 큰 PC: 5열
              xl: 'repeat(6, 1fr)'     // 초대형: 6열
            },
            gridAutoRows: 'auto',  // 내용에 맞게 자동 높이 조정 (행 수 제한 없음)
            alignContent: 'start',
            alignItems: 'stretch',  // 카드들이 같은 높이를 가지도록 (하지만 autoRows로 인해 내용에 맞게 조정됨)
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '3px' }
          }}
        >
          {allProducts.map((product) => {
            // 프리미엄인지 중저가인지 태그로 판단
            const isPremium = product.isPremium || false;
            return (
              <ProductCard
                key={product.id}
                product={product}
                isPremium={isPremium}
                onSelect={onProductSelect}
                compact={compact}
              />
            );
          })}
          {allProducts.length === 0 && (
            <Box sx={{ gridColumn: '1 / -1', gridRow: '1 / -1' }}>
              <Typography color="text.secondary" align="center" py={4}>
                등록된 휴대폰이 없습니다.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default TodaysMobileTab;
