/**
 * 가격 계산 관련 로직을 관리하는 커스텀 훅
 * MobileListTab의 복잡한 가격 계산 로직을 분리
 */
import { useState, useRef, useCallback } from 'react';
import { directStoreApiClient } from '../api/directStoreApiClient';
import { getCachedPrice, setCachedPrice } from '../utils/priceCache';

const MAX_QUEUE_PROCESSING_ATTEMPTS = 100;
const BATCH_SIZE = 1;
const DELAY_MS = 1500;
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 3000;

export const usePriceCalculation = () => {
  const [calculatedPrices, setCalculatedPrices] = useState({});
  const pendingRequestsRef = useRef(new Map());
  const priceCalculationQueueRef = useRef([]);
  const isProcessingQueueRef = useRef(false);
  const queueProcessingCountRef = useRef(0);

  /**
   * 내부 가격 계산 함수
   */
  const calculatePriceInternal = useCallback(async (
    modelId,
    planGroup,
    openingType,
    useCache = true,
    carrier
  ) => {
    const cacheKey = `${modelId}-${planGroup}-${openingType}-${carrier}`;

    // 캐시 확인
    if (useCache) {
      const cached = getCachedPrice(modelId, planGroup, openingType, carrier);
      if (cached && (cached.publicSupport !== undefined || cached.storeSupport !== undefined)) {
        setCalculatedPrices(prev => ({
          ...prev,
          [modelId]: {
            storeSupportWithAddon: cached.storeSupport || cached.storeSupportWithAddon || 0,
            storeSupportWithoutAddon: cached.storeSupportNoAddon || cached.storeSupportWithoutAddon || 0,
            purchasePriceWithAddon: cached.purchasePrice || cached.purchasePriceWithAddon || 0,
            purchasePriceWithoutAddon: cached.purchasePriceNoAddon || cached.purchasePriceWithoutAddon || 0
          }
        }));
        return;
      }
    }

    // 중복 요청 방지
    if (pendingRequestsRef.current.has(cacheKey)) {
      await pendingRequestsRef.current.get(cacheKey);
      return;
    }

    // API 호출
    const pricePromise = directStoreApiClient.calculateMobilePrice(
      modelId,
      planGroup,
      openingType,
      carrier,
      null
    ).then(result => {
      if (!result || !result.success) {
        throw new Error(result?.error || '가격 계산에 실패했습니다.');
      }

      // 캐시에 저장
      setCachedPrice(modelId, planGroup, openingType, carrier, {
        publicSupport: result.publicSupport || 0,
        storeSupport: result.storeSupportWithAddon || 0,
        storeSupportNoAddon: result.storeSupportWithoutAddon || 0,
        purchasePrice: result.purchasePriceWithAddon || 0,
        purchasePriceNoAddon: result.purchasePriceWithoutAddon || 0
      });

      // 상태 업데이트
      setCalculatedPrices(prev => ({
        ...prev,
        [modelId]: {
          storeSupportWithAddon: result.storeSupportWithAddon || 0,
          storeSupportWithoutAddon: result.storeSupportWithoutAddon || 0,
          purchasePriceWithAddon: result.purchasePriceWithAddon || 0,
          purchasePriceWithoutAddon: result.purchasePriceWithoutAddon || 0
        }
      }));

      return result;
    }).finally(() => {
      pendingRequestsRef.current.delete(cacheKey);
    });

    pendingRequestsRef.current.set(cacheKey, pricePromise);
    return pricePromise;
  }, []);

  /**
   * 가격 계산 요청 (큐에 추가)
   */
  const calculatePrice = useCallback((
    modelId,
    planGroup,
    openingType,
    useCache = true,
    carrier
  ) => {
    // 큐에 추가
    priceCalculationQueueRef.current.push({
      modelId,
      planGroup,
      openingType,
      useCache,
      carrier
    });

    // 큐 처리 시작
    processPriceCalculationQueue();
  }, []);

  /**
   * 큐 처리 함수
   */
  const processPriceCalculationQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || priceCalculationQueueRef.current.length === 0) {
      return;
    }

    // 무한루프 방지
    if (queueProcessingCountRef.current >= MAX_QUEUE_PROCESSING_ATTEMPTS) {
      console.warn('큐 처리 최대 재시도 횟수 초과');
      queueProcessingCountRef.current = 0;
      return;
    }

    isProcessingQueueRef.current = true;
    queueProcessingCountRef.current++;

    try {
      // 중복 제거
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

      // 배치 처리
      for (let i = 0; i < uniqueQueue.length; i += BATCH_SIZE) {
        const batch = uniqueQueue.slice(i, i + BATCH_SIZE);

        await Promise.allSettled(
          batch.map(async (item) => {
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
                return;
              } catch (err) {
                lastError = err;
                const isNetworkError = err.message?.includes('Failed to fetch') || 
                                     err.message?.includes('ERR_INSUFFICIENT_RESOURCES') ||
                                     err.message?.includes('NetworkError');
                
                if (!isNetworkError || retries >= MAX_RETRIES) {
                  console.error(`가격 계산 실패:`, {
                    modelId: item.modelId,
                    planGroup: item.planGroup,
                    openingType: item.openingType,
                    retries,
                    error: err
                  });
                  break;
                }

                // 지수 백오프로 재시도
                const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retries);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retries++;
              }
            }
          })
        );

        // 배치 간 지연
        if (i + BATCH_SIZE < uniqueQueue.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
      queueProcessingCountRef.current = 0;
    }
  }, [calculatePriceInternal]);

  /**
   * 계산된 가격 가져오기
   */
  const getCalculatedPrice = useCallback((modelId) => {
    return calculatedPrices[modelId] || null;
  }, [calculatedPrices]);

  /**
   * 계산된 가격 초기화
   */
  const clearCalculatedPrices = useCallback(() => {
    setCalculatedPrices({});
    priceCalculationQueueRef.current = [];
    pendingRequestsRef.current.clear();
  }, []);

  return {
    calculatedPrices,
    calculatePrice,
    getCalculatedPrice,
    clearCalculatedPrices,
    processPriceCalculationQueue
  };
};
