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
    const [newAddon, setNewAddon] = useState({ name: '', fee: '', incentive: '', deduction: '' });

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
            try {
                setLoading(true);
                const carrier = getCurrentCarrier();
                const data = await directStoreApi.getPolicySettings(carrier);
                
                if (data.success) {
                    if (data.margin) {
                        setMargin(data.margin.baseMargin || 0);
                    }
                    if (data.addon?.list) {
                        setAddons(data.addon.list);
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
                deduction: Number(newAddon.deduction) || 0
            }]);
            setNewAddon({ name: '', fee: '', incentive: '', deduction: '' });
        }
    };

    // 부가서비스 삭제
    const handleDeleteAddon = (id) => {
        setAddons(addons.filter(item => item.id !== id));
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
        try {
            setSaving(true);
            const carrier = getCurrentCarrier();
            let settings = {};

            if (type === 'margin') {
                settings = { margin: { baseMargin: margin } };
            } else if (type === 'addon') {
                settings = { addon: { list: addons } };
            } else if (type === 'special') {
                settings = { special: { list: specialPolicies } };
            }

            await directStoreApi.savePolicySettings(carrier, settings);
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

    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
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
                        <Typography variant="h5" color="primary" sx={{ mt: 2, fontWeight: 'bold' }}>
                            {margin.toLocaleString()}원
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
                                        label="이름" size="small" fullWidth
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
                                    <Button variant="contained" fullWidth startIcon={<AddIcon />} onClick={handleAddAddon}>
                                        추가
                                    </Button>
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
                                            secondary={`월 ${addon.fee.toLocaleString()}원`}
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
                                            <IconButton edge="end" onClick={() => handleDeleteAddon(addon.id)}>
                                                <DeleteIcon />
                                            </IconButton>
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
