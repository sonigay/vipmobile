import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  IconButton,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import ObExclusionManager from './ObExclusionManager';

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  } catch (error) {
    return value;
  }
};

const fallback = (value) => (value ? value : '-');

const resolveSheetUrl = (config) => {
  if (!config) return '';
  return config.sheetUrl || (config.sheetId ? `https://docs.google.com/spreadsheets/d/${config.sheetId}` : '');
};

const ObSettlementManagementPanel = ({
  sheetConfigs,
  storageSheetUrl,
  loading,
  error,
  onCreate,
  onEdit,
  onDelete,
  onDownloadTemplate,
  currentUser
}) => {
  const sortedConfigs = [...sheetConfigs].sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  const monthOptions = useMemo(() => {
    const uniqueMonths = Array.from(
      new Set(sortedConfigs.map((config) => config.month).filter(Boolean))
    );
    return uniqueMonths.map((month) => ({
      value: month,
      label: month
    }));
  }, [sortedConfigs]);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            OB 정산 관리
          </Typography>
          <Typography variant="body2" color="text.secondary">
            월별 구글시트 링크와 시트 이름을 등록해 정산 데이터를 자동 연동합니다.
            {storageSheetUrl ? (
              <>
                {' '}
                (<Button
                  size="small"
                  href={storageSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ textTransform: 'none', fontSize: '0.875rem' }}
                >
                  OB정산관리링크관리 시트 열기
                </Button>)
              </>
            ) : null}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={onDownloadTemplate}
          >
            템플릿 안내
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
            월별 링크 등록
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#fafafa' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>연월</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>시트 ID</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>시트 이름</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>추가 시트</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>비고</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>업데이트</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedConfigs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  등록된 월별 링크가 없습니다. <strong>월별 링크 등록</strong> 버튼을 눌러 시작하세요.
                </TableCell>
              </TableRow>
            )}

            {sortedConfigs.map((config) => (
              <TableRow key={config.id || config.month}>
                <TableCell sx={{ fontWeight: 600 }}>{fallback(config.month)}</TableCell>
                <TableCell>
                  {config.sheetId ? (
                    <Tooltip title="구글시트 열기">
                      <Button
                        size="small"
                        href={resolveSheetUrl(config)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {config.sheetId}
                      </Button>
                    </Tooltip>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      size="small"
                      label={`맞춤제안: ${fallback(config.sheetNames?.customProposal)}`}
                    />
                    <Chip
                      size="small"
                      label={`재약정: ${fallback(config.sheetNames?.recontract)}`}
                    />
                    <Chip
                      size="small"
                      label={`후정산: ${fallback(config.sheetNames?.postSettlement)}`}
                    />
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {config.extraSheetNames?.customProposal ? (
                      <Chip
                        size="small"
                        color="default"
                        variant="outlined"
                        label={`기타 맞춤제안: ${config.extraSheetNames.customProposal}`}
                      />
                    ) : null}
                    {config.extraSheetNames?.recontract ? (
                      <Chip
                        size="small"
                        color="default"
                        variant="outlined"
                        label={`기타 재약정: ${config.extraSheetNames.recontract}`}
                      />
                    ) : null}
                    {config.extraSheetNames?.postSettlement ? (
                      <Chip
                        size="small"
                        color="default"
                        variant="outlined"
                        label={`기타 후정산: ${config.extraSheetNames.postSettlement}`}
                      />
                    ) : null}
                    {!config.extraSheetNames ||
                      (!config.extraSheetNames.customProposal &&
                        !config.extraSheetNames.recontract &&
                        !config.extraSheetNames.postSettlement && <Typography variant="caption">-</Typography>)}
                  </Stack>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'pre-line' }}>{fallback(config.notes)}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(config.updatedAt || config.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    <Tooltip title="수정">
                      <IconButton size="small" onClick={() => onEdit?.(config)}>
                        <EditIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="삭제">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onDelete?.(config)}
                      >
                        <DeleteIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      <ObExclusionManager
        monthOptions={monthOptions}
        defaultMonth={sortedConfigs[0]?.month}
        currentUser={currentUser}
      />
    </Box>
  );
};

ObSettlementManagementPanel.propTypes = {
  sheetConfigs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      month: PropTypes.string,
      sheetId: PropTypes.string,
      sheetUrl: PropTypes.string,
      sheetNames: PropTypes.shape({
        customProposal: PropTypes.string,
        recontract: PropTypes.string,
        postSettlement: PropTypes.string
      }),
      extraSheetNames: PropTypes.shape({
        customProposal: PropTypes.string,
        recontract: PropTypes.string,
        postSettlement: PropTypes.string
      }),
      notes: PropTypes.string,
      createdAt: PropTypes.string,
      updatedAt: PropTypes.string
    })
  ),
  storageSheetUrl: PropTypes.string,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onCreate: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onDownloadTemplate: PropTypes.func,
  currentUser: PropTypes.string
};

ObSettlementManagementPanel.defaultProps = {
  sheetConfigs: [],
  storageSheetUrl: '',
  loading: false,
  error: '',
  onCreate: undefined,
  onEdit: undefined,
  onDelete: undefined,
  onDownloadTemplate: undefined,
  currentUser: ''
};

export default ObSettlementManagementPanel;

