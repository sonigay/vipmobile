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
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { getCachedPrice, setCachedPrice, setCachedPricesBatch } from '../../utils/priceCache';
import { LoadingState } from './common/LoadingState';
import { ErrorState, EmptyState } from './common/ErrorState';
import TodaysProductCard from './TodaysProductCard';

// ProductCard는 TodaysProductCard로 직접 사용 (초기화 순서 문제 방지)
// const ProductCard = TodaysProductCard; // 제거: 초기화 순서 문제 가능성

// getCarrierTheme 함수는 컴포넌트 내부 useCallback으로 이동 (TDZ 문제 방지)

const TodaysMobileTab = ({ isFullScreen, onProductSelect }) => {
  const [premiumPhones, setPremiumPhones] = useState([]);
  const [budgetPhones, setBudgetPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [compact, setCompact] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false); // 초기화 중 여부
  const expectedCalculationsRef = useRef(new Set()); // 초기 로드 시 계산 예상되는 상품 ID 목록
  const calculatedPricesRef = useRef(new Map()); // 계산된 가격 데이터 (productId -> priceData)
  const initStartTimeRef = useRef(null); // 초기화 시작 시간
  const [mainHeaderText, setMainHeaderText] = useState(() => {
    try {
      return typeof window !== 'undefined'
        ? localStorage.getItem('direct-main-header-text') || ''
        : '';
    } catch {
      return '';
    }
  });
  const [currentCarrier, setCurrentCarrier] = useState(null); // 현재 표시 중인 통신사 (테마용)
  
  // 슬라이드쇼 관련 상태
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const [slideshowData, setSlideshowData] = useState([]); // 슬라이드쇼용 데이터 구조
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTransitionPage, setIsTransitionPage] = useState(false);
  const [transitionPageData, setTransitionPageData] = useState(null);
  const [isSlideshowDataLoading, setIsSlideshowDataLoading] = useState(true); // 초기값을 true로 설정하여 로딩 상태로 시작
  // 로딩 단계 상태 (UI 없이 상태만 추적)
  const [loadSteps, setLoadSteps] = useState({
    mobiles: { label: '오늘의 휴대폰', status: 'idle', message: '' },
    header: { label: '메인 헤더 문구', status: 'idle', message: '' },
    slideshow: { label: '슬라이드쇼 데이터', status: 'idle', message: '' }
  });
  
  // 일반 모드에서 수동 슬라이드 탐색용 상태
  const [manualSlideIndex, setManualSlideIndex] = useState(0);
  const [isManualTransitionPage, setIsManualTransitionPage] = useState(false);
  const [manualTransitionPageData, setManualTransitionPageData] = useState(null);
  
  // 슬라이드쇼 로딩 상태 (Rules of Hooks 준수를 위해 최상단으로 이동)
  const [isSlideshowLoading, setIsSlideshowLoading] = useState(false);
  
  // 슬라이드쇼 반복 옵션 (Rules of Hooks 준수를 위해 최상단으로 이동)
  const [isSlideshowLooping, setIsSlideshowLooping] = useState(false);
  const [showRepeatDialog, setShowRepeatDialog] = useState(false);
  
  // 가격 계산 완료 상태 (재렌더링 트리거용) - Rules of Hooks 준수를 위해 최상단으로 이동
  const [priceCalculationTrigger, setPriceCalculationTrigger] = useState(0);
  
  // 가격 캐시는 전역 유틸리티 사용 (제거됨)

  // 통신사별 테마 함수 - useCallback으로 정의하여 TDZ 문제 방지 (Rules of Hooks 준수를 위해 최상단으로 이동)
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
          primary: '#ffd700', // 골드 (기본값)
          secondary: '#ffed4e',
          background: 'linear-gradient(135deg, #fff9e6 0%, #ffe082 50%, #ffd54f 100%)',
          cardBg: 'rgba(255, 255, 255, 0.95)',
          accent: '#f57f17',
          text: '#f57f17'
        };
    }
  }, []);

  // 전역 캐시에서 가격 데이터 가져오기 - Rules of Hooks 준수를 위해 최상단으로 이동
  const getPriceDataFromCache = useCallback((product) => {
    if (!product.id || !product.carrier) return null;
    
    // calculatedPricesRef에서 먼저 확인
    if (calculatedPricesRef.current.has(product.id)) {
      const cachedPriceData = calculatedPricesRef.current.get(product.id);
      // 모든 유형이 로드 완료되었는지 확인
      const allLoaded = cachedPriceData['010신규']?.loading === false &&
                        cachedPriceData['MNP']?.loading === false &&
                        cachedPriceData['기변']?.loading === false;
      if (allLoaded) {
        return cachedPriceData;
      }
    }
    
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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TodaysMobileTab.js:getPriceDataFromCache',message:'캐시 확인 완료',data:{productId:product.id,planGroup,hasCachedData,returnValue:hasCachedData?'priceData':'null'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H8'})}).catch(()=>{});
    // #endregion
    
    // 캐시가 있으면 priceData 반환, 없으면 null 반환하여 ProductCard에서 자체 로드하도록
    return hasCachedData ? priceData : null;
  }, []);

  // 가격 계산 완료 콜백 - Rules of Hooks 준수를 위해 최상단으로 이동
  const handlePriceCalculated = useCallback((productId, priceData) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TodaysMobileTab.js:handlePriceCalculated',message:'가격 계산 완료 콜백 호출',data:{productId,priceDataKeys:Object.keys(priceData||{}),loadingStates:priceData?Object.fromEntries(Object.entries(priceData).map(([k,v])=>[k,v?.loading])):{},calculatedCount:calculatedPricesRef.current.size,expectedCount:expectedCalculationsRef.current.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    calculatedPricesRef.current.set(productId, priceData);
    // 상태 업데이트를 트리거하기 위해 강제로 재렌더링
    setPriceCalculationTrigger(prev => prev + 1);
  }, []);

  // 프리미엄과 중저가를 하나의 배열로 합치기 - Rules of Hooks 준수를 위해 최상단으로 이동
  const allProducts = useMemo(() => {
    const premium = Array.isArray(premiumPhones) ? premiumPhones.slice(0, 3) : [];
    const budget = Array.isArray(budgetPhones) ? budgetPhones.slice(0, 2) : [];
    const combined = [...premium, ...budget];
    return combined.slice(0, 3); // 최대 3개만 표시
  }, [premiumPhones, budgetPhones]);

  // 통신사별 테마 색상 - Rules of Hooks 준수를 위해 최상단으로 이동
  const theme = useMemo(() => {
    const carrier = currentCarrier || 'SK'; // 기본값
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
  }, [currentCarrier]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadSteps(prev => ({
        ...prev,
        mobiles: { ...prev.mobiles, status: 'loading', message: '' }
      }));
      const data = await directStoreApiClient.getTodaysMobiles();

      // 데이터가 있으면 설정, 없으면 빈 배열 (에러 아님)
      if (data) {
        setPremiumPhones(Array.isArray(data.premium) ? data.premium : []);
        setBudgetPhones(Array.isArray(data.budget) ? data.budget : []);
        const hasData = (Array.isArray(data.premium) && data.premium.length > 0) ||
          (Array.isArray(data.budget) && data.budget.length > 0);
        setLoadSteps(prev => ({
          ...prev,
          mobiles: { ...prev.mobiles, status: hasData ? 'success' : 'empty', message: hasData ? '' : '등록된 데이터가 없습니다.' }
        }));
      } else {
        setPremiumPhones([]);
        setBudgetPhones([]);
        setLoadSteps(prev => ({
          ...prev,
          mobiles: { ...prev.mobiles, status: 'empty', message: '응답이 비어 있습니다.' }
        }));
      }
    } catch (err) {
      console.error('오늘의 휴대폰 데이터 로딩 실패:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다. 서버 연결을 확인해주세요.');
      setPremiumPhones([]);
      setBudgetPhones([]);
      setLoadSteps(prev => ({
        ...prev,
        mobiles: { ...prev.mobiles, status: 'error', message: '데이터 로드 실패' }
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
        } catch {
          // 로컬스토리지 접근 실패 시에는 조용히 무시
        }
        setLoadSteps(prev => ({
          ...prev,
          header: { ...prev.header, status: 'success', message: '' }
        }));
      } else {
        setLoadSteps(prev => ({
          ...prev,
          header: { ...prev.header, status: 'empty', message: '문구 응답이 없습니다.' }
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

  // 슬라이드쇼용 데이터 준비: 모든 통신사의 체크된 상품 가져오기
  const prepareSlideshowData = useCallback(async () => {
    try {
      setLoadSteps(prev => ({
        ...prev,
        slideshow: { ...prev.slideshow, status: 'loading', message: '' }
      }));
      const carriers = ['SK', 'KT', 'LG'];
      const allCheckedProducts = [];
      
      // 각 통신사별로 체크된 상품 가져오기
      for (const carrier of carriers) {
        try {
          const mobileList = await directStoreApiClient.getMobileList(carrier);
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
          
          // 🔥 개선: 캐시 값 검증 (휴대폰목록 페이지와 동일하게)
          const serverPublicSupport = product.publicSupport || product.support || 0;
          const cachePublicSupport = cached?.publicSupport || 0;
          const isCacheValueInvalid = cached && serverPublicSupport > 0 && 
            Math.abs(cachePublicSupport - serverPublicSupport) > 100000; // 10만원 이상 차이나면 잘못된 캐시로 간주
          
          if (cached && !isCacheValueInvalid) {
            // 캐시에 있고 유효하면 스킵
            continue;
          }
          
          // 캐시에 없거나 유효하지 않으면 API 호출
          // 🔥 개선: modelName 전달 (휴대폰목록 페이지와 동일하게)
          pricePromises.push(
            directStoreApiClient.calculateMobilePrice(
              product.id,
              planGroup,
              openingType,
              product.carrier,
              product.model || null
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
            const transitionText = await directStoreApiClient.getTransitionPageText(carrier, 'premium');
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
            const transitionText = await directStoreApiClient.getTransitionPageText(carrier, 'budget');
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
            const transitionText = await directStoreApiClient.getTransitionPageText(nextCarrier, 'premium');
            slideshowItems.push({
              type: 'transition',
              carrier: nextCarrier,
              category: 'premium',
              content: transitionText.data?.content || `이어서 ${nextCarrier} 프리미엄 상품 안내입니다.`,
              imageUrl: transitionText.data?.imageUrl || ''
            });
          } else if (nextBudget.length > 0) {
            const transitionText = await directStoreApiClient.getTransitionPageText(nextCarrier, 'budget');
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
      setLoadSteps(prev => ({
        ...prev,
        slideshow: {
          ...prev.slideshow,
          status: slideshowItems.length > 0 ? 'success' : 'empty',
          message: slideshowItems.length > 0 ? '' : '체크된 상품이 없습니다.'
        }
      }));
      return slideshowItems;
    } catch (err) {
      console.error('슬라이드쇼 데이터 준비 실패:', err);
      setSlideshowData([]); // 실패 시에도 빈 배열 설정
      setLoadSteps(prev => ({
        ...prev,
        slideshow: { ...prev.slideshow, status: 'error', message: '슬라이드쇼 데이터 실패' }
      }));
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


  // 모든 상품의 가격 계산 완료 확인
  useEffect(() => {
    // 초기화 중이 아니면 확인하지 않음
    if (!isInitializing || allProducts.length === 0) {
      return;
    }

    // 예상 계산 목록이 비어있으면 확인하지 않음
    if (expectedCalculationsRef.current.size === 0) {
      return;
    }

    // 최대 대기 시간 체크
    if (!initStartTimeRef.current) {
      initStartTimeRef.current = Date.now();
    }
    const MAX_WAIT_TIME = 150000; // 최대 150초 대기
    const elapsedTime = Date.now() - initStartTimeRef.current;

    // 모든 예상 상품의 가격이 계산되었는지 확인
    const calculatedProductIds = new Set(calculatedPricesRef.current.keys());
    const calculationStatus = Array.from(expectedCalculationsRef.current).map(productId => {
      const priceData = calculatedPricesRef.current.get(productId);
      const status = {
        productId,
        hasData: !!priceData,
        '010신규': priceData?.['010신규']?.loading !== false,
        'MNP': priceData?.['MNP']?.loading !== false,
        '기변': priceData?.['기변']?.loading !== false
      };
      return status;
    });
    const allCalculated = calculationStatus.every(status => 
      status.hasData && 
      status['010신규'] === false &&
      status['MNP'] === false &&
      status['기변'] === false
    );
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TodaysMobileTab.js:useEffect-calculation-check',message:'가격 계산 상태 확인',data:{elapsedTime:Math.round(elapsedTime/1000),maxWaitTime:MAX_WAIT_TIME/1000,expectedCount:expectedCalculationsRef.current.size,calculatedCount:calculatedProductIds.size,allCalculated,calculationStatus:calculationStatus.slice(0,5),isInitializing},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    // 최대 대기 시간 초과 시 강제로 초기화 완료
    if (elapsedTime > MAX_WAIT_TIME) {
      console.warn('오늘의휴대폰 초기화 대기 시간 초과, 강제로 초기화 완료', {
        expectedCount: expectedCalculationsRef.current.size,
        calculatedCount: calculatedProductIds.size,
        missingProducts: Array.from(expectedCalculationsRef.current).filter(id => !calculatedProductIds.has(id))
      });
      setIsInitializing(false);
      expectedCalculationsRef.current.clear();
      initStartTimeRef.current = null;
      return;
    }

    if (allCalculated) {
      // 약간의 지연 후 다시 확인 (마지막 요청이 완료될 시간 확보)
      const timeoutId = setTimeout(() => {
        const finalAllCalculated = Array.from(expectedCalculationsRef.current).every(productId => {
          const priceData = calculatedPricesRef.current.get(productId);
          return priceData && 
                 priceData['010신규']?.loading === false &&
                 priceData['MNP']?.loading === false &&
                 priceData['기변']?.loading === false;
        });

        if (finalAllCalculated) {
          setIsInitializing(false);
          expectedCalculationsRef.current.clear();
          initStartTimeRef.current = null;
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [allProducts, isInitializing, priceCalculationTrigger]);

  // allProducts가 변경될 때 가격 계산 시작
  useEffect(() => {
    if (allProducts.length === 0) {
      setIsInitializing(false);
      return;
    }

    // 초기화 시작
    setIsInitializing(true);
    initStartTimeRef.current = Date.now();
    expectedCalculationsRef.current.clear();
    calculatedPricesRef.current.clear();

    // 모든 상품 ID를 예상 목록에 추가
    const productIds = [];
    allProducts.forEach(product => {
      if (product.id) {
        expectedCalculationsRef.current.add(product.id);
        productIds.push(product.id);
        // 초기 가격 데이터 설정
        calculatedPricesRef.current.set(product.id, {
          '010신규': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
          'MNP': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true },
          '기변': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: true }
        });
      }
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TodaysMobileTab.js:useEffect-init',message:'가격 계산 초기화 시작',data:{productCount:allProducts.length,productIds,expectedCount:expectedCalculationsRef.current.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
  }, [allProducts.map(p => p.id).join(',')]); // 상품 ID 목록이 변경될 때만 실행

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
  

  // Early return은 모든 훅 호출 이후에 위치
  if (loading || isInitializing) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          {isInitializing ? '가격 정보를 계산하는 중...' : '데이터를 불러오는 중...'}
        </Typography>
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
            ) : (() => {
              // 상품 그룹 표시 (6개씩 그리드)
              const currentSlide = slideshowData?.[currentSlideIndex];
              const isProductGroup = currentSlide?.type === 'productGroup' && currentSlide?.products;
              if (!isProductGroup || !currentSlide?.products || !Array.isArray(currentSlide.products)) return null;
              
              
              const carrier = currentSlide.carrier || 'SK';
              
              return (
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
                {currentSlide.products.map((product) => {
                  if (!product || typeof product !== 'object') return null;
                  
                  
                  const carrierTheme = getCarrierTheme(carrier);
                  const cachedPriceData = getPriceDataFromCache(product);
                  return (
                    <TodaysProductCard
                      key={product.id || `${product.model}-${product.carrier}`}
                      product={product}
                      isPremium={product.isPremium === true}
                      onSelect={onProductSelect}
                      compact={compact}
                      theme={carrierTheme}
                      priceData={cachedPriceData}
                      onPriceCalculated={handlePriceCalculated}
                    />
                  );
                })}
              </Box>
              );
            })()}
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
                ) : (() => {
                  // 상품 그룹 표시
                  const manualSlide = slideshowData?.[manualSlideIndex];
                  const isManualProductGroup = manualSlide?.type === 'productGroup' && manualSlide?.products;
                  if (!isManualProductGroup || !manualSlide?.products || !Array.isArray(manualSlide.products)) return null;
                  
                  const manualCarrier = manualSlide.carrier || 'SK';
                  
                  return (
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
                    {manualSlide.products.map((product) => {
                      if (!product || typeof product !== 'object') return null;
                      
                      
                      const carrierTheme = getCarrierTheme(manualCarrier);
                      const cachedPriceData = getPriceDataFromCache(product);
                      return (
                        <TodaysProductCard
                          key={product.id || `${product.model}-${product.carrier}`}
                          product={product}
                          isPremium={product.isPremium === true}
                          onSelect={onProductSelect}
                          compact={compact}
                          theme={carrierTheme}
                          priceData={cachedPriceData}
                          onPriceCalculated={handlePriceCalculated}
                        />
                      );
                    })}
                  </Box>
                  );
                })()}
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
                  if (!product || typeof product !== 'object') return null;
                  
                  const isPremium = product.isPremium || false;
                  const productCarrier = product.carrier || 'SK';
                  const carrierTheme = getCarrierTheme(productCarrier);
                  const cachedPriceData = getPriceDataFromCache(product);
                  return (
                    <TodaysProductCard
                      key={product.id}
                      product={product}
                      isPremium={isPremium}
                      onSelect={onProductSelect}
                      compact={compact}
                      theme={carrierTheme}
                      priceData={cachedPriceData}
                      onPriceCalculated={handlePriceCalculated}
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
