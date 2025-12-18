import React, { useState, useEffect } from 'react';
import { Box, Typography, Container, Tabs, Tab, Paper, Button, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import MobileListTab from '../direct/MobileListTab';
import CustomerPreferredStoreTab from './CustomerPreferredStoreTab';
import CustomerPurchaseQueueTab from './CustomerPurchaseQueueTab';
import CustomerGuidePage from './CustomerGuidePage';
import OpeningInfoPage from '../direct/OpeningInfoPage';

const CustomerDashboard = () => {
    const [tabValue, setTabValue] = useState(0);
    const [customerInfo, setCustomerInfo] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedStore, setSelectedStore] = useState(null);
    const [showGuidePage, setShowGuidePage] = useState(false);
    const [guidePageType, setGuidePageType] = useState(null);
    const [showOpeningInfo, setShowOpeningInfo] = useState(false);
    const navigate = useNavigate();

    // localStorage에서 선택 상태 복원
    useEffect(() => {
        const info = localStorage.getItem('customer_info');
        if (info) {
            setCustomerInfo(JSON.parse(info));
        } else {
            navigate('/member/login');
            return;
        }

        // 선택한 상품 정보 복원
        const savedProduct = localStorage.getItem('customer_selected_product');
        if (savedProduct) {
            try {
                setSelectedProduct(JSON.parse(savedProduct));
            } catch (e) {
                console.error('Failed to parse saved product:', e);
            }
        }

        // 선택한 매장 정보 복원
        const savedStore = localStorage.getItem('customer_selected_store');
        if (savedStore) {
            try {
                setSelectedStore(JSON.parse(savedStore));
            } catch (e) {
                console.error('Failed to parse saved store:', e);
            }
        }
    }, [navigate]);

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
        setShowGuidePage(false);
    };

    const handleProductSelect = (product) => {
        console.log('Customer selected product:', product);
        setSelectedProduct(product);
        // localStorage에 저장
        localStorage.setItem('customer_selected_product', JSON.stringify(product));
        
        // 매장이 선택되지 않았으면 안내 페이지 표시
        if (!selectedStore) {
            setGuidePageType('SELECT_STORE');
            setShowGuidePage(true);
        } else {
            // 매장이 이미 선택되어 있으면 개통정보 입력 페이지로
            setGuidePageType('READY_TO_ORDER');
            setShowGuidePage(true);
        }
    };

    const handleStoreSelect = (action, store) => {
        if (action === 'SELECT_PRODUCT') {
            // 매장을 먼저 선택한 경우
            setSelectedStore(store);
            localStorage.setItem('customer_selected_store', JSON.stringify(store));
            setGuidePageType('SELECT_PRODUCT');
            setShowGuidePage(true);
            setTabValue(0); // 휴대폰시세표 탭으로 이동
        } else if (action === 'SELECT_ORDER_INFO') {
            // 상품과 매장이 모두 선택된 경우
            setSelectedStore(store);
            localStorage.setItem('customer_selected_store', JSON.stringify(store));
            setGuidePageType('READY_TO_ORDER');
            setShowGuidePage(true);
        }
    };

    const handleGuideNavigate = () => {
        setShowGuidePage(false);
        if (guidePageType === 'SELECT_STORE') {
            setTabValue(1); // 선호구입매장 탭으로 이동
        } else if (guidePageType === 'SELECT_PRODUCT') {
            setTabValue(0); // 휴대폰시세표 탭으로 이동
        } else if (guidePageType === 'READY_TO_ORDER') {
            setShowOpeningInfo(true); // 개통정보 입력 페이지 표시
        }
    };

    const handleOpeningInfoBack = () => {
        setShowOpeningInfo(false);
        // 구매대기 탭으로 이동
        setTabValue(2);
    };

    const handleLogout = () => {
        localStorage.removeItem('customer_info');
        localStorage.removeItem('customer_selected_product');
        localStorage.removeItem('customer_selected_store');
        navigate('/member/login');
    };

    if (!customerInfo) return null;

    // 개통정보 입력 페이지 표시
    if (showOpeningInfo && selectedProduct && selectedStore) {
        return (
            <OpeningInfoPage
                initialData={{
                    ...selectedProduct,
                    customerName: customerInfo.name,
                    customerContact: customerInfo.ctn,
                    carrier: selectedProduct.carrier || customerInfo.carrier
                }}
                onBack={handleOpeningInfoBack}
                mode="customer"
                customerInfo={customerInfo}
                selectedStore={selectedStore}
                saveToSheet="purchaseQueue"
            />
        );
    }

    // 안내 페이지 표시
    if (showGuidePage) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <CustomerGuidePage
                    type={guidePageType}
                    onNavigate={handleGuideNavigate}
                    onBack={() => setShowGuidePage(false)}
                />
            </Container>
        );
    }

    const handleModeToggle = (e, newValue) => {
        if (newValue !== null && newValue === '업체') {
            // 업체 화면으로 이동 (루트 경로)
            navigate('/');
        }
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            {/* 업체/맴버 토글 - 화면 맨 상단 왼쪽 */}
            <Box sx={{ mb: 2 }}>
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
                    <ToggleButton value="업체" aria-label="업체 화면">
                        업체
                    </ToggleButton>
                    <ToggleButton value="맴버" aria-label="맴버 화면">
                        맴버
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{customerInfo.name}님, 안녕하세요!</Typography>
                    <Typography variant="body1" color="text.secondary">
                        가입 모델: {customerInfo.model} ({customerInfo.carrier}) | 개통일: {customerInfo.soldAt ? new Date(customerInfo.soldAt).toLocaleDateString() : '정보 없음'}
                    </Typography>
                </Box>
                <Button variant="outlined" color="inherit" onClick={handleLogout}>로그아웃</Button>
            </Box>

            <Paper sx={{ width: '100%', mb: 2 }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="fullWidth"
                >
                    <Tab label="휴대폰 시세표" />
                    <Tab label="선호 구입 매장" />
                    <Tab label="나의 구매 대기" />
                </Tabs>
            </Paper>

            <Box sx={{ p: tabValue === 0 ? 0 : 3, bgcolor: '#fff', borderRadius: 2, boxShadow: 1, minHeight: '400px', overflow: 'hidden' }}>
                {tabValue === 0 && (
                    <Box>
                        <MobileListTab onProductSelect={handleProductSelect} isCustomerMode={true} />
                    </Box>
                )}
                {tabValue === 1 && (
                    <Box>
                        <CustomerPreferredStoreTab
                            selectedProduct={selectedProduct}
                            customerInfo={customerInfo}
                            onStoreConfirm={handleStoreSelect}
                        />
                    </Box>
                )}
                {tabValue === 2 && (
                    <Box sx={{ p: 3 }}>
                        <CustomerPurchaseQueueTab customerInfo={customerInfo} />
                    </Box>
                )}
            </Box>
        </Container>
    );
};

export default CustomerDashboard;
