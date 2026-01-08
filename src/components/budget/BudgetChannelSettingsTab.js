import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Autocomplete,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';

const BudgetChannelSettingsTab = ({ loggedInStore }) => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 예산채널 설정 모달 상태
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [settingsFormData, setSettingsFormData] = useState({
    channelName: '',
    channelDescription: '',
    channelLink: '',
    yearMonth: '',
    checkerPermissions: []
  });

  // 팀장 권한자 목록 (대리점아이디관리 시트에서 가져옴)
  const [teamLeaders, setTeamLeaders] = useState([]);
  
  // 년월 필터
  const [selectedYearMonth, setSelectedYearMonth] = useState('');
  const [availableYearMonths, setAvailableYearMonths] = useState([]);

  // 권한 체크
  const canAccess = loggedInStore?.userRole === 'SS';

  useEffect(() => {
    if (canAccess) {
      loadTeamLeaders();
    }
  }, [canAccess]);

  const loadSettings = async (yearMonth = null) => {
    try {
      setLoading(true);
      const url = new URL(`${API_BASE_URL}/api/budget-channel-settings`);
      if (yearMonth) {
        url.searchParams.append('yearMonth', yearMonth);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        
        // 사용 가능한 년월 목록 추출 (중복 제거, 정렬)
        const yearMonths = [...new Set(data.map(s => s.yearMonth).filter(Boolean))].sort().reverse();
        setAvailableYearMonths(yearMonths);
      } else {
        setError('예산채널 설정을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('예산채널 설정 로드 오류:', error);
      setError('예산채널 설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (canAccess) {
      loadSettings(selectedYearMonth || null);
    }
  }, [canAccess, selectedYearMonth]);

  const loadTeamLeaders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`);
      if (response.ok) {
        const agents = await response.json();
        
        // 동적으로 두 글자 대문자 권한 레벨 필터링 (팀장: AA, BB, CC, DD, EE, FF 등)
        const twoLetterPattern = /^[A-Z]{2}$/;
        
        const ssAgent = agents.find(agent => agent.permissionLevel === 'SS');
        
        const leaders = agents
          .filter(agent => {
            const permissionLevel = agent.permissionLevel;
            return permissionLevel && (permissionLevel === 'SS' || twoLetterPattern.test(permissionLevel));
          })
          .map(agent => {
            const permissionLevel = agent.permissionLevel;
            let name = agent.target;
            if (permissionLevel === 'SS' && ssAgent && ssAgent.target) {
              name = ssAgent.target;
            } else if (!name || name.trim() === '') {
              name = permissionLevel;
            }
            const qualification = agent.qualification || '';
            
            let finalQualification = qualification;
            if (permissionLevel === 'SS' && ssAgent && ssAgent.qualification) {
              finalQualification = ssAgent.qualification;
            }
            
            const displayName = finalQualification 
              ? `${name} (${finalQualification})`
              : name;
            
            return {
              code: permissionLevel,
              name: displayName
            };
          });
        
        const hasSS = leaders.some(leader => leader.code === 'SS');
        if (!hasSS) {
          if (ssAgent && ssAgent.target) {
            const name = ssAgent.target;
            const qualification = ssAgent.qualification || '';
            leaders.unshift({
              code: 'SS',
              name: qualification ? `${name} (${qualification})` : name
            });
          } else {
            leaders.unshift({
              code: 'SS',
              name: '총괄 (총괄)'
            });
          }
        } else {
          const ssLeader = leaders.find(leader => leader.code === 'SS');
          if (ssLeader && ssAgent && ssAgent.target) {
            const name = ssAgent.target;
            const qualification = ssAgent.qualification || '';
            if (!ssLeader.name || ssLeader.name.includes('총괄') || ssLeader.name === 'SS') {
              ssLeader.name = qualification ? `${name} (${qualification})` : name;
            }
          }
        }
        
        leaders.sort((a, b) => {
          if (a.code === 'SS') return -1;
          if (b.code === 'SS') return 1;
          return a.code.localeCompare(b.code);
        });
        
        console.log('팀장 목록 로드 완료:', leaders);
        setTeamLeaders(leaders);
      } else {
        console.error('팀장 목록 로드 실패:', response.status);
        setTeamLeaders([{
          code: 'SS',
          name: '총괄 (SS)'
        }]);
      }
    } catch (error) {
      console.error('팀장 목록 로드 오류:', error);
      setTeamLeaders([{
        code: 'SS',
        name: '총괄 (SS)'
      }]);
    }
  };

  const handleOpenSettingsModal = (setting = null) => {
    if (setting) {
      setEditingSetting(setting);
      setSettingsFormData({
        channelName: setting.channelName,
        channelDescription: setting.channelDescription || '',
        channelLink: setting.channelLink,
        yearMonth: setting.yearMonth || '',
        checkerPermissions: setting.checkerPermissions || []
      });
    } else {
      setEditingSetting(null);
      // 기본값: 현재 년월
      const now = new Date();
      const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setSettingsFormData({
        channelName: '',
        channelDescription: '',
        channelLink: '',
        yearMonth: defaultYearMonth,
        checkerPermissions: []
      });
    }
    setSettingsModalOpen(true);
  };

  const handleCloseSettingsModal = () => {
    setSettingsModalOpen(false);
    setEditingSetting(null);
    const now = new Date();
    const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSettingsFormData({
      channelName: '',
      channelDescription: '',
      channelLink: '',
      yearMonth: defaultYearMonth,
      checkerPermissions: []
    });
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      const url = editingSetting
        ? `${API_BASE_URL}/api/budget-channel-settings/${editingSetting.id}`
        : `${API_BASE_URL}/api/budget-channel-settings`;
      
      const method = editingSetting ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.id || ''
        },
        body: JSON.stringify(settingsFormData)
      });

      if (response.ok) {
        await loadSettings();
        handleCloseSettingsModal();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('예산채널 설정 저장 오류:', error);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSettings = async (id) => {
    if (!window.confirm('예산채널 설정을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/budget-channel-settings/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.id || ''
        }
      });

      if (response.ok) {
        await loadSettings();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('예산채널 설정 삭제 오류:', error);
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        채널별예산시트설정
      </Typography>

      {!canAccess && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          이 탭은 SS(총괄) 권한만 접근할 수 있습니다.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {canAccess && (
      <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6">예산채널 설정 목록</Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>년월 필터</InputLabel>
                <Select
                  value={selectedYearMonth}
                  onChange={(e) => setSelectedYearMonth(e.target.value)}
                  label="년월 필터"
                >
                  <MenuItem value="">전체</MenuItem>
                  {availableYearMonths.map(ym => (
                    <MenuItem key={ym} value={ym}>{ym}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenSettingsModal()}
            >
              예산시트 추가
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>예산채널이름</TableCell>
                    <TableCell>년월</TableCell>
                    <TableCell>예산채널링크</TableCell>
                    <TableCell>확인자적용권한</TableCell>
                    <TableCell>등록일시</TableCell>
                    <TableCell>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {settings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        등록된 예산채널 설정이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    settings.map((setting) => (
                      <TableRow key={setting.id}>
                        <TableCell>{setting.channelName}</TableCell>
                        <TableCell>{setting.yearMonth || '-'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {setting.channelLink}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {setting.checkerPermissions.map((perm) => {
                            const leader = teamLeaders.find(l => l.code === perm);
                            const displayLabel = leader 
                              ? `${leader.name} (${perm})` 
                              : perm;
                            return (
                              <Chip key={perm} label={displayLabel} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                            );
                          })}
                        </TableCell>
                        <TableCell>{new Date(setting.registeredAt).toLocaleString('ko-KR')}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleOpenSettingsModal(setting)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteSettings(setting.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
      </Box>

      {/* 예산채널 설정 모달 */}
      <Dialog open={settingsModalOpen} onClose={handleCloseSettingsModal} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSetting ? '예산채널 설정 수정' : '예산채널 설정 추가'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="예산채널이름"
                value={settingsFormData.channelName}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, channelName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="예산채널설명"
                value={settingsFormData.channelDescription}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, channelDescription: e.target.value })}
                multiline
                rows={2}
                placeholder="예산채널에 대한 설명을 입력하세요"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="예산채널링크"
                value={settingsFormData.channelLink}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, channelLink: e.target.value })}
                required
                placeholder="시트 ID 또는 전체 URL (예: 1Vy8Qhce3B6_41TxRfVUs883ioLxiGTUjkbD_nKebgrs)"
                helperText="시트 ID만 입력하거나 전체 편집 URL을 입력하세요"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="년월"
                value={settingsFormData.yearMonth}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, yearMonth: e.target.value })}
                required
                placeholder="YYYY-MM (예: 2025-01)"
                helperText="년월을 입력하세요 (예: 2025-01)"
                inputProps={{ pattern: '\\d{4}-\\d{2}' }}
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={teamLeaders}
                getOptionLabel={(option) => `${option.name} (${option.code})`}
                value={teamLeaders.filter(leader => 
                  settingsFormData.checkerPermissions.includes(leader.code)
                )}
                onChange={(event, newValue) => {
                  setSettingsFormData({
                    ...settingsFormData,
                    checkerPermissions: newValue.map(v => v.code)
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="확인자적용권한"
                    placeholder="팀장 권한자를 선택하세요"
                    required
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={`${option.name} (${option.code})`}
                      {...getTagProps({ index })}
                      key={option.code}
                    />
                  ))
                }
                filterOptions={(options, { inputValue }) => {
                  return options.filter((option) =>
                    option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                    option.code.toLowerCase().includes(inputValue.toLowerCase())
                  );
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSettingsModal}>취소</Button>
          <Button onClick={handleSaveSettings} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
      )}
    </Box>
  );
};

export default BudgetChannelSettingsTab;
