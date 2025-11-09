import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Box,
  Typography,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  FormHelperText
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { api } from '../api';

const QuickCostModal = ({
  open,
  onClose,
  fromStore,
  toStore,
  loggedInStore,
  modeType, // '일반모드' or '관리자모드'
  requestedStore // 관리자모드에서 재고요청점
}) => {
  const [companyOptions, setCompanyOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [recentCompanies, setRecentCompanies] = useState([]);

  // 업체 정보 초기값
  const initialCompany = {
    name: '',
    nameInputMode: 'select', // 'select' or 'input'
    phone: '',
    phoneInputMode: 'select',
    phoneOptions: [], // 해당 업체의 전화번호 목록
    cost: '',
    costInputMode: 'select',
    costOptions: [], // 해당 업체+전화번호의 비용 목록
    dispatchSpeed: '중간',
    pickupSpeed: '중간',
    arrivalSpeed: '중간'
  };

  const initialCompanyError = {
    name: '',
    phone: '',
    cost: '',
    dispatchSpeed: '',
    pickupSpeed: '',
    arrivalSpeed: ''
  };

  const cloneCompany = (company = initialCompany) => ({
    ...company,
    phoneOptions: [...(company.phoneOptions || [])],
    costOptions: [...(company.costOptions || [])]
  });

  const cloneCompanyList = (list) => list.map(cloneCompany);

  const convertDraftToCompany = (company) => ({
    ...initialCompany,
    name: company?.name || '',
    nameInputMode: 'input',
    phone: company?.phone || '',
    phoneInputMode: 'input',
    cost: company?.cost !== undefined && company?.cost !== null ? String(company.cost) : '',
    costInputMode: 'input',
    dispatchSpeed: company?.dispatchSpeed || '중간',
    pickupSpeed: company?.pickupSpeed || '중간',
    arrivalSpeed: company?.arrivalSpeed || '중간'
  });

  const resolvedFromStore = modeType === '관리자모드' && requestedStore
    ? requestedStore
    : (fromStore || loggedInStore || null);
  const resolvedToStore = toStore || null;
  const resolvedFromStoreId = resolvedFromStore?.id || '';
  const resolvedToStoreId = resolvedToStore?.id || '';

  const getDraftKey = () => {
    if (!resolvedFromStoreId || !resolvedToStoreId) return null;
    return `quick-cost-draft-${resolvedFromStoreId}-${resolvedToStoreId}`;
  };

  const saveDraft = (companiesData) => {
    const key = getDraftKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(companiesData));
    } catch (err) {
      console.error('퀵비용 드래프트 저장 실패:', err);
    }
  };

  const loadDraft = () => {
    const key = getDraftKey();
    if (!key) return null;
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      console.error('퀵비용 드래프트 로드 실패:', err);
      return null;
    }
  };

  const [companyList, setCompanyList] = useState([{ ...initialCompany }]);
  const [companyErrors, setCompanyErrors] = useState([{ ...initialCompanyError }]);

  useEffect(() => {
    setCompanyErrors(prev => {
      if (companyList.length === prev.length) return prev;
      if (companyList.length > prev.length) {
        const additions = Array.from({ length: companyList.length - prev.length }, () => ({ ...initialCompanyError }));
        return [...prev, ...additions];
      }
      return prev.slice(0, companyList.length);
    });
  }, [companyList.length]);

  // 최근 사용 업체 로드
  useEffect(() => {
    const saved = localStorage.getItem('quick-cost-recent');
    if (saved) {
      try {
        setRecentCompanies(JSON.parse(saved));
      } catch (e) {
        console.error('최근 사용 업체 로드 실패:', e);
      }
    }
  }, []);

  // 업체명 목록 로드
  useEffect(() => {
    if (!open) return;

    const loadCompanies = async () => {
      setLoading(true);
      try {
        const result = await api.getQuickServiceCompanies();
        if (result.success) {
          // 최근 사용 업체 우선 정렬
          const sorted = [...(result.data || [])].sort((a, b) => {
            const aRecent = recentCompanies.some(r => r.name === a);
            const bRecent = recentCompanies.some(r => r.name === b);
            if (aRecent && !bRecent) return -1;
            if (!aRecent && bRecent) return 1;
            return a.localeCompare(b);
          });
          setCompanyOptions(sorted);
        }
      } catch (err) {
        console.error('업체명 목록 로드 오류:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, [open, recentCompanies]);

  // 업체 추가
  const handleAddCompany = () => {
    if (companyList.length >= 5) return;
    setCompanyList(prev => [...cloneCompanyList(prev), { ...initialCompany }]);
    setCompanyErrors(prev => [...prev, { ...initialCompanyError }]);
  };

  // 업체 삭제
  const handleRemoveCompany = (index) => {
    setCompanyList(prev => cloneCompanyList(prev).filter((_, i) => i !== index));
    setCompanyErrors(prev => prev.filter((_, i) => i !== index));
  };

  // 업체명 변경
  const handleCompanyNameChange = async (index, value, inputMode) => {
    console.log('🔍 handleCompanyNameChange 호출:', { index, value, inputMode });
    const newList = cloneCompanyList(companyList);
    newList[index].name = value;
    newList[index].nameInputMode = inputMode;
    console.log('🔍 업데이트된 companyList:', newList[index]);

    setCompanyErrors(prev => prev.map((err, idx) => idx === index ? { ...err, name: '' } : err));

    // 선택 모드이고 업체명이 변경되면 전화번호 목록 로드
    if (inputMode === 'select' && value && value !== '직접 입력') {
      try {
        const result = await api.getQuickServicePhoneNumbers(value);
        if (result.success && result.data) {
          // 전화번호 목록 저장 및 필드 초기화
          newList[index].phoneOptions = result.data || [];
          newList[index].phone = '';
          newList[index].phoneInputMode = 'select';
          newList[index].costOptions = [];
          newList[index].cost = '';
          newList[index].costInputMode = 'select';
          console.log('🔍 전화번호 목록 로드 완료:', newList[index].phoneOptions);
        } else {
          newList[index].phoneOptions = [];
        }
      } catch (err) {
        console.error('전화번호 목록 로드 오류:', err);
        newList[index].phoneOptions = [];
      }
    } else {
      // 직접 입력 모드이거나 업체명이 없으면 전화번호 목록 초기화
      newList[index].phoneOptions = [];
      newList[index].phone = '';
      newList[index].costOptions = [];
      newList[index].cost = '';
    }

    setCompanyList(newList);
  };

  // 전화번호 변경
  const handlePhoneChange = async (index, value, inputMode) => {
    const normalizedValue = value !== undefined && value !== null ? value.toString() : '';
    const newList = cloneCompanyList(companyList);
    newList[index].phone = normalizedValue;
    newList[index].phoneInputMode = inputMode;

    setCompanyErrors(prev => prev.map((err, idx) => idx === index ? { ...err, phone: '', cost: '' } : err));

    // 선택 모드이고 업체명과 전화번호가 모두 있으면 비용 목록 로드
    if (inputMode === 'select' && normalizedValue && normalizedValue !== '직접 입력' && newList[index].name) {
      try {
        const result = await api.getQuickServiceCosts(newList[index].name, normalizedValue);
        if (result.success && result.data) {
          // 비용 목록 저장 및 필드 초기화
          newList[index].costOptions = result.data || [];
          newList[index].cost = '';
          newList[index].costInputMode = 'select';
          console.log('🔍 비용 목록 로드 완료:', newList[index].costOptions);
        } else {
          newList[index].costOptions = [];
        }
      } catch (err) {
        console.error('비용 목록 로드 오류:', err);
        newList[index].costOptions = [];
      }
    } else {
      // 직접 입력 모드이거나 전화번호가 없으면 비용 목록 초기화
      newList[index].costOptions = [];
      newList[index].cost = '';
    }

    setCompanyList(newList);
  };

  // 비용 변경
  const handleCostChange = (index, value, inputMode) => {
    const normalizedValue = value !== undefined && value !== null ? value.toString() : '';
    const newList = cloneCompanyList(companyList);
    newList[index].cost = normalizedValue;
    newList[index].costInputMode = inputMode;
    setCompanyList(newList);
    setCompanyErrors(prev => prev.map((err, idx) => idx === index ? { ...err, cost: '' } : err));
  };

  // 속도 변경
  const handleSpeedChange = (index, type, value) => {
    const newList = cloneCompanyList(companyList);
    newList[index][type] = value;
    setCompanyList(newList);
    setCompanyErrors(prev => prev.map((err, idx) => {
      if (idx !== index) return err;
      return { ...err, [type]: '' };
    }));
  };

  // 입력값 검증
  const validateForm = () => {
    const errors = companyList.map(() => ({ ...initialCompanyError }));
    let hasError = false;
    const nameRegex = /^[가-힣a-zA-Z0-9\s()&\-.,]+$/;

    companyList.forEach((company, index) => {
      const trimmedName = company.name ? company.name.trim() : '';
      if (!trimmedName) {
        errors[index].name = `업체 ${index + 1}의 업체명을 입력해주세요.`;
        hasError = true;
      } else if (trimmedName.length > 50) {
        errors[index].name = `업체 ${index + 1}의 업체명이 너무 깁니다. (최대 50자)`;
        hasError = true;
      } else if (!nameRegex.test(trimmedName)) {
        errors[index].name = `업체 ${index + 1}의 업체명에는 특수문자를 사용할 수 없습니다.`;
        hasError = true;
      }

      const rawPhone = company.phone ? company.phone.toString().trim() : '';
      if (!rawPhone) {
        errors[index].phone = `업체 ${index + 1}의 전화번호를 입력해주세요.`;
        hasError = true;
      } else {
        const phonePattern = /^[0-9-]+$/;
        if (!phonePattern.test(rawPhone)) {
          errors[index].phone = `업체 ${index + 1}의 전화번호 형식이 올바르지 않습니다.`;
          hasError = true;
        }
        const digitsOnly = rawPhone.replace(/-/g, '');
        if (!digitsOnly || digitsOnly.length < 8) {
          errors[index].phone = `업체 ${index + 1}의 전화번호가 너무 짧습니다.`;
          hasError = true;
        }
      }

      const rawCost = company.cost !== undefined && company.cost !== null ? company.cost.toString().replace(/,/g, '').trim() : '';
      if (!rawCost) {
        errors[index].cost = `업체 ${index + 1}의 비용을 입력해주세요.`;
        hasError = true;
      } else {
        const costNum = Number(rawCost);
        if (!Number.isInteger(costNum)) {
          errors[index].cost = `업체 ${index + 1}의 비용이 올바르지 않습니다.`;
          hasError = true;
        } else if (costNum <= 0 || costNum > 1000000) {
          errors[index].cost = `업체 ${index + 1}의 비용이 유효하지 않습니다. (1원 ~ 1,000,000원)`;
          hasError = true;
        }
      }

      if (!company.dispatchSpeed) {
        errors[index].dispatchSpeed = `업체 ${index + 1}의 배차속도를 선택해주세요.`;
        hasError = true;
      }
      if (!company.pickupSpeed) {
        errors[index].pickupSpeed = `업체 ${index + 1}의 픽업속도를 선택해주세요.`;
        hasError = true;
      }
      if (!company.arrivalSpeed) {
        errors[index].arrivalSpeed = `업체 ${index + 1}의 도착속도를 선택해주세요.`;
        hasError = true;
      }
    });

    setCompanyErrors(errors);

    if (hasError) {
      setError('입력값을 확인해주세요.');
      return false;
    }

    setError(null);
    return true;
  };

  // 저장
  const handleSave = async () => {
    setError(null);

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const fromStoreName = modeType === '관리자모드' && requestedStore 
        ? requestedStore.name 
        : (loggedInStore?.name || fromStore?.name || '');
      const fromStoreId = modeType === '관리자모드' && requestedStore 
        ? requestedStore.id 
        : (loggedInStore?.id || fromStore?.id || '');

      const toStoreName = toStore?.name || '';
      const toStoreId = toStore?.id || '';

      const companiesData = companyList.map(company => {
        const normalizedName = company.name ? company.name.trim() : '';
        const normalizedPhone = company.phone ? company.phone.toString().trim() : '';
        const normalizedCost = parseInt((company.cost !== undefined && company.cost !== null ? company.cost.toString() : '0').replace(/,/g, ''), 10) || 0;

        return {
          name: normalizedName,
          phone: normalizedPhone,
          cost: normalizedCost,
          dispatchSpeed: company.dispatchSpeed,
          pickupSpeed: company.pickupSpeed,
          arrivalSpeed: company.arrivalSpeed
        };
      });

      const saveData = {
        registrantStoreName: loggedInStore?.name || '',
        registrantStoreId: loggedInStore?.id || '',
        fromStoreName,
        fromStoreId,
        toStoreName,
        toStoreId,
        modeType: modeType || '일반모드',
        companies: companiesData
      };

      // 양방향 저장: 같은 퀵서비스 업체일 경우 A↔B와 B↔A 모두 저장
      // 조건: 입력한 업체 정보(업체명, 전화번호, 비용)가 동일한 경우
      // 현재 구현: 입력한 모든 업체 정보를 양방향으로 저장
      const saveDataReverse = {
        ...saveData,
        fromStoreName: toStoreName,
        fromStoreId: toStoreId,
        toStoreName: fromStoreName,
        toStoreId: fromStoreId,
        // 같은 업체 정보(companies)를 그대로 사용
        companies: companiesData
      };

      // 양방향 모두 저장 (같은 업체 정보로)
      console.log('🔍 양방향 저장 시작:', {
        방향1: `${fromStoreName}(${fromStoreId}) ↔ ${toStoreName}(${toStoreId})`,
        방향2: `${toStoreName}(${toStoreId}) ↔ ${fromStoreName}(${fromStoreId})`
      });
      
      const [result1, result2] = await Promise.all([
        api.saveQuickCost(saveData),
        api.saveQuickCost(saveDataReverse)
      ]);
      
      console.log('🔍 양방향 저장 결과:', {
        방향1: result1.success ? '성공' : `실패: ${result1.error || '알 수 없는 오류'}`,
        방향2: result2.success ? '성공' : `실패: ${result2.error || '알 수 없는 오류'}`
      });
      
      if (result1.success && result2.success) {
        saveDraft(companiesData);
        // 최근 사용 업체 저장
        companiesData.forEach(company => {
          const key = `${company.name}-${company.phone}`;
          if (!recentCompanies.some(r => `${r.name}-${r.phone}` === key)) {
            recentCompanies.unshift({ name: company.name, phone: company.phone });
            if (recentCompanies.length > 10) {
              recentCompanies.pop();
            }
          }
        });
        localStorage.setItem('quick-cost-recent', JSON.stringify(recentCompanies));

        // 저장 후 관련 캐시 무효화하여 즉시 반영되도록 함
        // 1. 예상퀵비용 캐시 삭제 (양방향 모두)
        const cacheKey1 = `quick-cost-estimate-${fromStoreId}-${toStoreId}`;
        const cacheKey2 = `quick-cost-estimate-${toStoreId}-${fromStoreId}`;
        if (window.clientCacheUtils) {
          window.clientCacheUtils.delete(cacheKey1);
          window.clientCacheUtils.delete(cacheKey2);
        }
        
        // 2. 업체명 목록 캐시 삭제 (새 업체가 목록에 나타나도록)
        const companiesCacheKey = 'quick-cost-companies';
        if (window.clientCacheUtils) {
          window.clientCacheUtils.delete(companiesCacheKey);
        }
        
        // 3. 저장한 업체의 전화번호/비용 캐시도 삭제
        companiesData.forEach(company => {
          const phoneCacheKey = `quick-cost-phone-${company.name}`;
          const costCacheKey = `quick-cost-cost-${company.name}-${company.phone}`;
          if (window.clientCacheUtils) {
            window.clientCacheUtils.delete(phoneCacheKey);
            window.clientCacheUtils.delete(costCacheKey);
          }
        });

        alert('퀵비용 정보가 성공적으로 저장되었습니다.');
        
        // 저장 성공 후 부모 컴포넌트에 리프레시 신호 전달
        if (onClose) {
          // onClose에 refresh 플래그를 전달할 수 있도록 수정 필요
          // 일단 모달을 닫고, 부모 컴포넌트에서 리프레시 처리하도록 함
          onClose(true); // true = 저장 성공 플래그
        } else {
          onClose();
        }
        
        // 폼 초기화
        setCompanyList([{ ...initialCompany }]);
        setCompanyErrors([{ ...initialCompanyError }]);
      } else {
        // 양방향 저장 중 하나라도 실패한 경우
        const errorMessages = [];
        if (!result1.success) {
          errorMessages.push(`방향1 저장 실패: ${result1.error || '알 수 없는 오류'}`);
        }
        if (!result2.success) {
          errorMessages.push(`방향2 저장 실패: ${result2.error || '알 수 없는 오류'}`);
        }
        setError(`저장에 실패했습니다. ${errorMessages.join(', ')}`);
        console.error('❌ 양방향 저장 실패:', { result1, result2 });
      }
    } catch (err) {
      console.error('저장 오류:', err);
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (!open) return;

    const draft = loadDraft();
    if (draft && draft.length) {
      const restored = draft.map(convertDraftToCompany);
      setCompanyList(restored);
      setCompanyErrors(restored.map(() => ({ ...initialCompanyError })));
    } else {
      setCompanyList([{ ...initialCompany }]);
      setCompanyErrors([{ ...initialCompanyError }]);
    }
    setError(null);
  }, [open, resolvedFromStoreId, resolvedToStoreId]);

  // 모달 닫기
  const handleClose = () => {
    setError(null);
    setCompanyList([{ ...initialCompany }]);
    setCompanyErrors([{ ...initialCompanyError }]);
    if (onClose) {
      onClose(false); // 저장하지 않고 닫은 경우
    }
  };

  const fromStoreName = modeType === '관리자모드' && requestedStore 
    ? requestedStore.name 
    : (loggedInStore?.name || fromStore?.name || '');
  const toStoreName = toStore?.name || '';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">퀵비용 등록</Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* 매장 정보 표시 */}
        <Box sx={{ mb: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="body1" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            {fromStoreName} <span style={{ color: '#1976d2' }}>↔</span> {toStoreName}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 업체 정보 입력 폼 */}
        {companyList.map((company, index) => {
          const companyError = companyErrors[index] || initialCompanyError;

          return (
            <Box key={`company-${index}-${company.nameInputMode}-${company.phoneInputMode}-${company.costInputMode}`} sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  업체 {index + 1}
                </Typography>
                {companyList.length > 1 && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemoveCompany(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>

              <Grid container spacing={2}>
                {/* 업체명 */}
                <Grid item xs={12} sm={6}>
                  {company.nameInputMode === 'input' ? (
                    <Box>
                      <TextField
                        fullWidth
                        size="small"
                        label="업체명"
                        placeholder="업체명을 입력하세요"
                        value={company.name}
                        onChange={(e) => handleCompanyNameChange(index, e.target.value, 'input')}
                        inputProps={{ maxLength: 50 }}
                        error={Boolean(companyError.name)}
                        helperText={companyError.name}
                      />
                      <Button
                        size="small"
                        onClick={() => {
                          setCompanyList(prevList => {
                            return prevList.map((item, idx) => {
                              if (idx === index) {
                                return { ...item, nameInputMode: 'select', name: '' };
                              }
                              return item;
                            });
                          });
                          setCompanyErrors(prev => prev.map((err, idx) => idx === index ? { ...err, name: '' } : err));
                        }}
                        sx={{ mt: 0.5, fontSize: '0.75rem' }}
                      >
                        목록에서 선택
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <FormControl fullWidth size="small" error={Boolean(companyError.name)}>
                        <InputLabel>업체명</InputLabel>
                        <Select
                          value={company.name || ''}
                          label="업체명"
                          onChange={(e) => {
                            const selectedValue = e.target.value;
                            if (selectedValue && selectedValue !== '') {
                              handleCompanyNameChange(index, selectedValue, 'select');
                            }
                          }}
                          displayEmpty
                        >
                          {loading ? (
                            <MenuItem disabled>로딩 중...</MenuItem>
                          ) : companyOptions.length === 0 ? (
                            <MenuItem disabled>등록된 업체가 없습니다</MenuItem>
                          ) : (
                            companyOptions.map((opt) => (
                              <MenuItem key={opt} value={opt}>
                                {opt}
                              </MenuItem>
                            ))
                          )}
                        </Select>
                        <FormHelperText>{companyError.name}</FormHelperText>
                      </FormControl>
                      <Button
                        size="small"
                        onClick={() => {
                          console.log('🔍 [업체명] 직접 입력 버튼 클릭');
                          setCompanyList(prevList => {
                            const updated = prevList.map((item, idx) => {
                              if (idx === index) {
                                return {
                                  ...item,
                                  name: '',
                                  nameInputMode: 'input'
                                };
                              }
                              return item;
                            });
                            console.log('🔍 [업체명] 상태 업데이트 완료:', updated[index]);
                            return updated;
                          });
                          setCompanyErrors(prev => prev.map((err, idx) => idx === index ? { ...err, name: '' } : err));
                        }}
                        sx={{ mt: 0.5, fontSize: '0.75rem' }}
                        variant="outlined"
                        color="primary"
                      >
                        직접 입력
                      </Button>
                    </Box>
                  )}
                </Grid>

                {/* 전화번호 */}
                <Grid item xs={12} sm={6}>
                  {company.name && company.nameInputMode === 'select' && company.phoneInputMode === 'select' ? (
                    <Box>
                      <FormControl fullWidth size="small" error={Boolean(companyError.phone)}>
                        <InputLabel>대표번호</InputLabel>
                        <Select
                          value={company.phone || ''}
                          label="대표번호"
                          onChange={async (e) => {
                            const selectedValue = e.target.value;
                            if (selectedValue && selectedValue !== '') {
                              handlePhoneChange(index, selectedValue, 'select');
                            }
                          }}
                          displayEmpty
                        >
                          {company.phoneOptions && company.phoneOptions.length > 0 ? (
                            company.phoneOptions.map((phone) => (
                              <MenuItem key={phone} value={phone}>
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {phone}
                                  </Typography>
                                  {company.name && (
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                      {company.name}
                                    </Typography>
                                  )}
                                </Box>
                              </MenuItem>
                            ))
                          ) : (
                            <MenuItem disabled>등록된 전화번호가 없습니다</MenuItem>
                          )}
                        </Select>
                        <FormHelperText>{companyError.phone}</FormHelperText>
                      </FormControl>
                      <Button
                        size="small"
                        onClick={() => {
                          console.log('🔍 [전화번호] 직접 입력 버튼 클릭');
                          setCompanyList(prevList => {
                            return prevList.map((item, idx) => {
                              if (idx === index) {
                                return {
                                  ...item,
                                  phone: '',
                                  phoneInputMode: 'input'
                                };
                              }
                              return item;
                            });
                          });
                          setCompanyErrors(prev => prev.map((err, idx) => idx === index ? { ...err, phone: '' } : err));
                        }}
                        sx={{ mt: 0.5, fontSize: '0.75rem' }}
                        variant="outlined"
                        color="primary"
                      >
                        직접 입력
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <TextField
                        fullWidth
                        size="small"
                        label="대표번호"
                        placeholder="010-1234-5678"
                        value={company.phone}
                        onChange={(e) => handlePhoneChange(index, e.target.value, 'input')}
                        error={Boolean(companyError.phone)}
                        helperText={companyError.phone}
                      />
                      {company.name && company.nameInputMode === 'select' && (
                        <Button
                          size="small"
                          onClick={() => {
                            setCompanyList(prevList => {
                              return prevList.map((item, idx) => {
                                if (idx === index) {
                                  return { ...item, phoneInputMode: 'select', phone: '' };
                                }
                                return item;
                              });
                            });
                            setCompanyErrors(prev => prev.map((err, idx) => idx === index ? { ...err, phone: '' } : err));
                          }}
                          sx={{ mt: 0.5, fontSize: '0.75rem' }}
                        >
                          목록에서 선택
                        </Button>
                      )}
                    </Box>
                  )}
                </Grid>

                {/* 비용 */}
                <Grid item xs={12} sm={6}>
                  {company.name && company.phone && company.nameInputMode === 'select' && company.phoneInputMode === 'select' && company.costInputMode === 'select' ? (
                    <Box>
                      <FormControl fullWidth size="small" error={Boolean(companyError.cost)}>
                        <InputLabel>비용</InputLabel>
                        <Select
                          value={company.cost || ''}
                          label="비용"
                          onChange={(e) => {
                            const selectedValue = e.target.value;
                            if (selectedValue && selectedValue !== '') {
                              handleCostChange(index, selectedValue, 'select');
                            }
                          }}
                          displayEmpty
                        >
                          {company.costOptions && company.costOptions.length > 0 ? (
                            company.costOptions.map((cost) => (
                              <MenuItem key={cost} value={cost}>
                                {Number(cost).toLocaleString()}원
                              </MenuItem>
                            ))
                          ) : (
                            <MenuItem disabled>등록된 비용이 없습니다</MenuItem>
                          )}
                        </Select>
                        <FormHelperText>{companyError.cost}</FormHelperText>
                      </FormControl>
                      <Button
                        size="small"
                        onClick={() => {
                          console.log('🔍 [비용] 직접 입력 버튼 클릭');
                          setCompanyList(prevList => {
                            return prevList.map((item, idx) => {
                              if (idx === index) {
                                return {
                                  ...item,
                                  cost: '',
                                  costInputMode: 'input'
                                };
                              }
                              return item;
                            });
                          });
                          setCompanyErrors(prev => prev.map((err, idx) => idx === index ? { ...err, cost: '' } : err));
                        }}
                        sx={{ mt: 0.5, fontSize: '0.75rem' }}
                        variant="outlined"
                        color="primary"
                      >
                        직접 입력
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <TextField
                        fullWidth
                        size="small"
                        label="비용 (원)"
                        placeholder="7000"
                        value={company.cost}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          handleCostChange(index, value, 'input');
                        }}
                        inputProps={{ maxLength: 7 }}
                        error={Boolean(companyError.cost)}
                        helperText={companyError.cost}
                      />
                      {company.name && company.phone && company.nameInputMode === 'select' && company.phoneInputMode === 'select' && (
                        <Button
                          size="small"
                          onClick={() => {
                            setCompanyList(prevList => {
                              return prevList.map((item, idx) => {
                                if (idx === index) {
                                  return { ...item, costInputMode: 'select', cost: '' };
                                }
                                return item;
                              });
                            });
                            setCompanyErrors(prev => prev.map((err, idx) => idx === index ? { ...err, cost: '' } : err));
                          }}
                          sx={{ mt: 0.5, fontSize: '0.75rem' }}
                        >
                          목록에서 선택
                        </Button>
                      )}
                    </Box>
                  )}
                </Grid>

                {/* 속도 선택 */}
                <Grid item xs={12} sm={6}>
                  <FormControl component="fieldset" size="small" error={Boolean(companyError.dispatchSpeed)}>
                    <FormLabel component="legend" sx={{ fontSize: '0.75rem' }}>배차속도</FormLabel>
                    <RadioGroup
                      row
                      value={company.dispatchSpeed}
                      onChange={(e) => handleSpeedChange(index, 'dispatchSpeed', e.target.value)}
                    >
                      <FormControlLabel value="빠름" control={<Radio size="small" />} label="빠름" />
                      <FormControlLabel value="중간" control={<Radio size="small" />} label="중간" />
                      <FormControlLabel value="느림" control={<Radio size="small" />} label="느림" />
                    </RadioGroup>
                    <FormHelperText>{companyError.dispatchSpeed}</FormHelperText>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl component="fieldset" size="small" error={Boolean(companyError.pickupSpeed)}>
                    <FormLabel component="legend" sx={{ fontSize: '0.75rem' }}>픽업속도</FormLabel>
                    <RadioGroup
                      row
                      value={company.pickupSpeed}
                      onChange={(e) => handleSpeedChange(index, 'pickupSpeed', e.target.value)}
                    >
                      <FormControlLabel value="빠름" control={<Radio size="small" />} label="빠름" />
                      <FormControlLabel value="중간" control={<Radio size="small" />} label="중간" />
                      <FormControlLabel value="느림" control={<Radio size="small" />} label="느림" />
                    </RadioGroup>
                    <FormHelperText>{companyError.pickupSpeed}</FormHelperText>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl component="fieldset" size="small" error={Boolean(companyError.arrivalSpeed)}>
                    <FormLabel component="legend" sx={{ fontSize: '0.75rem' }}>도착속도</FormLabel>
                    <RadioGroup
                      row
                      value={company.arrivalSpeed}
                      onChange={(e) => handleSpeedChange(index, 'arrivalSpeed', e.target.value)}
                    >
                      <FormControlLabel value="빠름" control={<Radio size="small" />} label="빠름" />
                      <FormControlLabel value="중간" control={<Radio size="small" />} label="중간" />
                      <FormControlLabel value="느림" control={<Radio size="small" />} label="느림" />
                    </RadioGroup>
                    <FormHelperText>{companyError.arrivalSpeed}</FormHelperText>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          );
        })}

        {/* 업체 추가 버튼 */}
        {companyList.length < 5 && (
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddCompany}
            variant="outlined"
            fullWidth
            sx={{ mb: 2 }}
          >
            다른 업체 정보 추가
          </Button>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          취소
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={20} /> : null}
        >
          {saving ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickCostModal;

