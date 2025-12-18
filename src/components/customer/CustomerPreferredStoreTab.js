import React, { useState, useEffect, useMemo } from 'react';
import { 
    Box, Typography, CircularProgress, Alert, Paper, Table, TableBody, 
    TableCell, TableContainer, TableHead, TableRow, Button, Grid, Card, CardContent 
} from '@mui/material';
import { Store as StoreIcon } from '@mui/icons-material';
import Map from '../Map';
import { fetchData, customerAPI } from '../../api';

const CustomerPreferredStoreTab = ({ selectedProduct, customerInfo, onStoreConfirm }) => {
    const [stores, setStores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStore, setSelectedStore] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    // 각 매장의 상세 정보 (사전승낙서 마크, 사진)
    const [storeDetails, setStoreDetails] = useState({});
    const [loadingDetails, setLoadingDetails] = useState({});

    useEffect(() => {
        // Get user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    setUserLocation({ lat: 37.5665, lng: 126.9780 });
                }
            );
        } else {
            setUserLocation({ lat: 37.5665, lng: 126.9780 });
        }

        const loadStores = async () => {
            setIsLoading(true);
            try {
                const response = await fetchData(false); // excludeShipped = false
                if (response.success) {
                    // VIP직영 매장만 필터링 (name.includes('직영') 제거)
                    const vipStores = response.data.filter(store =>
                        store.vipStatus === 'VIP직영'
                    );
                    setStores(vipStores);
                } else {
                    setError('매장 정보를 불러오는데 실패했습니다.');
                }
            } catch (err) {
                console.error('Error loading stores:', err);
                setError('매장 정보를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        loadStores();
    }, []);

    // 매장 상세 정보 로드 (사전승낙서 마크, 사진)
    useEffect(() => {
        const loadStoreDetails = async () => {
            if (stores.length === 0) return;

            const details = {};
            const loading = {};

            for (const store of stores) {
                loading[store.name] = true;
                try {
                    const [mark, photos] = await Promise.all([
                        customerAPI.getPreApprovalMark(store.name),
                        customerAPI.getStorePhotos(store.name)
                    ]);

                    details[store.name] = {
                        preApprovalMark: mark?.url || null,
                        photos: photos ? {
                            frontUrl: photos.frontPhoto,
                            insideUrl: photos.insidePhoto,
                            outsideUrl: photos.outsidePhoto,
                            outside2Url: photos.outside2Photo,
                            managerUrl: photos.managerPhoto,
                            staff1Url: photos.staff1Photo,
                            staff2Url: photos.staff2Photo,
                            staff3Url: photos.staff3Photo
                        } : null
                    };
                } catch (error) {
                    console.error(`매장 ${store.name} 상세 정보 로드 실패:`, error);
                    details[store.name] = {
                        preApprovalMark: null,
                        photos: null
                    };
                } finally {
                    loading[store.name] = false;
                }
            }

            setStoreDetails(details);
            setLoadingDetails(loading);
        };

        loadStoreDetails();
    }, [stores]);

    // stores는 이미 VIP직영으로 필터링되어 있으므로 그대로 사용
    const filteredStores = useMemo(() => {
        return stores;
    }, [stores]);

    const handleStoreSelect = async (store) => {
        // 매장 정보를 localStorage에 저장 (계획서 요구사항)
        localStorage.setItem('customer_selected_store', JSON.stringify(store));
        setSelectedStore(store);

        // 계획서에 따라: 버튼 클릭 시 안내 페이지를 거쳐야 함
        if (!selectedProduct) {
            // 상품 미선택 상태: 안내 페이지 → 휴대폰시세표 탭으로 이동
            if (onStoreConfirm) onStoreConfirm('SELECT_PRODUCT', store);
        } else {
            // 상품 선택 완료 상태: 안내 페이지 → 개통정보 입력 페이지로 이동
            if (onStoreConfirm) onStoreConfirm('SELECT_ORDER_INFO', store);
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 2 }}>
            {/* 지도 */}
            <Box sx={{ 
                height: '500px', 
                width: '100%', 
                position: 'relative', 
                borderRadius: 2, 
                overflow: 'hidden', 
                border: '1px solid #eee',
                flexShrink: 0,
                '& .leaflet-container': {
                    height: '100%',
                    width: '100%',
                    minHeight: '500px'
                }
            }}>
                <Map
                    userLocation={userLocation}
                    filteredStores={filteredStores}
                    selectedModel={selectedProduct?.model}
                    selectedColor={selectedProduct?.color}
                    isAgentMode={false}
                    currentView="all"
                    onStoreSelect={handleStoreSelect}
                    isCustomerMode={true}
                />
                {selectedProduct && (
                    <Box sx={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        zIndex: 1000,
                        bgcolor: 'rgba(255,255,255,0.9)',
                        p: 1.5,
                        borderRadius: 1,
                        boxShadow: 2,
                        borderLeft: '4px solid #1976d2'
                    }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>선택된 모델</Typography>
                        <Typography variant="body2">{selectedProduct.petName} ({selectedProduct.model})</Typography>
                        <Typography variant="caption" color="text.secondary">마커의 숫자는 해당 매장의 보유 재고입니다.</Typography>
                    </Box>
                )}
            </Box>

            {/* 매장 정보 테이블 */}
            <Box sx={{ flexShrink: 0 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StoreIcon color="primary" />
                    매장 정보
                </Typography>
                
                {filteredStores.length === 0 ? (
                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            표시할 매장이 없습니다.
                        </Typography>
                    </Paper>
                ) : (
                    <Grid container spacing={3}>
                        {filteredStores.map((store) => {
                            const details = storeDetails[store.name];
                            const isLoadingDetail = loadingDetails[store.name];
                            const photos = details?.photos;
                            const preApprovalMark = details?.preApprovalMark;

                            return (
                                <Grid item xs={12} md={6} key={store.id || store.uniqueId}>
                                    <Card sx={{ height: '100%', boxShadow: 2 }}>
                                        <CardContent>
                                            {/* 매장 기본 정보 */}
                                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
                                                {store.name || '-'}
                                            </Typography>
                                            
                                            <Box sx={{ mb: 2 }}>
                                                {store.phone && (
                                                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                        <strong>전화:</strong> {store.phone}
                                                    </Typography>
                                                )}
                                                {store.storePhone && (
                                                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                        <strong>휴대폰:</strong> {store.storePhone}
                                                    </Typography>
                                                )}
                                                {store.businessNumber && (
                                                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                        <strong>사업자번호:</strong> {store.businessNumber}
                                                    </Typography>
                                                )}
                                                {(store.managerName || store.manager) && (
                                                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                        <strong>점장명:</strong> {store.managerName || store.manager}
                                                    </Typography>
                                                )}
                                                {store.address && (
                                                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                        <strong>매장주소:</strong> {store.address}
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* 사전승낙서 마크 */}
                                            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                    사전승낙서 마크
                                                </Typography>
                                                {isLoadingDetail ? (
                                                    <CircularProgress size={20} />
                                                ) : preApprovalMark ? (
                                                    <Box dangerouslySetInnerHTML={{ __html: preApprovalMark }} />
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                        사전승낙서 마크 없음
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* 매장 사진 */}
                                            <Box sx={{ mb: 2 }}>
                                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                    매장 사진
                                                </Typography>
                                                <Grid container spacing={1}>
                                                    {['frontUrl', 'insideUrl', 'outsideUrl', 'outside2Url'].map((photoKey) => {
                                                        const photoUrl = photos?.[photoKey];
                                                        const labels = {
                                                            frontUrl: '전면',
                                                            insideUrl: '내부',
                                                            outsideUrl: '외부',
                                                            outside2Url: '외부2'
                                                        };
                                                        return (
                                                            <Grid item xs={6} key={photoKey}>
                                                                {photoUrl ? (
                                                                    <Box>
                                                                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                                                            {labels[photoKey]}
                                                                        </Typography>
                                                                        <img 
                                                                            src={photoUrl} 
                                                                            alt={labels[photoKey]}
                                                                            style={{ 
                                                                                width: '100%', 
                                                                                height: '80px', 
                                                                                objectFit: 'cover', 
                                                                                borderRadius: '4px',
                                                                                border: '1px solid #ddd'
                                                                            }}
                                                                        />
                                                                    </Box>
                                                                ) : (
                                                                    <Box sx={{ 
                                                                        width: '100%', 
                                                                        height: '80px', 
                                                                        bgcolor: '#f0f0f0', 
                                                                        borderRadius: '4px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        border: '1px solid #ddd'
                                                                    }}>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {labels[photoKey]} 사진 없음
                                                                        </Typography>
                                                                    </Box>
                                                                )}
                                                            </Grid>
                                                        );
                                                    })}
                                                </Grid>
                                            </Box>

                                            {/* 점장 및 직원 사진 */}
                                            <Box sx={{ mb: 2 }}>
                                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                    점장 및 직원
                                                </Typography>
                                                <Grid container spacing={1}>
                                                    {[
                                                        { key: 'managerUrl', label: '점장' },
                                                        { key: 'staff1Url', label: '직원1' },
                                                        { key: 'staff2Url', label: '직원2' },
                                                        { key: 'staff3Url', label: '직원3' }
                                                    ].map(({ key, label }) => {
                                                        const photoUrl = photos?.[key];
                                                        return (
                                                            <Grid item xs={6} key={key}>
                                                                {photoUrl ? (
                                                                    <Box>
                                                                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                                                            {label}
                                                                        </Typography>
                                                                        <img 
                                                                            src={photoUrl} 
                                                                            alt={label}
                                                                            style={{ 
                                                                                width: '100%', 
                                                                                height: '80px', 
                                                                                objectFit: 'cover', 
                                                                                borderRadius: '4px',
                                                                                border: '1px solid #ddd'
                                                                            }}
                                                                        />
                                                                    </Box>
                                                                ) : (
                                                                    <Box sx={{ 
                                                                        width: '100%', 
                                                                        height: '80px', 
                                                                        bgcolor: '#f0f0f0', 
                                                                        borderRadius: '4px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        border: '1px solid #ddd'
                                                                    }}>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {label} 사진 없음
                                                                        </Typography>
                                                                    </Box>
                                                                )}
                                                            </Grid>
                                                        );
                                                    })}
                                                </Grid>
                                            </Box>

                                            {/* 해당 매장 선택하기 버튼 */}
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                color="primary"
                                                onClick={() => handleStoreSelect(store)}
                                                sx={{ mt: 2 }}
                                            >
                                                해당 매장 선택하기
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </Box>
        </Box>
    );
};

export default CustomerPreferredStoreTab;
