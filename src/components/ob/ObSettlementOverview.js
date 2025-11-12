import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { keyframes } from '@emotion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../../api';

const currencyFormatter = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat('ko-KR');

const glowAnimation = keyframes`
  0% {
    box-shadow: 0 0 0 rgba(94, 53, 177, 0);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 18px 30px rgba(94, 53, 177, 0.28);
    transform: scale(1.008);
  }
  100% {
    box-shadow: 0 0 0 rgba(94, 53, 177, 0);
    transform: scale(1);
  }
`;

const COMPANY_LABELS = {
  vip: '(주)브이아이피플러스',
  yai: '(주)와이에이'
};

const createCompanyWorkflowState = () => ({
  completed: false,
  bankName: '',
  accountNumber: '',
  isSaved: false,
  editing: true,
  depositDone: false,
  confirmDone: false
});

const parseManualAmount = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    return Number(trimmed.replace(/,/g, ''));
  }
  return Number(value);
};

const CUSTOM_COLUMNS = [
  { key: 'sourceSheet', label: '시트' },
  { key: 'rowNumber', label: '행번호' },
  { key: 'proposerId', label: '유치자ID' },
  { key: 'proposerName', label: '유치자명' },
  { key: 'salesAmount', label: '당월 맞춤제안 매출' },
  { key: 'themeFlag', label: '테마 업셀' },
  { key: 'approvalFlag', label: '맞춤제안 인정' }
];

const RECONTRACT_COLUMNS = [
  { key: 'sourceSheet', label: '시트' },
  { key: 'rowNumber', label: '행번호' },
  { key: 'registrationDate', label: '등록일' },
  { key: 'outlet', label: '출고처' },
  { key: 'customerName', label: '고객명' },
  { key: 'internetUniqueNumber', label: '인터넷-고유번호' },
  { key: 'status', label: '상태' },
  { key: 'settlementAmount', label: '정산금액' },
  { key: 'remarkPlate', label: '동판-비고' },
  { key: 'remarkRecontract', label: '재약정-비고' },
  { key: 'offerGiftCard', label: '상품권 지급액' },
  { key: 'offerDeposit', label: '입금 지급액' },
  { key: 'promoterName', label: '유치자명' }
];

const SECTION_COLORS = {
  totals: '#F5F0FF',
  custom: '#F0F7FF',
  recontract: '#FFF5F0',
  laborCost: '#F6FBF0'
};

let xlsxLoaderPromise;

const loadXlsxLibrary = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('브라우저 환경에서만 XLSX 다운로드가 가능합니다.'));
  }
  if (window.XLSX) {
    return Promise.resolve(window.XLSX);
  }
  if (xlsxLoaderPromise) {
    return xlsxLoaderPromise;
  }
  xlsxLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.async = true;
    script.onload = () => {
      if (window.XLSX) {
        resolve(window.XLSX);
      } else {
        reject(new Error('XLSX 라이브러리를 불러오지 못했습니다.'));
      }
    };
    script.onerror = () => reject(new Error('XLSX 라이브러리를 불러오지 못했습니다.'));
    document.body.appendChild(script);
  });
  return xlsxLoaderPromise;
};

async function downloadXlsx(filename, columns, rows = []) {
  if (!rows || rows.length === 0) {
    throw new Error('내보낼 데이터가 없습니다.');
  }
  const XLSX = await loadXlsxLibrary();
  const worksheetData = rows.map((row) => {
    const result = {};
    columns.forEach((column) => {
      result[column.label] = row[column.key] ?? '';
    });
    return result;
  });
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '정산 데이터');
  XLSX.writeFile(workbook, filename);
}

const SummaryCard = ({ title, value, description, count, color, activated, animate, children }) => {
  const isActive = activated !== false;
  return (
  <Card
    sx={{
      height: '100%',
      transition: 'all 0.35s ease',
      opacity: isActive ? 1 : 0.45,
      filter: isActive ? 'none' : 'grayscale(0.2)',
      border: isActive ? '1px solid rgba(94,53,177,0.24)' : '1px solid rgba(0,0,0,0.08)',
      boxShadow: isActive ? '0 16px 32px rgba(94,53,177,0.25)' : 'none',
      animation: animate ? `${glowAnimation} 1.2s ease-in-out` : 'none',
      '&:hover': isActive
        ? {
            transform: 'translateY(-4px)',
            boxShadow: '0 22px 38px rgba(94,53,177,0.32)'
          }
        : {}
    }}
  >
    <CardContent>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color || 'text.primary', mb: 0.5 }}>
        {value}
      </Typography>
      {count ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {count}
        </Typography>
      ) : null}
      {description ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {description}
        </Typography>
      ) : null}
      {children ? <Box sx={{ mt: 2 }}>{children}</Box> : null}
    </CardContent>
  </Card>
  );
};

SummaryCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  description: PropTypes.string,
  count: PropTypes.string,
  color: PropTypes.string,
  activated: PropTypes.bool,
  animate: PropTypes.bool,
  children: PropTypes.node
};

SummaryCard.defaultProps = {
  description: '',
  count: '',
  color: undefined,
  activated: true,
  animate: false,
  children: null
};

const StepLabel = ({ step, title, description, active }) => (
  <Box sx={{ ml: 0.5 }}>
    <Typography
      variant="caption"
      sx={{
        fontWeight: 700,
        color: active ? 'primary.main' : 'text.secondary',
        letterSpacing: 0.4,
        display: 'block'
      }}
    >
      STEP {step}
    </Typography>
    <Typography
      variant="subtitle2"
      sx={{
        fontWeight: active ? 700 : 500,
        color: active ? 'primary.main' : 'text.primary',
        mb: 0.3
      }}
    >
      {title}
    </Typography>
    {description ? (
      <Typography
        variant="caption"
        sx={{
          color: active ? 'primary.main' : 'text.secondary',
          display: 'block',
          lineHeight: 1.4
        }}
      >
        {description}
      </Typography>
    ) : null}
  </Box>
);

StepLabel.propTypes = {
  step: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  active: PropTypes.bool
};

StepLabel.defaultProps = {
  description: '',
  active: false
};

const getStepBoxStyles = (active) => ({
  padding: '12px 14px',
  borderRadius: 1.5,
  border: active ? '1px solid rgba(94,53,177,0.35)' : '1px dashed rgba(0,0,0,0.18)',
  backgroundColor: active ? 'rgba(94,53,177,0.08)' : 'rgba(0,0,0,0.02)',
  transition: 'all 0.3s ease'
});

const parseCompanyProgressState = (data = {}) => ({
  completed: Boolean(data.completed),
  bankName: data.bankName || '',
  accountNumber: data.accountNumber || '',
  isSaved: Boolean(data.isSaved),
  depositDone: Boolean(data.depositDone),
  confirmDone: Boolean(data.confirmDone)
});

const hydrateCompanyWorkflowState = (data = {}) => {
  const parsed = parseCompanyProgressState(data);
  return {
    ...createCompanyWorkflowState(),
    ...parsed,
    editing: !parsed.isSaved
  };
};

const buildProgressPayload = (invoiceState = {}, workflowState = {}) => ({
  invoice: {
    issued: Boolean(invoiceState.issued),
    approved: Boolean(invoiceState.approved)
  },
  companies: {
    vip: parseCompanyProgressState(workflowState.vip),
    yai: parseCompanyProgressState(workflowState.yai)
  }
});

const Section = ({ title, subtitle, color, children, spacing, collapsible = false, expanded = false, onToggle }) => (
  <Paper
    elevation={0}
    sx={{
      p: 3,
      borderRadius: 3,
      backgroundColor: color,
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}
  >
    <Stack spacing={spacing ?? 3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {collapsible && (
          <IconButton
            size="small"
            onClick={onToggle}
            sx={{ ml: 1 }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
      </Box>
      {collapsible ? (
        <Collapse in={expanded}>
          {children}
        </Collapse>
      ) : (
        children
      )}
    </Stack>
  </Paper>
);

Section.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  color: PropTypes.string,
  children: PropTypes.node,
  spacing: PropTypes.number,
  collapsible: PropTypes.bool,
  expanded: PropTypes.bool,
  onToggle: PropTypes.func
};

Section.defaultProps = {
  subtitle: '',
  color: '#fff',
  children: null,
  spacing: 3
};

const ObSettlementOverview = ({ sheetConfigs, currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [laborEntries, setLaborEntries] = useState([]);
  const [costEntries, setCostEntries] = useState([]);
  const [laborForm, setLaborForm] = useState({ label: '', amount: '' });
  const [costForm, setCostForm] = useState({ label: '', amount: '' });
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [editingLaborId, setEditingLaborId] = useState(null);
  const [editingLaborForm, setEditingLaborForm] = useState({ label: '', amount: '' });
  const [editingCostId, setEditingCostId] = useState(null);
  const [editingCostForm, setEditingCostForm] = useState({ label: '', amount: '' });
  const [companyWorkflow, setCompanyWorkflow] = useState({
    vip: createCompanyWorkflowState(),
    yai: createCompanyWorkflowState()
  });
  const [invoiceStatus, setInvoiceStatus] = useState({ issued: false, approved: false });
  const [workflowError, setWorkflowError] = useState('');
  const [workflowSuccess, setWorkflowSuccess] = useState('');
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [finalSettlementExpanded, setFinalSettlementExpanded] = useState(false);
  const [customProposalExpanded, setCustomProposalExpanded] = useState(false);
  const [recontractExpanded, setRecontractExpanded] = useState(false);
  const [laborCostExpanded, setLaborCostExpanded] = useState(false);
  const invoiceStatusRef = useRef(invoiceStatus);
  const companyWorkflowRef = useRef(companyWorkflow);
  const isApplyingProgressRef = useRef(false);
  const autoCollapseAppliedRef = useRef(false);

  useEffect(() => {
    invoiceStatusRef.current = invoiceStatus;
  }, [invoiceStatus]);

  useEffect(() => {
    companyWorkflowRef.current = companyWorkflow;
  }, [companyWorkflow]);

  const vipConfirmDone = Boolean(companyWorkflow.vip?.confirmDone);
  const yaiConfirmDone = Boolean(companyWorkflow.yai?.confirmDone);

  useEffect(() => {
    if (vipConfirmDone && yaiConfirmDone) {
      if (!autoCollapseAppliedRef.current) {
        setSummaryExpanded(false);
        autoCollapseAppliedRef.current = true;
      }
    } else {
      autoCollapseAppliedRef.current = false;
      setSummaryExpanded(true);
    }
  }, [vipConfirmDone, yaiConfirmDone]);

  useEffect(() => {
    if (sheetConfigs && sheetConfigs.length > 0) {
      setSelectedMonth((prev) => prev || sheetConfigs[0].month);
    }
  }, [sheetConfigs]);

  useEffect(() => {
    const initialWorkflow = {
      vip: createCompanyWorkflowState(),
      yai: createCompanyWorkflowState()
    };
    const initialInvoice = { issued: false, approved: false };
    setCompanyWorkflow(initialWorkflow);
    companyWorkflowRef.current = initialWorkflow;
    setInvoiceStatus(initialInvoice);
    invoiceStatusRef.current = initialInvoice;
    setSummaryExpanded(true);
    autoCollapseAppliedRef.current = false;
    setWorkflowError('');
    setWorkflowSuccess('');
  }, [selectedMonth]);

  const loadManualEntries = useCallback(
    async (month) => {
      if (!month) {
        setLaborEntries([]);
        setCostEntries([]);
        return;
      }
      try {
        const convertAmount = (value) => {
          const parsed =
            typeof value === 'number' ? value : parseManualAmount(value);
          return Number.isFinite(parsed) ? parsed : 0;
        };
        const response = await api.getObManualAdjustments(month);
        if (response?.success) {
          const laborList = (response.data?.labor || []).map((entry) => ({
            ...entry,
            amount: convertAmount(entry.amount)
          }));
          const costList = (response.data?.cost || []).map((entry) => ({
            ...entry,
            amount: convertAmount(entry.amount)
          }));
          setLaborEntries(laborList);
          setCostEntries(costList);
          setManualError('');
        } else {
          setLaborEntries([]);
          setCostEntries([]);
          setManualError(response?.error || '수기 입력 데이터를 불러오지 못했습니다.');
        }
      } catch (err) {
        console.error('[OB] manual adjustments fetch error:', err);
        setLaborEntries([]);
        setCostEntries([]);
        setManualError(err.message || '수기 입력 데이터를 불러오지 못했습니다.');
      } finally {
        setEditingLaborId(null);
        setEditingLaborForm({ label: '', amount: '' });
        setEditingCostId(null);
        setEditingCostForm({ label: '', amount: '' });
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedMonth) return;
    setManualError('');
    setManualSuccess('');
    loadManualEntries(selectedMonth);
  }, [selectedMonth, loadManualEntries]);

  const applyProgress = useCallback((progressData) => {
    if (!progressData) {
      return;
    }
    isApplyingProgressRef.current = true;
    const nextInvoice = {
      issued: Boolean(progressData.invoice?.issued),
      approved: Boolean(progressData.invoice?.approved)
    };
    const nextWorkflow = {
      vip: hydrateCompanyWorkflowState(progressData.companies?.vip),
      yai: hydrateCompanyWorkflowState(progressData.companies?.yai)
    };
    setInvoiceStatus(nextInvoice);
    invoiceStatusRef.current = nextInvoice;
    setCompanyWorkflow(nextWorkflow);
    companyWorkflowRef.current = nextWorkflow;
    setWorkflowError('');
    setWorkflowSuccess('');
    window.setTimeout(() => {
      isApplyingProgressRef.current = false;
    }, 0);
  }, []);

  const persistProgress = useCallback(
    async (nextInvoiceState, nextWorkflowState, options = {}) => {
      if (!selectedMonth || isApplyingProgressRef.current) return;
      try {
        await api.saveObSettlementProgress({
          month: selectedMonth,
          progress: buildProgressPayload(nextInvoiceState, nextWorkflowState),
          registrant: currentUser || ''
        });
        if (options.showSuccess) {
          setWorkflowSuccess('진행상황을 저장했습니다.');
        }
      } catch (error) {
        console.error('[OB] progress save error:', error);
        setWorkflowError(error.message || '진행상황을 저장하지 못했습니다.');
      }
    },
    [selectedMonth, currentUser]
  );

  const monthOptions = useMemo(
    () => sheetConfigs.map((config) => ({ value: config.month, label: config.month })),
    [sheetConfigs]
  );

  const fetchSummary = useCallback(
    async (month) => {
      if (!month) return;
      setLoading(true);
      setError('');
      try {
        const response = await api.getObSettlementSummary(month);
        if (response?.success) {
          setSummary(response.data);
          applyProgress(response.data?.progress);
        } else {
          setSummary(null);
          setError(response?.error || '정산 데이터를 불러오지 못했습니다.');
        }
      } catch (err) {
        console.error('[OB] settlement summary fetch error:', err);
        setSummary(null);
        setError(err.message || '정산 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [applyProgress]
  );

  useEffect(() => {
    if (selectedMonth) {
      fetchSummary(selectedMonth);
    }
  }, [selectedMonth, fetchSummary]);

  const manualLaborTotal = useMemo(
    () => laborEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0),
    [laborEntries]
  );

  const manualCostTotal = useMemo(
    () => costEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0),
    [costEntries]
  );

  const refreshManualData = useCallback(async () => {
    if (!selectedMonth) return;
    await Promise.all([fetchSummary(selectedMonth), loadManualEntries(selectedMonth)]);
  }, [selectedMonth, fetchSummary, loadManualEntries]);

  const handleLaborFormChange = (field) => (event) => {
    const { value } = event.target;
    setLaborForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCostFormChange = (field) => (event) => {
    const { value } = event.target;
    setCostForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddLaborEntry = async () => {
    if (!selectedMonth) return;
    const label = laborForm.label.trim();
    const rawAmount = parseManualAmount(laborForm.amount);
    if (!label || Number.isNaN(rawAmount) || rawAmount === 0) {
      return;
    }
    const normalizedAmount = rawAmount > 0 ? rawAmount * -1 : rawAmount;
    try {
      setManualError('');
      setManualSuccess('');
      setManualSubmitting(true);
      await api.createObManualAdjustment({
        month: selectedMonth,
        type: 'labor',
        label,
        amount: normalizedAmount
      });
      setLaborForm({ label: '', amount: '' });
      setManualSuccess('인건비 항목을 추가했습니다.');
      await refreshManualData();
    } catch (error) {
      console.error('[OB] add labor manual entry error:', error);
      setManualError(error.message || '인건비 항목을 추가하지 못했습니다.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleAddCostEntry = async () => {
    if (!selectedMonth) return;
    const label = costForm.label.trim();
    const rawAmount = parseManualAmount(costForm.amount);
    if (!label || Number.isNaN(rawAmount) || rawAmount === 0) {
      return;
    }
    const normalizedAmount = rawAmount > 0 ? rawAmount * -1 : rawAmount;
    try {
      setManualError('');
      setManualSuccess('');
      setManualSubmitting(true);
      await api.createObManualAdjustment({
        month: selectedMonth,
        type: 'cost',
        label,
        amount: normalizedAmount
      });
      setCostForm({ label: '', amount: '' });
      setManualSuccess('비용 항목을 추가했습니다.');
      await refreshManualData();
    } catch (error) {
      console.error('[OB] add cost manual entry error:', error);
      setManualError(error.message || '비용 항목을 추가하지 못했습니다.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleRemoveLaborEntry = async (id) => {
    if (!selectedMonth) return;
    try {
      setManualError('');
      setManualSuccess('');
      setManualSubmitting(true);
      setEditingLaborId((prev) => (prev === id ? null : prev));
      await api.deleteObManualAdjustment(id, selectedMonth);
      setManualSuccess('인건비 항목을 삭제했습니다.');
      await refreshManualData();
    } catch (error) {
      console.error('[OB] remove labor manual entry error:', error);
      setManualError(error.message || '인건비 항목을 삭제하지 못했습니다.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleRemoveCostEntry = async (id) => {
    if (!selectedMonth) return;
    try {
      setManualError('');
      setManualSuccess('');
      setManualSubmitting(true);
      setEditingCostId((prev) => (prev === id ? null : prev));
      await api.deleteObManualAdjustment(id, selectedMonth);
      setManualSuccess('비용 항목을 삭제했습니다.');
      await refreshManualData();
    } catch (error) {
      console.error('[OB] remove cost manual entry error:', error);
      setManualError(error.message || '비용 항목을 삭제하지 못했습니다.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleEditingLaborChange = (field) => (event) => {
    const { value } = event.target;
    setEditingLaborForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditingCostChange = (field) => (event) => {
    const { value } = event.target;
    setEditingCostForm((prev) => ({ ...prev, [field]: value }));
  };

  const startLaborEdit = (entry) => {
    setManualError('');
    setManualSuccess('');
    setEditingLaborId(entry.id);
    setEditingLaborForm({
      label: entry.label || '',
      amount: Math.abs(entry.amount || 0).toString()
    });
  };

  const cancelLaborEdit = () => {
    setEditingLaborId(null);
    setEditingLaborForm({ label: '', amount: '' });
  };

  const startCostEdit = (entry) => {
    setManualError('');
    setManualSuccess('');
    setEditingCostId(entry.id);
    setEditingCostForm({
      label: entry.label || '',
      amount: Math.abs(entry.amount || 0).toString()
    });
  };

  const cancelCostEdit = () => {
    setEditingCostId(null);
    setEditingCostForm({ label: '', amount: '' });
  };

  const handleSaveLaborEntry = async (id) => {
    if (!selectedMonth) return;
    const label = editingLaborForm.label.trim();
    const rawAmount = parseManualAmount(editingLaborForm.amount);
    if (!label || Number.isNaN(rawAmount) || rawAmount === 0) {
      setManualError('인건비 항목의 이름과 금액을 확인해 주세요.');
      return;
    }
    const normalizedAmount = rawAmount > 0 ? rawAmount * -1 : rawAmount;
    try {
      setManualError('');
      setManualSuccess('');
      setManualSubmitting(true);
      await api.updateObManualAdjustment(id, {
        month: selectedMonth,
        type: 'labor',
        label,
        amount: normalizedAmount
      });
      setManualSuccess('인건비 항목을 수정했습니다.');
      setEditingLaborId(null);
      setEditingLaborForm({ label: '', amount: '' });
      await refreshManualData();
    } catch (error) {
      console.error('[OB] update labor manual entry error:', error);
      setManualError(error.message || '인건비 항목을 수정하지 못했습니다.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleSaveCostEntry = async (id) => {
    if (!selectedMonth) return;
    const label = editingCostForm.label.trim();
    const rawAmount = parseManualAmount(editingCostForm.amount);
    if (!label || Number.isNaN(rawAmount) || rawAmount === 0) {
      setManualError('비용 항목의 이름과 금액을 확인해 주세요.');
      return;
    }
    const normalizedAmount = rawAmount > 0 ? rawAmount * -1 : rawAmount;
    try {
      setManualError('');
      setManualSuccess('');
      setManualSubmitting(true);
      await api.updateObManualAdjustment(id, {
        month: selectedMonth,
        type: 'cost',
        label,
        amount: normalizedAmount
      });
      setManualSuccess('비용 항목을 수정했습니다.');
      setEditingCostId(null);
      setEditingCostForm({ label: '', amount: '' });
      await refreshManualData();
    } catch (error) {
      console.error('[OB] update cost manual entry error:', error);
      setManualError(error.message || '비용 항목을 수정하지 못했습니다.');
    } finally {
      setManualSubmitting(false);
    }
  };

  // 맞춤제안: 유치자명별 + 영업팀/코드별 집계
  const customProposerStats = useMemo(() => {
    if (!summary?.customProposal?.rows) return [];
    const stats = {};
    summary.customProposal.rows.forEach((row) => {
      const name = row.proposerName || '미지정';
      const team = row.team || '';
      const code = row.code || '';
      const teamCodeKey = team && code ? `${team}/${code}` : (team || code || '미지정');
      const sales = row.salesAmount || 0;
      const themeFlag = row.themeFlag;
      
      // 유치자명별 집계
      if (!stats[name]) {
        stats[name] = {
          name,
          team: '',
          code: '',
          count: 0,
          policy1Amount: 0,
          policy2Amount: 0
        };
      }
      stats[name].count += 1;
      stats[name].policy1Amount += sales;
      if (themeFlag === '1') {
        stats[name].policy2Amount += sales;
      }
      
      // 영업팀/코드 정보는 첫 번째 값으로 설정 (같은 유치자명이면 동일한 팀/코드일 가능성 높음)
      if (!stats[name].team && team) {
        stats[name].team = team;
      }
      if (!stats[name].code && code) {
        stats[name].code = code;
      }
    });
    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        team: data.team,
        code: data.code,
        ...data,
        totalAmount: (data.policy1Amount || 0) + (data.policy2Amount || 0)
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [summary]);

  // 재약정: 등록직원별 + 출고처별 집계
  const recontractPromoterStats = useMemo(() => {
    if (!summary?.recontract?.rows) return [];
    const targetOutletNames = summary?.targetOutlets?.recontract?.outletNames || [];
    const stats = {};
    
    summary.recontract.rows.forEach((row) => {
      const name = row.promoterName || '미지정';
      const outlet = row.outlet || '';
      
      // 출고처와 대상점 매칭 확인
      const matchedOutlets = targetOutletNames.filter((outletName) =>
        outlet.includes(outletName.trim())
      );
      
      // 대상점과 매칭된 경우만 집계
      if (matchedOutlets.length > 0 && outlet) {
        // 등록직원 + 출고처 조합으로 키 생성
        const key = `${name}|||${outlet}`;
        if (!stats[key]) {
          stats[key] = { 
            name, 
            outlet,
            count: 0, 
            feeTotal: 0, 
            offerTotal: 0 
          };
        }
        stats[key].count += 1;
        stats[key].feeTotal += row.settlementAmount || 0;
        stats[key].offerTotal += (row.offerGiftCard || 0) + (row.offerDeposit || 0);
      }
    });
    
    return Object.values(stats)
      .sort((a, b) => {
        // 먼저 등록직원명으로 정렬, 같으면 출고처로 정렬
        if (a.name !== b.name) {
          return a.name.localeCompare(b.name);
        }
        return a.outlet.localeCompare(b.outlet);
      });
  }, [summary]);

  if (!sheetConfigs || sheetConfigs.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info">OB 정산 관리 탭에서 월별 링크를 먼저 등록해주세요.</Alert>
      </Box>
    );
  }

  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };

  const handleDownload = async (type) => {
    if (!summary) return;
    setDownloadError('');
    try {
      if (type === 'custom') {
        const rows = summary.customProposal?.rows || [];
        if (!rows || rows.length === 0) {
          throw new Error('맞춤제안 데이터가 없습니다.');
        }
        await downloadXlsx(`OB_맞춤제안_${summary.month}.xlsx`, CUSTOM_COLUMNS, rows);
      } else if (type === 'recontract') {
        const rows = summary.recontract?.rows || [];
        if (!rows || rows.length === 0) {
          throw new Error('재약정 데이터가 없습니다.');
        }
        await downloadXlsx(`OB_재약정_${summary.month}.xlsx`, RECONTRACT_COLUMNS, rows);
      }
    } catch (err) {
      console.error('[OB] download error:', err);
      setDownloadError(err.message || '다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleCompanyCompletionToggle = (company) => (event) => {
    const checked = event.target.checked;
    const currentWorkflow = companyWorkflowRef.current;
    const nextWorkflow = checked
      ? {
          ...currentWorkflow,
          [company]: {
            ...currentWorkflow[company],
            completed: true
          }
        }
      : {
          ...currentWorkflow,
          [company]: createCompanyWorkflowState()
        };

    setCompanyWorkflow(nextWorkflow);
    companyWorkflowRef.current = nextWorkflow;

    let nextInvoice = invoiceStatusRef.current;
    if (!checked) {
      nextInvoice = { issued: false, approved: false };
      setInvoiceStatus(nextInvoice);
      invoiceStatusRef.current = nextInvoice;
      setWorkflowError('');
      setWorkflowSuccess('');
    }

    persistProgress(nextInvoice, nextWorkflow);
  };

  const handleBankFieldChange = (company, field) => (event) => {
    const value = event.target.value;
    setCompanyWorkflow((prev) => {
      const next = {
        ...prev,
        [company]: {
          ...prev[company],
          [field]: value,
          editing: true,
          isSaved: false
        }
      };
      companyWorkflowRef.current = next;
      return next;
    });
  };

  const handleBankSave = (company) => () => {
    const current = companyWorkflowRef.current[company];
    const bankNameValue = (current.bankName || '').trim();
    const accountValue = (current.accountNumber || '').trim();

    if (!bankNameValue || !accountValue) {
      setWorkflowError('은행과 계좌번호를 모두 입력해 주세요.');
      setWorkflowSuccess('');
      return;
    }

    const nextWorkflow = {
      ...companyWorkflowRef.current,
      [company]: {
        ...current,
        bankName: bankNameValue,
        accountNumber: accountValue,
        isSaved: true,
        editing: false
      }
    };

    setCompanyWorkflow(nextWorkflow);
    companyWorkflowRef.current = nextWorkflow;
    setWorkflowError('');
    setWorkflowSuccess(`${COMPANY_LABELS[company]} 계좌 정보를 저장했습니다.`);
    persistProgress(invoiceStatusRef.current, nextWorkflow);
  };

  const handleBankEdit = (company) => () => {
    const nextWorkflow = {
      ...companyWorkflowRef.current,
      [company]: {
        ...companyWorkflowRef.current[company],
        editing: true
      }
    };
    setCompanyWorkflow(nextWorkflow);
    companyWorkflowRef.current = nextWorkflow;
    setWorkflowSuccess('');
  };

  const handleBankReset = (company) => () => {
    const current = companyWorkflowRef.current[company];
    const nextWorkflow = {
      ...companyWorkflowRef.current,
      [company]: {
        ...createCompanyWorkflowState(),
        completed: current.completed
      }
    };
    setCompanyWorkflow(nextWorkflow);
    companyWorkflowRef.current = nextWorkflow;
    setWorkflowError('');
    setWorkflowSuccess(`${COMPANY_LABELS[company]} 입력 내용을 초기화했습니다.`);
    persistProgress(invoiceStatusRef.current, nextWorkflow);
  };

  const handleDepositToggle = (company) => () => {
    const current = companyWorkflowRef.current[company];
    if (!current) return;

    if (!current.depositDone) {
      if (!current.isSaved) {
        setWorkflowError('계좌 정보를 저장한 후 입금완료를 진행해 주세요.');
        setWorkflowSuccess('');
        return;
      }
    }

    const nextWorkflow = {
      ...companyWorkflowRef.current,
      [company]: {
        ...current,
        depositDone: !current.depositDone,
        confirmDone: current.depositDone ? false : current.confirmDone
      }
    };

    setCompanyWorkflow(nextWorkflow);
    companyWorkflowRef.current = nextWorkflow;
    setWorkflowError('');
    setWorkflowSuccess(
      nextWorkflow[company].depositDone
        ? `${COMPANY_LABELS[company]} 입금이 확인되었습니다.`
        : `${COMPANY_LABELS[company]} 입금 완료 상태를 해제했습니다.`
    );
    persistProgress(invoiceStatusRef.current, nextWorkflow);
  };

  const handleConfirmToggle = (company) => () => {
    const current = companyWorkflowRef.current[company];
    if (!current) return;

    if (!current.confirmDone) {
      if (!current.depositDone) {
        setWorkflowError('입금완료 후 확인완료를 진행해 주세요.');
        setWorkflowSuccess('');
        return;
      }
    }

    const nextWorkflow = {
      ...companyWorkflowRef.current,
      [company]: {
        ...current,
        confirmDone: !current.confirmDone
      }
    };

    setCompanyWorkflow(nextWorkflow);
    companyWorkflowRef.current = nextWorkflow;
    setWorkflowError('');
    setWorkflowSuccess(
      nextWorkflow[company].confirmDone
        ? `${COMPANY_LABELS[company]} 정산을 확인했습니다.`
        : `${COMPANY_LABELS[company]} 확인 완료 상태를 해제했습니다.`
    );
    persistProgress(invoiceStatusRef.current, nextWorkflow);
  };

  const updateInvoiceStatusField = (field, value) => {
    const nextInvoice = {
      ...invoiceStatusRef.current,
      [field]: Boolean(value)
    };
    setInvoiceStatus(nextInvoice);
    invoiceStatusRef.current = nextInvoice;
    persistProgress(nextInvoice, companyWorkflowRef.current);
  };

  const renderCompanyProgress = useCallback(
    (companyKey, isCompleted) => {
      const toggleHandler = handleCompanyCompletionToggle(companyKey);
      const stepOneActive = !isCompleted;

      return (
        <Stack spacing={1.25}>
          <Box sx={getStepBoxStyles(stepOneActive)}>
            <FormControlLabel
              control={<Checkbox checked={!stepOneActive} disabled />}
              label={
                <StepLabel
                  step={1}
                  title="입력중"
                  description={
                    stepOneActive
                      ? '현재 단계입니다. 시트 데이터를 검토하고 입력을 마무리해 주세요.'
                      : '완료된 단계입니다.'
                  }
                  active={stepOneActive}
                />
              }
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
          </Box>
          <Box sx={getStepBoxStyles(!stepOneActive)}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isCompleted}
                  onChange={toggleHandler}
                />
              }
              label={
                <StepLabel
                  step={2}
                  title="정산확인 및 입력완료"
                  description={
                    isCompleted
                      ? '완료되었습니다. 계좌 저장 → 입금완료 → 확인완료를 이어서 진행하세요.'
                      : '정산 검토를 마쳤다면 체크해 다음 단계로 이동하세요.'
                  }
                  active={!stepOneActive}
                />
              }
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
          </Box>
        </Stack>
      );
    },
    [handleCompanyCompletionToggle]
  );

  const renderSummary = () => {
    if (loading) {
      return (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      );
    }

    if (!summary) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          선택한 월의 정산 데이터가 없습니다.
        </Alert>
      );
    }

    const { customProposal, recontract, totals } = summary;

    const manualData = summary.manual || {};
    const customBase = totals?.customTotal || 0;
    const recontractBase = totals?.recontractTotal || 0;
    const laborSheetTotal = summary?.postSettlement?.laborTotal ?? 0;
    const costSheetTotal = summary?.postSettlement?.costTotal ?? 0;
    const laborManualTotalDisplay = manualData.laborManualTotal ?? manualLaborTotal;
    const costManualTotalDisplay = manualData.costManualTotal ?? manualCostTotal;
    const combinedLaborTotal = summary?.totals?.combinedLaborTotal ?? (laborSheetTotal + laborManualTotalDisplay);
    const combinedCostTotal = summary?.totals?.combinedCostTotal ?? (costSheetTotal + costManualTotalDisplay);
    const combinedGrandTotal =
      totals.grandTotal ?? customBase + recontractBase + combinedLaborTotal + combinedCostTotal;
    const combinedSplitVip = totals.split?.vip ?? Math.round(combinedGrandTotal * 0.3);
    const combinedSplitYai = totals.split?.yai ?? Math.round(combinedGrandTotal * 0.7);

    const vipState = companyWorkflow.vip;
    const yaiState = companyWorkflow.yai;
    const vipCompleted = Boolean(vipState.completed);
    const yaiCompleted = Boolean(yaiState.completed);
    const bothCompleted = vipCompleted && yaiCompleted;
    const invoiceControlsEnabled = bothCompleted;
    const invoiceChecksDone = invoiceStatus.issued && invoiceStatus.approved;
    const allConfirmed = vipState.confirmDone && yaiState.confirmDone;

    const renderCompanyWorkflow = (companyKey, label, accentColor) => {
      const state = companyWorkflow[companyKey];
      const bankNameValue = (state.bankName || '').trim();
      const accountValue = (state.accountNumber || '').trim();
      const fieldsDisabled = !invoiceChecksDone || !state.editing;
      const saveDisabled =
        !invoiceChecksDone || !state.editing || !bankNameValue || !accountValue;
      const editDisabled = !invoiceChecksDone || state.editing || !state.isSaved;
      const hasAnyProgress = Boolean(
        bankNameValue || accountValue || state.isSaved || state.depositDone || state.confirmDone
      );
      const resetDisabled = !invoiceChecksDone || !hasAnyProgress;
      const depositDisabled =
        !invoiceChecksDone || (!state.depositDone && !state.isSaved);
      const confirmDisabled =
        !invoiceChecksDone || (!state.depositDone && !state.confirmDone);

      return (
        <Paper
          key={companyKey}
          elevation={invoiceChecksDone ? 2 : 0}
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px solid ${invoiceChecksDone ? accentColor : 'rgba(0,0,0,0.08)'}`,
            backgroundColor: invoiceChecksDone ? 'rgba(255,255,255,0.95)' : 'rgba(250,250,250,0.8)',
            transition: 'all 0.3s ease'
          }}
        >
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {label}
              </Typography>
              <Chip
                size="small"
                label={state.isSaved ? '계좌 저장됨' : '계좌 입력 필요'}
                color={state.isSaved ? 'success' : 'default'}
                variant={state.isSaved ? 'filled' : 'outlined'}
              />
              <Chip
                size="small"
                label={state.depositDone ? '입금 완료' : '입금 대기'}
                color={state.depositDone ? 'primary' : 'default'}
                variant={state.depositDone ? 'filled' : 'outlined'}
              />
              <Chip
                size="small"
                label={state.confirmDone ? '확인 완료' : '확인 대기'}
                color={state.confirmDone ? 'success' : 'default'}
                variant={state.confirmDone ? 'filled' : 'outlined'}
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                label="은행명"
                size="small"
                fullWidth
                value={state.bankName}
                onChange={handleBankFieldChange(companyKey, 'bankName')}
                disabled={fieldsDisabled}
              />
              <TextField
                label="계좌번호"
                size="small"
                fullWidth
                value={state.accountNumber}
                onChange={handleBankFieldChange(companyKey, 'accountNumber')}
                disabled={fieldsDisabled}
              />
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="contained"
                size="small"
                onClick={handleBankSave(companyKey)}
                disabled={saveDisabled}
              >
                저장
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleBankEdit(companyKey)}
                disabled={editDisabled}
              >
                수정
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={handleBankReset(companyKey)}
                disabled={resetDisabled}
              >
                초기화
              </Button>
            </Stack>
            <Divider />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant={state.depositDone ? 'contained' : 'outlined'}
                size="small"
                color={state.depositDone ? 'success' : 'primary'}
                onClick={handleDepositToggle(companyKey)}
                disabled={depositDisabled}
              >
                {state.depositDone ? '입금완료 해제' : '입금완료'}
              </Button>
              <Button
                variant={state.confirmDone ? 'contained' : 'outlined'}
                size="small"
                color={state.confirmDone ? 'success' : 'primary'}
                onClick={handleConfirmToggle(companyKey)}
                disabled={confirmDisabled}
              >
                {state.confirmDone ? '확인완료 해제' : '확인완료'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      );
    };


    const laborFormAmountNumber = parseManualAmount(laborForm.amount);
    const laborAddDisabled =
      !laborForm.label.trim() || Number.isNaN(laborFormAmountNumber) || laborFormAmountNumber === 0;
    const costFormAmountNumber = parseManualAmount(costForm.amount);
    const costAddDisabled =
      !costForm.label.trim() || Number.isNaN(costFormAmountNumber) || costFormAmountNumber === 0;

    // 맞춤제안 유치자명 목록 (제외인원 제외)
    const customProposerNames = customProposerStats.map((s) => s.name).join(', ');
    const customProposerCount = customProposerStats.reduce((sum, s) => sum + s.count, 0);

    // 재약정 등록직원 목록 (제외인원 제외)
    const recontractPromoterNames = recontractPromoterStats.map((s) => s.name).join(', ');
    const recontractPromoterCount = recontractPromoterStats.reduce((sum, s) => sum + s.count, 0);

    const renderCompanyProgress = (companyKey) => {
      const state = companyWorkflow[companyKey] || createCompanyWorkflowState();
      const isCompleted = Boolean(state.completed);
      const depositDone = Boolean(state.depositDone);
      const confirmDone = Boolean(state.confirmDone);
      const toggleHandler = handleCompanyCompletionToggle(companyKey);
      const stepOneActive = !isCompleted;

      let stepTwoDescription = '정산 검토를 마쳤다면 체크해 다음 단계로 이동하세요.';
      if (isCompleted) {
        if (!state.isSaved) {
          stepTwoDescription = '계좌 정보를 저장해 주세요.';
        } else if (!depositDone) {
          stepTwoDescription = '계좌 저장이 끝났다면 입금완료 버튼으로 진행하세요.';
        } else if (!confirmDone) {
          stepTwoDescription = '입금 확인 후 확인완료 버튼을 눌러 마무리하세요.';
        } else {
          stepTwoDescription = '완료되었습니다. 필요 시 언제든지 상태를 되돌릴 수 있습니다.';
        }
      }

      return (
        <Stack spacing={1.25}>
          <Box sx={getStepBoxStyles(stepOneActive)}>
            <FormControlLabel
              control={<Checkbox checked={!stepOneActive} disabled />}
              label={
                <StepLabel
                  step={1}
                  title="입력중"
                  description={
                    stepOneActive
                      ? '현재 단계입니다. 시트 데이터를 검토하고 입력을 마무리해 주세요.'
                      : '완료된 단계입니다.'
                  }
                  active={stepOneActive}
                />
              }
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
          </Box>
          <Box sx={getStepBoxStyles(!stepOneActive)}>
            <FormControlLabel
              control={<Checkbox checked={isCompleted} onChange={toggleHandler} />}
              label={
                <StepLabel
                  step={2}
                  title="정산확인 및 입력완료"
                  description={stepTwoDescription}
                  active={!stepOneActive}
                />
              }
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
          </Box>
        </Stack>
      );
    };

    return (
      <Stack spacing={4}>
        {downloadError ? (
          <Alert severity="error" onClose={() => setDownloadError('')}>
            {downloadError}
          </Alert>
        ) : null}
        {manualError ? (
          <Alert severity="error" onClose={() => setManualError('')}>
            {manualError}
          </Alert>
        ) : null}
        {manualSuccess ? (
          <Alert severity="success" onClose={() => setManualSuccess('')}>
            {manualSuccess}
          </Alert>
        ) : null}

        {/* 최종 정산 섹션 - 맨 상단 */}
        <Section 
          title="최종 정산" 
          color={SECTION_COLORS.totals}
          collapsible
          expanded={finalSettlementExpanded}
          onToggle={() => setFinalSettlementExpanded((prev) => !prev)}
        >
          <Collapse in={allConfirmed}>
            <Paper
              elevation={3}
              sx={{
                mb: 3,
                p: 3,
                textAlign: 'center',
                background:
                  'linear-gradient(135deg, rgba(103,58,183,0.12), rgba(63,81,181,0.18))',
                border: '1px solid rgba(103,58,183,0.32)',
                animation: `${glowAnimation} 1.4s ease-in-out`
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                대상월 최종 완료!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                은행 입금 확인과 정산 승인까지 모두 끝났습니다.
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#512DA8' }}>
                한 달간 수고하셨습니다. ✨
              </Typography>
            </Paper>
          </Collapse>
          {allConfirmed ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: summaryExpanded ? 1 : 0 }}>
              <Button
                size="small"
                variant="text"
                onClick={() => setSummaryExpanded((prev) => !prev)}
              >
                {summaryExpanded ? '총 정산 금액 접기' : '총 정산 금액 펼치기'}
              </Button>
            </Box>
          ) : null}
          <Grid container spacing={2}>
            {(!allConfirmed || summaryExpanded) && (
              <Grid item xs={12}>
                <Collapse in={!allConfirmed || summaryExpanded} mountOnEnter unmountOnExit>
                  <Box>
                    <SummaryCard
                      title="총 정산 금액"
                      value={currencyFormatter.format(combinedGrandTotal)}
                      description={`맞춤제안 ${currencyFormatter.format(customBase)} + 재약정 ${currencyFormatter.format(recontractBase)} + 인건비 ${currencyFormatter.format(combinedLaborTotal)} + 비용 ${currencyFormatter.format(combinedCostTotal)}`}
                      color="#1976d2"
                      activated={bothCompleted}
                      animate={bothCompleted}
                    >
                      <Stack spacing={1.5}>
                        <Stack
                          direction={{ xs: 'column', lg: 'row' }}
                          spacing={1.5}
                          alignItems={{ xs: 'stretch', lg: 'center' }}
                          sx={{ flexWrap: 'wrap' }}
                        >
                          <Button
                            component="a"
                            href="https://www.wehago.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="contained"
                            color="primary"
                            disabled={!invoiceControlsEnabled}
                            sx={{ minWidth: 240, whiteSpace: 'nowrap' }}
                          >
                            세금계산서 발행 및 승인 바로가기
                          </Button>
                          <Stack direction="row" spacing={1.5} flexWrap="wrap">
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={invoiceStatus.issued}
                                  onChange={(event) =>
                                    updateInvoiceStatusField('issued', event.target.checked)
                                  }
                                  disabled={!invoiceControlsEnabled}
                                />
                              }
                              label="세금계산서 발행"
                              sx={{ whiteSpace: 'nowrap' }}
                            />
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={invoiceStatus.approved}
                                  onChange={(event) =>
                                    updateInvoiceStatusField('approved', event.target.checked)
                                  }
                                  disabled={!invoiceControlsEnabled}
                                />
                              }
                              label="세금계산서 승인"
                              sx={{ whiteSpace: 'nowrap' }}
                            />
                          </Stack>
                        </Stack>
                        {workflowError ? (
                          <Alert severity="error" onClose={() => setWorkflowError('')}>
                            {workflowError}
                          </Alert>
                        ) : null}
                        {workflowSuccess ? (
                          <Alert severity="success" onClose={() => setWorkflowSuccess('')}>
                            {workflowSuccess}
                          </Alert>
                        ) : null}
                        <Collapse in={invoiceChecksDone}>
                          <Stack spacing={2} sx={{ mt: 1 }}>
                            {renderCompanyWorkflow('vip', COMPANY_LABELS.vip, '#6A1B9A')}
                            {renderCompanyWorkflow('yai', COMPANY_LABELS.yai, '#00838F')}
                          </Stack>
                        </Collapse>
                      </Stack>
                    </SummaryCard>
                  </Box>
                </Collapse>
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <SummaryCard
                title="(주)브이아이피플러스 30%"
                value={currencyFormatter.format(combinedSplitVip)}
                color="#6A1B9A"
                animate={vipCompleted}
              >
                {renderCompanyProgress('vip')}
              </SummaryCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <SummaryCard
                title="(주)와이에이 70%"
                value={currencyFormatter.format(combinedSplitYai)}
                color="#00838F"
                animate={yaiCompleted}
              >
                {renderCompanyProgress('yai')}
              </SummaryCard>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>항목별 합계:</strong> 맞춤제안 {currencyFormatter.format(customBase)} | 재약정 {currencyFormatter.format(recontractBase)} | 인건비 {currencyFormatter.format(combinedLaborTotal)} (시트 {currencyFormatter.format(laborSheetTotal)} / 수기 {currencyFormatter.format(manualLaborTotal)}) | 비용 {currencyFormatter.format(combinedCostTotal)} (시트 {currencyFormatter.format(costSheetTotal)} / 수기 {currencyFormatter.format(manualCostTotal)})
            </Typography>
          </Box>
          {finalSettlementExpanded && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                항목별 금액 비교
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: '맞춤제안', 금액: customBase },
                    { name: '재약정', 금액: recontractBase },
                    { name: '인건비', 금액: combinedLaborTotal },
                    { name: '비용', 금액: combinedCostTotal }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `${(value / 10000).toFixed(0)}만원`} />
                  <RechartsTooltip formatter={(value) => currencyFormatter.format(value)} />
                  <Legend />
                  <Bar dataKey="금액" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Section>

        {/* 맞춤제안 섹션 */}
        <Section
          title="맞춤제안"
          collapsible
          expanded={customProposalExpanded}
          onToggle={() => setCustomProposalExpanded((prev) => !prev)}
          subtitle={`본사 raw 데이터 (39인덱스) 유치자명: ${customProposerNames || '없음'} (${customProposerCount}건)`}
          color={SECTION_COLORS.custom}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="정책① 기본 (2배 지급)"
                value={currencyFormatter.format(customProposal.policy1.payout)}
                count={`${numberFormatter.format(customProposal.includedCount)}건`}
                description={`매출 합계: ${currencyFormatter.format(customProposal.policy1.totalSales)}`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="정책② 테마 업셀"
                value={currencyFormatter.format(customProposal.policy2.qualifyingSales)}
                count={`${numberFormatter.format(customProposal.rows.filter((r) => r.themeFlag === '1').length)}건`}
                description="테마 업셀 플래그가 1인 매출 합계"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="정책③ 인건비 지원"
                value={currencyFormatter.format(customProposal.policy3.payout)}
                count={`${numberFormatter.format(customProposal.includedCount)}건`}
                description={customProposal.policy3.tier
                  ? `기준 매출 ${numberFormatter.format(customProposal.policy3.tier.sales)}만원 이상 → ${numberFormatter.format(customProposal.policy3.tier.payout)}만원 지급`
                  : '기준 매출 미달'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="건수 구간별 지급"
                value={currencyFormatter.format(customProposal.perCase.payout)}
                count={`${numberFormatter.format(customProposal.perCase.count)}건`}
                description={customProposal.perCase.threshold
                  ? `건당 ${currencyFormatter.format(customProposal.perCase.unitAmount)}`
                  : '건수 구간 미달'}
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>맞춤제안 합계:</strong> {currencyFormatter.format(customProposal.totalPayout)} (대상 {numberFormatter.format(customProposal.includedCount)}건, 제외 {numberFormatter.format(customProposal.excluded.count)}건)
              </Typography>
              <Button
                startIcon={<GetAppIcon />}
                variant="outlined"
                size="small"
                onClick={() => handleDownload('custom')}
                disabled={!customProposal.rows || customProposal.rows.length === 0}
              >
                엑셀 다운로드
              </Button>
            </Box>
          </Box>

          {/* 맞춤제안 유치자별 상세 테이블 */}
          {customProposerStats.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                유치자별 상세 내역
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ backgroundColor: 'rgba(255,255,255,0.8)' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>유치자명</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>영업팀</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>코드</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>건수</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>정책① 기본</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>정책② 테마 업셀</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>매출 합계(①+②)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customProposerStats.map((stat) => (
                      <TableRow key={stat.name}>
                        <TableCell>{stat.name}</TableCell>
                        <TableCell>{stat.team || '-'}</TableCell>
                        <TableCell>{stat.code || '-'}</TableCell>
                        <TableCell align="right">{numberFormatter.format(stat.count)}건</TableCell>
                        <TableCell align="right">{currencyFormatter.format(stat.policy1Amount)}</TableCell>
                        <TableCell align="right">{currencyFormatter.format(stat.policy2Amount)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {currencyFormatter.format(stat.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          {customProposalExpanded && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                정책별 금액 비교
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: '정책① 기본', 금액: customProposal.policy1.payout },
                    { name: '정책② 테마 업셀', 금액: customProposal.policy2.qualifyingSales },
                    { name: '정책③ 인건비 지원', 금액: customProposal.policy3.payout },
                    { name: '건수 구간별 지급', 금액: customProposal.perCase.payout }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis tickFormatter={(value) => `${(value / 10000).toFixed(0)}만원`} />
                  <RechartsTooltip formatter={(value) => currencyFormatter.format(value)} />
                  <Legend />
                  <Bar dataKey="금액" fill="#9c27b0" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Section>

        {/* 재약정 섹션 */}
        <Section
          title="재약정"
          subtitle={`폰클 홈데이터 (91인덱스) 등록직원: ${recontractPromoterNames || '없음'} (${recontractPromoterCount}건)`}
          color={SECTION_COLORS.recontract}
          collapsible
          expanded={recontractExpanded}
          onToggle={() => setRecontractExpanded((prev) => !prev)}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="재약정 수수료"
                value={currencyFormatter.format(recontract.feeTotal)}
                count={`${numberFormatter.format(recontract.includedCount)}건`}
                description="수수료 합계"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="재약정 오퍼 지급"
                value={currencyFormatter.format(recontract.offer.total)}
                count={`${numberFormatter.format(recontract.includedCount)}건`}
                description="오퍼금액 합계 (19인덱스 기준)"
              >
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  💡 오퍼금액은 폰클에서 입력시 홈 추가정책 란에 입력해주세요
                </Typography>
              </SummaryCard>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="재약정 총 지급액"
                value={currencyFormatter.format(recontract.totalPayout)}
                count={`${numberFormatter.format(recontract.includedCount)}건`}
                description={`제외 ${numberFormatter.format(recontract.excludedCount)}건`}
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>재약정 합계:</strong> {currencyFormatter.format(recontract.totalPayout)} (수수료 {currencyFormatter.format(recontract.feeTotal)} + 오퍼 {currencyFormatter.format(recontract.offer.total)})
              </Typography>
              <Button
                startIcon={<GetAppIcon />}
                variant="outlined"
                size="small"
                onClick={() => handleDownload('recontract')}
                disabled={!recontract.rows || recontract.rows.length === 0}
              >
                엑셀 다운로드
              </Button>
            </Box>
          </Box>

          {/* 재약정 등록직원별 상세 테이블 */}
          {recontractPromoterStats.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                등록직원별 상세 내역
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ backgroundColor: 'rgba(255,255,255,0.8)' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>등록직원</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>대상</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>건수</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>수수료 합계</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>오퍼 합계</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>총액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recontractPromoterStats.map((stat, index) => (
                      <TableRow key={`${stat.name}-${stat.outlet}-${index}`}>
                        <TableCell>{stat.name}</TableCell>
                        <TableCell>{stat.outlet || '-'}</TableCell>
                        <TableCell align="right">{numberFormatter.format(stat.count)}건</TableCell>
                        <TableCell align="right">{currencyFormatter.format(stat.feeTotal)}</TableCell>
                        <TableCell align="right">{currencyFormatter.format(stat.offerTotal)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {currencyFormatter.format(stat.feeTotal + stat.offerTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          {recontractExpanded && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                수수료/오퍼 비교
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: '수수료', 금액: recontract.feeTotal },
                    { name: '오퍼', 금액: recontract.offer.total }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `${(value / 10000).toFixed(0)}만원`} />
                  <RechartsTooltip formatter={(value) => currencyFormatter.format(value)} />
                  <Legend />
                  <Bar dataKey="금액" fill="#f57c00" />
                </BarChart>
              </ResponsiveContainer>
              {recontractPromoterStats.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 4, mb: 2, fontWeight: 600 }}>
                    등록직원별 금액 (상위 10개)
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={recontractPromoterStats.slice(0, 10).map(stat => ({
                        name: stat.name.length > 8 ? stat.name.substring(0, 8) + '...' : stat.name,
                        수수료: stat.feeTotal,
                        오퍼: stat.offerTotal,
                        총액: stat.totalAmount
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `${(value / 10000).toFixed(0)}만원`} />
                      <YAxis dataKey="name" type="category" width={100} />
                      <RechartsTooltip formatter={(value) => currencyFormatter.format(value)} />
                      <Legend />
                      <Bar dataKey="수수료" stackId="a" fill="#ff9800" />
                      <Bar dataKey="오퍼" stackId="a" fill="#ff6f00" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </Box>
          )}
        </Section>

        {/* 인건비/비용 섹션 */}
        <Section 
          title="인건비 / 비용" 
          color={SECTION_COLORS.laborCost}
          collapsible
          expanded={laborCostExpanded}
          onToggle={() => setLaborCostExpanded((prev) => !prev)}
        >
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              <strong>인건비 합계:</strong> {currencyFormatter.format(combinedLaborTotal)} (시트 {currencyFormatter.format(laborSheetTotal)} / 수기 입력 {currencyFormatter.format(laborManualTotalDisplay)})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>비용 합계:</strong> {currencyFormatter.format(combinedCostTotal)} (시트 {currencyFormatter.format(costSheetTotal)} / 수기 입력 {currencyFormatter.format(costManualTotalDisplay)})
            </Typography>
            
            {/* 시트 데이터 상세 목록 */}
            {summary?.postSettlement && (summary.postSettlement.laborEntries.length > 0 || summary.postSettlement.costEntries.length > 0) && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  시트 데이터 상세 내역
                </Typography>
                <TableContainer component={Paper} elevation={0} sx={{ backgroundColor: 'rgba(255,255,255,0.8)' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>항목</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>대상</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>내용</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>상세내용</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>금액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {summary.postSettlement.laborEntries.map((entry, index) => (
                        <TableRow key={`labor-${index}-${entry.rowNumber}`}>
                          <TableCell>{entry.item || '-'}</TableCell>
                          <TableCell>{entry.target || '-'}</TableCell>
                          <TableCell>{entry.content || '-'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'pre-wrap', maxWidth: 300 }}>{entry.detail || '-'}</TableCell>
                          <TableCell align="right">{currencyFormatter.format(entry.amount || 0)}</TableCell>
                        </TableRow>
                      ))}
                      {summary.postSettlement.costEntries.map((entry, index) => (
                        <TableRow key={`cost-${index}-${entry.rowNumber}`}>
                          <TableCell>{entry.item || '-'}</TableCell>
                          <TableCell>{entry.target || '-'}</TableCell>
                          <TableCell>{entry.content || '-'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'pre-wrap', maxWidth: 300 }}>{entry.detail || '-'}</TableCell>
                          <TableCell align="right">{currencyFormatter.format(entry.amount || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
            
            <Alert severity="info">
              수기 입력 금액은 자동으로 음수(-) 처리되어 최종 합계에 반영됩니다.
            </Alert>
            <Stack spacing={3} direction={{ xs: 'column', md: 'row' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  인건비 수기 입력
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    label="항목명"
                    value={laborForm.label}
                    onChange={handleLaborFormChange('label')}
                    fullWidth
                  />
                  <TextField
                    label="금액"
                    type="number"
                    value={laborForm.amount}
                    onChange={handleLaborFormChange('amount')}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleAddLaborEntry}
                    disabled={laborAddDisabled || manualSubmitting}
                  >
                    추가
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  금액을 입력하면 자동으로 음수(-)로 변환됩니다.
                </Typography>
                {laborEntries.length > 0 && (
                  <TableContainer component={Paper} elevation={0} sx={{ mt: 1, backgroundColor: 'rgba(255,255,255,0.8)' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>항목명</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>금액</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>관리</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {laborEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {editingLaborId === entry.id ? (
                                <TextField
                                  value={editingLaborForm.label}
                                  onChange={handleEditingLaborChange('label')}
                                  size="small"
                                  fullWidth
                                  disabled={manualSubmitting}
                                />
                              ) : (
                                entry.label
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {editingLaborId === entry.id ? (
                                <TextField
                                  value={editingLaborForm.amount}
                                  onChange={handleEditingLaborChange('amount')}
                                  size="small"
                                  type="number"
                                  inputProps={{ min: 0 }}
                                  disabled={manualSubmitting}
                                />
                              ) : (
                                currencyFormatter.format(entry.amount)
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {editingLaborId === entry.id ? (
                                <>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSaveLaborEntry(entry.id)}
                                    disabled={manualSubmitting}
                                  >
                                    <CheckCircleOutlineIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={cancelLaborEdit}
                                    disabled={manualSubmitting}
                                  >
                                    <CancelOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </>
                              ) : (
                                <>
                                  <IconButton
                                    size="small"
                                    onClick={() => startLaborEdit(entry)}
                                    disabled={manualSubmitting}
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemoveLaborEntry(entry.id)}
                                    disabled={manualSubmitting}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  비용 수기 입력
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    label="항목명"
                    value={costForm.label}
                    onChange={handleCostFormChange('label')}
                    fullWidth
                  />
                  <TextField
                    label="금액"
                    type="number"
                    value={costForm.amount}
                    onChange={handleCostFormChange('amount')}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleAddCostEntry}
                    disabled={costAddDisabled || manualSubmitting}
                  >
                    추가
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  금액을 입력하면 자동으로 음수(-)로 변환됩니다.
                </Typography>
                {costEntries.length > 0 && (
                  <TableContainer component={Paper} elevation={0} sx={{ mt: 1, backgroundColor: 'rgba(255,255,255,0.8)' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>항목명</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>금액</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>관리</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {costEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {editingCostId === entry.id ? (
                                <TextField
                                  value={editingCostForm.label}
                                  onChange={handleEditingCostChange('label')}
                                  size="small"
                                  fullWidth
                                  disabled={manualSubmitting}
                                />
                              ) : (
                                entry.label
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {editingCostId === entry.id ? (
                                <TextField
                                  value={editingCostForm.amount}
                                  onChange={handleEditingCostChange('amount')}
                                  size="small"
                                  type="number"
                                  inputProps={{ min: 0 }}
                                  disabled={manualSubmitting}
                                />
                              ) : (
                                currencyFormatter.format(entry.amount)
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {editingCostId === entry.id ? (
                                <>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSaveCostEntry(entry.id)}
                                    disabled={manualSubmitting}
                                  >
                                    <CheckCircleOutlineIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={cancelCostEdit}
                                    disabled={manualSubmitting}
                                  >
                                    <CancelOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </>
                              ) : (
                                <>
                                  <IconButton
                                    size="small"
                                    onClick={() => startCostEdit(entry)}
                                    disabled={manualSubmitting}
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemoveCostEntry(entry.id)}
                                    disabled={manualSubmitting}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Stack>
          </Stack>
          {laborCostExpanded && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                인건비/비용 비교
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: '인건비', 금액: combinedLaborTotal },
                    { name: '비용', 금액: combinedCostTotal }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `${(value / 10000).toFixed(0)}만원`} />
                  <RechartsTooltip formatter={(value) => currencyFormatter.format(value)} />
                  <Legend />
                  <Bar dataKey="금액" fill="#2e7d32" />
                </BarChart>
              </ResponsiveContainer>
              <Typography variant="subtitle2" sx={{ mt: 4, mb: 2, fontWeight: 600 }}>
                시트/수기 입력 비교
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: '인건비 시트', 금액: laborSheetTotal },
                    { name: '인건비 수기', 금액: laborManualTotalDisplay },
                    { name: '비용 시트', 금액: costSheetTotal },
                    { name: '비용 수기', 금액: costManualTotalDisplay }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis tickFormatter={(value) => `${(value / 10000).toFixed(0)}만원`} />
                  <RechartsTooltip formatter={(value) => currencyFormatter.format(value)} />
                  <Legend />
                  <Bar dataKey="금액" fill="#66bb6a" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Section>
      </Stack>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            OB 정산 확인
          </Typography>
          <Typography variant="body2" color="text.secondary">
            월별 정산 데이터를 확인하고 엑셀 파일로 다운로드할 수 있습니다.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>연월 선택</InputLabel>
          <Select value={selectedMonth} onChange={handleMonthChange} label="연월 선택">
            {monthOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {renderSummary()}
    </Box>
  );
};

ObSettlementOverview.propTypes = {
  sheetConfigs: PropTypes.arrayOf(
    PropTypes.shape({
      month: PropTypes.string
    })
  ).isRequired,
  currentUser: PropTypes.string
};

ObSettlementOverview.defaultProps = {
  currentUser: ''
};

export default ObSettlementOverview;
