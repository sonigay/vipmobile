import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../api';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Checkbox,
  Alert,
  Backdrop,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField
} from '@mui/material';
import {
  Policy as PolicyIcon,
  SwapHoriz as SwapHorizIcon,
  Update as UpdateIcon,
  Add as AddIcon,
  Notifications as NotificationsIcon,
  ArrowBack as ArrowBackIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  CancelOutlined as CancelOutlinedIcon,
  AccountBalance as AccountBalanceIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';

import AppUpdatePopup from './AppUpdatePopup';
import PolicyInputModal from './PolicyInputModal';
import PolicyApprovalModal from './PolicyApprovalModal';
import PolicyCancelModal from './PolicyCancelModal';
import SettlementReflectModal from './SettlementReflectModal';
import PolicyCopyModal from './PolicyCopyModal';
import PolicyService from '../utils/policyService';
import PolicyTableListTab from './policy/PolicyTableListTab';
import PolicyTableCreationTab from './policy/PolicyTableCreationTab';
import PolicyTableSettingsTab from './policy/PolicyTableSettingsTab';

// 기본 정책 카테고리 데이터 (폴백용)
const DEFAULT_POLICY_CATEGORIES = {
  wireless: [
    { id: 'wireless_shoe', name: '구두정책', icon: '👞' },
    { id: 'wireless_union', name: '연합정책', icon: '🤝' },
    { id: 'wireless_rate', name: '요금제유형별정책', icon: '💰' },
    { id: 'wireless_add_support', name: '부가추가지원정책', icon: '➕' },
    { id: 'wireless_add_deduct', name: '부가차감지원정책', icon: '➖' },
    { id: 'wireless_grade', name: '그레이드정책', icon: '⭐' },
    { id: 'wireless_individual', name: '개별소급정책', icon: '📋' }
  ],
  wired: [
    { id: 'wired_shoe', name: '구두정책', icon: '👞' },
    { id: 'wired_union', name: '연합정책', icon: '🤝' },
    { id: 'wired_rate', name: '요금제유형별정책', icon: '💰' },
    { id: 'wired_add_support', name: '부가추가지원정책', icon: '➕' },
    { id: 'wired_add_deduct', name: '부가차감지원정책', icon: '➖' },
    { id: 'wired_grade', name: '그레이드정책', icon: '⭐' },
    { id: 'wired_individual', name: '개별소급정책', icon: '📋' }
  ]
};

// 대상년월 옵션 (최근 12개월)
const getYearMonthOptions = () => {
  const options = [];
  const currentDate = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const label = `${year}-${month}`;
    const value = `${year}-${month}`;
    options.push({ label, value });
  }
  
  return options;
};

function PolicyMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  // 업데이트 팝업 상태
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 정책 타입 (무선/유선)
  const [policyType, setPolicyType] = useState('wireless');
  
  // 대상년월
  const [selectedYearMonth, setSelectedYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // 정책 데이터
  const [policyData, setPolicyData] = useState({});
  const [stores, setStores] = useState([]);
  const [teams, setTeams] = useState([]); // 소속정책팀 목록 추가
  const [loading, setLoading] = useState(false);
  
  // 담당자 관리
  const [managers, setManagers] = useState([]); // 담당자 목록
  const [selectedManager, setSelectedManager] = useState('전체'); // 선택된 담당자 (기본값: 전체)
  const [managerPolicyCounts, setManagerPolicyCounts] = useState({}); // 담당자별 정책 개수
  
  // 필터링 상태 추가
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  
  // 카테고리 데이터
  const [categories, setCategories] = useState(DEFAULT_POLICY_CATEGORIES);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  
  // 정책 입력 모달 상태
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // 화면 상태 관리
  const [currentView, setCurrentView] = useState('categories'); // 'categories' 또는 'policies'
  const [selectedCategoryForList, setSelectedCategoryForList] = useState(null);
  const [policies, setPolicies] = useState([]); // 전체 정책 목록
  
  // 승인 모달 상태
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedPolicyForApproval, setSelectedPolicyForApproval] = useState(null);
  const [approvalProcessing, setApprovalProcessing] = useState(false);
  
  // 취소 모달 상태
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPolicyForCancel, setSelectedPolicyForCancel] = useState(null);
  const [cancelType, setCancelType] = useState('policy'); // 'policy' 또는 'approval'
  
  // 정산 반영 모달 상태
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedPolicyForSettlement, setSelectedPolicyForSettlement] = useState(null);
  
  // 정책 수정 모달 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPolicyForEdit, setSelectedPolicyForEdit] = useState(null);
  
  // 정책 복사 모달 상태
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedPolicyForCopy, setSelectedPolicyForCopy] = useState(null);
  
  // 일괄 처리 관련 상태
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [showBulkCopyModal, setShowBulkCopyModal] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProcessingMessage, setBulkProcessingMessage] = useState('');

  // 공지사항 관련 상태
  const [notices, setNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [editingNotice, setEditingNotice] = useState(null);
  
  // 정책모드 진입 시 업데이트 팝업 표시 (숨김 설정 확인 후)
  useEffect(() => {
    // 오늘 하루 보지 않기 설정 확인
    const hideUntil = localStorage.getItem('hideUpdate_policy');
    const shouldShowPopup = !(hideUntil && new Date() < new Date(hideUntil));
    
    if (shouldShowPopup) {
      // 숨김 설정이 없거나 만료된 경우에만 팝업 표시
      setShowUpdatePopup(true);
    }
    
    // 매장 데이터 로드
    loadStores();
    
    // 팀 데이터 로드
    loadTeams();
    
    // 담당자 데이터 로드
    loadManagers();
    
    // 카테고리 데이터 로드
    loadCategories();
    
    // 정책 데이터 로드
    loadPolicyData();
  }, [policyType, selectedYearMonth, selectedManager]);

  // 공지사항 조회 (카테고리 선택 시)
  useEffect(() => {
    if (selectedCategoryForList && selectedYearMonth) {
      loadNotices();
    } else {
      setNotices([]);
    }
  }, [selectedCategoryForList, selectedYearMonth]);

  const loadStores = async () => {
    try {
      // 매장 데이터 로드 (기존 API 사용)
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/stores`);
      if (response.ok) {
        const storesData = await response.json();
        setStores(storesData);
      }
    } catch (error) {
      console.error('매장 데이터 로드 실패:', error);
    }
  };

  const loadTeams = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams`);
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error('팀 목록 로드 실패:', error);
    }
  };

  const loadManagers = async () => {
    try {
      // 재고나 개통실적이 있는 모든 담당자 (개통실적 없어도 OK)
      const response = await fetch(`${API_BASE_URL}/api/inventory/agent-filters`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // 제외할 담당자 목록
          const excludedNames = ['VIP직영', '인천사무실', '안산사무실', '평택사무실'];
          
          // 담당자 이름에서 괄호 제거하고 그룹핑
          const allNames = data.data.map(agent => agent.target).filter(Boolean);
          const uniqueNames = [...new Set(allNames.map(name => {
            // 괄호 제거 (예: "홍기현(직영)" → "홍기현")
            return name.replace(/\([^)]*\)/g, '').trim();
          }))]
          .filter(name => name && !excludedNames.includes(name)) // 제외 목록 필터링
          .sort();
          
          setManagers(uniqueNames);
          console.log('담당자 목록 로드 완료:', uniqueNames.length + '명');
        }
      }
    } catch (error) {
      console.error('담당자 목록 로드 실패:', error);
    }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const categoriesData = await PolicyService.getCategories();
      
      // 정책 타입별로 카테고리 그룹화
      const groupedCategories = {
        wireless: categoriesData.filter(cat => cat.policyType === 'wireless' && cat.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
        wired: categoriesData.filter(cat => cat.policyType === 'wired' && cat.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
      };
      
      setCategories(groupedCategories);
    } catch (error) {
      console.error('카테고리 데이터 로드 실패:', error);
      // 실패 시 기본 카테고리 사용
      setCategories(DEFAULT_POLICY_CATEGORIES);
    } finally {
      setCategoriesLoading(false);
    }
  };

  // 공지사항 조회 함수
  const loadNotices = async () => {
    if (!selectedCategoryForList || !selectedYearMonth) {
      console.log('📢 [공지사항] 조회 조건 불충족:', { selectedCategoryForList, selectedYearMonth });
      setNotices([]);
      return;
    }
    
    setNoticesLoading(true);
    try {
      const url = `${API_BASE_URL}/api/policy-notices?yearMonth=${selectedYearMonth}&category=${selectedCategoryForList}`;
      console.log('📢 [공지사항] 조회 요청:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('📢 [공지사항] HTTP 오류:', response.status, response.statusText);
        setNotices([]);
        return;
      }
      
      const data = await response.json();
      console.log('📢 [공지사항] 조회 응답:', data);
      
      if (data.success) {
        console.log('📢 [공지사항] 조회 성공, 공지사항 수:', data.notices?.length || 0);
        setNotices(data.notices || []);
      } else {
        console.error('📢 [공지사항] 조회 실패:', data.error);
        setNotices([]);
      }
    } catch (error) {
      console.error('📢 [공지사항] 조회 예외:', error);
      setNotices([]);
    } finally {
      setNoticesLoading(false);
    }
  };

  // 공지사항 작성/수정 핸들러
  const handleNoticeSave = async (noticeData) => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app';
      const url = editingNotice 
        ? `${API_BASE_URL}/api/policy-notices/${editingNotice.id}`
        : `${API_BASE_URL}/api/policy-notices`;
      const method = editingNotice ? 'PUT' : 'POST';
      
      // 카테고리 처리: noticeData에 category가 있으면 사용, 없으면 selectedCategoryForList 사용
      // "전체"를 선택한 경우 빈 문자열로 저장 (모든 카테고리에 표시)
      const categoryValue = noticeData.category === '전체' ? '' : (noticeData.category || selectedCategoryForList);
      
      console.log('📢 [공지사항] 저장 요청:', {
        yearMonth: selectedYearMonth,
        category: categoryValue,
        title: noticeData.title,
        editing: !!editingNotice
      });
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...noticeData,
          yearMonth: selectedYearMonth,
          category: categoryValue,
          author: loggedInStore?.target || loggedInStore?.name || '알 수 없음'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadNotices();
        setShowNoticeModal(false);
        setEditingNotice(null);
        setSelectedNotice(null);
      } else {
        alert('공지사항 저장에 실패했습니다: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('공지사항 저장 실패:', error);
      alert('공지사항 저장에 실패했습니다.');
    }
  };

  // 공지사항 삭제 핸들러
  const handleNoticeDelete = async (noticeId) => {
    if (!window.confirm('공지사항을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app';
      const response = await fetch(`${API_BASE_URL}/api/policy-notices/${noticeId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadNotices();
      } else {
        alert('공지사항 삭제에 실패했습니다: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('공지사항 삭제 실패:', error);
      alert('공지사항 삭제에 실패했습니다.');
    }
  };

  const loadPolicyData = async () => {
    setLoading(true);
    try {
      const policyTypeLabel = policyType === 'wireless' ? '무선' : '유선';
      const policies = await PolicyService.getPolicies({
        yearMonth: selectedYearMonth,
        policyType: policyTypeLabel
      });
      
      // 디버깅: 원본 API 응답 확인 (wireless_rate 카테고리만)
      const ratePoliciesRaw = policies.filter(p => p.category === 'wireless_rate' || p.category === 'wired_rate');
      if (ratePoliciesRaw.length > 0) {
        console.log('🔍 [정책 로드] 원본 API 응답 샘플 (요금제유형별정책):', 
          ratePoliciesRaw.slice(0, 2).map(p => ({
            id: p.id,
            policyName: p.policyName,
            category: p.category,
            isDirectInput: p.isDirectInput,
            isDirectInputType: typeof p.isDirectInput,
            rateSupports: p.rateSupports,
            rateSupportsType: typeof p.rateSupports,
            rateSupportsIsArray: Array.isArray(p.rateSupports),
            rateSupportsLength: Array.isArray(p.rateSupports) ? p.rateSupports.length : 'N/A',
            hasPolicyContent: !!(p.policyContent && p.policyContent.trim()),
            allKeys: Object.keys(p).filter(k => k.includes('Direct') || k.includes('rate') || k.includes('Support'))
          }))
        );
      }
      
      // 정책 조회 권한 제한 적용
      const userRole = loggedInStore?.userRole;
      const currentUserId = loggedInStore?.contactId || loggedInStore?.id;
      
      const filteredPolicies = policies.filter(policy => {
        // 소속정책팀 이상: 모든 정책 조회 가능
        if (['SS', 'S', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
          return true;
        }
        // 일반등록자: 본인 정책만 조회 가능
        return policy.inputUserId === currentUserId;
      });
      
      // 서버에서 이미 teamName을 제공하므로 추가 변환 불필요
      const policiesWithTeamNames = filteredPolicies;
      
      // 담당자별 정책 개수 계산 (전체 정책 기준)
      const managerCounts = { '전체': policiesWithTeamNames.length };
      policiesWithTeamNames.forEach(policy => {
        const manager = policy.manager || '미지정';
        managerCounts[manager] = (managerCounts[manager] || 0) + 1;
      });
      setManagerPolicyCounts(managerCounts);
      
      // 담당자 필터링 적용
      const managerFilteredPolicies = selectedManager === '전체'
        ? policiesWithTeamNames
        : policiesWithTeamNames.filter(policy => policy.manager === selectedManager);
      
      // 정책 데이터 파싱 및 정규화 (JSON 문자열 필드 파싱)
      const normalizedPolicies = managerFilteredPolicies.map(policy => {
        const normalized = { ...policy };
        
        // rateSupports 파싱 (JSON 문자열일 수 있음)
        if (normalized.rateSupports && typeof normalized.rateSupports === 'string') {
          try {
            normalized.rateSupports = JSON.parse(normalized.rateSupports);
          } catch (e) {
            console.warn('rateSupports 파싱 실패:', e, normalized.rateSupports);
            normalized.rateSupports = [];
          }
        }
        
        // unionTargetStores 파싱
        if (normalized.unionTargetStores && typeof normalized.unionTargetStores === 'string') {
          try {
            normalized.unionTargetStores = JSON.parse(normalized.unionTargetStores);
          } catch (e) {
            normalized.unionTargetStores = [];
          }
        }
        
        // 객체 필드들 파싱
        const objectFields = ['deductSupport', 'addSupport', 'conditionalOptions', 'supportConditionalOptions', 'unionConditions', 'individualTarget', 'activationType'];
        objectFields.forEach(field => {
          if (normalized[field] && typeof normalized[field] === 'string') {
            try {
              normalized[field] = JSON.parse(normalized[field]);
            } catch (e) {
              console.warn(`${field} 파싱 실패:`, e);
            }
          }
        });
        
        // isDirectInput이 undefined/null인 경우 판단 로직 적용
        if (normalized.isDirectInput === undefined || normalized.isDirectInput === null) {
          const originalValue = normalized.isDirectInput;
          // wireless_rate/wired_rate 카테고리에서 rateSupports가 없고 policyContent가 있으면 직접입력으로 판단
          if ((normalized.category === 'wireless_rate' || normalized.category === 'wired_rate')) {
            const hasRateSupports = normalized.rateSupports && 
              Array.isArray(normalized.rateSupports) && 
              normalized.rateSupports.length > 0;
            const hasPolicyContent = normalized.policyContent && normalized.policyContent.trim();
            normalized.isDirectInput = !hasRateSupports && hasPolicyContent;
            
            // 디버깅: 정규화 단계에서 isDirectInput 판단
            if (normalized.policyName === '동서울집단' || normalized.policyName === 'A2633-128 특별정책') {
              console.log(`🔄 [정규화] isDirectInput 판단:`, {
                policyName: normalized.policyName,
                category: normalized.category,
                originalValue,
                hasRateSupports,
                hasPolicyContent,
                result: normalized.isDirectInput,
                reason: normalized.isDirectInput ? 'rateSupports 없음 && policyContent 있음' : '기타'
              });
            }
          } else {
            normalized.isDirectInput = false;
          }
        }
        
        return normalized;
      });
      
      // 전체 정책 목록 저장 (정규화된 정책들)
      setPolicies(normalizedPolicies);
      
      // 디버깅: 정책 데이터 샘플 확인 (wireless_rate 카테고리만)
      const ratePolicies = normalizedPolicies.filter(p => p.category === 'wireless_rate' || p.category === 'wired_rate');
      if (ratePolicies.length > 0) {
        console.log('📊 요금제유형별정책 데이터 샘플:', 
          ratePolicies.slice(0, 3).map(p => ({
            id: p.id,
            name: p.policyName,
            category: p.category,
            isDirectInput: p.isDirectInput,
            rateSupportsLength: Array.isArray(p.rateSupports) ? p.rateSupports.length : 'N/A',
            hasPolicyContent: !!(p.policyContent && p.policyContent.trim())
          }))
        );
      }
      
      // 새로 저장된 정책 찾기
      const newPolicy = managerFilteredPolicies.find(p => p.id === 'POL_1760243517056_ushvjqq8t');
      if (newPolicy) {
        console.log('🎯 새로 저장된 정책 발견:', {
          id: newPolicy.id,
          multipleStoreName: newPolicy.multipleStoreName,
          isMultiple: newPolicy.isMultiple,
          manager: newPolicy.manager
        });
      } else {
        console.log('❌ 새로 저장된 정책이 필터링된 목록에 없습니다.');
        console.log('전체 정책 수:', policiesWithTeamNames.length);
        console.log('선택된 담당자:', selectedManager);
        console.log('필터링 후 정책 수:', managerFilteredPolicies.length);
      }
      
      // 카테고리별 개수 계산 (담당자 필터링된 정책들 기준)
      const counts = {};
      managerFilteredPolicies.forEach(policy => {
        const category = policy.category;
        counts[category] = (counts[category] || 0) + 1;
      });
      
      setPolicyData(counts);
    } catch (error) {
      console.error('정책 데이터 로드 실패:', error);
      setPolicyData({});
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToMain = () => {
    // 메인 화면으로 돌아가기 (모드 선택 팝업 표시)
    window.location.reload();
  };

  const handleAddPolicy = (categoryId) => {
    setSelectedCategory(categoryId);
    setShowPolicyModal(true);
  };

  const handleCategoryClick = (categoryId) => {
    // 해당 카테고리의 정책 목록 화면으로 이동
    setSelectedCategoryForList(categoryId);
    setCurrentView('policies');
  };

  const handleBackToCategories = () => {
    setCurrentView('categories');
    setSelectedCategoryForList(null);
  };

  const handleApprovalClick = (policy) => {
    setSelectedPolicyForApproval(policy);
    setShowApprovalModal(true);
  };

  const handleApprovalSubmit = async (approvalData) => {
    // 중복 처리 방지
    if (approvalProcessing) {
      return;
    }
    
    setApprovalProcessing(true);
    
    try {
      const { policyId, approvalData: approval, userRole } = approvalData;
      
             // 사용자 권한에 따른 승인 유형 결정
       let approvalType = '';
       if (userRole === 'SS' || userRole === '이사') {
         // 총괄/이사: 총괄, 정산팀, 소속팀 승인 모두 가능
         if (approval.total === '승인') approvalType = 'total';
         else if (approval.settlement === '승인') approvalType = 'settlement';
         else if (approval.team === '승인') approvalType = 'team';
       } else if (userRole === 'S') {
         // 정산팀: 총괄, 정산팀 승인 가능
         if (approval.total === '승인') approvalType = 'total';
         else if (approval.settlement === '승인') approvalType = 'settlement';
       } else if (['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
         // 소속정책팀: 소속팀 승인만 가능
         if (approval.team === '승인') approvalType = 'team';
       }
      
      if (!approvalType) {
        alert('승인 상태를 선택해주세요.');
        return;
      }
      
             // 승인 API 호출
       await PolicyService.approvePolicy(policyId, {
         approvalType,
         comment: approval.comment,
         userId: loggedInStore?.contactId || loggedInStore?.id,
         userName: loggedInStore?.target || loggedInStore?.name
       });
      
      alert('승인이 완료되었습니다.');
      setShowApprovalModal(false);
      setSelectedPolicyForApproval(null);
      // 정책 데이터 다시 로드
      await loadPolicyData();
    } catch (error) {
      console.error('승인 실패:', error);
      alert('승인에 실패했습니다: ' + error.message);
    } finally {
      setApprovalProcessing(false);
    }
  };

  const handleCancelClick = (policy, type) => {
    setSelectedPolicyForCancel(policy);
    setCancelType(type);
    setShowCancelModal(true);
  };

  // 정책 삭제 함수
  const handleDeleteClick = async (policy) => {
    if (!window.confirm(`정책 "${policy.policyName}"을(를) 삭제하시겠습니까?\n삭제된 정책은 복구할 수 없습니다.`)) {
      return;
    }

    try {
      console.log('정책 삭제 시도:', policy.id);
      
      // API 기본 URL 설정
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app';
      
      // 먼저 테스트 API로 DELETE 메서드가 작동하는지 확인
      console.log('DELETE 테스트 API 호출 시도...');
      const testResponse = await fetch(`${API_BASE_URL}/api/test-delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (testResponse.ok) {
        console.log('DELETE 테스트 API 성공:', await testResponse.json());
      } else {
        console.log('DELETE 테스트 API 실패:', testResponse.status, testResponse.statusText);
      }
      
      // 실제 정책 삭제 API 호출
      console.log('실제 정책 삭제 API 호출:', `${API_BASE_URL}/api/policies/${policy.id}`);
      const response = await fetch(`${API_BASE_URL}/api/policies/${policy.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('정책 삭제 응답 상태:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('정책 삭제 성공 응답:', result);
        alert('정책이 삭제되었습니다.');
        loadPolicyData(); // 정책 목록 새로고침
      } else {
        console.error('삭제 실패 응답:', response.status, response.statusText);
        
        // 응답이 JSON인지 확인
        let errorMessage = '알 수 없는 오류가 발생했습니다.';
        try {
          const errorData = await response.json();
          console.log('삭제 실패 상세:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('응답 파싱 실패:', parseError);
          errorMessage = `서버 오류 (${response.status}): ${response.statusText}`;
        }
        
        alert(`삭제 실패: ${errorMessage}`);
      }
    } catch (error) {
      console.error('정책 삭제 실패:', error);
      alert(`정책 삭제 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  const handleCancelSubmit = async (cancelData) => {
    try {
      if (cancelData.cancelType === 'policy') {
        // 정책 취소
        await PolicyService.cancelPolicy(cancelData.policyId, {
          cancelReason: cancelData.cancelReason,
          userId: loggedInStore?.contactId || loggedInStore?.id,
          userName: loggedInStore?.target || loggedInStore?.name
        });
        alert('정책이 성공적으로 취소되었습니다.');
      } else {
        // 승인 취소
        await PolicyService.cancelApproval(cancelData.policyId, {
          cancelReason: cancelData.cancelReason,
          approvalType: cancelData.approvalType,
          userId: loggedInStore?.contactId || loggedInStore?.id,
          userName: loggedInStore?.target || loggedInStore?.name
        });
        alert('승인이 성공적으로 취소되었습니다.');
      }
      
      setShowCancelModal(false);
      setSelectedPolicyForCancel(null);
      // 정책 데이터 다시 로드
      await loadPolicyData();
    } catch (error) {
      console.error('취소 실패:', error);
      alert('취소에 실패했습니다.');
    }
  };

  const handleSettlementClick = (policy) => {
    setSelectedPolicyForSettlement(policy);
    setShowSettlementModal(true);
  };

  const handleSettlementSubmit = async (settlementData) => {
    try {
      await PolicyService.reflectSettlement(settlementData.policyId, {
        isReflected: settlementData.isReflected,
        userId: loggedInStore?.contactId || loggedInStore?.id,
        userName: loggedInStore?.target || loggedInStore?.name
      });
      
      alert(`정책이 정산에 ${settlementData.isReflected ? '반영' : '미반영'} 처리되었습니다.`);
      setShowSettlementModal(false);
      setSelectedPolicyForSettlement(null);
      // 정책 데이터 다시 로드
      await loadPolicyData();
    } catch (error) {
      console.error('정산 반영 실패:', error);
      alert('정산 반영에 실패했습니다.');
    }
  };

  const handleSavePolicy = async (policyData) => {
    // 복수 정책 저장 요청 처리
    if (Array.isArray(policyData)) {
      const totalCount = policyData.length;
      let successCount = 0;
      let lastErrorMessage = '정책 저장에 실패했습니다. 다시 시도해주세요.';

      try {
        setBulkProcessing(true);
        setBulkProcessingMessage(`정책 저장 중... (0/${totalCount})`);

        for (let i = 0; i < totalCount; i += 1) {
          const currentPolicy = policyData[i];
          try {
            setBulkProcessingMessage(`정책 저장 중... (${i + 1}/${totalCount})`);
            await PolicyService.createPolicy(currentPolicy);
            successCount += 1;
          } catch (error) {
            console.error('복수 정책 저장 실패:', error);

            if (error.response && error.response.data) {
              const responseData = error.response.data;
              if (responseData.error) {
                lastErrorMessage = responseData.error;
              } else if (responseData.missingFieldNames && responseData.missingFieldNames.length > 0) {
                lastErrorMessage = `다음 필수 항목이 누락되었습니다: ${responseData.missingFieldNames.join(', ')}`;
              }
            } else if (error.message) {
              lastErrorMessage = error.message;
            }

            throw error;
          }
        }

        await loadPolicyData();
        alert(`정책 ${successCount}건이 성공적으로 저장되었습니다.`);
      } catch (error) {
        const summaryMessage = successCount > 0
          ? `정책 저장 중 오류가 발생했습니다. (${successCount}/${totalCount}건 성공)\n사유: ${lastErrorMessage}`
          : `정책 저장에 실패했습니다.\n사유: ${lastErrorMessage}`;
        alert(summaryMessage);
        throw new Error(lastErrorMessage);
      } finally {
        setBulkProcessing(false);
        setBulkProcessingMessage('');
      }

      return;
    }

    // 단일 정책 저장 처리
    try {
      console.log('정책 저장 시도:', policyData);
      await PolicyService.createPolicy(policyData);
      
      // 정책 데이터 다시 로드
      await loadPolicyData();
      
      // 성공 메시지 (나중에 스낵바로 변경 가능)
      alert('정책이 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error('정책 저장 실패:', error);
      
      // 서버에서 받은 에러 메시지가 있으면 사용
      let errorMessage = '정책 저장에 실패했습니다. 다시 시도해주세요.';
      
      if (error.response && error.response.data) {
        const responseData = error.response.data;
        if (responseData.error) {
          errorMessage = responseData.error;
        } else if (responseData.missingFieldNames && responseData.missingFieldNames.length > 0) {
          errorMessage = `다음 필수 항목이 누락되었습니다: ${responseData.missingFieldNames.join(', ')}`;
        }
      }
      
      alert(`정책 저장 실패: ${errorMessage}`);
      throw error;
    }
  };

  // 정책 수정 권한 확인 함수
  const canEditPolicy = (policy) => {
    const currentUserId = loggedInStore?.contactId || loggedInStore?.id;
    const userRole = loggedInStore?.userRole;
    
    // 정책이 취소된 경우 수정 불가
    if (policy.policyStatus === '취소됨') {
      return false;
    }
    
    // 승인 전 단계: 본인만 수정 가능
    const isPendingApproval = 
      (policy.approvalStatus?.total === '대기' || !policy.approvalStatus?.total) &&
      (policy.approvalStatus?.settlement === '대기' || !policy.approvalStatus?.settlement) &&
      (policy.approvalStatus?.team === '대기' || !policy.approvalStatus?.team);
    
    if (isPendingApproval) {
      return policy.inputUserId === currentUserId;
    }
    
    // 승인된 상태: 소속정책팀 이상 레벨에서 수정 가능
    const isApproved = 
      policy.approvalStatus?.total === '승인' ||
      policy.approvalStatus?.settlement === '승인' ||
      policy.approvalStatus?.team === '승인';
    
    if (isApproved) {
      return ['SS', 'S', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole);
    }
    
    return false;
  };

  // 정책 클릭 핸들러 (수정 모달 열기)
  const handlePolicyClick = (policy) => {
    if (!canEditPolicy(policy)) {
      alert('승인처리중이라 수정이 불가능합니다.');
      return;
    }
    
    setSelectedPolicyForEdit(policy);
    setShowEditModal(true);
  };

  // 정책 수정 저장 핸들러
  const handleEditPolicy = async (policyId, updateData) => {
    try {
      await PolicyService.updatePolicy(policyId, updateData);
      
      // 정책 데이터 다시 로드
      await loadPolicyData();
      
      alert('정책이 성공적으로 수정되었습니다.');
    } catch (error) {
      console.error('정책 수정 실패:', error);
      alert('정책 수정에 실패했습니다. 다시 시도해주세요.');
      throw error;
    }
  };

  // 정책 복사 핸들러
  const handleCopyPolicy = (policy) => {
    setSelectedPolicyForCopy(policy);
    setShowCopyModal(true);
  };

  // 정책 복사 저장 핸들러
  const handleCopyPolicySubmit = async (targetYearMonth) => {
    try {
      const originalPolicy = selectedPolicyForCopy;
      // 디버깅: 원본 정책 데이터 확인
      console.log('[개별복사] 원본 정책 데이터:', {
        policyName: originalPolicy.policyName,
        category: originalPolicy.category,
        isDirectInput: originalPolicy.isDirectInput,
        rateSupports: originalPolicy.rateSupports,
        rateSupportsType: typeof originalPolicy.rateSupports,
        rateSupportsLength: Array.isArray(originalPolicy.rateSupports) ? originalPolicy.rateSupports.length : 'N/A',
        policyContent: originalPolicy.policyContent?.substring(0, 50)
      });
      
      // 정책 적용일에서 시작일과 종료일 추출 (대상월에 맞춰 변경)
      let policyStartDate, policyEndDate;
      if (originalPolicy.policyDate && targetYearMonth) {
        // "2025. 6. 1. ~ 2025. 12. 31." 형태에서 날짜 추출
        const dateMatch = originalPolicy.policyDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*~\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
        if (dateMatch) {
          const [targetYear, targetMonth] = targetYearMonth.split('-').map(Number);
          // 시작일: 대상월의 1일
          const startDate = new Date(targetYear, targetMonth - 1, 1);
          // 종료일: 대상월의 마지막 일
          const endDate = new Date(targetYear, targetMonth, 0);
          policyStartDate = startDate.toISOString();
          policyEndDate = endDate.toISOString();
        }
      }
      
      // policy.policyDate가 없거나 파싱 실패한 경우 대상월에 맞춰 변경
      if (!policyStartDate || !policyEndDate) {
        // targetYearMonth가 있으면 항상 대상월의 1일~말일로 설정
        if (targetYearMonth) {
          const [targetYear, targetMonth] = targetYearMonth.split('-').map(Number);
          const startDate = new Date(targetYear, targetMonth - 1, 1);
          const endDate = new Date(targetYear, targetMonth, 0);
          policyStartDate = startDate.toISOString();
          policyEndDate = endDate.toISOString();
        } else if (originalPolicy.policyStartDate && originalPolicy.policyEndDate) {
          // targetYearMonth가 없으면 원본 날짜 사용 (예외 케이스)
          policyStartDate = originalPolicy.policyStartDate;
          policyEndDate = originalPolicy.policyEndDate;
        } else {
          // 모든 방법이 실패하면 현재 날짜 사용
          policyStartDate = new Date().toISOString();
          policyEndDate = new Date().toISOString();
        }
      }
      
      // 금액에서 실제 금액과 유형 추출 ("내용에 직접입력" 문구 처리 포함)
      let policyAmount = '';
      let amountType = 'total';
      if (originalPolicy.policyAmount) {
        if (originalPolicy.policyAmount.includes('내용에 직접입력')) {
          amountType = 'in_content';
        } else {
          // 만원 단위 처리: "3만원" -> 30000
          const manwonMatch = originalPolicy.policyAmount.match(/(\d+)만원/);
          if (manwonMatch) {
            policyAmount = String(Number(manwonMatch[1]) * 10000);
            if (originalPolicy.policyAmount.includes('건당금액')) {
              amountType = 'per_case';
            }
          } else {
            // 원 단위 처리: "30000원" -> 30000
            const amountMatch = originalPolicy.policyAmount.match(/(\d+)원/);
            if (amountMatch) {
              policyAmount = amountMatch[1];
              if (originalPolicy.policyAmount.includes('건당금액')) {
                amountType = 'per_case';
              }
            }
          }
        }
      }
      
      // 복사할 정책 데이터 생성
      const copyData = {
        policyName: originalPolicy.policyName,
        policyStartDate: policyStartDate || new Date().toISOString(),
        policyEndDate: policyEndDate || new Date().toISOString(),
        policyStore: originalPolicy.policyStore,
        policyContent: originalPolicy.policyContent,
        policyAmount: policyAmount,
        amountType: amountType,
        policyType: originalPolicy.policyType,
        category: originalPolicy.category,
        yearMonth: targetYearMonth,
        team: originalPolicy.team, // 소속정책팀 그대로 복사
        policyTeam: originalPolicy.team || originalPolicy.teamName, // 백엔드가 요구하는 policyTeam
        manager: originalPolicy.manager, // 담당자 그대로 복사
        inputUserId: loggedInStore?.contactId || loggedInStore?.id,
        inputUserName: loggedInStore?.target || loggedInStore?.name,
        inputDateTime: new Date().toISOString(),
        approvalStatus: {
          total: '대기',
          settlement: '대기',
          team: '대기'
        },
        // 정책별 특수 필드들 복사 (깊은 복사)
        activationType: (() => {
          if (!originalPolicy.activationType) return { new010: false, mnp: false, change: false };
          if (typeof originalPolicy.activationType === 'string') {
            try {
              return JSON.parse(originalPolicy.activationType);
            } catch (e) {
              return { new010: false, mnp: false, change: false };
            }
          }
          return { ...originalPolicy.activationType };
        })(),
        multipleStoreName: originalPolicy.multipleStoreName,
        isMultiple: originalPolicy.isMultiple,
        // 구두정책
        amount95Above: originalPolicy.amount95Above,
        amount95Below: originalPolicy.amount95Below,
        // 부가차감지원정책
        deductSupport: (() => {
          if (!originalPolicy.deductSupport) return { addServiceAmount: '', insuranceAmount: '', connectionAmount: '' };
          if (typeof originalPolicy.deductSupport === 'string') {
            try {
              return JSON.parse(originalPolicy.deductSupport);
            } catch (e) {
              return { addServiceAmount: '', insuranceAmount: '', connectionAmount: '' };
            }
          }
          return { ...originalPolicy.deductSupport };
        })(),
        conditionalOptions: (() => {
          if (!originalPolicy.conditionalOptions) return { addServiceAcquired: false, insuranceAcquired: false, connectionAcquired: false };
          if (typeof originalPolicy.conditionalOptions === 'string') {
            try {
              return JSON.parse(originalPolicy.conditionalOptions);
            } catch (e) {
              return { addServiceAcquired: false, insuranceAcquired: false, connectionAcquired: false };
            }
          }
          return { ...originalPolicy.conditionalOptions };
        })(),
        // 부가추가지원정책
        addSupport: (() => {
          if (!originalPolicy.addSupport) return { uplayPremiumAmount: '', phoneExchangePassAmount: '', musicAmount: '', numberFilteringAmount: '' };
          if (typeof originalPolicy.addSupport === 'string') {
            try {
              return JSON.parse(originalPolicy.addSupport);
            } catch (e) {
              return { uplayPremiumAmount: '', phoneExchangePassAmount: '', musicAmount: '', numberFilteringAmount: '' };
            }
          }
          return { ...originalPolicy.addSupport };
        })(),
        supportConditionalOptions: (() => {
          if (!originalPolicy.supportConditionalOptions) return { vas2Both: false, vas2Either: false, addon3All: false };
          if (typeof originalPolicy.supportConditionalOptions === 'string') {
            try {
              return JSON.parse(originalPolicy.supportConditionalOptions);
            } catch (e) {
              return { vas2Both: false, vas2Either: false, addon3All: false };
            }
          }
          return { ...originalPolicy.supportConditionalOptions };
        })(),
        // isDirectInput: 원본 값 사용, 없으면 rateSupports와 policyContent로 판단
        isDirectInput: (() => {
          let result;
          // 명시적으로 true인 경우
          if (originalPolicy.isDirectInput === true || originalPolicy.isDirectInput === 'true') {
            result = true;
            console.log(`✅ [개별복사-2단계] isDirectInput 판단: 명시적 true`, {
              policyName: originalPolicy.policyName,
              originalValue: originalPolicy.isDirectInput,
              result
            });
            return result;
          }
          // 명시적으로 false인 경우
          if (originalPolicy.isDirectInput === false || originalPolicy.isDirectInput === 'false') {
            result = false;
            console.log(`✅ [개별복사-2단계] isDirectInput 판단: 명시적 false`, {
              policyName: originalPolicy.policyName,
              originalValue: originalPolicy.isDirectInput,
              result
            });
            return result;
          }
          // undefined/null인 경우: rateSupports가 없고 policyContent가 있으면 직접입력으로 판단
          if ((originalPolicy.category === 'wireless_rate' || originalPolicy.category === 'wired_rate')) {
            const hasRateSupports = originalPolicy.rateSupports && 
              Array.isArray(originalPolicy.rateSupports) && 
              originalPolicy.rateSupports.length > 0;
            const hasPolicyContent = originalPolicy.policyContent && originalPolicy.policyContent.trim();
            // rateSupports가 없고 policyContent가 있으면 직접입력
            if (!hasRateSupports && hasPolicyContent) {
              result = true;
              console.log(`✅ [개별복사-2단계] isDirectInput 판단: 추론 true`, {
                policyName: originalPolicy.policyName,
                originalValue: originalPolicy.isDirectInput,
                hasRateSupports,
                hasPolicyContent,
                result,
                reason: 'rateSupports 없음 && policyContent 있음'
              });
              return result;
            }
          }
          result = false;
          console.log(`❌ [개별복사-2단계] isDirectInput 판단: 최종 false`, {
            policyName: originalPolicy.policyName,
            originalValue: originalPolicy.isDirectInput,
            category: originalPolicy.category,
            hasRateSupports: originalPolicy.rateSupports && Array.isArray(originalPolicy.rateSupports) && originalPolicy.rateSupports.length > 0,
            hasPolicyContent: !!(originalPolicy.policyContent && originalPolicy.policyContent.trim()),
            result
          });
          return result;
        })(),
        rateSupports: (() => {
          if (!originalPolicy.rateSupports) {
            return [];
          }
          // JSON 문자열인 경우 파싱
          if (typeof originalPolicy.rateSupports === 'string') {
            try {
              const parsed = JSON.parse(originalPolicy.rateSupports);
              return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              console.error('rateSupports 파싱 실패:', e, originalPolicy.rateSupports);
              return [];
            }
          }
          // 이미 배열인 경우 깊은 복사
          if (Array.isArray(originalPolicy.rateSupports)) {
            return JSON.parse(JSON.stringify(originalPolicy.rateSupports));
          }
          return [];
        })(),
        // 연합정책
        unionSettlementStore: originalPolicy.unionSettlementStore || '',
        unionTargetStores: (() => {
          if (!originalPolicy.unionTargetStores) return [];
          // JSON 문자열인 경우 파싱
          if (typeof originalPolicy.unionTargetStores === 'string') {
            try {
              return JSON.parse(originalPolicy.unionTargetStores);
            } catch (e) {
              return [];
            }
          }
          // 이미 배열인 경우 복사
          return Array.isArray(originalPolicy.unionTargetStores) ? [...originalPolicy.unionTargetStores] : [];
        })(),
        unionConditions: (() => {
          if (!originalPolicy.unionConditions) return {};
          if (typeof originalPolicy.unionConditions === 'string') {
            try {
              return JSON.parse(originalPolicy.unionConditions);
            } catch (e) {
              return {};
            }
          }
          return { ...originalPolicy.unionConditions };
        })(),
        // 개별소급정책
        individualTarget: (() => {
          if (!originalPolicy.individualTarget) return {};
          if (typeof originalPolicy.individualTarget === 'string') {
            try {
              return JSON.parse(originalPolicy.individualTarget);
            } catch (e) {
              return {};
            }
          }
          return { ...originalPolicy.individualTarget };
        })(),
        individualActivationType: originalPolicy.individualActivationType || ''
      };
      
      // 디버깅: 최종 복사 데이터 확인
      console.log(`📤 [개별복사-3단계] 최종 복사 데이터:`, {
        policyName: copyData.policyName,
        category: copyData.category,
        isDirectInput: copyData.isDirectInput,
        rateSupports: copyData.rateSupports,
        rateSupportsLength: Array.isArray(copyData.rateSupports) ? copyData.rateSupports.length : 'N/A',
        hasPolicyContent: !!(copyData.policyContent && copyData.policyContent.trim()),
        yearMonth: copyData.yearMonth
      });

      await PolicyService.createPolicy(copyData);
      
      // 정책 데이터 다시 로드
      await loadPolicyData();
      
      setShowCopyModal(false);
      setSelectedPolicyForCopy(null);
      
      alert('정책이 성공적으로 복사되었습니다.');
    } catch (error) {
      console.error('정책 복사 실패:', error);
      // API 응답에서 상세 에러 메시지 추출
      let errorMessage = '정책 복사에 실패했습니다. 다시 시도해주세요.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      alert(`정책 복사 실패: ${errorMessage}`);
      throw error;
    }
  };

  // 일괄 처리 관련 함수
  const canBulkApprove = () => {
    const userRole = loggedInStore?.userRole;
    return selectedPolicies.length > 0 && selectedPolicies.every(policy => {
      // 정책이 취소되지 않았고, 승인 권한이 있는 경우
      if (policy.policyStatus === '취소됨') return false;
      
      // 소속정책팀 이상 권한 필요
      return ['SS', 'S', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole);
    });
  };

  const canBulkSettlement = () => {
    const userRole = loggedInStore?.userRole;
    return selectedPolicies.length > 0 && 
           ['S', 'SS'].includes(userRole) && 
           selectedPolicies.every(policy => {
             // 정책이 취소되지 않았고, 정산 반영되지 않은 경우
             return policy.policyStatus !== '취소됨' && policy.settlementStatus !== '반영됨';
           });
  };

  const canBulkCancel = () => {
    const currentUserId = loggedInStore?.contactId || loggedInStore?.id;
    return selectedPolicies.length > 0 && selectedPolicies.every(policy => {
      // 본인이 입력한 정책이고, 취소되지 않은 경우
      return policy.inputUserId === currentUserId && policy.policyStatus !== '취소됨';
    });
  };

  const canBulkDelete = () => {
    const currentUserId = loggedInStore?.contactId || loggedInStore?.id;
    return selectedPolicies.length > 0 && selectedPolicies.every(policy => {
      // 본인이 입력한 정책인 경우
      return policy.inputUserId === currentUserId;
    });
  };

  const canBulkCopy = () => {
    return selectedPolicies.length > 0 && selectedPolicies.every(policy => {
      // 정책이 취소되지 않은 경우
      return policy.policyStatus !== '취소됨';
    });
  };

  const handleBulkAction = async (action) => {
    if (action === 'copy') {
      setShowBulkCopyModal(true);
      return;
    }
    
    if (action === 'delete') {
      if (!window.confirm(`선택된 ${selectedPolicies.length}건의 정책을 삭제하시겠습니까?\n삭제된 정책은 복구할 수 없습니다.`)) {
        return;
      }
      
      setBulkProcessing(true);
      setBulkProcessingMessage('일괄 삭제 중...');
      try {
        const totalCount = selectedPolicies.length;
        // 선택된 정책들을 순차적으로 삭제
        for (let i = 0; i < selectedPolicies.length; i++) {
          const policy = selectedPolicies[i];
          setBulkProcessingMessage(`일괄 삭제 중... (${i + 1}/${totalCount})`);
          const response = await fetch(`${API_BASE_URL}/api/policies/${policy.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '삭제 실패');
          }
        }
        
        alert(`${selectedPolicies.length}건의 정책이 삭제되었습니다.`);
        setSelectedPolicies([]); // 선택 해제
        loadPolicyData(); // 정책 목록 새로고침
      } catch (error) {
        console.error('일괄 삭제 실패:', error);
        alert(`일괄 삭제 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        setBulkProcessing(false);
        setBulkProcessingMessage('');
      }
      return;
    }

    if (action === 'approve') {
      const confirmed = window.confirm('선택된 정책들을 일괄 승인하시겠습니까?');
      if (!confirmed) return;

      setApprovalProcessing(true);
      setBulkProcessing(true);
      setBulkProcessingMessage('일괄 승인 중...');
      try {
        const userRole = loggedInStore?.userRole;
        let successCount = 0;
        let skipCount = 0;
        const errors = [];
        const totalCount = selectedPolicies.length;

        for (let i = 0; i < selectedPolicies.length; i++) {
          const policy = selectedPolicies[i];
          setBulkProcessingMessage(`일괄 승인 중... (${i + 1}/${totalCount})`);
          // 정책이 취소된 경우 스킵
          if (policy.policyStatus === '취소됨') {
            skipCount++;
            continue;
          }

          // 권한에 따라 승인 가능한 타입 결정
          let approvalType = '';
          const approvalStatus = policy.approvalStatus || {};
          
          if (userRole === 'SS' || userRole === '이사') {
            // 총괄: 총괄, 정산팀, 소속팀 승인 모두 가능
            if (approvalStatus.total !== '승인') {
              approvalType = 'total';
            } else if (approvalStatus.settlement !== '승인') {
              approvalType = 'settlement';
            } else if (approvalStatus.team !== '승인') {
              approvalType = 'team';
            }
          } else if (userRole === 'S') {
            // 정산팀: 총괄, 정산팀 승인 가능
            if (approvalStatus.total !== '승인') {
              approvalType = 'total';
            } else if (approvalStatus.settlement !== '승인') {
              approvalType = 'settlement';
            }
          } else if (['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
            // 소속정책팀: 소속팀 승인만 가능
            if (approvalStatus.team !== '승인') {
              approvalType = 'team';
            }
          }

          // 이미 승인된 경우 스킵
          if (!approvalType) {
            skipCount++;
            continue;
          }

          try {
            await PolicyService.approvePolicy(policy.id, {
              approvalType,
              comment: '일괄 승인',
              userId: loggedInStore?.contactId || loggedInStore?.id,
              userName: loggedInStore?.target || loggedInStore?.name
            });
            successCount++;
          } catch (error) {
            console.error(`정책 ${policy.policyName} 승인 실패:`, error);
            errors.push(`${policy.policyName}: ${error.message || '승인 실패'}`);
          }
        }

        let message = `일괄 승인 완료: ${successCount}건`;
        if (skipCount > 0) {
          message += `, 스킵: ${skipCount}건 (이미 승인됨 또는 취소됨)`;
        }
        if (errors.length > 0) {
          message += `\n실패: ${errors.length}건\n${errors.slice(0, 3).join('\n')}`;
          if (errors.length > 3) {
            message += `\n외 ${errors.length - 3}건...`;
          }
        }
        alert(message);
        setSelectedPolicies([]);
        await loadPolicyData();
      } catch (error) {
        console.error('일괄 승인 실패:', error);
        alert('일괄 승인에 실패했습니다: ' + error.message);
      } finally {
        setApprovalProcessing(false);
        setBulkProcessing(false);
        setBulkProcessingMessage('');
      }
    } else if (action === 'settlement') {
      const confirmed = window.confirm('선택된 정책들을 일괄 정산 반영하시겠습니까?');
      if (!confirmed) return;

      setBulkProcessing(true);
      setBulkProcessingMessage('일괄 정산 반영 중...');
      try {
        let successCount = 0;
        let skipCount = 0;
        const errors = [];
        const totalCount = selectedPolicies.length;

        for (let i = 0; i < selectedPolicies.length; i++) {
          const policy = selectedPolicies[i];
          setBulkProcessingMessage(`일괄 정산 반영 중... (${i + 1}/${totalCount})`);
          
          // 정책이 취소되었거나 이미 반영된 경우 스킵
          if (policy.policyStatus === '취소됨' || policy.settlementStatus === '반영됨') {
            skipCount++;
            continue;
          }

          try {
            await PolicyService.reflectSettlement(policy.id, {
              isReflected: true,
              userId: loggedInStore?.contactId || loggedInStore?.id,
              userName: loggedInStore?.target || loggedInStore?.name
            });
            successCount++;
          } catch (error) {
            console.error(`정책 ${policy.policyName} 정산 반영 실패:`, error);
            errors.push(`${policy.policyName}: ${error.message || '정산 반영 실패'}`);
          }
        }

        let message = `일괄 정산 반영 완료: ${successCount}건`;
        if (skipCount > 0) {
          message += `, 스킵: ${skipCount}건 (이미 반영됨 또는 취소됨)`;
        }
        if (errors.length > 0) {
          message += `\n실패: ${errors.length}건\n${errors.slice(0, 3).join('\n')}`;
          if (errors.length > 3) {
            message += `\n외 ${errors.length - 3}건...`;
          }
        }
        alert(message);
        setSelectedPolicies([]);
        await loadPolicyData();
      } catch (error) {
        console.error('일괄 정산 반영 실패:', error);
        alert('일괄 정산 반영에 실패했습니다: ' + error.message);
      } finally {
        setBulkProcessing(false);
        setBulkProcessingMessage('');
      }
    } else if (action === 'cancel') {
      const confirmed = window.confirm('선택된 정책들을 일괄 취소하시겠습니까?');
      if (!confirmed) return;

      setBulkProcessing(true);
      setBulkProcessingMessage('일괄 취소 중...');
      try {
        const totalCount = selectedPolicies.length;
        for (let i = 0; i < selectedPolicies.length; i++) {
          const policy = selectedPolicies[i];
          setBulkProcessingMessage(`일괄 취소 중... (${i + 1}/${totalCount})`);
          if (policy.policyStatus !== '취소됨') {
            await PolicyService.cancelPolicy(policy.id, {
              cancelReason: '일괄 취소',
              userId: loggedInStore?.contactId || loggedInStore?.id,
              userName: loggedInStore?.target || loggedInStore?.name
            });
          }
        }
        alert('선택된 정책들이 일괄 취소되었습니다.');
        setSelectedPolicies([]);
        await loadPolicyData();
      } catch (error) {
        console.error('일괄 취소 실패:', error);
        alert('일괄 취소에 실패했습니다.');
      } finally {
        setBulkProcessing(false);
        setBulkProcessingMessage('');
      }
    }
  };

  // 일괄 복사 저장 핸들러
  const handleBulkCopySubmit = async (targetYearMonth) => {
    setBulkProcessing(true);
    setBulkProcessingMessage('일괄 복사 중...');
    try {
      const totalCount = selectedPolicies.length;
      for (let i = 0; i < selectedPolicies.length; i++) {
        const policy = selectedPolicies[i];
        setBulkProcessingMessage(`일괄 복사 중... (${i + 1}/${totalCount})`);
        if (policy.policyStatus !== '취소됨') {
          // 디버깅: 원본 정책 데이터 확인
          console.log(`🔍 [일괄복사-1단계] 원본 정책 데이터 (${i + 1}/${totalCount}):`, {
            policyName: policy.policyName,
            category: policy.category,
            isDirectInput: policy.isDirectInput,
            isDirectInputType: typeof policy.isDirectInput,
            rateSupports: policy.rateSupports,
            rateSupportsType: typeof policy.rateSupports,
            rateSupportsLength: Array.isArray(policy.rateSupports) ? policy.rateSupports.length : 'N/A',
            rateSupportsIsArray: Array.isArray(policy.rateSupports),
            hasPolicyContent: !!(policy.policyContent && policy.policyContent.trim()),
            policyContentLength: policy.policyContent ? policy.policyContent.length : 0
          });
          // 정책 적용일 처리 및 대상월에 맞춰 변경
          let policyStartDate;
          let policyEndDate;
          
          // policy.policyDate 문자열에서 날짜 정보 추출 (대상월에 맞춰 변경)
          if (policy.policyDate && targetYearMonth) {
            const m = policy.policyDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*~\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
            if (m) {
              const [targetYear, targetMonth] = targetYearMonth.split('-').map(Number);
              // 시작일: 대상월의 1일
              const startDate = new Date(targetYear, targetMonth - 1, 1);
              // 종료일: 대상월의 마지막 일
              const endDate = new Date(targetYear, targetMonth, 0);
              policyStartDate = startDate.toISOString();
              policyEndDate = endDate.toISOString();
            }
          }
          
          // policy.policyDate가 없거나 파싱 실패한 경우 대상월에 맞춰 변경
          if (!policyStartDate || !policyEndDate) {
            // targetYearMonth가 있으면 항상 대상월의 1일~말일로 설정
            if (targetYearMonth) {
              const [targetYear, targetMonth] = targetYearMonth.split('-').map(Number);
              const startDate = new Date(targetYear, targetMonth - 1, 1);
              const endDate = new Date(targetYear, targetMonth, 0);
              policyStartDate = startDate.toISOString();
              policyEndDate = endDate.toISOString();
            } else if (policy.policyStartDate && policy.policyEndDate) {
              // targetYearMonth가 없으면 원본 날짜 사용 (예외 케이스)
              policyStartDate = policy.policyStartDate;
              policyEndDate = policy.policyEndDate;
            } else {
              // 모든 방법이 실패하면 현재 날짜 사용
              policyStartDate = new Date().toISOString();
              policyEndDate = new Date().toISOString();
            }
          }

          // 금액 및 금액유형 처리 ("내용에 직접입력" 문구 처리 포함)
          let amountType = policy.amountType || 'total';
          let policyAmount = '';
          if (policy.policyAmount) {
            if (policy.policyAmount.includes('내용에 직접입력')) {
              amountType = 'in_content';
            } else {
              // 만원 단위 처리: "3만원" -> 30000
              const manwonMatch = policy.policyAmount.match(/(\d+)만원/);
              if (manwonMatch) {
                policyAmount = String(Number(manwonMatch[1]) * 10000);
                if (policy.policyAmount.includes('건당금액')) amountType = 'per_case';
              } else {
                // 원 단위 처리: "30000원" -> 30000
                const amt = policy.policyAmount.match(/(\d+)원/);
                if (amt) {
                  policyAmount = amt[1];
                  if (policy.policyAmount.includes('건당금액')) amountType = 'per_case';
                }
              }
            }
          }

          const copyData = {
            policyName: policy.policyName,
            policyStartDate: policyStartDate || new Date().toISOString(),
            policyEndDate: policyEndDate || new Date().toISOString(),
            policyStore: policy.policyStore,
            policyContent: policy.policyContent,
            policyAmount: policyAmount,
            amountType: amountType,
            policyType: policy.policyType,
            category: policy.category,
            yearMonth: targetYearMonth,
            team: policy.team,
            policyTeam: policy.team || policy.teamName,
            manager: policy.manager,
            inputUserId: loggedInStore?.contactId || loggedInStore?.id,
            inputUserName: loggedInStore?.target || loggedInStore?.name,
            inputDateTime: new Date().toISOString(),
            approvalStatus: {
              total: '대기',
              settlement: '대기',
              team: '대기'
            },
            // 공통/카테고리별 추가 필드들
            activationType: (() => {
              if (!policy.activationType) return { new010: false, mnp: false, change: false };
              if (typeof policy.activationType === 'string') {
                try {
                  return JSON.parse(policy.activationType);
                } catch (e) {
                  return { new010: false, mnp: false, change: false };
                }
              }
              return { ...policy.activationType };
            })(),
            multipleStoreName: policy.multipleStoreName,
            isMultiple: policy.isMultiple,
            // 구두정책
            amount95Above: policy.amount95Above,
            amount95Below: policy.amount95Below,
            // 부가차감지원정책
            deductSupport: (() => {
              if (!policy.deductSupport) return { addServiceAmount: '', insuranceAmount: '', connectionAmount: '' };
              if (typeof policy.deductSupport === 'string') {
                try {
                  return JSON.parse(policy.deductSupport);
                } catch (e) {
                  return { addServiceAmount: '', insuranceAmount: '', connectionAmount: '' };
                }
              }
              return { ...policy.deductSupport };
            })(),
            conditionalOptions: (() => {
              if (!policy.conditionalOptions) return { addServiceAcquired: false, insuranceAcquired: false, connectionAcquired: false };
              if (typeof policy.conditionalOptions === 'string') {
                try {
                  return JSON.parse(policy.conditionalOptions);
                } catch (e) {
                  return { addServiceAcquired: false, insuranceAcquired: false, connectionAcquired: false };
                }
              }
              return { ...policy.conditionalOptions };
            })(),
            // 부가추가지원정책
            addSupport: (() => {
              if (!policy.addSupport) return { uplayPremiumAmount: '', phoneExchangePassAmount: '', musicAmount: '', numberFilteringAmount: '' };
              if (typeof policy.addSupport === 'string') {
                try {
                  return JSON.parse(policy.addSupport);
                } catch (e) {
                  return { uplayPremiumAmount: '', phoneExchangePassAmount: '', musicAmount: '', numberFilteringAmount: '' };
                }
              }
              return { ...policy.addSupport };
            })(),
            supportConditionalOptions: (() => {
              if (!policy.supportConditionalOptions) return { vas2Both: false, vas2Either: false, addon3All: false };
              if (typeof policy.supportConditionalOptions === 'string') {
                try {
                  return JSON.parse(policy.supportConditionalOptions);
                } catch (e) {
                  return { vas2Both: false, vas2Either: false, addon3All: false };
                }
              }
              return { ...policy.supportConditionalOptions };
            })(),
            // isDirectInput: 원본 값 사용, 없으면 rateSupports와 policyContent로 판단
            isDirectInput: (() => {
              let result;
              // 명시적으로 true인 경우
              if (policy.isDirectInput === true || policy.isDirectInput === 'true') {
                result = true;
                console.log(`✅ [일괄복사-2단계] isDirectInput 판단 (${i + 1}/${totalCount}): 명시적 true`, {
                  policyName: policy.policyName,
                  originalValue: policy.isDirectInput,
                  result
                });
                return result;
              }
              // 명시적으로 false인 경우
              if (policy.isDirectInput === false || policy.isDirectInput === 'false') {
                result = false;
                console.log(`✅ [일괄복사-2단계] isDirectInput 판단 (${i + 1}/${totalCount}): 명시적 false`, {
                  policyName: policy.policyName,
                  originalValue: policy.isDirectInput,
                  result
                });
                return result;
              }
              // undefined/null인 경우: rateSupports가 없고 policyContent가 있으면 직접입력으로 판단
              if ((policy.category === 'wireless_rate' || policy.category === 'wired_rate')) {
                const hasRateSupports = policy.rateSupports && 
                  Array.isArray(policy.rateSupports) && 
                  policy.rateSupports.length > 0;
                const hasPolicyContent = policy.policyContent && policy.policyContent.trim();
                // rateSupports가 없고 policyContent가 있으면 직접입력
                if (!hasRateSupports && hasPolicyContent) {
                  result = true;
                  console.log(`✅ [일괄복사-2단계] isDirectInput 판단 (${i + 1}/${totalCount}): 추론 true`, {
                    policyName: policy.policyName,
                    originalValue: policy.isDirectInput,
                    hasRateSupports,
                    hasPolicyContent,
                    result,
                    reason: 'rateSupports 없음 && policyContent 있음'
                  });
                  return result;
                }
              }
              result = false;
              console.log(`❌ [일괄복사-2단계] isDirectInput 판단 (${i + 1}/${totalCount}): 최종 false`, {
                policyName: policy.policyName,
                originalValue: policy.isDirectInput,
                category: policy.category,
                hasRateSupports: policy.rateSupports && Array.isArray(policy.rateSupports) && policy.rateSupports.length > 0,
                hasPolicyContent: !!(policy.policyContent && policy.policyContent.trim()),
                result
              });
              return result;
            })(),
            rateSupports: (() => {
              if (!policy.rateSupports) {
                return [];
              }
              // JSON 문자열인 경우 파싱
              if (typeof policy.rateSupports === 'string') {
                try {
                  const parsed = JSON.parse(policy.rateSupports);
                  return Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                  console.error('rateSupports 파싱 실패:', e, policy.rateSupports);
                  return [];
                }
              }
              // 이미 배열인 경우 깊은 복사
              if (Array.isArray(policy.rateSupports)) {
                return JSON.parse(JSON.stringify(policy.rateSupports));
              }
              return [];
            })(),
            // 연합정책
            unionSettlementStore: policy.unionSettlementStore || '',
            unionTargetStores: (() => {
              if (!policy.unionTargetStores) return [];
              // JSON 문자열인 경우 파싱
              if (typeof policy.unionTargetStores === 'string') {
                try {
                  return JSON.parse(policy.unionTargetStores);
                } catch (e) {
                  return [];
                }
              }
              // 이미 배열인 경우 복사
              return Array.isArray(policy.unionTargetStores) ? [...policy.unionTargetStores] : [];
            })(),
            unionConditions: (() => {
              if (!policy.unionConditions) return {};
              if (typeof policy.unionConditions === 'string') {
                try {
                  return JSON.parse(policy.unionConditions);
                } catch (e) {
                  return {};
                }
              }
              return { ...policy.unionConditions };
            })(),
            // 개별소급정책
            individualTarget: (() => {
              if (!policy.individualTarget) return {};
              if (typeof policy.individualTarget === 'string') {
                try {
                  return JSON.parse(policy.individualTarget);
                } catch (e) {
                  return {};
                }
              }
              return { ...policy.individualTarget };
            })(),
            individualActivationType: policy.individualActivationType || ''
          };
          
          // 디버깅: 최종 복사 데이터 확인
          console.log(`📤 [일괄복사-3단계] 최종 복사 데이터 (${i + 1}/${totalCount}):`, {
            policyName: copyData.policyName,
            category: copyData.category,
            isDirectInput: copyData.isDirectInput,
            rateSupports: copyData.rateSupports,
            rateSupportsLength: Array.isArray(copyData.rateSupports) ? copyData.rateSupports.length : 'N/A',
            hasPolicyContent: !!(copyData.policyContent && copyData.policyContent.trim()),
            yearMonth: copyData.yearMonth
          });
          
          await PolicyService.createPolicy(copyData);
        }
      }
      
      alert('선택된 정책들이 일괄 복사되었습니다.');
      setSelectedPolicies([]);
      setShowBulkCopyModal(false);
      await loadPolicyData();
    } catch (error) {
      console.error('일괄 복사 실패:', error);
      // API 응답에서 상세 에러 메시지 추출
      let errorMessage = '일괄 복사에 실패했습니다.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      alert(`일괄 복사 실패: ${errorMessage}`);
    } finally {
      setBulkProcessing(false);
      setBulkProcessingMessage('');
    }
  };

  // 전체 선택 핸들러
  const handleSelectAll = (event) => {
    // 필터링된 정책 목록 생성
    const filteredPolicies = policies
      .filter(policy => policy.category === selectedCategoryForList)
      .filter(policy => {
        // 소속정책팀 필터
        if (selectedTeamFilter !== 'all' && policy.team !== selectedTeamFilter) {
          return false;
        }
        // 상태 필터
        if (selectedStatusFilter === 'active') {
          // 진행중: 취소되지 않은 정책
          return policy.policyStatus !== '취소됨';
        } else if (selectedStatusFilter === 'cancelled') {
          // 취소됨: 취소된 정책
          return policy.policyStatus === '취소됨';
        }
        return true;
      });

    if (event.target.checked) {
      setSelectedPolicies(filteredPolicies);
    } else {
      setSelectedPolicies([]);
    }
  };

  // 개별 체크박스 핸들러
  const handlePolicySelect = (policy) => {
    setSelectedPolicies(prev => {
      const newSelected = [...prev];
      const index = newSelected.findIndex(p => p.id === policy.id);
      if (index > -1) {
        newSelected.splice(index, 1);
      } else {
        newSelected.push(policy);
      }
      return newSelected;
    });
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            정책 모드
          </Typography>
          
          {/* 알림 버튼 */}
          <IconButton color="inherit" sx={{ mr: 2 }}>
            <NotificationsIcon />
          </IconButton>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={() => {
                console.log('PolicyMode 모드 전환 버튼 클릭됨');
                console.log('onModeChange 존재:', !!onModeChange);
                console.log('availableModes:', availableModes);
                onModeChange();
              }}
              startIcon={<SwapHorizIcon />}
              sx={{ 
                mr: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              모드 변경
            </Button>
          )}
          
          {/* 업데이트 확인 버튼 */}
          <Button
            color="inherit"
            startIcon={<UpdateIcon />}
            onClick={() => setShowUpdatePopup(true)}
            sx={{ 
              mr: 2,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.2)'
              }
            }}
          >
            업데이트 확인
          </Button>
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth={false} sx={{ flex: 1, py: 4, px: 2 }}>
        {/* 메인 탭 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={mainTab}
            onChange={(e, newValue) => setMainTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="추가정책" />
            <Tab label="정책표목록" />
            <Tab label="정책표생성" />
            <Tab label="정책표생성설정" />
          </Tabs>
        </Paper>

        {/* 정책표목록 탭 */}
        {mainTab === 1 && (
          <PolicyTableListTab loggedInStore={loggedInStore} />
        )}

        {/* 정책표생성 탭 */}
        {mainTab === 2 && (
          <PolicyTableCreationTab loggedInStore={loggedInStore} />
        )}

        {/* 정책표생성설정 탭 */}
        {mainTab === 3 && (
          <PolicyTableSettingsTab loggedInStore={loggedInStore} />
        )}

        {/* 추가정책 탭 (기존 기능) */}
        {mainTab === 0 && (
          <>
        {/* 담당자 선택 탭 */}
        <Paper sx={{ mb: 2, p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
            👥 담당자
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`전체 (${managerPolicyCounts['전체'] || 0})`}
              onClick={() => setSelectedManager('전체')}
              color={selectedManager === '전체' ? 'primary' : 'default'}
              variant={selectedManager === '전체' ? 'filled' : 'outlined'}
              sx={{ fontWeight: selectedManager === '전체' ? 'bold' : 'normal' }}
            />
            {managers.map((manager) => (
              <Chip
                key={manager}
                label={`${manager} (${managerPolicyCounts[manager] || 0})`}
                onClick={() => setSelectedManager(manager)}
                color={selectedManager === manager ? 'primary' : 'default'}
                variant={selectedManager === manager ? 'filled' : 'outlined'}
                sx={{ fontWeight: selectedManager === manager ? 'bold' : 'normal' }}
              />
            ))}
          </Box>
        </Paper>

        {/* 정책 타입 선택 탭 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs 
            value={policyType} 
            onChange={(e, newValue) => setPolicyType(newValue)}
            centered
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab 
              value="wireless" 
              label="무선정책" 
              icon={<PolicyIcon />}
              iconPosition="start"
            />
            <Tab 
              value="wired" 
              label="유선정책" 
              icon={<PolicyIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {/* 대상년월 선택 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Typography variant="subtitle1" fontWeight="bold">
                대상년월:
              </Typography>
            </Grid>
            <Grid item>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>년월 선택</InputLabel>
                <Select
                  value={selectedYearMonth}
                  label="년월 선택"
                  onChange={(e) => setSelectedYearMonth(e.target.value)}
                >
                  {getYearMonthOptions().map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

                {/* 정책 카테고리 목록 또는 정책 목록 */}
                 {currentView === 'categories' ? (
           <Grid container spacing={3}>
             {categoriesLoading ? (
               <Grid item xs={12}>
                 <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                   <CircularProgress />
                 </Box>
               </Grid>
             ) : (
               categories[policyType]?.map((category) => (
              <Grid item xs={12} sm={6} md={4} key={category.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                      transition: 'all 0.2s'
                    }
                  }}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h4" sx={{ mr: 1 }}>
                        {category.icon}
                      </Typography>
                      <Typography variant="h6" component="div">
                        {category.name}
                      </Typography>
                    </Box>
                    
                    {/* 구두정책 경고문구 */}
                    {(category.id === 'wireless_shoe' || category.id === 'wired_shoe') && (
                      <Alert severity="warning" sx={{ mb: 2, fontSize: '0.75rem', py: 0.5 }}>
                        <Typography variant="caption" display="block" sx={{ fontWeight: 'bold' }}>
                          신규점이나 변동사항이 있을시만 입력해주세요!
                        </Typography>
                        <Typography variant="caption" display="block">
                          폰클에 등록되어있는점은 입력안해주셔도 됩니다!
                        </Typography>
                      </Alert>
                    )}
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip 
                        label={`${policyData[category.id] || 0}건`}
                        color="primary" 
                        variant="outlined"
                        size="small"
                      />
                      {/* 전체 탭이 아닐 때만 추가 버튼 표시 */}
                      {selectedManager !== '전체' && (
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddPolicy(category.id);
                          }}
                          sx={{ minWidth: 'auto' }}
                        >
                          추가
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                                 </Card>
               </Grid>
             )))}
           </Grid>
        ) : (
          /* 정책 목록 화면 */
          <Box>
            {/* 뒤로가기 버튼 */}
            <Button 
              onClick={handleBackToCategories}
              startIcon={<ArrowBackIcon />}
              sx={{ mb: 2 }}
            >
              카테고리로 돌아가기
            </Button>
            
                         {/* 카테고리 제목 */}
             <Typography variant="h5" sx={{ mb: 3 }}>
               {categories[policyType]?.find(cat => cat.id === selectedCategoryForList)?.name} 정책 목록
             </Typography>
            
            {/* 필터링 UI */}
            <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              {/* 소속정책팀 필터 */}
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>소속정책팀</InputLabel>
                <Select
                  value={selectedTeamFilter}
                  onChange={(e) => setSelectedTeamFilter(e.target.value)}
                  label="소속정책팀"
                >
                  <MenuItem value="all">전체</MenuItem>
                  {teams.map(team => (
                    <MenuItem key={team.code} value={team.code}>
                      {team.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {/* 상태 필터 */}
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>상태</InputLabel>
                <Select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  label="상태"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="active">진행중</MenuItem>
                  <MenuItem value="cancelled">취소됨</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* 선택된 정책 정보 및 일괄 처리 버튼 */}
            {selectedPolicies.length > 0 && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" color="primary">
                    {selectedPolicies.length}건 선택됨
                  </Typography>
                  <Button size="small" onClick={() => setSelectedPolicies([])}>
                    선택 해제
                  </Button>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    onClick={() => handleBulkAction('approve')}
                    disabled={!canBulkApprove()}
                  >
                    선택 일괄승인
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="info"
                    onClick={() => handleBulkAction('settlement')}
                    disabled={!canBulkSettlement()}
                  >
                    선택 일괄정산반영
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => handleBulkAction('cancel')}
                    disabled={!canBulkCancel()}
                  >
                    선택 일괄취소
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => handleBulkAction('delete')}
                    disabled={!canBulkDelete()}
                    sx={{ backgroundColor: 'error.light', color: 'white' }}
                  >
                    선택 일괄삭제
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    onClick={() => handleBulkAction('copy')}
                    disabled={!canBulkCopy()}
                  >
                    선택 일괄복사
                  </Button>
                </Box>
              </Box>
            )}
            
            {/* 공지사항 섹션 */}
            {selectedCategoryForList && (
              <Box sx={{ mb: 2 }}>
                <Paper sx={{ p: 2, bgcolor: '#fff3cd', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#856404' }}>
                      📢 공지사항 및 안내사항
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setEditingNotice(null);
                        setShowNoticeModal(true);
                      }}
                    >
                      공지사항 작성
                    </Button>
                  </Box>
                  {noticesLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : notices.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      등록된 공지사항이 없습니다.
                    </Typography>
                  ) : (
                    <Box>
                      {notices.map((notice) => (
                        <Box
                          key={notice.id}
                          sx={{
                            mb: 2,
                            p: 2,
                            bgcolor: 'white',
                            borderRadius: 1,
                            border: '1px solid #dee2e6'
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                {notice.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                작성자: {notice.author} | 작성일: {new Date(notice.createdAt).toLocaleString('ko-KR')}
                                {notice.updatedAt !== notice.createdAt && ` | 수정일: ${new Date(notice.updatedAt).toLocaleString('ko-KR')}`}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingNotice(notice);
                                  setShowNoticeModal(true);
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleNoticeDelete(notice.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              whiteSpace: 'pre-line',
                              color: 'text.primary',
                              lineHeight: 1.6
                            }}
                          >
                            {notice.content}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Box>
            )}
            
            {/* 정책 목록 테이블 */}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer 
                component={Paper} 
                sx={{ 
                  borderRadius: 2,
                  boxShadow: 2,
                  maxHeight: 'calc(100vh - 300px)',
                  overflow: 'auto',
                  '& .MuiTable-root': {
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    minWidth: '100%'
                  }
                }}
              >
                {(() => {
                  // 필터링된 정책 목록 생성
                  const filteredPolicies = policies
                    .filter(policy => policy.category === selectedCategoryForList)
                    .filter(policy => {
                      // 소속정책팀 필터
                      if (selectedTeamFilter !== 'all' && policy.team !== selectedTeamFilter) {
                        return false;
                      }
                      // 상태 필터
                      if (selectedStatusFilter === 'active') {
                        // 진행중: 취소되지 않은 정책
                        return policy.policyStatus !== '취소됨';
                      } else if (selectedStatusFilter === 'cancelled') {
                        // 취소됨: 취소된 정책
                        return policy.policyStatus === '취소됨';
                      }
                      return true;
                    });

                  return (
                    <Table>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'primary.main' }}>
                          <TableCell 
                            padding="checkbox"
                            sx={{ 
                              color: 'white',
                              fontWeight: 'bold',
                              borderBottom: '2px solid white'
                            }}
                          >
                            <Checkbox
                              indeterminate={selectedPolicies.length > 0 && selectedPolicies.length < filteredPolicies.length}
                              checked={selectedPolicies.length > 0 && selectedPolicies.length === filteredPolicies.length}
                              onChange={handleSelectAll}
                              sx={{ color: 'white', '&.Mui-checked': { color: 'white' } }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 120 }}>
                            정책명
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 100 }}>
                            정책일자
                          </TableCell>
                          {/* 연합정책이 아닐 때만 복수점명/적용점/업체명 컬럼 표시 */}
                          {selectedCategoryForList !== 'wireless_union' && selectedCategoryForList !== 'wired_union' && (
                            <>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 100 }}>
                                복수점명
                              </TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 80 }}>
                                적용점
                              </TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 120 }}>
                                업체명
                              </TableCell>
                            </>
                          )}
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 100 }}>
                            소속정책팀
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 200 }}>
                            내용
                          </TableCell>
                          {/* 요금제유형별정책이 아닐 때만 개통유형 컬럼 표시 */}
                          {selectedCategoryForList !== 'wireless_rate' && selectedCategoryForList !== 'wired_rate' && (
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 120 }}>
                              개통유형
                            </TableCell>
                          )}
                          {/* 개별소급정책일 때만 금액 컬럼 표시 */}
                          {(selectedCategoryForList === 'wireless_individual' || selectedCategoryForList === 'wired_individual') && (
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 120 }}>
                              금액
                            </TableCell>
                          )}
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 80 }}>
                            입력자
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 120 }}>
                            승인상태
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 100 }}>
                            정산반영
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 120 }}>
                            작업
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredPolicies.map((policy, index) => (
                          <TableRow 
                            key={policy.id}
                            sx={{ 
                              backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                              '&:hover': { 
                                backgroundColor: '#fff3e0',
                                '& .MuiTableCell-root': { color: '#f57c00' }
                              },
                              transition: 'background-color 0.2s ease'
                            }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedPolicies.some(p => p.id === policy.id)}
                                onChange={() => handlePolicySelect(policy)}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Box>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    cursor: canEditPolicy(policy) ? 'pointer' : 'default',
                                    textDecoration: canEditPolicy(policy) ? 'underline' : 'none',
                                    fontWeight: canEditPolicy(policy) ? 'bold' : 'normal',
                                    '&:hover': canEditPolicy(policy) ? { 
                                      color: 'primary.main',
                                      transform: 'scale(1.02)'
                                    } : {},
                                    transition: 'all 0.2s ease'
                                  }}
                                  onClick={() => handlePolicyClick(policy)}
                                >
                                  {policy.policyName}
                                </Typography>
                                {policy.policyStatus === '취소됨' && (
                                  <Chip 
                                    label="취소됨" 
                                    size="small" 
                                    color="error" 
                                    variant="outlined"
                                    sx={{ mt: 0.5, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>{policy.policyDate}</TableCell>
                            {/* 연합정책이 아닐 때만 복수점명/적용점/업체명 셀 표시 */}
                            {selectedCategoryForList !== 'wireless_union' && selectedCategoryForList !== 'wired_union' && (
                              <>
                                <TableCell>
                                  {policy.multipleStoreName && policy.multipleStoreName.trim() ? (
                                    <Chip 
                                      label={policy.multipleStoreName} 
                                      size="small" 
                                      color="primary" 
                                      variant="outlined"
                                      sx={{ fontSize: '0.7rem' }}
                                    />
                                  ) : (
                                    '단일점'
                                  )}
                                </TableCell>
                                <TableCell>{policy.policyStore}</TableCell>
                                <TableCell>{policy.policyStoreName || '-'}</TableCell>
                              </>
                            )}
                            <TableCell>{policy.teamName}</TableCell>
                            <TableCell>
                              <Box>
                                {(() => {
                                  // 구두정책인 경우 95군 이상/미만 정보 표시
                                  if (policy.category === 'wireless_shoe' || policy.category === 'wired_shoe') {
                                    if (policy.amount95Above || policy.amount95Below) {
                                      const aboveAmount = Number(policy.amount95Above) || 0;
                                      const belowAmount = Number(policy.amount95Below) || 0;
                                      
                                      let amountText;
                                      if (aboveAmount > 0 && belowAmount > 0 && aboveAmount === belowAmount) {
                                        // 95군이상과 95군미만 금액이 동일한 경우
                                        amountText = `💰 전요금제: ${aboveAmount.toLocaleString()}원`;
                                      } else {
                                        // 일반적인 경우
                                        const aboveText = aboveAmount > 0 ? `📈 95군이상: ${aboveAmount.toLocaleString()}원` : '';
                                        const belowText = belowAmount > 0 ? `📉 95군미만: ${belowAmount.toLocaleString()}원` : '';
                                        amountText = [aboveText, belowText].filter(Boolean).join(' / ');
                                      }
                                      
                                      return (
                                        <Box>
                                          <Typography variant="body2" sx={{ 
                                            fontWeight: 'bold',
                                            color: 'success.main',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5
                                          }}>
                                            {amountText}
                                          </Typography>
                                          {policy.policyContent && (
                                            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                                              추가내용: {policy.policyContent}
                                            </Typography>
                                          )}
                                        </Box>
                                      );
                                    }
                                  }
                                  
                                  // 부가차감지원정책인 경우 차감지원 정보 표시
                                  if (policy.category === 'wireless_add_deduct' || policy.category === 'wired_add_deduct') {
                                    // policyContent가 있으면 그대로 표시 (자동생성된 형식)
                                    if (policy.policyContent) {
                                      return (
                                        <Typography 
                                          variant="body2" 
                                          sx={{ whiteSpace: 'pre-line' }}
                                        >
                                          {policy.policyContent}
                                        </Typography>
                                      );
                                    }
                                    
                                    // policyContent가 없는 경우 (구버전 데이터) 기존 로직 유지
                                    const conditions = [];
                                    if (policy.conditionalOptions?.addServiceAcquired) conditions.push('부가유치시');
                                    if (policy.conditionalOptions?.insuranceAcquired) conditions.push('보험유치시');
                                    if (policy.conditionalOptions?.connectionAcquired) conditions.push('연결음유치시');
                                    
                                    // 조건부에 맞는 차감지원 금액만 수집
                                    const deductItems = [];
                                    const deductAmounts = [];
                                    
                                    // 부가유치시 조건이 체크되지 않았을 때만 부가미유치 금액 표시
                                    if (!policy.conditionalOptions?.addServiceAcquired && policy.deductSupport?.addServiceAmount) {
                                      deductItems.push({ icon: '📱', name: '부가미유치', amount: Number(policy.deductSupport.addServiceAmount) });
                                      deductAmounts.push(Number(policy.deductSupport.addServiceAmount));
                                    }
                                    
                                    // 보험유치시 조건이 체크되지 않았을 때만 보험미유치 금액 표시
                                    if (!policy.conditionalOptions?.insuranceAcquired && policy.deductSupport?.insuranceAmount) {
                                      deductItems.push({ icon: '🛡️', name: '보험미유치', amount: Number(policy.deductSupport.insuranceAmount) });
                                      deductAmounts.push(Number(policy.deductSupport.insuranceAmount));
                                    }
                                    
                                    // 연결음유치시 조건이 체크되지 않았을 때만 연결음미유치 금액 표시
                                    if (!policy.conditionalOptions?.connectionAcquired && policy.deductSupport?.connectionAmount) {
                                      deductItems.push({ icon: '🔊', name: '연결음미유치', amount: Number(policy.deductSupport.connectionAmount) });
                                      deductAmounts.push(Number(policy.deductSupport.connectionAmount));
                                    }
                                    
                                    if (deductItems.length > 0) {
                                      // 금액을 만원 단위로 변환하는 함수
                                      const formatAmountToManwon = (amount) => {
                                        const manwon = Math.floor(amount / 10000);
                                        return `${manwon}만원`;
                                      };
                                      
                                      // 모든 금액이 동일한지 확인
                                      const uniqueAmounts = [...new Set(deductAmounts)];
                                      const allSame = uniqueAmounts.length === 1;
                                      
                                      return (
                                        <Box>
                                          {conditions.length > 0 && (
                                            <Typography variant="body2" sx={{ 
                                              fontWeight: 'bold',
                                              color: 'primary.main',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 0.5,
                                              mb: 0.5
                                            }}>
                                              🎯 조건부: {conditions.join(', ')}
                                            </Typography>
                                          )}
                                          <Typography variant="body2" sx={{ 
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            color: 'success.main'
                                          }}>
                                            {allSame ? (
                                              <>
                                                💰 {deductItems.map(item => `${item.icon} ${item.name}`).join('/')} {formatAmountToManwon(uniqueAmounts[0])} 각각 차감금액지원
                                              </>
                                            ) : (
                                              <>
                                                💰 {deductItems.map(item => `${item.icon} ${item.name} ${formatAmountToManwon(item.amount)}`).join('/')} 각각 차감금액지원
                                              </>
                                            )}
                                          </Typography>
                                          {conditions.length === 0 && (
                                            <Typography variant="body2" sx={{ 
                                              mt: 0.5,
                                              color: 'text.secondary'
                                            }}>
                                              📌 조건: 없음
                                            </Typography>
                                          )}
                                        </Box>
                                      );
                                    }
                                  }
                                  
                                  // 일반 정책이거나 직접입력이 있는 경우
                                  return (
                                    <>
                                      <Typography 
                                        variant="body2" 
                                        sx={{ whiteSpace: 'pre-line' }}
                                      >
                                        {policy.policyContent}
                                      </Typography>
                                      {policy.cancelReason && (
                                        <Typography variant="caption" color="error" display="block">
                                          취소사유: {policy.cancelReason}
                                        </Typography>
                                      )}
                                    </>
                                  );
                                })()}
                              </Box>
                            </TableCell>
                            {/* 요금제유형별정책이 아닐 때만 개통유형 셀 표시 */}
                            {selectedCategoryForList !== 'wireless_rate' && selectedCategoryForList !== 'wired_rate' && (
                              <TableCell>
                                {(() => {
                                  // 개별소급정책은 individualActivationType 사용 (라디오 버튼)
                                  if (policy.category === 'wireless_individual' || policy.category === 'wired_individual') {
                                    if (!policy.individualActivationType) return '-';
                                    const typeMap = {
                                      'new010': '010신규',
                                      'mnp': 'MNP',
                                      'change': '기변'
                                    };
                                    return typeMap[policy.individualActivationType] || '-';
                                  }
                                  
                                  // 개통유형 표시 로직
                                  // 부가차감/추가지원정책, 연합정책은 개통유형 선택 필드가 없으므로 "전유형"으로 표시
                                  if (policy.category === 'wireless_add_deduct' || policy.category === 'wired_add_deduct' || 
                                      policy.category === 'wireless_add_support' || policy.category === 'wired_add_support' ||
                                      policy.category === 'wireless_union' || policy.category === 'wired_union') {
                                    return '전유형';
                                  }
                                  
                                  if (!policy.activationType) return '-';
                                  
                                  const { new010, mnp, change } = policy.activationType;
                                  const types = [];
                                  
                                  if (new010) types.push('010신규');
                                  if (mnp) types.push('MNP');
                                  if (change) types.push('기변');
                                  
                                  if (types.length === 0) return '-';
                                  if (types.length === 3) return '전유형';
                                  
                                  return types.join(', ');
                                })()}
                              </TableCell>
                            )}
                            {/* 개별소급정책일 때만 금액 셀 표시 */}
                            {(selectedCategoryForList === 'wireless_individual' || selectedCategoryForList === 'wired_individual') && (
                              <TableCell>
                                {(() => {
                                  if (!policy.policyAmount) return '-';
                                  
                                  // 숫자로 변환
                                  const amountNum = Number(policy.policyAmount);
                                  if (isNaN(amountNum) || amountNum === 0) return '-';
                                  
                                  // 금액 포맷팅
                                  const amountText = (amountNum >= 10000 && amountNum % 10000 === 0) 
                                    ? `${amountNum / 10000}만원`
                                    : `${amountNum.toLocaleString()}원`;
                                  
                                  // 금액 유형 표시
                                  const typeText = policy.amountType === 'total' ? '총금액' : '건당금액';
                                  return `${amountText} (${typeText})`;
                                })()}
                              </TableCell>
                            )}
                            <TableCell>{policy.inputUserName}</TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Chip 
                                  label={`총괄: ${policy.approvalStatus?.total || '대기'}`}
                                  size="small"
                                  color={policy.approvalStatus?.total === '승인' ? 'success' : 'default'}
                                  sx={{ 
                                    fontSize: '0.7rem',
                                    height: '20px',
                                    '& .MuiChip-label': { px: 1 }
                                  }}
                                />
                                <Chip 
                                  label={`정산팀: ${policy.approvalStatus?.settlement || '대기'}`}
                                  size="small"
                                  color={policy.approvalStatus?.settlement === '승인' ? 'success' : 'default'}
                                  sx={{ 
                                    fontSize: '0.7rem',
                                    height: '20px',
                                    '& .MuiChip-label': { px: 1 }
                                  }}
                                />
                                <Chip 
                                  label={`소속팀: ${policy.approvalStatus?.team || '대기'}`}
                                  size="small"
                                  color={policy.approvalStatus?.team === '승인' ? 'success' : 'default'}
                                  sx={{ 
                                    fontSize: '0.7rem',
                                    height: '20px',
                                    '& .MuiChip-label': { px: 1 }
                                  }}
                                />
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Chip 
                                  label={policy.settlementStatus || '미반영'}
                                  size="small"
                                  color={policy.settlementStatus === '반영됨' ? 'success' : 'default'}
                                  variant="outlined"
                                  sx={{ 
                                    fontSize: '0.7rem',
                                    height: '20px',
                                    '& .MuiChip-label': { px: 1 }
                                  }}
                                />
                                {policy.settlementUserName && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                    {policy.settlementUserName}
                                  </Typography>
                                )}
                                {policy.settlementDateTime && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                    {new Date(policy.settlementDateTime).toLocaleDateString()}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'row', 
                                gap: 0.5, 
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {/* 정책 취소 버튼 (입력자만 보임) */}
                                {policy.inputUserId === (loggedInStore?.contactId || loggedInStore?.id) && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleCancelClick(policy, 'policy')}
                                    disabled={policy.policyStatus === '취소됨'}
                                    title="정책취소"
                                    sx={{ 
                                      p: 0.5,
                                      '&:hover': { backgroundColor: 'error.light', color: 'white' }
                                    }}
                                  >
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                )}
                                
                                {/* 정책 삭제 버튼 (입력자만 보임) */}
                                {policy.inputUserId === (loggedInStore?.contactId || loggedInStore?.id) && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteClick(policy)}
                                    title="정책삭제"
                                    sx={{ 
                                      p: 0.5,
                                      backgroundColor: 'error.dark',
                                      color: 'white',
                                      '&:hover': { backgroundColor: 'error.main', color: 'white' }
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                                
                                {/* 승인 버튼 - 권한별 표시 */}
                                {(() => {
                                  const userRole = loggedInStore?.userRole;
                                  const canApprove = 
                                    // 총괄(SS): 모든 승인 가능
                                    userRole === 'SS' ||
                                    // 정산팀(S): 총괄, 정산팀 승인 가능
                                    userRole === 'S' ||
                                    // 소속정책팀(AA, BB, CC, DD, EE, FF): 소속팀 승인만 가능
                                    ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole);
                                  
                                  return canApprove ? (
                                    <IconButton
                                      size="small"
                                      color="success"
                                      onClick={() => handleApprovalClick(policy)}
                                      disabled={policy.policyStatus === '취소됨' || approvalProcessing}
                                      title="승인"
                                      sx={{ 
                                        p: 0.5,
                                        '&:hover': { backgroundColor: 'success.light', color: 'white' }
                                      }}
                                    >
                                      <CheckCircleIcon fontSize="small" />
                                    </IconButton>
                                  ) : null;
                                })()}
                                
                                {/* 승인 취소 버튼 - 권한별 표시 */}
                                {(() => {
                                  const userRole = loggedInStore?.userRole;
                                  const canCancelApproval = 
                                    // 총괄(SS): 모든 승인 취소 가능
                                    userRole === 'SS' ||
                                    // 정산팀(S): 총괄, 정산팀 승인 취소 가능
                                    userRole === 'S' ||
                                    // 소속정책팀(AA, BB, CC, DD, EE, FF): 소속팀 승인 취소만 가능
                                    ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole);
                                  
                                  return canCancelApproval ? (
                                    <IconButton
                                      size="small"
                                      color="warning"
                                      onClick={() => handleCancelClick(policy, 'approval')}
                                      disabled={policy.policyStatus === '취소됨'}
                                      title="승인취소"
                                      sx={{ 
                                        p: 0.5,
                                        '&:hover': { backgroundColor: 'warning.light', color: 'white' }
                                      }}
                                    >
                                      <CancelOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  ) : null;
                                })()}
                                
                                {/* 정산 반영 버튼 (정산팀 권한만 보임) */}
                                {(loggedInStore?.userRole === 'S' || loggedInStore?.userRole === 'SS') && (
                                  <IconButton
                                    size="small"
                                    color="info"
                                    onClick={() => handleSettlementClick(policy)}
                                    disabled={policy.policyStatus === '취소됨'}
                                    title="정산반영"
                                    sx={{ 
                                      p: 0.5,
                                      '&:hover': { backgroundColor: 'info.light', color: 'white' }
                                    }}
                                  >
                                    <AccountBalanceIcon fontSize="small" />
                                  </IconButton>
                                )}
                                
                                {/* 정책 복사 버튼 - 누구나 복사 가능 */}
                                <IconButton
                                  size="small"
                                  color="secondary"
                                  onClick={() => handleCopyPolicy(policy)}
                                  disabled={policy.policyStatus === '취소됨'}
                                  title="정책복사"
                                  sx={{ 
                                    p: 0.5,
                                    '&:hover': { backgroundColor: 'secondary.light', color: 'white' }
                                  }}
                                >
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                })()}
              </TableContainer>
            )}
          </Box>
        )}
          </>
        )}
      </Container>
      
      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="policy"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          console.log('정책모드 새 업데이트가 추가되었습니다.');
        }}
      />

            {/* 정책 입력 모달 */}
      <PolicyInputModal
        open={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        categoryId={selectedCategory}
        yearMonth={selectedYearMonth}
        stores={stores}
        teams={teams}
        selectedManager={selectedManager}
        onSave={handleSavePolicy}
        loggedInUser={loggedInStore}
      />

            {/* 정책 수정 모달 */}
            <PolicyInputModal
              open={showEditModal}
              onClose={() => {
                setShowEditModal(false);
                setSelectedPolicyForEdit(null);
              }}
              categoryId={selectedPolicyForEdit?.category}
              yearMonth={selectedYearMonth}
              stores={stores}
              teams={teams}
              selectedManager={selectedPolicyForEdit?.manager || selectedManager}
              onSave={handleEditPolicy}
              loggedInUser={loggedInStore}
              policy={selectedPolicyForEdit}
            />

                                                       {/* 정책 승인 모달 */}
                   <PolicyApprovalModal
            open={showApprovalModal}
            onClose={() => {
              setShowApprovalModal(false);
              setSelectedPolicyForApproval(null);
            }}
            policy={selectedPolicyForApproval}
            onApprovalSubmit={handleApprovalSubmit}
                        userRole={loggedInStore?.userRole}
            processing={approvalProcessing}
          />

               {/* 정책 취소 모달 */}
                                   <PolicyCancelModal
            open={showCancelModal}
            onClose={() => {
              setShowCancelModal(false);
              setSelectedPolicyForCancel(null);
            }}
            policy={selectedPolicyForCancel}
            onCancelSubmit={handleCancelSubmit}
            cancelType={cancelType}
            userRole={loggedInStore?.userRole}
          />

                 {/* 정산 반영 모달 */}
                  <SettlementReflectModal
            open={showSettlementModal}
            onClose={() => {
              setShowSettlementModal(false);
              setSelectedPolicyForSettlement(null);
            }}
            policy={selectedPolicyForSettlement}
            onReflectSubmit={handleSettlementSubmit}
            userRole={loggedInStore?.userRole}
          />

            {/* 정책 복사 모달 */}
            <PolicyCopyModal
              open={showCopyModal}
              onClose={() => {
                setShowCopyModal(false);
                setSelectedPolicyForCopy(null);
              }}
              policy={selectedPolicyForCopy}
              yearMonth={selectedYearMonth}
              onCopySubmit={handleCopyPolicySubmit}
            />

            {/* 일괄 복사 모달 */}
            <PolicyCopyModal
              open={showBulkCopyModal}
              onClose={() => {
                setShowBulkCopyModal(false);
                setSelectedPolicies([]); // 모달 닫을 때 선택 해제
              }}
              yearMonth={selectedYearMonth}
              onCopySubmit={handleBulkCopySubmit}
              selectedPolicies={selectedPolicies}
            />

            {/* 공지사항 작성/수정 모달 */}
            <Dialog
              open={showNoticeModal}
              onClose={() => {
                setShowNoticeModal(false);
                setEditingNotice(null);
                setSelectedNotice(null);
              }}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>
                {editingNotice ? '공지사항 수정' : '공지사항 작성'}
              </DialogTitle>
              <DialogContent>
                <NoticeForm
                  notice={editingNotice}
                  onSave={handleNoticeSave}
                  onCancel={() => {
                    setShowNoticeModal(false);
                    setEditingNotice(null);
                    setSelectedNotice(null);
                  }}
                  categories={categories[policyType] || []}
                  defaultCategory={selectedCategoryForList || ''}
                />
              </DialogContent>
            </Dialog>

            {/* 일괄 처리 로딩 오버레이 */}
            <Backdrop
              sx={{ 
                color: '#fff', 
                zIndex: (theme) => theme.zIndex.drawer + 1,
                flexDirection: 'column',
                gap: 2
              }}
              open={bulkProcessing}
            >
              <CircularProgress color="inherit" size={60} />
              <Typography variant="h6" sx={{ mt: 2 }}>
                {bulkProcessingMessage || '처리 중...'}
              </Typography>
            </Backdrop>
                    </Box>
  );
}

// 공지사항 작성/수정 폼 컴포넌트
function NoticeForm({ notice, onSave, onCancel, categories = [], defaultCategory = '' }) {
  // 수정 모드일 때는 notice의 category 사용, 새로 작성할 때는 defaultCategory 또는 '전체' 사용
  const initialCategory = notice?.category || defaultCategory || '전체';
  const [title, setTitle] = useState(notice?.title || '');
  const [content, setContent] = useState(notice?.content || '');
  const [note, setNote] = useState(notice?.note || '');
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    if (notice) {
      setTitle(notice.title || '');
      setContent(notice.content || '');
      setNote(notice.note || '');
      setCategory(notice.category || defaultCategory || '전체');
    } else {
      setTitle('');
      setContent('');
      setNote('');
      setCategory(defaultCategory || '전체');
    }
  }, [notice, defaultCategory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }
    onSave({ title, content, note, category });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <TextField
        fullWidth
        label="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="내용"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        multiline
        rows={6}
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="비고"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        multiline
        rows={2}
        sx={{ mb: 2 }}
      />
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>카테고리</InputLabel>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          label="카테고리"
        >
          <MenuItem value="전체">전체 (모든 카테고리에 표시)</MenuItem>
          {categories.map((cat) => (
            <MenuItem key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
        <Button onClick={onCancel}>취소</Button>
        <Button type="submit" variant="contained" color="primary">
          저장
        </Button>
      </Box>
    </Box>
  );
}

export default PolicyMode; 