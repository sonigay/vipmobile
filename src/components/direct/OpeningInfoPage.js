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
    CircularProgress
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

const OpeningInfoPage = ({ initialData, onBack }) => {
    const [selectedCarrier, setSelectedCarrier] = useState(initialData?.carrier || 'SK');
    const theme = CARRIER_THEMES[selectedCarrier] || CARRIER_THEMES['SK'];
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        customerName: initialData?.customerName || '',
        customerContact: initialData?.customerContact || '',
        customerBirth: '',
        openingType: initialData?.openingType || 'NEW', // NEW, MNP, CHANGE
        prevCarrier: '',
        installmentPeriod: 24,
        plan: '5GX 프라임', // 임시 기본값
        addons: {
            insurance: false,
            welfare: false,
            card: false
        }
    });

    // 계산 로직
    const calculateInstallmentPrincipal = () => {
        const factoryPrice = initialData?.factoryPrice || 0;
        const publicSupport = initialData?.publicSupport || 0; // 공시지원금
        const storeSupport = initialData?.storeSupport || 0; // 대리점지원금
        return Math.max(0, factoryPrice - publicSupport - storeSupport);
    };

    const calculateMonthlyInstallment = () => {
        const principal = calculateInstallmentPrincipal();
        const rate = 0.059; // 연이율 5.9%
        const period = formData.installmentPeriod;

        if (period === 0) return 0; // 일시불

        // 원리금균등상환 공식
        const monthlyRate = rate / 12;
        const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, period)) / (Math.pow(1 + monthlyRate, period) - 1);

        // 10원 단위 절사
        return Math.floor(payment / 10) * 10;
    };

    const calculateMonthlyPlanPrice = () => {
        // 임시 요금제 가격 (나중에 DB 연동 필요)
        let planPrice = 89000;

        // 선택약정 할인 (25%)
        if (formData.openingType !== 'NEW') { // 예시 조건
            // 실제로는 요금제 유형에 따라 다름
        }

        // LG 프리미어 약정 할인 (-5250원)
        let discount = 0;
        if (selectedCarrier === 'LG' && planPrice >= 85000) {
            discount += 5250;
        }

        return Math.floor((planPrice - discount) / 10) * 10;
    };

    const calculateTotalMonthlyPrice = () => {
        return calculateMonthlyInstallment() + calculateMonthlyPlanPrice();
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

            // 저장할 데이터 구성
            const saveData = {
                ...formData,
                carrier: selectedCarrier,
                model: initialData.model,
                petName: initialData.petName,
                status: 'pending', // 초기 상태
                date: new Date().toISOString().split('T')[0], // 오늘 날짜
                // 계산된 값들
                installmentPrincipal: calculateInstallmentPrincipal(),
                monthlyInstallment: calculateMonthlyInstallment(),
                monthlyPlanPrice: calculateMonthlyPlanPrice(),
                totalMonthlyPrice: calculateTotalMonthlyPrice()
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
            {/* 헤더 */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <IconButton onClick={onBack} sx={{ mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.primary }}>
                    개통정보 입력 ({selectedCarrier})
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    sx={{ mr: 2, borderColor: theme.primary, color: theme.primary }}
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

            <Grid container spacing={3}>
                {/* 왼쪽: 가입 정보 및 단말기 정보 */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, mb: 3, borderTop: `4px solid ${theme.primary}` }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>가입 정보</Typography>
                        <Grid container spacing={2}>
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
                                        label="이전 통신사"
                                        fullWidth
                                        value={formData.prevCarrier}
                                        onChange={(e) => setFormData({ ...formData, prevCarrier: e.target.value })}
                                    />
                                </Grid>
                            )}
                        </Grid>
                    </Paper>

                    <Paper sx={{ p: 3, borderTop: `4px solid ${theme.primary}` }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>단말기 및 할부 정보</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField
                                    label="모델명"
                                    fullWidth
                                    value={initialData?.petName || ''}
                                    InputProps={{ readOnly: true }}
                                    variant="filled"
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    label="출고가"
                                    fullWidth
                                    value={initialData?.factoryPrice?.toLocaleString() || 0}
                                    InputProps={{ readOnly: true }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    label="할부원금"
                                    fullWidth
                                    value={calculateInstallmentPrincipal().toLocaleString()}
                                    InputProps={{ readOnly: true }}
                                    sx={{ input: { fontWeight: 'bold', color: theme.primary } }}
                                />
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
                </Grid>

                {/* 오른쪽: 요금제 및 최종 납부 금액 */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, mb: 3, borderTop: `4px solid ${theme.primary}` }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>요금제 정보</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <FormControl fullWidth>
                                    <InputLabel>요금제 선택</InputLabel>
                                    <Select
                                        value={formData.plan}
                                        label="요금제 선택"
                                        onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                                    >
                                        <MenuItem value="5GX 프라임">5GX 프라임 (89,000원)</MenuItem>
                                        <MenuItem value="5GX 플래티넘">5GX 플래티넘 (125,000원)</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={<Checkbox checked={true} />}
                                    label="선택약정 할인 (25%)"
                                />
                                {selectedCarrier === 'LG' && (
                                    <FormControlLabel
                                        control={<Checkbox checked={true} />}
                                        label="LG 프리미어 약정 할인 (-5,250원)"
                                    />
                                )}
                            </Grid>
                        </Grid>
                    </Paper>

                    <Paper sx={{ p: 3, bgcolor: '#333', color: '#fff' }}>
                        <Typography variant="h6" gutterBottom sx={{ color: '#ffd700' }}>최종 납부 금액 (월)</Typography>
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mb: 2 }} />

                        <Stack direction="row" justifyContent="space-between" mb={1}>
                            <Typography>월 할부금 (5.9%)</Typography>
                            <Typography>{calculateMonthlyInstallment().toLocaleString()} 원</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" mb={2}>
                            <Typography>월 통신요금</Typography>
                            <Typography>{calculateMonthlyPlanPrice().toLocaleString()} 원</Typography>
                        </Stack>

                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mb: 2 }} />

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="h5" fontWeight="bold">합계</Typography>
                            <Typography variant="h4" fontWeight="bold" sx={{ color: '#ffd700' }}>
                                {calculateTotalMonthlyPrice().toLocaleString()} 원
                            </Typography>
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default OpeningInfoPage;
