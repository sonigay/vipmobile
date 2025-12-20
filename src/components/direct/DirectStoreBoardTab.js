import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Chip, Card, CardContent, Grid, IconButton,
    CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Divider
} from '@mui/material';
import {
    Store as StoreIcon,
    Star as StarIcon,
    Feedback as FeedbackIcon,
    Build as BuildIcon
} from '@mui/icons-material';
import { customerAPI } from '../../api';

const CATEGORY_OPTIONS = [
    { value: '사용후기', label: '사용후기', icon: <StarIcon />, color: '#ff9800' },
    { value: '매장칭찬', label: '매장칭찬', icon: <FeedbackIcon />, color: '#4caf50' },
    { value: '건의사항', label: '건의사항', icon: <BuildIcon />, color: '#2196f3' }
];

const DirectStoreBoardTab = ({ loggedInStore, isManagementMode = false }) => {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPost, setSelectedPost] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);

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
            setPosts(data);
        } catch (err) {
            console.error('Error loading posts:', err);
            setError('게시글을 불러오는데 실패했습니다.');
            setPosts([]);
        } finally {
            setIsLoading(false);
        }
    }, [isManagementMode, loggedInStore]);

    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

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
                    {isManagementMode ? '전체 게시판' : '게시판'}
                </Typography>
                {!isManagementMode && loggedInStore && (
                    <Typography variant="body2" color="text.secondary">
                        {loggedInStore.name} 매장의 게시글만 표시됩니다
                    </Typography>
                )}
            </Box>

            {posts.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f9f9f9' }}>
                    <Typography color="text.secondary">아직 작성된 글이 없습니다.</Typography>
                </Paper>
            ) : (
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
