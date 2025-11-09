import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { Paper, Box, Button } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import QuickCostPreview from './QuickCostPreview';

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
          // 지도 상태 확인 (간소화된 검사)
          const isMapReady = map && 
            map._loaded && 
            map._container && 
            map.setView;
          
          if (isMapReady) {
            console.log('지도 확대 실행:', { lat, lng, zoom: zoom || 14 });
            
            // 즉시 확대 실행 (애니메이션 없이)
            map.setView([lat, lng], zoom || 14, {
              animate: false,
              duration: 0
            });
            
            // 확대 후 애니메이션으로 부드럽게 이동
            setTimeout(() => {
              if (map && map.setView) {
                map.setView([lat, lng], zoom || 14, {
                  animate: true,
                  duration: 1.0
                });
              }
            }, 100);
            
            return;
          }
          
          // 재시도 로직 (최대 5회, 200ms 간격으로 단축)
          if (attemptCount < 5) {
            console.log(`지도 확대 재시도 ${attemptCount + 1}/5`);
            setTimeout(() => attemptZoom(attemptCount + 1), 200);
          } else {
            console.warn('ForceZoomUpdater 최대 재시도 횟수 초과 - 강제 실행');
            
            // 강제 실행 (지도 상태와 관계없이)
            try {
              if (map && map.setView) {
                console.log('강제 확대 실행');
                map.setView([lat, lng], zoom || 14, {
                  animate: false,
                  duration: 0
                });
              }
            } catch (finalError) {
              console.error('강제 확대 실행 실패:', finalError);
            }
          }
        } catch (error) {
          console.error('ForceZoomUpdater 오류:', error);
          // 오류 발생 시에도 재시도
          if (attemptCount < 5) {
            setTimeout(() => attemptZoom(attemptCount + 1), 200);
          }
        }
      };
      
      // 초기 시도 (지연 시간 단축)
      setTimeout(() => attemptZoom(), 300);
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
  loggedInStore, // 일반모드 카톡문구생성을 위해 추가
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
  onMapExpandToggle, // 맵 확대 토글 함수
  rememberedRequests, // 기억된 요청 목록
  setRememberedRequests, // 기억된 요청 목록 설정 함수
  onQuickCostClick // 퀵비용 등록 버튼 클릭 핸들러
}) {
  const [map, setMap] = useState(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapCenter, setMapCenter] = useState(userLocation || defaultCenter);

  // 기억 기능 함수
  const handleRemember = (store, model, color) => {
    if (!store || !model || !color) {
      alert('모델과 색상을 모두 선택해주세요.');
      return;
    }

    const newRequest = {
      id: Date.now(),
      storeName: store.name,
      model: model,
      color: color,
      manager: store.manager, // 매장의 담당자 정보
      requestedStore: requestedStore, // 요청점 정보
      timestamp: new Date().toLocaleString()
    };

    setRememberedRequests(prev => [...prev, newRequest]);
    alert(`${store.name}의 ${model} / ${color} 모델이 기억되었습니다!`);
  };


  // 일반모드용 카톡문구 생성 함수
  const handleKakaoTalk = (store, model, color, loggedInStore) => {
    if (!store || !model || !color || !loggedInStore) {
      alert('모델과 색상을 모두 선택해주세요.');
      return;
    }

    const message = `📱 앱 전송 메시지
↓↓↓↓↓ 영업사원요청 메시지 ↓↓↓↓↓

안녕하세요! ${store.name}에서
${model} / ${color} 모델
사용 가능한지 확인 부탁드립니다
${loggedInStore.name}으로 이동 예정입니다.
감사합니다.

↓↓↓↓↓ 매장전달용 메시지 ↓↓↓↓↓
(여기까지 메시지는 지우고 매장에전달)

안녕하세요! 
단말기 요청 드립니다.
${model} / ${color} 모델
일련번호 사진 부탁드립니다
${loggedInStore.name}으로 이동 예정입니다.
바쁘신데도 협조해주셔서 감사합니다.`;

    // 클립보드에 복사
    navigator.clipboard.writeText(message).then(() => {
      alert('카카오톡 문구가 복사되었습니다!\n\n담당자에게 @태그는 직접 추가해주세요!');
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
      alert('클립보드 복사에 실패했습니다.');
    });
  };
  
  // 마커들의 경계를 계산하는 함수
  const calculateBounds = (stores) => {
    if (!stores || stores.length === 0) return null;
    
    const validStores = stores.filter(store => {
      if (!store) return false;
      
      const lat = store.latitude;
      const lng = store.longitude;
      
      // null, undefined, 빈 문자열, 0, NaN 체크
      if (!lat || !lng || 
          lat === null || lng === null ||
          lat === undefined || lng === undefined ||
          lat === '' || lng === '' ||
          isNaN(parseFloat(lat)) || isNaN(parseFloat(lng)) ||
          parseFloat(lat) === 0 || parseFloat(lng) === 0) {
        return false;
      }
      
      return true;
    });
    
    if (validStores.length === 0) {
      console.warn('No valid stores with coordinates found for bounds calculation');
      return null;
    }
    
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
      if (currentView === 'all') return 6;       // 전체재고확인: 대한민국 전체 (줌 레벨 낮춤)
      if (currentView === 'assigned') return 9;  // 담당재고확인: 담당자 거래처 전체 (줌 레벨 낮춤)
      if (currentView === 'activation') return 10; // 담당개통확인: 중간 시야
      return 6; // 기본값: 전체재고확인과 동일
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
    const isOfficeStore = store.name && store.name.includes('사무실'); // 사무실 체크
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
    // 2. 사무실 (특별한 색상 - 청록색, 더 눈에 띄게)
    else if (isOfficeStore) {
      fillColor = '#21f8fb';
      strokeColor = '#000000'; // 검은색 테두리로 더 눈에 띄게
      radius = 18; // 크기도 더 크게
      iconStyle = 'border: 3px solid #000000; box-shadow: 0 0 0 2px rgba(33, 248, 251, 0.4), 0 0 8px rgba(33, 248, 251, 0.6);'; // 적당한 그림자 효과
    }
    // 3. 선택된 매장
    else if (isSelected) {
      fillColor = '#2196f3';
      strokeColor = '#1976d2';
      radius = 16;
      iconStyle = '';
    }
    // 4. 로그인한 매장
    else if (isLoggedInStore) {
      fillColor = '#9c27b0';
      strokeColor = '#7b1fa2';
      radius = 16;
      iconStyle = '';
    }
    // 5. 일반 매장 - 출고일 기준 색상 조정 (비중 기준)
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
          color: ${isOfficeStore ? 'black' : 'white'};
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

  // 선택된 매장으로 지도 이동 및 Popup 자동 열기 (개선된 버전)
  useEffect(() => {
    if (!selectedStore || !selectedStore.latitude || !selectedStore.longitude || !map) return;
    
    // 이전에 선택된 매장과 다른 경우에만 처리
    if (previousSelectedStoreRef.current !== selectedStore.id) {
      const position = {
        lat: parseFloat(selectedStore.latitude),
        lng: parseFloat(selectedStore.longitude)
      };
      
      safeMapOperation(() => {
        // 현재 지도 범위 확인
        const currentBounds = map.getBounds();
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();
        
        // 선택한 매장이 현재 화면에 보이는지 확인
        const isVisible = currentBounds.contains([position.lat, position.lng]);
        
        // 선택한 매장과 현재 중심점의 거리 계산
        const distance = currentCenter.distanceTo([position.lat, position.lng]);
        
        // 거리가 가까우면 (500m 이내) 이동하지 않음
        if (isVisible && distance < 500) {
          console.log('매장이 화면에 보이므로 지도 이동하지 않음');
        } else {
          // 현재 줌 레벨 유지 (강제 변경하지 않음)
          map.setView([position.lat, position.lng], currentZoom, {
            animate: true,
            duration: 0.8 // 애니메이션 시간 단축
          });
        }
        
        // 선택된 매장의 마커 Popup 자동으로 열기
        setTimeout(() => {
          try {
            // 지도에서 모든 레이어를 순회하며 해당 위치의 마커 찾기
            let foundMarker = null;
            map.eachLayer((layer) => {
              if (layer instanceof L.Marker) {
                const markerLat = layer.getLatLng().lat;
                const markerLng = layer.getLatLng().lng;
                // 좌표가 거의 일치하는지 확인 (0.0001도 이내, 약 11m)
                if (Math.abs(markerLat - position.lat) < 0.0001 && 
                    Math.abs(markerLng - position.lng) < 0.0001) {
                  foundMarker = layer;
                }
              }
            });
            
            if (foundMarker && foundMarker.getPopup) {
              const popup = foundMarker.getPopup();
              if (popup) {
                foundMarker.openPopup();
              }
            }
          } catch (error) {
            console.warn('Popup 열기 실패:', error);
          }
        }, 300); // 지도 이동 후 약간의 지연을 두고 Popup 열기
      });
      
      // 선택한 매장 ID 저장
      previousSelectedStoreRef.current = selectedStore.id;
    }
  }, [map, selectedStore, safeMapOperation]);

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
          if (currentView === 'all') maxZoom = 7;         // 전체재고확인: 대한민국 전체 (최대 줌 낮춤)
          else if (currentView === 'assigned') maxZoom = 9; // 담당재고확인: 담당자 거래처 전체 (최대 줌 낮춤)
          else if (currentView === 'activation') maxZoom = 11; // 담당개통확인: 중간 시야
          else maxZoom = 7;
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
        {currentView !== 'activation' && (() => {
          // 좌표별로 매장들을 그룹화
          const coordinateGroups = {};
          filteredStores.forEach(store => {
            if (!store.latitude || !store.longitude) return;
            
            const lat = parseFloat(store.latitude).toFixed(6);
            const lng = parseFloat(store.longitude).toFixed(6);
            const coordKey = `${lat},${lng}`;
            
            if (!coordinateGroups[coordKey]) {
              coordinateGroups[coordKey] = [];
            }
            coordinateGroups[coordKey].push(store);
          });

          // 각 좌표 그룹에 대해 마커 렌더링
          return Object.entries(coordinateGroups).map(([coordKey, stores]) => {
            // 선택된 매장이 있는 경우 해당 매장을 단일 매장으로 처리
            const selectedStoreInGroup = stores.find(store => selectedStore?.id === store.id);
            if (selectedStoreInGroup) {
              const store = selectedStoreInGroup;
              
              // 강력한 좌표 검증
              if (!store || !store.latitude || !store.longitude || 
                  isNaN(parseFloat(store.latitude)) || isNaN(parseFloat(store.longitude)) ||
                  parseFloat(store.latitude) === 0 || parseFloat(store.longitude) === 0 ||
                  parseFloat(store.latitude) === null || parseFloat(store.longitude) === null) {
                console.warn('Invalid coordinates for store:', store?.storeName, store?.latitude, store?.longitude);
                return null;
              }
              
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
                  
                  {/* 관리자모드일 때는 출고일 기준 재고 표시, 일반모드일 때는 영업사원요청문구 버튼 표시 */}
                  {isAgentMode ? (
                    <div>
                      {/* 퀵비용 예상 정보 (관리자 모드에서 요청점이 있는 경우 - 매장명 아래, 모델명/색상 정보 위) */}
                      {requestedStore && requestedStore.id && store.id && (
                        <QuickCostPreview
                          key={`quickcost-${requestedStore.id}-${store.id}-${selectedStore?.id === store.id ? 'selected' : 'normal'}`}
                          fromStoreId={requestedStore.id}
                          toStoreId={store.id}
                          fromStoreName={requestedStore.name}
                          toStoreName={store.name}
                          onQuickCostClick={onQuickCostClick}
                        />
                      )}
                      
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
                      
                      {/* 선택됨/기억/퀵비등록 버튼을 같은 줄에 배치 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        {isSelected && <span style={{color: '#2196f3', fontWeight: 'bold', fontSize: '12px'}}>✓ 선택됨</span>}
                        {isLoggedInStore && <span style={{color: '#9c27b0', fontWeight: 'bold', fontSize: '12px'}}>내 매장</span>}
                        
                        <button 
                          onClick={() => handleRemember(store, selectedModel, selectedColor)}
                          disabled={!selectedModel || !selectedColor}
                          style={{
                            padding: '6px 8px',
                            backgroundColor: selectedModel && selectedColor ? '#4CAF50' : '#F5F5F5',
                            color: selectedModel && selectedColor ? 'white' : '#999',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: selectedModel && selectedColor ? 'pointer' : 'not-allowed',
                            minWidth: '50px'
                          }}
                        >
                          기억
                        </button>
                        
                        {/* 퀵비등록 버튼 - 관리자모드: onQuickCostClick과 store만 있으면 활성화 */}
                        {(() => {
                          const isDisabled = !onQuickCostClick || !store;
                          if (isDisabled) {
                            console.log('퀵비등록 버튼 비활성화 상태 (관리자모드):', { 
                              onQuickCostClick: !!onQuickCostClick, 
                              store: !!store,
                              storeType: typeof store,
                              storeValue: store,
                              requestedStore: !!requestedStore,
                              requestedStoreValue: requestedStore
                            });
                          }
                          return (
                            <button 
                              onClick={() => {
                                if (onQuickCostClick && requestedStore && store) {
                                  const fromStore = requestedStore;
                                  const toStore = store;
                                  onQuickCostClick(fromStore, toStore);
                                } else {
                                  console.log('퀵비등록 버튼 클릭 실패:', { onQuickCostClick: !!onQuickCostClick, requestedStore: !!requestedStore, store: !!store });
                                }
                              }}
                              disabled={isDisabled}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: (onQuickCostClick && store) ? '#2196f3' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: (onQuickCostClick && store) ? 'pointer' : 'not-allowed',
                                minWidth: '60px',
                                opacity: (onQuickCostClick && store) ? 1 : 0.6
                              }}
                            >
                              퀵비등록
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    /* 일반모드일 때는 영업사원요청문구 버튼 표시 */
                    <div>
                      {store.address && <p>주소: {store.address}</p>}
                      
                      {/* 퀵비용 예상 정보 (주소 아래, 재고 위) */}
                      {loggedInStore && loggedInStore.id && store.id && (
                        <QuickCostPreview
                          key={`quickcost-${loggedInStore.id}-${store.id}-${selectedStore?.id === store.id ? 'selected' : 'normal'}`}
                          fromStoreId={loggedInStore.id}
                          toStoreId={store.id}
                          fromStoreName={loggedInStore.name}
                          toStoreName={store.name}
                          onQuickCostClick={onQuickCostClick}
                        />
                      )}
                      
                      <p>재고: {inventoryCount}개</p>
                      
                      {/* 선택됨/퀵비등록 버튼을 같은 줄에 배치 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        {isSelected && <span style={{color: '#2196f3', fontWeight: 'bold', fontSize: '12px'}}>✓ 선택됨</span>}
                        {isLoggedInStore && <span style={{color: '#9c27b0', fontWeight: 'bold', fontSize: '12px'}}>내 매장</span>}
                        
                        {/* 퀵비등록 버튼 - 일반모드: onQuickCostClick과 store만 있으면 활성화 */}
                        {(() => {
                          const isDisabled = !onQuickCostClick || !store;
                          if (isDisabled) {
                            console.log('퀵비등록 버튼 비활성화 상태:', { 
                              onQuickCostClick: !!onQuickCostClick, 
                              store: !!store,
                              storeType: typeof store,
                              storeValue: store,
                              loggedInStore: !!loggedInStore,
                              loggedInStoreValue: loggedInStore
                            });
                          }
                          return (
                            <button 
                              onClick={() => {
                                if (onQuickCostClick && loggedInStore && store) {
                                  const fromStore = loggedInStore;
                                  const toStore = store;
                                  onQuickCostClick(fromStore, toStore);
                                } else {
                                  console.log('퀵비등록 버튼 클릭 실패:', { onQuickCostClick: !!onQuickCostClick, loggedInStore: !!loggedInStore, store: !!store });
                                }
                              }}
                              disabled={isDisabled}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: (onQuickCostClick && store) ? '#2196f3' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: (onQuickCostClick && store) ? 'pointer' : 'not-allowed',
                                minWidth: '60px',
                                opacity: (onQuickCostClick && store) ? 1 : 0.6
                              }}
                            >
                              퀵비등록
                            </button>
                          );
                        })()}
                      </div>
                      
                      {/* 영업사원요청문구/기억 버튼을 아래로 이동 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <button 
                          onClick={() => handleKakaoTalk(store, selectedModel, selectedColor, loggedInStore)}
                          disabled={!selectedModel || !selectedColor}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            backgroundColor: selectedModel && selectedColor ? '#FEE500' : '#F5F5F5',
                            color: selectedModel && selectedColor ? '#3C1E1E' : '#999',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: selectedModel && selectedColor ? 'pointer' : 'not-allowed',
                            minWidth: '80px'
                          }}
                        >
                          영업사원요청문구
                        </button>
                        
                        <button 
                          onClick={() => handleRemember(store, selectedModel, selectedColor)}
                          disabled={!selectedModel || !selectedColor}
                          style={{
                            padding: '6px 8px',
                            backgroundColor: selectedModel && selectedColor ? '#4CAF50' : '#F5F5F5',
                            color: selectedModel && selectedColor ? 'white' : '#999',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: selectedModel && selectedColor ? 'pointer' : 'not-allowed',
                            minWidth: '50px'
                          }}
                        >
                          기억
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
            }
            
            if (stores.length === 1) {
              // 단일 매장인 경우 기존 로직
              const store = stores[0];
              
              // 강력한 좌표 검증
              if (!store || !store.latitude || !store.longitude || 
                  isNaN(parseFloat(store.latitude)) || isNaN(parseFloat(store.longitude)) ||
                  parseFloat(store.latitude) === 0 || parseFloat(store.longitude) === 0 ||
                  parseFloat(store.latitude) === null || parseFloat(store.longitude) === null) {
                console.warn('Invalid coordinates for store:', store?.storeName, store?.latitude, store?.longitude);
                return null;
              }
              
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
                  
                  {/* 관리자모드일 때는 출고일 기준 재고 표시, 일반모드일 때는 영업사원요청문구 버튼 표시 */}
                  {isAgentMode ? (
                    <div>
                      {/* 퀵비용 예상 정보 (관리자 모드에서 요청점이 있는 경우 - 매장명 아래, 모델명/색상 정보 위) */}
                      {requestedStore && requestedStore.id && store.id && (
                        <QuickCostPreview
                          key={`quickcost-${requestedStore.id}-${store.id}-${selectedStore?.id === store.id ? 'selected' : 'normal'}`}
                          fromStoreId={requestedStore.id}
                          toStoreId={store.id}
                          fromStoreName={requestedStore.name}
                          toStoreName={store.name}
                          onQuickCostClick={onQuickCostClick}
                        />
                      )}
                      
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
                      
                      {/* 선택됨/기억/퀵비등록 버튼을 같은 줄에 배치 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        {isSelected && <span style={{color: '#2196f3', fontWeight: 'bold', fontSize: '12px'}}>✓ 선택됨</span>}
                        {isLoggedInStore && <span style={{color: '#9c27b0', fontWeight: 'bold', fontSize: '12px'}}>내 매장</span>}
                        
                        <button 
                          onClick={() => handleRemember(store, selectedModel, selectedColor)}
                          disabled={!selectedModel || !selectedColor}
                          style={{
                            padding: '6px 8px',
                            backgroundColor: selectedModel && selectedColor ? '#4CAF50' : '#F5F5F5',
                            color: selectedModel && selectedColor ? 'white' : '#999',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: selectedModel && selectedColor ? 'pointer' : 'not-allowed',
                            minWidth: '50px'
                          }}
                        >
                          기억
                        </button>
                        
                        {/* 퀵비등록 버튼 - 관리자모드: onQuickCostClick과 store만 있으면 활성화 */}
                        {(() => {
                          const isDisabled = !onQuickCostClick || !store;
                          if (isDisabled) {
                            console.log('퀵비등록 버튼 비활성화 상태 (관리자모드):', { 
                              onQuickCostClick: !!onQuickCostClick, 
                              store: !!store,
                              storeType: typeof store,
                              storeValue: store,
                              requestedStore: !!requestedStore,
                              requestedStoreValue: requestedStore
                            });
                          }
                          return (
                            <button 
                              onClick={() => {
                                if (onQuickCostClick && requestedStore && store) {
                                  const fromStore = requestedStore;
                                  const toStore = store;
                                  onQuickCostClick(fromStore, toStore);
                                } else {
                                  console.log('퀵비등록 버튼 클릭 실패:', { onQuickCostClick: !!onQuickCostClick, requestedStore: !!requestedStore, store: !!store });
                                }
                              }}
                              disabled={isDisabled}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: (onQuickCostClick && store) ? '#2196f3' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: (onQuickCostClick && store) ? 'pointer' : 'not-allowed',
                                minWidth: '60px',
                                opacity: (onQuickCostClick && store) ? 1 : 0.6
                              }}
                            >
                              퀵비등록
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    /* 일반모드일 때는 영업사원요청문구 버튼 표시 */
                    <div>
                      {store.address && <p>주소: {store.address}</p>}
                      
                      {/* 퀵비용 예상 정보 (주소 아래, 재고 위) */}
                      {loggedInStore && loggedInStore.id && store.id && (
                        <QuickCostPreview
                          key={`quickcost-${loggedInStore.id}-${store.id}-${selectedStore?.id === store.id ? 'selected' : 'normal'}`}
                          fromStoreId={loggedInStore.id}
                          toStoreId={store.id}
                          fromStoreName={loggedInStore.name}
                          toStoreName={store.name}
                          onQuickCostClick={onQuickCostClick}
                        />
                      )}
                      
                      <p>재고: {inventoryCount}개</p>
                      
                      {/* 선택됨/퀵비등록 버튼을 같은 줄에 배치 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        {isSelected && <span style={{color: '#2196f3', fontWeight: 'bold', fontSize: '12px'}}>✓ 선택됨</span>}
                        {isLoggedInStore && <span style={{color: '#9c27b0', fontWeight: 'bold', fontSize: '12px'}}>내 매장</span>}
                        
                        {/* 퀵비등록 버튼 - 일반모드: onQuickCostClick과 store만 있으면 활성화 */}
                        {(() => {
                          const isDisabled = !onQuickCostClick || !store;
                          if (isDisabled) {
                            console.log('퀵비등록 버튼 비활성화 상태:', { 
                              onQuickCostClick: !!onQuickCostClick, 
                              store: !!store,
                              storeType: typeof store,
                              storeValue: store,
                              loggedInStore: !!loggedInStore,
                              loggedInStoreValue: loggedInStore
                            });
                          }
                          return (
                            <button 
                              onClick={() => {
                                if (onQuickCostClick && loggedInStore && store) {
                                  const fromStore = loggedInStore;
                                  const toStore = store;
                                  onQuickCostClick(fromStore, toStore);
                                } else {
                                  console.log('퀵비등록 버튼 클릭 실패:', { onQuickCostClick: !!onQuickCostClick, loggedInStore: !!loggedInStore, store: !!store });
                                }
                              }}
                              disabled={isDisabled}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: (onQuickCostClick && store) ? '#2196f3' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: (onQuickCostClick && store) ? 'pointer' : 'not-allowed',
                                minWidth: '60px',
                                opacity: (onQuickCostClick && store) ? 1 : 0.6
                              }}
                            >
                              퀵비등록
                            </button>
                          );
                        })()}
                      </div>
                      
                      {/* 영업사원요청문구/기억 버튼을 아래로 이동 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <button 
                          onClick={() => handleKakaoTalk(store, selectedModel, selectedColor, loggedInStore)}
                          disabled={!selectedModel || !selectedColor}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            backgroundColor: selectedModel && selectedColor ? '#FEE500' : '#F5F5F5',
                            color: selectedModel && selectedColor ? '#3C1E1E' : '#999',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: selectedModel && selectedColor ? 'pointer' : 'not-allowed',
                            minWidth: '80px'
                          }}
                        >
                          영업사원요청문구
                        </button>
                        
                        <button 
                          onClick={() => handleRemember(store, selectedModel, selectedColor)}
                          disabled={!selectedModel || !selectedColor}
                          style={{
                            padding: '6px 8px',
                            backgroundColor: selectedModel && selectedColor ? '#4CAF50' : '#F5F5F5',
                            color: selectedModel && selectedColor ? 'white' : '#999',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: selectedModel && selectedColor ? 'pointer' : 'not-allowed',
                            minWidth: '50px'
                          }}
                        >
                          기억
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
            } else {
              // 중복 좌표에 여러 매장이 있는 경우 하나의 마커로 표시하고 클릭 시 말풍선으로 선택
              const firstStore = stores[0];
              
              // 강력한 좌표 검증
              if (!firstStore || !firstStore.latitude || !firstStore.longitude || 
                  isNaN(parseFloat(firstStore.latitude)) || isNaN(parseFloat(firstStore.longitude)) ||
                  parseFloat(firstStore.latitude) === 0 || parseFloat(firstStore.longitude) === 0 ||
                  parseFloat(firstStore.latitude) === null || parseFloat(firstStore.longitude) === null) {
                console.warn('Invalid coordinates for duplicate group:', firstStore?.storeName, firstStore?.latitude, firstStore?.longitude);
                return null;
              }
              
              const baseLat = parseFloat(firstStore.latitude);
              const baseLng = parseFloat(firstStore.longitude);
              
              // 대표 매장 선택 로직 개선
              let representativeStore;
              let isSelected = false;
              
              // 1. 선택된 매장이 있으면 해당 매장을 대표로 사용
              const selectedStoreInGroup = stores.find(store => selectedStore?.id === store.id);
              if (selectedStoreInGroup) {
                representativeStore = selectedStoreInGroup;
                isSelected = true;
              }
              // 2. 선택된 매장이 없으면 사무실이 있으면 사무실, 없으면 첫 번째 매장
              else {
                representativeStore = stores.find(store => store.name && store.name.includes('사무실')) || stores[0];
              }
              
              // 선택되지 않은 상태일 때는 총 합산 수량을 계산
              let totalInventoryCount = 0;
              if (!isSelected) {
                totalInventoryCount = stores.reduce((total, store) => {
                  return total + calculateInventory(store);
                }, 0);
              }
              
              // 중복 좌표용 마커 아이콘 생성 함수
              const createDuplicateMarkerIcon = (store, isSelected, totalCount) => {
                if (isSelected) {
                  // 선택된 상태면 기존 로직 사용
                  return createMarkerIcon(store);
                } else {
                  // 선택되지 않은 상태면 회색으로 총 합산 수량 표시
                  return L.divIcon({
                    className: 'custom-marker',
                    html: `
                      <div style="
                        width: 36px;
                        height: 36px;
                        background-color: #666666;
                        border: 2px solid #888888;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 12px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        position: relative;
                      ">
                        ${totalCount > 0 ? totalCount : ''}
                      </div>
                    `,
                    iconSize: [36, 36],
                    iconAnchor: [18, 18]
                  });
                }
              };
              
              return (
                <Marker
                  key={`duplicate-${coordKey}`}
                  position={[baseLat, baseLng]}
                  icon={createDuplicateMarkerIcon(representativeStore, isSelected, totalInventoryCount)}
                  eventHandlers={{
                    click: () => {
                      // 선택되지 않은 상태면 아무것도 하지 않음 (말풍선만 표시)
                      // 선택된 상태면 해당 매장을 다시 선택
                      if (isSelected) {
                        onStoreSelect(representativeStore);
                      }
                    }
                  }}
                >
                  <Popup>
                    <div>
                      <h3>같은 위치의 매장들 ({stores.length}개)</h3>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {stores.map((store, index) => {
                          const isSelected = selectedStore?.id === store.id;
                          const isLoggedInStore = loggedInStoreId === store.id;
                          const isRequestedStore = requestedStore?.id === store.id;
                          const isOfficeStore = store.name && store.name.includes('사무실');
                          const inventoryCount = calculateInventory(store);
                          const inventoryByAge = getInventoryByAge(store);
                          const hasInventory = inventoryCount > 0;
                          
                          // 마커와 동일한 색상 로직 적용
                          let fillColor, strokeColor;
                          
                          // 1. 요청점 (최우선)
                          if (isRequestedStore) {
                            fillColor = '#ff9800';
                            strokeColor = '#f57c00';
                          }
                          // 2. 사무실 (특별한 색상 - 청록색)
                          else if (isOfficeStore) {
                            fillColor = '#21f8fb';
                            strokeColor = '#000000';
                          }
                          // 3. 선택된 매장
                          else if (isSelected) {
                            fillColor = '#2196f3';
                            strokeColor = '#1976d2';
                          }
                          // 4. 로그인한 매장
                          else if (isLoggedInStore) {
                            fillColor = '#9c27b0';
                            strokeColor = '#7b1fa2';
                          }
                          // 5. 일반 매장 - 출고일 기준 색상 조정
                          else {
                            const totalFilteredInventory = inventoryByAge.within30 + inventoryByAge.within60 + inventoryByAge.over60;
                            
                            if (totalFilteredInventory > 0) {
                              const within30Ratio = inventoryByAge.within30 / totalFilteredInventory;
                              const within60Ratio = inventoryByAge.within60 / totalFilteredInventory;
                              const over60Ratio = inventoryByAge.over60 / totalFilteredInventory;
                              
                              if (over60Ratio >= within30Ratio && over60Ratio >= within60Ratio) {
                                fillColor = hasInventory ? '#ff9800' : '#f44336';
                                strokeColor = hasInventory ? '#f57c00' : '#d32f2f';
                              } else if (within60Ratio >= within30Ratio) {
                                fillColor = hasInventory ? '#ffc107' : '#f44336';
                                strokeColor = hasInventory ? '#ff8f00' : '#d32f2f';
                              } else {
                                fillColor = hasInventory ? '#4caf50' : '#f44336';
                                strokeColor = hasInventory ? '#388e3c' : '#d32f2f';
                              }
                            } else {
                              fillColor = hasInventory ? '#4caf50' : '#f44336';
                              strokeColor = hasInventory ? '#388e3c' : '#d32f2f';
                            }
                          }
                          
                          return (
                            <div 
                              key={store.id}
                              style={{ 
                                padding: '8px', 
                                border: '1px solid #e0e0e0', 
                                borderRadius: '4px', 
                                marginBottom: '4px',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? '#e3f2fd' : '#f9f9f9'
                              }}
                              onClick={() => onStoreSelect(store)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                {/* 마커 색상 표시 */}
                                <div 
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    backgroundColor: fillColor,
                                    border: `2px solid ${strokeColor}`,
                                    marginRight: '8px',
                                    flexShrink: 0
                                  }}
                                />
                                <div style={{ fontWeight: 'bold', flex: 1 }}>
                                  {store.name}
                                  {isSelected && <span style={{color: '#2196f3', marginLeft: '8px'}}>✓ 선택됨</span>}
                                  {isLoggedInStore && <span style={{color: '#9c27b0', marginLeft: '8px'}}>내 매장</span>}
                                </div>
                                {/* 재고 수량을 마커 색상 원 안에 표시 */}
                                {inventoryCount > 0 && (
                                  <div 
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                      backgroundColor: fillColor,
                                      border: `2px solid ${strokeColor}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      color: isOfficeStore ? 'black' : 'white',
                                      marginLeft: '8px'
                                    }}
                                  >
                                    {inventoryCount}
                                  </div>
                                )}
                              </div>
                              
                              {/* 관리자모드에서만 출고일 기준 재고 표시 */}
                              {isAgentMode && currentView === 'assigned' && inventoryByAge && 
                               (inventoryByAge.within30 > 0 || inventoryByAge.within60 > 0 || inventoryByAge.over60 > 0) && (
                                <div style={{ fontSize: '0.8em', marginTop: '4px' }}>
                                  {inventoryByAge.over60 > 0 && (
                                    <span style={{ color: '#ff9800', marginRight: '8px' }}>⚠️ {inventoryByAge.over60}</span>
                                  )}
                                  {inventoryByAge.within60 > 0 && (
                                    <span style={{ color: '#ffc107', marginRight: '8px' }}>⚡ {inventoryByAge.within60}</span>
                                  )}
                                  {inventoryByAge.within30 > 0 && (
                                    <span style={{ color: '#4caf50', marginRight: '8px' }}>✅ {inventoryByAge.within30}</span>
                                  )}
                                </div>
                              )}
                              
                              {/* 퀵비용 예상 정보 */}
                              {((isAgentMode && requestedStore && requestedStore.id) || (!isAgentMode && loggedInStore && loggedInStore.id)) && store.id && (
                                <QuickCostPreview
                                  key={`quickcost-${isAgentMode && requestedStore ? requestedStore.id : (loggedInStore?.id || '')}-${store.id}-${selectedStore?.id === store.id ? 'selected' : 'normal'}`}
                                  fromStoreId={isAgentMode && requestedStore ? requestedStore.id : (loggedInStore?.id || '')}
                                  toStoreId={store.id}
                                  fromStoreName={isAgentMode && requestedStore ? requestedStore.name : (loggedInStore?.name || '')}
                                  toStoreName={store.name}
                                  onQuickCostClick={onQuickCostClick}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            }
          });
        })()}
        
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