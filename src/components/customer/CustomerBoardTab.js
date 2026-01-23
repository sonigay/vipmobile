import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Button, TextField, Dialog, DialogTitle, DialogContent,
    DialogActions, Select, MenuItem, FormControl, InputLabel, Chip, Card, CardContent,
    CardActions, IconButton, CircularProgress, Alert, Grid, Avatar, Divider,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton,
    ToggleButtonGroup, Tooltip
} from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Store as StoreIcon,
    Star as StarIcon,
    Feedback as FeedbackIcon,
    Build as BuildIcon,
    ViewModule as ViewModuleIcon,
    TableChart as TableChartIcon
} from '@mui/icons-material';
import { customerAPI } from '../../api';
import CustomerPreferredStoreTab from './CustomerPreferredStoreTab';

const CATEGORY_OPTIONS = [
    { value: '사용후기', label: '사용후기', icon: <StarIcon />, color: '#ff9800' },
    { value: '매장칭찬', label: '매장칭찬', icon: <FeedbackIcon />, color: '#4caf50' },
    { value: '건의사항', label: '건의사항', icon: <BuildIcon />, color: '#2196f3' }
];

const CustomerBoardTab = ({ customerInfo }) => {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showWriteDialog, setShowWriteDialog] = useState(false);
    const [showStoreSelectDialog, setShowStoreSelectDialog] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'

    // 글 작성 폼 상태
    const [formData, setFormData] = useState({
        category: '사용후기',
        title: '',
        content: '',
        storeName: '',
        storePhone: '',
        storeAddress: ''
    });

    const loadPosts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await customerAPI.getBoardList();
            setPosts(data);
        } catch (err) {
            console.error('Error loading posts:', err);
            setError('게시글을 불러오는데 실패했습니다.');
            setPosts([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

    const handleWriteClick = () => {
        // 매장이 선택되지 않았으면 매장 선택 다이얼로그 표시
        if (!formData.storeName) {
            setShowStoreSelectDialog(true);
        } else {
            setShowWriteDialog(true);
        }
    };

    const handleStoreSelect = (store) => {
        setFormData(prev => ({
            ...prev,
            storeName: store.name || store.storeName || '',
            storePhone: store.phone || store.storePhone || '',
            storeAddress: store.address || store.storeAddress || ''
        }));
        setShowStoreSelectDialog(false);
        setShowWriteDialog(true);
    };

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }
        if (!formData.content.trim()) {
            alert('내용을 입력해주세요.');
            return;
        }
        if (!formData.storeName) {
            alert('매장을 선택해주세요.');
            return;
        }

        try {
            await customerAPI.createBoardPost({
                ...formData,
                customerName: customerInfo?.name || '',
                customerCtn: customerInfo?.ctn || ''
            });
            await loadPosts();
            setShowWriteDialog(false);
            setFormData({
                category: '사용후기',
                title: '',
                content: '',
                storeName: '',
                storePhone: '',
                storeAddress: ''
            });
            alert('글이 작성되었습니다.');
        } catch (err) {
            alert('글 작성에 실패했습니다.');
        }
    };

    const handleDelete = async (id, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('정말로 삭제하시겠습니까?')) return;
        try {
            await customerAPI.deleteBoardPost(id);
            await loadPosts();
            alert('글이 삭제되었습니다.');
        } catch (err) {
            alert('글 삭제에 실패했습니다.');
        }
    };

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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    게시판
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                    {!(customerInfo?.isFirstPurchaseAdmin && customerInfo?.publicIdStatus === 'before') && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleWriteClick}
                            sx={{
                                bgcolor: '#1976d2',
                                '&:hover': { bgcolor: '#1565c0' }
                            }}
                        >
                            글쓰기
                        </Button>
                    )}
                </Box>
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
                                    </CardContent>
                                    {post.customerCtn === customerInfo?.ctn && (
                                        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={(e) => handleDelete(post.id, e)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </CardActions>
                                    )}
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            ) : (
                <TableContainer
                    component={Paper}
                    sx={{
                        boxShadow: 2,
                        overflowX: 'auto',
                        maxWidth: '100%'
                    }}
                >
                    <Table sx={{ minWidth: 600 }}>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', width: '80px' }}>카테고리</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>제목</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', width: '150px' }}>작성자</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', width: '150px' }}>매장</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', width: '120px' }}>작성일</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', width: '80px' }}>관리</TableCell>
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
                                        <TableCell>{post.customerName || '-'}</TableCell>
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
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            {post.customerCtn === customerInfo?.ctn && (
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={(e) => handleDelete(post.id, e)}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* 글 작성 다이얼로그 */}
            <Dialog
                open={showWriteDialog}
                onClose={() => {
                    setShowWriteDialog(false);
                    setFormData({
                        category: '사용후기',
                        title: '',
                        content: '',
                        storeName: '',
                        storePhone: '',
                        storeAddress: ''
                    });
                }}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>게시글 작성</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>카테고리</InputLabel>
                            <Select
                                value={formData.category}
                                label="카테고리"
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            >
                                {CATEGORY_OPTIONS.map(opt => (
                                    <MenuItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="제목"
                            fullWidth
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                        <TextField
                            label="내용"
                            fullWidth
                            multiline
                            rows={6}
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            required
                        />
                        <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                선택된 매장
                            </Typography>
                            <Typography variant="body2">{formData.storeName || '매장을 선택해주세요'}</Typography>
                            {formData.storeName && (
                                <Button
                                    size="small"
                                    onClick={() => setShowStoreSelectDialog(true)}
                                    sx={{ mt: 1 }}
                                >
                                    매장 변경
                                </Button>
                            )}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowWriteDialog(false)}>취소</Button>
                    <Button onClick={handleSubmit} variant="contained">작성</Button>
                </DialogActions>
            </Dialog>

            {/* 매장 선택 다이얼로그 */}
            {showStoreSelectDialog && (
                <Dialog
                    open={showStoreSelectDialog}
                    onClose={() => setShowStoreSelectDialog(false)}
                    maxWidth="lg"
                    fullWidth
                >
                    <DialogTitle>매장 선택</DialogTitle>
                    <DialogContent>
                        <CustomerPreferredStoreTab
                            selectedProduct={null}
                            customerInfo={customerInfo}
                            onStoreConfirm={(action, store) => {
                                if (store) {
                                    handleStoreSelect(store);
                                }
                            }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowStoreSelectDialog(false)}>취소</Button>
                    </DialogActions>
                </Dialog>
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

export default CustomerBoardTab;
