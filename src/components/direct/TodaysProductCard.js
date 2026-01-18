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
import { attachDiscordImageRefreshHandler } from '../../utils/discordImageUtils';

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
  const [imageUrl, setImageUrl] = useState(null); // 이미지 URL 상태 관리
  const imgElementRef = useRef(null); // 이미지 엘리먼트 ref
  
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

  // 🔥 이미지 URL 초기화 및 갱신 로직
  useEffect(() => {
    if (!product?.image) {
      setImageUrl(null);
      return;
    }

    // 초기 이미지 URL 설정 (매 렌더링마다 새로운 타임스탬프를 생성하지 않도록)
    let finalUrl = getProxyImageUrl(product.image);
    const isDiscordCdn = finalUrl.includes('cdn.discordapp.com') || finalUrl.includes('media.discordapp.net');
    
    // Discord 이미지인 경우 타임스탬프 추가 (캐시 방지, 하지만 product.image가 변경될 때만)
    if (isDiscordCdn && !finalUrl.includes('_t=')) {
      finalUrl = finalUrl.includes('?') 
        ? `${finalUrl}&_t=${Date.now()}`
        : `${finalUrl}?_t=${Date.now()}`;
    }
    
    setImageUrl(finalUrl);
  }, [product?.image]); // product.image가 변경될 때만 업데이트

  // 🔥 디스코드 이미지 갱신 핸들러 설정 (컴포넌트 마운트 시)
  useEffect(() => {
    if (!imgElementRef.current || !product?.discordThreadId || !product?.discordMessageId) {
      return;
    }

    const imgElement = imgElementRef.current;
    const isDiscordUrl = product.image?.includes('cdn.discordapp.com') || product.image?.includes('media.discordapp.net');
    
    if (!isDiscordUrl) {
      return;
    }

    // 에러 핸들러 설정 (이미지 로드 실패 시 자동 갱신)
    attachDiscordImageRefreshHandler(
      imgElement,
      product.discordThreadId,
      product.discordMessageId,
      (newUrl) => {
        console.log('✅ [TodaysProductCard] Discord 이미지 URL 갱신 성공');
        const proxyUrl = getProxyImageUrl(newUrl);
        const timestampedUrl = proxyUrl.includes('?') 
          ? `${proxyUrl}&_t=${Date.now()}`
          : `${proxyUrl}?_t=${Date.now()}`;
        setImageUrl(timestampedUrl);
      }
    );

    // 이미지 로드 성공 후에도 주기적으로 갱신 체크 (30초마다)
    let refreshInterval = null;
    const handleLoad = () => {
      // 이미지 로드 성공 후 30초마다 갱신 체크
      refreshInterval = setInterval(async () => {
        try {
          const { refreshDiscordImageUrl } = await import('../../utils/discordImageUtils');
          const refreshResult = await refreshDiscordImageUrl(product.discordThreadId, product.discordMessageId);
          
          if (refreshResult.success && refreshResult.imageUrl) {
            // 새로운 URL이 기존 URL과 다르면 업데이트
            if (refreshResult.imageUrl !== product.image) {
              console.log('✅ [TodaysProductCard] Discord 이미지 URL 갱신 (주기적 체크):', refreshResult.imageUrl.substring(0, 100));
              const newUrl = getProxyImageUrl(refreshResult.imageUrl);
              const timestampedUrl = newUrl.includes('?') 
                ? `${newUrl}&_t=${Date.now()}`
                : `${newUrl}?_t=${Date.now()}`;
              setImageUrl(timestampedUrl);
            }
          }
        } catch (error) {
          console.warn('⚠️ [TodaysProductCard] 이미지 갱신 체크 실패:', error);
        }
      }, 30000); // 30초마다 체크
    };

    imgElement.addEventListener('load', handleLoad, { once: true });

    return () => {
      imgElement.removeEventListener('load', handleLoad);
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [product?.discordThreadId, product?.discordMessageId, product?.image]);
  
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
          // 그라데이션 막대 제거됨
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
          storeSupportWithAddon: priceForDefaultType.storeSupport || 0
          // 🔥 수정: 부가미유치 기준 제거 (storeSupportNoAddon, storeSupportWithoutAddon 제거)
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
          background: cardTheme.background || '#ffffff', // 통신사별 배경색 (SK: 파란색, KT: 녹색, LG: 분홍색)
          borderRadius: '16px 16px 0 0', 
          overflow: 'hidden',
          borderBottom: `2px solid ${cardTheme.primary}20`,
          flexShrink: 0  // 이미지 영역이 축소되지 않도록
        }}
      >
        <CardMedia
          component="img"
          ref={imgElementRef}
          image={imageUrl || ''}
          alt={product.petName}
          onError={async (e) => {
            // 🔥 핵심 수정: 이미지 로드 실패 처리 개선
            const retryCount = parseInt(e.target.dataset.retryCount || '0');
            
            // 최대 3번까지 재시도
            if (retryCount >= 3) {
              e.target.dataset.gaveUp = 'true';
              e.target.onerror = null;
              e.target.style.display = 'none';
              return;
            }
            
            const originalUrl = product?.image;
            if (!originalUrl) {
              e.target.dataset.gaveUp = 'true';
              e.target.onerror = null;
              e.target.style.display = 'none';
              return;
            }
            
            // 🔥 핵심 수정: 프록시 실패 시 원본 URL로 폴백
            if (e.target.src.includes('/api/meetings/proxy-image')) {
              // 프록시 실패 → 원본 URL로 직접 시도
              const directUrl = originalUrl.includes('?') 
                ? `${originalUrl}&_t=${Date.now()}`
                : `${originalUrl}?_t=${Date.now()}`;
              setImageUrl(directUrl);
              e.target.dataset.retryCount = (retryCount + 1).toString();
              return;
            }
            
            // Discord 이미지이고 메시지 ID가 있으면 자동 갱신 시도
            const isDiscordUrl = originalUrl.includes('cdn.discordapp.com') || originalUrl.includes('media.discordapp.net');
            if (isDiscordUrl && product.discordThreadId && product.discordMessageId) {
              try {
                const { refreshDiscordImageUrl } = await import('../../utils/discordImageUtils');
                const refreshResult = await refreshDiscordImageUrl(product.discordThreadId, product.discordMessageId);
                
                if (refreshResult.success && refreshResult.imageUrl) {
                  console.log('✅ [TodaysProductCard] Discord 이미지 URL 갱신 성공 (에러 핸들러)');
                  const newUrl = getProxyImageUrl(refreshResult.imageUrl);
                  const timestampedUrl = newUrl.includes('?') 
                    ? `${newUrl}&_t=${Date.now()}`
                    : `${newUrl}?_t=${Date.now()}`;
                  setImageUrl(timestampedUrl);
                  e.target.dataset.retryCount = (retryCount + 1).toString();
                  return;
                }
              } catch (error) {
                console.warn('⚠️ [TodaysProductCard] Discord 이미지 갱신 실패:', error);
              }
            }
            
            // 원본 URL도 실패 → 프록시로 시도
            if (originalUrl && 
                (originalUrl.includes('cdn.discordapp.com') || originalUrl.includes('media.discordapp.net'))) {
              const proxyUrl = getProxyImageUrl(originalUrl);
              const timestampedUrl = proxyUrl.includes('?') 
                ? `${proxyUrl}&_t=${Date.now()}`
                : `${proxyUrl}?_t=${Date.now()}`;
              setImageUrl(timestampedUrl);
              e.target.dataset.retryCount = (retryCount + 1).toString();
              return;
            }
            
            // 모든 시도 실패
            e.target.dataset.gaveUp = 'true';
            e.target.onerror = null;
            e.target.style.display = 'none';
            
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [TodaysProductCard] 이미지 로드 실패:', {
                productId: product?.id,
                productName: product?.petName,
                originalUrl: product?.image,
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
              // 값이 있으면 항상 표시 (동적 설정값 반영)
              if (!addons || (typeof addons === 'string' && addons.trim() === '')) {
                return '없음';
              }
              // '없음' 문자열이 아닌 경우 실제 값 표시
              return addons.trim() === '없음' ? '없음' : addons;
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
              // 🔥 수정: 부가미유치 기준 제거 (storeSupportNoAddon, storeSupportWithoutAddon 제거)
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
