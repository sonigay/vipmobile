import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../api/directStoreApi';
import { getCachedPrice, setCachedPrice, setCachedPricesBatch } from '../../utils/priceCache';

const ProductCard = ({ product, isPremium, onSelect, compact, theme, priceData: propPriceData }) => {
  const [priceData, setPriceData] = useState({
    '010신규': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
    'MNP': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
    '기변': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true }
  });
  const hasLoadedRef = useRef(false);
  
  // props로 받은 priceData가 있으면 사용
  const finalPriceData = propPriceData || priceData;

  const getCarrierChipColor = (carrier) => {
    switch (carrier) {
      case 'SK': return 'info'; // 하늘색 계열
      case 'KT': return 'success'; // 연두색 계열
      case 'LG': return 'error'; // 핑크/레드 계열
      default: return 'default';
    }
  };
  
  const cardTheme = theme || {
    primary: '#ffd700',
    secondary: '#ffed4e',
    cardBg: 'rgba(255, 255, 255, 0.95)',
    accent: '#f57f17',
    text: '#f57f17'
  };

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
        if (cached && (cached.publicSupport !== undefined || cached.storeSupport !== undefined)) {
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

      // 모든 데이터가 캐시에 있으면 API 호출 없이 종료
      if (allCached) {
        setPriceData(newPriceData);
        return;
      }

      // 캐시에 없는 데이터만 API 호출
      for (const openingType of openingTypes) {
        // 이미 캐시에서 가져온 데이터는 스킵
        if (newPriceData[openingType].loading === false) continue;

        try {
          const result = await directStoreApi.calculateMobilePrice(
            product.id,
            defaultPlanGroup,
            openingType,
            product.carrier
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
    };

    loadPrices();
  }, [product.id, product.carrier, product.isPremium, product.isBudget, propPriceData]);

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

const TodaysMobileTab = ({ isFullScreen, onProductSelect }) => {
  const [premiumPhones, setPremiumPhones] = useState([]);
  const [budgetPhones, setBudgetPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [compact, setCompact] = useState(true);
  const [mainHeaderText, setMainHeaderText] = useState('');
  const [currentCarrier, setCurrentCarrier] = useState(null); // 현재 표시 중인 통신사 (테마용)
  
  // 슬라이드쇼 관련 상태
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const [slideshowData, setSlideshowData] = useState([]); // 슬라이드쇼용 데이터 구조
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTransitionPage, setIsTransitionPage] = useState(false);
  const [transitionPageData, setTransitionPageData] = useState(null);
  const [isSlideshowDataLoading, setIsSlideshowDataLoading] = useState(true); // 초기값을 true로 설정하여 로딩 상태로 시작
  
  // 일반 모드에서 수동 슬라이드 탐색용 상태
  const [manualSlideIndex, setManualSlideIndex] = useState(0);
  const [isManualTransitionPage, setIsManualTransitionPage] = useState(false);
  const [manualTransitionPageData, setManualTransitionPageData] = useState(null);
  
  // 가격 캐시는 전역 유틸리티 사용 (제거됨)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await directStoreApi.getTodaysMobiles();

      // 데이터가 있으면 설정, 없으면 빈 배열 (에러 아님)
      if (data) {
        setPremiumPhones(Array.isArray(data.premium) ? data.premium : []);
        setBudgetPhones(Array.isArray(data.budget) ? data.budget : []);
      } else {
        setPremiumPhones([]);
        setBudgetPhones([]);
      }
    } catch (err) {
      console.error('오늘의 휴대폰 데이터 로딩 실패:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다. 서버 연결을 확인해주세요.');
      setPremiumPhones([]);
      setBudgetPhones([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 메인헤더 문구 로드
  const loadMainHeaderText = useCallback(async () => {
    try {
      const response = await directStoreApi.getMainHeaderText();
      if (response.success && response.data) {
        setMainHeaderText(response.data.content || '');
      }
    } catch (err) {
      console.error('메인헤더 문구 로드 실패:', err);
    }
  }, []);

  // 슬라이드쇼용 데이터 준비: 모든 통신사의 체크된 상품 가져오기
  const prepareSlideshowData = useCallback(async () => {
    try {
      const carriers = ['SK', 'KT', 'LG'];
      const allCheckedProducts = [];
      
      // 각 통신사별로 체크된 상품 가져오기
      for (const carrier of carriers) {
        try {
          const mobileList = await directStoreApi.getMobileList(carrier);
          // 체크된 상품 필터링 (isPopular, isRecommended, isCheap, isPremium, isBudget 중 하나라도 true)
          const checked = mobileList.filter(product => 
            product.isPopular || 
            product.isRecommended || 
            product.isCheap || 
            product.isPremium || 
            product.isBudget
          );
          
          if (checked.length > 0) {
            allCheckedProducts.push({
              carrier,
              products: checked,
              count: checked.length
            });
          }
        } catch (err) {
          console.warn(`${carrier} 통신사 데이터 가져오기 실패:`, err);
        }
      }
      
      // 체크된 상품 수가 많은 순서로 정렬
      allCheckedProducts.sort((a, b) => b.count - a.count);
      
      // 모든 상품 수집 (가격 미리 로드용)
      const allProducts = [];
      for (const carrierData of allCheckedProducts) {
        allProducts.push(...carrierData.products);
      }
      
      // 모든 상품의 가격을 병렬로 미리 로드하여 전역 캐시에 저장
      const pricePromises = [];
      const cacheEntries = [];
      
      for (const product of allProducts) {
        const planGroup = product.isBudget && !product.isPremium ? '33군' : '115군';
        for (const openingType of ['010신규', 'MNP', '기변']) {
          // 전역 캐시 확인
          const cached = getCachedPrice(product.id, planGroup, openingType, product.carrier);
          if (cached) {
            // 캐시에 있으면 스킵
            continue;
          }
          
          // 캐시에 없으면 API 호출
          pricePromises.push(
            directStoreApi.calculateMobilePrice(
              product.id,
              planGroup,
              openingType,
              product.carrier
            ).then(result => {
              if (result.success) {
                cacheEntries.push({
                  modelId: product.id,
                  planGroup,
                  openingType,
                  carrier: product.carrier,
                  priceData: {
                    publicSupport: result.publicSupport || 0,
                    storeSupport: result.storeSupportWithAddon || 0,
                    purchasePrice: result.purchasePriceWithAddon || 0
                  }
                });
              }
              return { product, result };
            }).catch(err => {
              console.error(`가격 계산 실패 (${product.id}-${planGroup}-${openingType}):`, err);
              return { product, result: { success: false } };
            })
          );
        }
      }
      
      // 모든 가격 로드 완료 대기
      if (pricePromises.length > 0) {
        await Promise.allSettled(pricePromises);
      }
      
      // 배치로 전역 캐시에 저장
      if (cacheEntries.length > 0) {
        setCachedPricesBatch(cacheEntries);
      }
      
      // 슬라이드쇼 데이터 구조 생성 (3개씩 그룹화 - 그리드가 3열이므로)
      const slideshowItems = [];
      const PRODUCTS_PER_SLIDE = 3; // 슬라이드당 상품 개수 (그리드 3열 기준)
      
      for (let i = 0; i < allCheckedProducts.length; i++) {
        const carrierData = allCheckedProducts[i];
        const { carrier, products } = carrierData;
        
        // 프리미엄과 중저가 분리 (태그가 정확히 true인 것만)
        const premium = products.filter(p => p.isPremium === true);
        const budget = products.filter(p => p.isBudget === true);
        
        // 프리미엄 상품이 있으면
        if (premium.length > 0) {
          // 프리미엄 상품 그룹 시작 전 연결페이지 추가 (첫 번째가 아니거나 이전에 상품이 있었으면)
          if (slideshowItems.length > 0) {
            const transitionText = await directStoreApi.getTransitionPageText(carrier, 'premium');
            slideshowItems.push({
              type: 'transition',
              carrier,
              category: 'premium',
              content: transitionText.data?.content || `이어서 ${carrier} 프리미엄 상품 안내입니다.`,
              imageUrl: transitionText.data?.imageUrl || ''
            });
          }
          
          // 프리미엄 상품들을 3개씩 그룹화하여 추가
          for (let j = 0; j < premium.length; j += PRODUCTS_PER_SLIDE) {
            const productGroup = premium.slice(j, j + PRODUCTS_PER_SLIDE);
            slideshowItems.push({
              type: 'productGroup',
              products: productGroup,
              carrier,
              category: 'premium'
            });
          }
        }
        
        // 중저가 상품이 있으면
        if (budget.length > 0) {
          // 중저가 상품 그룹 시작 전 연결페이지 추가 (프리미엄이 있었거나 이전에 상품이 있었으면)
          if (premium.length > 0 || slideshowItems.length > 0) {
            const transitionText = await directStoreApi.getTransitionPageText(carrier, 'budget');
            slideshowItems.push({
              type: 'transition',
              carrier,
              category: 'budget',
              content: transitionText.data?.content || `이어서 ${carrier} 중저가 상품 안내입니다.`,
              imageUrl: transitionText.data?.imageUrl || ''
            });
          }
          
          // 중저가 상품들을 3개씩 그룹화하여 추가
          for (let j = 0; j < budget.length; j += PRODUCTS_PER_SLIDE) {
            const productGroup = budget.slice(j, j + PRODUCTS_PER_SLIDE);
            slideshowItems.push({
              type: 'productGroup',
              products: productGroup,
              carrier,
              category: 'budget'
            });
          }
        }
        
        // 다음 통신사로 넘어가기 전 연결페이지 추가 (마지막 통신사가 아니면)
        if (i < allCheckedProducts.length - 1) {
          const nextCarrier = allCheckedProducts[i + 1].carrier;
          const nextCarrierData = allCheckedProducts[i + 1];
          const nextPremium = nextCarrierData.products.filter(p => p.isPremium);
          const nextBudget = nextCarrierData.products.filter(p => p.isBudget);
          
          // 다음 통신사에 프리미엄이 있으면 프리미엄 연결페이지, 없으면 중저가 연결페이지
          if (nextPremium.length > 0) {
            const transitionText = await directStoreApi.getTransitionPageText(nextCarrier, 'premium');
            slideshowItems.push({
              type: 'transition',
              carrier: nextCarrier,
              category: 'premium',
              content: transitionText.data?.content || `이어서 ${nextCarrier} 프리미엄 상품 안내입니다.`,
              imageUrl: transitionText.data?.imageUrl || ''
            });
          } else if (nextBudget.length > 0) {
            const transitionText = await directStoreApi.getTransitionPageText(nextCarrier, 'budget');
            slideshowItems.push({
              type: 'transition',
              carrier: nextCarrier,
              category: 'budget',
              content: transitionText.data?.content || `이어서 ${nextCarrier} 중저가 상품 안내입니다.`,
              imageUrl: transitionText.data?.imageUrl || ''
            });
          }
        }
      }
      
      setSlideshowData(slideshowItems);
      return slideshowItems;
    } catch (err) {
      console.error('슬라이드쇼 데이터 준비 실패:', err);
      setSlideshowData([]); // 실패 시에도 빈 배열 설정
      return [];
    }
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      await fetchData();
      await loadMainHeaderText();
      // 일반 모드에서도 슬라이드쇼 데이터 준비
      setIsSlideshowDataLoading(true);
      try {
        await prepareSlideshowData();
      } finally {
        setIsSlideshowDataLoading(false);
      }
    };
    initializeData();
  }, [fetchData, loadMainHeaderText, prepareSlideshowData]);

  // 슬라이드쇼 로딩 상태
  const [isSlideshowLoading, setIsSlideshowLoading] = useState(false);
  
  // 슬라이드쇼 반복 옵션
  const [isSlideshowLooping, setIsSlideshowLooping] = useState(false);
  const [showRepeatDialog, setShowRepeatDialog] = useState(false);

  // 슬라이드쇼 시작/중지
  const toggleSlideshow = useCallback(async () => {
    if (!isSlideshowActive) {
      // 슬라이드쇼 시작 - 반복 옵션 선택 다이얼로그 표시
      setIsSlideshowLoading(true);
      try {
        const data = await prepareSlideshowData();
        if (data.length === 0) {
          alert('슬라이드쇼할 체크된 상품이 없습니다.');
          return;
        }
        // 반복 옵션 기본값 설정 (한번만)
        setIsSlideshowLooping(false);
        // 반복 옵션 선택 다이얼로그 표시
        setShowRepeatDialog(true);
      } finally {
        setIsSlideshowLoading(false);
      }
    } else {
      // 슬라이드쇼 중지
      setIsSlideshowActive(false);
      setCurrentSlideIndex(0);
      setIsTransitionPage(false);
      setTransitionPageData(null);
      setIsSlideshowLooping(false);
    }
  }, [isSlideshowActive, prepareSlideshowData]);

  // 슬라이드쇼 실제 시작 (반복 옵션 선택 후)
  const startSlideshow = useCallback((loop = false) => {
    setIsSlideshowLooping(loop);
    setIsSlideshowActive(true);
    setCurrentSlideIndex(0);
    const firstItem = slideshowData[0];
    setIsTransitionPage(firstItem?.type === 'transition');
    setTransitionPageData(firstItem?.type === 'transition' ? firstItem : null);
    if (firstItem?.type === 'productGroup' || firstItem?.type === 'product') {
      setCurrentCarrier(firstItem.carrier);
    } else if (firstItem?.type === 'transition') {
      setCurrentCarrier(firstItem.carrier);
    }
    setShowRepeatDialog(false);
  }, [slideshowData]);

  // 슬라이드쇼 자동 진행
  useEffect(() => {
    if (!isSlideshowActive || slideshowData.length === 0) return;
    
    const currentItem = slideshowData[currentSlideIndex];
    const displayDuration = currentItem?.type === 'transition' ? 3000 : 5000; // 상품 그룹도 5초
    
    const timeout = setTimeout(() => {
      setCurrentSlideIndex(prev => {
        const nextIndex = prev + 1;
        
        if (nextIndex >= slideshowData.length) {
          // 마지막 슬라이드 후 처리
          if (isSlideshowLooping) {
            // 무한 반복: 첫 슬라이드로 자연스럽게 돌아가기
            const firstItem = slideshowData[0];
            setIsTransitionPage(firstItem?.type === 'transition');
            setTransitionPageData(firstItem?.type === 'transition' ? firstItem : null);
            if (firstItem?.type === 'productGroup' || firstItem?.type === 'product') {
              setCurrentCarrier(firstItem.carrier);
            } else if (firstItem?.type === 'transition') {
              setCurrentCarrier(firstItem.carrier);
            }
            return 0; // 첫 슬라이드로 돌아가기
          } else {
            // 한번만: 슬라이드쇼 중지
            setIsSlideshowActive(false);
            setCurrentSlideIndex(0);
            setIsTransitionPage(false);
            setTransitionPageData(null);
            setIsSlideshowLooping(false);
            return 0;
          }
        }
        
        const nextItem = slideshowData[nextIndex];
        setIsTransitionPage(nextItem.type === 'transition');
        setTransitionPageData(nextItem.type === 'transition' ? nextItem : null);
        
        if (nextItem.type === 'productGroup' || nextItem.type === 'product') {
          setCurrentCarrier(nextItem.carrier);
        } else if (nextItem.type === 'transition') {
          setCurrentCarrier(nextItem.carrier);
        }
        
        return nextIndex;
      });
    }, displayDuration);
    
    return () => clearTimeout(timeout);
  }, [isSlideshowActive, slideshowData, currentSlideIndex, isSlideshowLooping]);

  // 이미지 업로드 이벤트 리스너: 이미지 업로드 성공 시 데이터 재로딩
  useEffect(() => {
    const handleImageUploaded = (event) => {
      console.log('🔄 [오늘의휴대폰] 이미지 업로드 이벤트 수신, 데이터 재로딩...', event.detail);
      // 약간의 지연 후 재로딩 (구글시트 저장 완료 대기)
      setTimeout(() => {
        fetchData();
      }, 1000); // 1초 후 재로딩
    };

    window.addEventListener('imageUploaded', handleImageUploaded);
    
    return () => {
      window.removeEventListener('imageUploaded', handleImageUploaded);
    };
  }, [fetchData]);

  // 프리미엄과 중저가를 하나의 배열로 합치기 (프리미엄 먼저, 중저가 나중에)
  // 총 3개만 표시 (프리미엄 우선)
  const allProducts = useMemo(() => {
    const premium = Array.isArray(premiumPhones) ? premiumPhones.slice(0, 3) : [];
    const budget = Array.isArray(budgetPhones) ? budgetPhones.slice(0, 2) : [];
    const combined = [...premium, ...budget];
    return combined.slice(0, 3); // 최대 3개만 표시
  }, [premiumPhones, budgetPhones]);

  // 일반 모드에서 수동 슬라이드 탐색 함수
  const handleManualSlideChange = useCallback((direction) => {
    if (slideshowData.length === 0) return;
    
    setManualSlideIndex(prev => {
      let newIndex;
      if (direction === 'next') {
        newIndex = prev + 1 >= slideshowData.length ? 0 : prev + 1;
      } else {
        newIndex = prev - 1 < 0 ? slideshowData.length - 1 : prev - 1;
      }
      
      const item = slideshowData[newIndex];
      setIsManualTransitionPage(item?.type === 'transition');
      setManualTransitionPageData(item?.type === 'transition' ? item : null);
      
      if (item?.type === 'productGroup' || item?.type === 'product') {
        setCurrentCarrier(item.carrier);
      } else if (item?.type === 'transition') {
        setCurrentCarrier(item.carrier);
      }
      
      return newIndex;
    });
  }, [slideshowData]);

  // 슬라이드쇼 데이터가 준비되면 첫 번째 슬라이드 설정
  useEffect(() => {
    if (slideshowData.length > 0 && !isSlideshowActive) {
      // 첫 번째 상품 그룹을 찾아서 표시 (연결페이지가 첫 번째면 건너뛰기)
      let firstProductGroupIndex = 0;
      for (let i = 0; i < slideshowData.length; i++) {
        if (slideshowData[i]?.type === 'productGroup') {
          firstProductGroupIndex = i;
          break;
        }
      }
      
      setManualSlideIndex(firstProductGroupIndex);
      const firstItem = slideshowData[firstProductGroupIndex];
      setIsManualTransitionPage(firstItem?.type === 'transition');
      setManualTransitionPageData(firstItem?.type === 'transition' ? firstItem : null);
      if (firstItem?.type === 'productGroup' || firstItem?.type === 'product') {
        setCurrentCarrier(firstItem.carrier);
      } else if (firstItem?.type === 'transition') {
        setCurrentCarrier(firstItem.carrier);
      }
    }
  }, [slideshowData, isSlideshowActive]);
  
  // 현재 표시 중인 통신사 감지 (테마용) - 슬라이드쇼 데이터가 준비된 후에만 실행
  useEffect(() => {
    if (allProducts.length > 0 && !isSlideshowActive && !isSlideshowDataLoading && slideshowData.length === 0) {
      // 첫 번째 상품의 통신사를 기본값으로 사용 (슬라이드쇼가 아닐 때만, 기본 그리드 표시 시)
      const firstCarrier = allProducts[0]?.carrier;
      if (firstCarrier && firstCarrier !== currentCarrier) {
        setCurrentCarrier(firstCarrier);
      }
    }
  }, [allProducts, isSlideshowActive, isSlideshowDataLoading, slideshowData.length, currentCarrier]);
  
  // 통신사별 테마 색상 정의
  // 전역 캐시에서 가격 데이터 가져오기
  const getPriceDataFromCache = useCallback((product) => {
    if (!product.id || !product.carrier) return null;
    
    const planGroup = product.isBudget && !product.isPremium ? '33군' : '115군';
    const priceData = {
      '010신규': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
      'MNP': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
      '기변': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true }
    };
    
    let hasCachedData = false;
    for (const openingType of ['010신규', 'MNP', '기변']) {
      const cached = getCachedPrice(product.id, planGroup, openingType, product.carrier);
      if (cached && (cached.publicSupport !== undefined || cached.storeSupport !== undefined)) {
        priceData[openingType] = {
          publicSupport: cached.publicSupport || 0,
          storeSupport: cached.storeSupport || cached.storeSupportWithAddon || 0,
          purchasePrice: cached.purchasePrice || cached.purchasePriceWithAddon || 0,
          loading: false
        };
        hasCachedData = true;
      }
    }
    
    // 캐시가 있으면 priceData 반환, 없으면 null 반환하여 ProductCard에서 자체 로드하도록
    return hasCachedData ? priceData : null;
  }, []);

  const getCarrierTheme = (carrier) => {
    switch (carrier) {
      case 'SK':
        return {
          primary: '#1976d2', // 파란색
          secondary: '#42a5f5',
          background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)',
          cardBg: 'rgba(255, 255, 255, 0.95)',
          accent: '#1565c0',
          text: '#0d47a1'
        };
      case 'KT':
        return {
          primary: '#2e7d32', // 녹색
          secondary: '#66bb6a',
          background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
          cardBg: 'rgba(255, 255, 255, 0.95)',
          accent: '#1b5e20',
          text: '#1b5e20'
        };
      case 'LG':
        return {
          primary: '#c2185b', // 핫핑크
          secondary: '#f06292',
          background: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 50%, #f48fb1 100%)',
          cardBg: 'rgba(255, 255, 255, 0.95)',
          accent: '#ad1457',
          text: '#880e4f'
        };
      default:
        return {
          primary: '#ffd700', // 골드 (기본값)
          secondary: '#ffed4e',
          background: 'linear-gradient(135deg, #fff9e6 0%, #ffe082 50%, #ffd54f 100%)',
          cardBg: 'rgba(255, 255, 255, 0.95)',
          accent: '#f57f17',
          text: '#f57f17'
        };
    }
  };
  
  const theme = getCarrierTheme(currentCarrier);

  // Early return은 모든 훅 호출 이후에 위치
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

  return (
    <Box
      sx={{
        height: isFullScreen ? '100vh' : 'calc(100vh - 64px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: theme.background,
        transition: 'all 0.5s ease',
        position: 'relative'
      }}
    >
      {/* 헤더 영역: 메인헤더 문구 + 제목 + 버튼 */}
      <Box
        sx={{
          p: isFullScreen ? (compact ? 2 : 3) : (compact ? 2 : 2.5),
          pb: isFullScreen && mainHeaderText ? (compact ? 1.5 : 2) : (compact ? 1.5 : 2),
          background: isFullScreen ? 'transparent' : `linear-gradient(to bottom, ${theme.cardBg}, transparent)`,
          transition: 'all 0.3s ease'
        }}
      >
        {/* 메인헤더 문구 */}
        {mainHeaderText && (
          <Box
            sx={{
              mb: isFullScreen ? 2 : 1.5,
              textAlign: 'center',
              py: isFullScreen ? 3 : 2,
              px: 2,
              borderRadius: 2,
              background: isFullScreen 
                ? `linear-gradient(135deg, ${theme.cardBg} 0%, rgba(255,255,255,0.8) 100%)`
                : `linear-gradient(135deg, ${theme.primary}08 0%, ${theme.secondary}08 100%)`,
              boxShadow: isFullScreen ? 3 : 1,
              border: isFullScreen ? 'none' : `1px solid ${theme.primary}20`,
              transition: 'all 0.3s ease'
            }}
          >
            <Typography
              variant={isFullScreen ? 'h5' : 'h6'}
              sx={{
                fontWeight: 'bold',
                color: theme.text,
                lineHeight: 1.6,
                textShadow: isFullScreen ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {mainHeaderText}
            </Typography>
          </Box>
        )}
        
        {/* 제목과 버튼 영역 */}
        {!isFullScreen && (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography 
              variant="h6" 
              fontWeight="bold"
              sx={{ color: theme.text }}
            >
              오늘의 휴대폰
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant={isSlideshowActive ? 'contained' : 'outlined'}
                size="small"
                startIcon={isSlideshowLoading ? <CircularProgress size={16} /> : (isSlideshowActive ? <PauseIcon /> : <PlayArrowIcon />)}
                onClick={toggleSlideshow}
                disabled={isSlideshowLoading}
                sx={{
                  ...(isSlideshowActive ? {
                    backgroundColor: theme.primary,
                    color: 'white',
                    '&:hover': {
                      backgroundColor: theme.accent
                    }
                  } : {
                    borderColor: theme.primary,
                    color: theme.primary,
                    '&:hover': {
                      borderColor: theme.accent,
                      backgroundColor: `${theme.primary}15`
                    }
                  })
                }}
              >
                {isSlideshowLoading ? '준비 중...' : (isSlideshowActive ? '슬라이드쇼 중지' : '슬라이드쇼 시작')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={fetchData}
                disabled={loading || isSlideshowActive}
                sx={{
                  borderColor: theme.primary,
                  color: theme.primary,
                  '&:hover': {
                    borderColor: theme.accent,
                    backgroundColor: `${theme.primary}15`
                  }
                }}
              >
                새로고침
              </Button>
              <Button
                variant={compact ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setCompact(prev => !prev)}
                disabled={isSlideshowActive}
                sx={{
                  minWidth: 100,
                  ...(compact ? {
                    backgroundColor: theme.primary,
                    color: 'white',
                    '&:hover': {
                      backgroundColor: theme.accent
                    }
                  } : {
                    borderColor: theme.primary,
                    color: theme.primary,
                    '&:hover': {
                      borderColor: theme.accent,
                      backgroundColor: `${theme.primary}15`
                    }
                  })
                }}
              >
                {compact ? '컴팩트' : '넉넉하게'}
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>

      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden', 
          width: '100%', 
          maxWidth: '100%',
          px: isFullScreen ? (compact ? 1 : 1.5) : (compact ? 1.5 : 2),
          pb: isFullScreen ? (compact ? 1 : 1.5) : (compact ? 1.5 : 2),
          position: 'relative'
        }}
      >
        {/* 슬라이드쇼 모드 */}
        {isSlideshowActive && slideshowData.length > 0 && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {isTransitionPage && transitionPageData ? (
              // 연결페이지 표시 (통신사별 테마 적용)
              (() => {
                const transitionTheme = getCarrierTheme(transitionPageData.carrier);
                return (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      p: 4,
                      animation: 'fadeIn 0.5s ease-in',
                      background: `linear-gradient(135deg, ${transitionTheme.cardBg} 0%, ${transitionTheme.primary}10 100%)`
                    }}
                  >
                    {transitionPageData.imageUrl ? (
                      <>
                        <CardMedia
                          component="img"
                          image={transitionPageData.imageUrl}
                          alt="연결페이지 이미지"
                          sx={{
                            maxWidth: '60%',
                            maxHeight: '50%',
                            objectFit: 'contain',
                            mb: 3,
                            borderRadius: 2,
                            boxShadow: `0 8px 24px ${transitionTheme.primary}40`,
                            border: `3px solid ${transitionTheme.primary}30`
                          }}
                        />
                        <Typography
                          variant="h4"
                          sx={{
                            fontWeight: 'bold',
                            color: transitionTheme.text,
                            mt: 2,
                            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            px: 2
                          }}
                        >
                          {transitionPageData.content}
                        </Typography>
                      </>
                    ) : (
                      <Typography
                        variant="h2"
                        sx={{
                          fontWeight: 'bold',
                          color: transitionTheme.text,
                          textShadow: `0 4px 12px ${transitionTheme.primary}30`,
                          lineHeight: 1.5,
                          px: 4,
                          py: 3,
                          borderRadius: 4,
                          background: `linear-gradient(135deg, ${transitionTheme.cardBg} 0%, ${transitionTheme.primary}08 100%)`,
                          border: `2px solid ${transitionTheme.primary}30`,
                          boxShadow: `0 8px 32px ${transitionTheme.primary}20`
                        }}
                      >
                        {transitionPageData.content}
                      </Typography>
                    )}
                  </Box>
                );
              })()
            ) : (
              // 상품 그룹 표시 (6개씩 그리드)
              slideshowData[currentSlideIndex]?.type === 'productGroup' && slideshowData[currentSlideIndex]?.products && (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    gap: compact ? (isFullScreen ? 1 : 1.5) : (isFullScreen ? 1.5 : 2),
                    gridTemplateColumns: {
                      xs: 'repeat(1, 1fr)',  // 모바일: 1열
                      sm: 'repeat(2, 1fr)',  // 태블릿: 2열
                      md: 'repeat(2, 1fr)',  // 작은PC: 2열
                      lg: 'repeat(3, 1fr)',  // 큰PC: 3열
                      xl: 'repeat(3, 1fr)'   // 매우 큰 화면: 3열
                    },
                    gridAutoRows: 'auto',
                    alignContent: 'start',
                    alignItems: 'stretch',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    p: isFullScreen ? (compact ? 1 : 1.5) : (compact ? 1.5 : 2),
                    animation: 'slideIn 0.5s ease-out',
                    '&::-webkit-scrollbar': { width: '6px' },
                    '&::-webkit-scrollbar-thumb': { 
                      bgcolor: `${theme.primary}80`, 
                      borderRadius: '3px',
                      '&:hover': {
                        bgcolor: theme.primary
                      }
                    }
                  }}
                >
                  {slideshowData[currentSlideIndex].products.map((product) => (
                    <ProductCard
                      key={product.id || `${product.model}-${product.carrier}`}
                      product={product}
                      isPremium={product.isPremium === true}
                      onSelect={onProductSelect}
                      compact={compact}
                      theme={getCarrierTheme(slideshowData[currentSlideIndex].carrier)}
                      priceData={getPriceDataFromCache(product)}
                    />
                  ))}
                </Box>
              )
            )}
          </Box>
        )}

        {/* 일반 모드: 슬라이드쇼 데이터 사용 (수동 탐색) */}
        {!isSlideshowActive && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* 이전 버튼 */}
            {slideshowData.length > 0 && (
              <IconButton
                onClick={() => handleManualSlideChange('prev')}
                disabled={slideshowData.length === 0}
                sx={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                  boxShadow: 3,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 1)',
                    transform: 'translateY(-50%) scale(1.1)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <ArrowBackIcon sx={{ fontSize: 32, color: theme.primary }} />
              </IconButton>
            )}

            {/* 다음 버튼 */}
            {slideshowData.length > 0 && (
              <IconButton
                onClick={() => handleManualSlideChange('next')}
                disabled={slideshowData.length === 0}
                sx={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                  boxShadow: 3,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 1)',
                    transform: 'translateY(-50%) scale(1.1)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <ArrowForwardIcon sx={{ fontSize: 32, color: theme.primary }} />
              </IconButton>
            )}

            {/* 슬라이드쇼 데이터 로딩 중 */}
            {isSlideshowDataLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : slideshowData.length > 0 ? (
              /* 슬라이드쇼 데이터가 있으면 슬라이드 표시 */
              <>
                {isManualTransitionPage && manualTransitionPageData ? (
                  // 연결페이지 표시
                  (() => {
                    const transitionTheme = getCarrierTheme(manualTransitionPageData.carrier);
                    return (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          p: 4,
                          animation: 'fadeIn 0.5s ease-in',
                          background: `linear-gradient(135deg, ${transitionTheme.cardBg} 0%, ${transitionTheme.primary}10 100%)`
                        }}
                      >
                        {manualTransitionPageData.imageUrl ? (
                          <>
                            <CardMedia
                              component="img"
                              image={manualTransitionPageData.imageUrl}
                              alt="연결페이지 이미지"
                              sx={{
                                maxWidth: '60%',
                                maxHeight: '50%',
                                objectFit: 'contain',
                                mb: 3,
                                borderRadius: 2,
                                boxShadow: `0 8px 24px ${transitionTheme.primary}40`,
                                border: `3px solid ${transitionTheme.primary}30`
                              }}
                            />
                            <Typography
                              variant="h4"
                              sx={{
                                fontWeight: 'bold',
                                color: transitionTheme.text,
                                mt: 2,
                                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                px: 2
                              }}
                            >
                              {manualTransitionPageData.content}
                            </Typography>
                          </>
                        ) : (
                          <Typography
                            variant="h2"
                            sx={{
                              fontWeight: 'bold',
                              color: transitionTheme.text,
                              textShadow: `0 4px 12px ${transitionTheme.primary}30`,
                              lineHeight: 1.5,
                              px: 4,
                              py: 3,
                              borderRadius: 4,
                              background: `linear-gradient(135deg, ${transitionTheme.cardBg} 0%, ${transitionTheme.primary}08 100%)`,
                              border: `2px solid ${transitionTheme.primary}30`,
                              boxShadow: `0 8px 32px ${transitionTheme.primary}20`
                            }}
                          >
                            {manualTransitionPageData.content}
                          </Typography>
                        )}
                      </Box>
                    );
                  })()
                ) : (
                  // 상품 그룹 표시
                  slideshowData[manualSlideIndex]?.type === 'productGroup' && slideshowData[manualSlideIndex]?.products && (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'grid',
                        gap: compact ? (isFullScreen ? 1 : 1.5) : (isFullScreen ? 1.5 : 2),
                        gridTemplateColumns: {
                          xs: 'repeat(1, 1fr)',  // 모바일: 1열
                          sm: 'repeat(2, 1fr)',  // 태블릿: 2열
                          md: 'repeat(2, 1fr)',  // 작은PC: 2열
                          lg: 'repeat(3, 1fr)',  // 큰PC: 3열
                          xl: 'repeat(3, 1fr)'   // 매우 큰 화면: 3열
                        },
                        gridAutoRows: 'auto',
                        alignContent: 'start',
                        alignItems: 'stretch',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        p: isFullScreen ? (compact ? 1 : 1.5) : (compact ? 1.5 : 2),
                        animation: 'slideIn 0.5s ease-out',
                        '&::-webkit-scrollbar': { width: '6px' },
                        '&::-webkit-scrollbar-thumb': { 
                          bgcolor: `${theme.primary}80`, 
                          borderRadius: '3px',
                          '&:hover': {
                            bgcolor: theme.primary
                          }
                        }
                      }}
                    >
                      {slideshowData[manualSlideIndex].products.map((product) => (
                        <ProductCard
                          key={product.id || `${product.model}-${product.carrier}`}
                          product={product}
                          isPremium={product.isPremium === true}
                          onSelect={onProductSelect}
                          compact={compact}
                          theme={getCarrierTheme(slideshowData[manualSlideIndex].carrier)}
                          priceData={getPriceDataFromCache(product)}
                        />
                      ))}
                    </Box>
                  )
                )}
              </>
            ) : (
              // 슬라이드쇼 데이터가 없으면 기본 그리드 표시 (슬라이드쇼 데이터 로딩이 완료된 후에만 표시)
              !isSlideshowDataLoading ? (
              <Box
                sx={{
                  display: 'grid',
                  gap: compact ? (isFullScreen ? 1 : 1.5) : (isFullScreen ? 1.5 : 2),
                  gridTemplateColumns: {
                    xs: 'repeat(1, 1fr)',  // 모바일: 1열
                    sm: 'repeat(2, 1fr)',  // 태블릿: 2열
                    md: 'repeat(2, 1fr)',  // 작은PC: 2열
                    lg: 'repeat(3, 1fr)',  // 큰PC: 3열
                    xl: 'repeat(3, 1fr)'   // 매우 큰 화면: 3열
                  },
                  gridAutoRows: 'auto',
                  alignContent: 'start',
                  alignItems: 'stretch',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flex: 1,
                  '&::-webkit-scrollbar': { width: '6px' },
                  '&::-webkit-scrollbar-thumb': { 
                    bgcolor: `${theme.primary}80`, 
                    borderRadius: '3px',
                    '&:hover': {
                      bgcolor: theme.primary
                    }
                  }
                }}
              >
                {allProducts.map((product) => {
                  const isPremium = product.isPremium || false;
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isPremium={isPremium}
                      onSelect={onProductSelect}
                      compact={compact}
                      theme={getCarrierTheme(product.carrier)}
                      priceData={getPriceDataFromCache(product)}
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
              ) : null
            )}
          </Box>
        )}
      </Box>
      
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
      
      {/* 슬라이드쇼 반복 옵션 선택 다이얼로그 */}
      <Dialog
        open={showRepeatDialog}
        onClose={() => {
          setShowRepeatDialog(false);
          setIsSlideshowLooping(false); // 다이얼로그 닫을 때 기본값으로 초기화
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>슬라이드쇼 반복 옵션 선택</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset" sx={{ mt: 2, width: '100%' }}>
            <RadioGroup
              value={isSlideshowLooping ? 'loop' : 'once'}
              onChange={(e) => setIsSlideshowLooping(e.target.value === 'loop')}
            >
              <FormControlLabel
                value="once"
                control={<Radio />}
                label="한번만 (마지막 슬라이드 후 중지)"
              />
              <FormControlLabel
                value="loop"
                control={<Radio />}
                label="계속 반복 (무한 반복)"
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowRepeatDialog(false);
              setIsSlideshowLooping(false); // 취소 시 기본값으로 초기화
            }}
          >
            취소
          </Button>
          <Button
            onClick={() => startSlideshow(isSlideshowLooping)}
            variant="contained"
            color="primary"
          >
            시작
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TodaysMobileTab;
