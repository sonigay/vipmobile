/**
 * 이미지 업로드 버튼 컴포넌트
 * 재사용 가능한 이미지 업로드 UI 컴포넌트
 */
import React from 'react';
import { IconButton, CircularProgress, Tooltip } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useImageUpload } from '../../../hooks/useImageUpload';

/**
 * ImageUploadButton 컴포넌트
 * @param {Object} props
 * @param {string} props.modelId - 모델 ID
 * @param {string} props.carrier - 통신사 (SK/KT/LG)
 * @param {string} props.modelName - 모델명
 * @param {string} props.petName - 펫네임
 * @param {Function} props.onUploadSuccess - 업로드 성공 콜백 (imageUrl, modelId, carrier 전달)
 * @param {Function} props.onUploadError - 업로드 실패 콜백 (error 전달)
 * @param {boolean} props.autoReload - 자동 재로딩 여부 (기본값: true)
 * @param {number} props.reloadDelay - 재로딩 대기 시간(ms) (기본값: 2000)
 * @param {boolean} props.showAlert - 알림 표시 여부 (기본값: true)
 * @param {Function} props.onReload - 재로딩 함수
 * @param {Object} props.sx - Material-UI sx prop
 * @param {string} props.size - 아이콘 크기 (small, medium, large)
 * @param {string} props.color - 아이콘 색상
 * @param {string} props.tooltip - 툴팁 텍스트
 * @param {...Object} props.other - 기타 props (IconButton에 전달)
 */
const ImageUploadButton = ({
  modelId,
  carrier,
  modelName,
  petName,
  onUploadSuccess,
  onUploadError,
  autoReload = true,
  reloadDelay = 2000,
  showAlert = true,
  onReload,
  sx,
  size = 'small',
  color = 'default',
  tooltip = '이미지 업로드',
  ...other
}) => {
  const {
    uploading,
    uploadingModelId,
    fileInputRef,
    handleImageUploadClick,
    handleFileChange
  } = useImageUpload({
    onSuccess: onUploadSuccess,
    onError: onUploadError,
    autoReload,
    reloadDelay,
    showAlert,
    onReload
  });

  const isUploading = uploading && uploadingModelId === modelId;

  const handleClick = () => {
    handleImageUploadClick(modelId);
  };

  const handleFileSelect = (event) => {
    handleFileChange(event, {
      modelId,
      carrier,
      modelName,
      petName
    });
  };

  const button = (
    <IconButton
      onClick={handleClick}
      disabled={isUploading}
      size={size}
      color={color}
      sx={{
        ...sx,
        ...(isUploading && {
          opacity: 0.6,
          cursor: 'not-allowed'
        })
      }}
      {...other}
    >
      {isUploading ? (
        <CircularProgress size={size === 'small' ? 16 : size === 'large' ? 24 : 20} />
      ) : (
        <EditIcon fontSize={size} />
      )}
    </IconButton>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      {tooltip ? (
        <Tooltip title={isUploading ? '업로드 중...' : tooltip}>
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </>
  );
};

export default ImageUploadButton;
export { ImageUploadButton };

