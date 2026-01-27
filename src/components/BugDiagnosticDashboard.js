/**
 * BugDiagnosticDashboard.js
 * 
 * 어플종합관리 모드의 버그관리 탭 컴포넌트입니다.
 * DataSourceDashboard와 동일한 구조(대리점/판매점/고객)로 모드별/탭별 진단을 제공합니다.
 * 
 * 기능:
 * - 개별 탭 진단 (▶ 버튼)
 * - 모드별 전체 진단 (모드 헤더의 버튼)
 * - 모든 모드 한번에 진단 (하단 전체 진단 버튼)
 * - 결과 복사 기능 (AI 디버깅 요청용)
 */

import React, { useState, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
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
import BugReportIcon from '@mui/icons-material/BugReport';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import PendingIcon from '@mui/icons-material/Pending';

// 상세 매핑 데이터 및 모드 설정 임포트
import { DATA_MAP_CONFIG } from '../config/dataMapConfig';
import { getModeTitle, getModeIcon, MODE_ORDER } from '../config/modeConfig';

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

/**
 * 버그 진단 결과 상태
 */
const DIAGNOSIS_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
};

/**
 * 개별 진단 실행 함수
 */
const runDiagnostic = async (modeKey, tabKey, tabData) => {
    const results = {
        modeKey,
        tabKey,
        tabLabel: tabData?.label || tabKey,
        status: DIAGNOSIS_STATUS.SUCCESS,
        logs: [],
        errors: [],
        warnings: [],
        timestamp: new Date().toISOString(),
    };

    try {
        // 1. API 엔드포인트 테스트
        if (tabData?.apiEndpoint) {
            try {
                const startTime = Date.now();
                const response = await fetch(`${API_BASE_URL}${tabData.apiEndpoint}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                const elapsed = Date.now() - startTime;

                if (response.ok) {
                    results.logs.push(`✅ API 연결 성공: ${tabData.apiEndpoint} (${elapsed}ms)`);

                    // 응답 데이터 검증
                    const data = await response.json();
                    if (data.success === false) {
                        results.warnings.push(`⚠️ API 응답 경고: ${data.error || data.message || '알 수 없는 오류'}`);
                        if (results.status === DIAGNOSIS_STATUS.SUCCESS) {
                            results.status = DIAGNOSIS_STATUS.WARNING;
                        }
                    } else {
                        results.logs.push(`✅ 데이터 정상 수신`);
                    }

                    // 느린 응답 경고
                    if (elapsed > 3000) {
                        results.warnings.push(`⚠️ 느린 응답 (${elapsed}ms) - 성능 최적화 필요`);
                        if (results.status === DIAGNOSIS_STATUS.SUCCESS) {
                            results.status = DIAGNOSIS_STATUS.WARNING;
                        }
                    }
                } else {
                    const errorText = await response.text().catch(() => '');
                    results.errors.push(`❌ API 오류 (${response.status}): ${errorText.slice(0, 200)}`);
                    results.status = DIAGNOSIS_STATUS.ERROR;
                }
            } catch (apiError) {
                results.errors.push(`❌ API 연결 실패: ${apiError.message}`);
                results.status = DIAGNOSIS_STATUS.ERROR;
            }
        } else {
            results.logs.push(`ℹ️ API 엔드포인트 미설정 - 테스트 건너뜀`);
        }

        // 2. Supabase 테이블 존재 여부 확인
        if (tabData?.supabaseTable) {
            try {
                const tableResponse = await fetch(`${API_BASE_URL}/api/db/tables/status`);
                if (tableResponse.ok) {
                    const tableResult = await tableResponse.json();
                    if (tableResult.success && tableResult.data) {
                        if (tableResult.data[tabData.supabaseTable]) {
                            results.logs.push(`✅ Supabase 테이블 존재: ${tabData.supabaseTable}`);
                        } else {
                            results.warnings.push(`⚠️ Supabase 테이블 미생성: ${tabData.supabaseTable}`);
                            if (results.status === DIAGNOSIS_STATUS.SUCCESS) {
                                results.status = DIAGNOSIS_STATUS.WARNING;
                            }
                        }
                    }
                }
            } catch (tableError) {
                results.warnings.push(`⚠️ 테이블 상태 확인 실패: ${tableError.message}`);
            }
        }

        // 3. Google Sheets 연동 확인 (sheet 정보가 있는 경우)
        if (tabData?.sheet) {
            results.logs.push(`ℹ️ Google Sheets 매핑: ${tabData.sheet}`);
        }

    } catch (error) {
        results.errors.push(`❌ 진단 중 예외 발생: ${error.message}`);
        results.status = DIAGNOSIS_STATUS.ERROR;
    }

    return results;
};

const BugDiagnosticDashboard = () => {
    const [diagnosing, setDiagnosing] = useState(false);
    const [diagnosingAll, setDiagnosingAll] = useState(false);
    const [diagnosisResults, setDiagnosisResults] = useState({});
    const [expandedModes, setExpandedModes] = useState({});
    const [currentTab, setCurrentTab] = useState(0);
    const [selectedResult, setSelectedResult] = useState(null);
    const [openResultDialog, setOpenResultDialog] = useState(false);

    // 모드 그룹 정의 (DataSourceDashboard와 동일)
    const DEALER_MODES = ['basicMode', 'directStore', 'onSaleReception', 'generalPolicy'];
    const CUSTOMER_MODES = ['customerMode'];

    const getGroupedModes = () => {
        const dealer = MODE_ORDER.filter(m => DEALER_MODES.includes(m));
        const customer = MODE_ORDER.filter(m => CUSTOMER_MODES.includes(m));
        const agency = MODE_ORDER.filter(m => !DEALER_MODES.includes(m) && !CUSTOMER_MODES.includes(m));
        return { agency, dealer, customer };
    };

    const groupedModes = getGroupedModes();

    // 진단 통계 계산
    const getStats = () => {
        const results = Object.values(diagnosisResults);
        const total = results.length;
        const success = results.filter(r => r.status === DIAGNOSIS_STATUS.SUCCESS).length;
        const warning = results.filter(r => r.status === DIAGNOSIS_STATUS.WARNING).length;
        const error = results.filter(r => r.status === DIAGNOSIS_STATUS.ERROR).length;
        return { total, success, warning, error };
    };

    const stats = getStats();

    // 개별 탭 진단 실행
    const handleDiagnoseTab = useCallback(async (modeKey, tabKey, tabData) => {
        const resultKey = `${modeKey}_${tabKey}`;

        // 진단 시작 상태
        setDiagnosisResults(prev => ({
            ...prev,
            [resultKey]: {
                ...prev[resultKey],
                status: DIAGNOSIS_STATUS.RUNNING,
            }
        }));

        const result = await runDiagnostic(modeKey, tabKey, tabData);

        // 버그관리 탭인 경우, 실제 수집된 에러 로그를 백엔드에서 조회하여 추가
        if (tabKey === 'bugs' && result.status === DIAGNOSIS_STATUS.SUCCESS) {
            try {
                // 최근 에러 20개 조회
                const logsResponse = await fetch(`${API_BASE_URL}/api/errors?limit=20`);
                if (logsResponse.ok) {
                    const logsData = await logsResponse.json();
                    if (logsData.success && logsData.data) {
                        result.logs.push('✅ 최신 에러 로그 조회 성공');

                        // 조회된 에러를 결과의 errors/warnings 배열에 추가
                        logsData.data.forEach(log => {
                            const timestamp = new Date(log.created_at).toLocaleTimeString();
                            const logMsg = `[${timestamp}] [${log.type.toUpperCase()}] ${log.message}`;

                            if (log.level === 'error') {
                                result.errors.push(logMsg);
                            } else {
                                result.warnings.push(logMsg);
                            }
                        });

                        // 통계 정보
                        result.logs.push(`📊 수집된 에러: ${logsData.data.length} 건 (최근 20개 표시)`);
                    }
                }
            } catch (e) {
                result.logs.push(`⚠️ 에러 로그 조회 실패: ${e.message}`);
            }
        }

        setDiagnosisResults(prev => ({
            ...prev,
            [resultKey]: result
        }));

        return result;
    }, []);

    // 개별 모드 전체 진단
    const handleDiagnoseMode = useCallback(async (modeKey) => {
        const modeData = DATA_MAP_CONFIG[modeKey];
        if (!modeData?.tabs) return;

        setDiagnosing(true);

        for (const [tabKey, tabData] of Object.entries(modeData.tabs)) {
            await handleDiagnoseTab(modeKey, tabKey, tabData);
        }

        setDiagnosing(false);
    }, [handleDiagnoseTab]);

    // 모든 모드 진단
    const handleDiagnoseAll = useCallback(async () => {
        if (!window.confirm('모든 모드의 버그 진단을 실행하시겠습니까?\n(수 분이 소요될 수 있습니다.)')) {
            return;
        }

        setDiagnosingAll(true);
        setDiagnosisResults({});

        for (const modeKey of MODE_ORDER) {
            const modeData = DATA_MAP_CONFIG[modeKey];
            if (!modeData?.tabs) continue;

            for (const [tabKey, tabData] of Object.entries(modeData.tabs)) {
                await handleDiagnoseTab(modeKey, tabKey, tabData);
            }
        }

        setDiagnosingAll(false);
    }, [handleDiagnoseTab]);

    // 결과 복사
    const handleCopyResult = useCallback((result) => {
        const formattedResult = `
=== 버그 진단 결과 ===
모드: ${getModeTitle(result.modeKey)}
탭: ${result.tabLabel} (${result.tabKey})
상태: ${result.status}
시간: ${result.timestamp}

--- 로그 ---
${result.logs?.join('\n') || '없음'}

--- 경고 ---
${result.warnings?.length > 0 ? result.warnings.join('\n') : '없음'}

--- 에러 ---
${result.errors?.length > 0 ? result.errors.join('\n') : '없음'}
==================
`.trim();

        navigator.clipboard.writeText(formattedResult).then(() => {
            alert('진단 결과가 클립보드에 복사되었습니다.\nAI에게 붙여넣기하여 디버깅을 요청하세요.');
        }).catch(err => {
            console.error('복사 실패:', err);
            alert('복사에 실패했습니다. 수동으로 복사해주세요.');
        });
    }, []);

    // 모든 결과 복사
    const handleCopyAllResults = useCallback(() => {
        const allResults = Object.values(diagnosisResults);
        if (allResults.length === 0) {
            alert('진단 결과가 없습니다. 먼저 진단을 실행해주세요.');
            return;
        }

        const errorResults = allResults.filter(r => r.status === DIAGNOSIS_STATUS.ERROR || r.status === DIAGNOSIS_STATUS.WARNING);

        const formattedResults = (errorResults.length > 0 ? errorResults : allResults).map(result => `
[${getModeTitle(result.modeKey)}/${result.tabLabel}] ${result.status.toUpperCase()}
${result.errors?.length > 0 ? result.errors.join('\n') : ''}
${result.warnings?.length > 0 ? result.warnings.join('\n') : ''}
`.trim()).filter(r => r.length > 50).join('\n\n');

        const summary = `
=== 버그 진단 전체 결과 ===
진단 시간: ${new Date().toISOString()}
총 진단: ${stats.total}개
성공: ${stats.success}개
경고: ${stats.warning}개
에러: ${stats.error}개

${formattedResults || '모든 항목이 정상입니다.'}
==================
`.trim();

        navigator.clipboard.writeText(summary).then(() => {
            alert('전체 진단 결과가 클립보드에 복사되었습니다.\nAI에게 붙여넣기하여 디버깅을 요청하세요.');
        });
    }, [diagnosisResults, stats]);

    // 결과 상세 보기
    const handleViewDetail = useCallback((result) => {
        setSelectedResult(result);
        setOpenResultDialog(true);
    }, []);

    const handleExpandMode = (modeKey) => {
        setExpandedModes(prev => ({ ...prev, [modeKey]: !prev[modeKey] }));
    };

    const handleTabChange = (_event, newValue) => {
        setCurrentTab(newValue);
    };

    // 결과 초기화
    const handleReset = () => {
        setDiagnosisResults({});
    };

    // 상태 아이콘 렌더링
    const renderStatusIcon = (status) => {
        switch (status) {
            case DIAGNOSIS_STATUS.SUCCESS:
                return <CheckCircleIcon color="success" fontSize="small" />;
            case DIAGNOSIS_STATUS.WARNING:
                return <WarningAmberIcon color="warning" fontSize="small" />;
            case DIAGNOSIS_STATUS.ERROR:
                return <ErrorOutlineIcon color="error" fontSize="small" />;
            case DIAGNOSIS_STATUS.RUNNING:
                return <CircularProgress size={18} />;
            default:
                return <PendingIcon color="disabled" fontSize="small" />;
        }
    };

    const isRunning = diagnosing || diagnosingAll;

    return (
        <Box>
            {/* 헤더 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <BugReportIcon sx={{ fontSize: 32, color: 'error.main' }} />
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        버그 진단 및 관리 대시보드
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="전체 결과 복사 (에러/경고만)">
                        <IconButton
                            onClick={handleCopyAllResults}
                            size="small"
                            disabled={Object.keys(diagnosisResults).length === 0}
                        >
                            <ContentCopyIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="결과 초기화">
                        <IconButton onClick={handleReset} size="small" disabled={isRunning}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <Grid container spacing={3}>
                {/* 진단 통계 및 사용 안내 */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: '#f8f9fa' }}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">진단 현황</Typography>
                        <Divider sx={{ mb: 2 }} />

                        {stats.total > 0 ? (
                            <>
                                <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="h4" color="success.main">{stats.success}</Typography>
                                        <Typography variant="caption" color="text.secondary">성공</Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="h4" color="warning.main">{stats.warning}</Typography>
                                        <Typography variant="caption" color="text.secondary">경고</Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="h4" color="error.main">{stats.error}</Typography>
                                        <Typography variant="caption" color="text.secondary">에러</Typography>
                                    </Box>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={(stats.success / stats.total) * 100}
                                    color={stats.error > 0 ? 'error' : stats.warning > 0 ? 'warning' : 'success'}
                                    sx={{ height: 8, borderRadius: 4 }}
                                />
                            </>
                        ) : (
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    진단을 실행해주세요
                                </Typography>
                            </Box>
                        )}
                    </Paper>

                    <Paper sx={{ p: 2, borderRadius: 2, bgcolor: '#fff3e0' }}>
                        <Typography variant="subtitle2" gutterBottom color="warning.dark">📋 사용 안내</Typography>
                        <Divider sx={{ mb: 1.5 }} />
                        <Typography variant="body2" color="text.secondary" component="div">
                            <ol style={{ margin: 0, paddingLeft: 16 }}>
                                <li><b>개별 진단</b>: 각 탭의 ▶ 버튼으로 해당 탭만 진단</li>
                                <li><b>모드별 진단</b>: 모드명 옆 ▶▶ 버튼으로 해당 모드 전체 진단</li>
                                <li><b>전체 진단</b>: 아래 버튼으로 모든 모드 한 번에 진단</li>
                                <li>에러 발생 시 <b>📋 복사 버튼</b>을 눌러 AI에게 디버깅 요청</li>
                            </ol>
                        </Typography>
                    </Paper>
                </Grid>

                {/* 모드-탭별 버그관리 트리 */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        <Box sx={{ bgcolor: '#ffebee', borderBottom: '1px solid #e0e0e0' }}>
                            <Box sx={{ px: 2, py: 1.5 }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    <FolderIcon sx={{ mr: 1, fontSize: 20, verticalAlign: 'text-bottom' }} />
                                    모든 모드-탭별 버그관리
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

                        <Box sx={{ p: 0, maxHeight: 500, overflow: 'auto' }}>
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

                                    // 현재 모드의 진단 결과 통계
                                    const modeResults = hasTabs ? Object.keys(modeData.tabs).map(tabKey =>
                                        diagnosisResults[`${modeKey}_${tabKey}`]
                                    ).filter(Boolean) : [];
                                    const modeHasError = modeResults.some(r => r?.status === DIAGNOSIS_STATUS.ERROR);
                                    const modeHasWarning = modeResults.some(r => r?.status === DIAGNOSIS_STATUS.WARNING);

                                    return (
                                        <Accordion
                                            key={modeKey}
                                            expanded={expandedModes[modeKey] || false}
                                            onChange={() => handleExpandMode(modeKey)}
                                            sx={{
                                                '&:before': { display: 'none' },
                                                boxShadow: 'none',
                                                borderBottom: '1px solid #eee',
                                                opacity: hasTabs ? 1 : 0.6,
                                                bgcolor: modeHasError ? '#ffebee' : modeHasWarning ? '#fff8e1' : 'transparent'
                                            }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                                    <ModeIcon color={modeHasError ? "error" : modeHasWarning ? "warning" : hasTabs ? "primary" : "disabled"} />
                                                    <Typography variant="subtitle1" fontWeight="bold">{modeTitle}</Typography>
                                                    <Box sx={{ flexGrow: 1 }} />
                                                    {hasTabs && (
                                                        <>
                                                            <Chip
                                                                label={`${Object.keys(modeData.tabs).length}개 탭`}
                                                                size="small"
                                                                color={modeHasError ? "error" : modeHasWarning ? "warning" : "default"}
                                                                variant="outlined"
                                                                sx={{ height: 20 }}
                                                            />
                                                            <Tooltip title="이 모드 전체 진단">
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDiagnoseMode(modeKey);
                                                                    }}
                                                                    disabled={isRunning}
                                                                >
                                                                    <PlaylistPlayIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </>
                                                    )}
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ bgcolor: '#fafafa', p: 0 }}>
                                                {hasTabs ? (
                                                    <List dense sx={{ py: 0 }}>
                                                        {Object.entries(modeData.tabs).map(([tabKey, tabData]) => {
                                                            const resultKey = `${modeKey}_${tabKey}`;
                                                            const result = diagnosisResults[resultKey];

                                                            return (
                                                                <ListItem
                                                                    key={tabKey}
                                                                    sx={{
                                                                        pl: 6,
                                                                        py: 1.5,
                                                                        borderBottom: '1px solid #f0f0f0',
                                                                        '&:last-child': { borderBottom: 'none' },
                                                                        bgcolor: result?.status === DIAGNOSIS_STATUS.ERROR ? '#ffebee' :
                                                                            result?.status === DIAGNOSIS_STATUS.WARNING ? '#fff8e1' :
                                                                                result?.status === DIAGNOSIS_STATUS.SUCCESS ? '#e8f5e9' :
                                                                                    'transparent'
                                                                    }}
                                                                >
                                                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                                                        {renderStatusIcon(result?.status)}
                                                                    </ListItemIcon>
                                                                    <ListItemText
                                                                        primary={
                                                                            <Typography variant="body1" fontWeight="medium">
                                                                                {tabData.label}
                                                                            </Typography>
                                                                        }
                                                                        secondary={
                                                                            result ? (
                                                                                <Typography variant="caption" color={
                                                                                    result.status === DIAGNOSIS_STATUS.ERROR ? 'error' :
                                                                                        result.status === DIAGNOSIS_STATUS.WARNING ? 'warning.dark' :
                                                                                            'success.main'
                                                                                } sx={{
                                                                                    display: 'block',
                                                                                    maxWidth: 250,
                                                                                    overflow: 'hidden',
                                                                                    textOverflow: 'ellipsis',
                                                                                    whiteSpace: 'nowrap'
                                                                                }}>
                                                                                    {result.errors?.length > 0 ? result.errors[0] :
                                                                                        result.warnings?.length > 0 ? result.warnings[0] :
                                                                                            '✅ 정상'}
                                                                                </Typography>
                                                                            ) : (
                                                                                <Typography variant="caption" color="text.secondary">
                                                                                    진단 대기 중
                                                                                </Typography>
                                                                            )
                                                                        }
                                                                    />
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                        {result && (
                                                                            <>
                                                                                <Tooltip title="상세 보기">
                                                                                    <IconButton
                                                                                        size="small"
                                                                                        onClick={() => handleViewDetail(result)}
                                                                                    >
                                                                                        <BugReportIcon fontSize="small" />
                                                                                    </IconButton>
                                                                                </Tooltip>
                                                                                <Tooltip title="결과 복사">
                                                                                    <IconButton
                                                                                        size="small"
                                                                                        onClick={() => handleCopyResult(result)}
                                                                                    >
                                                                                        <ContentCopyIcon fontSize="small" />
                                                                                    </IconButton>
                                                                                </Tooltip>
                                                                            </>
                                                                        )}
                                                                        <Tooltip title="진단 실행">
                                                                            <IconButton
                                                                                size="small"
                                                                                color="error"
                                                                                onClick={() => handleDiagnoseTab(modeKey, tabKey, tabData)}
                                                                                disabled={isRunning}
                                                                            >
                                                                                <PlayArrowIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </Box>
                                                                </ListItem>
                                                            );
                                                        })}
                                                    </List>
                                                ) : (
                                                    <Box sx={{ p: 2, textAlign: 'center' }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            이 모드에 대한 설정(`dataMapConfig.js`)이 존재하지 않습니다.
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

                {/* 전체 진단 버튼 */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: '#ffebee' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {diagnosingAll ? <CircularProgress size={24} color="error" /> : <BugReportIcon color="error" />}
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">전체 버그 진단 (모든 모드 한번에)</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        모든 모드의 모든 탭에 대해 API 연결, 데이터 로딩, 테이블 상태 등을 일괄 진단합니다.
                                    </Typography>
                                </Box>
                            </Box>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<PlaylistPlayIcon />}
                                onClick={handleDiagnoseAll}
                                disabled={isRunning}
                            >
                                {diagnosingAll ? '진단 중...' : '모든 모드 진단 실행'}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* 진단 결과 상세 다이얼로그 */}
            <Dialog
                open={openResultDialog}
                onClose={() => setOpenResultDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {selectedResult && renderStatusIcon(selectedResult.status)}
                    진단 결과 상세
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title="결과 복사">
                        <IconButton
                            size="small"
                            onClick={() => selectedResult && handleCopyResult(selectedResult)}
                        >
                            <ContentCopyIcon />
                        </IconButton>
                    </Tooltip>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedResult && (
                        <Box>
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" color="text.secondary">모드 / 탭</Typography>
                                <Typography variant="body1" fontWeight="bold">
                                    {getModeTitle(selectedResult.modeKey)} / {selectedResult.tabLabel}
                                </Typography>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            {/* 로그 */}
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>로그</Typography>
                            <Paper sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2, maxHeight: 150, overflow: 'auto' }}>
                                {selectedResult.logs.length > 0 ? (
                                    selectedResult.logs.map((log, idx) => (
                                        <Typography key={idx} variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {log}
                                        </Typography>
                                    ))
                                ) : (
                                    <Typography variant="body2" color="text.secondary">로그 없음</Typography>
                                )}
                            </Paper>

                            {/* 경고 */}
                            {selectedResult.warnings.length > 0 && (
                                <>
                                    <Typography variant="subtitle2" color="warning.dark" gutterBottom>경고</Typography>
                                    <Paper sx={{ p: 2, bgcolor: '#fff8e1', mb: 2, maxHeight: 150, overflow: 'auto' }}>
                                        {selectedResult.warnings.map((warn, idx) => (
                                            <Typography key={idx} variant="body2" sx={{ fontFamily: 'monospace', color: 'warning.dark' }}>
                                                {warn}
                                            </Typography>
                                        ))}
                                    </Paper>
                                </>
                            )}

                            {/* 에러 */}
                            {selectedResult.errors.length > 0 && (
                                <>
                                    <Typography variant="subtitle2" color="error" gutterBottom>에러</Typography>
                                    <Paper sx={{ p: 2, bgcolor: '#ffebee', maxHeight: 200, overflow: 'auto' }}>
                                        {selectedResult.errors.map((err, idx) => (
                                            <Typography key={idx} variant="body2" sx={{ fontFamily: 'monospace', color: 'error.main' }}>
                                                {err}
                                            </Typography>
                                        ))}
                                    </Paper>
                                </>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => selectedResult && handleCopyResult(selectedResult)}
                        startIcon={<ContentCopyIcon />}
                    >
                        결과 복사 (AI에게 붙여넣기)
                    </Button>
                    <Button onClick={() => setOpenResultDialog(false)} color="primary">
                        닫기
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default BugDiagnosticDashboard;
