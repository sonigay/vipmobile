import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  TextField,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api';

const TYPE_LABELS = {
  recontract: '재약정',
  postSettlement: '후정산'
};

const EMPTY_FORM = {
  type: 'recontract',
  outletName: '',
  reason: '',
  note: ''
};

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

const ObTargetOutletManager = ({ monthOptions, defaultMonth, currentUser }) => {
  const fallbackMonth = useMemo(() => {
    if (defaultMonth) return defaultMonth;
    if (monthOptions.length > 0) return monthOptions[0].value;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [defaultMonth, monthOptions]);

  const [selectedMonth, setSelectedMonth] = useState(fallbackMonth);
  const [targetOutlets, setTargetOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(EMPTY_FORM);

  const monthSelectOptions = useMemo(() => {
    if (monthOptions.length > 0) return monthOptions;
    return [
      {
        value: fallbackMonth,
        label: fallbackMonth
      }
    ];
  }, [monthOptions, fallbackMonth]);

  const handleFetch = useCallback(async () => {
    if (!selectedMonth) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getObTargetOutlets({ month: selectedMonth });
      setTargetOutlets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[OB] target outlet load error:', err);
      setTargetOutlets([]);
      setError(err.message || '대상점 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    handleFetch();
  }, [handleFetch]);

  const handleOpenDialog = (entry = null) => {
    if (entry) {
      setDialogMode('edit');
      setEditingId(entry.id);
      setFormValues({
        type: entry.type || 'recontract',
        outletName: entry.outletName || '',
        reason: entry.reason || '',
        note: entry.note || ''
      });
    } else {
      setDialogMode('create');
      setEditingId(null);
      setFormValues(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormValues(EMPTY_FORM);
  };

  const handleFormChange = (field) => (event) => {
    setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async () => {
    if (!formValues.outletName || !formValues.outletName.trim()) {
      setError('대상점명을 입력해주세요.');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');

      const payload = {
        month: selectedMonth,
        type: formValues.type || 'recontract',
        outletName: formValues.outletName.trim(),
        reason: formValues.reason.trim(),
        note: formValues.note.trim(),
        registrant: currentUser || ''
      };

      if (dialogMode === 'create') {
        await api.createObTargetOutlet(payload);
        setSuccessMessage('대상점을 등록했습니다.');
      } else {
        await api.updateObTargetOutlet(editingId, payload);
        setSuccessMessage('대상점을 수정했습니다.');
      }

      handleCloseDialog();
      await handleFetch();
    } catch (err) {
      console.error('[OB] target outlet save error:', err);
      setError(err.message || '대상점을 저장하지 못했습니다.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 이 대상점을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
      await api.deleteObTargetOutlet(id, selectedMonth);
      setSuccessMessage('대상점을 삭제했습니다.');
      await handleFetch();
    } catch (err) {
      console.error('[OB] target outlet delete error:', err);
      setError(err.message || '대상점을 삭제하지 못했습니다.');
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">대상점 관리</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              select
              label="연월"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            >
              {monthSelectOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              size="small"
            >
              대상점 추가
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>연월</TableCell>
              <TableCell>구분</TableCell>
              <TableCell>대상점명</TableCell>
              <TableCell>사유</TableCell>
              <TableCell>비고</TableCell>
              <TableCell>등록자</TableCell>
              <TableCell>등록일시</TableCell>
              <TableCell align="center">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  로딩 중...
                </TableCell>
              </TableRow>
            ) : targetOutlets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  등록된 대상점이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              targetOutlets.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.month || '-'}</TableCell>
                  <TableCell>{TYPE_LABELS[entry.type] || '-'}</TableCell>
                  <TableCell>{entry.outletName || '-'}</TableCell>
                  <TableCell>{entry.reason || '-'}</TableCell>
                  <TableCell>{entry.note || '-'}</TableCell>
                  <TableCell>{entry.registrant || '-'}</TableCell>
                  <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => handleOpenDialog(entry)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {dialogMode === 'create' ? '대상점 등록' : '대상점 수정'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="연월"
              value={selectedMonth}
              size="small"
              disabled
            />
            <TextField
              select
              label="구분"
              value={formValues.type}
              onChange={handleFormChange('type')}
              size="small"
              required
            >
              <MenuItem value="recontract">{TYPE_LABELS.recontract}</MenuItem>
              <MenuItem value="postSettlement">{TYPE_LABELS.postSettlement}</MenuItem>
            </TextField>
            <TextField
              label="대상점명"
              value={formValues.outletName}
              onChange={handleFormChange('outletName')}
              size="small"
              placeholder="예: 강남점"
              required
            />
            <TextField
              label="사유"
              value={formValues.reason}
              onChange={handleFormChange('reason')}
              size="small"
              placeholder="대상점 지정 사유를 입력하세요"
              multiline
              rows={2}
            />
            <TextField
              label="비고"
              value={formValues.note}
              onChange={handleFormChange('note')}
              size="small"
              placeholder="추가 메모"
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {dialogMode === 'create' ? '등록' : '수정'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessMessage('')} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

ObTargetOutletManager.propTypes = {
  monthOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ).isRequired,
  defaultMonth: PropTypes.string,
  currentUser: PropTypes.string
};

ObTargetOutletManager.defaultProps = {
  defaultMonth: null,
  currentUser: ''
};

export default ObTargetOutletManager;

