import React, { useState, useEffect } from 'react';
import { Box, Typography, Container, Tabs, Tab, Paper, Button, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import MobileListTab from '../direct/MobileListTab';
import CustomerPreferredStoreTab from './CustomerPreferredStoreTab';
import CustomerPurchaseQueueTab from './CustomerPurchaseQueueTab';
import CustomerPurchaseHistoryTab from './CustomerPurchaseHistoryTab';
import CustomerBoardTab from './CustomerBoardTab';
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
        // 나의구매대기(2)와 나의구매내역(3) 탭은 익명 계정에서 접근 제한 (Tab 컴포넌트의 disabled로 처리될 수 있으나 핸들러에서도 이중 확인)
        if (customerInfo?.isFirstPurchaseAdmin && customerInfo?.publicIdStatus === 'before') {
            if (newValue === 2 || newValue === 3) {
                return;
            }
        }
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
        // 첫구매 어드민이 아니고 정상 회원인 경우에만 구매대기 탭으로 이동
        if (!(customerInfo?.isFirstPurchaseAdmin && customerInfo?.publicIdStatus === 'before')) {
            setTabValue(2);
        } else {
            setTabValue(0); // 첫구매 어드민은 홈(휴대폰 시세표)으로
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('customer_info');
        localStorage.removeItem('customer_selected_product');
        localStorage.removeItem('customer_selected_store');
        localStorage.removeItem('vip_session');
        localStorage.removeItem('loginState');
        navigate('/member/login');
    };

    if (!customerInfo) return null;

    // 개통정보 입력 페이지 표시
    if (showOpeningInfo && selectedProduct && selectedStore) {
        return (
            <OpeningInfoPage
                initialData={{
                    ...selectedProduct,
                    customerName: '', // 초기값 빈칸
                    customerContact: '', // 초기값 빈칸
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

    return (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                mb: 3,
                gap: 2
            }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                        {customerInfo.isFirstPurchaseAdmin ? '반갑습니다! 첫 구매를 환영합니다.' : `${customerInfo.name}님, 안녕하세요!`}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        가입 모델: {customerInfo.model} ({customerInfo.carrier}) | 개통일: {customerInfo.soldAt ? new Date(customerInfo.soldAt).toLocaleDateString() : '정보 없음'}
                    </Typography>
                </Box>
                <Button variant="outlined" color="inherit" onClick={handleLogout} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>
                    로그아웃
                </Button>
            </Box>

            <Paper sx={{ width: '100%', mb: 2, overflow: 'hidden' }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        '& .MuiTab-root': {
                            fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' },
                            minWidth: { xs: 'auto', sm: 'auto' },
                            px: { xs: 1, sm: 2 }
                        }
                    }}
                >
                    <Tab label="휴대폰 시세표" />
                    <Tab label="선호 구입 매장" />
                    <Tab
                        label="나의 구매 대기"
                        disabled={customerInfo?.isFirstPurchaseAdmin && customerInfo?.publicIdStatus === 'before'}
                    />
                    <Tab
                        label="나의 구매 내역"
                        disabled={customerInfo?.isFirstPurchaseAdmin && customerInfo?.publicIdStatus === 'before'}
                    />
                    <Tab label="게시판" />
                </Tabs>
            </Paper>


            <Box sx={{
                p: { xs: tabValue === 0 ? 0 : 0, sm: tabValue === 0 ? 0 : 3 },
                bgcolor: '#fff',
                borderRadius: 2,
                boxShadow: 1,
                minHeight: { xs: '300px', sm: '400px' },
                overflow: tabValue === 1 ? 'visible' : 'hidden', // 선호구입매장 탭에서는 스크롤 가능하도록
                maxHeight: tabValue === 1 ? 'none' : { xs: 'calc(100vh - 300px)', sm: 'none' },
                height: tabValue === 1 ? 'auto' : { xs: 'calc(100vh - 250px)', sm: '100%' },
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
            }}>
                {tabValue === 0 && (
                    <Box sx={{
                        flex: '1 1 auto',
                        minHeight: 0,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <MobileListTab onProductSelect={handleProductSelect} isCustomerMode={true} />
                    </Box>
                )}
                {tabValue === 1 && (
                    <Box sx={{
                        width: '100%',
                        minHeight: 0,
                        flex: '1 1 auto'
                    }}>
                        <CustomerPreferredStoreTab
                            selectedProduct={selectedProduct}
                            customerInfo={customerInfo}
                            onStoreConfirm={handleStoreSelect}
                        />
                    </Box>
                )}
                {tabValue === 2 && (
                    <Box sx={{ p: 3 }}>
                        {customerInfo?.isFirstPurchaseAdmin && customerInfo?.publicIdStatus === 'before' ? (
                            <Alert severity="error">
                                아이디 부여 후 사용 가능한 기능입니다. 현재 공개아이디(아이디부여전) 상태로 접근할 수 없습니다.
                            </Alert>
                        ) : (
                            <CustomerPurchaseQueueTab customerInfo={customerInfo} />
                        )}
                    </Box>
                )}
                {tabValue === 3 && (
                    <Box sx={{ p: 3 }}>
                        <CustomerPurchaseHistoryTab customerInfo={customerInfo} />
                    </Box>
                )}
                {tabValue === 4 && (
                    <Box sx={{ p: 3 }}>
                        <CustomerBoardTab customerInfo={customerInfo} />
                    </Box>
                )}
            </Box>
        </Container>
    );
};

export default CustomerDashboard;
