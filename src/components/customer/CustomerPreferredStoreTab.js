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
    // 선택된 매장의 상세 정보 (사전승낙서 마크, 사진)
    const [selectedStoreDetails, setSelectedStoreDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    // 사진 갤러리: 메인 사진 (선택된 사진)
    const [mainPhoto, setMainPhoto] = useState(null);

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
                    // 위치 정보 실패 시 수도권이 보이도록 중심 좌표 설정
                    setUserLocation({ lat: 37.5, lng: 127.0, isDefault: true });
                }
            );
        } else {
            // Geolocation 미지원 시 수도권이 보이도록 중심 좌표 설정
            setUserLocation({ lat: 37.5, lng: 127.0, isDefault: true });
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

    // 선택된 매장의 상세 정보 로드 (사전승낙서 마크, 사진)
    useEffect(() => {
        const loadSelectedStoreDetails = async () => {
            if (!selectedStore?.name) {
                setSelectedStoreDetails(null);
                setMainPhoto(null);
                return;
            }

            setLoadingDetails(true);
            try {
                const [mark, photos] = await Promise.all([
                    customerAPI.getPreApprovalMark(selectedStore.name),
                    customerAPI.getStorePhotos(selectedStore.name)
                ]);

                const details = {
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

                setSelectedStoreDetails(details);
                
                // 첫 번째 사용 가능한 사진을 메인 사진으로 설정
                if (details.photos) {
                    const firstPhoto = details.photos.frontUrl || 
                                     details.photos.insideUrl || 
                                     details.photos.outsideUrl || 
                                     details.photos.outside2Url || null;
                    setMainPhoto(firstPhoto);
                } else {
                    setMainPhoto(null);
                }
            } catch (error) {
                console.error(`매장 ${selectedStore.name} 상세 정보 로드 실패:`, error);
                setSelectedStoreDetails(null);
                setMainPhoto(null);
            } finally {
                setLoadingDetails(false);
            }
        };

        loadSelectedStoreDetails();
    }, [selectedStore]);

    // stores는 이미 VIP직영으로 필터링되어 있으므로 그대로 사용
    const filteredStores = useMemo(() => {
        return stores;
    }, [stores]);

    // 맵에서 매장 클릭 시 (상세 정보만 표시, 선택은 버튼으로)
    const handleStoreClick = (store) => {
        setSelectedStore(store);
    };

    // 매장 선택하기 버튼 클릭 시
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
                {/* 지도 설명 문구 */}
                <Box sx={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 1000,
                    bgcolor: 'rgba(255,255,255,0.95)',
                    p: 1.5,
                    borderRadius: 1,
                    boxShadow: 2,
                    borderLeft: '4px solid #4caf50'
                }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.primary' }}>
                        고객님의 위치에서 가장 가까운 매장을 안내합니다.
                    </Typography>
                </Box>
                <Map
                    userLocation={userLocation}
                    filteredStores={filteredStores}
                    selectedModel={selectedProduct?.model}
                    selectedColor={selectedProduct?.color}
                    isAgentMode={false}
                    currentView="all"
                    onStoreSelect={handleStoreClick}
                    onStoreConfirm={(store) => handleStoreSelect(store)}
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

            {/* 선택된 매장 정보 (맵에서 클릭한 매장만 표시) */}
            {selectedStore ? (
                <Box sx={{ flexShrink: 0 }}>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StoreIcon color="primary" />
                        매장 정보 - {selectedStore.name}
                    </Typography>
                    
                    <Card sx={{ boxShadow: 3 }}>
                        <CardContent>
                            {/* 매장 기본 정보 */}
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
                                {selectedStore.name || '-'}
                            </Typography>
                            
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                {/* 왼쪽 컬럼: 기본 정보 */}
                                <Grid item xs={12} md={6}>
                                    <Box>
                                        {selectedStore.phone && (
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                <strong>전화:</strong> {selectedStore.phone}
                                            </Typography>
                                        )}
                                        {selectedStore.storePhone && (
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                <strong>휴대폰:</strong> {selectedStore.storePhone}
                                            </Typography>
                                        )}
                                        {selectedStore.businessNumber && (
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                <strong>사업자번호:</strong> {selectedStore.businessNumber}
                                            </Typography>
                                        )}
                                        {(selectedStore.managerName || selectedStore.manager) && (
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                <strong>점장명:</strong> {selectedStore.managerName || selectedStore.manager}
                                            </Typography>
                                        )}
                                        {selectedStore.address && (
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                <strong>매장주소:</strong> {selectedStore.address}
                                            </Typography>
                                        )}
                                    </Box>
                                </Grid>
                                
                                {/* 오른쪽 컬럼: 사전승낙서 마크 */}
                                <Grid item xs={12} md={6}>
                                    {loadingDetails ? (
                                        <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1, textAlign: 'center' }}>
                                            <CircularProgress size={24} />
                                        </Box>
                                    ) : selectedStoreDetails?.preApprovalMark ? (
                                        <Box sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-end',
                                            justifyContent: 'flex-start',
                                            textAlign: 'right',
                                            p: 2,
                                            bgcolor: '#f5f5f5',
                                            borderRadius: 1
                                        }}>
                                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                사전승낙서 마크
                                            </Typography>
                                            <Box 
                                                dangerouslySetInnerHTML={{ __html: selectedStoreDetails.preApprovalMark }}
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: 'flex-end'
                                                }}
                                            />
                                        </Box>
                                    ) : (
                                        <Box sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-end',
                                            justifyContent: 'flex-start',
                                            textAlign: 'right',
                                            p: 2,
                                            bgcolor: '#f5f5f5',
                                            borderRadius: 1
                                        }}>
                                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                사전승낙서 마크
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                사전승낙서 마크 없음
                                            </Typography>
                                        </Box>
                                    )}
                                </Grid>
                            </Grid>

                            {/* 사진 갤러리 */}
                            {loadingDetails ? (
                                <Box sx={{ mb: 3, textAlign: 'center' }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : selectedStoreDetails?.photos ? (
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                                        매장 사진
                                    </Typography>
                                    
                                    {/* 메인 사진 (큰 사진) */}
                                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                                        {mainPhoto ? (
                                            <img 
                                                src={mainPhoto} 
                                                alt="메인 사진"
                                                style={{ 
                                                    width: '100%', 
                                                    maxWidth: '600px',
                                                    height: 'auto',
                                                    maxHeight: '400px',
                                                    objectFit: 'contain',
                                                    borderRadius: '8px',
                                                    border: '2px solid #ddd',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                }}
                                            />
                                        ) : (
                                            <Box sx={{ 
                                                width: '100%', 
                                                maxWidth: '600px',
                                                height: '300px',
                                                bgcolor: '#f0f0f0', 
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '2px solid #ddd',
                                                margin: '0 auto'
                                            }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    사진 없음
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>

                                    {/* 썸네일 사진들 (작은 사진) */}
                                    <Grid container spacing={1} justifyContent="center">
                                        {[
                                            { key: 'frontUrl', label: '전면' },
                                            { key: 'insideUrl', label: '내부' },
                                            { key: 'outsideUrl', label: '외부' },
                                            { key: 'outside2Url', label: '외부2' }
                                        ].map(({ key, label }) => {
                                            const photoUrl = selectedStoreDetails.photos?.[key];
                                            const isSelected = mainPhoto === photoUrl;
                                            return (
                                                <Grid item xs={3} sm={3} key={key}>
                                                    {photoUrl ? (
                                                        <Box
                                                            onClick={() => setMainPhoto(photoUrl)}
                                                            sx={{
                                                                cursor: 'pointer',
                                                                border: isSelected ? '3px solid #1976d2' : '2px solid #ddd',
                                                                borderRadius: '4px',
                                                                overflow: 'hidden',
                                                                transition: 'all 0.2s',
                                                                '&:hover': {
                                                                    borderColor: '#1976d2',
                                                                    transform: 'scale(1.05)'
                                                                }
                                                            }}
                                                        >
                                                            <img 
                                                                src={photoUrl} 
                                                                alt={label}
                                                                style={{ 
                                                                    width: '100%', 
                                                                    height: '100px', 
                                                                    objectFit: 'cover',
                                                                    display: 'block'
                                                                }}
                                                            />
                                                            <Typography 
                                                                variant="caption" 
                                                                sx={{ 
                                                                    display: 'block', 
                                                                    textAlign: 'center',
                                                                    py: 0.5,
                                                                    bgcolor: isSelected ? '#e3f2fd' : 'transparent',
                                                                    fontWeight: isSelected ? 'bold' : 'normal'
                                                                }}
                                                            >
                                                                {label}
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Box sx={{ 
                                                            width: '100%', 
                                                            height: '100px', 
                                                            bgcolor: '#f0f0f0', 
                                                            borderRadius: '4px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: '2px solid #ddd'
                                                        }}>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                {label}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                                없음
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Grid>
                                            );
                                        })}
                                    </Grid>
                                </Box>
                            ) : (
                                <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, textAlign: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        매장 사진 없음
                                    </Typography>
                                </Box>
                            )}

                            {/* 매장 선택하기 버튼 */}
                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={() => handleStoreSelect(selectedStore)}
                                sx={{ mt: 3, py: 1.5 }}
                            >
                                매장선택하기
                            </Button>
                        </CardContent>
                    </Card>
                </Box>
            ) : (
                <Box sx={{ flexShrink: 0, textAlign: 'center', py: 4 }}>
                    <Paper sx={{ p: 4 }}>
                        <StoreIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                            매장을 선택해주세요
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            지도에서 매장을 클릭하면 상세 정보를 확인할 수 있습니다.
                        </Typography>
                    </Paper>
                </Box>
            )}
        </Box>
    );
};

export default CustomerPreferredStoreTab;
