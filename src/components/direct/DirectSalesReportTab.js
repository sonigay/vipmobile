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
import { LoadingState } from './common/LoadingState';
import { ErrorState } from './common/ErrorState';
import { ModernTable, ModernTableCell, HoverableTableRow, EmptyTableRow } from './common/ModernTable';

const DirectSalesReportTab = ({ onRowClick, loggedInStore, isManagementMode = false }) => {
    const [searchTerm, setSearchTerm] = useState('');
    // YYYY-MM 형식의 월 필터 (기본값: 현재 달)
    const [monthFilter, setMonthFilter] = useState(() => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${now.getFullYear()}-${month}`;
    });
    const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const fetchSalesData = async () => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DirectSalesReportTab.js:fetchSalesData',message:'판매일보 로드 시작',data:{isManagementMode,storeId:loggedInStore?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D1'})}).catch(()=>{});
            // #endregion
            try {
                setLoading(true);
                setError(null);
                // 직영점 모드: 해당 매장만, 관리 모드: 전체
                const filters = isManagementMode ? {} : { storeId: loggedInStore?.id };
                const startTime = Date.now();
                const data = await directStoreApiClient.getSalesReports(filters);
                const duration = Date.now() - startTime;
                setSalesData(data || []);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DirectSalesReportTab.js:fetchSalesData',message:'판매일보 로드 완료',data:{count:data?.length||0,duration},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D1'})}).catch(()=>{});
                // #endregion
            } catch (err) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DirectSalesReportTab.js:fetchSalesData',message:'판매일보 로드 실패',data:{error:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D1'})}).catch(()=>{});
                // #endregion
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
            // 요금제 정보에서 planGroup 추출 (예: "(AI 전화) 5G 시그니처(115군)" -> "115군")
            const planText = row.plan || row.요금제 || '';
            let planGroup = null;
            if (planText) {
                // 괄호 안의 요금제군 추출 (예: "(115군)" 또는 "115군")
                const match = planText.match(/\(?(\d+군)\)?/);
                if (match) {
                    planGroup = match[1];
                }
            }

            // 데이터 포맷을 OpeningInfoPage가 기대하는 형식으로 변환
            const formattedData = {
                ...row,
                model: row.deviceModel || row.model,
                petName: row.deviceName || row.petName,
                factoryPrice: row.factoryPrice || row.출고가,
                publicSupport: row.publicSupport || row.이통사지원금,
                storeSupport: row.storeSupportWithAddon || row['대리점추가지원금(부가유치)'],
                // 🔥 수정: 부가미유치 기준 제거 (storeSupportNoAddon 제거, 부가유치 값 사용)
                openingType: row.openingType || (row.개통유형 === '기변' ? 'CHANGE' : row.개통유형 === '신규' ? 'NEW' : 'MNP'),
                customerName: row.customerName || row.고객명,
                customerContact: row.customerContact || row.연락처,
                carrier: row.carrier || row.통신사,
                plan: planText, // 요금제명 (예: "(AI 전화) 5G 시그니처(115군)")
                planGroup: planGroup || row.planGroup, // 요금제군 (예: "115군")
                // 추가 필드들
                deviceColor: row.color || row.deviceColor || row.색상,
                deviceSerial: row.deviceSerial || row.단말일련번호,
                simModel: row.usimModel || row.simModel || row.유심모델명,
                simSerial: row.usimSerial || row.simSerial || row.유심일련번호,
                contractType: row.contractType || (row.약정 === '선택약정' ? 'selected' : 'standard'),
                installmentPeriod: row.installmentPeriod || row.할부개월 || 24,
                paymentType: row.paymentType || (row.할부구분 === '현금' ? 'cash' : 'installment'),
                prevCarrier: row.prevCarrier || row.전통신사
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

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DirectSalesReportTab.js:handleStatusUpdate',message:'상태 업데이트 시작',data:{rowId:selectedRow?.id||selectedRow?.번호,oldStatus:selectedRow?.status||selectedRow?.상태,newStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D2'})}).catch(()=>{});
        // #endregion
        try {
            setUpdating(true);
            const rowId = selectedRow.id || selectedRow.번호;
            const startTime = Date.now();
            await directStoreApiClient.updateSalesReport(rowId, { status: newStatus });
            const duration = Date.now() - startTime;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DirectSalesReportTab.js:handleStatusUpdate',message:'상태 업데이트 완료',data:{rowId,duration},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D2'})}).catch(()=>{});
            // #endregion
            
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

    // 검색 + 월 필터링
    const filteredData = salesData.filter(row => {
        const searchLower = searchTerm.toLowerCase();

        // 검색어 필터
        const matchesSearch =
            (row.customerName || row.고객명 || '').toLowerCase().includes(searchLower) ||
            (row.deviceModel || row.단말기모델명 || row.model || '').toLowerCase().includes(searchLower) ||
            (row.customerContact || row.연락처 || row.contact || '').includes(searchTerm);

        if (!matchesSearch) return false;

        // 월 필터 (판매일시 기준으로 YYYY-MM 포함 여부 체크)
        if (!monthFilter) return true;
        const saleDateRaw = row.saleDateTime || row.판매일시 || row.date || '';
        return typeof saleDateRaw === 'string' && saleDateRaw.includes(monthFilter);
    });

    // 현재 필터된 데이터의 마진 합계
    const totalMargin = filteredData.reduce((sum, row) => {
        const margin = Number(row.margin ?? row.마진 ?? 0);
        return sum + (isNaN(margin) ? 0 : margin);
    }, 0);

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    {isManagementMode ? '전체 판매일보' : '판매일보'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
                    <TextField
                        size="small"
                        type="month"
                        label="월 선택"
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ bgcolor: 'background.paper', borderRadius: 1, minWidth: 150 }}
                    />
                </Box>
            </Box>

            {error && (
                <ErrorState error={error} onRetry={() => window.location.reload()} />
            )}

            {/* 월 마진 합계 표시 */}
            {!loading && (
                <Box sx={{ mb: 1, textAlign: 'right' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        총 마진: <strong>{totalMargin.toLocaleString()}원</strong>
                    </Typography>
                </Box>
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
                                <ModernTableCell width="120">요금제</ModernTableCell>
                                <ModernTableCell align="right" width="100">마진</ModernTableCell>
                                <ModernTableCell align="center" width="80">상태</ModernTableCell>
                                <ModernTableCell align="center" width="100">관리</ModernTableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <EmptyTableRow colSpan={isManagementMode ? 16 : 15} message="표시할 데이터가 없습니다." />
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
                                            <TableCell align="right">
                                                {(() => {
                                                    const margin = Number(row.margin ?? row.마진 ?? 0);
                                                    return isNaN(margin) ? '-' : `${margin.toLocaleString()}원`;
                                                })()}
                                            </TableCell>
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
