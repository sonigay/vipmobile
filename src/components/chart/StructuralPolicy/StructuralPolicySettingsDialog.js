import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Typography,
    Box,
    TextField,
    Paper
} from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { API_BASE_URL } from '../../../api';

export default function StructuralPolicySettingsDialog({ open, onClose, initialCriteria, onSaveSuccess }) {
    const [criteria, setCriteria] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        console.log('[SettingsDialog] initialCriteria changed:', initialCriteria);
        if (initialCriteria && initialCriteria.length > 0) {
            setCriteria(JSON.parse(JSON.stringify(initialCriteria)));
        }
    }, [initialCriteria, open]);

    const handleAddRule = (indicator) => {
        const newRule = {
            indicator,
            score: 0,
            percentage: 0,
            description: '이상'
        };
        setCriteria([...criteria, newRule]);
    };

    const handleDeleteRule = (index) => {
        const newCriteria = [...criteria];
        newCriteria.splice(index, 1);
        setCriteria(newCriteria);
    };

    const handleChange = (index, field, value) => {
        const newCriteria = [...criteria];
        newCriteria[index] = { ...newCriteria[index], [field]: value };
        setCriteria(newCriteria);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/structural-policy/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ criteria })
            });

            if (!response.ok) throw new Error('설정 저장 실패');

            alert('저장되었습니다.');
            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (error) {
            alert('오류 발생: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box component="span" sx={{ variant: 'h6', fontWeight: 'bold' }}>구조정책 기준 설정</Box>
                <IconButton onClick={onClose} sx={{ color: (theme) => theme.palette.grey[500] }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#1976d2' }}>MNP 비중 기준 (Max 5점)</Typography>
                    {criteria.filter(c => c.indicator === 'mnp').sort((a, b) => b.score - a.score).map((rule, idx) => {
                        const realIdx = criteria.findIndex(c => c === rule);
                        return (
                            <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <TextField
                                    label="점수" type="number" size="small" sx={{ width: 80 }}
                                    value={rule.score ?? ""}
                                    onChange={(e) => handleChange(realIdx, 'score', parseInt(e.target.value) || 0)}
                                />
                                <Typography>점:</Typography>
                                <TextField
                                    label="기준 %" type="number" size="small" sx={{ width: 100 }}
                                    value={rule.percentage ?? ""}
                                    onChange={(e) => handleChange(realIdx, 'percentage', parseFloat(e.target.value) || 0)}
                                />
                                <Typography>% 이상</Typography>
                                <Box sx={{ flexGrow: 1 }} />
                                <IconButton color="error" onClick={() => handleDeleteRule(realIdx)}><DeleteIcon /></IconButton>
                            </Paper>
                        );
                    })}
                    <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={() => handleAddRule('mnp')}>MNP 규칙 추가</Button>
                </Box>

                <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#9c27b0' }}>고가치 비중 기준 (Max 5점)</Typography>
                    {criteria.filter(c => c.indicator === 'highValue').sort((a, b) => b.score - a.score).map((rule, idx) => {
                        const realIdx = criteria.findIndex(c => c === rule);
                        return (
                            <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <TextField
                                    label="점수" type="number" size="small" sx={{ width: 80 }}
                                    value={rule.score ?? ""}
                                    onChange={(e) => handleChange(realIdx, 'score', parseInt(e.target.value) || 0)}
                                />
                                <Typography>점:</Typography>
                                <TextField
                                    label="기준 %" type="number" size="small" sx={{ width: 100 }}
                                    value={rule.percentage ?? ""}
                                    onChange={(e) => handleChange(realIdx, 'percentage', parseFloat(e.target.value) || 0)}
                                />
                                <Typography>% 이상</Typography>
                                <Box sx={{ flexGrow: 1 }} />
                                <IconButton color="error" onClick={() => handleDeleteRule(realIdx)}><DeleteIcon /></IconButton>
                            </Paper>
                        );
                    })}
                    <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={() => handleAddRule('highValue')}>고가치 규칙 추가</Button>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>취소</Button>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={loading}>
                    {loading ? '저장 중...' : '설정 저장'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
