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
  Tooltip,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip as LeafletTooltip
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
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

const REGION_COORDINATES = {
  서울: { lat: 37.5665, lng: 126.978 },
  부산: { lat: 35.1796, lng: 129.0756 },
  대구: { lat: 35.8714, lng: 128.6014 },
  인천: { lat: 37.4563, lng: 126.7052 },
  광주: { lat: 35.1595, lng: 126.8526 },
  대전: { lat: 36.3504, lng: 127.3845 },
  울산: { lat: 35.5384, lng: 129.3114 },
  세종: { lat: 36.4875, lng: 127.2817 },
  경기: { lat: 37.4138, lng: 127.5183 },
  강원: { lat: 37.8228, lng: 128.1555 },
  충북: { lat: 36.6357, lng: 127.4917 },
  충남: { lat: 36.5184, lng: 126.8 },
  전북: { lat: 35.7175, lng: 127.153 },
  전남: { lat: 34.8679, lng: 126.991 },
  경북: { lat: 36.4919, lng: 128.8889 },
  경남: { lat: 35.4606, lng: 128.2132 },
  제주: { lat: 33.4996, lng: 126.5312 },
  기타: { lat: 36.5, lng: 127.8 }
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
  const [mapMetric, setMapMetric] = useState('popular');
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

  const handleMapMetricChange = (_event, next) => {
    if (next !== null) {
      setMapMetric(next);
    }
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

  const aggregatedRegionMetrics = useMemo(() => {
    const metrics = {};

    (statistics.popularCompanies || []).forEach((item) => {
      const regionKey = item.region || '기타';
      if (!metrics[regionKey]) {
        metrics[regionKey] = {
          region: regionKey,
          popularEntries: 0,
          excellentEntries: 0,
          averageSpeedScoreSum: 0,
          averageSpeedScoreAvg: 0,
          popularTopCompany: null,
          excellentTopCompany: null
        };
      }
      metrics[regionKey].popularEntries += item.entryCount || 0;
      if (!metrics[regionKey].popularTopCompany) {
        metrics[regionKey].popularTopCompany = {
          companyName: item.companyName,
          phoneNumber: item.phoneNumber
        };
      }
    });

    (statistics.excellentCompanies || []).forEach((item) => {
      const regionKey = item.region || '기타';
      if (!metrics[regionKey]) {
        metrics[regionKey] = {
          region: regionKey,
          popularEntries: 0,
          excellentEntries: 0,
          averageSpeedScoreSum: 0,
          averageSpeedScoreAvg: 0,
          popularTopCompany: null,
          excellentTopCompany: null
        };
      }
      metrics[regionKey].excellentEntries += 1;
      metrics[regionKey].averageSpeedScoreSum += item.averageSpeedScore || 0;
      if (!metrics[regionKey].excellentTopCompany) {
        metrics[regionKey].excellentTopCompany = {
          companyName: item.companyName,
          phoneNumber: item.phoneNumber
        };
      }
    });

    Object.values(metrics).forEach((metric) => {
      if (metric.excellentEntries > 0) {
        metric.averageSpeedScoreAvg =
          Math.round(
            (metric.averageSpeedScoreSum / metric.excellentEntries) * 100
          ) / 100;
      }
    });

    return metrics;
  }, [statistics]);

  const mapData = useMemo(() => {
    const list = [];

    Object.values(aggregatedRegionMetrics).forEach((metric) => {
      const coords =
        REGION_COORDINATES[metric.region] || REGION_COORDINATES.기타;

      if (mapMetric === 'popular' && metric.popularEntries > 0) {
        const top = metric.popularTopCompany;
        list.push({
          key: `${metric.region}-popular`,
          region: metric.region,
          lat: coords.lat,
          lng: coords.lng,
          intensity: metric.popularEntries,
          label: `${metric.popularEntries.toLocaleString()}건`,
          description: top
            ? `${top.companyName} (${top.phoneNumber || '-'})`
            : '상위 업체 정보 없음'
        });
      }

      if (mapMetric === 'excellent' && metric.excellentEntries > 0) {
        const top = metric.excellentTopCompany;
        list.push({
          key: `${metric.region}-excellent`,
          region: metric.region,
          lat: coords.lat,
          lng: coords.lng,
          intensity: metric.averageSpeedScoreAvg,
          label: `${metric.averageSpeedScoreAvg?.toFixed(2)}점`,
          description: top
            ? `${top.companyName} (${top.phoneNumber || '-'})`
            : '상위 업체 정보 없음'
        });
      }
    });

    return list;
  }, [aggregatedRegionMetrics, mapMetric]);

  const mapIntensityRange = useMemo(() => {
    if (mapData.length === 0) return { min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    mapData.forEach((item) => {
      if (item.intensity < min) min = item.intensity;
      if (item.intensity > max) max = item.intensity;
    });
    if (!isFinite(min) || !isFinite(max)) {
      return { min: 0, max: 1 };
    }
    return { min, max };
  }, [mapData]);

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
              <Paper
                elevation={2}
                sx={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Box
                  sx={{
                    px: 3,
                    py: 2,
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1.5
                  }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      지역 분포 시각화 (1차 버전)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      인기/우수 업체 데이터를 지도에 표시합니다. 이후 단계에서 폴리곤 기반 열지도 등으로 확장할 예정입니다.
                    </Typography>
                  </Stack>
                  <ToggleButtonGroup
                    size="small"
                    value={mapMetric}
                    exclusive
                    onChange={handleMapMetricChange}
                  >
                    <ToggleButton value="popular">인기 업체</ToggleButton>
                    <ToggleButton value="excellent">우수 업체</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Box sx={{ height: 420 }}>
                  {mapData.length === 0 ? (
                    <Box
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'text.secondary',
                        gap: 1.5
                      }}
                    >
                      <MapOutlinedIcon fontSize="large" />
                      <Typography variant="body2">
                        표시할 데이터가 없습니다.
                      </Typography>
                    </Box>
                  ) : (
                    <MapContainer
                      center={[36.5, 127.8]}
                      zoom={6.7}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                      attributionControl={false}
                    >
                      <TileLayer
                        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {mapData.map((item) => {
                        const range =
                          mapIntensityRange.max - mapIntensityRange.min || 1;
                        const normalized =
                          (item.intensity - mapIntensityRange.min) / range;
                        const radius =
                          mapMetric === 'popular'
                            ? 10000 + normalized * 25000
                            : 8000 + normalized * 20000;
                        const color =
                          mapMetric === 'popular' ? '#ff7043' : '#4caf50';
                        return (
                          <CircleMarker
                            key={item.key}
                            center={[item.lat, item.lng]}
                            radius={Math.max(radius / 4000, 8)}
                            pathOptions={{
                              color,
                              fillColor: color,
                              fillOpacity: 0.4,
                              weight: 2
                            }}
                          >
                            <LeafletTooltip direction="top" offset={[0, -2]}>
                              <div style={{ minWidth: 160 }}>
                                <strong>{item.region}</strong>
                                <br />
                                {mapMetric === 'popular'
                                  ? `등록 건수: ${item.label}`
                                  : `평균 속도 점수: ${item.label}`}
                                <br />
                                {item.description}
                              </div>
                            </LeafletTooltip>
                          </CircleMarker>
                        );
                      })}
                    </MapContainer>
                  )}
                </Box>
              </Paper>

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
