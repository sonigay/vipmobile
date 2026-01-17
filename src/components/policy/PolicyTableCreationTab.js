import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Tab,
  Tooltip,
  Popover,
  Switch,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel
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
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  AddCircle as AddCircleIcon,
  EditOutlined as EditOutlinedIcon,
  RemoveCircle as RemoveCircleIcon,
  PhoneAndroid as PhoneAndroidIcon
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';

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
  const [settingsLoading, setSettingsLoading] = useState(false); // 정책표 설정 로딩 상태
  const [error, setError] = useState(null);
  const [savingCardOrder, setSavingCardOrder] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
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

  // 정책적용일시 자동 생성 관련 상태
  const [autoDateSettings, setAutoDateSettings] = useState({
    startDate: new Date(), // 시작 날짜 (기본값: 오늘)
    startHour: new Date().getHours(), // 시작 시간 (시)
    startMinute: Math.floor(new Date().getMinutes() / 10) * 10, // 시작 시간 (분, 10분 단위)
    policyType: 'wireless', // 'wireless', 'wired', 'other'
    otherPolicyName: '이통사지원금', // 기타정책 선택 시 정책명
    hasEndDate: false, // 종료시점 사용 여부
    endDate: null, // 종료 날짜
    endHour: 0, // 종료 시간 (시)
    endMinute: 0 // 종료 시간 (분, 10분 단위)
  });
  const [otherPolicyTypes, setOtherPolicyTypes] = useState(['이통사지원금']); // 기타정책 목록
  const [newOtherPolicyName, setNewOtherPolicyName] = useState(''); // 새 기타정책명 입력

  // 기본 그룹 설정 관련 상태
  const [defaultGroups, setDefaultGroups] = useState({}); // { policyTableId: [groupIds] }
  const [defaultGroupModalOpen, setDefaultGroupModalOpen] = useState(false);
  const [defaultGroupFormData, setDefaultGroupFormData] = useState({
    policyTableId: '',
    defaultGroupIds: []
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
  
  // 변경이력 관련 상태
  const [changeHistory, setChangeHistory] = useState({}); // { groupId: [historyItems] }
  const [historyLoading, setHistoryLoading] = useState({}); // { groupId: boolean }
  const [popoverAnchor, setPopoverAnchor] = useState(null); // Popover 앵커
  const [popoverContent, setPopoverContent] = useState(null); // Popover 내용

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
      
      // 성능 최적화: 필수 데이터만 먼저 로드, 나머지는 백그라운드에서 로드
        if (canAccessPolicyTableCreation) {
        // 정책표 설정만 먼저 로드 (화면 표시에 필수) - 즉시 화면에 표시
        loadSettings().then(() => {
          // settings가 로드된 후 백그라운드에서 나머지 로드
          // 기타정책 목록과 기본 그룹은 덜 중요하므로 백그라운드에서 로드
          Promise.all([
            loadOtherPolicyTypes(),
            loadDefaultGroups()
          ]).catch(error => {
            console.error('백그라운드 데이터 로드 오류:', error);
          });
        }).catch(error => {
          console.error('정책표 설정 로드 오류:', error);
        });
      }
    }
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [canAccess, userRole, canAccessPolicyTableCreation]);

  // 정책영업그룹 탭이 활성화될 때 정책영업그룹 목록 로드 (지연 로드)
  useEffect(() => {
    if (activeTab === 1 && userGroups.length === 0) {
      // 정책영업그룹 목록 로드 (변경이력은 제외하여 빠르게 로드)
      loadUserGroupsWithoutHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 정책영업그룹 탭이 활성화되고 그룹이 로드된 후 변경이력 로드
  useEffect(() => {
    if (activeTab === 1 && userGroups.length > 0) {
      // 변경이력이 없는 그룹만 로드
      const groupsWithoutHistory = userGroups.filter(group => !changeHistory[group.id]);
      if (groupsWithoutHistory.length > 0) {
        console.log('🔍 [정책영업그룹] 변경이력 로드:', groupsWithoutHistory.length, '개 그룹');
        const changeHistoryPromises = groupsWithoutHistory.map(group => loadChangeHistory(group.id));
      Promise.all(changeHistoryPromises).then(() => {
        console.log('✅ [정책영업그룹] 변경이력 로드 완료');
      }).catch(error => {
        console.error('❌ [정책영업그룹] 변경이력 로드 실패:', error);
      });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userGroups.length]);

  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
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
        
        // 성능 최적화: 필터링 로직 간소화
        const filtered = userRole === 'SS' 
          ? data // 총괄은 모든 정책표 접근 가능
          : data.filter(setting => {
          // creatorPermissions가 배열인지 확인
          if (!Array.isArray(setting.creatorPermissions)) {
            return false;
          }
              // 정확한 문자열 비교
          const normalizedUserRole = (userRole || '').trim();
              return setting.creatorPermissions.some(perm => 
                (perm || '').trim() === normalizedUserRole
              );
        });
        
        setSettings(filtered);
      }
    } catch (error) {
      console.error('정책표 설정 로드 오류:', error);
      setError('정책표 설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setSettingsLoading(false);
    }
  };

  // 정책영업그룹 목록만 로드 (변경이력 제외 - 성능 최적화)
  const loadUserGroupsWithoutHistory = async () => {
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
        let groups = [];
        if (Array.isArray(data)) {
          groups = data;
        } else if (data.success !== false && Array.isArray(data.data)) {
          groups = data.data;
        } else {
          console.warn('정책영업그룹 응답 형식 오류:', data);
          groups = [];
        }
        
        setUserGroups(groups);
        
        // 변경이력은 백그라운드에서 지연 로드
        if (groups.length > 0) {
          console.log('🔍 [정책영업그룹] 변경이력 백그라운드 로드 시작:', groups.length, '개 그룹');
          const changeHistoryPromises = groups.map(group => loadChangeHistory(group.id));
          Promise.all(changeHistoryPromises).then(() => {
          console.log('✅ [정책영업그룹] 변경이력 로드 완료');
          }).catch(error => {
            console.error('❌ [정책영업그룹] 변경이력 로드 실패:', error);
          });
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

  const loadUserGroups = async () => {
    // loadUserGroupsWithoutHistory를 사용하여 변경이력 제외하고 빠르게 로드
    await loadUserGroupsWithoutHistory();
  };

  // 변경이력 로드 함수
  const loadChangeHistory = async (groupId) => {
    if (!groupId) return;
    
    try {
      setHistoryLoading(prev => ({ ...prev, [groupId]: true }));
      const response = await fetch(`${API_BASE_URL}/api/policy-table/user-groups/${groupId}/change-history`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setChangeHistory(prev => ({ ...prev, [groupId]: data || [] }));
      } else {
        console.error(`그룹 ${groupId} 변경이력 로드 실패:`, response.status);
        setChangeHistory(prev => ({ ...prev, [groupId]: [] }));
      }
    } catch (error) {
      console.error(`그룹 ${groupId} 변경이력 로드 오류:`, error);
      setChangeHistory(prev => ({ ...prev, [groupId]: [] }));
    } finally {
      setHistoryLoading(prev => ({ ...prev, [groupId]: false }));
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

  const handleOpenGroupModal = async (group = null) => {
    // companies와 teamLeaders가 없으면 지연 로드
    if (companies.length === 0) {
      await loadCompanies();
    }
    if (teamLeaders.length === 0) {
      await loadTeamLeaders();
    }
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
            'x-user-name': encodeURIComponent(String(loggedInStore?.name || loggedInStore?.target || 'Unknown'))
          },
        body: JSON.stringify(groupFormData)
      });

      if (response.ok) {
        const responseData = await response.json();
        const savedGroupId = editingGroup?.id || responseData.id;
        await loadUserGroups();
        // 수정된 그룹의 변경이력 다시 로드
        if (savedGroupId) {
          await loadChangeHistory(savedGroupId);
        }
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
        // 삭제된 그룹의 변경이력 제거
        setChangeHistory(prev => {
          const newHistory = { ...prev };
          delete newHistory[id];
          return newHistory;
        });
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

  // 변경이력 기반으로 항목의 상태 결정 (추가/수정/삭제/폰클적용)
  // useMemo로 최적화: 변경이력이 로드되지 않은 경우 null 반환 (지연 로딩)
  const getItemStatus = useCallback((groupId, itemName, itemType) => {
    const history = changeHistory[groupId] || [];
    if (history.length === 0) return null; // 변경이력이 없으면 기본 상태 (지연 로딩)

    // 해당 항목(그룹이름 또는 업체명)의 최신 변경이력 찾기
    const relevantHistory = history
      .filter(h => {
        if (itemType === '그룹이름') {
          return h.changeType === '그룹이름' && 
                 (h.beforeValue === itemName || h.afterValue === itemName);
        } else {
          const beforeValue = Array.isArray(h.beforeValue) ? h.beforeValue : (h.beforeValue ? [h.beforeValue] : []);
          const afterValue = Array.isArray(h.afterValue) ? h.afterValue : (h.afterValue ? [h.afterValue] : []);
          return h.changeType === '업체명' && 
                 (beforeValue.includes(itemName) || afterValue.includes(itemName));
        }
      })
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt)); // 최신순

    if (relevantHistory.length === 0) return null;

    // 폰클 적용 여부 확인 (특정 업체명에 대해 폰클 적용된 이력 찾기)
    // 업체명의 경우, phoneAppliedCompanies 배열에서 해당 업체명이 포함되어 있는지 확인
    if (itemType === '업체명') {
      const phoneAppliedHistory = relevantHistory.find(h => {
        // phoneAppliedCompanies 배열에서 해당 업체명 확인
        const phoneAppliedCompanies = h.phoneAppliedCompanies || [];
        if (phoneAppliedCompanies.includes(itemName)) {
          return true;
        }
        // 하위 호환성: phoneAppliedCompanies가 없고 phoneApplied가 Y인 경우
        // (기존 데이터)
        if (!h.phoneAppliedCompanies && h.phoneApplied === 'Y') {
          const afterValue = Array.isArray(h.afterValue) ? h.afterValue : (h.afterValue ? [h.afterValue] : []);
          // 단일 업체명인 경우에만 적용 (하위 호환성)
          if (afterValue.length === 1 && afterValue[0] === itemName) {
            return true;
          }
        }
        return false;
      });
      
      if (phoneAppliedHistory) {
        return {
          status: 'phoneApplied',
          history: phoneAppliedHistory
        };
      }
    } else {
      // 그룹이름의 경우 기존 로직 유지
      const phoneAppliedHistory = relevantHistory.find(h => h.phoneApplied === 'Y');
      if (phoneAppliedHistory) {
        return {
          status: 'phoneApplied',
          history: phoneAppliedHistory
        };
      }
    }

    // 최신 변경이력 확인
    const latest = relevantHistory[0];
    
    // 현재 항목이 변경이력에 포함되어 있는지 확인
    if (itemType === '그룹이름') {
      // 그룹이름의 경우 직접 비교
      if (latest.changeAction === '추가' && latest.afterValue === itemName) {
        return { status: 'added', history: latest };
      } else if (latest.changeAction === '수정' && latest.afterValue === itemName) {
        return { status: 'modified', history: latest };
      } else if (latest.changeAction === '삭제' && latest.beforeValue === itemName) {
        return { status: 'deleted', history: latest };
      }
    } else if (itemType === '업체명') {
      // 업체명의 경우 배열에서 확인
      const afterValue = Array.isArray(latest.afterValue) ? latest.afterValue : (latest.afterValue ? [latest.afterValue] : []);
      const beforeValue = Array.isArray(latest.beforeValue) ? latest.beforeValue : (latest.beforeValue ? [latest.beforeValue] : []);
      
      // 현재 업체명이 추가되었는지 확인
      if (latest.changeAction === '추가' && afterValue.includes(itemName) && !beforeValue.includes(itemName)) {
        return { status: 'added', history: latest };
      } 
      // 현재 업체명이 수정되었는지 확인 (이전에도 있었고 지금도 있지만 값이 변경됨)
      else if (latest.changeAction === '수정' && afterValue.includes(itemName)) {
        // 수정의 경우: 이전 값과 현재 값이 다르면 수정된 것으로 간주
        return { status: 'modified', history: latest };
      } 
      // 현재 업체명이 삭제되었는지 확인
      else if (latest.changeAction === '삭제' && beforeValue.includes(itemName) && !afterValue.includes(itemName)) {
        return { status: 'deleted', history: latest };
      }
    }

    return null;
  }, [changeHistory]);

  // Popover 열기 (지연 로딩: 변경이력이 없으면 로드)
  const handleOpenPopover = async (event, groupId, itemName, itemType) => {
    // 변경이력이 없으면 먼저 로드
    if (!changeHistory[groupId] || changeHistory[groupId].length === 0) {
      await loadChangeHistory(groupId);
    }
    
    const history = changeHistory[groupId] || [];
    const relevantHistory = history
      .filter(h => {
        if (itemType === '그룹이름') {
          return h.changeType === '그룹이름' && 
                 (h.beforeValue === itemName || h.afterValue === itemName);
        } else {
          const beforeValue = Array.isArray(h.beforeValue) ? h.beforeValue : (h.beforeValue ? [h.beforeValue] : []);
          const afterValue = Array.isArray(h.afterValue) ? h.afterValue : (h.afterValue ? [h.afterValue] : []);
          return h.changeType === '업체명' && 
                 (beforeValue.includes(itemName) || afterValue.includes(itemName));
        }
      })
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

    if (relevantHistory.length > 0) {
      setPopoverContent({
        groupId,
        itemName,
        itemType,
        history: relevantHistory
      });
      setPopoverAnchor(event.currentTarget);
    }
  };

  // Popover 닫기
  const handleClosePopover = () => {
    setPopoverAnchor(null);
    setPopoverContent(null);
  };

  // 폰클 적용 완료 핸들러
  const handleApplyPhone = async (groupId, changeId, companyName = null) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/policy-table/user-groups/${groupId}/change-history/${changeId}/apply-phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
          'x-user-name': encodeURIComponent(loggedInStore?.userName || loggedInStore?.name || '')
        },
        body: JSON.stringify({ companyName }) // 특정 업체명 전달
      });

      if (response.ok) {
        const data = await response.json();
        // 변경이력 다시 로드
        await loadChangeHistory(groupId);
        // 성공 메시지 표시 (선택사항)
        console.log('폰클 적용 완료:', data);
      } else {
        const errorData = await response.json();
        console.error('폰클 적용 실패:', errorData.error);
        setError(errorData.error || '폰클 적용에 실패했습니다.');
      }
    } catch (error) {
      console.error('폰클 적용 오류:', error);
      setError('폰클 적용 중 오류가 발생했습니다.');
    }
  };

  // 기타정책 목록 로드
  const loadOtherPolicyTypes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/policy-table/other-policy-types`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.otherPolicyTypes) {
          const names = data.otherPolicyTypes.map(item => item.name);
          // 기본값 "이통사지원금"이 없으면 추가
          if (!names.includes('이통사지원금')) {
            names.unshift('이통사지원금');
          }
          setOtherPolicyTypes(names);
        }
      }
    } catch (error) {
      console.error('기타정책 목록 로드 오류:', error);
    }
  };

  // 기타정책 추가
  const handleAddOtherPolicyType = async () => {
    if (!newOtherPolicyName.trim()) {
      setError('정책명을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-table/other-policy-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        },
        body: JSON.stringify({
          policyName: newOtherPolicyName.trim()
        })
      });

      if (response.ok) {
        await loadOtherPolicyTypes();
        setNewOtherPolicyName('');
        setSnackbar({
          open: true,
          message: '기타정책이 추가되었습니다.',
          severity: 'success'
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || '기타정책 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('기타정책 추가 오류:', error);
      setError('기타정책 추가 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 정책적용일시 자동 텍스트 생성
  const generateApplyDateText = useCallback(() => {
    const { startDate, startHour, startMinute, policyType, otherPolicyName, hasEndDate, endDate, endHour, endMinute } = autoDateSettings;
    
    if (!startDate) return '';

    const year = startDate.getFullYear() % 100; // 2자리 연도
    const month = startDate.getMonth() + 1;
    const day = startDate.getDate();
    const hour = startHour;
    const minute = startMinute;

    let policyTypeText = '';
    if (policyType === 'wireless') {
      policyTypeText = '【무선정책】';
    } else if (policyType === 'wired') {
      policyTypeText = '【유선정책】';
    } else if (policyType === 'other') {
      policyTypeText = `【${otherPolicyName || '이통사지원금'}】`;
    }

    let dateText = `◆ ${year}년 ${month}월 ${day}일 ${hour}시${minute > 0 ? minute + '분' : ''} 이후 ${policyTypeText} 변경공지`;

    if (hasEndDate && endDate) {
      const endDay = endDate.getDate();
      const endHourText = endHour;
      const endMinuteText = endMinute > 0 ? endMinute + '분' : '';
      dateText = `◆ ${year}년 ${month}월 ${day}일 ${hour}시${minute > 0 ? minute + '분' : ''} 이후 ${endDay}일 ${endHourText}시${endMinuteText ? ' ' + endMinuteText : ''} 까지 ${policyTypeText} 변경공지`;
    }

    return dateText;
  }, [autoDateSettings]);

  // autoDateSettings 변경 시 자동으로 applyDate 업데이트 (개별 생성)
  useEffect(() => {
    const generatedText = generateApplyDateText();
    if (generatedText && creationModalOpen) {
      setCreationFormData(prev => ({
        ...prev,
        applyDate: generatedText
      }));
    }
  }, [generateApplyDateText, creationModalOpen]);

  // autoDateSettings 변경 시 자동으로 applyDate 업데이트 (모두 생성)
  useEffect(() => {
    const generatedText = generateApplyDateText();
    if (generatedText && batchCreationModalOpen) {
      setBatchCreationFormData(prev => ({
        ...prev,
        applyDate: generatedText
      }));
    }
  }, [generateApplyDateText, batchCreationModalOpen]);

  // 기본 그룹 설정 로드
  const loadDefaultGroups = async () => {
    try {
      const userId = loggedInStore?.contactId || loggedInStore?.id;
      if (!userId) return;

      const response = await fetch(`${API_BASE_URL}/api/policy-table/default-groups/${userId}`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': userId
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.defaultGroups) {
          setDefaultGroups(data.defaultGroups);
          return data.defaultGroups; // 반환값 추가
        }
      }
      return {};
    } catch (error) {
      console.error('기본 그룹 설정 로드 오류:', error);
      return {};
    }
  };

  const handleOpenCreationModal = async (policyTable) => {
    setSelectedPolicyTable(policyTable);
    
    // 정책영업그룹이 로드되지 않았으면 먼저 로드
    if (userGroups.length === 0) {
      await loadUserGroupsWithoutHistory();
    }
    
    // 기본 그룹이 아직 로드되지 않았으면 먼저 로드 (빠른 응답을 위해)
    let defaultGroupIds = defaultGroups[policyTable.id] || [];
    if (defaultGroupIds.length === 0 && Object.keys(defaultGroups).length === 0) {
      // 기본 그룹이 전혀 로드되지 않았으면 로드 대기
      const loadedGroups = await loadDefaultGroups();
      defaultGroupIds = loadedGroups[policyTable.id] || [];
    }
    
    // 정책적용일시 자동 생성 설정 초기화 (오늘 날짜, 현재 시간)
    const now = new Date();
    setAutoDateSettings({
      startDate: new Date(now),
      startHour: now.getHours(),
      startMinute: Math.floor(now.getMinutes() / 10) * 10,
      policyType: 'wireless',
      otherPolicyName: '이통사지원금',
      hasEndDate: false,
      endDate: null,
      endHour: 0,
      endMinute: 0
    });
    
    setCreationFormData({
      applyDate: '',
      applyContent: '',
      accessGroupIds: defaultGroupIds
    });
    setGenerationStatus(null);
    setGeneratedResult(null);
    setCreationModalOpen(true);
    
    // 백그라운드에서 기본 그룹 다시 로드 (최신 데이터 보장, 이미 로드된 경우는 스킵)
    if (Object.keys(defaultGroups).length === 0) {
      // 이미 위에서 로드했으므로 스킵
    } else {
      // 이미 로드된 경우에만 백그라운드에서 최신 데이터 확인
      loadDefaultGroups().then(loadedGroups => {
        // 로드된 그룹이 있고, 현재 선택된 그룹이 없으면 업데이트
        if (loadedGroups[policyTable.id] && loadedGroups[policyTable.id].length > 0) {
          setCreationFormData(prev => {
            // 이미 그룹이 선택되어 있으면 업데이트하지 않음
            if (prev.accessGroupIds.length > 0) {
              return prev;
            }
            return {
              ...prev,
              accessGroupIds: loadedGroups[policyTable.id]
            };
          });
        }
      });
    }
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

        // 큐 정보 포함하여 상태 설정
        setGenerationStatus({
          status: 'queued',
          progress: 0,
          message: data.message || '대기 중...',
          queuePosition: data.queuePosition,
          queueLength: data.queueLength,
          estimatedWaitTime: data.estimatedWaitTime,
          discordBotStatus: data.discordBotStatus,
          queuedUserCount: data.queuedUserCount
        });

        // 상태 폴링 시작 (하이브리드 폴링)
        startPolling(jobId);
      } else {
        let errorData;
        try {
          const text = await response.text();
          errorData = text ? JSON.parse(text) : {};
        } catch (parseError) {
          console.error('응답 파싱 오류:', parseError);
          errorData = { error: `서버 오류 (${response.status})` };
        }
        
        // 중복 생성 시도인 경우
        if (response.status === 409) {
          setError(errorData.error || '이미 진행 중인 정책표 생성 작업이 있습니다.');
          setGenerationStatus({ status: 'queued', progress: 0, message: '이미 진행 중인 작업이 있습니다.' });
          // 기존 작업 ID가 있으면 해당 작업 상태 조회 시작
          if (errorData.existingJobId) {
            startPolling(errorData.existingJobId);
          }
        } else {
          setError(errorData.error || `정책표 생성 요청에 실패했습니다. (${response.status})`);
        setGenerationStatus({ status: 'failed', progress: 0, message: '생성 요청 실패' });
        }
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
          
          // 큐 정보 포함하여 상태 업데이트
          setGenerationStatus({
            ...status,
            queuePosition: status.queueInfo?.queuePosition,
            queueLength: status.queueInfo?.queueLength,
            estimatedWaitTime: status.queueInfo?.estimatedWaitTime,
            isProcessing: status.queueInfo?.isProcessing,
            discordBotStatus: status.discordBotStatus,
            queuedUserCount: status.queueInfo?.queuedUserCount
          });

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
      
      // 헤더 값 안전하게 처리 (한글 등 특수문자 인코딩)
      const userName = loggedInStore?.name || loggedInStore?.target || 'Unknown';
      const safeUserName = typeof userName === 'string' ? encodeURIComponent(userName) : 'Unknown';
      
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/tabs/order`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
          'x-user-name': safeUserName
        },
        body: JSON.stringify({ cardOrder })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('생성카드 순서 저장 완료');
          // 성공 메시지 표시 (선택사항)
          // alert('카드 순서가 저장되었습니다.');
        } else {
          console.error('생성카드 순서 저장 실패:', data.error);
          setError('카드 순서 저장에 실패했습니다.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('생성카드 순서 저장 실패:', response.status, errorData);
        setError('카드 순서 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('생성카드 순서 저장 오류:', error);
      setError('카드 순서 저장 중 오류가 발생했습니다.');
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

  // 여러 정책표 제한된 병렬 생성 시작 (동시에 최대 2개만 처리)
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
    
    // 순차 처리로 변경 (디스코드 봇이 동시 요청을 처리하지 못하는 문제 해결)
    const queue = [...selected];
    
    // 초기 상태 설정
    selected.forEach(setting => {
      setBatchGenerationStatus(prev => ({
        ...prev,
        [setting.id]: { status: 'queued', jobId: null, result: null, error: null }
      }));
    });
    
    // 헤더 값 안전하게 처리
    const userName = loggedInStore?.name || loggedInStore?.target || 'Unknown';
    const safeUserName = typeof userName === 'string' ? encodeURIComponent(userName) : 'Unknown';
    
    // 순차 처리 함수 (완료될 때까지 기다림)
    const processSetting = async (setting) => {
      return new Promise(async (resolve) => {
        try {
          // 디버깅: 요청 보내는 데이터 로그
          console.log(`[정책표 생성 프론트엔드] 요청 보냄:`);
          console.log(`  - setting.id: ${setting.id}`);
          console.log(`  - setting.policyTableName: ${setting.policyTableName}`);
          console.log(`  - policyTableId: ${setting.id}`);
          console.log(`  - accessGroupIds: ${JSON.stringify(batchCreationFormData.policyTableGroups[setting.id])}`);

          setBatchGenerationStatus(prev => ({
            ...prev,
            [setting.id]: { status: 'queued', jobId: null, result: null, error: null }
          }));

          const requestBody = {
            policyTableId: setting.id,
            applyDate: batchCreationFormData.applyDate,
            applyContent: batchCreationFormData.applyContent,
            accessGroupIds: batchCreationFormData.policyTableGroups[setting.id]
          };

          console.log(`[정책표 생성 프론트엔드] 요청 본문:`, JSON.stringify(requestBody, null, 2));

          const response = await fetch(`${API_BASE_URL}/api/policy-table/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-role': loggedInStore?.userRole || '',
              'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
              'x-user-name': safeUserName
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            let errorData;
            try {
              const text = await response.text();
              errorData = text ? JSON.parse(text) : {};
            } catch (parseError) {
              console.error('응답 파싱 오류:', parseError);
              errorData = { error: `서버 오류 (${response.status})` };
            }
            
            // 중복 생성 시도인 경우
            if (response.status === 409) {
              setBatchGenerationStatus(prev => ({
                ...prev,
                [setting.id]: { 
                  status: 'queued', 
                  jobId: errorData.existingJobId || null, 
                  result: null, 
                  error: null,
                  message: errorData.error || '이미 진행 중인 작업이 있습니다.'
                }
              }));
              // 기존 작업 ID가 있으면 해당 작업 상태 조회 시작
              if (errorData.existingJobId) {
                startBatchPolling(setting.id, errorData.existingJobId);
              }
              resolve({ settingId: setting.id, jobId: errorData.existingJobId, success: true });
              return;
            }
            throw new Error(errorData.error || `정책표 생성 요청에 실패했습니다. (${response.status})`);
          }

          let data;
          try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
          } catch (parseError) {
            console.error('응답 파싱 오류:', parseError);
            throw new Error('서버 응답을 파싱할 수 없습니다.');
          }
          const jobId = data.jobId;

          setBatchGenerationStatus(prev => ({
            ...prev,
            [setting.id]: { 
              status: data.status === 'queued' ? 'queued' : 'processing', 
              jobId, 
              result: null, 
              error: null,
              message: data.message || '대기 중...',
              queuePosition: data.queuePosition,
              queueLength: data.queueLength,
              queuedUserCount: data.queuedUserCount
            }
          }));

          // 폴링 시작 및 완료될 때까지 기다림
          await startBatchPollingUntilComplete(setting.id, jobId);

          resolve({ settingId: setting.id, jobId, success: true });
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
          resolve({ settingId: setting.id, jobId: null, success: false, error: error.message });
        }
      });
    };
    
    // 순차 처리 실행 (각 요청이 완료될 때까지 기다린 후 다음 요청 시작)
    // 병렬 처리에서 이미지가 뒤바뀌는 문제가 발생하여 순차 처리로 변경
    for (let i = 0; i < queue.length; i++) {
      const setting = queue[i];
      
      // setting 객체를 명시적으로 복사하여 클로저 문제 방지
      const settingCopy = {
        id: setting.id,
        policyTableName: setting.policyTableName,
        policyTableDescription: setting.policyTableDescription,
        policyTableLink: setting.policyTableLink,
        policyTablePublicLink: setting.policyTablePublicLink,
        discordChannelId: setting.discordChannelId,
        creatorPermissions: setting.creatorPermissions
      };
      
      console.log(`[정책표 생성] ${i + 1}/${queue.length} 처리 시작: ${settingCopy.policyTableName} (ID: ${settingCopy.id})`);
      
      // 첫 번째 요청이 아니면 이전 요청 완료 후 약간의 지연
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
      }
      
      await processSetting(settingCopy);
      
      console.log(`[정책표 생성] ${i + 1}/${queue.length} 처리 완료: ${settingCopy.policyTableName} (ID: ${settingCopy.id})`);
    }
    
    console.log(`[정책표 생성] 모든 요청 처리 완료 (${queue.length}개)`);
  };

  // 개별 정책표 재생성
  const handleRetryGeneration = async (settingId) => {
    const setting = settings.find(s => s.id === settingId);
    if (!setting) return;
    
    // 유효성 검사
    if (!batchCreationFormData.applyDate || !batchCreationFormData.applyContent) {
      setError('정책적용일시와 정책적용내용을 입력해주세요.');
      return;
    }

    if (!batchCreationFormData.policyTableGroups[settingId] || 
        batchCreationFormData.policyTableGroups[settingId].length === 0) {
      setError(`${setting.policyTableName}의 정책영업그룹을 선택해주세요.`);
      return;
    }

    setError(null);
    setSuccessMessage(`${setting.policyTableName} 재생성을 시작했습니다...`);
    
    try {
      setBatchGenerationStatus(prev => ({
        ...prev,
        [settingId]: { status: 'queued', jobId: null, result: null, error: null, message: '재생성 요청 중...' }
      }));

      const userName = loggedInStore?.name || loggedInStore?.target || 'Unknown';
      const safeUserName = typeof userName === 'string' ? encodeURIComponent(userName) : 'Unknown';

      const response = await fetch(`${API_BASE_URL}/api/policy-table/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
          'x-user-name': safeUserName
        },
        body: JSON.stringify({
          policyTableId: settingId,
          applyDate: batchCreationFormData.applyDate,
          applyContent: batchCreationFormData.applyContent,
          accessGroupIds: batchCreationFormData.policyTableGroups[settingId]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        // 중복 생성 시도인 경우
        if (response.status === 409) {
          setBatchGenerationStatus(prev => ({
            ...prev,
            [settingId]: { 
              status: 'queued', 
              jobId: errorData.existingJobId || null, 
              result: null, 
              error: null,
              message: errorData.error || '이미 진행 중인 작업이 있습니다.'
            }
          }));
          // 기존 작업 ID가 있으면 해당 작업 상태 조회 시작
          if (errorData.existingJobId) {
            startBatchPolling(settingId, errorData.existingJobId);
          }
          setSuccessMessage(null);
          return;
        }
        throw new Error(errorData.error || '정책표 생성 요청에 실패했습니다.');
      }

      const data = await response.json();
      const jobId = data.jobId;

      setBatchGenerationStatus(prev => ({
        ...prev,
        [settingId]: { 
          status: data.status === 'queued' ? 'queued' : 'processing', 
          jobId, 
          result: null, 
          error: null, 
          message: data.message || '재생성 처리 중...',
          queuePosition: data.queuePosition,
          queueLength: data.queueLength,
          queuedUserCount: data.queuedUserCount
        }
      }));

      // 성공 메시지 업데이트
      setSuccessMessage(`${setting.policyTableName} 재생성이 시작되었습니다. 진행 상황을 확인하세요.`);
      
      // 3초 후 성공 메시지 자동 제거
      setTimeout(() => setSuccessMessage(null), 3000);

      // 폴링 시작
      startBatchPolling(settingId, jobId);
    } catch (error) {
      console.error(`[정책표] ${setting.policyTableName} 재생성 오류:`, error);
      setError(`${setting.policyTableName} 재생성 실패: ${error.message}`);
      setSuccessMessage(null);
      setBatchGenerationStatus(prev => ({
        ...prev,
        [settingId]: { 
          status: 'failed', 
          jobId: null, 
          result: null, 
          error: error.message 
        }
      }));
    }
  };

  // 배치 생성 폴링 시작 (기존 - UI 업데이트용)
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
              message: data.message || '',
              queuePosition: data.queueInfo?.queuePosition,
              queueLength: data.queueInfo?.queueLength,
              estimatedWaitTime: data.queueInfo?.estimatedWaitTime,
              isProcessing: data.queueInfo?.isProcessing,
              discordBotStatus: data.discordBotStatus,
              failureReason: data.failureReason,
              queuedUserCount: data.queueInfo?.queuedUserCount
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

  // 배치 생성 폴링 (완료될 때까지 기다림)
  const startBatchPollingUntilComplete = (settingId, jobId) => {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/policy-table/generate/${jobId}/status`, {
            headers: {
              'x-user-role': loggedInStore?.userRole || '',
              'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
            }
          });

          if (response.ok) {
            const data = await response.json();
            
            // UI 업데이트
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

            if (data.status === 'completed') {
              console.log(`[정책표 생성] ${settingId} 완료`);
              resolve(data.result);
            } else if (data.status === 'failed') {
              console.error(`[정책표 생성] ${settingId} 실패:`, data.error);
              reject(new Error(data.error || '정책표 생성에 실패했습니다.'));
            } else {
              // 계속 폴링
              setTimeout(poll, 2000); // 2초 후 다시 폴링
            }
          } else {
            // 응답 오류 시 재시도
            setTimeout(poll, 2000);
          }
        } catch (error) {
          console.error(`[정책표] 폴링 오류 (${settingId}):`, error);
          // 네트워크 오류 시 재시도
          setTimeout(poll, 2000);
        }
      };

      // 즉시 시작
      poll();
    });
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
        setSnackbar({ open: true, message: '정책표가 등록되었습니다.', severity: 'success' });
        handleCloseCreationModal();
        // 정책표 목록 새로고침
        await loadSettings();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || '정책표 등록에 실패했습니다.';
        setError(errorMessage);
        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      }
    } catch (error) {
      console.error('정책표 등록 오류:', error);
      const errorMessage = '정책표 등록 중 오류가 발생했습니다.';
      setError(errorMessage);
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 배치 생성된 모든 정책표 등록
  const handleBatchRegister = async () => {
    // 완료된 정책표만 필터링
    const completedResults = Object.entries(batchGenerationStatus)
      .filter(([settingId, status]) => status.status === 'completed' && status.result)
      .map(([settingId, status]) => ({
        settingId,
        result: status.result,
        setting: settings.find(s => s.id === settingId)
      }));

    if (completedResults.length === 0) {
      setError('등록할 정책표가 없습니다.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 모든 정책표를 병렬로 등록
      const registerPromises = completedResults.map(({ result }) =>
        fetch(`${API_BASE_URL}/api/policy-tables/${result.id}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': loggedInStore?.userRole || '',
            'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
          }
        })
      );

      const responses = await Promise.allSettled(registerPromises);
      
      // 응답 결과 상세 분석 및 상태 업데이트
      const results = await Promise.all(
        responses.map(async (response, index) => {
          const { settingId } = completedResults[index];
          if (response.status === 'fulfilled' && response.value.ok) {
            const data = await response.value.json();
            // 등록 성공 상태 업데이트
            setBatchGenerationStatus(prev => ({
              ...prev,
              [settingId]: {
                ...prev[settingId],
                registrationStatus: data.alreadyRegistered ? 'already_registered' : 'registered',
                registrationMessage: data.alreadyRegistered ? '이미 등록 완료' : '등록 완료'
              }
            }));
            return {
              success: true,
              alreadyRegistered: data.alreadyRegistered || false,
              result: completedResults[index]
            };
          } else {
            let errorMessage = '등록 실패';
            if (response.status === 'fulfilled') {
              try {
                const errorData = await response.value.json();
                errorMessage = errorData.error || errorMessage;
              } catch (e) {
                errorMessage = `HTTP ${response.value.status}`;
              }
            } else {
              errorMessage = response.reason?.message || '등록 실패';
            }
            // 등록 실패 상태 업데이트
            setBatchGenerationStatus(prev => ({
              ...prev,
              [settingId]: {
                ...prev[settingId],
                registrationStatus: 'registration_failed',
                registrationError: errorMessage
              }
            }));
            return {
              success: false,
              error: errorMessage,
              result: completedResults[index]
            };
          }
        })
      );
      
      const successCount = results.filter(r => r.success).length;
      const alreadyRegisteredCount = results.filter(r => r.success && r.alreadyRegistered).length;
      const newRegisteredCount = successCount - alreadyRegisteredCount;
      const failCount = results.filter(r => !r.success).length;

      if (failCount === 0) {
        let message = '';
        if (alreadyRegisteredCount > 0 && newRegisteredCount > 0) {
          message = `${newRegisteredCount}개 등록 완료, ${alreadyRegisteredCount}개는 이미 등록되어 있었습니다.`;
        } else if (alreadyRegisteredCount > 0) {
          message = `모든 정책표(${alreadyRegisteredCount}개)가 이미 등록되어 있었습니다.`;
        } else {
          message = `모든 정책표(${successCount}개)가 등록되었습니다.`;
        }
        setSnackbar({ 
          open: true, 
          message, 
          severity: 'success' 
        });
        // 정책표 목록 새로고침
        await loadSettings();
        // 모든 정책표가 등록되었거나 이미 등록되어 있었다면 모달 닫기
        if (newRegisteredCount > 0 || (alreadyRegisteredCount > 0 && failCount === 0)) {
        handleCloseBatchCreationModal();
        }
      } else {
        // 일부 실패한 경우에도 성공 메시지는 표시하지 않고, UI에서 개별 상태를 확인하도록 함
        setSnackbar({ 
          open: true, 
          message: '일부 정책표 등록에 실패했습니다. 아래 상태를 확인해주세요.', 
          severity: 'warning' 
        });
      }
    } catch (error) {
      console.error('배치 정책표 등록 오류:', error);
      const errorMessage = '정책표 등록 중 오류가 발생했습니다.';
      setError(errorMessage);
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
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
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
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
          {settingsLoading && settings.length === 0 ? (
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
                    onClick={async () => {
                      const selected = settings.filter(s => selectedSettings.includes(s.id));
                      
                      // 정책영업그룹이 로드되지 않았으면 먼저 로드
                      if (userGroups.length === 0) {
                        await loadUserGroupsWithoutHistory();
                      }
                      
                      // 기본 그룹이 아직 로드되지 않았으면 먼저 로드 (빠른 응답을 위해)
                      let policyTableGroups = {};
                      if (Object.keys(defaultGroups).length === 0) {
                        // 기본 그룹이 전혀 로드되지 않았으면 로드 대기
                        const loadedGroups = await loadDefaultGroups();
                        selected.forEach(setting => {
                          const defaultGroupIds = loadedGroups[setting.id] || [];
                          if (defaultGroupIds.length > 0) {
                            policyTableGroups[setting.id] = defaultGroupIds;
                          }
                        });
                      } else {
                        // 이미 로드된 기본 그룹 사용 (즉시 모달 열기)
                        selected.forEach(setting => {
                          const defaultGroupIds = defaultGroups[setting.id] || [];
                          if (defaultGroupIds.length > 0) {
                            policyTableGroups[setting.id] = defaultGroupIds;
                          }
                        });
                      }
                      
                      setBatchCreationFormData({
                        applyDate: '',
                        applyContent: '',
                        policyTableGroups: policyTableGroups
                      });
                      setBatchGenerationStatus({});
                      setBatchCreationModalOpen(true);
                      
                      // 백그라운드에서 기본 그룹 다시 로드 (최신 데이터 보장, 이미 로드된 경우는 스킵)
                      if (Object.keys(defaultGroups).length === 0) {
                        // 이미 위에서 로드했으므로 스킵
                      } else {
                        // 이미 로드된 경우에만 백그라운드에서 최신 데이터 확인
                        loadDefaultGroups().then(loadedGroups => {
                          // 로드된 그룹으로 업데이트 (현재 선택된 그룹이 없는 경우만)
                          setBatchCreationFormData(prev => {
                            const updatedGroups = { ...prev.policyTableGroups };
                            let hasUpdate = false;
                            
                            selected.forEach(setting => {
                              if (loadedGroups[setting.id] && loadedGroups[setting.id].length > 0) {
                                if (!updatedGroups[setting.id] || updatedGroups[setting.id].length === 0) {
                                  updatedGroups[setting.id] = loadedGroups[setting.id];
                                  hasUpdate = true;
                                }
                              }
                            });
                            
                            if (hasUpdate) {
                              return {
                                ...prev,
                                policyTableGroups: updatedGroups
                              };
                            }
                            return prev;
                          });
                        });
                      }
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
                            let url = setting.policyTableLink;
                            if (/^[a-zA-Z0-9-_]+$/.test(url)) {
                              url = `https://docs.google.com/spreadsheets/d/${url}/edit`;
                            }
                            window.open(url, '_blank');
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
                    <TableCell>폰클등록</TableCell>
                    <TableCell>그룹이름</TableCell>
                    <TableCell>업체명</TableCell>
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
                    userGroups.map((group) => {
                      const groupNameStatus = getItemStatus(group.id, group.groupName, '그룹이름');
                      
                      return (
                        <TableRow 
                          key={group.id}
                          sx={{
                            backgroundColor: group.phoneRegistered ? '#f5f5f5' : 'inherit'
                          }}
                        >
                          <TableCell>
                            <Switch
                              checked={group.phoneRegistered || false}
                              onChange={async (e) => {
                                const newValue = e.target.checked;
                                try {
                                  const response = await fetch(`${API_BASE_URL}/api/policy-table/user-groups/${group.id}/phone-register`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-user-role': loggedInStore?.userRole || '',
                                      'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
                                      'x-user-name': encodeURIComponent(loggedInStore?.userName || loggedInStore?.name || '')
                                    },
                                    body: JSON.stringify({ phoneRegistered: newValue })
                                  });

                                  if (response.ok) {
                                    // 그룹 목록 다시 로드
                                    await loadUserGroups();
                                  } else {
                                    // Content-Type 확인 후 JSON 파싱
                                    const contentType = response.headers.get('content-type');
                                    if (contentType && contentType.includes('application/json')) {
                                      const errorData = await response.json();
                                      setError(errorData.error || '폰클 등록 여부 업데이트에 실패했습니다.');
                                    } else {
                                      // HTML 에러 페이지인 경우
                                      const errorText = await response.text();
                                      console.error('폰클 등록 여부 업데이트 실패:', {
                                        status: response.status,
                                        statusText: response.statusText,
                                        url: response.url
                                      });
                                      setError(`폰클 등록 여부 업데이트에 실패했습니다. (${response.status} ${response.statusText})`);
                                    }
                                  }
                                } catch (error) {
                                  console.error('폰클 등록 여부 업데이트 오류:', error);
                                  setError('폰클 등록 여부 업데이트 중 오류가 발생했습니다.');
                                }
                              }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography
                                component="span"
                                onClick={(e) => groupNameStatus && handleOpenPopover(e, group.id, group.groupName, '그룹이름')}
                                sx={{
                                  color: groupNameStatus?.status === 'phoneApplied' ? 'purple' :
                                         groupNameStatus?.status === 'added' ? 'primary.main' :
                                         groupNameStatus?.status === 'modified' ? 'success.main' :
                                         groupNameStatus?.status === 'deleted' ? 'error.main' : 'inherit',
                                  textDecoration: groupNameStatus?.status === 'deleted' ? 'line-through' : 'none',
                                  cursor: groupNameStatus ? 'pointer' : 'default',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.5
                                }}
                              >
                                {group.groupName}
                                {groupNameStatus?.status === 'phoneApplied' && <PhoneAndroidIcon sx={{ fontSize: 16 }} />}
                                {groupNameStatus?.status === 'added' && <AddCircleIcon sx={{ fontSize: 16 }} />}
                                {groupNameStatus?.status === 'modified' && <EditOutlinedIcon sx={{ fontSize: 16 }} />}
                                {groupNameStatus?.status === 'deleted' && <RemoveCircleIcon sx={{ fontSize: 16 }} />}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              // 현재 업체명 목록
                              const currentCompanyNames = group.companyNames || [];
                              
                              // 변경이력에서 삭제된 업체명 찾기
                              const history = changeHistory[group.id] || [];
                              const deletedCompaniesMap = new Map(); // 중복 방지를 위한 Map
                              
                              // 변경이력을 시간순으로 정렬하여 최신 상태 확인
                              const sortedHistory = [...history].sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
                              
                              // 각 업체명의 최종 상태 추적
                              const companyStatusMap = new Map();
                              
                              sortedHistory.forEach(h => {
                                if (h.changeType === '업체명') {
                                  const beforeValue = Array.isArray(h.beforeValue) ? h.beforeValue : (h.beforeValue ? [h.beforeValue] : []);
                                  const afterValue = Array.isArray(h.afterValue) ? h.afterValue : (h.afterValue ? [h.afterValue] : []);
                                  
                                  if (h.changeAction === '추가') {
                                    // 추가된 업체명들
                                    afterValue.forEach(companyName => {
                                      if (!beforeValue.includes(companyName)) {
                                        companyStatusMap.set(companyName, { status: 'exists', history: h });
                                      }
                                    });
                                  } else if (h.changeAction === '삭제') {
                                    // 삭제된 업체명들
                                    beforeValue.forEach(companyName => {
                                      if (!afterValue.includes(companyName)) {
                                        // 현재 그룹에 없는 경우에만 삭제된 것으로 표시
                                        if (!currentCompanyNames.includes(companyName)) {
                                          companyStatusMap.set(companyName, { status: 'deleted', history: h });
                                        } else {
                                          // 현재 그룹에 있으면 존재하는 것으로 표시 (재추가됨)
                                          companyStatusMap.set(companyName, { status: 'exists', history: h });
                                        }
                                      }
                                    });
                                  }
                                }
                              });
                              
                              // 삭제된 업체명만 별도로 수집
                              const deletedCompanies = [];
                              companyStatusMap.forEach((statusInfo, companyName) => {
                                if (statusInfo.status === 'deleted' && !currentCompanyNames.includes(companyName)) {
                                  deletedCompanies.push({
                                    name: companyName,
                                    deletedAt: statusInfo.history.changedAt,
                                    changeId: statusInfo.history.changeId,
                                    history: statusInfo.history
                                  });
                                }
                              });
                              
                              // 현재 업체명과 삭제된 업체명 합치기
                              const allCompanyNames = [
                                ...currentCompanyNames.map(name => ({ name, isDeleted: false })),
                                ...deletedCompanies.map(dc => ({ name: dc.name, isDeleted: true, deletedInfo: dc }))
                              ];
                              
                              if (allCompanyNames.length === 0) {
                                return (
                                  <Typography variant="body2" color="text.secondary">
                                    업체명 없음
                                  </Typography>
                                );
                              }
                              
                              return (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {allCompanyNames.map(({ name, isDeleted, deletedInfo }) => {
                                    const companyStatus = getItemStatus(group.id, name, '업체명');
                                    // 삭제된 업체명인 경우 deleted 상태로 표시
                                    const finalStatus = isDeleted ? { status: 'deleted', history: deletedInfo?.history } : companyStatus;
                                    
                                    return (
                                      <Chip
                                        key={`${name}-${isDeleted ? 'deleted' : 'current'}`}
                                        label={
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <span>{name}</span>
                                            {finalStatus?.status === 'phoneApplied' && <PhoneAndroidIcon sx={{ fontSize: 14 }} />}
                                            {finalStatus?.status === 'added' && <AddCircleIcon sx={{ fontSize: 14 }} />}
                                            {finalStatus?.status === 'modified' && <EditOutlinedIcon sx={{ fontSize: 14 }} />}
                                            {finalStatus?.status === 'deleted' && <RemoveCircleIcon sx={{ fontSize: 14 }} />}
                                          </Box>
                                        }
                                        size="small"
                                        onClick={(e) => finalStatus && handleOpenPopover(e, group.id, name, '업체명')}
                                        sx={{
                                          color: finalStatus?.status === 'phoneApplied' ? 'purple' :
                                                 finalStatus?.status === 'added' ? 'primary.main' :
                                                 finalStatus?.status === 'modified' ? 'success.main' :
                                                 finalStatus?.status === 'deleted' ? 'error.main' : 'inherit',
                                          textDecoration: finalStatus?.status === 'deleted' ? 'line-through' : 'none',
                                          cursor: finalStatus ? 'pointer' : 'default',
                                          '&:hover': finalStatus ? { opacity: 0.8 } : {}
                                        }}
                                      />
                                    );
                                  })}
                                </Box>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => handleOpenGroupModal(group)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleDeleteGroup(group.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
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
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* 정책적용일시 자동 생성 섹션 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                    정책적용일시 자동 생성
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {/* 시작 날짜 */}
                    <Grid item xs={12} sm={6}>
                      <DatePicker
                        label="시작 날짜"
                        value={autoDateSettings.startDate}
                        onChange={(newValue) => {
                          setAutoDateSettings(prev => ({ ...prev, startDate: newValue }));
                        }}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small'
                          }
                        }}
                      />
                    </Grid>
                    
                    {/* 시작 시간 */}
                    <Grid item xs={6} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>시</InputLabel>
                        <Select
                          value={autoDateSettings.startHour}
                          label="시"
                          onChange={(e) => {
                            setAutoDateSettings(prev => ({ ...prev, startHour: e.target.value }));
                          }}
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <MenuItem key={i} value={i}>{i}시</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={6} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>분 (10분 단위)</InputLabel>
                        <Select
                          value={autoDateSettings.startMinute}
                          label="분 (10분 단위)"
                          onChange={(e) => {
                            setAutoDateSettings(prev => ({ ...prev, startMinute: e.target.value }));
                          }}
                        >
                          {Array.from({ length: 6 }, (_, i) => {
                            const minute = i * 10;
                            return <MenuItem key={minute} value={minute}>{minute}분</MenuItem>;
                          })}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    {/* 정책 유형 선택 */}
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>정책 유형</InputLabel>
                        <Select
                          value={autoDateSettings.policyType}
                          label="정책 유형"
                          onChange={(e) => {
                            setAutoDateSettings(prev => ({ ...prev, policyType: e.target.value }));
                          }}
                        >
                          <MenuItem value="wireless">무선정책</MenuItem>
                          <MenuItem value="wired">유선정책</MenuItem>
                          <MenuItem value="other">기타정책</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    {/* 기타정책 선택 */}
                    {autoDateSettings.policyType === 'other' && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel>기타정책명</InputLabel>
                            <Select
                              value={autoDateSettings.otherPolicyName}
                              label="기타정책명"
                              onChange={(e) => {
                                setAutoDateSettings(prev => ({ ...prev, otherPolicyName: e.target.value }));
                              }}
                            >
                              {otherPolicyTypes.map((name) => (
                                <MenuItem key={name} value={name}>{name}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleAddOtherPolicyType}
                            sx={{ minWidth: 80 }}
                          >
                            추가
                          </Button>
                        </Box>
                      </Grid>
                    )}
                    
                    {/* 기타정책 추가 입력 필드 */}
                    {autoDateSettings.policyType === 'other' && (
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="새 기타정책명"
                            value={newOtherPolicyName}
                            onChange={(e) => setNewOtherPolicyName(e.target.value)}
                            placeholder="정책명을 입력하세요"
                          />
                        </Box>
                      </Grid>
                    )}
                    
                    {/* 종료시점 체크박스 */}
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={autoDateSettings.hasEndDate}
                            onChange={(e) => {
                              setAutoDateSettings(prev => ({
                                ...prev,
                                hasEndDate: e.target.checked,
                                endDate: e.target.checked ? (prev.endDate || new Date()) : null
                              }));
                            }}
                          />
                        }
                        label="종료시점 사용"
                      />
                    </Grid>
                    
                    {/* 종료 날짜/시간 */}
                    {autoDateSettings.hasEndDate && (
                      <>
                        <Grid item xs={12} sm={6}>
                          <DatePicker
                            label="종료 날짜"
                            value={autoDateSettings.endDate}
                            onChange={(newValue) => {
                              setAutoDateSettings(prev => ({ ...prev, endDate: newValue }));
                            }}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                size: 'small'
                              }
                            }}
                          />
                        </Grid>
                        
                        <Grid item xs={6} sm={3}>
                          <FormControl fullWidth size="small">
                            <InputLabel>종료 시</InputLabel>
                            <Select
                              value={autoDateSettings.endHour}
                              label="종료 시"
                              onChange={(e) => {
                                setAutoDateSettings(prev => ({ ...prev, endHour: e.target.value }));
                              }}
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <MenuItem key={i} value={i}>{i}시</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        
                        <Grid item xs={6} sm={3}>
                          <FormControl fullWidth size="small">
                            <InputLabel>종료 분 (10분 단위)</InputLabel>
                            <Select
                              value={autoDateSettings.endMinute}
                              label="종료 분 (10분 단위)"
                              onChange={(e) => {
                                setAutoDateSettings(prev => ({ ...prev, endMinute: e.target.value }));
                              }}
                            >
                              {Array.from({ length: 6 }, (_, i) => {
                                const minute = i * 10;
                                return <MenuItem key={minute} value={minute}>{minute}분</MenuItem>;
                              })}
                            </Select>
                          </FormControl>
                        </Grid>
                      </>
                    )}
                  </Grid>
                </Paper>
              </Grid>
              
              {/* 생성된 정책적용일시 표시 */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책적용일시"
                value={creationFormData.applyDate}
                onChange={(e) => setCreationFormData({ ...creationFormData, applyDate: e.target.value })}
                  placeholder="자동 생성된 텍스트가 여기에 표시됩니다"
                required
              />
            </Grid>
            </Grid>
          </LocalizationProvider>
          <Grid container spacing={2} sx={{ mt: 1 }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
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
                  sx={{ flex: 1 }}
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
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setDefaultGroupFormData({
                      policyTableId: selectedPolicyTable?.id || '',
                      defaultGroupIds: creationFormData.accessGroupIds
                    });
                    setDefaultGroupModalOpen(true);
                  }}
                  sx={{ minWidth: 100 }}
                >
                  기본설정
                </Button>
              </Box>
            </Grid>

            {/* 생성 진행 상황 */}
            {generationStatus && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {generationStatus.message || '처리 중...'}
                    </Typography>
                    
                    {/* 대기열 정보 표시 */}
                    {generationStatus.status === 'queued' && (generationStatus.queuePosition !== undefined || generationStatus.queuedUserCount !== undefined) && (
                      <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {generationStatus.queuedUserCount !== undefined 
                                ? `대기 중: ${generationStatus.queuedUserCount}명의 사용자가 ${generationStatus.queueLength}건 대기 중`
                                : `대기순번: ${generationStatus.queuePosition}번`}
                            </Typography>
                            {generationStatus.queuePosition !== undefined && generationStatus.queuePosition > 0 && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                내 순번: {generationStatus.queuePosition}번
                              </Typography>
                            )}
                            {generationStatus.estimatedWaitTime !== undefined && generationStatus.estimatedWaitTime > 0 && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                예상 대기 시간: 약 {Math.ceil(generationStatus.estimatedWaitTime / 60)}분
                              </Typography>
                            )}
                          </Box>
                          <CircularProgress size={24} />
                        </Box>
                      </Alert>
                    )}

                    {/* 디스코드 봇 상태 표시 */}
                    {generationStatus.discordBotStatus && (
                      <Box sx={{ mt: 1, mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          디스코드 봇 상태:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label={generationStatus.discordBotStatus.isAvailable ? '✅ 사용 가능' : '❌ 사용 불가'}
                            color={generationStatus.discordBotStatus.isAvailable ? 'success' : 'error'}
                          />
                          {generationStatus.discordBotStatus.lastResponseTime !== null && (
                            <Chip
                              size="small"
                              label={`응답 시간: ${(generationStatus.discordBotStatus.lastResponseTime / 1000).toFixed(1)}초`}
                              variant="outlined"
                            />
                          )}
                          {generationStatus.discordBotStatus.lastError && (
                            <Chip
                              size="small"
                              label={`오류: ${generationStatus.discordBotStatus.lastError.substring(0, 20)}...`}
                              color="error"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
                    )}

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
                        {generatedResult.excelUrl && (
                          <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                            ✅ 이미지 및 엑셀 파일이 모두 생성되었습니다.
                          </Typography>
                        )}
                        {!generatedResult.excelUrl && (
                          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                            ⚠️ 이미지는 생성되었으나 엑셀 파일은 생성되지 않았습니다.
                          </Typography>
                        )}
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
                      <Typography variant="body2" fontWeight="bold">
                        {generationStatus.error || '정책표 생성에 실패했습니다.'}
                      </Typography>
                      {generationStatus.failureReason && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                          원인: {generationStatus.failureReason}
                        </Typography>
                      )}
                      {generationStatus.discordBotStatus?.lastError && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          디스코드 봇 오류: {generationStatus.discordBotStatus.lastError.substring(0, 50)}...
                        </Typography>
                      )}
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
              disabled={
                loading || 
                !creationFormData.applyDate || 
                !creationFormData.applyContent ||
                (generationStatus && (generationStatus.status === 'queued' || generationStatus.status === 'processing'))
              }
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
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* 정책적용일시 자동 생성 섹션 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                    정책적용일시 자동 생성
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {/* 시작 날짜 */}
                    <Grid item xs={12} sm={6}>
                      <DatePicker
                        label="시작 날짜"
                        value={autoDateSettings.startDate}
                        onChange={(newValue) => {
                          setAutoDateSettings(prev => ({ ...prev, startDate: newValue }));
                        }}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small'
                          }
                        }}
                      />
                    </Grid>
                    
                    {/* 시작 시간 */}
                    <Grid item xs={6} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>시</InputLabel>
                        <Select
                          value={autoDateSettings.startHour}
                          label="시"
                          onChange={(e) => {
                            setAutoDateSettings(prev => ({ ...prev, startHour: e.target.value }));
                          }}
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <MenuItem key={i} value={i}>{i}시</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={6} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>분 (10분 단위)</InputLabel>
                        <Select
                          value={autoDateSettings.startMinute}
                          label="분 (10분 단위)"
                          onChange={(e) => {
                            setAutoDateSettings(prev => ({ ...prev, startMinute: e.target.value }));
                          }}
                        >
                          {Array.from({ length: 6 }, (_, i) => {
                            const minute = i * 10;
                            return <MenuItem key={minute} value={minute}>{minute}분</MenuItem>;
                          })}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    {/* 정책 유형 선택 */}
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>정책 유형</InputLabel>
                        <Select
                          value={autoDateSettings.policyType}
                          label="정책 유형"
                          onChange={(e) => {
                            setAutoDateSettings(prev => ({ ...prev, policyType: e.target.value }));
                          }}
                        >
                          <MenuItem value="wireless">무선정책</MenuItem>
                          <MenuItem value="wired">유선정책</MenuItem>
                          <MenuItem value="other">기타정책</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    {/* 기타정책 선택 */}
                    {autoDateSettings.policyType === 'other' && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel>기타정책명</InputLabel>
                            <Select
                              value={autoDateSettings.otherPolicyName}
                              label="기타정책명"
                              onChange={(e) => {
                                setAutoDateSettings(prev => ({ ...prev, otherPolicyName: e.target.value }));
                              }}
                            >
                              {otherPolicyTypes.map((name) => (
                                <MenuItem key={name} value={name}>{name}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleAddOtherPolicyType}
                            sx={{ minWidth: 80 }}
                          >
                            추가
                          </Button>
                        </Box>
                      </Grid>
                    )}
                    
                    {/* 기타정책 추가 입력 필드 */}
                    {autoDateSettings.policyType === 'other' && (
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="새 기타정책명"
                            value={newOtherPolicyName}
                            onChange={(e) => setNewOtherPolicyName(e.target.value)}
                            placeholder="정책명을 입력하세요"
                          />
                        </Box>
                      </Grid>
                    )}
                    
                    {/* 종료시점 체크박스 */}
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={autoDateSettings.hasEndDate}
                            onChange={(e) => {
                              setAutoDateSettings(prev => ({
                                ...prev,
                                hasEndDate: e.target.checked,
                                endDate: e.target.checked ? (prev.endDate || new Date()) : null
                              }));
                            }}
                          />
                        }
                        label="종료시점 사용"
                      />
                    </Grid>
                    
                    {/* 종료 날짜/시간 */}
                    {autoDateSettings.hasEndDate && (
                      <>
                        <Grid item xs={12} sm={6}>
                          <DatePicker
                            label="종료 날짜"
                            value={autoDateSettings.endDate}
                            onChange={(newValue) => {
                              setAutoDateSettings(prev => ({ ...prev, endDate: newValue }));
                            }}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                size: 'small'
                              }
                            }}
                          />
                        </Grid>
                        
                        <Grid item xs={6} sm={3}>
                          <FormControl fullWidth size="small">
                            <InputLabel>종료 시</InputLabel>
                            <Select
                              value={autoDateSettings.endHour}
                              label="종료 시"
                              onChange={(e) => {
                                setAutoDateSettings(prev => ({ ...prev, endHour: e.target.value }));
                              }}
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <MenuItem key={i} value={i}>{i}시</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        
                        <Grid item xs={6} sm={3}>
                          <FormControl fullWidth size="small">
                            <InputLabel>종료 분 (10분 단위)</InputLabel>
                            <Select
                              value={autoDateSettings.endMinute}
                              label="종료 분 (10분 단위)"
                              onChange={(e) => {
                                setAutoDateSettings(prev => ({ ...prev, endMinute: e.target.value }));
                              }}
                            >
                              {Array.from({ length: 6 }, (_, i) => {
                                const minute = i * 10;
                                return <MenuItem key={minute} value={minute}>{minute}분</MenuItem>;
                              })}
                            </Select>
                          </FormControl>
                        </Grid>
                      </>
                    )}
                  </Grid>
                </Paper>
              </Grid>
              
              {/* 생성된 정책적용일시 표시 */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="정책적용일시"
                value={batchCreationFormData.applyDate}
                onChange={(e) => setBatchCreationFormData({ 
                  ...batchCreationFormData, 
                  applyDate: e.target.value 
                })}
                  placeholder="자동 생성된 텍스트가 여기에 표시됩니다"
                required
              />
            </Grid>
            </Grid>
          </LocalizationProvider>
          <Grid container spacing={2} sx={{ mt: 1 }}>
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
                      <Grid item xs={12} sm={7}>
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
                      <Grid item xs={12} sm={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setDefaultGroupFormData({
                              policyTableId: setting.id,
                              defaultGroupIds: batchCreationFormData.policyTableGroups[setting.id] || []
                            });
                            setDefaultGroupModalOpen(true);
                          }}
                          sx={{ minWidth: 80 }}
                        >
                          기본설정
                        </Button>
                      </Grid>
                      {/* 생성 상태 표시 */}
                      {batchGenerationStatus[setting.id] && (
                        <Grid item xs={12}>
                          <Box sx={{ mt: 1 }}>
                            {batchGenerationStatus[setting.id].status === 'queued' && (
                              <Alert severity="info">
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {batchGenerationStatus[setting.id].message || '대기 중...'}
                                  </Typography>
                                  {batchGenerationStatus[setting.id].queuedUserCount !== undefined && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                      {batchGenerationStatus[setting.id].queuedUserCount}명의 사용자가 {batchGenerationStatus[setting.id].queueLength}건 대기 중
                                    </Typography>
                                  )}
                                  {batchGenerationStatus[setting.id].queuePosition !== undefined && batchGenerationStatus[setting.id].queuePosition > 0 && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                      내 순번: {batchGenerationStatus[setting.id].queuePosition}번
                                    </Typography>
                                  )}
                                  {batchGenerationStatus[setting.id].estimatedWaitTime !== undefined && batchGenerationStatus[setting.id].estimatedWaitTime > 0 && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                      예상 대기 시간: 약 {Math.ceil(batchGenerationStatus[setting.id].estimatedWaitTime / 60)}분
                                    </Typography>
                                  )}
                                </Box>
                              </Alert>
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
                                {/* 디스코드 봇 상태 표시 */}
                                {batchGenerationStatus[setting.id].discordBotStatus && (
                                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    <Chip
                                      size="small"
                                      label={batchGenerationStatus[setting.id].discordBotStatus.isAvailable ? '✅ 봇 사용 가능' : '❌ 봇 사용 불가'}
                                      color={batchGenerationStatus[setting.id].discordBotStatus.isAvailable ? 'success' : 'error'}
                                    />
                                    {batchGenerationStatus[setting.id].discordBotStatus.lastResponseTime !== null && (
                                      <Chip
                                        size="small"
                                        label={`응답: ${(batchGenerationStatus[setting.id].discordBotStatus.lastResponseTime / 1000).toFixed(1)}초`}
                                        variant="outlined"
                                      />
                                    )}
                                  </Box>
                                )}
                              </Box>
                            )}
                            {batchGenerationStatus[setting.id].status === 'completed' && (
                              <Box>
                                <Alert severity="success" sx={{ mb: 1 }}>
                                  생성 완료!
                                  {batchGenerationStatus[setting.id].result && (
                                    <>
                                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                        정책표 ID: {batchGenerationStatus[setting.id].result.id}
                                      </Typography>
                                      {batchGenerationStatus[setting.id].result.excelUrl && (
                                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontWeight: 'bold', color: 'success.main' }}>
                                          ✅ 이미지 및 엑셀 파일 생성 완료
                                        </Typography>
                                      )}
                                      {!batchGenerationStatus[setting.id].result.excelUrl && (
                                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                                          ⚠️ 이미지만 생성됨 (엑셀 파일 없음)
                                        </Typography>
                                      )}
                                    </>
                                  )}
                                </Alert>
                                {batchGenerationStatus[setting.id].result?.imageUrl && (
                                  <Box sx={{ mt: 1, textAlign: 'center' }}>
                                    <img
                                      src={batchGenerationStatus[setting.id].result.imageUrl}
                                      alt={`${setting.policyTableName} 정책표`}
                                      style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ddd', borderRadius: 4 }}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  </Box>
                                )}
                              </Box>
                            )}
                            {batchGenerationStatus[setting.id].status === 'failed' && (
                              <Box>
                                <Alert severity="error" sx={{ mb: 1 }}>
                                  <Typography variant="body2" fontWeight="bold">
                                    생성 실패: {batchGenerationStatus[setting.id].error || '알 수 없는 오류'}
                                  </Typography>
                                  {batchGenerationStatus[setting.id].failureReason && (
                                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                      원인: {batchGenerationStatus[setting.id].failureReason}
                                    </Typography>
                                  )}
                                  {batchGenerationStatus[setting.id].discordBotStatus?.lastError && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                      디스코드 봇 오류: {batchGenerationStatus[setting.id].discordBotStatus.lastError.substring(0, 50)}...
                                    </Typography>
                                  )}
                                </Alert>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<RefreshIcon />}
                                  onClick={() => handleRetryGeneration(setting.id)}
                                  disabled={
                                    !batchCreationFormData.applyDate ||
                                    !batchCreationFormData.applyContent ||
                                    !batchCreationFormData.policyTableGroups[setting.id] ||
                                    batchCreationFormData.policyTableGroups[setting.id].length === 0
                                  }
                                >
                                  재생성
                                </Button>
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                ))}
            </Grid>
          </Grid>
          
          {/* 정책표별 등록 상태 표시 (정책표등록 버튼 위) */}
          {Object.values(batchGenerationStatus).some(status => 
            status.status === 'completed' && status.result
          ) && (
            <Box sx={{ mt: 3, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                정책표 등록 상태
              </Typography>
              <Grid container spacing={2}>
                {settings
                  .filter(s => selectedSettings.includes(s.id))
                  .filter(s => {
                    const status = batchGenerationStatus[s.id];
                    return status?.status === 'completed' && status?.result;
                  })
                  .map((setting) => {
                    const status = batchGenerationStatus[setting.id];
                    const registrationStatus = status?.registrationStatus;
                    const registrationError = status?.registrationError;
                    const registrationMessage = status?.registrationMessage;
                    
                    return (
                      <Grid item xs={12} key={setting.id}>
                        <Box sx={{ 
                          p: 2, 
                          border: '1px solid', 
                          borderColor: registrationStatus === 'registration_failed' ? 'error.main' : 
                                       registrationStatus === 'already_registered' ? 'warning.main' :
                                       registrationStatus === 'registered' ? 'success.main' :
                                       'divider',
                          borderRadius: 1,
                          bgcolor: registrationStatus === 'registration_failed' ? 'rgba(211, 47, 47, 0.1)' : 
                                   registrationStatus === 'already_registered' ? 'rgba(237, 108, 2, 0.1)' : 
                                   registrationStatus === 'registered' ? 'rgba(46, 125, 50, 0.1)' :
                                   'background.paper'
                        }}>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={4}>
                              <Typography variant="body1" fontWeight="medium">
                                {setting.policyTableName}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={5}>
                              {registrationStatus === 'registration_failed' ? (
                                <Alert severity="error" sx={{ py: 0 }}>
                                  <Typography variant="body2">
                                    등록 실패: {registrationError}
                                  </Typography>
                                </Alert>
                              ) : registrationStatus === 'already_registered' ? (
                                <Alert severity="warning" sx={{ py: 0 }}>
                                  <Typography variant="body2">
                                    {registrationMessage || '이미 등록 완료'}
                                  </Typography>
                                </Alert>
                              ) : registrationStatus === 'registered' ? (
                                <Alert severity="success" sx={{ py: 0 }}>
                                  <Typography variant="body2">
                                    {registrationMessage || '등록 완료'}
                                  </Typography>
                                </Alert>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  등록 대기 중
                                </Typography>
                              )}
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              {registrationStatus === 'registration_failed' && (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={<RefreshIcon />}
                                    onClick={() => handleRetryGeneration(setting.id)}
                                    disabled={
                                      !batchCreationFormData.applyDate ||
                                      !batchCreationFormData.applyContent ||
                                      batchGenerationStatus[setting.id]?.status === 'processing' ||
                                      batchGenerationStatus[setting.id]?.status === 'queued'
                                    }
                                    sx={{ flex: 1 }}
                                  >
                                    재생성
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={<CheckCircleIcon />}
                                    onClick={async () => {
                                      const status = batchGenerationStatus[setting.id];
                                      if (!status?.result?.id) return;
                                      
                                      try {
                                        setLoading(true);
                                        const response = await fetch(`${API_BASE_URL}/api/policy-tables/${status.result.id}/register`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'x-user-role': loggedInStore?.userRole || '',
                                            'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
                                          }
                                        });
                                        
                                        if (response.ok) {
                                          const data = await response.json();
                                          
                                          // 상태 업데이트 및 모든 정책표 등록 완료 확인
                                          setBatchGenerationStatus(prev => {
                                            const updated = {
                                              ...prev,
                                              [setting.id]: {
                                                ...prev[setting.id],
                                                registrationStatus: data.alreadyRegistered ? 'already_registered' : 'registered',
                                                registrationMessage: data.alreadyRegistered ? '이미 등록 완료' : '등록 완료'
                                              }
                                            };
                                            
                                            // 업데이트된 상태에서 모든 정책표 등록 완료 확인
                                            const completedSettings = settings.filter(s => 
                                              selectedSettings.includes(s.id) &&
                                              updated[s.id]?.status === 'completed' &&
                                              updated[s.id]?.result
                                            );
                                            
                                            const allRegistered = completedSettings.length > 0 && completedSettings.every(s => {
                                              const status = updated[s.id];
                                              return status?.registrationStatus === 'registered' || 
                                                     status?.registrationStatus === 'already_registered';
                                            });
                                            
                                            if (allRegistered) {
                                              // 모든 정책표가 등록 완료되었으므로 모달 닫기
                                              setTimeout(() => {
                                                setSnackbar({ 
                                                  open: true, 
                                                  message: `모든 정책표(${completedSettings.length}개) 등록이 완료되었습니다.`, 
                                                  severity: 'success' 
                                                });
                                                loadSettings().then(() => {
                                                  handleCloseBatchCreationModal();
                                                });
                                              }, 0);
                                            } else {
                                              setSnackbar({ 
                                                open: true, 
                                                message: `${setting.policyTableName} 등록 완료`, 
                                                severity: 'success' 
                                              });
                                              loadSettings();
                                            }
                                            
                                            return updated;
                                          });
                                        } else {
                                          const errorData = await response.json();
                                          setBatchGenerationStatus(prev => ({
                                            ...prev,
                                            [setting.id]: {
                                              ...prev[setting.id],
                                              registrationStatus: 'registration_failed',
                                              registrationError: errorData.error || '등록 실패'
                                            }
                                          }));
                                          setSnackbar({ 
                                            open: true, 
                                            message: `${setting.policyTableName} 등록 실패: ${errorData.error || '등록 실패'}`, 
                                            severity: 'error' 
                                          });
                                        }
                                      } catch (error) {
                                        console.error('개별 정책표 등록 오류:', error);
                                        setBatchGenerationStatus(prev => ({
                                          ...prev,
                                          [setting.id]: {
                                            ...prev[setting.id],
                                            registrationStatus: 'registration_failed',
                                            registrationError: '등록 중 오류 발생'
                                          }
                                        }));
                                        setSnackbar({ 
                                          open: true, 
                                          message: `${setting.policyTableName} 등록 중 오류가 발생했습니다.`, 
                                          severity: 'error' 
                                        });
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    disabled={loading}
                                    sx={{ flex: 1 }}
                                  >
                                    등록
                                  </Button>
                                </Box>
                              )}
                              {!registrationStatus && status?.status === 'completed' && status?.result && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  startIcon={<CheckCircleIcon />}
                                  onClick={async () => {
                                    const status = batchGenerationStatus[setting.id];
                                    if (!status?.result?.id) return;
                                    
                                    try {
                                      setLoading(true);
                                      const response = await fetch(`${API_BASE_URL}/api/policy-tables/${status.result.id}/register`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'x-user-role': loggedInStore?.userRole || '',
                                          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
                                        }
                                      });
                                      
                                      if (response.ok) {
                                        const data = await response.json();
                                        
                                        // 상태 업데이트 및 모든 정책표 등록 완료 확인
                                        setBatchGenerationStatus(prev => {
                                          const updated = {
                                            ...prev,
                                            [setting.id]: {
                                              ...prev[setting.id],
                                              registrationStatus: data.alreadyRegistered ? 'already_registered' : 'registered',
                                              registrationMessage: data.alreadyRegistered ? '이미 등록 완료' : '등록 완료'
                                            }
                                          };
                                          
                                          // 업데이트된 상태에서 모든 정책표 등록 완료 확인
                                          const completedSettings = settings.filter(s => 
                                            selectedSettings.includes(s.id) &&
                                            updated[s.id]?.status === 'completed' &&
                                            updated[s.id]?.result
                                          );
                                          
                                          const allRegistered = completedSettings.length > 0 && completedSettings.every(s => {
                                            const status = updated[s.id];
                                            return status?.registrationStatus === 'registered' || 
                                                   status?.registrationStatus === 'already_registered';
                                          });
                                          
                                          if (allRegistered) {
                                            // 모든 정책표가 등록 완료되었으므로 모달 닫기
                                            setTimeout(() => {
                                              setSnackbar({ 
                                                open: true, 
                                                message: `모든 정책표(${completedSettings.length}개) 등록이 완료되었습니다.`, 
                                                severity: 'success' 
                                              });
                                              loadSettings().then(() => {
                                                handleCloseBatchCreationModal();
                                              });
                                            }, 0);
                                          } else {
                                            setSnackbar({ 
                                              open: true, 
                                              message: `${setting.policyTableName} 등록 완료`, 
                                              severity: 'success' 
                                            });
                                            loadSettings();
                                          }
                                          
                                          return updated;
                                        });
                                      } else {
                                        const errorData = await response.json();
                                        setBatchGenerationStatus(prev => ({
                                          ...prev,
                                          [setting.id]: {
                                            ...prev[setting.id],
                                            registrationStatus: 'registration_failed',
                                            registrationError: errorData.error || '등록 실패'
                                          }
                                        }));
                                        setSnackbar({ 
                                          open: true, 
                                          message: `${setting.policyTableName} 등록 실패: ${errorData.error || '등록 실패'}`, 
                                          severity: 'error' 
                                        });
                                      }
                                    } catch (error) {
                                      console.error('개별 정책표 등록 오류:', error);
                                      setBatchGenerationStatus(prev => ({
                                        ...prev,
                                        [setting.id]: {
                                          ...prev[setting.id],
                                          registrationStatus: 'registration_failed',
                                          registrationError: '등록 중 오류 발생'
                                        }
                                      }));
                                      setSnackbar({ 
                                        open: true, 
                                        message: `${setting.policyTableName} 등록 중 오류가 발생했습니다.`, 
                                        severity: 'error' 
                                      });
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                  disabled={loading}
                                  fullWidth
                                >
                                  등록
                                </Button>
                              )}
                            </Grid>
                          </Grid>
                        </Box>
                      </Grid>
                    );
                  })}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBatchCreationModal}>취소</Button>
          {/* 완료된 정책표가 있을 때만 정책표등록 버튼 표시 */}
          {Object.values(batchGenerationStatus).some(status => 
            status.status === 'completed' && status.result &&
            (!status.registrationStatus || status.registrationStatus === 'registration_failed')
          ) && (
            <Button
              onClick={handleBatchRegister}
              variant="contained"
              color="success"
              disabled={loading}
              startIcon={<CheckCircleIcon />}
            >
              정책표등록
            </Button>
          )}
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

      {/* 변경이력 Popover */}
      <Popover
        open={Boolean(popoverAnchor)}
        anchorEl={popoverAnchor}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {popoverContent && (
          <Box sx={{ p: 2, minWidth: 300, maxWidth: 400 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              {popoverContent.itemType === '그룹이름' ? '그룹이름' : '업체명'}: {popoverContent.itemName}
            </Typography>
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {popoverContent.history.map((item, index) => {
                // 해당 itemName과 관련된 정보만 필터링
                let filteredBeforeValue = item.beforeValue;
                let filteredAfterValue = item.afterValue;
                
                if (popoverContent.itemType === '업체명') {
                  const beforeValue = Array.isArray(item.beforeValue) ? item.beforeValue : (item.beforeValue ? [item.beforeValue] : []);
                  const afterValue = Array.isArray(item.afterValue) ? item.afterValue : (item.afterValue ? [item.afterValue] : []);
                  
                  // 해당 itemName만 필터링
                  filteredBeforeValue = beforeValue.filter(name => name === popoverContent.itemName);
                  filteredAfterValue = afterValue.filter(name => name === popoverContent.itemName);
                  
                  // 단일 값으로 변환 (배열이 1개 요소만 있으면 단일 값으로)
                  if (filteredBeforeValue.length === 1) {
                    filteredBeforeValue = filteredBeforeValue[0];
                  } else if (filteredBeforeValue.length === 0) {
                    filteredBeforeValue = null;
                  }
                  
                  if (filteredAfterValue.length === 1) {
                    filteredAfterValue = filteredAfterValue[0];
                  } else if (filteredAfterValue.length === 0) {
                    filteredAfterValue = null;
                  }
                }
                
                return (
                  <Box key={index} sx={{ mb: 1.5, pb: 1.5, borderBottom: index < popoverContent.history.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Typography variant="caption" sx={{ 
                        color: item.phoneApplied === 'Y' ? 'purple' :
                               item.changeAction === '추가' ? 'primary.main' :
                               item.changeAction === '수정' ? 'success.main' :
                               'error.main',
                        fontWeight: 'bold'
                      }}>
                        {item.phoneApplied === 'Y' ? '폰클 적용 완료' : item.changeAction}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(item.changedAt).toLocaleString('ko-KR')}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      변경자: {item.changedByName || item.changedBy}
                    </Typography>
                    {popoverContent.itemType === '업체명' && (
                      <>
                        {item.changeAction === '삭제' && filteredBeforeValue && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            변경전: {Array.isArray(filteredBeforeValue) ? filteredBeforeValue.join(', ') : filteredBeforeValue}
                          </Typography>
                        )}
                        {item.changeAction === '추가' && filteredAfterValue && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            변경후: {Array.isArray(filteredAfterValue) ? filteredAfterValue.join(', ') : filteredAfterValue}
                          </Typography>
                        )}
                        {item.changeAction === '수정' && (
                          <>
                            {filteredBeforeValue && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                변경전: {Array.isArray(filteredBeforeValue) ? filteredBeforeValue.join(', ') : filteredBeforeValue}
                              </Typography>
                            )}
                            {filteredAfterValue && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                변경후: {Array.isArray(filteredAfterValue) ? filteredAfterValue.join(', ') : filteredAfterValue}
                              </Typography>
                            )}
                          </>
                        )}
                      </>
                    )}
                  {(() => {
                    // 업체명인 경우, 해당 업체명이 폰클 적용되었는지 확인
                    const isCompanyName = popoverContent.itemType === '업체명';
                    let isApplied = false;
                    
                    if (isCompanyName) {
                      const phoneAppliedCompanies = item.phoneAppliedCompanies || [];
                      isApplied = phoneAppliedCompanies.includes(popoverContent.itemName);
                    } else {
                      isApplied = item.phoneApplied === 'Y';
                    }
                    
                    return isApplied && (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="purple" sx={{ display: 'block', fontWeight: 'bold' }}>
                          폰클 적용일시: {new Date(item.phoneAppliedAt).toLocaleString('ko-KR')}
                        </Typography>
                        <Typography variant="caption" color="purple" sx={{ display: 'block' }}>
                          적용한 사용자: {item.phoneAppliedBy}
                        </Typography>
                      </Box>
                    );
                  })()}
                  {item.changeAction === '수정' && popoverContent.itemType === '그룹이름' && (
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        변경 전: {item.beforeValue}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        변경 후: {item.afterValue}
                      </Typography>
                    </Box>
                  )}
                  {(() => {
                    // 업체명인 경우, 해당 업체명이 이미 폰클 적용되었는지 확인
                    const isCompanyName = popoverContent.itemType === '업체명';
                    let isAlreadyApplied = false;
                    
                    if (isCompanyName) {
                      const phoneAppliedCompanies = item.phoneAppliedCompanies || [];
                      isAlreadyApplied = phoneAppliedCompanies.includes(popoverContent.itemName);
                    } else {
                      // 그룹이름인 경우 기존 로직
                      isAlreadyApplied = item.phoneApplied === 'Y';
                    }
                    
                    return !isAlreadyApplied && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PhoneAndroidIcon />}
                        onClick={() => {
                          const companyName = isCompanyName ? popoverContent.itemName : null;
                          handleApplyPhone(popoverContent.groupId, item.changeId, companyName);
                          handleClosePopover();
                        }}
                        sx={{ mt: 1, color: 'purple', borderColor: 'purple' }}
                      >
                        폰클에 적용완료
                      </Button>
                    );
                  })()}
                </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Popover>

      {/* 기본 그룹 설정 모달 */}
      <Dialog open={defaultGroupModalOpen} onClose={() => setDefaultGroupModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          기본 정책영업그룹 설정
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                선택한 그룹이 이 정책표 생성 시 자동으로 선택됩니다.
              </Typography>
              <Autocomplete
                multiple
                options={userGroups || []}
                getOptionLabel={(option) => option?.groupName || ''}
                value={userGroups.filter(g => defaultGroupFormData.defaultGroupIds.includes(g.id)) || []}
                onChange={(event, newValue) => {
                  setDefaultGroupFormData({
                    ...defaultGroupFormData,
                    defaultGroupIds: newValue.map(g => g.id)
                  });
                }}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                noOptionsText="등록된 그룹이 없습니다."
                filterSelectedOptions
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="기본 정책영업그룹"
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDefaultGroupModalOpen(false)}>취소</Button>
          <Button
            onClick={async () => {
              try {
                setLoading(true);
                const userId = loggedInStore?.contactId || loggedInStore?.id;
                if (!userId) {
                  setError('사용자 정보를 찾을 수 없습니다.');
                  return;
                }

                const response = await fetch(`${API_BASE_URL}/api/policy-table/default-groups/${userId}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': loggedInStore?.userRole || '',
                    'x-user-id': userId
                  },
                  body: JSON.stringify({
                    policyTableId: defaultGroupFormData.policyTableId,
                    defaultGroupIds: defaultGroupFormData.defaultGroupIds
                  })
                });

                if (response.ok) {
                  await loadDefaultGroups();
                  setDefaultGroupModalOpen(false);
                  setSnackbar({
                    open: true,
                    message: '기본 그룹 설정이 저장되었습니다.',
                    severity: 'success'
                  });
                } else {
                  // 응답이 JSON인지 확인
                  const contentType = response.headers.get('content-type');
                  let errorMessage = '기본 그룹 설정 저장에 실패했습니다.';
                  
                  if (contentType && contentType.includes('application/json')) {
                    try {
                      const errorData = await response.json();
                      errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                      console.error('JSON 파싱 오류:', e);
                    }
                  } else {
                    // HTML 응답인 경우
                    const text = await response.text();
                    console.error('서버 응답 (HTML):', text.substring(0, 200));
                    errorMessage = `서버 오류 (${response.status}): ${response.statusText}`;
                  }
                  
                  setError(errorMessage);
                }
              } catch (error) {
                console.error('기본 그룹 설정 저장 오류:', error);
                setError('기본 그룹 설정 저장 중 오류가 발생했습니다.');
              } finally {
                setLoading(false);
              }
            }}
            variant="contained"
            disabled={loading}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PolicyTableCreationTab;

