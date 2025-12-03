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
    Alert
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterListIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    HourglassEmpty as HourglassEmptyIcon,
    Print as PrintIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../api/directStoreApi';

const DirectSalesReportTab = ({ onRowClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSalesData = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await directStoreApi.getSalesReports();
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
    }, []);

    const getStatusChip = (status) => {
        switch (status) {
            case 'completed':
                return <Chip icon={<CheckCircleIcon />} label="개통완료" color="success" size="small" variant="outlined" />;
            case 'cancelled':
                return <Chip icon={<CancelIcon />} label="취소됨" color="error" size="small" variant="outlined" />;
            case 'pending':
            default:
                return <Chip icon={<HourglassEmptyIcon />} label="접수대기" color="warning" size="small" variant="outlined" />;
        }
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
                ...row, // 기존 데이터 포함
                petName: row.model, // 임시로 모델명을 펫네임으로 사용 (실제 데이터에 펫네임이 있으면 그것 사용)
                openingType: row.type === '기변' ? 'CHANGE' : row.type === '신규' ? 'NEW' : 'MNP',
                customerName: row.customer,
                customerContact: row.contact
            };
            onRowClick(formattedData);
        }
    };

    // 검색 필터링
    const filteredData = salesData.filter(row =>
        row.customer?.includes(searchTerm) ||
        row.model?.includes(searchTerm) ||
        row.contact?.includes(searchTerm)
    );

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    판매일보
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
                    <Tooltip title="필터">
                        <IconButton sx={{ bgcolor: 'background.paper' }}>
                            <FilterListIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper} sx={{ flexGrow: 1, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell align="center">접수일자</TableCell>
                                <TableCell align="center">지점</TableCell>
                                <TableCell align="center">통신사</TableCell>
                                <TableCell align="center">유형</TableCell>
                                <TableCell>모델명</TableCell>
                                <TableCell align="center">고객명</TableCell>
                                <TableCell align="center">연락처</TableCell>
                                <TableCell align="center">상태</TableCell>
                                <TableCell align="center">관리</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                                        <Typography color="text.secondary">표시할 데이터가 없습니다.</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => handleRowClick(row)}
                                    >
                                        <TableCell align="center">{row.date}</TableCell>
                                        <TableCell align="center">{row.store}</TableCell>
                                        <TableCell align="center" sx={{ color: getCarrierColor(row.carrier), fontWeight: 'bold' }}>
                                            {row.carrier}
                                        </TableCell>
                                        <TableCell align="center">{row.type}</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>{row.model}</TableCell>
                                        <TableCell align="center">{row.customer}</TableCell>
                                        <TableCell align="center">{row.contact}</TableCell>
                                        <TableCell align="center">{getStatusChip(row.status)}</TableCell>
                                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                            <Tooltip title="인쇄">
                                                <IconButton size="small">
                                                    <PrintIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default DirectSalesReportTab;
