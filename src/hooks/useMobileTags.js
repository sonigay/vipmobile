/**
 * 모바일 태그 관리 로직을 관리하는 커스텀 훅
 * MobileListTab의 태그 관리 로직을 분리
 */
import { useState, useCallback } from 'react';
import { directStoreApiClient } from '../api/directStoreApiClient';

export const useMobileTags = (mobileList, setMobileList) => {
  const [tagMenuAnchor, setTagMenuAnchor] = useState({});

  const handleTagMenuOpen = useCallback((event, modelId) => {
    event.stopPropagation();
    event.preventDefault();
    setTagMenuAnchor(prev => {
      if (prev[modelId]) return prev;
      return { ...prev, [modelId]: event.currentTarget };
    });
  }, []);

  const handleTagMenuClose = useCallback((modelId) => {
    setTagMenuAnchor(prev => {
      if (!prev[modelId]) return prev;
      const newState = { ...prev };
      delete newState[modelId];
      return newState;
    });
  }, []);

  const handleTagChange = useCallback(async (
    modelId,
    tagType,
    checked,
    onPlanGroupChange
  ) => {
    const currentMobile = mobileList.find(m => m.id === modelId);
    if (!currentMobile) return;

    // 이전 상태 백업
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

    // 낙관적 업데이트
    setMobileList(prevList => prevList.map(item =>
      item.id === modelId
        ? {
            ...item,
            ...newTags,
            tags: Object.keys(newTags).filter(k => newTags[k])
          }
        : item
    ));

    // API 호출
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

      if (!result || !result.success) {
        throw new Error(result?.error || '태그 업데이트 실패');
      }

      // 태그 변경 시 요금제군 재계산
      if (onPlanGroupChange && (tagType === 'budget' || tagType === 'premium')) {
        onPlanGroupChange(modelId, newTags);
      }
    } catch (err) {
      console.error('구분 태그 업데이트 실패:', err);

      // 롤백
      setMobileList(prevList => prevList.map(item =>
        item.id === modelId
          ? {
              ...item,
              ...previousTags,
              tags: Object.keys(previousTags).filter(k => previousTags[k])
            }
          : item
      ));
    }
  }, [mobileList, setMobileList]);

  const getSelectedTags = useCallback((row) => {
    const tags = [];
    if (row.isPopular) tags.push('인기');
    if (row.isRecommended) tags.push('추천');
    if (row.isCheap) tags.push('저렴');
    if (row.isPremium) tags.push('프리미엄');
    if (row.isBudget) tags.push('중저가');
    return tags.length > 0 ? tags.join(', ') : '선택';
  }, []);

  return {
    tagMenuAnchor,
    handleTagMenuOpen,
    handleTagMenuClose,
    handleTagChange,
    getSelectedTags
  };
};
