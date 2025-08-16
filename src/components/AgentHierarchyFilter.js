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

// 대리점 계층 필터 컴포넌트
const AgentHierarchyFilter = ({ filters, setFilters, filterOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();
  const [expandedSections, setExpandedSections] = useState({
    managers: true,
    branches: true,
    agents: true
  });

  // 대리점 계층 데이터 구조화
  const agentHierarchy = useMemo(() => {
    const hierarchy = {
      managers: new Set(),
      branches: {},
      agents: {}
    };

    // 모든 대리점 데이터를 순회하며 계층 구조 생성
    filterOptions.salesData?.forEach(item => {
      if (item.manager) {
        hierarchy.managers.add(item.manager);
        
        if (!hierarchy.branches[item.manager]) {
          hierarchy.branches[item.manager] = new Set();
        }
        hierarchy.branches[item.manager].add(item.branch);
        
        const branchKey = `${item.manager}_${item.branch}`;
        if (!hierarchy.agents[branchKey]) {
          hierarchy.agents[branchKey] = new Set();
        }
        if (item.agentName) {
          hierarchy.agents[branchKey].add(`${item.agentName} (${item.agentCode})`);
        }
      }
    });

    return hierarchy;
  }, [filterOptions.salesData]);

  // 검색 필터링된 데이터
  const filteredManagers = useMemo(() => {
    if (!searchTerm) return Array.from(agentHierarchy.managers).sort();
    return Array.from(agentHierarchy.managers)
      .filter(manager => manager.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort();
  }, [agentHierarchy.managers, searchTerm]);

  const filteredBranches = useMemo(() => {
    if (!searchTerm) return agentHierarchy.branches;
    const filtered = {};
    Object.entries(agentHierarchy.branches).forEach(([manager, branches]) => {
      const matchingBranches = Array.from(branches)
        .filter(branch => branch.toLowerCase().includes(searchTerm.toLowerCase()));
      if (matchingBranches.length > 0) {
        filtered[manager] = matchingBranches;
      }
    });
    return filtered;
  }, [agentHierarchy.branches, searchTerm]);

  const filteredAgents = useMemo(() => {
    if (!searchTerm) return agentHierarchy.agents;
    const filtered = {};
    Object.entries(agentHierarchy.agents).forEach(([branchKey, agents]) => {
      const matchingAgents = Array.from(agents)
        .filter(agent => agent.toLowerCase().includes(searchTerm.toLowerCase()));
      if (matchingAgents.length > 0) {
        filtered[branchKey] = matchingAgents;
      }
    });
    return filtered;
  }, [agentHierarchy.agents, searchTerm]);

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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 특정 담당의 모든 하위 지점 선택/해제
  const handleManagerGroupClick = (manager) => {
    const branches = Array.from(agentHierarchy.branches[manager] || []);
    const currentBranches = filters.branches;
    
    const allSelected = branches.every(branch => currentBranches.includes(branch));
    
    if (allSelected) {
      handleFilterChange('branches', currentBranches.filter(branch => !branches.includes(branch)));
    } else {
      handleFilterChange('branches', [...new Set([...currentBranches, ...branches])]);
    }
  };

  // 특정 지점의 모든 하위 대리점 선택/해제
  const handleBranchGroupClick = (manager, branch) => {
    const branchKey = `${manager}_${branch}`;
    const agents = Array.from(agentHierarchy.agents[branchKey] || []);
    const currentAgents = filters.agents;
    
    const allSelected = agents.every(agent => currentAgents.includes(agent));
    
    if (allSelected) {
      handleFilterChange('agents', currentAgents.filter(agent => !agents.includes(agent)));
    } else {
      handleFilterChange('agents', [...new Set([...currentAgents, ...agents])]);
    }
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
        대리점 계층 필터 설정
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
            <Typography variant="h6" sx={{ color: '#e91e63', fontWeight: 'bold' }}>
              대리점 계층 필터 설정
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
              placeholder="담당/지점/대리점명 검색..."
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
          
          {/* 1단계: 담당 */}
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
                {filteredManagers.map(manager => {
                  const branches = Array.from(agentHierarchy.branches[manager] || []);
                  const allSelected = branches.every(branch => filters.branches.includes(branch));
                  const someSelected = branches.some(branch => filters.branches.includes(branch));
                  
                  return (
                    <Box key={manager} sx={{ mb: 2 }}>
                      <Chip
                        label={`${manager} (${branches.length})`}
                        size="medium"
                        onClick={() => handleManagerGroupClick(manager)}
                        color={allSelected ? 'primary' : someSelected ? 'secondary' : 'default'}
                        variant={allSelected ? 'filled' : someSelected ? 'outlined' : 'outlined'}
                        sx={{ 
                          mr: 1, 
                          mb: 1,
                          fontWeight: 'bold',
                          '&:hover': { backgroundColor: '#e91e63', color: 'white' }
                        }}
                      />
                      <Box sx={{ ml: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {branches.map(branch => (
                          <Chip
                            key={branch}
                            label={branch}
                            size="small"
                            onClick={() => handleFilterChange('branches', 
                              filters.branches.includes(branch) 
                                ? filters.branches.filter(b => b !== branch)
                                : [...filters.branches, branch]
                            )}
                            color={filters.branches.includes(branch) ? 'primary' : 'default'}
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
          
          {/* 2단계: 지점 */}
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
                지점 ({Object.keys(agentHierarchy.branches).length}개)
              </Typography>
              {expandedSections.branches ? <ExpandLess /> : <ExpandMore />}
            </Button>
            
            {expandedSections.branches && (
              <Box sx={{ mt: 1, ml: 2 }}>
                {Object.entries(filteredBranches).map(([manager, branches]) => {
                  const branchList = Array.isArray(branches) ? branches : Array.from(branches);
                  return (
                    <Box key={manager} sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 1 }}>
                        {manager}
                      </Typography>
                      <Box sx={{ ml: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {branchList.map(branch => {
                          const branchKey = `${manager}_${branch}`;
                          const agents = Array.from(filteredAgents[branchKey] || []);
                          const allSelected = agents.every(agent => filters.agents.includes(agent));
                          const someSelected = agents.some(agent => filters.agents.includes(agent));
                          
                          return (
                            <Box key={branch} sx={{ mb: 1 }}>
                              <Chip
                                label={`${branch} (${agents.length})`}
                                size="small"
                                onClick={() => handleBranchGroupClick(manager, branch)}
                                color={allSelected ? 'primary' : someSelected ? 'secondary' : 'default'}
                                variant={allSelected ? 'filled' : someSelected ? 'outlined' : 'outlined'}
                                sx={{ 
                                  mr: 1, 
                                  mb: 1,
                                  fontWeight: 'bold',
                                  fontSize: '0.75rem',
                                  '&:hover': { backgroundColor: '#e91e63', color: 'white' }
                                }}
                              />
                              <Box sx={{ ml: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {agents.map(agent => (
                                  <Chip
                                    key={agent}
                                    label={agent}
                                    size="small"
                                    onClick={() => handleFilterChange('agents',
                                      filters.agents.includes(agent)
                                        ? filters.agents.filter(a => a !== agent)
                                        : [...filters.agents, agent]
                                    )}
                                    color={filters.agents.includes(agent) ? 'primary' : 'default'}
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

export default AgentHierarchyFilter;
