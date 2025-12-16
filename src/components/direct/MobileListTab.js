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
  TextField
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Edit as EditIcon,
  Recommend as RecommendIcon,
  Star as StarIcon,
  Label as LabelIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { Checkbox } from '@mui/material';
import { directStoreApi } from '../../api/directStoreApi';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { getCachedPrice, setCachedPrice, setCachedPricesBatch } from '../../utils/priceCache';
import { LoadingState } from './common/LoadingState';
import { ErrorState, EmptyState } from './common/ErrorState';
import { ModernTable, ModernTableCell, HoverableTableRow, EmptyTableRow } from './common/ModernTable';
import { formatPrice } from '../../utils/directStoreUtils';
import { MobileListRow } from './MobileListRow';
import { debugLog } from '../../utils/debugLogger';

const MobileListTab = ({ onProductSelect }) => {
  const [carrierTab, setCarrierTab] = useState(0); // 0: SK, 1: KT, 2: LG
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

  const pricingDataRef = useRef(new Map()); // Key: modelId-planGroup-openingType -> PriceData
  const userSelectedOpeningTypesRef = useRef(new Set()); // 사용자가 수동으로 선택한 개통유형 추적
  const initializedRef = useRef(false);

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
      case 0: return 'SK';
      case 1: return 'KT';
      case 2: return 'LG';
      default: return 'SK';
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

        // 1. 요금제군 목록 추출 (plans-master 기반)
        const uniqueGroups = [...new Set(plans.map(p => p.planGroup))].filter(Boolean);
        setPlanGroups(uniqueGroups);

        // 2. 요금정책 데이터 인덱싱 (Lookup Map 생성)
        const priceMap = new Map();
        pricing.forEach(p => {
          // 키: modelId-planGroup-openingType
          // openingType 정규화: 서버는 '010신규', 'MNP', '기변' 등으로 줌
          // 프론트에서도 동일하게 사용
          const key = `${p.modelId}-${p.planGroup}-${p.openingType}`;
          priceMap.set(key, p);
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
            const storeSupportWithout = priceData.storeSupportWithoutAddon || 0;

            // calculatedPrices 초기화
            newCalculated[`${m.modelId}-${defType}`] = {
              storeSupportWithAddon: storeSupportWith,
              storeSupportWithoutAddon: storeSupportWithout,
              purchasePriceWithAddon: Math.max(0, m.factoryPrice - publicSupport - storeSupportWith),
              purchasePriceWithoutAddon: Math.max(0, m.factoryPrice - publicSupport - storeSupportWithout),
              publicSupport: publicSupport,
              openingType: defType
            };
          } else {
            // 가격 정보 없음 - 0 처리
            newCalculated[`${m.modelId}-${defType}`] = {
              storeSupportWithAddon: 0,
              storeSupportWithoutAddon: 0,
              purchasePriceWithAddon: m.factoryPrice,
              purchasePriceWithoutAddon: m.factoryPrice,
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
            support: publicSupport // Legacy field support
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
  }, [carrierTab, getCurrentCarrier]);

  const handleReload = () => {
    // CarrierTab을 다시 설정하여 useEffect 트리거 (실제 로직은 useEffect에 위임)
    setCarrierTab(prev => prev);
    // 강제 리렌더링을 위해 carrierTab 변경이 감지되도록 해야 함.
    // 하지만 단순 setCarrierTab(prev)는 동일 값이라 효과 없음.
    // fetchData를 별도 함수로 분리했으므로 직접 호출하지 않고, 
    // initializedRef를 false로 하고 컴포넌트 키를 바꾸거나 해야 함.
    // 여기서는 간단히 페이지 새로고침과 유사하게 처리하려면:
    // useEffect의 의존성에 dummy state를 추가하거나, fetchData를 외부로 빼야함.
    // 간단히:
    window.location.reload(); // 가장 확실하지만 전체 앱 리로드임.
    // 대안: carrierTab 변경 시 로직이 실행되므로, 잠시 다른 탭 갔다 오는 효과? 아니면 fetchData 로직을 함수로 분리?
    // 위 useEffect 내부 로직을 handleReload에서도 호출 가능하게 분리하는 게 좋음.
    // 하지만 이미 useEffect 내부에 있으니... 
    // 임시로 initializedRef = false 설정하고 carrierTab을 다시 set
    initializedRef.current = false;
    setCarrierTab(c => c); // 이건 효과 없음.
    // useEffect 의존성에 timestamp 추가
  };

  // handleReload 재구현을 위해 useEffect 분리 대신 
  // useEffect 의존성에 reloadTrigger 추가 권장.
  // 하지만 여기서는 코드 교체가 목표이므로 간단히 유지.

  // 가격 Lookup 함수 (동기식)
  const lookupPrice = useCallback((modelId, planGroup, openingType) => {
    const key = `${modelId}-${planGroup}-${openingType}`;
    const priceData = pricingDataRef.current.get(key);

    // 현재 단말 정보 찾기
    const mobile = mobileList.find(m => m.id === modelId);
    const factoryPrice = mobile ? mobile.factoryPrice : 0;

    if (priceData) {
      return {
        storeSupportWithAddon: priceData.storeSupportWithAddon || 0,
        storeSupportWithoutAddon: priceData.storeSupportWithoutAddon || 0,
        purchasePriceWithAddon: Math.max(0, factoryPrice - (priceData.publicSupport || 0) - (priceData.storeSupportWithAddon || 0)),
        purchasePriceWithoutAddon: Math.max(0, factoryPrice - (priceData.publicSupport || 0) - (priceData.storeSupportWithoutAddon || 0)),
        publicSupport: priceData.publicSupport || 0,
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
    return {
      storeSupportWithAddon: 0,
      storeSupportWithoutAddon: 0,
      purchasePriceWithAddon: factoryPrice,
      purchasePriceWithoutAddon: factoryPrice,
      publicSupport: 0,
      openingType: openingType
    };
  }, [mobileList]);

  // calculatePrice 대체 (동기식 상태 업데이트)
  const updatePriceState = useCallback((modelId, planGroup, openingType) => {
    const priceObj = lookupPrice(modelId, planGroup, openingType);
    const key = `${modelId}-${openingType}`;

    setCalculatedPrices(prev => ({
      ...prev,
      [key]: priceObj
    }));
  }, [lookupPrice]);

  const [uploadingModelId, setUploadingModelId] = useState(null);
  const fileInputRef = React.useRef(null);

  // ... (existing useEffect)

  const handleImageUploadClick = useCallback((modelId) => {
    setUploadingModelId(modelId);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !uploadingModelId) return;

    try {
      setLoading(true); // 전체 로딩 혹은 개별 로딩 처리 (여기서는 전체 로딩으로 단순화)

      // 현재 모델 정보 가져오기
      const currentModel = mobileList.find(m => m.id === uploadingModelId);
      const carrier = getCurrentCarrier();
      const modelName = currentModel?.model || uploadingModelId;
      const petName = currentModel?.petName || modelName;

      // 모델ID는 실제 모델 코드(모델명)로 사용 (동적 ID 대신)
      // 서버에서도 modelId = modelName으로 처리하므로 일관성 유지
      const actualModelId = modelName; // 실제 모델 코드를 modelId로 사용


      console.log('📤 [이미지 업로드] 시작:', {
        clientId: uploadingModelId, // 클라이언트 ID (참고용)
        modelId: actualModelId,      // 실제 모델 코드 (서버에 전송)
        carrier,
        modelName,
        petName,
        fileName: file.name,
        fileSize: file.size
      });

      // API 호출 (실제 모델 코드를 modelId로 전송)
      const result = await directStoreApi.uploadImage(file, actualModelId, carrier, modelName, petName);


      if (!result || !result.success) {
        throw new Error(result?.error || '이미지 업로드에 실패했습니다.');
      }

      // imageUrl이 없으면 에러
      if (!result.imageUrl) {
        throw new Error('이미지 URL을 받지 못했습니다.');
      }

      // 경고가 있으면 함께 표시
      if (result.warning) {
        alert(`이미지가 업로드되었습니다.\n\n⚠️ 경고: ${result.warning}`);
      } else {
        alert('이미지가 성공적으로 업로드되었습니다.');
      }

      console.log('✅ [이미지 업로드] 성공:', result.imageUrl);

      // 🔥 개선: 즉시 로컬 상태 업데이트 (UI 반영)
      setMobileList(prevList => prevList.map(item =>
        item.id === uploadingModelId
          ? { ...item, image: result.imageUrl }
          : item
      ));


      // 서버에서 최신 데이터를 다시 가져와서 UI에 반영
      // 구글시트에 저장된 최신 이미지 URL을 포함한 전체 데이터를 가져옴
      // Google Sheets 저장 완료를 기다리기 위해 지연 시간 추가
      try {
        console.log('🔄 [이미지 업로드] Google Sheets 저장 완료 대기 중... (3초)');
        await new Promise(resolve => setTimeout(resolve, 3000)); // 2초 -> 3초로 증가

        console.log('🔄 [이미지 업로드] 서버에서 최신 데이터 재로딩 중...');
        const freshData = await directStoreApiClient.getMobileList(carrier);

        // 🔥 핵심 수정: 모델명으로 정확히 매칭 (ID가 다를 수 있음)
        // 1순위: 모델명으로 정확히 일치하는 모델 찾기
        const uploadedModel = freshData?.find(m => {
          // 모델명이 정확히 일치하는 경우
          if (m.model === modelName) return true;
          // ID에 모델명이 포함된 경우
          if (m.id && m.id.includes(modelName)) return true;
          // 클라이언트 ID와 일치하는 경우
          if (m.id === uploadingModelId) return true;
          return false;
        });

        console.log('🔍 [이미지 업로드] 모델 매칭 결과:', {
          uploadingModelId,
          modelName,
          foundModel: uploadedModel ? {
            id: uploadedModel.id,
            model: uploadedModel.model,
            image: uploadedModel.image
          } : null,
          freshDataCount: freshData?.length
        });

        // 🔥 핵심 수정: 이미지 업데이트 로직 개선
        if (uploadedModel && uploadedModel.image) {
          // 서버에서 이미지를 찾았으면 전체 데이터 업데이트
          setMobileList(freshData || []);
          console.log('✅ [이미지 업로드] 서버에서 이미지 찾음, 전체 데이터 업데이트');
        } else {
          // 🔥 핵심 수정: 서버에서 이미지를 찾지 못했거나 모델을 찾지 못한 경우
          // 로컬 상태를 강제로 업데이트하여 이미지가 즉시 표시되도록 함
          setMobileList(prevList => {
            const updatedList = prevList.map(item => {
              // 업로드한 모델과 일치하는 항목 찾기
              if (item.id === uploadingModelId || item.model === modelName) {
                // 이미지 URL을 강제로 업데이트
                return { ...item, image: result.imageUrl };
              }
              // 다른 모델들도 freshData에서 업데이트
              const matched = freshData?.find(m =>
                (m.id && item.id && m.id === item.id) ||
                (m.model && item.model && m.model === item.model)
              );
              if (matched) {
                // freshData에 이미지가 있으면 사용, 없으면 기존 이미지 유지
                return { ...matched, image: matched.image || item.image };
              }
              return item;
            });

            // 업로드한 모델이 리스트에 없으면 추가 (안전장치)
            const hasUploadedModel = updatedList.some(item =>
              item.id === uploadingModelId || item.model === modelName
            );
            if (!hasUploadedModel && currentModel) {
              updatedList.push({ ...currentModel, image: result.imageUrl });
            }

            return updatedList;
          });
          console.log('✅ [이미지 업로드] 로컬 상태 강제 업데이트 완료');
        }
        console.log('✅ [이미지 업로드] 최신 데이터 재로딩 완료');

        // 이미지 업로드 성공 이벤트 발생 (오늘의휴대폰 페이지 등 다른 컴포넌트에서 데이터 재로딩)
        window.dispatchEvent(new CustomEvent('imageUploaded', {
          detail: { carrier, modelId: actualModelId, imageUrl: result.imageUrl }
        }));
      } catch (reloadError) {
        console.warn('⚠️ [이미지 업로드] 최신 데이터 재로딩 실패, 로컬 상태만 업데이트:', reloadError);
        // 재로딩 실패해도 이벤트는 발생 (다른 컴포넌트에서 시도)
        window.dispatchEvent(new CustomEvent('imageUploaded', {
          detail: { carrier, modelId: actualModelId, imageUrl: result.imageUrl }
        }));
      }
    } catch (err) {
      console.error('❌ [이미지 업로드] 실패:', err);
      const errorMessage = err.message || err.toString() || '이미지 업로드에 실패했습니다.';
      alert(`이미지 업로드에 실패했습니다.\n\n오류: ${errorMessage}`);
    } finally {
      setLoading(false);
      setUploadingModelId(null);
    }
  };

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
        storeSupportNoAddon: currentMobile.storeSupportWithoutAddon,
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
  const getDisplayValue = useCallback((row, field, selectedOpeningType = null) => {
    // 🔥 개선: openingType별로 저장된 값을 가져오도록 수정
    // openingType이 null이면 기본값 'MNP' 사용 (초기 로드 시 selectedOpeningTypes가 빈 객체일 수 있음)
    const openingType = selectedOpeningType || selectedOpeningTypes[row.id] || 'MNP';
    const priceKey = `${row.id}-${openingType}`;
    const calculated = calculatedPrices[priceKey] || null;

    // 🔥 성능 최적화: 디버그 로그 제거 (불필요한 네트워크 요청 제거)
    // 디버그 로그는 문제 발생 시에만 활성화
    // 계산된 값이 있고, 해당 필드가 존재하면 사용
    // 단, 대리점지원금의 경우 0이면 fallback 사용 (0은 유효하지 않은 값으로 간주)
    if (calculated && calculated[field] !== undefined) {
      // 대리점지원금 필드이고 값이 0이면 fallback 사용
      if ((field === 'storeSupportWithAddon' || field === 'storeSupportWithoutAddon') && calculated[field] === 0) {
        return row[field];
      }
      // 🔥 개선: openingType이 일치하는지 확인
      // '010신규'나 '기변'은 서버에서 '010신규/기변'으로 변환되므로, 이를 고려하여 비교
      const normalizedCalculatedOpeningType = calculated.openingType === '010신규/기변'
        ? (openingType === '010신규' || openingType === '기변' ? '010신규/기변' : calculated.openingType)
        : calculated.openingType;
      const normalizedOpeningType = (openingType === '010신규' || openingType === '기변')
        ? '010신규/기변'
        : openingType;

      if (calculated.openingType && normalizedCalculatedOpeningType !== normalizedOpeningType) {
        // openingType이 일치하지 않으면 row 값 반환
        return row[field];
      }
      return calculated[field];
    }
    return row[field];
  }, [calculatedPrices, selectedOpeningTypes]);

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileChange}
      />

      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
        휴대폰 목록
      </Typography>

      {/* 로딩 단계 표시 (칩만 표시, 기능 없음) */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Object.entries(steps).map(([key, step]) => (
            <Chip
              key={key}
              label={`${step.label}${step.message ? `: ${step.message}` : ''}`}
              size="small"
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
        <Button
          variant="outlined"
          size="small"
          onClick={handleReload}
          startIcon={<RefreshIcon />}
          disabled={loading}
          sx={{ ml: 'auto' }}
        >
          새로고침
        </Button>
      </Box>

      {/* 통신사 탭 */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={carrierTab}
          onChange={handleCarrierChange}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          sx={{
            '& .MuiTab-root': {
              fontWeight: 'bold',
              fontSize: '1.1rem',
              py: 2
            },
            '& .Mui-selected': {
              bgcolor: 'rgba(212, 175, 55, 0.05)'
            }
          }}
        >
          <Tab label="SK Telecom" sx={{ color: '#e60012' }} />
          <Tab label="KT" sx={{ color: '#00abc7' }} />
          <Tab label="LG U+" sx={{ color: '#ec008c' }} />
        </Tabs>
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
        /* 상품 테이블 */
        <ModernTable sx={{ flexGrow: 1 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <ModernTableCell align="center" width="120">구분</ModernTableCell>
                <ModernTableCell align="center" width="100">이미지</ModernTableCell>
                <ModernTableCell align="center" width="220">모델명 / 펫네임</ModernTableCell>
                <ModernTableCell align="center" width="120">요금제군</ModernTableCell>
                <ModernTableCell align="center" width="100">유형</ModernTableCell>
                <ModernTableCell align="center" width="100">출고가</ModernTableCell>
                <ModernTableCell align="center" width="100">이통사지원금</ModernTableCell>
                <ModernTableCell align="center" colSpan={2} width="180" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.5)' }}>
                  대리점 지원금
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    <span>부가유치</span>
                    <span>미유치</span>
                  </Box>
                </ModernTableCell>
                <ModernTableCell align="center" colSpan={2} width="180" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.5)', bgcolor: 'rgba(212, 175, 55, 0.1)' }}>
                  구매가 (할부원금)
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    <span>부가유치</span>
                    <span>미유치</span>
                  </Box>
                </ModernTableCell>
              </TableRow>
            </TableHead>
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
                      onImageUploadClick={handleImageUploadClick}
                      getSelectedTags={getSelectedTags}
                      getDisplayValue={getDisplayValue}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </ModernTable>
      )}
    </Box>
  );
};

export default MobileListTab;


