import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import LineInputPanel from './LineInputPanel';

export default function TogetherCalculatorPanel({ inputs, result, onSave, onInputChange, planData, onCustomerNameSync }) {
  const handleLineUpdate = (updated) => {
    onInputChange({ ...inputs, togetherLines: updated.lines });
  };

  return (
    <Box sx={{ 
      border: '1px solid #e0e0e0', 
      borderRadius: 2, 
      overflow: 'hidden', 
      backgroundColor: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.3s ease',
      '&:hover': {
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
      }
    }}>
      <Box sx={{ 
        p: 2, 
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
        borderBottom: '1px solid #e0e0e0',
        minHeight: 106,
        display: 'flex',
        alignItems: 'center'
      }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#fff' }}>투게더결합 계산식</Typography>
      </Box>
      <Box sx={{ p: 1.5 }}>
        <LineInputPanel
          inputs={{ lines: inputs.togetherLines || [] }}
          onChange={handleLineUpdate}
          planData={planData}
          panelType="together"
          onCustomerNameChange={onCustomerNameSync}
        />
      </Box>
      <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, borderBottom: '1px solid #f0f0f0' }}>
        <Box sx={{ 
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
          p: 1.5, 
          borderRadius: 1.5, 
          boxShadow: '0 2px 6px rgba(240,147,251,0.3)',
          transition: 'transform 0.2s',
          '&:hover': { transform: 'translateY(-2px)' }
        }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>총액</Typography>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>{Number(result?.amount || 0).toLocaleString()}원</Typography>
        </Box>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1.5, borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
          <Typography variant="caption" color="text.secondary">회선수</Typography>
          <Typography variant="h6">{inputs?.togetherLines?.length || 0}개</Typography>
        </Box>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1.5, borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
          <Typography variant="caption" color="text.secondary">투게더할인</Typography>
          <Typography variant="h6" sx={{ color: '#d32f2f' }}>{Number(result?.togetherBundleDiscount || 0).toLocaleString()}원</Typography>
        </Box>
      </Box>
      <Box sx={{ p: 2, pt: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, borderBottom: '1px solid #f0f0f0' }}>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1.5, borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
          <Typography variant="caption" color="text.secondary">선택약정할인</Typography>
          <Typography variant="h6" sx={{ color: '#d32f2f' }}>{Number(result?.selectionDiscount || 0).toLocaleString()}원</Typography>
        </Box>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1.5, borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
          <Typography variant="caption" color="text.secondary">프리미어할인</Typography>
          <Typography variant="h6" sx={{ color: '#d32f2f' }}>{Number(result?.premierDiscount || 0).toLocaleString()}원</Typography>
        </Box>
        <Box sx={{ backgroundColor: '#f9fafb', p: 1.5, borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
          <Typography variant="caption" color="text.secondary">인터넷할인</Typography>
          <Typography variant="h6" sx={{ color: '#d32f2f' }}>{Number(result?.internetDiscount || 0).toLocaleString()}원</Typography>
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


