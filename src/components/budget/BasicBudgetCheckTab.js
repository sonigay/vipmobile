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
  MenuItem,
  Button
} from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import { API_BASE_URL } from '../../api';

const BasicBudgetCheckTab = ({ loggedInStore }) => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [selectedYearMonth, setSelectedYearMonth] = useState('all');
  const [allSettings, setAllSettings] = useState([]);

  useEffect(() => {
    loadAllSettings();
    loadTeamLeaders();
  }, []);

  useEffect(() => {
    loadSettings();
  }, [selectedYearMonth, allSettings]);

  const loadAllSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/basic-budget-settings`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        const userRole = loggedInStore?.userRole;
        const filtered = (userRole === 'SS' || userRole === 'S')
          ? data
          : data.filter(setting => {
              if (!Array.isArray(setting.checkerPermissions)) {
                return false;
              }
              const normalizedUserRole = (userRole || '').trim();
              return setting.checkerPermissions.some(perm =>
                (perm || '').trim() === normalizedUserRole
              );
            });
        setAllSettings(filtered);
        setSettings(filtered);
      }
    } catch (error) {
      console.error('기본예산 설정 전체 로드 오류:', error);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      let filteredByYearMonth = allSettings;
      if (selectedYearMonth && selectedYearMonth !== 'all') {
        filteredByYearMonth = allSettings.filter(setting => setting.yearMonth === selectedYearMonth);
      }
      setSettings(filteredByYearMonth);
    } catch (error) {
      console.error('기본예산 설정 로드 오류:', error);
      setError('기본예산 설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamLeaders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/team-leaders`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTeamLeaders(data);
      }
    } catch (error) {
      console.error('팀장 목록 로드 오류:', error);
    }
  };

  const handleCardClick = (link) => {
    if (!link) return;
    let url = link;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://docs.google.com/spreadsheets/d/${link}/edit`;
    }
    window.open(url, '_blank');
  };

  const availableYearMonths = useMemo(() => {
    const months = new Set(allSettings.map(s => s.yearMonth).filter(Boolean));
    return ['all', ...Array.from(months).sort().reverse()];
  }, [allSettings]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        기본예산확인
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
          {settings.length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                등록된 기본예산이 없습니다. 기본예산시트설정 탭에서 추가해주세요.
              </Typography>
            </Grid>
          ) : (
            settings.map((setting) => (
              <Grid item xs={12} sm={6} md={4} key={setting.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>{setting.name}</Typography>
                    {setting.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {setting.description}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>년월:</strong> {setting.yearMonth}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>확인자적용권한:</strong>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', mt: 0.5 }}>
                        {setting.checkerPermissions.map((perm) => {
                          const leader = teamLeaders.find(l => l.code === perm);
                          const displayLabel = leader ? `${leader.name} (${perm})` : perm;
                          return (
                            <Chip key={perm} label={displayLabel} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                          );
                        })}
                      </Box>
                    </Typography>
                  </CardContent>
                  <Box sx={{ p: 2, pt: 0 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<LinkIcon />}
                      onClick={() => handleCardClick(setting.link)}
                      sx={{ mt: 1 }}
                    >
                      구글시트 바로가기
                    </Button>
                  </Box>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}
    </Box>
  );
};

export default BasicBudgetCheckTab;
