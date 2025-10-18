import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import LineInputPanel from './LineInputPanel';
import BundleOptionsPanel from './BundleOptionsPanel';

export default function ExistingCalculatorPanel({ inputs, result, onSave, onInputChange, planData, onCustomerNameSync }) {
  const handleLineUpdate = (updated) => {
    onInputChange({ ...inputs, existingLines: updated.lines });
  };

  return (
    <Box sx={{ border: '1px solid #ddd', borderRadius: 1, overflow: 'hidden', backgroundColor: '#fff' }}>
      <Box sx={{ p: 1.5, backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>기존결합 계산식</Typography>
        <BundleOptionsPanel inputs={inputs} onChange={onInputChange} />
      </Box>
      <Box sx={{ p: 1.5 }}>
        <LineInputPanel
          inputs={{ lines: inputs.existingLines || [] }}
          onChange={handleLineUpdate}
          planData={planData}
          panelType="existing"
          onCustomerNameChange={onCustomerNameSync}
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
      <Box sx={{ p: 1.5, pt: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, borderBottom: '1px solid #eee' }}>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1, borderRadius: 1, border: '1px solid #eee' }}>
          <Typography variant="caption" color="text.secondary">선택약정할인</Typography>
          <Typography variant="h6">{Number(result?.selectionDiscount || 0).toLocaleString()}원</Typography>
        </Box>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1, borderRadius: 1, border: '1px solid #eee' }}>
          <Typography variant="caption" color="text.secondary">프리미어할인</Typography>
          <Typography variant="h6">{Number(result?.premierDiscount || 0).toLocaleString()}원</Typography>
        </Box>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1, borderRadius: 1, border: '1px solid #eee' }}>
          <Typography variant="caption" color="text.secondary">인터넷할인</Typography>
          <Typography variant="h6">{Number(result?.internetDiscount || 0).toLocaleString()}원</Typography>
        </Box>
      </Box>
      <Box sx={{ p: 1.5, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>회선</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>고객명</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>요금제</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>약정</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>기본료</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>할인</th>
              <th style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>합계</th>
            </tr>
          </thead>
          <tbody>
            {(result?.rows || []).map(row => {
              const discountSum = (row.discounts || []).reduce((s, d) => s + (d.amount || 0), 0);
              return (
                <tr key={row.lineNo}>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>{row.lineNo}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, fontSize: 11, textAlign: 'center' }}>{row.customerName || '-'}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>{row.planName || '-'}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, fontSize: 11, textAlign: 'center' }}>{row.contractType || '-'}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>{Number(row.baseFee || 0).toLocaleString()}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center', color: discountSum < 0 ? '#d32f2f' : '#000' }}>
                    {discountSum.toLocaleString()}
                  </td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center', fontWeight: 'bold' }}>{Number(row.total || 0).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}


