import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { api } from '../../api';

function MeetingEditor({ open, meeting, loggedInStore, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    meetingName: '',
    meetingDate: '',
    meetingNumber: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      if (meeting) {
        // 수정 모드
        setFormData({
          meetingName: meeting.meetingName || '',
          meetingDate: meeting.meetingDate || '',
          meetingNumber: meeting.meetingNumber || ''
        });
      } else {
        // 생성 모드
        const today = new Date().toISOString().split('T')[0];
        setFormData({
          meetingName: '',
          meetingDate: today,
          meetingNumber: ''
        });
      }
      setErrors({});
      setError(null);
    }
  }, [open, meeting]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    // 에러 초기화
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.meetingName.trim()) {
      newErrors.meetingName = '회의 이름을 입력해주세요.';
    }
    
    if (!formData.meetingDate) {
      newErrors.meetingDate = '회의 날짜를 선택해주세요.';
    }
    
    if (!formData.meetingNumber || parseInt(formData.meetingNumber) <= 0) {
      newErrors.meetingNumber = '차수를 입력해주세요. (1 이상)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const meetingData = {
        meetingName: formData.meetingName.trim(),
        meetingDate: formData.meetingDate,
        meetingNumber: parseInt(formData.meetingNumber),
        createdBy: loggedInStore?.name || loggedInStore?.target || 'Unknown'
      };

      if (meeting) {
        // 수정
        await api.updateMeeting(meeting.meetingId, meetingData);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        // 생성
        const result = await api.createMeeting(meetingData);
        if (onSuccess) {
          // 생성된 회의 정보를 전달
          onSuccess(result.meeting);
        }
      }
    } catch (err) {
      console.error('회의 저장 오류:', err);
      setError(err.message || '회의 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {meeting ? '회의 수정' : '새 회의 생성'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="회의 이름"
            value={formData.meetingName}
            onChange={handleChange('meetingName')}
            error={!!errors.meetingName}
            helperText={errors.meetingName}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="회의 날짜"
            type="date"
            value={formData.meetingDate}
            onChange={handleChange('meetingDate')}
            error={!!errors.meetingDate}
            helperText={errors.meetingDate}
            margin="normal"
            required
            InputLabelProps={{
              shrink: true
            }}
          />

          <TextField
            fullWidth
            label="차수"
            type="number"
            value={formData.meetingNumber}
            onChange={handleChange('meetingNumber')}
            error={!!errors.meetingNumber}
            helperText={errors.meetingNumber || '같은 날짜에 동일 차수가 이미 존재하면 생성할 수 없습니다.'}
            margin="normal"
            required
            inputProps={{ min: 1 }}
          />

          {!meeting && (
            <Alert severity="info" sx={{ mt: 2 }}>
              회의 생성 시 설정된 모든 슬라이드가 자동으로 캡처됩니다.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          sx={{ backgroundColor: '#3949AB', '&:hover': { backgroundColor: '#303F9F' } }}
        >
          {loading ? <CircularProgress size={20} /> : (meeting ? '수정' : '생성')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MeetingEditor;

