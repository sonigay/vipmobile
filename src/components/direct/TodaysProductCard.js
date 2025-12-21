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
import { getProxyImageUrl } from '../../api';

// 함수 선언으로 변경하여 hoisting으로 TDZ 문제 방지
// React.lazy와의 호환성을 위해 함수를 즉시 평가 가능한 형태로 정의
function TodaysProductCard(props) {
  // CRITICAL: React hooks MUST be called before any conditional returns
  // 모든 React hooks를 최상단에서 먼저 호출하여 TDZ 문제 방지
  const [priceData, setPriceData] = useState({
    '010신규': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
    'MNP': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
    '기변': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true }
  });
  const hasLoadedRef = useRef(false);
  
  // Early return for invalid props AFTER hooks (React rules of hooks)
  if (!props) {
    return null;
  }
  
  const { 
    product, 
    isPremium, 
    onSelect, 
    compact, 
    theme, 
    priceData: propPriceData, 
    onPriceCalculated
  } = props || {};
  
  // props로 받은 priceData가 있으면 사용 (초기화 순서 문제 방지 - useMemo 제거하고 직접 계산)
  const finalPriceData = propPriceData || priceData;
  
  const getCarrierChipColor = (carrier) => {
    switch (carrier) {
      case 'SK': return 'info'; // 하늘색 계열
      case 'KT': return 'success'; // 연두색 계열
      case 'LG': return 'error'; // 핑크/레드 계열
      default: return 'default';
    }
  };
  
  // cardTheme 계산 (초기화 순서 문제 방지를 위해 useMemo 제거)
  const cardTheme = theme || {
    primary: '#ffd700',
    secondary: '#ffed4e',
    cardBg: 'rgba(255, 255, 255, 0.95)',
    accent: '#f57f17',
    text: '#f57f17'
  };
  
  const tagChips = [];
  if (product && product.isPremium) tagChips.push({ label: '프리미엄', color: 'primary' });
  if (product && product.isBudget) tagChips.push({ label: '중저가', color: 'secondary' });
  if (product && product.isPopular) tagChips.push({ label: '인기', color: 'warning' });
  if (product && product.isRecommended) tagChips.push({ label: '추천', color: 'success' });
  if (product && product.isCheap) tagChips.push({ label: '저렴', color: 'info' });
  
  // 각 유형별 가격 정보 로드 (props로 받은 priceData가 있으면 사용, 없으면 마스터 데이터 기반으로 설정)
  useEffect(() => {
    // propPriceData가 있으면 그대로 사용 (마스터 데이터에서 이미 로드됨)
    if (propPriceData) {
      setPriceData(propPriceData);
      if (onPriceCalculated) {
        onPriceCalculated(product?.id, propPriceData);
      }
      return;
    }

    // propPriceData가 없으면 기본값으로 설정
    // TodaysMobileTab의 getPriceDataForProduct가 항상 객체를 반환하므로
    // 여기서는 기본값만 설정 (loading 상태는 propPriceData에서 관리)
    if (!product || !product.id) {
      return;
    }

    // 기본값 설정 (propPriceData가 없을 때만 사용)
    // 실제로는 TodaysMobileTab에서 항상 propPriceData를 전달하므로 이 코드는 거의 실행되지 않음
    const defaultPriceData = {
      '010신규': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: false },
      'MNP': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: false },
      '기변': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: false }
    };
    setPriceData(defaultPriceData);
  }, [product?.id, propPriceData, onPriceCalculated]);

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
      onClick={() => {
        if (!product || !onSelect) return;

        // 개통정보입력 페이지에 전달할 기본값 구성
        const defaultOpeningType = 'MNP';
        const priceForDefaultType = finalPriceData[defaultOpeningType] || finalPriceData['MNP'] || {};

        const selectedProduct = {
          // 기본 단말 정보
          ...product,
          id: product.id || product.modelId, // OpeningInfoPage에서 modelId로 사용
          // 기본 요금제군: 프리미엄/중저가 여부에 따라 결정 (TodaysMobileTab와 동일 로직)
          planGroup: product.defaultPlanGroup || (product.isBudget && !product.isPremium ? '33군' : '115군'),
          // 기본 개통유형: MNP 기준
          openingType: defaultOpeningType,
          // 지원금/구매가 정보 (MNP 기준)
          publicSupport: priceForDefaultType.publicSupport || 0,
          support: priceForDefaultType.publicSupport || 0, // 하위 호환 필드
          storeSupport: priceForDefaultType.storeSupport || 0,
          storeSupportWithAddon: priceForDefaultType.storeSupport || 0,
          // 미유치 지원금은 Master에서 다시 계산되므로 0으로 초기화
          storeSupportNoAddon: 0,
          storeSupportWithoutAddon: 0
        };

        onSelect(selectedProduct);
      }}
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

      <Box 
        sx={{ 
          position: 'relative', 
          pt: compact ? '50%' : '65%',  // 이미지 영역 비율 축소 (55%->50%, 70%->65%)
          minHeight: compact ? 160 : 220,  // 최소 높이 축소 (180->160, 240->220)
          background: `linear-gradient(135deg, ${cardTheme.primary}10 0%, ${cardTheme.secondary}10 100%)`,
          borderRadius: '16px 16px 0 0', 
          overflow: 'hidden',
          borderBottom: `2px solid ${cardTheme.primary}20`,
          flexShrink: 0  // 이미지 영역이 축소되지 않도록
        }}
      >
        <CardMedia
          component="img"
          image={product.image ? (() => {
            // 🔥 핵심 수정: MobileListRow와 동일하게 처리
            let finalUrl = getProxyImageUrl(product.image);
            const isDiscordCdn = finalUrl.includes('cdn.discordapp.com') || finalUrl.includes('media.discordapp.net');
            if (isDiscordCdn && !finalUrl.includes('_t=')) {
              // 쿼리 파라미터가 있으면 &로 추가, 없으면 ?로 추가
              finalUrl = finalUrl.includes('?') 
                ? `${finalUrl}&_t=${Date.now()}`
                : `${finalUrl}?_t=${Date.now()}`;
            }
            return finalUrl;
          })() : ''}
          alt={product.petName}
          onError={(e) => {
            // 🔥 핵심 수정: 이미지 로드 실패 처리 개선
            const retryCount = parseInt(e.target.dataset.retryCount || '0');
            
            // 최대 3번까지 재시도
            if (retryCount >= 3) {
              e.target.dataset.gaveUp = 'true';
              e.target.onerror = null;
              e.target.style.display = 'none';
              return;
            }
            
            const originalUrl = product.image;
            if (!originalUrl) {
              e.target.dataset.gaveUp = 'true';
              e.target.onerror = null;
              e.target.style.display = 'none';
              return;
            }
            
            // 🔥 핵심 수정: 프록시 실패 시 원본 URL로 폴백
            if (e.target.src.includes('/api/meetings/proxy-image')) {
              // 프록시 실패 → 원본 URL로 직접 시도
              e.target.src = originalUrl;
              e.target.dataset.retryCount = (retryCount + 1).toString();
              return;
            }
            
            // 원본 URL도 실패 → 프록시로 시도
            if (originalUrl && 
                (originalUrl.includes('cdn.discordapp.com') || originalUrl.includes('media.discordapp.net'))) {
              const proxyUrl = getProxyImageUrl(originalUrl);
              e.target.src = proxyUrl;
              e.target.dataset.retryCount = (retryCount + 1).toString();
              return;
            }
            
            // 모든 시도 실패
            e.target.dataset.gaveUp = 'true';
            e.target.onerror = null;
            e.target.style.display = 'none';
            
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [TodaysProductCard] 이미지 로드 실패:', {
                productId: product.id,
                productName: product.petName,
                originalUrl: product.image,
                attemptedUrl: e.target.src || 'N/A',
                retryCount
              });
            }
          }}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',  // contain으로 변경하여 이미지가 잘리지 않도록
            objectPosition: 'center',
            padding: '8px',  // 여백 추가로 이미지 축소
            transition: 'transform 0.3s',
            '&:hover': { transform: 'scale(1.05)'             }
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
            * 필수부가: {(() => {
              const addons = product.requiredAddons || product.addons;
              // 빈 문자열이나 '없음' 문자열이면 '없음' 표시
              return (addons && addons.trim() && addons.trim() !== '없음') ? addons : '없음';
            })()} (93일 유지조건)
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
            if (!product || !onSelect) return;

            const defaultOpeningType = 'MNP';
            const priceForDefaultType = finalPriceData[defaultOpeningType] || finalPriceData['MNP'] || {};

            const selectedProduct = {
              ...product,
              id: product.id || product.modelId,
              planGroup: product.defaultPlanGroup || (product.isBudget && !product.isPremium ? '33군' : '115군'),
              openingType: defaultOpeningType,
              publicSupport: priceForDefaultType.publicSupport || 0,
              support: priceForDefaultType.publicSupport || 0,
              storeSupport: priceForDefaultType.storeSupport || 0,
              storeSupportWithAddon: priceForDefaultType.storeSupport || 0,
              storeSupportNoAddon: 0,
              storeSupportWithoutAddon: 0
            };

            onSelect(selectedProduct);
          }}
        >
          구매하기
        </Button>
      </CardActions>
    </Card>
  );
}

// Named export도 추가하여 lazy loading TDZ 문제 방지
export { TodaysProductCard };

// Default export - 함수 선언은 hoisted되므로 직접 export 가능
export default TodaysProductCard;
