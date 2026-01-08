import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { API_BASE_URL } from '../../api';

const BudgetChannelCheckTab = ({ loggedInStore }) => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [selectedYearMonth, setSelectedYearMonth] = useState('all');
  const [allSettings, setAllSettings] = useState([]); // For year-month filter options

  useEffect(() => {
    loadAllSettings(); // Load all settings first to populate year-month filter
    loadTeamLeaders();
  }, []);

  useEffect(() => {
    loadSettings();
  }, [selectedYearMonth]);

  const loadAllSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/budget-channel-settings`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAllSettings(data);
        // Initially show all settings
        setSettings(data);
      }
    } catch (error) {
      console.error('예산채널 설정 전체 로드 오류:', error);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const url = new URL(`${API_BASE_URL}/api/budget-channel-settings`);
      if (selectedYearMonth && selectedYearMonth !== 'all') {
        url.searchParams.append('yearMonth', selectedYearMonth);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        setError('예산채널 설정을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('예산채널 설정 로드 오류:', error);
      setError('예산채널 설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamLeaders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`);
      if (response.ok) {
        const agents = await response.json();
        const twoLetterPattern = /^[A-Z]{2}$/;
        const ssAgent = agents.find(agent => agent.permissionLevel === 'SS');
        
        const leaders = agents
          .filter(agent => {
            const permissionLevel = agent.permissionLevel;
            return permissionLevel && (permissionLevel === 'SS' || twoLetterPattern.test(permissionLevel));
          })
          .map(agent => {
            const permissionLevel = agent.permissionLevel;
            let name = agent.target;
            if (permissionLevel === 'SS' && ssAgent && ssAgent.target) {
              name = ssAgent.target;
            } else if (!name || name.trim() === '') {
              name = permissionLevel;
            }
            const qualification = agent.qualification || '';
            let finalQualification = qualification;
            if (permissionLevel === 'SS' && ssAgent && ssAgent.qualification) {
              finalQualification = ssAgent.qualification;
            }
            const displayName = finalQualification 
              ? `${name} (${finalQualification})`
              : name;
            return {
              code: permissionLevel,
              name: displayName
            };
          });
        
        const hasSS = leaders.some(leader => leader.code === 'SS');
        if (!hasSS) {
          if (ssAgent && ssAgent.target) {
            const name = ssAgent.target;
            const qualification = ssAgent.qualification || '';
            leaders.unshift({
              code: 'SS',
              name: qualification ? `${name} (${qualification})` : name
            });
          } else {
            leaders.unshift({
              code: 'SS',
              name: '총괄 (총괄)'
            });
          }
        }
        
        leaders.sort((a, b) => {
          if (a.code === 'SS') return -1;
          if (b.code === 'SS') return 1;
          return a.code.localeCompare(b.code);
        });
        
        setTeamLeaders(leaders);
      }
    } catch (error) {
      console.error('팀장 목록 로드 오류:', error);
    }
  };

  // Extract unique year-months for the filter
  const availableYearMonths = useMemo(() => {
    const months = new Set(allSettings.map(s => s.yearMonth).filter(Boolean));
    return ['all', ...Array.from(months).sort().reverse()];
  }, [allSettings]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        채널별예산확인
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>년월 필터</InputLabel>
          <Select
            value={selectedYearMonth}
            label="년월 필터"
            onChange={(e) => setSelectedYearMonth(e.target.value)}
          >
            {availableYearMonths.map(ym => (
              <MenuItem key={ym} value={ym}>
                {ym === 'all' ? '전체' : ym}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading && settings.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {settings.map((setting) => (
            <Grid item xs={12} sm={6} md={4} key={setting.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {setting.channelName}
                  </Typography>
                  {setting.channelDescription && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {setting.channelDescription}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <a 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        let url = setting.channelLink;
                        if (/^[a-zA-Z0-9-_]+$/.test(url)) {
                          url = `https://docs.google.com/spreadsheets/d/${url}/edit`;
                        }
                        window.open(url, '_blank');
                      }}
                      style={{ color: '#1976d2', textDecoration: 'none' }}
                    >
                      구글시트 바로가기
                    </a>
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      확인적용권한자:
                    </Typography>
                    {setting.checkerPermissions.map((perm) => {
                      const leader = teamLeaders.find(l => l.code === perm);
                      const displayLabel = leader 
                        ? `${leader.name} (${perm})` 
                        : perm;
                      return (
                        <Chip key={perm} label={displayLabel} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default BudgetChannelCheckTab;
