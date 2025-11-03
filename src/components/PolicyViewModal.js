import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

const PolicyViewModal = ({ 
  open, 
  onClose, 
  policy, 
  onEdit, 
  onDelete,
  onViewHistory,
  loggedInStore,
  isReceptionMode = false
}) => {
  const [viewHistory, setViewHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && policy) {
      if (policy.viewHistory) {
        setViewHistory(policy.viewHistory);
      } else {
        // viewHistory가 없으면 API에서 가져오기
        fetchPolicyDetails();
      }
      
      // 접수 모드일 때 확인 이력 기록
      if (isReceptionMode && policy?.id && loggedInStore?.id && loggedInStore?.name) {
        recordViewHistory();
      }
    }
  }, [open, policy]);

  const recordViewHistory = async () => {
    if (!policy?.id || !loggedInStore?.id || !loggedInStore?.name) return;
    
    try {
      const API_URL = process.env.REACT_APP_API_URL;
      await fetch(`${API_URL}/api/onsale/policies/${policy.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: loggedInStore.id,
          companyName: loggedInStore.name
        })
      });
    } catch (error) {
      console.error('확인 이력 기록 실패:', error);
    }
  };

  const fetchPolicyDetails = async () => {
    if (!policy?.id) return;
    
    try {
      setLoading(true);
      const API_URL = process.env.REACT_APP_API_URL;
      const response = await fetch(`${API_URL}/api/onsale/policies/${policy.id}`);
      const data = await response.json();
      
      if (data.success && data.policy) {
        setViewHistory(data.policy.viewHistory || []);
      }
    } catch (error) {
      console.error('정책 상세 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setViewHistory([]);
    onClose();
  };

  const handleEdit = () => {
    handleClose();
    onEdit && onEdit(policy);
  };

  const handleDelete = async () => {
    if (!window.confirm(`"${policy.title}" 정책을 삭제하시겠습니까?`)) {
      return;
    }
    
    handleClose();
    onDelete && onDelete(policy);
  };

  // 중복 제거하여 고유 업체만 표시 (최초 조회일시 기준)
  const uniqueViewHistory = [];
  const companyMap = new Map();
  
  viewHistory.forEach(view => {
    if (!companyMap.has(view.companyId)) {
      companyMap.set(view.companyId, view);
      uniqueViewHistory.push(view);
    } else {
      // 같은 업체의 이전 조회 이력과 비교하여 최초 조회일시가 더 이른 경우 업데이트
      const existing = companyMap.get(view.companyId);
      if (view.firstViewDate && (!existing.firstViewDate || view.firstViewDate < existing.firstViewDate)) {
        const index = uniqueViewHistory.findIndex(v => v.companyId === view.companyId);
        if (index !== -1) {
          uniqueViewHistory[index] = view;
          companyMap.set(view.companyId, view);
        }
      }
    }
  });

  // 조회일시 기준 정렬 (최신순)
  uniqueViewHistory.sort((a, b) => {
    const dateA = new Date(a.firstViewDate || a.viewDate || 0);
    const dateB = new Date(b.firstViewDate || b.viewDate || 0);
    return dateB - dateA;
  });

  if (!policy) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{policy.title}</Typography>
          {policy.isPinned && (
            <Chip label="중요!" color="warning" size="small" />
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* 접수 모드일 때 워터마크 */}
        {isReceptionMode && loggedInStore?.name && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
              opacity: 0.03,
              overflow: 'hidden'
            }}
          >
            {Array.from({ length: 20 }, (_, i) => (
              <Typography
                key={i}
                sx={{
                  position: 'absolute',
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  fontSize: `${40 + Math.random() * 80}px`,
                  fontWeight: 'bold',
                  color: '#000',
                  transform: `rotate(${(Math.random() - 0.5) * 60}deg)`,
                  userSelect: 'none'
                }}
              >
                {loggedInStore.name}
              </Typography>
            ))}
          </Box>
        )}
        <Box sx={{ pt: 2, position: 'relative', zIndex: 2 }}>
          {/* 정책 정보 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              등록자: {policy.createdBy} | 등록일: {policy.createdAt}
            </Typography>
            {policy.updatedAt && (
              <Typography variant="body2" color="textSecondary">
                수정일: {policy.updatedAt}
              </Typography>
            )}
            {policy.groups && policy.groups.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  그룹: {policy.groups.join(', ')}
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 정책 내용 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              내용
            </Typography>
            <Paper sx={{ p: 2, bgcolor: '#f5f5f5', whiteSpace: 'pre-wrap' }}>
              <Typography variant="body1">
                {policy.content}
              </Typography>
            </Paper>
          </Box>

          {/* 확인 이력 (관리 모드만) */}
          {!isReceptionMode && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  확인 이력 ({uniqueViewHistory.length}개 업체)
                </Typography>
                {loading ? (
                  <Typography>로딩 중...</Typography>
                ) : uniqueViewHistory.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    아직 확인한 업체가 없습니다.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>번호</TableCell>
                          <TableCell>조회일시</TableCell>
                          <TableCell>업체명</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uniqueViewHistory.map((view, index) => (
                          <TableRow key={view.companyId || index}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              {view.firstViewDate || view.viewDate || '-'}
                            </TableCell>
                            <TableCell>{view.companyName || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {!isReceptionMode && (
          <>
            <Button onClick={handleClose} startIcon={<ArrowBackIcon />}>
              목록으로
            </Button>
            <Button onClick={handleEdit} variant="outlined" startIcon={<EditIcon />}>
              수정
            </Button>
            <Button onClick={handleDelete} variant="outlined" color="error" startIcon={<DeleteIcon />}>
              삭제
            </Button>
          </>
        )}
        {isReceptionMode && (
          <Button onClick={handleClose}>닫기</Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PolicyViewModal;

