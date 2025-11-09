import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import UpdateIcon from '@mui/icons-material/Update';
import LogoutIcon from '@mui/icons-material/Logout';
import InsightsIcon from '@mui/icons-material/Insights';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { api } from '../api';
import AppUpdatePopup from './AppUpdatePopup';
import { getModeColor, getModeTitle } from '../config/modeConfig';

const MODE_KEY = 'quickServiceManagement';

const defaultStatistics = {
  companyStats: [],
  popularCompanies: [],
  excellentCompanies: [],
  distanceCostAnalysis: [],
  timeTrends: []
};

const defaultQuality = {
  outliers: [],
  normalizationStatus: { total: 0, normalized: 0, rate: 0 },
  duplicateRate: 0,
  reliabilityScores: []
};

const QuickServiceManagementMode = ({
  onLogout,
  onModeChange,
  availableModes = [],
  loggedInStore
}) => {
  const [statistics, setStatistics] = useState(defaultStatistics);
  const [quality, setQuality] = useState(defaultQuality);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [region, setRegion] = useState('all');
  const [regionOptions, setRegionOptions] = useState(['all']);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const modeColor = useMemo(() => getModeColor(MODE_KEY), []);
  const modeTitle = useMemo(
    () => getModeTitle(MODE_KEY, '퀵서비스 관리 모드'),
    []
  );

  const collectRegions = useCallback((stats) => {
    if (!stats) return [];
    const regions = new Set();
    (stats.popularCompanies || []).forEach((item) => {
      if (item.region) regions.add(item.region);
    });
    (stats.excellentCompanies || []).forEach((item) => {
      if (item.region) regions.add(item.region);
    });
    return Array.from(regions);
  }, []);

  const fetchData = useCallback(
    async (targetRegion, forceRefresh = false) => {
      setLoading(true);
      setError(null);

      try {
        const [statsRes, qualityRes] = await Promise.all([
          api.getQuickCostStatistics(
            targetRegion === 'all' ? undefined : targetRegion,
            { forceRefresh }
          ),
          api.getQuickCostQuality({ forceRefresh })
        ]);

        if (!statsRes?.success) {
          throw new Error(statsRes?.error || '통계 데이터를 불러오지 못했습니다.');
        }
        if (!qualityRes?.success) {
          throw new Error(
            qualityRes?.error || '데이터 품질 정보를 불러오지 못했습니다.'
          );
        }

        const statsData = statsRes.data || defaultStatistics;
        const qualityData = qualityRes.data || defaultQuality;

        setStatistics(statsData);
        setQuality(qualityData);

        const regions = collectRegions(statsData);
        setRegionOptions((prev) => {
          const merged = new Set(prev);
          regions.forEach((item) => merged.add(item));
          return ['all', ...Array.from(merged).filter((item) => item !== 'all')];
        });
      } catch (err) {
        console.error('[QuickServiceManagementMode] 데이터 로드 실패:', err);
        setError(err.message || '데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [collectRegions]
  );

  useEffect(() => {
    fetchData(region, false);
  }, [fetchData, region]);

  useEffect(() => {
    const hideUntil = localStorage.getItem(`hideUpdate_${MODE_KEY}`);
    if (!hideUntil || new Date() >= new Date(hideUntil)) {
      setShowUpdatePopup(true);
    }
  }, []);

  const summaryStats = useMemo(() => {
    const totalCompanies = statistics.companyStats.length;
    const totalEntries = statistics.companyStats.reduce(
      (sum, item) => sum + (item.entryCount || 0),
      0
    );
    const averageCost =
      totalCompanies > 0
        ? Math.round(
            statistics.companyStats.reduce(
              (sum, item) => sum + (item.averageCost || 0),
              0
            ) / totalCompanies
          )
        : 0;
    const averageReliability =
      totalCompanies > 0
        ? Math.round(
            statistics.companyStats.reduce(
              (sum, item) => sum + (item.reliabilityScore || 0),
              0
            ) / totalCompanies
          )
        : 0;

    return {
      totalCompanies,
      totalEntries,
      averageCost,
      averageReliability
    };
  }, [statistics]);

  const normalizationRate = quality.normalizationStatus?.rate || 0;

  const handleRegionChange = (event) => {
    setRegion(event.target.value);
  };

  const handleRefresh = () => {
    fetchData(region, true);
  };

  const renderSummaryCard = (title, value, icon, description, color) => (
    <Card elevation={3} sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: `${color}22`,
              color
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
            {description && (
              <Typography variant="caption" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderTable = (title, rows, columns, emptyMessage) => (
    <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      {rows.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
          {emptyMessage}
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                  align={column.align || 'left'}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.companyName}-${row.phoneNumber}-${index}`}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align || 'left'}
                    sx={{ whiteSpace: column.nowrap ? 'nowrap' : 'inherit' }}
                  >
                    {column.render
                      ? column.render(row, index)
                      : row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: modeColor }}>
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" component="div">
              {modeTitle}
            </Typography>
            {loggedInStore?.name && (
              <Chip
                icon={<InfoOutlinedIcon />}
                label={loggedInStore.name}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  color: 'white',
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {typeof onModeChange === 'function' &&
              (availableModes?.length || 0) > 1 && (
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<SwapHorizIcon />}
                  onClick={onModeChange}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.5)',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.8)'
                    }
                  }}
                >
                  모드 변경
                </Button>
              )}
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<UpdateIcon />}
              onClick={() => setShowUpdatePopup(true)}
              sx={{
                borderColor: 'rgba(255,255,255,0.5)',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.8)'
                }
              }}
            >
              업데이트 확인
            </Button>
            {typeof onLogout === 'function' && (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={onLogout}
                sx={{
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.8)'
                  }
                }}
              >
                로그아웃
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Paper
            elevation={1}
            sx={{
              p: 2.5,
              borderRadius: 2,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                지역 선택
              </Typography>
              <TextField
                select
                size="small"
                value={region}
                onChange={handleRegionChange}
                sx={{ minWidth: 160 }}
              >
                {regionOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option === 'all' ? '전체 지역' : option}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Tooltip title="데이터 새로고침">
                <span>
                  <IconButton
                    color="primary"
                    onClick={handleRefresh}
                    disabled={loading}
                  >
                    <RefreshIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Paper>

          {loading ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 12,
                gap: 2,
                color: 'text.secondary'
              }}
            >
              <CircularProgress color="secondary" />
              <Typography variant="body2">데이터를 불러오는 중입니다...</Typography>
            </Box>
          ) : error ? (
            <Paper
              elevation={1}
              sx={{
                p: 4,
                borderRadius: 2,
                textAlign: 'center',
                color: 'error.main'
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                데이터를 불러오지 못했습니다.
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {error}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => fetchData(region, true)}
              >
                다시 시도
              </Button>
            </Paper>
          ) : (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  {renderSummaryCard(
                    '총 업체 수',
                    `${summaryStats.totalCompanies.toLocaleString()} 곳`,
                    <InsightsIcon />,
                    '등록된 퀵서비스 업체 수',
                    modeColor
                  )}
                </Grid>
                <Grid item xs={12} md={3}>
                  {renderSummaryCard(
                    '총 입력 건수',
                    `${summaryStats.totalEntries.toLocaleString()} 건`,
                    <CheckCircleIcon />,
                    '누적 입력 기록',
                    '#1976d2'
                  )}
                </Grid>
                <Grid item xs={12} md={3}>
                  {renderSummaryCard(
                    '평균 비용',
                    summaryStats.averageCost
                      ? `${summaryStats.averageCost.toLocaleString()} 원`
                      : '-',
                    <MapOutlinedIcon />,
                    '전체 평균 예상 비용',
                    '#ff9800'
                  )}
                </Grid>
                <Grid item xs={12} md={3}>
                  {renderSummaryCard(
                    '평균 신뢰도',
                    `${summaryStats.averageReliability}`,
                    <InsightsIcon />,
                    '입력량/일관성 기반 지표',
                    '#009688'
                  )}
                </Grid>
              </Grid>

              <Grid container spacing={3}>
                <Grid item xs={12} lg={6}>
                  {renderTable(
                    '지역별 인기 업체 TOP 20',
                    statistics.popularCompanies || [],
                    [
                      {
                        key: 'rank',
                        label: '순위',
                        align: 'center',
                        render: (_row, index) => index + 1
                      },
                      { key: 'region', label: '지역', nowrap: true },
                      {
                        key: 'companyName',
                        label: '업체명',
                        render: (row) => (
                          <Stack spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {row.companyName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.phoneNumber}
                            </Typography>
                          </Stack>
                        )
                      },
                      {
                        key: 'entryCount',
                        label: '등록 건수',
                        align: 'right',
                        render: (row) =>
                          `${(row.entryCount || 0).toLocaleString()} 건`
                      }
                    ],
                    '해당 지역의 인기 업체 데이터가 없습니다.'
                  )}
                </Grid>
                <Grid item xs={12} lg={6}>
                  {renderTable(
                    '지역별 우수 업체 TOP 20',
                    statistics.excellentCompanies || [],
                    [
                      {
                        key: 'rank',
                        label: '순위',
                        align: 'center',
                        render: (_row, index) => index + 1
                      },
                      { key: 'region', label: '지역', nowrap: true },
                      {
                        key: 'companyName',
                        label: '업체명',
                        render: (row) => (
                          <Stack spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {row.companyName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.phoneNumber}
                            </Typography>
                          </Stack>
                        )
                      },
                      {
                        key: 'averageSpeedScore',
                        label: '평균 속도 점수',
                        align: 'right',
                        render: (row) => (
                          <Chip
                            size="small"
                            color={
                              row.averageSpeedScore >= 2.5
                                ? 'success'
                                : row.averageSpeedScore >= 2
                                ? 'warning'
                                : 'default'
                            }
                            label={row.averageSpeedScore?.toFixed(2) || '-'}
                            sx={{ fontWeight: 600 }}
                          />
                        )
                      }
                    ],
                    '해당 지역의 우수 업체 데이터가 없습니다.'
                  )}
                </Grid>
              </Grid>

              <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    데이터 품질 현황
                  </Typography>
                </Box>
                <Box sx={{ px: 3, py: 3 }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle2" color="text.secondary">
                          업체명 정규화 진행률
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            color="primary"
                            variant="outlined"
                            label={`${normalizationRate}%`}
                            sx={{ fontWeight: 600 }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            총 {quality.normalizationStatus.total.toLocaleString()}건 중{' '}
                            {quality.normalizationStatus.normalized.toLocaleString()}건 정규화
                          </Typography>
                        </Stack>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle2" color="text.secondary">
                          업체명 중복률
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            color={
                              quality.duplicateRate < 20
                                ? 'success'
                                : quality.duplicateRate < 40
                                ? 'warning'
                                : 'error'
                            }
                            label={`${quality.duplicateRate?.toFixed(2)}%`}
                            sx={{ fontWeight: 600 }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            중복률이 높을수록 정규화 필요성이 큽니다.
                          </Typography>
                        </Stack>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle2" color="text.secondary">
                          이상치 데이터
                        </Typography>
                        {quality.outliers?.length > 0 ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <WarningAmberIcon color="warning" />
                            <Typography variant="body2">
                              {quality.outliers.length.toLocaleString()}건의 이상치 검토 필요
                            </Typography>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CheckCircleIcon color="success" />
                            <Typography variant="body2" color="text.secondary">
                              검토가 필요한 이상치 데이터가 없습니다.
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="body2" color="text.secondary">
                    * 지도 기반 시각화 및 추가 품질 지표는 향후 단계에서 구현 예정입니다.
                    인기/우수 업체 분포를 지도에서 직관적으로 확인할 수 있도록 확장할 계획입니다.
                  </Typography>
                </Box>
              </Paper>
            </>
          )}
        </Stack>
      </Container>

      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode={MODE_KEY}
        loggedInStore={loggedInStore}
      />
    </>
  );
};

export default QuickServiceManagementMode;
