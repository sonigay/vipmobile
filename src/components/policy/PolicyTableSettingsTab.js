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
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../../api';

const PolicyTableSettingsTab = ({ loggedInStore }) => {
  const [settings, setSettings] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 정책표 설정 모달 상태
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [settingsFormData, setSettingsFormData] = useState({
    policyTableName: '',
    policyTableLink: '',
    discordChannelId: '',
    creatorPermissions: []
  });

  // 일반사용자 그룹 모달 상태
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupFormData, setGroupFormData] = useState({
    groupName: '',
    userIds: []
  });

  // 탭 상태 (정책표 설정 / 일반사용자 그룹)
  const [activeTab, setActiveTab] = useState(0);

  // 팀장 권한자 목록 (대리점아이디관리 시트에서 가져옴)
  const [teamLeaders, setTeamLeaders] = useState([]);
  
  // 일반 사용자 목록 (A-F)
  const [regularUsers, setRegularUsers] = useState([]);

  // 권한 체크
  const canAccess = loggedInStore?.userRole === 'SS';

  useEffect(() => {
    if (canAccess) {
      loadSettings();
      loadUserGroups();
      loadTeamLeaders();
      loadRegularUsers();
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

  const loadUserGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/policy-table/user-groups`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.id || ''
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

  const loadTeamLeaders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`);
      if (response.ok) {
        const agents = await response.json();
        // R열(17번 인덱스)이 AA-FF인 사용자만 필터링
        const leaders = agents
          .filter(agent => ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(agent[17]))
          .map(agent => ({
            code: agent[17],
            name: agent[1] || agent[17] // 이름 또는 코드
          }));
        setTeamLeaders(leaders);
      }
    } catch (error) {
      console.error('팀장 목록 로드 오류:', error);
    }
  };

  const loadRegularUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`);
      if (response.ok) {
        const agents = await response.json();
        // R열(17번 인덱스)이 A-F인 사용자만 필터링
        const users = agents
          .filter(agent => ['A', 'B', 'C', 'D', 'E', 'F'].includes(agent[17]))
          .map(agent => ({
            code: agent[17],
            name: agent[1] || agent[17] // 이름 또는 코드
          }));
        setRegularUsers(users);
      }
    } catch (error) {
      console.error('일반 사용자 목록 로드 오류:', error);
    }
  };

  const handleOpenSettingsModal = (setting = null) => {
    if (setting) {
      setEditingSetting(setting);
      setSettingsFormData({
        policyTableName: setting.policyTableName,
        policyTableLink: setting.policyTableLink,
        discordChannelId: setting.discordChannelId,
        creatorPermissions: setting.creatorPermissions || []
      });
    } else {
      setEditingSetting(null);
      setSettingsFormData({
        policyTableName: '',
        policyTableLink: '',
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
      policyTableLink: '',
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

  const handleOpenGroupModal = (group = null) => {
    if (group) {
      setEditingGroup(group);
      setGroupFormData({
        groupName: group.groupName,
        userIds: group.userIds || []
      });
    } else {
      setEditingGroup(null);
      setGroupFormData({
        groupName: '',
        userIds: []
      });
    }
    setGroupModalOpen(true);
  };

  const handleCloseGroupModal = () => {
    setGroupModalOpen(false);
    setEditingGroup(null);
    setGroupFormData({
      groupName: '',
      userIds: []
    });
  };

  const handleSaveGroup = async () => {
    try {
      setLoading(true);
      const url = editingGroup
        ? `${API_BASE_URL}/api/policy-table/user-groups/${editingGroup.id}`
        : `${API_BASE_URL}/api/policy-table/user-groups`;
      
      const method = editingGroup ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.id || ''
        },
        body: JSON.stringify(groupFormData)
      });

      if (response.ok) {
        await loadUserGroups();
        handleCloseGroupModal();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('일반사용자 그룹 저장 오류:', error);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('일반사용자 그룹을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-table/user-groups/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.id || ''
        }
      });

      if (response.ok) {
        await loadUserGroups();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('일반사용자 그룹 삭제 오류:', error);
      setError('삭제 중 오류가 발생했습니다.');
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
        정책표생성설정
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="정책표 설정" />
          <Tab label="일반사용자 그룹" icon={<GroupIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* 정책표 설정 탭 */}
      {activeTab === 0 && (
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
                          {setting.creatorPermissions.map((perm) => (
                            <Chip key={perm} label={perm} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                          ))}
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
      )}

      {/* 일반사용자 그룹 탭 */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">일반사용자 그룹 목록</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenGroupModal()}
            >
              그룹 추가
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
                    <TableCell>그룹이름</TableCell>
                    <TableCell>일반사용자</TableCell>
                    <TableCell>등록일시</TableCell>
                    <TableCell>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        등록된 그룹이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    userGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>{group.groupName}</TableCell>
                        <TableCell>
                          {group.userIds.map((userId) => (
                            <Chip key={userId} label={userId} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                          ))}
                        </TableCell>
                        <TableCell>{new Date(group.registeredAt).toLocaleString('ko-KR')}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleOpenGroupModal(group)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteGroup(group.id)}>
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
      )}

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
                label="정책표링크"
                value={settingsFormData.policyTableLink}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, policyTableLink: e.target.value })}
                required
                placeholder="https://docs.google.com/spreadsheets/d/..."
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

      {/* 일반사용자 그룹 모달 */}
      <Dialog open={groupModalOpen} onClose={handleCloseGroupModal} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingGroup ? '일반사용자 그룹 수정' : '일반사용자 그룹 추가'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="그룹이름"
                value={groupFormData.groupName}
                onChange={(e) => setGroupFormData({ ...groupFormData, groupName: e.target.value })}
                required
                placeholder="예: 서울지역, 부산지역"
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={regularUsers}
                getOptionLabel={(option) => `${option.name} (${option.code})`}
                value={regularUsers.filter(user => 
                  groupFormData.userIds.includes(user.code)
                )}
                onChange={(event, newValue) => {
                  setGroupFormData({
                    ...groupFormData,
                    userIds: newValue.map(v => v.code)
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="일반사용자 선택"
                    placeholder="일반사용자를 선택하세요"
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
          <Button onClick={handleCloseGroupModal}>취소</Button>
          <Button onClick={handleSaveGroup} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PolicyTableSettingsTab;

