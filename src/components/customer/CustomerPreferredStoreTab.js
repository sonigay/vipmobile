import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import Map from '../Map';
import { fetchData, customerAPI } from '../../api';

const CustomerPreferredStoreTab = ({ selectedProduct, customerInfo, onStoreConfirm }) => {
    const [stores, setStores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStore, setSelectedStore] = useState(null);
    const [userLocation, setUserLocation] = useState(null);

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
                    // Filter VIP stores based on the new vipStatus field
                    const vipStores = response.data.filter(store =>
                        store.vipStatus === 'VIP직영' ||
                        (store.name && store.name.includes('직영'))
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

    // VIP직영 매장만 필터링 (18번 인덱스 = vipStatus)
    // useMemo는 항상 hook 규칙에 따라 최상위에서 호출되어야 함
    const filteredStores = useMemo(() => {
        return stores.filter(store => 
            store.vipStatus === 'VIP직영' || 
            (store.name && store.name.includes('직영'))
        );
    }, [stores]);

    const handleStoreSelect = async (store) => {
        setSelectedStore(store);

        if (!selectedProduct) {
            alert('휴대폰시세표 탭을 통해 구입하실 휴대폰을 선택합니다.');
            // Switch to model list tab logic should be handled by the parent
            if (onStoreConfirm) onStoreConfirm('SELECT_PRODUCT', store);
            return;
        }

        if (window.confirm(`[${store.name}] 매장을 선호매장으로 선택하시겠습니까?\n이제 개통정보 입력을 통해 구입을 예약해주세요.`)) {
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
        <Box sx={{ height: '500px', width: '100%', position: 'relative', borderRadius: 2, overflow: 'hidden', border: '1px solid #eee' }}>
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
    );
};

export default CustomerPreferredStoreTab;
