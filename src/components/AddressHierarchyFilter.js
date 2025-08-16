import React, { useState, useMemo, useTransition } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Chip, 
  IconButton, 
  Paper,
  Divider,
  CircularProgress
} from '@mui/material';
import { 
  FilterList, 
  Close, 
  ExpandMore, 
  ExpandLess 
} from '@mui/icons-material';

// 주소 계층 필터 컴포넌트
const AddressHierarchyFilter = ({ filters, setFilters, filterOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();
  const [expandedSections, setExpandedSections] = useState({
    provinces: true,
    cities: true,
    districts: true,
    detailAreas: true
  });

  // 주소 계층 데이터 구조화
  const addressHierarchy = useMemo(() => {
    const hierarchy = {
      provinces: new Set(),
      cities: {},
      districts: {},
      detailAreas: {}
    };

    // 모든 주소 데이터를 순회하며 계층 구조 생성
    filterOptions.salesData?.forEach(item => {
      if (item.province) {
        hierarchy.provinces.add(item.province);
        
        if (!hierarchy.cities[item.province]) {
          hierarchy.cities[item.province] = new Set();
        }
        hierarchy.cities[item.province].add(item.city);
        
        const cityKey = `${item.province}_${item.city}`;
        if (!hierarchy.districts[cityKey]) {
          hierarchy.districts[cityKey] = new Set();
        }
        if (item.district) {
          hierarchy.districts[cityKey].add(item.district);
        }
        
        const districtKey = `${cityKey}_${item.district}`;
        if (!hierarchy.detailAreas[districtKey]) {
          hierarchy.detailAreas[districtKey] = new Set();
        }
        if (item.detailArea) {
          hierarchy.detailAreas[districtKey].add(item.detailArea);
        }
      }
    });

    return hierarchy;
  }, [filterOptions.salesData]);

  // 검색 필터링된 데이터
  const filteredProvinces = useMemo(() => {
    if (!searchTerm) return Array.from(addressHierarchy.provinces).sort();
    return Array.from(addressHierarchy.provinces)
      .filter(province => province.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort();
  }, [addressHierarchy.provinces, searchTerm]);

  const filteredCities = useMemo(() => {
    if (!searchTerm) return {};
    const filtered = {};
    Object.entries(addressHierarchy.cities).forEach(([province, cities]) => {
      const matchingCities = Array.from(cities)
        .filter(city => city.toLowerCase().includes(searchTerm.toLowerCase()));
      if (matchingCities.length > 0) {
        filtered[province] = matchingCities;
      }
    });
    return filtered;
  }, [addressHierarchy.cities, searchTerm]);

  const filteredDistricts = useMemo(() => {
    if (!searchTerm) return {};
    const filtered = {};
    Object.entries(addressHierarchy.districts).forEach(([cityKey, districts]) => {
      const matchingDistricts = Array.from(districts)
        .filter(district => district.toLowerCase().includes(searchTerm.toLowerCase()));
      if (matchingDistricts.length > 0) {
        filtered[cityKey] = matchingDistricts;
      }
    });
    return filtered;
  }, [addressHierarchy.districts, searchTerm]);

  const filteredDetailAreas = useMemo(() => {
    if (!searchTerm) return {};
    const filtered = {};
    Object.entries(addressHierarchy.detailAreas).forEach(([districtKey, detailAreas]) => {
      const matchingDetailAreas = Array.from(detailAreas)
        .filter(detailArea => detailArea.toLowerCase().includes(searchTerm.toLowerCase()));
      if (matchingDetailAreas.length > 0) {
        filtered[districtKey] = matchingDetailAreas;
      }
    });
    return filtered;
  }, [addressHierarchy.detailAreas, searchTerm]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      provinces: [],
      cities: [],
      districts: [],
      detailAreas: []
    }));
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 특정 도/광역시의 모든 하위 지역 선택/해제
  const handleProvinceGroupClick = (province) => {
    const cities = Array.from(addressHierarchy.cities[province] || []);
    const currentCities = filters.cities;
    
    const allSelected = cities.every(city => currentCities.includes(city));
    
    if (allSelected) {
      handleFilterChange('cities', currentCities.filter(city => !cities.includes(city)));
    } else {
      handleFilterChange('cities', [...new Set([...currentCities, ...cities])]);
    }
  };

  // 특정 시/구의 모든 하위 지역 선택/해제
  const handleCityGroupClick = (province, city) => {
    const cityKey = `${province}_${city}`;
    const districts = Array.from(addressHierarchy.districts[cityKey] || []);
    const currentDistricts = filters.districts;
    
    const allSelected = districts.every(district => currentDistricts.includes(district));
    
    if (allSelected) {
      handleFilterChange('districts', currentDistricts.filter(district => !districts.includes(district)));
    } else {
      handleFilterChange('districts', [...new Set([...currentDistricts, ...districts])]);
    }
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
        주소 기반 필터 설정
      </Button>
      
      {isOpen && (
        <Paper sx={{ 
          p: 3, 
          width: 500, 
          maxHeight: '80vh', 
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
              주소 기반 필터 설정
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
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                startTransition(() => {
                  // 검색 상태를 비동기로 처리하여 UI 블로킹 방지
                });
              }}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '10px'
              }}
            />
            {isPending && (
              <Box sx={{ mt: 1, textAlign: 'center' }}>
                <CircularProgress size={16} />
              </Box>
            )}
          </Box>
          
          {/* 1단계: 도/광역시 */}
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              onClick={() => toggleSection('provinces')}
              sx={{
                justifyContent: 'space-between',
                textAlign: 'left',
                backgroundColor: '#f5f5f5',
                '&:hover': { backgroundColor: '#e0e0e0' }
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                도/광역시 ({filteredProvinces.length}개)
              </Typography>
              {expandedSections.provinces ? <ExpandLess /> : <ExpandMore />}
            </Button>
            
            {expandedSections.provinces && (
              <Box sx={{ mt: 1, ml: 2 }}>
                {filteredProvinces.map(province => {
                  const cities = Array.from(addressHierarchy.cities[province] || []);
                  const allSelected = cities.every(city => filters.cities.includes(city));
                  const someSelected = cities.some(city => filters.cities.includes(city));
                  
                  return (
                    <Box key={province} sx={{ mb: 2 }}>
                      <Chip
                        label={`${province} (${cities.length})`}
                        size="medium"
                        onClick={() => handleProvinceGroupClick(province)}
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
                        {cities.map(city => (
                          <Chip
                            key={city}
                            label={city}
                            size="small"
                            onClick={() => handleFilterChange('cities', 
                              filters.cities.includes(city) 
                                ? filters.cities.filter(c => c !== city)
                                : [...filters.cities, city]
                            )}
                            color={filters.cities.includes(city) ? 'primary' : 'default'}
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
          
          {/* 2단계: 시/구 */}
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              onClick={() => toggleSection('cities')}
              sx={{
                justifyContent: 'space-between',
                textAlign: 'left',
                backgroundColor: '#f5f5f5',
                '&:hover': { backgroundColor: '#e0e0e0' }
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                시/구 ({Object.keys(addressHierarchy.cities).length}개)
              </Typography>
              {expandedSections.cities ? <ExpandLess /> : <ExpandMore />}
            </Button>
            
            {expandedSections.cities && (
              <Box sx={{ mt: 1, ml: 2 }}>
                {Object.entries(addressHierarchy.cities).map(([province, cities]) => {
                  const cityList = Array.from(cities);
                  return (
                    <Box key={province} sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 1 }}>
                        {province}
                      </Typography>
                      <Box sx={{ ml: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {cityList.map(city => {
                          const cityKey = `${province}_${city}`;
                          const districts = Array.from(addressHierarchy.districts[cityKey] || []);
                          const allSelected = districts.every(district => filters.districts.includes(district));
                          const someSelected = districts.some(district => filters.districts.includes(district));
                          
                          return (
                            <Box key={city} sx={{ mb: 1 }}>
                              <Chip
                                label={`${city} (${districts.length})`}
                                size="small"
                                onClick={() => handleCityGroupClick(province, city)}
                                color={allSelected ? 'primary' : someSelected ? 'secondary' : 'default'}
                                variant={allSelected ? 'filled' : someSelected ? 'outlined' : 'outlined'}
                                sx={{ 
                                  mr: 1, 
                                  mb: 1,
                                  fontWeight: 'bold',
                                  fontSize: '0.75rem',
                                  '&:hover': { backgroundColor: '#2196f3', color: 'white' }
                                }}
                              />
                              <Box sx={{ ml: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {districts.map(district => (
                                  <Chip
                                    key={district}
                                    label={district}
                                    size="small"
                                    onClick={() => handleFilterChange('districts',
                                      filters.districts.includes(district)
                                        ? filters.districts.filter(d => d !== district)
                                        : [...filters.districts, district]
                                    )}
                                    color={filters.districts.includes(district) ? 'primary' : 'default'}
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
          
          {/* 선택된 필터 표시 */}
          {(filters.provinces.length > 0 || filters.cities.length > 0 || filters.districts.length > 0 || filters.detailAreas.length > 0) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#666' }}>
                선택된 필터:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {filters.provinces.map(province => (
                  <Chip
                    key={province}
                    label={province}
                    size="small"
                    color="primary"
                    onDelete={() => handleFilterChange('provinces', filters.provinces.filter(p => p !== province))}
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
                {filters.cities.map(city => (
                  <Chip
                    key={city}
                    label={city}
                    size="small"
                    color="secondary"
                    onDelete={() => handleFilterChange('cities', filters.cities.filter(c => c !== city))}
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
                {filters.districts.map(district => (
                  <Chip
                    key={district}
                    label={district}
                    size="small"
                    color="info"
                    onDelete={() => handleFilterChange('districts', filters.districts.filter(d => d !== district))}
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
                {filters.detailAreas.map(detailArea => (
                  <Chip
                    key={detailArea}
                    label={detailArea}
                    size="small"
                    color="warning"
                    onDelete={() => handleFilterChange('detailAreas', filters.detailAreas.filter(d => d !== detailArea))}
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

export default AddressHierarchyFilter;
