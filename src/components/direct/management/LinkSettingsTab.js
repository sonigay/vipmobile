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
    Alert,
    CircularProgress,
    Snackbar
} from '@mui/material';
import { Save as SaveIcon, Link as LinkIcon } from '@mui/icons-material';
import { directStoreApi } from '../../../api/directStoreApi';

const LinkSettingsTab = () => {
    const [carrierTab, setCarrierTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // 링크 설정 상태
    const [planGroupSettings, setPlanGroupSettings] = useState({
        link: '',
        range: ''
    });

    const [supportSettings, setSupportSettings] = useState({
        link: '',
        range: ''
    });

    const [policySettings, setPolicySettings] = useState({
        link: '',
        range: ''
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
            const data = await directStoreApi.getLinkSettings(carrier);

            if (data.success) {
                if (data.planGroup) {
                    setPlanGroupSettings({
                        link: data.planGroup.link || '',
                        range: data.planGroup.range || ''
                    });
                }
                if (data.support) {
                    setSupportSettings({
                        link: data.support.link || '',
                        range: data.support.range || ''
                    });
                }
                if (data.policy) {
                    setPolicySettings({
                        link: data.policy.link || '',
                        range: data.policy.range || ''
                    });
                }
            }
        } catch (err) {
            console.error('링크 설정 로드 실패:', err);
            setError('링크 설정을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePlanGroup = async () => {
        try {
            setSaving(true);
            setError(null);
            const carrier = getCurrentCarrier();
            await directStoreApi.saveLinkSettings(carrier, {
                planGroup: planGroupSettings
            });
            setSuccessMessage('요금제 그룹 설정이 저장되었습니다.');
        } catch (err) {
            console.error('요금제 그룹 설정 저장 실패:', err);
            setError('요금제 그룹 설정 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSupport = async () => {
        try {
            setSaving(true);
            setError(null);
            const carrier = getCurrentCarrier();
            await directStoreApi.saveLinkSettings(carrier, {
                support: supportSettings
            });
            setSuccessMessage('이통사 지원금 설정이 저장되었습니다.');
        } catch (err) {
            console.error('이통사 지원금 설정 저장 실패:', err);
            setError('이통사 지원금 설정 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePolicy = async () => {
        try {
            setSaving(true);
            setError(null);
            const carrier = getCurrentCarrier();
            await directStoreApi.saveLinkSettings(carrier, {
                policy: policySettings
            });
            setSuccessMessage('정책표 설정이 저장되었습니다.');
        } catch (err) {
            console.error('정책표 설정 저장 실패:', err);
            setError('정책표 설정 저장에 실패했습니다.');
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
                링크 및 범위 설정
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
                구글 스프레드시트의 링크와 데이터 범위를 설정하여 실시간 데이터를 연동합니다.
            </Alert>

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

            <Stack spacing={3}>
                {/* 요금제 그룹 설정 */}
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                            요금제 그룹 설정
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                label="구글 시트 링크"
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                value={planGroupSettings.link}
                                onChange={(e) => setPlanGroupSettings({ ...planGroupSettings, link: e.target.value })}
                                fullWidth
                                disabled={loading}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="데이터 범위"
                                placeholder="시트명!A1:C20"
                                value={planGroupSettings.range}
                                onChange={(e) => setPlanGroupSettings({ ...planGroupSettings, range: e.target.value })}
                                fullWidth
                                disabled={loading}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Button 
                                variant="contained" 
                                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                                onClick={handleSavePlanGroup}
                                disabled={saving || loading}
                            >
                                설정 저장
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                {/* 공시지원금 설정 */}
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                            공시지원금 설정
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                label="구글 시트 링크"
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                value={supportSettings.link}
                                onChange={(e) => setSupportSettings({ ...supportSettings, link: e.target.value })}
                                fullWidth
                                disabled={loading}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="데이터 범위"
                                placeholder="시트명!A1:E100"
                                value={supportSettings.range}
                                onChange={(e) => setSupportSettings({ ...supportSettings, range: e.target.value })}
                                fullWidth
                                disabled={loading}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Button 
                                variant="contained" 
                                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                                onClick={handleSaveSupport}
                                disabled={saving || loading}
                            >
                                설정 저장
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                {/* 정책표 설정 */}
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                            정책표 설정
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                label="구글 시트 링크"
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                value={policySettings.link}
                                onChange={(e) => setPolicySettings({ ...policySettings, link: e.target.value })}
                                fullWidth
                                disabled={loading}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="데이터 범위"
                                placeholder="시트명!A1:F100"
                                value={policySettings.range}
                                onChange={(e) => setPolicySettings({ ...policySettings, range: e.target.value })}
                                fullWidth
                                disabled={loading}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Button 
                                variant="contained" 
                                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                                onClick={handleSavePolicy}
                                disabled={saving || loading}
                            >
                                설정 저장
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>
            </Stack>

            <Snackbar
                open={!!successMessage}
                autoHideDuration={3000}
                onClose={() => setSuccessMessage(null)}
                message={successMessage}
            />
        </Box>
    );
};

export default LinkSettingsTab;
