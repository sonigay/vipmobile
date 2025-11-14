import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { api } from '../../api';

// 디버깅: import 확인
console.log('🔍 [MeetingPresentationTab] api import 결과:', api);
console.log('🔍 [MeetingPresentationTab] api.getMeetings:', api?.getMeetings);

import ImageSlideViewer from './ImageSlideViewer';

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

function MeetingPresentationTab({ loggedInStore }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [slides, setSlides] = useState([]);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    setLoading(true);
    setError(null);
    try {
      // 디버깅: api 객체 확인
      console.log('🔍 [MeetingPresentationTab] api 객체:', api);
      console.log('🔍 [MeetingPresentationTab] api.getMeetings 타입:', typeof api?.getMeetings);
      
      if (!api) {
        throw new Error('API 객체가 없습니다.');
      }
      
      if (typeof api.getMeetings !== 'function') {
        console.error('❌ [MeetingPresentationTab] getMeetings가 함수가 아닙니다:', api.getMeetings);
        throw new Error(`getMeetings 함수를 찾을 수 없습니다.`);
      }
      
      console.log('✅ [MeetingPresentationTab] getMeetings 호출 시작');
      const response = await api.getMeetings();
      console.log('✅ [MeetingPresentationTab] getMeetings 응답:', response);
      
      if (response && response.success === false) {
        throw new Error(response.error || '회의 목록 조회 실패');
      }
      // 완료된 회의만 필터링
      const completedMeetings = ((response && response.meetings) || []).filter(m => m.status === 'completed');
      setMeetings(completedMeetings);
    } catch (err) {
      console.error('❌ [MeetingPresentationTab] 회의 목록 조회 오류:', err);
      console.error('❌ [MeetingPresentationTab] 에러 스택:', err.stack);
      setError(err.message || '회의 목록을 불러오는데 실패했습니다.');
      // 에러 발생 시 빈 배열로 설정
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (meeting) => {
    try {
      setLoading(true);
      const response = await api.getMeetingConfig(meeting.meetingId);
      const loadedSlides = (response.slides || [])
        .filter(slide => slide.imageUrl) // 이미지 URL이 있는 슬라이드만
        .sort((a, b) => a.order - b.order); // 순서대로 정렬

      if (loadedSlides.length === 0) {
        alert('이 회의에는 캡처된 이미지가 없습니다.');
        setLoading(false);
        return;
      }

      setSelectedMeeting(meeting);
      setSlides(loadedSlides);
      setViewing(true);
    } catch (err) {
      console.error('회의 설정 조회 오류:', err);
      alert('회의 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setViewing(false);
    setSelectedMeeting(null);
    setSlides([]);
  };

  if (viewing && slides.length > 0) {
    return (
      <ImageSlideViewer
        slides={slides}
        onClose={handleClose}
      />
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        회의 진행
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 600 }}>회의 이름</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>날짜</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>차수</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>생성자</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>생성일시</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {meetings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      재생 가능한 회의가 없습니다.
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
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handlePlay(meeting)}
                        title="회의 재생"
                        sx={{ color: '#3949AB' }}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}

export default MeetingPresentationTab;

