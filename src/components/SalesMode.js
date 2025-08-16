import React, { useEffect, useState, useCallback, useMemo, useRef, useTransition } from 'react';
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
  Close,
  Update,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AppUpdatePopup from './AppUpdatePopup';
import AddressHierarchyFilter from './AddressHierarchyFilter';
import AgentHierarchyFilter from './AgentHierarchyFilter';

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





// 실적 범위 필터 패널 컴포넌트
const PerformanceFilterPanel = ({ filters, setFilters }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      minPerformance: '',
      maxPerformance: ''
    }));
  };

  return (
    <Box sx={{ position: 'absolute', top: 70, left: 390, zIndex: 1000 }}>
      <Button
        variant="contained"
        startIcon={<FilterList />}
        onClick={() => setIsOpen(!isOpen)}
        sx={{ 
          mb: 1, 
          backgroundColor: '#4caf50',
          '&:hover': { backgroundColor: '#388e3c' }
        }}
      >
        실적 범위 설정
      </Button>
      
      {isOpen && (
        <Paper sx={{ 
          p: 3, 
          width: 300, 
          maxHeight: '60vh', 
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
              실적 범위 설정
            </Typography>
            <IconButton size="small" onClick={() => setIsOpen(false)}>
              <Close />
            </IconButton>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          {/* 실적 범위 필터 */}
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}>
            실적 범위
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <input
                type="number"
                placeholder="최소 실적"
                value={filters.minPerformance}
                onChange={(e) => handleFilterChange('minPerformance', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <input
                type="number"
                placeholder="최대 실적"
                value={filters.maxPerformance}
                onChange={(e) => handleFilterChange('maxPerformance', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

// 영업 모드 메인 컴포넌트
const SalesMode = ({ onLogout, loggedInStore, onModeChange, availableModes }) => {
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [filters, setFilters] = useState({
    // 주소 계층 필터
    provinces: [],
    cities: [],
    districts: [],
    detailAreas: [],
    // 대리점 계층 필터
    managers: [],
    branches: [],
    agents: [],
    // 실적 범위 필터
    minPerformance: '',
    maxPerformance: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    salesData: [],
    provinces: [],
    cities: [],
    districts: [],
    detailAreas: [],
    managers: [],
    branches: [],
    agents: []
  });
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  // 접근 권한 확인
  const checkAccess = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-mode-access`);
      const data = await response.json();
      
      if (data.success && data.hasAccess) {
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

    // 영업 데이터 로드 (캐시 활용 + 메모리 최적화)
  const loadSalesData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 캐시된 데이터가 있는지 확인 (안전한 읽기)
      try {
        const cachedData = sessionStorage.getItem('sales_data_cache');
        const cacheTimestamp = sessionStorage.getItem('sales_data_timestamp');
        const now = Date.now();
        
        // 캐시가 1시간 이내인지 확인
        if (cachedData && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 60 * 60 * 1000) {
          // 로그 최소화 (성능 최적화)
          // console.log('📦 [SALES] 세션 캐시에서 데이터 로드');
          const data = JSON.parse(cachedData);
          setSalesData(data);
          
          // 필터 옵션 생성 (메모리 최적화: 필요한 데이터만 추출)
          setFilterOptions({
            salesData: data.salesData,
            provinces: [],
            cities: [],
            districts: [],
            detailAreas: [],
            managers: [],
            branches: [],
            agents: []
          });
          
          setLoading(false);
          return;
        }
      } catch (error) {
        console.warn('캐시 읽기 실패:', error);
        // 캐시 오류 시 기존 캐시 정리
        sessionStorage.removeItem('sales_data_cache');
        sessionStorage.removeItem('sales_data_timestamp');
      }
      
             // 로그 최소화 (성능 최적화)
       // console.log('🌐 [SALES] 서버에서 데이터 로드');
       const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-data`);
      const data = await response.json();
      
      if (data.success) {
        setSalesData(data.data);
        
        // 세션 스토리지에 캐시 저장 (용량 제한 적용)
        try {
          const dataString = JSON.stringify(data.data);
          const dataSize = new Blob([dataString]).size;
          const maxSize = 5 * 1024 * 1024; // 5MB 제한
          const now = Date.now();
          
          if (dataSize <= maxSize) {
            sessionStorage.setItem('sales_data_cache', dataString);
            sessionStorage.setItem('sales_data_timestamp', now.toString());
            console.log(`✅ [SALES] 캐시 저장 완료 (${(dataSize / 1024 / 1024).toFixed(2)}MB)`);
          } else {
            console.warn(`⚠️ [SALES] 데이터가 너무 큽니다 (${(dataSize / 1024 / 1024).toFixed(2)}MB). 캐시 저장을 건너뜁니다.`);
            // 기존 캐시 정리
            sessionStorage.removeItem('sales_data_cache');
            sessionStorage.removeItem('sales_data_timestamp');
          }
        } catch (error) {
          console.warn('캐시 저장 실패:', error);
          // 기존 캐시 정리
          sessionStorage.removeItem('sales_data_cache');
          sessionStorage.removeItem('sales_data_timestamp');
        }
        
        // 필터 옵션 생성 (메모리 최적화: 필요한 데이터만 추출)
        setFilterOptions({
          salesData: data.data.salesData,
          provinces: [],
          cities: [],
          districts: [],
          detailAreas: [],
          managers: [],
          branches: [],
          agents: []
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

  // 필터링된 데이터 계산 (성능 최적화)
  const filteredData = useMemo(() => {
    if (!salesData) return [];
    
    // 필터 조건이 없는 경우 빈 배열 반환 (성능 최적화)
    const hasFilters = filters.provinces.length > 0 || 
                      filters.cities.length > 0 || 
                      filters.districts.length > 0 || 
                      filters.detailAreas.length > 0 ||
                      filters.managers.length > 0 || 
                      filters.branches.length > 0 || 
                      filters.agents.length > 0 || 
                      filters.minPerformance || 
                      filters.maxPerformance;
    
    if (!hasFilters) {
      return []; // 필터가 없으면 아무것도 표시하지 않음
    }
    
    return Object.values(salesData.posCodeMap).filter(item => {
      // 주소 계층 필터
      if (filters.provinces.length > 0 && !filters.provinces.includes(item.province)) {
        return false;
      }
      
      if (filters.cities.length > 0 && !filters.cities.includes(item.city)) {
        return false;
      }
      
      if (filters.districts.length > 0 && !filters.districts.includes(item.district)) {
        return false;
      }
      
      if (filters.detailAreas.length > 0 && !filters.detailAreas.includes(item.detailArea)) {
        return false;
      }
      
      // 대리점 계층 필터
      if (filters.managers.length > 0 && !filters.managers.includes(item.manager)) {
        return false;
      }
      
      if (filters.branches.length > 0 && !filters.branches.includes(item.branch)) {
        return false;
      }
      
      if (filters.agents.length > 0) {
        const itemAgents = Array.from(item.agents.values()).map(agent => `${agent.agentName} (${agent.agentCode})`);
        const hasMatchingAgent = itemAgents.some(agent => filters.agents.includes(agent));
        if (!hasMatchingAgent) {
          return false;
        }
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

  // 데이터 새로고침 (캐시 무시 + 메모리 최적화)
  const handleRefresh = async () => {
    try {
      setLoading(true);
      
             // 캐시 삭제
       sessionStorage.removeItem('sales_data_cache');
       sessionStorage.removeItem('sales_data_timestamp');
       
       // 로그 최소화 (성능 최적화)
       // console.log('🔄 [SALES] 데이터 새로고침 - 서버에서 최신 데이터 로드');
       const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-data`);
      const data = await response.json();
      
      if (data.success) {
        setSalesData(data.data);
        
        // 새로운 캐시 저장 (용량 제한 적용)
        const now = Date.now();
        try {
          const dataString = JSON.stringify(data.data);
          const dataSize = new Blob([dataString]).size;
          const maxSize = 5 * 1024 * 1024; // 5MB 제한
          
          if (dataSize <= maxSize) {
            sessionStorage.setItem('sales_data_cache', dataString);
            sessionStorage.setItem('sales_data_timestamp', now.toString());
            console.log(`✅ [SALES] 새로고침 캐시 저장 완료 (${(dataSize / 1024 / 1024).toFixed(2)}MB)`);
          } else {
            console.warn(`⚠️ [SALES] 새로고침 데이터가 너무 큽니다 (${(dataSize / 1024 / 1024).toFixed(2)}MB). 캐시 저장을 건너뜁니다.`);
            // 기존 캐시 정리
            sessionStorage.removeItem('sales_data_cache');
            sessionStorage.removeItem('sales_data_timestamp');
          }
        } catch (error) {
          console.warn('새로고침 캐시 저장 실패:', error);
          // 기존 캐시 정리
          sessionStorage.removeItem('sales_data_cache');
          sessionStorage.removeItem('sales_data_timestamp');
        }
        
        // 필터 옵션 생성 (메모리 최적화: 필요한 데이터만 추출)
        setFilterOptions({
          salesData: data.data.salesData,
          provinces: [],
          cities: [],
          districts: [],
          detailAreas: [],
          managers: [],
          branches: [],
          agents: []
        });
      } else {
        setError('영업 데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('영업 데이터 새로고침 실패:', error);
      setError('영업 데이터 새로고침 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
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
      {/* 헤더 */}
      <Box sx={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        backgroundColor: '#e91e63',
        color: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        p: 1
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
            영업 모드
          </Typography>
                     <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <Tooltip title="업데이트 확인">
               <Button
                 color="inherit"
                 startIcon={<Update />}
                 onClick={() => setShowUpdatePopup(true)}
                 sx={{ 
                   border: '1px solid rgba(255,255,255,0.3)',
                   borderRadius: 2,
                   px: 2
                 }}
               >
                 업데이트 확인
               </Button>
             </Tooltip>
             <Tooltip title="데이터 새로고침">
               <IconButton 
                 onClick={handleRefresh} 
                 sx={{ 
                   color: 'inherit',
                   border: '1px solid rgba(255,255,255,0.3)',
                   borderRadius: 1
                 }}
               >
                 <Refresh />
               </IconButton>
             </Tooltip>
             <Tooltip title="모드 변경">
               <IconButton 
                 onClick={onModeChange} 
                 sx={{ 
                   color: 'inherit',
                   border: '1px solid rgba(255,255,255,0.3)',
                   borderRadius: 1
                 }}
               >
                 <Business />
               </IconButton>
             </Tooltip>
             <Tooltip title="로그아웃">
               <Button
                 color="inherit"
                 startIcon={<Close />}
                 onClick={onLogout}
                 sx={{ 
                   border: '1px solid rgba(255,255,255,0.3)',
                   borderRadius: 2,
                   px: 2
                 }}
               >
                 로그아웃
               </Button>
             </Tooltip>
           </Box>
        </Box>
      </Box>

      {/* 통합된 필터 표시 영역 */}
      {(filters.provinces.length > 0 || filters.cities.length > 0 || filters.districts.length > 0 || 
        filters.detailAreas.length > 0 || filters.managers.length > 0 || filters.branches.length > 0 || 
        filters.agents.length > 0 || filters.minPerformance || filters.maxPerformance) && (
        <Box sx={{
          position: 'absolute',
          top: 60,
          left: 10,
          right: 10,
          zIndex: 999,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 2,
          p: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#333' }}>
              선택된 필터:
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setFilters({
                provinces: [],
                cities: [],
                districts: [],
                detailAreas: [],
                managers: [],
                branches: [],
                agents: [],
                minPerformance: '',
                maxPerformance: ''
              })}
              sx={{
                borderColor: '#e91e63',
                color: '#e91e63',
                fontSize: '0.75rem',
                py: 0.5,
                px: 1.5,
                '&:hover': {
                  borderColor: '#c2185b',
                  backgroundColor: '#fce4ec'
                }
              }}
            >
              전체 초기화
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {/* 주소 필터 */}
            {filters.provinces.map(province => (
              <Chip
                key={`province-${province}`}
                label={province}
                size="small"
                color="primary"
                onDelete={() => setFilters(prev => ({
                  ...prev,
                  provinces: prev.provinces.filter(p => p !== province)
                }))}
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {filters.cities.map(city => (
              <Chip
                key={`city-${city}`}
                label={city}
                size="small"
                color="secondary"
                onDelete={() => setFilters(prev => ({
                  ...prev,
                  cities: prev.cities.filter(c => c !== city)
                }))}
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {filters.districts.map(district => (
              <Chip
                key={`district-${district}`}
                label={district}
                size="small"
                color="info"
                onDelete={() => setFilters(prev => ({
                  ...prev,
                  districts: prev.districts.filter(d => d !== district)
                }))}
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {filters.detailAreas.map(detailArea => (
              <Chip
                key={`detailArea-${detailArea}`}
                label={detailArea}
                size="small"
                color="warning"
                onDelete={() => setFilters(prev => ({
                  ...prev,
                  detailAreas: prev.detailAreas.filter(d => d !== detailArea)
                }))}
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {/* 대리점 필터 */}
            {filters.managers.map(manager => (
              <Chip
                key={`manager-${manager}`}
                label={manager}
                size="small"
                color="primary"
                onDelete={() => setFilters(prev => ({
                  ...prev,
                  managers: prev.managers.filter(m => m !== manager)
                }))}
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {filters.branches.map(branch => (
              <Chip
                key={`branch-${branch}`}
                label={branch}
                size="small"
                color="secondary"
                onDelete={() => setFilters(prev => ({
                  ...prev,
                  branches: prev.branches.filter(b => b !== branch)
                }))}
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {filters.agents.map(agent => (
              <Chip
                key={`agent-${agent}`}
                label={agent}
                size="small"
                color="info"
                onDelete={() => setFilters(prev => ({
                  ...prev,
                  agents: prev.agents.filter(a => a !== agent)
                }))}
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {/* 실적 범위 필터 */}
            {filters.minPerformance && (
              <Chip
                label={`최소: ${filters.minPerformance}`}
                size="small"
                color="success"
                onDelete={() => setFilters(prev => ({
                  ...prev,
                  minPerformance: ''
                }))}
                sx={{ fontSize: '0.7rem' }}
              />
            )}
            {filters.maxPerformance && (
              <Chip
                label={`최대: ${filters.maxPerformance}`}
                size="small"
                color="success"
                onDelete={() => setFilters(prev => ({
                  ...prev,
                  maxPerformance: ''
                }))}
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </Box>
      )}

      {/* 새로운 계층적 필터 패널들 */}
      <AddressHierarchyFilter 
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
      />
      <AgentHierarchyFilter 
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
      />
      <PerformanceFilterPanel 
        filters={filters}
        setFilters={setFilters}
      />
      
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
        
        {/* 필터 안내 메시지 */}
        {filteredData.length === 0 && (
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 2,
            p: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            textAlign: 'center',
            maxWidth: 400
          }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#2196f3', fontWeight: 'bold' }}>
              📍 필터를 설정해주세요
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, color: '#666' }}>
              지도에 매장을 표시하려면 상단의 필터 버튼을 클릭하여<br/>
              지역, 대리점, 실적 범위 등을 선택해주세요.
            </Typography>
            <Typography variant="body2" sx={{ color: '#999', fontSize: '0.9rem' }}>
              💡 성능 최적화를 위해 필터 선택 시에만 마커가 표시됩니다.
            </Typography>
          </Box>
        )}
        
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
      {filteredData.length > 0 && (
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
      )}

      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="sales"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          setShowUpdatePopup(false);
        }}
      />
    </Box>
  );
};

export default SalesMode;
