import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { Paper, Typography, Box, CircularProgress } from '@mui/material';

const containerStyle = {
  width: '100%',
  height: '700px',
  aspectRatio: 'auto'
};

const mapContainerStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: '600px',
  maxWidth: '100%',
  height: '100%',
  margin: 0,
  padding: 0
};

const defaultCenter = {
  lat: 37.5665,
  lng: 126.9780
};

const defaultOptions = {
  gestureHandling: 'greedy',
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
};

function Map({ 
  userLocation, 
  filteredStores, 
  selectedStore,
  selectedRadius,
  selectedModel,
  selectedColor,
  loggedInStoreId,
  onStoreSelect
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'marker'],
  });

  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [circle, setCircle] = useState(null);

  const center = useMemo(() => userLocation || defaultCenter, [userLocation]);

  // 재고 수량 계산 함수
  const calculateInventory = useCallback((store) => {
    if (!store.inventory) return 0;
    
    // 모델과 색상 모두 선택되지 않은 경우: 총 재고
    if (!selectedModel) {
      return Object.entries(store.inventory).reduce((total, [model, colors]) => {
        return total + Object.values(colors).reduce((sum, quantity) => sum + quantity, 0);
      }, 0);
    }
    
    // 해당 모델의 재고가 없는 경우
    if (!store.inventory[selectedModel]) return 0;
    
    // 모델만 선택된 경우: 해당 모델의 전체 재고
    if (!selectedColor) {
      return Object.values(store.inventory[selectedModel]).reduce((sum, quantity) => sum + quantity, 0);
    }
    
    // 모델과 색상 모두 선택된 경우: 해당 모델/색상의 재고
    return store.inventory[selectedModel][selectedColor] || 0;
  }, [selectedModel, selectedColor]);

  // 지도 로드 핸들러
  const onLoad = useCallback((map) => {
    console.log('지도 로드됨');
    setMap(map);
  }, []);

  // 지도 언마운트 핸들러
  const onUnmount = useCallback(() => {
    console.log('지도 언마운트');
    markers.forEach(marker => marker.setMap(null));
    if (circle) circle.setMap(null);
    setMarkers([]);
    setCircle(null);
    setMap(null);
  }, [markers, circle]);

  const getMarkerIcon = useCallback((store) => {
    const isSelected = selectedStore?.id === store.id;
    const isLoggedInStore = loggedInStoreId === store.id;
    
    const inventoryCount = calculateInventory(store);
    const hasInventory = inventoryCount > 0;
    console.log(`매장: ${store.name}, 재고수량: ${inventoryCount}, 선택모델: ${selectedModel}, 선택색상: ${selectedColor}`);

    // 1. 선택된 매장
    if (isSelected) {
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#2196f3',
        fillOpacity: 1,
        strokeColor: '#1976d2',
        strokeWeight: 2,
        scale: 16
      };
    }

    // 2. 로그인한 매장
    if (isLoggedInStore) {
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#9c27b0',
        fillOpacity: 1,
        strokeColor: '#7b1fa2',
        strokeWeight: 2,
        scale: 16
      };
    }

    // 3. 일반 매장
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: hasInventory ? '#4caf50' : '#f44336',
      fillOpacity: 1,
      strokeColor: hasInventory ? '#388e3c' : '#d32f2f',
      strokeWeight: 2,
      scale: hasInventory ? 14 : 10
    };
  }, [selectedStore, loggedInStoreId, selectedModel, selectedColor, calculateInventory]);

  // 마커와 원 업데이트
  useEffect(() => {
    if (!isLoaded || !map) return;

    console.log('마커 업데이트 시작', {
      매장수: filteredStores.length,
      선택된모델: selectedModel,
      선택된색상: selectedColor
    });

    // 기존 마커와 원 제거
    markers.forEach(marker => marker.setMap(null));
    if (circle) circle.setMap(null);

    const newMarkers = [];
    const bounds = new window.google.maps.LatLngBounds();

    // 매장 마커 생성
    filteredStores.forEach(store => {
      if (!store.latitude || !store.longitude) return;

      const position = {
        lat: parseFloat(store.latitude),
        lng: parseFloat(store.longitude)
      };
      
      const inventoryCount = calculateInventory(store);
      const isSelected = selectedStore?.id === store.id;
      const isLoggedInStore = loggedInStoreId === store.id;
      
      let labelOptions = null;
      
      if (inventoryCount > 0) {
        labelOptions = {
          text: String(inventoryCount),
          color: isSelected || isLoggedInStore ? '#FFEB3B' : '#FFFFFF',
          fontSize: isSelected || isLoggedInStore ? '14px' : '13px',
          fontWeight: 'bold'
        };
      }
      
      const marker = new window.google.maps.Marker({
        map,
        position,
        title: store.name,
        icon: getMarkerIcon(store),
        label: labelOptions,
        zIndex: isSelected ? 30 : (isLoggedInStore ? 20 : (inventoryCount > 0 ? 10 : 1))
      });

      marker.addListener('click', () => {
        onStoreSelect(store);
      });

      newMarkers.push(marker);
      bounds.extend(position);
    });

    // 검색 반경 원 생성
    if (userLocation && selectedRadius) {
      const newCircle = new window.google.maps.Circle({
        map,
        center: userLocation,
        radius: selectedRadius,
        fillColor: '#4285F4',
        fillOpacity: 0.1,
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
      setCircle(newCircle);
      
      // 원의 경계도 bounds에 포함
      bounds.union(newCircle.getBounds());
    }

    // 지도 범위 조정
    if (newMarkers.length > 0 || (userLocation && selectedRadius)) {
      map.fitBounds(bounds);
      const listener = window.google.maps.event.addListener(map, 'idle', () => {
        if (map.getZoom() > 15) map.setZoom(15);
        window.google.maps.event.removeListener(listener);
      });
    }

    setMarkers(newMarkers);
  }, [map, isLoaded, filteredStores, userLocation, selectedRadius, loggedInStoreId, selectedModel, selectedColor, onStoreSelect, getMarkerIcon, calculateInventory, selectedStore]);

  if (loadError) {
    return (
      <Paper sx={mapContainerStyle}>
        <Box sx={{ p: 2 }}>
          <Typography color="error">지도를 불러오는데 실패했습니다.</Typography>
        </Box>
      </Paper>
    );
  }

  if (!isLoaded) {
    return (
      <Paper sx={mapContainerStyle}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={mapContainerStyle}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        options={defaultOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
      />
    </Paper>
  );
}

export default Map; 