import React, { useState } from 'react';
import {
    Box,
    Paper,
    Tabs,
    Tab,
    Typography,
    TextField,
    Button,
    Grid,
    Divider,
    Stack,
    Alert
} from '@mui/material';
import { Save as SaveIcon, Link as LinkIcon } from '@mui/icons-material';

const LinkSettingsTab = () => {
    const [carrierTab, setCarrierTab] = useState(0);

    const handleCarrierChange = (event, newValue) => {
        setCarrierTab(newValue);
    };

    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                링크 및 범위 설정
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
                구글 스프레드시트의 링크와 데이터 범위를 설정하여 실시간 데이터를 연동합니다.
            </Alert>

            {/* 통신사 탭 */}
            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={carrierTab}
                    onChange={handleCarrierChange}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="fullWidth"
                >
                    <Tab label="SK Telecom" />
                    <Tab label="KT" />
                    <Tab label="LG U+" />
                </Tabs>
            </Paper>

            <Stack spacing={3}>
                {/* 요금제 그룹 설정 */}
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                            요금제 그룹 설정
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                label="구글 시트 링크"
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="데이터 범위"
                                placeholder="시트명!A1:C20"
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Button variant="contained" startIcon={<SaveIcon />}>
                                설정 저장
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                {/* 공시지원금 설정 */}
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                            공시지원금 설정
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                label="구글 시트 링크"
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="데이터 범위"
                                placeholder="시트명!A1:E100"
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Button variant="contained" startIcon={<SaveIcon />}>
                                설정 저장
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                {/* 정책표 설정 */}
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                            정책표 설정
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                label="구글 시트 링크"
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="데이터 범위"
                                placeholder="시트명!A1:F100"
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Button variant="contained" startIcon={<SaveIcon />}>
                                설정 저장
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>
            </Stack>
        </Box>
    );
};

export default LinkSettingsTab;
