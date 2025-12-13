/**
 * 이미지 업로드 로직을 관리하는 커스텀 훅
 * MobileListTab의 이미지 업로드 로직을 분리
 */
import { useState, useRef, useCallback } from 'react';
import { directStoreApiClient } from '../api/directStoreApiClient';

export const useImageUpload = (mobileList, setMobileList, getCurrentCarrier) => {
  const [uploadingModelId, setUploadingModelId] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageUploadClick = useCallback((modelId) => {
    setUploadingModelId(modelId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !uploadingModelId) return;

    try {
      const currentModel = mobileList.find(m => m.id === uploadingModelId);
      const carrier = getCurrentCarrier();
      const modelName = currentModel?.model || uploadingModelId;
      const petName = currentModel?.petName || modelName;
      const actualModelId = modelName;

      const result = await directStoreApiClient.uploadImage(
        file,
        actualModelId,
        carrier,
        modelName,
        petName
      );

      if (!result || !result.success) {
        throw new Error(result?.error || '이미지 업로드에 실패했습니다.');
      }

      if (result.warning) {
        alert(`이미지가 업로드되었습니다.\n\n⚠️ 경고: ${result.warning}`);
      } else {
        alert('이미지가 성공적으로 업로드되었습니다.');
      }

      // Google Sheets 저장 완료 대기
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 최신 데이터 재로딩
      const freshData = await directStoreApiClient.getMobileList(carrier);
      setMobileList(freshData || []);

      // 이벤트 발생
      window.dispatchEvent(new CustomEvent('imageUploaded', {
        detail: { carrier, modelId: actualModelId, imageUrl: result.imageUrl }
      }));
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
      const errorMessage = err.message || err.toString() || '이미지 업로드에 실패했습니다.';
      alert(`이미지 업로드에 실패했습니다.\n\n오류: ${errorMessage}`);
    } finally {
      setUploadingModelId(null);
    }
  }, [uploadingModelId, mobileList, setMobileList, getCurrentCarrier]);

  return {
    uploadingModelId,
    fileInputRef,
    handleImageUploadClick,
    handleFileChange
  };
};
