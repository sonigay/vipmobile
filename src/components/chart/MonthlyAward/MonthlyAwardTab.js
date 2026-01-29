import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert,
    CircularProgress,
    Grid,
    Collapse
} from '@mui/material';
import {
    Close as CloseIcon,
    ExpandMore as ExpandMoreIcon,
    Edit as EditIcon,
    Print as PrintIcon
} from '@mui/icons-material';
import { api } from '../../../api';
import MonthlyAwardSettingsDialog from './Settings/MonthlyAwardSettingsDialog';

// 월간시상 탭 컴포넌트
export default function MonthlyAwardTab() {
    const targetTotalScore = 13; // User defined target score
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAgentTableExpanded, setIsAgentTableExpanded] = useState(true);
    const [isOfficeTableExpanded, setIsOfficeTableExpanded] = useState(true);
    const [isDepartmentTableExpanded, setIsDepartmentTableExpanded] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    // 데이터 로드
    const loadData = async () => {
        try {
            setLoading(true);
            const result = await api.getMonthlyAwardData();
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Matrix 셀 색상 계산 (현재 달성한 칸만 강조)
    const getMatrixCellColor = (cellScore, percentage, indicator) => {
        if (!data?.matrixCriteria) return 'transparent';

        const criteriaList = data.matrixCriteria.filter(c => c.indicator === indicator);
        const actualScore = calculateScore(percentage, criteriaList);

        if (cellScore !== actualScore) return 'transparent';

        // 만점 기준에 따른 색상 분기 (인터넷 3점 vs 기타 6점)
        const maxScore = indicator === 'internet' ? 3 : 6;

        if (cellScore === maxScore) return '#2e7d32'; // 성공 (진한 녹색)
        if (cellScore >= maxScore * 0.6) return '#1976d2'; // 양호 (파란색)
        if (cellScore > 0) return '#ed6c02'; // 주의 (주황색)
        return '#d32f2f'; // 미달 (빨간색)
    };

    // 성과 텍스트 색상 계산 (New Requirement)
    const getPerformanceColor = (percentage, indicator) => {
        if (!data?.matrixCriteria) return '#333';

        // 해당 지표의 최고 점수 기준값 찾기
        const maxCriteria = data.matrixCriteria
            .filter(c => c.indicator === indicator)
            .sort((a, b) => b.score - a.score)[0];

        if (!maxCriteria) return '#333';

        // 달성(만점 기준)시 파란색, 미달시 빨간색
        if (percentage >= maxCriteria.percentage) return '#1976d2'; // Blue
        return '#d32f2f'; // Red
    };

    // 성과 아이콘 계산 (시트에서 로드된 기준값 사용)
    const getPerformanceIcon = (percentage, indicator) => {
        if (!data?.matrixCriteria) return '⚠️';

        // 해당 지표의 최고 점수 기준값 찾기
        const maxCriteria = data.matrixCriteria
            .filter(c => c.indicator === indicator)
            .sort((a, b) => b.score - a.score)[0];

        if (!maxCriteria) return '⚠️';

        if (percentage >= maxCriteria.percentage) return '🏆';
        if (percentage >= maxCriteria.percentage * 0.8) return '👍';
        return '⚠️';
    };

    // 점수 계산 함수 (백엔드와 동일한 로직)
    const calculateScore = (percentage, criteria) => {
        if (!criteria || criteria.length === 0) return 0;

        // 기준값을 점수별로 정렬
        const sortedCriteria = [...criteria].sort((a, b) => b.score - a.score);

        for (const criterion of sortedCriteria) {
            if (criterion.description === '미만') {
                if (percentage < criterion.percentage) return criterion.score;
            } else {
                if (percentage >= criterion.percentage) return criterion.score;
            }
        }

        const minScore = Math.min(...criteria.map(c => c.score));
        return minScore;
    };


    const handlePrint = () => {
        // 인쇄 시 모든 섹션 확장 확인 (CSS에서 강제 처리하지만 상태도 변경해주면 좋음)
        setIsExpanded(true);
        setIsAgentTableExpanded(true);
        setIsOfficeTableExpanded(true);
        setIsDepartmentTableExpanded(true);

        setTimeout(() => {
            window.print();
        }, 300);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {error}
            </Alert>
        );
    }

    if (!data) {
        return (
            <Alert severity="info" sx={{ m: 2 }}>
                데이터가 없습니다.
            </Alert>
        );
    }

    return (
        <Box>
            {/* Print CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
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
                    #monthly-award-print-area, #monthly-award-print-area * {
                        visibility: visible;
                    }
                    #monthly-award-print-area {
                        position: relative !important;
                        margin: 0 !important;
                        width: 100% !important;
                        zoom: 1.0;
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
                    /* 요약 슬롯 높이 조절 */
                    .indicator-box {
                        padding: 6px !important;
                    }
                    .indicator-box h4 {
                        font-size: 20px !important; /* 글자 크기 축소 */
                        margin-bottom: 2px !important;
                    }
                    .status-box {
                        height: 38px !important; /* 더 공격적으로 축소 */
                        padding-top: 2px !important;
                        padding-bottom: 2px !important;
                        margin-bottom: 4px !important;
                    }
                    .status-box h6 {
                        font-size: 13px !important;
                        line-height: 1.2 !important;
                    }
                    .status-box p {
                        font-size: 9px !important;
                        line-height: 1.1 !important;
                    }
                    /* 기수별 페이지 넘김 설정 */
                    .print-page-break {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    /* 테이블 인쇄 압축 */
                    .MuiTableCell-root {
                        padding: 1px 4px !important; /* 초밀착 패딩 */
                        font-size: 9.5px !important; /* 글자 크기 극한 축소 */
                        line-height: 1.1 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .MuiTableHead-root .MuiTableCell-root {
                        height: 22px !important;
                        font-weight: bold !important;
                    }
                }
            ` }} />

            <Box id="monthly-award-print-area" sx={{ p: 2 }}>

                {/* 인쇄 전용 헤더 (화면에서는 숨김) */}
                <Box className="print-header" sx={{ display: 'none' }}>
                    <img src="/login.png" alt="logo" className="print-logo" />
                    <Typography className="print-company-name">
                        (주)브이아이피플러스
                    </Typography>
                </Box>

                {/* Page 1: 요약 + Matrix 를 하나로 묶어 페이지 넘김 방지 */}
                <Box className="print-page-break">
                    {/* 월간 시상 현황 요약 */}
                    <Paper elevation={2} sx={{ p: 1, mb: 0.5, borderRadius: 2 }}>
                        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }} className="print-section-title">
                                {data.date} 월간시상 현황
                            </Typography>
                            <Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    startIcon={isExpanded ? <CloseIcon /> : <ExpandMoreIcon />}
                                    sx={{ mr: 1, display: { print: 'none' } }}
                                >
                                    {isExpanded ? '축소' : '확대'}
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={handlePrint}
                                    startIcon={<PrintIcon />}
                                    sx={{ mr: 1, display: { print: 'none' } }}
                                    color="success"
                                >
                                    인쇄
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => setShowSettings(true)}
                                    startIcon={<EditIcon />}
                                    sx={{ display: { print: 'none' } }}
                                >
                                    셋팅
                                </Button>
                            </Box>
                        </Box>

                        <Grid container spacing={1}>
                            <Grid item xs={12} md={4}>
                                <Box className="indicator-box" sx={{ textAlign: 'center', p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                    <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                                        {data.indicators.change105Above.percentage}%
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        기변105이상 ({Math.round(data.indicators.change105Above.numerator)} / {Math.round(data.indicators.change105Above.denominator)})
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box className="indicator-box" sx={{ textAlign: 'center', p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                    <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                                        {data.indicators.strategicProducts.percentage}%
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        전략상품 ({Math.round(data.indicators.strategicProducts.numerator)} / {Math.round(data.indicators.strategicProducts.denominator)})
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box className="indicator-box" sx={{ textAlign: 'center', p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                    <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                                        {data.indicators.internetRatio.percentage}%
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        인터넷 비중 ({Math.round(data.indicators.internetRatio.numerator)} / {Math.round(data.indicators.internetRatio.denominator)})
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* 월간시상 Matrix */}
                    <Collapse in={isExpanded}>
                        <Paper elevation={2} sx={{ p: 1, mb: 0.5, borderRadius: 2 }}>
                            <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }} className="print-section-title">
                                월간시상 Matrix
                            </Typography>

                            {/* 만점기준 */}
                            <Box sx={{ mb: 1 }}>
                                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
                                    만점기준
                                </Typography>
                                <Grid container spacing={1}>
                                    <Grid item xs={12} md={3}>
                                        <Box className="status-box" sx={{ textAlign: 'center', py: 0.5, bgcolor: '#e3f2fd', borderRadius: 1, height: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>{data.totalMaxScore || 15}점</Typography>
                                            <Typography variant="body2" color="text.secondary">총점</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Box className="status-box" sx={{ textAlign: 'center', py: 0.5, bgcolor: '#fff3e0', borderRadius: 1, height: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>{data.maxScores?.change105 || 6}점</Typography>
                                            <Typography variant="body2" color="text.secondary">기변105이상</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Box className="status-box" sx={{ textAlign: 'center', py: 0.5, bgcolor: '#f3e5f5', borderRadius: 1, height: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>{data.maxScores?.strategic || 6}점</Typography>
                                            <Typography variant="body2" color="text.secondary">전략상품</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Box className="status-box" sx={{ textAlign: 'center', py: 0.5, bgcolor: '#fce4ec', borderRadius: 1, height: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 'bold' }}>{data.maxScores?.internet || 3}점</Typography>
                                            <Typography variant="body2" color="text.secondary">인터넷 비중</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Box>

                            {/* 달성상황 */}
                            <Box sx={{ mb: 1 }}>
                                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
                                    달성상황
                                </Typography>
                                <Grid container spacing={1}>
                                    <Grid item xs={12} md={3}>
                                        <Box className="status-box" sx={{ textAlign: 'center', py: 0.5, bgcolor: '#e3f2fd', borderRadius: 1, height: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>{data.totalScore}점</Typography>
                                            <Typography variant="body2" color="text.secondary">총점</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Box className="status-box" sx={{ textAlign: 'center', py: 0.5, bgcolor: '#fff3e0', borderRadius: 1, height: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <Typography variant="h6" sx={{ color: getPerformanceColor(data.indicators.change105Above.percentage, 'change105'), fontWeight: 'bold' }}>
                                                {getPerformanceIcon(data.indicators.change105Above.percentage, 'change105')}
                                                {calculateScore(parseFloat(data.indicators.change105Above.percentage), data.matrixCriteria?.filter(c => c.indicator === 'change105') || [])}점
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                기변105이상
                                                <br />
                                                <Typography component="span" variant="caption">
                                                    ({Math.round(data.indicators.change105Above.numerator)} / {Math.round(data.indicators.change105Above.denominator)})
                                                </Typography>
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Box className="status-box" sx={{ textAlign: 'center', py: 0.5, bgcolor: '#f3e5f5', borderRadius: 1, height: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <Typography variant="h6" sx={{ color: getPerformanceColor(data.indicators.strategicProducts.percentage, 'strategic'), fontWeight: 'bold' }}>
                                                {getPerformanceIcon(data.indicators.strategicProducts.percentage, 'strategic')}
                                                {calculateScore(parseFloat(data.indicators.strategicProducts.percentage), data.matrixCriteria?.filter(c => c.indicator === 'strategic') || [])}점
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                전략상품
                                                <br />
                                                <Typography component="span" variant="caption">
                                                    ({Math.round(data.indicators.strategicProducts.numerator)} / {Math.round(data.indicators.strategicProducts.denominator)})
                                                </Typography>
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Box className="status-box" sx={{ textAlign: 'center', py: 0.5, bgcolor: '#fce4ec', borderRadius: 1, height: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <Typography variant="h6" sx={{ color: getPerformanceColor(data.indicators.internetRatio.percentage, 'internet'), fontWeight: 'bold' }}>
                                                {getPerformanceIcon(data.indicators.internetRatio.percentage, 'internet')}
                                                {calculateScore(parseFloat(data.indicators.internetRatio.percentage), data.matrixCriteria?.filter(c => c.indicator === 'internet') || [])}점
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                인터넷 비중
                                                <br />
                                                <Typography component="span" variant="caption">
                                                    ({Math.round(data.indicators.internetRatio.numerator)} / {Math.round(data.indicators.internetRatio.denominator)})
                                                </Typography>
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Box>

                            {/* Matrix 테이블 */}
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '25%' }}>점수</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', width: '25%' }}>기변105이상</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5', width: '25%' }}>전략상품</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fce4ec', width: '25%' }}>인터넷 비중</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {[6, 5, 4, 3, 2, 1].map((score) => {
                                            const change105Criteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'change105');
                                            const strategicCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'strategic');
                                            const internetCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'internet');

                                            return (
                                                <TableRow key={score}>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{score}점</TableCell>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            bgcolor: getMatrixCellColor(score, parseFloat(data.indicators.change105Above.percentage), 'change105'),
                                                            color: getMatrixCellColor(score, parseFloat(data.indicators.change105Above.percentage), 'change105') !== 'transparent' ? 'white' : 'inherit',
                                                            fontWeight: getMatrixCellColor(score, parseFloat(data.indicators.change105Above.percentage), 'change105') !== 'transparent' ? 'bold' : 'normal',
                                                            border: getMatrixCellColor(score, parseFloat(data.indicators.change105Above.percentage), 'change105') !== 'transparent' ? '2px solid rgba(255,255,255,0.3)' : 'none'
                                                        }}
                                                    >
                                                        {change105Criteria ? `${change105Criteria.percentage}% ${change105Criteria.description || ''}` : '-'}
                                                    </TableCell>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            bgcolor: getMatrixCellColor(score, parseFloat(data.indicators.strategicProducts.percentage), 'strategic'),
                                                            color: getMatrixCellColor(score, parseFloat(data.indicators.strategicProducts.percentage), 'strategic') !== 'transparent' ? 'white' : 'inherit',
                                                            fontWeight: getMatrixCellColor(score, parseFloat(data.indicators.strategicProducts.percentage), 'strategic') !== 'transparent' ? 'bold' : 'normal',
                                                            border: getMatrixCellColor(score, parseFloat(data.indicators.strategicProducts.percentage), 'strategic') !== 'transparent' ? '2px solid rgba(255,255,255,0.3)' : 'none'
                                                        }}
                                                    >
                                                        {strategicCriteria ? `${strategicCriteria.percentage}% ${strategicCriteria.description || ''}` : '-'}
                                                    </TableCell>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            bgcolor: getMatrixCellColor(score, parseFloat(data.indicators.internetRatio.percentage), 'internet'),
                                                            color: getMatrixCellColor(score, parseFloat(data.indicators.internetRatio.percentage), 'internet') !== 'transparent' ? 'white' : 'inherit',
                                                            fontWeight: getMatrixCellColor(score, parseFloat(data.indicators.internetRatio.percentage), 'internet') !== 'transparent' ? 'bold' : 'normal',
                                                            border: getMatrixCellColor(score, parseFloat(data.indicators.internetRatio.percentage), 'internet') !== 'transparent' ? '2px solid rgba(255,255,255,0.3)' : 'none'
                                                        }}
                                                    >
                                                        {score <= 3 ? (internetCriteria ? `${internetCriteria.percentage}% ${internetCriteria.description || ''}` : '-') : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Collapse>
                </Box>

                {/* 사무실별 + 부서별 현황 (Page 2) */}
                <Box className="print-page-break">
                    {/* 사무실별 현황 */}
                    <Paper elevation={2} sx={{ p: 2, mb: 1, borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }} className="print-section-title">
                                사무실별 현황
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setIsOfficeTableExpanded(!isOfficeTableExpanded)}
                                startIcon={isOfficeTableExpanded ? <CloseIcon /> : <ExpandMoreIcon />}
                                sx={{ display: { print: 'none' } }}
                            >
                                {isOfficeTableExpanded ? '축소' : '확대'}
                            </Button>
                        </Box>
                        <Collapse in={isOfficeTableExpanded}>
                            <TableContainer>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>순위</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>사무실</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e9' }}>무선모수</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>평균 총점</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>인원</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>기변105 Avg</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>전략상품 Avg</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fce4ec' }}>인터넷 Avg</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.officeGroups
                                            .sort((a, b) => b.averageTotalScore - a.averageTotalScore)
                                            .map((group, index) => (
                                                <TableRow key={index} hover sx={{
                                                    bgcolor: (group.averageTotalScore < targetTotalScore) ? '#d32f2f' : 'inherit',
                                                    transition: 'background-color 0.2s',
                                                    '& td': {
                                                        color: (group.averageTotalScore < targetTotalScore) ? '#ffffff !important' : 'inherit',
                                                        fontWeight: (group.averageTotalScore < targetTotalScore) ? 'bold' : 'inherit'
                                                    },
                                                    '& .MuiTypography-root': {
                                                        color: (group.averageTotalScore < targetTotalScore) ? '#ffffff !important' : 'inherit'
                                                    },
                                                    '& .MuiTypography-caption': {
                                                        color: (group.averageTotalScore < targetTotalScore) ? '#e0e0e0 !important' : 'text.secondary'
                                                    },
                                                    '&:hover': {
                                                        bgcolor: (group.averageTotalScore < targetTotalScore) ? '#f5f5f5 !important' : undefined,
                                                        '& td': {
                                                            color: (group.averageTotalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                        },
                                                        '& .MuiTypography-root': {
                                                            color: (group.averageTotalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                        },
                                                        '& .MuiTypography-caption': {
                                                            color: (group.averageTotalScore < targetTotalScore) ? 'text.secondary !important' : 'text.secondary'
                                                        }
                                                    }
                                                }}>
                                                    <TableCell align="center">{index + 1}</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{group.office}</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                                        {Math.round(group.totalInternetDenominator || 0)}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1.1rem' }}>
                                                        {group.averageTotalScore}점
                                                    </TableCell>
                                                    <TableCell align="center">{group.count}명</TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ color: getPerformanceColor(group.averageChange105Percentage || 0, 'change105'), fontWeight: 'bold' }}>
                                                                {group.averageChange105Percentage || 0}%
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                ({Math.round(group.totalChange105Numerator || 0)}/{Math.round(group.totalChange105Denominator || 0)})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({group.averageChange105Score}점)
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ color: getPerformanceColor(group.averageStrategicPercentage || 0, 'strategic'), fontWeight: 'bold' }}>
                                                                {group.averageStrategicPercentage || 0}%
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                ({Math.round(group.totalStrategicNumerator || 0)}/{Math.round(group.totalStrategicDenominator || 0)})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({group.averageStrategicScore}점)
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ color: getPerformanceColor(group.averageInternetPercentage || 0, 'internet'), fontWeight: 'bold' }}>
                                                                {group.averageInternetPercentage || 0}%
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                ({Math.round(group.totalInternetNumerator || 0)}/{Math.round(group.totalInternetDenominator || 0)})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({group.averageInternetScore}점)
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

                    {/* 부서별 현황 */}
                    <Paper elevation={2} sx={{ p: 2, mb: 1, borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }} className="print-section-title">
                                부서별 현황
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setIsDepartmentTableExpanded(!isDepartmentTableExpanded)}
                                startIcon={isDepartmentTableExpanded ? <CloseIcon /> : <ExpandMoreIcon />}
                                sx={{ display: { print: 'none' } }}
                            >
                                {isDepartmentTableExpanded ? '축소' : '확대'}
                            </Button>
                        </Box>
                        <Collapse in={isDepartmentTableExpanded}>
                            <TableContainer>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>순위</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>부서</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e9' }}>무선모수</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>평균 총점</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>인원</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>기변105 Avg</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>전략상품 Avg</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fce4ec' }}>인터넷 Avg</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.departmentGroups
                                            .sort((a, b) => b.averageTotalScore - a.averageTotalScore)
                                            .map((group, index) => (
                                                <TableRow key={index} hover sx={{
                                                    bgcolor: (group.averageTotalScore < targetTotalScore) ? '#d32f2f' : 'inherit',
                                                    transition: 'background-color 0.2s',
                                                    '& td': {
                                                        color: (group.averageTotalScore < targetTotalScore) ? '#ffffff !important' : 'inherit',
                                                        fontWeight: (group.averageTotalScore < targetTotalScore) ? 'bold' : 'inherit'
                                                    },
                                                    '& .MuiTypography-root': {
                                                        color: (group.averageTotalScore < targetTotalScore) ? '#ffffff !important' : 'inherit'
                                                    },
                                                    '& .MuiTypography-caption': {
                                                        color: (group.averageTotalScore < targetTotalScore) ? '#e0e0e0 !important' : 'text.secondary'
                                                    },
                                                    '&:hover': {
                                                        bgcolor: (group.averageTotalScore < targetTotalScore) ? '#f5f5f5 !important' : undefined,
                                                        '& td': {
                                                            color: (group.averageTotalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                        },
                                                        '& .MuiTypography-root': {
                                                            color: (group.averageTotalScore < targetTotalScore) ? 'inherit !important' : 'inherit'
                                                        },
                                                        '& .MuiTypography-caption': {
                                                            color: (group.averageTotalScore < targetTotalScore) ? 'text.secondary !important' : 'text.secondary'
                                                        }
                                                    }
                                                }}>
                                                    <TableCell align="center">{index + 1}</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{group.department}</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                                        {Math.round(group.totalInternetDenominator || 0)}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1.1rem' }}>
                                                        {group.averageTotalScore}점
                                                    </TableCell>
                                                    <TableCell align="center">{group.count}명</TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ color: getPerformanceColor(group.averageChange105Percentage || 0, 'change105'), fontWeight: 'bold' }}>
                                                                {group.averageChange105Percentage || 0}%
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                ({Math.round(group.totalChange105Numerator || 0)}/{Math.round(group.totalChange105Denominator || 0)})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({group.averageChange105Score}점)
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ color: getPerformanceColor(group.averageStrategicPercentage || 0, 'strategic'), fontWeight: 'bold' }}>
                                                                {group.averageStrategicPercentage || 0}%
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                ({Math.round(group.totalStrategicNumerator || 0)}/{Math.round(group.totalStrategicDenominator || 0)})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({group.averageStrategicScore}점)
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ color: getPerformanceColor(group.averageInternetPercentage || 0, 'internet'), fontWeight: 'bold' }}>
                                                                {group.averageInternetPercentage || 0}%
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                ({Math.round(group.totalInternetNumerator || 0)}/{Math.round(group.totalInternetDenominator || 0)})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({group.averageInternetScore}점)
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

                {/* 채널별 현황 (Page 3) */}
                <Box className="print-page-break">
                    <Paper elevation={2} sx={{ p: 2, mb: 1, borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }} className="print-section-title">
                                채널별 현황
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setIsAgentTableExpanded(!isAgentTableExpanded)}
                                startIcon={isAgentTableExpanded ? <CloseIcon /> : <ExpandMoreIcon />}
                                sx={{ display: { print: 'none' } }}
                            >
                                {isAgentTableExpanded ? '축소' : '확대'}
                            </Button>
                        </Box>
                        <Collapse in={isAgentTableExpanded}>
                            <TableContainer sx={{ maxHeight: { xs: 600, print: 'none' } }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>순위</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>담당자</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e9' }}>무선모수</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>총점</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>사무실</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>소속</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>기변105</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>전략상품</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fce4ec' }}>인터넷</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.agentDetails
                                            .sort((a, b) => b.totalScore - a.totalScore)
                                            .map((agent, index) => (
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
                                                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{agent.manager}</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                                        {Math.round(agent.internetRatio?.denominator || 0)}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1.1rem' }}>
                                                        {agent.totalScore}점
                                                    </TableCell>
                                                    <TableCell align="center">{agent.office}</TableCell>
                                                    <TableCell align="center">{agent.department}</TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ color: getPerformanceColor(agent.change105Above?.percentage || 0, 'change105'), fontWeight: 'bold' }}>
                                                                {agent.change105Above?.percentage || 0}%
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                ({Math.round(agent.change105Above?.numerator || 0)}/{Math.round(agent.change105Above?.denominator || 0)})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({agent.change105Above?.score || 0}점)
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ color: getPerformanceColor(agent.strategicProducts?.percentage || 0, 'strategic'), fontWeight: 'bold' }}>
                                                                {agent.strategicProducts?.percentage || 0}%
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                ({Math.round(agent.strategicProducts?.numerator || 0)}/{Math.round(agent.strategicProducts?.denominator || 0)})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({agent.strategicProducts?.score || 0}점)
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ color: getPerformanceColor(agent.internetRatio?.percentage || 0, 'internet'), fontWeight: 'bold' }}>
                                                                {agent.internetRatio?.percentage || 0}%
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                ({Math.round(agent.internetRatio?.numerator || 0)}/{Math.round(agent.internetRatio?.denominator || 0)})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({agent.internetRatio?.score || 0}점)
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

                {/* settings dialog */}
                <MonthlyAwardSettingsDialog
                    open={showSettings}
                    onClose={() => setShowSettings(false)}
                    data={data}
                    onRefresh={loadData}
                />
            </Box>
        </Box >
    );
}

