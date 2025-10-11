import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Box,
  Chip,
  Alert,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  IconButton
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { Autocomplete } from '@mui/material';

// 정책 카테고리 매핑
const CATEGORY_NAMES = {
  'wireless_shoe': '구두정책',
  'wireless_union': '연합정책',
  'wireless_rate': '요금제유형별정책',
  'wireless_add_support': '부가추가지원정책',
  'wireless_add_deduct': '부가차감지원정책',
  'wireless_grade': '그레이드정책',
  'wireless_individual': '개별소급정책',
  'wired_shoe': '구두정책',
  'wired_union': '연합정책',
  'wired_rate': '요금제유형별정책',
  'wired_add_support': '부가추가지원정책',
  'wired_add_deduct': '부가차감지원정책',
  'wired_grade': '그레이드정책',
  'wired_individual': '개별소급정책'
};

function PolicyInputModal({ 
  open, 
  onClose, 
  categoryId, 
  yearMonth, 
  stores = [], 
  onSave,
  loggedInUser,
  teams = [], // 소속정책팀 목록 추가
  policy // 수정할 정책 데이터 추가
}) {
  const [formData, setFormData] = useState({
    policyName: '',
    policyStartDate: new Date(),
    policyEndDate: new Date(),
    policyStore: '',
    policyContent: '',
    policyAmount: '',
    amountType: 'total', // 'total', 'per_case', 'in_content'
    team: '', // 소속정책팀 추가
    storeType: 'single', // 'single' 또는 'multiple'
    multipleStores: [], // 복수점 선택 시 매장 목록
    multipleStoreName: '', // 복수점명 (수기 입력)
    // 구두정책 전용 필드
    activationType: {
      new010: false,    // 010신규
      mnp: false,       // MNP
      change: false     // 기변
    },
    // 95군 이상/미만 금액 입력
    amount95Above: '',     // 95군 이상 금액
    amount95Below: '',     // 95군 미만 금액
    isDirectInput: false,   // 직접입력 여부
    // 부가차감지원정책 전용 필드
    deductSupport: {
      addServiceAmount: '',    // 부가 미유치 금액
      insuranceAmount: '',     // 보험 미유치 금액
      connectionAmount: ''    // 연결음미유치 금액
    },
    conditionalOptions: {
      addServiceAcquired: false,    // 부가유치시
      insuranceAcquired: false,    // 보험유치시
      connectionAcquired: false    // 연결음유치시
    },
    // 부가추가지원정책 전용 필드
    addSupport: {
      uplayPremiumAmount: '',      // 유플레이(프리미엄) 유치금액
      phoneExchangePassAmount: '', // 폰교체패스 유치금액
      musicAmount: '',             // 음악감상 유치금액
      numberFilteringAmount: ''    // 지정번호필터링 유치금액
    },
    supportConditionalOptions: {
      vas2Both: false,             // VAS 2종 동시유치
      vas2Either: false,           // VAS 2종중 1개유치
      addon3All: false             // 부가3종 모두유치
    },
    // 요금제유형별정책 전용 필드
    rateSupports: [],  // 동적 배열: { modelType, rateGrade, rateRange, activationType, amount }
    // 연합정책 전용 필드
    unionSettlementStore: '',  // 정산 입금처 (단일점)
    unionTargetStores: [],     // 연합대상하부점 (복수점)
    unionConditions: {
      individualInput: false,  // 개별 입력
      postSettlement: false    // 후정산 입력
    },
    // 개별소급정책 전용 필드
    individualTarget: {
      activationDate: new Date(),  // 개통일
      customerName: '',            // 고객명
      deviceSerial: ''             // 단말일련번호
    },
    individualActivationType: ''  // 개통유형 (라디오: 'new010', 'mnp', 'change')
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 카테고리 정보
  const categoryName = CATEGORY_NAMES[categoryId] || '정책';
  const isWireless = categoryId?.startsWith('wireless');

  useEffect(() => {
    if (open) {
      if (policy) {
        // 수정 모드: 기존 정책 데이터로 폼 초기화
        setFormData({
          policyName: policy.policyName || '',
          policyStartDate: policy.policyStartDate ? new Date(policy.policyStartDate) : new Date(),
          policyEndDate: policy.policyEndDate ? new Date(policy.policyEndDate) : new Date(),
          policyStore: policy.policyStore || '',
          policyContent: policy.policyContent || '',
          policyAmount: policy.policyAmount ? String(policy.policyAmount) : '',
          amountType: policy.amountType || 'total',
          team: policy.team || loggedInUser?.userRole || '',
          storeType: 'single',
          multipleStores: [],
          multipleStoreName: '',
          activationType: {
            new010: false,
            mnp: false,
            change: false
          },
          amount95Above: '',
          amount95Below: '',
          isDirectInput: false,
          deductSupport: {
            addServiceAmount: '',
            insuranceAmount: '',
            connectionAmount: ''
          },
          conditionalOptions: {
            addServiceAcquired: false,
            insuranceAcquired: false,
            connectionAcquired: false
          },
          addSupport: policy.addSupport || {
            uplayPremiumAmount: '',
            phoneExchangePassAmount: '',
            musicAmount: '',
            numberFilteringAmount: ''
          },
          supportConditionalOptions: policy.supportConditionalOptions || {
            vas2Both: false,
            vas2Either: false,
            addon3All: false
          },
          rateSupports: policy.rateSupports || [],
          unionSettlementStore: policy.unionSettlementStore || '',
          unionTargetStores: policy.unionTargetStores || [],
          unionConditions: policy.unionConditions || {
            individualInput: false,
            postSettlement: false
          },
          individualTarget: policy.individualTarget || {
            activationDate: new Date(),
            customerName: '',
            deviceSerial: ''
          },
          individualActivationType: policy.individualActivationType || ''
        });
      } else {
        // 새 정책 생성 모드: 빈 폼으로 초기화
        setFormData({
          policyName: '',
          policyStartDate: new Date(),
          policyEndDate: new Date(),
          policyStore: '',
          policyContent: '',
          policyAmount: '',
          amountType: 'total',
          team: '', // 소속팀장을 선택하세요
          storeType: 'single',
          multipleStores: [],
          multipleStoreName: '',
          activationType: {
            new010: false,
            mnp: false,
            change: false
          },
          amount95Above: '',
          amount95Below: '',
          isDirectInput: false,
          deductSupport: {
            addServiceAmount: '',
            insuranceAmount: '',
            connectionAmount: ''
          },
          conditionalOptions: {
            addServiceAcquired: false,
            insuranceAcquired: false,
            connectionAcquired: false
          }
        });
      }
      setErrors({});
    }
  }, [open, loggedInUser, policy]);

  // 부가차감지원정책 내용 자동생성
  useEffect(() => {
    if ((categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct') && !formData.isDirectInput) {
      const conditions = [];
      if (formData.conditionalOptions?.addServiceAcquired) conditions.push('부가유치시');
      if (formData.conditionalOptions?.insuranceAcquired) conditions.push('보험유치시');
      if (formData.conditionalOptions?.connectionAcquired) conditions.push('연결음유치시');
      
      // 조건부에 맞는 차감지원 금액 수집
      const deductItems = [];
      const deductAmounts = [];
      
      // 조건부가 있는 경우: 체크되지 않은 항목만 표시
      // 조건부가 없는 경우: 모든 항목 표시
      const hasAnyCondition = conditions.length > 0;
      
      // 부가미유치 금액 (조건부가 없거나 부가유치시 조건이 체크되지 않았을 때)
      if ((!hasAnyCondition || !formData.conditionalOptions?.addServiceAcquired) && formData.deductSupport?.addServiceAmount?.trim()) {
        deductItems.push('📱 부가미유치');
        deductAmounts.push(Number(formData.deductSupport.addServiceAmount));
      }
      
      // 보험미유치 금액 (조건부가 없거나 보험유치시 조건이 체크되지 않았을 때)
      if ((!hasAnyCondition || !formData.conditionalOptions?.insuranceAcquired) && formData.deductSupport?.insuranceAmount?.trim()) {
        deductItems.push('🛡️ 보험미유치');
        deductAmounts.push(Number(formData.deductSupport.insuranceAmount));
      }
      
      // 연결음미유치 금액 (조건부가 없거나 연결음유치시 조건이 체크되지 않았을 때)
      if ((!hasAnyCondition || !formData.conditionalOptions?.connectionAcquired) && formData.deductSupport?.connectionAmount?.trim()) {
        deductItems.push('🔊 연결음미유치');
        deductAmounts.push(Number(formData.deductSupport.connectionAmount));
      }
      
      console.log('🔍 [자동생성] 디버그:', {
        hasAnyCondition,
        conditions,
        deductItems,
        deductAmounts,
        deductSupport: formData.deductSupport,
        conditionalOptions: formData.conditionalOptions
      });
      
      if (deductItems.length > 0) {
        // 모든 금액이 동일한 경우 하나의 금액으로 표시
        const uniqueAmounts = [...new Set(deductAmounts)];
        const amountText = uniqueAmounts.length === 1 
          ? `${uniqueAmounts[0].toLocaleString()}원`
          : deductAmounts.map(amount => `${amount.toLocaleString()}원`).join('/');
        
        let content;
        if (conditions.length > 0) {
          // 조건부가 있는 경우
          content = `🎯 조건부: ${conditions.join(', ')}\n💰 ${deductItems.join('/')} ${amountText} 차감금액지원`;
        } else {
          // 조건부가 없는 경우 - 모든 차감지원 금액 표시
          content = `💰 ${deductItems.join('/')} ${amountText} 차감금액지원`;
        }
        setFormData(prev => ({ ...prev, policyContent: content }));
      } else {
        // 차감지원 금액이 없는 경우 내용 초기화
        setFormData(prev => ({ ...prev, policyContent: '' }));
      }
    }
  }, [formData.deductSupport, formData.conditionalOptions, formData.isDirectInput, categoryId]);

  // 부가추가지원정책 내용 자동생성
  useEffect(() => {
    if ((categoryId === 'wireless_add_support' || categoryId === 'wired_add_support') && !formData.isDirectInput) {
      const conditions = [];
      if (formData.supportConditionalOptions?.vas2Both) conditions.push('VAS 2종 동시유치');
      if (formData.supportConditionalOptions?.vas2Either) conditions.push('VAS 2종중 1개유치');
      if (formData.supportConditionalOptions?.addon3All) conditions.push('부가3종 모두유치');
      
      // 추가지원 금액 수집
      const supportItems = [];
      const supportAmounts = [];
      
      // 유플레이(프리미엄) 유치금액
      if (formData.addSupport?.uplayPremiumAmount?.trim()) {
        supportItems.push('📺 유플레이(프리미엄)');
        supportAmounts.push(Number(formData.addSupport.uplayPremiumAmount));
      }
      
      // 폰교체패스 유치금액
      if (formData.addSupport?.phoneExchangePassAmount?.trim()) {
        supportItems.push('📱 폰교체패스');
        supportAmounts.push(Number(formData.addSupport.phoneExchangePassAmount));
      }
      
      // 음악감상 유치금액
      if (formData.addSupport?.musicAmount?.trim()) {
        supportItems.push('🎵 음악감상');
        supportAmounts.push(Number(formData.addSupport.musicAmount));
      }
      
      // 지정번호필터링 유치금액
      if (formData.addSupport?.numberFilteringAmount?.trim()) {
        supportItems.push('🔢 지정번호필터링');
        supportAmounts.push(Number(formData.addSupport.numberFilteringAmount));
      }
      
      if (supportItems.length > 0) {
        // 모든 금액이 동일한 경우 하나의 금액으로 표시
        const uniqueAmounts = [...new Set(supportAmounts)];
        const amountText = uniqueAmounts.length === 1 
          ? `${uniqueAmounts[0].toLocaleString()}원`
          : supportAmounts.map(amount => `${amount.toLocaleString()}원`).join('/');
        
        let content;
        if (conditions.length > 0) {
          // 조건부가 있는 경우
          content = `🎯 조건부: ${conditions.join(', ')}\n💰 ${supportItems.join('/')} ${amountText} 추가금액지원`;
        } else {
          // 조건부가 없는 경우 - 모든 추가지원 금액 표시
          content = `💰 ${supportItems.join('/')} ${amountText} 추가금액지원`;
        }
        setFormData(prev => ({ ...prev, policyContent: content }));
      } else {
        // 추가지원 금액이 없는 경우 내용 초기화
        setFormData(prev => ({ ...prev, policyContent: '' }));
      }
    }
  }, [formData.addSupport, formData.supportConditionalOptions, formData.isDirectInput, categoryId]);

  // 요금제유형별정책 내용 자동생성
  useEffect(() => {
    if ((categoryId === 'wireless_rate' || categoryId === 'wired_rate') && !formData.isDirectInput) {
      if (formData.rateSupports && formData.rateSupports.length > 0) {
        // 모델유형/요금제군(+범위)/금액이 동일한 것끼리 그룹핑 → 유형만 나열
        const grouped = {};
        
        formData.rateSupports.forEach(item => {
          if (item.modelType && item.rateGrade && item.activationType && item.amount) {
            const rateGradeText = item.rateRange && item.rateRange !== '해당군' 
              ? `${item.rateGrade} ${item.rateRange}` 
              : item.rateGrade;
            const key = `${item.modelType}|${rateGradeText}|${item.amount}`;
            if (!grouped[key]) {
              grouped[key] = {
                modelType: item.modelType,
                rateGradeText: rateGradeText,
                activationTypes: [],
                amount: item.amount
              };
            }
            grouped[key].activationTypes.push(item.activationType);
          }
        });
        
        // 자동문구 생성
        const lines = Object.values(grouped).map(group => {
          const types = group.activationTypes.join(', ');
          const amountNum = Number(group.amount);
          // 10,000원 단위로 +X만 형식으로 변환
          const amountText = (amountNum >= 10000 && amountNum % 10000 === 0) 
            ? `+${amountNum / 10000}만`
            : `+${amountNum.toLocaleString()}원`;
          return `💰 ${group.modelType} / ${group.rateGradeText} / ${types} / ${amountText}`;
        });
        
        if (lines.length > 0) {
          const content = lines.join('\n');
          setFormData(prev => ({ ...prev, policyContent: content }));
        } else {
          setFormData(prev => ({ ...prev, policyContent: '' }));
        }
      } else {
        setFormData(prev => ({ ...prev, policyContent: '' }));
      }
    }
  }, [formData.rateSupports, formData.isDirectInput, categoryId]);

  // 연합정책 내용 자동생성
  useEffect(() => {
    if ((categoryId === 'wireless_union' || categoryId === 'wired_union') && !formData.isDirectInput) {
      const parts = [];
      
      // 1. 정산 입금처
      if (formData.unionSettlementStore) {
        parts.push(`🏢 정산 입금처: ${formData.unionSettlementStore}`);
      }
      
      // 2. 연합대상하부점
      if (formData.unionTargetStores?.length > 0) {
        parts.push('\n🏪 연합대상하부점:');
        formData.unionTargetStores.forEach(store => {
          parts.push(`   - ${store}`);
        });
      }
      
      // 3. 지원금액
      if (formData.policyAmount) {
        const amountNum = Number(formData.policyAmount);
        const amountText = (amountNum >= 10000 && amountNum % 10000 === 0) 
          ? `${amountNum / 10000}만원`
          : `${amountNum.toLocaleString()}원`;
        const amountTypeText = formData.amountType === 'total' ? '총금액' : '건당금액';
        parts.push(`\n💰 지원금액: ${amountText} (${amountTypeText})`);
      }
      
      // 4. 조건 (조건이 있을 때만 표시)
      const conditions = [];
      if (formData.unionConditions?.individualInput) conditions.push('개별 입력');
      if (formData.unionConditions?.postSettlement) conditions.push('후정산 입력');
      
      if (conditions.length > 0) {
        parts.push(`\n📌 조건: ${conditions.join(', ')}`);
      }
      
      if (parts.length > 0) {
        const content = parts.join('\n');
        setFormData(prev => ({ ...prev, policyContent: content }));
      } else {
        setFormData(prev => ({ ...prev, policyContent: '' }));
      }
    }
  }, [formData.unionSettlementStore, formData.unionTargetStores, formData.policyAmount, formData.amountType, formData.unionConditions, formData.isDirectInput, categoryId]);

  // 개별소급정책 내용 자동생성
  useEffect(() => {
    if ((categoryId === 'wireless_individual' || categoryId === 'wired_individual') && !formData.isDirectInput) {
      const parts = [];
      
      // 1. 개통일
      if (formData.individualTarget?.activationDate) {
        const dateStr = new Date(formData.individualTarget.activationDate).toLocaleDateString('ko-KR');
        parts.push(`📅 개통일: ${dateStr}`);
      }
      
      // 2. 고객명
      if (formData.individualTarget?.customerName) {
        parts.push(`👤 고객명: ${formData.individualTarget.customerName}`);
      }
      
      // 3. 단말일련번호
      if (formData.individualTarget?.deviceSerial) {
        parts.push(`📱 단말일련번호: ${formData.individualTarget.deviceSerial}`);
      }
      
      if (parts.length > 0) {
        const content = parts.join('\n');
        setFormData(prev => ({ ...prev, policyContent: content }));
      } else {
        setFormData(prev => ({ ...prev, policyContent: '' }));
      }
    }
  }, [formData.individualTarget, formData.isDirectInput, categoryId]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.policyName.trim()) {
      newErrors.policyName = '정책명을 입력해주세요.';
    }
    
    if (!formData.policyStartDate) {
      newErrors.policyStartDate = '정책 시작일을 선택해주세요.';
    }
    
    if (!formData.policyEndDate) {
      newErrors.policyEndDate = '정책 종료일을 선택해주세요.';
    }
    
    if (formData.policyStartDate && formData.policyEndDate && 
        formData.policyStartDate > formData.policyEndDate) {
      newErrors.policyEndDate = '종료일은 시작일보다 늦어야 합니다.';
    }
    
    // 연합정책이 아닐 때만 정책적용점 검증
    if (categoryId !== 'wireless_union' && categoryId !== 'wired_union') {
      if (formData.storeType === 'single' && !formData.policyStore) {
        newErrors.policyStore = '정책적용점을 선택해주세요.';
      }
      
      if (formData.storeType === 'multiple' && formData.multipleStores.length === 0) {
        newErrors.multipleStores = '적용점을 최소 1개 이상 선택해주세요.';
      }
      
      if (formData.storeType === 'multiple' && !formData.multipleStoreName.trim()) {
        newErrors.multipleStoreName = '복수점명을 입력해주세요.';
      }
    }
    
    // 단일점 선택일 때는 복수점명 검증하지 않음
    if (formData.storeType === 'single') {
      // 복수점명 관련 오류 제거
      delete newErrors.multipleStoreName;
    }
    
    // 부가차감지원정책 차감지원설정 검사 (직접입력이 아닐 때만)
    if ((categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct') && !formData.isDirectInput) {
      const hasAnyAmount = (formData.deductSupport?.addServiceAmount || '').trim() || 
                          (formData.deductSupport?.insuranceAmount || '').trim() || 
                          (formData.deductSupport?.connectionAmount || '').trim();
      if (!hasAnyAmount) {
        newErrors.deductSupport = '차감지원 금액을 최소 하나 입력해주세요.';
      }
      
      // 조건부 옵션 검사
      const hasAnyCondition = (formData.conditionalOptions?.addServiceAcquired || false) || 
                             (formData.conditionalOptions?.insuranceAcquired || false) || 
                             (formData.conditionalOptions?.connectionAcquired || false);
      if (!hasAnyCondition) {
        newErrors.conditionalOptions = '조건부 옵션을 최소 하나 선택해주세요.';
      }
    }

    // 부가추가지원정책 추가지원설정 검사 (직접입력이 아닐 때만)
    if ((categoryId === 'wireless_add_support' || categoryId === 'wired_add_support') && !formData.isDirectInput) {
      const hasAnyAmount = (formData.addSupport?.uplayPremiumAmount || '').trim() || 
                          (formData.addSupport?.phoneExchangePassAmount || '').trim() || 
                          (formData.addSupport?.musicAmount || '').trim() ||
                          (formData.addSupport?.numberFilteringAmount || '').trim();
      if (!hasAnyAmount) {
        newErrors.addSupport = '추가지원 금액을 최소 하나 입력해주세요.';
      }
    }

    // 요금제유형별정책 지원사항 검사 (직접입력이 아닐 때만)
    if ((categoryId === 'wireless_rate' || categoryId === 'wired_rate') && !formData.isDirectInput) {
      if (!formData.rateSupports || formData.rateSupports.length === 0) {
        newErrors.rateSupports = '지원사항을 최소 1개 이상 추가해주세요.';
      } else {
        // 각 행의 필드 검증 (rateRange는 선택사항이므로 제외)
        const hasIncompleteRow = formData.rateSupports.some(item => 
          !item.modelType || !item.rateGrade || !item.activationType || !item.amount
        );
        if (hasIncompleteRow) {
          newErrors.rateSupports = '모든 지원사항의 필수 필드를 입력해주세요.';
        }
      }
    }

    // 연합정책 필드 검사 (직접입력이 아닐 때만)
    if ((categoryId === 'wireless_union' || categoryId === 'wired_union') && !formData.isDirectInput) {
      if (!formData.unionSettlementStore) {
        newErrors.unionSettlementStore = '정산 입금처를 선택해주세요.';
      }
      if (!formData.unionTargetStores?.length) {
        newErrors.unionTargetStores = '연합대상하부점을 최소 1개 이상 선택해주세요.';
      }
    }

    // 개별소급정책 필드 검사 (직접입력이 아닐 때만)
    if ((categoryId === 'wireless_individual' || categoryId === 'wired_individual') && !formData.isDirectInput) {
      if (!formData.individualTarget?.activationDate) {
        newErrors.individualActivationDate = '개통일을 선택해주세요.';
      }
      if (!formData.individualTarget?.customerName?.trim()) {
        newErrors.individualCustomerName = '고객명을 입력해주세요.';
      }
      if (!formData.individualTarget?.deviceSerial?.trim()) {
        newErrors.individualDeviceSerial = '단말일련번호를 입력해주세요.';
      }
      if (!formData.individualActivationType) {
        newErrors.individualActivationType = '개통유형을 선택해주세요.';
      }
    }

    // 구두정책 개통유형 검사
    if (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe') {
      const hasAnyActivationType = formData.activationType.new010 || formData.activationType.mnp || formData.activationType.change;
      if (!hasAnyActivationType) {
        newErrors.activationType = '개통유형을 최소 1개 이상 선택해주세요.';
      }
      
      // 95군 이상/미만 금액 검사
      if (!formData.isDirectInput) {
        if (!formData.amount95Above.trim()) {
          newErrors.amount95Above = '95군 이상 금액을 입력해주세요.';
        }
        if (!formData.amount95Below.trim()) {
          newErrors.amount95Below = '95군 미만 금액을 입력해주세요.';
        }
      }
    }
    
    // 정책내용 검사 - 구두정책이나 부가차감지원정책, 부가추가지원정책, 요금제유형별정책이 아니거나 직접입력이 체크된 경우에만 필수
    const isShoePolicy = categoryId === 'wireless_shoe' || categoryId === 'wired_shoe';
    const isAddDeductPolicy = categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct';
    const isAddSupportPolicy = categoryId === 'wireless_add_support' || categoryId === 'wired_add_support';
    const isRatePolicy = categoryId === 'wireless_rate' || categoryId === 'wired_rate';
    if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicy || formData.isDirectInput) {
      if (!formData.policyContent.trim()) {
        newErrors.policyContent = '정책내용을 입력해주세요.';
      }
    }
    
    // 금액 입력 방식에 따른 검증 (구두정책이나 부가차감지원정책, 부가추가지원정책, 요금제유형별정책이 아닌 경우에만)
    if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicy && formData.amountType !== 'in_content') {
      if (!formData.policyAmount.trim()) {
        newErrors.policyAmount = '금액을 입력해주세요.';
      } else if (isNaN(Number(formData.policyAmount))) {
        newErrors.policyAmount = '올바른 금액을 입력해주세요.';
      }
    }
    
    // 금액 유형 검사 (구두정책이나 부가차감지원정책, 부가추가지원정책, 요금제유형별정책이 아닌 경우에만)
    if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicy && !formData.amountType) {
      newErrors.amountType = '금액 유형을 선택해주세요.';
    }
    
    if (!formData.team) {
      newErrors.team = '소속정책팀을 선택해주세요.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      // 구체적인 에러 메시지 표시
      const errorFields = Object.keys(errors);
      if (errorFields.length > 0) {
        const fieldNames = {
          policyName: '정책명',
          policyStartDate: '정책 시작일',
          policyEndDate: '정책 종료일',
          policyStore: '정책적용점',
          policyContent: '정책내용',
          policyAmount: '금액',
          amountType: '금액 유형',
          team: '소속정책팀'
        };
        const errorFieldNames = errorFields.map(field => fieldNames[field] || field).join(', ');
        setErrors({ submit: `다음 필수 입력란을 확인해주세요: [${errorFieldNames}]` });
      }
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (policy) {
        // 수정 모드
        const updateData = {
          policyName: formData.policyName.trim(),
          policyStartDate: formData.policyStartDate,
          policyEndDate: formData.policyEndDate,
          policyStore: formData.policyStore,
          policyContent: formData.policyContent.trim(),
          policyAmount: (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct' || categoryId === 'wireless_add_support' || categoryId === 'wired_add_support' || categoryId === 'wireless_rate' || categoryId === 'wired_rate') ? '' : (formData.amountType === 'in_content' ? '' : Number(formData.policyAmount)),
          amountType: (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct' || categoryId === 'wireless_add_support' || categoryId === 'wired_add_support' || categoryId === 'wireless_rate' || categoryId === 'wired_rate') ? '' : formData.amountType,
          policyType: isWireless ? '무선' : '유선',
          category: categoryId,
          yearMonth: yearMonth,
          policyTeam: (() => {
            // 팀 코드를 팀 이름으로 변환
            const selectedTeam = teams.find(team => team.code === formData.team);
            return selectedTeam ? selectedTeam.name : formData.team;
          })(),
          inputUserId: loggedInUser?.contactId || loggedInUser?.id,
          inputUserName: loggedInUser?.target || loggedInUser?.name,
          modifiedBy: loggedInUser?.contactId || loggedInUser?.id,
          modifiedByName: loggedInUser?.target || loggedInUser?.name,
          modifiedAt: new Date().toISOString(),
          activationType: formData.activationType, // 개통유형
          amount95Above: formData.amount95Above, // 95군이상금액
          amount95Below: formData.amount95Below, // 95군미만금액
          // 부가차감지원정책 데이터
          deductSupport: formData.deductSupport,
          conditionalOptions: formData.conditionalOptions,
          // 부가추가지원정책 데이터
          addSupport: formData.addSupport,
          supportConditionalOptions: formData.supportConditionalOptions,
          // 요금제유형별정책 데이터
          rateSupports: formData.rateSupports,
          // 연합정책 데이터
          unionSettlementStore: formData.unionSettlementStore,
          unionTargetStores: formData.unionTargetStores,
          unionConditions: formData.unionConditions,
          // 개별소급정책 데이터
          individualTarget: formData.individualTarget,
          individualActivationType: formData.individualActivationType
        };

        await onSave(policy.id, updateData);
      } else {
        // 새 정책 생성 모드
        if (formData.storeType === 'single') {
          // 단일점 선택
          const policyData = {
            id: `POL_${Date.now()}`, // 임시 ID 생성
            policyName: formData.policyName.trim(),
            policyStartDate: formData.policyStartDate,
            policyEndDate: formData.policyEndDate,
            policyStore: formData.policyStore,
            policyContent: formData.policyContent.trim(),
            policyAmount: (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct') ? '' : (formData.amountType === 'in_content' ? '' : Number(formData.policyAmount)),
            amountType: (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct') ? '' : formData.amountType,
            policyType: isWireless ? '무선' : '유선',
            category: categoryId,
            yearMonth: yearMonth,
            inputUserId: loggedInUser?.contactId || loggedInUser?.id,
            inputUserName: loggedInUser?.target || loggedInUser?.name,
            inputDateTime: new Date().toISOString(),
            approvalStatus: {
              total: '대기',
              settlement: '대기',
              team: '대기'
            },
            policyTeam: (() => {
              // 팀 코드를 팀 이름으로 변환
              const selectedTeam = teams.find(team => team.code === formData.team);
              return selectedTeam ? selectedTeam.name : formData.team;
            })(), // 소속정책팀 추가
            activationType: formData.activationType, // 개통유형
            // 구두정책용 필드 (부가차감지원정책에서는 제외)
            ...(categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' ? {
              amount95Above: formData.amount95Above, // 95군이상금액
              amount95Below: formData.amount95Below, // 95군미만금액
            } : {}),
            // 부가차감지원정책 데이터 추가
            deductSupport: formData.deductSupport,
            conditionalOptions: formData.conditionalOptions,
            // 부가추가지원정책 데이터 추가
            addSupport: formData.addSupport,
            supportConditionalOptions: formData.supportConditionalOptions,
            // 요금제유형별정책 데이터 추가
            rateSupports: formData.rateSupports,
            // 연합정책 데이터 추가
            unionSettlementStore: formData.unionSettlementStore,
            unionTargetStores: formData.unionTargetStores,
            unionConditions: formData.unionConditions,
            // 개별소급정책 데이터 추가
            individualTarget: formData.individualTarget,
            individualActivationType: formData.individualActivationType,
            multipleStoreName: formData.multipleStoreName || ''
          };

          await onSave(policyData);
        } else {
          // 복수점 선택 - 각 매장별로 개별 정책 생성
          const policies = formData.multipleStores.map((store, index) => ({
            id: `POL_${Date.now()}_${index}`, // 임시 ID 생성
            policyName: formData.policyName.trim(),
            policyStartDate: formData.policyStartDate,
            policyEndDate: formData.policyEndDate,
            policyStore: store.id,
            policyContent: formData.policyContent.trim(),
            policyAmount: (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct') ? '' : (formData.amountType === 'in_content' ? '' : Number(formData.policyAmount)),
            amountType: (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct') ? '' : formData.amountType,
            policyType: isWireless ? '무선' : '유선',
            category: categoryId,
            yearMonth: yearMonth,
            inputUserId: loggedInUser?.contactId || loggedInUser?.id,
            inputUserName: loggedInUser?.target || loggedInUser?.name,
            inputDateTime: new Date().toISOString(),
            approvalStatus: {
              total: '대기',
              settlement: '대기',
              team: '대기'
            },
            policyTeam: (() => {
              // 팀 코드를 팀 이름으로 변환
              const selectedTeam = teams.find(team => team.code === formData.team);
              return selectedTeam ? selectedTeam.name : formData.team;
            })(),
            isMultiple: true, // 복수점 정책임을 표시
            multipleStoreName: formData.multipleStoreName, // 사용자가 입력한 복수점명
            activationType: formData.activationType, // 개통유형
            // 구두정책용 필드 (부가차감지원정책에서는 제외)
            ...(categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' ? {
              amount95Above: formData.amount95Above, // 95군이상금액
              amount95Below: formData.amount95Below, // 95군미만금액
            } : {}),
            // 부가차감지원정책 데이터 추가
            deductSupport: formData.deductSupport,
            conditionalOptions: formData.conditionalOptions,
            // 부가추가지원정책 데이터 추가
            addSupport: formData.addSupport,
            supportConditionalOptions: formData.supportConditionalOptions,
            // 요금제유형별정책 데이터 추가
            rateSupports: formData.rateSupports,
            // 연합정책 데이터 추가
            unionSettlementStore: formData.unionSettlementStore,
            unionTargetStores: formData.unionTargetStores,
            unionConditions: formData.unionConditions,
            // 개별소급정책 데이터 추가
            individualTarget: formData.individualTarget,
            individualActivationType: formData.individualActivationType
          }));

          // 각 정책을 순차적으로 저장
          for (const policyData of policies) {
            await onSave(policyData);
          }
        }
      }
      
      onClose();
    } catch (error) {
      console.error('정책 저장 실패:', error);
      
      // 서버에서 받은 에러 메시지가 있으면 사용, 없으면 기본 메시지
      let errorMessage = '정책 저장에 실패했습니다. 다시 시도해주세요.';
      
      if (error.message) {
        // HTTP 에러 응답에서 메시지 추출
        try {
          if (error.message.includes('HTTP error! status: 400')) {
            // 서버 응답에서 누락된 필드 정보 추출 시도
            if (error.response && error.response.data) {
              const responseData = error.response.data;
              
              // 서버에서 제공한 구체적인 오류 메시지 사용
              if (responseData.error) {
                errorMessage = responseData.error;
              } else if (responseData.missingFieldNames && responseData.missingFieldNames.length > 0) {
                errorMessage = `다음 필수 항목이 누락되었습니다: ${responseData.missingFieldNames.join(', ')}`;
              } else if (responseData.received) {
                const received = responseData.received;
                const missingFields = [];
                
                // 필드명 매핑
                const fieldNames = {
                  policyName: '정책명',
                  policyStartDate: '정책 시작일',
                  policyEndDate: '정책 종료일',
                  policyStore: '정책적용점',
                  policyContent: '정책내용',
                  policyAmount: '금액',
                  amountType: '금액 유형',
                  team: '소속정책팀'
                };
                
                // 누락된 필드 확인
                Object.keys(fieldNames).forEach(field => {
                  if (!received[field] || received[field] === '') {
                    missingFields.push(fieldNames[field]);
                  }
                });
                
                if (missingFields.length > 0) {
                  errorMessage = `다음 필수 입력란을 확인해주세요: [${missingFields.join(', ')}]`;
                } else {
                  errorMessage = '입력 정보를 확인해주세요. 필수 항목이 누락되었거나 형식이 올바르지 않습니다.';
                }
              } else {
                errorMessage = '입력 정보를 확인해주세요. 필수 항목이 누락되었거나 형식이 올바르지 않습니다.';
              }
            } else {
              errorMessage = '입력 정보를 확인해주세요. 필수 항목이 누락되었거나 형식이 올바르지 않습니다.';
            }
          } else if (error.message.includes('HTTP error! status: 404')) {
            errorMessage = '정책을 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.';
          } else if (error.message.includes('HTTP error! status: 500')) {
            errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
          } else {
            errorMessage = error.message;
          }
        } catch (parseError) {
          // 파싱 실패 시 기본 메시지 사용
          errorMessage = '정책 저장에 실패했습니다. 다시 시도해주세요.';
        }
      }
      
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    // 숫자 필드에 대한 유효성 검사
    if (field === 'policyAmount' && value !== '') {
      // 숫자가 아닌 문자 제거 (소수점과 음수 부호는 허용)
      const numericValue = value.toString().replace(/[^\d.-]/g, '');
      if (numericValue !== value) {
        value = numericValue;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 에러 메시지 제거
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">
            {policy ? `${categoryName} 수정` : `${categoryName} 추가`}
          </Typography>
          <Chip 
            label={isWireless ? '무선' : '유선'} 
            color={isWireless ? 'primary' : 'secondary'}
            size="small"
          />
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {errors.submit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.submit}
          </Alert>
        )}
        
        {/* 수정 모드일 때 현재 승인 상태 표시 */}
        {policy && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>현재 승인 상태:</strong><br />
              총괄: {policy.approvalStatus?.total || '대기'} | 
              정산팀: {policy.approvalStatus?.settlement || '대기'} | 
              소속팀: {policy.approvalStatus?.team || '대기'}<br />
              <em>참고: 정책 수정 후 승인 상태는 변경되지 않습니다.</em>
            </Typography>
          </Alert>
        )}
        
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="정책명"
              value={formData.policyName}
              onChange={(e) => handleInputChange('policyName', e.target.value)}
              error={!!errors.policyName}
              helperText={errors.policyName}
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <DatePicker
                label="정책 시작일"
                value={formData.policyStartDate}
                onChange={(date) => handleInputChange('policyStartDate', date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.policyStartDate,
                    helperText: errors.policyStartDate,
                    required: true
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <DatePicker
                label="정책 종료일"
                value={formData.policyEndDate}
                onChange={(date) => handleInputChange('policyEndDate', date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.policyEndDate,
                    helperText: errors.policyEndDate,
                    required: true
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>
          
          {/* 연합정책이 아닐 때만 적용점 타입 선택 표시 */}
          {categoryId !== 'wireless_union' && categoryId !== 'wired_union' && (
            <Grid item xs={12}>
              <FormControl component="fieldset">
                <Typography variant="subtitle2" gutterBottom>
                  적용점 선택 방식
                </Typography>
                <RadioGroup
                  row
                  value={formData.storeType}
                  onChange={(e) => {
                    handleInputChange('storeType', e.target.value);
                    // 타입 변경 시 기존 선택 초기화
                    if (e.target.value === 'single') {
                      handleInputChange('multipleStores', []);
                    } else {
                      handleInputChange('policyStore', '');
                    }
                  }}
                >
                  <FormControlLabel value="single" control={<Radio />} label="단일점" />
                  <FormControlLabel value="multiple" control={<Radio />} label="복수점" />
                </RadioGroup>
              </FormControl>
            </Grid>
          )}

          {/* 단일점 선택 */}
          {categoryId !== 'wireless_union' && categoryId !== 'wired_union' && formData.storeType === 'single' && (
            <Grid item xs={12}>
              <Autocomplete
                options={stores}
                getOptionLabel={(option) => option.name}
                value={stores.find(store => store.id === formData.policyStore) || null}
                onChange={(event, newValue) => {
                  handleInputChange('policyStore', newValue ? newValue.id : '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="정책적용점"
                    error={!!errors.policyStore}
                    helperText={errors.policyStore}
                    required
                  />
                )}
                filterOptions={(options, { inputValue }) => {
                  return options.filter((option) =>
                    option.name.toLowerCase().includes(inputValue.toLowerCase())
                  );
                }}
              />
            </Grid>
          )}

          {/* 복수점 선택 */}
          {categoryId !== 'wireless_union' && categoryId !== 'wired_union' && formData.storeType === 'multiple' && (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="복수점명"
                  value={formData.multipleStoreName}
                  onChange={(e) => handleInputChange('multipleStoreName', e.target.value)}
                  error={!!errors.multipleStoreName}
                  helperText={errors.multipleStoreName || '복수점의 이름을 입력해주세요. (예: 서울지역, 강남구 등)'}
                  required
                  placeholder="예: 서울지역, 강남구, A그룹 등"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    적용점 선택 (복수 선택 가능)
                  </Typography>
                  <Autocomplete
                    multiple
                    options={stores}
                    getOptionLabel={(option) => option.name}
                    value={formData.multipleStores}
                    onChange={(event, newValue) => {
                      handleInputChange('multipleStores', newValue);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="정책적용점들"
                        error={!!errors.multipleStores}
                        helperText={errors.multipleStores || '여러 매장을 선택할 수 있습니다.'}
                        required
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="outlined"
                          label={option.name}
                          {...getTagProps({ index })}
                          key={option.id}
                        />
                      ))
                    }
                    filterOptions={(options, { inputValue }) => {
                      return options.filter((option) =>
                        option.name.toLowerCase().includes(inputValue.toLowerCase())
                      );
                    }}
                  />
                </Box>
              </Grid>
            </>
          )}
          
          {/* 구두정책 전용: 개통유형 선택 */}
          {categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' ? (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                개통유형 *
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.activationType.new010}
                      onChange={(e) => {
                        const newActivationType = {
                          ...formData.activationType,
                          new010: e.target.checked
                        };
                        handleInputChange('activationType', newActivationType);
                      }}
                    />
                  }
                  label="010신규"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.activationType.mnp}
                      onChange={(e) => {
                        const newActivationType = {
                          ...formData.activationType,
                          mnp: e.target.checked
                        };
                        handleInputChange('activationType', newActivationType);
                      }}
                    />
                  }
                  label="MNP"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.activationType.change}
                      onChange={(e) => {
                        const newActivationType = {
                          ...formData.activationType,
                          change: e.target.checked
                        };
                        handleInputChange('activationType', newActivationType);
                      }}
                    />
                  }
                  label="기변"
                />
              </Box>
              {errors.activationType && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  {errors.activationType}
                </Typography>
              )}
            </Grid>
          ) : null}

          {/* 구두정책 전용: 95군 이상/미만 금액 입력 */}
          {categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' ? (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                금액 설정 *
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: 80 }}>95군이상</Typography>
                  <TextField
                    size="small"
                    value={formData.amount95Above}
                    onChange={(e) => handleInputChange('amount95Above', e.target.value)}
                    placeholder="금액 입력"
                    type="number"
                    sx={{ width: 120 }}
                    inputProps={{ min: 0 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: 80 }}>95군미만</Typography>
                  <TextField
                    size="small"
                    value={formData.amount95Below}
                    onChange={(e) => handleInputChange('amount95Below', e.target.value)}
                    placeholder="금액 입력"
                    type="number"
                    sx={{ width: 120 }}
                    inputProps={{ min: 0 }}
                  />
                </Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isDirectInput}
                      onChange={(e) => handleInputChange('isDirectInput', e.target.checked)}
                    />
                  }
                  label="직접입력"
                />
              </Box>
              {errors.amount95Above && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  {errors.amount95Above}
                </Typography>
              )}
              {errors.amount95Below && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  {errors.amount95Below}
                </Typography>
              )}
            </Grid>
          ) : null}

          {/* 부가차감지원정책 전용: 차감지원설정 */}
          {categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct' ? (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  차감지원설정 *
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                  <TextField
                    label="부가미유치 금액"
                    value={formData.deductSupport?.addServiceAmount || ''}
                    onChange={(e) => handleInputChange('deductSupport', {
                      ...(formData.deductSupport || {}),
                      addServiceAmount: e.target.value
                    })}
                    type="number"
                    inputProps={{ min: 0 }}
                    sx={{ width: 150 }}
                    placeholder="금액 입력"
                  />
                  <TextField
                    label="보험미유치 금액"
                    value={formData.deductSupport?.insuranceAmount || ''}
                    onChange={(e) => handleInputChange('deductSupport', {
                      ...(formData.deductSupport || {}),
                      insuranceAmount: e.target.value
                    })}
                    type="number"
                    inputProps={{ min: 0 }}
                    sx={{ width: 150 }}
                    placeholder="금액 입력"
                  />
                  <TextField
                    label="연결음미유치 금액"
                    value={formData.deductSupport?.connectionAmount || ''}
                    onChange={(e) => handleInputChange('deductSupport', {
                      ...(formData.deductSupport || {}),
                      connectionAmount: e.target.value
                    })}
                    type="number"
                    inputProps={{ min: 0 }}
                    sx={{ width: 150 }}
                    placeholder="금액 입력"
                  />
                </Box>
                {errors.deductSupport && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    {errors.deductSupport}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  조건부 *
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.conditionalOptions?.addServiceAcquired || false}
                        onChange={(e) => handleInputChange('conditionalOptions', {
                          ...(formData.conditionalOptions || {}),
                          addServiceAcquired: e.target.checked
                        })}
                      />
                    }
                    label="부가유치시"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.conditionalOptions?.insuranceAcquired || false}
                        onChange={(e) => handleInputChange('conditionalOptions', {
                          ...(formData.conditionalOptions || {}),
                          insuranceAcquired: e.target.checked
                        })}
                      />
                    }
                    label="보험유치시"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.conditionalOptions?.connectionAcquired || false}
                        onChange={(e) => handleInputChange('conditionalOptions', {
                          ...(formData.conditionalOptions || {}),
                          connectionAcquired: e.target.checked
                        })}
                      />
                    }
                    label="연결음유치시"
                  />
                </Box>
                {errors.conditionalOptions && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    {errors.conditionalOptions}
                  </Typography>
                )}
                
                {/* 직접입력 체크박스 */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isDirectInput}
                      onChange={(e) => handleInputChange('isDirectInput', e.target.checked)}
                    />
                  }
                  label="직접입력"
                />
              </Grid>
            </>
          ) : null}

          {/* 부가추가지원정책 전용: 추가지원설정 */}
          {categoryId === 'wireless_add_support' || categoryId === 'wired_add_support' ? (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  추가지원설정 *
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                  <TextField
                    label="유플레이(프리미엄) 유치금액"
                    value={formData.addSupport?.uplayPremiumAmount || ''}
                    onChange={(e) => handleInputChange('addSupport', {
                      ...(formData.addSupport || {}),
                      uplayPremiumAmount: e.target.value
                    })}
                    type="number"
                    inputProps={{ min: 0 }}
                    sx={{ width: 200 }}
                    placeholder="금액 입력"
                  />
                  <TextField
                    label="폰교체패스 유치금액"
                    value={formData.addSupport?.phoneExchangePassAmount || ''}
                    onChange={(e) => handleInputChange('addSupport', {
                      ...(formData.addSupport || {}),
                      phoneExchangePassAmount: e.target.value
                    })}
                    type="number"
                    inputProps={{ min: 0 }}
                    sx={{ width: 200 }}
                    placeholder="금액 입력"
                  />
                  <TextField
                    label="음악감상 유치금액"
                    value={formData.addSupport?.musicAmount || ''}
                    onChange={(e) => handleInputChange('addSupport', {
                      ...(formData.addSupport || {}),
                      musicAmount: e.target.value
                    })}
                    type="number"
                    inputProps={{ min: 0 }}
                    sx={{ width: 200 }}
                    placeholder="금액 입력"
                  />
                  <TextField
                    label="지정번호필터링 유치금액"
                    value={formData.addSupport?.numberFilteringAmount || ''}
                    onChange={(e) => handleInputChange('addSupport', {
                      ...(formData.addSupport || {}),
                      numberFilteringAmount: e.target.value
                    })}
                    type="number"
                    inputProps={{ min: 0 }}
                    sx={{ width: 200 }}
                    placeholder="금액 입력"
                  />
                </Box>
                {errors.addSupport && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    {errors.addSupport}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  조건부 (선택사항)
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.supportConditionalOptions?.vas2Both || false}
                        onChange={(e) => handleInputChange('supportConditionalOptions', {
                          ...(formData.supportConditionalOptions || {}),
                          vas2Both: e.target.checked
                        })}
                      />
                    }
                    label="VAS 2종 동시유치"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.supportConditionalOptions?.vas2Either || false}
                        onChange={(e) => handleInputChange('supportConditionalOptions', {
                          ...(formData.supportConditionalOptions || {}),
                          vas2Either: e.target.checked
                        })}
                      />
                    }
                    label="VAS 2종중 1개유치"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.supportConditionalOptions?.addon3All || false}
                        onChange={(e) => handleInputChange('supportConditionalOptions', {
                          ...(formData.supportConditionalOptions || {}),
                          addon3All: e.target.checked
                        })}
                      />
                    }
                    label="부가3종 모두유치"
                  />
                </Box>
                
                {/* 직접입력 체크박스 */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isDirectInput}
                      onChange={(e) => handleInputChange('isDirectInput', e.target.checked)}
                    />
                  }
                  label="직접입력"
                />
              </Grid>
            </>
          ) : null}

          {/* 요금제유형별정책 전용: 지원사항 */}
          {categoryId === 'wireless_rate' || categoryId === 'wired_rate' ? (
            <>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">
                    지원사항 *
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      const newSupports = [...(formData.rateSupports || []), { modelType: '', rateGrade: '', rateRange: '해당군', activationType: '', amount: '' }];
                      handleInputChange('rateSupports', newSupports);
                    }}
                  >
                    추가
                  </Button>
                </Box>
                
                {formData.rateSupports && formData.rateSupports.map((item, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                    <TextField
                      label="모델유형"
                      value={item.modelType || ''}
                      onChange={(e) => {
                        const newSupports = [...formData.rateSupports];
                        newSupports[index].modelType = e.target.value;
                        handleInputChange('rateSupports', newSupports);
                      }}
                      sx={{ width: 150 }}
                      placeholder="예: 갤럭시 S24"
                      size="small"
                    />
                    <FormControl sx={{ width: 130 }} size="small">
                      <InputLabel>요금제군</InputLabel>
                      <Select
                        value={item.rateGrade || ''}
                        label="요금제군"
                        onChange={(e) => {
                          const newSupports = [...formData.rateSupports];
                          newSupports[index].rateGrade = e.target.value;
                          handleInputChange('rateSupports', newSupports);
                        }}
                      >
                        <MenuItem value="전요금제">전요금제</MenuItem>
                        <MenuItem value="115군">115군</MenuItem>
                        <MenuItem value="105군">105군</MenuItem>
                        <MenuItem value="95군">95군</MenuItem>
                        <MenuItem value="85군">85군</MenuItem>
                        <MenuItem value="75군">75군</MenuItem>
                        <MenuItem value="69군">69군</MenuItem>
                        <MenuItem value="61군">61군</MenuItem>
                        <MenuItem value="55군">55군</MenuItem>
                        <MenuItem value="44군">44군</MenuItem>
                        <MenuItem value="33군">33군</MenuItem>
                        <MenuItem value="33군 미만">33군 미만</MenuItem>
                        <MenuItem value="시니어 Ⅰ군">시니어 Ⅰ군</MenuItem>
                        <MenuItem value="시니어 Ⅱ군">시니어 Ⅱ군</MenuItem>
                        <MenuItem value="청소년 Ⅰ군">청소년 Ⅰ군</MenuItem>
                        <MenuItem value="청소년 Ⅱ군">청소년 Ⅱ군</MenuItem>
                        <MenuItem value="청소년 Ⅲ군">청소년 Ⅲ군</MenuItem>
                        <MenuItem value="키즈군">키즈군</MenuItem>
                        <MenuItem value="키즈22군">키즈22군</MenuItem>
                        <MenuItem value="2nd군">2nd군</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl sx={{ width: 90 }} size="small">
                      <InputLabel>범위</InputLabel>
                      <Select
                        value={item.rateRange || '해당군'}
                        label="범위"
                        onChange={(e) => {
                          const newSupports = [...formData.rateSupports];
                          newSupports[index].rateRange = e.target.value;
                          handleInputChange('rateSupports', newSupports);
                        }}
                      >
                        <MenuItem value="해당군">해당군</MenuItem>
                        <MenuItem value="이상">이상</MenuItem>
                        <MenuItem value="이하">이하</MenuItem>
                        <MenuItem value="초과">초과</MenuItem>
                        <MenuItem value="미만">미만</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl sx={{ width: 100 }} size="small">
                      <InputLabel>유형</InputLabel>
                      <Select
                        value={item.activationType || ''}
                        label="유형"
                        onChange={(e) => {
                          const newSupports = [...formData.rateSupports];
                          newSupports[index].activationType = e.target.value;
                          handleInputChange('rateSupports', newSupports);
                        }}
                      >
                        <MenuItem value="전유형">전유형</MenuItem>
                        <MenuItem value="010신규">010신규</MenuItem>
                        <MenuItem value="MNP">MNP</MenuItem>
                        <MenuItem value="보상">보상</MenuItem>
                        <MenuItem value="기변">기변</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="금액"
                      value={item.amount || ''}
                      onChange={(e) => {
                        const newSupports = [...formData.rateSupports];
                        newSupports[index].amount = e.target.value;
                        handleInputChange('rateSupports', newSupports);
                      }}
                      type="number"
                      inputProps={{ min: 0 }}
                      sx={{ width: 120 }}
                      placeholder="금액 입력"
                      size="small"
                    />
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        const newSupports = formData.rateSupports.filter((_, i) => i !== index);
                        handleInputChange('rateSupports', newSupports);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                
                {errors.rateSupports && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    {errors.rateSupports}
                  </Typography>
                )}
                
                {/* 직접입력 체크박스 */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isDirectInput}
                      onChange={(e) => handleInputChange('isDirectInput', e.target.checked)}
                    />
                  }
                  label="직접입력"
                />
              </Grid>
            </>
          ) : null}

          {/* 연합정책 전용: 정산 입금처 + 연합대상하부점 + 조건 */}
          {categoryId === 'wireless_union' || categoryId === 'wired_union' ? (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  정산 입금처 *
                </Typography>
                <Autocomplete
                  options={stores}
                  getOptionLabel={(option) => option.name || ''}
                  value={stores.find(s => s.name === formData.unionSettlementStore) || null}
                  onChange={(event, newValue) => {
                    handleInputChange('unionSettlementStore', newValue ? newValue.name : '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="정산 입금처 매장을 선택하세요"
                      error={!!errors.unionSettlementStore}
                      helperText={errors.unionSettlementStore}
                    />
                  )}
                  filterOptions={(options, { inputValue }) => {
                    return options.filter((option) =>
                      option.name.toLowerCase().includes(inputValue.toLowerCase())
                    );
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  연합대상하부점 *
                </Typography>
                <Autocomplete
                  multiple
                  options={stores}
                  getOptionLabel={(option) => option.name || ''}
                  value={stores.filter(s => (formData.unionTargetStores || []).includes(s.name))}
                  onChange={(event, newValue) => {
                    handleInputChange('unionTargetStores', newValue.map(v => v.name));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="연합대상하부점을 선택하세요 (복수 선택 가능)"
                      error={!!errors.unionTargetStores}
                      helperText={errors.unionTargetStores}
                    />
                  )}
                  filterOptions={(options, { inputValue }) => {
                    return options.filter((option) =>
                      option.name.toLowerCase().includes(inputValue.toLowerCase())
                    );
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  조건부 옵션
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.unionConditions?.individualInput || false}
                        onChange={(e) => handleInputChange('unionConditions', {
                          ...(formData.unionConditions || {}),
                          individualInput: e.target.checked
                        })}
                      />
                    }
                    label="개별 입력"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.unionConditions?.postSettlement || false}
                        onChange={(e) => handleInputChange('unionConditions', {
                          ...(formData.unionConditions || {}),
                          postSettlement: e.target.checked
                        })}
                      />
                    }
                    label="후정산 입력"
                  />
                </Box>
              </Grid>

              {/* 직접입력 체크박스 */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isDirectInput}
                      onChange={(e) => handleInputChange('isDirectInput', e.target.checked)}
                    />
                  }
                  label="직접입력"
                />
              </Grid>
            </>
          ) : null}

          {/* 개별소급정책 전용: 적용대상 + 개통유형 */}
          {categoryId === 'wireless_individual' || categoryId === 'wired_individual' ? (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  적용대상 *
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                    <DatePicker
                      label="개통일"
                      value={formData.individualTarget?.activationDate || new Date()}
                      onChange={(newValue) => {
                        handleInputChange('individualTarget', {
                          ...(formData.individualTarget || {}),
                          activationDate: newValue
                        });
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          error={!!errors.individualActivationDate}
                          helperText={errors.individualActivationDate}
                        />
                      )}
                    />
                  </LocalizationProvider>
                  
                  <TextField
                    fullWidth
                    label="고객명"
                    value={formData.individualTarget?.customerName || ''}
                    onChange={(e) => {
                      handleInputChange('individualTarget', {
                        ...(formData.individualTarget || {}),
                        customerName: e.target.value
                      });
                    }}
                    error={!!errors.individualCustomerName}
                    helperText={errors.individualCustomerName}
                    placeholder="고객명을 입력하세요"
                  />
                  
                  <TextField
                    fullWidth
                    label="단말일련번호"
                    value={formData.individualTarget?.deviceSerial || ''}
                    onChange={(e) => {
                      handleInputChange('individualTarget', {
                        ...(formData.individualTarget || {}),
                        deviceSerial: e.target.value
                      });
                    }}
                    error={!!errors.individualDeviceSerial}
                    helperText={errors.individualDeviceSerial}
                    placeholder="단말일련번호를 입력하세요"
                  />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <FormControl component="fieldset" error={!!errors.individualActivationType}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    개통유형 *
                  </Typography>
                  <RadioGroup
                    value={formData.individualActivationType}
                    onChange={(e) => handleInputChange('individualActivationType', e.target.value)}
                  >
                    <FormControlLabel value="new010" control={<Radio />} label="010신규" />
                    <FormControlLabel value="mnp" control={<Radio />} label="MNP" />
                    <FormControlLabel value="change" control={<Radio />} label="기변" />
                  </RadioGroup>
                  {errors.individualActivationType && (
                    <Typography variant="caption" color="error">
                      {errors.individualActivationType}
                    </Typography>
                  )}
                </FormControl>
              </Grid>

              {/* 직접입력 체크박스 */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isDirectInput}
                      onChange={(e) => handleInputChange('isDirectInput', e.target.checked)}
                    />
                  }
                  label="직접입력"
                />
              </Grid>
            </>
          ) : null}

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="정책내용"
              value={formData.policyContent}
              onChange={(e) => handleInputChange('policyContent', e.target.value)}
              error={!!errors.policyContent}
              helperText={
                (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe') 
                  ? (formData.isDirectInput ? '직접입력 모드: 정책 내용을 입력해주세요.' : '95군 이상/미만 금액을 입력하면 자동으로 내용이 생성됩니다.')
                  : (categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct')
                  ? (formData.isDirectInput ? '직접입력 모드: 정책 내용을 입력해주세요.' : '차감지원설정과 조건부를 입력하면 자동으로 내용이 생성됩니다.')
                  : errors.policyContent
              }
              multiline
              rows={4}
              required={
                (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || 
                 categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct') 
                  ? formData.isDirectInput 
                  : true
              }
              disabled={
                (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || 
                 categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct') 
                  ? !formData.isDirectInput 
                  : false
              }
            />
          </Grid>
          
          {/* 구두정책과 부가차감지원정책, 부가추가지원정책, 요금제유형별정책이 아닌 경우에만 금액 입력 필드 표시 */}
          {!(categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || 
             categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct' ||
             categoryId === 'wireless_add_support' || categoryId === 'wired_add_support' ||
             categoryId === 'wireless_rate' || categoryId === 'wired_rate') && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="금액 (원)"
                value={formData.policyAmount}
                onChange={(e) => handleInputChange('policyAmount', e.target.value)}
                error={!!errors.policyAmount}
                helperText={errors.policyAmount}
                type="number"
                inputProps={{ min: 0 }}
                disabled={formData.amountType === 'in_content'}
                required={formData.amountType !== 'in_content'}
              />
            </Grid>
          )}
          
          {/* 구두정책과 부가차감지원정책, 부가추가지원정책, 요금제유형별정책이 아닌 경우에만 금액 유형 선택 표시 */}
          {!(categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' || 
             categoryId === 'wireless_add_deduct' || categoryId === 'wired_add_deduct' ||
             categoryId === 'wireless_add_support' || categoryId === 'wired_add_support' ||
             categoryId === 'wireless_rate' || categoryId === 'wired_rate') && (
            <Grid item xs={12} sm={6}>
              <FormControl component="fieldset" error={!!errors.amountType}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  금액 유형 *
                </Typography>
                <RadioGroup
                  row
                  value={formData.amountType}
                  onChange={(e) => handleInputChange('amountType', e.target.value)}
                >
                  <FormControlLabel
                    value="total"
                    control={<Radio />}
                    label="총금액"
                  />
                  <FormControlLabel
                    value="per_case"
                    control={<Radio />}
                    label="건당금액"
                  />
                  {/* 연합정책이 아닐 때만 "내용에 직접입력" 옵션 표시 */}
                  {categoryId !== 'wireless_union' && categoryId !== 'wired_union' && (
                    <FormControlLabel
                      value="in_content"
                      control={<Radio />}
                      label="내용에 직접입력"
                    />
                  )}
                </RadioGroup>
                {errors.amountType && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.amountType}
                  </Typography>
                )}
              </FormControl>
            </Grid>
          )}

          {/* 소속정책팀 선택 */}
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={teams}
              getOptionLabel={(option) => option.name}
              value={teams.find(team => team.code === formData.team) || null}
              onChange={(event, newValue) => {
                handleInputChange('team', newValue ? newValue.code : '');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="소속정책팀 *"
                  placeholder="소속팀장을 선택하세요"
                  error={!!errors.team}
                  helperText={errors.team}
                  required
                />
              )}
              filterOptions={(options, { inputValue }) => {
                return options.filter((option) =>
                  option.name.toLowerCase().includes(inputValue.toLowerCase())
                );
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="대상년월"
              value={yearMonth}
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          취소
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (policy ? '수정 중...' : '저장 중...') : (policy ? '수정' : '저장')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PolicyInputModal; 