import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  CircularProgress,
  LinearProgress,
  Alert,
  Chip,
  IconButton
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';

const PolicyTableCreationTab = ({ loggedInStore }) => {
  const [settings, setSettings] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 생성 모달 상태
  const [creationModalOpen, setCreationModalOpen] = useState(false);
  const [selectedPolicyTable, setSelectedPolicyTable] = useState(null);
  const [creationFormData, setCreationFormData] = useState({
    applyDate: '',
    applyContent: '',
    accessGroupId: null
  });

  // 생성 진행 상태
  const [generationStatus, setGenerationStatus] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [generatedResult, setGeneratedResult] = useState(null);

  // 권한 체크
  const canAccess = ['S', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(loggedInStore?.userRole);

  useEffect(() => {
    if (canAccess) {
      loadSettings();
      loadUserGroups();
    }
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [canAccess]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-table-settings`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        // 현재 사용자의 권한에 맞는 정책표만 필터링
        const userRole = loggedInStore?.userRole;
        const filtered = data.filter(setting => {
          if (userRole === 'S') return true; // 정산팀은 모든 정책표 접근 가능
          return setting.creatorPermissions.includes(userRole);
        });
        setSettings(filtered);
      }
    } catch (error) {
      console.error('정책표 설정 로드 오류:', error);
      setError('정책표 설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadUserGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/policy-table/user-groups`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUserGroups(data);
      }
    } catch (error) {
      console.error('일반사용자 그룹 로드 오류:', error);
    }
  };

  const handleOpenCreationModal = (policyTable) => {
    setSelectedPolicyTable(policyTable);
    setCreationFormData({
      applyDate: '',
      applyContent: '',
      accessGroupId: null
    });
    setGenerationStatus(null);
    setGeneratedResult(null);
    setCreationModalOpen(true);
  };

  const handleCloseCreationModal = () => {
    setCreationModalOpen(false);
    setSelectedPolicyTable(null);
    setCreationFormData({
      applyDate: '',
      applyContent: '',
      accessGroupId: null
    });
    setGenerationStatus(null);
    setGeneratedResult(null);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const handleStartGeneration = async () => {
    if (!selectedPolicyTable) return;

    try {
      setLoading(true);
      setError(null);
      setGenerationStatus({ status: 'queued', progress: 0, message: '생성 요청 중...' });

      const response = await fetch(`${API_BASE_URL}/api/policy-table/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.id || ''
        },
        body: JSON.stringify({
          policyTableId: selectedPolicyTable.id,
          applyDate: creationFormData.applyDate,
          applyContent: creationFormData.applyContent,
          accessGroupId: creationFormData.accessGroupId
        })
      });

      if (response.ok) {
        const data = await response.json();
        const jobId = data.jobId;

        // 상태 폴링 시작 (하이브리드 폴링)
        startPolling(jobId);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '정책표 생성 요청에 실패했습니다.');
        setGenerationStatus({ status: 'failed', progress: 0, message: '생성 요청 실패' });
      }
    } catch (error) {
      console.error('정책표 생성 요청 오류:', error);
      setError('정책표 생성 요청 중 오류가 발생했습니다.');
      setGenerationStatus({ status: 'failed', progress: 0, message: '생성 요청 실패' });
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (jobId) => {
    let pollInterval = 2000; // 초기 2초 간격
    let consecutiveNoChange = 0;

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/policy-table/generate/${jobId}/status`, {
          headers: {
            'x-user-role': loggedInStore?.userRole || '',
            'x-user-id': loggedInStore?.id || ''
          }
        });

        if (response.ok) {
          const status = await response.json();
          setGenerationStatus(status);

          if (status.status === 'completed') {
            setGeneratedResult(status.result);
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
          } else if (status.status === 'failed') {
            setError(status.error || '정책표 생성에 실패했습니다.');
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
          } else if (status.status === 'processing') {
            // 진행 중이면 짧은 간격으로 폴링
            pollInterval = 2000;
            consecutiveNoChange = 0;
          } else {
            // 대기 중이면 긴 간격으로 폴링
            consecutiveNoChange++;
            if (consecutiveNoChange > 3) {
              pollInterval = 10000; // 10초
            }
          }
        }
      } catch (error) {
        console.error('상태 조회 오류:', error);
      }
    };

    // 즉시 한 번 실행
    poll();

    // 주기적으로 실행
    const interval = setInterval(poll, pollInterval);
    setPollingInterval(interval);
  };

  const handleRegister = async () => {
    if (!generatedResult) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/${generatedResult.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.id || ''
        }
      });

      if (response.ok) {
        alert('정책표가 등록되었습니다.');
        handleCloseCreationModal();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '정책표 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('정책표 등록 오류:', error);
      setError('정책표 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="warning">이 탭에 접근할 권한이 없습니다.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        정책표생성
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && settings.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {settings.map((setting) => (
            <Grid item xs={12} sm={6} md={4} key={setting.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {setting.policyTableName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    디스코드 채널: {setting.discordChannelId}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    {setting.creatorPermissions.map((perm) => (
                      <Chip key={perm} label={perm} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                    ))}
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => handleOpenCreationModal(setting)}
                  >
                    생성
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* 생성 모달 */}
      <Dialog open={creationModalOpen} onClose={handleCloseCreationModal} maxWidth="md" fullWidth>
        <DialogTitle>
          정책표 생성 - {selectedPolicyTable?.policyTableName}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책적용일시"
                type="datetime-local"
                value={creationFormData.applyDate}
                onChange={(e) => setCreationFormData({ ...creationFormData, applyDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책적용내용"
                value={creationFormData.applyContent}
                onChange={(e) => setCreationFormData({ ...creationFormData, applyContent: e.target.value })}
                multiline
                rows={4}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                options={userGroups}
                getOptionLabel={(option) => option.groupName}
                value={userGroups.find(g => g.id === creationFormData.accessGroupId) || null}
                onChange={(event, newValue) => {
                  setCreationFormData({
                    ...creationFormData,
                    accessGroupId: newValue ? newValue.id : null
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="접근권한 (일반사용자 그룹)"
                    placeholder="그룹을 선택하세요 (선택사항)"
                  />
                )}
              />
            </Grid>

            {/* 생성 진행 상황 */}
            {generationStatus && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {generationStatus.message || '처리 중...'}
                    </Typography>
                    {generationStatus.progress !== undefined && (
                      <LinearProgress
                        variant="determinate"
                        value={generationStatus.progress}
                        sx={{ mt: 1 }}
                      />
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {generationStatus.progress || 0}%
                    </Typography>
                  </Box>

                  {generationStatus.status === 'completed' && generatedResult && (
                    <Box>
                      <Alert severity="success" sx={{ mb: 2 }}>
                        정책표 생성이 완료되었습니다.
                      </Alert>
                      <Box sx={{ mb: 2, textAlign: 'center' }}>
                        <img
                          src={generatedResult.imageUrl}
                          alt="생성된 정책표"
                          style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ddd', borderRadius: 4 }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </Box>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleRegister}
                        disabled={loading}
                        startIcon={<CheckCircleIcon />}
                      >
                        정책표등록
                      </Button>
                    </Box>
                  )}

                  {generationStatus.status === 'failed' && (
                    <Alert severity="error">
                      {generationStatus.error || '정책표 생성에 실패했습니다.'}
                    </Alert>
                  )}
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreationModal}>취소</Button>
          {!generationStatus || generationStatus.status === 'failed' ? (
            <Button
              onClick={handleStartGeneration}
              variant="contained"
              disabled={loading || !creationFormData.applyDate || !creationFormData.applyContent}
            >
              {loading ? <CircularProgress size={24} /> : '정책표생성'}
            </Button>
          ) : generationStatus.status === 'completed' ? (
            <Button
              onClick={() => handleOpenCreationModal(selectedPolicyTable)}
              variant="outlined"
              startIcon={<RefreshIcon />}
            >
              다시 생성
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PolicyTableCreationTab;

