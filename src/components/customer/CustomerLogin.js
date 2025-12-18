import React, { useState } from 'react';
import { Box, Container, TextField, Button, Typography, Paper, Alert, CircularProgress, Divider } from '@mui/material';
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

    return (
        <Container maxWidth="xs" sx={{ mt: 8 }}>
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
                <img src="/logo.png" alt="VIP Plus" style={{ width: '200px', marginBottom: '20px' }}
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/200x50?text=VIP+PLUS'; }} />

                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>고객 로그인</Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Box component="form" onSubmit={handleLogin} sx={{ mt: 2 }}>
                    <TextField
                        fullWidth
                        label="휴대폰 번호 (CTN)"
                        variant="outlined"
                        margin="normal"
                        value={ctn}
                        onChange={(e) => setCtn(e.target.value)}
                        placeholder="01012345678"
                        disabled={loading}
                    />
                    <TextField
                        fullWidth
                        label="비밀번호"
                        type="password"
                        variant="outlined"
                        margin="normal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="전화번호 가운데 4자리"
                        disabled={loading}
                        helperText="010 다음 숫자 4자리를 입력하세요"
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

                <Box sx={{ mt: 4, textAlign: 'center', p: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 700, mb: 2 }}>
                        호갱걱정 NO
                    </Typography>
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 700, mb: 2 }}>
                        사후관리걱정 NO
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600, mb: 1 }}>
                        실시간으로 공개되는 투명한 정찰제 가격
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        임직원 30명
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        당사 거래 파트너점 25년12월기준 480여 업체
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        16년 이상의 업력에서 나오는 안정적 재무 구조의 검증된 기업
                    </Typography>
                    <Typography variant="body1" color="primary" sx={{ fontWeight: 600, mt: 2 }}>
                        휴대폰 구매! 앞으로 브이아이피플러스와 함께하세요
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
};

export default CustomerLogin;
