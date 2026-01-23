import React, { useState } from 'react';
import { Box, Container, TextField, Button, Typography, Paper, Alert, CircularProgress, Divider, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const CustomerLogin = () => {
    const [ctn, setCtn] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!ctn || !password) {
            setError('전화번호와 비밀번호를 입력해주세요.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 첫구매 어드민 계정 체크 (하드코딩)
            if (ctn === '1234' && password === '5678') {
                // 첫구매 어드민 계정 정보 생성
                const adminCustomer = {
                    ctn: '1234',
                    name: '첫구매 회원',
                    model: '',
                    carrier: '',
                    soldAt: null,
                    isFirstPurchaseAdmin: true, // 첫구매 어드민 플래그
                    publicIdStatus: 'before' // 공개아이디(아이디부여전)
                };
                localStorage.setItem('customer_info', JSON.stringify(adminCustomer));
                navigate('/member/dashboard');
                return;
            }

            const API_URL = process.env.REACT_APP_API_URL || '';
            const response = await axios.post(`${API_URL}/api/member/login`, {
                ctn,
                password
            });

            if (response.data.success) {
                // 로그인 정보 저장
                localStorage.setItem('customer_info', JSON.stringify(response.data.customer));
                navigate('/member/dashboard');
            } else {
                setError(response.data.error || '로그인에 실패했습니다.');
            }
        } catch (err) {
            console.error('Customer login error:', err);
            setError(err.response?.data?.error || '로그인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleModeToggle = (e, newValue) => {
        if (newValue !== null && newValue === '업체') {
            // 업체 화면으로 이동 (루트 경로)
            navigate('/');
        }
    };

    return (
        <>
            {/* 업체/맴버 토글 - 전체 화면 기준 상단 오른쪽 (Container 밖) */}
            <Box sx={{
                position: 'fixed',
                top: 16,
                right: 16,
                zIndex: 1000
            }}>
                <ToggleButtonGroup
                    value="맴버"
                    exclusive
                    onChange={handleModeToggle}
                    aria-label="로그인 타입 선택"
                    size="small"
                    sx={{
                        '& .MuiToggleButton-root': {
                            px: 2,
                            py: 0.5,
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            '&.Mui-selected': {
                                bgcolor: 'primary.main',
                                color: 'white',
                                '&:hover': {
                                    bgcolor: 'primary.dark',
                                }
                            }
                        }
                    }}
                >
                    <ToggleButton value="업체" aria-label="업체 로그인">
                        업체
                    </ToggleButton>
                    <ToggleButton value="맴버" aria-label="맴버 로그인">
                        맴버
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Container maxWidth="xs" sx={{ mt: 8 }}>
                <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
                    {/* 로고 */}
                    <Box sx={{ mb: 3 }}>
                        <img
                            src="/login.png"
                            alt="(주)브이아이피플러스"
                            style={{
                                maxWidth: '180px',
                                height: 'auto',
                                marginBottom: '10px'
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                        <Typography variant="h6" color="text.secondary" sx={{ fontSize: '1.1rem', fontWeight: 500 }}>
                            (주)브이아이피플러스
                        </Typography>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Box component="form" onSubmit={handleLogin} sx={{ mt: 2 }} autoComplete="off">
                        <TextField
                            fullWidth
                            label="아이디"
                            variant="outlined"
                            margin="normal"
                            value={ctn}
                            onChange={(e) => setCtn(e.target.value)}
                            disabled={loading}
                            autoComplete="off"
                        />
                        <TextField
                            fullWidth
                            label="비밀번호"
                            type="password"
                            variant="outlined"
                            margin="normal"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleLogin(e);
                                }
                            }}
                            disabled={loading}
                            autoComplete="new-password"
                            inputProps={{
                                autocomplete: "new-password",
                                form: {
                                    autocomplete: "off"
                                }
                            }}
                        />
                        <Button
                            fullWidth
                            type="submit"
                            variant="contained"
                            color="primary"
                            sx={{ mt: 3, mb: 2, height: '50px', position: 'relative' }}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={24} sx={{ position: 'absolute' }} /> : '로그인'}
                        </Button>
                    </Box>

                    {/* 홍보문구 개선 */}
                    <Box sx={{ mt: 4, textAlign: 'left', p: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                        <Typography variant="h5" color="primary" sx={{ fontWeight: 700, mb: 1.5 }}>
                            투명한 정찰제 가격
                        </Typography>
                        <Typography variant="h6" color="primary" sx={{ fontWeight: 600, mb: 1 }}>
                            호갱걱정 NO · 사후관리걱정 NO
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600, mb: 2, lineHeight: 1.6 }}>
                            실시간 공개되는 최신 시세와<br />
                            검증된 업체의 안정적인 서비스
                        </Typography>
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, textAlign: 'left' }}>
                                ✓ 임직원 30명 · 파트너점 480여 업체
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, textAlign: 'left' }}>
                                ✓ 16년 이상의 검증된 업력
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
                                ✓ 안정적인 재무 구조
                            </Typography>
                        </Box>
                        <Typography variant="body1" color="primary" sx={{ fontWeight: 600, mt: 2, textAlign: 'left' }}>
                            휴대폰 구매! 앞으로는 브이아이피플러스와 함께하세요
                        </Typography>
                    </Box>
                </Paper>
            </Container>
        </>
    );
};

export default CustomerLogin;
