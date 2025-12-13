import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { getCachedPrice, setCachedPrice, setCachedPricesBatch } from '../../utils/priceCache';

const MobileListTab = ({ onProductSelect }) => {
  const [carrierTab, setCarrierTab] = useState(0); // 0: SK, 1: KT, 2: LG
  const [mobileList, setMobileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 로딩 단계 상태 (UI 없이 상태만 추적)
  const [steps, setSteps] = useState({
    fetch: { label: '목록 로드', status: 'idle', message: '' },
    pricing: { label: '기본 요금/지원금 반영', status: 'idle', message: '' }
  });
  const [tagMenuAnchor, setTagMenuAnchor] = useState({}); // { modelId: anchorElement }
  const [planGroups, setPlanGroups] = useState([]); // 요금제군 목록
  const [selectedPlanGroups, setSelectedPlanGroups] = useState({}); // { modelId: planGroup }
  const [selectedOpeningTypes, setSelectedOpeningTypes] = useState({}); // { modelId: openingType } - 010신규, MNP, 기변
  const [calculatedPrices, setCalculatedPrices] = useState({}); // { modelId: { storeSupportWithAddon, storeSupportWithoutAddon, purchasePriceWithAddon, purchasePriceWithoutAddon } }
  const pendingRequestsRef = useRef(new Map()); // { cacheKey: Promise } - 중복 요청 방지
  const initializedRef = useRef(false); // 초기화 완료 여부 추적
  const userSelectedOpeningTypesRef = useRef(new Set()); // 사용자가 수동으로 선택한 개통유형 추적
  const priceCalculationQueueRef = useRef([]); // 가격 계산 요청 큐
  const isProcessingQueueRef = useRef(false); // 큐 처리 중 여부

  // 개통 유형 목록 (고정)
  const openingTypes = ['010신규', 'MNP', '기변'];

  const handleCarrierChange = (event, newValue) => {
    setCarrierTab(newValue);
    // 통신사 변경 시 초기화 상태 리셋
    initializedRef.current = false;
    userSelectedOpeningTypesRef.current.clear();
  };

  const getCurrentCarrier = () => {
    switch (carrierTab) {
      case 0: return 'SK';
      case 1: return 'KT';
      case 2: return 'LG';
      default: return 'SK';
    }
  };

  useEffect(() => {
    const fetchMobileList = async () => {
      try {
        setLoading(true);
        setError(null);
        setSteps(prev => ({
          ...prev,
          fetch: { ...prev.fetch, status: 'loading', message: '' },
          pricing: { ...prev.pricing, status: 'idle', message: '' }
        }));
        const carrier = getCurrentCarrier();

        const { list, meta } = await directStoreApi.getMobileList(carrier, {
          withMeta: true
        }) || {};
        const safeList = list || [];
        setMobileList(safeList);
        setSteps(prev => ({
          ...prev,
          fetch: {
            ...prev.fetch,
            status: safeList.length > 0 ? 'success' : 'empty',
            message: safeList.length > 0 ? '' : (meta?.error || '수신된 데이터가 없습니다.')
          }
        }));
      } catch (err) {
        console.error('휴대폰 목록 로딩 실패:', err);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        setMobileList([]);
        setSteps(prev => ({
          ...prev,
          fetch: { ...prev.fetch, status: 'error', message: '목록 요청 실패' }
        }));
      } finally {
        setLoading(false);
      }
    };

    fetchMobileList();
  }, [carrierTab]);

  // 초기 로딩 시 구분 태그에 따라 요금제군/유형 기본값 설정
  useEffect(() => {
    if (mobileList.length === 0 || planGroups.length === 0) return;

    const setDefaultValues = async () => {
      // 이미 초기화되었고, 사용자가 수동으로 선택한 값이 있으면 건너뛰기
      if (initializedRef.current && userSelectedOpeningTypesRef.current.size > 0) {
        return;
      }

      setSteps(prev => ({
        ...prev,
        pricing: { ...prev.pricing, status: 'loading', message: '' }
      }));
      const carrier = getCurrentCarrier();
      const newPlanGroups = { ...selectedPlanGroups };
      const newOpeningTypes = { ...selectedOpeningTypes };
      const calculationQueue = [];

      // 모든 모델에 대해 기본값 설정 및 가격 계산 준비
      const cacheEntries = [];

      for (const model of mobileList) {
        // 사용자가 수동으로 선택한 개통유형은 보존
        if (userSelectedOpeningTypesRef.current.has(model.id)) {
          // 사용자 선택값이 있으면 그대로 유지하고 가격만 재계산
          const existingPlanGroup = newPlanGroups[model.id];
          const existingOpeningType = newOpeningTypes[model.id];
          if (existingPlanGroup && existingOpeningType && planGroups.includes(existingPlanGroup)) {
            const cached = getCachedPrice(model.id, existingPlanGroup, existingOpeningType, carrier);
            if (!cached) {
              calculationQueue.push({
                modelId: model.id,
                planGroup: existingPlanGroup,
                openingType: existingOpeningType
              });
            }
          }
          continue;
        }

        // 초기 로딩 시에는 기존 값이 있어도 기본값으로 재설정하지 않음
        // 단, 값이 없을 때만 기본값 설정
        if (newPlanGroups[model.id] && newOpeningTypes[model.id]) {
          // 값이 이미 있으면 전역 캐시에서 먼저 확인
          const existingPlanGroup = newPlanGroups[model.id];
          const existingOpeningType = newOpeningTypes[model.id];
          if (planGroups.includes(existingPlanGroup)) {
            const cached = getCachedPrice(model.id, existingPlanGroup, existingOpeningType, carrier);
            // 🔥 캐시 값 검증: 초기 로드 시 서버에서 받은 publicSupport 값과 캐시 값이 크게 다르면 캐시 무시
            const serverPublicSupport = model.publicSupport || model.support || 0;
            const cachePublicSupport = cached?.publicSupport || 0;
            const isCacheValueInvalid = cached && serverPublicSupport > 0 && 
              Math.abs(cachePublicSupport - serverPublicSupport) > 100000; // 10만원 이상 차이나면 잘못된 캐시로 간주
            
            if (cached && !isCacheValueInvalid) {
              // 캐시에서 즉시 상태 업데이트
              setCalculatedPrices(prev => ({
                ...prev,
                [model.id]: {
                  storeSupportWithAddon: cached.storeSupportWithAddon || 0,
                  storeSupportWithoutAddon: cached.storeSupportWithoutAddon || 0,
                  purchasePriceWithAddon: cached.purchasePriceWithAddon || 0,
                  purchasePriceWithoutAddon: cached.purchasePriceWithoutAddon || 0,
                  publicSupport: cached.publicSupport || 0
                }
              }));
              // mobileList 상태도 업데이트
              setMobileList(prevList => prevList.map(item =>
                item.id === model.id
                  ? {
                      ...item,
                      publicSupport: cached.publicSupport || item.publicSupport || 0,
                      support: cached.publicSupport || item.support || item.publicSupport || 0
                    }
                  : item
              ));
            } else {
              // 캐시에 없으면 계산 대기열에 추가
              calculationQueue.push({
                modelId: model.id,
                planGroup: existingPlanGroup,
                openingType: existingOpeningType
              });
            }
          }
          continue;
        }

        // 구분 태그 확인
        const isPremium = model.isPremium || false;
        const isBudget = model.isBudget || false;

        // 기본값 결정 (사용자 요구사항에 맞춘 엄격한 규칙)
        let defaultPlanGroup = '115군'; // 기본값 (미선택/기타): 115군
        const defaultOpeningType = 'MNP'; // 기본값 (모든 경우): MNP (번호이동)

        if (isPremium) {
          // 프리미엄: 115군
          defaultPlanGroup = '115군';
        } else if (isBudget) {
          // 중저가: 33군 (프리미엄이 아닐 때만)
          defaultPlanGroup = '33군';
        } else {
          // 둘 다 체크 안됨: 115군
          defaultPlanGroup = '115군';
        }

        // 요금제군이 목록에 있는지 확인 (없으면 첫 번째 요금제군 사용)
        let finalPlanGroup = defaultPlanGroup;
        if (!planGroups.includes(defaultPlanGroup)) {
          // 기본값이 목록에 없으면 목록의 첫 번째 값 사용 (혹은 할당 안함)
          if (planGroups.length > 0) {
            finalPlanGroup = planGroups[0];
          } else {
            // 요금제군 목록 자체가 비었으면 건너뛰기
            continue;
          }
        }

        newPlanGroups[model.id] = finalPlanGroup;
        newOpeningTypes[model.id] = defaultOpeningType;

        // 전역 캐시에서 먼저 확인
        const cached = getCachedPrice(model.id, finalPlanGroup, defaultOpeningType, carrier);
        // 🔥 캐시 값 검증: 초기 로드 시 서버에서 받은 publicSupport 값과 캐시 값이 크게 다르면 캐시 무시
        const serverPublicSupport = model.publicSupport || model.support || 0;
        const cachePublicSupport = cached?.publicSupport || 0;
        const isCacheValueInvalid = cached && serverPublicSupport > 0 && 
          Math.abs(cachePublicSupport - serverPublicSupport) > 100000; // 10만원 이상 차이나면 잘못된 캐시로 간주
        
        if (cached && !isCacheValueInvalid) {
          // 캐시에서 즉시 상태 업데이트
          setCalculatedPrices(prev => ({
            ...prev,
            [model.id]: {
              storeSupportWithAddon: cached.storeSupportWithAddon || 0,
              storeSupportWithoutAddon: cached.storeSupportWithoutAddon || 0,
              purchasePriceWithAddon: cached.purchasePriceWithAddon || 0,
              purchasePriceWithoutAddon: cached.purchasePriceWithoutAddon || 0,
              publicSupport: cached.publicSupport || 0
            }
          }));
          // mobileList 상태도 업데이트
          setMobileList(prevList => prevList.map(item =>
            item.id === model.id
              ? {
                  ...item,
                  publicSupport: cached.publicSupport || item.publicSupport || 0,
                  support: cached.publicSupport || item.support || item.publicSupport || 0
                }
              : item
          ));
        } else {
          // 캐시에 없으면 계산 대기열에 추가 (실행은 나중에 배치 처리)
          calculationQueue.push({
            modelId: model.id,
            planGroup: finalPlanGroup,
            openingType: defaultOpeningType
          });
        }
      }

      // 상태 먼저 업데이트 (UI에 즉시 반영)
      setSelectedPlanGroups(newPlanGroups);
      setSelectedOpeningTypes(newOpeningTypes);

      // 가격 계산 배치 처리 (큐 시스템 사용)
      if (calculationQueue.length > 0) {
        // 모든 계산 요청을 큐에 추가
        calculationQueue.forEach(item => {
          calculatePrice(item.modelId, item.planGroup, item.openingType, true);
        });

        // 큐 처리가 완료될 때까지 대기 (비동기로 처리되므로 상태만 업데이트)
        setSteps(prev => ({
          ...prev,
          pricing: { ...prev.pricing, status: 'loading', message: '가격 계산 중...' }
        }));

        // 큐 처리 완료를 대략적으로 추정 (모든 요청이 큐에 추가된 후 약간의 시간 후 완료로 표시)
        setTimeout(() => {
          setSteps(prev => ({
            ...prev,
            pricing: { ...prev.pricing, status: 'success', message: '' }
          }));
        }, Math.max(1000, calculationQueue.length * 200)); // 최소 1초, 요청 수에 비례
      } else {
        setSteps(prev => ({
          ...prev,
          pricing: { ...prev.pricing, status: 'success', message: '' }
        }));
      }

      // 초기화 완료 표시
      initializedRef.current = true;
    };

    setDefaultValues();
  }, [mobileList, planGroups]);

  const handleReload = async () => {
    try {
      setLoading(true);
      setError(null);
      setSteps(prev => ({
        ...prev,
        fetch: { ...prev.fetch, status: 'loading', message: '재로딩 중' },
        pricing: { ...prev.pricing, status: 'idle', message: '' }
      }));
      const carrier = getCurrentCarrier();

      const { list, meta } = await directStoreApi.getMobileList(carrier, {
        withMeta: true
      }) || {};
      const safeList = list || [];
      setMobileList(safeList);
      setSteps(prev => ({
        ...prev,
        fetch: {
          ...prev.fetch,
          status: safeList.length > 0 ? 'success' : 'empty',
          message: safeList.length > 0 ? '' : (meta?.error || '수신된 데이터가 없습니다.')
        }
      }));
    } catch (err) {
      console.error('휴대폰 목록 재로딩 실패:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      setMobileList([]);
      setSteps(prev => ({
        ...prev,
        fetch: { ...prev.fetch, status: 'error', message: '재로딩 실패' }
      }));
    } finally {
      setLoading(false);
    }
  };

  // 요금제군 목록 로드 (캐싱으로 최적화)
  useEffect(() => {
    const fetchPlanGroups = async () => {
      try {
        const carrier = getCurrentCarrier();
        const cacheKey = `planGroups-${carrier}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            // 5분 이내 캐시면 사용
            if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
              setPlanGroups(cachedData.planGroups || []);
              return;
            }
          } catch (e) {
            // 캐시 파싱 실패 시 무시
          }
        }

        const linkSettings = await directStoreApi.getLinkSettings(carrier);
        if (linkSettings.success && linkSettings.planGroup) {
          const planGroups = linkSettings.planGroup.planGroups || [];
          setPlanGroups(planGroups);
          // 세션 스토리지에 캐싱 (5분)
          sessionStorage.setItem(cacheKey, JSON.stringify({
            planGroups,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        console.error('요금제군 목록 로딩 실패:', err);
      }
    };

    fetchPlanGroups();
  }, [carrierTab]);

  const [uploadingModelId, setUploadingModelId] = useState(null);
  const fileInputRef = React.useRef(null);

  // ... (existing useEffect)

  const handleImageUploadClick = (modelId) => {
    setUploadingModelId(modelId);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
      fileInputRef.current.click();
    }
  };

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

      // 경고가 있으면 함께 표시
      if (result.warning) {
        alert(`이미지가 업로드되었습니다.\n\n⚠️ 경고: ${result.warning}`);
      } else {
        alert('이미지가 성공적으로 업로드되었습니다.');
      }

      console.log('✅ [이미지 업로드] 성공:', result.imageUrl);

      // 서버에서 최신 데이터를 다시 가져와서 UI에 반영
      // 구글시트에 저장된 최신 이미지 URL을 포함한 전체 데이터를 가져옴
      // Google Sheets 저장 완료를 기다리기 위해 지연 시간 추가
      try {
        console.log('🔄 [이미지 업로드] Google Sheets 저장 완료 대기 중... (2초)');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        
        console.log('🔄 [이미지 업로드] 서버에서 최신 데이터 재로딩 중...');
        const freshData = await directStoreApi.getMobileList(carrier);
        setMobileList(freshData || []);
        console.log('✅ [이미지 업로드] 최신 데이터 재로딩 완료');

        // 이미지 업로드 성공 이벤트 발생 (오늘의휴대폰 페이지 등 다른 컴포넌트에서 데이터 재로딩)
        window.dispatchEvent(new CustomEvent('imageUploaded', {
          detail: { carrier, modelId: actualModelId, imageUrl: result.imageUrl }
        }));
      } catch (reloadError) {
        console.warn('⚠️ [이미지 업로드] 최신 데이터 재로딩 실패, 로컬 상태만 업데이트:', reloadError);
        // 재로딩 실패 시 로컬 상태만 업데이트 (fallback)
        setMobileList(prevList => prevList.map(item =>
          item.id === uploadingModelId
            ? { ...item, image: result.imageUrl }
            : item
        ));

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

  const handleRowClick = (model) => {
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
  };

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

      const result = await directStoreApi.updateMobileTags(modelId, payload);

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
          calculatePrice(modelId, newPlanGroup, currentOpeningType, false); // 캐시 무시하고 재계산
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

  const getSelectedTags = (row) => {
    const tags = [];
    if (row.isPopular) tags.push('인기');
    if (row.isRecommended) tags.push('추천');
    if (row.isCheap) tags.push('저렴');
    if (row.isPremium) tags.push('프리미엄');
    if (row.isBudget) tags.push('중저가');
    return tags.length > 0 ? tags.join(', ') : '선택';
  };

  // 가격 계산 요청 큐 처리 함수
  const processPriceCalculationQueue = async () => {
    if (isProcessingQueueRef.current || priceCalculationQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;

    try {
      // 큐에서 중복 제거 (같은 cacheKey는 하나만 유지)
      const uniqueQueue = [];
      const seenKeys = new Set();
      
      for (const item of priceCalculationQueueRef.current) {
        const cacheKey = `${item.modelId}-${item.planGroup}-${item.openingType}-${item.carrier}`;
        if (!seenKeys.has(cacheKey)) {
          seenKeys.add(cacheKey);
          uniqueQueue.push(item);
        }
      }

      priceCalculationQueueRef.current = [];

      // 배치 처리 설정 (캐시 비활성화 시 더 보수적으로)
      const BATCH_SIZE = 2; // 동시 실행 수 제한 (3 -> 2로 감소)
      const DELAY_MS = 1000; // 배치 간 지연 시간 (500ms -> 1000ms로 증가)
      const MAX_RETRIES = 2; // 최대 재시도 횟수
      const INITIAL_RETRY_DELAY = 2000; // 초기 재시도 지연 (2초)

      for (let i = 0; i < uniqueQueue.length; i += BATCH_SIZE) {
        const batch = uniqueQueue.slice(i, i + BATCH_SIZE);

        // 배치 실행 (재시도 로직 포함)
        await Promise.allSettled(
          batch.map(async (item, batchIndex) => {
            let retries = 0;
            let lastError = null;

            while (retries <= MAX_RETRIES) {
              try {
                await calculatePriceInternal(
                  item.modelId,
                  item.planGroup,
                  item.openingType,
                  item.useCache,
                  item.carrier
                );
                return; // 성공 시 종료
              } catch (err) {
                lastError = err;
                const isNetworkError = err.message?.includes('Failed to fetch') || 
                                     err.message?.includes('ERR_INSUFFICIENT_RESOURCES') ||
                                     err.message?.includes('NetworkError');
                
                // 네트워크 에러가 아니거나 최대 재시도 횟수에 도달하면 종료
                if (!isNetworkError || retries >= MAX_RETRIES) {
                  console.error(`가격 계산 실패 (큐 처리):`, {
                    modelId: item.modelId,
                    planGroup: item.planGroup,
                    openingType: item.openingType,
                    retries,
                    error: err
                  });
                  break;
                }

                // 지수 백오프로 재시도
                const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retries) + (batchIndex * 100);
                console.warn(`가격 계산 재시도 (${retries + 1}/${MAX_RETRIES}):`, {
                  modelId: item.modelId,
                  delay: retryDelay
                });
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retries++;
              }
            }
          })
        );

        // 마지막 배치가 아니면 지연
        if (i + BATCH_SIZE < uniqueQueue.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
    } finally {
      isProcessingQueueRef.current = false;

      // 큐에 새로운 항목이 추가되었으면 다시 처리
      if (priceCalculationQueueRef.current.length > 0) {
        // 다음 이벤트 루프에서 처리 (지연 시간 증가)
        setTimeout(() => processPriceCalculationQueue(), 200);
      }
    }
  };

  // 내부 가격 계산 함수 (실제 API 호출)
  const calculatePriceInternal = async (modelId, planGroup, openingType, useCache = true, carrier = null) => {
    if (!planGroup || !openingType) {
      return;
    }

    // 모델에서 carrier 정보 추출 (모델 ID 형식: mobile-{carrier}-{index})
    const currentModel = mobileList.find(m => m.id === modelId);
    const modelCarrier = carrier || currentModel?.carrier || getCurrentCarrier();
    
    // carrier가 현재 탭과 다르면 요청 스킵 (탭 전환 중 발생하는 잘못된 요청 방지)
    const currentTabCarrier = getCurrentCarrier();
    if (modelCarrier !== currentTabCarrier) {
      console.log(`[MobileListTab] 캐리어 불일치로 요청 스킵: modelCarrier=${modelCarrier}, tabCarrier=${currentTabCarrier}`);
      return;
    }
    
    const cacheKey = `${modelId}-${planGroup}-${openingType}-${modelCarrier}`;

    // 전역 캐시 확인
    if (useCache) {
      const cached = getCachedPrice(modelId, planGroup, openingType, modelCarrier);
      // 🔥 캐시 값 검증: 서버에서 받은 publicSupport 값과 캐시 값이 크게 다르면 캐시 무시
      const serverPublicSupport = currentModel?.publicSupport || currentModel?.support || 0;
      const cachePublicSupport = cached?.publicSupport || 0;
      const isCacheValueInvalid = cached && serverPublicSupport > 0 && 
        Math.abs(cachePublicSupport - serverPublicSupport) > 100000; // 10만원 이상 차이나면 잘못된 캐시로 간주
      
      if (cached && !isCacheValueInvalid) {
        setCalculatedPrices(prev => ({
          ...prev,
          [modelId]: {
            storeSupportWithAddon: cached.storeSupportWithAddon || 0,
            storeSupportWithoutAddon: cached.storeSupportWithoutAddon || 0,
            purchasePriceWithAddon: cached.purchasePriceWithAddon || 0,
            purchasePriceWithoutAddon: cached.purchasePriceWithoutAddon || 0,
            publicSupport: cached.publicSupport || 0
          }
        }));
        // mobileList 상태도 업데이트
        setMobileList(prevList => prevList.map(item =>
          item.id === modelId
            ? {
                ...item,
                publicSupport: cached.publicSupport || item.publicSupport || 0,
                support: cached.publicSupport || item.support || item.publicSupport || 0
              }
            : item
        ));
        return;
      }
    }

    // 중복 요청 방지
    if (pendingRequestsRef.current.has(cacheKey)) {
      try {
        const result = await pendingRequestsRef.current.get(cacheKey);
        if (result.success) {
          setCalculatedPrices(prev => ({
            ...prev,
            [modelId]: {
              storeSupportWithAddon: result.storeSupportWithAddon || 0,
              storeSupportWithoutAddon: result.storeSupportWithoutAddon || 0,
              purchasePriceWithAddon: result.purchasePriceWithAddon || 0,
              purchasePriceWithoutAddon: result.purchasePriceWithoutAddon || 0,
              publicSupport: result.publicSupport || 0
            }
          }));
          // mobileList 상태도 업데이트
          setMobileList(prevList => prevList.map(item =>
            item.id === modelId
              ? {
                ...item,
                publicSupport: result.publicSupport || item.publicSupport || 0,
                support: result.publicSupport || item.support || item.publicSupport || 0
              }
              : item
          ));
        }
      } catch (err) {
        console.error('가격 계산 실패 (대기 중 요청):', err);
      }
      return;
    }

    // 모델명 찾기 (404 에러 방지를 위해) - currentModel은 이미 위에서 찾음
    const modelName = currentModel?.model || null;

    // API 호출
    const pricePromise = directStoreApi.calculateMobilePrice(modelId, planGroup, openingType, modelCarrier, modelName)
      .then(result => {
        // 404 에러는 재시도하지 않음
        if (result.status === 404) {
          console.warn('모델을 찾을 수 없음 (404):', { modelId, modelName, planGroup, openingType, carrier: modelCarrier });
          return { success: false, status: 404 };
        }

        if (!result || !result.success) {
          throw new Error(result?.error || '가격 계산에 실패했습니다.');
        }

        return {
          success: true,
          storeSupportWithAddon: result.storeSupportWithAddon || 0,
          storeSupportWithoutAddon: result.storeSupportWithoutAddon || 0,
          purchasePriceWithAddon: result.purchasePriceWithAddon || 0,
          purchasePriceWithoutAddon: result.purchasePriceWithoutAddon || 0,
          publicSupport: result.publicSupport || 0
        };
      })
      .catch(err => {
        console.error('가격 계산 API 호출 실패:', err, { modelId, planGroup, openingType, carrier: modelCarrier });
        return { success: false, error: err.message || err.toString() };
      })
      .finally(() => {
        // 요청 완료 후 pendingRequests에서 제거
        pendingRequestsRef.current.delete(cacheKey);
      });

    // pendingRequests에 추가
    pendingRequestsRef.current.set(cacheKey, pricePromise);

    const result = await pricePromise;

    if (result.success) {
      // 캐시에 저장
      if (useCache) {
        setCachedPrice(modelId, planGroup, openingType, modelCarrier, {
          storeSupportWithAddon: result.storeSupportWithAddon,
          storeSupportWithoutAddon: result.storeSupportWithoutAddon,
          purchasePriceWithAddon: result.purchasePriceWithAddon,
          purchasePriceWithoutAddon: result.purchasePriceWithoutAddon,
          publicSupport: result.publicSupport
        });
      }

      // 상태 업데이트
      setCalculatedPrices(prev => ({
        ...prev,
        [modelId]: {
          storeSupportWithAddon: result.storeSupportWithAddon || 0,
          storeSupportWithoutAddon: result.storeSupportWithoutAddon || 0,
          purchasePriceWithAddon: result.purchasePriceWithAddon || 0,
          purchasePriceWithoutAddon: result.purchasePriceWithoutAddon || 0,
          publicSupport: result.publicSupport || 0
        }
      }));

      // mobileList 상태도 업데이트
      setMobileList(prevList => prevList.map(item =>
        item.id === modelId
          ? {
            ...item,
            publicSupport: result.publicSupport || item.publicSupport || 0,
            support: result.publicSupport || item.support || item.publicSupport || 0
          }
          : item
      ));
    }
  };

  // 가격 계산 함수 (요금제군과 유형 모두 필요) - 큐를 통한 배치 처리
  const calculatePrice = async (modelId, planGroup, openingType, useCache = true) => {
    if (!planGroup || !openingType) {
      return;
    }

    // 모델에서 carrier 정보 추출 (모델 ID 형식: mobile-{carrier}-{index})
    const currentModel = mobileList.find(m => m.id === modelId);
    const carrier = currentModel?.carrier || getCurrentCarrier();
    
    // carrier가 현재 탭과 다르면 요청 스킵 (탭 전환 중 발생하는 잘못된 요청 방지)
    const currentTabCarrier = getCurrentCarrier();
    if (carrier !== currentTabCarrier) {
      console.log(`[MobileListTab] 캐리어 불일치로 요청 스킵: modelCarrier=${carrier}, tabCarrier=${currentTabCarrier}`);
      return;
    }
    
    const cacheKey = `${modelId}-${planGroup}-${openingType}-${carrier}`;

    // 전역 캐시 확인 (캐시가 있으면 즉시 반환)
    if (useCache) {
      const cached = getCachedPrice(modelId, planGroup, openingType, carrier);
      // 🔥 캐시 값 검증: 서버에서 받은 publicSupport 값과 캐시 값이 크게 다르면 캐시 무시
      const serverPublicSupport = currentModel?.publicSupport || currentModel?.support || 0;
      const cachePublicSupport = cached?.publicSupport || 0;
      const isCacheValueInvalid = cached && serverPublicSupport > 0 && 
        Math.abs(cachePublicSupport - serverPublicSupport) > 100000; // 10만원 이상 차이나면 잘못된 캐시로 간주
      
      if (cached && !isCacheValueInvalid) {
        setCalculatedPrices(prev => ({
          ...prev,
          [modelId]: {
            storeSupportWithAddon: cached.storeSupportWithAddon || 0,
            storeSupportWithoutAddon: cached.storeSupportWithoutAddon || 0,
            purchasePriceWithAddon: cached.purchasePriceWithAddon || 0,
            purchasePriceWithoutAddon: cached.purchasePriceWithoutAddon || 0,
            publicSupport: cached.publicSupport || 0
          }
        }));
        // mobileList 상태도 업데이트
        setMobileList(prevList => prevList.map(item =>
          item.id === modelId
            ? {
                ...item,
                publicSupport: cached.publicSupport || item.publicSupport || 0,
                support: cached.publicSupport || item.support || item.publicSupport || 0
              }
            : item
        ));
        return;
      }
    }

    // 중복 요청 방지 (이미 큐에 있거나 처리 중인 요청)
    if (pendingRequestsRef.current.has(cacheKey)) {
      try {
        const result = await pendingRequestsRef.current.get(cacheKey);
        if (result && result.success) {
          setCalculatedPrices(prev => ({
            ...prev,
            [modelId]: {
              storeSupportWithAddon: result.storeSupportWithAddon || 0,
              storeSupportWithoutAddon: result.storeSupportWithoutAddon || 0,
              purchasePriceWithAddon: result.purchasePriceWithAddon || 0,
              purchasePriceWithoutAddon: result.purchasePriceWithoutAddon || 0,
              publicSupport: result.publicSupport || 0
            }
          }));
          // mobileList 상태도 업데이트
          setMobileList(prevList => prevList.map(item =>
            item.id === modelId
              ? {
                ...item,
                publicSupport: result.publicSupport || item.publicSupport || 0,
                support: result.publicSupport || item.support || item.publicSupport || 0
              }
              : item
          ));
        }
      } catch (err) {
        console.error('가격 계산 실패 (대기 중 요청):', err);
      }
      return;
    }

    // 큐 크기 제한 (너무 많은 요청 방지)
    const MAX_QUEUE_SIZE = 100;
    if (priceCalculationQueueRef.current.length >= MAX_QUEUE_SIZE) {
      console.warn(`[MobileListTab] 큐 크기 제한 도달 (${MAX_QUEUE_SIZE}), 요청 스킵:`, {
        modelId,
        planGroup,
        openingType,
        carrier
      });
      return;
    }

    // 중복 체크 (같은 요청이 이미 큐에 있으면 스킵)
    const isDuplicate = priceCalculationQueueRef.current.some(item => {
      const itemKey = `${item.modelId}-${item.planGroup}-${item.openingType}-${item.carrier}`;
      return itemKey === cacheKey;
    });

    if (isDuplicate) {
      // 중복이지만 큐가 처리 중이 아니면 추가 (처리 중이면 스킵)
      if (isProcessingQueueRef.current) {
        return;
      }
    }

    // 큐에 추가
    priceCalculationQueueRef.current.push({
      modelId,
      planGroup,
      openingType,
      carrier,
      useCache
    });

    // 큐 처리 시작 (비동기로 실행)
    processPriceCalculationQueue();
  };

  // 요금제군 선택 핸들러
  const handlePlanGroupChange = async (modelId, planGroup) => {
    if (!planGroup) {
      setSelectedPlanGroups(prev => {
        const newState = { ...prev };
        delete newState[modelId];
        return newState;
      });
      setCalculatedPrices(prev => {
        const newState = { ...prev };
        delete newState[modelId];
        return newState;
      });
      return;
    }

    setSelectedPlanGroups(prev => ({ ...prev, [modelId]: planGroup }));

    // 선택된 유형이 있으면 해당 유형으로 계산, 없으면 기본값 '010신규'로 계산
    const openingType = selectedOpeningTypes[modelId] || '010신규';
    try {
      await calculatePrice(modelId, planGroup, openingType);
    } catch (err) {
      console.error('요금제군 변경 시 가격 계산 실패:', err, { modelId, planGroup, openingType });
      // 에러 발생 시에도 무한 재시도 방지를 위해 상태는 유지
    }
  };

  // 유형 선택 핸들러
  const handleOpeningTypeChange = async (modelId, openingType) => {
    if (!openingType) {
      setSelectedOpeningTypes(prev => {
        const newState = { ...prev };
        delete newState[modelId];
        return newState;
      });
      setCalculatedPrices(prev => {
        const newState = { ...prev };
        delete newState[modelId];
        return newState;
      });
      // 사용자 선택 추적에서 제거
      userSelectedOpeningTypesRef.current.delete(modelId);
      return;
    }

    // 사용자가 수동으로 선택한 것으로 표시
    userSelectedOpeningTypesRef.current.add(modelId);

    setSelectedOpeningTypes(prev => ({ ...prev, [modelId]: openingType }));

    // 선택된 요금제군이 있으면 해당 요금제군과 유형으로 계산
    const planGroup = selectedPlanGroups[modelId];
    if (planGroup) {
      try {
        await calculatePrice(modelId, planGroup, openingType);
      } catch (err) {
        console.error('개통유형 변경 시 가격 계산 실패:', err, { modelId, planGroup, openingType });
        // 에러 발생 시에도 무한 재시도 방지를 위해 상태는 유지
      }
    }
  };

  // 표시할 값 가져오기 (계산된 값이 있으면 사용, 없으면 원래 값)
  const getDisplayValue = (row, field) => {
    const calculated = calculatedPrices[row.id];
    // 계산된 값이 있고, 해당 필드가 존재하면 사용
    // 단, 대리점지원금의 경우 0이면 fallback 사용 (0은 유효하지 않은 값으로 간주)
    if (calculated && calculatedPrices[row.id] && calculated[field] !== undefined) {
      // 대리점지원금 필드이고 값이 0이면 fallback 사용
      if ((field === 'storeSupportWithAddon' || field === 'storeSupportWithoutAddon') && calculated[field] === 0) {
        return row[field];
      }
      return calculated[field];
    }
    return row[field];
  };

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
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* 로딩 인디케이터 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* 상품 테이블 */
        <TableContainer component={Paper} sx={{ flexGrow: 1, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align="center" width="120">구분</TableCell>
                <TableCell align="center" width="100">이미지</TableCell>
                <TableCell align="center" width="220">모델명 / 펫네임</TableCell>
                <TableCell align="center" width="120">요금제군</TableCell>
                <TableCell align="center" width="100">유형</TableCell>
                <TableCell align="center" width="100">출고가</TableCell>
                <TableCell align="center" width="100">이통사지원금</TableCell>
                <TableCell align="center" colSpan={2} width="180" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.5)' }}>
                  대리점 지원금
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    <span>부가유치</span>
                    <span>미유치</span>
                  </Box>
                </TableCell>
                <TableCell align="center" colSpan={2} width="180" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.5)', bgcolor: 'rgba(212, 175, 55, 0.1)' }}>
                  구매가 (할부원금)
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    <span>부가유치</span>
                    <span>미유치</span>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mobileList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">표시할 데이터가 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                mobileList.map((row) => {
                  // directStoreApi에서 이미 계산된 값 사용
                  const purchasePriceAddon = row.purchasePriceWithAddon || (row.factoryPrice || 0) - (row.support || row.publicSupport || 0) - (row.storeSupport || 0);
                  const purchasePriceNoAddon = row.purchasePriceWithoutAddon || (row.factoryPrice || 0) - (row.support || row.publicSupport || 0) - (row.storeSupportNoAddon || 0);

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<LabelIcon />}
                          onClick={(e) => handleTagMenuOpen(e, row.id)}
                          sx={{
                            minWidth: 100,
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            py: 0.5
                          }}
                        >
                          {getSelectedTags(row)}
                        </Button>
                        <Menu
                          anchorEl={tagMenuAnchor[row.id]}
                          open={Boolean(tagMenuAnchor[row.id])}
                          onClose={() => handleTagMenuClose(row.id)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'popular', !row.isPopular);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isPopular || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip icon={<StarIcon />} label="인기" color="secondary" size="small" />
                            </ListItemText>
                          </MenuItem>
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'recommend', !row.isRecommended);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isRecommended || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip icon={<RecommendIcon />} label="추천" color="primary" size="small" />
                            </ListItemText>
                          </MenuItem>
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'cheap', !row.isCheap);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isCheap || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip label="저렴" color="success" size="small" />
                            </ListItemText>
                          </MenuItem>
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'premium', !row.isPremium);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isPremium || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip label="프리미엄" color="warning" size="small" />
                            </ListItemText>
                          </MenuItem>
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'budget', !row.isBudget);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isBudget || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip label="중저가" color="info" size="small" />
                            </ListItemText>
                          </MenuItem>
                        </Menu>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ position: 'relative', display: 'inline-block' }}>
                          <Avatar
                            variant="rounded"
                            src={row.image ? `${row.image}${row.image.includes('?') ? '&' : '?'}_t=${Date.now()}` : undefined}
                            onError={(e) => {
                              const originalSrc = e.target.src.split('?')[0]; // 쿼리 파라미터 제거
                              const retryCount = parseInt(e.target.dataset.retryCount || '0');
                              
                              // 최대 2회 재시도 (총 3회 시도)
                              if (retryCount < 2 && originalSrc) {
                                e.target.dataset.retryCount = String(retryCount + 1);
                                // 캐시 버스팅을 위해 타임스탬프 추가하여 재시도
                                setTimeout(() => {
                                  e.target.src = `${originalSrc}${originalSrc.includes('?') ? '&' : '?'}_t=${Date.now()}&retry=${retryCount + 1}`;
                                }, 1000 * (retryCount + 1)); // 1초, 2초 지연 후 재시도
                              } else {
                                // 재시도 실패 시 src를 제거하여 기본 아이콘만 표시
                                e.target.src = '';
                                e.target.onerror = null; // 무한 루프 방지
                              }
                            }}
                            sx={{ width: 60, height: 60, bgcolor: 'background.subtle' }}
                          >
                            <PhotoCameraIcon />
                          </Avatar>
                          <IconButton
                            size="small"
                            sx={{
                              position: 'absolute',
                              bottom: -8,
                              right: -8,
                              bgcolor: 'background.paper',
                              boxShadow: 1,
                              '&:hover': { bgcolor: 'primary.main', color: 'black' }
                            }}
                            onClick={() => handleImageUploadClick(row.id)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '0.95rem' }}>{row.petName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{row.model}</Typography>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Autocomplete
                          size="small"
                          options={planGroups}
                          value={selectedPlanGroups[row.id] || null}
                          onChange={(e, newValue) => handlePlanGroupChange(row.id, newValue)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="요금제군 선택"
                              sx={{ minWidth: 100 }}
                            />
                          )}
                          sx={{ minWidth: 120 }}
                        />
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Autocomplete
                          size="small"
                          options={openingTypes}
                          value={selectedOpeningTypes[row.id] || null}
                          onChange={(e, newValue) => handleOpeningTypeChange(row.id, newValue)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="유형 선택"
                              sx={{ minWidth: 80 }}
                            />
                          )}
                          sx={{ minWidth: 100 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body1"
                          sx={{
                            textDecoration: 'line-through',
                            color: 'text.secondary'
                          }}
                        >
                          {row.factoryPrice?.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ color: 'info.main' }}>
                        {getDisplayValue(row, 'publicSupport')?.toLocaleString() || row.publicSupport?.toLocaleString() || row.support?.toLocaleString()}
                      </TableCell>

                      {/* 대리점 지원금 */}
                      <TableCell align="center" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.3)', width: '90px' }}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            color: 'info.main'
                          }}
                        >
                          {(() => {
                            const displayValue = getDisplayValue(row, 'storeSupportWithAddon');
                            const fallbackValue = row.storeSupport || row.storeSupportWithAddon;
                            const finalValue = (displayValue !== undefined && displayValue !== null && displayValue !== 0)
                              ? displayValue.toLocaleString()
                              : (fallbackValue !== undefined && fallbackValue !== null ? fallbackValue.toLocaleString() : '-');
                            // #region agent log
                            // 부가유치 대리점지원금 불일치 로깅
                            if (displayValue !== undefined && displayValue !== null && fallbackValue !== undefined && fallbackValue !== null && displayValue !== fallbackValue) {
                              fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MobileListTab.js:render',message:'대리점지원금(부가유치) 불일치',data:{modelId:row.id,displayValue,fallbackValue,calculatedPrices:calculatedPrices[row.id],rowStoreSupport:row.storeSupport,rowStoreSupportWithAddon:row.storeSupportWithAddon},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'SS-A'})}).catch(()=>{});
                            }
                            // #endregion
                            return finalValue;
                          })()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ width: '90px' }}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            color: 'warning.main'
                          }}
                        >
                          {(() => {
                            const displayValue = getDisplayValue(row, 'storeSupportWithoutAddon');
                            const fallbackValue = row.storeSupportNoAddon;
                            const finalValue = (displayValue !== undefined && displayValue !== null && displayValue !== 0)
                              ? displayValue.toLocaleString()
                              : (fallbackValue !== undefined && fallbackValue !== null ? fallbackValue.toLocaleString() : '-');
                            // #region agent log
                            // 부가미유치 대리점지원금 불일치 로깅
                            if (displayValue !== undefined && displayValue !== null && fallbackValue !== undefined && fallbackValue !== null && displayValue !== fallbackValue) {
                              fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MobileListTab.js:render',message:'대리점지원금(부가미유치) 불일치',data:{modelId:row.id,displayValue,fallbackValue,calculatedPrices:calculatedPrices[row.id],rowStoreSupportNoAddon:row.storeSupportNoAddon},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'SS-B'})}).catch(()=>{});
                            }
                            // #endregion
                            return finalValue;
                          })()}
                        </Typography>
                      </TableCell>

                      {/* 구매가 (할부원금) */}
                      <TableCell align="center" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.3)', bgcolor: 'rgba(212, 175, 55, 0.05)', width: '90px' }}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontSize: '1.15rem',
                            fontWeight: 'bold',
                            color: 'primary.main'
                          }}
                        >
                          {(() => {
                            const displayValue = getDisplayValue(row, 'purchasePriceWithAddon');
                            const finalValue = displayValue !== undefined && displayValue !== null
                              ? displayValue.toLocaleString()
                              : purchasePriceAddon.toLocaleString();
                            // #region agent log
                            // 구매가가 계산값과 다를 때 로깅 (0도 정상일 수 있으므로 모든 불일치 로깅)
                            if (displayValue !== undefined && displayValue !== null && displayValue !== purchasePriceAddon) {
                              fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MobileListTab.js:render',message:'구매가(부가유치) 계산 불일치 확인',data:{modelId:row.id,displayValue,calculatedPrices:calculatedPrices[row.id],purchasePriceAddon,rowFactoryPrice:row.factoryPrice,rowSupport:row.support,rowPublicSupport:row.publicSupport,rowStoreSupport:row.storeSupport,rowStoreSupportWithAddon:row.storeSupportWithAddon,difference:Math.abs(displayValue - purchasePriceAddon),finalValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
                            }
                            // #endregion
                            return finalValue;
                          })()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: 'rgba(212, 175, 55, 0.05)', width: '90px' }}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontSize: '1.15rem',
                            fontWeight: 'bold',
                            color: 'success.main'
                          }}
                        >
                          {(() => {
                            const displayValue = getDisplayValue(row, 'purchasePriceWithoutAddon');
                            const finalValue = displayValue !== undefined && displayValue !== null
                              ? displayValue.toLocaleString()
                              : purchasePriceNoAddon.toLocaleString();
                            // #region agent log
                            // 구매가가 계산값과 다를 때 로깅 (0도 정상일 수 있으므로 모든 불일치 로깅)
                            if (displayValue !== undefined && displayValue !== null && displayValue !== purchasePriceNoAddon) {
                              fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MobileListTab.js:render',message:'구매가(부가미유치) 계산 불일치 확인',data:{modelId:row.id,displayValue,calculatedPrices:calculatedPrices[row.id],purchasePriceNoAddon,rowFactoryPrice:row.factoryPrice,rowSupport:row.support,rowPublicSupport:row.publicSupport,rowStoreSupportNoAddon:row.storeSupportNoAddon,difference:Math.abs(displayValue - purchasePriceNoAddon),finalValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                            }
                            // #endregion
                            return finalValue;
                          })()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default MobileListTab;
