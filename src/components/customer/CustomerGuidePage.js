import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * 고객모드 안내 페이지 컴포넌트
 * @param {string} type - 'SELECT_STORE' | 'SELECT_PRODUCT' | 'READY_TO_ORDER'
 * @param {function} onNavigate - 탭 이동 콜백 함수
 * @param {function} onBack - 뒤로가기 콜백 함수
 */
const CustomerGuidePage = ({ type, onNavigate, onBack }) => {
    const navigate = useNavigate();

    const getMessage = () => {
        switch (type) {
            case 'SELECT_STORE':
                return '선호매장을 선택해주세요';
            case 'SELECT_PRODUCT':
                return '휴대폰시세표 탭을 통해 구입하실 휴대폰을 선택합니다';
            case 'READY_TO_ORDER':
                return '이제 개통정보 입력을 통해 구입을 예약해주세요. 입력된 정보는 수정 및 삭제가 직접 가능합니다.';
            default:
                return '';
        }
    };

    const getButtonText = () => {
        switch (type) {
            case 'SELECT_STORE':
                return '선호구입매장 탭으로 이동';
            case 'SELECT_PRODUCT':
                return '휴대폰시세표 탭으로 이동';
            case 'READY_TO_ORDER':
                return '개통정보 입력 페이지로 이동';
            default:
                return '';
        }
    };

    const handleNavigate = () => {
        if (onNavigate) {
            onNavigate();
        }
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    return (
        <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '400px',
            p: 3
        }}>
            <Paper 
                elevation={3} 
                sx={{ 
                    p: 4, 
                    textAlign: 'center',
                    maxWidth: 500,
                    width: '100%'
                }}
            >
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={handleBack}
                    sx={{ mb: 2, alignSelf: 'flex-start' }}
                >
                    뒤로가기
                </Button>
                
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, color: 'primary.main' }}>
                    {getMessage()}
                </Typography>

                <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={handleNavigate}
                    sx={{ mt: 2, py: 1.5 }}
                >
                    {getButtonText()}
                </Button>
            </Paper>
        </Box>
    );
};

export default CustomerGuidePage;

