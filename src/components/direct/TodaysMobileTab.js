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
  Divider,
  CardActions,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Star as StarIcon,
  LocalOffer as LocalOfferIcon,
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
        height: '100%',
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

      <Box sx={{ position: 'relative', pt: compact ? '48%' : '56%', bgcolor: '#FAFAFA', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
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
            objectFit: 'contain',
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

  // 프리미엄: 최대 6개 (3열 x 2행)
  const displayPremiumPhones = premiumPhones.slice(0, 6);
  // 실속형: 최대 2개 (1열 x 2행)
  const displayBudgetPhones = budgetPhones.slice(0, 2);

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 40px)',
        maxHeight: '100vh',
        overflow: 'hidden',
        p: isFullScreen ? 2 : 2.5,
        bgcolor: 'background.default',
        transition: 'all 0.3s ease'
      }}
    >
      <Container maxWidth="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
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
            <Chip
              label={compact ? '컴팩트' : '넉넉하게'}
              color="primary"
              variant="outlined"
              onClick={() => setCompact(prev => !prev)}
              sx={{ cursor: 'pointer' }}
            />
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: isFullScreen ? 2.5 : 2,
            gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
            height: 'calc(100vh - 120px)',
            overflow: 'hidden'
          }}
        >
          {/* 프리미엄 섹션 */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={2} mb={2}>
              <StarIcon sx={{ color: 'primary.main', fontSize: 28 }} />
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                프리미엄
              </Typography>
              <Divider sx={{ flexGrow: 1, borderColor: 'rgba(212, 175, 55, 0.3)' }} />
            </Stack>

          <Box
            sx={{
              display: 'grid',
              gap: isFullScreen ? 2.5 : 2,
              gridTemplateColumns: {
                xs: 'repeat(auto-fit, minmax(220px, 1fr))',
                sm: 'repeat(auto-fit, minmax(230px, 1fr))',
                md: 'repeat(auto-fit, minmax(240px, 1fr))'
              },
              alignContent: 'start',
              gridAutoRows: '1fr',
              overflow: 'hidden'
            }}
          >
              {displayPremiumPhones.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isPremium={true}
                  onSelect={onProductSelect}
                />
              ))}
              {displayPremiumPhones.length === 0 && (
                <Typography color="text.secondary" align="center">등록된 프리미엄 휴대폰이 없습니다.</Typography>
              )}
            </Box>
          </Box>

          {/* 중저가 섹션 */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={2} mb={2}>
              <LocalOfferIcon sx={{ color: 'secondary.main', fontSize: 28 }} />
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                중저가
              </Typography>
              <Divider sx={{ flexGrow: 1, borderColor: 'rgba(0,0,0,0.08)' }} />
            </Stack>

          <Box
            sx={{
              display: 'grid',
              gap: isFullScreen ? 2.5 : 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr'
              },
              gridAutoRows: '1fr',
              alignContent: 'start',
              overflow: 'hidden'
            }}
          >
              {displayBudgetPhones.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isPremium={false}
                  onSelect={onProductSelect}
                />
              ))}
              {displayBudgetPhones.length === 0 && (
                <Typography color="text.secondary" align="center">등록된 중저가 휴대폰이 없습니다.</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default TodaysMobileTab;
