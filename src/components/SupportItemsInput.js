import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

const SupportItemsInput = ({ value, onChange, isDirectInput, onDirectInputChange }) => {
  const [supportItems, setSupportItems] = useState({
    basic: [], // 기본: 모델유형/요금제군/범위/유형/금액
    additional: [], // 부가: 부가유형/유치,차감/금액
    other: [], // 기타: 정책명/내용/금액
    freeText: '' // 자유입력
  });

  // 초기값 설정 (직접입력 모드가 아닐 때만)
  useEffect(() => {
    if (!isDirectInput && value) {
      // value가 이미 포맷팅된 문자열이면 supportItems로 파싱 불가
      // 따라서 value는 사용하지 않고 supportItems는 빈 상태로 시작
      // 사용자가 지원사항을 추가하면 자동으로 포맷팅됨
    }
  }, [isDirectInput]);

  // 지원사항 변경 시 자동 포맷팅
  useEffect(() => {
    if (isDirectInput) return; // 직접입력 모드면 자동 포맷팅 안 함

    const lines = [];

    // 기본 타입 포맷팅
    if (supportItems.basic && supportItems.basic.length > 0) {
      supportItems.basic.forEach(item => {
        if (item.modelType && item.rateGrade && item.activationType && item.amount) {
          const rateGradeText = item.rateRange && item.rateRange !== '해당군' 
            ? `${item.rateGrade} ${item.rateRange}` 
            : item.rateGrade;
          const amountNum = Number(item.amount);
          const amountText = (amountNum >= 10000 && amountNum % 10000 === 0) 
            ? `+${amountNum / 10000}만`
            : `+${amountNum.toLocaleString()}원`;
          lines.push(`💰 ${item.modelType} / ${rateGradeText} / ${item.activationType} / ${amountText}`);
        }
      });
    }

    // 부가 타입 포맷팅
    if (supportItems.additional && supportItems.additional.length > 0) {
      supportItems.additional.forEach(item => {
        if (item.additionalType && item.acquisitionType && item.amount) {
          const amountNum = Number(item.amount);
          const amountText = (amountNum >= 10000 && amountNum % 10000 === 0) 
            ? `${amountNum / 10000}만`
            : `${amountNum.toLocaleString()}원`;
          const prefix = item.acquisitionType === '유치' ? '+' : '-';
          lines.push(`💳 ${item.additionalType} / ${item.acquisitionType} / ${prefix}${amountText}`);
        }
      });
    }

    // 기타 타입 포맷팅
    if (supportItems.other && supportItems.other.length > 0) {
      supportItems.other.forEach(item => {
        if (item.policyName && item.content && item.amount) {
          const amountNum = Number(item.amount);
          const amountText = (amountNum >= 10000 && amountNum % 10000 === 0) 
            ? `${amountNum / 10000}만`
            : `${amountNum.toLocaleString()}원`;
          lines.push(`📌 ${item.policyName} / ${item.content} / ${amountText}`);
        }
      });
    }

    // 자유입력 추가
    if (supportItems.freeText && supportItems.freeText.trim()) {
      lines.push(`📝 ${supportItems.freeText.trim()}`);
    }

    if (onChange) {
      if (lines.length > 0) {
        onChange(lines.join('\n'));
      } else {
        // 지원사항이 없으면 빈 문자열로 설정
        onChange('');
      }
    }
  }, [supportItems, isDirectInput, onChange]);

  const handleAddBasic = () => {
    setSupportItems(prev => ({
      ...prev,
      basic: [...(prev.basic || []), {
        modelType: '',
        rateGrade: '',
        rateRange: '해당군',
        activationType: '',
        amount: ''
      }]
    }));
  };

  const handleAddAdditional = () => {
    setSupportItems(prev => ({
      ...prev,
      additional: [...(prev.additional || []), {
        additionalType: '',
        acquisitionType: '유치',
        amount: ''
      }]
    }));
  };

  const handleAddOther = () => {
    setSupportItems(prev => ({
      ...prev,
      other: [...(prev.other || []), {
        policyName: '',
        content: '',
        amount: ''
      }]
    }));
  };

  const handleRemoveBasic = (index) => {
    setSupportItems(prev => ({
      ...prev,
      basic: prev.basic.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveAdditional = (index) => {
    setSupportItems(prev => ({
      ...prev,
      additional: prev.additional.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveOther = (index) => {
    setSupportItems(prev => ({
      ...prev,
      other: prev.other.filter((_, i) => i !== index)
    }));
  };

  const handleBasicChange = (index, field, value) => {
    setSupportItems(prev => {
      const newBasic = [...prev.basic];
      newBasic[index] = { ...newBasic[index], [field]: value };
      return { ...prev, basic: newBasic };
    });
  };

  const handleAdditionalChange = (index, field, value) => {
    setSupportItems(prev => {
      const newAdditional = [...prev.additional];
      newAdditional[index] = { ...newAdditional[index], [field]: value };
      return { ...prev, additional: newAdditional };
    });
  };

  const handleOtherChange = (index, field, value) => {
    setSupportItems(prev => {
      const newOther = [...prev.other];
      newOther[index] = { ...newOther[index], [field]: value };
      return { ...prev, other: newOther };
    });
  };

  return (
    <Box>
      {!isDirectInput && (
        <>
          {/* 기본 타입 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                기본
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddBasic}
              >
                추가
              </Button>
            </Box>
            {supportItems.basic && supportItems.basic.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  label="모델유형"
                  value={item.modelType || ''}
                  onChange={(e) => handleBasicChange(index, 'modelType', e.target.value)}
                  size="small"
                  sx={{ minWidth: 120 }}
                  placeholder="예: 갤럭시 S24"
                />
                <TextField
                  label="요금제군"
                  value={item.rateGrade || ''}
                  onChange={(e) => handleBasicChange(index, 'rateGrade', e.target.value)}
                  size="small"
                  sx={{ minWidth: 100 }}
                  placeholder="예: S군"
                />
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>범위</InputLabel>
                  <Select
                    value={item.rateRange || '해당군'}
                    label="범위"
                    onChange={(e) => handleBasicChange(index, 'rateRange', e.target.value)}
                  >
                    <MenuItem value="해당군">해당군</MenuItem>
                    <MenuItem value="이상">이상</MenuItem>
                    <MenuItem value="미만">미만</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="유형"
                  value={item.activationType || ''}
                  onChange={(e) => handleBasicChange(index, 'activationType', e.target.value)}
                  size="small"
                  sx={{ minWidth: 100 }}
                  placeholder="예: 신규, MNP"
                />
                <TextField
                  label="금액"
                  value={item.amount || ''}
                  onChange={(e) => handleBasicChange(index, 'amount', e.target.value)}
                  type="number"
                  size="small"
                  sx={{ minWidth: 120 }}
                  placeholder="금액 입력"
                  inputProps={{ min: 0 }}
                />
                <IconButton
                  color="error"
                  onClick={() => handleRemoveBasic(index)}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>

          {/* 부가 타입 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                부가
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddAdditional}
              >
                추가
              </Button>
            </Box>
            {supportItems.additional && supportItems.additional.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  label="부가유형"
                  value={item.additionalType || ''}
                  onChange={(e) => handleAdditionalChange(index, 'additionalType', e.target.value)}
                  size="small"
                  sx={{ minWidth: 150 }}
                  placeholder="예: 부가미유치, 보험미유치"
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>유치,차감</InputLabel>
                  <Select
                    value={item.acquisitionType || '유치'}
                    label="유치,차감"
                    onChange={(e) => handleAdditionalChange(index, 'acquisitionType', e.target.value)}
                  >
                    <MenuItem value="유치">유치</MenuItem>
                    <MenuItem value="차감">차감</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="금액"
                  value={item.amount || ''}
                  onChange={(e) => handleAdditionalChange(index, 'amount', e.target.value)}
                  type="number"
                  size="small"
                  sx={{ minWidth: 120 }}
                  placeholder="금액 입력"
                  inputProps={{ min: 0 }}
                />
                <IconButton
                  color="error"
                  onClick={() => handleRemoveAdditional(index)}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>

          {/* 기타 타입 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                기타
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddOther}
              >
                추가
              </Button>
            </Box>
            {supportItems.other && supportItems.other.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  label="정책명"
                  value={item.policyName || ''}
                  onChange={(e) => handleOtherChange(index, 'policyName', e.target.value)}
                  size="small"
                  sx={{ minWidth: 150 }}
                  placeholder="정책명 입력"
                />
                <TextField
                  label="내용"
                  value={item.content || ''}
                  onChange={(e) => handleOtherChange(index, 'content', e.target.value)}
                  size="small"
                  sx={{ minWidth: 200 }}
                  placeholder="내용 입력"
                />
                <TextField
                  label="금액"
                  value={item.amount || ''}
                  onChange={(e) => handleOtherChange(index, 'amount', e.target.value)}
                  type="number"
                  size="small"
                  sx={{ minWidth: 120 }}
                  placeholder="금액 입력"
                  inputProps={{ min: 0 }}
                />
                <IconButton
                  color="error"
                  onClick={() => handleRemoveOther(index)}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>

          {/* 자유입력 필드 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
              자유입력
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={supportItems.freeText || ''}
              onChange={(e) => setSupportItems(prev => ({ ...prev, freeText: e.target.value }))}
              placeholder="자유롭게 내용을 입력하세요"
              size="small"
            />
          </Box>
        </>
      )}
    </Box>
  );
};

export default SupportItemsInput;

