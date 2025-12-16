import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  CircularProgress,
  CardMedia
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { LoadingState } from './common/LoadingState';
import { ErrorState } from './common/ErrorState';
import TodaysProductCard from './TodaysProductCard';

const TodaysMobileTab = ({ isFullScreen, onProductSelect }) => {
  const [premiumPhones, setPremiumPhones] = useState([]);
  const [budgetPhones, setBudgetPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [compact, setCompact] = useState(true);

  // 마스터 데이터 상태
  const [masterPricing, setMasterPricing] = useState({}); // { `${modelId}-${openingType}`: priceObj }

  const [mainHeaderText, setMainHeaderText] = useState(() => {
    try {
      return typeof window !== 'undefined'
        ? localStorage.getItem('direct-main-header-text') || ''
        : '';
    } catch {
      return '';
    }
  });

  // 슬라이드쇼 관련 상태
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const [slideshowData, setSlideshowData] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTransitionPage, setIsTransitionPage] = useState(false);
  const [transitionPageData, setTransitionPageData] = useState(null);
  const [isSlideshowDataLoading, setIsSlideshowDataLoading] = useState(false);
  const [isSlideshowLooping, setIsSlideshowLooping] = useState(false);
  const [showRepeatDialog, setShowRepeatDialog] = useState(false);
  const [currentCarrier, setCurrentCarrier] = useState(null); // 테마 색상용

  // 수동 슬라이드 탐색 상태 (일반 모드)
  const [manualSlideIndex, setManualSlideIndex] = useState(0);
  const [isManualTransitionPage, setIsManualTransitionPage] = useState(false);
  const [manualTransitionPageData, setManualTransitionPageData] = useState(null);

  // 로딩 단계 상태
  const [loadSteps, setLoadSteps] = useState({
    mobiles: { label: '오늘의 휴대폰', status: 'idle', message: '' },
    pricing: { label: '가격 정보', status: 'idle', message: '' },
    header: { label: '메인 헤더 문구', status: 'idle', message: '' },
    slideshow: { label: '슬라이드쇼 데이터', status: 'idle', message: '' }
  });

  // 통신사별 테마 색상 반환
  const getCarrierTheme = useCallback((carrier) => {
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
          primary: '#ffd700', // 골드
          secondary: '#ffed4e',
          background: 'linear-gradient(135deg, #fff9e6 0%, #ffe082 50%, #ffd54f 100%)',
          cardBg: 'rgba(255, 255, 255, 0.95)',
          accent: '#f57f17',
          text: '#f57f17'
        };
    }
  }, []);

  // 현재 테마 색상 (슬라이드쇼용)
  const theme = useMemo(() => getCarrierTheme(currentCarrier || 'SK'), [currentCarrier, getCarrierTheme]);

  // 데이터 로드
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadSteps(prev => ({
        ...prev,
        mobiles: { ...prev.mobiles, status: 'loading', message: '' },
        pricing: { ...prev.pricing, status: 'idle', message: '' }
      }));

      // 1. 단말 마스터 데이터 조회 (모든 통신사)
      // 병렬로 API 호출
      const [skMobiles, ktMobiles, lgMobiles] = await Promise.all([
        directStoreApiClient.getMobilesMaster('SK'),
        directStoreApiClient.getMobilesMaster('KT'),
        directStoreApiClient.getMobilesMaster('LG')
      ]);

      const allMobiles = [...skMobiles, ...ktMobiles, ...lgMobiles];

      // 프리미엄/중저가/인기/추천 등으로 필터링
      /* 
         규칙: 
         - Premium: isPremium === true
         - Budget: isBudget === true
         (Note: API 응답에 isPremium, isBudget 필드가 포함되어 있어야 함)
      */
      const premium = allMobiles.filter(m => m.isPremium);
      const budget = allMobiles.filter(m => m.isBudget);

      setPremiumPhones(premium);
      setBudgetPhones(budget);

      setLoadSteps(prev => ({
        ...prev,
        mobiles: {
          ...prev.mobiles,
          status: allMobiles.length > 0 ? 'success' : 'empty',
          message: allMobiles.length > 0 ? '' : '데이터가 없습니다.'
        },
        pricing: { ...prev.pricing, status: 'loading', message: '요금 정보 로딩 중...' }
      }));

      // 2. 단말 요금정책 마스터 조회 (모든 통신사)
      const [skPricing, ktPricing, lgPricing] = await Promise.all([
        directStoreApiClient.getMobilesPricing('SK'),
        directStoreApiClient.getMobilesPricing('KT'),
        directStoreApiClient.getMobilesPricing('LG')
      ]);

      const allPricing = [...skPricing, ...ktPricing, ...lgPricing];

      // 가격 데이터 인덱싱: 
      // 1) `${modelId}-${openingType}` -> priceObj (기본 키)
      // 2) `${modelId}-${planGroup}-${openingType}` -> priceObj (요금제군별 키)
      const pricingMap = {};
      allPricing.forEach(item => {
        const basicKey = `${item.modelId}-${item.openingType}`;
        const planGroupKey = `${item.modelId}-${item.planGroup}-${item.openingType}`;
        
        // 기본 키로 저장 (기존 호환성 유지)
        if (!pricingMap[basicKey]) {
          pricingMap[basicKey] = item;
        }
        
        // 요금제군별 키로도 저장 (요금제군별 조회 가능)
        pricingMap[planGroupKey] = item;
      });

      setMasterPricing(pricingMap);

      setLoadSteps(prev => ({
        ...prev,
        pricing: { ...prev.pricing, status: 'success', message: '' }
      }));

    } catch (err) {
      console.error('데이터 로딩 실패:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      setLoadSteps(prev => ({
        ...prev,
        mobiles: { ...prev.mobiles, status: 'error', message: '로드 실패' },
        pricing: { ...prev.pricing, status: 'error', message: '로드 실패' }
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  // 메인헤더 문구 로드
  const loadMainHeaderText = useCallback(async () => {
    try {
      setLoadSteps(prev => ({
        ...prev,
        header: { ...prev.header, status: 'loading', message: '' }
      }));
      const response = await directStoreApiClient.getMainHeaderText();
      if (response.success && response.data && response.data.content) {
        const content = response.data.content;
        setMainHeaderText(content);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('direct-main-header-text', content);
          }
        } catch { }
        setLoadSteps(prev => ({
          ...prev,
          header: { ...prev.header, status: 'success', message: '' }
        }));
      } else {
        setLoadSteps(prev => ({
          ...prev,
          header: { ...prev.header, status: 'empty', message: '문구 없음' }
        }));
      }
    } catch (err) {
      console.error('메인헤더 문구 로드 실패:', err);
      setLoadSteps(prev => ({
        ...prev,
        header: { ...prev.header, status: 'error', message: '문구 로드 실패' }
      }));
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchData();
    loadMainHeaderText();
  }, [fetchData, loadMainHeaderText]);

  // 이미지 업로드 이벤트 리스너
  useEffect(() => {
    const handleImageUploaded = (event) => {
      console.log('🔄 [오늘의휴대폰] 이미지 업로드 이벤트 수신, 재로딩...');
      setTimeout(() => fetchData(), 1000); // 1초 후 재로딩
    };
    window.addEventListener('imageUploaded', handleImageUploaded);
    return () => window.removeEventListener('imageUploaded', handleImageUploaded);
  }, [fetchData]);

  // 가격 데이터 Lookup 함수 (TodaysProductCard용 prop 생성)
  const getPriceDataForProduct = useCallback((product) => {
    // product가 없으면 기본값 반환 (null 대신 항상 객체 반환)
    if (!product || !product.id) {
      return {
        '010신규': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: false },
        'MNP': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: false },
        '기변': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: false }
      };
    }

    const openingTypes = ['010신규', 'MNP', '기변'];
    const result = {};

    // 기본 요금제군 결정 (프리미엄/중저가에 따라)
    let defaultPlanGroup = '115군';
    if (product.isBudget && !product.isPremium) {
      defaultPlanGroup = '33군';
    }

    // masterPricing이 비어있으면 기본값 반환 (로딩 완료 상태로 표시)
    const isMasterPricingLoaded = Object.keys(masterPricing).length > 0;

    // 마스터 가격 데이터에서 요금제군별로 찾기
    openingTypes.forEach(type => {
      // 1순위: 요금제군별 키로 찾기 `${modelId}-${planGroup}-${openingType}`
      const planGroupKey = `${product.id}-${defaultPlanGroup}-${type}`;
      let pricing = masterPricing[planGroupKey];

      // 2순위: 기본 키로 찾기 `${modelId}-${openingType}` (요금제군별 키가 없을 때)
      if (!pricing) {
        const basicKey = `${product.id}-${type}`;
        pricing = masterPricing[basicKey];
      }

      if (pricing) {
        result[type] = {
          publicSupport: pricing.publicSupport || 0,
          storeSupport: pricing.storeSupportWithAddon || 0, // 기본값으로 부가서비스 포함 지원금 사용
          purchasePrice: pricing.purchasePriceWithAddon || 0,
          loading: false
        };
      } else {
        // 데이터가 없으면 0으로 초기화
        // masterPricing이 로드되었으면 loading: false, 아직 로드 중이면 loading: true
        result[type] = {
          publicSupport: 0,
          storeSupport: 0,
          purchasePrice: 0,
          loading: !isMasterPricingLoaded // 마스터 데이터 로드 완료 여부에 따라 결정
        };
      }
    });

    // 마스터 데이터를 사용하므로 항상 반환 (loading 상태는 masterPricing 로드 여부에 따라 결정)
    return result;
  }, [masterPricing]);

  // 표시할 상품 목록 (Premium Top 3 + Budget Top 2)
  const allProducts = useMemo(() => {
    const pIds = new Set();
    const result = [];

    // Premium (Max 3)
    const pList = premiumPhones.slice(0, 3);
    pList.forEach(p => {
      if (!pIds.has(p.id)) {
        pIds.add(p.id);
        result.push(p);
      }
    });

    // Budget (Max 2)
    const bList = budgetPhones.slice(0, 2);
    bList.forEach(p => {
      if (!pIds.has(p.id)) {
        pIds.add(p.id);
        result.push(p);
      }
    });

    // Total Max 3? (기존 로직: combined.slice(0, 3))
    // 기존 로직: premiumPhones.slice(0,3) + budgetPhones.slice(0,2) -> result.slice(0,3)
    return result.slice(0, 3);
  }, [premiumPhones, budgetPhones]);


  // === 슬라이드쇼 데이터 준비 ===
  // 체크된 모든 상품을 가져와서 슬라이드쇼 데이터 구성
  const prepareSlideshowData = useCallback(async () => {
    try {
      setIsSlideshowDataLoading(true);
      setLoadSteps(prev => ({
        ...prev,
        slideshow: { ...prev.slideshow, status: 'loading', message: '' }
      }));

      // 마스터 데이터(masterPricing)가 이미 로드되어 있어야 함 (fetchData 완료 가정)

      const carriers = ['SK', 'KT', 'LG'];
      const allCheckedProducts = [];

      // API 호출하여 체크된 상품만 필터링? NO, 이미 allMobiles를 가져오는 것이 나을 수도 있지만
      // 여기서는 fetchData에서 저장하지 않은 전체 목록이 필요할 수 있음.
      // 하지만 Master API 호출은 가벼움.

      // 편의상 fetchData에서 이미 mobiles state를 저장해두면 좋았을 텐데,
      // premiumPhones/budgetPhones만 저장함. 
      // Master API 재호출보다는 state 확장이 나음.
      // 여기서는 다시 호출 (병렬)
      const [skMobiles, ktMobiles, lgMobiles] = await Promise.all([
        directStoreApiClient.getMobilesMaster('SK'),
        directStoreApiClient.getMobilesMaster('KT'),
        directStoreApiClient.getMobilesMaster('LG')
      ]);

      const carrierMobiles = { 'SK': skMobiles, 'KT': ktMobiles, 'LG': lgMobiles };

      for (const carrier of carriers) {
        const list = carrierMobiles[carrier] || [];
        // 체크된 상품 필터링
        const checked = list.filter(p =>
          p.isPopular || p.isRecommended || p.isCheap || p.isPremium || p.isBudget
        );

        if (checked.length > 0) {
          allCheckedProducts.push({
            carrier,
            products: checked,
            count: checked.length
          });
        }
      }

      // 체크된 상품 수 많은 순 정렬
      allCheckedProducts.sort((a, b) => b.count - a.count);

      // 슬라이드쇼 아이템 생성
      const slideshowItems = [];
      const PRODUCTS_PER_SLIDE = 3;

      for (let i = 0; i < allCheckedProducts.length; i++) {
        const carrierData = allCheckedProducts[i];
        const { carrier, products } = carrierData;

        const premium = products.filter(p => p.isPremium);
        const budget = products.filter(p => p.isBudget);

        // Premium Group
        if (premium.length > 0) {
          if (slideshowItems.length > 0) {
            const transitionText = await directStoreApiClient.getTransitionPageText(carrier, 'premium');
            slideshowItems.push({
              type: 'transition',
              carrier,
              category: 'premium',
              content: transitionText.data?.content || `이어서 ${carrier} 프리미엄 상품 안내입니다.`,
              imageUrl: transitionText.data?.imageUrl || ''
            });
          }
          for (let j = 0; j < premium.length; j += PRODUCTS_PER_SLIDE) {
            slideshowItems.push({
              type: 'productGroup',
              products: premium.slice(j, j + PRODUCTS_PER_SLIDE),
              carrier,
              category: 'premium'
            });
          }
        }

        // Budget Group
        if (budget.length > 0) {
          if (premium.length > 0 || slideshowItems.length > 0) {
            const transitionText = await directStoreApiClient.getTransitionPageText(carrier, 'budget');
            slideshowItems.push({
              type: 'transition',
              carrier,
              category: 'budget',
              content: transitionText.data?.content || `이어서 ${carrier} 중저가 상품 안내입니다.`,
              imageUrl: transitionText.data?.imageUrl || ''
            });
          }
          for (let j = 0; j < budget.length; j += PRODUCTS_PER_SLIDE) {
            slideshowItems.push({
              type: 'productGroup',
              products: budget.slice(j, j + PRODUCTS_PER_SLIDE),
              carrier,
              category: 'budget'
            });
          }
        }

        // Next Carrier Transition
        if (i < allCheckedProducts.length - 1) {
          const nextCarrier = allCheckedProducts[i + 1].carrier;
          const nextData = allCheckedProducts[i + 1];
          const hasNextPremium = nextData.products.some(p => p.isPremium);
          const hasNextBudget = nextData.products.some(p => p.isBudget);

          if (hasNextPremium) {
            const tText = await directStoreApiClient.getTransitionPageText(nextCarrier, 'premium');
            slideshowItems.push({
              type: 'transition',
              carrier: nextCarrier,
              category: 'premium',
              content: tText.data?.content || `이어서 ${nextCarrier} 프리미엄 상품 안내입니다.`,
              imageUrl: tText.data?.imageUrl || ''
            });
          } else if (hasNextBudget) {
            const tText = await directStoreApiClient.getTransitionPageText(nextCarrier, 'budget');
            slideshowItems.push({
              type: 'transition',
              carrier: nextCarrier,
              category: 'budget',
              content: tText.data?.content || `이어서 ${nextCarrier} 중저가 상품 안내입니다.`,
              imageUrl: tText.data?.imageUrl || ''
            });
          }
        }
      }

      setSlideshowData(slideshowItems);
      setLoadSteps(prev => ({
        ...prev,
        slideshow: {
          ...prev.slideshow,
          status: slideshowItems.length > 0 ? 'success' : 'empty',
          message: slideshowItems.length > 0 ? '' : '체크된 상품 없음'
        }
      }));
      return slideshowItems;

    } catch (err) {
      console.error('슬라이드쇼 데이터 준비 실패:', err);
      setLoadSteps(prev => ({
        ...prev,
        slideshow: { ...prev.slideshow, status: 'error', message: '오류 발생' }
      }));
      return [];
    } finally {
      setIsSlideshowDataLoading(false);
    }
  }, []); // 의존성 없음 (API 호출)

  // 일반 모드에서도 슬라이드쇼 데이터 준비 (초기 로드 후)
  useEffect(() => {
    if (!loading) {
      prepareSlideshowData();
    }
  }, [loading, prepareSlideshowData]);


  // 슬라이드쇼 제어 (Start/Stop)
  const toggleSlideshow = useCallback(async () => {
    if (!isSlideshowActive) {
      // 시작 -> 다이얼로그
      const data = slideshowData.length > 0 ? slideshowData : await prepareSlideshowData();
      if (data.length === 0) {
        alert('슬라이드쇼할 상품이 없습니다.');
        return;
      }
      setIsSlideshowLooping(false);
      setShowRepeatDialog(true);
    } else {
      // 중지
      setIsSlideshowActive(false);
      setCurrentSlideIndex(0);
      setIsTransitionPage(false);
      setTransitionPageData(null);
      setIsSlideshowLooping(false);
    }
  }, [isSlideshowActive, slideshowData, prepareSlideshowData]);

  const startSlideshow = useCallback((loop = false) => {
    setIsSlideshowLooping(loop);
    setIsSlideshowActive(true);
    setCurrentSlideIndex(0);
    const first = slideshowData[0];
    setIsTransitionPage(first?.type === 'transition');
    setTransitionPageData(first?.type === 'transition' ? first : null);
    if (first?.carrier) setCurrentCarrier(first.carrier);
    setShowRepeatDialog(false);
  }, [slideshowData]);

  // 슬라이드쇼 타이머
  useEffect(() => {
    if (!isSlideshowActive || slideshowData.length === 0) return;

    const currentItem = slideshowData[currentSlideIndex];
    const duration = currentItem?.type === 'transition' ? 3000 : 5000;

    const timer = setTimeout(() => {
      setCurrentSlideIndex(prev => {
        const next = prev + 1;
        if (next >= slideshowData.length) {
          if (isSlideshowLooping) {
            const first = slideshowData[0];
            setIsTransitionPage(first?.type === 'transition');
            setTransitionPageData(first?.type === 'transition' ? first : null);
            if (first?.carrier) setCurrentCarrier(first.carrier);
            return 0;
          } else {
            setIsSlideshowActive(false);
            setCurrentSlideIndex(0);
            return 0;
          }
        }

        const nextItem = slideshowData[next];
        setIsTransitionPage(nextItem.type === 'transition');
        setTransitionPageData(nextItem.type === 'transition' ? nextItem : null);
        if (nextItem.carrier) setCurrentCarrier(nextItem.carrier);
        return next;
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [isSlideshowActive, slideshowData, currentSlideIndex, isSlideshowLooping]);

  // 수동 탐색 핸들러
  const handleManualSlideChange = useCallback((direction) => {
    if (slideshowData.length === 0) return;
    setManualSlideIndex(prev => {
      let next;
      if (direction === 'next') next = prev + 1 >= slideshowData.length ? 0 : prev + 1;
      else next = prev - 1 < 0 ? slideshowData.length - 1 : prev - 1;

      const item = slideshowData[next];
      setIsManualTransitionPage(item?.type === 'transition');
      setManualTransitionPageData(item?.type === 'transition' ? item : null);
      return next;
    });
  }, [slideshowData]);


  // 렌더링
  return (
    <Box sx={{ p: isFullScreen ? 0 : 3, height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* 헤더 (일반 모드) */}
      {!isFullScreen && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" fontWeight="bold">오늘의 휴대폰</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => { fetchData(); loadMainHeaderText(); }}
            >
              새로고침
            </Button>
            <Button
              variant="contained"
              color={isSlideshowActive ? "secondary" : "primary"}
              onClick={toggleSlideshow}
            >
              {isSlideshowActive ? '슬라이드쇼 중지' : '슬라이드쇼 시작'}
            </Button>
          </Box>
        </Box>
      )}

      {/* 로딩/에러/메인 컨텐츠 */}
      {loading ? (
        <LoadingState message={loadSteps.mobiles.status === 'success' ? '가격 정보 로딩 중...' : '데이터 로딩 중...'} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchData} />
      ) : isSlideshowActive ? (
        // === 슬라이드쇼 모드 ===
        <Box sx={{
          flex: 1,
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          bgcolor: 'background.default',
          zIndex: 1300,
          p: 2
        }}>
          {isTransitionPage && transitionPageData ? (
            // 연결 페이지
            <Box sx={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${getCarrierTheme(transitionPageData.carrier).cardBg} 0%, ${getCarrierTheme(transitionPageData.carrier).primary}15 100%)`
            }}>
              {transitionPageData.imageUrl ? (
                <CardMedia
                  component="img"
                  image={transitionPageData.imageUrl}
                  sx={{ maxHeight: '60%', maxWidth: '80%', objectFit: 'contain', mb: 4 }}
                />
              ) : null}
              <Typography variant="h3" fontWeight="bold" color="primary.main" textAlign="center">
                {transitionPageData.content}
              </Typography>
            </Box>
          ) : (
            // 상품 목록 페이지
            <Box sx={{
              height: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
              p: 4
            }}>
              {slideshowData[currentSlideIndex]?.products?.map(product => (
                <TodaysProductCard
                  key={product.id}
                  product={product}
                  isPremium={product.isPremium}
                  priceData={getPriceDataForProduct(product)}
                  onSelect={onProductSelect}
                  theme={getCarrierTheme(product.carrier)}
                  compact={false}
                />
              ))}
            </Box>
          )}

          {/* 하단 컨트롤 (중지 버튼) */}
          <Box sx={{ position: 'absolute', bottom: 20, right: 20 }}>
            <Button variant="contained" color="secondary" onClick={toggleSlideshow} size="large">
              슬라이드쇼 종료
            </Button>
          </Box>
        </Box>
      ) : (
        // === 일반 그리드 모드 ===
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {/* 메인 헤더 문구 */}
          {mainHeaderText && (
            <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
              <Typography variant="h6" fontWeight="bold">{mainHeaderText}</Typography>
            </Box>
          )}

          {/* 상품 그리드 (Top Products) */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 2
          }}>
            {allProducts.map(product => (
              <TodaysProductCard
                key={product.id}
                product={product}
                isPremium={product.isPremium}
                priceData={getPriceDataForProduct(product)}
                onSelect={onProductSelect}
                theme={getCarrierTheme(product.carrier)}
                compact={compact}
              />
            ))}
            {allProducts.length === 0 && (
              <Typography variant="body1" sx={{ gridColumn: '1/-1', textAlign: 'center', py: 4 }}>
                표시할 상품이 없습니다.
              </Typography>
            )}
          </Box>

          {/* 수동 슬라이드쇼 프리뷰 (옵션) - 생략 가능 */}
          {slideshowData.length > 0 && (
            <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">모든 체크 상품 미리보기 ({slideshowData.length} 슬라이드)</Typography>
                <Box>
                  <IconButton onClick={() => handleManualSlideChange('prev')}><ArrowBackIcon /></IconButton>
                  <IconButton onClick={() => handleManualSlideChange('next')}><ArrowForwardIcon /></IconButton>
                </Box>
              </Box>

              <Box sx={{ height: 400, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                {isManualTransitionPage && manualTransitionPageData ? (
                  <Box sx={{
                    height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', bgcolor: 'rgba(0,0,0,0.03)'
                  }}>
                    <Typography variant="h5">{manualTransitionPageData.content}</Typography>
                  </Box>
                ) : (
                  <Box sx={{
                    height: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, p: 1
                  }}>
                    {slideshowData[manualSlideIndex]?.products?.map(product => (
                      <TodaysProductCard
                        key={`manual-${product.id}`}
                        product={product}
                        isPremium={product.isPremium}
                        priceData={getPriceDataForProduct(product)}
                        onSelect={onProductSelect}
                        theme={getCarrierTheme(product.carrier)}
                        compact={true}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}

        </Box>
      )}

      {/* 반복 옵션 다이얼로그 */}
      <Dialog open={showRepeatDialog} onClose={() => setShowRepeatDialog(false)}>
        <DialogTitle>슬라이드쇼 반복 옵션</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset">
            <RadioGroup value={isSlideshowLooping ? 'loop' : 'once'} onChange={(e) => setIsSlideshowLooping(e.target.value === 'loop')}>
              <FormControlLabel value="once" control={<Radio />} label="한번만" />
              <FormControlLabel value="loop" control={<Radio />} label="무한 반복" />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRepeatDialog(false)}>취소</Button>
          <Button onClick={() => startSlideshow(isSlideshowLooping)} variant="contained">시작</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default TodaysMobileTab;
