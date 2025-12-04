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
    Close as CloseIcon,
    Checkbox
} from '@mui/icons-material';
import { directStoreApi } from '../../../api/directStoreApi';

// 구글 시트 ID 추출 함수 (전체 URL 또는 ID만 입력 가능)
const extractSheetId = (value = '') => {
    if (!value) return '';
    const trimmed = value.trim();
    // URL 형식에서 ID 추출: /d/(ID) 패턴
    const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return match[1];
    // 이미 ID 형식인 경우 (10자 이상의 영숫자, 하이픈, 언더스코어)
    if (/^[a-zA-Z0-9-_]{10,}$/.test(trimmed)) return trimmed;
    return '';
};

const LinkSettingsTab = () => {
    const [carrierTab, setCarrierTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [previewDialog, setPreviewDialog] = useState({ open: false, title: '', data: [], useUnique: false, multiplyBy10000: false, link: '', range: '', fieldName: '' });

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
        planGroupRanges: {} // { '115군': { '010신규': 'Sheet1!G2:G100', 'MNP': 'Sheet1!H2:H100', '기변': 'Sheet1!I2:I100' }, ... }
    });

    // 개통 유형 목록 (고정)
    const openingTypes = ['010신규', 'MNP', '기변'];

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
                        setPlanGroupSettings({
                            link: data.planGroup.link || data.planGroup.sheetId || '',
                            planNameRange: data.planGroup.planNameRange || '',
                            planGroupRange: data.planGroup.planGroupRange || '',
                            basicFeeRange: data.planGroup.basicFeeRange || '',
                            planGroups: data.planGroup.planGroups || []
                        });
                    }
                    if (data.support) {
                        setSupportSettings({
                            link: data.support.link || data.support.sheetId || '',
                            modelRange: data.support.modelRange || '',
                            petNameRange: data.support.petNameRange || '',
                            factoryPriceRange: data.support.factoryPriceRange || '',
                            openingTypeRange: data.support.openingTypeRange || '',
                            planGroupRanges: data.support.planGroupRanges || {}
                        });
                    }
                    if (data.policy) {
                        setPolicySettings({
                            link: data.policy.link || data.policy.sheetId || '',
                            modelRange: data.policy.modelRange || '',
                            petNameRange: data.policy.petNameRange || '',
                            planGroupRanges: data.policy.planGroupRanges || {}
                        });
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

    // 시트에서 요금제군 자동 가져오기
    // 주의: 요금제군은 유니크한 값만 필요하므로 unique=true로 처리합니다.
    // 금액 범위는 이 함수를 사용하지 않고 handlePreviewRange를 사용합니다.
    const handleFetchPlanGroups = async () => {
        try {
            setLoading(true);
            setError(null);
            const sheetId = extractSheetId(planGroupSettings.link);
            if (!sheetId) {
                setError('구글 시트 링크 또는 ID를 먼저 입력해주세요.');
                setLoading(false);
                return;
            }
            if (!planGroupSettings.planGroupRange) {
                setError('요금제군 범위를 먼저 입력해주세요.');
                setLoading(false);
                return;
            }

            const result = await directStoreApi.fetchPlanGroups(sheetId, planGroupSettings.planGroupRange);
            if (result.success && result.planGroups) {
                setPlanGroupSettings(prev => ({
                    ...prev,
                    planGroups: result.planGroups
                }));
                setSuccessMessage(`${result.planGroups.length}개의 요금제군을 가져왔습니다.`);
            } else {
                setError(result.error || '요금제군을 가져오는데 실패했습니다.');
            }
        } catch (err) {
            console.error('요금제군 가져오기 실패:', err);
            setError('요금제군을 가져오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 범위 데이터 미리보기
    // unique 옵션 지원: 금액 범위도 유니크 옵션을 선택할 수 있습니다.
    // 정책금 범위는 *10000을 적용하여 표시합니다.
    const handlePreviewRange = async (type, fieldName, link, range, useUnique = false, multiplyBy10000 = false) => {
        try {
            setLoading(true);
            setError(null);
            const sheetId = extractSheetId(link);
            if (!sheetId) {
                setError('구글 시트 링크 또는 ID를 먼저 입력해주세요.');
                setLoading(false);
                return;
            }
            if (!range) {
                setError('범위를 먼저 입력해주세요.');
                setLoading(false);
                return;
            }

            const result = await directStoreApi.fetchRangeData(sheetId, range, useUnique);
            if (result.success && result.data) {
                let previewData = result.data.flat().slice(0, 20); // 최대 20개만 미리보기
                
                // 정책금 범위는 *10000 적용
                if (multiplyBy10000) {
                    previewData = previewData.map(item => {
                        const numValue = parseFloat(item) || 0;
                        return numValue > 0 ? (numValue * 10000).toLocaleString() : item;
                    });
                }
                
                setPreviewDialog({
                    open: true,
                    title: `${fieldName} 미리보기 (최대 20개)${useUnique ? ' - 유니크' : ''}${multiplyBy10000 ? ' - 만원 단위 변환' : ''}`,
                    data: previewData,
                    useUnique,
                    multiplyBy10000,
                    link,
                    range,
                    fieldName
                });
            } else {
                setError(result.error || '데이터를 가져오는데 실패했습니다.');
            }
        } catch (err) {
            console.error('범위 미리보기 실패:', err);
            setError('데이터를 가져오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (type) => {
        try {
            setSaving(true);
            const carrier = getCurrentCarrier();
            let settings = {};

            if (type === 'planGroup') {
                // 링크에서 ID만 추출해서 저장
                const sheetId = extractSheetId(planGroupSettings.link);
                if (!sheetId) {
                    setError('올바른 구글 시트 링크 또는 ID를 입력해주세요.');
                    setSaving(false);
                    return;
                }
                settings = { 
                    planGroup: {
                        ...planGroupSettings,
                        link: sheetId, // ID만 저장
                        sheetId: sheetId
                    }
                };
            } else if (type === 'support') {
                const sheetId = extractSheetId(supportSettings.link);
                if (!sheetId) {
                    setError('올바른 구글 시트 링크 또는 ID를 입력해주세요.');
                    setSaving(false);
                    return;
                }
                settings = { 
                    support: {
                        ...supportSettings,
                        link: sheetId,
                        sheetId: sheetId
                    }
                };
            } else if (type === 'policy') {
                const sheetId = extractSheetId(policySettings.link);
                if (!sheetId) {
                    setError('올바른 구글 시트 링크 또는 ID를 입력해주세요.');
                    setSaving(false);
                    return;
                }
                settings = { 
                    policy: {
                        ...policySettings,
                        link: sheetId,
                        sheetId: sheetId
                    }
                };
            }

            await directStoreApi.saveLinkSettings(carrier, settings);
            setSuccessMessage('설정이 저장되었습니다.');
            
            // 저장 후 자동으로 다시 로드 (planGroups 자동 추출 반영)
            if (type === 'planGroup') {
                const reloadData = await directStoreApi.getLinkSettings(carrier);
                if (reloadData.success && reloadData.planGroup) {
                    setPlanGroupSettings({
                        link: reloadData.planGroup.link || reloadData.planGroup.sheetId || '',
                        planNameRange: reloadData.planGroup.planNameRange || '',
                        planGroupRange: reloadData.planGroup.planGroupRange || '',
                        basicFeeRange: reloadData.planGroup.basicFeeRange || '',
                        planGroups: reloadData.planGroup.planGroups || []
                    });
                }
                setOpenPlanGroupModal(false);
            } else if (type === 'support') {
                setOpenSupportModal(false);
            } else if (type === 'policy') {
                setOpenPolicyModal(false);
            }
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
                            모델정보 및 요금제군별 리베이트 범위 설정
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
                            label="구글 시트 링크 또는 ID"
                            fullWidth
                            value={planGroupSettings.link}
                            onChange={(e) => setPlanGroupSettings({ ...planGroupSettings, link: e.target.value })}
                            placeholder="전체 URL 또는 시트 ID만 입력 (예: 12Jx-Y2EXGjsIulWvw9Cr4kVOZQwQPdBQtIRi90rUTJc)"
                            helperText="전체 URL 또는 시트 ID만 입력해주세요. ID만 입력해도 됩니다."
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
                                    placeholder="예: 정책!D5:D500 또는 '정책'!D5:D500"
                                    helperText="시트이름!범위 형식 (한글 시트명은 작은따옴표 권장)"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="요금제군 범위"
                                    fullWidth
                                    value={planGroupSettings.planGroupRange}
                                    onChange={(e) => setPlanGroupSettings({ ...planGroupSettings, planGroupRange: e.target.value })}
                                    placeholder="예: 정책!F5:F500 또는 '정책'!F5:F500"
                                    helperText="시트이름!범위 형식 (한글 시트명은 작은따옴표 권장)"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="기본료 범위"
                                    fullWidth
                                    value={planGroupSettings.basicFeeRange}
                                    onChange={(e) => setPlanGroupSettings({ ...planGroupSettings, basicFeeRange: e.target.value })}
                                    placeholder="예: 정책!E5:E500 또는 '정책'!E5:E500"
                                    helperText="시트이름!범위 형식 (한글 시트명은 작은따옴표 권장)"
                                />
                            </Grid>
                        </Grid>

                        <Divider />
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                요금제군 목록
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                                * 시트에서 자동으로 가져오거나 수동으로 추가할 수 있습니다.
                                이 목록은 다른 설정 모달의 동적 필드를 생성하는 데 사용됩니다.
                            </Typography>
                            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
                                <Button 
                                    variant="outlined" 
                                    onClick={handleFetchPlanGroups} 
                                    disabled={!planGroupSettings.link || !planGroupSettings.planGroupRange || loading}
                                    startIcon={<LinkIcon />}
                                >
                                    시트에서 자동 가져오기
                                </Button>
                                <TextField
                                    size="small"
                                    label="요금제군 추가"
                                    value={newPlanGroup}
                                    onChange={(e) => setNewPlanGroup(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAddPlanGroup();
                                        }
                                    }}
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
                            label="구글 시트 링크 또는 ID"
                            fullWidth
                            value={supportSettings.link}
                            onChange={(e) => setSupportSettings({ ...supportSettings, link: e.target.value })}
                            placeholder="전체 URL 또는 시트 ID만 입력 (예: 12Jx-Y2EXGjsIulWvw9Cr4kVOZQwQPdBQtIRi90rUTJc)"
                            helperText="전체 URL 또는 시트 ID만 입력해주세요. ID만 입력해도 됩니다."
                        />
                        <Divider />
                        <Typography variant="subtitle1" fontWeight="bold">모델 정보 범위</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6} md={3}>
                                <Stack direction="row" spacing={1}>
                                    <TextField
                                        label="모델명 범위"
                                        fullWidth
                                        value={supportSettings.modelRange}
                                        onChange={(e) => setSupportSettings({ ...supportSettings, modelRange: e.target.value })}
                                        placeholder="예: 정책!A5:A500"
                                        helperText="시트이름!범위"
                                    />
                                    <Button 
                                        variant="outlined" 
                                        size="small"
                                        onClick={() => handlePreviewRange('support', 'modelRange', supportSettings.link, supportSettings.modelRange)}
                                        disabled={!supportSettings.link || !supportSettings.modelRange}
                                        sx={{ minWidth: 'auto', px: 1 }}
                                    >
                                        미리보기
                                    </Button>
                                </Stack>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Stack direction="row" spacing={1}>
                                    <TextField
                                        label="펫네임 범위"
                                        fullWidth
                                        value={supportSettings.petNameRange}
                                        onChange={(e) => setSupportSettings({ ...supportSettings, petNameRange: e.target.value })}
                                        placeholder="예: 정책!B5:B500"
                                        helperText="시트이름!범위"
                                    />
                                    <Button 
                                        variant="outlined" 
                                        size="small"
                                        onClick={() => handlePreviewRange('support', 'petNameRange', supportSettings.link, supportSettings.petNameRange)}
                                        disabled={!supportSettings.link || !supportSettings.petNameRange}
                                        sx={{ minWidth: 'auto', px: 1 }}
                                    >
                                        미리보기
                                    </Button>
                                </Stack>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Stack direction="row" spacing={1}>
                                    <TextField
                                        label="출고가 범위"
                                        fullWidth
                                        value={supportSettings.factoryPriceRange}
                                        onChange={(e) => setSupportSettings({ ...supportSettings, factoryPriceRange: e.target.value })}
                                        placeholder="예: 정책!C5:C500"
                                        helperText="시트이름!범위"
                                    />
                                    <Button 
                                        variant="outlined" 
                                        size="small"
                                        onClick={() => handlePreviewRange('support', 'factoryPriceRange', supportSettings.link, supportSettings.factoryPriceRange)}
                                        disabled={!supportSettings.link || !supportSettings.factoryPriceRange}
                                        sx={{ minWidth: 'auto', px: 1 }}
                                    >
                                        미리보기
                                    </Button>
                                </Stack>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Stack direction="row" spacing={1}>
                                    <TextField
                                        label="개통유형 범위"
                                        fullWidth
                                        value={supportSettings.openingTypeRange}
                                        onChange={(e) => setSupportSettings({ ...supportSettings, openingTypeRange: e.target.value })}
                                        placeholder="예: 정책!D5:D500"
                                        helperText="시트이름!범위"
                                    />
                                    <Button 
                                        variant="outlined" 
                                        size="small"
                                        onClick={() => handlePreviewRange('support', 'openingTypeRange', supportSettings.link, supportSettings.openingTypeRange)}
                                        disabled={!supportSettings.link || !supportSettings.openingTypeRange}
                                        sx={{ minWidth: 'auto', px: 1 }}
                                    >
                                        미리보기
                                    </Button>
                                </Stack>
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
                                        placeholder="예: 정책!E5:E500"
                                        helperText="시트이름!범위 (한글 시트명은 작은따옴표 권장)"
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
                            label="구글 시트 링크 또는 ID"
                            fullWidth
                            value={policySettings.link}
                            onChange={(e) => setPolicySettings({ ...policySettings, link: e.target.value })}
                            placeholder="전체 URL 또는 시트 ID만 입력 (예: 12Jx-Y2EXGjsIulWvw9Cr4kVOZQwQPdBQtIRi90rUTJc)"
                            helperText="전체 URL 또는 시트 ID만 입력해주세요. ID만 입력해도 됩니다."
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
                                    placeholder="예: 정책!A5:A500"
                                    helperText="시트이름!범위"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="펫네임 범위"
                                    fullWidth
                                    value={policySettings.petNameRange}
                                    onChange={(e) => setPolicySettings({ ...policySettings, petNameRange: e.target.value })}
                                    placeholder="예: 정책!B5:B500"
                                    helperText="시트이름!범위"
                                />
                            </Grid>
                        </Grid>
                        <Divider />
                        <Typography variant="subtitle1" fontWeight="bold">요금제군별 리베이트 범위 (동적 생성)</Typography>
                        <Grid container spacing={2}>
                            {planGroupSettings.planGroups.map((group) => (
                                <Grid item xs={12} key={group}>
                                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                            {group}
                                        </Typography>
                                        <Grid container spacing={2} sx={{ mt: 1 }}>
                                            {openingTypes.map((type) => {
                                                const rangeKey = `${group}_${type}`;
                                                const currentRange = policySettings.planGroupRanges[group]?.[type] || '';
                                                return (
                                                    <Grid item xs={12} sm={4} key={type}>
                                                        <Stack direction="row" spacing={1}>
                                                            <TextField
                                                                label={`${type} 리베이트 범위`}
                                                                fullWidth
                                                                value={currentRange}
                                                                onChange={(e) => setPolicySettings({
                                                                    ...policySettings,
                                                                    planGroupRanges: {
                                                                        ...policySettings.planGroupRanges,
                                                                        [group]: {
                                                                            ...(policySettings.planGroupRanges[group] || {}),
                                                                            [type]: e.target.value
                                                                        }
                                                                    }
                                                                })}
                                                                placeholder="예: 정책!F5:F500"
                                                                helperText="시트이름!범위 (만원 단위, *10000 적용)"
                                                            />
                                                            <Button 
                                                                variant="outlined" 
                                                                size="small"
                                                                onClick={() => handlePreviewRange('policy', `${group} ${type} 리베이트 범위`, policySettings.link, currentRange, false, true)}
                                                                disabled={!policySettings.link || !currentRange}
                                                                sx={{ minWidth: 'auto', px: 1, alignSelf: 'flex-start', mt: 1 }}
                                                            >
                                                                미리보기
                                                            </Button>
                                                        </Stack>
                                                    </Grid>
                                                );
                                            })}
                                        </Grid>
                                    </Paper>
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

            {/* 범위 데이터 미리보기 다이얼로그 */}
            <Dialog open={previewDialog.open} onClose={() => setPreviewDialog({ open: false, title: '', data: [], useUnique: false, multiplyBy10000: false, link: '', range: '', fieldName: '' })} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">{previewDialog.title}</Typography>
                        {previewDialog.fieldName && (
                            <Button
                                size="small"
                                variant={previewDialog.useUnique ? 'contained' : 'outlined'}
                                onClick={async () => {
                                    const sheetId = extractSheetId(previewDialog.link);
                                    const result = await directStoreApi.fetchRangeData(sheetId, previewDialog.range, !previewDialog.useUnique);
                                    if (result.success && result.data) {
                                        let previewData = result.data.flat().slice(0, 20);
                                        if (previewDialog.multiplyBy10000) {
                                            previewData = previewData.map(item => {
                                                const numValue = parseFloat(item) || 0;
                                                return numValue > 0 ? (numValue * 10000).toLocaleString() : item;
                                            });
                                        }
                                        setPreviewDialog(prev => ({
                                            ...prev,
                                            useUnique: !prev.useUnique,
                                            data: previewData
                                        }));
                                    }
                                }}
                            >
                                유니크 {previewDialog.useUnique ? 'ON' : 'OFF'}
                            </Button>
                        )}
                    </Stack>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1} sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {previewDialog.data.length > 0 ? (
                            previewDialog.data.map((item, idx) => (
                                <Paper key={idx} sx={{ p: 1, bgcolor: 'background.default' }}>
                                    <Typography variant="body2">{item || '(빈 값)'}</Typography>
                                </Paper>
                            ))
                        ) : (
                            <Typography variant="body2" color="text.secondary">데이터가 없습니다.</Typography>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewDialog({ open: false, title: '', data: [], useUnique: false, multiplyBy10000: false, link: '', range: '', fieldName: '' })}>닫기</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default LinkSettingsTab;
