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
  IconButton
} from '@mui/material';
import {
  Print as PrintIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';

const ActivationInfoPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // URL 파라미터에서 정보 추출
  const [urlParams, setUrlParams] = useState({});
  
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
    contractType: '공시지원금',
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

  // URL 파라미터 파싱
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramData = {
      vipCompany: params.get('vipCompany') || '',
      activationSheetId: params.get('activationSheetId') || '',
      activationSheetName: params.get('activationSheetName') || '',
      targetUrl: params.get('targetUrl') || '',
      storeId: params.get('storeId') || ''
    };
    setUrlParams(paramData);
    
    // 매장 정보 자동 설정
    setFormData(prev => ({
      ...prev,
      storeName: decodeURIComponent(paramData.vipCompany || ''),
      pCode: paramData.storeId || ''
    }));
  }, []);

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
      mediaServices: prev.mediaServices.includes(service)
        ? prev.mediaServices.filter(s => s !== service)
        : [...prev.mediaServices, service]
    }));
  };

  // 유효성 검사
  const validateForm = () => {
    const required = ['customerName', 'birthDate', 'phoneNumber', 'modelName', 'deviceSerial', 'plan'];
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
      // localStorage에 시트 정보 저장 (확장 프로그램용)
      localStorage.setItem('vip_activation_sheetId', urlParams.activationSheetId);
      localStorage.setItem('vip_activation_sheetName', urlParams.activationSheetName);
      localStorage.setItem('vip_activation_phoneNumber', formData.phoneNumber);
      
      // API 호출
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/onsale/activation-info`, {
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
          const targetUrl = `${urlParams.targetUrl}?vipCompany=${encodeURIComponent(urlParams.vipCompany)}`;
          window.open(targetUrl, '_blank');
        }, 2000);
      } else {
        setError(result.error || '개통정보 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('개통정보 저장 실패:', error);
      setError('개통정보 저장 중 오류가 발생했습니다.');
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', position: 'relative' }}>
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
            p: 4, 
            maxWidth: 1200, 
            mx: 'auto',
            background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaf6 100%)',
            border: '1px solid #e1bee7',
            boxShadow: '0 8px 32px rgba(142, 36, 170, 0.15)'
          }}
        >
          <Grid container spacing={3}>
            {/* 매장 정보 */}
            <Grid item xs={12}>
              <Card sx={{ mb: 3, bgcolor: '#f3e5f5' }}>
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
              <Card sx={{ mb: 3 }}>
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
              <Card sx={{ mb: 3 }}>
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
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: '#5e35b1', fontWeight: 'bold' }}>
                    💰 요금 및 약정 정보
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">약정유형</FormLabel>
                        <RadioGroup
                          value={formData.contractType}
                          onChange={(e) => updateFormData('contractType', e.target.value)}
                        >
                          <FormControlLabel value="공시지원금" control={<Radio />} label="공시지원금" />
                          <FormControlLabel value="선택약정(24)" control={<Radio />} label="선택약정(24)" />
                          <FormControlLabel value="선택약정(12)" control={<Radio />} label="선택약정(12)" />
                          <FormControlLabel value="선택약정(12+12)" control={<Radio />} label="선택약정(12+12)" />
                        </RadioGroup>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                          fullWidth
                          label="전환지원금"
                          value={formData.conversionSubsidy}
                          onChange={(e) => updateFormData('conversionSubsidy', e.target.value)}
                          type="number"
                        />
                        <TextField
                          fullWidth
                          label="유통망추가지원금"
                          value={formData.additionalSubsidy}
                          onChange={(e) => updateFormData('additionalSubsidy', e.target.value)}
                          type="number"
                        />
                      </Box>
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
                    <Grid item xs={12} md={6}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                          fullWidth
                          label="할부원금"
                          value={formData.installmentAmount}
                          onChange={(e) => updateFormData('installmentAmount', e.target.value)}
                          type="number"
                        />
                        <TextField
                          fullWidth
                          label="프리"
                          value={formData.free}
                          onChange={(e) => updateFormData('free', e.target.value)}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="요금제(OTT명까지) *"
                        value={formData.plan}
                        onChange={(e) => updateFormData('plan', e.target.value)}
                        required
                      />
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
                                  checked={formData.mediaServices.includes(service)}
                                  onChange={() => handleMediaServiceChange(service)}
                                />
                              }
                              label={service}
                            />
                          ))}
                        </FormGroup>
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
                    <Grid item xs={12} md={6}>
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
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* 기타 정보 */}
            <Grid item xs={12}>
              <Card sx={{ mb: 3 }}>
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
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>안내사항:</strong><br/>
                  • 보험 및 맘대로폰교체 가입은 서류 별도 접수 필요<br/>
                  • 복지서류는 별도 접수 시 복지등록 가능
                </Typography>
              </Alert>
            </Grid>
          </Grid>

          {/* 제출 버튼 영역 */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>제출 후 다음 온세일 접수페이지로 이동합니다. 온세일 접수까지 완료되어야 최종 완료입니다.</strong>
              </Typography>
            </Alert>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
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
            size: A4;
            margin: 8mm;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            font-size: 8pt !important;
            line-height: 1.2 !important;
          }
          
          .watermark {
            display: block !important;
            opacity: 0.03 !important;
            font-size: 60px !important;
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
            padding: 8px !important;
            margin: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }
          
          /* Grid 레이아웃 조정 */
          .MuiGrid-container {
            margin: 0 !important;
          }
          
          .MuiGrid-item {
            padding: 2px !important;
          }
          
          /* Card 컴포넌트 조정 */
          .MuiCard-root {
            margin: 2px !important;
            padding: 4px !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
          }
          
          .MuiCardContent-root {
            padding: 4px !important;
          }
          
          /* Typography 조정 */
          .MuiTypography-h6 {
            font-size: 10pt !important;
            margin: 2px 0 !important;
          }
          
          .MuiTypography-body1 {
            font-size: 8pt !important;
            margin: 1px 0 !important;
          }
          
          .MuiTypography-body2 {
            font-size: 7pt !important;
            margin: 1px 0 !important;
          }
          
          /* Form 필드 조정 */
          .MuiTextField-root {
            margin: 1px !important;
          }
          
          .MuiInputBase-root {
            font-size: 7pt !important;
            padding: 2px !important;
            min-height: 20px !important;
          }
          
          input, select, textarea {
            font-size: 7pt !important;
            border: 1px solid #000 !important;
            padding: 1px !important;
            margin: 0 !important;
          }
          
          /* Radio, Checkbox 조정 */
          .MuiFormControl-root {
            margin: 1px !important;
          }
          
          .MuiFormGroup-root {
            margin: 1px !important;
          }
          
          .MuiFormControlLabel-root {
            margin: 0 !important;
            font-size: 7pt !important;
          }
          
          /* Grid spacing 조정 */
          .MuiGrid-spacing-xs-3 > .MuiGrid-item {
            padding: 1px !important;
          }
          
          /* Alert 컴포넌트 조정 */
          .MuiAlert-root {
            padding: 2px !important;
            margin: 1px 0 !important;
            font-size: 7pt !important;
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
        }
      `}</style>
    </Box>
  );
};

export default ActivationInfoPage;
