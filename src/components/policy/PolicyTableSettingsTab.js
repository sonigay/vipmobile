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
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';

const PolicyTableSettingsTab = ({ loggedInStore }) => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 정책표 설정 모달 상태
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [settingsFormData, setSettingsFormData] = useState({
    policyTableName: '',
    policyTableDescription: '',
    policyTableLink: '',
    policyTablePublicLink: '',
    discordChannelId: '',
    creatorPermissions: []
  });

  // 팀장 권한자 목록 (대리점아이디관리 시트에서 가져옴)
  const [teamLeaders, setTeamLeaders] = useState([]);

  // 권한 체크
  const canAccess = loggedInStore?.userRole === 'SS';

  useEffect(() => {
    if (canAccess) {
      loadSettings();
      loadTeamLeaders();
    }
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
        setSettings(data);
      } else {
        setError('정책표 설정을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('정책표 설정 로드 오류:', error);
      setError('정책표 설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamLeaders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`);
      if (response.ok) {
        const agents = await response.json();
        
        // 동적으로 두 글자 대문자 권한 레벨 필터링 (팀장: AA, BB, CC, DD, EE, FF 등)
        // 정규식: /^[A-Z]{2}$/ - 정확히 두 글자 대문자
        const twoLetterPattern = /^[A-Z]{2}$/;
        
        // SS 권한 사용자를 먼저 찾기 (필터링 전에)
        const ssAgent = agents.find(agent => agent.permissionLevel === 'SS');
        
        const leaders = agents
          .filter(agent => {
            const permissionLevel = agent.permissionLevel;
            // SS(총괄) 또는 두 글자 대문자 패턴(팀장)인 경우
            return permissionLevel && (permissionLevel === 'SS' || twoLetterPattern.test(permissionLevel));
          })
          .map(agent => {
            const permissionLevel = agent.permissionLevel;
            const name = agent.target || permissionLevel; // A열: 이름
            const qualification = agent.qualification || ''; // B열: 직함
            
            // 이름 (직함) 형식으로 표시, 직함이 없으면 이름만 표시
            const displayName = qualification 
              ? `${name} (${qualification})`
              : name;
            
            return {
              code: permissionLevel,
              name: displayName
            };
          });
        
        // SS가 목록에 없으면 동적으로 추가 (agents에서 SS 권한을 가진 사용자 찾기)
        const hasSS = leaders.some(leader => leader.code === 'SS');
        if (!hasSS) {
          if (ssAgent && ssAgent.target) {
            // SS 권한 사용자가 있고 이름이 있으면 실제 이름과 직함 사용
            const name = ssAgent.target; // A열: 실제 이름
            const qualification = ssAgent.qualification || ''; // B열: 직함
            leaders.unshift({
              code: 'SS',
              name: qualification ? `${name} (${qualification})` : name
            });
          } else {
            // SS 권한 사용자가 없거나 이름이 없으면 기본값으로 추가
            leaders.unshift({
              code: 'SS',
              name: '총괄 (총괄)'
            });
          }
        } else {
          // SS가 이미 목록에 있지만, 이름이 비어있거나 '총괄'인 경우 실제 데이터로 업데이트
          const ssLeader = leaders.find(leader => leader.code === 'SS');
          if (ssLeader && ssAgent && ssAgent.target && ssLeader.name.includes('총괄')) {
            const name = ssAgent.target;
            const qualification = ssAgent.qualification || '';
            ssLeader.name = qualification ? `${name} (${qualification})` : name;
          }
        }
        
        // SS를 맨 앞에, 나머지는 정렬
        leaders.sort((a, b) => {
          if (a.code === 'SS') return -1;
          if (b.code === 'SS') return 1;
          return a.code.localeCompare(b.code);
        });
        
        console.log('팀장 목록 로드 완료:', leaders);
        setTeamLeaders(leaders);
      } else {
        console.error('팀장 목록 로드 실패:', response.status);
        // API 실패 시에도 SS를 기본으로 추가
        setTeamLeaders([{
          code: 'SS',
          name: '총괄 (SS)'
        }]);
      }
    } catch (error) {
      console.error('팀장 목록 로드 오류:', error);
      // 오류 발생 시에도 SS를 기본으로 추가
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
        policyTableName: setting.policyTableName,
        policyTableDescription: setting.policyTableDescription || '',
        policyTableLink: setting.policyTableLink,
        policyTablePublicLink: setting.policyTablePublicLink || '',
        discordChannelId: setting.discordChannelId,
        creatorPermissions: setting.creatorPermissions || []
      });
    } else {
      setEditingSetting(null);
      setSettingsFormData({
        policyTableName: '',
        policyTableDescription: '',
        policyTableLink: '',
        policyTablePublicLink: '',
        discordChannelId: '',
        creatorPermissions: []
      });
    }
    setSettingsModalOpen(true);
  };

  const handleCloseSettingsModal = () => {
    setSettingsModalOpen(false);
    setEditingSetting(null);
    setSettingsFormData({
      policyTableName: '',
      policyTableDescription: '',
      policyTableLink: '',
      policyTablePublicLink: '',
      discordChannelId: '',
      creatorPermissions: []
    });
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      const url = editingSetting
        ? `${API_BASE_URL}/api/policy-table-settings/${editingSetting.id}`
        : `${API_BASE_URL}/api/policy-table-settings`;
      
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
      console.error('정책표 설정 저장 오류:', error);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSettings = async (id) => {
    if (!window.confirm('정책표 설정을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-table-settings/${id}`, {
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
      console.error('정책표 설정 삭제 오류:', error);
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        정책표생성설정
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">정책표 설정 목록</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenSettingsModal()}
            >
              정책표 추가
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
                    <TableCell>정책표이름</TableCell>
                    <TableCell>정책표링크</TableCell>
                    <TableCell>디스코드채널ID</TableCell>
                    <TableCell>생성자적용권한</TableCell>
                    <TableCell>등록일시</TableCell>
                    <TableCell>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {settings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        등록된 정책표 설정이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    settings.map((setting) => (
                      <TableRow key={setting.id}>
                        <TableCell>{setting.policyTableName}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {setting.policyTableLink}
                          </Typography>
                        </TableCell>
                        <TableCell>{setting.discordChannelId}</TableCell>
                        <TableCell>
                          {setting.creatorPermissions.map((perm) => {
                            // 권한 코드로 이름 찾기
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

      {/* 정책표 설정 모달 */}
      <Dialog open={settingsModalOpen} onClose={handleCloseSettingsModal} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSetting ? '정책표 설정 수정' : '정책표 설정 추가'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책표이름"
                value={settingsFormData.policyTableName}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, policyTableName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책표설명"
                value={settingsFormData.policyTableDescription}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, policyTableDescription: e.target.value })}
                multiline
                rows={2}
                placeholder="정책표에 대한 설명을 입력하세요"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책표링크 (편집 링크)"
                value={settingsFormData.policyTableLink}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, policyTableLink: e.target.value })}
                required
                placeholder="시트 ID 또는 전체 URL (예: 1Vy8Qhce3B6_41TxRfVUs883ioLxiGTUjkbD_nKebgrs)"
                helperText="시트 ID만 입력하거나 전체 편집 URL을 입력하세요"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책표공개링크 (캡처용)"
                value={settingsFormData.policyTablePublicLink}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, policyTablePublicLink: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml (선택사항)"
                helperText="웹에 게시된 공개 링크(/pubhtml). 없으면 편집 링크를 사용합니다."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="디스코드채널ID"
                value={settingsFormData.discordChannelId}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, discordChannelId: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={teamLeaders}
                getOptionLabel={(option) => `${option.name} (${option.code})`}
                value={teamLeaders.filter(leader => 
                  settingsFormData.creatorPermissions.includes(leader.code)
                )}
                onChange={(event, newValue) => {
                  setSettingsFormData({
                    ...settingsFormData,
                    creatorPermissions: newValue.map(v => v.code)
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="생성자적용권한"
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
    </Box>
  );
};

export default PolicyTableSettingsTab;

