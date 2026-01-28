import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Divider,
    Alert,
    Chip
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { api } from '../../../../api'; // Correct path to src/api.js

const INDICATORS = [
    { id: 'change105', label: '기변105이상' },
    { id: 'strategic', label: '전략상품' },
    { id: 'internet', label: '인터넷 비중' }
];

export default function MatrixSettings({ initialCriteria, onSaveSuccess }) {
    const [criteria, setCriteria] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialCriteria) {
            setCriteria(JSON.parse(JSON.stringify(initialCriteria)));
        }
    }, [initialCriteria]);

    const handleAddRule = (indicatorId) => {
        const newRule = {
            indicator: indicatorId,
            score: 0,
            percentage: 0,
            description: ''
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
            // Sort by score descending within each indicator
            const sortedCriteria = [...criteria].sort((a, b) => b.score - a.score);

            await api.saveMonthlyAwardSettings('matrix_criteria', sortedCriteria);
            alert('저장되었습니다.');
            if (onSaveSuccess) onSaveSuccess();
        } catch (error) {
            alert('저장 실패: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={loading}
                >
                    {loading ? '저장 중...' : '변경사항 저장'}
                </Button>
            </Box>

            {INDICATORS.map(indicator => {
                const rules = criteria.filter(c => c.indicator === indicator.id)
                    .sort((a, b) => b.score - a.score);

                return (
                    <Accordion key={indicator.id} defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{indicator.label}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            {rules.length === 0 && (
                                <Alert severity="info" sx={{ mb: 2 }}>설정된 규칙이 없습니다.</Alert>
                            )}

                            {rules.map((rule, idx) => {
                                // Find actual index in main array to update
                                const realIndex = criteria.findIndex(c => c === rule);

                                return (
                                    <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <TextField
                                            label="점수"
                                            type="number"
                                            size="small"
                                            value={rule.score}
                                            onChange={(e) => handleChange(realIndex, 'score', parseFloat(e.target.value))}
                                            sx={{ width: 100 }}
                                        />
                                        <Typography variant="body1">점</Typography>

                                        <TextField
                                            label="기준 퍼센트"
                                            type="number"
                                            size="small"
                                            value={rule.percentage}
                                            onChange={(e) => handleChange(realIndex, 'percentage', parseFloat(e.target.value))}
                                            sx={{ width: 120 }}
                                        />
                                        <Typography variant="body1">%</Typography>

                                        <TextField
                                            label="설명 (옵션)"
                                            size="small"
                                            value={rule.description || ''}
                                            onChange={(e) => handleChange(realIndex, 'description', e.target.value)}
                                            placeholder="예: 이상, 달성"
                                            fullWidth
                                        />

                                        <IconButton color="error" onClick={() => handleDeleteRule(realIndex)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Paper>
                                );
                            })}

                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={() => handleAddRule(indicator.id)}
                            >
                                규칙 추가
                            </Button>
                        </AccordionDetails>
                    </Accordion>
                );
            })}
        </Box>
    );
}
