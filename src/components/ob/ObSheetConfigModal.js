import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  Stack,
  Typography
} from '@mui/material';

const DEFAULT_FORM = {
  id: undefined,
  month: '',
  sheetUrlOrId: '',
  sheetId: '',
  sheetUrl: '',
  sheetNames: {
    customProposal: '',
    recontract: '',
    postSettlement: ''
  },
  extraSheetNames: {
    customProposal: '',
    recontract: '',
    postSettlement: ''
  },
  notes: ''
};

const extractSheetId = (value = '') => {
  if (!value) return '';
  const trimmed = value.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{10,}$/.test(trimmed)) return trimmed;
  return '';
};

const formatMonthValue = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  } catch (error) {
    console.warn('Failed to format month value', value, error);
  }
  return '';
};

const ObSheetConfigModal = ({ open, initialValues, onClose, onSubmit }) => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});

  const title = useMemo(
    () => (initialValues?.id ? '시트 구성 수정' : '시트 구성 등록'),
    [initialValues?.id]
  );

  useEffect(() => {
    if (open) {
      const month = initialValues?.month || formatMonthValue(new Date());
      setForm({
        ...DEFAULT_FORM,
        ...initialValues,
        month,
        sheetUrlOrId: initialValues?.sheetUrl || initialValues?.sheetId || '',
        sheetNames: {
          ...DEFAULT_FORM.sheetNames,
          ...initialValues?.sheetNames
        },
        extraSheetNames: {
          ...DEFAULT_FORM.extraSheetNames,
          ...initialValues?.extraSheetNames
        }
      });
      setErrors({});
    }
  }, [initialValues, open]);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedChange = (group, field, value) => {
    setForm((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [field]: value
      }
    }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.month) {
      nextErrors.month = '연월을 선택해주세요.';
    }
    const resolvedSheetId = extractSheetId(form.sheetUrlOrId);
    if (!resolvedSheetId) {
      nextErrors.sheetUrlOrId = '올바른 구글시트 링크 또는 ID를 입력해주세요.';
    }
    if (!form.sheetNames.customProposal) {
      nextErrors.customProposal = '맞춤제안 시트 이름을 입력해주세요.';
    }
    if (!form.sheetNames.recontract) {
      nextErrors.recontract = '재약정 시트 이름을 입력해주세요.';
    }
    if (!form.sheetNames.postSettlement) {
      nextErrors.postSettlement = '후정산 시트 이름을 입력해주세요.';
    }

    setErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      resolvedSheetId
    };
  };

  const handleSubmit = () => {
    const { isValid, resolvedSheetId } = validate();
    if (!isValid) return;

    const payload = {
      ...form,
      month: formatMonthValue(form.month),
      sheetId: resolvedSheetId,
      sheetUrl: form.sheetUrlOrId?.startsWith('http')
        ? form.sheetUrlOrId.trim()
        : `https://docs.google.com/spreadsheets/d/${resolvedSheetId}`,
      updatedAt: new Date().toISOString()
    };

    onSubmit?.(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="연월"
                type="month"
                value={form.month}
                onChange={(event) => handleChange('month', event.target.value)}
                error={Boolean(errors.month)}
                helperText={errors.month || '정산에 사용할 연월을 선택하세요.'}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="구글시트 링크 또는 ID"
                value={form.sheetUrlOrId}
                onChange={(event) => handleChange('sheetUrlOrId', event.target.value)}
                error={Boolean(errors.sheetUrlOrId)}
                helperText={
                  errors.sheetUrlOrId ||
                  '예: https://docs.google.com/spreadsheets/d/{시트ID} 또는 시트ID만 입력'
                }
              />
            </Grid>
          </Grid>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">시트 이름</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="시트 이름(맞춤제안)"
                  value={form.sheetNames.customProposal}
                  onChange={(event) =>
                    handleNestedChange('sheetNames', 'customProposal', event.target.value)
                  }
                  error={Boolean(errors.customProposal)}
                  helperText={errors.customProposal || ''}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="시트 이름(재약정)"
                  value={form.sheetNames.recontract}
                  onChange={(event) =>
                    handleNestedChange('sheetNames', 'recontract', event.target.value)
                  }
                  error={Boolean(errors.recontract)}
                  helperText={errors.recontract || ''}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="시트 이름(후정산)"
                  value={form.sheetNames.postSettlement}
                  onChange={(event) =>
                    handleNestedChange('sheetNames', 'postSettlement', event.target.value)
                  }
                  error={Boolean(errors.postSettlement)}
                  helperText={errors.postSettlement || ''}
                />
              </Grid>
            </Grid>
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">추가 시트 이름 (선택)</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="기타맞춤제안 시트"
                  value={form.extraSheetNames.customProposal}
                  onChange={(event) =>
                    handleNestedChange('extraSheetNames', 'customProposal', event.target.value)
                  }
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="기타재약정 시트"
                  value={form.extraSheetNames.recontract}
                  onChange={(event) =>
                    handleNestedChange('extraSheetNames', 'recontract', event.target.value)
                  }
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="기타후정산 시트"
                  value={form.extraSheetNames.postSettlement}
                  onChange={(event) =>
                    handleNestedChange('extraSheetNames', 'postSettlement', event.target.value)
                  }
                />
              </Grid>
            </Grid>
          </Stack>

          <TextField
            fullWidth
            label="비고"
            multiline
            minRows={2}
            value={form.notes}
            onChange={(event) => handleChange('notes', event.target.value)}
            placeholder="추가 참고 사항이 있다면 입력하세요."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          취소
        </Button>
        <Button onClick={handleSubmit} variant="contained">
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ObSheetConfigModal.propTypes = {
  open: PropTypes.bool.isRequired,
  initialValues: PropTypes.shape({
    id: PropTypes.string,
    month: PropTypes.string,
    sheetUrlOrId: PropTypes.string,
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
    notes: PropTypes.string
  }),
  onClose: PropTypes.func,
  onSubmit: PropTypes.func
};

ObSheetConfigModal.defaultProps = {
  initialValues: undefined,
  onClose: undefined,
  onSubmit: undefined
};

export default ObSheetConfigModal;

