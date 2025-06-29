import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Box, AppBar, Toolbar, Typography, Button, CircularProgress, Chip } from '@mui/material';
import Map from './components/Map';
import FilterPanel from './components/FilterPanel';
import AgentFilterPanel from './components/AgentFilterPanel';
import Login from './components/Login';
import InventoryMode from './components/InventoryMode';
import { fetchData, fetchModels, cacheManager } from './api';
import { calculateDistance } from './utils/distanceUtils';
import './App.css';
import StoreInfoTable from './components/StoreInfoTable';

// Logger 유틸리티
const logActivity = async (activityData) => {
  try {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
    const loggingEnabled = process.env.REACT_APP_LOGGING_ENABLED === 'true';
    
    if (!loggingEnabled) {
      console.log('활동 로깅이 비활성화되어 있습니다.');
      return;
    }
    
    console.log('활동 로깅 데이터:', activityData);
    
    // 서버로 전송
    console.log(`로그 전송 URL: ${API_URL}/api/log-activity`);
    const response = await fetch(`${API_URL}/api/log-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activityData),
    });
    
    const data = await response.json();
    console.log('로그 전송 응답:', data);
    
    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status} ${response.statusText}`);
    }
    
    console.log('활동 로깅 성공!');
  } catch (error) {
    console.error('활동 로깅 실패:', error);
    console.error('활동 데이터:', activityData);
  }
};

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
  // 관리자 모드 관련 상태 추가
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [agentTarget, setAgentTarget] = useState('');
  const [agentQualification, setAgentQualification] = useState('');
  const [agentContactId, setAgentContactId] = useState('');
  // 재고모드 관련 상태 추가
  const [isInventoryMode, setIsInventoryMode] = useState(false);
  // 재고요청점 검색 관련 상태 추가
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  // 현재 세션의 IP 및 위치 정보
  const [ipInfo, setIpInfo] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  // 캐시 상태
  const [cacheStatus, setCacheStatus] = useState(null);

  // 재고모드 ID 목록
  const INVENTORY_MODE_IDS = ["JEGO306891", "JEGO315835", "JEGO314942", "JEGO316558", "JEGO316254"];

  // 캐시 상태 업데이트 함수
  const updateCacheStatus = useCallback(() => {
    const status = cacheManager.getStatus();
    setCacheStatus(status);
  }, []);

  // 캐시 정리 함수
  const handleCacheCleanup = useCallback(() => {
    cacheManager.cleanup();
    updateCacheStatus();
  }, [updateCacheStatus]);

  // 전체 캐시 삭제 함수
  const handleCacheClearAll = useCallback(() => {
    cacheManager.clearAll();
    updateCacheStatus();
  }, [updateCacheStatus]);

  // 로그인 상태 복원
  useEffect(() => {
    const savedLoginState = localStorage.getItem('loginState');
    if (savedLoginState) {
      try {
        const parsedState = JSON.parse(savedLoginState);
        setIsLoggedIn(true);
        setLoggedInStore(parsedState.store);
        
        // 관리자 모드 상태 복원
        if (parsedState.isAgent) {
          setIsAgentMode(true);
          setAgentTarget(parsedState.agentTarget || '');
          setAgentQualification(parsedState.agentQualification || '');
          setAgentContactId(parsedState.agentContactId || '');
          
          // 관리자 모드 위치 설정 (안산지역 중심)
          setUserLocation({
            lat: 37.3215,  // 안산지역 중심
            lng: 126.8309,
          });
          setSelectedRadius(80000);
        } else if (parsedState.isInventory) {
          // 재고모드 상태 복원
          setIsInventoryMode(true);
          
          // 재고모드 위치 설정 (전체 지역 보기)
          setUserLocation({
            lat: 37.5665,
            lng: 126.9780,
          });
          setSelectedRadius(50000);
        } else if (parsedState.store) {
          // 일반 매장 모드 위치 설정
          const store = parsedState.store;
          if (store.latitude && store.longitude) {
            setUserLocation({
              lat: parseFloat(store.latitude),
              lng: parseFloat(store.longitude)
            });
          }
        }
      } catch (error) {
        console.error('저장된 로그인 상태를 복원하는 중 오류 발생:', error);
        localStorage.removeItem('loginState');
      }
    }
  }, []);

  // 디바이스 및 IP 정보 수집
  useEffect(() => {
    // 디바이스 정보 가져오기
    const userAgent = navigator.userAgent;
    setDeviceInfo(userAgent);
    
    // localStorage에서 IP 정보 가져오기
    const savedIpInfo = localStorage.getItem('userIpInfo');
    if (savedIpInfo) {
      setIpInfo(JSON.parse(savedIpInfo));
    }
  }, []);

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

  // 캐시 상태 주기적 업데이트
  useEffect(() => {
    updateCacheStatus();
    const interval = setInterval(updateCacheStatus, 30000); // 30초마다 업데이트
    return () => clearInterval(interval);
  }, [updateCacheStatus]);

  // 로그인한 매장 정보 업데이트 (재고 정보 포함)
  useEffect(() => {
    if (isLoggedIn && data?.stores && loggedInStore) {
      console.log('로그인 매장 재고 정보 업데이트 시작');
      
      // 로그인한 매장의 최신 정보 찾기
      const updatedStore = data.stores.find(store => store.id === loggedInStore.id);
      
      if (updatedStore) {
        console.log('로그인 매장 최신 정보 발견:', {
          매장명: updatedStore.name,
          재고: updatedStore.inventory
        });
        
        // 로그인 매장 정보 업데이트
        setLoggedInStore(updatedStore);
      }
    }
  }, [isLoggedIn, data, loggedInStore?.id]);

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
      
      if (store.inventory) {
        // 새로운 데이터 구조: { phones: {}, sims: {}, wearables: {}, smartDevices: {} }
        if (selectedModel) {
          // 특정 모델의 재고 확인
          Object.values(store.inventory).forEach(category => {
            if (category[selectedModel]) {
              if (selectedColor) {
                // 특정 모델과 색상의 재고 확인
                Object.values(category[selectedModel]).forEach(status => {
                  if (status[selectedColor]) {
                    totalQuantity += status[selectedColor] || 0;
                  }
                });
              } else {
                // 특정 모델의 전체 재고 확인
                Object.values(category[selectedModel]).forEach(status => {
                  Object.values(status).forEach(qty => {
                    totalQuantity += qty || 0;
                  });
                });
              }
            }
          });
          hasInventory = totalQuantity > 0;
          console.log(`매장 [${store.name}] - ${selectedModel}${selectedColor ? ` ${selectedColor}` : ''} 재고: ${totalQuantity}`);
        } else {
          // 모델이 선택되지 않은 경우: 모든 재고 합계 확인
          Object.values(store.inventory).forEach(category => {
            if (typeof category === 'object' && category !== null) {
              Object.values(category).forEach(model => {
                if (typeof model === 'object' && model !== null) {
                  Object.values(model).forEach(status => {
                    if (typeof status === 'object' && status !== null) {
                      Object.values(status).forEach(qty => {
                        totalQuantity += qty || 0;
                      });
                    }
                  });
                }
              });
            }
          });
          hasInventory = totalQuantity > 0;
          console.log(`매장 [${store.name}] - 전체 재고: ${totalQuantity}`);
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
      총매장수: data.stores.length,
      관리자모드: isAgentMode
    });

    try {
      // 1. 기본 매장 목록 복사
      let filtered = data.stores.map(store => ({
        ...store,
        distance: null
      }));

      // 2. 거리 계산
      if (userLocation) {
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
        });
        
        // 관리자 모드가 아닌 경우에만 반경 필터링 적용
        if (!isAgentMode && selectedRadius) {
          filtered = filtered.filter(store => store.distance <= selectedRadius / 1000);
        }
      }

      // 3. 결과 로깅
      console.log('필터링 결과:', {
        총매장수: data.stores.length,
        필터링된매장수: filtered.length,
        검색반경: selectedRadius ? `${selectedRadius/1000}km` : '없음',
        관리자모드: isAgentMode
      });

      setFilteredStores(filtered);
    } catch (error) {
      console.error('필터링 중 오류 발생:', error);
      setFilteredStores([]);
    }
  }, [data, selectedRadius, userLocation, isAgentMode]);

  const handleLogin = (store) => {
    setIsLoggedIn(true);
    setLoggedInStore(store);
    
    // 재고모드인지 확인 (백엔드 응답의 isInventory 플래그 우선 확인)
    if (store.isInventory || INVENTORY_MODE_IDS.includes(store.id)) {
      console.log('로그인: 재고모드');
      setIsInventoryMode(true);
      setIsAgentMode(false);
      
      // 재고모드에서는 서울시청을 중심으로 전체 지역 보기
      setUserLocation({
        lat: 37.5665,
        lng: 126.9780,
      });
      setSelectedRadius(50000);
      
      // 로그인 상태 저장
      localStorage.setItem('loginState', JSON.stringify({
        isInventory: true,
        isAgent: false,
        store: store
      }));
    }
    // 관리자 모드인지 확인
    else if (store.isAgent) {
      console.log('로그인: 관리자 모드');
      setIsAgentMode(true);
      setIsInventoryMode(false);
      setAgentTarget(store.target);
      setAgentQualification(store.qualification);
      setAgentContactId(store.contactId);
      
      // 관리자 모드에서는 안산지역을 중심으로 인천-평택 지역 보기
      setUserLocation({
        lat: 37.3215,  // 안산지역 중심
        lng: 126.8309,
      });
      // 검색 반경을 더 넓게 설정 (인천-평택 지역까지 보이도록)
      setSelectedRadius(80000);
      
      // 로그인 상태 저장
      localStorage.setItem('loginState', JSON.stringify({
        isAgent: true,
        isInventory: false,
        store: store,
        agentTarget: store.target,
        agentQualification: store.qualification,
        agentContactId: store.contactId
      }));
    } else {
      console.log('로그인: 일반 매장 모드');
      setIsAgentMode(false);
      setIsInventoryMode(false);
      // 일반 매장인 경우 기존 로직 유지
      if (store.latitude && store.longitude) {
        setUserLocation({
          lat: parseFloat(store.latitude),
          lng: parseFloat(store.longitude)
        });
      }
      
      // 로그인 상태 저장
      localStorage.setItem('loginState', JSON.stringify({
        isAgent: false,
        isInventory: false,
        store: store
      }));
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
    // 관리자 모드 상태 초기화
    setIsAgentMode(false);
    setAgentTarget('');
    setAgentQualification('');
    setAgentContactId('');
    // 재고모드 상태 초기화
    setIsInventoryMode(false);
    
    // 로그인 상태 삭제
    localStorage.removeItem('loginState');
  };

  const handleModelSelect = useCallback((model) => {
    console.log('선택된 모델 변경:', model);
    setSelectedModel(model);
    setSelectedColor('');  // 색상 선택 초기화
    setFilteredStores([]); // 검색 결과 초기화
    
    // 모델 검색 로그 전송
    if (loggedInStore) {
      console.log('모델 선택 로그 전송 시작:', model);
      logActivity({
        userId: loggedInStore.id,
        userType: isAgentMode ? 'agent' : 'store',
        targetName: isAgentMode ? agentTarget : loggedInStore.name,
        ipAddress: ipInfo?.ip || 'unknown',
        location: ipInfo?.location || 'unknown',
        deviceInfo: deviceInfo || 'unknown',
        activity: 'search',
        model: model
      });
    }
    
    // 데이터 로드는 로그 전송 후 실행
    loadData();
  }, [loadData, loggedInStore, isAgentMode, agentTarget, ipInfo, deviceInfo]);

  const handleColorSelect = useCallback((color) => {
    console.log('선택된 색상 변경:', color);
    setSelectedColor(color);
    setFilteredStores([]); // 검색 결과 초기화
    
    // 색상 검색 로그 전송
    if (loggedInStore && selectedModel) {
      console.log('색상 선택 로그 전송 시작:', color, '모델:', selectedModel);
      logActivity({
        userId: loggedInStore.id,
        userType: isAgentMode ? 'agent' : 'store',
        targetName: isAgentMode ? agentTarget : loggedInStore.name,
        ipAddress: ipInfo?.ip || 'unknown',
        location: ipInfo?.location || 'unknown',
        deviceInfo: deviceInfo || 'unknown',
        activity: 'search',
        model: selectedModel,
        colorName: color
      });
    }
    
    // 데이터 로드는 로그 전송 후 실행
    loadData();
  }, [loadData, loggedInStore, selectedModel, isAgentMode, agentTarget, ipInfo, deviceInfo]);

  const handleRadiusSelect = useCallback((radius) => {
    console.log('선택된 반경 변경:', radius);
    setSelectedRadius(radius);
  }, []);

  const handleStoreSelect = useCallback((store) => {
    console.log('선택된 매장:', store);
    setSelectedStore(store);
  }, []);

  // 재고요청점 검색 함수
  const handleStoreSearch = useCallback((query) => {
    setSearchQuery(query);
    
    if (!query.trim() || !data?.stores) {
      setSearchResults([]);
      return;
    }
    
    // 매장명 또는 담당자명으로 검색 (대소문자 구분 없이)
    const filtered = data.stores.filter(store => {
      const storeName = store.name?.toLowerCase() || '';
      const managerName = store.manager?.toLowerCase() || '';
      const searchTerm = query.toLowerCase();
      
      return storeName.includes(searchTerm) || managerName.includes(searchTerm);
    });
    
    console.log(`검색어: "${query}" - 검색 결과: ${filtered.length}개`);
    console.log('검색된 매장들:', filtered.map(s => ({ name: s.name, manager: s.manager })));
    
    setSearchResults(filtered);
  }, [data?.stores]);

  // 검색된 매장으로 지도 이동
  const handleSearchResultSelect = useCallback((store) => {
    setSelectedStore(store);
    setSearchQuery('');
    setSearchResults([]);
    
    // 선택된 매장으로 지도 이동 (더 확대된 줌 레벨)
    if (store.latitude && store.longitude) {
      setUserLocation({
        lat: parseFloat(store.latitude),
        lng: parseFloat(store.longitude)
      });
      
      // 지도 확대를 위해 강제로 줌 레벨 설정
      setTimeout(() => {
        const mapElement = document.querySelector('.leaflet-container');
        if (mapElement && mapElement._leaflet_map) {
          const map = mapElement._leaflet_map;
          map.setView([parseFloat(store.latitude), parseFloat(store.longitude)], 16);
        }
      }, 100);
    }
  }, []);

  // 전화 연결 버튼 클릭 핸들러
  const handleCallButtonClick = useCallback(() => {
    if (loggedInStore && isAgentMode) {
      // 관리자가 전화 연결 버튼을 클릭한 경우 로그 전송
      logActivity({
        userId: loggedInStore.id,
        userType: 'agent',
        targetName: agentTarget,
        ipAddress: ipInfo?.ip || 'unknown',
        location: ipInfo?.location || 'unknown',
        deviceInfo: deviceInfo || 'unknown',
        activity: 'call_button',
        callButton: true
      });
    }
  }, [loggedInStore, isAgentMode, agentTarget, ipInfo, deviceInfo]);

  // 카카오톡 보내기 버튼 클릭 핸들러
  const handleKakaoTalkButtonClick = useCallback(() => {
    if (loggedInStore && isAgentMode) {
      // 관리자가 카카오톡 보내기 버튼을 클릭한 경우 로그 전송
      logActivity({
        userId: loggedInStore.id,
        userType: 'agent',
        targetName: agentTarget,
        ipAddress: ipInfo?.ip || 'unknown',
        location: ipInfo?.location || 'unknown',
        deviceInfo: deviceInfo || 'unknown',
        activity: 'kakao_button',
        kakaoButton: true,
        model: selectedModel,
        colorName: selectedColor
      });
    }
  }, [loggedInStore, isAgentMode, agentTarget, ipInfo, deviceInfo, selectedModel, selectedColor]);

  // 매장 재고 계산 함수 추가
  const getStoreInventory = useCallback((store) => {
    if (!store || !store.inventory) return 0;
    
    // 새로운 데이터 구조: { phones: {}, sims: {}, wearables: {}, smartDevices: {} }
    let totalInventory = 0;
    
    if (selectedModel && selectedColor) {
      // 특정 모델과 색상의 재고 확인
      Object.values(store.inventory).forEach(category => {
        if (category[selectedModel]) {
          Object.values(category[selectedModel]).forEach(status => {
            if (status[selectedColor]) {
              totalInventory += status[selectedColor] || 0;
            }
          });
        }
      });
    } else if (selectedModel) {
      // 특정 모델의 전체 재고 확인
      Object.values(store.inventory).forEach(category => {
        if (category[selectedModel]) {
          Object.values(category[selectedModel]).forEach(status => {
            Object.values(status).forEach(qty => {
              totalInventory += qty || 0;
            });
          });
        }
      });
    } else {
      // 전체 재고 계산
      Object.values(store.inventory).forEach(category => {
        if (typeof category === 'object' && category !== null) {
          Object.values(category).forEach(model => {
            if (typeof model === 'object' && model !== null) {
              Object.values(model).forEach(status => {
                if (typeof status === 'object' && status !== null) {
                  Object.values(status).forEach(qty => {
                    totalInventory += qty || 0;
                  });
                }
              });
            }
          });
        }
      });
    }
    
    return totalInventory;
  }, [selectedModel, selectedColor]);

  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  // 재고모드일 때는 별도 화면 렌더링
  if (isInventoryMode) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <InventoryMode onLogout={handleLogout} loggedInStore={loggedInStore} />
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
              <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                {isAgentMode ? (
                  // 관리자 모드일 때 대리점 정보 표시
                  <span style={{ fontWeight: 'bold', fontSize: '0.7em' }}>
                    {agentTarget} ({agentQualification})
                  </span>
                ) : loggedInStore && (
                  // 일반 매장 모드일 때 기존 정보 표시
                  <>
                    <span style={{ fontWeight: 'bold', fontSize: '0.7em' }}>{loggedInStore.name}</span>
                    {selectedModel ? (
                      <span style={{ marginLeft: '16px', fontSize: '0.6em' }}>
                        {selectedModel} 
                        {selectedColor ? ` ${selectedColor}` : ''} 
                        재고: {(() => {
                          if (!loggedInStore.inventory) return 0;
                          
                          // 새로운 데이터 구조에 맞게 재고 계산
                          let totalInventory = 0;
                          
                          if (selectedModel && selectedColor) {
                            // 특정 모델과 색상의 재고 확인
                            Object.values(loggedInStore.inventory).forEach(category => {
                              if (category[selectedModel]) {
                                Object.values(category[selectedModel]).forEach(status => {
                                  if (status[selectedColor]) {
                                    totalInventory += status[selectedColor] || 0;
                                  }
                                });
                              }
                            });
                          } else if (selectedModel) {
                            // 특정 모델의 전체 재고 확인
                            Object.values(loggedInStore.inventory).forEach(category => {
                              if (category[selectedModel]) {
                                Object.values(category[selectedModel]).forEach(status => {
                                  Object.values(status).forEach(qty => {
                                    totalInventory += qty || 0;
                                  });
                                });
                              }
                            });
                          }
                          
                          return totalInventory;
                        })()}
                      </span>
                    ) : (
                      <span style={{ marginLeft: '16px', fontSize: '0.6em' }}>
                        총 재고: {(() => {
                          if (!loggedInStore.inventory) return 0;
                          
                          // 새로운 데이터 구조에 맞게 전체 재고 계산
                          let totalInventory = 0;
                          Object.values(loggedInStore.inventory).forEach(category => {
                            if (typeof category === 'object' && category !== null) {
                              Object.values(category).forEach(model => {
                                if (typeof model === 'object' && model !== null) {
                                  Object.values(model).forEach(status => {
                                    if (typeof status === 'object' && status !== null) {
                                      Object.values(status).forEach(qty => {
                                        totalInventory += qty || 0;
                                      });
                                    }
                                  });
                                }
                              });
                            }
                          });
                          
                          return totalInventory;
                        })()}
                      </span>
                    )}
                  </>
                )}
                {!loggedInStore && '가까운 가용재고 조회'}
              </Typography>
              
              {/* 캐시 상태 표시 */}
              {cacheStatus && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                  <Chip 
                    label={`캐시: ${cacheStatus.memory.valid}/${cacheStatus.memory.total}`}
                    size="small"
                    color={cacheStatus.memory.valid > 0 ? "success" : "default"}
                    variant="outlined"
                    sx={{ fontSize: '0.7em' }}
                  />
                  <Chip 
                    label={`LS: ${cacheStatus.localStorage.total}`}
                    size="small"
                    color={cacheStatus.localStorage.total > 0 ? "info" : "default"}
                    variant="outlined"
                    sx={{ fontSize: '0.7em' }}
                  />
                </Box>
              )}
              
              {isLoggedIn && (
                <Button color="inherit" onClick={handleLogout} sx={{ fontSize: '0.8em' }}>
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
              {isAgentMode ? (
                // 관리자 모드일 때 StoreInfoTable과 AgentFilterPanel 표시
                <>
                  <StoreInfoTable 
                    selectedStore={selectedStore}
                    agentTarget={agentTarget}
                    agentContactId={agentContactId}
                    onCallButtonClick={handleCallButtonClick}
                    onKakaoTalkButtonClick={handleKakaoTalkButtonClick}
                    selectedModel={selectedModel}
                    selectedColor={selectedColor}
                  />
                  <AgentFilterPanel
                    models={data?.models}
                    colorsByModel={data?.colorsByModel}
                    selectedModel={selectedModel}
                    selectedColor={selectedColor}
                    onModelSelect={handleModelSelect}
                    onColorSelect={handleColorSelect}
                    searchQuery={searchQuery}
                    searchResults={searchResults}
                    onStoreSearch={handleStoreSearch}
                    onSearchResultSelect={handleSearchResultSelect}
                  />
                </>
              ) : (
                // 일반 매장 모드일 때 FilterPanel만 표시
                <FilterPanel
                  models={data?.models}
                  colorsByModel={data?.colorsByModel}
                  selectedModel={selectedModel}
                  selectedColor={selectedColor}
                  selectedRadius={selectedRadius}
                  onModelSelect={handleModelSelect}
                  onColorSelect={handleColorSelect}
                  onRadiusSelect={handleRadiusSelect}
                  isAgentMode={isAgentMode}
                />
              )}
              <Box sx={{ flex: 1 }}>
                <Map
                  userLocation={userLocation}
                  filteredStores={filteredStores}
                  selectedStore={selectedStore}
                  onStoreSelect={handleStoreSelect}
                  selectedRadius={isAgentMode ? null : selectedRadius} // 관리자 모드일 때는 반경 표시 안함
                  selectedModel={selectedModel}
                  selectedColor={selectedColor}
                  loggedInStoreId={loggedInStore?.id}
                  isAgentMode={isAgentMode}
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