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
  custom: '맞춤제안',
  recontract: '재약정'
};

const EMPTY_FORM = {
  targetId: '',
  targetName: '',
  reason: '',
  note: ''
};

const ObExclusionManager = ({ monthOptions, defaultMonth, currentUser }) => {
  const fallbackMonth = useMemo(() => {
    if (defaultMonth) return defaultMonth;
    if (monthOptions.length > 0) return monthOptions[0].value;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [defaultMonth, monthOptions]);

  const [selectedMonth, setSelectedMonth] = useState(fallbackMonth);
  const [customExclusions, setCustomExclusions] = useState([]);
  const [recontractExclusions, setRecontractExclusions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('custom');
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
      const response = await api.getObExclusions({ month: selectedMonth, type: 'all' });
      const data = response?.data || {};
      setCustomExclusions(Array.isArray(data.custom) ? data.custom : []);
      setRecontractExclusions(Array.isArray(data.recontract) ? data.recontract : []);
    } catch (err) {
      console.error('[OB] exclusion load error:', err);
      setCustomExclusions([]);
      setRecontractExclusions([]);
      setError(err.message || '제외 인원 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    handleFetch();
  }, [handleFetch]);

  const handleOpenDialog = (type, entry = null) => {
    setDialogType(type);
    if (entry) {
      setDialogMode('edit');
      setEditingId(entry.id);
      setFormValues({
        targetId: entry.targetId || '',
        targetName: entry.targetName || '',
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
    const { value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    const payload = {
      month: selectedMonth,
      type: dialogType,
      targetId: formValues.targetId?.trim() || '',
      targetName: formValues.targetName?.trim() || '',
      reason: formValues.reason?.trim() || '',
      note: formValues.note?.trim() || '',
      registrant: currentUser || ''
    };

    if (!payload.targetId && !payload.targetName) {
      setError('유치자 ID 또는 유치자명을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (dialogMode === 'create') {
        await api.createObExclusion(payload);
        setSuccessMessage('제외 인원을 등록했습니다.');
      } else {
        await api.updateObExclusion(editingId, payload);
        setSuccessMessage('제외 인원을 수정했습니다.');
      }
      handleCloseDialog();
      await handleFetch();
    } catch (err) {
      console.error('[OB] exclusion save error:', err);
      setError(err.message || '제외 인원을 저장하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!entry?.id) return;
    const confirmDelete = window.confirm(
      `[${TYPE_LABELS[entry.type] || entry.type}] ${entry.targetName || entry.targetId} 항목을 삭제할까요?`
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      setError('');
      await api.deleteObExclusion(entry.id);
      setSuccessMessage('제외 인원을 삭제했습니다.');
      await handleFetch();
    } catch (err) {
      console.error('[OB] exclusion delete error:', err);
      setError(err.message || '제외 인원을 삭제하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (title, type, items) => (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {title}
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog(type)}
        >
          추가
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>유치자ID</TableCell>
            <TableCell>유치자명</TableCell>
            <TableCell>사유</TableCell>
            <TableCell>등록자</TableCell>
            <TableCell>등록일시</TableCell>
            <TableCell align="center">관리</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center">
                {loading ? '로딩 중...' : '등록된 제외 인원이 없습니다.'}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.targetId || '-'}</TableCell>
                <TableCell>{item.targetName || '-'}</TableCell>
                <TableCell>{item.reason || '-'}</TableCell>
                <TableCell>{item.registrant || '-'}</TableCell>
                <TableCell>{item.createdAt ? item.createdAt.replace('T', ' ').replace('Z', '') : '-'}</TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => handleOpenDialog(type, item)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(item)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Paper>
  );

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
        <Typography variant="h6" fontWeight={700}>
          제외 인원 관리
        </Typography>
        <TextField
          select
          size="small"
          label="연월 선택"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          sx={{ minWidth: 160, maxWidth: 220 }}
        >
          {monthSelectOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
        해당 월에 제외할 맞춤제안/재약정 인원을 등록하면 정산 계산에서 자동 제외됩니다.
      </Typography>

      <Stack spacing={2}>
        {renderTable('맞춤제안 제외 인원', 'custom', customExclusions)}
        {renderTable('재약정 제외 인원', 'recontract', recontractExclusions)}
      </Stack>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {dialogMode === 'create'
            ? `${TYPE_LABELS[dialogType]} 제외 인원 등록`
            : `${TYPE_LABELS[dialogType]} 제외 인원 수정`}
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
              label="유치자 ID"
              value={formValues.targetId}
              onChange={handleFormChange('targetId')}
              size="small"
              placeholder="예: a306891291"
            />
            <TextField
              label="유치자명"
              value={formValues.targetName}
              onChange={handleFormChange('targetName')}
              size="small"
              placeholder="예: 정다운"
            />
            <TextField
              label="사유"
              value={formValues.reason}
              onChange={handleFormChange('reason')}
              size="small"
              placeholder="제외 사유를 입력하세요"
            />
            <TextField
              label="비고"
              value={formValues.note}
              onChange={handleFormChange('note')}
              size="small"
              placeholder="추가 메모"
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
        <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessMessage('')} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

ObExclusionManager.propTypes = {
  monthOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ),
  defaultMonth: PropTypes.string,
  currentUser: PropTypes.string
};

ObExclusionManager.defaultProps = {
  monthOptions: [],
  defaultMonth: '',
  currentUser: ''
};

export default ObExclusionManager;

