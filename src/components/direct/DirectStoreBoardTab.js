import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Chip, Card, CardContent, Grid, IconButton,
    CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Divider, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, ToggleButton, ToggleButtonGroup, Tooltip, Select, MenuItem,
    FormControl, InputLabel, TextField, InputAdornment
} from '@mui/material';
import {
    Store as StoreIcon,
    Star as StarIcon,
    Feedback as FeedbackIcon,
    Build as BuildIcon,
    ViewModule as ViewModuleIcon,
    TableChart as TableChartIcon,
    Search as SearchIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import { customerAPI, api } from '../../api';

const CATEGORY_OPTIONS = [
    { value: '사용후기', label: '사용후기', icon: <StarIcon />, color: '#ff9800' },
    { value: '매장칭찬', label: '매장칭찬', icon: <FeedbackIcon />, color: '#4caf50' },
    { value: '건의사항', label: '건의사항', icon: <BuildIcon />, color: '#2196f3' }
];

const DirectStoreBoardTab = ({ loggedInStore, isManagementMode = false }) => {
    const [posts, setPosts] = useState([]);
    const [allPosts, setAllPosts] = useState([]); // 전체 게시글 (필터링 전)
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPost, setSelectedPost] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
    const [selectedStoreFilter, setSelectedStoreFilter] = useState('all'); // 'all' or storeName
    const [stores, setStores] = useState([]); // 매장 목록
    const [searchTerm, setSearchTerm] = useState(''); // 검색어

    const loadPosts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            let data = [];
            if (isManagementMode) {
                // 관리 모드: 전체 글 조회
                data = await customerAPI.getBoardList();
            } else if (loggedInStore) {
                // 직영점 모드: 해당 매장의 글만 조회
                const posCode = loggedInStore.id; // POS코드
                data = await customerAPI.getBoardList(null, posCode);
            }
            setAllPosts(data); // 전체 게시글 저장
            setPosts(data); // 초기에는 전체 표시
        } catch (err) {
            console.error('Error loading posts:', err);
            setError('게시글을 불러오는데 실패했습니다.');
            setPosts([]);
            setAllPosts([]);
        } finally {
            setIsLoading(false);
        }
    }, [isManagementMode, loggedInStore]);

    // 매장 목록 로드 (관리 모드만)
    const loadStores = useCallback(async () => {
        if (!isManagementMode) return;
        try {
            const storeData = await api.getStores({ includeShipped: false });
            // VIP직영 매장만 필터링
            const vipStores = storeData.filter(store => store.vipStatus === 'VIP직영');
            setStores(vipStores);
        } catch (err) {
            console.error('Error loading stores:', err);
        }
    }, [isManagementMode]);

    // 매장 필터링 및 검색
    useEffect(() => {
        let filtered = [...allPosts];

        // 매장 필터링 (관리 모드만)
        if (isManagementMode && selectedStoreFilter !== 'all') {
            filtered = filtered.filter(post => post.storeName === selectedStoreFilter);
        }

        // 검색 필터링
        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(post => {
                return (
                    (post.title || '').toLowerCase().includes(searchLower) ||
                    (post.content || '').toLowerCase().includes(searchLower) ||
                    (post.customerName || '').toLowerCase().includes(searchLower) ||
                    (post.storeName || '').toLowerCase().includes(searchLower) ||
                    (post.category || '').toLowerCase().includes(searchLower)
                );
            });
        }

        setPosts(filtered);
    }, [selectedStoreFilter, allPosts, isManagementMode, searchTerm]);

    useEffect(() => {
        loadPosts();
        loadStores();
    }, [loadPosts, loadStores]);

    const handlePostClick = async (post) => {
        try {
            const detail = await customerAPI.getBoardPost(post.id);
            setSelectedPost(detail);
            setShowDetailDialog(true);
        } catch (err) {
            alert('게시글을 불러오는데 실패했습니다.');
        }
    };

    const getCategoryInfo = (category) => {
        return CATEGORY_OPTIONS.find(opt => opt.value === category) || CATEGORY_OPTIONS[0];
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {error}
            </Alert>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                            {isManagementMode ? '전체 게시판' : '게시판'}
                        </Typography>
                        {!isManagementMode && loggedInStore && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {loggedInStore.name} 매장의 게시글만 표시됩니다
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        {isManagementMode && stores.length > 0 && (
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel>매장 필터</InputLabel>
                                <Select
                                    value={selectedStoreFilter}
                                    label="매장 필터"
                                    onChange={(e) => setSelectedStoreFilter(e.target.value)}
                                >
                                    <MenuItem value="all">전체 매장</MenuItem>
                                    {stores.map(store => (
                                        <MenuItem key={store.id || store.name} value={store.name}>
                                            {store.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            onChange={(e, newMode) => {
                                if (newMode !== null) setViewMode(newMode);
                            }}
                            size="small"
                        >
                            <ToggleButton value="card" aria-label="카드 뷰">
                                <Tooltip title="카드 뷰">
                                    <ViewModuleIcon />
                                </Tooltip>
                            </ToggleButton>
                            <ToggleButton value="table" aria-label="테이블 뷰">
                                <Tooltip title="테이블 뷰">
                                    <TableChartIcon />
                                </Tooltip>
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>
                {/* 검색 바 */}
                <TextField
                    fullWidth
                    size="small"
                    placeholder="제목, 내용, 작성자, 매장명, 카테고리로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: searchTerm && (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={() => setSearchTerm('')}
                                    edge="end"
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                    sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
                />
            </Box>

            {posts.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f9f9f9' }}>
                    <Typography color="text.secondary">아직 작성된 글이 없습니다.</Typography>
                </Paper>
            ) : viewMode === 'card' ? (
                <Grid container spacing={3}>
                    {posts.map((post) => {
                        const categoryInfo = getCategoryInfo(post.category);
                        return (
                            <Grid item xs={12} md={6} lg={4} key={post.id}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: 6
                                        }
                                    }}
                                    onClick={() => handlePostClick(post)}
                                >
                                    <CardContent sx={{ flexGrow: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <Chip
                                                icon={categoryInfo.icon}
                                                label={categoryInfo.label}
                                                size="small"
                                                sx={{
                                                    bgcolor: categoryInfo.color,
                                                    color: 'white',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ ml: 'auto' }}
                                            >
                                                {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''}
                                            </Typography>
                                        </Box>
                                        <Typography
                                            variant="h6"
                                            sx={{
                                                fontWeight: 'bold',
                                                mb: 1,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical'
                                            }}
                                        >
                                            {post.title}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                mb: 2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: 'vertical',
                                                minHeight: '60px'
                                            }}
                                        >
                                            {post.content}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 'auto' }}>
                                            <StoreIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                                            <Typography variant="caption" color="text.secondary">
                                                {post.storeName || '미지정'}
                                            </Typography>
                                        </Box>
                                        {isManagementMode && (
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                작성자: {post.customerName}
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            ) : (
                <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', width: '80px' }}>카테고리</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>제목</TableCell>
                                {isManagementMode && (
                                    <TableCell sx={{ fontWeight: 'bold', width: '120px' }}>작성자</TableCell>
                                )}
                                <TableCell sx={{ fontWeight: 'bold', width: '150px' }}>매장</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', width: '120px' }}>작성일</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {posts.map((post) => {
                                const categoryInfo = getCategoryInfo(post.category);
                                return (
                                    <TableRow
                                        key={post.id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => handlePostClick(post)}
                                    >
                                        <TableCell>
                                            <Chip
                                                icon={categoryInfo.icon}
                                                label={categoryInfo.label}
                                                size="small"
                                                sx={{
                                                    bgcolor: categoryInfo.color,
                                                    color: 'white',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 'medium',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '400px'
                                                }}
                                            >
                                                {post.title}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{
                                                    display: 'block',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '400px',
                                                    mt: 0.5
                                                }}
                                            >
                                                {post.content}
                                            </Typography>
                                        </TableCell>
                                        {isManagementMode && (
                                            <TableCell>{post.customerName || '-'}</TableCell>
                                        )}
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <StoreIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                                                <Typography variant="body2">
                                                    {post.storeName || '미지정'}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* 상세보기 다이얼로그 */}
            {selectedPost && (
                <Dialog
                    open={showDetailDialog}
                    onClose={() => {
                        setShowDetailDialog(false);
                        setSelectedPost(null);
                    }}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                                icon={getCategoryInfo(selectedPost.category).icon}
                                label={getCategoryInfo(selectedPost.category).label}
                                size="small"
                                sx={{
                                    bgcolor: getCategoryInfo(selectedPost.category).color,
                                    color: 'white',
                                    fontWeight: 'bold'
                                }}
                            />
                            <Typography variant="h6" sx={{ flexGrow: 1 }}>
                                {selectedPost.title}
                            </Typography>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                작성자: {selectedPost.customerName} | 작성일: {selectedPost.createdAt ? new Date(selectedPost.createdAt).toLocaleString() : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <StoreIcon sx={{ fontSize: 16 }} />
                                <Typography variant="body2">
                                    {selectedPost.storeName} | {selectedPost.storePhone} | {selectedPost.storeAddress}
                                </Typography>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                                {selectedPost.content}
                            </Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => {
                            setShowDetailDialog(false);
                            setSelectedPost(null);
                        }}>닫기</Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );
};

export default DirectStoreBoardTab;
