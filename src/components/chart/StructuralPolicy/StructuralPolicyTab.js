import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Grid,
    Button,
    IconButton,
    Collapse
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    Print as PrintIcon,
    EmojiEvents as EmojiEventsIcon,
    CorporateFare as CorporateFareIcon,
    Groups as GroupsIcon,
    Person as PersonIcon,
    PieChart as PieChartIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../../../api';
import { fetchWithRetry } from '../../../utils/fetchWithRetry';
import StructuralPolicySettingsDialog from './StructuralPolicySettingsDialog';

// --- Styles ---
const styles = {
    headerCard: {
        background: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)',
        color: 'white',
        p: 2,
        mb: 2,
        borderRadius: 2,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    },
    tableHeader: {
        bgcolor: '#f5f5f5',
        '& .MuiTableCell-root': {
            fontWeight: 'bold',
            color: '#333',
            borderBottom: '2px solid #ddd'
        }
    },
    printOnly: {
        display: 'none',
        '@media print': {
            display: 'block'
        }
    },
    noPrint: {
        '@media print': {
            display: 'none'
        }
    }
};

const calculateScore = (percentage, criteria) => {
    if (!criteria || criteria.length === 0) return 0;
    const p = parseFloat(percentage);
    const sorted = [...criteria].sort((a, b) => b.percentage - a.percentage);
    for (const c of sorted) {
        if (p >= c.percentage) return c.score;
    }
    return 0;
};

const StructuralPolicyTab = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [showSettings, setShowSettings] = useState(false);

    // 섹션 확장/축소 상태
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
    const [isOfficeExpanded, setIsOfficeExpanded] = useState(true);
    const [isDeptExpanded, setIsDeptExpanded] = useState(true);
    const [isCodeExpanded, setIsCodeExpanded] = useState(true);
    const [isAgentExpanded, setIsAgentExpanded] = useState(true);

    const fetchData = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        try {
            const url = `${API_BASE_URL}/api/structural-policy/data${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetchWithRetry(url);
            const result = await response.json();
            setData(result);
            setLastUpdate(result.lastUpdate);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePrint = () => {
        // 인쇄 시 모든 섹션 확장
        setIsSummaryExpanded(true);
        setIsOfficeExpanded(true);
        setIsDeptExpanded(true);
        setIsCodeExpanded(true);
        setIsAgentExpanded(true);
        setTimeout(() => window.print(), 300);
    };

    // --- Grouping Logic ---
    const targetTotalScore = useMemo(() => {
        return 7; // Fixed target score based on user feedback (MNP 3 + HighValue 4 = 7)
    }, []);


    const codeGroups = useMemo(() => {
        if (!data) return [];
        const criteria_mnp = data.matrixCriteria?.filter(c => c.indicator === 'mnp') || [];
        const criteria_hv = data.matrixCriteria?.filter(c => c.indicator === 'highValue') || [];

        return (data.codes || []).map(codeObj => {
            const mnpP = parseFloat(codeObj.mnp.percentage);
            const hvP = parseFloat(codeObj.highValue.percentage);
            const mnpScore = calculateScore(mnpP, criteria_mnp);
            const hvScore = calculateScore(hvP, criteria_hv);
            return {
                ...codeObj,
                mnpScore,
                hvScore,
                totalScore: mnpScore + hvScore
            };
        }).sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
            // Denominator tie-break (Wireless Total)
            if (b.mnp.denominator !== a.mnp.denominator) return b.mnp.denominator - a.mnp.denominator;
            // Percent Sum tie-break
            const aTotalP = parseFloat(a.mnp.percentage) + parseFloat(a.highValue.percentage);
            const bTotalP = parseFloat(b.mnp.percentage) + parseFloat(b.highValue.percentage);
            return bTotalP - aTotalP;
        });
    }, [data]);

    const officeGroups = useMemo(() => {
        if (!data?.agents) return [];
        const criteria_mnp = data.matrixCriteria?.filter(c => c.indicator === 'mnp') || [];
        const criteria_hv = data.matrixCriteria?.filter(c => c.indicator === 'highValue') || [];
        const groups = {};

        data.agents.forEach(agent => {
            const off = agent.office;
            if (!groups[off]) groups[off] = { name: off, agents: [], mnpNum: 0, mnpDen: 0, hvNum: 0, hvDen: 0 };
            groups[off].agents.push(agent);
            groups[off].mnpNum += agent.mnp.numerator;
            groups[off].mnpDen += agent.mnp.denominator;
            groups[off].hvNum += agent.highValue.numerator;
            groups[off].hvDen += agent.highValue.denominator;
        });

        return Object.values(groups).map(g => {
            const mnpP = g.mnpDen > 0 ? (g.mnpNum / g.mnpDen * 100).toFixed(1) : 0;
            const hvP = g.hvDen > 0 ? (g.hvNum / g.hvDen * 100).toFixed(1) : 0;
            const mnpScore = calculateScore(mnpP, criteria_mnp);
            const hvScore = calculateScore(hvP, criteria_hv);
            return {
                ...g,
                mnpP, hvP,
                totalScore: mnpScore + hvScore,
                mnpScore,
                hvScore,
                mnp: { numerator: g.mnpNum, denominator: g.mnpDen, percentage: mnpP },
                highValue: { numerator: g.hvNum, denominator: g.hvDen, percentage: hvP }
            };
        }).sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
            // Denominator tie-break (Wireless Total)
            if (b.mnpDen !== a.mnpDen) return b.mnpDen - a.mnpDen;
            // Percent Sum tie-break
            const aTotalP = parseFloat(a.mnpP) + parseFloat(a.hvP);
            const bTotalP = parseFloat(b.mnpP) + parseFloat(b.hvP);
            return bTotalP - aTotalP;
        });
    }, [data]);

    const deptGroups = useMemo(() => {
        if (!data?.agents) return [];
        const criteria_mnp = data.matrixCriteria?.filter(c => c.indicator === 'mnp') || [];
        const criteria_hv = data.matrixCriteria?.filter(c => c.indicator === 'highValue') || [];
        const groups = {};

        data.agents.forEach(agent => {
            const key = `${agent.office}-${agent.department}`;
            if (!groups[key]) groups[key] = { office: agent.office, name: agent.department, agents: [], mnpNum: 0, mnpDen: 0, hvNum: 0, hvDen: 0 };
            groups[key].agents.push(agent);
            groups[key].mnpNum += agent.mnp.numerator;
            groups[key].mnpDen += agent.mnp.denominator;
            groups[key].hvNum += agent.highValue.numerator;
            groups[key].hvDen += agent.highValue.denominator;
        });

        return Object.values(groups).map(g => {
            const mnpP = g.mnpDen > 0 ? (g.mnpNum / g.mnpDen * 100).toFixed(1) : 0;
            const hvP = g.hvDen > 0 ? (g.hvNum / g.hvDen * 100).toFixed(1) : 0;
            const mnpScore = calculateScore(mnpP, criteria_mnp);
            const hvScore = calculateScore(hvP, criteria_hv);
            return {
                ...g,
                mnpP, hvP,
                totalScore: mnpScore + hvScore,
                mnpScore,
                hvScore,
                mnp: { numerator: g.mnpNum, denominator: g.mnpDen, percentage: mnpP },
                highValue: { numerator: g.hvNum, denominator: g.hvDen, percentage: hvP }
            };
        }).sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
            // Denominator tie-break (Wireless Total)
            if (b.mnpDen !== a.mnpDen) return b.mnpDen - a.mnpDen;
            // Percent Sum tie-break
            const aTotalP = parseFloat(a.mnpP) + parseFloat(a.hvP);
            const bTotalP = parseFloat(b.mnpP) + parseFloat(b.hvP);
            return bTotalP - aTotalP;
        });
    }, [data]);

    const sortedAgents = useMemo(() => {
        if (!data?.agents) return [];
        const criteria_mnp = data.matrixCriteria?.filter(c => c.indicator === 'mnp') || [];
        const criteria_hv = data.matrixCriteria?.filter(c => c.indicator === 'highValue') || [];

        return data.agents.map(agent => {
            const mnpP = parseFloat(agent.mnp.percentage);
            const hvP = parseFloat(agent.highValue.percentage);
            const mnpScore = calculateScore(mnpP, criteria_mnp);
            const hvScore = calculateScore(hvP, criteria_hv);
            return {
                ...agent,
                mnpScore,
                hvScore,
                totalScore: mnpScore + hvScore
            };
        }).sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
            if (b.mnp.denominator !== a.mnp.denominator) return b.mnp.denominator - a.mnp.denominator;
            const aTotalP = parseFloat(a.mnp.percentage) + parseFloat(a.highValue.percentage);
            const bTotalP = parseFloat(b.mnp.percentage) + parseFloat(b.highValue.percentage);
            return bTotalP - aTotalP;
        });
    }, [data]);

    if (loading && !data) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                <CircularProgress />
            </Box>
        );
    }

    // --- Helper Functions (Defined inside to access 'data') ---
    // --- Helper Functions (Defined inside to access 'data') ---

    const getMatrixCellColor = (cellScore, percentage, indicator) => {
        if (!data?.matrixCriteria) return 'transparent';
        const criteriaList = data.matrixCriteria.filter(c => c.indicator === indicator);
        const actualScore = calculateScore(percentage, criteriaList);
        if (cellScore !== actualScore) return 'transparent';

        const maxScore = Math.max(...criteriaList.map(c => c.score), 0);
        if (cellScore >= maxScore && maxScore > 0) return '#2e7d32';
        if (cellScore >= maxScore * 0.6) return '#1976d2';
        if (cellScore > 0) return '#ed6c02';
        return '#d32f2f';
    };

    const getPerformanceColor = (percentage, indicator) => {
        if (!data?.matrixCriteria) return '#333';
        const criteriaList = data.matrixCriteria.filter(c => c.indicator === indicator);
        const maxCriteria = [...criteriaList].sort((a, b) => b.score - a.score)[0];
        if (!maxCriteria) return '#333';
        if (percentage >= maxCriteria.percentage) return '#1976d2';
        return '#d32f2f';
    };

    const getPerformanceIcon = (percentage, indicator) => {
        if (!data?.matrixCriteria) return '⚠️';
        const criteriaList = data.matrixCriteria.filter(c => c.indicator === indicator);
        const maxCriteria = [...criteriaList].sort((a, b) => b.score - a.score)[0];
        if (!maxCriteria) return '⚠️';
        if (percentage >= maxCriteria.percentage) return '🏆';
        if (percentage >= maxCriteria.percentage * 0.8) return '👍';
        return '⚠️';
    };

    const getCellColor = (score) => {
        if (score >= 5) return '#e3f2fd';
        if (score >= 3) return '#fffde7';
        if (score <= 1) return '#fbe9e7';
        return 'transparent';
    };


    return (
        <Box id="structural-policy-print-area" sx={{ p: { xs: 1, md: 2 } }}>
            <style>
                {`
          @media print {
            @page {
                size: A4 landscape;
                margin: 5mm; /* 상단 및 여백 5mm로 조절 */
            }
            /* 모든 부모 컨테이너의 제한 해제 및 상단 정렬 강제 */
            html, body, #root, [class*="MuiBox-root"], .MuiBox-root, .MuiContainer-root, main {
                overflow: visible !important;
                height: auto !important;
                width: 100% !important;
                max-width: none !important;
                position: static !important;
                margin: 0 !important;
                padding: 0 !important;
                display: block !important; /* 세로 중앙 정렬 방지 */
                text-align: left !important;
            }
            body * {
                visibility: hidden;
            }
            #structural-policy-print-area, #structural-policy-print-area * {
                visibility: visible;
            }
            #structural-policy-print-area {
                position: relative !important;
                margin: 0 !important;
                width: 100% !important;
                zoom: 0.95; /* 약간만 축소 */
            }
            /* 그리드 강제 가로 정렬 */
            .MuiGrid-container {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                width: 100% !important;
                margin: 0 !important;
            }
            /* 3개짜리 그리드 (4/12) */
            .MuiGrid-item.MuiGrid-grid-md-4 {
                flex-basis: 33.33% !important;
                max-width: 33.33% !important;
                display: block !important;
                padding: 10px !important;
            }
            /* 4개짜리 그리드 (3/12) */
            .MuiGrid-item.MuiGrid-grid-md-3 {
                flex-basis: 25% !important;
                max-width: 25% !important;
                display: block !important;
                padding: 10px !important;
            }
            .MuiButton-root, .MuiIconButton-root, .nav-container, .sidebar-container, .no-print {
                display: none !important;
            }
            .MuiPaper-root {
                box-shadow: none !important;
                border: 1px solid #eee !important;
                margin-bottom: 8px !important; /* 더 축소 */
                padding: 10px !important; /* 더 축소 */
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .MuiCollapse-container {
                height: auto !important;
                visibility: visible !important;
                display: block !important;
            }
            .MuiTableContainer-root {
                max-height: none !important;
                overflow: visible !important;
            }
            /* 인쇄 헤더 스타일 */
            .print-header {
                display: flex !important;
                justify-content: flex-end;
                align-items: center;
                margin-bottom: 10px !important; /* 상단 여백 문제를 위해 축소 */
                padding-bottom: 5px;
                border-bottom: 1px solid #ddd;
                gap: 12px;
                width: 100%;
            }
            .print-logo {
                height: 25px; /* 조금 더 작게 */
                object-fit: contain;
            }
            .print-company-name {
                font-size: 14px;
                font-weight: bold;
                color: #666;
            }
            /* 섹션 제목 인쇄 스타일 */
            .print-section-title {
                display: block !important;
                font-size: 15px !important;
                font-weight: bold !important;
                margin-bottom: 4px !important;
                border-left: 3px solid #f5576c;
                padding-left: 8px;
            }
            /* 기수별 페이지 넘김 설정 */
            .print-page-break {
                page-break-before: always !important;
                break-before: page !important;
            }
            /* 테이블 인쇄 압축 (Relaxed) */
            .MuiTableCell-root {
                padding: 4px 8px !important; /* 여백 증가 */
                font-size: 11px !important; /* 글자 크기 증가 */
                line-height: 1.2 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
          }
        `}
            </style>


            {/* 인쇄 전용 헤더 */}
            <Box className="print-header" sx={{ display: 'none' }}>
                <img src="/login.png" alt="logo" className="print-logo" />
                <Typography className="print-company-name">
                    (주)브이아이피플러스
                </Typography>
            </Box>

            <Box className="print-only" sx={{ mb: 2, textAlign: 'center', display: 'none', '@media print': { display: 'block' } }}>
                <Typography variant="h5" fontWeight="bold">구조정책 분석 현황</Typography>
                <Typography variant="subtitle1">{new Date().toLocaleDateString()} 기준</Typography>
            </Box>

            {/* Screen Header */}
            <Paper sx={{ ...styles.headerCard, ...styles.noPrint }}>
                <Grid container alignItems="center" spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                            <PieChartIcon sx={{ mr: 1 }} /> 구조정책 분석 현황
                        </Typography>
                        {lastUpdate && (
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                최종 업데이트: {new Date(lastUpdate).toLocaleString()}
                            </Typography>
                        )}
                    </Grid>
                    <Grid item xs={12} md={6} sx={{ textAlign: 'right' }}>
                        <Button variant="contained" startIcon={<RefreshIcon />} onClick={() => fetchData(true)} sx={{ mr: 1, backgroundColor: 'rgba(255,255,255,0.2)' }}>새로고침</Button>
                        <Button variant="contained" startIcon={<SettingsIcon />} onClick={() => setShowSettings(true)} sx={{ mr: 1, backgroundColor: 'rgba(255,255,255,0.2)' }}>셋팅</Button>
                        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>인쇄</Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Print Header */}
            <Box sx={styles.printOnly} className="print-header">
                <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>VIP Plus 구조정책 분석 리포트</Typography>
            </Box>

            {/* Page 1: Summary & Matrix */}
            <Box className="print-page-break">
                <Paper elevation={2} sx={{ p: 1, mb: 1, borderRadius: 2 }}>
                    <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }} className="print-section-title">
                            전사 구조정책 분석 요약
                        </Typography>
                        <IconButton size="small" className="no-print" onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}>
                            {isSummaryExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Box>
                    <Collapse in={isSummaryExpanded}>
                        {/* Summary Status Boxes */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
                                달성상황
                            </Typography>
                            <Grid container spacing={1}>
                                <Grid item xs={12} md={4}>
                                    <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e3f2fd', borderRadius: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <Typography variant="h5" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                                            {data?.companySummary?.totalScore || 0} / 10점
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">전사 합계점수</Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fff3e0', borderRadius: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <Typography variant="h5" sx={{ color: getPerformanceColor(data?.companySummary?.mnp?.percentage, 'mnp'), fontWeight: 'bold' }}>
                                            {getPerformanceIcon(data?.companySummary?.mnp?.percentage, 'mnp')}
                                            {calculateScore(data?.companySummary?.mnp?.percentage, data.matrixCriteria?.filter(c => c.indicator === 'mnp'))}점
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            MNP ({data?.companySummary?.mnp?.percentage}%)
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            ({data?.companySummary?.mnp?.numerator} / {data?.companySummary?.mnp?.denominator})
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#f3e5f5', borderRadius: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <Typography variant="h5" sx={{ color: getPerformanceColor(data?.companySummary?.highValue?.percentage, 'highValue'), fontWeight: 'bold' }}>
                                            {getPerformanceIcon(data?.companySummary?.highValue?.percentage, 'highValue')}
                                            {calculateScore(data?.companySummary?.highValue?.percentage, data.matrixCriteria?.filter(c => c.indicator === 'highValue'))}점
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            고가치 ({data?.companySummary?.highValue?.percentage}%)
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            ({data?.companySummary?.highValue?.numerator} / {data?.companySummary?.highValue?.denominator})
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Box>

                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                            <Table size="small">
                                <TableHead sx={styles.tableHeader}>
                                    <TableRow>
                                        <TableCell align="center">지표</TableCell>
                                        {data?.matrixCriteria?.filter(c => c.indicator === 'mnp').sort((a, b) => b.score - a.score).map((c, i) => (
                                            <TableCell align="center" key={i}>{c.score}점</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fafafa' }}>MNP 비중</TableCell>
                                        {data?.matrixCriteria?.filter(c => c.indicator === 'mnp').sort((a, b) => b.score - a.score).map((c, i) => (
                                            <TableCell align="center" key={i} sx={{ bgcolor: getMatrixCellColor(c.score, data?.companySummary?.mnp?.percentage, 'mnp'), color: getMatrixCellColor(c.score, data?.companySummary?.mnp?.percentage, 'mnp') !== 'transparent' ? 'white' : 'inherit' }}>
                                                {c.percentage}% ↑
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fafafa' }}>고가치 비중</TableCell>
                                        {data?.matrixCriteria?.filter(c => c.indicator === 'highValue').sort((a, b) => b.score - a.score).map((c, i) => (
                                            <TableCell align="center" key={i} sx={{ bgcolor: getMatrixCellColor(c.score, data?.companySummary?.highValue?.percentage, 'highValue'), color: getMatrixCellColor(c.score, data?.companySummary?.highValue?.percentage, 'highValue') !== 'transparent' ? 'white' : 'inherit' }}>
                                                {c.percentage}% ↑
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Collapse>
                </Paper>
            </Box>

            {/* Page 2: Rankings Table */}
            <Box className="print-page-break">

                {/* Code Status Table */}
                <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }} className="print-section-title">
                            코드별 구조정책 현황
                        </Typography>
                        <IconButton size="small" className="no-print" onClick={() => setIsCodeExpanded(!isCodeExpanded)}>
                            {isCodeExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1, ml: 1 }}>
                        ※ 순위 기준: 총점(높은순) &gt; 무선모수(많은순) &gt; 달성률(높은순)
                    </Typography>
                    <Collapse in={isCodeExpanded}>
                        <TableContainer>
                            <Table size="small">
                                <TableHead sx={styles.tableHeader}>
                                    <TableRow>
                                        <TableCell align="center">순위</TableCell>
                                        <TableCell align="center">코드</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#e8f5e9', fontWeight: 'bold' }}>무선모수</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#e3f2fd', fontWeight: 'bold' }}>총점</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#fff3e0', fontWeight: 'bold' }}>MNP 비중</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#f3e5f5', fontWeight: 'bold' }}>고가치 비중</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {codeGroups.map((codeObj, index) => (
                                        <TableRow key={index} hover sx={{
                                            bgcolor: (codeObj.totalScore < targetTotalScore) ? '#d32f2f' : 'inherit',
                                            transition: 'background-color 0.2s',
                                            '& td': {
                                                color: (codeObj.totalScore < targetTotalScore) ? '#ffffff !important' : 'inherit',
                                                fontWeight: (codeObj.totalScore < targetTotalScore) ? 'bold' : 'inherit'
                                            },
                                            '& .MuiTypography-root': {
                                                color: (codeObj.totalScore < targetTotalScore) ? '#ffffff !important' : 'inherit'
                                            },
                                            '& .MuiTypography-caption': {
                                                color: (codeObj.totalScore < targetTotalScore) ? '#e0e0e0 !important' : 'text.secondary'
                                            },
                                            '&:hover': {
                                                bgcolor: (codeObj.totalScore < targetTotalScore) ? '#f5f5f5 !important' : undefined,
                                                '& td': {
                                                    color: (codeObj.totalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                },
                                                '& .MuiTypography-root': {
                                                    color: (codeObj.totalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                },
                                                '& .MuiTypography-caption': {
                                                    color: (codeObj.totalScore < targetTotalScore) ? 'text.secondary !important' : 'text.secondary'
                                                }
                                            }
                                        }}>
                                            <TableCell align="center">
                                                {index + 1}
                                                {index < 3 && <Typography component="span" sx={{ ml: 0.5 }}>👑</Typography>}
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>{codeObj.name || codeObj.code || '(이름없음)'}</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                                {codeObj.mnp.denominator}
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1.1rem' }}>
                                                {codeObj.totalScore}점
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ color: getPerformanceColor(codeObj.mnp.percentage, 'mnp'), fontWeight: 'bold' }}>
                                                        {codeObj.mnp.percentage}%
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                                        ({codeObj.mnp.numerator}/{codeObj.mnp.denominator})
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#555' }}>
                                                        {codeObj.mnpScore}점
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ color: getPerformanceColor(codeObj.highValue.percentage, 'highValue'), fontWeight: 'bold' }}>
                                                        {codeObj.highValue.percentage}%
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                                        ({codeObj.highValue.numerator}/{codeObj.highValue.denominator})
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#555' }}>
                                                        {codeObj.hvScore}점
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Collapse>
                </Paper>

                {/* Office Status Table */}
                <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }} className="print-section-title">
                            사무실별 구조정책 현황
                        </Typography>
                        <IconButton size="small" className="no-print" onClick={() => setIsOfficeExpanded(!isOfficeExpanded)}>
                            {isOfficeExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1, ml: 1 }}>
                        ※ 순위 기준: 총점(높은순) &gt; 무선모수(많은순) &gt; 달성률(높은순)
                    </Typography>
                    <Collapse in={isOfficeExpanded}>
                        <TableContainer>
                            <Table size="small">
                                <TableHead sx={styles.tableHeader}>
                                    <TableRow>
                                        <TableCell align="center">순위</TableCell>
                                        <TableCell align="center">사무실</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#e8f5e9', fontWeight: 'bold' }}>무선모수</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#e3f2fd', fontWeight: 'bold' }}>총점</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#fff3e0', fontWeight: 'bold' }}>MNP 비중</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#f3e5f5', fontWeight: 'bold' }}>고가치 비중</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {officeGroups.map((off, index) => (
                                        <TableRow key={index} hover sx={{
                                            bgcolor: (off.totalScore < targetTotalScore) ? '#d32f2f' : 'inherit',
                                            transition: 'background-color 0.2s',
                                            '& td': {
                                                color: (off.totalScore < targetTotalScore) ? '#ffffff !important' : 'inherit',
                                                fontWeight: (off.totalScore < targetTotalScore) ? 'bold' : 'inherit'
                                            },
                                            '& .MuiTypography-root': {
                                                color: (off.totalScore < targetTotalScore) ? '#ffffff !important' : 'inherit'
                                            },
                                            '& .MuiTypography-caption': {
                                                color: (off.totalScore < targetTotalScore) ? '#e0e0e0 !important' : 'text.secondary'
                                            },
                                            '&:hover': {
                                                bgcolor: (off.totalScore < targetTotalScore) ? '#f5f5f5 !important' : undefined,
                                                '& td': {
                                                    color: (off.totalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                },
                                                '& .MuiTypography-root': {
                                                    color: (off.totalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                },
                                                '& .MuiTypography-caption': {
                                                    color: (off.totalScore < targetTotalScore) ? 'text.secondary !important' : 'text.secondary'
                                                }
                                            }
                                        }}>
                                            <TableCell align="center">
                                                {index + 1}
                                                {index < 3 && <Typography component="span" sx={{ ml: 0.5 }}>👑</Typography>}
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>{off.name}</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                                {off.mnp.denominator}
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1.1rem' }}>
                                                {off.totalScore}점
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ color: getPerformanceColor(off.mnp.percentage, 'mnp'), fontWeight: 'bold' }}>
                                                        {off.mnp.percentage}%
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                                        ({off.mnp.numerator}/{off.mnp.denominator})
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#555' }}>
                                                        {off.mnpScore}점
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ color: getPerformanceColor(off.highValue.percentage, 'highValue'), fontWeight: 'bold' }}>
                                                        {off.highValue.percentage}%
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                                        ({off.highValue.numerator}/{off.highValue.denominator})
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#555' }}>
                                                        {off.hvScore}점
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Collapse>
                </Paper>

                {/* Department Status Table */}
                <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }} className="print-section-title">
                            부서별 구조정책 현황
                        </Typography>
                        <IconButton size="small" className="no-print" onClick={() => setIsDeptExpanded(!isDeptExpanded)}>
                            {isDeptExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1, ml: 1 }}>
                        ※ 순위 기준: 총점(높은순) &gt; 무선모수(많은순) &gt; 달성률(높은순)
                    </Typography>
                    <Collapse in={isDeptExpanded}>
                        <TableContainer>
                            <Table size="small">
                                <TableHead sx={styles.tableHeader}>
                                    <TableRow>
                                        <TableCell align="center">순위</TableCell>
                                        <TableCell align="center">사무실</TableCell>
                                        <TableCell align="center">부서</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#e8f5e9', fontWeight: 'bold' }}>무선모수</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#e3f2fd', fontWeight: 'bold' }}>총점</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#fff3e0', fontWeight: 'bold' }}>MNP 비중</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#f3e5f5', fontWeight: 'bold' }}>고가치 비중</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {deptGroups.map((dept, index) => (
                                        <TableRow key={index} hover sx={{
                                            bgcolor: (dept.totalScore < targetTotalScore) ? '#d32f2f' : 'inherit',
                                            transition: 'background-color 0.2s',
                                            '& td': {
                                                color: (dept.totalScore < targetTotalScore) ? '#ffffff !important' : 'inherit',
                                                fontWeight: (dept.totalScore < targetTotalScore) ? 'bold' : 'inherit'
                                            },
                                            '& .MuiTypography-root': {
                                                color: (dept.totalScore < targetTotalScore) ? '#ffffff !important' : 'inherit'
                                            },
                                            '& .MuiTypography-caption': {
                                                color: (dept.totalScore < targetTotalScore) ? '#e0e0e0 !important' : 'text.secondary'
                                            },
                                            '&:hover': {
                                                bgcolor: (dept.totalScore < targetTotalScore) ? '#f5f5f5 !important' : undefined,
                                                '& td': {
                                                    color: (dept.totalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                },
                                                '& .MuiTypography-root': {
                                                    color: (dept.totalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                },
                                                '& .MuiTypography-caption': {
                                                    color: (dept.totalScore < targetTotalScore) ? 'text.secondary !important' : 'text.secondary'
                                                }
                                            }
                                        }}>
                                            <TableCell align="center">
                                                {index + 1}
                                                {index < 3 && <Typography component="span" sx={{ ml: 0.5 }}>👑</Typography>}
                                            </TableCell>
                                            <TableCell align="center">{dept.office}</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>{dept.name}</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                                {dept.mnp.denominator}
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1.1rem' }}>
                                                {dept.totalScore}점
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ color: getPerformanceColor(dept.mnp.percentage, 'mnp'), fontWeight: 'bold' }}>
                                                        {dept.mnp.percentage}%
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                                        ({dept.mnp.numerator}/{dept.mnp.denominator})
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#555' }}>
                                                        {dept.mnpScore}점
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ color: getPerformanceColor(dept.highValue.percentage, 'highValue'), fontWeight: 'bold' }}>
                                                        {dept.highValue.percentage}%
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                                        ({dept.highValue.numerator}/{dept.highValue.denominator})
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#555' }}>
                                                        {dept.hvScore}점
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Collapse>
                </Paper>
            </Box>

            {/* Rankings Table (Moved) */}
            <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }} className="print-section-title">
                        담당자별 구조정책 현황
                    </Typography>
                    <Button
                        variant="outlined" size="small" className="no-print"
                        onClick={() => setIsAgentExpanded(!isAgentExpanded)}
                        startIcon={isAgentExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    >
                        {isAgentExpanded ? '축소' : '확대'}
                    </Button>
                </Box>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1, ml: 1 }}>
                    ※ 순위 기준: 총점(높은순) &gt; 무선모수(많은순) &gt; 달성률(높은순)
                </Typography>
                <Collapse in={isAgentExpanded}>
                    <TableContainer sx={{ maxHeight: { xs: 600, print: 'none' } }}>
                        <Table stickyHeader size="small">
                            <TableHead sx={styles.tableHeader}>
                                <TableRow>
                                    <TableCell align="center">순위</TableCell>
                                    <TableCell align="center">담당자</TableCell>
                                    <TableCell align="center" sx={{ bgcolor: '#e8f5e9', fontWeight: 'bold' }}>무선모수</TableCell>
                                    <TableCell align="center" sx={{ bgcolor: '#e3f2fd', fontWeight: 'bold' }}>총점</TableCell>
                                    <TableCell align="center">사무실</TableCell>
                                    <TableCell align="center">부서</TableCell>
                                    <TableCell align="center" sx={{ bgcolor: '#fff3e0', fontWeight: 'bold' }}>MNP 비중</TableCell>
                                    <TableCell align="center" sx={{ bgcolor: '#f3e5f5', fontWeight: 'bold' }}>고가치 비중</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sortedAgents.map((agent, index) => (
                                    <TableRow key={index} hover sx={{
                                        bgcolor: (agent.totalScore < targetTotalScore) ? '#d32f2f' : 'inherit',
                                        transition: 'background-color 0.2s',
                                        '& td': {
                                            color: (agent.totalScore < targetTotalScore) ? '#ffffff !important' : 'inherit',
                                            fontWeight: (agent.totalScore < targetTotalScore) ? 'bold' : 'inherit'
                                        },
                                        '& .MuiTypography-root': {
                                            color: (agent.totalScore < targetTotalScore) ? '#ffffff !important' : 'inherit'
                                        },
                                        '& .MuiTypography-caption': {
                                            color: (agent.totalScore < targetTotalScore) ? '#e0e0e0 !important' : 'text.secondary'
                                        },
                                        '&:hover': {
                                            bgcolor: (agent.totalScore < targetTotalScore) ? '#f5f5f5 !important' : undefined,
                                            '& td': {
                                                color: (agent.totalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                            },
                                            '& .MuiTypography-root': {
                                                color: (agent.totalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                            },
                                            '& .MuiTypography-caption': {
                                                color: (agent.totalScore < targetTotalScore) ? 'text.secondary !important' : 'text.secondary'
                                            }
                                        }
                                    }}>
                                        <TableCell align="center">
                                            {index + 1}
                                            {index < 3 && <Typography component="span" sx={{ ml: 0.5 }}>👑</Typography>}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{agent.manager}</Typography>
                                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 'bold', display: 'block' }}>
                                                {agent.totalScore}점
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                            {agent.mnp.denominator}
                                        </TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1.1rem' }}>
                                            {agent.totalScore}점
                                        </TableCell>
                                        <TableCell align="center">{agent.office}</TableCell>
                                        <TableCell align="center">{agent.department}</TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                <Typography variant="body2" sx={{ color: getPerformanceColor(agent.mnp.percentage, 'mnp'), fontWeight: 'bold' }}>
                                                    {agent.mnp.percentage}%
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                                    ({agent.mnp.numerator}/{agent.mnp.denominator})
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#555' }}>
                                                    {agent.mnpScore}점
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                <Typography variant="body2" sx={{ color: getPerformanceColor(agent.highValue.percentage, 'highValue'), fontWeight: 'bold' }}>
                                                    {agent.highValue.percentage}%
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                                    ({agent.highValue.numerator}/{agent.highValue.denominator})
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#555' }}>
                                                    {agent.hvScore}점
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Collapse>
            </Paper>

            {/* Settings Dialog */}
            <StructuralPolicySettingsDialog
                open={showSettings}
                onClose={() => setShowSettings(false)}
                initialCriteria={data?.matrixCriteria}
                onSaveSuccess={fetchData}
            />
        </Box>
    );
};

export default StructuralPolicyTab;
