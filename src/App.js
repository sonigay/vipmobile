import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Box, AppBar, Toolbar, Typography, Button, CircularProgress } from '@mui/material';
import Map from './components/Map';
import FilterPanel from './components/FilterPanel';
import StoreList from './components/StoreList';
import Login from './components/Login';
import { fetchData, fetchModels } from './api';
import { calculateDistance } from './utils/distanceUtils';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [data, setData] = useState(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedRadius, setSelectedRadius] = useState(2000);
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loggedInStore, setLoggedInStore] = useState(null);

  // 데이터 로딩 함수
  const loadData = useCallback(async () => {
    if (!isLoggedIn) return;
    
    setIsLoading(true);
    try {
      console.log('데이터 로딩 시작');
      const [storesResponse, modelsResponse] = await Promise.all([
        fetchData(),
        fetchModels()
      ]);

      console.log('매장 응답 전체:', storesResponse);
      console.log('모델 응답 전체:', modelsResponse);

      if (storesResponse.success && modelsResponse.success) {
        // 데이터 구조 자세히 로깅
        console.log('모델 데이터 원본:', modelsResponse.data);
        const models = Object.keys(modelsResponse.data || {}).sort();
        console.log('추출된 모델 목록:', models);
        console.log('모델별 색상 데이터:', modelsResponse.data);

        // 데이터 설정 전 최종 확인
        const finalData = {
          stores: storesResponse.data,
          models: models,
          colorsByModel: modelsResponse.data,
        };
        console.log('최종 설정될 데이터:', finalData);

        setData(finalData);
      } else {
        console.error('데이터 로딩 실패 상세:', { 
          storesSuccess: storesResponse.success,
          modelsSuccess: modelsResponse.success,
          storesError: storesResponse.error,
          modelsError: modelsResponse.error
        });
      }
    } catch (error) {
      console.error('데이터 로딩 중 상세 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  // 초기 데이터 로딩
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 위치 정보 가져오기
  useEffect(() => {
    if (!userLocation && isLoggedIn && data?.stores?.length > 0) {
      // 로그인한 매장 찾기
      const loggedInStore = data.stores[0]; // 첫 번째 매장을 예시로 사용
      if (loggedInStore.latitude && loggedInStore.longitude) {
        setUserLocation({
          lat: parseFloat(loggedInStore.latitude),
          lng: parseFloat(loggedInStore.longitude)
        });
      } else {
        // 매장 위치 정보가 없는 경우 서울시청 좌표 사용
        setUserLocation({
          lat: 37.5665,
          lng: 126.9780,
        });
      }
    }
  }, [isLoggedIn, data, userLocation]);

  const filterStores = useCallback((stores, selectedModel, selectedColor, userLocation, searchRadius) => {
    console.log('재고 필터링 시작:', { selectedModel, selectedColor });
    
    if (!stores || !Array.isArray(stores)) {
      console.log('매장 데이터가 없거나 유효하지 않음');
      return [];
    }

    return stores.filter(store => {
      // 1. 재고 확인
      let hasInventory = false;
      let totalQuantity = 0;
      
      if (store.inventory && selectedModel) {
        if (store.inventory[selectedModel]) {
          if (selectedColor) {
            // 특정 모델과 색상의 재고 확인
            totalQuantity = store.inventory[selectedModel][selectedColor] || 0;
            hasInventory = totalQuantity > 0;
            console.log(`매장 [${store.name}] - ${selectedModel} ${selectedColor} 재고: ${totalQuantity}`);
          } else {
            // 특정 모델의 전체 재고 확인
            Object.values(store.inventory[selectedModel]).forEach(qty => {
              totalQuantity += qty;
            });
            hasInventory = totalQuantity > 0;
            console.log(`매장 [${store.name}] - ${selectedModel} 전체 재고: ${totalQuantity}`);
          }
        }
      }
      
      store.totalQuantity = totalQuantity;
      store.hasInventory = hasInventory;

      // 2. 위치 기반 필터링
      if (userLocation && searchRadius) {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          parseFloat(store.latitude),
          parseFloat(store.longitude)
        );
        store.distance = distance;
        return distance <= searchRadius && hasInventory;
      }
      
      return hasInventory;
    });
  }, []);

  // 매장 필터링
  useEffect(() => {
    if (!data?.stores) {
      console.log('매장 데이터가 없음');
      return;
    }

    console.log('필터링 시작:', {
      총매장수: data.stores.length
    });

    try {
      // 1. 기본 매장 목록 복사
      let filtered = data.stores.map(store => ({
        ...store,
        distance: null
      }));

      // 2. 거리 계산 및 필터링
      if (userLocation && selectedRadius) {
        filtered = filtered.map(store => {
          if (!store.latitude || !store.longitude) {
            return { ...store, distance: Infinity };
          }

          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            parseFloat(store.latitude),
            parseFloat(store.longitude)
          );

          return { ...store, distance };
        }).filter(store => store.distance <= selectedRadius / 1000);
      }

      // 3. 결과 로깅
      console.log('필터링 결과:', {
        총매장수: data.stores.length,
        필터링된매장수: filtered.length,
        검색반경: selectedRadius ? `${selectedRadius/1000}km` : '없음'
      });

      setFilteredStores(filtered);
    } catch (error) {
      console.error('필터링 중 오류 발생:', error);
      setFilteredStores([]);
    }
  }, [data, selectedRadius, userLocation]);

  const handleLogin = (store) => {
    setIsLoggedIn(true);
    setLoggedInStore(store);
    if (store.latitude && store.longitude) {
      setUserLocation({
        lat: parseFloat(store.latitude),
        lng: parseFloat(store.longitude)
      });
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInStore(null);
    setData(null);
    setSelectedModel('');
    setSelectedColor('');
    setSelectedRadius(2000);
    setFilteredStores([]);
    setSelectedStore(null);
  };

  const handleModelSelect = useCallback((model) => {
    console.log('선택된 모델 변경:', model);
    setSelectedModel(model);
    setSelectedColor('');  // 색상 선택 초기화
    setFilteredStores([]); // 검색 결과 초기화
    loadData(); // 새로운 데이터 로드
  }, [loadData]);

  const handleColorSelect = useCallback((color) => {
    console.log('선택된 색상 변경:', color);
    setSelectedColor(color);
    setFilteredStores([]); // 검색 결과 초기화
    loadData(); // 새로운 데이터 로드
  }, [loadData]);

  const handleRadiusSelect = useCallback((radius) => {
    console.log('선택된 반경 변경:', radius);
    setSelectedRadius(radius);
  }, []);

  const handleStoreSelect = useCallback((store) => {
    console.log('선택된 매장:', store);
    setSelectedStore(store);
  }, []);

  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ height: '100vh', py: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                가까운 가용재고 조회
              </Typography>
              {isLoggedIn && (
                <Button color="inherit" onClick={handleLogout}>
                  로그아웃
                </Button>
              )}
            </Toolbar>
          </AppBar>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <FilterPanel
                models={data?.models}
                colorsByModel={data?.colorsByModel}
                selectedModel={selectedModel}
                selectedColor={selectedColor}
                selectedRadius={selectedRadius}
                onModelSelect={handleModelSelect}
                onColorSelect={handleColorSelect}
                onRadiusSelect={handleRadiusSelect}
              />
              <Box sx={{ flex: 1, display: 'flex', gap: 2 }}>
                <Map
                  userLocation={userLocation}
                  filteredStores={filteredStores}
                  selectedStore={selectedStore}
                  onStoreSelect={handleStoreSelect}
                  selectedRadius={selectedRadius}
                  selectedModel={selectedModel}
                  selectedColor={selectedColor}
                  loggedInStoreId={loggedInStore?.id}
                />
                <StoreList
                  stores={filteredStores}
                  selectedStore={selectedStore}
                  onStoreSelect={handleStoreSelect}
                  selectedModel={selectedModel}
                  selectedColor={selectedColor}
                />
              </Box>
            </>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App; 