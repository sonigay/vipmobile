import React, { useEffect, useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Select,
  Stack,
  Typography
} from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';
import api from '../../api';

const currencyFormatter = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat('ko-KR');

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
  { key: 'outlet', label: '출고처' },
  { key: 'status', label: '상태' },
  { key: 'settlementAmount', label: '정산금액' },
  { key: 'remarkPlate', label: '동판-비고' },
  { key: 'remarkRecontract', label: '재약정-비고' },
  { key: 'offerGiftCard', label: '상품권 지급액' },
  { key: 'offerDeposit', label: '입금 지급액' },
  { key: 'promoterId', label: '유치자ID' },
  { key: 'promoterName', label: '유치자명' }
];

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

const SummaryCard = ({ title, value, description, color }) => (
  <Card>
    <CardContent>
      <Typography variant="subtitle2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color || 'text.primary' }}>
        {value}
      </Typography>
      {description ? (
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      ) : null}
    </CardContent>
  </Card>
);

SummaryCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  description: PropTypes.string,
  color: PropTypes.string
};

SummaryCard.defaultProps = {
  description: '',
  color: undefined
};

const ObSettlementOverview = ({ sheetConfigs }) => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (sheetConfigs && sheetConfigs.length > 0) {
      setSelectedMonth((prev) => prev || sheetConfigs[0].month);
    }
  }, [sheetConfigs]);

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

  const monthOptions = useMemo(
    () => sheetConfigs.map((config) => ({ value: config.month, label: config.month })),
    [sheetConfigs]
  );

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

    return (
      <Stack spacing={4}>
        {downloadError ? (
          <Alert severity="error" onClose={() => setDownloadError('')}>
            {downloadError}
          </Alert>
        ) : null}

        {/* 맞춤제안 섹션 */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            맞춤제안
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="정책① 기본 (2배 지급)"
                value={currencyFormatter.format(customProposal.policy1.payout)}
                description={`매출 합계: ${currencyFormatter.format(customProposal.policy1.totalSales)}`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="정책② 테마 업셀"
                value={currencyFormatter.format(customProposal.policy2.qualifyingSales)}
                description="테마 업셀 플래그가 1인 매출 합계"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="정책③ 인건비 지원"
                value={currencyFormatter.format(customProposal.policy3.payout)}
                description={customProposal.policy3.tier
                  ? `기준 매출 ${numberFormatter.format(customProposal.policy3.tier.sales)}만원 이상 → ${numberFormatter.format(customProposal.policy3.tier.payout)}만원 지급`
                  : '기준 매출 미달'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="건수 구간별 지급"
                value={currencyFormatter.format(customProposal.perCase.payout)}
                description={customProposal.perCase.threshold
                  ? `${numberFormatter.format(customProposal.perCase.count)}건 × ${currencyFormatter.format(customProposal.perCase.unitAmount)}`
                  : `${numberFormatter.format(customProposal.perCase.count)}건`}
              />
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              총 지급액: <strong>{currencyFormatter.format(customProposal.totalPayout)}</strong> (대상 {numberFormatter.format(customProposal.includedCount)}건, 제외 {numberFormatter.format(customProposal.excluded.count)}건)
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

        <Divider />

        {/* 재약정 섹션 */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            재약정
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="재약정 수수료"
                value={currencyFormatter.format(recontract.feeTotal)}
                description={`대상 ${numberFormatter.format(recontract.includedCount)}건`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="재약정 오퍼 지급"
                value={currencyFormatter.format(recontract.offer.total)}
                description={`상품권 ${currencyFormatter.format(recontract.offer.giftCard)} / 입금 ${currencyFormatter.format(recontract.offer.deposit)}`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="재약정 총 지급액"
                value={currencyFormatter.format(recontract.totalPayout)}
                description={`제외 ${numberFormatter.format(recontract.excludedCount)}건`}
              />
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              수수료 + 오퍼 금액 합계
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

        <Divider />

        {/* 인건비/비용 섹션 (준비 중) */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            인건비 / 비용
          </Typography>
          <Alert severity="info">
            인건비 및 비용 데이터는 준비 중입니다. 데이터가 준비되면 여기에 표시됩니다.
          </Alert>
        </Box>

        <Divider />

        {/* 최종 정산 섹션 */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            최종 정산
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="총 정산 금액"
                value={currencyFormatter.format(totals.grandTotal)}
                description={`맞춤제안 ${currencyFormatter.format(totals.customTotal)} + 재약정 ${currencyFormatter.format(totals.recontractTotal)}`}
                color="#1976d2"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="(주)브이아이피플러스 30%"
                value={currencyFormatter.format(totals.split.vip)}
                color="#6A1B9A"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SummaryCard
                title="(주)와이에이 70%"
                value={currencyFormatter.format(totals.split.yai)}
                color="#00838F"
              />
            </Grid>
          </Grid>
        </Box>
      </Stack>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            OB 정산 확인
          </Typography>
          <Typography variant="body2" color="text.secondary">
            월별 정산 데이터를 확인하고 엑셀 파일로 다운로드할 수 있습니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">연월 선택</Typography>
          <Select size="small" value={selectedMonth} onChange={handleMonthChange}>
            {monthOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </Stack>
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
