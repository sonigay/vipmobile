import React, { useState, useEffect } from 'react';
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
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../api/directStoreApi';

const ProductCard = ({ product, isPremium, onSelect }) => {
  const getCarrierChipColor = (carrier) => {
    switch (carrier) {
      case 'SK': return 'info'; // 하늘색 계열
      case 'KT': return 'success'; // 연두색 계열
      case 'LG': return 'error'; // 핑크/레드 계열
      default: return 'default';
    }
  };

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
      {isPremium && (
        <Box
          sx={{
            position: 'absolute',
            top: -10,
            left: -10,
            zIndex: 1,
            bgcolor: 'primary.main',
            color: 'black',
            px: 2,
            py: 0.5,
            borderRadius: 2,
            fontWeight: 'bold',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
          }}
        >
          BEST
        </Box>
      )}

      <Box sx={{ position: 'relative', pt: '60%', bgcolor: '#FAFAFA', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
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
            p: 2,
            transition: 'transform 0.3s',
            '&:hover': { transform: 'scale(1.05)' }
          }}
        />
      </Box>

      <CardContent sx={{ flexGrow: 1, p: 2 }}>
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

        <Stack spacing={1} sx={{ bgcolor: '#F5F5F5', p: 1.5, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">출고가</Typography>
            <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>
              {product.factoryPrice?.toLocaleString()}원
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1" fontWeight="bold" color="primary">구매가</Typography>
            <Typography variant="h5" fontWeight="bold" color="primary">
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

      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<ShoppingCartIcon />}
          size="large"
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // API 호출
        const data = await directStoreApi.getTodaysMobiles();

        if (data && (data.premium || data.budget)) {
          setPremiumPhones(data.premium || []);
          setBudgetPhones(data.budget || []);
        } else {
          // 데이터가 없을 경우 (초기 상태 등)
          setPremiumPhones([]);
          setBudgetPhones([]);
        }
      } catch (err) {
        console.error('오늘의 휴대폰 데이터 로딩 실패:', err);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        height: '100%',
        overflow: 'auto',
        p: isFullScreen ? 4 : 3,
        bgcolor: 'background.default',
        transition: 'all 0.3s ease'
      }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={3}>
          {/* 프리미엄 휴대폰 섹션 - 3열 */}
          <Grid item xs={12} md={9}>
            <Stack direction="row" alignItems="center" spacing={2} mb={3}>
              <StarIcon sx={{ color: 'primary.main', fontSize: 32 }} />
              <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                프리미엄
              </Typography>
              <Divider sx={{ flexGrow: 1, borderColor: 'rgba(212, 175, 55, 0.3)' }} />
            </Stack>

            <Grid container spacing={3}>
              {displayPremiumPhones.map((product) => (
                <Grid item xs={12} sm={6} md={4} key={product.id}>
                  <ProductCard
                    product={product}
                    isPremium={true}
                    onSelect={onProductSelect}
                  />
                </Grid>
              ))}
              {displayPremiumPhones.length === 0 && (
                <Grid item xs={12}>
                  <Typography color="text.secondary" align="center">등록된 프리미엄 휴대폰이 없습니다.</Typography>
                </Grid>
              )}
            </Grid>
          </Grid>

          {/* 실속형 휴대폰 섹션 - 1열 */}
          <Grid item xs={12} md={3}>
            <Stack direction="row" alignItems="center" spacing={2} mb={3}>
              <LocalOfferIcon sx={{ color: 'secondary.main', fontSize: 32 }} />
              <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                실속형
              </Typography>
            </Stack>

            <Grid container spacing={3}>
              {displayBudgetPhones.map((product) => (
                <Grid item xs={12} key={product.id}>
                  <ProductCard
                    product={product}
                    isPremium={false}
                    onSelect={onProductSelect}
                  />
                </Grid>
              ))}
              {displayBudgetPhones.length === 0 && (
                <Grid item xs={12}>
                  <Typography color="text.secondary" align="center">등록된 실속형 휴대폰이 없습니다.</Typography>
                </Grid>
              )}
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default TodaysMobileTab;
