import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { Paper, Typography, Box, CircularProgress } from '@mui/material';

const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '700px'
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
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

// libraries를 상수로 정의하여 경고 방지
const MAP_LIBRARIES = ['places', 'marker'];

function Map({ 
  userLocation, 
  filteredStores, 
  selectedStore,
  selectedRadius,
  selectedModel,
  selectedColor,
  loggedInStoreId,
  onStoreSelect,
  isAgentMode
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES
  });

  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [circle, setCircle] = useState(null);
  const [userInteracted, setUserInteracted] = useState(false);
  
  // 지도 초기 로드 여부를 트래킹
  const initialLoadRef = useRef(true);
  
  // 선택된 매장이 변경될 때 센터를 이동하기 위한 ref
  const previousSelectedStoreRef = useRef(null);

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
    
    // 사용자 인터랙션 이벤트 리스너 추가
    map.addListener('dragstart', () => {
      setUserInteracted(true);
    });
    
    map.addListener('zoom_changed', () => {
      setUserInteracted(true);
    });
  }, []);

  // 지도 언마운트 핸들러
  const onUnmount = useCallback(() => {
    console.log('지도 언마운트');
    markers.forEach(marker => marker.setMap(null));
    if (circle) circle.setMap(null);
    setMarkers([]);
    setCircle(null);
    setMap(null);
    setUserInteracted(false);
    initialLoadRef.current = true;
  }, [markers, circle]);

  // 선택된 매장으로 지도 이동
  useEffect(() => {
    if (!map || !selectedStore || !selectedStore.latitude || !selectedStore.longitude) return;
    
    // 이전에 선택된 매장과 다른 경우에만 처리
    if (previousSelectedStoreRef.current !== selectedStore.id) {
      const position = {
        lat: parseFloat(selectedStore.latitude),
        lng: parseFloat(selectedStore.longitude)
      };
      
      // 지도 센터만 변경하고 줌 레벨은 유지
      map.panTo(position);
      
      // 선택한 매장 ID 저장
      previousSelectedStoreRef.current = selectedStore.id;
    }
  }, [map, selectedStore]);

  const getMarkerIcon = useCallback((store) => {
    const isSelected = selectedStore?.id === store.id;
    const isLoggedInStore = loggedInStoreId === store.id;
    
    const inventoryCount = calculateInventory(store);
    const hasInventory = inventoryCount > 0;

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
  }, [selectedStore, loggedInStoreId, calculateInventory]);

  // 마커와 원 업데이트
  useEffect(() => {
    if (!isLoaded || !map) return;

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

    // 검색 반경 원 생성 (관리자 모드가 아닐 때만)
    if (userLocation && selectedRadius && !isAgentMode) {
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
    } else {
      setCircle(null);
    }

    // 초기 로드이고 사용자가 지도를 조작하지 않은 경우에만 지도 범위 자동 조정
    if ((initialLoadRef.current || !userInteracted) && 
        (newMarkers.length > 0 || (userLocation && selectedRadius && !isAgentMode))) {
      map.fitBounds(bounds);
      
      // 줌 레벨 조정
      if (map.getZoom() > 15) {
        map.setZoom(15);
      }
      
      // 초기 로드 완료 표시
      initialLoadRef.current = false;
    }

    setMarkers(newMarkers);
  }, [map, isLoaded, filteredStores, userLocation, selectedRadius, loggedInStoreId, selectedModel, selectedColor, onStoreSelect, getMarkerIcon, calculateInventory, selectedStore, isAgentMode, userInteracted]);

  // 반경 변경 시 지도 범위 재설정(사용자 상호작용 여부와 상관없이)
  useEffect(() => {
    if (!map || !isLoaded || !userLocation || !selectedRadius || isAgentMode) return;
    
    // 반경이 변경된 경우에는 지도 범위를 다시 설정
    if (circle) {
      const bounds = circle.getBounds();
      map.fitBounds(bounds);
      
      if (map.getZoom() > 15) {
        map.setZoom(15);
      }
    }
  }, [map, isLoaded, selectedRadius, userLocation, circle, isAgentMode]);

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