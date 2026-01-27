import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Switch,
    Alert,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
    Button,
    Chip,
    IconButton,
    Tooltip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import WarningIcon from '@mui/icons-material/Warning';
import BuildIcon from '@mui/icons-material/Build';
import CloudIcon from '@mui/icons-material/Cloud';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';

// 상세 매핑 데이터 및 모드 설정 임포트
import { DATA_MAP_CONFIG } from '../config/dataMapConfig';
import { getModeTitle, getModeIcon, MODE_ORDER } from '../config/modeConfig';

const DataSourceDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [flags, setFlags] = useState({});
    const [status, setStatus] = useState({ database: false, googleSheets: false });
    const [tableStatus, setTableStatus] = useState({});
    const [error, setError] = useState(null);
    const [expandedModes, setExpandedModes] = useState({});
    const [currentTab, setCurrentTab] = useState(0);

    // 모드 그룹 정의
    const DEALER_MODES = ['basicMode', 'directStore', 'onSaleReception', 'generalPolicy'];
    const CUSTOMER_MODES = ['customerMode'];

    const getGroupedModes = () => {
        const dealer = MODE_ORDER.filter(m => DEALER_MODES.includes(m));
        const customer = MODE_ORDER.filter(m => CUSTOMER_MODES.includes(m));
        const agency = MODE_ORDER.filter(m => !DEALER_MODES.includes(m) && !CUSTOMER_MODES.includes(m));
        return { agency, dealer, customer };
    };

    const groupedModes = getGroupedModes();

    // 동기화 결과 관련 상태
    const [syncResult, setSyncResult] = useState(null);
    const [openResultDialog, setOpenResultDialog] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Feature Flags 및 시스템 상태 조회
            const flagResponse = await fetch('/api/db/flags');
            if (!flagResponse.ok) {
                const text = await flagResponse.text();
                throw new Error(`Flags API 오류 (${flagResponse.status}): ${text.slice(0, 100)}`);
            }
            const flagResult = await flagResponse.json();

            // 2. Supabase 테이블 존재 여부 조회
            const tableResponse = await fetch('/api/db/tables/status');
            if (!tableResponse.ok) {
                const text = await tableResponse.text();
                throw new Error(`Tables API 오류 (${tableResponse.status}): ${text.slice(0, 100)}`);
            }
            const tableResult = await tableResponse.json();

            if (flagResult.success) {
                setFlags(flagResult.data.flags);
                setStatus(flagResult.data.status);
            }

            if (tableResult.success) {
                setTableStatus(tableResult.data);
            }
        } catch (err) {
            console.error('[DataSourceDashboard] Fetch Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleToggle = async (key, currentEnabled) => {
        try {
            const response = await fetch('/api/db/flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, enabled: !currentEnabled }),
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`설정 변경 실패 (${response.status}): ${text.slice(0, 100)}`);
            }
            const result = await response.json();
            if (result.success) {
                setFlags(result.data);
            }
        } catch (err) {
            alert('설정 변경 실패: ' + err.message);
        }
    };

    const handleSmartSync = async () => {
        if (!window.confirm('모든 시트의 변경사항을 스캔하여 수파베이스에 동기화하시겠습니까?\n(데이터 량에 따라 수 분이 소요될 수 있습니다.)')) {
            return;
        }

        setSyncing(true);
        try {
            const response = await fetch('/api/db/sync/smart', { method: 'POST' });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`동기화 실패 (${response.status}): ${text.slice(0, 100)}`);
            }
            const result = await response.json();
            if (result.success) {
                setSyncResult(result.summary);
                setOpenResultDialog(true);
                fetchData(); // 상태 새로고침
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            alert('동기화 실패: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const handleExpandMode = (modeKey) => {
        setExpandedModes(prev => ({ ...prev, [modeKey]: !prev[modeKey] }));
    };

    // 마이그레이션 통계 계산
    const getStats = () => {
        let total = 0;
        let implemented = 0;
        Object.values(DATA_MAP_CONFIG).forEach(mode => {
            Object.values(mode.tabs).forEach(tab => {
                total++;
                if (tableStatus[tab.supabaseTable]) implemented++;
            });
        });
        return { total, implemented, percentage: total > 0 ? Math.round((implemented / total) * 100) : 0 };
    };

    const handleTabChange = (_event, newValue) => {
        setCurrentTab(newValue);
    };

    const stats = getStats();

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

    return (
        <Box>
            {/* 헤더 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <StorageIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        데이터베이스 정밀 제어 대시보드
                    </Typography>
                </Box>
                <IconButton onClick={fetchData} size="small" disabled={syncing}>
                    <RefreshIcon />
                </IconButton>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Grid container spacing={3}>
                {/* 시스템 연결 상태 및 통계 */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: '#f8f9fa' }}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">시스템 연결 상태</Typography>
                        <Divider sx={{ mb: 2 }} />
                        <List dense>
                            <ListItem>
                                <ListItemIcon>
                                    {status.googleSheets ? <CloudIcon color="success" /> : <CloudOffIcon color="disabled" />}
                                </ListItemIcon>
                                <ListItemText primary="Google Sheets API" secondary={status.googleSheets ? '연결됨' : '연결 안됨'} />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon>
                                    {status.database ? <StorageIcon color="primary" /> : <CloudOffIcon color="disabled" />}
                                </ListItemIcon>
                                <ListItemText primary="Supabase Database" secondary={status.database ? '연결됨' : '연결 안됨'} />
                            </ListItem>
                        </List>

                        <Box sx={{ mt: 2, p: 2, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary">Supabase 테이블 생성 현황</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={stats.percentage}
                                    sx={{ flex: 1, height: 8, borderRadius: 4 }}
                                />
                                <Typography variant="body2" fontWeight="bold">{stats.percentage}%</Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                {stats.implemented} / {stats.total} 테이블 생성됨
                            </Typography>
                        </Box>
                    </Paper>

                    <Paper sx={{ p: 2, borderRadius: 2, bgcolor: '#fff4e5' }}>
                        <Typography variant="subtitle2" gutterBottom color="orange">마이그레이션 안내</Typography>
                        <Divider sx={{ mb: 1.5 }} />
                        <Typography variant="body2" color="text.secondary">
                            1. 구글 시트 기반에서 수파베이스로 데이터를 옮길 수 있습니다.<br />
                            2. <b>빨간색 느낌표</b>가 뜨는 곳은 테이블이 아직 없습니다.<br />
                            3. AI에게 <b>"시트 [이름]의 스키마를 생성해줘"</b>라고 요청하세요.
                        </Typography>
                    </Paper>
                </Grid>

                {/* 동적 모드-탭 트리 트리 */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        <Box sx={{ bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                            <Box sx={{ px: 2, py: 1.5 }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    <FolderIcon sx={{ mr: 1, fontSize: 20, verticalAlign: 'text-bottom' }} />
                                    모든 모드-탭별 데이터 소스 관리
                                </Typography>
                            </Box>

                            <Tabs
                                value={currentTab}
                                onChange={handleTabChange}
                                variant="fullWidth"
                                sx={{
                                    minHeight: 40,
                                    '& .MuiTab-root': { py: 1, minHeight: 40 }
                                }}
                            >
                                <Tab icon={<BusinessCenterIcon sx={{ fontSize: '1rem' }} />} iconPosition="start" label="대리점" />
                                <Tab icon={<StorefrontIcon sx={{ fontSize: '1rem' }} />} iconPosition="start" label="판매점" />
                                <Tab icon={<PersonIcon sx={{ fontSize: '1rem' }} />} iconPosition="start" label="고객" />
                            </Tabs>
                        </Box>

                        <Box sx={{ p: 0 }}>
                            {(() => {
                                const activeModes =
                                    currentTab === 0 ? groupedModes.agency :
                                        currentTab === 1 ? groupedModes.dealer :
                                            groupedModes.customer;

                                if (activeModes.length === 0) {
                                    return (
                                        <Box sx={{ p: 4, textAlign: 'center' }}>
                                            <Typography color="text.secondary">표시할 모드가 없습니다.</Typography>
                                        </Box>
                                    );
                                }

                                return activeModes.map((modeKey) => {
                                    const modeData = DATA_MAP_CONFIG[modeKey];
                                    const ModeIcon = getModeIcon(modeKey);
                                    const modeTitle = getModeTitle(modeKey);
                                    const hasTabs = modeData && modeData.tabs && Object.keys(modeData.tabs).length > 0;
                                    const isDisabled = modeData?.disabled === true;
                                    const isActive = hasTabs && !isDisabled;

                                    return (
                                        <Accordion
                                            key={modeKey}
                                            expanded={expandedModes[modeKey] || false}
                                            onChange={() => handleExpandMode(modeKey)}
                                            sx={{
                                                '&:before': { display: 'none' },
                                                boxShadow: 'none',
                                                borderBottom: '1px solid #eee',
                                                opacity: isActive ? 1 : 0.5
                                            }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                                    <ModeIcon color={isActive ? "primary" : "disabled"} />
                                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ color: isActive ? 'text.primary' : 'text.disabled' }}>{modeTitle}</Typography>
                                                    <Box sx={{ flexGrow: 1 }} />
                                                    {isDisabled ? (
                                                        <Chip
                                                            label="시트 미확인"
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ height: 20, color: 'text.disabled', borderColor: '#ccc', bgcolor: '#f5f5f5' }}
                                                        />
                                                    ) : hasTabs ? (
                                                        <Chip
                                                            label={`${Object.keys(modeData.tabs).length}개 탭`}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                            sx={{ height: 20 }}
                                                        />
                                                    ) : (
                                                        <Chip
                                                            label="DB 미연동"
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ height: 20, color: 'text.disabled', borderColor: '#eee' }}
                                                        />
                                                    )}
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ bgcolor: '#fafafa', p: 0 }}>
                                                {hasTabs ? (
                                                    <List dense sx={{ py: 0 }}>
                                                        {Object.entries(modeData.tabs).map(([tabKey, tabData]) => {
                                                            const flagKey = `${modeKey}:${tabKey}`;
                                                            const isEnabled = flags[flagKey] || (flags[modeKey] && flags[flagKey] === undefined);
                                                            const isTableExists = tableStatus[tabData.supabaseTable] || false;

                                                            return (
                                                                <ListItem
                                                                    key={tabKey}
                                                                    sx={{
                                                                        pl: 6,
                                                                        py: 1.5,
                                                                        borderBottom: '1px solid #f0f0f0',
                                                                        '&:last-child': { borderBottom: 'none' }
                                                                    }}
                                                                >
                                                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                                                        {isTableExists ?
                                                                            <CheckCircleIcon color="success" fontSize="small" /> :
                                                                            <ErrorOutlineIcon color="error" fontSize="small" />
                                                                        }
                                                                    </ListItemIcon>
                                                                    <ListItemText
                                                                        primary={
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                <Typography variant="body1" fontWeight="medium">{tabData.label}</Typography>
                                                                                <Chip
                                                                                    label={tabData.sheet}
                                                                                    size="small"
                                                                                    sx={{ height: 20, fontSize: '0.75rem', bgcolor: '#e8f5e9' }}
                                                                                />
                                                                            </Box>
                                                                        }
                                                                        secondary={
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                Supabase Table: {tabData.supabaseTable}
                                                                            </Typography>
                                                                        }
                                                                    />
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Typography variant="caption" color={isEnabled ? "primary" : "success"}>
                                                                            {isEnabled ? "Supabase" : "G-Sheets"}
                                                                        </Typography>
                                                                        <Tooltip title={isTableExists ? "데이터 소스 전환" : "테이블이 없어 전환할 수 없습니다."}>
                                                                            <span>
                                                                                <Switch
                                                                                    checked={isEnabled}
                                                                                    onChange={() => handleToggle(flagKey, isEnabled)}
                                                                                    disabled={!isTableExists && !isEnabled}
                                                                                    size="small"
                                                                                />
                                                                            </span>
                                                                        </Tooltip>
                                                                    </Box>
                                                                </ListItem>
                                                            );
                                                        })}
                                                    </List>
                                                ) : (
                                                    <Box sx={{ p: 2, textAlign: 'center' }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            이 모드에 대한 데이터베이스 매핑 설정(`dataMapConfig.js`)이 존재하지 않습니다.
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                });
                            })()}
                        </Box>
                    </Paper>
                </Grid>

                {/* 스마트 마이그레이션 도구 */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: '#e8f5e9' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {syncing ? <CircularProgress size={24} color="success" /> : <SyncIcon color="success" />}
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">지능형 데이터 동기화 (Smart Sync)</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        모든 시트를 스캔하여 변경사항이 있는 항목만 선택적으로 수파베이스에 업데이트합니다.
                                    </Typography>
                                </Box>
                            </Box>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<SyncIcon />}
                                onClick={handleSmartSync}
                                disabled={syncing}
                            >
                                {syncing ? '동기화 중...' : '마법사 실행'}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* 마이그레이션 결과 다이얼로그 */}
            <Dialog open={openResultDialog} onClose={() => setOpenResultDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon color="success" />
                    마이그레이션 완료 보고
                </DialogTitle>
                <DialogContent dividers>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        총 {syncResult?.totalUpdated}개 시트가 업데이트되었습니다.
                    </Typography>
                    <List dense>
                        {syncResult?.details.map((detail, idx) => (
                            <ListItem key={idx}>
                                <ListItemIcon>
                                    {detail.status === 'updated' ? <SyncIcon color="primary" fontSize="small" /> :
                                        detail.status === 'error' ? <WarningIcon color="error" fontSize="small" /> :
                                            <CheckCircleIcon color="disabled" fontSize="small" />}
                                </ListItemIcon>
                                <ListItemText
                                    primary={detail.tab}
                                    secondary={`${detail.sheet} - ${detail.status === 'updated' ? `${detail.count}건 업데이트됨` :
                                        detail.status === 'error' ? `오류: ${detail.error}` : '변경사항 없음'}`}
                                    secondaryTypographyProps={{ color: detail.status === 'error' ? 'error' : 'text.secondary' }}
                                />
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenResultDialog(false)} color="primary">확인</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DataSourceDashboard;
