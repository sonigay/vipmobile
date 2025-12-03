import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Tabs,
    Tab,
    Typography,
    TextField,
    Button,
    Grid,
    Divider,
    Stack,
    InputAdornment,
    Alert,
    CircularProgress,
    Snackbar
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { directStoreApi } from '../../../api/directStoreApi';

const PolicySettingsTab = () => {
    const [carrierTab, setCarrierTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // 마진 설정 상태
    const [marginSettings, setMarginSettings] = useState({
        baseMargin: 0,
        mnpMargin: 0,
        changeMargin: 0
    });

    // 부가서비스 설정 상태
    const [addonSettings, setAddonSettings] = useState({
        welfareDeduction: 0,
        insuranceDeduction: 0
    });

    // 별도 정책 설정 상태
    const [specialSettings, setSpecialSettings] = useState({
        policyDeduction: 0,
        specialPolicy: 0
    });

    const getCurrentCarrier = () => {
        switch (carrierTab) {
            case 0: return 'SK';
            case 1: return 'KT';
            case 2: return 'LG';
            default: return 'SK';
        }
    };

    // 설정 로드
    useEffect(() => {
        loadSettings();
    }, [carrierTab]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            setError(null);
            const carrier = getCurrentCarrier();
            const data = await directStoreApi.getPolicySettings(carrier);

            if (data.success) {
                if (data.margin) {
                    setMarginSettings({
                        baseMargin: data.margin.baseMargin || 0,
                        mnpMargin: data.margin.mnpMargin || 0,
                        changeMargin: data.margin.changeMargin || 0
                    });
                }
                if (data.addon) {
                    setAddonSettings({
                        welfareDeduction: data.addon.welfareDeduction || 0,
                        insuranceDeduction: data.addon.insuranceDeduction || 0
                    });
                }
                if (data.special) {
                    setSpecialSettings({
                        policyDeduction: data.special.policyDeduction || 0,
                        specialPolicy: data.special.specialPolicy || 0
                    });
                }
            }
        } catch (err) {
            console.error('설정 로드 실패:', err);
            setError('설정을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMargin = async () => {
        try {
            setSaving(true);
            setError(null);
            const carrier = getCurrentCarrier();
            await directStoreApi.savePolicySettings(carrier, {
                margin: marginSettings
            });
            setSuccessMessage('마진 설정이 저장되었습니다.');
        } catch (err) {
            console.error('마진 설정 저장 실패:', err);
            setError('마진 설정 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAddon = async () => {
        try {
            setSaving(true);
            setError(null);
            const carrier = getCurrentCarrier();
            await directStoreApi.savePolicySettings(carrier, {
                addon: addonSettings
            });
            setSuccessMessage('부가서비스 설정이 저장되었습니다.');
        } catch (err) {
            console.error('부가서비스 설정 저장 실패:', err);
            setError('부가서비스 설정 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSpecial = async () => {
        try {
            setSaving(true);
            setError(null);
            const carrier = getCurrentCarrier();
            await directStoreApi.savePolicySettings(carrier, {
                special: specialSettings
            });
            setSuccessMessage('별도 정책 설정이 저장되었습니다.');
        } catch (err) {
            console.error('별도 정책 설정 저장 실패:', err);
            setError('별도 정책 설정 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleCarrierChange = (event, newValue) => {
        setCarrierTab(newValue);
    };

    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                정책 설정
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* 통신사 탭 */}
            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={carrierTab}
                    onChange={handleCarrierChange}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="fullWidth"
                >
                    <Tab label="SK Telecom" />
                    <Tab label="KT" />
                    <Tab label="LG U+" />
                </Tabs>
            </Paper>

            <Grid container spacing={3}>
                {/* 마진 설정 */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">
                            마진 설정
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <TextField
                                label="기본 마진"
                                type="number"
                                value={marginSettings.baseMargin}
                                onChange={(e) => setMarginSettings({ ...marginSettings, baseMargin: parseInt(e.target.value) || 0 })}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">원</InputAdornment>,
                                }}
                                fullWidth
                                disabled={loading}
                            />
                            <TextField
                                label="추가 마진 (MNP)"
                                type="number"
                                value={marginSettings.mnpMargin}
                                onChange={(e) => setMarginSettings({ ...marginSettings, mnpMargin: parseInt(e.target.value) || 0 })}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">원</InputAdornment>,
                                }}
                                fullWidth
                                disabled={loading}
                            />
                            <TextField
                                label="추가 마진 (기변)"
                                type="number"
                                value={marginSettings.changeMargin}
                                onChange={(e) => setMarginSettings({ ...marginSettings, changeMargin: parseInt(e.target.value) || 0 })}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">원</InputAdornment>,
                                }}
                                fullWidth
                                disabled={loading}
                            />
                            <Button 
                                variant="contained" 
                                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                                onClick={handleSaveMargin}
                                disabled={saving || loading}
                            >
                                저장
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>

                {/* 부가서비스 설정 */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">
                            부가서비스 차감 설정
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                                <Typography variant="subtitle2" gutterBottom>우주패스</Typography>
                                <TextField
                                    label="미유치 시 차감액"
                                    size="small"
                                    type="number"
                                    value={addonSettings.welfareDeduction}
                                    onChange={(e) => setAddonSettings({ ...addonSettings, welfareDeduction: parseInt(e.target.value) || 0 })}
                                    fullWidth
                                    sx={{ mb: 1 }}
                                    disabled={loading}
                                />
                            </Box>
                            <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                                <Typography variant="subtitle2" gutterBottom>보험</Typography>
                                <TextField
                                    label="미유치 시 차감액"
                                    size="small"
                                    type="number"
                                    value={addonSettings.insuranceDeduction}
                                    onChange={(e) => setAddonSettings({ ...addonSettings, insuranceDeduction: parseInt(e.target.value) || 0 })}
                                    fullWidth
                                    sx={{ mb: 1 }}
                                    disabled={loading}
                                />
                            </Box>
                            <Button 
                                variant="contained" 
                                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                                onClick={handleSaveAddon}
                                disabled={saving || loading}
                            >
                                저장
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>

                {/* 별도 정책 설정 */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">
                            별도 정책 설정
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <TextField
                                label="정책표 차감"
                                type="number"
                                value={specialSettings.policyDeduction}
                                onChange={(e) => setSpecialSettings({ ...specialSettings, policyDeduction: parseInt(e.target.value) || 0 })}
                                helperText="정책표 금액에서 일괄 차감할 금액"
                                fullWidth
                                disabled={loading}
                            />
                            <TextField
                                label="특별 추가 정책"
                                type="number"
                                value={specialSettings.specialPolicy}
                                onChange={(e) => setSpecialSettings({ ...specialSettings, specialPolicy: parseInt(e.target.value) || 0 })}
                                helperText="특정 조건 만족 시 추가"
                                fullWidth
                                disabled={loading}
                            />
                            <Button 
                                variant="contained" 
                                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                                onClick={handleSaveSpecial}
                                disabled={saving || loading}
                            >
                                저장
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>

            <Snackbar
                open={!!successMessage}
                autoHideDuration={3000}
                onClose={() => setSuccessMessage(null)}
                message={successMessage}
            />
        </Box>
    );
};

export default PolicySettingsTab;
