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
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon
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

  // 정책영업그룹 관리 상태
  const [activeTab, setActiveTab] = useState(0); // 0: 정책표 생성, 1: 정책영업그룹
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupFormData, setGroupFormData] = useState({
    groupName: '',
    companyNames: [],
    managerIds: []
  });
  const [companies, setCompanies] = useState([]);
  const [teamLeaders, setTeamLeaders] = useState([]);

  // 권한 체크
  const canAccess = ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(loggedInStore?.userRole);

  useEffect(() => {
    if (canAccess) {
      loadSettings();
      loadUserGroups();
      loadCompanies();
      loadTeamLeaders();
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
        console.log('🔍 [정책표생성] 정책표 설정 로드:', {
          userRole,
          totalSettings: data.length,
          settings: data.map(s => ({
            id: s.id,
            policyTableName: s.policyTableName,
            creatorPermissions: s.creatorPermissions,
            creatorPermissionsType: typeof s.creatorPermissions,
            isArray: Array.isArray(s.creatorPermissions),
            includesUserRole: Array.isArray(s.creatorPermissions) ? s.creatorPermissions.includes(userRole) : false
          }))
        });
        
        const filtered = data.filter(setting => {
          if (userRole === 'SS') return true; // 총괄은 모든 정책표 접근 가능
          
          // creatorPermissions가 배열인지 확인
          if (!Array.isArray(setting.creatorPermissions)) {
            console.warn('⚠️ [정책표생성] creatorPermissions가 배열이 아닙니다:', {
              setting: setting.policyTableName,
              creatorPermissions: setting.creatorPermissions,
              type: typeof setting.creatorPermissions
            });
            return false;
          }
          
          const includes = setting.creatorPermissions.includes(userRole);
          console.log(`🔍 [정책표생성] 필터링 체크: ${setting.policyTableName}`, {
            userRole,
            creatorPermissions: setting.creatorPermissions,
            includes
          });
          return includes;
        });
        
        console.log('✅ [정책표생성] 필터링 결과:', {
          filteredCount: filtered.length,
          filtered: filtered.map(s => s.policyTableName)
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
        // 응답이 배열인지 확인
        if (Array.isArray(data)) {
          setUserGroups(data);
        } else if (data.success !== false && Array.isArray(data.data)) {
          setUserGroups(data.data);
        } else {
          console.warn('정책영업그룹 응답 형식 오류:', data);
          setUserGroups([]);
        }
      } else {
        console.error('정책영업그룹 로드 실패:', response.status);
        setUserGroups([]);
      }
    } catch (error) {
      console.error('정책영업그룹 로드 오류:', error);
      setUserGroups([]);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/policy-table/companies`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 업체명을 code로 사용, managerIds도 함께 저장
          const companyOptions = data.companies.map(company => ({
            code: company.companyName, // 업체명을 고유 ID로 사용
            name: company.companyName,
            managerIds: company.managerIds || (company.managerId ? [company.managerId] : [])
          }));
          setCompanies(companyOptions);

          // 현재 로그인한 사용자의 아이디로 업체명 자동 선택
          const currentUserId = loggedInStore?.contactId || loggedInStore?.id;
          if (currentUserId) {
            const userCompany = companyOptions.find(company => 
              company.managerIds.includes(currentUserId)
            );
            if (userCompany) {
              setGroupFormData(prev => ({
                ...prev,
                companyNames: [userCompany.code],
                managerIds: userCompany.managerIds
              }));
            }
          }
        }
      }
    } catch (error) {
      console.error('업체명 목록 로드 오류:', error);
    }
  };

  const loadTeamLeaders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`);
      if (response.ok) {
        const agents = await response.json();
        // SS 총괄과 팀장 권한자(AA-FF) 필터링
        const leaders = agents
          .filter(agent => {
            const permissionLevel = agent.permissionLevel;
            return permissionLevel && (permissionLevel === 'SS' || ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(permissionLevel));
          })
          .map(agent => ({
            code: agent.permissionLevel,
            name: agent.target || agent.permissionLevel // A열(대상/이름) 또는 권한 코드
          }));
        
        // SS가 목록에 없으면 수동으로 추가
        const hasSS = leaders.some(leader => leader.code === 'SS');
        if (!hasSS) {
          leaders.unshift({
            code: 'SS',
            name: '총괄 (SS)'
          });
        }
        
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

  const handleOpenGroupModal = (group = null) => {
    if (group) {
      setEditingGroup(group);
      setGroupFormData({
        groupName: group.groupName,
        companyNames: group.companyNames || [],
        managerIds: group.managerIds || []
      });
    } else {
      setEditingGroup(null);
      setGroupFormData({
        groupName: '',
        companyNames: [],
        managerIds: []
      });
      // 새 그룹 생성 시 현재 사용자의 업체명 자동 선택
      const currentUserId = loggedInStore?.contactId || loggedInStore?.id;
      if (currentUserId) {
        const userCompany = companies.find(company => 
          company.managerIds.includes(currentUserId)
        );
        if (userCompany) {
          setGroupFormData(prev => ({
            ...prev,
            companyNames: [userCompany.code],
            managerIds: userCompany.managerIds
          }));
        }
      }
    }
    setGroupModalOpen(true);
  };

  const handleCloseGroupModal = () => {
    setGroupModalOpen(false);
    setEditingGroup(null);
    setGroupFormData({
      groupName: '',
      companyNames: [],
      managerIds: []
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
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
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
      console.error('정책영업그룹 저장 오류:', error);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('정책영업그룹을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-table/user-groups/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });

      if (response.ok) {
        await loadUserGroups();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('정책영업그룹 삭제 오류:', error);
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
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
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
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

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="정책표 생성" />
          <Tab label="정책영업그룹" icon={<GroupIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* 정책표 생성 탭 */}
      {activeTab === 0 && (
        <>
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
                      {setting.policyTableDescription && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {setting.policyTableDescription}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <a 
                          href={setting.policyTableLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            // 구글시트 링크를 웹 버전으로 강제 열기 (PC/모바일 모두)
                            let url = setting.policyTableLink;
                            
                            // 시트 ID만 있는 경우 전체 URL로 변환
                            if (/^[a-zA-Z0-9-_]+$/.test(url)) {
                              url = `https://docs.google.com/spreadsheets/d/${url}/edit`;
                            }
                            
                            // 구글시트 ID 추출
                            const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                            if (sheetIdMatch) {
                              const sheetId = sheetIdMatch[1];
                              // gid 파라미터 추출 (원본 URL에 있는 경우만 사용)
                              const gidMatch = url.match(/[?&#]gid=([0-9]+)/);
                              
                              // 웹 버전으로 강제 열기 (앱 실행 방지)
                              // usp=drive_web: 웹 버전 강제 (PC/모바일 모두)
                              // rm=minimal: 모바일 앱 리다이렉트 방지
                              if (gidMatch) {
                                // 원본 URL에 gid가 있으면 그대로 사용 (사용자가 의도한 시트)
                                const gid = gidMatch[1];
                                url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=drive_web&rm=minimal&gid=${gid}#gid=${gid}`;
                              } else {
                                // 원본 URL에 gid가 없으면 gid 파라미터를 포함하지 않음 (첫 번째 시트로 열림)
                                url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=drive_web&rm=minimal`;
                              }
                            } else {
                              // ID를 찾을 수 없으면 원본 URL에 파라미터 추가 (gid는 유지)
                              const separator = url.includes('?') ? '&' : '?';
                              // 원본 URL에 이미 gid가 있는지 확인
                              const hasGid = url.includes('gid=');
                              if (hasGid) {
                                url = `${url}${separator}usp=drive_web&rm=minimal`;
                              } else {
                                url = `${url}${separator}usp=drive_web&rm=minimal`;
                              }
                            }
                            
                            // 새 창에서 열기 (앱 리다이렉트 방지)
                            try {
                              const newWindow = window.open(
                                url, 
                                '_blank', 
                                'noopener,noreferrer,width=1200,height=800'
                              );
                              
                              // 팝업 차단 감지 (window.open 직후 즉시 확인)
                              // newWindow가 null이거나 undefined인 경우만 팝업 차단으로 판단
                              // 사용자가 창을 닫은 경우는 newWindow.closed로 확인 가능하므로 여기서는 확인하지 않음
                              if (newWindow === null || newWindow === undefined) {
                                // 팝업이 차단된 경우 사용자에게 알림
                                alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
                              }
                              // newWindow가 존재하면 정상적으로 열린 것이므로 아무것도 하지 않음
                              // 사용자가 나중에 창을 닫아도 감지하지 않음
                            } catch (error) {
                              // window.open이 예외를 발생시킨 경우 (일부 브라우저에서 발생 가능)
                              console.error('구글시트 열기 오류:', error);
                              alert('구글시트를 열 수 없습니다. 브라우저 설정에서 팝업을 허용해주세요.');
                            }
                          }}
                          style={{ color: '#1976d2', textDecoration: 'none', cursor: 'pointer' }}
                        >
                          구글시트 바로가기
                        </a>
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          정책생성가능자:
                        </Typography>
                        {setting.creatorPermissions.map((perm) => {
                          const leader = teamLeaders.find(l => l.code === perm);
                          const displayLabel = leader ? leader.name : perm;
                          return (
                            <Chip key={perm} label={displayLabel} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                          );
                        })}
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
        </>
      )}

      {/* 정책영업그룹 탭 */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">정책영업그룹 목록</Typography>
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
                          {group.companyNames && group.companyNames.length > 0 && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="caption" color="text.secondary">업체명:</Typography>
                              {group.companyNames.map((companyName) => (
                                <Chip key={companyName} label={companyName} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                              ))}
                            </Box>
                          )}
                          {group.managerIds && group.managerIds.length > 0 && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">담당자:</Typography>
                              {group.managerIds.map((managerId) => (
                                <Chip key={managerId} label={managerId} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                              ))}
                            </Box>
                          )}
                          {/* 하위 호환성: userIds가 있으면 표시 (기존 데이터) */}
                          {(!group.companyNames || group.companyNames.length === 0) && 
                           (!group.managerIds || group.managerIds.length === 0) &&
                           group.userIds && group.userIds.length > 0 && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">기존 데이터 (수정 필요):</Typography>
                              {group.userIds.map((userId) => (
                                <Chip key={userId} label={userId} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                              ))}
                            </Box>
                          )}
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
                value={creationFormData.applyDate}
                onChange={(e) => setCreationFormData({ ...creationFormData, applyDate: e.target.value })}
                placeholder="예: 2025-01-01 10:00"
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
                options={userGroups || []}
                getOptionLabel={(option) => option?.groupName || ''}
                value={userGroups.find(g => g.id === creationFormData.accessGroupId) || null}
                onChange={(event, newValue) => {
                  setCreationFormData({
                    ...creationFormData,
                    accessGroupId: newValue ? newValue.id : null
                  });
                }}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                noOptionsText="등록된 그룹이 없습니다."
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="접근권한 (정책영업그룹)"
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

      {/* 정책영업그룹 추가/수정 모달 */}
      <Dialog open={groupModalOpen} onClose={handleCloseGroupModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingGroup ? '정책영업그룹 수정' : '정책영업그룹 추가'}
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
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={companies}
                getOptionLabel={(option) => option?.name || option?.code || ''}
                value={companies.filter(company => groupFormData.companyNames.includes(company.code))}
                onChange={(event, newValue) => {
                  // 선택된 업체명들
                  const selectedCompanyNames = newValue.map(company => company.code);
                  
                  // 선택된 업체들의 담당자 아이디를 모두 수집
                  const allManagerIds = new Set();
                  newValue.forEach(company => {
                    if (company.managerIds && Array.isArray(company.managerIds)) {
                      company.managerIds.forEach(id => allManagerIds.add(id));
                    }
                  });

                  setGroupFormData({
                    ...groupFormData,
                    companyNames: selectedCompanyNames,
                    managerIds: Array.from(allManagerIds)
                  });
                }}
                isOptionEqualToValue={(option, value) => option?.code === value?.code}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="업체명"
                    placeholder="업체명을 선택하세요"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={option.code || key}
                        label={option.name || option.code}
                        onDelete={tagProps.onDelete}
                        {...tagProps}
                      />
                    );
                  })
                }
                filterSelectedOptions
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseGroupModal}>취소</Button>
          <Button
            onClick={handleSaveGroup}
            variant="contained"
            disabled={loading || !groupFormData.groupName}
          >
            {loading ? <CircularProgress size={24} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PolicyTableCreationTab;

