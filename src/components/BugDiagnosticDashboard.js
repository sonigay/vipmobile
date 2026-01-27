/**
 * BugDiagnosticDashboard.js
 * 
 * 어플종합관리 모드의 버그관리 탭 컴포넌트입니다.
 * 모드별/탭별 원클릭 진단 버튼과 한 줄 에러 메시지 진단 로직을 제공합니다.
 */

import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Button,
    Alert,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Chip,
    Divider,
    IconButton,
    Tooltip,
    Collapse,
    LinearProgress,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import StorageIcon from '@mui/icons-material/Storage';
import ApiIcon from '@mui/icons-material/Api';

/**
 * 각 엔드포인트에 대한 진단 설정
 * - path: API 엔드포인트
 * - method: HTTP 메소드
 * - category: 분류 (모드/탭)
 * - expected: 예상되는 성공 조건 (response 체크)
 */
const DIAGNOSTIC_ENDPOINTS = [
    // 퀵서비스 관리
    { path: '/api/quick-cost/companies', method: 'GET', category: '퀵서비스', feature: '업체 목록', critical: true },
    { path: '/api/quick-cost/history?limit=1', method: 'GET', category: '퀵서비스', feature: '이력 조회', critical: true },

    // 직영점 모드
    { path: '/api/db/flags', method: 'GET', category: '데이터베이스', feature: 'Feature Flags', critical: true },

    // 공통 시스템
    { path: '/api/stores', method: 'GET', category: '공통', feature: '매장 목록', critical: true },
    { path: '/health', method: 'GET', category: '시스템', feature: '서버 상태', critical: true },
];

// 진단 결과 상태 타입
const DIAGNOSTIC_STATUS = {
    IDLE: 'idle',
    RUNNING: 'running',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
};

// 상태에 따른 UI 맵핑
const statusConfig = {
    [DIAGNOSTIC_STATUS.IDLE]: { icon: <BugReportIcon />, color: 'default', label: '대기 중' },
    [DIAGNOSTIC_STATUS.RUNNING]: { icon: <CircularProgress size={20} />, color: 'info', label: '진단 중...' },
    [DIAGNOSTIC_STATUS.SUCCESS]: { icon: <CheckCircleIcon />, color: 'success', label: '정상' },
    [DIAGNOSTIC_STATUS.WARNING]: { icon: <WarningIcon />, color: 'warning', label: '주의' },
    [DIAGNOSTIC_STATUS.ERROR]: { icon: <ErrorIcon />, color: 'error', label: '오류' },
};

const BugDiagnosticDashboard = () => {
    const [diagnostics, setDiagnostics] = useState(
        DIAGNOSTIC_ENDPOINTS.map((ep) => ({
            ...ep,
            status: DIAGNOSTIC_STATUS.IDLE,
            message: '',
            responseTime: null,
            expanded: false,
        }))
    );
    const [overallStatus, setOverallStatus] = useState(DIAGNOSTIC_STATUS.IDLE);
    const [isRunning, setIsRunning] = useState(false);
    const [lastRun, setLastRun] = useState(null);

    /**
     * 단일 엔드포인트 진단 실행
     */
    const runSingleDiagnostic = async (endpoint, index) => {
        const startTime = Date.now();

        setDiagnostics((prev) =>
            prev.map((d, i) => (i === index ? { ...d, status: DIAGNOSTIC_STATUS.RUNNING, message: '' } : d))
        );

        try {
            const response = await fetch(endpoint.path, {
                method: endpoint.method,
                headers: { 'Content-Type': 'application/json' },
            });

            const responseTime = Date.now() - startTime;
            const data = await response.json().catch(() => null);

            let status = DIAGNOSTIC_STATUS.SUCCESS;
            let message = `응답 시간: ${responseTime}ms`;

            // HTTP 상태 코드 체크
            if (!response.ok) {
                status = DIAGNOSTIC_STATUS.ERROR;
                message = `HTTP ${response.status}: ${response.statusText}`;
            } else if (responseTime > 3000) {
                // 3초 이상 걸리면 경고
                status = DIAGNOSTIC_STATUS.WARNING;
                message = `느린 응답 (${responseTime}ms) - 성능 최적화 필요`;
            } else if (data?.success === false) {
                status = DIAGNOSTIC_STATUS.ERROR;
                message = data?.error || 'API 응답에서 success: false 반환';
            }

            setDiagnostics((prev) =>
                prev.map((d, i) =>
                    i === index
                        ? { ...d, status, message, responseTime }
                        : d
                )
            );

            return status;
        } catch (error) {
            const message = `네트워크 오류: ${error.message}`;
            setDiagnostics((prev) =>
                prev.map((d, i) =>
                    i === index
                        ? { ...d, status: DIAGNOSTIC_STATUS.ERROR, message, responseTime: null }
                        : d
                )
            );
            return DIAGNOSTIC_STATUS.ERROR;
        }
    };

    /**
     * 모든 엔드포인트 진단 실행
     */
    const runAllDiagnostics = async () => {
        setIsRunning(true);
        setOverallStatus(DIAGNOSTIC_STATUS.RUNNING);

        const results = [];

        for (let i = 0; i < diagnostics.length; i++) {
            const result = await runSingleDiagnostic(DIAGNOSTIC_ENDPOINTS[i], i);
            results.push(result);
        }

        // 전체 상태 결정
        const hasError = results.some((r) => r === DIAGNOSTIC_STATUS.ERROR);
        const hasWarning = results.some((r) => r === DIAGNOSTIC_STATUS.WARNING);

        if (hasError) {
            setOverallStatus(DIAGNOSTIC_STATUS.ERROR);
        } else if (hasWarning) {
            setOverallStatus(DIAGNOSTIC_STATUS.WARNING);
        } else {
            setOverallStatus(DIAGNOSTIC_STATUS.SUCCESS);
        }

        setIsRunning(false);
        setLastRun(new Date());
    };

    const toggleExpand = (index) => {
        setDiagnostics((prev) =>
            prev.map((d, i) => (i === index ? { ...d, expanded: !d.expanded } : d))
        );
    };

    // 카테고리별 그룹핑
    const groupedDiagnostics = diagnostics.reduce((acc, diag, idx) => {
        if (!acc[diag.category]) acc[diag.category] = [];
        acc[diag.category].push({ ...diag, originalIndex: idx });
        return acc;
    }, {});

    return (
        <Box>
            {/* 헤더 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <HealthAndSafetyIcon sx={{ fontSize: 32, color: 'error.main' }} />
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        시스템 버그 및 작동 진단
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {lastRun && (
                        <Typography variant="caption" color="text.secondary">
                            마지막 진단: {lastRun.toLocaleTimeString()}
                        </Typography>
                    )}
                    <Tooltip title="전체 진단 실행">
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                            onClick={runAllDiagnostics}
                            disabled={isRunning}
                        >
                            전체 진단 실행
                        </Button>
                    </Tooltip>
                </Box>
            </Box>

            {/* 전체 상태 요약 */}
            <Paper sx={{
                p: 2, mb: 3, borderRadius: 2, bgcolor:
                    overallStatus === DIAGNOSTIC_STATUS.SUCCESS ? '#e8f5e9' :
                        overallStatus === DIAGNOSTIC_STATUS.WARNING ? '#fff3e0' :
                            overallStatus === DIAGNOSTIC_STATUS.ERROR ? '#ffebee' : '#f5f5f5'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {statusConfig[overallStatus].icon}
                    <Typography variant="h6" fontWeight="bold">
                        전체 상태: {statusConfig[overallStatus].label}
                    </Typography>
                    {overallStatus === DIAGNOSTIC_STATUS.SUCCESS && (
                        <Typography variant="body2" color="text.secondary">
                            모든 시스템이 정상적으로 작동 중입니다.
                        </Typography>
                    )}
                    {overallStatus === DIAGNOSTIC_STATUS.ERROR && (
                        <Typography variant="body2" color="error">
                            일부 시스템에 문제가 감지되었습니다. 아래에서 세부 정보를 확인하세요.
                        </Typography>
                    )}
                </Box>
                {isRunning && <LinearProgress sx={{ mt: 2 }} color="error" />}
            </Paper>

            {/* 카테고리별 진단 목록 */}
            <Grid container spacing={3}>
                {Object.entries(groupedDiagnostics).map(([category, items]) => (
                    <Grid item xs={12} md={6} key={category}>
                        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <Box sx={{ px: 2, py: 1.5, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    {category === '시스템' && <StorageIcon sx={{ mr: 1, fontSize: 20, verticalAlign: 'text-bottom' }} />}
                                    {category === '퀵서비스' && <ApiIcon sx={{ mr: 1, fontSize: 20, verticalAlign: 'text-bottom' }} />}
                                    {category}
                                </Typography>
                            </Box>
                            <List sx={{ p: 0 }}>
                                {items.map((diag, idx) => (
                                    <React.Fragment key={diag.path}>
                                        <ListItem
                                            sx={{ py: 1.5, cursor: 'pointer' }}
                                            onClick={() => toggleExpand(diag.originalIndex)}
                                        >
                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                {statusConfig[diag.status].icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography variant="body1" fontWeight="medium">
                                                            {diag.feature}
                                                        </Typography>
                                                        {diag.critical && (
                                                            <Chip label="중요" size="small" color="error" variant="outlined" sx={{ height: 20 }} />
                                                        )}
                                                    </Box>
                                                }
                                                secondary={diag.path}
                                            />
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip
                                                    label={statusConfig[diag.status].label}
                                                    size="small"
                                                    color={statusConfig[diag.status].color}
                                                    variant="outlined"
                                                />
                                                <IconButton size="small">
                                                    {diag.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                </IconButton>
                                            </Box>
                                        </ListItem>
                                        <Collapse in={diag.expanded}>
                                            <Box sx={{ px: 3, py: 2, bgcolor: '#fafafa' }}>
                                                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                                    {diag.message || '진단을 실행하면 결과가 여기에 표시됩니다.'}
                                                </Typography>
                                                {diag.responseTime !== null && (
                                                    <Typography variant="caption" color="text.disabled">
                                                        응답 시간: {diag.responseTime}ms
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Collapse>
                                        {idx < items.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </List>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* 유지보수 가이드 */}
            <Paper sx={{ p: 3, mt: 3, borderRadius: 2, bgcolor: '#e3f2fd' }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    📋 유지보수 가이드
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    • <strong>HTTP 오류</strong>: 서버 로그(<code>server/index.js</code>)를 확인하고 해당 라우트 파일의 에러 핸들링 점검<br />
                    • <strong>느린 응답</strong>: Google Sheets API 쿼터 limit 또는 Rate Limiter 설정 확인 (<code>rateLimiter</code>)<br />
                    • <strong>네트워크 오류</strong>: 서버가 실행 중인지 확인 (<code>npm run dev</code>) 및 방화벽 설정 점검<br />
                    • <strong>success: false</strong>: API 응답에서 반환된 에러 메시지를 확인하고 해당 로직 수정
                </Typography>
            </Paper>
        </Box>
    );
};

export default BugDiagnosticDashboard;
