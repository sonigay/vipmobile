import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import { keyframes } from '@emotion/react';
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

const SummaryCard = ({ title, value, description, count, color, activated, animate, children }) => (
  <Card
    sx={{
      height: '100%',
      transition: 'all 0.35s ease',
      opacity: activated ? 1 : 0.45,
      filter: activated ? 'none' : 'grayscale(0.2)',
      border: activated ? '1px solid rgba(94,53,177,0.24)' : '1px solid rgba(0,0,0,0.08)',
      boxShadow: activated ? '0 16px 32px rgba(94,53,177,0.25)' : 'none',
      animation: animate ? `${glowAnimation} 1.2s ease-in-out` : 'none',
      '&:hover': activated
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
  activated: false,
  animate: false,
  children: null
};

const Section = ({ title, subtitle, color, children, spacing }) => (
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
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Stack>
  </Paper>
);

Section.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  color: PropTypes.string,
  children: PropTypes.node,
  spacing: PropTypes.number
};

Section.defaultProps = {
  subtitle: '',
  color: '#fff',
  children: null,
  spacing: 3
};

const ObSettlementOverview = ({ sheetConfigs }) => {
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

  useEffect(() => {
    if (sheetConfigs && sheetConfigs.length > 0) {
      setSelectedMonth((prev) => prev || sheetConfigs[0].month);
    }
  }, [sheetConfigs]);

  useEffect(() => {
    setCompanyWorkflow({
      vip: createCompanyWorkflowState(),
      yai: createCompanyWorkflowState()
    });
    setInvoiceStatus({ issued: false, approved: false });
    setWorkflowError('');
    setWorkflowSuccess('');
  }, [selectedMonth]);

  useEffect(() => {
    if (!invoiceStatus.issued || !invoiceStatus.approved) {
      setCompanyWorkflow((prev) => ({
        vip: {
          ...prev.vip,
          isSaved: false,
          editing: true,
          depositDone: false,
          confirmDone: false
        },
        yai: {
          ...prev.yai,
          isSaved: false,
          editing: true,
          depositDone: false,
          confirmDone: false
        }
      }));
      setWorkflowError('');
      setWorkflowSuccess('');
    }
  }, [invoiceStatus.issued, invoiceStatus.approved]);

  const fetchSummary = useCallback(
    async (month) => {
      if (!month) return;
      setLoading(true);
      setError('');
      try {
        const response = await api.getObSettlementSummary(month);
        if (response?.success) {
          setSummary(response.data);
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
    []
  );

  useEffect(() => {
    if (selectedMonth) {
      fetchSummary(selectedMonth);
    }
  }, [selectedMonth, fetchSummary]);

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

  const monthOptions = useMemo(
    () => sheetConfigs.map((config) => ({ value: config.month, label: config.month })),
    [sheetConfigs]
  );

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

  // 맞춤제안: 유치자명별 집계
  const customProposerStats = useMemo(() => {
    if (!summary?.customProposal?.rows) return [];
    const stats = {};
    summary.customProposal.rows.forEach((row) => {
      const name = row.proposerName || '미지정';
      const sales = row.salesAmount || 0;
      const themeFlag = row.themeFlag;
      if (!stats[name]) {
        stats[name] = {
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
    });
    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        ...data,
        totalAmount: (data.policy1Amount || 0) + (data.policy2Amount || 0)
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [summary]);

  // 재약정: 등록직원별 집계
  const recontractPromoterStats = useMemo(() => {
    if (!summary?.recontract?.rows) return [];
    const stats = {};
    summary.recontract.rows.forEach((row) => {
      const name = row.promoterName || '미지정';
      if (!stats[name]) {
        stats[name] = { count: 0, feeTotal: 0, offerTotal: 0 };
      }
      stats[name].count += 1;
      stats[name].feeTotal += row.settlementAmount || 0;
      stats[name].offerTotal += (row.offerGiftCard || 0) + (row.offerDeposit || 0);
    });
    return Object.entries(stats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.feeTotal - a.feeTotal);
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
    setCompanyWorkflow((prev) => {
      if (checked) {
        return {
          ...prev,
          [company]: {
            ...prev[company],
            completed: true
          }
        };
      }
      return {
        ...prev,
        [company]: createCompanyWorkflowState()
      };
    });
    if (!checked) {
      setInvoiceStatus({ issued: false, approved: false });
      setWorkflowError('');
      setWorkflowSuccess('');
    }
  };

  const handleBankFieldChange = (company, field) => (event) => {
    const value = event.target.value;
    setCompanyWorkflow((prev) => ({
      ...prev,
      [company]: {
        ...prev[company],
        [field]: value,
        editing: true,
        isSaved: false
      }
    }));
  };

  const handleBankSave = (company) => () => {
    let hasError = false;
    setCompanyWorkflow((prev) => {
      const state = prev[company];
      const bankNameValue = (state.bankName || '').trim();
      const accountValue = (state.accountNumber || '').trim();
      if (!bankNameValue || !accountValue) {
        hasError = true;
        return prev;
      }
      return {
        ...prev,
        [company]: {
          ...state,
          bankName: bankNameValue,
          accountNumber: accountValue,
          isSaved: true,
          editing: false
        }
      };
    });
    if (hasError) {
      setWorkflowError('은행과 계좌번호를 모두 입력해 주세요.');
      setWorkflowSuccess('');
    } else {
      setWorkflowError('');
      setWorkflowSuccess(`${COMPANY_LABELS[company]} 계좌 정보를 저장했습니다.`);
    }
  };

  const handleBankEdit = (company) => () => {
    setCompanyWorkflow((prev) => ({
      ...prev,
      [company]: {
        ...prev[company],
        editing: true
      }
    }));
    setWorkflowSuccess('');
  };

  const handleBankReset = (company) => () => {
    setCompanyWorkflow((prev) => ({
      ...prev,
      [company]: {
        ...createCompanyWorkflowState(),
        completed: prev[company].completed
      }
    }));
    setWorkflowError('');
    setWorkflowSuccess(`${COMPANY_LABELS[company]} 입력 내용을 초기화했습니다.`);
  };

  const handleDepositComplete = (company) => () => {
    let errorMessage = '';
    let successMessage = '';
    setCompanyWorkflow((prev) => {
      const state = prev[company];
      if (!state.isSaved) {
        errorMessage = '계좌 정보를 저장한 후 입금완료를 진행해 주세요.';
        return prev;
      }
      if (state.depositDone) {
        successMessage = `${COMPANY_LABELS[company]} 입금 완료가 이미 처리되었습니다.`;
        return prev;
      }
      successMessage = `${COMPANY_LABELS[company]} 입금이 확인되었습니다.`;
      return {
        ...prev,
        [company]: {
          ...state,
          depositDone: true
        }
      };
    });
    if (errorMessage) {
      setWorkflowError(errorMessage);
      setWorkflowSuccess('');
    } else if (successMessage) {
      setWorkflowError('');
      setWorkflowSuccess(successMessage);
    }
  };

  const handleConfirmComplete = (company) => () => {
    let errorMessage = '';
    let successMessage = '';
    setCompanyWorkflow((prev) => {
      const state = prev[company];
      if (!state.depositDone) {
        errorMessage = '입금완료 후 확인완료를 진행해 주세요.';
        return prev;
      }
      if (state.confirmDone) {
        successMessage = `${COMPANY_LABELS[company]} 정산이 이미 확인되었습니다.`;
        return prev;
      }
      successMessage = `${COMPANY_LABELS[company]} 정산을 확인했습니다.`;
      return {
        ...prev,
        [company]: {
          ...state,
          confirmDone: true
        }
      };
    });
    if (errorMessage) {
      setWorkflowError(errorMessage);
      setWorkflowSuccess('');
    } else if (successMessage) {
      setWorkflowError('');
      setWorkflowSuccess(successMessage);
    }
  };

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
    const laborSheetTotal = manualData.laborSheetTotal ?? 0;
    const costSheetTotal = manualData.costSheetTotal ?? 0;
    const laborManualTotalDisplay = manualData.laborManualTotal ?? manualLaborTotal;
    const costManualTotalDisplay = manualData.costManualTotal ?? manualCostTotal;
    const combinedLaborTotal =
      manualData.laborTotal ?? laborSheetTotal + laborManualTotalDisplay;
    const combinedCostTotal =
      manualData.costTotal ?? costSheetTotal + costManualTotalDisplay;
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
      const depositDisabled = !invoiceChecksDone || !state.isSaved || state.depositDone;
      const confirmDisabled =
        !invoiceChecksDone || !state.depositDone || state.confirmDone;

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
                variant="contained"
                size="small"
                color="primary"
                onClick={handleDepositComplete(companyKey)}
                disabled={depositDisabled}
              >
                입금완료
              </Button>
              <Button
                variant="contained"
                size="small"
                color="success"
                onClick={handleConfirmComplete(companyKey)}
                disabled={confirmDisabled}
              >
                확인완료
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
        <Section title="최종 정산" color={SECTION_COLORS.totals}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
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
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                  >
                    <Button
                      component="a"
                      href="https://www.wehago.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="contained"
                      color="primary"
                      disabled={!invoiceControlsEnabled}
                      sx={{ minWidth: 220 }}
                    >
                      세금계산서 발행 및 승인 바로가기
                    </Button>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={invoiceStatus.issued}
                          onChange={(event) =>
                            setInvoiceStatus((prev) => ({
                              ...prev,
                              issued: event.target.checked && invoiceControlsEnabled
                            }))
                          }
                          disabled={!invoiceControlsEnabled}
                        />
                      }
                      label="세금계산서 발행"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={invoiceStatus.approved}
                          onChange={(event) =>
                            setInvoiceStatus((prev) => ({
                              ...prev,
                              approved: event.target.checked && invoiceControlsEnabled
                            }))
                          }
                          disabled={!invoiceControlsEnabled}
                        />
                      }
                      label="세금계산서 승인"
                    />
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
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="(주)브이아이피플러스 30%"
                value={currencyFormatter.format(combinedSplitVip)}
                color="#6A1B9A"
                activated={vipCompleted}
                animate={vipCompleted}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={vipCompleted}
                        onChange={handleCompanyCompletionToggle('vip')}
                      />
                    }
                    label="정산확인 및 입력완료"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={!vipCompleted} disabled />}
                    label="입력중"
                  />
                </Stack>
              </SummaryCard>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="(주)와이에이 70%"
                value={currencyFormatter.format(combinedSplitYai)}
                color="#00838F"
                activated={yaiCompleted}
                animate={yaiCompleted}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={yaiCompleted}
                        onChange={handleCompanyCompletionToggle('yai')}
                      />
                    }
                    label="정산확인 및 입력완료"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={!yaiCompleted} disabled />}
                    label="입력중"
                  />
                </Stack>
              </SummaryCard>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>항목별 합계:</strong> 맞춤제안 {currencyFormatter.format(customBase)} | 재약정 {currencyFormatter.format(recontractBase)} | 인건비 {currencyFormatter.format(combinedLaborTotal)} (시트 {currencyFormatter.format(laborSheetTotal)} / 수기 {currencyFormatter.format(manualLaborTotal)}) | 비용 {currencyFormatter.format(combinedCostTotal)} (시트 {currencyFormatter.format(costSheetTotal)} / 수기 {currencyFormatter.format(manualCostTotal)})
            </Typography>
          </Box>
          <Collapse in={allConfirmed}>
            <Paper
              elevation={3}
              sx={{
                mt: 3,
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
                한 달간 수고하셨습니다. 다음 달 정산도 함께 달려봅시다! ✨
              </Typography>
            </Paper>
          </Collapse>
        </Section>

        {/* 맞춤제안 섹션 */}
        <Section
          title="맞춤제안"
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
        </Section>

        {/* 재약정 섹션 */}
        <Section
          title="재약정"
          subtitle={`폰클 홈데이터 (91인덱스) 등록직원: ${recontractPromoterNames || '없음'} (${recontractPromoterCount}건)`}
          color={SECTION_COLORS.recontract}
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
                description={`상품권 ${currencyFormatter.format(recontract.offer.giftCard)} / 입금 ${currencyFormatter.format(recontract.offer.deposit)}`}
              />
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
                      <TableCell align="right" sx={{ fontWeight: 600 }}>건수</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>수수료 합계</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>오퍼 합계</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>총액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recontractPromoterStats.map((stat) => (
                      <TableRow key={stat.name}>
                        <TableCell>{stat.name}</TableCell>
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
        </Section>

        {/* 인건비/비용 섹션 */}
        <Section title="인건비 / 비용" color={SECTION_COLORS.laborCost}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              <strong>인건비 합계:</strong> {currencyFormatter.format(combinedLaborTotal)} (시트 {currencyFormatter.format(laborSheetTotal)} / 수기 입력 {currencyFormatter.format(laborManualTotalDisplay)})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>비용 합계:</strong> {currencyFormatter.format(combinedCostTotal)} (시트 {currencyFormatter.format(costSheetTotal)} / 수기 입력 {currencyFormatter.format(costManualTotalDisplay)})
            </Typography>
            <Alert severity="info">
              인건비 및 비용 데이터는 준비 중입니다. 수기 입력 금액은 자동으로 음수(-) 처리되어 최종 합계에 반영됩니다.
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
  ).isRequired
};

export default ObSettlementOverview;
