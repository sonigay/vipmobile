import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Tabs,
    Tab,
    Grid,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Stack,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Divider,
    Alert,
    CircularProgress,
    Snackbar
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Link as LinkIcon,
    TableChart as TableChartIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../../api/directStoreApi';

const LinkSettingsTab = () => {
    const [carrierTab, setCarrierTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // 모달 상태
    const [openPlanGroupModal, setOpenPlanGroupModal] = useState(false);
    const [openSupportModal, setOpenSupportModal] = useState(false);
    const [openPolicyModal, setOpenPolicyModal] = useState(false);

    // 설정 상태
    const [planGroupSettings, setPlanGroupSettings] = useState({
        link: '',
        planNameRange: '',
        planGroupRange: '',
        basicFeeRange: '',
        // 임시: 백엔드 없이 동적 필드를 테스트하기 위한 요금제군 목록
        planGroups: ['5GX 프라임', '5GX 플래티넘', 'T플랜 에센스']
    });

    const [supportSettings, setSupportSettings] = useState({
        link: '',
        modelRange: '',
        petNameRange: '',
        factoryPriceRange: '',
        openingTypeRange: '',
        planGroupRanges: {} // { '5GX 프라임': 'Sheet1!F2:F100', ... }
    });

    const [policySettings, setPolicySettings] = useState({
        link: '',
        modelRange: '',
        petNameRange: '',
        planGroupRanges: {} // { '5GX 프라임': 'Sheet1!G2:G100', ... }
    });

    // 임시 요금제군 추가 상태
    const [newPlanGroup, setNewPlanGroup] = useState('');

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
        const loadSettings = async () => {
            try {
                setLoading(true);
                const carrier = getCurrentCarrier();
                const data = await directStoreApi.getLinkSettings(carrier);
                
                if (data.success) {
                    if (data.planGroup) {
                        setPlanGroupSettings(prev => ({
                            ...prev,
                            link: data.planGroup.link || '',
                            planGroups: data.planGroup.planGroups || prev.planGroups
                        }));
                    }
                    if (data.support) {
                        setSupportSettings(prev => ({
                            ...prev,
                            link: data.support.link || ''
                        }));
                    }
                    if (data.policy) {
                        setPolicySettings(prev => ({
                            ...prev,
                            link: data.policy.link || ''
                        }));
                    }
                }
            } catch (err) {
                console.error('링크 설정 로드 실패:', err);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, [carrierTab]);

    const handleCarrierChange = (event, newValue) => {
        setCarrierTab(newValue);
    };

    // --- 핸들러 ---

    const handleAddPlanGroup = () => {
        if (newPlanGroup && !planGroupSettings.planGroups.includes(newPlanGroup)) {
            setPlanGroupSettings(prev => ({
                ...prev,
                planGroups: [...prev.planGroups, newPlanGroup]
            }));
            setNewPlanGroup('');
        }
    };

    const handleDeletePlanGroup = (group) => {
        setPlanGroupSettings(prev => ({
            ...prev,
            planGroups: prev.planGroups.filter(g => g !== group)
        }));
    };

    const handleSave = async (type) => {
        try {
            setSaving(true);
            const carrier = getCurrentCarrier();
            let settings = {};

            if (type === 'planGroup') {
                settings = { planGroup: planGroupSettings };
            } else if (type === 'support') {
                settings = { support: supportSettings };
            } else if (type === 'policy') {
                settings = { policy: policySettings };
            }

            await directStoreApi.saveLinkSettings(carrier, settings);
            setSuccessMessage('설정이 저장되었습니다.');
            
            if (type === 'planGroup') setOpenPlanGroupModal(false);
            if (type === 'support') setOpenSupportModal(false);
            if (type === 'policy') setOpenPolicyModal(false);
        } catch (err) {
            console.error('링크 설정 저장 실패:', err);
            setError('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                링크 설정
            </Typography>

            {/* 통신사 탭 */}
            <Paper sx={{ mb: 4 }}>
                <Tabs
                    value={carrierTab}
                    onChange={handleCarrierChange}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="fullWidth"
                >
                    <Tab label="SK" />
                    <Tab label="KT" />
                    <Tab label="LG" />
                </Tabs>
            </Paper>

            <Grid container spacing={3}>
                {/* 1. 요금제 그룹핑 설정 버튼 */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
                        }}
                        onClick={() => setOpenPlanGroupModal(true)}
                    >
                        <SettingsIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight="bold">요금제 그룹핑 설정</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            요금제명, 요금제군, 기본료 범위 설정
                        </Typography>
                    </Paper>
                </Grid>

                {/* 2. 이통사 지원금 설정 버튼 */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
                        }}
                        onClick={() => setOpenSupportModal(true)}
                    >
                        <LinkIcon sx={{ fontSize: 60, color: 'secondary.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight="bold">이통사 지원금 설정</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            모델정보 및 요금제군별 지원금 범위 설정
                        </Typography>
                    </Paper>
                </Grid>

                {/* 3. 정책표 설정 버튼 */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
                        }}
                        onClick={() => setOpenPolicyModal(true)}
                    >
                        <TableChartIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight="bold">정책표 설정</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            모델정보 및 요금제군별 정책금 범위 설정
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* --- 모달들 --- */}

            {/* 1. 요금제 그룹핑 설정 모달 */}
            <Dialog open={openPlanGroupModal} onClose={() => setOpenPlanGroupModal(false)} maxWidth="md" fullWidth>
                <DialogTitle>요금제 그룹핑 설정 ({getCurrentCarrier()})</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        <TextField
                            label="구글 시트 링크"
                            fullWidth
                            value={planGroupSettings.link}
                            onChange={(e) => setPlanGroupSettings({ ...planGroupSettings, link: e.target.value })}
                            placeholder="https://docs.google.com/spreadsheets/..."
                        />
                        <Divider />
                        <Typography variant="subtitle1" fontWeight="bold">데이터 범위 설정</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="요금제명 범위"
                                    fullWidth
                                    value={planGroupSettings.planNameRange}
                                    onChange={(e) => setPlanGroupSettings({ ...planGroupSettings, planNameRange: e.target.value })}
                                    placeholder="예: Sheet1!A2:A100"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="요금제군 범위"
                                    fullWidth
                                    value={planGroupSettings.planGroupRange}
                                    onChange={(e) => setPlanGroupSettings({ ...planGroupSettings, planGroupRange: e.target.value })}
                                    placeholder="예: Sheet1!B2:B100"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="기본료 범위"
                                    fullWidth
                                    value={planGroupSettings.basicFeeRange}
                                    onChange={(e) => setPlanGroupSettings({ ...planGroupSettings, basicFeeRange: e.target.value })}
                                    placeholder="예: Sheet1!C2:C100"
                                />
                            </Grid>
                        </Grid>

                        <Divider />
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                요금제군 목록 (테스트용 수동 관리)
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                                * 실제로는 위 범위 설정에 따라 시트에서 자동으로 가져오지만, 현재 백엔드 미구현으로 수동 입력이 필요합니다.
                                이 목록은 다른 설정 모달의 동적 필드를 생성하는 데 사용됩니다.
                            </Typography>
                            <Stack direction="row" spacing={1} mb={2}>
                                <TextField
                                    size="small"
                                    label="요금제군 추가"
                                    value={newPlanGroup}
                                    onChange={(e) => setNewPlanGroup(e.target.value)}
                                />
                                <Button variant="contained" onClick={handleAddPlanGroup} startIcon={<AddIcon />}>추가</Button>
                            </Stack>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {planGroupSettings.planGroups.map((group) => (
                                    <Paper key={group} sx={{ p: 1, px: 2, display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
                                        <Typography>{group}</Typography>
                                        <IconButton size="small" onClick={() => handleDeletePlanGroup(group)} sx={{ ml: 1 }}>
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Paper>
                                ))}
                            </Box>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenPlanGroupModal(false)}>취소</Button>
                    <Button variant="contained" onClick={() => handleSave('planGroup')} disabled={saving}>
                        {saving ? <CircularProgress size={24} /> : '저장'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 2. 이통사 지원금 설정 모달 */}
            <Dialog open={openSupportModal} onClose={() => setOpenSupportModal(false)} maxWidth="md" fullWidth>
                <DialogTitle>이통사 지원금 설정 ({getCurrentCarrier()})</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        <TextField
                            label="구글 시트 링크"
                            fullWidth
                            value={supportSettings.link}
                            onChange={(e) => setSupportSettings({ ...supportSettings, link: e.target.value })}
                        />
                        <Divider />
                        <Typography variant="subtitle1" fontWeight="bold">모델 정보 범위</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6} md={3}>
                                <TextField
                                    label="모델명 범위"
                                    fullWidth
                                    value={supportSettings.modelRange}
                                    onChange={(e) => setSupportSettings({ ...supportSettings, modelRange: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <TextField
                                    label="펫네임 범위"
                                    fullWidth
                                    value={supportSettings.petNameRange}
                                    onChange={(e) => setSupportSettings({ ...supportSettings, petNameRange: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <TextField
                                    label="출고가 범위"
                                    fullWidth
                                    value={supportSettings.factoryPriceRange}
                                    onChange={(e) => setSupportSettings({ ...supportSettings, factoryPriceRange: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <TextField
                                    label="개통유형 범위"
                                    fullWidth
                                    value={supportSettings.openingTypeRange}
                                    onChange={(e) => setSupportSettings({ ...supportSettings, openingTypeRange: e.target.value })}
                                />
                            </Grid>
                        </Grid>
                        <Divider />
                        <Typography variant="subtitle1" fontWeight="bold">요금제군별 지원금 범위 (동적 생성)</Typography>
                        <Grid container spacing={2}>
                            {planGroupSettings.planGroups.map((group) => (
                                <Grid item xs={12} sm={6} key={group}>
                                    <TextField
                                        label={`${group} 지원금 범위`}
                                        fullWidth
                                        value={supportSettings.planGroupRanges[group] || ''}
                                        onChange={(e) => setSupportSettings({
                                            ...supportSettings,
                                            planGroupRanges: {
                                                ...supportSettings.planGroupRanges,
                                                [group]: e.target.value
                                            }
                                        })}
                                        placeholder="예: Sheet1!E2:E100"
                                    />
                                </Grid>
                            ))}
                            {planGroupSettings.planGroups.length === 0 && (
                                <Grid item xs={12}>
                                    <Alert severity="info">요금제 그룹핑 설정에서 요금제군을 먼저 등록해주세요.</Alert>
                                </Grid>
                            )}
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenSupportModal(false)}>취소</Button>
                    <Button variant="contained" onClick={() => handleSave('support')} disabled={saving}>
                        {saving ? <CircularProgress size={24} /> : '저장'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 3. 정책표 설정 모달 */}
            <Dialog open={openPolicyModal} onClose={() => setOpenPolicyModal(false)} maxWidth="md" fullWidth>
                <DialogTitle>정책표 설정 ({getCurrentCarrier()})</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        <TextField
                            label="구글 시트 링크"
                            fullWidth
                            value={policySettings.link}
                            onChange={(e) => setPolicySettings({ ...policySettings, link: e.target.value })}
                        />
                        <Divider />
                        <Typography variant="subtitle1" fontWeight="bold">모델 정보 범위</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="모델명 범위"
                                    fullWidth
                                    value={policySettings.modelRange}
                                    onChange={(e) => setPolicySettings({ ...policySettings, modelRange: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="펫네임 범위"
                                    fullWidth
                                    value={policySettings.petNameRange}
                                    onChange={(e) => setPolicySettings({ ...policySettings, petNameRange: e.target.value })}
                                />
                            </Grid>
                        </Grid>
                        <Divider />
                        <Typography variant="subtitle1" fontWeight="bold">요금제군별 정책금 범위 (동적 생성)</Typography>
                        <Grid container spacing={2}>
                            {planGroupSettings.planGroups.map((group) => (
                                <Grid item xs={12} sm={6} key={group}>
                                    <TextField
                                        label={`${group} 정책금 범위`}
                                        fullWidth
                                        value={policySettings.planGroupRanges[group] || ''}
                                        onChange={(e) => setPolicySettings({
                                            ...policySettings,
                                            planGroupRanges: {
                                                ...policySettings.planGroupRanges,
                                                [group]: e.target.value
                                            }
                                        })}
                                        placeholder="예: Sheet1!F2:F100"
                                    />
                                </Grid>
                            ))}
                            {planGroupSettings.planGroups.length === 0 && (
                                <Grid item xs={12}>
                                    <Alert severity="info">요금제 그룹핑 설정에서 요금제군을 먼저 등록해주세요.</Alert>
                                </Grid>
                            )}
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenPolicyModal(false)}>취소</Button>
                    <Button variant="contained" onClick={() => handleSave('policy')} disabled={saving}>
                        {saving ? <CircularProgress size={24} /> : '저장'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!successMessage}
                autoHideDuration={3000}
                onClose={() => setSuccessMessage(null)}
                message={successMessage}
            />

            {error && (
                <Snackbar
                    open={!!error}
                    autoHideDuration={3000}
                    onClose={() => setError(null)}
                >
                    <Alert severity="error">{error}</Alert>
                </Snackbar>
            )}
        </Box>
    );
};

export default LinkSettingsTab;
