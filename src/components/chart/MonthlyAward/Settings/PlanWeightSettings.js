import React, { useState } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Paper,
    Divider,
    Alert
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import axios from 'axios';

const PlanWeightSettings = ({ data, onRefresh }) => {
    const [weights, setWeights] = useState(data?.planWeightsList || []);
    const [newKeyword, setNewKeyword] = useState('');
    const [newPoints, setNewPoints] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleAdd = () => {
        if (!newKeyword || isNaN(newPoints)) {
            alert('키워드와 올바른 점수를 입력해주세요.');
            return;
        }

        const newEntry = {
            keyword: newKeyword.trim(),
            points: parseFloat(newPoints)
        };

        setWeights([...weights, newEntry]);
        setNewKeyword('');
        setNewPoints('');
    };

    const handleDelete = (index) => {
        const newWeights = weights.filter((_, i) => i !== index);
        setWeights(newWeights);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await axios.post('/api/monthly-award/settings', {
                type: 'plan_weights',
                data: weights
            });
            alert('저장되었습니다.');
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('저장 실패:', error);
            alert('저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                요금제 가중치 관리
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                요금제 명칭에 특정 키워드가 포함될 경우 적용할 포인트 가중치를 설정합니다. (기본값: 1.0)
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                예: '티빙' 키워드에 1.2점을 설정하면 '5G 프리미어 에센셜 (티빙)' 요금제 유치 시 1.2점이 집계됩니다.
            </Alert>

            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f9f9f9' }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        size="small"
                        label="키워드 (예: 티빙)"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        sx={{ flexGrow: 1 }}
                    />
                    <TextField
                        size="small"
                        label="가중치 (예: 1.2)"
                        type="number"
                        value={newPoints}
                        onChange={(e) => setNewPoints(e.target.value)}
                        sx={{ width: 120 }}
                    />
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAdd}
                    >
                        추가
                    </Button>
                </Box>
            </Paper>

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead sx={{ bgcolor: '#eee' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>키워드</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }} align="center">가중치 (점수)</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }} align="right">작동</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {weights.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                                    등록된 가중치가 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            weights.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.keyword}</TableCell>
                                    <TableCell align="center">{item.points}</TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" color="error" onClick={() => handleDelete(index)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={isSaving}
                    size="large"
                >
                    {isSaving ? '저장 중...' : '설정 저장하기'}
                </Button>
            </Box>
        </Box>
    );
};

export default PlanWeightSettings;
