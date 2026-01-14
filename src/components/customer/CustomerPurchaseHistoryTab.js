import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { LoadingState } from '../direct/common/LoadingState';
import { ErrorState } from '../direct/common/ErrorState';
import { ModernTable, ModernTableCell, HoverableTableRow, EmptyTableRow } from '../direct/common/ModernTable';
import OpeningInfoPage from '../direct/OpeningInfoPage';
import { reverseConvertOpeningType } from '../../utils/directStoreUtils';

/**
 * 고객모드 - 나의 구매 내역 탭
 * 직영점_판매일보 시트에서 CTN 기준으로 본인 구매 내역만 조회
 */
const CustomerPurchaseHistoryTab = ({ customerInfo }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!customerInfo?.ctn) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // 🔥 CTN 기준으로 판매일보 조회 (백엔드에서 필터링)
      const data = await directStoreApiClient.getSalesReports({ ctn: customerInfo.ctn });
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('나의 구매 내역 조회 실패:', err);
      setError('구매 내역을 불러오는 중 오류가 발생했습니다.');
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [customerInfo?.ctn]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRowClick = (row) => {
    setSelectedRow(row);
    setShowDetailDialog(true);
  };

  const filteredData = history.filter(row => {
    if (!searchTerm) return true;
    const keyword = searchTerm.trim().toLowerCase();
    return (
      (row.customerName || '').toLowerCase().includes(keyword) ||
      (row.model || '').toLowerCase().includes(keyword) ||
      (row.요금제 || row.plan || '').toLowerCase().includes(keyword)
    );
  });

  if (isLoading) {
    return <LoadingState message="구매 내역을 불러오는 중..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={loadHistory} />;
  }

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          나의 구매 내역
        </Typography>
        <TextField
          size="small"
          placeholder="모델명, 요금제, 고객명 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ bgcolor: 'background.paper', borderRadius: 1, minWidth: 250 }}
        />
      </Box>

      {filteredData.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f9f9f9' }}>
          <Typography color="text.secondary">표시할 구매 내역이 없습니다.</Typography>
        </Paper>
      ) : (
        <ModernTable sx={{ flexGrow: 1 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <ModernTableCell align="center" width="80">판매일시</ModernTableCell>
                <ModernTableCell align="center" width="60">통신사</ModernTableCell>
                <ModernTableCell width="140">단말기모델명</ModernTableCell>
                <ModernTableCell align="center" width="80">개통유형</ModernTableCell>
                <ModernTableCell align="center" width="80">할부구분</ModernTableCell>
                <ModernTableCell align="center" width="80">할부개월</ModernTableCell>
                <ModernTableCell width="160">요금제</ModernTableCell>
                <ModernTableCell align="right" width="100">할부원금</ModernTableCell>
                <ModernTableCell align="center" width="80">상태</ModernTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData.map((row) => (
                <HoverableTableRow 
                  key={row.id || row.번호}
                  onClick={() => handleRowClick(row)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell align="center">
                    {row.soldAt || row.판매일시 || ''}
                  </TableCell>
                  <TableCell align="center">
                    {row.carrier || row.통신사 || ''}
                  </TableCell>
                  <TableCell>
                    {row.model || row.단말기모델명 || ''}
                  </TableCell>
                  <TableCell align="center">
                    {row.개통유형 || row.openingType || ''}
                  </TableCell>
                  <TableCell align="center">
                    {row.할부구분 || row.installmentType || ''}
                  </TableCell>
                  <TableCell align="center">
                    {row.할부개월 || row.installmentPeriod || ''}
                  </TableCell>
                  <TableCell>
                    {row.요금제 || row.plan || ''}
                  </TableCell>
                  <TableCell align="right">
                    {(row.할부원금 ?? row.installmentPrincipal ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell align="center">
                    {row.상태 || row.status || ''}
                  </TableCell>
                </HoverableTableRow>
              ))}
            </TableBody>
          </Table>
        </ModernTable>
      )}

      {/* 상세 정보 다이얼로그 */}
      {selectedRow && showDetailDialog && (
        <Dialog
          open={showDetailDialog}
          onClose={() => {
            setShowDetailDialog(false);
            setSelectedRow(null);
          }}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>구매 내역 상세 정보</DialogTitle>
          <DialogContent>
            <OpeningInfoPage
              initialData={{
                ...selectedRow,
                번호: selectedRow.id || selectedRow.번호, // 판매일보 ID
                model: selectedRow.model || selectedRow.단말기모델명 || '',
                petName: selectedRow.model || selectedRow.단말기모델명 || '',
                factoryPrice: selectedRow.factoryPrice || selectedRow.출고가 || 0,
                publicSupport: selectedRow.publicSupport || selectedRow.이통사지원금 || 0,
                storeSupport: selectedRow.storeSupport || selectedRow.대리점추가지원금 || 0,
                대리점추가지원금: selectedRow.storeSupport || selectedRow.대리점추가지원금 || 0,
                additionalStoreSupport: selectedRow.additionalStoreSupport || selectedRow.대리점추가지원금직접입력 || 0,
                대리점추가지원금직접입력: selectedRow.additionalStoreSupport || selectedRow.대리점추가지원금직접입력 || 0,
                installmentPrincipal: selectedRow.installmentPrincipal || selectedRow.할부원금 || 0,
                할부원금: selectedRow.installmentPrincipal || selectedRow.할부원금 || 0,
                lgPremier: selectedRow.lgPremier !== undefined ? Boolean(selectedRow.lgPremier) : (selectedRow.프리미어약정 === 'Y' || selectedRow.프리미어약정 === true || false),
                프리미어약정: selectedRow.lgPremier !== undefined ? (selectedRow.lgPremier ? 'Y' : 'N') : (selectedRow.프리미어약정 || 'N'),
                openingType: reverseConvertOpeningType(selectedRow.개통유형 || selectedRow.openingType || ''),
                customerName: selectedRow.customerName || selectedRow.고객명 || '',
                customerContact: selectedRow.customerContact || selectedRow.CTN || selectedRow.ctn || '',
                carrier: selectedRow.carrier || selectedRow.통신사 || '',
                plan: selectedRow.plan || selectedRow.요금제 || '',
                deviceColor: selectedRow.color || selectedRow.색상 || '',
                deviceSerial: selectedRow.deviceSerial || selectedRow.단말일련번호 || '',
                simModel: selectedRow.usimModel || selectedRow.유심모델명 || '',
                simSerial: selectedRow.usimSerial || selectedRow.유심일련번호 || '',
                contractType: selectedRow.contractType === '선택약정' ? 'selected' : (selectedRow.약정 || 'standard'),
                installmentPeriod: selectedRow.installmentPeriod || selectedRow.할부개월 || 24,
                paymentType: selectedRow.installmentType === '현금' ? 'cash' : (selectedRow.할부구분 === '현금' ? 'cash' : 'installment'),
                prevCarrier: selectedRow.prevCarrier || selectedRow.전통신사 || ''
              }}
              onBack={async () => {
                await loadHistory(); // 목록 새로고침
                setShowDetailDialog(false);
                setSelectedRow(null);
              }}
              mode="customer"
              customerInfo={customerInfo}
              saveToSheet="sales" // 판매일보는 읽기 전용이지만 구조 유지
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

export default CustomerPurchaseHistoryTab;

