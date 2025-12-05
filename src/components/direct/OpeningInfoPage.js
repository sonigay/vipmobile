import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Checkbox,
    Button,
    Divider,
    Stack,
    IconButton,
    CircularProgress,
    Alert
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Print as PrintIcon,
    CheckCircle as CheckCircleIcon,
    Calculate as CalculateIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../api/directStoreApi';

// 통신사별 테마 색상
const CARRIER_THEMES = {
    'SK': {
        primary: '#00a9e0', // Sky Blue
        secondary: '#e60012',
        bg: '#f0f9fc'
    },
    'KT': {
        primary: '#00abc7', // Light Green (KT Greenish Blue)
        secondary: '#333',
        bg: '#f0fcfc'
    },
    'LG': {
        primary: '#ec008c', // Hot Pink
        secondary: '#333',
        bg: '#fcf0f6'
    }
};

const OpeningInfoPage = ({ initialData, onBack, loggedInStore }) => {
    const [selectedCarrier, setSelectedCarrier] = useState(initialData?.carrier || 'SK');
    const theme = CARRIER_THEMES[selectedCarrier] || CARRIER_THEMES['SK'];
    const [isSaving, setIsSaving] = useState(false);
    const [planGroups, setPlanGroups] = useState([]); // 요금제 그룹 목록
    const [selectedPlanGroup, setSelectedPlanGroup] = useState('');
    const [planBasicFee, setPlanBasicFee] = useState(0);
    const [requiredAddons, setRequiredAddons] = useState([]); // 필수 부가서비스 목록

    // 단말/지원금 기본값 정리 (휴대폰목록/오늘의휴대폰에서 전달된 데이터 사용)
    const factoryPrice = initialData?.factoryPrice || 0;
    const publicSupport = initialData?.publicSupport || initialData?.support || 0; // 이통사 지원금
    const storeSupportWithAddon = initialData?.storeSupport || 0; // 부가유치시 대리점추가지원금
    const storeSupportWithoutAddon = initialData?.storeSupportNoAddon || 0; // 부가미유치시 대리점추가지원금

    const [formData, setFormData] = useState({
        customerName: initialData?.customerName || '',
        customerContact: initialData?.customerContact || '',
        customerBirth: '',
        openingType: initialData?.openingType || 'NEW', // NEW, MNP, CHANGE
        prevCarrier: '',
        contractType: 'standard', // standard | selected (선택약정)
        installmentPeriod: 24,
        plan: '', // 요금제명
        paymentType: 'installment', // installment | cash
        withAddon: true, // 부가유치 여부 (true: 부가유치, false: 미유치)
        usePublicSupport: true, // 이통사지원금 사용 여부
        lgPremier: false, // LG 프리미어 약정 적용 여부
        cashPrice: 0, // 현금가
        depositAccount: '', // 입금계좌
        // 단말기/유심 정보
        deviceColor: '',
        deviceSerial: '',
        simModel: '',
        simSerial: '',
        // POS코드
        posCode: ''
    });

    // 요금제 그룹 로드 (링크설정에서 가져오기)
    useEffect(() => {
        const loadPlanGroups = async () => {
            try {
                const linkSettings = await directStoreApi.getLinkSettings(selectedCarrier);
                if (linkSettings.success && linkSettings.planGroup) {
                    const planGroup = linkSettings.planGroup;
                    // 요금제군 목록과 기본료를 조합하여 요금제 목록 생성
                    // TODO: 실제로는 planNameRange와 basicFeeRange를 읽어서 조합해야 함
                    const plans = (planGroup.planGroups || []).map((group, idx) => ({
                        name: group,
                        group: group,
                        basicFee: 89000 + (idx * 10000) // 임시 기본료
                    }));
                    setPlanGroups(plans);
                    if (plans.length > 0) {
                        setSelectedPlanGroup(plans[0].name);
                        setPlanBasicFee(plans[0].basicFee);
                        setFormData(prev => ({ ...prev, plan: plans[0].name }));
                    }
                } else {
                    // 링크설정이 없으면 Mock 데이터 사용
                    const mockPlans = [
                        { name: '5GX 프라임', group: '5GX프라임군', basicFee: 89000 },
                        { name: '5GX 플래티넘', group: '5GX플래티넘군', basicFee: 125000 },
                        { name: 'T플랜 에센스', group: 'T플랜군', basicFee: 75000 }
                    ];
                    setPlanGroups(mockPlans);
                    if (mockPlans.length > 0) {
                        setSelectedPlanGroup(mockPlans[0].name);
                        setPlanBasicFee(mockPlans[0].basicFee);
                        setFormData(prev => ({ ...prev, plan: mockPlans[0].name }));
                    }
                }
            } catch (err) {
                console.error('요금제 그룹 로드 실패:', err);
                // 에러 시 Mock 데이터 사용
                const mockPlans = [
                    { name: '5GX 프라임', group: '5GX프라임군', basicFee: 89000 },
                    { name: '5GX 플래티넘', group: '5GX플래티넘군', basicFee: 125000 }
                ];
                setPlanGroups(mockPlans);
            }
        };
        loadPlanGroups();
    }, [selectedCarrier]);

    // 필수 부가서비스 로드 (정책설정에서 가져오기)
    useEffect(() => {
        const loadRequiredAddons = async () => {
            try {
                const policySettings = await directStoreApi.getPolicySettings(selectedCarrier);
                if (policySettings.success && policySettings.addon?.list) {
                    // 미유치차감금액이 있는 부가서비스를 필수 부가서비스로 간주
                    const required = policySettings.addon.list
                        .filter(addon => addon.deduction > 0)
                        .map(addon => ({
                            name: addon.name,
                            monthlyFee: addon.fee || 0
                        }));
                    setRequiredAddons(required);
                } else {
                    // 정책설정이 없으면 Mock 데이터 사용
                    setRequiredAddons([
                        { name: '우주패스', monthlyFee: 9900 },
                        { name: 'V컬러링', monthlyFee: 3300 }
                    ]);
                }
            } catch (err) {
                console.error('필수 부가서비스 로드 실패:', err);
                // 에러 시 Mock 데이터 사용
                setRequiredAddons([
                    { name: '우주패스', monthlyFee: 9900 },
                    { name: 'V컬러링', monthlyFee: 3300 }
                ]);
            }
        };
        loadRequiredAddons();
    }, [selectedCarrier]);

    // 계산 로직
    const calculateInstallmentPrincipalWithAddon = () => {
        // 출고가 - 이통사지원금(선택시) - 대리점추가지원금(부가유치)
        const support = formData.usePublicSupport ? publicSupport : 0;
        return Math.max(0, factoryPrice - support - storeSupportWithAddon);
    };

    const calculateInstallmentPrincipalWithoutAddon = () => {
        // 출고가 - 이통사지원금(선택시) - 대리점추가지원금(부가미유치)
        const support = formData.usePublicSupport ? publicSupport : 0;
        return Math.max(0, factoryPrice - support - storeSupportWithoutAddon);
    };

    const getCurrentInstallmentPrincipal = () => {
        return formData.withAddon
            ? calculateInstallmentPrincipalWithAddon()
            : calculateInstallmentPrincipalWithoutAddon();
    };

    // 할부수수료 계산 (연 5.9%, 원리금균등상환)
    const calculateInstallmentFee = () => {
        const principal = getCurrentInstallmentPrincipal();
        const rate = 0.059; // 연이율 5.9%
        const period = formData.installmentPeriod;

        if (period === 0 || principal === 0) return { total: 0, monthly: 0 };

        const monthlyRate = rate / 12;
        const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, period)) / (Math.pow(1 + monthlyRate, period) - 1);
        const totalPayment = monthlyPayment * period;
        const totalFee = totalPayment - principal; // 총 할부수수료

        return {
            total: Math.floor(totalFee / 10) * 10, // 10원 단위 절사
            monthly: Math.floor(monthlyPayment / 10) * 10
        };
    };

    // 요금제 기본료 계산 (선택약정 할인, LG 프리미어 할인 포함)
    const calculatePlanFee = () => {
        let fee = planBasicFee;

        // 선택약정 할인 (25%)
        if (formData.contractType === 'selected') {
            fee = fee * 0.75;
        }

        // LG 프리미어 약정 할인 (-5,250원)
        if (selectedCarrier === 'LG' && formData.lgPremier && planBasicFee >= 85000) {
            fee = fee - 5250;
        }

        return Math.floor(fee / 10) * 10;
    };

    // 필수 부가서비스 월요금 합계
    const calculateRequiredAddonsFee = () => {
        return requiredAddons.reduce((sum, addon) => sum + (addon.monthlyFee || 0), 0);
    };

    // 최종 월 납부금 계산
    const calculateTotalMonthlyFee = () => {
        if (formData.paymentType === 'cash') {
            return 0; // 현금은 월 납부 없음
        }

        const installmentFee = calculateInstallmentFee();
        const planFee = calculatePlanFee();
        const addonsFee = calculateRequiredAddonsFee();

        return installmentFee.monthly + planFee + addonsFee;
    };

    // 현금가 계산 (할부원금이 0보다 크면 할부원금 표시, 아니면 직접 입력)
    const getCashPrice = () => {
        const principal = getCurrentInstallmentPrincipal();
        if (principal > 0 && formData.cashPrice === 0) {
            return principal;
        }
        return formData.cashPrice;
    };

    const handlePrint = () => {
        window.print();
    };

    const handleComplete = async () => {
        try {
            setIsSaving(true);

            // 필수 데이터 검증
            if (!formData.customerName || !formData.customerContact) {
                alert('고객명과 연락처를 입력해주세요.');
                setIsSaving(false);
                return;
            }

            if (!formData.plan) {
                alert('요금제를 선택해주세요.');
                setIsSaving(false);
                return;
            }

            // 판매일보 시트 구조에 맞는 데이터 구성
            const saveData = {
                // 기본 정보
                posCode: formData.posCode || '',
                storeName: loggedInStore?.name || '',
                storeId: loggedInStore?.id || '',
                saleDateTime: new Date().toISOString(),
                customerName: formData.customerName,
                customerContact: formData.customerContact,
                ctn: '', // CTN은 나중에 입력
                carrier: selectedCarrier,
                deviceModel: initialData?.model || '',
                deviceName: initialData?.petName || '',
                deviceColor: formData.deviceColor,
                deviceSerial: formData.deviceSerial,
                simModel: formData.simModel,
                simSerial: formData.simSerial,
                openingType: formData.openingType,
                prevCarrier: formData.openingType === 'MNP' ? formData.prevCarrier : '',
                paymentType: formData.paymentType, // 할부구분
                installmentPeriod: formData.installmentPeriod, // 할부개월
                contractType: formData.contractType, // 약정
                plan: formData.plan, // 요금제
                addons: requiredAddons.map(a => a.name).join(', '), // 부가서비스
                // 금액 정보
                factoryPrice: factoryPrice, // 출고가
                publicSupport: formData.usePublicSupport ? publicSupport : 0, // 이통사지원금
                storeSupportWithAddon: formData.withAddon ? storeSupportWithAddon : 0, // 대리점추가지원금(부가유치)
                storeSupportWithoutAddon: !formData.withAddon ? storeSupportWithoutAddon : 0, // 대리점추가지원금(부가미유치)
                margin: 0, // 마진 (정책설정에서 가져와야 함)
                // 계산된 값들
                installmentPrincipalWithAddon: calculateInstallmentPrincipalWithAddon(),
                installmentPrincipalWithoutAddon: calculateInstallmentPrincipalWithoutAddon(),
                installmentFee: calculateInstallmentFee(),
                planFee: calculatePlanFee(),
                requiredAddonsFee: calculateRequiredAddonsFee(),
                totalMonthlyFee: calculateTotalMonthlyFee(),
                cashPrice: formData.paymentType === 'cash' ? getCashPrice() : 0,
                depositAccount: formData.paymentType === 'cash' ? formData.depositAccount : '',
                status: '개통대기' // 초기 상태
            };

            console.log('저장할 데이터:', saveData);

            // API 호출
            await directStoreApi.createSalesReport(saveData);

            alert('개통 정보가 저장되었습니다.');
            if (onBack) onBack();
        } catch (error) {
            console.error('저장 실패:', error);
            alert('저장에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto', bgcolor: theme.bg }}>
            {/* 인쇄용 스타일 */}
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 5mm;
                    }
                    
                    body * {
                        visibility: hidden;
                    }
                    
                    .print-area, .print-area * {
                        visibility: visible;
                    }
                    
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        page-break-inside: avoid;
                    }
                    
                    /* 헤더 숨기기 */
                    .no-print {
                        display: none !important;
                    }
                    
                    /* Paper 컴포넌트 스타일 최적화 - 페이지 브레이크 제거 */
                    .print-area .MuiPaper-root {
                        margin-bottom: 4px !important;
                        padding: 6px !important;
                        box-shadow: none !important;
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                    
                    /* Typography 크기 축소 */
                    .print-area .MuiTypography-h4 {
                        font-size: 1.2rem !important;
                        margin-bottom: 4px !important;
                    }
                    
                    .print-area .MuiTypography-h6 {
                        font-size: 0.85rem !important;
                        margin-bottom: 3px !important;
                    }
                    
                    .print-area .MuiTypography-body1 {
                        font-size: 0.75rem !important;
                    }
                    
                    .print-area .MuiTypography-body2 {
                        font-size: 0.65rem !important;
                    }
                    
                    /* Grid 간격 축소 */
                    .print-area .MuiGrid-container {
                        margin: 0 !important;
                        width: 100% !important;
                    }
                    
                    .print-area .MuiGrid-item {
                        padding: 1px 2px !important;
                    }
                    
                    /* Grid spacing 최소화 */
                    .print-area .MuiGrid-spacing-xs-1\.5 > .MuiGrid-item {
                        padding: 1px !important;
                    }
                    
                    .print-area .MuiGrid-spacing-xs-1 > .MuiGrid-item {
                        padding: 1px !important;
                    }
                    
                    /* TextField 스타일 최적화 */
                    .print-area .MuiTextField-root {
                        margin-bottom: 1px !important;
                    }
                    
                    .print-area .MuiInputBase-root {
                        font-size: 0.65rem !important;
                        padding: 2px 4px !important;
                        min-height: 24px !important;
                        height: 24px !important;
                    }
                    
                    .print-area .MuiInputLabel-root {
                        font-size: 0.65rem !important;
                        transform: translate(4px, 6px) scale(1) !important;
                    }
                    
                    .print-area .MuiInputLabel-shrink {
                        transform: translate(4px, -7px) scale(0.7) !important;
                    }
                    
                    /* Divider 간격 축소 */
                    .print-area .MuiDivider-root {
                        margin: 1px 0 !important;
                    }
                    
                    /* Stack 간격 축소 */
                    .print-area .MuiStack-root {
                        margin-bottom: 0 !important;
                    }
                    
                    /* Stack spacing 최소화 */
                    .print-area .MuiStack-root > * {
                        margin: 0 !important;
                    }
                    
                    /* Alert 스타일 최적화 */
                    .print-area .MuiAlert-root {
                        padding: 1px 4px !important;
                        margin-bottom: 1px !important;
                        font-size: 0.65rem !important;
                    }
                    
                    /* RadioGroup, Checkbox 간격 축소 */
                    .print-area .MuiFormControl-root {
                        margin-bottom: 1px !important;
                    }
                    
                    .print-area .MuiFormControlLabel-root {
                        margin-right: 4px !important;
                        margin-bottom: 0 !important;
                    }
                    
                    .print-area .MuiRadio-root {
                        padding: 1px !important;
                        font-size: 0.65rem !important;
                    }
                    
                    .print-area .MuiCheckbox-root {
                        padding: 1px !important;
                    }
                    
                    /* Select 스타일 최적화 */
                    .print-area .MuiSelect-root {
                        font-size: 0.65rem !important;
                        padding: 2px 4px !important;
                        min-height: 24px !important;
                        height: 24px !important;
                    }
                    
                    /* 금액종합안내 박스 최적화 */
                    .print-area .MuiPaper-root[style*="background-color: rgb(51, 51, 51)"] {
                        padding: 4px !important;
                    }
                    
                    .print-area .MuiPaper-root[style*="background-color: rgb(51, 51, 51)"] .MuiTypography-h6 {
                        font-size: 0.75rem !important;
                        margin-bottom: 2px !important;
                    }
                    
                    .print-area .MuiPaper-root[style*="background-color: rgb(51, 51, 51)"] .MuiTypography-h5 {
                        font-size: 0.9rem !important;
                    }
                    
                    .print-area .MuiPaper-root[style*="background-color: rgb(51, 51, 51)"] .MuiTypography-h4 {
                        font-size: 1.1rem !important;
                    }
                    
                    /* 불필요한 여백 제거 */
                    .print-area .MuiBox-root {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    /* 페이지 브레이크 방지 제거 - 한 페이지에 모든 내용 표시 */
                    .print-area .MuiPaper-root {
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                }
            `}</style>

            {/* 헤더 */}
            <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <IconButton onClick={onBack} sx={{ mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.primary }}>
                    {selectedCarrier} 개통정보를 입력해주세요
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    sx={{ mr: 2, borderColor: theme.primary, color: theme.primary }}
                    onClick={handlePrint}
                >
                    인쇄하기
                </Button>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<CheckCircleIcon />}
                    sx={{ bgcolor: theme.primary, '&:hover': { bgcolor: theme.primary } }}
                    onClick={handleComplete}
                    disabled={isSaving}
                >
                    {isSaving ? <CircularProgress size={24} color="inherit" /> : '입력완료'}
                </Button>
            </Box>
            
            {/* 인쇄용 제목 */}
            <Box className="print-only" sx={{ display: 'none', '@media print': { display: 'block', mb: 1 } }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.primary, textAlign: 'center' }}>
                    {selectedCarrier} 개통정보
                </Typography>
            </Box>

            <div className="print-area">
                <style>{`
                    @media print {
                        .print-only {
                            display: block !important;
                        }
                    }
                `}</style>
                <Grid container spacing={1}>
                    {/* 왼쪽: 가입 정보, 통신사 정보, 약정 및 할부 정보, 단말기유심 정보 */}
                    <Grid item xs={12} md={6}>
                        {/* 가입 정보 */}
                        <Paper sx={{ p: 2, mb: 1.5, borderTop: `3px solid ${theme.primary}` }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>가입 정보</Typography>
                            <Grid container spacing={1.5}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="고객명"
                                        fullWidth
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="연락처"
                                        fullWidth
                                        value={formData.customerContact}
                                        onChange={(e) => setFormData({ ...formData, customerContact: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControl component="fieldset">
                                        <Typography variant="subtitle2" gutterBottom>가입 유형</Typography>
                                        <RadioGroup
                                            row
                                            value={formData.openingType}
                                            onChange={(e) => setFormData({ ...formData, openingType: e.target.value })}
                                        >
                                            <FormControlLabel value="NEW" control={<Radio />} label="신규가입" />
                                            <FormControlLabel value="MNP" control={<Radio />} label="번호이동" />
                                            <FormControlLabel value="CHANGE" control={<Radio />} label="기기변경" />
                                        </RadioGroup>
                                    </FormControl>
                                </Grid>
                                {formData.openingType === 'MNP' && (
                                    <Grid item xs={12}>
                                        <TextField
                                            label="전통신사"
                                            fullWidth
                                            value={formData.prevCarrier}
                                            onChange={(e) => setFormData({ ...formData, prevCarrier: e.target.value })}
                                            placeholder="SK, KT, LG 중 선택"
                                        />
                                    </Grid>
                                )}
                            </Grid>
                        </Paper>

                        {/* 통신사 정보 박스 */}
                        <Paper sx={{ p: 1.5, mb: 1.5, borderTop: `3px solid ${theme.primary}`, bgcolor: theme.bg }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: theme.primary }}>
                                통신사 정보
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', color: theme.primary }}>
                                {selectedCarrier}
                            </Typography>
                        </Paper>

                        {/* 약정 및 할부 정보 */}
                        <Paper sx={{ p: 2, mb: 1.5, borderTop: `3px solid ${theme.primary}` }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>약정 및 할부 정보</Typography>
                            <Grid container spacing={1.5}>
                                <Grid item xs={12}>
                                    <FormControl component="fieldset">
                                        <Typography variant="subtitle2" gutterBottom>약정 유형</Typography>
                                        <RadioGroup
                                            row
                                            value={formData.contractType}
                                            onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                                        >
                                            <FormControlLabel value="standard" control={<Radio />} label="일반약정" />
                                            <FormControlLabel value="selected" control={<Radio />} label="선택약정" />
                                        </RadioGroup>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControl fullWidth>
                                        <InputLabel>할부 개월</InputLabel>
                                        <Select
                                            value={formData.installmentPeriod}
                                            label="할부 개월"
                                            onChange={(e) => setFormData({ ...formData, installmentPeriod: e.target.value })}
                                        >
                                            <MenuItem value={24}>24개월</MenuItem>
                                            <MenuItem value={30}>30개월</MenuItem>
                                            <MenuItem value={36}>36개월</MenuItem>
                                            <MenuItem value={0}>일시불</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* 단말기유심 정보 및 금액안내 */}
                        <Paper sx={{ p: 2, borderTop: `3px solid ${theme.primary}` }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>단말기유심 정보 및 금액안내</Typography>
                            <Grid container spacing={1.5}>
                                <Grid item xs={12}>
                                    <TextField
                                        label="모델명"
                                        fullWidth
                                        value={initialData?.model || ''}
                                        InputProps={{ readOnly: true }}
                                        variant="filled"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="색상"
                                        fullWidth
                                        value={formData.deviceColor}
                                        onChange={(e) => setFormData({ ...formData, deviceColor: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="단말일련번호"
                                        fullWidth
                                        value={formData.deviceSerial}
                                        onChange={(e) => setFormData({ ...formData, deviceSerial: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="유심모델명"
                                        fullWidth
                                        value={formData.simModel}
                                        onChange={(e) => setFormData({ ...formData, simModel: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="유심일련번호"
                                        fullWidth
                                        value={formData.simSerial}
                                        onChange={(e) => setFormData({ ...formData, simSerial: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Divider sx={{ my: 2 }} />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="출고가"
                                        fullWidth
                                        value={factoryPrice.toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                {formData.usePublicSupport && (
                                    <Grid item xs={6}>
                                        <TextField
                                            label="이통사 지원금"
                                            fullWidth
                                            value={publicSupport.toLocaleString()}
                                            InputProps={{ readOnly: true }}
                                        />
                                    </Grid>
                                )}
                                <Grid item xs={6}>
                                    <TextField
                                        label="대리점추가지원금 (부가유치)"
                                        fullWidth
                                        value={storeSupportWithAddon.toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="대리점추가지원금 (부가미유치)"
                                        fullWidth
                                        value={storeSupportWithoutAddon.toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="할부원금 (부가유치)"
                                        fullWidth
                                        value={calculateInstallmentPrincipalWithAddon().toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                        sx={{ input: { fontWeight: 'bold', color: theme.primary } }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="할부원금 (부가미유치)"
                                        fullWidth
                                        value={calculateInstallmentPrincipalWithoutAddon().toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                        sx={{ input: { fontWeight: 'bold', color: theme.primary } }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControl component="fieldset">
                                        <Typography variant="subtitle2" gutterBottom>부가서비스 유치 여부</Typography>
                                        <RadioGroup
                                            row
                                            value={formData.withAddon ? 'with' : 'without'}
                                            onChange={(e) => setFormData({ ...formData, withAddon: e.target.value === 'with' })}
                                        >
                                            <FormControlLabel value="with" control={<Radio />} label="부가유치" />
                                            <FormControlLabel value="without" control={<Radio />} label="부가미유치" />
                                        </RadioGroup>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControl component="fieldset">
                                        <Typography variant="subtitle2" gutterBottom>할부/현금 선택</Typography>
                                        <RadioGroup
                                            row
                                            value={formData.paymentType}
                                            onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                                        >
                                            <FormControlLabel value="installment" control={<Radio />} label="할부" />
                                            <FormControlLabel value="cash" control={<Radio />} label="현금" />
                                        </RadioGroup>
                                    </FormControl>
                                </Grid>
                                {formData.paymentType === 'installment' && (
                                    <>
                                        <Grid item xs={12}>
                                            <Divider sx={{ my: 1 }} />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="총 할부수수료"
                                                fullWidth
                                                value={calculateInstallmentFee().total.toLocaleString()}
                                                InputProps={{ readOnly: true }}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="월 할부수수료"
                                                fullWidth
                                                value={calculateInstallmentFee().monthly.toLocaleString()}
                                                InputProps={{ readOnly: true }}
                                            />
                                        </Grid>
                                    </>
                                )}
                                {formData.paymentType === 'cash' && (
                                    <>
                                        <Grid item xs={12}>
                                            <Divider sx={{ my: 1 }} />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="현금가"
                                                fullWidth
                                                type="number"
                                                value={getCashPrice()}
                                                onChange={(e) => {
                                                    const price = parseInt(e.target.value) || 0;
                                                    setFormData({ ...formData, cashPrice: price });
                                                }}
                                                disabled={getCurrentInstallmentPrincipal() > 0}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="입금계좌"
                                                fullWidth
                                                value={formData.depositAccount}
                                                onChange={(e) => setFormData({ ...formData, depositAccount: e.target.value })}
                                            />
                                        </Grid>
                                    </>
                                )}
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* 오른쪽: 요금정보, 금액종합안내 */}
                    <Grid item xs={12} md={6}>
                        {/* 요금정보 */}
                        <Paper sx={{ p: 2, mb: 1.5, borderTop: `3px solid ${theme.primary}` }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>요금정보</Typography>
                            <Grid container spacing={1.5}>
                                <Grid item xs={12}>
                                    <FormControl fullWidth>
                                        <InputLabel>요금제 선택</InputLabel>
                                        <Select
                                            value={formData.plan}
                                            label="요금제 선택"
                                            onChange={(e) => {
                                                const selectedPlan = planGroups.find(p => p.name === e.target.value);
                                                setFormData({ ...formData, plan: e.target.value });
                                                setSelectedPlanGroup(e.target.value);
                                                setPlanBasicFee(selectedPlan?.basicFee || 0);
                                            }}
                                        >
                                            {planGroups.map((plan) => (
                                                <MenuItem key={plan.name} value={plan.name}>
                                                    {plan.name} ({plan.basicFee.toLocaleString()}원)
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                {formData.plan && (
                                    <>
                                        <Grid item xs={12}>
                                            <TextField
                                                label="기본료"
                                                fullWidth
                                                value={planBasicFee.toLocaleString()}
                                                InputProps={{ readOnly: true }}
                                            />
                                        </Grid>
                                        {formData.contractType === 'selected' && (
                                            <Grid item xs={12}>
                                                <Alert severity="info">
                                                    선택약정 할인: -{Math.floor(planBasicFee * 0.25).toLocaleString()}원
                                                </Alert>
                                            </Grid>
                                        )}
                                        {selectedCarrier === 'LG' && planBasicFee >= 85000 && (
                                            <Grid item xs={12}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={formData.lgPremier}
                                                            onChange={(e) => setFormData({ ...formData, lgPremier: e.target.checked })}
                                                        />
                                                    }
                                                    label="LG 프리미어 약정 적용"
                                                />
                                                {formData.lgPremier && (
                                                    <Typography variant="body2" color="error" sx={{ ml: 4 }}>
                                                        -5,250원
                                                    </Typography>
                                                )}
                                            </Grid>
                                        )}
                                        {requiredAddons.length > 0 && (
                                            <Grid item xs={12}>
                                                <Divider sx={{ my: 1 }} />
                                                <Typography variant="subtitle2" gutterBottom>필수 부가서비스</Typography>
                                                {requiredAddons.map((addon, idx) => (
                                                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                        <Typography variant="body2">{addon.name}</Typography>
                                                        <Typography variant="body2" color="primary">
                                                            +{addon.monthlyFee.toLocaleString()}원
                                                        </Typography>
                                                    </Box>
                                                ))}
                                            </Grid>
                                        )}
                                    </>
                                )}
                            </Grid>
                        </Paper>

                        {/* 금액종합안내 */}
                        <Paper sx={{ p: 2, bgcolor: '#333', color: '#fff', mb: 1.5 }}>
                            <Typography variant="h6" gutterBottom sx={{ color: '#ffd700', fontWeight: 'bold' }}>
                                금액종합안내
                            </Typography>
                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mb: 2 }} />

                            {/* 단말기 금액 */}
                            <Typography variant="subtitle2" sx={{ mb: 1, color: '#ffd700' }}>단말기 금액</Typography>
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="body2">출고가</Typography>
                                <Typography variant="body2">{factoryPrice.toLocaleString()}원</Typography>
                            </Stack>
                            {formData.usePublicSupport && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">이통사 지원금</Typography>
                                    <Typography variant="body2">-{publicSupport.toLocaleString()}원</Typography>
                                </Stack>
                            )}
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="body2">
                                    대리점추가지원금 ({formData.withAddon ? '부가유치' : '부가미유치'})
                                </Typography>
                                <Typography variant="body2">
                                    -{(formData.withAddon ? storeSupportWithAddon : storeSupportWithoutAddon).toLocaleString()}원
                                </Typography>
                            </Stack>
                            {formData.paymentType === 'installment' && (
                                <Stack direction="row" justifyContent="space-between" mb={2}>
                                    <Typography variant="body2" fontWeight="bold">할부원금</Typography>
                                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#ffd700' }}>
                                        {getCurrentInstallmentPrincipal().toLocaleString()}원
                                    </Typography>
                                </Stack>
                            )}
                            {formData.paymentType === 'cash' && (
                                <Stack direction="row" justifyContent="space-between" mb={2}>
                                    <Typography variant="body2" fontWeight="bold">현금가</Typography>
                                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#ffd700' }}>
                                        {getCashPrice().toLocaleString()}원
                                    </Typography>
                                </Stack>
                            )}

                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 2 }} />

                            {/* 요금 금액 */}
                            <Typography variant="subtitle2" sx={{ mb: 1, color: '#ffd700' }}>요금 금액</Typography>
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="body2">기본료</Typography>
                                <Typography variant="body2">{planBasicFee.toLocaleString()}원</Typography>
                            </Stack>
                            {formData.contractType === 'selected' && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">선택약정 할인</Typography>
                                    <Typography variant="body2" color="error">
                                        -{Math.floor(planBasicFee * 0.25).toLocaleString()}원
                                    </Typography>
                                </Stack>
                            )}
                            {selectedCarrier === 'LG' && formData.lgPremier && planBasicFee >= 85000 && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">LG 프리미어 할인</Typography>
                                    <Typography variant="body2" color="error">-5,250원</Typography>
                                </Stack>
                            )}
                            {requiredAddons.length > 0 && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">필수 부가서비스</Typography>
                                    <Typography variant="body2" color="primary">
                                        +{calculateRequiredAddonsFee().toLocaleString()}원
                                    </Typography>
                                </Stack>
                            )}

                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 2 }} />

                            {/* 최종 합계 */}
                            {formData.paymentType === 'installment' && (
                                <>
                                    <Stack direction="row" justifyContent="space-between" mb={1}>
                                        <Typography variant="body1">월 할부금</Typography>
                                        <Typography variant="body1">{calculateInstallmentFee().monthly.toLocaleString()}원</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between" mb={2}>
                                        <Typography variant="body1">월 통신요금</Typography>
                                        <Typography variant="body1">{calculatePlanFee().toLocaleString()}원</Typography>
                                    </Stack>
                                    {requiredAddons.length > 0 && (
                                        <Stack direction="row" justifyContent="space-between" mb={2}>
                                            <Typography variant="body1">월 부가서비스</Typography>
                                            <Typography variant="body1">{calculateRequiredAddonsFee().toLocaleString()}원</Typography>
                                        </Stack>
                                    )}
                                </>
                            )}

                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mb: 2 }} />

                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="h5" fontWeight="bold">최종 월 납부금</Typography>
                                <Typography variant="h4" fontWeight="bold" sx={{ color: '#ffd700' }}>
                                    {calculateTotalMonthlyFee().toLocaleString()}원
                                </Typography>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            </div>
        </Box>
    );
};

export default OpeningInfoPage;
