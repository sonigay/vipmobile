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
  Close,
  Update,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AppUpdatePopup from './AppUpdatePopup';

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

// 지역 필터 패널 컴포넌트
const RegionFilterPanel = ({ filters, setFilters, filterOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    regions: true,
    subRegions: true
  });

  // 지역별 세부상권 그룹핑
  const regionSubRegionsMap = useMemo(() => {
    const map = {};
    filterOptions.subRegions.forEach(subRegion => {
      // 주소에서 지역 추출 (예: "구월2동" -> "구월동")
      const baseRegion = subRegion.replace(/\d+동$/, '동');
      if (!map[baseRegion]) {
        map[baseRegion] = [];
      }
      map[baseRegion].push(subRegion);
    });
    return map;
  }, [filterOptions.subRegions]);

  // 광역상권 그룹핑 (예: "경기도 수원시" -> "경기도")
  const groupedRegions = useMemo(() => {
    const groups = {};
    filterOptions.regions.forEach(region => {
      const baseRegion = region.split(' ')[0]; // 첫 번째 단어만 추출
      if (!groups[baseRegion]) {
        groups[baseRegion] = [];
      }
      groups[baseRegion].push(region);
    });
    return groups;
  }, [filterOptions.regions]);

  // 검색 필터링된 데이터
  const filteredRegions = useMemo(() => {
    if (!searchTerm) return filterOptions.regions;
    return filterOptions.regions.filter(region => 
      region.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filterOptions.regions, searchTerm]);

  const filteredSubRegions = useMemo(() => {
    if (!searchTerm) return filterOptions.subRegions;
    return filterOptions.subRegions.filter(subRegion => 
      subRegion.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filterOptions.subRegions, searchTerm]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      regions: [],
      subRegions: []
    }));
  };

  const handleRegionGroupClick = (baseRegion) => {
    const regions = groupedRegions[baseRegion];
    const currentRegions = filters.regions;
    
    // 이미 모든 하위 지역이 선택되어 있으면 해제, 아니면 선택
    const allSelected = regions.every(region => currentRegions.includes(region));
    
    if (allSelected) {
      handleFilterChange('regions', currentRegions.filter(r => !regions.includes(r)));
    } else {
      handleFilterChange('regions', [...new Set([...currentRegions, ...regions])]);
    }
  };

  const handleSubRegionGroupClick = (baseSubRegion) => {
    const subRegions = regionSubRegionsMap[baseSubRegion];
    const currentSubRegions = filters.subRegions;
    
    // 이미 모든 하위 지역이 선택되어 있으면 해제, 아니면 선택
    const allSelected = subRegions.every(subRegion => currentSubRegions.includes(subRegion));
    
    if (allSelected) {
      handleFilterChange('subRegions', currentSubRegions.filter(sr => !subRegions.includes(sr)));
    } else {
      handleFilterChange('subRegions', [...new Set([...currentSubRegions, ...subRegions])]);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <Box sx={{ position: 'absolute', top: 70, left: 10, zIndex: 1000 }}>
              <Button
          variant="contained"
          startIcon={<FilterList />}
          onClick={() => setIsOpen(!isOpen)}
          sx={{ 
            mb: 1, 
            backgroundColor: '#2196f3',
            '&:hover': { backgroundColor: '#1976d2' }
          }}
        >
          지역 필터 설정
        </Button>
      
      {isOpen && (
        <Paper sx={{ 
          p: 3, 
          width: 450, 
          maxHeight: '80vh', 
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
              지역 필터 설정
            </Typography>
            <IconButton size="small" onClick={() => setIsOpen(false)}>
              <Close />
            </IconButton>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          {/* 검색바 */}
          <Box sx={{ mb: 3 }}>
            <input
              type="text"
              placeholder="지역명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '10px'
              }}
            />
          </Box>
          
          {/* 광역상권 필터 - 아코디언 방식 */}
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              onClick={() => toggleSection('regions')}
              sx={{
                justifyContent: 'space-between',
                textAlign: 'left',
                backgroundColor: '#f5f5f5',
                '&:hover': { backgroundColor: '#e0e0e0' }
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                광역상권 ({filteredRegions.length}개)
              </Typography>
              {expandedSections.regions ? <ExpandLess /> : <ExpandMore />}
            </Button>
            
            {expandedSections.regions && (
              <Box sx={{ mt: 1, ml: 2 }}>
                {Object.entries(groupedRegions).map(([baseRegion, regions]) => {
                  const allSelected = regions.every(region => filters.regions.includes(region));
                  const someSelected = regions.some(region => filters.regions.includes(region));
                  
                  return (
                    <Box key={baseRegion} sx={{ mb: 2 }}>
                      <Chip
                        label={`${baseRegion} (${regions.length})`}
                        size="medium"
                        onClick={() => handleRegionGroupClick(baseRegion)}
                        color={allSelected ? 'primary' : someSelected ? 'secondary' : 'default'}
                        variant={allSelected ? 'filled' : someSelected ? 'outlined' : 'outlined'}
                        sx={{ 
                          mr: 1, 
                          mb: 1,
                          fontWeight: 'bold',
                          '&:hover': { backgroundColor: '#2196f3', color: 'white' }
                        }}
                      />
                      <Box sx={{ ml: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {regions.map(region => (
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
                            variant="outlined"
                            sx={{ fontSize: '0.75rem' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
          
          {/* 세부상권 필터 - 아코디언 방식 */}
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              onClick={() => toggleSection('subRegions')}
              sx={{
                justifyContent: 'space-between',
                textAlign: 'left',
                backgroundColor: '#f5f5f5',
                '&:hover': { backgroundColor: '#e0e0e0' }
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                세부상권 ({filteredSubRegions.length}개)
              </Typography>
              {expandedSections.subRegions ? <ExpandLess /> : <ExpandMore />}
            </Button>
            
            {expandedSections.subRegions && (
              <Box sx={{ mt: 1, ml: 2 }}>
                {Object.entries(regionSubRegionsMap).map(([baseSubRegion, subRegions]) => {
                  const allSelected = subRegions.every(subRegion => filters.subRegions.includes(subRegion));
                  const someSelected = subRegions.some(subRegion => filters.subRegions.includes(subRegion));
                  
                  return (
                    <Box key={baseSubRegion} sx={{ mb: 2 }}>
                      <Chip
                        label={`${baseSubRegion} (${subRegions.length})`}
                        size="medium"
                        onClick={() => handleSubRegionGroupClick(baseSubRegion)}
                        color={allSelected ? 'primary' : someSelected ? 'secondary' : 'default'}
                        variant={allSelected ? 'filled' : someSelected ? 'outlined' : 'outlined'}
                        sx={{ 
                          mr: 1, 
                          mb: 1,
                          fontWeight: 'bold',
                          '&:hover': { backgroundColor: '#2196f3', color: 'white' }
                        }}
                      />
                      <Box sx={{ ml: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {subRegions.map(subRegion => (
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
                            variant="outlined"
                            sx={{ fontSize: '0.75rem' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
          

          
          {/* 선택된 필터 표시 */}
          {(filters.regions.length > 0 || filters.subRegions.length > 0) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#666' }}>
                선택된 필터:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {filters.regions.map(region => (
                  <Chip
                    key={region}
                    label={region}
                    size="small"
                    color="primary"
                    onDelete={() => handleFilterChange('regions', filters.regions.filter(r => r !== region))}
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
                                 {filters.subRegions.map(subRegion => (
                   <Chip
                     key={subRegion}
                     label={subRegion}
                     size="small"
                     color="secondary"
                     onDelete={() => handleFilterChange('subRegions', filters.subRegions.filter(sr => sr !== subRegion))}
                     sx={{ fontSize: '0.75rem' }}
                   />
                 ))}
              </Box>
            </Box>
          )}
          
          <Button
            variant="outlined"
            onClick={clearFilters}
            fullWidth
            sx={{ 
              mb: 1,
              borderColor: '#2196f3',
              color: '#2196f3',
              '&:hover': { 
                borderColor: '#1976d2',
                backgroundColor: '#e3f2fd'
              }
            }}
          >
            필터 초기화
          </Button>
        </Paper>
      )}
    </Box>
  );
};

// 대리점 필터 패널 컴포넌트
const AgentFilterPanel = ({ filters, setFilters, filterOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    managers: true,
    branches: true,
    agents: true
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      managers: [],
      branches: [],
      agents: []
    }));
  };

  // 검색 필터링된 데이터
  const filteredManagers = useMemo(() => {
    if (!searchTerm) return filterOptions.managers;
    return filterOptions.managers.filter(manager => 
      manager.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filterOptions.managers, searchTerm]);

  const filteredBranches = useMemo(() => {
    if (!searchTerm) return filterOptions.branches;
    return filterOptions.branches.filter(branch => 
      branch.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filterOptions.branches, searchTerm]);

  const filteredAgents = useMemo(() => {
    if (!searchTerm) return filterOptions.agents;
    return filterOptions.agents.filter(agent => 
      agent.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filterOptions.agents, searchTerm]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <Box sx={{ position: 'absolute', top: 70, left: 200, zIndex: 1000 }}>
      <Button
        variant="contained"
        startIcon={<FilterList />}
        onClick={() => setIsOpen(!isOpen)}
        sx={{ 
          mb: 1, 
          backgroundColor: '#e91e63',
          '&:hover': { backgroundColor: '#c2185b' }
        }}
      >
        대리점 필터 설정
      </Button>
      
      {isOpen && (
        <Paper sx={{ 
          p: 3, 
          width: 450, 
          maxHeight: '80vh', 
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: '#e91e63', fontWeight: 'bold' }}>
              대리점 필터 설정
            </Typography>
            <IconButton size="small" onClick={() => setIsOpen(false)}>
              <Close />
            </IconButton>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          {/* 검색바 */}
          <Box sx={{ mb: 3 }}>
            <input
              type="text"
              placeholder="대리점명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '10px'
              }}
            />
          </Box>
          
          {/* 담당 필터 - 아코디언 방식 */}
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              onClick={() => toggleSection('managers')}
              sx={{
                justifyContent: 'space-between',
                textAlign: 'left',
                backgroundColor: '#f5f5f5',
                '&:hover': { backgroundColor: '#e0e0e0' }
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                담당 ({filteredManagers.length}개)
              </Typography>
              {expandedSections.managers ? <ExpandLess /> : <ExpandMore />}
            </Button>
            
            {expandedSections.managers && (
              <Box sx={{ mt: 1, ml: 2 }}>
                {filteredManagers.map(manager => (
                  <Chip
                    key={manager}
                    label={manager}
                    size="medium"
                    onClick={() => handleFilterChange('managers', 
                      filters.managers.includes(manager) 
                        ? filters.managers.filter(m => m !== manager)
                        : [...filters.managers, manager]
                    )}
                    color={filters.managers.includes(manager) ? 'primary' : 'default'}
                    variant={filters.managers.includes(manager) ? 'filled' : 'outlined'}
                    sx={{ 
                      mr: 1, 
                      mb: 1,
                      fontWeight: 'bold',
                      '&:hover': { backgroundColor: '#e91e63', color: 'white' }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
          
          {/* 지점 필터 - 아코디언 방식 */}
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              onClick={() => toggleSection('branches')}
              sx={{
                justifyContent: 'space-between',
                textAlign: 'left',
                backgroundColor: '#f5f5f5',
                '&:hover': { backgroundColor: '#e0e0e0' }
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                지점 ({filteredBranches.length}개)
              </Typography>
              {expandedSections.branches ? <ExpandLess /> : <ExpandMore />}
            </Button>
            
            {expandedSections.branches && (
              <Box sx={{ mt: 1, ml: 2 }}>
                {filteredBranches.map(branch => (
                  <Chip
                    key={branch}
                    label={branch}
                    size="medium"
                    onClick={() => handleFilterChange('branches',
                      filters.branches.includes(branch)
                        ? filters.branches.filter(b => b !== branch)
                        : [...filters.branches, branch]
                    )}
                    color={filters.branches.includes(branch) ? 'primary' : 'default'}
                    variant={filters.branches.includes(branch) ? 'filled' : 'outlined'}
                    sx={{ 
                      mr: 1, 
                      mb: 1,
                      fontWeight: 'bold',
                      '&:hover': { backgroundColor: '#e91e63', color: 'white' }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
          
          {/* 대리점 필터 - 아코디언 방식 */}
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              onClick={() => toggleSection('agents')}
              sx={{
                justifyContent: 'space-between',
                textAlign: 'left',
                backgroundColor: '#f5f5f5',
                '&:hover': { backgroundColor: '#e0e0e0' }
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                대리점 ({filteredAgents.length}개)
              </Typography>
              {expandedSections.agents ? <ExpandLess /> : <ExpandMore />}
            </Button>
            
            {expandedSections.agents && (
              <Box sx={{ mt: 1, ml: 2 }}>
                {filteredAgents.map(agent => (
                  <Chip
                    key={agent}
                    label={agent}
                    size="medium"
                    onClick={() => handleFilterChange('agents',
                      filters.agents.includes(agent)
                        ? filters.agents.filter(a => a !== agent)
                        : [...filters.agents, agent]
                    )}
                    color={filters.agents.includes(agent) ? 'primary' : 'default'}
                    variant={filters.agents.includes(agent) ? 'filled' : 'outlined'}
                    sx={{ 
                      mr: 1, 
                      mb: 1,
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      '&:hover': { backgroundColor: '#e91e63', color: 'white' }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
          
          {/* 선택된 필터 표시 */}
          {(filters.managers.length > 0 || filters.branches.length > 0 || filters.agents.length > 0) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#666' }}>
                선택된 필터:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {filters.managers.map(manager => (
                  <Chip
                    key={manager}
                    label={manager}
                    size="small"
                    color="primary"
                    onDelete={() => handleFilterChange('managers', filters.managers.filter(m => m !== manager))}
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
                {filters.branches.map(branch => (
                  <Chip
                    key={branch}
                    label={branch}
                    size="small"
                    color="secondary"
                    onDelete={() => handleFilterChange('branches', filters.branches.filter(b => b !== branch))}
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
                {filters.agents.map(agent => (
                  <Chip
                    key={agent}
                    label={agent}
                    size="small"
                    color="info"
                    onDelete={() => handleFilterChange('agents', filters.agents.filter(a => a !== agent))}
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
              </Box>
            </Box>
          )}
          
          <Button
            variant="outlined"
            onClick={clearFilters}
            fullWidth
            sx={{ 
              mb: 1,
              borderColor: '#e91e63',
              color: '#e91e63',
              '&:hover': { 
                borderColor: '#c2185b',
                backgroundColor: '#fce4ec'
              }
            }}
          >
            필터 초기화
          </Button>
        </Paper>
      )}
    </Box>
  );
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
          
          {/* 선택된 필터 표시 */}
          {(filters.minPerformance || filters.maxPerformance) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#666' }}>
                선택된 필터:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {filters.minPerformance && (
                  <Chip
                    label={`최소: ${filters.minPerformance}`}
                    size="small"
                    color="info"
                    onDelete={() => handleFilterChange('minPerformance', '')}
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
                {filters.maxPerformance && (
                  <Chip
                    label={`최대: ${filters.maxPerformance}`}
                    size="small"
                    color="info"
                    onDelete={() => handleFilterChange('maxPerformance', '')}
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            </Box>
          )}
          
          <Button
            variant="outlined"
            onClick={clearFilters}
            fullWidth
            sx={{ 
              mb: 1,
              borderColor: '#4caf50',
              color: '#4caf50',
              '&:hover': { 
                borderColor: '#388e3c',
                backgroundColor: '#e8f5e8'
              }
            }}
          >
            필터 초기화
          </Button>
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
    regions: [],
    subRegions: [],
    managers: [],
    branches: [],
    agents: [],
    minPerformance: '',
    maxPerformance: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    regions: [],
    subRegions: [],
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

  // 영업 데이터 로드 (캐시 활용)
  const loadSalesData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 캐시된 데이터가 있는지 확인
      const cachedData = sessionStorage.getItem('sales_data_cache');
      const cacheTimestamp = sessionStorage.getItem('sales_data_timestamp');
      const now = Date.now();
      
      // 캐시가 30분 이내인지 확인
      if (cachedData && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 30 * 60 * 1000) {
        console.log('📦 [SALES] 세션 캐시에서 데이터 로드');
        const data = JSON.parse(cachedData);
        setSalesData(data);
        
        // 필터 옵션 생성
        const regions = [...new Set(data.salesData.map(item => item.region))];
        const subRegions = [...new Set(data.salesData.map(item => item.subRegion))];
        const managers = [...new Set(data.salesData.map(item => item.manager))];
        const branches = [...new Set(data.salesData.map(item => item.branch))];
        const agents = [...new Set(data.salesData.map(item => `${item.agentName} (${item.agentCode})`))];
        
        setFilterOptions({
          regions: regions.sort(),
          subRegions: subRegions.sort(),
          managers: managers.sort(),
          branches: branches.sort(),
          agents: agents.sort()
        });
        
        setLoading(false);
        return;
      }
      
      console.log('🌐 [SALES] 서버에서 데이터 로드');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-data`);
      const data = await response.json();
      
      if (data.success) {
        setSalesData(data.data);
        
        // 세션 스토리지에 캐시 저장 (30분)
        sessionStorage.setItem('sales_data_cache', JSON.stringify(data.data));
        sessionStorage.setItem('sales_data_timestamp', now.toString());
        
        // 필터 옵션 생성
        const regions = [...new Set(data.data.salesData.map(item => item.region))];
        const subRegions = [...new Set(data.data.salesData.map(item => item.subRegion))];
        const managers = [...new Set(data.data.salesData.map(item => item.manager))];
        const branches = [...new Set(data.data.salesData.map(item => item.branch))];
        const agents = [...new Set(data.data.salesData.map(item => `${item.agentName} (${item.agentCode})`))];
        
        setFilterOptions({
          regions: regions.sort(),
          subRegions: subRegions.sort(),
          managers: managers.sort(),
          branches: branches.sort(),
          agents: agents.sort()
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
      
      // 담당 필터
      if (filters.managers.length > 0 && !filters.managers.includes(item.manager)) {
        return false;
      }
      
      // 지점 필터
      if (filters.branches.length > 0 && !filters.branches.includes(item.branch)) {
        return false;
      }
      
      // 대리점 필터
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

  // 데이터 새로고침 (캐시 무시)
  const handleRefresh = async () => {
    try {
      setLoading(true);
      
      // 캐시 삭제
      sessionStorage.removeItem('sales_data_cache');
      sessionStorage.removeItem('sales_data_timestamp');
      
      console.log('🔄 [SALES] 데이터 새로고침 - 서버에서 최신 데이터 로드');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-data`);
      const data = await response.json();
      
      if (data.success) {
        setSalesData(data.data);
        
        // 새로운 캐시 저장
        const now = Date.now();
        sessionStorage.setItem('sales_data_cache', JSON.stringify(data.data));
        sessionStorage.setItem('sales_data_timestamp', now.toString());
        
        // 필터 옵션 생성
        const regions = [...new Set(data.data.salesData.map(item => item.region))];
        const subRegions = [...new Set(data.data.salesData.map(item => item.subRegion))];
        const managers = [...new Set(data.data.salesData.map(item => item.manager))];
        const branches = [...new Set(data.data.salesData.map(item => item.branch))];
        const agents = [...new Set(data.data.salesData.map(item => `${item.agentName} (${item.agentCode})`))];
        
        setFilterOptions({
          regions: regions.sort(),
          subRegions: subRegions.sort(),
          managers: managers.sort(),
          branches: branches.sort(),
          agents: agents.sort()
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
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="업데이트 확인">
              <IconButton 
                onClick={() => setShowUpdatePopup(true)}
                sx={{ 
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 1
                }}
              >
                <Update />
              </IconButton>
            </Tooltip>
            <Tooltip title="데이터 새로고침">
              <IconButton 
                onClick={handleRefresh} 
                sx={{ 
                  color: 'white',
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
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 1
                }}
              >
                <Business />
              </IconButton>
            </Tooltip>
            <Tooltip title="로그아웃">
              <IconButton 
                onClick={onLogout} 
                sx={{ 
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 1
                }}
              >
                <Close />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* 필터 패널들 */}
      <RegionFilterPanel 
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
      />
      <AgentFilterPanel 
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
