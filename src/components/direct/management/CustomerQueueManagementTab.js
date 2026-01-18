import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, IconButton, Select, MenuItem, FormControl,
    CircularProgress, Alert, Button, TextField
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import { customerAPI } from '../../../api';
import CustomerPurchaseQueueTab from '../../customer/CustomerPurchaseQueueTab';

const CustomerQueueManagementTab = ({ loggedInStore, onRowClick }) => {
    const [queue, setQueue] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const loadAllQueue = useCallback(async () => {
        setIsLoading(true);
        try {
            // Updated backend allows fetching all queue if ctn is not provided or specialized?
            // Wait, my backend implementation of /api/member/queue requires CTN.
            // I should update the backend to allow fetching all if authorized.
            // For now, I'll fetch with a special flag or just update the backend.
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/member/queue/all`);
            const data = await response.json();
            setQueue(data);
        } catch (err) {
            console.error('Error loading all queue:', err);
            setError('목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAllQueue();
    }, [loadAllQueue]);

    const handleStatusChange = async (id, newStatus) => {
        try {
            await customerAPI.updatePurchaseQueue(id, { status: newStatus });
            setQueue(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
        } catch (err) {
            alert('상태 업데이트에 실패했습니다.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('정말로 삭제하시겠습니까? (삭제됨 상태로 변경됩니다)')) return;
        try {
            await customerAPI.deleteFromPurchaseQueue(id);
            setQueue(prev => prev.map(item => item.id === id ? { ...item, status: '삭제됨' } : item));
        } catch (err) {
            alert('삭제에 실패했습니다.');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case '대기': return 'primary';
            case '확인중': return 'warning';
            case '완료': return 'success';
            case '취소': return 'error';
            case '삭제됨': return 'default';
            default: return 'default';
        }
    };

    const filteredQueue = queue.filter(item =>
        item.name.includes(searchTerm) ||
        item.ctn.includes(searchTerm) ||
        item.model.includes(searchTerm) ||
        (item.storeName && item.storeName.includes(searchTerm))
    );

    if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>고객 구매 대기 관리</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        size="small"
                        placeholder="고객명, 연락처, 모델 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ width: 300 }}
                    />
                    <Button startIcon={<RefreshIcon />} onClick={loadAllQueue}>새로고침</Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TableContainer 
                component={Paper} 
                sx={{ 
                    boxShadow: 3,
                    overflowX: 'auto',
                    maxWidth: '100%'
                }}
            >
                <Table sx={{ minWidth: 800 }}>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>등록일시</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>고객명</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>연락처</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>모델/색상</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>희망매장</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>메모</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>상태</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>관리</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredQueue.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                                    데이터가 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredQueue.map((item) => (
                                <TableRow 
                                    key={item.id} 
                                    hover 
                                    sx={{ 
                                        opacity: item.status === '삭제됨' ? 0.6 : 1,
                                        cursor: onRowClick ? 'pointer' : 'default'
                                    }}
                                    onClick={() => {
                                        if (onRowClick) {
                                            // 구매대기 데이터를 개통정보입력페이지 형식으로 변환
                                            const openingTypeMap = {
                                                '신규': 'NEW',
                                                '번호이동': 'MNP',
                                                '기기변경': 'CHANGE'
                                            };
                                            const openingType = openingTypeMap[item.activationType] || 'NEW';
                                            
                                            onRowClick({
                                                id: item.id,
                                                번호: item.id,
                                                purchaseQueueId: item.id, // 수정 모드 구분용
                                                customerName: item.name,
                                                customerContact: item.ctn,
                                                carrier: item.carrier,
                                                model: item.model,
                                                deviceColor: item.color || '',
                                                deviceSerial: item.deviceSerial || '',
                                                simModel: item.usimModel || '',
                                                simSerial: item.usimSerial || '',
                                                openingType: openingType,
                                                prevCarrier: item.oldCarrier || '',
                                                paymentType: item.installmentType === '할부' ? 'installment' : 'cash',
                                                installmentPeriod: item.installmentMonths || 24,
                                                contractType: item.contractType === '선택약정' ? 'selected' : 'standard',
                                                plan: item.plan || '',
                                                withAddon: true, // 기본값
                                                usePublicSupport: true, // 기본값
                                                factoryPrice: item.factoryPrice || 0,
                                                publicSupport: item.carrierSupport || 0,
                                                support: item.carrierSupport || 0, // 하위 호환
                                                storeSupport: item.dealerSupportWithAdd || 0,
                                                // 🔥 수정: 부가미유치 기준 제거 (storeSupportNoAddon 제거, 부가유치 값 사용)
                                                soldAt: item.createdAt
                                            });
                                        }
                                    }}
                                >
                                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>{item.name}</TableCell>
                                    <TableCell>{item.ctn}</TableCell>
                                    <TableCell>{item.model} / {item.color}</TableCell>
                                    <TableCell>
                                        <Chip label={item.storeName || '미지정'} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.memo}
                                    </TableCell>
                                    <TableCell>
                                        <FormControl size="small" sx={{ minWidth: 100 }}>
                                            <Select
                                                value={item.status}
                                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                sx={{
                                                    color: getStatusColor(item.status) + '.main',
                                                    fontWeight: 'bold',
                                                    bgcolor: item.status === '대기' ? '#e3f2fd' : 'transparent'
                                                }}
                                            >
                                                <MenuItem value="대기">대기</MenuItem>
                                                <MenuItem value="확인중">확인중</MenuItem>
                                                <MenuItem value="완료">완료</MenuItem>
                                                <MenuItem value="취소">취소</MenuItem>
                                                <MenuItem value="삭제됨" disabled>삭제됨</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </TableCell>
                                    <TableCell>
                                        <IconButton color="error" size="small" onClick={() => handleDelete(item.id)} disabled={item.status === '삭제됨'}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default CustomerQueueManagementTab;
