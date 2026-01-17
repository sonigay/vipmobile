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
  DialogContent,
  useMediaQuery,
  useTheme,
  Button
} from '@mui/material';
import { Search as SearchIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
    <Box sx={{ p: { xs: 1, sm: 3 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        mb: 3,
        gap: { xs: 2, sm: 0 }
      }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>
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
          sx={{ 
            bgcolor: 'background.paper', 
            borderRadius: 1, 
            minWidth: { xs: '100%', sm: 250 },
            width: { xs: '100%', sm: 'auto' }
          }}
        />
      </Box>

      {filteredData.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f9f9f9' }}>
          <Typography color="text.secondary">표시할 구매 내역이 없습니다.</Typography>
        </Paper>
      ) : (
        <TableContainer 
          sx={{ 
            flexGrow: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            maxHeight: { xs: 'calc(100vh - 250px)', sm: 'none' }
          }}
        >
          <Table stickyHeader size="small" sx={{ minWidth: { xs: '900px', sm: '100%' }, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: { xs: '70px', sm: '80px' }, fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold' }}>보기</TableCell>
                <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold', whiteSpace: 'nowrap' }}>판매일시</TableCell>
                <TableCell align="center" sx={{ width: '60px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold' }}>통신사</TableCell>
                <TableCell sx={{ width: '140px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold' }}>단말기모델명</TableCell>
                <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold' }}>개통유형</TableCell>
                <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold' }}>할부구분</TableCell>
                <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold' }}>할부개월</TableCell>
                <TableCell sx={{ width: '160px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold' }}>요금제</TableCell>
                <TableCell align="right" sx={{ width: '100px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold' }}>할부원금</TableCell>
                <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 'bold' }}>상태</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData.map((row) => (
                <HoverableTableRow 
                  key={row.id || row.번호}
                  onClick={() => handleRowClick(row)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell 
                    align="center" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(row);
                    }}
                    sx={{ width: { xs: '70px', sm: '80px' }, p: { xs: 0.5, sm: 1 } }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(row);
                      }}
                      sx={{
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        px: { xs: 0.5, sm: 1 },
                        py: { xs: 0.25, sm: 0.5 },
                        minWidth: { xs: 'auto', sm: '60px' },
                        '& .MuiButton-startIcon': {
                          marginRight: { xs: 0, sm: 0.5 },
                          '& > *:nth-of-type(1)': {
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          }
                        }
                      }}
                    >
                      {isMobile ? '' : '보기'}
                    </Button>
                  </TableCell>
                  <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' }, whiteSpace: 'nowrap' }}>
                    {(() => {
                      const dateValue = row.soldAt || row.판매일시 || '';
                      if (!dateValue) return '';
                      try {
                        // ISO 문자열이나 날짜 문자열을 Date 객체로 변환
                        const date = new Date(dateValue);
                        if (isNaN(date.getTime())) return dateValue; // 유효하지 않은 날짜면 원본 반환
                        // YYYY-MM-DD 형식으로 반환
                        return date.toISOString().split('T')[0].replace(/-/g, '.');
                      } catch (e) {
                        // 날짜 파싱 실패 시 원본 반환 (이미 날짜 형식일 수 있음)
                        return dateValue.length > 10 ? dateValue.substring(0, 10).replace(/-/g, '.') : dateValue;
                      }
                    })()}
                  </TableCell>
                  <TableCell align="center" sx={{ width: '60px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {row.carrier || row.통신사 || ''}
                  </TableCell>
                  <TableCell sx={{ width: '140px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {row.model || row.단말기모델명 || ''}
                  </TableCell>
                  <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {row.개통유형 || row.openingType || ''}
                  </TableCell>
                  <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {row.할부구분 || row.installmentType || ''}
                  </TableCell>
                  <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {row.할부개월 || row.installmentPeriod || ''}
                  </TableCell>
                  <TableCell sx={{ width: '160px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {row.요금제 || row.plan || ''}
                  </TableCell>
                  <TableCell align="right" sx={{ width: '100px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {(row.할부원금 ?? row.installmentPrincipal ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell align="center" sx={{ width: '80px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {row.상태 || row.status || ''}
                  </TableCell>
                </HoverableTableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
          fullScreen={isMobile}
          sx={{
            '& .MuiDialog-paper': {
              m: { xs: 0, sm: 2 },
              maxHeight: { xs: '100vh', sm: '90vh' }
            }
          }}
        >
          <DialogTitle sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, py: { xs: 1.5, sm: 2 } }}>
            구매 내역 상세 정보
          </DialogTitle>
          <DialogContent 
            dividers
            sx={{ 
              p: { xs: 1, sm: 3 },
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              maxHeight: { xs: 'calc(100vh - 120px)', sm: 'calc(90vh - 120px)' }
            }}
          >
            <Box sx={{ 
              '& .print-root': {
                p: { xs: 1, sm: 3 }
              }
            }}>
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
            </Box>
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

export default CustomerPurchaseHistoryTab;

