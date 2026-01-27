import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../api';
import {
    Box, Typography, CircularProgress, Alert, Paper, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Button, Grid, Card, CardContent,
    FormControlLabel, Switch, useMediaQuery, useTheme, Dialog, IconButton
} from '@mui/material';
import { Store as StoreIcon, Refresh as RefreshIcon, Close as CloseIcon } from '@mui/icons-material';
import Map from '../Map';
import { fetchData, customerAPI } from '../../api';
import { directStoreApiClient } from '../../api/directStoreApiClient';

const CustomerPreferredStoreTab = ({ selectedProduct, customerInfo, onStoreConfirm }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [stores, setStores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStore, setSelectedStore] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    // 선택된 매장의 상세 정보 (사전승낙서 마크, 사진)
    const [selectedStoreDetails, setSelectedStoreDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    // 사진 갤러리: 메인 사진 (선택된 사진) - 매장사진과 직원사진 분리
    const [mainStorePhoto, setMainStorePhoto] = useState(null);
    const [mainStaffPhoto, setMainStaffPhoto] = useState(null);
    // 이미지 확대 모달 상태
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [modalImageUrl, setModalImageUrl] = useState(null);
    const [modalImageTitle, setModalImageTitle] = useState('');
    // 대중교통 위치 데이터
    const [transitLocations, setTransitLocations] = useState([]);
    const [showTransitMarkers, setShowTransitMarkers] = useState(true);
    // 이미지 갱신 상태
    const [refreshingImages, setRefreshingImages] = useState(false);

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
                    // 위치 정보 실패 시 평택 중심 좌표 설정 (인천과 청주지역까지 보이도록)
                    setUserLocation({ lat: 36.9922, lng: 127.1128, isDefault: true });
                }
            );
        } else {
            // Geolocation 미지원 시 평택 중심 좌표 설정 (인천과 청주지역까지 보이도록)
            setUserLocation({ lat: 36.9922, lng: 127.1128, isDefault: true });
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

        // 대중교통 위치 데이터 로드
        const loadTransitLocations = async () => {
            try {
                const response = await directStoreApiClient.getTransitLocations();
                if (response.success && response.data) {
                    setTransitLocations(response.data);
                }
            } catch (error) {
                console.error('대중교통 위치 로드 실패:', error);
            }
        };
        loadTransitLocations();
    }, []);

    // 선택된 매장의 상세 정보 로드 (사전승낙서 마크, 사진)
    useEffect(() => {
        const loadSelectedStoreDetails = async () => {
            if (!selectedStore?.name) {
                setSelectedStoreDetails(null);
                setMainStorePhoto(null);
                setMainStaffPhoto(null);
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
                        frontMessageId: photos.frontMessageId,
                        frontThreadId: photos.frontThreadId,
                        insideUrl: photos.insidePhoto,
                        insideMessageId: photos.insideMessageId,
                        insideThreadId: photos.insideThreadId,
                        outsideUrl: photos.outsidePhoto,
                        outsideMessageId: photos.outsideMessageId,
                        outsideThreadId: photos.outsideThreadId,
                        outside2Url: photos.outside2Photo,
                        outside2MessageId: photos.outside2MessageId,
                        outside2ThreadId: photos.outside2ThreadId,
                        managerUrl: photos.managerPhoto,
                        managerMessageId: photos.managerMessageId,
                        managerThreadId: photos.managerThreadId,
                        staff1Url: photos.staff1Photo,
                        staff1MessageId: photos.staff1MessageId,
                        staff1ThreadId: photos.staff1ThreadId,
                        staff2Url: photos.staff2Photo,
                        staff2MessageId: photos.staff2MessageId,
                        staff2ThreadId: photos.staff2ThreadId,
                        staff3Url: photos.staff3Photo,
                        staff3MessageId: photos.staff3MessageId,
                        staff3ThreadId: photos.staff3ThreadId
                    } : null
                };

                setSelectedStoreDetails(details);

                // 첫 번째 사용 가능한 사진을 메인 사진으로 설정
                if (details.photos) {
                    const firstStorePhoto = details.photos.frontUrl ||
                        details.photos.insideUrl ||
                        details.photos.outsideUrl ||
                        details.photos.outside2Url || null;
                    setMainStorePhoto(firstStorePhoto);

                    const firstStaffPhoto = details.photos.managerUrl ||
                        details.photos.staff1Url ||
                        details.photos.staff2Url ||
                        details.photos.staff3Url || null;
                    setMainStaffPhoto(firstStaffPhoto);
                } else {
                    setMainStorePhoto(null);
                    setMainStaffPhoto(null);
                }
            } catch (error) {
                console.error(`매장 ${selectedStore.name} 상세 정보 로드 실패:`, error);
                setSelectedStoreDetails(null);
                setMainStorePhoto(null);
                setMainStaffPhoto(null);
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

    // 이미지 갱신 함수
    const handleRefreshImages = async () => {
        if (!selectedStore?.name || !selectedStoreDetails?.photos) {
            return;
        }

        setRefreshingImages(true);
        try {
            const photoTypes = ['front', 'inside', 'outside', 'outside2', 'manager', 'staff1', 'staff2', 'staff3'];
            const photoMap = {
                front: { messageId: 'frontMessageId', threadId: 'frontThreadId' },
                inside: { messageId: 'insideMessageId', threadId: 'insideThreadId' },
                outside: { messageId: 'outsideMessageId', threadId: 'outsideThreadId' },
                outside2: { messageId: 'outside2MessageId', threadId: 'outside2ThreadId' },
                manager: { messageId: 'managerMessageId', threadId: 'managerThreadId' },
                staff1: { messageId: 'staff1MessageId', threadId: 'staff1ThreadId' },
                staff2: { messageId: 'staff2MessageId', threadId: 'staff2ThreadId' },
                staff3: { messageId: 'staff3MessageId', threadId: 'staff3ThreadId' }
            };

            // 모든 사진 순차적으로 갱신 (API 할당량 초과 방지)
            for (const photoType of photoTypes) {
                const messageId = selectedStoreDetails.photos[photoMap[photoType].messageId];
                const threadId = selectedStoreDetails.photos[photoMap[photoType].threadId];

                if (messageId && threadId) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/direct/refresh-store-photo-url`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                storeName: selectedStore.name,
                                photoType: photoType,
                                threadId: threadId,
                                messageId: messageId
                            })
                        });
                        console.log(`✅ [순차 갱신 완료] ${photoType}`);
                        await response.json();
                    } catch (error) {
                        console.error(`매장 사진 갱신 실패 (${photoType}):`, error);
                    }
                }
            }

            // 갱신 후 사진 다시 로드
            const photos = await customerAPI.getStorePhotos(selectedStore.name);
            if (photos) {
                const details = {
                    ...selectedStoreDetails,
                    photos: {
                        frontUrl: photos.frontPhoto,
                        frontMessageId: photos.frontMessageId,
                        frontThreadId: photos.frontThreadId,
                        insideUrl: photos.insidePhoto,
                        insideMessageId: photos.insideMessageId,
                        insideThreadId: photos.insideThreadId,
                        outsideUrl: photos.outsidePhoto,
                        outsideMessageId: photos.outsideMessageId,
                        outsideThreadId: photos.outsideThreadId,
                        outside2Url: photos.outside2Photo,
                        outside2MessageId: photos.outside2MessageId,
                        outside2ThreadId: photos.outside2ThreadId,
                        managerUrl: photos.managerPhoto,
                        managerMessageId: photos.managerMessageId,
                        managerThreadId: photos.managerThreadId,
                        staff1Url: photos.staff1Photo,
                        staff1MessageId: photos.staff1MessageId,
                        staff1ThreadId: photos.staff1ThreadId,
                        staff2Url: photos.staff2Photo,
                        staff2MessageId: photos.staff2MessageId,
                        staff2ThreadId: photos.staff2ThreadId,
                        staff3Url: photos.staff3Photo,
                        staff3MessageId: photos.staff3MessageId,
                        staff3ThreadId: photos.staff3ThreadId
                    }
                };
                setSelectedStoreDetails(details);

                // 메인 사진 업데이트
                const updatedStorePhoto = details.photos.frontUrl ||
                    details.photos.insideUrl ||
                    details.photos.outsideUrl ||
                    details.photos.outside2Url || null;
                if (updatedStorePhoto) {
                    setMainStorePhoto(updatedStorePhoto + (updatedStorePhoto.includes('?') ? '&' : '?') + 't=' + Date.now()); // 캐시 무효화 및 상태 업데이트
                }

                const updatedStaffPhoto = details.photos.managerUrl ||
                    details.photos.staff1Url ||
                    details.photos.staff2Url ||
                    details.photos.staff3Url || null;
                if (updatedStaffPhoto) {
                    setMainStaffPhoto(updatedStaffPhoto + (updatedStaffPhoto.includes('?') ? '&' : '?') + 't=' + Date.now()); // 캐시 무효화 및 상태 업데이트
                }
            }
        } catch (error) {
            console.error('이미지 갱신 오류:', error);
            alert('이미지 갱신 중 오류가 발생했습니다.');
        } finally {
            setRefreshingImages(false);
        }
    };

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
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            p: { xs: 1, sm: 2 },
            width: '100%',
            minHeight: '100%',
            pb: { xs: 4, sm: 4 } // 하단 여백 추가로 하단 내용이 잘리지 않도록
        }}>
            {/* 지도 설명 문구 - 지도 위쪽으로 이동 */}
            <Box sx={{
                bgcolor: 'rgba(76, 175, 80, 0.1)',
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                borderLeft: '4px solid #4caf50',
                flexShrink: 0
            }}>
                <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.primary', fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                    고객님의 위치에서 가장 가까운 매장을 안내합니다.
                </Typography>
            </Box>

            {/* 지도 */}
            <Box sx={{
                height: { xs: '300px', sm: '400px', md: '500px' },
                width: '100%',
                position: 'relative',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid #eee',
                flexShrink: 0,
                '& .leaflet-container': {
                    height: '100%',
                    width: '100%',
                    minHeight: { xs: '300px', sm: '400px', md: '500px' }
                },
                // Leaflet zoom 컨트롤이 제대로 표시되고 작동하도록 스타일 조정
                '& .leaflet-control-zoom': {
                    zIndex: '2000 !important', // 다른 요소들보다 높게 설정
                    pointerEvents: 'auto !important',
                    position: 'relative' // z-index가 작동하도록
                },
                '& .leaflet-control-zoom-in, & .leaflet-control-zoom-out': {
                    pointerEvents: 'auto !important',
                    cursor: 'pointer',
                    zIndex: '2000 !important',
                    position: 'relative'
                },
                // Leaflet zoom 컨트롤이 클릭 가능하도록 보장
                '& .leaflet-control-zoom a': {
                    pointerEvents: 'auto !important',
                    cursor: 'pointer !important',
                    zIndex: '2000 !important'
                }
            }}>
                {/* 대중교통 마커 토글 (왼쪽 하단으로 이동) */}
                <Box sx={{
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                    zIndex: 1000,
                    bgcolor: 'rgba(255,255,255,0.95)',
                    p: 1,
                    borderRadius: 1,
                    boxShadow: 2,
                    pointerEvents: 'auto' // 이 요소만 클릭 가능
                }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={showTransitMarkers}
                                onChange={(e) => setShowTransitMarkers(e.target.checked)}
                                size="small"
                            />
                        }
                        label={<Typography variant="body2" sx={{ fontSize: '0.875rem' }}>가까운대중교통 보기</Typography>}
                    />
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
                    transitLocations={transitLocations}
                    showTransitMarkers={showTransitMarkers}
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
                        borderLeft: '4px solid #1976d2',
                        pointerEvents: 'auto' // 이 요소만 클릭 가능
                    }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>선택된 모델</Typography>
                        <Typography variant="body2">{selectedProduct.petName} ({selectedProduct.model})</Typography>
                        <Typography variant="caption" color="text.secondary">마커의 숫자는 해당 매장의 보유 재고입니다.</Typography>
                    </Box>
                )}
            </Box>

            {/* 선택된 매장 정보 (맵에서 클릭한 매장만 표시) */}
            {selectedStore ? (
                <Box sx={{
                    flexShrink: 0
                    // 스크롤은 부모 Box에서 처리하므로 여기서는 제거
                }}>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                        <StoreIcon color="primary" />
                        매장 정보 - {selectedStore.name}
                    </Typography>

                    <Card sx={{ boxShadow: 3 }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
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
                                        <Box sx={{
                                            p: 2,
                                            bgcolor: '#ffffff',
                                            borderRadius: 1,
                                            textAlign: 'center',
                                            width: '50%',
                                            mx: 'auto'
                                        }}>
                                            <CircularProgress size={24} />
                                        </Box>
                                    ) : selectedStoreDetails?.preApprovalMark ? (
                                        <Box sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            textAlign: 'center',
                                            p: 2,
                                            bgcolor: '#ffffff',
                                            borderRadius: 1,
                                            width: '50%',
                                            mx: 'auto'
                                        }}>
                                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                사전승낙서 마크
                                            </Typography>
                                            <Box
                                                dangerouslySetInnerHTML={{ __html: selectedStoreDetails.preApprovalMark }}
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: 'center'
                                                }}
                                            />
                                        </Box>
                                    ) : (
                                        <Box sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            textAlign: 'center',
                                            p: 2,
                                            bgcolor: '#ffffff',
                                            borderRadius: 1,
                                            width: '50%',
                                            mx: 'auto'
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
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                            매장 사진
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<RefreshIcon />}
                                            onClick={handleRefreshImages}
                                            disabled={refreshingImages}
                                            sx={{ minWidth: 'auto' }}
                                        >
                                            {refreshingImages ? '갱신 중...' : '이미지갱신하기'}
                                        </Button>
                                    </Box>

                                    {/* 매장사진과 직원사진을 양쪽으로 나누기 */}
                                    <Grid container spacing={3}>
                                        {/* 왼쪽: 매장사진 */}
                                        <Grid item xs={12} md={6}>
                                            <Box sx={{
                                                bgcolor: 'rgba(25, 118, 210, 0.05)',
                                                borderRadius: 3,
                                                p: 2,
                                                border: '2px solid rgba(25, 118, 210, 0.1)',
                                                height: '100%'
                                            }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                                                    매장사진
                                                </Typography>

                                                {/* 메인 사진 */}
                                                <Box sx={{ mb: 2, textAlign: 'center' }}>
                                                    {mainStorePhoto ? (
                                                        <Box
                                                            onClick={() => {
                                                                setModalImageUrl(mainStorePhoto);
                                                                setModalImageTitle('매장사진');
                                                                setImageModalOpen(true);
                                                            }}
                                                            sx={{
                                                                position: 'relative',
                                                                borderRadius: 2,
                                                                overflow: 'hidden',
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                                transition: 'transform 0.3s',
                                                                cursor: 'pointer',
                                                                '&:hover': {
                                                                    transform: 'scale(1.02)',
                                                                    boxShadow: '0 6px 16px rgba(0,0,0,0.2)'
                                                                }
                                                            }}
                                                        >
                                                            <img
                                                                src={mainStorePhoto}
                                                                alt="매장 메인 사진"
                                                                style={{
                                                                    width: '100%',
                                                                    height: 'auto',
                                                                    maxHeight: '350px',
                                                                    objectFit: 'contain',
                                                                    display: 'block'
                                                                }}
                                                            />
                                                        </Box>
                                                    ) : (
                                                        <Box sx={{
                                                            width: '100%',
                                                            height: '250px',
                                                            bgcolor: 'rgba(0,0,0,0.05)',
                                                            borderRadius: 2,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: '2px dashed rgba(0,0,0,0.2)'
                                                        }}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                사진 없음
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>

                                                {/* 서브 사진들 */}
                                                <Grid container spacing={1}>
                                                    {[
                                                        { key: 'frontUrl', label: '전면' },
                                                        { key: 'insideUrl', label: '내부' },
                                                        { key: 'outsideUrl', label: '외부' },
                                                        { key: 'outside2Url', label: '외부2' }
                                                    ].map(({ key, label }) => {
                                                        const photoUrl = selectedStoreDetails.photos?.[key];
                                                        const isSelected = mainStorePhoto === photoUrl;
                                                        return (
                                                            <Grid item xs={6} key={key}>
                                                                {photoUrl ? (
                                                                    <Box
                                                                        onClick={() => setMainStorePhoto(photoUrl)}
                                                                        sx={{
                                                                            cursor: 'pointer',
                                                                            border: isSelected ? '3px solid #1976d2' : '2px solid rgba(0,0,0,0.1)',
                                                                            borderRadius: 1.5,
                                                                            overflow: 'hidden',
                                                                            transition: 'all 0.2s',
                                                                            bgcolor: isSelected ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
                                                                            '&:hover': {
                                                                                borderColor: '#1976d2',
                                                                                transform: 'translateY(-2px)',
                                                                                boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
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
                                                                                bgcolor: isSelected ? 'rgba(25, 118, 210, 0.15)' : 'transparent',
                                                                                fontWeight: isSelected ? 'bold' : 'normal',
                                                                                fontSize: '0.75rem'
                                                                            }}
                                                                        >
                                                                            {label}
                                                                        </Typography>
                                                                    </Box>
                                                                ) : (
                                                                    <Box sx={{
                                                                        width: '100%',
                                                                        height: '100px',
                                                                        bgcolor: 'rgba(0,0,0,0.03)',
                                                                        borderRadius: 1.5,
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        border: '2px dashed rgba(0,0,0,0.1)'
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
                                        </Grid>

                                        {/* 오른쪽: 직원사진 */}
                                        <Grid item xs={12} md={6}>
                                            <Box sx={{
                                                bgcolor: 'rgba(156, 39, 176, 0.05)',
                                                borderRadius: 3,
                                                p: 2,
                                                border: '2px solid rgba(156, 39, 176, 0.1)',
                                                height: '100%'
                                            }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: 'secondary.main' }}>
                                                    직원사진
                                                </Typography>

                                                {/* 메인 사진 */}
                                                <Box sx={{ mb: 2, textAlign: 'center' }}>
                                                    {mainStaffPhoto ? (
                                                        <Box
                                                            onClick={() => {
                                                                setModalImageUrl(mainStaffPhoto);
                                                                setModalImageTitle('직원사진');
                                                                setImageModalOpen(true);
                                                            }}
                                                            sx={{
                                                                position: 'relative',
                                                                borderRadius: 2,
                                                                overflow: 'hidden',
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                                transition: 'transform 0.3s',
                                                                cursor: 'pointer',
                                                                '&:hover': {
                                                                    transform: 'scale(1.02)',
                                                                    boxShadow: '0 6px 16px rgba(0,0,0,0.2)'
                                                                }
                                                            }}
                                                        >
                                                            <img
                                                                src={mainStaffPhoto}
                                                                alt="직원 메인 사진"
                                                                style={{
                                                                    width: '100%',
                                                                    height: 'auto',
                                                                    maxHeight: '350px',
                                                                    objectFit: 'contain',
                                                                    display: 'block'
                                                                }}
                                                            />
                                                        </Box>
                                                    ) : (
                                                        <Box sx={{
                                                            width: '100%',
                                                            height: '250px',
                                                            bgcolor: 'rgba(0,0,0,0.05)',
                                                            borderRadius: 2,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: '2px dashed rgba(0,0,0,0.2)'
                                                        }}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                사진 없음
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>

                                                {/* 서브 사진들 */}
                                                <Grid container spacing={1}>
                                                    {[
                                                        { key: 'managerUrl', label: '점장' },
                                                        { key: 'staff1Url', label: '직원1' },
                                                        { key: 'staff2Url', label: '직원2' },
                                                        { key: 'staff3Url', label: '직원3' }
                                                    ].map(({ key, label }) => {
                                                        const photoUrl = selectedStoreDetails.photos?.[key];
                                                        const isSelected = mainStaffPhoto === photoUrl;
                                                        return (
                                                            <Grid item xs={6} key={key}>
                                                                {photoUrl ? (
                                                                    <Box
                                                                        onClick={() => setMainStaffPhoto(photoUrl)}
                                                                        sx={{
                                                                            cursor: 'pointer',
                                                                            border: isSelected ? '3px solid #9c27b0' : '2px solid rgba(0,0,0,0.1)',
                                                                            borderRadius: 1.5,
                                                                            overflow: 'hidden',
                                                                            transition: 'all 0.2s',
                                                                            bgcolor: isSelected ? 'rgba(156, 39, 176, 0.1)' : 'transparent',
                                                                            '&:hover': {
                                                                                borderColor: '#9c27b0',
                                                                                transform: 'translateY(-2px)',
                                                                                boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
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
                                                                                bgcolor: isSelected ? 'rgba(156, 39, 176, 0.15)' : 'transparent',
                                                                                fontWeight: isSelected ? 'bold' : 'normal',
                                                                                fontSize: '0.75rem'
                                                                            }}
                                                                        >
                                                                            {label}
                                                                        </Typography>
                                                                    </Box>
                                                                ) : (
                                                                    <Box sx={{
                                                                        width: '100%',
                                                                        height: '100px',
                                                                        bgcolor: 'rgba(0,0,0,0.03)',
                                                                        borderRadius: 1.5,
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        border: '2px dashed rgba(0,0,0,0.1)'
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
                                        </Grid>
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

            {/* 이미지 확대 모달 */}
            <Dialog
                open={imageModalOpen}
                onClose={() => setImageModalOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: 'rgba(0, 0, 0, 0.9)',
                        boxShadow: 'none',
                        m: 0,
                        maxHeight: '100vh'
                    }
                }}
            >
                <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                    {/* 닫기 버튼 */}
                    <IconButton
                        onClick={() => setImageModalOpen(false)}
                        sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            zIndex: 1,
                            bgcolor: 'rgba(255, 255, 255, 0.9)',
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 1)'
                            }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>

                    {/* 이미지 */}
                    {modalImageUrl && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: '80vh',
                                p: 3
                            }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    color: 'white',
                                    mb: 2,
                                    fontWeight: 'bold'
                                }}
                            >
                                {modalImageTitle}
                            </Typography>
                            <Box
                                sx={{
                                    maxWidth: '90vw',
                                    maxHeight: '75vh',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <img
                                    src={modalImageUrl}
                                    alt={modalImageTitle}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '75vh',
                                        objectFit: 'contain',
                                        borderRadius: '8px',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                                    }}
                                />
                            </Box>
                        </Box>
                    )}
                </Box>
            </Dialog>
        </Box>
    );
};

export default CustomerPreferredStoreTab;
