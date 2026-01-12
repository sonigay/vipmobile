import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Chip, IconButton, Tooltip, TextField, InputAdornment, CircularProgress, Alert,
    Dialog, DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material';
import {
    Search as SearchIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Store as StoreIcon
} from '@mui/icons-material';
import { customerAPI } from '../../api';
import { LoadingState } from '../direct/common/LoadingState';
import { ErrorState } from '../direct/common/ErrorState';
import { ModernTable, ModernTableCell, HoverableTableRow, EmptyTableRow } from '../direct/common/ModernTable';
import OpeningInfoPage from '../direct/OpeningInfoPage';
import CustomerPreferredStoreTab from './CustomerPreferredStoreTab';
import { reverseConvertOpeningType } from '../../utils/directStoreUtils';

/**
 * 개인정보 마스킹 함수
 * @param {string} name - 이름
 * @param {string} ctn - 전화번호
 * @param {boolean} isManagementMode - 관리모드 여부 (마스킹 안 함)
 * @returns {object} 마스킹된 이름과 CTN
 */
const maskPersonalInfo = (name, ctn, isManagementMode = false) => {
    if (isManagementMode) {
        return { maskedName: name, maskedCtn: ctn };
    }
    
    // 이름 마스킹: 앞글자와 맨뒷글자만 표시, 가운데는 ***
    let maskedName = name || '';
    if (maskedName.length > 2) {
        maskedName = maskedName[0] + '***' + maskedName[maskedName.length - 1];
    } else if (maskedName.length === 2) {
        maskedName = maskedName[0] + '*';
    }
    
    // CTN 마스킹: 가운데 번호는 ****
    let maskedCtn = ctn || '';
    if (maskedCtn.length >= 11) {
        // 010-1234-5678 -> 010-****-5678
        maskedCtn = maskedCtn.replace(/(\d{3})-?(\d{4})-?(\d{4})/, '$1-****-$3');
    } else if (maskedCtn.length >= 7) {
        // 01012345678 -> 010****5678
        maskedCtn = maskedCtn.substring(0, 3) + '****' + maskedCtn.substring(7);
    }
    
    return { maskedName, maskedCtn };
};

const CustomerPurchaseQueueTab = ({ customerInfo, isManagementMode = false, loggedInStore = null }) => {
    const [queue, setQueue] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRow, setSelectedRow] = useState(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showStoreSelectDialog, setShowStoreSelectDialog] = useState(false);

    const loadQueue = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            let data = [];
            
            if (isManagementMode) {
                // 직영점관리모드: 전체 구매대기 조회
                data = await customerAPI.getAllQueue();
            } else if (loggedInStore) {
                // 직영점모드: 해당 매장의 구매대기만 조회 (POS코드로 필터링)
                // loggedInStore.id가 POS코드 (15번 인덱스)
                const posCode = loggedInStore.id;
                data = await customerAPI.getAllQueue(posCode);
            } else {
                // 고객모드: 로그인한 고객의 구매대기만 조회
                if (!customerInfo?.ctn) return;
                data = await customerAPI.getPurchaseQueue(customerInfo.ctn);
            }
            
            // '삭제됨' 상태 제외
            setQueue(data.filter(item => item.status !== '삭제됨'));
        } catch (err) {
            console.error('Error loading queue:', err);
            setError('목록을 불러오는데 실패했습니다.');
            setQueue([]);
        } finally {
            setIsLoading(false);
        }
    }, [customerInfo?.ctn, isManagementMode, loggedInStore]);

    useEffect(() => {
        loadQueue();
    }, [loadQueue]);

    const handleRowClick = (row) => {
        setSelectedRow(row);
        setShowEditDialog(true);
    };

    const handleDelete = async (id, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('정말로 삭제하시겠습니까?')) return;
        try {
            await customerAPI.deleteFromPurchaseQueue(id);
            setQueue(prev => prev.filter(item => item.id !== id));
            if (selectedRow?.id === id) {
                setSelectedRow(null);
                setShowEditDialog(false);
            }
        } catch (err) {
            alert('삭제에 실패했습니다.');
        }
    };

    // handleEditSave는 더 이상 필요 없음 - OpeningInfoPage가 직접 저장 처리

    const handleStoreModify = (row, e) => {
        if (e) e.stopPropagation();
        setSelectedRow(row); // 선택된 행 설정
        setShowStoreSelectDialog(true);
    };

    const handleStoreSelect = async (store) => {
        if (!selectedRow) return;
        try {
            await customerAPI.updatePurchaseQueue(selectedRow.id, {
                storeName: store.name,
                storePhone: store.phone || store.storePhone,
                storeAddress: store.address,
                storeBankInfo: store.accountInfo
            });
            await loadQueue();
            setShowStoreSelectDialog(false);
            setSelectedRow(null); // 다이얼로그 닫을 때 선택 해제
            alert('선호매장이 변경되었습니다.');
        } catch (err) {
            alert('매장 변경에 실패했습니다.');
        }
    };

    // 검색 필터링
    const filteredData = queue.filter(row => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            (row.name || '').toLowerCase().includes(searchLower) ||
            (row.model || '').toLowerCase().includes(searchLower) ||
            (row.ctn || '').includes(searchTerm)
        );
    });

    if (isLoading) {
        return <LoadingState message="구매 대기 목록을 불러오는 중..." />;
    }

    if (error) {
        return <ErrorState error={error} onRetry={loadQueue} />;
    }

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {isManagementMode ? '전체 구매 대기' : loggedInStore ? '구매 대기' : '나의 구매 대기'}
                </Typography>
                <TextField
                    size="small"
                    placeholder="고객명, 모델명, CTN 검색"
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
                    <Typography color="text.secondary">대기 중인 구매 내역이 없습니다.</Typography>
                </Paper>
            ) : (
                <ModernTable sx={{ flexGrow: 1 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <ModernTableCell align="center" width="80">등록일시</ModernTableCell>
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
                                <ModernTableCell align="center" width="100">선택매장</ModernTableCell>
                                <ModernTableCell align="center" width="80">상태</ModernTableCell>
                                <ModernTableCell align="center" width="120">관리</ModernTableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredData.map((row) => {
                                const { maskedName, maskedCtn } = maskPersonalInfo(row.name, row.ctn, isManagementMode);
                                return (
                                    <HoverableTableRow
                                        key={row.id}
                                        onClick={() => handleRowClick(row)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        <TableCell align="center">
                                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell align="center">{maskedName}</TableCell>
                                        <TableCell align="center">{maskedCtn}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={row.carrier || '-'}
                                                size="small"
                                                sx={{
                                                    bgcolor: row.carrier === 'SK' ? '#e60012' : row.carrier === 'KT' ? '#00abc7' : '#ec008c',
                                                    color: 'white',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{row.model || '-'}</TableCell>
                                        <TableCell align="center">{row.color || '-'}</TableCell>
                                        <TableCell align="center">{row.activationType || '-'}</TableCell>
                                        <TableCell align="center">{row.installmentType || '-'}</TableCell>
                                        <TableCell align="center">{row.installmentMonths || '-'}</TableCell>
                                        <TableCell align="center">{row.contractType || '-'}</TableCell>
                                        <TableCell>{row.plan || '-'}</TableCell>
                                        <TableCell align="center">{row.storeName || '-'}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={row.status || '구매대기'}
                                                size="small"
                                                color={row.status === '처리완료' ? 'success' : 'primary'}
                                            />
                                        </TableCell>
                                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                            <Tooltip title="선호매장 수정">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => handleStoreModify(e)}
                                                    sx={{ mr: 0.5 }}
                                                >
                                                    <StoreIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="삭제">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => handleDelete(row.id, e)}
                                                    color="error"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </HoverableTableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </ModernTable>
            )}

            {/* 수정 다이얼로그 */}
            {selectedRow && showEditDialog && (
                <Dialog
                    open={showEditDialog}
                    onClose={() => {
                        setShowEditDialog(false);
                        setSelectedRow(null);
                    }}
                    maxWidth="lg"
                    fullWidth
                >
                    <DialogTitle>구매 대기 정보 수정</DialogTitle>
                    <DialogContent>
                        <OpeningInfoPage
                            initialData={{
                                ...selectedRow,
                                purchaseQueueId: selectedRow.id, // 구매대기 항목 ID (수정 모드 구분용)
                                model: selectedRow.model,
                                petName: selectedRow.model,
                                factoryPrice: selectedRow.factoryPrice || 0,
                                publicSupport: selectedRow.carrierSupport || 0,
                                // 🔥 수정: 구매대기에서 저장된 대리점추가지원금을 정확히 전달
                                storeSupport: selectedRow.dealerSupportWithAdd || 0, // 저장된 대리점추가지원금
                                대리점추가지원금: selectedRow.dealerSupportWithAdd || 0, // 한글 필드명도 추가
                                // 🔥 수정: dealerSupportWithoutAdd는 실제로는 대리점추가지원금직접입력이므로 additionalStoreSupport로 매핑
                                additionalStoreSupport: selectedRow.dealerSupportWithoutAdd !== undefined && selectedRow.dealerSupportWithoutAdd !== null ? Number(selectedRow.dealerSupportWithoutAdd) : null,
                                대리점추가지원금직접입력: selectedRow.dealerSupportWithoutAdd !== undefined && selectedRow.dealerSupportWithoutAdd !== null ? Number(selectedRow.dealerSupportWithoutAdd) : null,
                                // 🔥 추가: 할부원금과 LG프리미어약정
                                installmentPrincipal: selectedRow.installmentPrincipal || selectedRow.할부원금 || 0,
                                할부원금: selectedRow.installmentPrincipal || selectedRow.할부원금 || 0,
                                lgPremier: selectedRow.lgPremier !== undefined ? Boolean(selectedRow.lgPremier) : (selectedRow.프리미어약정 === 'Y' || selectedRow.프리미어약정 === true || false),
                                프리미어약정: selectedRow.lgPremier !== undefined ? (selectedRow.lgPremier ? 'Y' : 'N') : (selectedRow.프리미어약정 || 'N'),
                                openingType: reverseConvertOpeningType(selectedRow.activationType),
                                customerName: selectedRow.name,
                                customerContact: selectedRow.ctn,
                                carrier: selectedRow.carrier,
                                plan: selectedRow.plan,
                                deviceColor: selectedRow.color,
                                deviceSerial: selectedRow.deviceSerial,
                                simModel: selectedRow.usimModel,
                                simSerial: selectedRow.usimSerial,
                                contractType: selectedRow.contractType === '선택약정' ? 'selected' : 'standard',
                                installmentPeriod: selectedRow.installmentMonths || 24,
                                paymentType: selectedRow.installmentType === '현금' ? 'cash' : 'installment',
                                prevCarrier: selectedRow.oldCarrier
                            }}
                            onBack={async () => {
                                await loadQueue(); // 목록 새로고침
                                setShowEditDialog(false);
                                setSelectedRow(null);
                            }}
                            mode={isManagementMode ? 'management' : loggedInStore ? 'directStore' : 'customer'}
                            customerInfo={customerInfo}
                            selectedStore={selectedRow.storeName ? {
                                name: selectedRow.storeName,
                                phone: selectedRow.storePhone,
                                address: selectedRow.storeAddress,
                                accountInfo: selectedRow.storeBankInfo
                            } : null}
                            loggedInStore={loggedInStore}
                            saveToSheet="purchaseQueue"
                        />
                    </DialogContent>
                </Dialog>
            )}

            {/* 선호매장 선택 다이얼로그 */}
            {showStoreSelectDialog && selectedRow && (
                <Dialog
                    open={showStoreSelectDialog}
                    onClose={() => setShowStoreSelectDialog(false)}
                    maxWidth="lg"
                    fullWidth
                >
                    <DialogTitle>선호매장 변경</DialogTitle>
                    <DialogContent>
                        <CustomerPreferredStoreTab
                            selectedProduct={null}
                            customerInfo={customerInfo}
                            onStoreConfirm={(action, store) => {
                                // action과 관계없이 store가 있으면 매장 선택 처리
                                if (store) {
                                    handleStoreSelect(store);
                                }
                            }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => {
                            setShowStoreSelectDialog(false);
                            setSelectedRow(null); // 다이얼로그 닫을 때 선택 해제
                        }}>취소</Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );
};

export default CustomerPurchaseQueueTab;
