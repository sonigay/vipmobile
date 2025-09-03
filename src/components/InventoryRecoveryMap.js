import React, { useState, useEffect, useMemo } from 'react';
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

function InventoryRecoveryMap({ data, tabIndex, onStatusUpdate, onRefresh }) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');

  // 마커 색상 정의
  const markerColors = {
    default: '#ffeb3b',      // 노란색 (기본)
    selected: '#4caf50',     // 초록색 (선정된 곳)
    completed: '#9c27b0'     // 보라색 (완료된 곳)
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

  // 지도 초기화
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      initializeMap();
    } else {
      // Google Maps API 로딩 대기
      const timer = setInterval(() => {
        if (typeof window !== 'undefined' && window.google && window.google.maps) {
          clearInterval(timer);
          initializeMap();
        }
      }, 100);

      return () => clearInterval(timer);
    }
  }, [processedMarkers]);

  // 지도 초기화 함수
  const initializeMap = () => {
    try {
      setMapLoading(true);
      setMapError('');

      // 지도 컨테이너 확인
      const mapContainer = document.getElementById('inventory-recovery-map');
      if (!mapContainer) {
        throw new Error('지도 컨테이너를 찾을 수 없습니다.');
      }

      // 기본 중심점 (한국)
      const defaultCenter = { lat: 36.5, lng: 127.5 };
      
      // 데이터가 있으면 첫 번째 마커를 중심으로 설정
      if (processedMarkers.length > 0) {
        const firstMarker = processedMarkers[0];
        defaultCenter.lat = firstMarker.latitude;
        defaultCenter.lng = firstMarker.longitude;
      }

      // 지도 생성
      const map = new window.google.maps.Map(mapContainer, {
        center: defaultCenter,
        zoom: 10,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // 마커 생성
      processedMarkers.forEach(store => {
        const marker = new window.google.maps.Marker({
          position: { lat: store.latitude, lng: store.longitude },
          map: map,
          title: `${store.storeName} (${store.totalCount}건)`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: store.color,
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2
          }
        });

        // 마커 클릭 이벤트
        marker.addListener('click', () => {
          setSelectedMarker(store);
        });

        // 정보창 생성
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; min-width: 200px;">
              <h3 style="margin: 0 0 10px 0; color: #1976d2;">${store.storeName}</h3>
              <p style="margin: 5px 0;"><strong>총 회수대상:</strong> ${store.totalCount}건</p>
              <p style="margin: 5px 0;"><strong>선정된 항목:</strong> ${store.selectedCount}건</p>
              <p style="margin: 5px 0;"><strong>완료된 항목:</strong> ${store.completedCount}건</p>
              <div style="margin-top: 10px;">
                <div style="display: inline-block; width: 12px; height: 12px; background-color: ${markerColors.default}; border-radius: 50%; margin-right: 5px;"></div>
                <span style="font-size: 12px;">기본</span>
                <div style="display: inline-block; width: 12px; height: 12px; background-color: ${markerColors.selected}; border-radius: 50%; margin-right: 5px; margin-left: 10px;"></div>
                <span style="font-size: 12px;">선정</span>
                <div style="display: inline-block; width: 12px; height: 12px; background-color: ${markerColors.completed}; border-radius: 50%; margin-right: 5px; margin-left: 10px;"></div>
                <span style="font-size: 12px;">완료</span>
              </div>
            </div>
          `
        });

        // 마커에 정보창 연결
        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      });

      setMapLoading(false);
    } catch (error) {
      console.error('지도 초기화 오류:', error);
      setMapError(error.message);
      setMapLoading(false);
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
        // 모든 항목의 회수대상 선정 해제
        for (const item of store.items) {
          if (item.recoveryTargetSelected) {
            await onStatusUpdate(item.rowIndex, 'recoveryTargetSelected', '');
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

      {/* 지도 컨테이너 */}
      <Card>
        <CardContent sx={{ p: 0, position: 'relative' }}>
          <div 
            id="inventory-recovery-map" 
            style={{ 
              width: '100%', 
              height: '600px',
              position: 'relative'
            }}
          />
          
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

          {/* 에러 오버레이 */}
          {mapError && (
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              zIndex: 1000
            }}>
              <Alert severity="error">
                지도 로딩 실패: {mapError}
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 선택된 마커 정보 */}
      {selectedMarker && (
        <Card sx={{ mt: 2 }}>
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
                    {item.modelName} - {item.color} ({item.serialNumber})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    담당자: {item.manager} | 현황: {item.status} | 상태: {item.deviceStatus}
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
    </Box>
  );
}

export default InventoryRecoveryMap;
