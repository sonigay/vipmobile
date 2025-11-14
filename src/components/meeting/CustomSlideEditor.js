import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography
} from '@mui/material';

function CustomSlideEditor({ open, onClose, onSave, slide }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    backgroundColor: '#ffffff'
  });

  React.useEffect(() => {
    if (open) {
      if (slide) {
        setFormData({
          title: slide.title || '',
          content: slide.content || '',
          backgroundColor: slide.backgroundColor || '#ffffff'
        });
      } else {
        setFormData({
          title: '',
          content: '',
          backgroundColor: '#ffffff'
        });
      }
    }
  }, [open, slide]);

  const handleChange = (field) => (event) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
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

