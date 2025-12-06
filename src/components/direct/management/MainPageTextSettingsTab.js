import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardMedia,
  CardContent
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PhotoCamera as PhotoCameraIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../../api/directStoreApi';

const MainPageTextSettingsTab = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const [mainHeader, setMainHeader] = useState({ content: '', imageUrl: '' });
  const [transitionPages, setTransitionPages] = useState({});
  
  const [openMainHeaderModal, setOpenMainHeaderModal] = useState(false);
  const [openTransitionModal, setOpenTransitionModal] = useState(false);
  const [editingTransition, setEditingTransition] = useState(null);
  
  const [mainHeaderForm, setMainHeaderForm] = useState({ content: '', imageUrl: '' });
  const [transitionForm, setTransitionForm] = useState({
    carrier: 'SK',
    category: 'premium',
    content: '',
    imageUrl: ''
  });
  
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await directStoreApi.getMainPageTexts();
      
      if (response.success && response.data) {
        if (response.data.mainHeader) {
          setMainHeader(response.data.mainHeader);
        }
        if (response.data.transitionPages) {
          setTransitionPages(response.data.transitionPages);
        }
      }
    } catch (err) {
      console.error('문구 설정 로드 실패:', err);
      setError('문구 설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMainHeaderModal = () => {
    setMainHeaderForm({
      content: mainHeader.content || '',
      imageUrl: mainHeader.imageUrl || ''
    });
    setOpenMainHeaderModal(true);
  };

  const handleOpenTransitionModal = (carrier, category) => {
    const existing = transitionPages[carrier]?.[category];
    setTransitionForm({
      carrier: carrier || 'SK',
      category: category || 'premium',
      content: existing?.content || '',
      imageUrl: existing?.imageUrl || ''
    });
    setEditingTransition({ carrier, category });
    setOpenTransitionModal(true);
  };

  const handleImageUpload = async (file) => {
    try {
      setUploadingImage(true);
      const result = await directStoreApi.uploadTransitionPageImage(
        file,
        transitionForm.carrier,
        transitionForm.category
      );
      
      if (result.success) {
        setTransitionForm(prev => ({ ...prev, imageUrl: result.imageUrl }));
        setSuccessMessage('이미지가 업로드되었습니다.');
      } else {
        throw new Error(result.error || '이미지 업로드 실패');
      }
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
      setError(err.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveMainHeader = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await directStoreApi.saveMainPageText('', '', 'mainHeader', mainHeaderForm.content, mainHeaderForm.imageUrl);
      
      if (response.success) {
        setMainHeader(mainHeaderForm);
        setOpenMainHeaderModal(false);
        setSuccessMessage('메인헤더 문구가 저장되었습니다.');
        loadData();
      } else {
        throw new Error(response.error || '저장 실패');
      }
    } catch (err) {
      console.error('메인헤더 저장 실패:', err);
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTransition = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await directStoreApi.saveMainPageText(
        transitionForm.carrier,
        transitionForm.category,
        'transitionPage',
        transitionForm.content,
        transitionForm.imageUrl
      );
      
      if (response.success) {
        if (!transitionPages[transitionForm.carrier]) {
          setTransitionPages(prev => ({ ...prev, [transitionForm.carrier]: {} }));
        }
        setTransitionPages(prev => ({
          ...prev,
          [transitionForm.carrier]: {
            ...prev[transitionForm.carrier],
            [transitionForm.category]: {
              content: transitionForm.content,
              imageUrl: transitionForm.imageUrl
            }
          }
        }));
        
        setOpenTransitionModal(false);
        setEditingTransition(null);
        setSuccessMessage('연결페이지 문구가 저장되었습니다.');
        loadData();
      } else {
        throw new Error(response.error || '저장 실패');
      }
    } catch (err) {
      console.error('연결페이지 저장 실패:', err);
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImage = () => {
    setTransitionForm(prev => ({ ...prev, imageUrl: '' }));
  };

  const carriers = ['SK', 'KT', 'LG'];
  const categories = [
    { value: 'premium', label: '프리미엄' },
    { value: 'budget', label: '중저가' }
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        메인페이지 문구 설정
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">메인페이지 대표헤더문구</Typography>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleOpenMainHeaderModal}
              >
                수정
              </Button>
            </Stack>
            {mainHeader.content ? (
              <Typography variant="body1" sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                {mainHeader.content}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                설정된 문구가 없습니다.
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>연결페이지 문구설정</Typography>
            <Divider sx={{ my: 2 }} />
            
            {carriers.map(carrier => (
              <Box key={carrier} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                  {carrier} 통신사
                </Typography>
                <Grid container spacing={2}>
                  {categories.map(category => {
                    const data = transitionPages[carrier]?.[category.value];
                    return (
                      <Grid item xs={12} sm={6} key={`${carrier}-${category.value}`}>
                        <Card>
                          <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                              <Typography variant="subtitle2">{category.label}</Typography>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenTransitionModal(carrier, category.value)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                            {data?.content ? (
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {data.content}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                설정된 문구가 없습니다.
                              </Typography>
                            )}
                            {data?.imageUrl && (
                              <CardMedia
                                component="img"
                                image={data.imageUrl}
                                alt="연결페이지 이미지"
                                sx={{ maxHeight: 100, objectFit: 'contain', mt: 1 }}
                              />
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={openMainHeaderModal} onClose={() => setOpenMainHeaderModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>메인페이지 대표헤더문구 수정</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="문구내용"
              multiline
              rows={4}
              fullWidth
              value={mainHeaderForm.content}
              onChange={(e) => setMainHeaderForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="예: 구매가는 정책에따라 매일 변동될수 있습니다. 오늘도 좋은하루 되세요!"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMainHeaderModal(false)}>취소</Button>
          <Button onClick={handleSaveMainHeader} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={20} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openTransitionModal} onClose={() => setOpenTransitionModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>연결페이지 문구 수정</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>통신사</InputLabel>
              <Select
                value={transitionForm.carrier}
                label="통신사"
                onChange={(e) => setTransitionForm(prev => ({ ...prev, carrier: e.target.value }))}
              >
                {carriers.map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>카테고리</InputLabel>
              <Select
                value={transitionForm.category}
                label="카테고리"
                onChange={(e) => setTransitionForm(prev => ({ ...prev, category: e.target.value }))}
              >
                {categories.map(c => (
                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="문구내용"
              multiline
              rows={3}
              fullWidth
              value={transitionForm.content}
              onChange={(e) => setTransitionForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder={transitionForm.category === 'premium' 
                ? '예: 최신 스마트폰을 만나보세요! 프리미엄 기기의 혜택을 놓치지 마세요.'
                : '예: 저렴한걸 찾으신다면 추천합니다. 합리적인 가격의 중저가폰을 확인해보세요.'}
            />
            
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                  }
                }}
              />
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? '업로드 중...' : '이미지 업로드'}
                </Button>
                {transitionForm.imageUrl && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteImage}
                  >
                    이미지 삭제
                  </Button>
                )}
              </Stack>
              {transitionForm.imageUrl && (
                <CardMedia
                  component="img"
                  image={transitionForm.imageUrl}
                  alt="미리보기"
                  sx={{ maxHeight: 200, objectFit: 'contain', mt: 2, borderRadius: 1 }}
                />
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTransitionModal(false)}>취소</Button>
          <Button onClick={handleSaveTransition} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={20} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
      />
    </Box>
  );
};

export default MainPageTextSettingsTab;
