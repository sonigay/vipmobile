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
  CardMedia,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Paper,
  Collapse
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { directStoreApi } from '../../api/directStoreApi';
import { LoadingState } from './common/LoadingState';
import { ErrorState } from './common/ErrorState';
import TodaysProductCard from './TodaysProductCard';

const TodaysMobileTab = ({ isFullScreen, onProductSelect, loggedInStore }) => {
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
  const [isTransitioning, setIsTransitioning] = useState(false); // 전환 애니메이션 중인지

  // 수동 슬라이드 탐색 상태 (일반 모드)
  const [manualSlideIndex, setManualSlideIndex] = useState(0);
  const [isManualTransitionPage, setIsManualTransitionPage] = useState(false);
  const [manualTransitionPageData, setManualTransitionPageData] = useState(null);
  
  // 슬라이드 설정 상태 (각 슬라이드별 시간 및 전환 효과, 연결페이지 폰트/스타일)
  const [slideSettings, setSlideSettings] = useState({}); // { index: { duration, transitionEffect, fontSize, fontWeight, color, backgroundColor } }
  const [editingSlideIndex, setEditingSlideIndex] = useState(null); // 현재 편집 중인 슬라이드 인덱스
  const [savingSettings, setSavingSettings] = useState(false); // 설정 저장 중 상태

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

      // 🔥 핵심 수정: API 응답의 imageUrl 필드를 image로 매핑하고,
      // 기본 요금제군(defaultPlanGroup)을 미리 계산해둔다.
      // - 프리미엄: 기본 115군
      // - 중저가: 기본 33군
      // requiredAddons 필드도 제대로 전달되도록 확인
      const allMobiles = [...skMobiles, ...ktMobiles, ...lgMobiles].map(m => {
        let defaultPlanGroup = m.defaultPlanGroup || '115군';
        if (m.isBudget && !m.isPremium) {
          defaultPlanGroup = '33군';
        }

        return {
          ...m,
          image: m.imageUrl || m.image, // imageUrl을 image로 매핑
          addons: m.requiredAddons || m.addons || '', // requiredAddons를 addons로도 매핑 (하위 호환성)
          requiredAddons: m.requiredAddons || m.addons || '', // requiredAddons 필드 유지
          defaultPlanGroup
        };
      });

      // 필수 부가서비스 및 보험상품 로드 (통신사별)
      const policySettingsByCarrier = {};
      const carriers = ['SK', 'KT', 'LG'];
      
      try {
        const policyPromises = carriers.map(async (carrier) => {
          try {
            const policySettings = await directStoreApi.getPolicySettings(carrier);
            return { carrier, policySettings };
          } catch (err) {
            console.warn(`[TodaysMobileTab] ${carrier} 정책 설정 로드 실패:`, err);
            return { carrier, policySettings: null };
          }
        });
        
        const policyResults = await Promise.all(policyPromises);
        policyResults.forEach(({ carrier, policySettings }) => {
          if (policySettings) {
            policySettingsByCarrier[carrier] = policySettings;
          }
        });
      } catch (err) {
        console.error('[TodaysMobileTab] 필수 부가서비스 로드 실패:', err);
      }

      // 각 상품에 필수 부가서비스 및 보험상품 매핑
      const allMobilesWithAddons = allMobiles.map(m => {
        const policySettings = policySettingsByCarrier[m.carrier];
        const addonNames = [];
        
        // 1. 미유치차감금액이 있는 부가서비스 추가
        if (policySettings?.success && policySettings.addon?.list) {
          const addonList = policySettings.addon.list
            .filter(addon => addon.deduction > 0)
            .map(addon => addon.name);
          addonNames.push(...addonList);
        }
        
        // 2. 보험상품 매칭 (출고가 및 모델 유형 기준)
        if (policySettings?.success && policySettings.insurance?.list && m.factoryPrice > 0) {
          const insuranceList = policySettings.insurance.list || [];
          
          // 현재 단말이 플립/폴드 계열인지 여부 (펫네임/모델명 기준)
          const modelNameForCheck = (m.petName || m.model || '').toString();
          const lowerModelName = modelNameForCheck.toLowerCase();
          const flipFoldKeywords = ['플립', '폴드', 'flip', 'fold'];
          const isFlipFoldModel = flipFoldKeywords.some(keyword =>
            lowerModelName.includes(keyword.toLowerCase())
          );
          
          // 보험상품 중 이름에 플립/폴드 관련 키워드가 포함된 상품
          const flipFoldInsurances = insuranceList.filter(item => {
            const name = (item.name || '').toString().toLowerCase();
            return flipFoldKeywords.some(keyword =>
              name.includes(keyword.toLowerCase())
            );
          });
          
          // 일반 보험상품 (플립/폴드 전용 상품 제외)
          const normalInsurances = insuranceList.filter(item => !flipFoldInsurances.includes(item));
          
          let matchingInsurance = null;
          
          if (m.carrier === 'LG' && isFlipFoldModel && flipFoldInsurances.length > 0) {
            // LG + 플립/폴드 단말인 경우 → "폰교체 패스 플립/폴드" 상품 우선 사용
            matchingInsurance = flipFoldInsurances.find(insurance => {
              const minPrice = insurance.minPrice || 0;
              const maxPrice = insurance.maxPrice || 9999999;
              return m.factoryPrice >= minPrice && m.factoryPrice <= maxPrice;
            }) || flipFoldInsurances[0];
          } else {
            // 그 외 모델들은 플립/폴드 전용 상품을 제외한 나머지 보험상품에서 출고가로 매칭
            const baseList = normalInsurances.length > 0 ? normalInsurances : insuranceList;
            matchingInsurance = baseList.find(insurance => {
              const minPrice = insurance.minPrice || 0;
              const maxPrice = insurance.maxPrice || 9999999;
              return m.factoryPrice >= minPrice && m.factoryPrice <= maxPrice;
            });
          }
          
          if (matchingInsurance) {
            addonNames.push(matchingInsurance.name);
          }
        }
        
        // 필수 부가서비스 목록을 문자열로 변환
        // 정책 설정에서 가져온 부가서비스가 있으면 사용, 없으면 기존 값 사용
        const requiredAddonsStr = addonNames.length > 0 
          ? addonNames.join(', ') 
          : (m.requiredAddons || m.addons || '없음');
        
        // 디버깅: 필수부가 설정 확인
        if (process.env.NODE_ENV === 'development' && m.modelId) {
          console.log(`[필수부가] ${m.modelId} (${m.carrier}):`, {
            addonNames,
            requiredAddonsStr,
            originalRequiredAddons: m.requiredAddons,
            originalAddons: m.addons,
            policySettingsSuccess: policySettings?.success
          });
        }
        
        return {
          ...m,
          addons: requiredAddonsStr,
          requiredAddons: requiredAddonsStr
        };
      });

      // 프리미엄/중저가/인기/추천 등으로 필터링
      /* 
         규칙: 
         - Premium: isPremium === true
         - Budget: isBudget === true
         (Note: API 응답에 isPremium, isBudget 필드가 포함되어 있어야 함)
      */
      const premium = allMobilesWithAddons.filter(m => m.isPremium);
      const budget = allMobilesWithAddons.filter(m => m.isBudget);

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
        // purchasePrice 계산 (출고가 - 이통사지원금 - 대리점추가지원금)
        const purchasePriceWithAddon = Math.max(0, 
          (item.factoryPrice || 0) - (item.publicSupport || 0) - (item.storeSupportWithAddon || 0)
        );
        const purchasePriceWithoutAddon = Math.max(0,
          (item.factoryPrice || 0) - (item.publicSupport || 0) - (item.storeSupportWithoutAddon || 0)
        );

        // 계산된 purchasePrice를 포함한 객체 생성
        const priceItem = {
          ...item,
          purchasePriceWithAddon,
          purchasePriceWithoutAddon
        };

        const basicKey = `${item.modelId}-${item.openingType}`;
        const planGroupKey = `${item.modelId}-${item.planGroup}-${item.openingType}`;
        
        // 기본 키로 저장 (기존 호환성 유지)
        if (!pricingMap[basicKey]) {
          pricingMap[basicKey] = priceItem;
        }
        
        // 요금제군별 키로도 저장 (요금제군별 조회 가능)
        pricingMap[planGroupKey] = priceItem;
      });

      setMasterPricing(pricingMap);

      // 디버깅: 마스터 가격 데이터 로드 확인
      console.log('🔍 [TodaysMobileTab] 마스터 가격 데이터 로드 완료:', {
        totalItems: allPricing.length,
        pricingMapKeys: Object.keys(pricingMap).slice(0, 10), // 처음 10개 키만 표시
        sampleItem: pricingMap[Object.keys(pricingMap)[0]] // 첫 번째 아이템 샘플
      });

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

  // 매장별 설정 로드
  const loadStoreSettings = useCallback(async () => {
    if (!loggedInStore?.id) {
      // 매장 정보가 없으면 기본값만 로드
      await loadMainHeaderText();
      return;
    }

    try {
      setLoadSteps(prev => ({
        ...prev,
        header: { ...prev.header, status: 'loading', message: '' }
      }));

      // 매장별 메인페이지 문구 조회 (기본값 우선순위 처리)
      const storeTextsResponse = await directStoreApiClient.getStoreMainPageTexts(loggedInStore.id);
      if (storeTextsResponse.success && storeTextsResponse.data) {
        const data = storeTextsResponse.data;
        if (data.mainHeader?.content) {
          setMainHeaderText(data.mainHeader.content);
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem('direct-main-header-text', data.mainHeader.content);
            }
          } catch { }
        }
      }

      // 매장별 슬라이드쇼 설정 조회
      const settingsResponse = await directStoreApiClient.getStoreSlideshowSettings(loggedInStore.id);
      if (settingsResponse.success && settingsResponse.data) {
        const storeSettings = settingsResponse.data;
        if (storeSettings.slideSettings) {
          setSlideSettings(storeSettings.slideSettings);
        }
      }

      setLoadSteps(prev => ({
        ...prev,
        header: { ...prev.header, status: 'success', message: '' }
      }));
    } catch (err) {
      console.error('매장별 설정 로드 실패:', err);
      // 실패 시 기본값 로드
      await loadMainHeaderText();
      setLoadSteps(prev => ({
        ...prev,
        header: { ...prev.header, status: 'error', message: '설정 로드 실패' }
      }));
    }
  }, [loggedInStore?.id]);

  // 메인헤더 문구 로드 (기본값)
  const loadMainHeaderText = useCallback(async () => {
    try {
      const response = await directStoreApiClient.getMainHeaderText();
      if (response.success && response.data && response.data.content) {
        const content = response.data.content;
        setMainHeaderText(content);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('direct-main-header-text', content);
          }
        } catch { }
      }
    } catch (err) {
      console.error('메인헤더 문구 로드 실패:', err);
    }
  }, []);

  // 슬라이드쇼 설정 저장
  const saveSlideshowSettings = useCallback(async () => {
    if (!loggedInStore?.id) {
      alert('매장 정보가 없어 설정을 저장할 수 없습니다.');
      return;
    }

    try {
      setSavingSettings(true);

      // 연결페이지 텍스트 수집 (슬라이드 데이터에서)
      const transitionPageTexts = {};
      slideshowData.forEach((slide, index) => {
        if (slide.type === 'transition' && slide.carrier && slide.category) {
          if (!transitionPageTexts[slide.carrier]) {
            transitionPageTexts[slide.carrier] = {};
          }
          transitionPageTexts[slide.carrier][slide.category] = slide.content;
        }
      });

      const response = await directStoreApiClient.saveStoreSlideshowSettings(
        loggedInStore.id,
        slideSettings,
        mainHeaderText,
        transitionPageTexts
      );

      if (response.success) {
        alert('설정이 저장되었습니다.');
      } else {
        alert(`설정 저장 실패: ${response.error || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error('설정 저장 실패:', err);
      alert(`설정 저장 실패: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setSavingSettings(false);
    }
  }, [loggedInStore?.id, slideSettings, mainHeaderText, slideshowData]);

  // 초기 로드
  useEffect(() => {
    fetchData();
    loadStoreSettings();
  }, [fetchData, loadStoreSettings]);

  // 🔥 단방향 동기화: 휴대폰목록 페이지에서만 업로드 가능
  // 오늘의휴대폰 페이지에서는 업로드 기능 제거, 휴대폰목록에서 업로드 시에만 자동 반영

  // 이미지 업로드 이벤트 리스너 (다른 페이지에서 업로드 시)
  useEffect(() => {
    const handleImageUploaded = (event) => {
      console.log('🔄 [오늘의휴대폰] 이미지 업로드 이벤트 수신, 재로딩...');
      setTimeout(() => fetchData(), 3000); // 3초 후 재로딩 (서버 처리 시간 확보)
    };
    window.addEventListener('imageUploaded', handleImageUploaded);
    return () => window.removeEventListener('imageUploaded', handleImageUploaded);
  }, [fetchData]);

  // 가격 데이터 Lookup 함수 (TodaysProductCard용 prop 생성)
  const getPriceDataForProduct = useCallback((product) => {
    // product가 없으면 기본값 반환 (null 대신 항상 객체 반환)
    // product.id 또는 product.modelId 사용 (getMobilesMaster는 modelId를 반환)
    const modelId = product?.modelId || product?.id;
    if (!product || !modelId) {
      return {
        '010신규': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: false },
        'MNP': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: false },
        '기변': { publicSupport: 0, storeSupport: 0, purchasePrice: 0, loading: false }
      };
    }

    const openingTypes = ['010신규', 'MNP', '기변'];
    const result = {};

    // 기본 요금제군 결정 (프리미엄/중저가에 따라)
    let defaultPlanGroup = product.defaultPlanGroup || '115군';
    if (product.isBudget && !product.isPremium) {
      defaultPlanGroup = '33군';
    }

    // masterPricing이 비어있으면 기본값 반환 (로딩 완료 상태로 표시)
    const isMasterPricingLoaded = Object.keys(masterPricing).length > 0;

    // 마스터 가격 데이터에서 요금제군별로 찾기
    openingTypes.forEach(type => {
      // 안전장치: 직영점_단말요금정책 시트에는 'MNP'로 저장되어 있지만,
      // 혹시 모를 경우를 대비해 '번호이동'도 시도 (양방향 매핑)
      const alternativeType = type === 'MNP' ? '번호이동' : (type === '번호이동' ? 'MNP' : null);
      
      // 1순위: 요금제군별 키로 찾기 `${modelId}-${planGroup}-${openingType}`
      const planGroupKey = `${modelId}-${defaultPlanGroup}-${type}`;
      let pricing = masterPricing[planGroupKey];

      // 1-1순위: 대체 타입으로 요금제군별 키 시도 (MNP <-> 번호이동)
      if (!pricing && alternativeType) {
        const altPlanGroupKey = `${modelId}-${defaultPlanGroup}-${alternativeType}`;
        pricing = masterPricing[altPlanGroupKey];
      }

      // 2순위: 기본 키로 찾기 `${modelId}-${openingType}` (요금제군별 키가 없을 때)
      if (!pricing) {
        const basicKey = `${modelId}-${type}`;
        pricing = masterPricing[basicKey];
      }

      // 2-1순위: 대체 타입으로 기본 키 시도 (MNP <-> 번호이동)
      if (!pricing && alternativeType) {
        const altBasicKey = `${modelId}-${alternativeType}`;
        pricing = masterPricing[altBasicKey];
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
        
        // 디버깅: 데이터를 찾지 못한 경우
        if (isMasterPricingLoaded) {
          console.warn('⚠️ [TodaysMobileTab] 가격 데이터를 찾지 못함:', {
            modelId: modelId,
            productId: product.id,
            productModelId: product.modelId,
            productName: product.model || product.petName,
            planGroup: defaultPlanGroup,
            openingType: type,
            searchedKeys: [`${modelId}-${defaultPlanGroup}-${type}`, `${modelId}-${type}`],
            availableKeys: Object.keys(masterPricing).filter(k => k.includes(modelId)).slice(0, 5)
          });
        }
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

      // 매장별 연결페이지 텍스트 로드 (있으면 사용, 없으면 기본값)
      let storeTransitionTexts = {};
      if (loggedInStore?.id) {
        try {
          const storeTextsResponse = await directStoreApiClient.getStoreMainPageTexts(loggedInStore.id);
          if (storeTextsResponse.success && storeTextsResponse.data?.transitionPages) {
            storeTransitionTexts = storeTextsResponse.data.transitionPages;
          }
        } catch (err) {
          console.warn('매장별 연결페이지 텍스트 로드 실패:', err);
        }
      }

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

      // 필수 부가서비스 및 보험상품 로드 (통신사별) - 슬라이드쇼용
      const policySettingsByCarrier = {};
      try {
        const policyPromises = carriers.map(async (carrier) => {
          try {
            const policySettings = await directStoreApi.getPolicySettings(carrier);
            return { carrier, policySettings };
          } catch (err) {
            console.warn(`[TodaysMobileTab] 슬라이드쇼 ${carrier} 정책 설정 로드 실패:`, err);
            return { carrier, policySettings: null };
          }
        });
        
        const policyResults = await Promise.all(policyPromises);
        policyResults.forEach(({ carrier, policySettings }) => {
          if (policySettings) {
            policySettingsByCarrier[carrier] = policySettings;
          }
        });
      } catch (err) {
        console.error('[TodaysMobileTab] 슬라이드쇼 필수 부가서비스 로드 실패:', err);
      }

      // 🔥 핵심 수정: 슬라이드쇼 데이터 준비 시에도 imageUrl을 image로 매핑
      // requiredAddons 필드도 제대로 전달되도록 확인 (정책 설정에서 가져온 값 사용)
      // 보험상품도 포함하여 매핑
      const carrierMobiles = { 
        'SK': skMobiles.map(m => {
          const policySettings = policySettingsByCarrier['SK'];
          const addonNames = [];
          
          // 1. 미유치차감금액이 있는 부가서비스 추가
          if (policySettings?.success && policySettings.addon?.list) {
            const addonList = policySettings.addon.list
              .filter(addon => addon.deduction > 0)
              .map(addon => addon.name);
            addonNames.push(...addonList);
          }
          
          // 2. 보험상품 매칭 (출고가 및 모델 유형 기준)
          if (policySettings?.success && policySettings.insurance?.list && m.factoryPrice > 0) {
            const insuranceList = policySettings.insurance.list || [];
            
            // 현재 단말이 플립/폴드 계열인지 여부 (펫네임/모델명 기준)
            const modelNameForCheck = (m.petName || m.model || '').toString();
            const lowerModelName = modelNameForCheck.toLowerCase();
            const flipFoldKeywords = ['플립', '폴드', 'flip', 'fold'];
            const isFlipFoldModel = flipFoldKeywords.some(keyword =>
              lowerModelName.includes(keyword.toLowerCase())
            );
            
            // 보험상품 중 이름에 플립/폴드 관련 키워드가 포함된 상품
            const flipFoldInsurances = insuranceList.filter(item => {
              const name = (item.name || '').toString().toLowerCase();
              return flipFoldKeywords.some(keyword =>
                name.includes(keyword.toLowerCase())
              );
            });
            
            // 일반 보험상품 (플립/폴드 전용 상품 제외)
            const normalInsurances = insuranceList.filter(item => !flipFoldInsurances.includes(item));
            
            let matchingInsurance = null;
            
            if (m.carrier === 'LG' && isFlipFoldModel && flipFoldInsurances.length > 0) {
              // LG + 플립/폴드 단말인 경우 → "폰교체 패스 플립/폴드" 상품 우선 사용
              matchingInsurance = flipFoldInsurances.find(insurance => {
                const minPrice = insurance.minPrice || 0;
                const maxPrice = insurance.maxPrice || 9999999;
                return m.factoryPrice >= minPrice && m.factoryPrice <= maxPrice;
              }) || flipFoldInsurances[0];
            } else {
              // 그 외 모델들은 플립/폴드 전용 상품을 제외한 나머지 보험상품에서 출고가로 매칭
              const baseList = normalInsurances.length > 0 ? normalInsurances : insuranceList;
              matchingInsurance = baseList.find(insurance => {
                const minPrice = insurance.minPrice || 0;
                const maxPrice = insurance.maxPrice || 9999999;
                return m.factoryPrice >= minPrice && m.factoryPrice <= maxPrice;
              });
            }
            
            if (matchingInsurance) {
              addonNames.push(matchingInsurance.name);
            }
          }
          
          const requiredAddonsStr = addonNames.length > 0 
            ? addonNames.join(', ') 
            : (m.requiredAddons || m.addons || '');
          
          return {
            ...m, 
            image: m.imageUrl || m.image,
            addons: requiredAddonsStr,
            requiredAddons: requiredAddonsStr
          };
        }),
        'KT': ktMobiles.map(m => {
          const policySettings = policySettingsByCarrier['KT'];
          const addonNames = [];
          
          // 1. 미유치차감금액이 있는 부가서비스 추가
          if (policySettings?.success && policySettings.addon?.list) {
            const addonList = policySettings.addon.list
              .filter(addon => addon.deduction > 0)
              .map(addon => addon.name);
            addonNames.push(...addonList);
          }
          
          // 2. 보험상품 매칭 (출고가 및 모델 유형 기준)
          if (policySettings?.success && policySettings.insurance?.list && m.factoryPrice > 0) {
            const insuranceList = policySettings.insurance.list || [];
            
            // 현재 단말이 플립/폴드 계열인지 여부 (펫네임/모델명 기준)
            const modelNameForCheck = (m.petName || m.model || '').toString();
            const lowerModelName = modelNameForCheck.toLowerCase();
            const flipFoldKeywords = ['플립', '폴드', 'flip', 'fold'];
            const isFlipFoldModel = flipFoldKeywords.some(keyword =>
              lowerModelName.includes(keyword.toLowerCase())
            );
            
            // 보험상품 중 이름에 플립/폴드 관련 키워드가 포함된 상품
            const flipFoldInsurances = insuranceList.filter(item => {
              const name = (item.name || '').toString().toLowerCase();
              return flipFoldKeywords.some(keyword =>
                name.includes(keyword.toLowerCase())
              );
            });
            
            // 일반 보험상품 (플립/폴드 전용 상품 제외)
            const normalInsurances = insuranceList.filter(item => !flipFoldInsurances.includes(item));
            
            let matchingInsurance = null;
            
            if (m.carrier === 'LG' && isFlipFoldModel && flipFoldInsurances.length > 0) {
              // LG + 플립/폴드 단말인 경우 → "폰교체 패스 플립/폴드" 상품 우선 사용
              matchingInsurance = flipFoldInsurances.find(insurance => {
                const minPrice = insurance.minPrice || 0;
                const maxPrice = insurance.maxPrice || 9999999;
                return m.factoryPrice >= minPrice && m.factoryPrice <= maxPrice;
              }) || flipFoldInsurances[0];
            } else {
              // 그 외 모델들은 플립/폴드 전용 상품을 제외한 나머지 보험상품에서 출고가로 매칭
              const baseList = normalInsurances.length > 0 ? normalInsurances : insuranceList;
              matchingInsurance = baseList.find(insurance => {
                const minPrice = insurance.minPrice || 0;
                const maxPrice = insurance.maxPrice || 9999999;
                return m.factoryPrice >= minPrice && m.factoryPrice <= maxPrice;
              });
            }
            
            if (matchingInsurance) {
              addonNames.push(matchingInsurance.name);
            }
          }
          
          const requiredAddonsStr = addonNames.length > 0 
            ? addonNames.join(', ') 
            : (m.requiredAddons || m.addons || '');
          
          return {
            ...m, 
            image: m.imageUrl || m.image,
            addons: requiredAddonsStr,
            requiredAddons: requiredAddonsStr
          };
        }),
        'LG': lgMobiles.map(m => {
          const policySettings = policySettingsByCarrier['LG'];
          const addonNames = [];
          
          // 1. 미유치차감금액이 있는 부가서비스 추가
          if (policySettings?.success && policySettings.addon?.list) {
            const addonList = policySettings.addon.list
              .filter(addon => addon.deduction > 0)
              .map(addon => addon.name);
            addonNames.push(...addonList);
          }
          
          // 2. 보험상품 매칭 (출고가 및 모델 유형 기준)
          if (policySettings?.success && policySettings.insurance?.list && m.factoryPrice > 0) {
            const insuranceList = policySettings.insurance.list || [];
            
            // 현재 단말이 플립/폴드 계열인지 여부 (펫네임/모델명 기준)
            const modelNameForCheck = (m.petName || m.model || '').toString();
            const lowerModelName = modelNameForCheck.toLowerCase();
            const flipFoldKeywords = ['플립', '폴드', 'flip', 'fold'];
            const isFlipFoldModel = flipFoldKeywords.some(keyword =>
              lowerModelName.includes(keyword.toLowerCase())
            );
            
            // 보험상품 중 이름에 플립/폴드 관련 키워드가 포함된 상품
            const flipFoldInsurances = insuranceList.filter(item => {
              const name = (item.name || '').toString().toLowerCase();
              return flipFoldKeywords.some(keyword =>
                name.includes(keyword.toLowerCase())
              );
            });
            
            // 일반 보험상품 (플립/폴드 전용 상품 제외)
            const normalInsurances = insuranceList.filter(item => !flipFoldInsurances.includes(item));
            
            let matchingInsurance = null;
            
            if (m.carrier === 'LG' && isFlipFoldModel && flipFoldInsurances.length > 0) {
              // LG + 플립/폴드 단말인 경우 → "폰교체 패스 플립/폴드" 상품 우선 사용
              matchingInsurance = flipFoldInsurances.find(insurance => {
                const minPrice = insurance.minPrice || 0;
                const maxPrice = insurance.maxPrice || 9999999;
                return m.factoryPrice >= minPrice && m.factoryPrice <= maxPrice;
              }) || flipFoldInsurances[0];
            } else {
              // 그 외 모델들은 플립/폴드 전용 상품을 제외한 나머지 보험상품에서 출고가로 매칭
              const baseList = normalInsurances.length > 0 ? normalInsurances : insuranceList;
              matchingInsurance = baseList.find(insurance => {
                const minPrice = insurance.minPrice || 0;
                const maxPrice = insurance.maxPrice || 9999999;
                return m.factoryPrice >= minPrice && m.factoryPrice <= maxPrice;
              });
            }
            
            if (matchingInsurance) {
              addonNames.push(matchingInsurance.name);
            }
          }
          
          const requiredAddonsStr = addonNames.length > 0 
            ? addonNames.join(', ') 
            : (m.requiredAddons || m.addons || '');
          
          return {
            ...m, 
            image: m.imageUrl || m.image,
            addons: requiredAddonsStr,
            requiredAddons: requiredAddonsStr
          };
        })
      };

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

        // Budget Group (먼저 표시)
        if (budget.length > 0) {
          // 첫 번째 통신사이고 첫 번째 그룹이 아닐 때, 또는 이미 아이템이 있을 때 연결 페이지 추가
          // Premium Group과 동일한 로직 적용
          if (i > 0 || slideshowItems.length > 0) {
            // 매장별 설정이 있으면 우선 사용, 없으면 기본값
            // storeTransitionTexts는 이미 매장별 설정과 기본값이 병합된 상태
            const transitionText = storeTransitionTexts[carrier]?.['budget'];
            const content = transitionText?.content || `이어서 ${carrier} 중저가 상품 안내입니다.`;
            const imageUrl = transitionText?.imageUrl || '';
            
            slideshowItems.push({
              type: 'transition',
              carrier,
              category: 'budget',
              content,
              imageUrl,
              duration: 3000, // 기본값: 3초
              transitionEffect: 'fade' // 기본값: fade
            });
          }
          for (let j = 0; j < budget.length; j += PRODUCTS_PER_SLIDE) {
            slideshowItems.push({
              type: 'productGroup',
              products: budget.slice(j, j + PRODUCTS_PER_SLIDE),
              carrier,
              category: 'budget',
              duration: 5000, // 기본값: 5초
              transitionEffect: 'fade' // 기본값: fade
            });
          }
        }

        // Premium Group (Budget 이후 표시)
        if (premium.length > 0) {
          // Budget이 있었거나 이미 아이템이 있으면 연결 페이지 추가
          if (budget.length > 0 || slideshowItems.length > 0) {
            // 매장별 설정이 있으면 우선 사용, 없으면 기본값
            // storeTransitionTexts는 이미 매장별 설정과 기본값이 병합된 상태
            const transitionText = storeTransitionTexts[carrier]?.['premium'];
            const content = transitionText?.content || `이어서 ${carrier} 프리미엄 상품 안내입니다.`;
            const imageUrl = transitionText?.imageUrl || '';
            
            slideshowItems.push({
              type: 'transition',
              carrier,
              category: 'premium',
              content,
              imageUrl,
              duration: 3000, // 기본값: 3초
              transitionEffect: 'fade' // 기본값: fade
            });
          }
          for (let j = 0; j < premium.length; j += PRODUCTS_PER_SLIDE) {
            slideshowItems.push({
              type: 'productGroup',
              products: premium.slice(j, j + PRODUCTS_PER_SLIDE),
              carrier,
              category: 'premium',
              duration: 5000, // 기본값: 5초
              transitionEffect: 'fade' // 기본값: fade
            });
          }
          
          // Premium 이후 Budget이 있으면 Budget 연결 페이지 추가
          if (budget.length > 0) {
            const transitionText = storeTransitionTexts[carrier]?.['budget'];
            const content = transitionText?.content || `이어서 ${carrier} 중저가 상품 안내입니다.`;
            const imageUrl = transitionText?.imageUrl || '';
            
            slideshowItems.push({
              type: 'transition',
              carrier,
              category: 'budget',
              content,
              imageUrl,
              duration: 3000, // 기본값: 3초
              transitionEffect: 'fade' // 기본값: fade
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
              imageUrl: tText.data?.imageUrl || '',
              duration: 3000, // 기본값: 3초
              transitionEffect: 'fade' // 기본값: fade
            });
          } else if (hasNextBudget) {
            const tText = await directStoreApiClient.getTransitionPageText(nextCarrier, 'budget');
            slideshowItems.push({
              type: 'transition',
              carrier: nextCarrier,
              category: 'budget',
              content: tText.data?.content || `이어서 ${nextCarrier} 중저가 상품 안내입니다.`,
              imageUrl: tText.data?.imageUrl || '',
              duration: 3000, // 기본값: 3초
              transitionEffect: 'fade' // 기본값: fade
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
  }, [loggedInStore?.id]); // loggedInStore.id가 변경되면 재로드

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

  // 전환 효과 스타일 생성 함수
  const getTransitionStyle = useCallback((effect, isEntering) => {
    const baseStyle = {
      transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      width: '100%',
      height: '100%'
    };

    switch (effect) {
      case 'fade':
        return {
          ...baseStyle,
          opacity: isEntering ? 1 : 0
        };
      case 'slideLeft':
        return {
          ...baseStyle,
          transform: isEntering ? 'translateX(0)' : 'translateX(100%)',
          opacity: isEntering ? 1 : 0
        };
      case 'slideRight':
        return {
          ...baseStyle,
          transform: isEntering ? 'translateX(0)' : 'translateX(-100%)',
          opacity: isEntering ? 1 : 0
        };
      case 'slideUp':
        return {
          ...baseStyle,
          transform: isEntering ? 'translateY(0)' : 'translateY(100%)',
          opacity: isEntering ? 1 : 0
        };
      case 'slideDown':
        return {
          ...baseStyle,
          transform: isEntering ? 'translateY(0)' : 'translateY(-100%)',
          opacity: isEntering ? 1 : 0
        };
      case 'zoomIn':
        return {
          ...baseStyle,
          transform: isEntering ? 'scale(1)' : 'scale(0.5)',
          opacity: isEntering ? 1 : 0
        };
      case 'zoomOut':
        return {
          ...baseStyle,
          transform: isEntering ? 'scale(1)' : 'scale(1.5)',
          opacity: isEntering ? 1 : 0
        };
      case 'flipX':
        return {
          ...baseStyle,
          transform: isEntering ? 'rotateY(0deg)' : 'rotateY(90deg)',
          opacity: isEntering ? 1 : 0,
          transformStyle: 'preserve-3d'
        };
      case 'flipY':
        return {
          ...baseStyle,
          transform: isEntering ? 'rotateX(0deg)' : 'rotateX(90deg)',
          opacity: isEntering ? 1 : 0,
          transformStyle: 'preserve-3d'
        };
      case 'rotate':
        return {
          ...baseStyle,
          transform: isEntering ? 'rotate(0deg) scale(1)' : 'rotate(180deg) scale(0.8)',
          opacity: isEntering ? 1 : 0
        };
      default:
        return baseStyle;
    }
  }, []);

  // 슬라이드쇼 타이머
  useEffect(() => {
    if (!isSlideshowActive || slideshowData.length === 0) return;

    const currentItem = slideshowData[currentSlideIndex];
    // 설정된 duration이 있으면 사용, 없으면 기본값
    const duration = slideSettings[currentSlideIndex]?.duration || currentItem?.duration || (currentItem?.type === 'transition' ? 3000 : 5000);

    const timer = setTimeout(() => {
      setIsTransitioning(true);
      // 전환 애니메이션 시간 (0.8초)
      setTimeout(() => {
        setCurrentSlideIndex(prev => {
          const next = prev + 1;
          if (next >= slideshowData.length) {
            if (isSlideshowLooping) {
              const first = slideshowData[0];
              setIsTransitionPage(first?.type === 'transition');
              setTransitionPageData(first?.type === 'transition' ? first : null);
              if (first?.carrier) setCurrentCarrier(first.carrier);
              setIsTransitioning(false);
              return 0;
            } else {
              setIsSlideshowActive(false);
              setCurrentSlideIndex(0);
              setIsTransitioning(false);
              return 0;
            }
          }

          const nextItem = slideshowData[next];
          setIsTransitionPage(nextItem.type === 'transition');
          setTransitionPageData(nextItem.type === 'transition' ? nextItem : null);
          if (nextItem.carrier) setCurrentCarrier(nextItem.carrier);
          setIsTransitioning(false);
          return next;
        });
      }, 800); // 전환 애니메이션 시간
    }, duration);

    return () => clearTimeout(timer);
  }, [isSlideshowActive, slideshowData, currentSlideIndex, isSlideshowLooping, slideSettings]);

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
    <Box sx={{ p: isFullScreen ? 0 : 3, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>

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
          p: 2,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 메인 헤더 문구 (슬라이드쇼 모드에도 표시) */}
          {mainHeaderText && (
            <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'primary.main', color: 'white', textAlign: 'center', flexShrink: 0 }}>
              <Typography variant="h6" fontWeight="bold">{mainHeaderText}</Typography>
            </Box>
          )}
          
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {isTransitionPage && transitionPageData ? (
            // 연결 페이지 (전환 효과 적용)
            <Box sx={{
              height: '100%', 
              width: '100%',
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${getCarrierTheme(transitionPageData.carrier).cardBg} 0%, ${getCarrierTheme(transitionPageData.carrier).primary}15 100%)`,
              p: 4,
              position: 'absolute',
              top: 0,
              left: 0,
              ...getTransitionStyle(
                slideSettings[currentSlideIndex]?.transitionEffect || transitionPageData.transitionEffect || 'fade',
                !isTransitioning
              )
            }}>
              {transitionPageData.imageUrl ? (
                <CardMedia
                  component="img"
                  image={transitionPageData.imageUrl}
                  sx={{ 
                    maxHeight: '50%', 
                    maxWidth: '70%', 
                    objectFit: 'contain', 
                    mb: 6,
                    filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.3))'
                  }}
                />
              ) : null}
              <Typography 
                variant="h1" 
                fontWeight={slideSettings[currentSlideIndex]?.fontWeight || '900'}
                color={slideSettings[currentSlideIndex]?.color || 'primary.main'}
                textAlign="center"
                sx={{
                  fontSize: slideSettings[currentSlideIndex]?.fontSize 
                    ? { xs: `${Math.max(1, slideSettings[currentSlideIndex].fontSize * 0.5)}rem`, sm: `${Math.max(2, slideSettings[currentSlideIndex].fontSize * 0.7)}rem`, md: `${slideSettings[currentSlideIndex].fontSize}rem`, lg: `${slideSettings[currentSlideIndex].fontSize * 1.2}rem` }
                    : { xs: '3rem', sm: '4rem', md: '5rem', lg: '6rem' },
                  lineHeight: 1.2,
                  textShadow: '2px 2px 8px rgba(0,0,0,0.2)',
                  letterSpacing: '0.05em',
                  px: 4,
                  py: 2,
                  background: slideSettings[currentSlideIndex]?.backgroundColor
                    ? `linear-gradient(135deg, ${slideSettings[currentSlideIndex].backgroundColor}E6 0%, ${slideSettings[currentSlideIndex].backgroundColor}B3 100%)`
                    : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                  borderRadius: 4,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                  maxWidth: '90%',
                  wordBreak: 'keep-all'
                }}
              >
                {transitionPageData.content}
              </Typography>
            </Box>
          ) : (
            // 상품 목록 페이지 (전환 효과 적용)
            <Box sx={{
              height: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
              p: 4,
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              ...getTransitionStyle(
                slideSettings[currentSlideIndex]?.transitionEffect || slideshowData[currentSlideIndex]?.transitionEffect || 'fade',
                !isTransitioning
              )
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
        </Box>
      ) : (
        // === 일반 그리드 모드 ===
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {/* 모든 체크 상품 미리보기 */}
          {slideshowData.length > 0 && (
            <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              {/* 메인 헤더 문구 (미리보기 섹션에도 표시) */}
              {mainHeaderText && (
                <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight="bold">{mainHeaderText}</Typography>
                  {loggedInStore?.id && (
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ mt: 1, color: 'white', borderColor: 'white' }}
                      onClick={() => {
                        const newText = prompt('메인 헤더 문구를 입력하세요:', mainHeaderText);
                        if (newText !== null && newText !== mainHeaderText) {
                          setMainHeaderText(newText);
                        }
                      }}
                    >
                      문구 수정
                    </Button>
                  )}
                </Box>
              )}
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">모든 체크 상품 미리보기 ({slideshowData.length} 슬라이드)</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SettingsIcon />}
                    onClick={() => setEditingSlideIndex(editingSlideIndex === manualSlideIndex ? null : manualSlideIndex)}
                  >
                    {editingSlideIndex === manualSlideIndex ? '설정 닫기' : '슬라이드 설정'}
                  </Button>
                  {loggedInStore?.id && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SaveIcon />}
                      onClick={saveSlideshowSettings}
                      disabled={savingSettings}
                    >
                      {savingSettings ? '저장 중...' : '설정 저장'}
                    </Button>
                  )}
                  <IconButton onClick={() => handleManualSlideChange('prev')}><ArrowBackIcon /></IconButton>
                  <IconButton onClick={() => handleManualSlideChange('next')}><ArrowForwardIcon /></IconButton>
                </Box>
              </Box>

              {/* 슬라이드 설정 패널 */}
              {editingSlideIndex === manualSlideIndex && slideshowData[manualSlideIndex] && (
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    슬라이드 {manualSlideIndex + 1} 설정
                    {slideshowData[manualSlideIndex].type === 'transition' && ' (연결 페이지)'}
                    {slideshowData[manualSlideIndex].type === 'productGroup' && ' (상품 페이지)'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                    <TextField
                      label="표시 시간 (밀리초)"
                      type="number"
                      size="small"
                      value={slideSettings[manualSlideIndex]?.duration || slideshowData[manualSlideIndex].duration || (slideshowData[manualSlideIndex].type === 'transition' ? 3000 : 5000)}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1000;
                        setSlideSettings(prev => ({
                          ...prev,
                          [manualSlideIndex]: {
                            ...prev[manualSlideIndex],
                            duration: value
                          }
                        }));
                      }}
                      inputProps={{ min: 1000, max: 30000, step: 500 }}
                      sx={{ minWidth: 200 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>전환 효과</InputLabel>
                      <Select
                        value={slideSettings[manualSlideIndex]?.transitionEffect || slideshowData[manualSlideIndex].transitionEffect || 'fade'}
                        label="전환 효과"
                        onChange={(e) => {
                          setSlideSettings(prev => ({
                            ...prev,
                            [manualSlideIndex]: {
                              ...prev[manualSlideIndex],
                              transitionEffect: e.target.value
                            }
                          }));
                        }}
                      >
                        <MenuItem value="fade">페이드 (Fade)</MenuItem>
                        <MenuItem value="slideLeft">슬라이드 좌 (Slide Left)</MenuItem>
                        <MenuItem value="slideRight">슬라이드 우 (Slide Right)</MenuItem>
                        <MenuItem value="slideUp">슬라이드 상 (Slide Up)</MenuItem>
                        <MenuItem value="slideDown">슬라이드 하 (Slide Down)</MenuItem>
                        <MenuItem value="zoomIn">줌 인 (Zoom In)</MenuItem>
                        <MenuItem value="zoomOut">줌 아웃 (Zoom Out)</MenuItem>
                        <MenuItem value="flipX">플립 X (Flip X)</MenuItem>
                        <MenuItem value="flipY">플립 Y (Flip Y)</MenuItem>
                        <MenuItem value="rotate">회전 (Rotate)</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  
                  {/* 연결 페이지 전용 설정 (텍스트, 폰트 크기, 스타일, 색상) */}
                  {slideshowData[manualSlideIndex]?.type === 'transition' && (
                    <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        연결 페이지 설정
                      </Typography>
                      <TextField
                        label="연결 페이지 문구"
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                        value={slideshowData[manualSlideIndex]?.content || ''}
                        onChange={(e) => {
                          const newContent = e.target.value;
                          setSlideshowData(prev => {
                            const updated = [...prev];
                            if (updated[manualSlideIndex]) {
                              updated[manualSlideIndex] = {
                                ...updated[manualSlideIndex],
                                content: newContent
                              };
                            }
                            return updated;
                          });
                          // manualTransitionPageData도 업데이트
                          if (isManualTransitionPage && manualTransitionPageData) {
                            setManualTransitionPageData({
                              ...manualTransitionPageData,
                              content: newContent
                            });
                          }
                        }}
                        sx={{ mt: 2, mb: 2 }}
                      />
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                        연결 페이지 스타일 설정
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                        <TextField
                          label="폰트 크기 (rem)"
                          type="number"
                          size="small"
                          value={slideSettings[manualSlideIndex]?.fontSize || 5}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 3;
                            setSlideSettings(prev => ({
                              ...prev,
                              [manualSlideIndex]: {
                                ...prev[manualSlideIndex],
                                fontSize: value
                              }
                            }));
                          }}
                          inputProps={{ min: 1, max: 10, step: 0.5 }}
                          sx={{ minWidth: 150 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel>폰트 굵기</InputLabel>
                          <Select
                            value={slideSettings[manualSlideIndex]?.fontWeight || '900'}
                            label="폰트 굵기"
                            onChange={(e) => {
                              setSlideSettings(prev => ({
                                ...prev,
                                [manualSlideIndex]: {
                                  ...prev[manualSlideIndex],
                                  fontWeight: e.target.value
                                }
                              }));
                            }}
                          >
                            <MenuItem value="300">Light (300)</MenuItem>
                            <MenuItem value="400">Regular (400)</MenuItem>
                            <MenuItem value="500">Medium (500)</MenuItem>
                            <MenuItem value="600">Semi Bold (600)</MenuItem>
                            <MenuItem value="700">Bold (700)</MenuItem>
                            <MenuItem value="800">Extra Bold (800)</MenuItem>
                            <MenuItem value="900">Black (900)</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="텍스트 색상"
                          type="color"
                          size="small"
                          value={slideSettings[manualSlideIndex]?.color || '#1976d2'}
                          onChange={(e) => {
                            setSlideSettings(prev => ({
                              ...prev,
                              [manualSlideIndex]: {
                                ...prev[manualSlideIndex],
                                color: e.target.value
                              }
                            }));
                          }}
                          sx={{ minWidth: 120 }}
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          label="배경 색상"
                          type="color"
                          size="small"
                          value={slideSettings[manualSlideIndex]?.backgroundColor || '#ffffff'}
                          onChange={(e) => {
                            setSlideSettings(prev => ({
                              ...prev,
                              [manualSlideIndex]: {
                                ...prev[manualSlideIndex],
                                backgroundColor: e.target.value
                              }
                            }));
                          }}
                          sx={{ minWidth: 120 }}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Box>
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    현재 슬라이드: {manualSlideIndex + 1} / {slideshowData.length}
                  </Typography>
                </Paper>
              )}

              <Box sx={{ height: '70vh', minHeight: 600, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'auto', position: 'relative' }}>
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
