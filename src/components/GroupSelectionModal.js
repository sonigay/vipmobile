import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Collapse,
  Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon
} from '@mui/icons-material';

const GroupSelectionModal = ({ open, onClose, onConfirm, selectedGroups = [], selectedCompanyIds = [] }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [localSelectedGroups, setLocalSelectedGroups] = useState(new Set(selectedGroups));
  const [localSelectedCompanyIds, setLocalSelectedCompanyIds] = useState(new Set(selectedCompanyIds));
  const [searchTerm, setSearchTerm] = useState('');

  const API_URL = process.env.REACT_APP_API_URL;

  // 그룹 목록 불러오기
  useEffect(() => {
    if (open) {
      fetchGroups();
      // 기존 선택값으로 초기화
      setLocalSelectedGroups(new Set(selectedGroups));
      setLocalSelectedCompanyIds(new Set(selectedCompanyIds));
    }
  }, [open, selectedGroups, selectedCompanyIds]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/onsale/policies/groups`);
      const data = await response.json();
      
      if (data.success) {
        setGroups(data.groups || []);
        // 모든 그룹 접기 상태로 초기화
        setExpandedGroups(new Set());
      }
    } catch (error) {
      console.error('그룹 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGroup = (groupName) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  const handleGroupCheck = (groupName, checked) => {
    setLocalSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(groupName);
      } else {
        newSet.delete(groupName);
        // 그룹 선택 해제 시 해당 그룹의 모든 업체도 선택 해제
        const group = groups.find(g => g.name === groupName);
        if (group) {
          setLocalSelectedCompanyIds(prevIds => {
            const newIds = new Set(prevIds);
            group.companies.forEach(company => {
              newIds.delete(company.id);
            });
            return newIds;
          });
        }
      }
      return newSet;
    });
  };

  const handleCompanyCheck = (companyId, checked) => {
    setLocalSelectedCompanyIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(companyId);
      } else {
        newSet.delete(companyId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    const selectedGroupsArray = Array.from(localSelectedGroups);
    const selectedCompanyIdsArray = Array.from(localSelectedCompanyIds);
    
    onConfirm(selectedGroupsArray, selectedCompanyIdsArray);
    onClose();
  };

  const handleSelectAllCompaniesInGroup = (groupName) => {
    const group = groups.find(g => g.name === groupName);
    if (!group) return;

    setLocalSelectedCompanyIds(prev => {
      const newSet = new Set(prev);
      group.companies.forEach(company => {
        newSet.add(company.id);
      });
      return newSet;
    });
  };

  const handleDeselectAllCompaniesInGroup = (groupName) => {
    const group = groups.find(g => g.name === groupName);
    if (!group) return;

    setLocalSelectedCompanyIds(prev => {
      const newSet = new Set(prev);
      group.companies.forEach(company => {
        newSet.delete(company.id);
      });
      return newSet;
    });
  };

  // 검색 필터링
  const filteredGroups = groups.filter(group => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      group.name.toLowerCase().includes(searchLower) ||
      group.companies.some(company => 
        company.name.toLowerCase().includes(searchLower) ||
        company.id.toLowerCase().includes(searchLower)
      )
    );
  });

  const isGroupExpanded = (groupName) => expandedGroups.has(groupName);
  const isGroupSelected = (groupName) => localSelectedGroups.has(groupName);
  const isCompanySelected = (companyId) => localSelectedCompanyIds.has(companyId);

  // 그룹 내 모든 업체가 선택되었는지 확인
  const isAllCompaniesSelectedInGroup = (group) => {
    return group.companies.length > 0 && 
           group.companies.every(company => localSelectedCompanyIds.has(company.id));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">그룹 및 업체 선택</Typography>
          <Chip 
            label={`${localSelectedGroups.size}개 그룹, ${localSelectedCompanyIds.size}개 업체 선택됨`}
            color="primary"
            size="small"
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* 검색 필드 */}
        <TextField
          fullWidth
          placeholder="그룹명 또는 업체명으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography>로딩 중...</Typography>
          </Box>
        ) : (
          <List>
            {filteredGroups.map((group) => (
              <Box key={group.name}>
                {/* 그룹 헤더 */}
                <ListItem
                  sx={{
                    bgcolor: isGroupSelected(group.name) ? '#e3f2fd' : 'inherit',
                    borderBottom: '1px solid #eee',
                    '&:hover': { bgcolor: '#f5f5f5' }
                  }}
                >
                  <Checkbox
                    checked={isGroupSelected(group.name)}
                    onChange={(e) => handleGroupCheck(group.name, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {group.name}
                        </Typography>
                        <Chip 
                          label={`${group.companies.length}개 업체`}
                          size="small"
                          variant="outlined"
                        />
                        {isAllCompaniesSelectedInGroup(group) && (
                          <Chip 
                            label="전체 선택됨"
                            size="small"
                            color="success"
                          />
                        )}
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {isGroupExpanded(group.name) && (
                      <>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAllCompaniesSelectedInGroup(group)) {
                              handleDeselectAllCompaniesInGroup(group.name);
                            } else {
                              handleSelectAllCompaniesInGroup(group.name);
                            }
                          }}
                        >
                          {isAllCompaniesSelectedInGroup(group) ? '전체 해제' : '전체 선택'}
                        </Button>
                      </>
                    )}
                    <IconButton
                      onClick={() => handleToggleGroup(group.name)}
                      size="small"
                    >
                      {isGroupExpanded(group.name) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                </ListItem>

                {/* 업체 목록 (접기/펼치기) */}
                <Collapse in={isGroupExpanded(group.name)} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {group.companies.map((company) => (
                      <ListItem
                        key={company.id}
                        sx={{
                          pl: 4,
                          bgcolor: isCompanySelected(company.id) ? '#e8f5e9' : 'inherit',
                          '&:hover': { bgcolor: '#f1f8e9' }
                        }}
                      >
                        <Checkbox
                          checked={isCompanySelected(company.id)}
                          onChange={(e) => handleCompanyCheck(company.id, e.target.checked)}
                        />
                        <ListItemText
                          primary={company.name}
                          secondary={`ID: ${company.id}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Box>
            ))}
          </List>
        )}

        {filteredGroups.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="textSecondary">
              {searchTerm ? '검색 결과가 없습니다.' : '그룹이 없습니다.'}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleConfirm} variant="contained" color="primary">
          확인
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GroupSelectionModal;

