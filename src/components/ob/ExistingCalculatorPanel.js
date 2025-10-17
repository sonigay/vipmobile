import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import LineInputPanel from './LineInputPanel';

export default function ExistingCalculatorPanel({ inputs, result, onSave, onInputChange, planData }) {
  return (
    <Box sx={{ border: '1px solid #ddd', borderRadius: 1, overflow: 'hidden', backgroundColor: '#fff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
        <Typography variant="subtitle1" fontWeight="bold">기존결합 계산식</Typography>
        <Button variant="contained" size="small" onClick={onSave}>저장</Button>
      </Box>
      <Box sx={{ p: 1.5 }}>
        <LineInputPanel
          inputs={{ lines: inputs.existingLines || [] }}
          onChange={(updated) => onInputChange({ ...inputs, existingLines: updated.lines })}
          planData={planData}
          panelType="existing"
        />
      </Box>
      <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, borderBottom: '1px solid #eee' }}>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1, borderRadius: 1, border: '1px solid #eee' }}>
          <Typography variant="caption" color="text.secondary">총액</Typography>
          <Typography variant="h6">{Number(result?.amount || 0).toLocaleString()}원</Typography>
        </Box>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1, borderRadius: 1, border: '1px solid #eee' }}>
          <Typography variant="caption" color="text.secondary">회선수</Typography>
          <Typography variant="h6">{inputs?.existingLines?.length || 0}개</Typography>
        </Box>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1, borderRadius: 1, border: '1px solid #eee' }}>
          <Typography variant="caption" color="text.secondary">결합할인</Typography>
          <Typography variant="h6">{Number(result?.bundleDiscount || 0).toLocaleString()}원</Typography>
        </Box>
      </Box>
      <Box sx={{ p: 1.5, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={{ border: '1px solid #e5e7eb', padding: 6 }}>line#</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6 }}>요금제</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6 }}>약정</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6 }}>기본료</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6 }}>할인</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6 }}>합계</th>
            </tr>
          </thead>
          <tbody>
            {(result?.rows || []).map(row => {
              const discountSum = (row.discounts || []).reduce((s, d) => s + (d.amount || 0), 0);
              return (
                <tr key={row.lineNo}>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{row.lineNo}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{row.planName || '-'}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, fontSize: 11 }}>{row.contractType || '-'}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'right' }}>{Number(row.baseFee || 0).toLocaleString()}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'right', color: discountSum < 0 ? '#d32f2f' : '#000' }}>
                    {discountSum.toLocaleString()}
                  </td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'right', fontWeight: 'bold' }}>{Number(row.total || 0).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}


