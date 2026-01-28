import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    IconButton,
    InputAdornment,
    Alert,
    Card,
    CardContent,
    CardActions,
    Chip,
    Stack
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Add as AddIcon,
    Save as SaveIcon,
    Search as SearchIcon,
    ErrorOutline as ErrorOutlineIcon
} from '@mui/icons-material';
import { api } from '../../../../api';

export default function StrategicProductSettings({ initialProducts, unmatchedProducts = [], onSaveSuccess }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // New product state
    const [newProduct, setNewProduct] = useState({
        subCategory: '',
        serviceCode: '',
        serviceName: '',
        points: ''
    });

    useEffect(() => {
        if (initialProducts) {
            setProducts(JSON.parse(JSON.stringify(initialProducts)));
        }
    }, [initialProducts]);

    const handleAddProduct = () => {
        if (!newProduct.serviceName || !newProduct.points) {
            alert('서비스명과 점수는 필수입니다.');
            return;
        }

        const productToAdd = {
            ...newProduct,
            points: parseFloat(newProduct.points)
        };

        setProducts([...products, productToAdd]);
        setNewProduct({ subCategory: '', serviceCode: '', serviceName: '', points: '' });
    };

    const handleDeleteProduct = (index) => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
            const newProducts = [...products];
            newProducts.splice(index, 1);
            setProducts(newProducts);
        }
    };

    const handleChange = (index, field, value) => {
        const newProducts = [...products];
        newProducts[index] = { ...newProducts[index], [field]: value };
        setProducts(newProducts);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            await api.saveMonthlyAwardSettings('strategic_products', products);
            alert('저장되었습니다.');
            if (onSaveSuccess) onSaveSuccess();
        } catch (error) {
            alert('저장 실패: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.subCategory.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Box>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                    <TextField
                        placeholder="검색..."
                        size="small"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </Box>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={loading}
                >
                    {loading ? '저장 중...' : '변경사항 저장'}
                </Button>
            </Box>

            {/* Unregistered Products Alert */}
            {unmatchedProducts && unmatchedProducts.length > 0 && (
                <Alert
                    severity="warning"
                    icon={<ErrorOutlineIcon />}
                    sx={{ mb: 3 }}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        미등록 전략상품이 발견되었습니다!
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        아래 태그를 클릭하면 자동으로 입력됩니다.
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        {unmatchedProducts.map((productName, idx) => (
                            <Chip
                                key={idx}
                                label={productName}
                                color="warning"
                                variant="outlined"
                                onClick={() => setNewProduct({ ...newProduct, serviceName: productName })}
                                sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#fff3e0' }, mb: 1 }}
                            />
                        ))}
                    </Stack>
                </Alert>
            )}

            {/* Add New Product Card */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>새 전략상품 추가</Typography>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                        <TextField
                            label="소분류 (별칭)"
                            size="small"
                            fullWidth
                            value={newProduct.subCategory}
                            onChange={(e) => setNewProduct({ ...newProduct, subCategory: e.target.value })}
                            placeholder="예: 유플릭스"
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField
                            label="부가서비스명 (정확히 입력)"
                            size="small"
                            fullWidth
                            required
                            value={newProduct.serviceName}
                            onChange={(e) => setNewProduct({ ...newProduct, serviceName: e.target.value })}
                            placeholder="예: 유플릭스 프리미엄"
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <TextField
                            label="코드 (선택)"
                            size="small"
                            fullWidth
                            value={newProduct.serviceCode}
                            onChange={(e) => setNewProduct({ ...newProduct, serviceCode: e.target.value })}
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <TextField
                            label="점수"
                            type="number"
                            size="small"
                            fullWidth
                            required
                            value={newProduct.points}
                            onChange={(e) => setNewProduct({ ...newProduct, points: e.target.value })}
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Button
                            variant="contained"
                            fullWidth
                            startIcon={<AddIcon />}
                            onClick={handleAddProduct}
                        >
                            추가
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Product List */}
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                등록된 전략상품 ({filteredProducts.length}개)
            </Typography>

            {filteredProducts.length === 0 ? (
                <Alert severity="info">등록된 전략상품이 없습니다.</Alert>
            ) : (
                <Grid container spacing={2}>
                    {filteredProducts.map((product, idx) => {
                        // Find actual index
                        const realIndex = products.findIndex(p => p === product);

                        return (
                            <Grid item xs={12} md={6} lg={4} key={idx}>
                                <Card variant="outlined">
                                    <CardContent sx={{ pb: 1 }}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12}>
                                                <TextField
                                                    label="부가서비스명"
                                                    fullWidth
                                                    size="small"
                                                    value={product.serviceName}
                                                    onChange={(e) => handleChange(realIndex, 'serviceName', e.target.value)}
                                                />
                                            </Grid>
                                            <Grid item xs={6}>
                                                <TextField
                                                    label="소분류"
                                                    fullWidth
                                                    size="small"
                                                    value={product.subCategory}
                                                    onChange={(e) => handleChange(realIndex, 'subCategory', e.target.value)}
                                                />
                                            </Grid>
                                            <Grid item xs={6}>
                                                <TextField
                                                    label="점수"
                                                    type="number"
                                                    fullWidth
                                                    size="small"
                                                    value={product.points}
                                                    onChange={(e) => handleChange(realIndex, 'points', parseFloat(e.target.value))}
                                                />
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                    <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                                        <Button
                                            size="small"
                                            color="error"
                                            startIcon={<DeleteIcon />}
                                            onClick={() => handleDeleteProduct(realIndex)}
                                        >
                                            삭제
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}
        </Box>
    );
}
