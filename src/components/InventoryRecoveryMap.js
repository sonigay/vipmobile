import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';

// Leaflet 마커 아이콘 설정 (기본 아이콘 경로 문제 해결)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function InventoryRecoveryMap({ data, tabIndex, onStatusUpdate, onRefresh }) {
  const [selectedMarker, setSelectedMarker] = useState(null);

  // selectedMarker 상태 변화 로그
  useEffect(() => {
    console.log('selectedMarker 상태 변화:', selectedMarker);
  }, [selectedMarker]);
  
  // 지도 높이 토글 상태
  const [mapHeight, setMapHeight] = useState(600);
  
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [markerProgress, setMarkerProgress] = useState(0);
  const mapRef = useRef(null);

  // 마커 색상 정의 (Leaflet용)
  const markerColors = {
    default: '#ff9800',      // 주황색 (기본) - 더 잘 보임!
    selected: '#4caf50',     // 초록색 (선정된 곳)
    completed: '#9c27b0'     // 보라색 (완료된 곳)
  };

  // 기본 중심점 (한국)
  const defaultCenter = {
    lat: 37.5665,
    lng: 126.9780
  };

  // 마커 데이터 처리
  const processedMarkers = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 업체별로 데이터 그룹화 (같은 위치에 여러 항목이 있을 수 있음)
    const storeGroups = {};
    data.forEach(item => {
      const key = `${item.latitude}-${item.longitude}`;
      if (!storeGroups[key]) {
        storeGroups[key] = {
          latitude: item.latitude,
          longitude: item.longitude,
          storeName: item.storeName,
          items: [],
          totalCount: 0,
          selectedCount: 0,
          completedCount: 0
        };
      }
      
      storeGroups[key].items.push(item);
      storeGroups[key].totalCount++;
      
      if (item.recoveryTargetSelected) {
        storeGroups[key].selectedCount++;
      }
      if (item.recoveryCompleted) {
        storeGroups[key].completedCount++;
      }
    });

    // 마커 색상 결정
    return Object.values(storeGroups).map(store => {
      let color = markerColors.default;
      if (store.completedCount > 0) {
        color = markerColors.completed;
      } else if (store.selectedCount > 0) {
        color = markerColors.selected;
      }

      return {
        ...store,
        color,
        markerType: store.completedCount > 0 ? 'completed' : 
                   store.selectedCount > 0 ? 'selected' : 'default'
      };
    });
  }, [data]);

  // 데이터가 있으면 첫 번째 마커를 중심으로 설정
  useEffect(() => {
    if (processedMarkers.length > 0) {
      const firstMarker = processedMarkers[0];
      defaultCenter.lat = firstMarker.latitude;
      defaultCenter.lng = firstMarker.longitude;
    }
  }, [processedMarkers]);

  // 커스텀 마커 아이콘 생성
  const createCustomIcon = (color) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: 20px; 
        height: 20px; 
        background-color: ${color}; 
        border: 2px solid white; 
        border-radius: 50%; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  // 지도 로딩 완료 시 처리
  useEffect(() => {
    if (processedMarkers.length > 0) {
      setMapLoading(false);
    }
  }, [processedMarkers]);

  // 지도 높이 토글 함수
  const toggleMapHeight = () => {
    if (mapHeight === 600) {
      setMapHeight(800);      // 600px → 800px
    } else if (mapHeight === 800) {
      setMapHeight(1000);     // 800px → 1000px
    } else {
      setMapHeight(600);      // 1000px → 600px (순환)
    }
  };

  // 상태 변경 핸들러
  const handleStatusChange = async (store, action) => {
    try {
      if (action === 'select') {
        // 모든 항목을 회수대상으로 선정
        for (const item of store.items) {
          if (!item.recoveryTargetSelected) {
            await onStatusUpdate(item.rowIndex, 'recoveryTargetSelected', 'O');
          }
        }
      } else if (action === 'deselect') {
        // 모든 항목의 회수대상 선정 해제 및 회수완료도 함께 취소
        for (const item of store.items) {
          if (item.recoveryTargetSelected) {
            // 회수대상선정 취소
            await onStatusUpdate(item.rowIndex, 'recoveryTargetSelected', '');
            // 회수완료도 함께 취소
            if (item.recoveryCompleted) {
              await onStatusUpdate(item.rowIndex, 'recoveryCompleted', '');
            }
          }
        }
      } else if (action === 'complete') {
        // 모든 항목을 회수완료로 처리
        for (const item of store.items) {
          if (!item.recoveryCompleted) {
            await onStatusUpdate(item.rowIndex, 'recoveryCompleted', 'O');
          }
        }
      } else if (action === 'uncomplete') {
        // 모든 항목의 회수완료 해제
        for (const item of store.items) {
          if (item.recoveryCompleted) {
            await onStatusUpdate(item.rowIndex, 'recoveryCompleted', '');
          }
        }
      }
      
      setSelectedMarker(null);
    } catch (error) {
      console.error('상태 변경 오류:', error);
    }
  };

  // 데이터가 없는 경우
  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
                  {tabIndex === 0 && '총 회수대상 데이터가 없습니다.'}
        {tabIndex === 1 && '금일 회수대상 데이터가 없습니다.'}
        {tabIndex === 2 && '금일 회수완료 데이터가 없습니다.'}
        {tabIndex === 3 && '위경도좌표없는곳 데이터가 없습니다.'}
        </Typography>
      </Box>
    );
  }

    return (
    <Box>
      {/* 지도 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {tabIndex === 0 && '📦 총 회수대상 - 지도 보기'}
          {tabIndex === 1 && '🎯 금일 회수대상 - 지도 보기'}
          {tabIndex === 2 && '✅ 금일 회수완료 - 지도 보기'}
          {tabIndex === 3 && '⚠️ 위경도좌표없는곳 - 지도 보기'}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<LocationIcon />}
            onClick={onRefresh}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 마커 범례 */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              마커 범례:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 16, 
                height: 16, 
                backgroundColor: markerColors.default, 
                borderRadius: '50%',
                border: '1px solid #ccc'
              }} />
              <Typography variant="body2">기본</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 16, 
                height: 16, 
                backgroundColor: markerColors.selected, 
                borderRadius: '50%',
                border: '1px solid #ccc'
              }} />
              <Typography variant="body2">선정됨</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 16, 
                height: 16, 
                backgroundColor: markerColors.completed, 
                borderRadius: '50%',
                border: '1px solid #ccc'
              }} />
              <Typography variant="body2">완료됨</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 지도 높이 토글 버튼 */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              지도 크기:
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={toggleMapHeight}
              sx={{ minWidth: '120px' }}
            >
              {mapHeight === 600 ? '지도 크게' : 
               mapHeight === 800 ? '지도 더 크게' : '지도 작게'}
            </Button>
            <Typography variant="body2" color="text.secondary">
              현재: {mapHeight}px
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* 선택된 마커 정보 - 지도 위쪽으로 이동 */}
      {selectedMarker && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                📍 {selectedMarker.storeName}
              </Typography>
              <Button
                size="small"
                onClick={() => setSelectedMarker(null)}
              >
                닫기
              </Button>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* 마커 정보 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>담당자:</strong> {selectedMarker.items[0]?.manager || '담당자 미지정'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>주소:</strong> {selectedMarker.items[0]?.address || '주소 정보 없음'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>총 회수대상:</strong> {selectedMarker.totalCount}건
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>선정된 항목:</strong> {selectedMarker.selectedCount}건
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>완료된 항목:</strong> {selectedMarker.completedCount}건
              </Typography>
            </Box>

            {/* 액션 버튼 */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {tabIndex === 0 && (
                <>
                  {selectedMarker.selectedCount === 0 ? (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckIcon />}
                      onClick={() => handleStatusChange(selectedMarker, 'select')}
                      size="small"
                    >
                      회수 대상점 선정
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<CancelIcon />}
                      onClick={() => handleStatusChange(selectedMarker, 'deselect')}
                      size="small"
                    >
                      회수 대상점 취소
                    </Button>
                  )}
                </>
              )}

              {tabIndex === 1 && (
                <>
                  {selectedMarker.completedCount === 0 ? (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckIcon />}
                      onClick={() => handleStatusChange(selectedMarker, 'complete')}
                      size="small"
                    >
                      회수 완료
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<CancelIcon />}
                      onClick={() => handleStatusChange(selectedMarker, 'uncomplete')}
                      size="small"
                    >
                      회수 완료 취소
                    </Button>
                  )}
                </>
              )}
            </Box>

            {/* 상세 항목 목록 */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              상세 항목:
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                             {selectedMarker.items.map((item, index) => (
                 <Box key={index} sx={{ 
                   p: 1, 
                   mb: 1, 
                   backgroundColor: '#f5f5f5', 
                   borderRadius: 1,
                   border: '1px solid #e0e0e0'
                 }}>
                   <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                     {item.modelName} - {item.color} ({item.serialNumber}) / 상태: {item.deviceStatus} / 최근출고일: {item.recentShipmentDate || '정보없음'}
                   </Typography>
                   <Box sx={{ mt: 1 }}>
                     {item.recoveryTargetSelected && (
                       <Chip label="회수대상선정" size="small" color="success" sx={{ mr: 1 }} />
                     )}
                     {item.recoveryCompleted && (
                       <Chip label="회수완료" size="small" color="primary" />
                     )}
                   </Box>
                 </Box>
               ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 지도 컨테이너 - 확대/축소 기능 추가 */}
      <Card>
        <CardContent sx={{ p: 0, position: 'relative' }}>

                      <div style={{ width: '100%', height: `${mapHeight}px` }}>
            {processedMarkers.length > 0 ? (
              <MapContainer
                center={[defaultCenter.lat, defaultCenter.lng]}
                zoom={10}
                style={{ width: '100%', height: '100%' }}
                ref={mapRef}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                
                {/* 마커들 */}
                {processedMarkers.map((store, index) => (
                  <Marker
                    key={index}
                    position={[store.latitude, store.longitude]}
                    icon={createCustomIcon(store.color)}
                    eventHandlers={{
                      click: () => {
                        console.log('마커 클릭됨:', store);
                        setSelectedMarker(store);
                      }
                    }}
                  >
                    <Popup>
                      <div style={{ padding: '10px', minWidth: '250px' }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>
                          📍 {store.storeName}
                        </h3>
                        <p style={{ margin: '5px 0' }}>
                          <strong>총 회수대상:</strong> {store.totalCount}건
                        </p>
                        <p style={{ margin: '5px 0' }}>
                          <strong>선정된 항목:</strong> {store.selectedCount}건
                        </p>
                        <p style={{ margin: '5px 0' }}>
                          <strong>완료된 항목:</strong> {store.completedCount}건
                        </p>
                        
                        {/* 액션 버튼들 */}
                        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {tabIndex === 0 && (
                            <>
                              {store.selectedCount === 0 ? (
                                <button
                                  style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#4caf50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                  }}
                                  onClick={() => handleStatusChange(store, 'select')}
                                >
                                  ✅ 회수 대상점 선정
                                </button>
                              ) : (
                                <button
                                  style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                  }}
                                  onClick={() => handleStatusChange(store, 'deselect')}
                                >
                                  ❌ 회수 대상점 취소
                                </button>
                              )}
                            </>
                          )}

                          {tabIndex === 1 && (
                            <>
                              {store.completedCount === 0 ? (
                                <button
                                  style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#9c27b0',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                  }}
                                  onClick={() => handleStatusChange(store, 'complete')}
                                >
                                  ✅ 회수 완료
                                </button>
                              ) : (
                                <button
                                  style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                  }}
                                  onClick={() => handleStatusChange(store, 'uncomplete')}
                                >
                                  ❌ 회수 완료 취소
                                </button>
                              )}
                            </>
                          )}
                          
                          <button
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#2196f3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px'
                            }}
                            onClick={() => setSelectedMarker(store)}
                          >
                            📋 상세 정보 보기
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <Box sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#f5f5f5'
              }}>
                <Typography variant="body1" color="text.secondary">
                  표시할 데이터가 없습니다.
                </Typography>
              </Box>
            )}
          </div>
          
          {/* 로딩 오버레이 */}
          {mapLoading && (
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 1000
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <CircularProgress size={40} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  지도를 불러오는 중...
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default InventoryRecoveryMap;
