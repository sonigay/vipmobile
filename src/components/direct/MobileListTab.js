import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Button,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  FormControlLabel,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Autocomplete,
  TextField,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Edit as EditIcon,
  Recommend as RecommendIcon,
  Star as StarIcon,
  Label as LabelIcon,
  Refresh as RefreshIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { Checkbox } from '@mui/material';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { getCachedPrice, setCachedPrice, setCachedPricesBatch } from '../../utils/priceCache';
import { LoadingState } from './common/LoadingState';
import { ErrorState, EmptyState } from './common/ErrorState';
import { ModernTable, ModernTableCell, HoverableTableRow, EmptyTableRow } from './common/ModernTable';
import { formatPrice } from '../../utils/directStoreUtils';
import { MobileListRow } from './MobileListRow';
import { debugLog } from '../../utils/debugLogger';

const MobileListTab = ({ onProductSelect, isCustomerMode = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [carrierTab, setCarrierTab] = useState(0); // 0: LG, 1: KT, 2: SK
  const [mobileList, setMobileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 초기화 완료 여부 (마스터 데이터 로딩 완료 여부)
  const [isInitializing, setIsInitializing] = useState(false);
  // 로딩 단계 상태 (UI 표시용)
  const [steps, setSteps] = useState({
    fetch: { label: '데이터 로드', status: 'idle', message: '' },
    pricing: { label: '가격 반영', status: 'idle', message: '' }
  });
  const [tagMenuAnchor, setTagMenuAnchor] = useState({}); // { modelId: anchorElement }
  const [planGroups, setPlanGroups] = useState([]); // 요금제군 목록
  const [selectedPlanGroups, setSelectedPlanGroups] = useState({}); // { modelId: planGroup }
  const [selectedOpeningTypes, setSelectedOpeningTypes] = useState({}); // { modelId: openingType }
  const [calculatedPrices, setCalculatedPrices] = useState({}); // { modelId-openingType: PriceObj }
  const [reloadTrigger, setReloadTrigger] = useState(0); // 새로고침 트리거
  const [policySettings, setPolicySettings] = useState(null); // 🔥 정책 설정 저장
  const [refreshingAllImages, setRefreshingAllImages] = useState(false); // 전체 이미지 갱신 상태

  const pricingDataRef = useRef(new Map()); // Key: modelId-planGroup-openingType -> PriceData
  const userSelectedOpeningTypesRef = useRef(new Set()); // 사용자가 수동으로 선택한 개통유형 추적
  const initializedRef = useRef(false);
  const headerScrollRef = useRef(null); // 헤더 스크롤 컨테이너 ref
  const bodyScrollRef = useRef(null); // 본문 스크롤 컨테이너 ref
  const isScrollingRef = useRef(false); // 스크롤 동기화 중 플래그

  // 개통 유형 목록 (고정)
  const openingTypes = ['010신규', 'MNP', '기변'];

  const handleCarrierChange = (event, newValue) => {
    setCarrierTab(newValue);
    initializedRef.current = false;
    userSelectedOpeningTypesRef.current.clear();
    setCalculatedPrices({});
    setMobileList([]);
  };

  const getCurrentCarrier = useCallback(() => {
    switch (carrierTab) {
      case 0: return 'LG';
      case 1: return 'KT';
      case 2: return 'SK';
      default: return 'LG';
    }
  }, [carrierTab]);

  // 통합 데이터 로딩 (Master API 사용)
  useEffect(() => {
    const fetchData = async () => {
      const carrier = getCurrentCarrier();

      setLoading(true);
      setError(null);
      setSteps({
        fetch: { label: '마스터 데이터 로드', status: 'loading', message: '단말/요금/정책 수신 중...' },
        pricing: { label: '가격 매핑', status: 'idle', message: '' }
      });

      try {
        // 병렬 요청: 단말마스터, 요금정책마스터, 요금제마스터
        const [mobiles, pricing, plans] = await Promise.all([
          directStoreApiClient.getMobilesMaster(carrier),
          directStoreApiClient.getMobilesPricing(carrier),
          directStoreApiClient.getPlansMaster(carrier)
        ]);

        // 가격 데이터가 비어있는 경우 경고
        if (!pricing || pricing.length === 0) {
          console.warn('⚠️ [휴대폰시세표] 가격 데이터가 비어있습니다. 서버가 아직 데이터를 준비하지 않았을 수 있습니다.');
        }

        // 1. 요금제군 목록 추출 (plans-master 기반)
        const uniqueGroups = [...new Set(plans.map(p => p.planGroup))].filter(Boolean);
        setPlanGroups(uniqueGroups);

        // 2. 요금정책 데이터 인덱싱 (Lookup Map 생성)
        // 🔥 수정: 시트에 '010신규/기변'으로 저장된 데이터를 '010신규'와 '기변'에도 매핑
        const priceMap = new Map();
        pricing.forEach(p => {
          // 키: modelId-planGroup-openingType
          // openingType 정규화: 서버는 '010신규', 'MNP', '기변', '010신규/기변' 등으로 줌
          const baseKey = `${p.modelId}-${p.planGroup}-${p.openingType}`;
          priceMap.set(baseKey, p);
          
          // 🔥 수정: '010신규/기변'으로 저장된 데이터를 '010신규'와 '기변'에도 매핑
          // 이통사지원금은 '010신규'와 '기변'이 동일하므로, 시트에 '010신규/기변'으로 저장된 경우
          // '010신규'나 '기변'으로 조회할 때도 같은 이통사지원금을 반환해야 함
          if (p.openingType === '010신규/기변') {
            const key010 = `${p.modelId}-${p.planGroup}-010신규`;
            const key기변 = `${p.modelId}-${p.planGroup}-기변`;
            // 이미 해당 키에 데이터가 없을 때만 설정 (우선순위: 개별 유형 > 통합 유형)
            if (!priceMap.has(key010)) {
              priceMap.set(key010, { ...p, openingType: '010신규' });
            }
            if (!priceMap.has(key기변)) {
              priceMap.set(key기변, { ...p, openingType: '기변' });
            }
          }
        });
        pricingDataRef.current = priceMap;

        // 3. 단말 목록 처리 및 초기 가격 계산
        setSteps(prev => ({
          ...prev,
          fetch: { ...prev.fetch, status: 'success', message: '' },
          pricing: { label: '가격 매핑', status: 'loading', message: '화면 구성 중...' }
        }));

        const newCalculated = {};
        const newSelectedPlans = {};
        const newSelectedTypes = {};

        const modList = mobiles.map(m => {
          // 기본값 결정
          // 태그 기반 요금제군
          let defPlan = '115군';
          if (m.isBudget && !m.isPremium) defPlan = '33군';
          if (!uniqueGroups.includes(defPlan) && uniqueGroups.length > 0) defPlan = uniqueGroups[0];

          // 기본 개통유형
          const defType = 'MNP';

          // 상태 저장
          newSelectedPlans[m.modelId] = defPlan;
          newSelectedTypes[m.modelId] = defType;

            // 초기 가격 Lookup
            // Key: modelId-defPlan-defType
            const priceKey = `${m.modelId}-${defPlan}-${defType}`;
            const priceData = priceMap.get(priceKey);

            let publicSupport = 0;

            if (priceData) {
              publicSupport = priceData.publicSupport || 0;
              const storeSupportWith = priceData.storeSupportWithAddon || 0;

              // 🔥 수정: 부가미유치 기준 제거, 부가유치 기준만 사용
              // calculatedPrices 초기화
              newCalculated[`${m.modelId}-${defType}`] = {
                storeSupportWithAddon: storeSupportWith,
                purchasePriceWithAddon: Math.max(0, m.factoryPrice - publicSupport - storeSupportWith),
                publicSupport: publicSupport,
                openingType: defType
              };
            } else {
              // 가격 정보 없음 - 0 처리
              newCalculated[`${m.modelId}-${defType}`] = {
                storeSupportWithAddon: 0,
                purchasePriceWithAddon: m.factoryPrice,
                publicSupport: 0,
                openingType: defType
              };
            }

          // Mobile object mapping (기존 UI 호환성)
          return {
            id: m.modelId, // ID 매핑
            model: m.model,
            petName: m.petName,
            carrier: m.carrier,
            factoryPrice: m.factoryPrice,
            image: m.imageUrl,
            isPremium: m.isPremium,
            isBudget: m.isBudget,
            isPopular: m.isPopular,
            isRecommended: m.isRecommended,
            isCheap: m.isCheap,
            publicSupport: publicSupport, // 초기값
            support: publicSupport, // Legacy field support
            discordMessageId: m.discordMessageId, // Discord 메시지 ID
            discordThreadId: m.discordThreadId, // Discord 스레드 ID
            modelId: m.modelId // modelId 필드 유지
          };
        });

        // 상태 일괄 업데이트
        setMobileList(modList);
        setCalculatedPrices(newCalculated);
        setSelectedPlanGroups(newSelectedPlans);
        setSelectedOpeningTypes(newSelectedTypes);

        setSteps(prev => ({
          ...prev,
          pricing: { label: '완료', status: 'success', message: '' }
        }));

        initializedRef.current = true;
      } catch (err) {
        console.error('데이터 로딩 실패:', err);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        setSteps(prev => ({
          ...prev,
          fetch: { ...prev.fetch, status: 'error', message: err.message }
        }));
      } finally {
        setLoading(false);
        setIsInitializing(false);
      }
    };

    fetchData();
  }, [carrierTab, getCurrentCarrier, reloadTrigger]);

  // 🔥 정책 설정 로드
  useEffect(() => {
    const loadPolicySettings = async () => {
      const carrier = getCurrentCarrier();
      try {
        const settings = await directStoreApiClient.getPolicySettings(carrier);
        setPolicySettings(settings);
      } catch (err) {
        console.error('[MobileListTab] 정책 설정 로드 실패:', err);
        setPolicySettings(null);
      }
    };
    loadPolicySettings();
  }, [getCurrentCarrier]);

  const handleReload = () => {
    // reloadTrigger를 증가시켜 useEffect 재실행
    setReloadTrigger(prev => prev + 1);
    initializedRef.current = false;
    setLoading(true);
    setError(null);
  };

  // 전체 이미지 갱신 함수 (배치 처리)
  const handleRefreshAllImages = async () => {
    if (!mobileList || mobileList.length === 0) {
      return;
    }

    setRefreshingAllImages(true);
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';
      const carrier = getCurrentCarrier();
      
      // Discord 메시지 ID와 스레드 ID가 있는 모델만 필터링
      const modelsToRefresh = mobileList.filter(m => 
        m.discordMessageId && m.discordThreadId
      );

      if (modelsToRefresh.length === 0) {
        alert('갱신할 수 있는 이미지가 없습니다.');
        setRefreshingAllImages(false);
        return;
      }

      // 배치 처리: 한 번에 5개씩 처리 (서버 부하 방지)
      const BATCH_SIZE = 5;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < modelsToRefresh.length; i += BATCH_SIZE) {
        const batch = modelsToRefresh.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (model) => {
          try {
            const response = await fetch(`${API_URL}/api/direct/refresh-mobile-image-url`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                carrier: carrier,
                modelId: model.modelId || model.id,
                modelName: model.model || model.petName,
                threadId: model.discordThreadId,
                messageId: model.discordMessageId
              })
            });
            
            if (!response.ok) {
              // CORS나 504 에러는 조용히 처리
              return { success: false, error: `HTTP ${response.status}` };
            }
            
            const result = await response.json();
            if (result.success) {
              successCount++;
            } else {
              failCount++;
            }
            return result;
          } catch (error) {
            // 네트워크 에러는 조용히 처리 (CORS, timeout 등)
            failCount++;
            return { success: false, error: error.message };
          }
        });

        await Promise.all(batchPromises);
        
        // 배치 간 짧은 대기 (서버 부하 방지)
        if (i + BATCH_SIZE < modelsToRefresh.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // 결과 요약만 표시
      if (successCount > 0 || failCount === 0) {
        alert(`${successCount}개 이미지 갱신 완료${failCount > 0 ? ` (${failCount}개 실패)` : ''}`);
        // 갱신 후 데이터 다시 로드
        handleReload();
      } else {
        alert('이미지 갱신에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('이미지 갱신 오류:', error);
      alert('이미지 갱신 중 오류가 발생했습니다.');
    } finally {
      setRefreshingAllImages(false);
    }
  };

  // handleReload 재구현을 위해 useEffect 분리 대신 
  // useEffect 의존성에 reloadTrigger 추가 권장.
  // 하지만 여기서는 코드 교체가 목표이므로 간단히 유지.

  // 🔥 조건 기반 정책 필터링
  const conditionalPolicies = useMemo(() => {
    if (!policySettings?.success || !policySettings?.special?.list) {
      return [];
    }
    
    return policySettings.special.list
      .filter(policy => policy.isActive && policy.policyType === 'conditional')
      .map(policy => {
        try {
          const conditionsJson = typeof policy.conditionsJson === 'string' 
            ? JSON.parse(policy.conditionsJson) 
            : policy.conditionsJson || {};
          
          if (conditionsJson.type === 'conditional' && conditionsJson.conditions) {
            return {
              name: policy.name,
              conditions: conditionsJson.conditions || []
            };
          }
        } catch (e) {
          console.warn('[MobileListTab] 정책 조건 JSON 파싱 실패:', e);
        }
        return null;
      })
      .filter(Boolean);
  }, [policySettings]);

  // 가격 Lookup 함수 (동기식)
  const lookupPrice = useCallback((modelId, planGroup, openingType) => {
    // 🔥 수정: 시트 데이터 로드 시 이미 '010신규/기변'을 '010신규'와 '기변'에 매핑했으므로
    // lookupPrice에서는 원래 openingType 그대로 조회하면 됨
    const key = `${modelId}-${planGroup}-${openingType}`;
    const priceData = pricingDataRef.current.get(key);

    // 현재 단말 정보 찾기
    const mobile = mobileList.find(m => m.id === modelId);
    const factoryPrice = mobile ? mobile.factoryPrice : 0;
    const modelName = mobile?.model || mobile?.petName || '';

    if (priceData) {
      // 🔥 수정: 부가미유치 기준 제거, 부가유치 기준만 사용
      const baseStoreSupport = priceData.storeSupportWithAddon || 0;
      
      // 🔥 정책 적용: 시세표는 이통사지원금 기준이므로 contractType 조건 없는 정책만 적용
      let policyAmount = 0;
      
      if (conditionalPolicies.length > 0) {
        // 1단계: minStoreSupport 없는 정책 적용
        conditionalPolicies.forEach(policy => {
          policy.conditions.forEach(condition => {
            // contractType 조건이 있으면 제외 (선택약정시 차감정책)
            if (condition.contractType) {
              return;
            }
            
            // minStoreSupport 조건이 있으면 나중에 처리
            if (condition.minStoreSupport) {
              return;
            }
            
            // 모델 매칭
            const modelMatch = (condition.models || []).length === 0 || 
              condition.models.some(model => 
                modelName === model ||
                modelName.includes(model) ||
                (mobile?.petName && mobile.petName === model) ||
                (mobile?.petName && mobile.petName.includes(model))
              );
            
            // 개통유형 매칭
            const openingTypeMatch = (condition.openingTypes || []).length === 0 ||
              condition.openingTypes.includes(openingType);
            
            // 요금제군 매칭
            const planGroupMatch = (condition.planGroups || []).length === 0 ||
              condition.planGroups.includes(planGroup);
            
            // 모든 조건이 일치하면 적용
            if (modelMatch && openingTypeMatch && planGroupMatch) {
              policyAmount += condition.amount || 0;
            }
          });
        });
        
        // 2단계: minStoreSupport 조건이 있는 정책 적용 (이미 계산된 대리점추가지원금과 비교)
        const currentStoreSupport = baseStoreSupport + policyAmount;
        conditionalPolicies.forEach(policy => {
          policy.conditions.forEach(condition => {
            // contractType 조건이 있으면 제외
            if (condition.contractType) {
              return;
            }
            
            // minStoreSupport 조건이 있는 정책만 처리
            if (condition.minStoreSupport && currentStoreSupport >= condition.minStoreSupport) {
              // 모델 매칭
              const modelMatch = (condition.models || []).length === 0 || 
                condition.models.some(model => 
                  modelName === model ||
                  modelName.includes(model) ||
                  (mobile?.petName && mobile.petName === model) ||
                  (mobile?.petName && mobile.petName.includes(model))
                );
              
              // 개통유형 매칭
              const openingTypeMatch = (condition.openingTypes || []).length === 0 ||
                condition.openingTypes.includes(openingType);
              
              // 요금제군 매칭
              const planGroupMatch = (condition.planGroups || []).length === 0 ||
                condition.planGroups.includes(planGroup);
              
              // 모든 조건이 일치하면 적용
              if (modelMatch && openingTypeMatch && planGroupMatch) {
                policyAmount += condition.amount || 0;
              }
            }
          });
        });
      }
      
      const finalStoreSupport = baseStoreSupport + policyAmount;
      const publicSupport = priceData.publicSupport || 0;
      
      // 🔥 수정: 출고가와 이통사지원금 차액보다 대리점지원금이 더 크다면 그 차액만큼만 표시
      const maxStoreSupport = factoryPrice > publicSupport 
        ? factoryPrice - publicSupport 
        : 0;
      const limitedStoreSupport = Math.min(finalStoreSupport, maxStoreSupport);
      
      return {
        storeSupportWithAddon: limitedStoreSupport,
        purchasePriceWithAddon: Math.max(0, factoryPrice - publicSupport - limitedStoreSupport),
        publicSupport: publicSupport,
        openingType: openingType
      };
    }

    // 데이터를 찾지 못한 경우 디버깅 로그 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[MobileListTab] 가격 데이터를 찾지 못함: key=${key}, modelId=${modelId}, planGroup=${planGroup}, openingType=${openingType}`);
      // pricingDataRef에 있는 키 목록 일부 출력 (디버깅용)
      const availableKeys = Array.from(pricingDataRef.current.keys()).slice(0, 5);
      console.log(`[MobileListTab] 사용 가능한 키 샘플:`, availableKeys);
    }

    // 데이터 없으면 0 리턴
    // 🔥 수정: 부가미유치 기준 제거
    return {
      storeSupportWithAddon: 0,
      purchasePriceWithAddon: factoryPrice,
      publicSupport: 0,
      openingType: openingType
    };
  }, [mobileList, conditionalPolicies]);

  // calculatePrice 대체 (동기식 상태 업데이트)
  const updatePriceState = useCallback((modelId, planGroup, openingType) => {
    const priceObj = lookupPrice(modelId, planGroup, openingType);
    const key = `${modelId}-${openingType}`;

    setCalculatedPrices(prev => ({
      ...prev,
      [key]: priceObj
    }));
  }, [lookupPrice]);

  // 🔥 핵심 수정: mobileList가 변경되면 calculatedPrices 자동 재계산
  useEffect(() => {
    // 초기화가 완료되지 않았거나 mobileList가 비어있으면 스킵
    if (!initializedRef.current || mobileList.length === 0) {
      return;
    }

    // 모든 모델의 calculatedPrices 재계산
    const newCalculated = {};

    mobileList.forEach(mobile => {
      const modelId = mobile.id;
      const planGroup = selectedPlanGroups[modelId] || '115군';
      const openingType = selectedOpeningTypes[modelId] || 'MNP';

      // lookupPrice로 최신 가격 계산
      const priceObj = lookupPrice(modelId, planGroup, openingType);
      const key = `${modelId}-${openingType}`;

      newCalculated[key] = priceObj;
    });

    // calculatedPrices 업데이트 (변경사항이 있을 때만)
    setCalculatedPrices(prev => {
      // 변경사항이 있는지 확인
      const hasChanges = Object.keys(newCalculated).some(key => {
        const oldValue = prev[key];
        const newValue = newCalculated[key];
        if (!oldValue) return true;

        // 주요 필드 비교
        // 🔥 수정: 부가미유치 기준 제거
        return (
          oldValue.purchasePriceWithAddon !== newValue.purchasePriceWithAddon ||
          oldValue.storeSupportWithAddon !== newValue.storeSupportWithAddon ||
          oldValue.publicSupport !== newValue.publicSupport
        );
      });

      if (hasChanges) {
        console.log('🔄 [가격 재계산] mobileList 변경으로 인한 가격 자동 재계산');
        return { ...prev, ...newCalculated };
      }

      return prev;
    });
  }, [mobileList, selectedPlanGroups, selectedOpeningTypes, lookupPrice]);

  // 🔥 리팩토링: 이미지 업로드 성공 핸들러 (ImageUploadButton이 자동으로 처리)
  const handleImageUploadSuccess = useCallback(async (imageUrl, modelId, carrier) => {
    console.log('✅ [휴대폰목록] 이미지 업로드 성공 콜백:', { imageUrl, modelId, carrier });

    // 즉시 로컬 상태 업데이트 (UI 반영) - 이미지만 업데이트
    setMobileList(prevList => prevList.map(item => {
      // 모델ID 또는 모델명으로 매칭
      if (item.id === modelId || item.model === modelId) {
        return { ...item, image: imageUrl };
      }
      return item;
    }));

    // 🔥 핵심 수정: 가격 정책 데이터도 함께 재로딩하여 pricingDataRef 업데이트
    // 서버에서 최신 데이터 재로딩 (재시도 로직 포함)
    // 캐시 무효화 후 즉시 재로딩하면 Rate Limit이나 불완전한 데이터가 반환될 수 있음
    const reloadWithRetry = async (retryCount = 0, maxRetries = 3) => {
      const delay = retryCount === 0 ? 1000 : 2000; // 첫 시도는 1초, 재시도는 2초

      setTimeout(async () => {
        try {
          console.log(`🔄 [휴대폰목록] 최신 데이터 재로딩 시도 ${retryCount + 1}/${maxRetries + 1}...`);

          // 🔥 핵심 수정: 초기 로드와 동일한 방식으로 데이터 가져오기
          // getMobileList는 id 형식이 다르고 이미 계산된 가격이 포함되어 있어서
          // 초기 로드와 동일하게 getMobilesMaster, getMobilesPricing, getPlansMaster를 사용
          const [mobiles, pricing, plans] = await Promise.all([
            directStoreApiClient.getMobilesMaster(carrier),
            directStoreApiClient.getMobilesPricing(carrier),
            directStoreApiClient.getPlansMaster(carrier)
          ]);

          // 요금제군 목록 추출
          const uniqueGroups = [...new Set(plans.map(p => p.planGroup))].filter(Boolean);

          // 가격 정책 데이터 인덱싱 (Lookup Map 생성)
          // 🔥 수정: 시트에 '010신규/기변'으로 저장된 데이터를 '010신규'와 '기변'에도 매핑
          const priceMap = new Map();
          pricing.forEach(p => {
            const baseKey = `${p.modelId}-${p.planGroup}-${p.openingType}`;
            priceMap.set(baseKey, p);
            
            // 🔥 수정: '010신규/기변'으로 저장된 데이터를 '010신규'와 '기변'에도 매핑
            if (p.openingType === '010신규/기변') {
              const key010 = `${p.modelId}-${p.planGroup}-010신규`;
              const key기변 = `${p.modelId}-${p.planGroup}-기변`;
              if (!priceMap.has(key010)) {
                priceMap.set(key010, { ...p, openingType: '010신규' });
              }
              if (!priceMap.has(key기변)) {
                priceMap.set(key기변, { ...p, openingType: '기변' });
              }
            }
          });
          pricingDataRef.current = priceMap;
          console.log('🔄 [휴대폰목록] 가격 정책 데이터 업데이트 완료');

          // 초기 로드와 동일한 방식으로 mobileList 생성
          const newSelectedPlans = {};
          const newSelectedTypes = {};
          const newCalculated = {};

          const modList = mobiles.map(m => {
            // 기본값 결정
            let defPlan = '115군';
            if (m.isBudget && !m.isPremium) defPlan = '33군';
            if (!uniqueGroups.includes(defPlan) && uniqueGroups.length > 0) defPlan = uniqueGroups[0];

            const defType = 'MNP';

            // 상태 저장
            newSelectedPlans[m.modelId] = defPlan;
            newSelectedTypes[m.modelId] = defType;

            // 초기 가격 Lookup
            const priceKey = `${m.modelId}-${defPlan}-${defType}`;
            const priceData = priceMap.get(priceKey);

            let publicSupport = 0;

            if (priceData) {
              publicSupport = priceData.publicSupport || 0;
              const storeSupportWith = priceData.storeSupportWithAddon || 0;

              // 🔥 수정: 부가미유치 기준 제거, 부가유치 기준만 사용
              // calculatedPrices 초기화
              newCalculated[`${m.modelId}-${defType}`] = {
                storeSupportWithAddon: storeSupportWith,
                purchasePriceWithAddon: Math.max(0, m.factoryPrice - publicSupport - storeSupportWith),
                publicSupport: publicSupport,
                openingType: defType
              };
            } else {
              // 가격 정보 없음 - 0 처리
              newCalculated[`${m.modelId}-${defType}`] = {
                storeSupportWithAddon: 0,
                purchasePriceWithAddon: m.factoryPrice,
                publicSupport: 0,
                openingType: defType
              };
            }

            // Mobile object mapping (초기 로드와 동일한 구조)
            return {
              id: m.modelId, // ID 매핑 (초기 로드와 동일)
              model: m.model,
              petName: m.petName,
              carrier: m.carrier,
              factoryPrice: m.factoryPrice,
              image: m.imageUrl,
              isPremium: m.isPremium,
              isBudget: m.isBudget,
              isPopular: m.isPopular,
              isRecommended: m.isRecommended,
              isCheap: m.isCheap,
              publicSupport: publicSupport,
              support: publicSupport
            };
          });

          // 업로드한 이미지가 포함되어 있는지 확인
          const hasNewImage = modList.some(item =>
            (item.id === modelId || item.model === modelId) && item.image === imageUrl
          );

          if (hasNewImage || retryCount >= maxRetries) {
            // 상태 일괄 업데이트 (초기 로드와 동일)
            setMobileList(modList);
            setCalculatedPrices(newCalculated);
            setSelectedPlanGroups(prev => ({ ...prev, ...newSelectedPlans }));
            setSelectedOpeningTypes(prev => ({ ...prev, ...newSelectedTypes }));
            console.log('✅ [휴대폰목록] 최신 데이터 재로딩 완료 (초기 로드 방식, 가격 정책 업데이트)');
            return; // 성공
          } else {
            // 새 이미지가 아직 반영되지 않음 - 재시도
            console.log(`⚠️ [휴대폰목록] 새 이미지가 아직 반영되지 않음, 재시도... (${retryCount + 1}/${maxRetries})`);
            reloadWithRetry(retryCount + 1, maxRetries);
            return;
          }
        } catch (reloadError) {
          console.warn(`⚠️ [휴대폰목록] 최신 데이터 재로딩 실패 (시도 ${retryCount + 1}/${maxRetries + 1}):`, reloadError);
          if (retryCount < maxRetries) {
            reloadWithRetry(retryCount + 1, maxRetries);
            return;
          }
          // 재시도 횟수 초과 시에도 이전 데이터 유지 (이미 이미지는 업데이트됨)
        }
      }, delay);
    };

    reloadWithRetry();
  }, []);

  // 🔥 양방향 동기화: 다른 페이지(오늘의휴대폰)에서 이미지 업로드 시 자동 업데이트
  useEffect(() => {
    const handleImageUploaded = async (event) => {
      const { carrier: eventCarrier, modelId, imageUrl } = event.detail || {};
      const currentCarrier = getCurrentCarrier();

      // 현재 탭의 통신사와 일치하는 경우에만 업데이트
      if (eventCarrier && eventCarrier === currentCarrier) {
        console.log('🔄 [휴대폰목록] 다른 페이지에서 이미지 업로드 이벤트 수신:', { modelId, imageUrl });

        // 즉시 로컬 상태 업데이트
        setMobileList(prevList => prevList.map(item => {
          if (item.id === modelId || item.model === modelId) {
            return { ...item, image: imageUrl };
          }
          return item;
        }));

        // 🔥 핵심 수정: 가격 정책 데이터도 함께 재로딩하여 pricingDataRef 업데이트
        // 서버에서 최신 데이터 재로딩 (재시도 로직 포함)
        const reloadWithRetry = async (retryCount = 0, maxRetries = 3) => {
          const delay = retryCount === 0 ? 1000 : 2000; // 첫 시도는 1초, 재시도는 2초

          setTimeout(async () => {
            try {
              console.log(`🔄 [휴대폰목록] 다른 페이지 업로드 후 최신 데이터 재로딩 시도 ${retryCount + 1}/${maxRetries + 1}...`);

              // 🔥 핵심 수정: 초기 로드와 동일한 방식으로 데이터 가져오기
              const [mobiles, pricing, plans] = await Promise.all([
                directStoreApiClient.getMobilesMaster(currentCarrier),
                directStoreApiClient.getMobilesPricing(currentCarrier),
                directStoreApiClient.getPlansMaster(currentCarrier)
              ]);

              // 요금제군 목록 추출
              const uniqueGroups = [...new Set(plans.map(p => p.planGroup))].filter(Boolean);

              // 가격 정책 데이터 인덱싱 (Lookup Map 생성)
              const priceMap = new Map();
              pricing.forEach(p => {
                const key = `${p.modelId}-${p.planGroup}-${p.openingType}`;
                priceMap.set(key, p);
              });
              pricingDataRef.current = priceMap;
              console.log('🔄 [휴대폰목록] 가격 정책 데이터 업데이트 완료');

              // 초기 로드와 동일한 방식으로 mobileList 생성
              const newSelectedPlans = {};
              const newSelectedTypes = {};
              const newCalculated = {};

              const modList = mobiles.map(m => {
                // 기본값 결정
                let defPlan = '115군';
                if (m.isBudget && !m.isPremium) defPlan = '33군';
                if (!uniqueGroups.includes(defPlan) && uniqueGroups.length > 0) defPlan = uniqueGroups[0];

                const defType = 'MNP';

                // 상태 저장
                newSelectedPlans[m.modelId] = defPlan;
                newSelectedTypes[m.modelId] = defType;

                // 초기 가격 Lookup
                const priceKey = `${m.modelId}-${defPlan}-${defType}`;
                const priceData = priceMap.get(priceKey);

                let publicSupport = 0;

                if (priceData) {
                  publicSupport = priceData.publicSupport || 0;
                  const storeSupportWith = priceData.storeSupportWithAddon || 0;

                  // 🔥 수정: 부가미유치 기준 제거, 부가유치 기준만 사용
                  // calculatedPrices 초기화
                  newCalculated[`${m.modelId}-${defType}`] = {
                    storeSupportWithAddon: storeSupportWith,
                    purchasePriceWithAddon: Math.max(0, m.factoryPrice - publicSupport - storeSupportWith),
                    publicSupport: publicSupport,
                    openingType: defType
                  };
                } else {
                  // 가격 정보 없음 - 0 처리
                  // 🔥 수정: 부가미유치 기준 제거
                  newCalculated[`${m.modelId}-${defType}`] = {
                    storeSupportWithAddon: 0,
                    purchasePriceWithAddon: m.factoryPrice,
                    publicSupport: 0,
                    openingType: defType
                  };
                }

                // Mobile object mapping (초기 로드와 동일한 구조)
                return {
                  id: m.modelId, // ID 매핑 (초기 로드와 동일)
                  model: m.model,
                  petName: m.petName,
                  carrier: m.carrier,
                  factoryPrice: m.factoryPrice,
                  image: m.imageUrl,
                  isPremium: m.isPremium,
                  isBudget: m.isBudget,
                  isPopular: m.isPopular,
                  isRecommended: m.isRecommended,
                  isCheap: m.isCheap,
                  publicSupport: publicSupport,
                  support: publicSupport
                };
              });

              // 업로드한 이미지가 포함되어 있는지 확인
              const hasNewImage = modList.some(item =>
                (item.id === modelId || item.model === modelId) && item.image === imageUrl
              );

              if (hasNewImage || retryCount >= maxRetries) {
                // 상태 일괄 업데이트 (초기 로드와 동일)
                setMobileList(modList);
                setCalculatedPrices(newCalculated);
                setSelectedPlanGroups(prev => ({ ...prev, ...newSelectedPlans }));
                setSelectedOpeningTypes(prev => ({ ...prev, ...newSelectedTypes }));
                console.log('✅ [휴대폰목록] 다른 페이지 업로드 후 최신 데이터 재로딩 완료 (초기 로드 방식)');
                return; // 성공
              } else {
                // 새 이미지가 아직 반영되지 않음 - 재시도
                console.log(`⚠️ [휴대폰목록] 새 이미지가 아직 반영되지 않음, 재시도... (${retryCount + 1}/${maxRetries})`);
                reloadWithRetry(retryCount + 1, maxRetries);
                return;
              }
            } catch (reloadError) {
              console.warn(`⚠️ [휴대폰목록] 최신 데이터 재로딩 실패 (시도 ${retryCount + 1}/${maxRetries + 1}):`, reloadError);
              if (retryCount < maxRetries) {
                reloadWithRetry(retryCount + 1, maxRetries);
                return;
              }
              // 재시도 횟수 초과 시에도 이전 데이터 유지 (이미 이미지는 업데이트됨)
            }
          }, delay);
        };

        reloadWithRetry();
      }
    };

    window.addEventListener('imageUploaded', handleImageUploaded);
    return () => window.removeEventListener('imageUploaded', handleImageUploaded);
  }, [getCurrentCarrier]);

  const handleRowClick = useCallback((model) => {
    if (onProductSelect) {
      // 선택된 요금제군과 유형을 포함하여 전달
      const planGroup = selectedPlanGroups[model.id] || null;
      const openingType = selectedOpeningTypes[model.id] || null;
      onProductSelect({
        ...model,
        planGroup,
        openingType
      });
    }
  }, [onProductSelect, selectedPlanGroups, selectedOpeningTypes]);

  const handleTagMenuOpen = useCallback((event, modelId) => {
    event.stopPropagation();
    event.preventDefault();
    setTagMenuAnchor(prev => {
      // 이미 열려있으면 즉시 반환 (중복 방지)
      if (prev[modelId]) return prev;
      return { ...prev, [modelId]: event.currentTarget };
    });
  }, []);

  const handleTagMenuClose = useCallback((modelId) => {
    setTagMenuAnchor(prev => {
      // 이미 닫혀있으면 즉시 반환 (중복 방지)
      if (!prev[modelId]) return prev;
      const newState = { ...prev };
      delete newState[modelId];
      return newState;
    });
  }, []);

  const handleTagChange = async (modelId, tagType, checked) => {
    const currentMobile = mobileList.find(m => m.id === modelId);
    if (!currentMobile) return;

    // 이전 상태 백업 (에러 시 롤백용)
    const previousTags = {
      isPopular: currentMobile.isPopular || false,
      isRecommended: currentMobile.isRecommended || false,
      isCheap: currentMobile.isCheap || false,
      isPremium: currentMobile.isPremium || false,
      isBudget: currentMobile.isBudget || false
    };

    // 새로운 태그 상태
    const newTags = {
      isPopular: tagType === 'popular' ? checked : currentMobile.isPopular || false,
      isRecommended: tagType === 'recommend' ? checked : currentMobile.isRecommended || false,
      isCheap: tagType === 'cheap' ? checked : currentMobile.isCheap || false,
      isPremium: tagType === 'premium' ? checked : currentMobile.isPremium || false,
      isBudget: tagType === 'budget' ? checked : currentMobile.isBudget || false
    };

    // 낙관적 업데이트: UI를 먼저 업데이트 (즉시 반응)
    setMobileList(prevList => prevList.map(item =>
      item.id === modelId
        ? {
          ...item,
          ...newTags,
          tags: Object.keys(newTags).filter(k => newTags[k])
        }
        : item
    ));

    // 백그라운드에서 API 호출 (비동기)
    try {
      const payload = {
        ...newTags,
        model: currentMobile.model,
        petName: currentMobile.petName,
        carrier: currentMobile.carrier,
        factoryPrice: currentMobile.factoryPrice,
        publicSupport: currentMobile.publicSupport,
        storeSupport: currentMobile.storeSupportWithAddon,
        // 🔥 수정: 부가미유치 기준 제거 (storeSupportNoAddon 제거)
        requiredAddons: currentMobile.requiredAddons,
        image: currentMobile.image
      };

      const result = await directStoreApiClient.updateMobileTags(modelId, payload);

      // API 호출 성공 시 추가 처리 없음 (이미 UI 업데이트됨)
      if (!result || !result.success) {
        throw new Error(result?.error || '태그 업데이트 실패');
      }

      // 태그 변경 시 요금제군이 변경될 수 있으므로 재계산
      // 중저가/프리미엄 태그 변경 시 요금제군 기본값 재계산
      const updatedMobile = mobileList.find(m => m.id === modelId);
      if (updatedMobile && (tagType === 'budget' || tagType === 'premium')) {
        const isPremium = updatedMobile.isPremium || false;
        const isBudget = updatedMobile.isBudget || false;

        let newPlanGroup = '115군';
        if (isPremium && !isBudget) {
          newPlanGroup = '115군';
        } else if (isBudget && !isPremium) {
          newPlanGroup = '33군';
        } else {
          newPlanGroup = '115군';
        }

        // 요금제군이 변경되었으면 업데이트 및 재계산
        const currentPlanGroup = selectedPlanGroups[modelId];
        if (currentPlanGroup !== newPlanGroup && planGroups.includes(newPlanGroup)) {
          setSelectedPlanGroups(prev => ({ ...prev, [modelId]: newPlanGroup }));
          const currentOpeningType = selectedOpeningTypes[modelId] || 'MNP';
          // 로컬 가격 상태 동기식 업데이트
          updatePriceState(modelId, newPlanGroup, currentOpeningType);
        }
      }
    } catch (err) {
      console.error('구분 태그 업데이트 실패:', err);

      // 에러 발생 시 이전 상태로 롤백
      setMobileList(prevList => prevList.map(item =>
        item.id === modelId
          ? {
            ...item,
            ...previousTags,
            tags: Object.keys(previousTags).filter(k => previousTags[k])
          }
          : item
      ));

      // 사용자에게 에러 알림 (선택적 - 너무 자주 뜨면 방해될 수 있음)
      // alert('구분 태그 업데이트에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 요금제군 변경 시 상태 및 가격 업데이트
  const handlePlanGroupChange = useCallback((modelId, newPlanGroup) => {
    if (!newPlanGroup) return;

    // 현재 openingType을 먼저 읽어서 가격 업데이트에 사용
    setSelectedPlanGroups(prev => {
      // 상태 업데이트
      return {
        ...prev,
        [modelId]: newPlanGroup
      };
    });

    // 상태 업데이트 후 가격 업데이트 (현재 openingType 사용)
    const currentOpeningType = selectedOpeningTypes[modelId] || 'MNP';
    updatePriceState(modelId, newPlanGroup, currentOpeningType);
  }, [selectedOpeningTypes, updatePriceState]);

  // 개통유형 변경 시 상태 및 가격 업데이트
  const handleOpeningTypeChange = useCallback((modelId, newOpeningType) => {
    if (!newOpeningType) return;

    // 현재 planGroup을 먼저 읽어서 가격 업데이트에 사용
    setSelectedOpeningTypes(prev => {
      // 상태 업데이트
      return {
        ...prev,
        [modelId]: newOpeningType
      };
    });

    // 상태 업데이트 후 가격 업데이트 (현재 planGroup 사용)
    const currentPlanGroup = selectedPlanGroups[modelId] || planGroups[0] || '115군';
    if (currentPlanGroup) {
      updatePriceState(modelId, currentPlanGroup, newOpeningType);
    }
  }, [selectedPlanGroups, planGroups, updatePriceState]);

  const getSelectedTags = useCallback((row) => {
    const tags = [];
    if (row.isPopular) tags.push('인기');
    if (row.isRecommended) tags.push('추천');
    if (row.isCheap) tags.push('저렴');
    if (row.isPremium) tags.push('프리미엄');
    if (row.isBudget) tags.push('중저가');
    return tags.length > 0 ? tags.join(', ') : '선택';
  }, []);

  // 가격 계산 요청 큐 처리 함수

  // 표시할 값 가져오기 (계산된 값이 있으면 사용, 없으면 원래 값) - 메모이제이션
  // 🔥 핵심 수정: calculatedPrices 대신 lookupPrice를 직접 호출하여 항상 최신 factoryPrice 사용
  const getDisplayValue = useCallback((row, field, selectedOpeningType = null) => {
    // openingType이 null이면 기본값 'MNP' 사용
    const openingType = selectedOpeningType || selectedOpeningTypes[row.id] || 'MNP';
    const planGroup = selectedPlanGroups[row.id] || '115군';

    // 🔥 수정: 시트 데이터 로드 시 이미 '010신규/기변'을 '010신규'와 '기변'에 매핑했으므로
    // getDisplayValue에서는 원래 openingType 그대로 lookupPrice 호출하면 됨

    // 🔥 핵심 수정: lookupPrice를 직접 호출하여 항상 최신 factoryPrice로 계산
    // 이렇게 하면 mobileList가 변경되어도 항상 최신 가격이 표시됨
    const calculated = lookupPrice(row.id, planGroup, openingType);

    // 계산된 값이 있고, 해당 필드가 존재하면 사용
    // 🔥 수정: 대리점지원금의 경우 0도 유효한 값으로 간주 (마스터 데이터에 0으로 저장된 경우)
    if (calculated && calculated[field] !== undefined) {
      // 🔥 수정: 0도 유효한 값으로 반환 (마스터 데이터에 명시적으로 0으로 저장된 경우)
      return calculated[field];
    }
    return row[field];
  }, [selectedOpeningTypes, selectedPlanGroups, lookupPrice]);

  // 모바일에서 헤더와 본문의 가로 스크롤 동기화 (고객모드에서는 헤더 스크롤 숨김으로 동기화 불필요)
  useEffect(() => {
    if (!isMobile || !headerScrollRef.current || !bodyScrollRef.current || isCustomerMode) return;

    const headerContainer = headerScrollRef.current;
    const bodyContainer = bodyScrollRef.current;

    const syncHeaderScroll = () => {
      if (isScrollingRef.current) return;
      isScrollingRef.current = true;
      headerContainer.scrollLeft = bodyContainer.scrollLeft;
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    };

    const syncBodyScroll = () => {
      if (isScrollingRef.current) return;
      isScrollingRef.current = true;
      bodyContainer.scrollLeft = headerContainer.scrollLeft;
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    };

    bodyContainer.addEventListener('scroll', syncHeaderScroll);
    headerContainer.addEventListener('scroll', syncBodyScroll);

    return () => {
      bodyContainer.removeEventListener('scroll', syncHeaderScroll);
      headerContainer.removeEventListener('scroll', syncBodyScroll);
    };
  }, [isMobile, mobileList.length]); // mobileList.length가 변경되면 재설정

  return (
    <Box sx={{ 
      p: { xs: 1, sm: 2, md: 3 }, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden', 
      position: 'relative',
      // 모바일에서 높이 제한
      ...(isMobile && {
        height: '100%',
        maxHeight: '100%',
        minHeight: 0
      })
    }}>

      <Typography 
        variant="h5" 
        gutterBottom 
        sx={{ 
          fontWeight: 'bold', 
          color: 'text.primary',
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
          mb: { xs: 1, sm: 2 }
        }}
      >
        {isCustomerMode ? '실시간 휴대폰 시세표' : '휴대폰시세표'}
      </Typography>

      {/* 통신사 탭 및 컬럼 헤더 - 고정 */}
      <Paper 
        sx={{ 
          mb: 0, 
          p: { xs: 1, sm: 2 }, 
          bgcolor: 'background.paper', 
          borderRadius: 0,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          boxShadow: 2,
          flexShrink: 0,
          // 모바일에서 헤더 높이 최적화
          ...(isMobile && {
            p: 1,
            mb: 0
          })
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: { xs: 1, sm: 2 },
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Tabs
              value={carrierTab}
              onChange={handleCarrierChange}
              variant="scrollable"
              scrollButtons="auto"
              indicatorColor="primary"
              textColor="primary"
              sx={{
                '& .MuiTab-root': {
                  fontWeight: 'bold',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' },
                  minWidth: { xs: 'auto', sm: 'auto' },
                  px: { xs: 1, sm: 2 }
                },
                '& .Mui-selected': {
                  bgcolor: 'rgba(212, 175, 55, 0.05)'
                }
              }}
            >
              <Tab label="LG U+" sx={{ color: '#ec008c' }} />
              <Tab label="KT" sx={{ color: '#00abc7' }} />
              <Tab label="SK Telecom" sx={{ color: '#e60012' }} />
            </Tabs>
          </Box>

          <Button
            variant="outlined"
            size="small"
            onClick={handleReload}
            startIcon={<RefreshIcon />}
            disabled={loading}
            sx={{ 
              ml: { xs: 0, sm: 2 },
              mt: { xs: 1, sm: 0 },
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              minWidth: { xs: 'auto', sm: 'auto' },
              px: { xs: 1, sm: 2 }
            }}
          >
            새로고침
          </Button>
        </Box>

        {/* 상태 단계 표시 */}
        {loading && (
          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 0.5, sm: 1 }, 
            mb: { xs: 1, sm: 2 },
            flexWrap: 'wrap'
          }}>
            {Object.values(steps).map((step, index) => (
              <Chip
                key={index}
                label={`${step.label}${step.message ? `: ${step.message}` : ''}`}
                size="small"
                sx={{
                  fontSize: { xs: '0.625rem', sm: '0.75rem' },
                  height: { xs: '24px', sm: '32px' }
                }}
                color={
                  step.status === 'success' ? 'success' :
                    step.status === 'loading' ? 'info' :
                      step.status === 'empty' ? 'default' :
                        step.status === 'error' ? 'error' : 'default'
                }
                variant={step.status === 'success' ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        )}

        {/* 컬럼 헤더 */}
        <TableContainer 
          ref={headerScrollRef}
          sx={{ 
            overflowX: isCustomerMode ? 'hidden' : 'auto', // 고객모드에서는 헤더 스크롤 숨김
            overflowY: 'hidden',
            width: '100%',
            // 모바일에서 터치 스크롤 최적화
            WebkitOverflowScrolling: 'touch',
            // 모바일에서 헤더 스크롤 방지 (본문과 동기화를 위해)
            ...(isMobile && {
              position: 'relative',
              overflowX: isCustomerMode ? 'hidden' : 'auto', // 고객모드에서는 헤더 스크롤 숨김
              '&::-webkit-scrollbar': {
                height: '4px',
                display: isCustomerMode ? 'none' : 'block' // 고객모드에서는 스크롤바 숨김
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '2px'
              }
            })
          }}
        >
          <Table sx={{ 
            width: '100%',
            minWidth: { xs: '800px', sm: '100%' }, // 모바일에서 최소 너비 보장
            tableLayout: 'fixed',
            borderCollapse: 'separate', 
            borderSpacing: 0 
          }}>
            <TableHead>
              <TableRow>
                {!isCustomerMode && (
                  <ModernTableCell
                    align="center"
                    sx={{
                      width: '120px',
                      backgroundColor: 'background.paper',
                      fontWeight: 'bold',
                      borderBottom: '2px solid',
                      borderColor: 'divider'
                    }}
                  >
                    구분
                  </ModernTableCell>
                )}
                <ModernTableCell
                  align="center"
                  sx={{
                    width: '100px',
                    backgroundColor: 'background.paper',
                    fontWeight: 'bold',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      이미지
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={handleRefreshAllImages}
                      disabled={refreshingAllImages}
                      sx={{ 
                        minWidth: 'auto',
                        fontSize: '0.7rem',
                        py: 0.3,
                        px: 0.8,
                        whiteSpace: 'nowrap',
                        lineHeight: 1.2
                      }}
                    >
                      {refreshingAllImages ? (
                        <Box component="span" sx={{ fontSize: '0.65rem' }}>
                          갱신<br />중...
                        </Box>
                      ) : (
                        <Box component="span" sx={{ fontSize: '0.65rem' }}>
                          이미지<br />갱신하기
                        </Box>
                      )}
                    </Button>
                  </Box>
                </ModernTableCell>
                <ModernTableCell
                  align="center"
                  sx={{
                    width: '220px',
                    backgroundColor: 'background.paper',
                    fontWeight: 'bold',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                    // 고객모드에서는 틀고정 완전히 제거
                    ...(isCustomerMode ? {
                      position: 'static', // 명시적으로 static으로 설정
                      left: 'auto',
                      zIndex: 'auto'
                    } : {
                      position: 'sticky',
                      left: '220px',
                      zIndex: 3
                    })
                  }}
                >
                  모델명 / 펫네임
                </ModernTableCell>
                <ModernTableCell
                  align="center"
                  sx={{
                    width: '120px',
                    backgroundColor: 'background.paper',
                    fontWeight: 'bold',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}
                >
                  요금제군
                </ModernTableCell>
                <ModernTableCell
                  align="center"
                  sx={{
                    width: '100px',
                    backgroundColor: 'background.paper',
                    fontWeight: 'bold',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}
                >
                  유형
                </ModernTableCell>
                <ModernTableCell
                  align="center"
                  sx={{
                    width: '100px',
                    backgroundColor: 'background.paper',
                    fontWeight: 'bold',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}
                >
                  출고가
                </ModernTableCell>
                <ModernTableCell
                  align="center"
                  sx={{
                    width: '100px',
                    backgroundColor: 'background.paper',
                    fontWeight: 'bold',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}
                >
                  이통사지원금
                </ModernTableCell>
                <ModernTableCell
                  align="center"
                  sx={{
                    width: '90px',
                    borderLeft: '1px solid rgba(81, 81, 81, 0.5)',
                    backgroundColor: 'background.paper',
                    fontWeight: 'bold',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Box sx={{ lineHeight: 1.3 }}>
                    <Box sx={{ mb: 1 }}>대리점 지원금</Box>
                    <Box sx={{ fontSize: '0.65rem', color: 'error.main', fontWeight: 'bold', lineHeight: 1.2 }}>
                      부가보험<br />모두 유치시
                    </Box>
                  </Box>
                </ModernTableCell>
                <ModernTableCell
                  align="center"
                  sx={{
                    width: '90px',
                    borderLeft: '1px solid rgba(81, 81, 81, 0.5)',
                    bgcolor: 'rgba(212, 175, 55, 0.1)',
                    backgroundColor: 'rgba(212, 175, 55, 0.1)',
                    fontWeight: 'bold',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Box sx={{ lineHeight: 1.3 }}>
                    <Box sx={{ mb: 0.5 }}>구매가</Box>
                    <Box sx={{ fontSize: '0.7rem', mb: 1 }}>(할부원금)</Box>
                    <Box sx={{ fontSize: '0.65rem', color: 'error.main', fontWeight: 'bold', lineHeight: 1.2 }}>
                      부가보험<br />모두 유치시
                    </Box>
                  </Box>
                </ModernTableCell>
              </TableRow>
            </TableHead>
          </Table>
        </TableContainer>
      </Paper>

      {/* 에러 메시지 */}
      {error && (
        <ErrorState error={error} onRetry={handleReload} title="데이터 로딩 실패" />
      )}

      {/* 로딩 인디케이터 */}
      {loading || isInitializing ? (
        <LoadingState
          message={isInitializing ? '가격 정보를 계산하는 중...' : '데이터를 불러오는 중...'}
        />
      ) : (
        <>
          {/* 상품 테이블 */}
          <Paper
            sx={{
              flexGrow: 1,
              maxWidth: '100%',
              bgcolor: 'background.paper',
              boxShadow: 1,
              borderRadius: 2,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0, // flexbox에서 스크롤을 위해 필요
              // 모바일에서 높이 제한
              ...(isMobile && {
                flex: '1 1 auto',
                minHeight: 0,
                height: '100%'
              })
            }}
          >
            <TableContainer
              ref={bodyScrollRef}
              sx={{
                flexGrow: 1,
                overflowX: 'auto',
                overflowY: 'auto',
                maxWidth: '100%',
                width: '100%',
                position: 'relative',
                minHeight: 0, // flexbox에서 스크롤을 위해 필요
                // 모바일에서 터치 스크롤 최적화
                WebkitOverflowScrolling: 'touch',
                // 모바일에서 동적 높이 계산
                ...(isMobile ? {
                  flex: '1 1 auto',
                  height: '100%',
                  maxHeight: '100%',
                  // 고객모드일 때는 더 많은 공간 확보
                  ...(isCustomerMode && {
                    height: 'calc(100vh - 280px)',
                    maxHeight: 'calc(100vh - 280px)'
                  }),
                  // 모바일에서 스크롤바 스타일
                  '&::-webkit-scrollbar': {
                    width: '4px',
                    height: '4px'
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '2px'
                  }
                } : {
                  // PC에서는 기존 높이 계산 유지
                  height: { xs: 'calc(100vh - 400px)', sm: 'calc(100vh - 350px)', md: 'calc(100vh - 300px)' },
                  maxHeight: { xs: 'calc(100vh - 400px)', sm: 'calc(100vh - 350px)', md: 'calc(100vh - 300px)' }
                })
              }}
            >
              <Table sx={{ 
                width: '100%',
                minWidth: { xs: '800px', sm: '100%' }, // 모바일에서 최소 너비 보장 (헤더와 동일)
                tableLayout: 'fixed',
                borderCollapse: 'separate', 
                borderSpacing: 0 
              }}>
              <TableBody>
                {mobileList.length === 0 ? (
                  <EmptyTableRow colSpan={11} message="표시할 데이터가 없습니다." />
                ) : (
                  mobileList.map((row) => {
                    // 🔥 성능 최적화: openingType과 calculatedPrice 계산 최적화
                    const openingType = selectedOpeningTypes[row.id] || 'MNP';
                    const priceKey = `${row.id}-${openingType}`;
                    const calculatedPrice = calculatedPrices[priceKey] || null;

                    return (
                      <MobileListRow
                        key={row.id}
                        row={row}
                        planGroups={planGroups}
                        openingTypes={openingTypes}
                        selectedPlanGroup={selectedPlanGroups[row.id] || null}
                        selectedOpeningType={openingType}
                        calculatedPrice={calculatedPrice}
                        tagMenuAnchor={tagMenuAnchor}
                        onRowClick={handleRowClick}
                        onTagMenuOpen={handleTagMenuOpen}
                        onTagMenuClose={handleTagMenuClose}
                        onTagChange={handleTagChange}
                        onPlanGroupChange={handlePlanGroupChange}
                        onOpeningTypeChange={handleOpeningTypeChange}
                        onImageUploadSuccess={handleImageUploadSuccess}
                        getSelectedTags={getSelectedTags}
                        getDisplayValue={getDisplayValue}
                        isCustomerMode={isCustomerMode}
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default MobileListTab;


