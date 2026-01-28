import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Tabs,
    Tab,
    Box,
    IconButton,
    Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import MatrixSettings from './MatrixSettings';
import StrategicProductSettings from './StrategicProductSettings';
import PlanWeightSettings from './PlanWeightSettings';

export default function MonthlyAwardSettingsDialog({ open, onClose, data, onRefresh }) {
    const [tabIndex, setTabIndex] = useState(0);

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue);
    };

    const handleSaveSuccess = () => {
        if (onRefresh) {
            onRefresh(); // 데이터 새로고침
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    월간시상 셋팅
                </Typography>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{ color: (theme) => theme.palette.grey[500] }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={tabIndex} onChange={handleTabChange}>
                        <Tab label="Matrix 기준값" />
                        <Tab label="전략상품 관리" />
                        <Tab label="요금제 가중치 관리" />
                    </Tabs>
                </Box>

                {tabIndex === 0 && (
                    <MatrixSettings
                        initialCriteria={data?.matrixCriteria || []}
                        onSaveSuccess={handleSaveSuccess}
                    />
                )}
                {tabIndex === 1 && (
                    <StrategicProductSettings
                        initialProducts={data?.strategicProductsList || []}
                        unmatchedProducts={data?.unmatchedItems?.strategicProducts || []}
                        onSaveSuccess={handleSaveSuccess}
                    />
                )}
                {tabIndex === 2 && (
                    <PlanWeightSettings
                        data={data}
                        onRefresh={onRefresh}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
