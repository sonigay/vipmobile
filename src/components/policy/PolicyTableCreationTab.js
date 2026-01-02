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
  Group as GroupIcon,
  DragIndicator as DragIndicatorIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { API_BASE_URL } from '../../api';

// 드래그 가능한 카드 컴포넌트
const SortableCard = ({ setting, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: setting.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative'
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Box
        {...listeners}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          cursor: 'grab',
          color: 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          '&:active': {
            cursor: 'grabbing'
          }
        }}
      >
        <DragIndicatorIcon />
      </Box>
      {children}
    </div>
  );
};

const PolicyTableCreationTab = ({ loggedInStore }) => {
  const [settings, setSettings] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savingCardOrder, setSavingCardOrder] = useState(false);
  
  // 여러 정책표 생성 관련 상태
  const [selectedSettings, setSelectedSettings] = useState([]); // 체크된 카드 ID 배열
  const [batchCreationModalOpen, setBatchCreationModalOpen] = useState(false);
  const [batchCreationFormData, setBatchCreationFormData] = useState({
    applyDate: '',
    applyContent: '',
    policyTableGroups: {} // { settingId: [groupIds] }
  });
  const [batchGenerationStatus, setBatchGenerationStatus] = useState({}); // { settingId: { status, jobId, result } }
  const [batchPollingIntervals, setBatchPollingIntervals] = useState({}); // { settingId: intervalId }

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 생성 모달 상태
  const [creationModalOpen, setCreationModalOpen] = useState(false);
  const [selectedPolicyTable, setSelectedPolicyTable] = useState(null);
  const [creationFormData, setCreationFormData] = useState({
    applyDate: '',
    applyContent: '',
    accessGroupIds: []
  });

  // 생성 진행 상태
  const [generationStatus, setGenerationStatus] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [generatedResult, setGeneratedResult] = useState(null);

  // 정책영업그룹 관리 상태
  // S 권한자는 정책영업그룹 탭만 보이므로 초기값을 1로 설정
  const [activeTab, setActiveTab] = useState(() => {
    const userRole = loggedInStore?.userRole;
    const twoLetterPattern = /^[A-Z]{2}$/;
    // S 권한자는 정책영업그룹 탭만 보이므로 1로 설정, 그 외는 0
    if (userRole === 'S') {
      return 1;
    }
    return 0;
  });
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupFormData, setGroupFormData] = useState({
    groupName: '',
    companyNames: [],
    managerIds: []
  });
  const [companies, setCompanies] = useState([]);
  const [teamLeaders, setTeamLeaders] = useState([]);

  // 권한 체크 - 동적으로 두 글자 대문자 패턴(팀장) 또는 SS(총괄), S(정산팀) 인식
  const userRole = loggedInStore?.userRole;
  const twoLetterPattern = /^[A-Z]{2}$/;
  const canAccess = userRole && (userRole === 'SS' || userRole === 'S' || twoLetterPattern.test(userRole));
  // S 권한자는 정책영업그룹 탭만 접근 가능
  const canAccessPolicyTableCreation = userRole && (userRole === 'SS' || twoLetterPattern.test(userRole));
  const canAccessUserGroups = canAccess; // S 권한자도 정책영업그룹 접근 가능

  // 디버깅: 권한 체크 로그
  useEffect(() => {
    console.log('🔍 [정책표생성] 권한 체크:', {
      userRole,
      canAccess,
      twoLetterPatternTest: userRole ? twoLetterPattern.test(userRole) : false,
      loggedInStore: loggedInStore ? {
        userRole: loggedInStore.userRole,
        contactId: loggedInStore.contactId,
        id: loggedInStore.id
      } : null
    });
  }, [userRole, canAccess]);

  useEffect(() => {
    if (canAccess) {
      // S 권한자는 정책영업그룹 탭만 보이도록 activeTab을 1로 설정
      if (userRole === 'S') {
        setActiveTab(1);
      }
      loadUserGroups();
      loadCompanies();
      loadTeamLeaders();
      // 정책표 생성 기능은 SS 또는 팀장만 사용 가능
      if (canAccessPolicyTableCreation) {
        loadSettings();
      }
    }
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [canAccess, userRole, canAccessPolicyTableCreation]);

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
        // 백엔드에서 이미 사용자별 순서가 적용되어 있음
        setSettings(data);
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
          
          // 정확한 문자열 비교를 위해 trim() 및 대소문자 일치 확인
          const normalizedUserRole = (userRole || '').trim();
          const includes = setting.creatorPermissions.some(perm => {
            const normalizedPerm = (perm || '').trim();
            return normalizedPerm === normalizedUserRole;
          });
          
          console.log(`🔍 [정책표생성] 필터링 체크: ${setting.policyTableName}`, {
            userRole: normalizedUserRole,
            creatorPermissions: setting.creatorPermissions,
            normalizedPermissions: setting.creatorPermissions.map(p => (p || '').trim()),
            includes,
            matchDetails: setting.creatorPermissions.map(perm => ({
              original: perm,
              normalized: (perm || '').trim(),
              matches: (perm || '').trim() === normalizedUserRole
            }))
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
            // SS 권한 사용자인 경우 ssAgent의 target을 우선 사용
            let name = agent.target;
            if (permissionLevel === 'SS' && ssAgent && ssAgent.target) {
              name = ssAgent.target; // A열: 실제 이름
            } else if (!name || name.trim() === '') {
              name = permissionLevel; // 이름이 없으면 권한레벨 사용
            }
            const qualification = agent.qualification || ''; // B열: 직함
            
            // SS 권한 사용자인 경우 ssAgent의 qualification을 우선 사용
            let finalQualification = qualification;
            if (permissionLevel === 'SS' && ssAgent && ssAgent.qualification) {
              finalQualification = ssAgent.qualification;
            }
            
            // 이름 (직함) 형식으로 표시, 직함이 없으면 이름만 표시
            const displayName = finalQualification 
              ? `${name} (${finalQualification})`
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
          if (ssLeader && ssAgent && ssAgent.target) {
            const name = ssAgent.target; // A열: 실제 이름
            const qualification = ssAgent.qualification || ''; // B열: 직함
            // 이름이 비어있거나 '총괄'이 포함되어 있으면 업데이트
            if (!ssLeader.name || ssLeader.name.includes('총괄') || ssLeader.name === 'SS') {
              ssLeader.name = qualification ? `${name} (${qualification})` : name;
            }
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
            'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
            'x-user-name': String(loggedInStore?.name || loggedInStore?.target || 'Unknown')
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
      accessGroupIds: []
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
      accessGroupIds: []
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
          accessGroupIds: creationFormData.accessGroupIds
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

  // 카드 순서 저장
  const saveCardOrder = async (newSettings) => {
    try {
      setSavingCardOrder(true);
      const cardOrder = newSettings.map(setting => setting.id);
      
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/tabs/order`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
          'x-user-name': String(loggedInStore?.name || loggedInStore?.target || 'Unknown')
        },
        body: JSON.stringify({ cardOrder })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('생성카드 순서 저장 완료');
        }
      } else {
        console.error('생성카드 순서 저장 실패:', response.status);
      }
    } catch (error) {
      console.error('생성카드 순서 저장 오류:', error);
    } finally {
      setSavingCardOrder(false);
    }
  };

  // 드래그 종료 핸들러
  const handleCardDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSettings((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        const newSettings = arrayMove(items, oldIndex, newIndex);
        
        // 순서 저장
        saveCardOrder(newSettings);
        
        return newSettings;
      });
    }
  };

  // 모두정책생성 모달 닫기
  const handleCloseBatchCreationModal = () => {
    setBatchCreationModalOpen(false);
    setBatchCreationFormData({
      applyDate: '',
      applyContent: '',
      policyTableGroups: {}
    });
    setBatchGenerationStatus({});
    // 모든 폴링 인터벌 정리
    Object.values(batchPollingIntervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });
    setBatchPollingIntervals({});
    setSelectedSettings([]);
  };

  // 여러 정책표 병렬 생성 시작
  const handleStartBatchGeneration = async () => {
    const selected = settings.filter(s => selectedSettings.includes(s.id));
    
    // 유효성 검사
    if (!batchCreationFormData.applyDate || !batchCreationFormData.applyContent) {
      setError('정책적용일시와 정책적용내용을 입력해주세요.');
      return;
    }

    for (const setting of selected) {
      if (!batchCreationFormData.policyTableGroups[setting.id] || 
          batchCreationFormData.policyTableGroups[setting.id].length === 0) {
        setError(`${setting.policyTableName}의 정책영업그룹을 선택해주세요.`);
        return;
      }
    }

    setError(null);
    
    // 각 정책표별로 생성 작업 시작 (병렬 처리)
    const generationPromises = selected.map(async (setting) => {
      try {
        setBatchGenerationStatus(prev => ({
          ...prev,
          [setting.id]: { status: 'queued', jobId: null, result: null, error: null }
        }));

        const response = await fetch(`${API_BASE_URL}/api/policy-table/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': loggedInStore?.userRole || '',
            'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
            'x-user-name': String(loggedInStore?.name || loggedInStore?.target || 'Unknown')
          },
          body: JSON.stringify({
            policyTableId: setting.id,
            applyDate: batchCreationFormData.applyDate,
            applyContent: batchCreationFormData.applyContent,
            accessGroupIds: batchCreationFormData.policyTableGroups[setting.id]
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '정책표 생성 요청에 실패했습니다.');
        }

        const data = await response.json();
        const jobId = data.jobId;

        setBatchGenerationStatus(prev => ({
          ...prev,
          [setting.id]: { status: 'processing', jobId, result: null, error: null }
        }));

        // 폴링 시작
        startBatchPolling(setting.id, jobId);

        return { settingId: setting.id, jobId, success: true };
      } catch (error) {
        console.error(`[정책표] ${setting.policyTableName} 생성 오류:`, error);
        setBatchGenerationStatus(prev => ({
          ...prev,
          [setting.id]: { 
            status: 'failed', 
            jobId: null, 
            result: null, 
            error: error.message 
          }
        }));
        return { settingId: setting.id, jobId: null, success: false, error: error.message };
      }
    });

    // 모든 생성 작업 시작 (병렬)
    await Promise.allSettled(generationPromises);
  };

  // 배치 생성 폴링 시작
  const startBatchPolling = (settingId, jobId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/policy-table/generate/${jobId}/status`, {
          headers: {
            'x-user-role': loggedInStore?.userRole || '',
            'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          setBatchGenerationStatus(prev => ({
            ...prev,
            [settingId]: {
              status: data.status,
              jobId: jobId,
              result: data.result || null,
              error: data.error || null,
              progress: data.progress || 0,
              message: data.message || ''
            }
          }));

          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
            setBatchPollingIntervals(prev => {
              const newIntervals = { ...prev };
              delete newIntervals[settingId];
              return newIntervals;
            });
          }
        }
      } catch (error) {
        console.error(`[정책표] 폴링 오류 (${settingId}):`, error);
        clearInterval(interval);
        setBatchPollingIntervals(prev => {
          const newIntervals = { ...prev };
          delete newIntervals[settingId];
          return newIntervals;
        });
      }
    }, 2000); // 2초마다 폴링

    setBatchPollingIntervals(prev => ({
      ...prev,
      [settingId]: interval
    }));
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
        <Tabs 
          value={canAccessPolicyTableCreation ? activeTab : 0} 
          onChange={(e, newValue) => {
            // S 권한자는 정책영업그룹 탭만 접근 가능하므로 항상 0으로 설정 (정책표 생성 탭이 없으므로)
            if (userRole === 'S') {
              setActiveTab(1); // 내부적으로는 1로 유지하되, 탭 인덱스는 0으로 표시
            } else {
              setActiveTab(newValue);
            }
          }}
        >
          {canAccessPolicyTableCreation && (
            <Tab label="정책표 생성" />
          )}
          <Tab label="정책영업그룹" icon={<GroupIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* 정책표 생성 탭 */}
      {canAccessPolicyTableCreation && activeTab === 0 && (
        <>
          {loading && settings.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCardDragEnd}
            >
              <SortableContext
                items={settings.map(s => s.id)}
                strategy={rectSortingStrategy}
              >
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSettings.length > 0 ? `${selectedSettings.length}개 선택됨` : '카드를 선택하세요'}
                  </Typography>
                  <Button
                    variant="contained"
                    disabled={selectedSettings.length === 0}
                    onClick={() => {
                      const selected = settings.filter(s => selectedSettings.includes(s.id));
                      setBatchCreationFormData({
                        applyDate: '',
                        applyContent: '',
                        policyTableGroups: {}
                      });
                      setBatchGenerationStatus({});
                      setBatchCreationModalOpen(true);
                    }}
                    startIcon={<AddIcon />}
                  >
                    모두생성
                  </Button>
                </Box>
                <Grid container spacing={2}>
                  {settings.map((setting) => (
                    <Grid item xs={12} sm={6} md={4} key={setting.id}>
                      <SortableCard setting={setting}>
                        <Card sx={{ position: 'relative' }}>
                          <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 3 }}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSettings(prev => {
                                  if (prev.includes(setting.id)) {
                                    return prev.filter(id => id !== setting.id);
                                  } else {
                                    return [...prev, setting.id];
                                  }
                                });
                              }}
                              sx={{ 
                                backgroundColor: 'background.paper',
                                '&:hover': {
                                  backgroundColor: 'action.hover'
                                }
                              }}
                            >
                              {selectedSettings.includes(setting.id) ? (
                                <CheckBoxIcon color="primary" />
                              ) : (
                                <CheckBoxOutlineBlankIcon />
                              )}
                            </IconButton>
                          </Box>
                    <CardContent sx={{ pl: 6, pt: 2 }}>
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
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
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
                            let newWindow = null;
                            try {
                              newWindow = window.open(
                                url, 
                                '_blank', 
                                'noopener,noreferrer,width=1200,height=800'
                              );
                              
                              // 팝업 차단 감지: window.open 직후 즉시 확인
                              // newWindow가 null이거나 undefined인 경우만 팝업 차단으로 판단
                              if (!newWindow) {
                                // 팝업이 차단된 경우 사용자에게 알림
                                alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
                                return;
                              }
                              
                              // newWindow가 존재하면 정상적으로 열린 것
                              // 사용자가 창을 닫은 경우는 newWindow.closed가 true가 되지만,
                              // 이는 정상적인 동작이므로 알림을 표시하지 않음
                              // 팝업 차단 감지는 window.open 직후에만 수행하며,
                              // 이후 창이 닫히는 것은 감지하지 않음
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
                        </SortableCard>
                    </Grid>
                  ))}
                </Grid>
              </SortableContext>
            </DndContext>
          )}
          {savingCardOrder && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 1, mt: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" sx={{ ml: 1 }}>
                순서 저장 중...
              </Typography>
            </Box>
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
                multiple
                options={userGroups || []}
                getOptionLabel={(option) => option?.groupName || ''}
                value={userGroups.filter(g => creationFormData.accessGroupIds.includes(g.id)) || []}
                onChange={(event, newValue) => {
                  setCreationFormData({
                    ...creationFormData,
                    accessGroupIds: newValue.map(g => g.id)
                  });
                }}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                noOptionsText="등록된 그룹이 없습니다."
                filterSelectedOptions
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="접근권한 (정책영업그룹)"
                    placeholder="그룹을 선택하세요 (다중 선택 가능)"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={option.id || key}
                        label={option.groupName || ''}
                        onDelete={tagProps.onDelete}
                        {...tagProps}
                      />
                    );
                  })
                }
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

      {/* 모두정책생성 모달 */}
      <Dialog open={batchCreationModalOpen} onClose={handleCloseBatchCreationModal} maxWidth="md" fullWidth>
        <DialogTitle>
          모두정책생성 ({selectedSettings.length}개)
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* 공통 필드 */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책적용일시"
                value={batchCreationFormData.applyDate}
                onChange={(e) => setBatchCreationFormData({ 
                  ...batchCreationFormData, 
                  applyDate: e.target.value 
                })}
                placeholder="예: 2025-01-01 10:00"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책적용내용"
                value={batchCreationFormData.applyContent}
                onChange={(e) => setBatchCreationFormData({ 
                  ...batchCreationFormData, 
                  applyContent: e.target.value 
                })}
                multiline
                rows={4}
                required
              />
            </Grid>

            {/* 정책표별 정책영업그룹 선택 */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                정책표별 정책영업그룹 선택
              </Typography>
              {settings
                .filter(s => selectedSettings.includes(s.id))
                .map((setting) => (
                  <Box key={setting.id} sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={4}>
                        <Typography variant="body1" fontWeight="medium">
                          {setting.policyTableName}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={8}>
                        <Autocomplete
                          multiple
                          options={userGroups || []}
                          getOptionLabel={(option) => option.groupName || ''}
                          value={
                            (userGroups || []).filter(group => 
                              batchCreationFormData.policyTableGroups[setting.id]?.includes(group.id)
                            )
                          }
                          onChange={(event, newValue) => {
                            setBatchCreationFormData(prev => ({
                              ...prev,
                              policyTableGroups: {
                                ...prev.policyTableGroups,
                                [setting.id]: newValue.map(g => g.id)
                              }
                            }));
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="정책영업그룹"
                              placeholder="그룹 선택"
                              required
                            />
                          )}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip
                                key={option.id}
                                label={option.groupName}
                                {...getTagProps({ index })}
                                size="small"
                              />
                            ))
                          }
                        />
                      </Grid>
                      {/* 생성 상태 표시 */}
                      {batchGenerationStatus[setting.id] && (
                        <Grid item xs={12}>
                          <Box sx={{ mt: 1 }}>
                            {batchGenerationStatus[setting.id].status === 'queued' && (
                              <Alert severity="info">대기 중...</Alert>
                            )}
                            {batchGenerationStatus[setting.id].status === 'processing' && (
                              <Box>
                                <LinearProgress />
                                <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                                  생성 중... ({batchGenerationStatus[setting.id].progress || 0}%)
                                </Typography>
                                {batchGenerationStatus[setting.id].message && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {batchGenerationStatus[setting.id].message}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            {batchGenerationStatus[setting.id].status === 'completed' && (
                              <Alert severity="success">
                                생성 완료!
                                {batchGenerationStatus[setting.id].result && (
                                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                    정책표 ID: {batchGenerationStatus[setting.id].result.id}
                                  </Typography>
                                )}
                              </Alert>
                            )}
                            {batchGenerationStatus[setting.id].status === 'failed' && (
                              <Alert severity="error">
                                생성 실패: {batchGenerationStatus[setting.id].error || '알 수 없는 오류'}
                              </Alert>
                            )}
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBatchCreationModal}>취소</Button>
          <Button
            onClick={handleStartBatchGeneration}
            variant="contained"
            disabled={
              !batchCreationFormData.applyDate ||
              !batchCreationFormData.applyContent ||
              Object.keys(batchGenerationStatus).some(settingId => 
                batchGenerationStatus[settingId]?.status === 'processing' ||
                batchGenerationStatus[settingId]?.status === 'queued'
              )
            }
          >
            정책표생성
          </Button>
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

