import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { Paper, Box, Button } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet 마커 아이콘 설정 (기본 아이콘 경로 문제 해결)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 동적 스타일을 위한 함수들
const getContainerStyle = (isExpanded) => ({
  width: '100%',
  height: isExpanded ? '85vh' : '100%',
  borderRadius: '4px',
  transition: 'height 0.3s ease-in-out'
});

const getMapContainerStyle = (isExpanded) => ({
  width: '100%',
  height: isExpanded ? '85vh' : '100%',
  display: 'flex',
  flexDirection: 'column',
  margin: 0,
  padding: 0,
  borderRadius: '4px',
  overflow: 'hidden',
  position: 'relative',
  transition: 'height 0.3s ease-in-out'
});

const defaultCenter = {
  lat: 37.5665,
  lng: 126.9780
};

// 강제 확대를 위한 별도 컴포넌트
function ForceZoomUpdater({ forceZoomToStore }) {
  const map = useMap();
  
  useEffect(() => {
    if (forceZoomToStore && map) {
      const { lat, lng, zoom } = forceZoomToStore;
      
      const attemptZoom = (attemptCount = 0) => {
        try {
          // 지도가 완전히 로드되었는지 확인 (더 강력한 검사)
          if (map && map._loaded && map._container && map._mapPane && map._leaflet_pos) {
            // 지도 패널 크기 확인 (컨테이너 크기로 대체 가능)
            const container = map._container;
            const panelSize = map._size || { x: container.offsetWidth, y: container.offsetHeight };
            
            if (panelSize.x > 0 && panelSize.y > 0) {
              map.setView([lat, lng], zoom || 14, {
                animate: true,
                duration: 1.5 // 애니메이션 시간을 늘려서 더 자연스럽게
              });
              return;
            } else if (container.offsetWidth > 0 && container.offsetHeight > 0) {
              // 컨테이너 크기로 대체
              map.setView([lat, lng], zoom || 14, {
                animate: true,
                duration: 1.5 // 애니메이션 시간을 늘려서 더 자연스럽게
              });
              return;
            }
          }
          
          // 재시도 로직 (최대 5회, 300ms 간격으로 늘림)
          if (attemptCount < 5) {
            setTimeout(() => attemptZoom(attemptCount + 1), 300);
          } else {
            console.warn('ForceZoomUpdater 최대 재시도 횟수 초과');
          }
        } catch (error) {
          console.error('ForceZoomUpdater 오류:', error);
          // 오류 발생 시에도 재시도
          if (attemptCount < 5) {
            setTimeout(() => attemptZoom(attemptCount + 1), 300);
          }
        }
      };
      
      // 초기 시도
      setTimeout(() => attemptZoom(), 200);
    }
  }, [forceZoomToStore, map]);
  
  return null;
}

// 지도 뷰 업데이트를 위한 컴포넌트
function MapUpdater({ center, bounds, zoom, isAgentMode, currentView, forceZoomToStore }) {
  const map = useMap();
  
  // 각 모드별 줌 레벨 설정
  const getModeZoom = () => {
    if (isAgentMode) {
      if (currentView === 'all') return 10;      // 전체재고확인
      if (currentView === 'assigned') return 11; // 담당재고확인
      if (currentView === 'activation') return 12; // 담당개통확인
      return 10; // 기본값
    }
    return 12; // 일반 매장 모드
  };
  
  useEffect(() => {
    // 강제 확대가 진행 중이면 MapUpdater 비활성화 (지도 위치 유지)
    if (forceZoomToStore) {
      return;
    }
    
    const attemptUpdate = (attemptCount = 0) => {
      try {
        if (map && map._loaded && map._container && map._mapPane && map._leaflet_pos) {
          const container = map._container;
          const panelSize = map._size || { x: container.offsetWidth, y: container.offsetHeight };
          
          if (panelSize.x > 0 && panelSize.y > 0 || container.offsetWidth > 0 && container.offsetHeight > 0) {
            if (bounds) {
              const modeZoom = getModeZoom();
              map.fitBounds(bounds, {
                animate: true,
                duration: 1.5,
                maxZoom: modeZoom // 최대 줌 레벨 제한
              });
            } else if (center) {
              map.setView([center.lat, center.lng], zoom || getModeZoom(), {
                animate: true,
                duration: 1.5
              });
            }
            return;
          }
        }
        
        // 재시도 로직 (최대 3회, 400ms 간격으로 늘림)
        if (attemptCount < 3) {
          setTimeout(() => attemptUpdate(attemptCount + 1), 400);
        }
      } catch (error) {
        console.error('MapUpdater 오류:', error);
        if (attemptCount < 3) {
          setTimeout(() => attemptUpdate(attemptCount + 1), 400);
        }
      }
    };
    
    attemptUpdate();
  }, [map, center, bounds, zoom, isAgentMode, currentView, forceZoomToStore]);
  
  return null;
}

function Map({ 
  userLocation, 
  filteredStores, 
  selectedStore,
  requestedStore,
  selectedRadius,
  selectedModel,
  selectedColor,
  loggedInStoreId,
  onStoreSelect,
  isAgentMode,
  currentView,
  forceZoomToStore,
  activationData, // 개통실적 데이터 추가
  showActivationMarkers, // 개통실적 마커 표시 여부
  activationModelSearch, // 개통실적 모델 검색
  activationDateSearch, // 개통실적 날짜 검색
  agentTarget, // 담당자 정보 추가
  isMapExpanded, // 맵 확대 상태
  onMapExpandToggle // 맵 확대 토글 함수
}) {
  const [map, setMap] = useState(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapCenter, setMapCenter] = useState(userLocation || defaultCenter);
  
  // 마커들의 경계를 계산하는 함수
  const calculateBounds = (stores) => {
    if (!stores || stores.length === 0) return null;
    
    const validStores = stores.filter(store => 
      store.latitude && store.longitude && 
      !isNaN(parseFloat(store.latitude)) && !isNaN(parseFloat(store.longitude))
    );
    
    if (validStores.length === 0) return null;
    
    let minLat = parseFloat(validStores[0].latitude);
    let maxLat = parseFloat(validStores[0].latitude);
    let minLng = parseFloat(validStores[0].longitude);
    let maxLng = parseFloat(validStores[0].longitude);
    
    validStores.forEach(store => {
      const lat = parseFloat(store.latitude);
      const lng = parseFloat(store.longitude);
      
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });
    
    // 경계에 여백 추가 (10% 패딩)
    const latPadding = (maxLat - minLat) * 0.1;
    const lngPadding = (maxLng - minLng) * 0.1;
    
    // Leaflet bounds 객체 생성
    const bounds = L.latLngBounds([
      [minLat - latPadding, minLng - lngPadding],
      [maxLat + latPadding, maxLng + lngPadding]
    ]);
    
    return bounds;
  };

  // 각 모드별 초기 줌 레벨 설정 (마커 기반)
  const getInitialZoom = () => {
    if (isAgentMode) {
      if (currentView === 'all') return 10;      // 전체재고확인 (기본값)
      if (currentView === 'assigned') return 11; // 담당재고확인 (기본값)
      if (currentView === 'activation') return 12; // 담당개통확인 (기본값)
      return 10; // 기본값
    }
    return 12; // 일반 매장 모드
  };
  
  const [mapZoom, setMapZoom] = useState(getInitialZoom());
  const [mapKey, setMapKey] = useState(0);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const initialLoadRef = useRef(true);
  const previousSelectedStoreRef = useRef(null);
  const mapRef = useRef(null);

  const center = useMemo(() => userLocation || defaultCenter, [userLocation]);

  // userLocation이 변경될 때 mapCenter 업데이트
  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
    }
  }, [userLocation]);

  // 컴포넌트 언마운트 시 지도 정리
  useEffect(() => {
    return () => {
      if (map) {
        try {
          // 지도 이벤트 리스너 제거
          map.off();
          // 지도 컨테이너 정리
          if (map._container) {
            map._container.innerHTML = '';
          }
          // 지도 인스턴스 정리
          map.remove();
        } catch (error) {
          console.warn('지도 정리 중 오류:', error);
        }
      }
    };
  }, [map]);

  // 재고 수량 계산 함수
  const calculateInventory = useCallback((store) => {
    if (!store.inventory) return 0;
    
    // 새로운 데이터 구조: { phones: {}, sims: {}, wearables: {}, smartDevices: {} }
    let totalInventory = 0;
    
    // 모든 카테고리의 재고를 합산
    Object.values(store.inventory).forEach(category => {
      if (typeof category === 'object' && category !== null) {
        Object.values(category).forEach(model => {
          if (typeof model === 'object' && model !== null) {
            Object.values(model).forEach(status => {
              if (typeof status === 'object' && status !== null) {
                Object.values(status).forEach(item => {
                  // 새로운 구조: { quantity: number, shippedDate: string }
                  if (typeof item === 'object' && item && item.quantity) {
                    totalInventory += item.quantity || 0;
                  } else if (typeof item === 'number') {
                    // 기존 구조 호환성
                    totalInventory += item || 0;
                  }
                });
              }
            });
          }
        });
      }
    });
    
    // 모델과 색상이 선택된 경우 필터링
    if (selectedModel) {
      let filteredInventory = 0;
      
      Object.values(store.inventory).forEach(category => {
        if (category[selectedModel]) {
          if (selectedColor) {
            // 특정 모델과 색상의 재고
            Object.values(category[selectedModel]).forEach(status => {
              if (status[selectedColor]) {
                const item = status[selectedColor];
                if (typeof item === 'object' && item && item.quantity) {
                  filteredInventory += item.quantity || 0;
                } else if (typeof item === 'number') {
                  filteredInventory += item || 0;
                }
              }
            });
          } else {
            // 특정 모델의 전체 재고
            Object.values(category[selectedModel]).forEach(status => {
              Object.values(status).forEach(item => {
                if (typeof item === 'object' && item && item.quantity) {
                  filteredInventory += item.quantity || 0;
                } else if (typeof item === 'number') {
                  filteredInventory += item || 0;
                }
              });
            });
          }
        }
      });
      
      return filteredInventory;
    }
    
    return totalInventory;
  }, [selectedModel, selectedColor]);

  // 출고일 기준 재고 분류 함수 (검색된 재고 또는 총재고 기준)
  const getInventoryByAge = useCallback((store) => {
    const now = new Date();
    const result = {
      within30: 0,    // 30일 이내
      within60: 0,    // 30-60일
      over60: 0       // 60일 이상
    };

    if (!store.inventory) return result;

    // 검색된 모델/색상이 있는지 확인
    const hasSearchFilter = selectedModel || selectedColor;

    Object.values(store.inventory).forEach(category => {
      if (!category || typeof category !== 'object') return;
      Object.entries(category).forEach(([modelName, model]) => {
        if (!model || typeof model !== 'object') return;
        
        // 검색 필터가 있고, 해당 모델이 선택되지 않은 경우 스킵
        if (hasSearchFilter && selectedModel && modelName !== selectedModel) return;
        
        Object.values(model).forEach(status => {
          if (!status || typeof status !== 'object') return;
          Object.entries(status).forEach(([color, item]) => {
            // 검색 필터가 있고, 해당 색상이 선택되지 않은 경우 스킵
            if (hasSearchFilter && selectedColor && color !== selectedColor) return;
            
            // 새로운 구조: { quantity: number, shippedDate: string }
            if (typeof item === 'object' && item && item.shippedDate && item.quantity) {
              const days = Math.floor((now - new Date(item.shippedDate)) / (1000 * 60 * 60 * 24));
              if (days <= 30) {
                result.within30 += item.quantity;
              } else if (days <= 60) {
                result.within60 += item.quantity;
              } else {
                result.over60 += item.quantity;
              }
            }
          });
        });
      });
    });



    return result;
  }, [selectedModel, selectedColor]);

  // 마커 아이콘 생성 함수
  const createMarkerIcon = useCallback((store) => {
    const isSelected = selectedStore?.id === store.id;
    const isLoggedInStore = loggedInStoreId === store.id;
    const isRequestedStore = requestedStore?.id === store.id;
    const inventoryCount = calculateInventory(store);
    const inventoryByAge = getInventoryByAge(store);
    const hasInventory = inventoryCount > 0;

    let fillColor, strokeColor, radius, iconStyle, urgencyIcon = '';

    // 출고일 기준 긴급도 아이콘 결정 (비중 기준)
    const totalFilteredInventory = inventoryByAge.within30 + inventoryByAge.within60 + inventoryByAge.over60;
    
    if (totalFilteredInventory > 0) {
      // 비중이 가장 높은 카테고리로 결정
      const within30Ratio = inventoryByAge.within30 / totalFilteredInventory;
      const within60Ratio = inventoryByAge.within60 / totalFilteredInventory;
      const over60Ratio = inventoryByAge.over60 / totalFilteredInventory;
      
      if (over60Ratio >= within30Ratio && over60Ratio >= within60Ratio) {
        urgencyIcon = '⚠️';
      } else if (within60Ratio >= within30Ratio) {
        urgencyIcon = '⚡';
      } else {
        urgencyIcon = '✅';
      }
    }

    // 1. 요청점 (최우선)
    if (isRequestedStore) {
      fillColor = '#ff9800';
      strokeColor = '#f57c00';
      radius = 18;
      iconStyle = 'border: 3px solid #ff9800; box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.3);';
    }
    // 2. 선택된 매장
    else if (isSelected) {
      fillColor = '#2196f3';
      strokeColor = '#1976d2';
      radius = 16;
      iconStyle = '';
    }
    // 3. 로그인한 매장
    else if (isLoggedInStore) {
      fillColor = '#9c27b0';
      strokeColor = '#7b1fa2';
      radius = 16;
      iconStyle = '';
    }
    // 4. 일반 매장 - 출고일 기준 색상 조정 (비중 기준)
    else {
      const totalFilteredInventory = inventoryByAge.within30 + inventoryByAge.within60 + inventoryByAge.over60;
      
      if (totalFilteredInventory > 0) {
        // 비중이 가장 높은 카테고리로 색상 결정
        const within30Ratio = inventoryByAge.within30 / totalFilteredInventory;
        const within60Ratio = inventoryByAge.within60 / totalFilteredInventory;
        const over60Ratio = inventoryByAge.over60 / totalFilteredInventory;
        
        if (over60Ratio >= within30Ratio && over60Ratio >= within60Ratio) {
          // 60일 이상 비중이 높음: 주황색
          fillColor = hasInventory ? '#ff9800' : '#f44336';
          strokeColor = hasInventory ? '#f57c00' : '#d32f2f';
        } else if (within60Ratio >= within30Ratio) {
          // 30-60일 비중이 높음: 노란색
          fillColor = hasInventory ? '#ffc107' : '#f44336';
          strokeColor = hasInventory ? '#ff8f00' : '#d32f2f';
        } else {
          // 30일 이내 비중이 높음: 초록색
          fillColor = hasInventory ? '#4caf50' : '#f44336';
          strokeColor = hasInventory ? '#388e3c' : '#d32f2f';
        }
      } else {
        // 출고일 정보가 없는 경우 기본 색상
        fillColor = hasInventory ? '#4caf50' : '#f44336';
        strokeColor = hasInventory ? '#388e3c' : '#d32f2f';
      }
      radius = hasInventory ? 14 : 10;
      iconStyle = '';
    }

    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: ${radius * 2}px;
          height: ${radius * 2}px;
          background-color: ${fillColor};
          border: 2px solid ${strokeColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${radius > 12 ? '12px' : '10px'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ${iconStyle}
          position: relative;
        ">
          ${inventoryCount > 0 ? inventoryCount : ''}
          ${urgencyIcon && (
            `<div style="
              position: absolute;
              top: -8px;
              right: -8px;
              background: rgba(0,0,0,0.8);
              border-radius: 50%;
              width: 16px;
              height: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              color: white;
            ">${urgencyIcon}</div>`
          )}
        </div>
      `,
      iconSize: [radius * 2, radius * 2],
      iconAnchor: [radius, radius]
    });
  }, [selectedStore, loggedInStoreId, calculateInventory, getInventoryByAge]);

  // 지도 로드 핸들러
  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    mapRef.current = mapInstance; // ref 설정
    
    // 지도가 완전히 로드될 때까지 대기 (더 긴 대기 시간)
    setTimeout(() => {
      // 추가 안전 검사
      if (mapInstance && mapInstance._loaded && mapInstance._mapPane) {
        setIsMapReady(true);
        setIsMapInitialized(true);
      } else {
        // 지도가 아직 준비되지 않았으면 다시 시도
        setTimeout(() => {
          if (mapInstance && mapInstance._loaded && mapInstance._mapPane) {
            setIsMapReady(true);
            setIsMapInitialized(true);
          }
        }, 500);
      }
    }, 500); // 더 긴 대기 시간으로 조정
    
    // 사용자 인터랙션 이벤트 리스너 추가
    mapInstance.on('dragstart', () => {
      setUserInteracted(true);
    });
    
    mapInstance.on('zoomstart', () => {
      setUserInteracted(true);
    });
  }, []);

  // 안전한 지도 조작 함수
  const safeMapOperation = useCallback((operation) => {
    if (map && isMapReady && map._loaded && map._mapPane && map._leaflet_pos) {
      try {
        operation();
      } catch (error) {
        console.warn('지도 조작 중 오류 발생:', error);
      }
    }
  }, [map, isMapReady]);

  // 선택된 매장으로 지도 이동
  useEffect(() => {
    if (!selectedStore || !selectedStore.latitude || !selectedStore.longitude) return;
    
    // 이전에 선택된 매장과 다른 경우에만 처리
    if (previousSelectedStoreRef.current !== selectedStore.id) {
      const position = {
        lat: parseFloat(selectedStore.latitude),
        lng: parseFloat(selectedStore.longitude)
      };
      
      safeMapOperation(() => {
        // 현재 줌 레벨을 유지하면서 위치만 이동 (줌 레벨 강제 변경 방지)
        const currentZoom = map.getZoom();
        const targetZoom = Math.max(currentZoom, isAgentMode ? 12 : 14); // 최소 줌 레벨만 설정
        
        map.setView([position.lat, position.lng], targetZoom, {
          animate: true,
          duration: 1.5 // 애니메이션 시간을 늘려서 더 자연스럽게
        });
      });
      
      // 선택한 매장 ID 저장
      previousSelectedStoreRef.current = selectedStore.id;
    }
  }, [map, selectedStore, safeMapOperation, isAgentMode]);

  // 강제 확대 (검색 결과 선택 시) - 직접 지도 조작
  useEffect(() => {
    if (forceZoomToStore && mapRef.current && mapRef.current._mapPane && mapRef.current._leaflet_pos) {
      const { lat, lng } = forceZoomToStore;
      
      try {
        const mapInstance = mapRef.current;
        if (mapInstance._loaded && mapInstance._mapPane && mapInstance._leaflet_pos) {
          mapInstance.setView([lat, lng], 14, {
            animate: true,
            duration: 1.5 // 애니메이션 시간을 늘려서 더 자연스럽게
          });
        }
      } catch (error) {
        console.error('강제 확대 직접 조작 오류:', error);
      }
    }
  }, [forceZoomToStore]);

  // 지도 범위 계산 (각 모드별 최적화)
  const mapBounds = useMemo(() => {
    if (!filteredStores.length && !userLocation) return null;
    
    const bounds = L.latLngBounds();

    // 매장 위치 추가 (재고가 있는 매장만)
    filteredStores.forEach(store => {
      if (store.latitude && store.longitude && store.hasInventory) {
        bounds.extend([parseFloat(store.latitude), parseFloat(store.longitude)]);
      }
    });
    
    // 개통실적 마커가 있는 경우 해당 위치도 추가
    if (showActivationMarkers && activationData) {
      Object.entries(activationData).forEach(([storeName, data]) => {
        const storeLocation = filteredStores.find(store => store.name === storeName);
        if (storeLocation && storeLocation.latitude && storeLocation.longitude) {
          bounds.extend([parseFloat(storeLocation.latitude), parseFloat(storeLocation.longitude)]);
        }
      });
    }
    
    // 사용자 위치 추가 (일반 모드에서만)
    if (userLocation && !isAgentMode) {
      bounds.extend([userLocation.lat, userLocation.lng]);
    }
    
    // 경계가 유효한지 확인
    if (bounds && typeof bounds.isEmpty === 'function' && bounds.isEmpty()) {
      return null;
    }
    
    return bounds;
  }, [filteredStores, userLocation, isAgentMode, showActivationMarkers, activationData]);
      
  // 초기 로드 시 지도 범위 설정 (각 모드별 최적화)
  useEffect(() => {
    if (mapBounds && (initialLoadRef.current || !userInteracted) && !forceZoomToStore) {
      safeMapOperation(() => {
        // 각 모드별 최대 줌 레벨 설정
        let maxZoom;
        if (isAgentMode) {
          if (currentView === 'all') maxZoom = 9;         // 전체재고확인: 매우 넓은 시야
          else if (currentView === 'assigned') maxZoom = 10; // 담당재고확인: 넓은 시야
          else if (currentView === 'activation') maxZoom = 11; // 담당개통확인: 중간 시야
          else maxZoom = 10;
        } else {
          maxZoom = 12; // 일반 매장 모드: 중간 시야
        }
        
        map.fitBounds(mapBounds, {
          animate: true,
          duration: 1.5,
          maxZoom: maxZoom, // 최대 줌 레벨 제한
          padding: [20, 20] // 경계에 여백 추가
        });
        
        console.log(`지도 초기 뷰 설정: ${isAgentMode ? '관리자' : '일반'} 모드, ${currentView || '기본'} 뷰, 최대줌: ${maxZoom}`);
      });
      initialLoadRef.current = false;
    }
  }, [map, mapBounds, userInteracted, safeMapOperation, isAgentMode, currentView, forceZoomToStore]);

  // 반경 변경 시 지도 범위 재설정
  useEffect(() => {
    if (!userLocation || !selectedRadius || isAgentMode) return;
    
    if (initialLoadRef.current || !userInteracted) {
      const bounds = L.latLngBounds([
        [userLocation.lat - selectedRadius / 111000, userLocation.lng - selectedRadius / (111000 * Math.cos(userLocation.lat * Math.PI / 180))],
        [userLocation.lat + selectedRadius / 111000, userLocation.lng + selectedRadius / (111000 * Math.cos(userLocation.lat * Math.PI / 180))]
      ]);
      
      safeMapOperation(() => {
        // 일반 매장 모드에서 반경 변경 시 최대 줌 레벨 제한
        const maxZoom = 13;
        
        map.fitBounds(bounds, {
          animate: true,
          duration: 1.5,
          maxZoom: maxZoom
        });
      });
    }
  }, [map, selectedRadius, userLocation, isAgentMode, userInteracted, safeMapOperation]);

  return (
          <Paper sx={getMapContainerStyle(isMapExpanded)}>
      {/* 확대/축소 토글 버튼 */}
      <Box sx={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        backgroundColor: 'white',
        borderRadius: 1,
        boxShadow: 2,
        p: 0.5
      }}>
        <Button
          size="small"
          variant="outlined"
          onClick={onMapExpandToggle}
          sx={{
            minWidth: 'auto',
            px: 1,
            py: 0.5,
            fontSize: '12px',
            backgroundColor: 'white'
          }}
        >
          {isMapExpanded ? '축소' : '확대'}
        </Button>
      </Box>
      
      <MapContainer
        key={`map-${isAgentMode ? 'agent' : 'store'}-${currentView || 'default'}-${currentView === 'activation' ? 'activation' : mapKey}`}
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={mapZoom}
        style={getContainerStyle(isMapExpanded)}
        whenCreated={onMapLoad}
        zoomControl={true}
        attributionControl={false}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* 지도 뷰 업데이트 */}
        <MapUpdater 
          center={mapCenter} 
          bounds={mapBounds} 
          zoom={mapZoom}
          isAgentMode={isAgentMode}
          currentView={currentView}
          forceZoomToStore={forceZoomToStore}
        />
        
        {/* 강제 확대 업데이트 */}
        <ForceZoomUpdater 
          forceZoomToStore={forceZoomToStore}
        />
        
        {/* 매장 마커들 (담당개통확인 모드에서는 재고 마커 숨김) */}
        {currentView !== 'activation' && filteredStores.map((store) => {
          if (!store.latitude || !store.longitude) return null;
          
          const inventoryCount = calculateInventory(store);
          const inventoryByAge = getInventoryByAge(store);
          const isSelected = selectedStore?.id === store.id;
          const isLoggedInStore = loggedInStoreId === store.id;
          
          return (
            <Marker
              key={store.id}
              position={[parseFloat(store.latitude), parseFloat(store.longitude)]}
              icon={createMarkerIcon(store)}
              eventHandlers={{
                click: () => onStoreSelect(store)
              }}
            >

              <Popup>
                <div>
                  <h3>{store.name}</h3>
                  
                  {/* 담당재고확인 모드일 때만 모델별 재고 표시 */}
                  {isAgentMode && currentView === 'assigned' ? (
                    <div>
                      {store.inventory && (
                        <div>
                          {Object.entries(store.inventory).map(([category, models]) => {
                            if (!models || typeof models !== 'object') return null;
                            
                            return Object.entries(models).map(([model, statuses]) => {
                              if (!statuses || typeof statuses !== 'object') return null;
                              
                              // 해당 모델의 총 재고 계산
                              let modelTotal = 0;
                              const colorDetails = [];
                              
                              Object.entries(statuses).forEach(([status, colors]) => {
                                if (colors && typeof colors === 'object') {
                                  Object.entries(colors).forEach(([color, item]) => {
                                    let quantity = 0;
                                    if (typeof item === 'object' && item && item.quantity) {
                                      quantity = item.quantity;
                                    } else if (typeof item === 'number') {
                                      quantity = item;
                                    }
                                    if (quantity && quantity > 0) {
                                      modelTotal += quantity;
                                      colorDetails.push(`${color}: ${quantity}개`);
                                    }
                                  });
                                }
                              });
                              
                              if (modelTotal > 0) {
                                return (
                                  <div key={model} style={{ marginBottom: '8px' }}>
                                    <p style={{ fontWeight: 'bold', margin: '0 0 4px 0', color: '#2196f3' }}>
                                      {model}: {modelTotal}개
                                    </p>
                                    <div style={{ fontSize: '0.9em', color: '#666', marginLeft: '8px' }}>
                                      {colorDetails.join(', ')}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            });
                          })}
                        </div>
                      )}
                      
                      {/* 출고일 기준 재고 정보 */}
                      {(inventoryByAge.within30 > 0 || inventoryByAge.within60 > 0 || inventoryByAge.over60 > 0) && (
                        <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                          <p style={{ fontWeight: 'bold', margin: '0 0 8px 0', fontSize: '0.9em' }}>출고일 기준 재고:</p>
                          <div style={{ fontSize: '0.85em' }}>
                            {inventoryByAge.over60 > 0 && (
                              <p style={{ margin: '2px 0', color: '#ff9800' }}>⚠️ 60일 이상: {inventoryByAge.over60}개</p>
                            )}
                            {inventoryByAge.within60 > 0 && (
                              <p style={{ margin: '2px 0', color: '#ffc107' }}>⚡ 30-60일: {inventoryByAge.within60}개</p>
                            )}
                            {inventoryByAge.within30 > 0 && (
                              <p style={{ margin: '2px 0', color: '#4caf50' }}>✅ 30일 이내: {inventoryByAge.within30}개</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {isSelected && <p style={{color: '#2196f3', fontWeight: 'bold', marginTop: '8px'}}>✓ 선택됨</p>}
                      {isLoggedInStore && <p style={{color: '#9c27b0', fontWeight: 'bold'}}>내 매장</p>}
                    </div>
                  ) : (
                    /* 기존 말풍선 내용 (전체재고확인 및 일반 모드) */
                    <div>
                      <p>재고: {inventoryCount}개</p>
                      
                      {/* 출고일 기준 재고 정보 */}
                      {(inventoryByAge.within30 > 0 || inventoryByAge.within60 > 0 || inventoryByAge.over60 > 0) && (
                        <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                          <p style={{ fontWeight: 'bold', margin: '0 0 4px 0', fontSize: '0.85em' }}>출고일 기준:</p>
                          <div style={{ fontSize: '0.8em' }}>
                            {inventoryByAge.over60 > 0 && (
                              <span style={{ color: '#ff9800', marginRight: '8px' }}>⚠️ {inventoryByAge.over60}개</span>
                            )}
                            {inventoryByAge.within60 > 0 && (
                              <span style={{ color: '#ffc107', marginRight: '8px' }}>⚡ {inventoryByAge.within60}개</span>
                            )}
                            {inventoryByAge.within30 > 0 && (
                              <span style={{ color: '#4caf50' }}>✅ {inventoryByAge.within30}개</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {store.address && <p>주소: {store.address}</p>}
                      {isSelected && <p style={{color: '#2196f3', fontWeight: 'bold'}}>✓ 선택됨</p>}
                      {isLoggedInStore && <p style={{color: '#9c27b0', fontWeight: 'bold'}}>내 매장</p>}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* 개통실적 마커들 (담당개통확인 화면에서만 표시) */}
        {showActivationMarkers && activationData && Object.entries(activationData).map(([storeName, data]) => {
          // 담당자 필터링 (담당개통확인 모드에서만)
          if (currentView === 'activation' && isAgentMode && agentTarget) {
            if (!data.agents || !data.agents.includes(agentTarget)) {
              return null; // 해당 담당자가 담당하지 않는 매장은 마커 표시 안함
            }
          }
          
          // 해당 매장의 위치 정보 찾기
          const storeLocation = filteredStores.find(store => store.name === storeName);
          if (!storeLocation || !storeLocation.latitude || !storeLocation.longitude) return null;
          
          const { currentMonth, previousMonth, models, agents, lastActivationDate } = data;
          
          // 모델 검색이 있는 경우 해당 모델의 판매량만 계산
          let displayCurrent = currentMonth;
          let displayPrevious = previousMonth;
          let displayModels = models;
          
          if (activationModelSearch) {
            displayCurrent = 0;
            displayPrevious = 0;
            displayModels = {};
            
            Object.entries(models).forEach(([modelKey, count]) => {
              if (modelKey.startsWith(activationModelSearch + ' (')) {
                displayCurrent += count;
                displayModels[modelKey] = count;
              }
            });
            
            // 전월 데이터도 비율로 계산
            if (currentMonth > 0 && previousMonth > 0) {
              displayPrevious = Math.round((displayCurrent / currentMonth) * previousMonth);
            }
          } else if (activationDateSearch) {
            // 날짜 검색이 있는 경우 - 이미 해당 날짜의 데이터만 필터링되어 있음
            // 추가 필터링 불필요 (백엔드에서 이미 처리됨)
          }
          
          // 개통실적이 있는 경우에만 마커 표시
          if (displayCurrent === 0 && displayPrevious === 0) return null;
          
          // 비교 결과에 따른 색상 결정
          let markerColor = '#FF9800'; // 동일 (주황색)
          if (displayCurrent > displayPrevious) {
            markerColor = '#4CAF50'; // 증가 (초록색)
          } else if (displayCurrent < displayPrevious) {
            markerColor = '#F44336'; // 감소 (빨간색)
          }
          
          // 개통실적 마커 아이콘 생성
          const activationIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div style="
                background-color: ${markerColor};
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 10px;
                text-align: center;
                line-height: 1.2;
              ">
                <div style="font-size: 12px;">${displayCurrent}</div>
                <div style="font-size: 8px; opacity: 0.8;">${displayPrevious}</div>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
          });
          
          return (
            <Marker
              key={`activation-${storeName}`}
              position={[parseFloat(storeLocation.latitude), parseFloat(storeLocation.longitude)]}
              icon={activationIcon}
              eventHandlers={{
                click: () => {
                  // 개통실적 상세 정보 팝업 표시 (향후 구현 예정)
                }
              }}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>{storeName}</h3>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      marginBottom: '4px',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      <span style={{ color: '#0ea5e9' }}>
                        {activationModelSearch ? `${activationModelSearch}: ` : ''}당월: {displayCurrent}개
                      </span>
                      <span style={{ 
                        color: markerColor,
                        fontSize: '16px'
                      }}>
                        {displayCurrent > displayPrevious ? '↗️' : displayCurrent < displayPrevious ? '↘️' : '→'}
                      </span>
                      <span style={{ color: '#64748b' }}>전월: {displayPrevious}개</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      기준일: {activationDateSearch ? 
                        new Date(activationDateSearch).toLocaleDateString('ko-KR') : 
                        (lastActivationDate ? lastActivationDate.toLocaleDateString('ko-KR') : '날짜 정보 없음')
                      }
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '8px' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#374151' }}>담당자</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {agents.map((agent, idx) => (
                        <span key={idx} style={{
                          background: '#e0f2fe',
                          color: '#0277bd',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: '500'
                        }}>
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#374151' }}>
                      {activationModelSearch ? `${activationModelSearch} 상세` : '모델별 실적'}
                    </h4>
                    <div style={{ fontSize: '11px' }}>
                      {Object.entries(displayModels).map(([model, count]) => (
                        <div key={model} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '2px 0'
                        }}>
                          <span style={{ color: '#1e293b' }}>{model}</span>
                          <span style={{ color: '#0ea5e9', fontWeight: '600' }}>{count}개</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* 검색 반경 원 (관리자 모드가 아닐 때만) */}
        {userLocation && selectedRadius && !isAgentMode && (
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={selectedRadius}
            pathOptions={{
              fillColor: '#4285F4',
              fillOpacity: 0.1,
              color: '#4285F4',
              opacity: 0.8,
              weight: 2
            }}
      />
        )}
      </MapContainer>
    </Paper>
  );
}

export default Map; 