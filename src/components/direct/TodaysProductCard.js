/**
 * 오늘의 휴대폰 ProductCard 컴포넌트
 * TodaysMobileTab에서 분리된 제품 카드 컴포넌트
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Typography,
  Chip,
  Stack,
  Button,
  Box,
  CircularProgress
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { getCachedPrice, setCachedPrice, setCachedPricesBatch } from '../../utils/priceCache';

// #region agent log
try {
  fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TodaysProductCard.js:module-init',message:'TodaysProductCard 모듈 초기화 시작',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'init-check',hypothesisId:'INIT-ORDER'})}).catch(()=>{});
} catch (e) {}
// #endregion

const TodaysProductCard = ({ 
  product, 
  isPremium, 
  onSelect, 
  compact, 
  theme, 
  priceData: propPriceData, 
  onPriceCalculated 
}) => {
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TodaysProductCard.js:render-start',message:'TodaysProductCard 렌더링 시작',data:{hasProduct:!!product,productId:product?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'render-check',hypothesisId:'RENDER-ORDER'})}).catch(()=>{});
  } catch (e) {}
  // #endregion
  const [priceData, setPriceData] = useState({
    '010신규': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
    'MNP': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
    '기변': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true }
  });
  const hasLoadedRef = useRef(false);
  
  // props로 받은 priceData가 있으면 사용 (초기화 순서 문제 방지를 위해 useMemo 사용)
  const finalPriceData = React.useMemo(() => {
    return propPriceData || priceData;
  }, [propPriceData, priceData]);

  const getCarrierChipColor = (carrier) => {
    switch (carrier) {
      case 'SK': return 'info'; // 하늘색 계열
      case 'KT': return 'success'; // 연두색 계열
      case 'LG': return 'error'; // 핑크/레드 계열
      default: return 'default';
    }
  };
  
  // cardTheme 계산을 useMemo로 감싸서 초기화 순서 문제 방지
  const cardTheme = React.useMemo(() => {
    return theme || {
      primary: '#ffd700',
      secondary: '#ffed4e',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      accent: '#f57f17',
      text: '#f57f17'
    };
  }, [theme]);

  const tagChips = [];
  if (product.isPremium) tagChips.push({ label: '프리미엄', color: 'primary' });
  if (product.isBudget) tagChips.push({ label: '중저가', color: 'secondary' });
  if (product.isPopular) tagChips.push({ label: '인기', color: 'warning' });
  if (product.isRecommended) tagChips.push({ label: '추천', color: 'success' });
  if (product.isCheap) tagChips.push({ label: '저렴', color: 'info' });

  // 각 유형별 가격 정보 로드 (props로 받은 priceData가 없거나 null일 때만)
  useEffect(() => {
    // propPriceData가 null이거나 undefined가 아니고, 모든 유형이 loading이 false이면 스킵
    if (propPriceData && propPriceData['010신규'] && propPriceData['010신규'].loading === false) {
      return;
    }
    if (hasLoadedRef.current || !product.id || !product.carrier) return;
    
    const loadPrices = async () => {
      hasLoadedRef.current = true;
      
      // 기본 요금제군 결정 (프리미엄/중저가에 따라)
      let defaultPlanGroup = '115군';
      if (product.isBudget && !product.isPremium) {
        defaultPlanGroup = '33군';
      }

      const openingTypes = ['010신규', 'MNP', '기변'];
      const newPriceData = { ...priceData };

      // 먼저 전역 캐시에서 확인
      let allCached = true;
      for (const openingType of openingTypes) {
        const cached = getCachedPrice(product.id, defaultPlanGroup, openingType, product.carrier);
        
        // 🔥 개선: 캐시 값 검증 (휴대폰목록 페이지와 동일하게)
        const serverPublicSupport = product.publicSupport || product.support || 0;
        const cachePublicSupport = cached?.publicSupport || 0;
        const isCacheValueInvalid = cached && serverPublicSupport > 0 && 
          Math.abs(cachePublicSupport - serverPublicSupport) > 100000; // 10만원 이상 차이나면 잘못된 캐시로 간주
        
        if (cached && !isCacheValueInvalid && (cached.publicSupport !== undefined || cached.storeSupport !== undefined)) {
          newPriceData[openingType] = {
            publicSupport: cached.publicSupport || 0,
            storeSupport: cached.storeSupport || cached.storeSupportWithAddon || 0,
            purchasePrice: cached.purchasePrice || cached.purchasePriceWithAddon || 0,
            loading: false
          };
        } else {
          allCached = false;
        }
      }

      // 모든 데이터가 캐시에 있으면 즉시 업데이트
      if (allCached) {
        setPriceData(newPriceData);
        if (onPriceCalculated) {
          onPriceCalculated(product.id, newPriceData);
        }
        return;
      }

      // 캐시에 없는 데이터만 API 호출
      for (const openingType of openingTypes) {
        // 이미 캐시에서 가져온 데이터는 스킵
        if (newPriceData[openingType].loading === false) continue;

        try {
          // 🔥 개선: modelName 전달 및 개선된 API 클라이언트 사용
          const result = await directStoreApiClient.calculateMobilePrice(
            product.id,
            defaultPlanGroup,
            openingType,
            product.carrier,
            product.model || null
          );

          if (result.success) {
            // 전역 캐시에 저장
            setCachedPrice(product.id, defaultPlanGroup, openingType, product.carrier, {
              publicSupport: result.publicSupport || 0,
              storeSupport: result.storeSupportWithAddon || 0,
              purchasePrice: result.purchasePriceWithAddon || 0
            });

            newPriceData[openingType] = {
              publicSupport: result.publicSupport || 0,
              storeSupport: result.storeSupportWithAddon || 0,
              purchasePrice: result.purchasePriceWithAddon || 0,
              loading: false
            };
          } else {
            newPriceData[openingType].loading = false;
          }
        } catch (err) {
          console.error(`가격 계산 실패 (${openingType}):`, err);
          newPriceData[openingType].loading = false;
        }
      }

      setPriceData(newPriceData);
      if (onPriceCalculated) {
        onPriceCalculated(product.id, newPriceData);
      }
    };

    loadPrices();
  }, [product.id, product.carrier, product.model, product.isBudget, product.isPremium, propPriceData]);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'visible',
        cursor: 'pointer',
        backgroundColor: cardTheme.cardBg,
        border: `2px solid ${cardTheme.primary}30`,
        transition: 'all 0.3s ease',
        '&:hover': { 
          transform: 'translateY(-5px)', 
          boxShadow: `0 8px 24px ${cardTheme.primary}40`,
          borderColor: cardTheme.primary,
          zIndex: 1
        }
      }}
      onClick={() => onSelect(product)}
    >
      {/* 태그 칩들 */}
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
        pt: compact ? '55%' : '70%',  // 컴팩트 모드에서 이미지 영역 비율 더 감소
        minHeight: compact ? 180 : 240,  // 컴팩트 모드에서 최소 높이 더 감소
        background: `linear-gradient(135deg, ${cardTheme.primary}10 0%, ${cardTheme.secondary}10 100%)`,
        borderRadius: '16px 16px 0 0', 
        overflow: 'hidden',
        borderBottom: `2px solid ${cardTheme.primary}20`,
        flexShrink: 0  // 이미지 영역이 축소되지 않도록
      }}>
        <CardMedia
          component="img"
          image={product.image || ''}
          alt={product.petName}
          onError={(e) => {
            // 이미지 로드 실패 시 빈 이미지로 처리
            e.target.style.display = 'none';
          }}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',  // cover로 변경하여 섹션을 꽉 채움
            transition: 'transform 0.3s',
            '&:hover': { transform: 'scale(1.05)' }
          }}
        />
      </Box>

      <CardContent sx={{ flex: '1 1 auto', p: compact ? 1.0 : 2, minHeight: 0, overflow: 'visible' }}>
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

        <Stack spacing={1.5} sx={{ 
          background: `linear-gradient(135deg, ${cardTheme.primary}08 0%, ${cardTheme.secondary}08 100%)`,
          p: compact ? 1.0 : 2, 
          borderRadius: 2,
          border: `1px solid ${cardTheme.primary}20`
        }}>
          {/* 출고가 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pb: 1, borderBottom: `1px solid ${cardTheme.primary}15` }}>
            <Typography variant="body1" color="text.secondary" fontWeight="medium">출고가</Typography>
            <Typography variant="body1" sx={{ textDecoration: 'line-through', color: 'text.secondary', fontWeight: 'bold' }}>
              {product.factoryPrice?.toLocaleString()}원
            </Typography>
          </Box>

          {/* 가격 정보 테이블 (부드러운 디자인) */}
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: 'auto 1fr 1fr 1fr',
            gap: 1,
            alignItems: 'center',
            fontSize: compact ? '0.75rem' : '0.8rem'
          }}>
            {/* 헤더 */}
            <Box sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 1, pb: 0.5, borderBottom: `1px solid ${cardTheme.primary}20` }}>
              <Box></Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" fontWeight="medium">010신규</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" fontWeight="medium">MNP</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" fontWeight="medium">기변</Typography>
              </Box>
            </Box>

            {/* 이통사지원금 */}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? '0.7rem' : '0.75rem' }}>
              이통사지원금
            </Typography>
            {['010신규', 'MNP', '기변'].map((type) => (
              <Box key={type} sx={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                {finalPriceData[type].loading ? (
                  <CircularProgress size={12} />
                ) : (
                  <Typography variant="caption" sx={{ fontSize: compact ? '0.7rem' : '0.75rem' }}>
                    {finalPriceData[type].publicSupport?.toLocaleString()}원
                  </Typography>
                )}
              </Box>
            ))}

            {/* 대리점지원금 */}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? '0.7rem' : '0.75rem' }}>
              대리점지원금
            </Typography>
            {['010신규', 'MNP', '기변'].map((type) => (
              <Box key={type} sx={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                {finalPriceData[type].loading ? (
                  <CircularProgress size={12} />
                ) : (
                  <Typography variant="caption" sx={{ fontSize: compact ? '0.7rem' : '0.75rem' }}>
                    {finalPriceData[type].storeSupport?.toLocaleString()}원
                  </Typography>
                )}
              </Box>
            ))}

            {/* 최종구매가 */}
            <Typography variant="caption" fontWeight="bold" sx={{ fontSize: compact ? '0.75rem' : '0.8rem', color: cardTheme.text }}>
              최종구매가
            </Typography>
            {['010신규', 'MNP', '기변'].map((type) => (
              <Box key={type} sx={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                {finalPriceData[type].loading ? (
                  <CircularProgress size={12} />
                ) : (
                  <Typography variant="caption" fontWeight="bold" sx={{ fontSize: compact ? '0.9rem' : '1rem', color: cardTheme.primary }}>
                    {finalPriceData[type].purchasePrice?.toLocaleString()}원
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            * 필수부가: {product.addons || product.requiredAddons || '없음'} (93일 유지조건)
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ p: compact ? 1.5 : 2, pt: compact ? 0 : 0 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<ShoppingCartIcon />}
          size={compact ? 'medium' : 'large'}
          sx={{ 
            borderRadius: 2,
            backgroundColor: cardTheme.primary,
            color: 'white',
            fontWeight: 'bold',
            '&:hover': {
              backgroundColor: cardTheme.accent,
              transform: 'scale(1.02)',
              boxShadow: `0 4px 12px ${cardTheme.primary}60`
            },
            transition: 'all 0.2s ease'
          }}
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

export default TodaysProductCard;
