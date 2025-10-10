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
  Checkbox
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
  Delete as DeleteIcon
} from '@mui/icons-material';

import AppUpdatePopup from './AppUpdatePopup';
import PolicyInputModal from './PolicyInputModal';
import PolicyApprovalModal from './PolicyApprovalModal';
import PolicyCancelModal from './PolicyCancelModal';
import SettlementReflectModal from './SettlementReflectModal';
import PolicyCopyModal from './PolicyCopyModal';
import PolicyService from '../utils/policyService';

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
    
    // 카테고리 데이터 로드
    loadCategories();
    
    // 정책 데이터 로드
    loadPolicyData();
  }, [policyType, selectedYearMonth]);

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

  const loadPolicyData = async () => {
    setLoading(true);
    try {
      const policyTypeLabel = policyType === 'wireless' ? '무선' : '유선';
      const policies = await PolicyService.getPolicies({
        yearMonth: selectedYearMonth,
        policyType: policyTypeLabel
      });
      
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
      
      // 전체 정책 목록 저장 (필터링된 정책들)
      setPolicies(policiesWithTeamNames);
      
      // 카테고리별 개수 계산 (필터링된 정책들 기준)
      const counts = {};
      policiesWithTeamNames.forEach(policy => {
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
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://port-0-jegomap2-md0ol3n075a69e78.sel5.cloudtype.app';
      
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
      
      // 정책 적용일에서 시작일과 종료일 추출
      let policyStartDate, policyEndDate;
      if (originalPolicy.policyDate) {
        // "2025. 6. 1. ~ 2025. 12. 31." 형태에서 날짜 추출
        const dateMatch = originalPolicy.policyDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*~\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
        if (dateMatch) {
          const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = dateMatch;
          policyStartDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay)).toISOString();
          policyEndDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay)).toISOString();
        }
      }
      
      // 금액에서 실제 금액과 유형 추출
      let policyAmount = '';
      let amountType = 'total';
      if (originalPolicy.policyAmount) {
        if (originalPolicy.policyAmount.includes('내용에 직접입력')) {
          amountType = 'in_content';
        } else {
          const amountMatch = originalPolicy.policyAmount.match(/(\d+)원/);
          if (amountMatch) {
            policyAmount = amountMatch[1];
            if (originalPolicy.policyAmount.includes('건당금액')) {
              amountType = 'per_case';
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
        inputUserId: loggedInStore?.contactId || loggedInStore?.id,
        inputUserName: loggedInStore?.target || loggedInStore?.name,
        inputDateTime: new Date().toISOString(),
        approvalStatus: {
          total: '대기',
          settlement: '대기',
          team: '대기'
        }
      };

      await PolicyService.createPolicy(copyData);
      
      // 정책 데이터 다시 로드
      await loadPolicyData();
      
      setShowCopyModal(false);
      setSelectedPolicyForCopy(null);
      
      alert('정책이 성공적으로 복사되었습니다.');
    } catch (error) {
      console.error('정책 복사 실패:', error);
      alert('정책 복사에 실패했습니다. 다시 시도해주세요.');
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
      
      try {
        // 선택된 정책들을 순차적으로 삭제
        for (const policy of selectedPolicies) {
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
      }
      return;
    }

    if (action === 'approve') {
      const confirmed = window.confirm('선택된 정책들을 일괄 승인하시겠습니까?');
      if (!confirmed) return;

      setApprovalProcessing(true);
      try {
        for (const policy of selectedPolicies) {
          if (canEditPolicy(policy)) {
            const { policyId, approvalData: approval, userRole } = { policyId: policy.id, approvalData: { total: '승인', settlement: '대기', team: '대기' }, userRole: loggedInStore?.userRole };
            let approvalType = '';
            if (userRole === 'SS' || userRole === '이사') {
              if (approval.total === '승인') approvalType = 'total';
              else if (approval.settlement === '승인') approvalType = 'settlement';
              else if (approval.team === '승인') approvalType = 'team';
            } else if (userRole === 'S') {
              if (approval.total === '승인') approvalType = 'total';
              else if (approval.settlement === '승인') approvalType = 'settlement';
            } else if (['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
              if (approval.team === '승인') approvalType = 'team';
            }
            if (!approvalType) continue;

            await PolicyService.approvePolicy(policyId, {
              approvalType,
              comment: '일괄 승인',
              userId: loggedInStore?.contactId || loggedInStore?.id,
              userName: loggedInStore?.target || loggedInStore?.name
            });
          }
        }
        alert('선택된 정책들이 일괄 승인되었습니다.');
        setSelectedPolicies([]);
        await loadPolicyData();
      } catch (error) {
        console.error('일괄 승인 실패:', error);
        alert('일괄 승인에 실패했습니다.');
      } finally {
        setApprovalProcessing(false);
      }
    } else if (action === 'settlement') {
      const confirmed = window.confirm('선택된 정책들을 일괄 정산 반영하시겠습니까?');
      if (!confirmed) return;

      try {
        for (const policy of selectedPolicies) {
          if (policy.settlementStatus !== '반영됨') {
            await PolicyService.reflectSettlement(policy.id, {
              isReflected: true,
              userId: loggedInStore?.contactId || loggedInStore?.id,
              userName: loggedInStore?.target || loggedInStore?.name
            });
          }
        }
        alert('선택된 정책들이 일괄 정산 반영되었습니다.');
        setSelectedPolicies([]);
        await loadPolicyData();
      } catch (error) {
        console.error('일괄 정산 반영 실패:', error);
        alert('일괄 정산 반영에 실패했습니다.');
      }
    } else if (action === 'cancel') {
      const confirmed = window.confirm('선택된 정책들을 일괄 취소하시겠습니까?');
      if (!confirmed) return;

      try {
        for (const policy of selectedPolicies) {
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
      }
    }
  };

  // 일괄 복사 저장 핸들러
  const handleBulkCopySubmit = async (targetYearMonth) => {
    try {
      for (const policy of selectedPolicies) {
        if (policy.policyStatus !== '취소됨') {
          const copyData = {
            policyName: policy.policyName,
            policyStartDate: policy.policyStartDate,
            policyEndDate: policy.policyEndDate,
            policyStore: policy.policyStore,
            policyContent: policy.policyContent,
            policyAmount: policy.policyAmount,
            amountType: policy.amountType,
            policyType: policy.policyType,
            category: policy.category,
            yearMonth: targetYearMonth,
            team: policy.team,
            inputUserId: loggedInStore?.contactId || loggedInStore?.id,
            inputUserName: loggedInStore?.target || loggedInStore?.name,
            inputDateTime: new Date().toISOString(),
            approvalStatus: {
              total: '대기',
              settlement: '대기',
              team: '대기'
            }
          };
          await PolicyService.createPolicy(copyData);
        }
      }
      
      alert('선택된 정책들이 일괄 복사되었습니다.');
      setSelectedPolicies([]);
      setShowBulkCopyModal(false);
      await loadPolicyData();
    } catch (error) {
      console.error('일괄 복사 실패:', error);
      alert('일괄 복사에 실패했습니다.');
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
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip 
                        label={`${policyData[category.id] || 0}건`}
                        color="primary" 
                        variant="outlined"
                        size="small"
                      />
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
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 100 }}>
                            복수점명
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 80 }}>
                            적용점
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 120 }}>
                            업체명
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 100 }}>
                            소속정책팀
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 200 }}>
                            내용
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white', minWidth: 120 }}>
                            개통유형
                          </TableCell>
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
                            <TableCell>
                              {policy.isMultiple ? (
                                <Chip 
                                  label={policy.multipleStoreName && policy.multipleStoreName.trim() ? policy.multipleStoreName : '단일점'} 
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
                                    const conditions = [];
                                    if (policy.conditionalOptions?.addServiceAcquired) conditions.push('부가유치시');
                                    if (policy.conditionalOptions?.insuranceAcquired) conditions.push('보험유치시');
                                    if (policy.conditionalOptions?.connectionAcquired) conditions.push('연결음유치시');
                                    
                                    // 조건부에 맞는 차감지원 금액만 수집
                                    const deductItems = [];
                                    const deductAmounts = [];
                                    
                                    // 부가유치시 조건이 체크되지 않았을 때만 부가미유치 금액 표시
                                    if (!policy.conditionalOptions?.addServiceAcquired && policy.deductSupport?.addServiceAmount) {
                                      deductItems.push('📱 부가미유치');
                                      deductAmounts.push(Number(policy.deductSupport.addServiceAmount));
                                    }
                                    
                                    // 보험유치시 조건이 체크되지 않았을 때만 보험미유치 금액 표시
                                    if (!policy.conditionalOptions?.insuranceAcquired && policy.deductSupport?.insuranceAmount) {
                                      deductItems.push('🛡️ 보험미유치');
                                      deductAmounts.push(Number(policy.deductSupport.insuranceAmount));
                                    }
                                    
                                    // 연결음유치시 조건이 체크되지 않았을 때만 연결음미유치 금액 표시
                                    if (!policy.conditionalOptions?.connectionAcquired && policy.deductSupport?.connectionAmount) {
                                      deductItems.push('🔊 연결음미유치');
                                      deductAmounts.push(Number(policy.deductSupport.connectionAmount));
                                    }
                                    
                                    if (conditions.length > 0 && deductItems.length > 0) {
                                      // 모든 금액이 동일한 경우 하나의 금액으로 표시
                                      const uniqueAmounts = [...new Set(deductAmounts)];
                                      const amountText = uniqueAmounts.length === 1 
                                        ? `${uniqueAmounts[0].toLocaleString()}원`
                                        : deductAmounts.map(amount => `${amount.toLocaleString()}원`).join('/');
                                      
                                      return (
                                        <Box>
                                          <Typography variant="body2" sx={{ 
                                            fontWeight: 'bold',
                                            color: 'primary.main',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5
                                          }}>
                                            🎯 조건부: {conditions.join(', ')}
                                          </Typography>
                                          <Typography variant="body2" sx={{ 
                                            mt: 0.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            color: 'success.main'
                                          }}>
                                            💰 {deductItems.join('/')} {amountText} 차감금액지원
                                          </Typography>
                                          {policy.policyContent && policy.policyContent !== `🎯 조건부: ${conditions.join(', ')}\n💰 ${deductItems.join('/')} ${amountText} 차감금액지원` && (
                                            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                                              추가내용: {policy.policyContent}
                                            </Typography>
                                          )}
                                        </Box>
                                      );
                                    }
                                  }
                                  
                                  // 일반 정책이거나 직접입력이 있는 경우
                                  return (
                                    <>
                                      <Typography variant="body2">{policy.policyContent}</Typography>
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
                            <TableCell>
                              {(() => {
                                // 개통유형 표시 로직
                                // 부가차감/추가지원정책, 요금제유형별정책은 개통유형 선택 필드가 없으므로 "전유형"으로 표시
                                if (policy.category === 'wireless_add_deduct' || policy.category === 'wired_add_deduct' || 
                                    policy.category === 'wireless_add_support' || policy.category === 'wired_add_support' ||
                                    policy.category === 'wireless_rate' || policy.category === 'wired_rate') {
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
                    </Box>
  );
}

export default PolicyMode; 