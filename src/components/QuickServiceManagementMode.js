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
  ToggleButtonGroup,
  Alert
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
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../api';
import AppUpdatePopup from './AppUpdatePopup';
import QuickCostModal from './QuickCostModal';
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

const CITY_COORDINATES = {
  수원시: { lat: 37.2636, lng: 127.0286 },
  용인시: { lat: 37.2411, lng: 127.1775 },
  성남시: { lat: 37.4200, lng: 127.1267 },
  의정부시: { lat: 37.7380, lng: 127.0337 },
  안양시: { lat: 37.3943, lng: 126.9568 },
  부천시: { lat: 37.5036, lng: 126.7660 },
  고양시: { lat: 37.6584, lng: 126.8320 },
  과천시: { lat: 37.4292, lng: 126.9879 },
  광명시: { lat: 37.4755, lng: 126.8666 },
  구리시: { lat: 37.5943, lng: 127.1295 },
  남양주시: { lat: 37.6368, lng: 127.2148 },
  동두천시: { lat: 37.9035, lng: 127.0606 },
  시흥시: { lat: 37.3799, lng: 126.8031 },
  파주시: { lat: 37.7599, lng: 126.7800 },
  평택시: { lat: 36.9925, lng: 127.1129 },
  포천시: { lat: 37.8945, lng: 127.2001 },
  하남시: { lat: 37.5393, lng: 127.2146 },
  군포시: { lat: 37.3614, lng: 126.9350 },
  의왕시: { lat: 37.3446, lng: 126.9683 },
  오산시: { lat: 37.1498, lng: 127.0771 },
  이천시: { lat: 37.2720, lng: 127.4350 },
  안산시: { lat: 37.3219, lng: 126.8309 },
  양주시: { lat: 37.7853, lng: 127.0450 },
  여주시: { lat: 37.2980, lng: 127.6374 },
  김포시: { lat: 37.6152, lng: 126.7158 },
  화성시: { lat: 37.1995, lng: 126.8314 },
  천안시: { lat: 36.8151, lng: 127.1139 },
  아산시: { lat: 36.7898, lng: 127.0019 },
  공주시: { lat: 36.4460, lng: 127.1190 },
  보령시: { lat: 36.3333, lng: 126.6125 },
  서산시: { lat: 36.7845, lng: 126.4500 },
  논산시: { lat: 36.1872, lng: 127.0980 },
  계룡시: { lat: 36.2748, lng: 127.2487 },
  당진시: { lat: 36.8890, lng: 126.6468 },
  춘천시: { lat: 37.8813, lng: 127.7298 },
  원주시: { lat: 37.3422, lng: 127.9198 },
  강릉시: { lat: 37.7519, lng: 128.8761 },
  동해시: { lat: 37.5245, lng: 129.1140 },
  태백시: { lat: 37.1641, lng: 128.9856 },
  속초시: { lat: 38.2043, lng: 128.5911 },
  삼척시: { lat: 37.4479, lng: 129.1657 },
  충주시: { lat: 36.9910, lng: 127.9250 },
  제천시: { lat: 37.1326, lng: 128.1995 },
  청주시: { lat: 36.6424, lng: 127.4890 },
  전주시: { lat: 35.8242, lng: 127.1479 },
  군산시: { lat: 35.9676, lng: 126.7363 },
  익산시: { lat: 35.9483, lng: 126.9574 },
  남원시: { lat: 35.4164, lng: 127.3900 },
  김제시: { lat: 35.8039, lng: 126.8800 },
  목포시: { lat: 34.8118, lng: 126.3922 },
  여수시: { lat: 34.7604, lng: 127.6622 },
  순천시: { lat: 34.9507, lng: 127.4872 },
  나주시: { lat: 35.0155, lng: 126.7109 },
  광양시: { lat: 34.9400, lng: 127.6957 },
  포항시: { lat: 36.0190, lng: 129.3435 },
  경주시: { lat: 35.8562, lng: 129.2247 },
  안동시: { lat: 36.5683, lng: 128.7294 },
  김천시: { lat: 36.1397, lng: 128.1136 },
  구미시: { lat: 36.1195, lng: 128.3446 },
  영주시: { lat: 36.8057, lng: 128.6242 },
  영천시: { lat: 35.9733, lng: 128.9382 },
  상주시: { lat: 36.4105, lng: 128.1596 },
  문경시: { lat: 36.5860, lng: 128.1868 },
  경산시: { lat: 35.8251, lng: 128.7415 },
  창원시: { lat: 35.2283, lng: 128.6818 },
  김해시: { lat: 35.2285, lng: 128.8890 },
  진주시: { lat: 35.1796, lng: 128.1070 },
  통영시: { lat: 34.8554, lng: 128.4330 },
  사천시: { lat: 35.0038, lng: 128.0640 },
  밀양시: { lat: 35.5038, lng: 128.7468 },
  거제시: { lat: 34.8806, lng: 128.6216 },
  양산시: { lat: 35.3350, lng: 129.0372 },
  제주시: { lat: 33.4996, lng: 126.5312 },
  서귀포시: { lat: 33.2539, lng: 126.5590 }
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
  const [historyFilters, setHistoryFilters] = useState({
    fromStoreId: '',
    toStoreId: ''
  });
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [historySuccessMessage, setHistorySuccessMessage] = useState('');
  const [editEntry, setEditEntry] = useState(null);
  const modeColor = useMemo(() => getModeColor(MODE_KEY), []);
  const modeTitle = useMemo(
    () => getModeTitle(MODE_KEY, '퀵서비스 관리 모드'),
    []
  );

  const collectRegions = useCallback((stats) => {
    if (!stats) return [];
    const regionSet = new Set();

    (stats.regionStats || []).forEach((item) => {
      if (item?.region) regionSet.add(item.region);
    });

    (stats.popularCompanies || []).forEach((item) => {
      if (item?.region) regionSet.add(item.region);
    });

    (stats.excellentCompanies || []).forEach((item) => {
      if (item?.region) regionSet.add(item.region);
    });

    return Array.from(regionSet);
  }, []);

  const fetchData = useCallback(
    async (targetRegion, forceRefresh = false) => {
      const fetchRegion =
        targetRegion === 'all' || !targetRegion ? undefined : targetRegion;

      if (fetchRegion !== region) {
        setRegion(targetRegion);
      }

      setLoading(true);
      setError(null);

      try {
        const [statsRes, qualityRes] = await Promise.all([
          api.getQuickCostStatistics(fetchRegion, { forceRefresh }),
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
          const regionList = Array.from(merged).filter(
            (item) => item !== 'all'
          );
          regionList.sort((a, b) => {
            if (a === '기타') return 1;
            if (b === '기타') return -1;
            return a.localeCompare(b, 'ko');
          });
          return ['all', ...regionList];
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
  }, []); // 초기 로딩 한 번만 실행

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
  const duplicateGroups = useMemo(
    () => (quality.duplicateGroups || []).slice(0, 10),
    [quality.duplicateGroups]
  );
  const mergeSuggestions = useMemo(
    () => (quality.mergeSuggestions || []).slice(0, 6),
    [quality.mergeSuggestions]
  );
  const topOutliers = useMemo(
    () => (quality.outliers || []).slice(0, 10),
    [quality.outliers]
  );
  const reliabilityScores = useMemo(
    () => (quality.reliabilityScores || []).slice(0, 15),
    [quality.reliabilityScores]
  );

  const getReliabilityStatus = (score) => {
    if (score >= 75) {
      return { color: 'success', label: '안정' };
    }
    if (score >= 50) {
      return { color: 'warning', label: '주의' };
    }
    return { color: 'error', label: '검토' };
  };

  const companyStatsAll = useMemo(
    () => Array.isArray(statistics.companyStats) ? statistics.companyStats : [],
    [statistics.companyStats]
  );

  const companyOverview = useMemo(() => {
    if (!companyStatsAll.length) {
      return {
        totalCompanies: 0,
        totalEntries: 0,
        averageCost: 0,
        averageReliability: 0
      };
    }

    const totalCompanies = companyStatsAll.length;
    const totalEntries = companyStatsAll.reduce(
      (sum, item) => sum + (item.entryCount || 0),
      0
    );
    const averageCost =
      totalCompanies > 0
        ? Math.round(
            companyStatsAll.reduce(
              (sum, item) => sum + (item.averageCost || 0),
              0
            ) / totalCompanies
          )
        : 0;
    const averageReliability =
      totalCompanies > 0
        ? Math.round(
            companyStatsAll.reduce(
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
  }, [companyStatsAll]);

  const topReliableCompanies = useMemo(() => {
    const sorted = [...companyStatsAll].sort(
      (a, b) => (b.reliabilityScore || 0) - (a.reliabilityScore || 0)
    );
    return sorted.slice(0, 10);
  }, [companyStatsAll]);

  const topVolumeCompanies = useMemo(() => {
    const sorted = [...companyStatsAll].sort(
      (a, b) => (b.entryCount || 0) - (a.entryCount || 0)
    );
    return sorted.slice(0, 10);
  }, [companyStatsAll]);

  const topAffordableCompanies = useMemo(() => {
    const filtered = companyStatsAll.filter((item) => (item.entryCount || 0) >= 3);
    const sorted = filtered.sort(
      (a, b) => (a.averageCost || 0) - (b.averageCost || 0)
    );
    return sorted.slice(0, 10);
  }, [companyStatsAll]);

  const handleRegionChange = (event) => {
    const nextRegion = event.target.value;
    setRegion(nextRegion);
    fetchData(nextRegion, false);
  };

  const handleMapMetricChange = (_event, next) => {
    if (next !== null) {
      setMapMetric(next);
    }
  };

  const performFetchHistory = useCallback(
    async (options = {}) => {
      const { silent = false } = options;
      const fromId = historyFilters.fromStoreId.trim();
      const toId = historyFilters.toStoreId.trim();

      if (!fromId || !toId) {
        setHistoryError('출발 매장 ID와 도착 매장 ID를 모두 입력해주세요.');
        setHistoryData([]);
        setHistoryFetched(false);
        return;
      }

      if (!silent) {
        setHistoryLoading(true);
        setHistorySuccessMessage('');
      }
      setHistoryError(null);

      try {
        const result = await api.getQuickServiceHistory({
          fromStoreId: fromId,
          toStoreId: toId
        });

        if (!result?.success) {
          throw new Error(result?.error || '데이터를 불러오지 못했습니다.');
        }

        setHistoryData(result.data || []);
        setHistoryFetched(true);
      } catch (err) {
        console.error('[QuickServiceManagementMode] history fetch failed:', err);
        setHistoryError(err.message || '데이터를 불러오지 못했습니다.');
        setHistoryData([]);
        setHistoryFetched(false);
      } finally {
        if (!silent) {
          setHistoryLoading(false);
        }
      }
    },
    [historyFilters]
  );

  const handleHistoryInputChange = (field) => (event) => {
    const value = event.target.value;
    setHistoryFilters((prev) => ({
      ...prev,
      [field]: value
    }));
    setHistoryError(null);
    setHistorySuccessMessage('');
  };

  const handleHistoryReset = () => {
    setHistoryFilters({ fromStoreId: '', toStoreId: '' });
    setHistoryData([]);
    setHistoryFetched(false);
    setHistoryError(null);
    setHistorySuccessMessage('');
  };

  const handleFetchHistoryClick = () => {
    performFetchHistory();
  };

  const handleEditEntry = (entry) => {
    if (!entry) return;
    setHistoryError(null);
    setHistorySuccessMessage('');
    setEditEntry({
      rowIndex: entry.rowIndex,
      reverseRowIndex: entry.reverseRowIndex,
      registrantStoreName: entry.registrantStoreName,
      registrantStoreId: entry.registrantStoreId,
      fromStoreName: entry.fromStoreName,
      fromStoreId: entry.fromStoreId,
      toStoreName: entry.toStoreName,
      toStoreId: entry.toStoreId,
      modeType: entry.modeType,
      companies: entry.companies
    });
  };

  const clearClientRouteCache = (fromId, toId, companies = []) => {
    if (typeof window === 'undefined' || !window.clientCacheUtils) return;
    const cacheUtils = window.clientCacheUtils;
    if (fromId && toId) {
      cacheUtils.delete(`quick-cost-estimate-${fromId}-${toId}`);
      cacheUtils.delete(`quick-cost-estimate-${toId}-${fromId}`);
    }
    cacheUtils.delete('quick-cost-companies');
    companies.forEach((company) => {
      if (!company) return;
      const nameKey = (company.name || '').trim();
      if (nameKey) {
        cacheUtils.delete(`quick-cost-phone-${nameKey}`);
      }
      const phoneKey = (company.phone || '').toString().trim();
      if (nameKey && phoneKey) {
        cacheUtils.delete(`quick-cost-cost-${nameKey}-${phoneKey}`);
      }
    });
  };

  const handleDeleteEntry = async (entry) => {
    if (!entry) return;
    const confirmDelete = window.confirm(
      `${entry.fromStoreName || entry.fromStoreId} → ${entry.toStoreName || entry.toStoreId} 등록 데이터를 삭제하시겠습니까?`
    );
    if (!confirmDelete) {
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    setHistorySuccessMessage('');

    try {
      const payload = {
        rowIndex: entry.rowIndex,
        reverseRowIndex: entry.reverseRowIndex,
        fromStoreId: entry.fromStoreId,
        toStoreId: entry.toStoreId
      };
      const result = await api.deleteQuickCost(payload);
      if (!result?.success) {
        throw new Error(result?.error || '삭제에 실패했습니다.');
      }

      clearClientRouteCache(entry.fromStoreId, entry.toStoreId, entry.companies);
      setHistorySuccessMessage('선택한 데이터가 삭제되었습니다.');
      await performFetchHistory({ silent: true });
      fetchData(region, true);
    } catch (err) {
      console.error('[QuickServiceManagementMode] delete failed:', err);
      setHistoryError(err.message || '삭제에 실패했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleEditModalClose = (result) => {
    setEditEntry(null);
    if (result === 'updated') {
      setHistorySuccessMessage('퀵비용 데이터가 수정되었습니다.');
      performFetchHistory({ silent: false });
      fetchData(region, true);
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
        CITY_COORDINATES[metric.region] ||
        REGION_COORDINATES[metric.region] ||
        REGION_COORDINATES.기타;

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
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ borderRadius: 2 }}>
              <Box
                sx={{
                  px: { xs: 2, md: 3 },
                  py: { xs: 2, md: 2.5 }
                }}
              >
                <Grid
                  container
                  spacing={2}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Grid item xs={12} md={8} lg={9}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={{ xs: 1.5, sm: 2 }}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      sx={{ width: '100%', flexWrap: 'wrap' }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, flexShrink: 0 }}
                      >
                        지역 선택
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value={region}
                        onChange={handleRegionChange}
                        sx={{
                          minWidth: { xs: '100%', sm: 220 },
                          maxWidth: { sm: 260 },
                          width: { xs: '100%', sm: 'auto' }
                        }}
                      >
                        {regionOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option === 'all' ? '전체 지역' : option}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  </Grid>
                  <Grid
                    item
                    xs={12}
                    md={4}
                    lg={3}
                    sx={{
                      display: 'flex',
                      justifyContent: { xs: 'flex-start', md: 'flex-end' }
                    }}
                  >
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
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12}>
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
                <Typography variant="body2">
                  데이터를 불러오는 중입니다...
                </Typography>
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
              <Grid container spacing={3}>
                {/* 지도 영역 */}
                <Grid item xs={12}>
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
                </Grid>

                {/* 요약 카드 */}
                <Grid item xs={12}>
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
                </Grid>

                {/* 인기/우수 테이블 */}
                <Grid item xs={12}>
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
                </Grid>

              {/* 업체별 통계 */}
              {companyStatsAll.length > 0 && (
                <Grid item xs={12}>
                  <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
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
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        업체별 통계 개요
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        평균 비용·등록 건수·신뢰도 등을 기반으로 상위 업체를 확인할 수 있습니다.
                      </Typography>
                    </Box>
                    <Box sx={{ px: 3, py: 3 }}>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} md={3}>
                          {renderSummaryCard(
                            '총 업체 수',
                            `${companyOverview.totalCompanies.toLocaleString()} 곳`,
                            <LeaderboardIcon />,
                            '통계에 포함된 업체 (업체+전화 조합)',
                            '#1976d2'
                          )}
                        </Grid>
                        <Grid item xs={12} md={3}>
                          {renderSummaryCard(
                            '총 등록 건수',
                            `${companyOverview.totalEntries.toLocaleString()} 건`,
                            <TrendingUpIcon />,
                            '전체 업체의 누적 입력 수',
                            '#5c6bc0'
                          )}
                        </Grid>
                        <Grid item xs={12} md={3}>
                          {renderSummaryCard(
                            '평균 비용',
                            companyOverview.averageCost
                              ? `${companyOverview.averageCost.toLocaleString()} 원`
                              : '-',
                            <AttachMoneyIcon />,
                            '전체 업체 평균 예상 비용',
                            '#ff7043'
                          )}
                        </Grid>
                        <Grid item xs={12} md={3}>
                          {renderSummaryCard(
                            '평균 신뢰도',
                            `${companyOverview.averageReliability} 점`,
                            <InsightsIcon />,
                            '업체별 신뢰도 점수 평균',
                            '#009688'
                          )}
                        </Grid>
                      </Grid>

                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                              신뢰도 상위 업체
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600 }}>업체명</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    신뢰도
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    등록수
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    평균 비용
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {topReliableCompanies.map((company, index) => {
                                  const status = getReliabilityStatus(
                                    company.reliabilityScore || 0
                                  );
                                  return (
                                    <TableRow key={`${company.companyName}-${company.phoneNumber}-${index}`}>
                                      <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                          {company.companyName}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {company.phoneNumber}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        <Chip
                                          size="small"
                                          color={status.color}
                                          label={`${company.reliabilityScore || 0}점`}
                                          sx={{ fontWeight: 600 }}
                                        />
                                      </TableCell>
                                      <TableCell align="right">
                                        {company.entryCount?.toLocaleString()}건
                                      </TableCell>
                                      <TableCell align="right">
                                        {company.averageCost?.toLocaleString()}원
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                              등록 건수 상위 업체
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600 }}>업체명</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    등록수
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    평균 비용
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    신뢰도
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {topVolumeCompanies.map((company, index) => {
                                  const status = getReliabilityStatus(
                                    company.reliabilityScore || 0
                                  );
                                  return (
                                    <TableRow key={`${company.companyName}-${company.phoneNumber}-volume-${index}`}>
                                      <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                          {company.companyName}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {company.phoneNumber}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        {company.entryCount?.toLocaleString()}건
                                      </TableCell>
                                      <TableCell align="right">
                                        {company.averageCost?.toLocaleString()}원
                                      </TableCell>
                                      <TableCell align="right">
                                        <Chip
                                          size="small"
                                          color={status.color}
                                          label={`${company.reliabilityScore || 0}점`}
                                          sx={{ fontWeight: 600 }}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </Paper>
                        </Grid>
                        <Grid item xs={12}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                              평균 비용이 낮은 우수 업체 (등록 3건 이상)
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600 }}>업체명</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    평균 비용
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    등록수
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    신뢰도
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    속도 점수
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {topAffordableCompanies.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={5} align="center">
                                      <Typography variant="body2" color="text.secondary">
                                        조건을 충족하는 업체가 없습니다.
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  topAffordableCompanies.map((company, index) => {
                                    const status = getReliabilityStatus(
                                      company.reliabilityScore || 0
                                    );
                                    return (
                                      <TableRow key={`${company.companyName}-${company.phoneNumber}-affordable-${index}`}>
                                        <TableCell>
                                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {company.companyName}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {company.phoneNumber}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          {company.averageCost?.toLocaleString()}원
                                        </TableCell>
                                        <TableCell align="right">
                                          {company.entryCount?.toLocaleString()}건
                                        </TableCell>
                                        <TableCell align="right">
                                          <Chip
                                            size="small"
                                            color={status.color}
                                            label={`${company.reliabilityScore || 0}점`}
                                            sx={{ fontWeight: 600 }}
                                          />
                                        </TableCell>
                                        <TableCell align="right">
                                          {company.averageSpeedScore}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                )}
                              </TableBody>
                            </Table>
                          </Paper>
                        </Grid>
                      </Grid>
                    </Box>
                  </Paper>
                </Grid>
              )}

                {/* 데이터 품질 */}
                <Grid item xs={12}>
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
                              <Stack direction="row" spacing={1} align-items="center">
                                <WarningAmberIcon color="warning" />
                                <Typography variant="body2">
                                  {quality.outliers.length.toLocaleString()}건의 이상치 검토 필요
                                </Typography>
                              </Stack>
                            ) : (
                              <Stack direction="row" spacing={1} align-items="center">
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
                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <Paper
                            variant="outlined"
                            sx={{ p: 2, borderRadius: 2 }}
                          >
                            <Stack spacing={1.5}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  신뢰도 평가
                                </Typography>
                                <Tooltip title="등록 건수, 비용 분산, 이상치 비율을 기반으로 산출된 신뢰도 점수입니다.">
                                  <IconButton size="small">
                                    <InfoOutlinedIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                              {reliabilityScores.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                  계산 가능한 신뢰도 데이터가 없습니다.
                                </Typography>
                              ) : (
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600 }}>업체명</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">
                                        신뢰도
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">
                                        등록수
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">
                                        평균 비용
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">
                                        표준편차
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">
                                        이상치 비율
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {reliabilityScores.map((item) => {
                                      const status = getReliabilityStatus(item.score);
                                      return (
                                        <TableRow key={item.normalizedName}>
                                          <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                              {item.displayName || item.normalizedName}
                                            </Typography>
                                            {item.displayName !== item.normalizedName && (
                                              <Typography variant="caption" color="text.secondary">
                                                ({item.normalizedName})
                                              </Typography>
                                            )}
                                          </TableCell>
                                          <TableCell align="right">
                                            <Chip
                                              size="small"
                                              color={status.color}
                                              label={`${item.score}점 · ${status.label}`}
                                              sx={{ fontWeight: 600 }}
                                            />
                                          </TableCell>
                                          <TableCell align="right">
                                            {item.entryCount?.toLocaleString()}건
                                          </TableCell>
                                          <TableCell align="right">
                                            {item.meanCost?.toLocaleString()}원
                                          </TableCell>
                                          <TableCell align="right">
                                            {item.stdDev?.toLocaleString()}원
                                          </TableCell>
                                          <TableCell align="right">
                                            {item.outlierRatio?.toFixed(2)}%
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              )}
                            </Stack>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Paper
                            variant="outlined"
                            sx={{ p: 2, borderRadius: 2, height: '100%' }}
                          >
                            <Stack spacing={1.5} sx={{ height: '100%' }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  중복 업체명 그룹
                                </Typography>
                                <Tooltip title="정규화 키에 여러 변형이 존재하는 상위 그룹">
                                  <IconButton size="small">
                                    <InfoOutlinedIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                              {duplicateGroups.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                  중복 관리가 필요한 업체명이 없습니다.
                                </Typography>
                              ) : (
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600 }}>
                                        정규화 이름
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">
                                        등록 건수
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {duplicateGroups.map((group) => (
                                      <TableRow key={group.normalizedName}>
                                        <TableCell>
                                          <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 600 }}
                                          >
                                            {group.normalizedName || '(미정규화)'}
                                          </Typography>
                                          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                            {group.variants.slice(0, 3).map((variant) => (
                                              <Typography
                                                key={`${variant.name}-${variant.count}`}
                                                variant="caption"
                                                color="text.secondary"
                                              >
                                                {variant.name || '(빈 문자열)'} ·{' '}
                                                {variant.count.toLocaleString()}건
                                              </Typography>
                                            ))}
                                            {group.variants.length > 3 && (
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                              >
                                                + {group.variants.length - 3}개 변형
                                              </Typography>
                                            )}
                                          </Stack>
                                        </TableCell>
                                        <TableCell align="right">
                                          {group.totalCount.toLocaleString()}건
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </Stack>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Paper
                            variant="outlined"
                            sx={{ p: 2, borderRadius: 2, height: '100%' }}
                          >
                            <Stack spacing={1.5} sx={{ height: '100%' }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  이상치 감지
                                </Typography>
                                <Tooltip title="평균 대비 편차가 큰 비용 입력 항목">
                                  <IconButton size="small">
                                    <InfoOutlinedIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                              {topOutliers.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                  확인이 필요한 이상치 데이터가 없습니다.
                                </Typography>
                              ) : (
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600 }}>업체명</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">
                                        비용
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">
                                        편차
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {topOutliers.map((item, index) => (
                                      <TableRow key={`${item.normalizedName}-${index}`}>
                                        <TableCell>
                                          <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 600 }}
                                          >
                                            {item.companyName}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                          >
                                            {item.fromStoreName || '-'} →{' '}
                                            {item.toStoreName || '-'}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          {item.cost?.toLocaleString()}원
                                        </TableCell>
                                        <TableCell align="right">
                                          +{item.deviationRatio}%
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </Stack>
                          </Paper>
                        </Grid>
                        {mergeSuggestions.length > 0 && (
                          <Grid item xs={12}>
                            <Paper
                              variant="outlined"
                              sx={{ p: 2, borderRadius: 2 }}
                            >
                              <Stack spacing={1.5}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography
                                    variant="subtitle2"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    병합 제안
                                  </Typography>
                                  <Tooltip title="동일 정규화 키로 매칭되는 주요 변형 목록입니다. 유사 업체명 병합을 검토하세요.">
                                    <IconButton size="small">
                                      <InfoOutlinedIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                                <Grid container spacing={1.5}>
                                  {mergeSuggestions.map((suggestion) => (
                                    <Grid key={suggestion.normalizedName} item xs={12} md={6}>
                                      <Paper
                                        variant="outlined"
                                        sx={{ p: 1.5, borderRadius: 2 }}
                                      >
                                        <Typography
                                          variant="body2"
                                          sx={{ fontWeight: 600 }}
                                        >
                                          {suggestion.normalizedName || '(미정규화)'}
                                        </Typography>
                                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                          {suggestion.candidates.map((candidate) => (
                                            <Typography
                                              key={`${candidate.name}-${candidate.count}`}
                                              variant="caption"
                                              color="text.secondary"
                                            >
                                              {candidate.name || '(빈 문자열)'} ·{' '}
                                              {candidate.count.toLocaleString()}건
                                            </Typography>
                                          ))}
                                        </Stack>
                                      </Paper>
                                    </Grid>
                                  ))}
                                </Grid>
                              </Stack>
                            </Paper>
                          </Grid>
                        )}
                      </Grid>
                      <Divider sx={{ my: 3 }} />
                      <Typography variant="body2" color="text.secondary">
                        * 지도 기반 시각화 및 추가 품질 지표는 향후 단계에서 구현 예정입니다.
                        인기/우수 업체 분포를 지도에서 직관적으로 확인할 수 있도록 확장할 계획입니다.
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                {/* 데이터 수정/삭제 */}
                <Grid item xs={12}>
                  <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Box
                      sx={{
                        px: 3,
                        py: 2,
                        borderBottom: '1px solid rgba(0,0,0,0.08)'
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.5}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          등록 데이터 수정/삭제
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button
                            onClick={handleHistoryReset}
                            disabled={historyLoading}
                          >
                            초기화
                          </Button>
                          <Button
                            variant="contained"
                            onClick={handleFetchHistoryClick}
                            disabled={historyLoading}
                          >
                            {historyLoading ? '조회 중...' : '조회'}
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                    <Box sx={{ px: 3, py: 3 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4} lg={3}>
                          <TextField
                            label="출발 매장 ID"
                            size="small"
                            fullWidth
                            value={historyFilters.fromStoreId}
                            onChange={handleHistoryInputChange('fromStoreId')}
                            placeholder="예: P123456"
                          />
                        </Grid>
                        <Grid item xs={12} md={4} lg={3}>
                          <TextField
                            label="도착 매장 ID"
                            size="small"
                            fullWidth
                            value={historyFilters.toStoreId}
                            onChange={handleHistoryInputChange('toStoreId')}
                            placeholder="예: P654321"
                          />
                        </Grid>
                        <Grid item xs={12} md={4} lg={6}>
                          <Typography variant="body2" color="text.secondary">
                            출발/도착 매장 ID를 입력하고 조회를 눌러 등록된 퀵비용 데이터를 수정하거나 삭제할 수 있습니다.
                          </Typography>
                        </Grid>
                      </Grid>

                      {historyError && (
                        <Box sx={{ mt: 2 }}>
                          <Alert severity="error">{historyError}</Alert>
                        </Box>
                      )}

                      {historySuccessMessage && (
                        <Box sx={{ mt: 2 }}>
                          <Alert severity="success">{historySuccessMessage}</Alert>
                        </Box>
                      )}

                      <Box sx={{ mt: 3 }}>
                        {historyLoading ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              py: 6,
                              color: 'text.secondary',
                              gap: 2
                            }}
                          >
                            <CircularProgress size={28} />
                            <Typography variant="body2">
                              데이터를 불러오는 중입니다...
                            </Typography>
                          </Box>
                        ) : historyData.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            {historyFetched
                              ? '조회된 데이터가 없습니다.'
                              : '출발/도착 매장 ID를 입력한 뒤 조회를 눌러주세요.'}
                          </Typography>
                        ) : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>등록일시</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>등록자</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>구간</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>업체 정보</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">
                                  동작
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {historyData.map((item) => (
                                <TableRow key={item.rowIndex}>
                                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {item.registeredAt || '-'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      행 번호: {item.rowIndex}
                                      {item.reverseRowIndex
                                        ? ` / 반대 방향: ${item.reverseRowIndex}`
                                        : ''}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {item.registrantStoreName || '-'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {item.registrantStoreId || '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {item.fromStoreName || '-'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {item.fromStoreId || '-'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                                      ↘ {item.toStoreName || '-'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {item.toStoreId || '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Stack spacing={0.5}>
                                      {item.companies.slice(0, 3).map((company, idx) => (
                                        <Typography
                                          key={`${company.name}-${company.phone}-${idx}`}
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {company.name} / {company.phone} /{' '}
                                          {company.cost?.toLocaleString()}원
                                        </Typography>
                                      ))}
                                      {item.companies.length > 3 && (
                                        <Typography variant="caption" color="text.secondary">
                                          + {item.companies.length - 3}건
                                        </Typography>
                                      )}
                                    </Stack>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Tooltip title="수정">
                                      <span>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleEditEntry(item)}
                                          disabled={historyLoading}
                                        >
                                          <EditIcon fontSize="inherit" />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                    <Tooltip title="삭제">
                                      <span>
                                        <IconButton
                                          size="small"
                                          color="error"
                                          onClick={() => handleDeleteEntry(item)}
                                          disabled={historyLoading}
                                        >
                                          <DeleteOutlineIcon fontSize="inherit" />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Container>

      <QuickCostModal
        open={Boolean(editEntry)}
        onClose={handleEditModalClose}
        loggedInStore={loggedInStore}
        fromStore={
          editEntry
            ? { id: editEntry.fromStoreId, name: editEntry.fromStoreName }
            : null
        }
        toStore={
          editEntry
            ? { id: editEntry.toStoreId, name: editEntry.toStoreName }
            : null
        }
        modeType="관리자모드"
        editData={editEntry}
      />

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
