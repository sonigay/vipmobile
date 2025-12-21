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
    Snackbar,
    Switch,
    FormControlLabel,
    Chip
} from '@mui/material';
import {
    AttachMoney as AttachMoneyIcon,
    AddCircle as AddCircleIcon,
    PlaylistAddCheck as PlaylistAddCheckIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../../api/directStoreApi';
import { directStoreApiClient } from '../../../api/directStoreApiClient';
import { LoadingState } from '../common/LoadingState';
import { ErrorState } from '../common/ErrorState';

const PolicySettingsTab = () => {
    const [carrierTab, setCarrierTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // 모달 상태
    const [openMarginModal, setOpenMarginModal] = useState(false);
    const [openAddonModal, setOpenAddonModal] = useState(false);
    const [openSpecialModal, setOpenSpecialModal] = useState(false);

    // --- 데이터 상태 ---

    // 1. 마진 설정
    const [margin, setMargin] = useState(0);

    // 2. 부가서비스 설정 리스트
    const [addons, setAddons] = useState([
        { id: 1, name: 'V컬러링', fee: 3300, incentive: 1000, deduction: 0 },
        { id: 2, name: '우주패스', fee: 9900, incentive: 5000, deduction: 2000 }
    ]);
    // 부가서비스 입력 폼 상태
    const [newAddon, setNewAddon] = useState({ name: '', fee: '', incentive: '', deduction: '', description: '', url: '' });
    // 부가서비스 수정 중인 항목 ID
    const [editingAddonId, setEditingAddonId] = useState(null);

    // 2-1. 보험상품 설정 리스트
    const [insurances, setInsurances] = useState([]);
    // 보험상품 입력 폼 상태
    const [newInsurance, setNewInsurance] = useState({ name: '', minPrice: '', maxPrice: '', fee: '', incentive: '', deduction: '', description: '', url: '' });
    // 보험상품 수정 중인 항목 ID
    const [editingInsuranceId, setEditingInsuranceId] = useState(null);

    // 3. 별도정책 설정 리스트
    const [specialPolicies, setSpecialPolicies] = useState([
        { id: 1, name: '기기반납', addition: 0, deduction: 100000, isActive: true },
        { id: 2, name: '제휴카드', addition: 50000, deduction: 0, isActive: false }
    ]);
    // 별도정책 입력 폼 상태
    const [newSpecial, setNewSpecial] = useState({ name: '', addition: '', deduction: '', isActive: true });


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
            // #region agent log
            const carrier = getCurrentCarrier();
            fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PolicySettingsTab.js:loadSettings',message:'정책 설정 로드 시작',data:{carrier},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P1'})}).catch(()=>{});
            // #endregion
            try {
                setLoading(true);
                const startTime = Date.now();
                const data = await directStoreApiClient.getPolicySettings(carrier);
                const duration = Date.now() - startTime;
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PolicySettingsTab.js:loadSettings',message:'정책 설정 로드 완료',data:{carrier,success:data?.success,duration,hasMargin:!!data?.margin,addonCount:data?.addon?.list?.length||0,insuranceCount:data?.insurance?.list?.length||0,specialCount:data?.special?.list?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P1'})}).catch(()=>{});
                // #endregion
                
                if (data.success) {
                    if (data.margin) {
                        setMargin(data.margin.baseMargin || 0);
                    }
                    if (data.addon?.list) {
                        setAddons(data.addon.list);
                    }
                    if (data.insurance?.list) {
                        setInsurances(data.insurance.list);
                    }
                    if (data.special?.list) {
                        setSpecialPolicies(data.special.list);
                    }
                }
            } catch (err) {
                console.error('정책 설정 로드 실패:', err);
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

    // 부가서비스 추가
    const handleAddAddon = () => {
        if (newAddon.name) {
            setAddons([...addons, {
                id: Date.now(),
                name: newAddon.name,
                fee: Number(newAddon.fee) || 0,
                incentive: Number(newAddon.incentive) || 0,
                deduction: Number(newAddon.deduction) || 0,
                description: newAddon.description || '',
                url: newAddon.url || ''
            }]);
            setNewAddon({ name: '', fee: '', incentive: '', deduction: '', description: '', url: '' });
        }
    };

    // 부가서비스 수정 시작
    const handleEditAddon = (addon) => {
        setEditingAddonId(addon.id);
        setNewAddon({
            name: addon.name,
            fee: addon.fee,
            incentive: addon.incentive,
            deduction: addon.deduction,
            description: addon.description || '',
            url: addon.url || ''
        });
    };

    // 부가서비스 수정 취소
    const handleCancelEditAddon = () => {
        setEditingAddonId(null);
        setNewAddon({ name: '', fee: '', incentive: '', deduction: '', description: '', url: '' });
    };

    // 부가서비스 수정 저장
    const handleSaveEditAddon = () => {
        if (newAddon.name && editingAddonId) {
            setAddons(addons.map(item => 
                item.id === editingAddonId 
                    ? {
                        ...item,
                        name: newAddon.name,
                        fee: Number(newAddon.fee) || 0,
                        incentive: Number(newAddon.incentive) || 0,
                        deduction: Number(newAddon.deduction) || 0,
                        description: newAddon.description || '',
                        url: newAddon.url || ''
                    }
                    : item
            ));
            handleCancelEditAddon();
        }
    };

    // 부가서비스 삭제
    const handleDeleteAddon = (id) => {
        setAddons(addons.filter(item => item.id !== id));
    };

    // 보험상품 추가
    const handleAddInsurance = () => {
        if (newInsurance.name && newInsurance.minPrice !== '' && newInsurance.maxPrice !== '' && newInsurance.fee !== '') {
            setInsurances([...insurances, {
                id: Date.now(),
                name: newInsurance.name,
                minPrice: Number(newInsurance.minPrice) || 0,
                maxPrice: Number(newInsurance.maxPrice) || 0,
                fee: Number(newInsurance.fee) || 0,
                incentive: Number(newInsurance.incentive) || 0,
                deduction: Number(newInsurance.deduction) || 0,
                description: newInsurance.description || '',
                url: newInsurance.url || ''
            }]);
            setNewInsurance({ name: '', minPrice: '', maxPrice: '', fee: '', incentive: '', deduction: '', description: '', url: '' });
        }
    };

    // 보험상품 수정 시작
    const handleEditInsurance = (insurance) => {
        setEditingInsuranceId(insurance.id);
        setNewInsurance({
            name: insurance.name,
            minPrice: insurance.minPrice,
            maxPrice: insurance.maxPrice,
            fee: insurance.fee,
            incentive: insurance.incentive,
            deduction: insurance.deduction,
            description: insurance.description || '',
            url: insurance.url || ''
        });
    };

    // 보험상품 수정 취소
    const handleCancelEditInsurance = () => {
        setEditingInsuranceId(null);
        setNewInsurance({ name: '', minPrice: '', maxPrice: '', fee: '', incentive: '', deduction: '', description: '', url: '' });
    };

    // 보험상품 수정 저장
    const handleSaveEditInsurance = () => {
        if (newInsurance.name && editingInsuranceId) {
            setInsurances(insurances.map(item => 
                item.id === editingInsuranceId 
                    ? {
                        ...item,
                        name: newInsurance.name,
                        minPrice: Number(newInsurance.minPrice) || 0,
                        maxPrice: Number(newInsurance.maxPrice) || 0,
                        fee: Number(newInsurance.fee) || 0,
                        incentive: Number(newInsurance.incentive) || 0,
                        deduction: Number(newInsurance.deduction) || 0,
                        description: newInsurance.description || '',
                        url: newInsurance.url || ''
                    }
                    : item
            ));
            handleCancelEditInsurance();
        }
    };

    // 보험상품 삭제
    const handleDeleteInsurance = (id) => {
        setInsurances(insurances.filter(item => item.id !== id));
    };

    // 별도정책 추가
    const handleAddSpecial = () => {
        if (newSpecial.name) {
            setSpecialPolicies([...specialPolicies, {
                id: Date.now(),
                name: newSpecial.name,
                addition: Number(newSpecial.addition) || 0,
                deduction: Number(newSpecial.deduction) || 0,
                isActive: newSpecial.isActive
            }]);
            setNewSpecial({ name: '', addition: '', deduction: '', isActive: true });
        }
    };

    // 별도정책 삭제
    const handleDeleteSpecial = (id) => {
        setSpecialPolicies(specialPolicies.filter(item => item.id !== id));
    };

    // 별도정책 활성/비활성 토글
    const handleToggleSpecial = (id) => {
        setSpecialPolicies(specialPolicies.map(item =>
            item.id === id ? { ...item, isActive: !item.isActive } : item
        ));
    };

    const handleSave = async (type) => {
        // #region agent log
        const carrier = getCurrentCarrier();
        fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PolicySettingsTab.js:handleSave',message:'정책 설정 저장 시작',data:{type,carrier},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P2'})}).catch(()=>{});
        // #endregion
        try {
            setSaving(true);
            let settings = {};

            if (type === 'margin') {
                settings = { margin: { baseMargin: margin } };
            } else if (type === 'addon') {
                settings = { addon: { list: addons }, insurance: { list: insurances } };
            } else if (type === 'special') {
                settings = { special: { list: specialPolicies } };
            }

            const startTime = Date.now();
            await directStoreApiClient.savePolicySettings(carrier, settings);
            const duration = Date.now() - startTime;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PolicySettingsTab.js:handleSave',message:'정책 설정 저장 완료',data:{type,carrier,duration},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P2'})}).catch(()=>{});
            // #endregion
            setSuccessMessage('설정이 저장되었습니다.');
            
            if (type === 'margin') setOpenMarginModal(false);
            if (type === 'addon') setOpenAddonModal(false);
            if (type === 'special') setOpenSpecialModal(false);
        } catch (err) {
            console.error('정책 설정 저장 실패:', err);
            setError('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <LoadingState message="정책 설정을 불러오는 중..." />;
    }

    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            {error && (
                <ErrorState error={error} onRetry={() => window.location.reload()} title="정책 설정 로드 실패" />
            )}
            
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                정책 설정
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
                {/* 1. 마진 설정 버튼 */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
                        }}
                        onClick={() => setOpenMarginModal(true)}
                    >
                        <AttachMoneyIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight="bold">마진 설정</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            기본 마진 금액 설정
                        </Typography>
                        <Typography
                            variant="h5"
                            color={margin > 0 ? 'primary' : 'text.secondary'}
                            sx={{ mt: 2, fontWeight: 'bold' }}
                        >
                            {margin > 0 ? `${margin.toLocaleString()}원` : '설정된 마진 금액이 없습니다'}
                        </Typography>
                    </Paper>
                </Grid>

                {/* 2. 부가서비스 설정 버튼 */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
                        }}
                        onClick={() => setOpenAddonModal(true)}
                    >
                        <AddCircleIcon sx={{ fontSize: 60, color: 'secondary.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight="bold">부가서비스 설정</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            추가/차감 금액 설정
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 2 }}>
                            등록된 항목: {addons.length}개
                        </Typography>
                    </Paper>
                </Grid>

                {/* 3. 별도정책 설정 버튼 */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
                        }}
                        onClick={() => setOpenSpecialModal(true)}
                    >
                        <PlaylistAddCheckIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight="bold">별도정책 설정</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            조건별 추가/차감 설정
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 2 }}>
                            활성 항목: {specialPolicies.filter(p => p.isActive).length}개
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* --- 모달들 --- */}

            {/* 1. 마진 설정 모달 */}
            <Dialog open={openMarginModal} onClose={() => setOpenMarginModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle>마진 설정 ({getCurrentCarrier()})</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ py: 2 }}>
                        <TextField
                            label="마진 금액"
                            type="number"
                            fullWidth
                            value={margin}
                            onChange={(e) => setMargin(Number(e.target.value))}
                            InputProps={{ endAdornment: '원' }}
                            helperText="기본적으로 적용될 마진 금액을 입력하세요."
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenMarginModal(false)}>취소</Button>
                    <Button variant="contained" onClick={() => handleSave('margin')} disabled={saving}>
                        저장
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 2. 부가서비스 설정 모달 */}
            <Dialog open={openAddonModal} onClose={() => setOpenAddonModal(false)} maxWidth="md" fullWidth>
                <DialogTitle>부가서비스 설정 ({getCurrentCarrier()})</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        {/* 입력 폼 */}
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.subtle' }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight="bold">새 부가서비스 추가</Typography>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        label="서비스명" size="small" fullWidth
                                        value={newAddon.name} onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={4} sm={2}>
                                    <TextField
                                        label="월요금" size="small" fullWidth type="number"
                                        value={newAddon.fee} onChange={(e) => setNewAddon({ ...newAddon, fee: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={4} sm={2}>
                                    <TextField
                                        label="유치(+)" size="small" fullWidth type="number" color="primary"
                                        value={newAddon.incentive} onChange={(e) => setNewAddon({ ...newAddon, incentive: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={4} sm={2}>
                                    <TextField
                                        label="미유치(-)" size="small" fullWidth type="number" color="error"
                                        value={newAddon.deduction} onChange={(e) => setNewAddon({ ...newAddon, deduction: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    {editingAddonId ? (
                                        <Stack direction="row" spacing={1}>
                                            <Button variant="contained" fullWidth startIcon={<SaveIcon />} onClick={handleSaveEditAddon} color="success">
                                                저장
                                            </Button>
                                            <Button variant="outlined" fullWidth onClick={handleCancelEditAddon}>
                                                취소
                                            </Button>
                                        </Stack>
                                    ) : (
                                    <Button variant="contained" fullWidth startIcon={<AddIcon />} onClick={handleAddAddon}>
                                        추가
                                    </Button>
                                    )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="상세설명" size="small" fullWidth multiline rows={2}
                                        value={newAddon.description} onChange={(e) => setNewAddon({ ...newAddon, description: e.target.value })}
                                        placeholder="부가서비스에 대한 상세 설명을 입력하세요"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="공식사이트 URL" size="small" fullWidth
                                        value={newAddon.url} onChange={(e) => setNewAddon({ ...newAddon, url: e.target.value })}
                                        placeholder="https://..."
                                        helperText="통신사 공식 부가서비스 안내 페이지 URL"
                                    />
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* 리스트 */}
                        <List>
                            {addons.map((addon) => (
                                <React.Fragment key={addon.id}>
                                    <ListItem>
                                        <ListItemText
                                            primary={
                                                <Typography fontWeight="bold">{addon.name}</Typography>
                                            }
                                            secondary={
                                                <Box>
                                                    <Typography variant="body2" color="text.secondary">
                                                        월 {addon.fee.toLocaleString()}원
                                                    </Typography>
                                                    {addon.description && (
                                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                                            {addon.description}
                                                        </Typography>
                                                    )}
                                                    {addon.url && (
                                                        <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5 }}>
                                                            <a href={addon.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                                                공식사이트: {addon.url}
                                                            </a>
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                        />
                                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mr: 2 }}>
                                            <Typography variant="body2" color="primary">
                                                유치: +{addon.incentive.toLocaleString()}
                                            </Typography>
                                            <Typography variant="body2" color="error">
                                                미유치: -{addon.deduction.toLocaleString()}
                                            </Typography>
                                        </Stack>
                                        <ListItemSecondaryAction>
                                            <Stack direction="row" spacing={1}>
                                                <IconButton edge="end" onClick={() => handleEditAddon(addon)} color="primary">
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton edge="end" onClick={() => handleDeleteAddon(addon.id)} color="error">
                                                <DeleteIcon />
                                            </IconButton>
                                            </Stack>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                    <Divider />
                                </React.Fragment>
                            ))}
                            {addons.length === 0 && (
                                <Typography color="text.secondary" align="center" py={2}>
                                    등록된 부가서비스가 없습니다.
                                </Typography>
                            )}
                        </List>

                        {/* 보험상품 추가 섹션 */}
                        <Divider sx={{ my: 2 }} />
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.subtle' }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight="bold">새 보험상품 추가</Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                                출고가 범위별로 월요금을 다르게 설정할 수 있습니다.
                            </Typography>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        label="보험상품명" size="small" fullWidth
                                        value={newInsurance.name} onChange={(e) => setNewInsurance({ ...newInsurance, name: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={6} sm={2}>
                                    <TextField
                                        label="출고가 최소" size="small" fullWidth type="number"
                                        value={newInsurance.minPrice} onChange={(e) => setNewInsurance({ ...newInsurance, minPrice: e.target.value })}
                                        placeholder="0"
                                    />
                                </Grid>
                                <Grid item xs={6} sm={2}>
                                    <TextField
                                        label="출고가 최대" size="small" fullWidth type="number"
                                        value={newInsurance.maxPrice} onChange={(e) => setNewInsurance({ ...newInsurance, maxPrice: e.target.value })}
                                        placeholder="9999999"
                                    />
                                </Grid>
                                <Grid item xs={4} sm={1.5}>
                                    <TextField
                                        label="월요금" size="small" fullWidth type="number"
                                        value={newInsurance.fee} onChange={(e) => setNewInsurance({ ...newInsurance, fee: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={4} sm={1.5}>
                                    <TextField
                                        label="유치(+)" size="small" fullWidth type="number" color="primary"
                                        value={newInsurance.incentive} onChange={(e) => setNewInsurance({ ...newInsurance, incentive: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={4} sm={1.5}>
                                    <TextField
                                        label="미유치(-)" size="small" fullWidth type="number" color="error"
                                        value={newInsurance.deduction} onChange={(e) => setNewInsurance({ ...newInsurance, deduction: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="상세설명" size="small" fullWidth multiline rows={2}
                                        value={newInsurance.description} onChange={(e) => setNewInsurance({ ...newInsurance, description: e.target.value })}
                                        placeholder="보험상품에 대한 상세 설명을 입력하세요"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="공식사이트 URL" size="small" fullWidth
                                        value={newInsurance.url} onChange={(e) => setNewInsurance({ ...newInsurance, url: e.target.value })}
                                        placeholder="https://..."
                                        helperText="통신사 공식 보험상품 안내 페이지 URL"
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    {editingInsuranceId ? (
                                        <Stack direction="row" spacing={1}>
                                            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveEditInsurance} color="success">
                                                저장
                                            </Button>
                                            <Button variant="outlined" onClick={handleCancelEditInsurance}>
                                                취소
                                            </Button>
                                        </Stack>
                                    ) : (
                                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddInsurance}>
                                        추가
                                    </Button>
                                    )}
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* 보험상품 리스트 */}
                        {insurances.length > 0 && (
                            <>
                                <Typography variant="subtitle2" gutterBottom fontWeight="bold" sx={{ mt: 2 }}>등록된 보험상품</Typography>
                                <List>
                                    {insurances.map((insurance) => (
                                        <React.Fragment key={insurance.id}>
                                            <ListItem>
                                                <ListItemText
                                                    primary={
                                                        <Typography fontWeight="bold">{insurance.name}</Typography>
                                                    }
                                                    secondary={
                                                        <Box>
                                                            <Typography variant="body2" color="text.secondary">
                                                                출고가: {insurance.minPrice.toLocaleString()}원 ~ {insurance.maxPrice.toLocaleString()}원
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                월 {insurance.fee.toLocaleString()}원
                                                            </Typography>
                                                            {insurance.description && (
                                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                                                    {insurance.description}
                                                                </Typography>
                                                            )}
                                                            {insurance.url && (
                                                                <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5 }}>
                                                                    <a href={insurance.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                                                        공식사이트: {insurance.url}
                                                                    </a>
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    }
                                                />
                                                <Stack direction="row" spacing={2} alignItems="center" sx={{ mr: 2 }}>
                                                    <Typography variant="body2" color="primary">
                                                        유치: +{insurance.incentive.toLocaleString()}
                                                    </Typography>
                                                    <Typography variant="body2" color="error">
                                                        미유치: -{insurance.deduction.toLocaleString()}
                                                    </Typography>
                                                </Stack>
                                                <ListItemSecondaryAction>
                                                    <Stack direction="row" spacing={1}>
                                                        <IconButton edge="end" onClick={() => handleEditInsurance(insurance)} color="primary">
                                                            <EditIcon />
                                                        </IconButton>
                                                        <IconButton edge="end" onClick={() => handleDeleteInsurance(insurance.id)} color="error">
                                                        <DeleteIcon />
                                                    </IconButton>
                                                    </Stack>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                            <Divider />
                                        </React.Fragment>
                                    ))}
                                </List>
                            </>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenAddonModal(false)}>닫기</Button>
                    <Button variant="contained" onClick={() => handleSave('addon')} disabled={saving}>
                        저장
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 3. 별도정책 설정 모달 */}
            <Dialog open={openSpecialModal} onClose={() => setOpenSpecialModal(false)} maxWidth="md" fullWidth>
                <DialogTitle>별도정책 설정 ({getCurrentCarrier()})</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        <Alert severity="info">
                            추후 모델, 개통유형, 요금제, 기간 등 상세 조건 설정 기능이 추가될 예정입니다.
                        </Alert>

                        {/* 입력 폼 */}
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.subtle' }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight="bold">새 정책 추가</Typography>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        label="정책 이름" size="small" fullWidth
                                        value={newSpecial.name} onChange={(e) => setNewSpecial({ ...newSpecial, name: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={4} sm={3}>
                                    <TextField
                                        label="추가금액(+)" size="small" fullWidth type="number" color="primary"
                                        value={newSpecial.addition} onChange={(e) => setNewSpecial({ ...newSpecial, addition: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={4} sm={3}>
                                    <TextField
                                        label="차감금액(-)" size="small" fullWidth type="number" color="error"
                                        value={newSpecial.deduction} onChange={(e) => setNewSpecial({ ...newSpecial, deduction: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={4} sm={3}>
                                    <Button variant="contained" fullWidth startIcon={<AddIcon />} onClick={handleAddSpecial}>
                                        추가
                                    </Button>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* 리스트 */}
                        <List>
                            {specialPolicies.map((policy) => (
                                <React.Fragment key={policy.id}>
                                    <ListItem>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={policy.isActive}
                                                    onChange={() => handleToggleSpecial(policy.id)}
                                                    color="primary"
                                                />
                                            }
                                            label={policy.isActive ? "적용" : "미적용"}
                                            sx={{ mr: 2 }}
                                        />
                                        <ListItemText
                                            primary={
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography fontWeight="bold" color={policy.isActive ? 'text.primary' : 'text.disabled'}>
                                                        {policy.name}
                                                    </Typography>
                                                    {!policy.isActive && <Chip label="미적용" size="small" />}
                                                </Stack>
                                            }
                                        />
                                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mr: 2 }}>
                                            {policy.addition > 0 && (
                                                <Typography variant="body2" color={policy.isActive ? "primary" : "text.disabled"}>
                                                    +{policy.addition.toLocaleString()}
                                                </Typography>
                                            )}
                                            {policy.deduction > 0 && (
                                                <Typography variant="body2" color={policy.isActive ? "error" : "text.disabled"}>
                                                    -{policy.deduction.toLocaleString()}
                                                </Typography>
                                            )}
                                        </Stack>
                                        <ListItemSecondaryAction>
                                            <IconButton edge="end" onClick={() => handleDeleteSpecial(policy.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                    <Divider />
                                </React.Fragment>
                            ))}
                            {specialPolicies.length === 0 && (
                                <Typography color="text.secondary" align="center" py={2}>
                                    등록된 별도정책이 없습니다.
                                </Typography>
                            )}
                        </List>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenSpecialModal(false)}>닫기</Button>
                    <Button variant="contained" onClick={() => handleSave('special')} disabled={saving}>
                        저장
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

export default PolicySettingsTab;
