import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  InputAdornment
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';

// 날짜 포맷팅 함수 (생성일시, 등록일시용)
const formatDate = (dateValue) => {
  if (!dateValue) return '-';
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return dateValue || '-';
    }
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.warn('날짜 포맷팅 오류:', dateValue, error);
    return dateValue || '-';
  }
};

const PolicyTableListTab = ({ loggedInStore, mode }) => {
  const [tabs, setTabs] = useState([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 검색/필터링
  const [searchCreator, setSearchCreator] = useState('');
  const [filterApplyDateFrom, setFilterApplyDateFrom] = useState('');

  // 권한 체크
  // 일반정책모드인 경우 modePermissions.generalPolicy로 체크
  // 정책모드인 경우 userRole로 체크
  const canAccess = mode === 'generalPolicy' 
    ? loggedInStore?.modePermissions?.generalPolicy === true
    : ['A', 'B', 'C', 'D', 'E', 'F', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'S', 'SS'].includes(loggedInStore?.userRole);
  const canDelete = loggedInStore?.userRole === 'SS' || ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(loggedInStore?.userRole);

  useEffect(() => {
    if (canAccess) {
      loadTabs();
    }
  }, [canAccess]);

  useEffect(() => {
    if (tabs.length > 0 && activeTabIndex < tabs.length) {
      loadPolicies(tabs[activeTabIndex].policyTableName);
    }
  }, [tabs, activeTabIndex]);

  const loadTabs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (mode) {
        params.append('mode', mode);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/tabs?${params}`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        // 권한 필터링은 백엔드에서 처리되지만, 프론트엔드에서도 한 번 더 확인
        setTabs(data);
        if (data.length > 0) {
          setActiveTabIndex(0);
        }
      }
    } catch (error) {
      console.error('탭 목록 로드 오류:', error);
      setError('탭 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadPolicies = async (policyTableName) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        policyTableName: policyTableName,
        ...(searchCreator && { creator: searchCreator }),
        ...(filterApplyDateFrom && { applyDateSearch: filterApplyDateFrom }),
        ...(mode && { mode: mode })
      });

      const response = await fetch(`${API_BASE_URL}/api/policy-tables?${params}`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPolicies(data);
      }
    } catch (error) {
      console.error('정책표 목록 로드 오류:', error);
      setError('정책표 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTabIndex(newValue);
    setPolicies([]);
    setSearchCreator('');
    setFilterApplyDateFrom('');
  };

  const handlePolicyClick = async (policy) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/${policy.id}`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedPolicy(data);
        setImageError(false);
        setDetailModalOpen(true);
      }
    } catch (error) {
      console.error('정책표 상세 조회 오류:', error);
      setError('정책표 상세를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleRefreshImage = async () => {
    if (!selectedPolicy) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/${selectedPolicy.id}/refresh-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.id || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedPolicy({ ...selectedPolicy, imageUrl: data.imageUrl });
        setImageError(false);
        alert('이미지가 갱신되었습니다.');
      } else {
        const errorData = await response.json();
        setError(errorData.error || '이미지 갱신에 실패했습니다.');
      }
    } catch (error) {
      console.error('이미지 갱신 오류:', error);
      setError('이미지 갱신 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyImage = async () => {
    if (!selectedPolicy || !selectedPolicy.imageUrl) return;

    try {
      const response = await fetch(selectedPolicy.imageUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);

      alert('이미지가 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error('이미지 복사 오류:', error);
      alert('이미지 복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정책표를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });

      if (response.ok) {
        const currentTab = tabs[activeTabIndex];
        if (currentTab) {
          await loadPolicies(currentTab.policyTableName);
        }
        if (selectedPolicy && selectedPolicy.id === id) {
          setDetailModalOpen(false);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('정책표 삭제 오류:', error);
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const currentTab = tabs[activeTabIndex];
    if (currentTab) {
      loadPolicies(currentTab.policyTableName);
    }
  };

  if (!canAccess) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="warning">이 탭에 접근할 권한이 없습니다.</Alert>
      </Box>
    );
  }

  const currentTab = tabs[activeTabIndex];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        정책표목록
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 탭 */}
      {tabs.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab, index) => (
              <Tab key={tab.policyTableId} label={tab.policyTableName} />
            ))}
          </Tabs>
        </Paper>
      )}

      {/* 검색/필터링 */}
      {currentTab && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="생성자 검색"
                value={searchCreator}
                onChange={(e) => setSearchCreator(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="적용일시 검색"
                value={filterApplyDateFrom}
                onChange={(e) => setFilterApplyDateFrom(e.target.value)}
                placeholder="텍스트로 검색"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button variant="contained" fullWidth onClick={handleSearch}>
                검색
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* 테이블 */}
      {loading && policies.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>정책적용일시</TableCell>
                <TableCell>생성자</TableCell>
                <TableCell>생성일시</TableCell>
                <TableCell>등록일시</TableCell>
                <TableCell>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    등록된 정책표가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((policy) => (
                  <TableRow
                    key={policy.id}
                    hover
                    onClick={() => handlePolicyClick(policy)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{policy.applyDate || '-'}</TableCell>
                    <TableCell>{policy.creator}</TableCell>
                    <TableCell>{formatDate(policy.createdAt)}</TableCell>
                    <TableCell>{formatDate(policy.registeredAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canDelete && (
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(policy.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 상세 모달 */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          정책표 상세 - {selectedPolicy?.policyTableName}
        </DialogTitle>
        <DialogContent>
          {selectedPolicy && (
            <Box>
              {/* 상단: 정책적용일시, 정책적용내용 */}
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  정책적용일시
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {selectedPolicy.applyDate || '-'}
                </Typography>
                <Typography variant="subtitle2" gutterBottom>
                  정책적용내용
                </Typography>
                <Typography variant="body1">
                  {selectedPolicy.applyContent}
                </Typography>
              </Paper>

              {/* 하단: 이미지 */}
              <Paper sx={{ p: 2 }}>
                <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshImage}
                    disabled={loading}
                  >
                    정책다시확인하기
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyImage}
                  >
                    이미지복사하기
                  </Button>
                </Box>
                {imageError ? (
                  <Alert severity="warning">
                    이미지를 불러올 수 없습니다. "정책다시확인하기" 버튼을 클릭하여 이미지를 갱신해주세요.
                  </Alert>
                ) : (
                  <Box sx={{ textAlign: 'center' }}>
                    <img
                      src={selectedPolicy.imageUrl}
                      alt="정책표"
                      style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ddd', borderRadius: 4 }}
                      onError={() => {
                        setImageError(true);
                      }}
                    />
                  </Box>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailModalOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PolicyTableListTab;

