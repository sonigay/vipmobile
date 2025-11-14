import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Chip,
  Stack,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
// api import - named export와 default export 모두 지원
import apiObj, { api as namedApi } from '../../api';
const api = namedApi || apiObj.default || apiObj.api || apiObj;

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  } catch (error) {
    return value;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'capturing':
      return 'warning';
    case 'preparing':
      return 'info';
    default:
      return 'default';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'completed':
      return '완료';
    case 'capturing':
      return '캡처중';
    case 'preparing':
      return '준비중';
    default:
      return status;
  }
};

function MeetingList({ onAdd, onEdit, onDelete, onSelect, refreshTrigger }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMeetings = async () => {
    setLoading(true);
    setError(null);
    try {
      // api 객체 확인
      if (!api || typeof api.getMeetings !== 'function') {
        throw new Error('API 함수를 찾을 수 없습니다.');
      }
      
      const response = await api.getMeetings();
      if (response && response.success === false) {
        throw new Error(response.error || '회의 목록 조회 실패');
      }
      setMeetings((response && response.meetings) || []);
    } catch (err) {
      console.error('회의 목록 조회 오류:', err);
      setError(err.message || '회의 목록을 불러오는데 실패했습니다.');
      // 에러 발생 시 빈 배열로 설정
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, [refreshTrigger]);

  const handleDelete = async (meetingId, meetingName) => {
    if (!window.confirm(`"${meetingName}" 회의를 삭제하시겠습니까?\n\n구글시트에서만 삭제되며, Discord 이미지는 유지됩니다.`)) {
      return;
    }

    try {
      await api.deleteMeeting(meetingId);
      await loadMeetings();
      if (onDelete) onDelete();
    } catch (err) {
      console.error('회의 삭제 오류:', err);
      alert('회의 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          회의 목록
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          sx={{ backgroundColor: '#3949AB', '&:hover': { backgroundColor: '#303F9F' } }}
        >
          새 회의 생성
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 600 }}>회의 이름</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>날짜</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>차수</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>생성자</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>생성일시</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>상태</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {meetings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    등록된 회의가 없습니다. 새 회의를 생성해주세요.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              meetings.map((meeting) => (
                <TableRow key={meeting.meetingId} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {meeting.meetingName || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{meeting.meetingDate || '-'}</TableCell>
                  <TableCell>{meeting.meetingNumber || '-'}</TableCell>
                  <TableCell>{meeting.createdBy || '-'}</TableCell>
                  <TableCell>{formatDateTime(meeting.createdAt)}</TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(meeting.status)}
                      color={getStatusColor(meeting.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton
                        size="small"
                        onClick={() => onSelect && onSelect(meeting)}
                        title={meeting.status === 'completed' ? '회의 재생' : '설정 편집'}
                        sx={{ color: meeting.status === 'completed' ? '#3949AB' : 'inherit' }}
                      >
                        {meeting.status === 'completed' ? (
                          <PlayArrowIcon fontSize="small" />
                        ) : (
                          <EditIcon fontSize="small" />
                        )}
                      </IconButton>
                      {meeting.status !== 'completed' && (
                        <IconButton
                          size="small"
                          onClick={() => onEdit && onEdit(meeting)}
                          title="회의 정보 수정"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(meeting.meetingId, meeting.meetingName)}
                        title="삭제"
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default MeetingList;

