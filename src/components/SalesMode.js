import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { 
  Paper, 
  Box, 
  Button, 
  Typography, 
  Card, 
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { 
  FilterList, 
  Search, 
  Refresh, 
  LocationOn, 
  Business,
  TrendingUp,
  Close
} from '@mui/icons-material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api';

// Leaflet 마커 아이콘 설정
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 실적별 마커 색상 설정
const getMarkerColor = (performance) => {
  if (performance === 0) return '#ff0000'; // 빨간색 (실적 0)
  if (performance >= 50) return '#4caf50'; // 초록색 (높은 실적)
  if (performance >= 20) return '#ff9800'; // 주황색 (중간 실적)
  return '#2196f3'; // 파란색 (낮은 실적)
};

// 실적별 마커 아이콘 생성
const createCustomIcon = (performance) => {
  const color = getMarkerColor(performance);
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        ${performance}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

const defaultCenter = {
  lat: 37.5665,
  lng: 126.9780
};

// 필터 패널 컴포넌트
const SalesFilterPanel = ({ filters, setFilters, filterOptions }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      regions: [],
      subRegions: [],
      agentCodes: [],
      agentNames: [],
      posCodes: [],
      storeNames: [],
      minPerformance: '',
      maxPerformance: ''
    });
  };

  return (
    <Box sx={{ position: 'absolute', top: 10, left: 10, zIndex: 1000 }}>
      <Button
        variant="contained"
        startIcon={<FilterList />}
        onClick={() => setIsOpen(!isOpen)}
        sx={{ mb: 1 }}
      >
        영업 필터 설정
      </Button>
      
      {isOpen && (
        <Paper sx={{ p: 2, width: 300, maxHeight: 400, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">필터 설정</Typography>
            <IconButton size="small" onClick={() => setIsOpen(false)}>
              <Close />
            </IconButton>
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          {/* 광역상권 필터 */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>광역상권</Typography>
          <Box sx={{ mb: 2 }}>
            {filterOptions.regions.map(region => (
              <Chip
                key={region}
                label={region}
                size="small"
                onClick={() => handleFilterChange('regions', 
                  filters.regions.includes(region) 
                    ? filters.regions.filter(r => r !== region)
                    : [...filters.regions, region]
                )}
                color={filters.regions.includes(region) ? 'primary' : 'default'}
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
          </Box>
          
          {/* 세부상권 필터 */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>세부상권</Typography>
          <Box sx={{ mb: 2 }}>
            {filterOptions.subRegions.map(subRegion => (
              <Chip
                key={subRegion}
                label={subRegion}
                size="small"
                onClick={() => handleFilterChange('subRegions',
                  filters.subRegions.includes(subRegion)
                    ? filters.subRegions.filter(r => r !== subRegion)
                    : [...filters.subRegions, subRegion]
                )}
                color={filters.subRegions.includes(subRegion) ? 'primary' : 'default'}
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
          </Box>
          
          {/* 실적 범위 필터 */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>실적 범위</Typography>
          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <input
                type="number"
                placeholder="최소"
                value={filters.minPerformance}
                onChange={(e) => handleFilterChange('minPerformance', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <input
                type="number"
                placeholder="최대"
                value={filters.maxPerformance}
                onChange={(e) => handleFilterChange('maxPerformance', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </Grid>
          </Grid>
          
          <Button
            variant="outlined"
            onClick={clearFilters}
            fullWidth
            sx={{ mb: 1 }}
          >
            필터 초기화
          </Button>
        </Paper>
      )}
    </Box>
  );
};

// 영업 모드 메인 컴포넌트
const SalesMode = () => {
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [filters, setFilters] = useState({
    regions: [],
    subRegions: [],
    agentCodes: [],
    agentNames: [],
    posCodes: [],
    storeNames: [],
    minPerformance: '',
    maxPerformance: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    regions: [],
    subRegions: [],
    agentCodes: [],
    agentNames: [],
    posCodes: [],
    storeNames: []
  });
  const [selectedMarker, setSelectedMarker] = useState(null);

  // 접근 권한 확인
  const checkAccess = useCallback(async () => {
    try {
      const response = await api.get('/api/sales-mode-access');
      if (response.data.success && response.data.hasAccess) {
        setAccessGranted(true);
        return true;
      } else {
        setError('영업 모드 접근 권한이 없습니다.');
        return false;
      }
    } catch (error) {
      console.error('접근 권한 확인 실패:', error);
      setError('접근 권한 확인 중 오류가 발생했습니다.');
      return false;
    }
  }, []);

  // 영업 데이터 로드
  const loadSalesData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/sales-data');
      
      if (response.data.success) {
        setSalesData(response.data.data);
        
        // 필터 옵션 생성
        const regions = [...new Set(response.data.data.salesData.map(item => item.region))];
        const subRegions = [...new Set(response.data.data.salesData.map(item => item.subRegion))];
        const agentCodes = [...new Set(response.data.data.salesData.map(item => item.agentCode))];
        const agentNames = [...new Set(response.data.data.salesData.map(item => item.agentName))];
        const posCodes = [...new Set(response.data.data.salesData.map(item => item.posCode))];
        const storeNames = [...new Set(response.data.data.salesData.map(item => item.storeName))];
        
        setFilterOptions({
          regions: regions.sort(),
          subRegions: subRegions.sort(),
          agentCodes: agentCodes.sort(),
          agentNames: agentNames.sort(),
          posCodes: posCodes.sort(),
          storeNames: storeNames.sort()
        });
      } else {
        setError('영업 데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('영업 데이터 로드 실패:', error);
      setError('영업 데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 필터링된 데이터 계산
  const filteredData = useMemo(() => {
    if (!salesData) return [];
    
    return Object.values(salesData.posCodeMap).filter(item => {
      // 지역 필터
      if (filters.regions.length > 0 && !filters.regions.includes(item.region)) {
        return false;
      }
      
      // 세부상권 필터
      if (filters.subRegions.length > 0 && !filters.subRegions.includes(item.subRegion)) {
        return false;
      }
      
      // 실적 범위 필터
      if (filters.minPerformance && item.totalPerformance < parseInt(filters.minPerformance)) {
        return false;
      }
      
      if (filters.maxPerformance && item.totalPerformance > parseInt(filters.maxPerformance)) {
        return false;
      }
      
      return true;
    });
  }, [salesData, filters]);

  // 초기 로드
  useEffect(() => {
    const initialize = async () => {
      const hasAccess = await checkAccess();
      if (hasAccess) {
        await loadSalesData();
      }
    };
    
    initialize();
  }, [checkAccess, loadSalesData]);

  // 데이터 새로고침
  const handleRefresh = async () => {
    await loadSalesData();
  };

  if (!accessGranted) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error">
          {error || '영업 모드에 접근할 수 없습니다.'}
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={handleRefresh}>
            재시도
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', position: 'relative' }}>
      {/* 필터 패널 */}
      <SalesFilterPanel 
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
      />
      
      {/* 새로고침 버튼 */}
      <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
        <Tooltip title="데이터 새로고침">
          <IconButton onClick={handleRefresh} color="primary">
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* 지도 */}
      <MapContainer
        center={defaultCenter}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* 마커들 */}
        {filteredData.map((item, index) => (
          <Marker
            key={`${item.posCode}-${index}`}
            position={[item.latitude, item.longitude]}
            icon={createCustomIcon(item.totalPerformance)}
            eventHandlers={{
              click: () => setSelectedMarker(item)
            }}
          >
            <Popup>
              <Box sx={{ minWidth: 200 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {item.storeName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  POS코드: {item.posCode}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  주소: {item.address}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  지역: {item.region} - {item.subRegion}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="h6" color="primary" sx={{ mb: 1 }}>
                  총 실적: {item.totalPerformance}개
                </Typography>
                
                {/* 대리점별 실적 */}
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  대리점별 실적:
                </Typography>
                {item.agents.map((agent, agentIndex) => (
                  <Box key={agentIndex} sx={{ mb: 0.5 }}>
                    <Typography variant="body2">
                      {agent.agentName} ({agent.agentCode}): {agent.performance}개
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* 요약 정보 */}
      <Box sx={{ 
        position: 'absolute', 
        bottom: 10, 
        left: 10, 
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 1,
        p: 2
      }}>
        <Typography variant="body2">
          총 {filteredData.length}개 매장 | 
          총 실적: {filteredData.reduce((sum, item) => sum + item.totalPerformance, 0)}개
        </Typography>
      </Box>
    </Box>
  );
};

export default SalesMode;
