import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { Image as ImageIcon, Delete as DeleteIcon, Description as DescriptionIcon } from '@mui/icons-material';
import { api } from '../../api';

// 파일 타입 감지 함수
const getFileType = (file) => {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type;
  
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (
    fileName.endsWith('.xlsx') || 
    fileName.endsWith('.xls') || 
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel')
  ) {
    return 'excel';
  } else if (
    fileName.endsWith('.pptx') || 
    fileName.endsWith('.ppt') || 
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint')
  ) {
    return 'ppt';
  } else if (
    fileName.endsWith('.mp4') ||
    fileName.endsWith('.mov') ||
    fileName.endsWith('.avi') ||
    fileName.endsWith('.webm') ||
    fileName.endsWith('.mkv') ||
    mimeType.startsWith('video/')
  ) {
    return 'video';
  }
  return 'unknown';
};

function CustomSlideEditor({ open, onClose, onSave, slide, meetingDate, meetingNumber }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    backgroundColor: '#ffffff',
    imageUrl: '',
    videoUrl: ''
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedFileType, setUploadedFileType] = useState(null);
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    if (open) {
      if (slide) {
        setFormData({
          title: slide.title || '',
          content: slide.content || '',
          backgroundColor: slide.backgroundColor || '#ffffff',
          imageUrl: slide.imageUrl || '',
          videoUrl: slide.videoUrl || ''
        });
        setPreviewUrl(slide.imageUrl || slide.videoUrl || null);
      } else {
        setFormData({
          title: '',
          content: '',
          backgroundColor: '#ffffff',
          imageUrl: '',
          videoUrl: ''
        });
        setPreviewUrl(null);
      }
      setUploadError(null);
    }
  }, [open, slide]);

  const handleChange = (field) => (event) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 감지
    const fileType = getFileType(file);
    
    if (fileType === 'unknown') {
      setUploadError('지원하지 않는 파일 형식입니다. (이미지, Excel, PPT, 동영상만 가능)');
      return;
    }

    // 파일 크기 제한 (25MB - Discord 제한)
    if (file.size > 25 * 1024 * 1024) {
      setUploadError('파일 크기는 25MB 이하여야 합니다.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadedFileType(fileType);

    try {
      // 이미지 파일인 경우 미리보기 생성
      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrl(e.target.result);
        };
        reader.readAsDataURL(file);
      }

      // 파일 업로드 및 변환
      const result = await api.uploadCustomSlideFile(file, meetingDate, fileType, meetingNumber);
      
      if (result.success) {
        // 동영상 파일인 경우
        if (fileType === 'video' && result.videoUrl) {
          setPreviewUrl(result.videoUrl);
          setFormData(prev => ({ ...prev, videoUrl: result.videoUrl, imageUrl: '' }));
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ [CustomSlideEditor] 동영상 업로드 완료:', result.videoUrl);
          }
        }
        // 여러 이미지가 반환될 수 있음 (Excel/PPT의 경우)
        else if (result.imageUrls && result.imageUrls.length > 0) {
          // 첫 번째 이미지를 미리보기로 사용
          setPreviewUrl(result.imageUrls[0]);
          // 첫 번째 이미지 URL 저장 (나중에 여러 이미지 처리 개선 가능)
          setFormData(prev => ({ ...prev, imageUrl: result.imageUrls[0], videoUrl: '' }));
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ [CustomSlideEditor] ${fileType} 파일 업로드 완료: ${result.imageUrls.length}개 이미지 생성`);
          }
        } else if (result.imageUrl) {
          // 단일 이미지인 경우 미리보기 URL 설정
          setPreviewUrl(result.imageUrl);
          setFormData(prev => ({ ...prev, imageUrl: result.imageUrl, videoUrl: '' }));
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ [CustomSlideEditor] 파일 업로드 완료:', result.imageUrl);
          }
        }
      } else {
        throw new Error(result.error || '파일 업로드 실패');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [CustomSlideEditor] 파일 업로드 오류:', error);
      }
      setUploadError(error.message || '파일 업로드에 실패했습니다.');
      setPreviewUrl(null);
      setUploadedFileType(null);
    } finally {
      setUploading(false);
      // 파일 입력 리셋
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, imageUrl: '', videoUrl: '' }));
    setPreviewUrl(null);
    setUploadedFileType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    const customSlide = {
      ...formData,
      slideId: slide?.slideId || `custom-${Date.now()}`,
      type: 'custom'
    };

    if (onSave) {
      onSave(customSlide);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {slide ? '커스텀 화면 수정' : '커스텀 화면 추가'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="제목"
            value={formData.title}
            onChange={handleChange('title')}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="내용"
            value={formData.content}
            onChange={handleChange('content')}
            margin="normal"
            multiline
            rows={4}
            placeholder="회의 안내, 질의응답 시간 등의 내용을 입력하세요."
          />

          <TextField
            fullWidth
            label="배경색"
            type="color"
            value={formData.backgroundColor}
            onChange={handleChange('backgroundColor')}
            margin="normal"
            InputLabelProps={{
              shrink: true
            }}
          />

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              파일 첨부 (선택사항)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              이미지, Excel, PPT, 동영상 파일을 업로드할 수 있습니다. Excel과 PPT는 자동으로 이미지로 변환됩니다.
            </Typography>
            
            {uploadError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {uploadError}
              </Alert>
            )}

            {previewUrl && (
              <Box sx={{ mb: 2, position: 'relative' }}>
                {uploadedFileType === 'video' ? (
                  <Box
                    component="video"
                    src={previewUrl}
                    controls
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: 1,
                      border: '1px solid #e0e0e0'
                    }}
                  />
                ) : (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="미리보기"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: 1,
                      border: '1px solid #e0e0e0'
                    }}
                  />
                )}
                {uploadedFileType && uploadedFileType !== 'image' && uploadedFileType !== 'video' && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    {uploadedFileType === 'excel' ? 'Excel' : 'PPT'} 파일이 이미지로 변환되었습니다.
                  </Alert>
                )}
                {uploadedFileType === 'video' && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    동영상 파일이 업로드되었습니다. 슬라이드에서 재생할 수 있습니다.
                  </Alert>
                )}
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleRemoveImage}
                  sx={{ mt: 1 }}
                >
                  파일 제거
                </Button>
              </Box>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.xlsx,.xls,.pptx,.ppt,video/*,.mp4,.mov,.avi,.webm,.mkv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            <Button
              variant="outlined"
              startIcon={uploading ? <CircularProgress size={16} /> : <DescriptionIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              fullWidth
            >
              {uploading 
                ? `업로드 중... (${uploadedFileType === 'excel' ? 'Excel 변환 중' : uploadedFileType === 'ppt' ? 'PPT 변환 중' : uploadedFileType === 'video' ? '동영상 업로드 중' : '처리 중'})` 
                : previewUrl 
                  ? '파일 변경' 
                  : '파일 선택 (이미지/Excel/PPT/동영상)'}
            </Button>
            
            {((formData.imageUrl || formData.videoUrl) && !previewUrl) && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {formData.videoUrl ? '동영상' : '이미지'} URL: {(formData.videoUrl || formData.imageUrl).substring(0, 50)}...
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          취소
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          sx={{ backgroundColor: '#3949AB', '&:hover': { backgroundColor: '#303F9F' } }}
        >
          {slide ? '수정' : '추가'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CustomSlideEditor;

