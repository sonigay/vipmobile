import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Grid,
  Card,
  CardContent,
  Divider,
  IconButton,
  Autocomplete
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../api';

const ActivationInfoPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // URL 파라미터에서 정보 추출
  const [urlParams, setUrlParams] = useState({});
  
  // 수정 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editData, setEditData] = useState(null);
  
  // 폼 데이터 상태
  const [formData, setFormData] = useState({
    // 매장 정보 (자동 입력)
    storeName: '',
    pCode: '',
    
    // 개통 정보
    activationType: '신규',
    previousCarrier: 'SKT',
    previousCarrierOther: '',
    customerName: '',
    birthDate: '',
    phoneNumber: '',
    
    // 기기/유심 정보
    modelName: '',
    deviceSerial: '',
    color: '',
    simModel: '',
    simSerial: '',
    
    // 요금/약정 정보
    contractType: '이통사지원금',
    conversionSubsidy: '',
    additionalSubsidy: '',
    installmentMonths: '할부24개월',
    installmentAmount: '',
    free: '',
    plan: '',
    mediaServices: [],
    additionalServices: '',
    premierContract: '미가입',
    
    // 기타 정보
    reservationNumber: '',
    otherRequests: '',
    otherRequestsText: ''
  });

  // 수정 데이터 로드 함수
  const loadEditData = async (sheetId, rowIndex) => {
    try {
      console.log('📝 [ActivationInfoPage] 수정 데이터 로드 시작:', sheetId, rowIndex);
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/onsale/activation-info/${sheetId}/${rowIndex}`);
      console.log('📝 [ActivationInfoPage] API 응답 상태:', response.status);
      const result = await response.json();
      console.log('📝 [ActivationInfoPage] API 응답 데이터:', result);
      
      if (result.success) {
        setEditData(result.data);
        setFormData(result.data);
        console.log('✅ [ActivationInfoPage] 수정 데이터 로드 성공');
      } else {
        console.error('❌ [ActivationInfoPage] API 응답 실패:', result);
        setError('개통정보를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ [ActivationInfoPage] 수정 데이터 로드 실패:', error);
      setError('개통정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // URL 파라미터 파싱
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramData = {
      vipCompany: params.get('vipCompany') || '',
      activationSheetId: params.get('activationSheetId') || '',
      activationSheetName: params.get('activationSheetName') || '',
      targetUrl: params.get('targetUrl') || '',
      storeId: params.get('storeId') || '',
      editMode: params.get('editMode') || '',
      viewMode: params.get('viewMode') || '',
      sheetId: params.get('sheetId') || '',
      rowIndex: params.get('rowIndex') || ''
    };
    
    console.log('🔍 [ActivationInfoPage] URL 파라미터:', paramData);
    setUrlParams(paramData);
    
    // 수정 모드 확인
    if (paramData.editMode === 'true' && paramData.sheetId && paramData.rowIndex) {
      setIsEditMode(true);
      loadEditData(paramData.sheetId, paramData.rowIndex);
    }
    
    // 조회 모드 확인
    if (paramData.viewMode === 'true' && paramData.sheetId && paramData.rowIndex) {
      setIsViewMode(true);
      loadEditData(paramData.sheetId, paramData.rowIndex);
    } else {
      // 신규 입력 모드: 매장 정보 자동 설정
      setFormData(prev => ({
        ...prev,
        storeName: decodeURIComponent(paramData.vipCompany || ''),
        pCode: paramData.storeId || ''
      }));
    }
  }, []);

  // 요금제 데이터 로드
  useEffect(() => {
    loadPlanData();
  }, []);

  // 요금제 옵션 데이터 (동적 로드)
  const [planOptions, setPlanOptions] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [directInput, setDirectInput] = useState(false);

  // 요금제 데이터 로드 함수
  const loadPlanData = async () => {
    try {
      setPlanLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/ob/plan-data`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setPlanOptions(result.data);
      } else {
        console.warn('요금제 데이터 로드 실패:', result.error);
        setPlanOptions([]);
      }
    } catch (error) {
      console.error('요금제 데이터 로드 실패:', error);
      setPlanOptions([]);
    } finally {
      setPlanLoading(false);
    }
  };

  // 미디어 서비스 옵션
  const mediaServiceOptions = [
    '밀리의서재',
    '아이들나라', 
    '바이브',
    '지니',
    '유플레이(구 영화월정액)'
  ];

  // 폼 데이터 업데이트 함수
  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 미디어 서비스 체크박스 처리
  const handleMediaServiceChange = (service) => {
    setFormData(prev => ({
      ...prev,
      mediaServices: (prev.mediaServices || []).includes(service)
        ? (prev.mediaServices || []).filter(s => s !== service)
        : [...(prev.mediaServices || []), service]
    }));
  };

  // 유효성 검사
  const validateForm = () => {
    const required = ['customerName', 'birthDate', 'phoneNumber', 'modelName', 'plan'];
    const missing = required.filter(field => !formData[field]);
    
    if (missing.length > 0) {
      setError(`다음 필드는 필수입니다: ${missing.join(', ')}`);
      return false;
    }
    
    // 전화번호 형식 검증
    const phoneRegex = /^[0-9-+\s()]+$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      setError('전화번호 형식이 올바르지 않습니다.');
      return false;
    }
    
    return true;
  };

  // 제출 처리
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (isEditMode) {
        // 수정 모드: PUT API 호출
        const response = await fetch(`${API_BASE_URL}/api/onsale/activation-info/${urlParams.sheetId}/${urlParams.rowIndex}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: formData,
            editor: formData.storeName // 수정자 정보
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          setSuccess('개통정보가 수정되었습니다.');
          
          // 부모 컴포넌트에 수정 완료 알림 (새로고침을 위해)
          if (window.opener) {
            window.opener.postMessage({ type: 'ACTIVATION_UPDATED' }, '*');
          }
          
          setTimeout(() => {
            window.history.back();
          }, 2000);
        } else {
          setError(result.error || '개통정보 수정에 실패했습니다.');
        }
      } else {
        // 신규 입력 모드: POST API 호출
        // localStorage에 시트 정보 저장 (확장 프로그램용)
        localStorage.setItem('vip_activation_sheetId', urlParams.activationSheetId);
        localStorage.setItem('vip_activation_sheetName', urlParams.activationSheetName);
        localStorage.setItem('vip_activation_phoneNumber', formData.phoneNumber);
        
        const response = await fetch(`${API_BASE_URL}/api/onsale/activation-info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sheetId: urlParams.activationSheetId,
            sheetName: urlParams.activationSheetName,
            data: formData
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          setSuccess('개통정보가 저장되었습니다. U+ 온세일 접수 페이지로 이동합니다.');
          
          // 2초 후 U+ 페이지로 이동
          setTimeout(() => {
            window.open(urlParams.targetUrl, '_blank');
          }, 2000);
        } else {
          setError(result.error || '개통정보 저장에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('개통정보 처리 실패:', error);
      setError('개통정보 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 취소 처리 함수
  const handleCancel = async () => {
    if (!window.confirm('이 개통정보를 취소 처리하시겠습니까?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/onsale/activation-info/${urlParams.sheetId}/${urlParams.rowIndex}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelledBy: formData.storeName // 취소자 정보
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess('개통정보가 취소되었습니다.');
        setTimeout(() => {
          window.history.back();
        }, 2000);
      } else {
        setError(result.error || '개통정보 취소에 실패했습니다.');
      }
    } catch (error) {
      console.error('개통정보 취소 실패:', error);
      setError('개통정보 취소에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 인쇄 기능
  const handlePrint = () => {
    window.print();
  };

  // 뒤로가기
  const handleGoBack = () => {
    window.history.back();
  };

  // 개통완료 처리
  const handleCompleteActivation = async () => {
    if (!window.confirm('이 개통정보를 완료 처리하시겠습니까?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/onsale/activation-info/${urlParams.sheetId}/${urlParams.rowIndex}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completedBy: urlParams.vipCompany
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess('개통정보가 완료 처리되었습니다.');
        
        // 부모 컴포넌트에 완료 알림
        if (window.opener) {
          window.opener.postMessage({ type: 'ACTIVATION_COMPLETED' }, '*');
        }
        
        setTimeout(() => {
          window.history.back();
        }, 2000);
      } else {
        setError(result.error || '개통정보 완료 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('개통정보 완료 처리 실패:', error);
      setError('개통정보 완료 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 인쇄 스타일 */}
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 15mm;
            }
            
            .no-print {
              display: none !important;
            }
            
            .print-container {
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
            
            body {
              font-size: 12px !important;
              line-height: 1.4 !important;
            }
            
            .MuiGrid-container {
              margin: 0 !important;
              width: 100% !important;
            }
            
            .MuiTextField-root .MuiOutlinedInput-root {
              border: none !important;
              background: transparent !important;
            }
            
            .MuiTextField-root .MuiOutlinedInput-notchedOutline {
              border: none !important;
            }
            
            .MuiTextField-root .MuiInputBase-input {
              padding: 2px 0 !important;
              border-bottom: 1px solid #ccc !important;
              background: transparent !important;
            }
            
            .MuiFormControl-root .MuiSelect-select {
              border: none !important;
              border-bottom: 1px solid #ccc !important;
              padding: 2px 0 !important;
              background: transparent !important;
            }
            
            .MuiFormControl-root .MuiOutlinedInput-notchedOutline {
              border: none !important;
            }
            
            .MuiFormGroup-root {
              flex-direction: row !important;
              flex-wrap: wrap !important;
            }
            
            .MuiCheckbox-root {
              padding: 2px !important;
            }
            
            .MuiInputLabel-root {
              position: static !important;
              transform: none !important;
              font-size: 11px !important;
              color: #333 !important;
              margin-bottom: 2px !important;
            }
            
            .MuiFormControlLabel-root {
              margin-right: 16px !important;
            }
            
            .MuiCheckbox-root:not(.Mui-checked) {
              display: none !important;
            }
          }
        `}
      </style>
      
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', position: 'relative' }} className="print-container">
      {/* 워터마크 */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
          opacity: 0.03,
          overflow: 'hidden'
        }}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <Typography
            key={i}
            sx={{
              position: 'absolute',
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              fontSize: `${40 + Math.random() * 80}px`,
              fontWeight: 'bold',
              color: '#000',
              transform: `rotate(${(Math.random() - 0.5) * 60}deg`,
              userSelect: 'none'
            }}
          >
            {decodeURIComponent(urlParams.vipCompany || '')}
          </Typography>
        ))}
      </Box>

      {/* 상단 인디케이터 */}
      <Box
        sx={{
          position: 'fixed',
          top: 20,
          right: 20,
          bgcolor: 'white',
          border: '2px solid #000',
          borderRadius: '8px',
          px: 2,
          py: 1,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography variant="body2" fontWeight="bold">
          (주)브이아이피플러스
        </Typography>
      </Box>

      {/* 메인 컨텐츠 */}
      <Box sx={{ position: 'relative', zIndex: 2, p: 3 }}>
        {/* 헤더 */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 2
            }}
          >
            📱 개통정보 입력
          </Typography>
          <Typography variant="h6" color="text.secondary">
            U+ 온라인 가입을 위한 개통정보를 입력해주세요
          </Typography>
        </Box>

        {/* 폼 */}
        <Paper 
          sx={{ 
            p: 3, 
            maxWidth: 1200, 
            mx: 'auto',
            background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaf6 100%)',
            border: '1px solid #e1bee7',
            boxShadow: '0 8px 32px rgba(142, 36, 170, 0.15)'
          }}
        >
          <Grid container spacing={2}>
            {/* 매장 정보 */}
            <Grid item xs={12}>
              <Card sx={{ mb: 2, bgcolor: '#f3e5f5' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: '#5e35b1', fontWeight: 'bold' }}>
                    🏪 매장 정보
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="매장명/매장번호"
                        value={formData.storeName}
                        InputProps={{ readOnly: true }}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="P코드"
                        value={formData.pCode}
                        InputProps={{ readOnly: true }}
                        variant="outlined"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* 개통 정보 */}
            <Grid item xs={12}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: '#5e35b1', fontWeight: 'bold' }}>
                    📋 개통 정보
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">개통유형 *</FormLabel>
                        <RadioGroup
                          value={formData.activationType}
                          onChange={(e) => updateFormData('activationType', e.target.value)}
                          row
                        >
                          <FormControlLabel value="신규" control={<Radio />} label="신규" />
                          <FormControlLabel value="MNP" control={<Radio />} label="MNP" />
                          <FormControlLabel value="재가입" control={<Radio />} label="재가입" />
                          <FormControlLabel value="정책기변" control={<Radio />} label="정책기변" />
                        </RadioGroup>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">전통신사</FormLabel>
                        <RadioGroup
                          value={formData.previousCarrier}
                          onChange={(e) => updateFormData('previousCarrier', e.target.value)}
                          row
                        >
                          <FormControlLabel value="SKT" control={<Radio />} label="SKT" />
                          <FormControlLabel value="KT" control={<Radio />} label="KT" />
                          <FormControlLabel value="알뜰폰" control={<Radio />} label="알뜰폰" />
                        </RadioGroup>
                      </FormControl>
                      {formData.previousCarrier === '알뜰폰' && (
                        <TextField
                          fullWidth
                          label="알뜰폰 상세"
                          value={formData.previousCarrierOther}
                          onChange={(e) => updateFormData('previousCarrierOther', e.target.value)}
                          margin="normal"
                        />
                      )}
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="고객명 *"
                        value={formData.customerName}
                        onChange={(e) => updateFormData('customerName', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="생년월일 *"
                        value={formData.birthDate}
                        onChange={(e) => updateFormData('birthDate', e.target.value)}
                        placeholder="YYMMDD 또는 YYYYMMDD"
                        helperText="미성년자/외국인전체기재"
                        required
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="개통번호 *"
                        value={formData.phoneNumber}
                        onChange={(e) => updateFormData('phoneNumber', e.target.value)}
                        placeholder="010-1234-5678"
                        required
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* 기기 및 유심 정보 */}
            <Grid item xs={12}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: '#5e35b1', fontWeight: 'bold' }}>
                    📱 기기 및 유심 정보
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="모델명 *"
                        value={formData.modelName}
                        onChange={(e) => updateFormData('modelName', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="일련번호(기기) *"
                        value={formData.deviceSerial}
                        onChange={(e) => updateFormData('deviceSerial', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="색상"
                        value={formData.color}
                        onChange={(e) => updateFormData('color', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="유심모델"
                        value={formData.simModel}
                        onChange={(e) => updateFormData('simModel', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="일련번호(유심)"
                        value={formData.simSerial}
                        onChange={(e) => updateFormData('simSerial', e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* 요금 및 약정 정보 */}
            <Grid item xs={12}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: '#5e35b1', fontWeight: 'bold' }}>
                    💰 요금 및 약정 정보
                  </Typography>
                  <Grid container spacing={2}>
                    {/* 한 줄 배치: 약정유형 + 할부개월 */}
                    <Grid item xs={12} md={6}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">약정유형</FormLabel>
                        <RadioGroup
                          value={formData.contractType}
                          onChange={(e) => updateFormData('contractType', e.target.value)}
                          row
                        >
                          <FormControlLabel value="이통사지원금" control={<Radio />} label="이통사지원금" />
                          <FormControlLabel value="선택약정(24)" control={<Radio />} label="선택약정(24)" />
                          <FormControlLabel value="선택약정(12)" control={<Radio />} label="선택약정(12)" />
                          <FormControlLabel value="선택약정(12+12)" control={<Radio />} label="선택약정(12+12)" />
                        </RadioGroup>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">할부개월</FormLabel>
                        <RadioGroup
                          value={formData.installmentMonths}
                          onChange={(e) => updateFormData('installmentMonths', e.target.value)}
                          row
                        >
                          <FormControlLabel value="할부24개월" control={<Radio />} label="24개월" />
                          <FormControlLabel value="할부30개월" control={<Radio />} label="30개월" />
                          <FormControlLabel value="할부36개월" control={<Radio />} label="36개월" />
                          <FormControlLabel value="현금완납" control={<Radio />} label="현금완납" />
                        </RadioGroup>
                      </FormControl>
                    </Grid>

                    {/* 한 줄 배치: 이통사지원금 + 유통망추가지원금 + 할부원금 + 프리 */}
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="이통사지원금"
                        value={formData.conversionSubsidy}
                        onChange={(e) => updateFormData('conversionSubsidy', e.target.value)}
                        type="number"
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="유통망추가지원금"
                        value={formData.additionalSubsidy}
                        onChange={(e) => updateFormData('additionalSubsidy', e.target.value)}
                        type="number"
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="할부원금"
                        value={formData.installmentAmount}
                        onChange={(e) => updateFormData('installmentAmount', e.target.value)}
                        type="number"
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="프리"
                        value={formData.free}
                        onChange={(e) => updateFormData('free', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={directInput}
                              onChange={(e) => setDirectInput(e.target.checked)}
                              size="small"
                            />
                          }
                          label="직접입력"
                        />
                      </Box>
                      
                      {directInput ? (
                        <TextField
                          fullWidth
                          label="요금제(OTT명까지) *"
                          value={formData.plan}
                          onChange={(e) => updateFormData('plan', e.target.value)}
                          placeholder="요금제명을 직접 입력하세요"
                          required
                        />
                      ) : (
                        <Autocomplete
                          fullWidth
                          options={planOptions}
                          value={planOptions.find(option => option.planName === formData.plan) || null}
                          onChange={(event, newValue) => updateFormData('plan', newValue?.planName || '')}
                          getOptionLabel={(option) => `${option.planName} (${option.planGroup}) - ${Number(option.baseFee || 0).toLocaleString()}원`}
                          isOptionEqualToValue={(option, value) => option.planName === value?.planName}
                          loading={planLoading}
                          disabled={planOptions.length === 0}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="요금제(OTT명까지) *"
                              placeholder={planOptions.length === 0 ? "요금제 데이터를 불러오는 중..." : "요금제를 검색하거나 선택하세요"}
                              required
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {planLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                          filterOptions={(options, { inputValue }) => {
                            const searchTerm = inputValue.toLowerCase();
                            return options.filter(option => {
                              const planName = option.planName.toLowerCase();
                              const planGroup = option.planGroup.toLowerCase();
                              const baseFee = Number(option.baseFee || 0).toLocaleString();
                              const baseFeeNumber = (option.baseFee || 0).toString();
                              
                              return (planName || '').includes(searchTerm) || 
                                     (planGroup || '').includes(searchTerm) || 
                                     (baseFee || '').includes(searchTerm) ||
                                     (baseFeeNumber || '').includes(searchTerm);
                            });
                          }}
                          noOptionsText={planOptions.length === 0 ? "요금제 데이터가 없습니다. 직접입력을 사용하세요." : "검색 결과가 없습니다"}
                          renderOption={(props, option) => (
                            <Box component="li" {...props}>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                  {option.planName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {option.planGroup} - {Number(option.baseFee || 0).toLocaleString()}원
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        />
                      )}
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">요금제미디어서비스(95이상)</FormLabel>
                        <FormGroup row>
                          {mediaServiceOptions.map((service) => (
                            <FormControlLabel
                              key={service}
                              control={
                                <Checkbox
                                  checked={(formData.mediaServices || []).includes(service)}
                                  onChange={() => handleMediaServiceChange(service)}
                                />
                              }
                              label={service}
                            />
                          ))}
                        </FormGroup>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">프리미어약정(85이상)</FormLabel>
                        <RadioGroup
                          value={formData.premierContract}
                          onChange={(e) => updateFormData('premierContract', e.target.value)}
                          row
                        >
                          <FormControlLabel value="가입" control={<Radio />} label="가입" />
                          <FormControlLabel value="미가입" control={<Radio />} label="미가입" />
                        </RadioGroup>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="부가서비스"
                        value={formData.additionalServices}
                        onChange={(e) => updateFormData('additionalServices', e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* 기타 정보 */}
            <Grid item xs={12}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: '#5e35b1', fontWeight: 'bold' }}>
                    📝 기타 정보
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="예약번호(사전예약시)"
                        value={formData.reservationNumber}
                        onChange={(e) => updateFormData('reservationNumber', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.otherRequests}
                            onChange={(e) => updateFormData('otherRequests', e.target.checked)}
                          />
                        }
                        label="동판여부"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="기타요청사항"
                        value={formData.otherRequestsText}
                        onChange={(e) => updateFormData('otherRequestsText', e.target.value)}
                        multiline
                        rows={3}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* 안내사항 */}
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ mt: 1, mb: 1 }}>
                <strong>안내사항:</strong><br/>
                • 보험 및 맘대로폰교체 가입은 서류 별도 접수 필요<br/>
                • 복지서류는 별도 접수 시 복지등록 가능
              </Typography>
            </Grid>
          </Grid>

          {/* 제출 버튼 영역 */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography 
              variant="body2" 
              sx={{ 
                mt: 1, 
                mb: 3,
                p: 2, 
                backgroundColor: '#fff9c4', 
                borderRadius: 1,
                border: '1px solid #fdd835'
              }}
            >
              <strong>제출 후 다음 온세일 접수페이지로 이동합니다. 온세일 접수까지 완료되어야 최종 완료입니다.</strong>
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }} className="no-print">
              {isEditMode ? (
                // 수정 모드 버튼들
                <>
                  <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    sx={{ minWidth: 120 }}
                  >
                    인쇄하기
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={handleGoBack}
                    sx={{ minWidth: 120 }}
                  >
                    뒤로가기
                  </Button>
                  
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleCancel}
                    disabled={loading}
                    sx={{ minWidth: 120 }}
                  >
                    개통 취소
                  </Button>
                  
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSubmit}
                    disabled={loading}
                    sx={{ 
                      minWidth: 120,
                      background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                      '&:hover': { 
                        background: 'linear-gradient(135deg, #7b1fa2 0%, #4a2c7a 100%)'
                      },
                      boxShadow: '0 4px 15px rgba(142, 36, 170, 0.3)'
                    }}
                  >
                    {loading ? <CircularProgress size={20} /> : '수정 완료'}
                  </Button>
                </>
              ) : isViewMode ? (
                // 조회 모드 버튼들
                <>
                  <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    sx={{ minWidth: 120 }}
                  >
                    인쇄하기
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={handleGoBack}
                    sx={{ minWidth: 120 }}
                  >
                    뒤로가기
                  </Button>
                  
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleCompleteActivation}
                    disabled={loading}
                    sx={{ 
                      minWidth: 120,
                      background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
                      '&:hover': { 
                        background: 'linear-gradient(135deg, #388e3c 0%, #1b5e20 100%)'
                      },
                      boxShadow: '0 4px 15px rgba(76, 175, 80, 0.3)'
                    }}
                  >
                    {loading ? <CircularProgress size={20} /> : '개통완료'}
                  </Button>
                </>
              ) : (
                // 신규 입력 모드 버튼들
                <>
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={handleGoBack}
                    sx={{ minWidth: 120 }}
                  >
                    뒤로가기
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    sx={{ minWidth: 120 }}
                  >
                    인쇄하기
                  </Button>
                  
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSubmit}
                    disabled={loading}
                    sx={{ 
                      minWidth: 200,
                      background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                      '&:hover': { 
                        background: 'linear-gradient(135deg, #7b1fa2 0%, #4a2c7a 100%)'
                      },
                      boxShadow: '0 4px 15px rgba(142, 36, 170, 0.3)'
                    }}
                  >
                    {loading ? <CircularProgress size={20} /> : '제출하고 온세일 접수하기'}
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* 에러/성공 메시지 */}
      {error && (
        <Alert severity="error" sx={{ position: 'fixed', top: 20, left: 20, right: 20, zIndex: 1000 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ position: 'fixed', top: 20, left: 20, right: 20, zIndex: 1000 }}>
          {success}
        </Alert>
      )}

      {/* 인쇄 스타일 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            font-size: 10pt !important;
            line-height: 1.2 !important;
          }
          
          .watermark {
            display: block !important;
            opacity: 0.03 !important;
            font-size: 70px !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          /* 전체 컨테이너 조정 */
          .MuiContainer-root {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Paper 컴포넌트 조정 */
          .MuiPaper-root {
            padding: 6px !important;
            margin: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }
          
          /* Grid 레이아웃 조정 - 세로 최적화 */
          .MuiGrid-container {
            margin: 0 !important;
          }
          
          .MuiGrid-item {
            padding: 2px !important;
          }
          
          /* Card 컴포넌트 조정 */
          .MuiCard-root {
            margin: 1px 0 !important;
            padding: 3px !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            page-break-inside: avoid !important;
          }
          
          .MuiCardContent-root {
            padding: 3px !important;
          }
          
          /* Typography 조정 */
          .MuiTypography-h4 {
            font-size: 16pt !important;
            margin: 1px 0 !important;
          }
          
          .MuiTypography-h6 {
            font-size: 11pt !important;
            margin: 1px 0 !important;
            font-weight: bold !important;
          }
          
          .MuiTypography-body1 {
            font-size: 9pt !important;
            margin: 0 !important;
          }
          
          .MuiTypography-body2 {
            font-size: 9pt !important;
            margin: 0 !important;
          }
          
          /* Form 필드 조정 - 세로 레이아웃에 맞게 */
          .MuiTextField-root {
            margin: 1px 0 !important;
          }
          
          .MuiInputBase-root {
            font-size: 9pt !important;
            padding: 3px !important;
            min-height: 22px !important;
          }
          
          .MuiInputLabel-root {
            font-size: 9pt !important;
          }
          
          input, select, textarea {
            font-size: 9pt !important;
            border: 1px solid #000 !important;
            padding: 2px !important;
            margin: 0 !important;
            height: 22px !important;
          }
          
          /* Radio, Checkbox 조정 */
          .MuiFormControl-root {
            margin: 1px 0 !important;
          }
          
          .MuiFormGroup-root {
            margin: 1px 0 !important;
          }
          
          .MuiFormControlLabel-root {
            margin: 0 !important;
            font-size: 9pt !important;
          }
          
          .MuiRadio-root {
            padding: 1px !important;
            font-size: 9pt !important;
          }
          
          .MuiCheckbox-root {
            padding: 1px !important;
            font-size: 9pt !important;
          }
          
          .MuiFormLabel-root {
            font-size: 9pt !important;
            font-weight: bold !important;
          }
          
          /* Grid spacing 조정 - 세로 최적화 */
          .MuiGrid-spacing-xs-2 > .MuiGrid-item {
            padding: 1px !important;
          }
          
          /* Alert 컴포넌트 조정 */
          .MuiAlert-root {
            padding: 2px !important;
            margin: 1px 0 !important;
            font-size: 8pt !important;
          }
          
          /* Button 영역 숨김 */
          .MuiButton-root {
            display: none !important;
          }
          
          /* 헤더 영역 조정 */
          .MuiBox-root {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* 세로 레이아웃 최적화 - 2열 배치 허용 */
          .MuiGrid-item {
            width: 50% !important;
            flex-basis: 50% !important;
            max-width: 50% !important;
          }
          
          /* 특정 필드는 전체 너비 유지 */
          .MuiGrid-item[data-full-width="true"] {
            width: 100% !important;
            flex-basis: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
      </Box>
    </>
  );
};

export default ActivationInfoPage;
