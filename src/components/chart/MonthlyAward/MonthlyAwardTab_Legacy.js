import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Tabs,
    Tab,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
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
    ShowChartIcon,
    Edit as EditIcon,
    TrendingUp as TrendingUpIcon,
    Assessment as AssessmentIcon,
    PieChart as PieChartIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { api } from '../../../api';

// 월간시상 탭 컴포넌트
export default function MonthlyAwardTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAgentTableExpanded, setIsAgentTableExpanded] = useState(true);
    const [isOfficeTableExpanded, setIsOfficeTableExpanded] = useState(true);
    const [isDepartmentTableExpanded, setIsDepartmentTableExpanded] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState(0); // 셋팅 다이얼로그에서 현재 탭 상태 관리

    // Matrix 기준값 상태
    const [matrixValues, setMatrixValues] = useState({});

    // 추가 전략상품 상태
    const [newStrategicProduct, setNewStrategicProduct] = useState({
        subCategory: '',
        serviceName: '',
        points: 0
    });

    // 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const result = await api.getMonthlyAwardData();
                setData(result);

                // Matrix 기준값 초기화
                if (result.matrixCriteria) {
                    const initialMatrixValues = {};
                    result.matrixCriteria.forEach(criterion => {
                        const key = `${criterion.indicator}-${criterion.score}`;
                        const descKey = `${criterion.indicator}-desc-${criterion.score}`;
                        initialMatrixValues[key] = criterion.percentage;
                        initialMatrixValues[descKey] = criterion.description || '';
                    });
                    setMatrixValues(initialMatrixValues);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Matrix 셀 색상 계산
    const getMatrixCellColor = (score, percentage) => {
        if (!data?.matrixCriteria) return '#ffffff';

        const criteria = data.matrixCriteria.find(c => c.score === score);
        if (!criteria) return '#ffffff';

        const targetPercentage = criteria.percentage;
        if (percentage >= targetPercentage) return '#4caf50'; // 녹색
        if (percentage >= targetPercentage * 0.8) return '#ff9800'; // 주황색
        return '#f44336'; // 빨간색
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

    // 달성 상태 텍스트 생성
    const getAchievementText = (percentage, indicator) => {
        if (!data?.matrixCriteria) return '미달';

        // 해당 지표의 최고 점수 기준값 찾기
        const maxCriteria = data.matrixCriteria
            .filter(c => c.indicator === indicator)
            .sort((a, b) => b.score - a.score)[0];

        if (!maxCriteria) return '미달';

        if (percentage >= maxCriteria.percentage) {
            return '달성';
        } else {
            const gap = (maxCriteria.percentage - percentage).toFixed(1);
            return `${gap}% 부족`;
        }
    };

    // 점수 계산 함수 (백엔드와 동일한 로직)
    const calculateScore = (percentage, criteria) => {
        if (!criteria || criteria.length === 0) return 0;

        // 기준값을 점수별로 정렬
        const sortedCriteria = [...criteria].sort((a, b) => b.score - a.score);

        for (const criterion of sortedCriteria) {
            if (criterion.description === '미만') {
                // 미만 조건: 해당 퍼센트 미만이면 해당 점수
                if (percentage < criterion.percentage) {
                    return criterion.score;
                }
            } else if (criterion.description === '만점') {
                // 만점 조건: 해당 퍼센트 이상이면 해당 점수
                if (percentage >= criterion.percentage) {
                    return criterion.score;
                }
            } else {
                // 이상 조건: 해당 퍼센트 이상이면 해당 점수
                if (percentage >= criterion.percentage) {
                    return criterion.score;
                }
            }
        }

        // 모든 조건을 만족하지 않으면 최소 점수 반환
        const minScore = Math.min(...criteria.map(c => c.score));
        return minScore;
    };

    // 추가 전략상품 핸들러
    const handleAddStrategicProduct = async () => {
        if (!newStrategicProduct.subCategory || !newStrategicProduct.serviceName || newStrategicProduct.points <= 0) {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        try {
            const updatedProducts = [
                ...(data.strategicProductsList || []),
                {
                    subCategory: newStrategicProduct.subCategory,
                    serviceCode: '', // 빈 값으로 설정
                    serviceName: newStrategicProduct.serviceName,
                    points: newStrategicProduct.points
                }
            ];

            await api.saveMonthlyAwardSettings('strategic_products', updatedProducts);

            // 데이터 새로고침
            const result = await api.getMonthlyAwardData();
            setData(result);

            // 입력 필드 초기화
            setNewStrategicProduct({
                subCategory: '',
                serviceName: '',
                points: 0
            });

            alert('전략상품이 추가되었습니다.');
        } catch (error) {
            alert('전략상품 추가 중 오류가 발생했습니다: ' + error.message);
        }
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
            {/* 헤더 정보 */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
                        {data.date} 월간시상 현황
                    </Typography>
                    <Box>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setIsExpanded(!isExpanded)}
                            startIcon={isExpanded ? <CloseIcon /> : <ShowChartIcon />}
                            sx={{ mr: 1 }}
                        >
                            {isExpanded ? '축소' : '확대'}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setShowSettings(true)}
                            startIcon={<EditIcon />}
                        >
                            셋팅
                        </Button>
                    </Box>
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                            <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                                {data.indicators.upsellChange.percentage}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">업셀기변</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                            <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                                {data.indicators.change105Above.percentage}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">기변105이상</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                            <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                                {data.indicators.strategicProducts.percentage}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">전략상품</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                            <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                                {data.indicators.internetRatio.percentage}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">인터넷 비중</Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* 월간시상 Matrix */}
            <Collapse in={isExpanded}>
                <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}>
                        월간시상 Matrix
                    </Typography>

                    {/* 만점기준 */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
                            만점기준
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e3f2fd', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>{data.totalMaxScore || 21}점</Typography>
                                    <Typography variant="body2" color="text.secondary">총점</Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e8f5e8', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>{data.maxScores?.upsell || 6}점</Typography>
                                    <Typography variant="body2" color="text.secondary">업셀기변</Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fff3e0', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>{data.maxScores?.change105 || 6}점</Typography>
                                    <Typography variant="body2" color="text.secondary">기변105이상</Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#f3e5f5', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>{data.maxScores?.strategic || 6}점</Typography>
                                    <Typography variant="body2" color="text.secondary">전략상품</Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fce4ec', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 'bold' }}>{data.maxScores?.internet || 3}점</Typography>
                                    <Typography variant="body2" color="text.secondary">인터넷 비중</Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>

                    {/* 달성상황 */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
                            달성상황
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e3f2fd', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>{data.totalScore}점</Typography>
                                    <Typography variant="body2" color="text.secondary">총점</Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e8f5e8', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                                        {getPerformanceIcon(data.indicators.upsellChange.percentage, 'upsell')}
                                        {calculateScore(parseFloat(data.indicators.upsellChange.percentage), data.matrixCriteria?.filter(c => c.indicator === 'upsell') || [])}점
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        업셀기변
                                    </Typography>

                                </Box>
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fff3e0', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>
                                        {getPerformanceIcon(data.indicators.change105Above.percentage, 'change105')}
                                        {calculateScore(parseFloat(data.indicators.change105Above.percentage), data.matrixCriteria?.filter(c => c.indicator === 'change105') || [])}점
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        기변105이상
                                    </Typography>

                                </Box>
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#f3e5f5', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>
                                        {getPerformanceIcon(data.indicators.strategicProducts.percentage, 'strategic')}
                                        {calculateScore(parseFloat(data.indicators.strategicProducts.percentage), data.matrixCriteria?.filter(c => c.indicator === 'strategic') || [])}점
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        전략상품
                                    </Typography>

                                </Box>
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fce4ec', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 'bold' }}>
                                        {getPerformanceIcon(data.indicators.internetRatio.percentage, 'internet')}
                                        {calculateScore(parseFloat(data.indicators.internetRatio.percentage), data.matrixCriteria?.filter(c => c.indicator === 'internet') || [])}점
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        인터넷 비중
                                    </Typography>

                                </Box>
                            </Grid>
                        </Grid>
                    </Box>

                    {/* Matrix 테이블 */}
                    <Collapse in={isExpanded}>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>점수</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e8' }}>업셀기변</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>기변105이상</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>전략상품</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fce4ec' }}>인터넷 비중</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {[6, 5, 4, 3, 2, 1].map((score) => {
                                        // 점수별 기준값 가져오기
                                        const upsellCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'upsell');
                                        const change105Criteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'change105');
                                        const strategicCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'strategic');
                                        const internetCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'internet');

                                        return (
                                            <TableRow key={score}>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>{score}점</TableCell>
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        bgcolor: getMatrixCellColor(score, parseFloat(data.indicators.upsellChange.percentage)),
                                                        color: getMatrixCellColor(score, parseFloat(data.indicators.upsellChange.percentage)) !== '#ffffff' ? 'white' : 'inherit'
                                                    }}
                                                >
                                                    {upsellCriteria ? `${upsellCriteria.percentage}% ${upsellCriteria.description || ''}` : '-'}
                                                </TableCell>
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        bgcolor: getMatrixCellColor(score, parseFloat(data.indicators.change105Above.percentage)),
                                                        color: getMatrixCellColor(score, parseFloat(data.indicators.change105Above.percentage)) !== '#ffffff' ? 'white' : 'inherit'
                                                    }}
                                                >
                                                    {change105Criteria ? `${change105Criteria.percentage}% ${change105Criteria.description || ''}` : '-'}
                                                </TableCell>
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        bgcolor: getMatrixCellColor(score, parseFloat(data.indicators.strategicProducts.percentage)),
                                                        color: getMatrixCellColor(score, parseFloat(data.indicators.strategicProducts.percentage)) !== '#ffffff' ? 'white' : 'inherit'
                                                    }}
                                                >
                                                    {strategicCriteria ? `${strategicCriteria.percentage}% ${strategicCriteria.description || ''}` : '-'}
                                                </TableCell>
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        bgcolor: getMatrixCellColor(score, parseFloat(data.indicators.internetRatio.percentage)),
                                                        color: getMatrixCellColor(score, parseFloat(data.indicators.internetRatio.percentage)) !== '#ffffff' ? 'white' : 'inherit'
                                                    }}
                                                >
                                                    {/* 인터넷 비중은 3점까지만 있음 */}
                                                    {score <= 3 ? (internetCriteria ? `${internetCriteria.percentage}% ${internetCriteria.description || ''}` : '-') : '-'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Collapse>
                </Paper>
            </Collapse>

            {/* 채널별 현황 */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
                        채널별 현황
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setIsAgentTableExpanded(!isAgentTableExpanded)}
                        startIcon={isAgentTableExpanded ? <CloseIcon /> : <ShowChartIcon />}
                    >
                        {isAgentTableExpanded ? '축소' : '확대'}
                    </Button>
                </Box>
                <Collapse in={isAgentTableExpanded}>
                    <TableContainer sx={{ maxHeight: 600 }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>순위</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>담당자</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>사무실</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>소속</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>총점</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e8' }}>업셀기변</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>기변105</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>전략상품</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fce4ec' }}>인터넷</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.agentDetails
                                    .sort((a, b) => b.totalScore - a.totalScore)
                                    .map((agent, index) => (
                                        <TableRow key={index} hover>
                                            <TableCell align="center">
                                                {index + 1}
                                                {index < 3 && <Typography component="span" sx={{ ml: 0.5 }}>👑</Typography>}
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>{agent.manager}</TableCell>
                                            <TableCell align="center">{agent.office}</TableCell>
                                            <TableCell align="center">{agent.department}</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                                                {agent.totalScore}점
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <Typography variant="body2">
                                                        {agent.upsellChange?.percentage || 0}%
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        ({agent.upsellChange?.score || 0}점)
                                                        {getAchievementText(parseFloat(agent.upsellChange?.percentage || 0), 'upsell') !== '달성' &&
                                                            ` ${getAchievementText(parseFloat(agent.upsellChange?.percentage || 0), 'upsell')}`
                                                        }
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <Typography variant="body2">
                                                        {agent.change105Above?.percentage || 0}%
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        ({agent.change105Above?.score || 0}점)
                                                        {getAchievementText(parseFloat(agent.change105Above?.percentage || 0), 'change105') !== '달성' &&
                                                            ` ${getAchievementText(parseFloat(agent.change105Above?.percentage || 0), 'change105')}`
                                                        }
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <Typography variant="body2">
                                                        {agent.strategicProducts?.percentage || 0}%
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        ({agent.strategicProducts?.score || 0}점)
                                                        {getAchievementText(parseFloat(agent.strategicProducts?.percentage || 0), 'strategic') !== '달성' &&
                                                            ` ${getAchievementText(parseFloat(agent.strategicProducts?.percentage || 0), 'strategic')}`
                                                        }
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <Typography variant="body2">
                                                        {agent.internetRatio?.percentage || 0}%
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

            {/* 사무실별 현황 */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
                        사무실별 현황
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setIsOfficeTableExpanded(!isOfficeTableExpanded)}
                        startIcon={isOfficeTableExpanded ? <CloseIcon /> : <ShowChartIcon />}
                    >
                        {isOfficeTableExpanded ? '축소' : '확대'}
                    </Button>
                </Box>
                <Collapse in={isOfficeTableExpanded}>
                    <TableContainer>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>사무실</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>인원</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>평균 총점</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e8' }}>업셀기변 Avg</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>기변105 Avg</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>전략상품 Avg</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fce4ec' }}>인터넷 Avg</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.officeGroups
                                    .sort((a, b) => b.averageTotalScore - a.averageTotalScore)
                                    .map((group, index) => (
                                        <TableRow key={index} hover>
                                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>{group.office}</TableCell>
                                            <TableCell align="center">{group.count}명</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                                                {group.averageTotalScore}점
                                            </TableCell>
                                            <TableCell align="center">{group.averageUpsellScore}점</TableCell>
                                            <TableCell align="center">{group.averageChange105Score}점</TableCell>
                                            <TableCell align="center">{group.averageStrategicScore}점</TableCell>
                                            <TableCell align="center">{group.averageInternetScore}점</TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Collapse>
            </Paper>

            {/* 부서별 현황 */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
                        부서별 현황
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setIsDepartmentTableExpanded(!isDepartmentTableExpanded)}
                        startIcon={isDepartmentTableExpanded ? <CloseIcon /> : <ShowChartIcon />}
                    >
                        {isDepartmentTableExpanded ? '축소' : '확대'}
                    </Button>
                </Box>
                <Collapse in={isDepartmentTableExpanded}>
                    <TableContainer>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>부서</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>인원</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>평균 총점</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e8' }}>업셀기변 Avg</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>기변105 Avg</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>전략상품 Avg</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fce4ec' }}>인터넷 Avg</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.departmentGroups
                                    .sort((a, b) => b.averageTotalScore - a.averageTotalScore)
                                    .map((group, index) => (
                                        <TableRow key={index} hover>
                                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>{group.department}</TableCell>
                                            <TableCell align="center">{group.count}명</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                                                {group.averageTotalScore}점
                                            </TableCell>
                                            <TableCell align="center">{group.averageUpsellScore}점</TableCell>
                                            <TableCell align="center">{group.averageChange105Score}점</TableCell>
                                            <TableCell align="center">{group.averageStrategicScore}점</TableCell>
                                            <TableCell align="center">{group.averageInternetScore}점</TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Collapse>
            </Paper>

            {/* 셋팅 팝업 (임시: 내용은 추후 리팩토링) */}
            <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="lg" fullWidth>
                <DialogTitle>월간시상 셋팅</DialogTitle>
                <DialogContent>
                    <Tabs value={settingsTab} onChange={(e, newValue) => setSettingsTab(newValue)} sx={{ mb: 3 }}>
                        <Tab label="Matrix 기준값" />
                        <Tab label="전략상품 관리" />
                    </Tabs>
                    {settingsTab === 0 && <Box><Typography>Matrix 설정(추후 구현)</Typography></Box>}
                    {settingsTab === 1 && <Box><Typography>전략상품 설정(추후 구현)</Typography></Box>}
                </DialogContent>
            </Dialog>
        </Box>
    );
}
