/**
 * 이미지 업로드 로직을 관리하는 커스텀 훅
 * 재사용 가능하고 옵션 기반으로 동작
 */
import { useState, useRef, useCallback } from 'react';
import { directStoreApiClient } from '../api/directStoreApiClient';

/**
 * useImageUpload 훅
 * @param {Object} options - 옵션 객체
 * @param {Function} options.onSuccess - 업로드 성공 콜백 (imageUrl, modelId, carrier 전달)
 * @param {Function} options.onError - 업로드 실패 콜백 (error 전달)
 * @param {boolean} options.autoReload - 자동 재로딩 여부 (기본값: true)
 * @param {number} options.reloadDelay - 재로딩 대기 시간(ms) (기본값: 2000)
 * @param {boolean} options.showAlert - 알림 표시 여부 (기본값: true)
 * @param {Function} options.onReload - 재로딩 함수 (autoReload가 true일 때 사용)
 * @returns {Object} { uploading, uploadingModelId, fileInputRef, handleImageUploadClick, handleFileChange, uploadImage }
 */
export const useImageUpload = (options = {}) => {
  const {
    onSuccess,
    onError,
    autoReload = true,
    reloadDelay = 2000,
    showAlert = true,
    onReload
  } = options;

  const [uploading, setUploading] = useState(false);
  const [uploadingModelId, setUploadingModelId] = useState(null);
  const fileInputRef = useRef(null);

  /**
   * 이미지 업로드 실행
   * @param {File} file - 업로드할 파일
   * @param {string} modelId - 모델 ID
   * @param {string} carrier - 통신사 (SK/KT/LG)
   * @param {string} modelName - 모델명
   * @param {string} petName - 펫네임
   */
  const uploadImage = useCallback(async (file, modelId, carrier, modelName, petName) => {
    if (!file) {
      throw new Error('파일이 선택되지 않았습니다.');
    }

    setUploading(true);

    try {
      console.log('📤 [이미지 업로드] 시작:', {
        modelId,
        carrier,
        modelName,
        petName,
        fileName: file.name,
        fileSize: file.size
      });

      const result = await directStoreApiClient.uploadImage(
        file,
        modelId,
        carrier,
        modelName,
        petName
      );

      if (!result || !result.success) {
        throw new Error(result?.error || '이미지 업로드에 실패했습니다.');
      }

      if (!result.imageUrl) {
        throw new Error('이미지 URL을 받지 못했습니다.');
      }

      console.log('✅ [이미지 업로드] 성공:', result.imageUrl);

      // 경고가 있으면 함께 표시
      if (showAlert) {
        if (result.warning) {
          alert(`이미지가 업로드되었습니다.\n\n⚠️ 경고: ${result.warning}`);
        } else {
          alert('이미지가 성공적으로 업로드되었습니다.');
        }
      }

      // 성공 콜백 호출
      if (onSuccess) {
        onSuccess(result.imageUrl, modelId, carrier, result);
      }

      // 자동 재로딩
      if (autoReload && onReload) {
        if (reloadDelay > 0) {
          console.log(`🔄 [이미지 업로드] 재로딩 대기 중... (${reloadDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, reloadDelay));
        }
        console.log('🔄 [이미지 업로드] 재로딩 시작...');
        await onReload();
        console.log('✅ [이미지 업로드] 재로딩 완료');
      }

      // 이벤트 발생 (다른 컴포넌트에서 리스닝 가능)
      window.dispatchEvent(new CustomEvent('imageUploaded', {
        detail: { carrier, modelId, imageUrl: result.imageUrl }
      }));

      return result;
    } catch (err) {
      console.error('❌ [이미지 업로드] 실패:', err);
      const errorMessage = err.message || err.toString() || '이미지 업로드에 실패했습니다.';

      if (showAlert) {
        alert(`이미지 업로드에 실패했습니다.\n\n오류: ${errorMessage}`);
      }

      // 에러 콜백 호출
      if (onError) {
        onError(err);
      }

      throw err;
    } finally {
      setUploading(false);
      setUploadingModelId(null);
    }
  }, [onSuccess, onError, autoReload, reloadDelay, showAlert, onReload]);

  /**
   * 이미지 업로드 버튼 클릭 핸들러
   * @param {string} modelId - 모델 ID
   */
  const handleImageUploadClick = useCallback((modelId) => {
    setUploadingModelId(modelId);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
      fileInputRef.current.click();
    }
  }, []);

  /**
   * 파일 선택 핸들러
   * @param {Event} event - 파일 선택 이벤트
   * @param {Object} modelInfo - 모델 정보 { modelId, carrier, modelName, petName }
   */
  const handleFileChange = useCallback(async (event, modelInfo) => {
    const file = event.target.files?.[0];
    if (!file || !uploadingModelId) return;

    // modelInfo가 없으면 기본값 사용
    const {
      modelId = uploadingModelId,
      carrier = 'SK',
      modelName = uploadingModelId,
      petName = uploadingModelId
    } = modelInfo || {};

    try {
      await uploadImage(file, modelId, carrier, modelName, petName);
    } catch (err) {
      // 에러는 uploadImage에서 처리됨
    } finally {
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [uploadingModelId, uploadImage]);

  return {
    uploading,
    uploadingModelId,
    fileInputRef,
    handleImageUploadClick,
    handleFileChange,
    uploadImage
  };
};
