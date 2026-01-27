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
  Alert,
  Autocomplete,
  Tabs,
  Tab
} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Tooltip as LeafletTooltip
} from 'react-leaflet';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
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
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { api } from '../api';
import AppUpdatePopup from './AppUpdatePopup';
import QuickCostModal from './QuickCostModal';
import { getModeColor, getModeTitle } from '../config/modeConfig';

import DataSourceDashboard from './DataSourceDashboard';
import BugDiagnosticDashboard from './BugDiagnosticDashboard';
import { REGION_COORDINATES, CITY_COORDINATES } from '../constants/coordinates';

const MODE_KEY = 'quickServiceManagement';

const defaultStatistics = {
  companyStats: [],
  popularCompanies: [],
  excellentCompanies: [],
  regionAggregates: [],
  distanceCostAnalysis: [],
  timeTrends: {
    monthly: [],
    weekly: []
  }
};

const defaultQuality = {
  outliers: [],
  normalizationStatus: { total: 0, normalized: 0, rate: 0 },
  duplicateRate: 0,
  reliabilityScores: []
};

const TREND_OPTIONS = [
  { key: 'monthly', label: '월별' },
  { key: 'weekly', label: '주별' }
];


const REGION_METRIC_KEYS = new Set(['volume', 'avgCost', 'avgDistance', 'costPerKm']);

const MAP_METRIC_PALETTES = {
  volume: ['#ffe0b2', '#ffb74d', '#f57c00'],
  avgCost: ['#2e7d32', '#fff59d', '#ef5350'],
  avgDistance: ['#bbdefb', '#64b5f6', '#1e88e5'],
  costPerKm: ['#c5e1a5', '#ffeb3b', '#e65100']
};

const interpolateColor = (colors, t) => {
  if (!Array.isArray(colors) || colors.length === 0) {
    return '#1976d2';
  }
  const clampT = Math.max(0, Math.min(1, t));
  if (colors.length === 1) return colors[0];
  const segment = (colors.length - 1) * clampT;
  const index = Math.floor(segment);
  const ratio = segment - index;
  const startColor = colors[index];
  const endColor = colors[Math.min(index + 1, colors.length - 1)];

  const hexToRgb = (hex) => {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  };

  const rgbToHex = (r, g, b) => {
    const toHex = (value) => {
      const hex = value.toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);

  const r = Math.round(start.r + (end.r - start.r) * ratio);
  const g = Math.round(start.g + (end.g - start.g) * ratio);
  const b = Math.round(start.b + (end.b - start.b) * ratio);

  return rgbToHex(r, g, b);
};

const getGradientColor = (paletteKey, value, min, max) => {
  const palette = MAP_METRIC_PALETTES[paletteKey];
  if (!palette || typeof value !== 'number') {
    return '#1976d2';
  }
  const safeMin = typeof min === 'number' ? min : 0;
  const safeMax = typeof max === 'number' ? max : safeMin + 1;
  const range = safeMax - safeMin;
  const normalized =
    range === 0 ? 0.5 : Math.max(0, Math.min(1, (value - safeMin) / range));
  return interpolateColor(palette, normalized);
};

const formatMonthLabel = (label) => {
  if (typeof label !== 'string') return label || '';
  const trimmed = label.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [year, month] = trimmed.split('-');
    return `${year}.${month}`;
  }
  return trimmed || '';
};

const formatWeekLabel = (label) => {
  if (typeof label !== 'string') return label || '';
  const trimmed = label.trim();
  const match = trimmed.match(/^(\d{4})-W(\d{2})$/);
  if (match) {
    const [, year, week] = match;
    return `${year}.${week}주`;
  }
  return trimmed || '';
};

const getIsoWeekStartTimestamp = (year, week) => {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay();
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  simple.setUTCDate(simple.getUTCDate() + (1 - isoDay));
  return simple.getTime();
};

const getTimestampFromLabel = (label) => {
  if (typeof label !== 'string') return null;
  const trimmed = label.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const [, year, month] = match;
    const y = Number(year);
    const m = Number(month);
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      return Date.UTC(y, Math.max(0, m - 1), 1);
    }
  }
  const weekMatch = trimmed.match(/^(\d{4})-W(\d{2})$/);
  if (weekMatch) {
    const [, year, week] = weekMatch;
    const y = Number(year);
    const w = Number(week);
    if (!Number.isNaN(y) && !Number.isNaN(w)) {
      return getIsoWeekStartTimestamp(y, w);
    }
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

const formatTrendDelta = (value, suffix) => {
  if (typeof value !== 'number') return '변화 데이터 없음';
  if (value === 0) return '변화 없음';
  const direction = value > 0 ? '▲' : '▼';
  return `${direction} ${Math.abs(value).toLocaleString()}${suffix}`;
};

const formatNumberWithUnit = (value, unit) => {
  if (value === null || value === undefined) return '-';
  return `${value.toLocaleString()}${unit}`;
};

const formatDateWithSeparator = (timestamp) => {
  if (!timestamp && timestamp !== 0) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const formatDateRange = (startTimestamp, endTimestamp) => {
  const start = formatDateWithSeparator(startTimestamp);
  const end = formatDateWithSeparator(endTimestamp);
  if (!start && !end) return '';
  if (!start) return `~ ${end}`;
  if (!end) return `${start} ~`;
  return `${start} ~ ${end}`;
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
    fromInput: '',
    toInput: ''
  });
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [historySuccessMessage, setHistorySuccessMessage] = useState('');
  const [editEntry, setEditEntry] = useState(null);
  const [storeOptions, setStoreOptions] = useState([]);
  const [storeOptionsLoading, setStoreOptionsLoading] = useState(false);
  const [storeOptionsError, setStoreOptionsError] = useState(null);
  const [historySearchMode, setHistorySearchMode] = useState({
    from: 'id',
    to: 'id'
  });
  const [historySelection, setHistorySelection] = useState({
    from: null,
    to: null
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalStores, setCreateModalStores] = useState({
    from: null,
    to: null
  });
  const [trendGranularity, setTrendGranularity] = useState('monthly');
  const [currentTab, setCurrentTab] = useState('quickService'); // 탭 상태 추가
  const modeColor = useMemo(() => getModeColor(MODE_KEY), []);
  const modeTitle = useMemo(
    () => getModeTitle(MODE_KEY, '퀵서비스 관리 모드'),
    []
  );
  const storeFilterOptions = useMemo(
    () =>
      createFilterOptions({
        matchFrom: 'any',
        stringify: (option) => `${option?.id || ''} ${option?.name || ''}`
      }),
    []
  );

  const resolveStoreIdForFetch = useCallback(
    (mode, selection, input) => {
      if (selection?.id) {
        return selection.id;
      }

      const trimmed = (input || '').toString().trim();
      if (!trimmed) return '';

      if (mode === 'id') {
        return trimmed;
      }

      const lower = trimmed.toLowerCase();
      const found = storeOptions.find(
        (store) =>
          store.name.toLowerCase().includes(lower) ||
          store.id.toLowerCase() === lower
      );
      return found?.id || '';
    },
    [storeOptions]
  );

  const collectRegions = useCallback((stats) => {
    if (!stats) return [];

    // 1. Use explicit availableRegions from API if present (Robust)
    if (stats.availableRegions && Array.isArray(stats.availableRegions) && stats.availableRegions.length > 0) {
      console.log('🔍 [Debug-Frontend] API returned availableRegions:', stats.availableRegions);
      return stats.availableRegions;
    }

    console.warn('⚠️ [Debug-Frontend] API did NOT return availableRegions or it is empty. Stats keys:', Object.keys(stats));

    // 2. Fallback to existing logic (Legacy)
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

    (stats.companyStats || []).forEach((item) => {
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

  useEffect(() => {
    let mounted = true;
    const fetchStores = async () => {
      setStoreOptionsLoading(true);
      setStoreOptionsError(null);
      try {
        const stores = await api.getStores({ includeShipped: true });
        if (!mounted) return;
        if (Array.isArray(stores)) {
          const processed = stores
            .map((store) => ({
              id: store?.id?.toString().trim() || '',
              name: store?.name?.toString().trim() || '',
              address: store?.address?.toString().trim() || '',
              uniqueId: store?.uniqueId || `${store?.id || ''}_${store?.name || ''}`
            }))
            .filter((store) => store.id && store.name);
          processed.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
          setStoreOptions(processed);
        } else {
          setStoreOptions([]);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[QuickServiceManagementMode] store fetch failed:', err);
        setStoreOptionsError(err.message || '매장 목록을 불러오지 못했습니다.');
        setStoreOptions([]);
      } finally {
        if (mounted) {
          setStoreOptionsLoading(false);
        }
      }
    };

    fetchStores();
    return () => {
      mounted = false;
    };
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

  const trendDataMap = useMemo(() => {
    const raw = statistics.timeTrends;
    if (!raw) return {};
    if (Array.isArray(raw)) {
      return { monthly: raw };
    }
    return raw;
  }, [statistics.timeTrends]);

  const availableTrendKeys = useMemo(() => {
    const keys = Object.keys(trendDataMap);
    if (keys.length === 0) return [];
    const nonEmpty = keys.filter((key) => {
      const list = trendDataMap[key];
      return Array.isArray(list) && list.length > 0;
    });
    return nonEmpty.length > 0 ? nonEmpty : keys;
  }, [trendDataMap]);

  useEffect(() => {
    if (availableTrendKeys.length === 0) return;
    if (!availableTrendKeys.includes(trendGranularity)) {
      setTrendGranularity(availableTrendKeys[0]);
    }
  }, [availableTrendKeys, trendGranularity]);

  const timeTrendSeries = useMemo(() => {
    const source = trendDataMap[trendGranularity];
    if (!Array.isArray(source)) return [];
    return source
      .map((item) => {
        const label = item?.label || '';
        const rawTimestamp =
          typeof item?.timestamp === 'number'
            ? item.timestamp
            : getTimestampFromLabel(label);
        const startTimestamp =
          typeof item?.startTimestamp === 'number'
            ? item.startTimestamp
            : rawTimestamp;
        const endTimestamp =
          typeof item?.endTimestamp === 'number'
            ? item.endTimestamp
            : startTimestamp;
        const timestamp = Number.isFinite(startTimestamp)
          ? startTimestamp
          : Number.isFinite(rawTimestamp)
            ? rawTimestamp
            : Date.now();
        const type = item?.type || trendGranularity;
        const displayLabel =
          item?.displayLabel ||
          (type === 'weekly'
            ? formatWeekLabel(label)
            : formatMonthLabel(label));
        return {
          label,
          displayLabel,
          entryCount: item?.entryCount ?? item?.count ?? 0,
          averageCost:
            item?.averageCost !== undefined
              ? item.averageCost
              : item?.avgCost ?? null,
          companyCount: item?.companyCount ?? 0,
          averageCostPerKm:
            item?.averageCostPerKm !== undefined
              ? item.averageCostPerKm
              : item?.avgCostPerKm ?? null,
          distanceCoverage: item?.distanceCoverage ?? null,
          timestamp,
          type,
          startTimestamp: Number.isFinite(startTimestamp)
            ? startTimestamp
            : timestamp,
          endTimestamp: Number.isFinite(endTimestamp)
            ? endTimestamp
            : timestamp
        };
      })
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [trendDataMap, trendGranularity]);

  const timeTrendMetrics = useMemo(() => {
    if (timeTrendSeries.length === 0) {
      return {
        latest: null,
        previous: null,
        maxEntryCount: 0,
        maxAverageCost: 0
      };
    }
    const maxEntryCount = Math.max(
      ...timeTrendSeries.map((item) => item.entryCount || 0)
    );
    const maxAverageCost = Math.max(
      ...timeTrendSeries.map((item) => item.averageCost || 0)
    );
    const latest = timeTrendSeries[timeTrendSeries.length - 1];
    const previous =
      timeTrendSeries.length > 1
        ? timeTrendSeries[timeTrendSeries.length - 2]
        : null;

    return {
      latest,
      previous,
      maxEntryCount,
      maxAverageCost
    };
  }, [timeTrendSeries]);

  const trendCostAxisMax =
    timeTrendMetrics.maxAverageCost > 0
      ? Math.ceil(timeTrendMetrics.maxAverageCost * 1.2)
      : null;
  const trendEntryAxisMax =
    timeTrendMetrics.maxEntryCount > 0
      ? Math.ceil(timeTrendMetrics.maxEntryCount * 1.2)
      : null;

  const latestTrend = timeTrendMetrics.latest;
  const previousTrend = timeTrendMetrics.previous;
  const entryDelta =
    latestTrend && previousTrend
      ? (latestTrend.entryCount || 0) - (previousTrend.entryCount || 0)
      : null;
  const costDelta =
    latestTrend &&
      previousTrend &&
      latestTrend.averageCost !== null &&
      previousTrend.averageCost !== null
      ? latestTrend.averageCost - previousTrend.averageCost
      : null;
  const trendDescription =
    trendGranularity === 'weekly'
      ? '주별 등록 건수와 평균 비용 변화를 한눈에 확인하세요.'
      : '월별 등록 건수와 평균 비용 변화를 한눈에 확인하세요.';
  const comparisonLabel = trendGranularity === 'weekly' ? '전주' : '전월';
  const latestLabelPrefix = trendGranularity === 'weekly' ? '최근 주' : '최근 월';
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

  const handleTrendGranularityChange = (_event, next) => {
    if (next && next !== trendGranularity) {
      setTrendGranularity(next);
    }
  };

  const performFetchHistory = useCallback(
    async (options = {}) => {
      const { silent = false } = options;
      const fromInputTrim = (historyFilters.fromInput || '').trim();
      const toInputTrim = (historyFilters.toInput || '').trim();
      const fromId = resolveStoreIdForFetch(
        historySearchMode.from,
        historySelection.from,
        historyFilters.fromInput
      );
      const toId = resolveStoreIdForFetch(
        historySearchMode.to,
        historySelection.to,
        historyFilters.toInput
      );

      if (!fromId || !toId) {
        let message = '출발/도착 매장 정보를 모두 선택하거나 입력해주세요.';
        if (!fromId && historySearchMode.from === 'name' && fromInputTrim) {
          message =
            '입력한 출발 매장명을 찾을 수 없습니다. 목록에서 선택해주세요.';
        } else if (!toId && historySearchMode.to === 'name' && toInputTrim) {
          message =
            '입력한 도착 매장명을 찾을 수 없습니다. 목록에서 선택해주세요.';
        }
        setHistoryError(message);
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
    [
      historyFilters.fromInput,
      historyFilters.toInput,
      historySearchMode,
      historySelection,
      resolveStoreIdForFetch
    ]
  );

  const getHistoryInputKey = useCallback(
    (field) => (field === 'from' ? 'fromInput' : 'toInput'),
    []
  );

  const handleHistoryModeChange = useCallback(
    (field) => (_event, newMode) => {
      if (!newMode) return;
      setHistorySearchMode((prev) => ({
        ...prev,
        [field]: newMode
      }));
      const inputKey = getHistoryInputKey(field);
      setHistoryFilters((prev) => ({
        ...prev,
        [inputKey]: ''
      }));
      setHistorySelection((prev) => ({
        ...prev,
        [field]: null
      }));
      setHistoryError(null);
      setHistorySuccessMessage('');
    },
    [getHistoryInputKey]
  );

  const handleHistorySelectionChange = useCallback(
    (field) => (_event, newValue) => {
      const inputKey = getHistoryInputKey(field);
      setHistorySelection((prev) => ({
        ...prev,
        [field]: newValue
      }));
      if (newValue) {
        setHistoryFilters((prev) => ({
          ...prev,
          [inputKey]:
            historySearchMode[field] === 'id'
              ? newValue.id || ''
              : newValue.name || ''
        }));
      } else {
        setHistoryFilters((prev) => ({
          ...prev,
          [inputKey]: ''
        }));
      }
      setHistoryError(null);
      setHistorySuccessMessage('');
    },
    [getHistoryInputKey, historySearchMode]
  );

  const handleHistoryInputChange = useCallback(
    (field) => (_event, newValue, reason) => {
      const inputKey = getHistoryInputKey(field);
      setHistoryFilters((prev) => ({
        ...prev,
        [inputKey]: newValue || ''
      }));
      if (reason === 'input' || reason === 'clear') {
        setHistorySelection((prev) => ({
          ...prev,
          [field]: null
        }));
      }
      setHistoryError(null);
      setHistorySuccessMessage('');
    },
    [getHistoryInputKey]
  );

  const handleHistoryReset = () => {
    setHistoryFilters({ fromInput: '', toInput: '' });
    setHistoryData([]);
    setHistoryFetched(false);
    setHistoryError(null);
    setHistorySuccessMessage('');
    setHistorySelection({ from: null, to: null });
    setHistorySearchMode({ from: 'id', to: 'id' });
    setShowCreateModal(false);
    setCreateModalStores({ from: null, to: null });
  };

  const handleFetchHistoryClick = () => {
    performFetchHistory();
  };

  const buildStoreInfo = useCallback(
    (id, fallbackName = '') => {
      if (!id) return null;
      const matched =
        historySelection.from?.id === id
          ? historySelection.from
          : historySelection.to?.id === id
            ? historySelection.to
            : storeOptions.find((store) => store.id === id);
      if (matched) {
        return { id: matched.id, name: matched.name };
      }
      return { id, name: fallbackName || id };
    },
    [historySelection.from, historySelection.to, storeOptions]
  );

  const handleOpenCreateModal = () => {
    const fromId = resolveStoreIdForFetch(
      historySearchMode.from,
      historySelection.from,
      historyFilters.fromInput
    );
    const toId = resolveStoreIdForFetch(
      historySearchMode.to,
      historySelection.to,
      historyFilters.toInput
    );

    const fromInputTrim = historyFilters.fromInput.trim();
    const toInputTrim = historyFilters.toInput.trim();

    if (!fromId || !toId) {
      let message = '신규 등록을 위해 출발/도착 매장을 모두 지정해주세요.';
      if (!fromId && historySearchMode.from === 'name' && fromInputTrim) {
        message = '출발 매장명을 목록에서 선택하거나 정확히 입력해주세요.';
      } else if (!toId && historySearchMode.to === 'name' && toInputTrim) {
        message = '도착 매장명을 목록에서 선택하거나 정확히 입력해주세요.';
      }
      setHistoryError(message);
      setHistorySuccessMessage('');
      return;
    }

    const fromStoreInfo = buildStoreInfo(
      fromId,
      historySearchMode.from === 'name' ? fromInputTrim : ''
    );
    const toStoreInfo = buildStoreInfo(
      toId,
      historySearchMode.to === 'name' ? toInputTrim : ''
    );

    if (!fromStoreInfo || !toStoreInfo) {
      setHistoryError('선택한 매장 정보를 찾을 수 없습니다.');
      setHistorySuccessMessage('');
      return;
    }

    setCreateModalStores({ from: fromStoreInfo, to: toStoreInfo });
    setHistoryError(null);
    setHistorySuccessMessage('');
    setShowCreateModal(true);
  };

  const handleEditEntry = (entry) => {
    if (!entry) return;
    setHistoryError(null);
    setHistorySuccessMessage('');
    const fromStore = entry.fromStoreId
      ? {
        id: entry.fromStoreId,
        name: entry.fromStoreName || entry.fromStoreId
      }
      : null;
    const toStore = entry.toStoreId
      ? {
        id: entry.toStoreId,
        name: entry.toStoreName || entry.toStoreId
      }
      : null;
    setHistorySelection((prev) => ({
      ...prev,
      from: fromStore,
      to: toStore
    }));
    setHistoryFilters((prev) => ({
      ...prev,
      fromInput:
        historySearchMode.from === 'name'
          ? fromStore?.name || ''
          : fromStore?.id || '',
      toInput:
        historySearchMode.to === 'name'
          ? toStore?.name || ''
          : toStore?.id || ''
    }));
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

  const handleCreateModalClose = (result) => {
    setShowCreateModal(false);
    if (result === true) {
      setHistorySuccessMessage('새 퀵비용 데이터가 등록되었습니다.');
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

  const regionAggregates = useMemo(
    () =>
      Array.isArray(statistics.regionAggregates)
        ? statistics.regionAggregates
        : [],
    [statistics.regionAggregates]
  );

  const distanceCostAnalysis = useMemo(
    () =>
      Array.isArray(statistics.distanceCostAnalysis)
        ? statistics.distanceCostAnalysis
        : [],
    [statistics.distanceCostAnalysis]
  );

  const hasDistanceAnalysis = useMemo(
    () => distanceCostAnalysis.some((bucket) => (bucket?.count || 0) > 0),
    [distanceCostAnalysis]
  );

  const mapData = useMemo(() => {
    const list = [];

    if (mapMetric === 'popular' || mapMetric === 'excellent') {
      Object.values(aggregatedRegionMetrics).forEach((metric) => {
        const coords =
          CITY_COORDINATES[metric.region] ||
          REGION_COORDINATES[metric.region] ||
          REGION_COORDINATES.기타;

        if (mapMetric === 'popular' && metric.popularEntries > 0) {
          const top = metric.popularTopCompany;
          list.push({
            key: `${metric.region}-popular`,
            type: 'company',
            region: metric.region,
            coords,
            value: metric.popularEntries,
            label: `${metric.popularEntries.toLocaleString()}건`,
            topCompany: top
              ? {
                name: top.companyName,
                phone: top.phoneNumber
              }
              : null
          });
        }

        if (mapMetric === 'excellent' && metric.excellentEntries > 0) {
          const top = metric.excellentTopCompany;
          list.push({
            key: `${metric.region}-excellent`,
            type: 'company',
            region: metric.region,
            coords,
            value: metric.averageSpeedScoreAvg,
            label: `${metric.averageSpeedScoreAvg?.toFixed(2)}점`,
            entryCount: metric.excellentEntries,
            topCompany: top
              ? {
                name: top.companyName,
                phone: top.phoneNumber
              }
              : null
          });
        }
      });

      return list;
    }

    regionAggregates.forEach((regionMetric) => {
      const coords =
        REGION_COORDINATES[regionMetric.region] ||
        CITY_COORDINATES[regionMetric.region] ||
        REGION_COORDINATES.기타;
      const baseData = {
        key: `${regionMetric.region}-${mapMetric}`,
        type: 'region',
        region: regionMetric.region,
        coords,
        totalEntries: regionMetric.totalEntries,
        companyCount: regionMetric.companyCount,
        averageCost: regionMetric.averageCost,
        averageDistance: regionMetric.averageDistance,
        averageCostPerKm: regionMetric.averageCostPerKm,
        distanceCoverage: regionMetric.distanceCoverage
      };

      let value = null;
      let label = '';

      switch (mapMetric) {
        case 'volume': {
          value = regionMetric.totalEntries;
          label = value ? `${value.toLocaleString()}건` : '-';
          break;
        }
        case 'avgCost': {
          value = regionMetric.averageCost;
          label = value ? `${value.toLocaleString()}원` : '-';
          break;
        }
        case 'avgDistance': {
          value = regionMetric.averageDistance;
          label = value ? `${value.toLocaleString()}km` : '-';
          break;
        }
        case 'costPerKm': {
          value = regionMetric.averageCostPerKm;
          label = value ? `${value.toLocaleString()}원/km` : '-';
          break;
        }
        default:
          break;
      }

      if (
        value === null ||
        value === undefined ||
        Number.isNaN(value) ||
        (mapMetric === 'volume' && value <= 0)
      ) {
        return;
      }

      list.push({
        ...baseData,
        value,
        label
      });
    });

    return list;
  }, [aggregatedRegionMetrics, mapMetric, regionAggregates]);

  const isRegionMetric = useMemo(
    () => REGION_METRIC_KEYS.has(mapMetric),
    [mapMetric]
  );

  const mapIntensityRange = useMemo(() => {
    if (mapData.length === 0) return { min: 0, max: 0 };
    const values = mapData
      .map((item) => item.value)
      .filter((value) => typeof value === 'number' && !Number.isNaN(value));
    if (values.length === 0) return { min: 0, max: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: 0, max: 0 };
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
        {/* 어플종합관리 3단 탭 */}
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', px: 2 }}>
          <Tabs
            value={currentTab}
            onChange={(_e, v) => setCurrentTab(v)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{
              '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)', minHeight: 48 },
              '& .Mui-selected': { color: '#fff', fontWeight: 'bold' },
              '& .MuiTabs-indicator': { backgroundColor: '#fff' }
            }}
          >
            <Tab label="퀵서비스관리" value="quickService" />
            <Tab label="데이터베이스관리" value="database" />
            <Tab label="버그관리" value="bugs" />
          </Tabs>
        </Box>
      </AppBar>

      <Container sx={{ py: 4 }}>
        {currentTab === 'quickService' && (
          <Box id="quick-service-section">
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
            </Grid>

            <Grid container spacing={3}>
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
                              지역 분포 시각화
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {isRegionMetric
                                ? '등록 건수·평균 비용·평균 거리 등 핵심 지표를 열지도 스타일로 확인할 수 있습니다.'
                                : '지역별 인기/우수 업체 TOP 데이터를 지도에서 확인할 수 있습니다.'}
                            </Typography>
                          </Stack>
                          <ToggleButtonGroup
                            size="small"
                            value={mapMetric}
                            exclusive
                            onChange={handleMapMetricChange}
                            sx={{
                              flexWrap: 'wrap',
                              gap: 0.5,
                              '& .MuiToggleButton-root': {
                                flex: '0 0 auto'
                              }
                            }}
                          >
                            <ToggleButton value="popular">인기 업체</ToggleButton>
                            <ToggleButton value="excellent">우수 업체</ToggleButton>
                            <ToggleButton value="volume">등록 건수</ToggleButton>
                            <ToggleButton value="avgCost">평균 비용</ToggleButton>
                            <ToggleButton value="avgDistance">평균 거리</ToggleButton>
                            <ToggleButton value="costPerKm">km당 비용</ToggleButton>
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
                                const valueRange =
                                  mapIntensityRange.max - mapIntensityRange.min || 1;
                                const normalized =
                                  valueRange === 0
                                    ? 0.5
                                    : (item.value - mapIntensityRange.min) /
                                    valueRange;

                                if (item.type === 'company') {
                                  const color =
                                    mapMetric === 'popular' ? '#ff7043' : '#4caf50';
                                  const radius =
                                    mapMetric === 'popular'
                                      ? 10000 + normalized * 25000
                                      : 8000 + normalized * 20000;
                                  return (
                                    <CircleMarker
                                      key={item.key}
                                      center={[item.coords.lat, item.coords.lng]}
                                      radius={Math.max(radius / 4000, 8)}
                                      pathOptions={{
                                        color,
                                        fillColor: color,
                                        fillOpacity: 0.4,
                                        weight: 2
                                      }}
                                    >
                                      <LeafletTooltip direction="top" offset={[0, -2]}>
                                        <div style={{ minWidth: 180 }}>
                                          <strong>{item.region}</strong>
                                          <br />
                                          {mapMetric === 'popular'
                                            ? `등록 건수: ${item.label}`
                                            : `평균 속도 점수: ${item.label}`}
                                          <br />
                                          {item.topCompany
                                            ? `${item.topCompany.name} (${item.topCompany.phone || '-'})`
                                            : '상위 업체 정보 없음'}
                                          {mapMetric === 'excellent' && item.entryCount && (
                                            <>
                                              <br />
                                              등록 건수: {item.entryCount.toLocaleString()}건
                                            </>
                                          )}
                                        </div>
                                      </LeafletTooltip>
                                    </CircleMarker>
                                  );
                                }

                                const color = getGradientColor(
                                  mapMetric,
                                  item.value,
                                  mapIntensityRange.min,
                                  mapIntensityRange.max
                                );
                                const radiusMeters = 25000 + normalized * 80000;

                                return (
                                  <Circle
                                    key={item.key}
                                    center={[item.coords.lat, item.coords.lng]}
                                    radius={Math.max(radiusMeters, 15000)}
                                    pathOptions={{
                                      color,
                                      fillColor: color,
                                      fillOpacity: 0.35,
                                      weight: 1.5
                                    }}
                                  >
                                    <LeafletTooltip direction="top" offset={[0, -4]}>
                                      <div style={{ minWidth: 190 }}>
                                        <strong>{item.region}</strong>
                                        <br />
                                        {mapMetric === 'volume' && (
                                          <>
                                            등록 건수: {item.totalEntries?.toLocaleString()}건
                                            <br />
                                            업체 수: {item.companyCount?.toLocaleString()}곳
                                            <br />
                                            평균 비용:{' '}
                                            {item.averageCost
                                              ? `${item.averageCost.toLocaleString()}원`
                                              : '-'}
                                            <br />
                                            평균 거리:{' '}
                                            {item.averageDistance
                                              ? `${item.averageDistance.toLocaleString()}km`
                                              : '-'}
                                            <br />
                                            거리 데이터 커버리지:{' '}
                                            {item.distanceCoverage ?? 0}%
                                          </>
                                        )}
                                        {mapMetric === 'avgCost' && (
                                          <>
                                            평균 비용: {item.label}
                                            <br />
                                            등록 건수:{' '}
                                            {item.totalEntries?.toLocaleString()}건
                                            <br />
                                            업체 수:{' '}
                                            {item.companyCount?.toLocaleString()}곳
                                          </>
                                        )}
                                        {mapMetric === 'avgDistance' && (
                                          <>
                                            평균 거리: {item.label}
                                            <br />
                                            km당 비용:{' '}
                                            {item.averageCostPerKm
                                              ? `${item.averageCostPerKm.toLocaleString()}원/km`
                                              : '-'}
                                            <br />
                                            거리 데이터 커버리지:{' '}
                                            {item.distanceCoverage ?? 0}%
                                          </>
                                        )}
                                        {mapMetric === 'costPerKm' && (
                                          <>
                                            평균 km당 비용: {item.label}
                                            <br />
                                            평균 비용:{' '}
                                            {item.averageCost
                                              ? `${item.averageCost.toLocaleString()}원`
                                              : '-'}
                                            <br />
                                            평균 거리:{' '}
                                            {item.averageDistance
                                              ? `${item.averageDistance.toLocaleString()}km`
                                              : '-'}
                                          </>
                                        )}
                                      </div>
                                    </LeafletTooltip>
                                  </Circle>
                                );
                              })}
                            </MapContainer>
                          )}
                        </Box>
                      </Paper>
                    </Grid>

                    {hasDistanceAnalysis && (
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
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                              alignItems={{ xs: 'flex-start', sm: 'center' }}
                              justifyContent="space-between"
                            >
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                거리대별 비용 분석
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                위경도 좌표가 있는 구간만 집계되며, 각 구간의 평균 비용과 km당 비용을
                                제공합니다.
                              </Typography>
                            </Stack>
                          </Box>
                          <Box sx={{ px: 3, py: 2 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600 }}>거리 구간</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    등록 건수
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    평균 비용
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 600 }} align="right">
                                    평균 km당 비용
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {distanceCostAnalysis.map((bucket) => (
                                  <TableRow key={bucket.label}>
                                    <TableCell>{bucket.label}</TableCell>
                                    <TableCell align="right">
                                      {bucket.count?.toLocaleString() || 0}
                                    </TableCell>
                                    <TableCell align="right">
                                      {bucket.averageCost
                                        ? `${bucket.averageCost.toLocaleString()}원`
                                        : '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                      {bucket.averageCostPerKm
                                        ? `${bucket.averageCostPerKm.toLocaleString()}원/km`
                                        : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </Paper>
                      </Grid>
                    )}

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

                    {/* 최근 등록 추이 */}
                    <Grid item xs={12}>
                      <Paper
                        elevation={2}
                        sx={{ borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                      >
                        <Box
                          sx={{
                            px: 3,
                            py: 2,
                            borderBottom: '1px solid rgba(0,0,0,0.08)',
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: 1.5,
                            justifyContent: 'space-between'
                          }}
                        >
                          <Stack spacing={0.5}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                              최근 등록 추이
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {trendDescription}
                            </Typography>
                          </Stack>
                          <Stack
                            spacing={1}
                            alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                          >
                            <ToggleButtonGroup
                              size="small"
                              value={trendGranularity}
                              exclusive
                              onChange={handleTrendGranularityChange}
                              sx={{ alignSelf: { xs: 'stretch', sm: 'flex-end' } }}
                            >
                              {TREND_OPTIONS.map((option) => {
                                const disabled =
                                  !Array.isArray(trendDataMap[option.key]) ||
                                  trendDataMap[option.key].length === 0;
                                return (
                                  <ToggleButton
                                    key={option.key}
                                    value={option.key}
                                    disabled={disabled}
                                  >
                                    {option.label}
                                  </ToggleButton>
                                );
                              })}
                            </ToggleButtonGroup>
                            {latestTrend && (
                              <Stack spacing={0.5}>
                                <Stack
                                  direction={{ xs: 'column', sm: 'row' }}
                                  spacing={1.5}
                                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                                >
                                  <Chip
                                    size="small"
                                    color="primary"
                                    label={`${latestLabelPrefix} ${latestTrend.displayLabel}`}
                                    sx={{ fontWeight: 600 }}
                                  />
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    등록 {formatNumberWithUnit(latestTrend.entryCount, '건')} · 평균 비용{' '}
                                    {latestTrend.averageCost !== null
                                      ? `${latestTrend.averageCost.toLocaleString()}원`
                                      : '-'}
                                  </Typography>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  {comparisonLabel} 대비 등록{' '}
                                  {entryDelta !== null
                                    ? formatTrendDelta(entryDelta, '건')
                                    : '비교 데이터 없음'}{' '}
                                  · 평균 비용{' '}
                                  {costDelta !== null
                                    ? formatTrendDelta(costDelta, '원')
                                    : '비교 데이터 없음'}
                                </Typography>
                              </Stack>
                            )}
                          </Stack>
                        </Box>
                        <Box sx={{ px: 2.5, py: 3, height: 340 }}>
                          {timeTrendSeries.length === 0 ? (
                            <Stack
                              sx={{ height: '100%' }}
                              alignItems="center"
                              justifyContent="center"
                              spacing={1.5}
                              color="text.secondary"
                            >
                              <MapOutlinedIcon fontSize="large" />
                              <Typography variant="body2">
                                추이를 분석할 데이터가 부족합니다.
                              </Typography>
                            </Stack>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart
                                data={timeTrendSeries}
                                margin={{ top: 8, right: 24, bottom: 12, left: 8 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="displayLabel" />
                                <YAxis
                                  yAxisId="left"
                                  orientation="left"
                                  tickFormatter={(value) =>
                                    value ? `${value.toLocaleString()}원` : '0원'
                                  }
                                  domain={[0, trendCostAxisMax || 'auto']}
                                />
                                <YAxis
                                  yAxisId="right"
                                  orientation="right"
                                  tickFormatter={(value) =>
                                    value ? `${value.toLocaleString()}건` : '0건'
                                  }
                                  domain={[0, trendEntryAxisMax || 'auto']}
                                />
                                <RechartsTooltip
                                  formatter={(value, name) => {
                                    if (name === '평균 비용') {
                                      return [
                                        typeof value === 'number'
                                          ? `${value.toLocaleString()}원`
                                          : '-',
                                        name
                                      ];
                                    }
                                    if (name === '등록 건수') {
                                      return [
                                        typeof value === 'number'
                                          ? `${value.toLocaleString()}건`
                                          : '-',
                                        name
                                      ];
                                    }
                                    return [value, name];
                                  }}
                                  labelFormatter={(label, payload) => {
                                    const item = payload?.[0]?.payload;
                                    if (item) {
                                      const range = formatDateRange(
                                        item.startTimestamp,
                                        item.endTimestamp
                                      );
                                      if (range) {
                                        return `기간: ${range}`;
                                      }
                                      if (item.displayLabel) {
                                        return `기간: ${item.displayLabel}`;
                                      }
                                    }
                                    return `기간: ${label}`;
                                  }}
                                />
                                <Legend />
                                <Bar
                                  yAxisId="right"
                                  dataKey="entryCount"
                                  name="등록 건수"
                                  fill="#90caf9"
                                  radius={[6, 6, 0, 0]}
                                />
                                <Line
                                  yAxisId="left"
                                  type="monotone"
                                  dataKey="averageCost"
                                  name="평균 비용"
                                  stroke="#ff7043"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          )}
                        </Box>
                      </Paper>
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
                                    label={
                                      quality.duplicateRate === null ||
                                        quality.duplicateRate === undefined
                                        ? '-'
                                        : `${quality.duplicateRate.toFixed(2)}%`
                                    }
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
                                variant="outlined"
                                startIcon={<AddCircleOutlineIcon />}
                                onClick={handleOpenCreateModal}
                                disabled={historyLoading || storeOptionsLoading}
                              >
                                신규 등록
                              </Button>
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
                          <Grid container spacing={2} alignItems="flex-start">
                            <Grid item xs={12} md={6} lg={4}>
                              <Stack spacing={1.5}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    출발 매장 찾기
                                  </Typography>
                                  <ToggleButtonGroup
                                    size="small"
                                    value={historySearchMode.from}
                                    exclusive
                                    onChange={handleHistoryModeChange('from')}
                                  >
                                    <ToggleButton value="id">ID</ToggleButton>
                                    <ToggleButton value="name">매장명</ToggleButton>
                                  </ToggleButtonGroup>
                                </Stack>
                                <Autocomplete
                                  freeSolo
                                  options={storeOptions}
                                  loading={storeOptionsLoading}
                                  filterOptions={storeFilterOptions}
                                  loadingText="매장 목록을 불러오는 중입니다..."
                                  noOptionsText="일치하는 매장을 찾을 수 없습니다."
                                  value={historySelection.from}
                                  onChange={handleHistorySelectionChange('from')}
                                  inputValue={historyFilters.fromInput}
                                  onInputChange={handleHistoryInputChange('from')}
                                  getOptionLabel={(option) => {
                                    if (typeof option === 'string') return option;
                                    if (!option) return '';
                                    return historySearchMode.from === 'id'
                                      ? option.id || ''
                                      : option.name || '';
                                  }}
                                  renderOption={(props, option) => (
                                    <li {...props} key={option.uniqueId || option.id}>
                                      <Stack spacing={0.25}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                          {option.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {option.id}
                                        </Typography>
                                      </Stack>
                                    </li>
                                  )}
                                  isOptionEqualToValue={(option, value) =>
                                    option?.id === (value?.id || value)
                                  }
                                  ListboxProps={{ style: { maxHeight: 320 } }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label={
                                        historySearchMode.from === 'id'
                                          ? '출발 매장 ID'
                                          : '출발 매장명'
                                      }
                                      size="small"
                                      placeholder={
                                        historySearchMode.from === 'id'
                                          ? '예: P123456'
                                          : '예: 정직폰강서점'
                                      }
                                    />
                                  )}
                                />
                              </Stack>
                            </Grid>
                            <Grid item xs={12} md={6} lg={4}>
                              <Stack spacing={1.5}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    도착 매장 찾기
                                  </Typography>
                                  <ToggleButtonGroup
                                    size="small"
                                    value={historySearchMode.to}
                                    exclusive
                                    onChange={handleHistoryModeChange('to')}
                                  >
                                    <ToggleButton value="id">ID</ToggleButton>
                                    <ToggleButton value="name">매장명</ToggleButton>
                                  </ToggleButtonGroup>
                                </Stack>
                                <Autocomplete
                                  freeSolo
                                  options={storeOptions}
                                  loading={storeOptionsLoading}
                                  filterOptions={storeFilterOptions}
                                  loadingText="매장 목록을 불러오는 중입니다..."
                                  noOptionsText="일치하는 매장을 찾을 수 없습니다."
                                  value={historySelection.to}
                                  onChange={handleHistorySelectionChange('to')}
                                  inputValue={historyFilters.toInput}
                                  onInputChange={handleHistoryInputChange('to')}
                                  getOptionLabel={(option) => {
                                    if (typeof option === 'string') return option;
                                    if (!option) return '';
                                    return historySearchMode.to === 'id'
                                      ? option.id || ''
                                      : option.name || '';
                                  }}
                                  renderOption={(props, option) => (
                                    <li {...props} key={option.uniqueId || option.id}>
                                      <Stack spacing={0.25}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                          {option.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {option.id}
                                        </Typography>
                                      </Stack>
                                    </li>
                                  )}
                                  isOptionEqualToValue={(option, value) =>
                                    option?.id === (value?.id || value)
                                  }
                                  ListboxProps={{ style: { maxHeight: 320 } }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label={
                                        historySearchMode.to === 'id'
                                          ? '도착 매장 ID'
                                          : '도착 매장명'
                                      }
                                      size="small"
                                      placeholder={
                                        historySearchMode.to === 'id'
                                          ? '예: P654321'
                                          : '예: 신윤티엔에스'
                                      }
                                    />
                                  )}
                                />
                              </Stack>
                            </Grid>
                            <Grid item xs={12} lg={4}>
                              <Typography variant="body2" color="text.secondary">
                                매장 ID 또는 매장명을 선택해 출발/도착 매장을 지정한 뒤 조회를 눌러 등록된
                                퀵비용 데이터를 수정하거나 삭제할 수 있습니다. 한 글자만 입력해도 목록에서
                                빠르게 검색할 수 있습니다.
                              </Typography>
                            </Grid>
                          </Grid>

                          {storeOptionsError && (
                            <Box sx={{ mt: 2 }}>
                              <Alert severity="warning">{storeOptionsError}</Alert>
                            </Box>
                          )}

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
                                  : '출발/도착 매장을 선택하거나 입력한 뒤 조회를 눌러주세요.'}
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
          </Box>
        )}

        {currentTab === 'database' && (
          <Box sx={{ p: 3 }}>
            <DataSourceDashboard />
          </Box>
        )}

        {currentTab === 'bugs' && (
          <Box sx={{ p: 3 }}>
            <BugDiagnosticDashboard />
          </Box>
        )}
      </Container>

      <QuickCostModal
        open={showCreateModal}
        onClose={handleCreateModalClose}
        loggedInStore={loggedInStore}
        fromStore={createModalStores.from}
        toStore={createModalStores.to}
        modeType="관리자모드"
      />

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
