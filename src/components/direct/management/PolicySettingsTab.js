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
    InputAdornment
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

const PolicySettingsTab = () => {
    const [carrierTab, setCarrierTab] = useState(0);

    const handleCarrierChange = (event, newValue) => {
        setCarrierTab(newValue);
    };

    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                정책 설정
            </Typography>

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

            <Grid container spacing={3}>
                {/* 마진 설정 */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">
                            마진 설정
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <TextField
                                label="기본 마진"
                                type="number"
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">원</InputAdornment>,
                                }}
                                fullWidth
                            />
                            <TextField
                                label="추가 마진 (MNP)"
                                type="number"
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">원</InputAdornment>,
                                }}
                                fullWidth
                            />
                            <TextField
                                label="추가 마진 (기변)"
                                type="number"
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">원</InputAdornment>,
                                }}
                                fullWidth
                            />
                            <Button variant="contained" startIcon={<SaveIcon />}>
                                저장
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>

                {/* 부가서비스 설정 */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">
                            부가서비스 차감 설정
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                                <Typography variant="subtitle2" gutterBottom>우주패스</Typography>
                                <TextField
                                    label="미유치 시 차감액"
                                    size="small"
                                    fullWidth
                                    sx={{ mb: 1 }}
                                />
                            </Box>
                            <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                                <Typography variant="subtitle2" gutterBottom>보험</Typography>
                                <TextField
                                    label="미유치 시 차감액"
                                    size="small"
                                    fullWidth
                                    sx={{ mb: 1 }}
                                />
                            </Box>
                            <Button variant="contained" startIcon={<SaveIcon />}>
                                저장
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>

                {/* 별도 정책 설정 */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">
                            별도 정책 설정
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <TextField
                                label="정책표 차감"
                                type="number"
                                helperText="정책표 금액에서 일괄 차감할 금액"
                                fullWidth
                            />
                            <TextField
                                label="특별 추가 정책"
                                type="number"
                                helperText="특정 조건 만족 시 추가"
                                fullWidth
                            />
                            <Button variant="contained" startIcon={<SaveIcon />}>
                                저장
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default PolicySettingsTab;
