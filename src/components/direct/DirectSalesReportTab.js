import React, { useState, useEffect } from 'react';
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
    Chip,
    IconButton,
    Tooltip,
    TextField,
    InputAdornment,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    MenuItem,
    Select,
    FormControl,
    InputLabel
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterListIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    HourglassEmpty as HourglassEmptyIcon,
    Print as PrintIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../api/directStoreApi';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { LoadingState, ErrorState } from './common';
import { ModernTable, ModernTableCell, HoverableTableRow, EmptyTableRow } from './common/ModernTable';

const DirectSalesReportTab = ({ onRowClick, loggedInStore, isManagementMode = false }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const fetchSalesData = async () => {
            try {
                setLoading(true);
                setError(null);
                // 직영점 모드: 해당 매장만, 관리 모드: 전체
                const filters = isManagementMode ? {} : { storeId: loggedInStore?.id };
                const data = await directStoreApiClient.getSalesReports(filters);
                setSalesData(data || []);
            } catch (err) {
                console.error('판매일보 로딩 실패:', err);
                setError('데이터를 불러오는 중 오류가 발생했습니다.');
                setSalesData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSalesData();
    }, [loggedInStore, isManagementMode]);

    const getStatusChip = (status) => {
        const statusMap = {
            '개통완료': { icon: <CheckCircleIcon />, label: '개통완료', color: 'success' },
            '개통취소': { icon: <CancelIcon />, label: '개통취소', color: 'error' },
            '개통보류': { icon: <HourglassEmptyIcon />, label: '개통보류', color: 'warning' },
            '개통대기': { icon: <HourglassEmptyIcon />, label: '개통대기', color: 'info' }
        };
        const statusInfo = statusMap[status] || statusMap['개통대기'];
        return (
            <Chip
                icon={statusInfo.icon}
                label={statusInfo.label}
                color={statusInfo.color}
                size="small"
                variant="outlined"
            />
        );
    };

    const getCarrierColor = (carrier) => {
        switch (carrier) {
            case 'SK': return '#e60012';
            case 'KT': return '#00abc7';
            case 'LG': return '#ec008c';
            default: return 'text.primary';
        }
    };

    const handleRowClick = (row) => {
        if (onRowClick) {
            // 데이터 포맷을 OpeningInfoPage가 기대하는 형식으로 변환
            const formattedData = {
                ...row,
                model: row.deviceModel || row.model,
                petName: row.deviceName || row.petName,
                factoryPrice: row.factoryPrice || row.출고가,
                publicSupport: row.publicSupport || row.이통사지원금,
                storeSupport: row.storeSupportWithAddon || row['대리점추가지원금(부가유치)'],
                storeSupportNoAddon: row.storeSupportWithoutAddon || row['대리점추가지원금(부가미유치)'],
                openingType: row.openingType || (row.개통유형 === '기변' ? 'CHANGE' : row.개통유형 === '신규' ? 'NEW' : 'MNP'),
                customerName: row.customerName || row.고객명,
                customerContact: row.customerContact || row.연락처,
                carrier: row.carrier || row.통신사
            };
            onRowClick(formattedData);
        }
    };

    const handleStatusChangeClick = (e, row) => {
        e.stopPropagation();
        setSelectedRow(row);
        setNewStatus(row.status || row.상태 || '개통대기');
        setStatusDialogOpen(true);
    };

    const handleStatusUpdate = async () => {
        if (!selectedRow || !newStatus) return;

        try {
            setUpdating(true);
            const rowId = selectedRow.id || selectedRow.번호;
            await directStoreApiClient.updateSalesReport(rowId, { status: newStatus });
            
            // 로컬 상태 업데이트
            setSalesData(prev => prev.map(item => 
                (item.id === rowId || item.번호 === rowId) 
                    ? { ...item, status: newStatus, 상태: newStatus }
                    : item
            ));
            
            setStatusDialogOpen(false);
            setSelectedRow(null);
            setNewStatus('');
        } catch (err) {
            console.error('상태 변경 실패:', err);
            alert('상태 변경에 실패했습니다.');
        } finally {
            setUpdating(false);
        }
    };

    // 검색 필터링
    const filteredData = salesData.filter(row => {
        const searchLower = searchTerm.toLowerCase();
        return (
            (row.customerName || row.고객명 || '').toLowerCase().includes(searchLower) ||
            (row.deviceModel || row.단말기모델명 || row.model || '').toLowerCase().includes(searchLower) ||
            (row.customerContact || row.연락처 || row.contact || '').includes(searchTerm)
        );
    });

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    {isManagementMode ? '전체 판매일보' : '판매일보'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        size="small"
                        placeholder="고객명, 모델명 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
                    />
                </Box>
            </Box>

            {error && (
                <ErrorState error={error} onRetry={() => window.location.reload()} />
            )}

            {loading ? (
                <LoadingState message="판매일보를 불러오는 중..." />
            ) : (
                <ModernTable sx={{ flexGrow: 1 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <ModernTableCell align="center" width="60">번호</ModernTableCell>
                                {isManagementMode && <ModernTableCell align="center" width="100">업체명</ModernTableCell>}
                                <ModernTableCell align="center" width="100">판매일시</ModernTableCell>
                                <ModernTableCell align="center" width="80">고객명</ModernTableCell>
                                <ModernTableCell align="center" width="100">CTN</ModernTableCell>
                                <ModernTableCell align="center" width="60">통신사</ModernTableCell>
                                <ModernTableCell width="120">단말기모델명</ModernTableCell>
                                <ModernTableCell align="center" width="60">색상</ModernTableCell>
                                <ModernTableCell align="center" width="80">개통유형</ModernTableCell>
                                <ModernTableCell align="center" width="80">할부구분</ModernTableCell>
                                <ModernTableCell align="center" width="80">할부개월</ModernTableCell>
                                <ModernTableCell align="center" width="80">약정</ModernTableCell>
                                <ModernTableCell width="100">요금제</ModernTableCell>
                                <ModernTableCell align="center" width="80">상태</ModernTableCell>
                                <ModernTableCell align="center" width="100">관리</ModernTableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <EmptyTableRow colSpan={isManagementMode ? 15 : 14} message="표시할 데이터가 없습니다." />
                            ) : (
                                filteredData.map((row, idx) => {
                                    const rowNumber = row.번호 || row.id || (idx + 1);
                                    const status = row.status || row.상태 || '개통대기';
                                    return (
                                        <HoverableTableRow
                                            key={row.id || row.번호 || idx}
                                            onClick={() => handleRowClick(row)}
                                        >
                                            <TableCell align="center">{rowNumber}</TableCell>
                                            {isManagementMode && (
                                                <TableCell align="center">{row.storeName || row.업체명 || '-'}</TableCell>
                                            )}
                                            <TableCell align="center">
                                                {row.saleDateTime || row.판매일시 || row.date || '-'}
                                            </TableCell>
                                            <TableCell align="center">{row.customerName || row.고객명 || '-'}</TableCell>
                                            <TableCell align="center">{row.ctn || row.CTN || '-'}</TableCell>
                                            <TableCell align="center" sx={{ color: getCarrierColor(row.carrier || row.통신사), fontWeight: 'bold' }}>
                                                {row.carrier || row.통신사 || '-'}
                                            </TableCell>
                                            <TableCell>{row.deviceModel || row.단말기모델명 || row.model || '-'}</TableCell>
                                            <TableCell align="center">{row.deviceColor || row.색상 || '-'}</TableCell>
                                            <TableCell align="center">{row.openingType || row.개통유형 || row.type || '-'}</TableCell>
                                            <TableCell align="center">{row.installmentType || row.paymentType || row.할부구분 || '-'}</TableCell>
                                            <TableCell align="center">{row.installmentPeriod || row.할부개월 || '-'}</TableCell>
                                            <TableCell align="center">{row.contractType || row.contract || row.약정 || '-'}</TableCell>
                                            <TableCell>{row.plan || row.요금제 || '-'}</TableCell>
                                            <TableCell align="center">{getStatusChip(status)}</TableCell>
                                            <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                                <Tooltip title="상태 변경">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleStatusChangeClick(e, row)}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </HoverableTableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </ModernTable>
            )}

            {/* 상태 변경 다이얼로그 */}
            <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>상태 변경</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            고객명: {selectedRow?.customerName || selectedRow?.고객명 || '-'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                            모델명: {selectedRow?.deviceModel || selectedRow?.단말기모델명 || selectedRow?.model || '-'}
                        </Typography>
                        <FormControl fullWidth>
                            <InputLabel>상태 선택</InputLabel>
                            <Select
                                value={newStatus}
                                label="상태 선택"
                                onChange={(e) => setNewStatus(e.target.value)}
                            >
                                <MenuItem value="개통대기">개통대기</MenuItem>
                                <MenuItem value="개통보류">개통보류</MenuItem>
                                <MenuItem value="개통취소">개통취소</MenuItem>
                                <MenuItem value="개통완료">개통완료</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setStatusDialogOpen(false)}>취소</Button>
                    <Button
                        variant="contained"
                        onClick={handleStatusUpdate}
                        disabled={updating || !newStatus}
                    >
                        {updating ? <CircularProgress size={24} /> : '변경'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DirectSalesReportTab;
