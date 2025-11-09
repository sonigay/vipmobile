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
  Chip
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
  const [companies, setCompanies] = useState([]);
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
    cost: '',
    costInputMode: 'select',
    dispatchSpeed: '중간',
    pickupSpeed: '중간',
    arrivalSpeed: '중간'
  };

  const [companyList, setCompanyList] = useState([{ ...initialCompany }]);

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
    if (companyList.length >= 5) {
      alert('최대 5개 업체까지만 등록 가능합니다.');
      return;
    }
    setCompanyList([...companyList, { ...initialCompany }]);
  };

  // 업체 삭제
  const handleRemoveCompany = (index) => {
    if (companyList.length === 1) {
      alert('최소 1개 업체는 등록해야 합니다.');
      return;
    }
    setCompanyList(companyList.filter((_, i) => i !== index));
  };

  // 업체명 변경
  const handleCompanyNameChange = async (index, value, inputMode) => {
    const newList = [...companyList];
    newList[index].name = value;
    newList[index].nameInputMode = inputMode;

    // 선택 모드이고 업체명이 변경되면 전화번호 목록 로드
    if (inputMode === 'select' && value && value !== '직접 입력') {
      try {
        const result = await api.getQuickServicePhoneNumbers(value);
        if (result.success) {
          // 전화번호 필드 초기화
          newList[index].phone = '';
          newList[index].phoneInputMode = 'select';
          newList[index].cost = '';
          newList[index].costInputMode = 'select';
        }
      } catch (err) {
        console.error('전화번호 목록 로드 오류:', err);
      }
    }

    setCompanyList(newList);
  };

  // 전화번호 변경
  const handlePhoneChange = async (index, value, inputMode) => {
    const newList = [...companyList];
    newList[index].phone = value;
    newList[index].phoneInputMode = inputMode;

    // 선택 모드이고 업체명과 전화번호가 모두 있으면 비용 목록 로드
    if (inputMode === 'select' && value && value !== '직접 입력' && newList[index].name) {
      try {
        const result = await api.getQuickServiceCosts(newList[index].name, value);
        if (result.success) {
          // 비용 필드 초기화
          newList[index].cost = '';
          newList[index].costInputMode = 'select';
        }
      } catch (err) {
        console.error('비용 목록 로드 오류:', err);
      }
    }

    setCompanyList(newList);
  };

  // 비용 변경
  const handleCostChange = (index, value, inputMode) => {
    const newList = [...companyList];
    newList[index].cost = value;
    newList[index].costInputMode = inputMode;
    setCompanyList(newList);
  };

  // 속도 변경
  const handleSpeedChange = (index, type, value) => {
    const newList = [...companyList];
    newList[index][type] = value;
    setCompanyList(newList);
  };

  // 입력값 검증
  const validateForm = () => {
    for (let i = 0; i < companyList.length; i++) {
      const company = companyList[i];
      
      if (!company.name || company.name.trim() === '') {
        setError(`업체 ${i + 1}의 업체명을 입력해주세요.`);
        return false;
      }

      if (company.name.length > 50) {
        setError(`업체 ${i + 1}의 업체명이 너무 깁니다. (최대 50자)`);
        return false;
      }

      if (!company.phone || company.phone.trim() === '') {
        setError(`업체 ${i + 1}의 전화번호를 입력해주세요.`);
        return false;
      }

      const phoneRegex = /^[0-9-]+$/;
      if (!phoneRegex.test(company.phone.replace(/\s/g, ''))) {
        setError(`업체 ${i + 1}의 전화번호 형식이 올바르지 않습니다.`);
        return false;
      }

      if (!company.cost || company.cost.trim() === '') {
        setError(`업체 ${i + 1}의 비용을 입력해주세요.`);
        return false;
      }

      const costNum = parseInt(company.cost.replace(/,/g, ''));
      if (isNaN(costNum) || costNum <= 0 || costNum > 1000000) {
        setError(`업체 ${i + 1}의 비용이 유효하지 않습니다. (1원 ~ 1,000,000원)`);
        return false;
      }

      if (!company.dispatchSpeed || !company.pickupSpeed || !company.arrivalSpeed) {
        setError(`업체 ${i + 1}의 속도 정보를 모두 선택해주세요.`);
        return false;
      }
    }

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

      const companiesData = companyList.map(company => ({
        name: company.name.trim(),
        phone: company.phone.trim(),
        cost: parseInt(company.cost.replace(/,/g, '')),
        dispatchSpeed: company.dispatchSpeed,
        pickupSpeed: company.pickupSpeed,
        arrivalSpeed: company.arrivalSpeed
      }));

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

      const result = await api.saveQuickCost(saveData);
      
      if (result.success) {
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

        alert('퀵비용 정보가 성공적으로 저장되었습니다.');
        onClose();
        // 폼 초기화
        setCompanyList([{ ...initialCompany }]);
      } else {
        setError(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('저장 오류:', err);
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 모달 닫기
  const handleClose = () => {
    setError(null);
    setCompanyList([{ ...initialCompany }]);
    onClose();
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
        {companyList.map((company, index) => (
          <Box key={index} sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
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
                <FormControl fullWidth size="small">
                  <InputLabel>업체명</InputLabel>
                  <Select
                    value={company.nameInputMode === 'select' ? company.name : '직접 입력'}
                    label="업체명"
                    onChange={(e) => {
                      if (e.target.value === '직접 입력') {
                        handleCompanyNameChange(index, '', 'input');
                      } else {
                        handleCompanyNameChange(index, e.target.value, 'select');
                      }
                    }}
                  >
                    {loading ? (
                      <MenuItem disabled>로딩 중...</MenuItem>
                    ) : (
                      <>
                        <MenuItem value="직접 입력">직접 입력</MenuItem>
                        {companyOptions.map((opt) => (
                          <MenuItem key={opt} value={opt}>
                            {opt}
                          </MenuItem>
                        ))}
                      </>
                    )}
                  </Select>
                </FormControl>
                {company.nameInputMode === 'input' && (
                  <TextField
                    fullWidth
                    size="small"
                    sx={{ mt: 1 }}
                    placeholder="업체명을 입력하세요"
                    value={company.name}
                    onChange={(e) => handleCompanyNameChange(index, e.target.value, 'input')}
                    inputProps={{ maxLength: 50 }}
                  />
                )}
              </Grid>

              {/* 전화번호 */}
              <Grid item xs={12} sm={6}>
                {company.name && company.nameInputMode === 'select' && company.name !== '직접 입력' ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>대표번호</InputLabel>
                    <Select
                      value={company.phoneInputMode === 'select' ? company.phone : '직접 입력'}
                      label="대표번호"
                      onChange={async (e) => {
                        if (e.target.value === '직접 입력') {
                          handlePhoneChange(index, '', 'input');
                        } else {
                          handlePhoneChange(index, e.target.value, 'select');
                        }
                      }}
                    >
                      <MenuItem value="직접 입력">직접 입력</MenuItem>
                      {/* 전화번호 목록은 동적으로 로드 */}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    label="대표번호"
                    placeholder="010-1234-5678"
                    value={company.phone}
                    onChange={(e) => handlePhoneChange(index, e.target.value, 'input')}
                  />
                )}
              </Grid>

              {/* 비용 */}
              <Grid item xs={12} sm={6}>
                {company.name && company.phone && company.nameInputMode === 'select' && company.phoneInputMode === 'select' && company.name !== '직접 입력' && company.phone !== '직접 입력' ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>비용</InputLabel>
                    <Select
                      value={company.costInputMode === 'select' ? company.cost : '직접 입력'}
                      label="비용"
                      onChange={(e) => {
                        if (e.target.value === '직접 입력') {
                          handleCostChange(index, '', 'input');
                        } else {
                          handleCostChange(index, e.target.value, 'select');
                        }
                      }}
                    >
                      <MenuItem value="직접 입력">직접 입력</MenuItem>
                      {/* 비용 목록은 동적으로 로드 */}
                    </Select>
                  </FormControl>
                ) : (
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
                  />
                )}
              </Grid>

              {/* 속도 선택 */}
              <Grid item xs={12} sm={6}>
                <FormControl component="fieldset" size="small">
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
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl component="fieldset" size="small">
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
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl component="fieldset" size="small">
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
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        ))}

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

