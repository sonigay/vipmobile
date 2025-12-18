import React, { useState, useEffect, useMemo } from 'react';
import { 
    Box, Typography, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, 
    DialogActions, TextField, Button, Grid, IconButton, Stack, Paper, Table, 
    TableBody, TableCell, TableContainer, TableHead, TableRow 
} from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon, CloudUpload as CloudUploadIcon, Store as StoreIcon } from '@mui/icons-material';
import Map from '../Map';
import { fetchData, customerAPI } from '../../api';

/**
 * 직영점모드/관리모드용 선호구입매장 탭
 * 매장 선택 및 사전승낙서마크, 매장 사진 관리 기능 제공
 */
const DirectStorePreferredStoreTab = ({ loggedInStore, isManagementMode = false }) => {
    const [stores, setStores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStore, setSelectedStore] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    
    // 편집 다이얼로그 상태
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [editPreApprovalMark, setEditPreApprovalMark] = useState('');
    const [editStorePhotos, setEditStorePhotos] = useState({
        frontUrl: '',
        insideUrl: '',
        outsideUrl: '',
        outside2Url: '',
        managerUrl: '',
        staff1Url: '',
        staff2Url: '',
        staff3Url: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingPhotoType, setUploadingPhotoType] = useState(null); // 현재 업로드 중인 사진 타입

    // stores는 이미 필터링되어 있으므로 그대로 사용
    // Hook 규칙: 모든 Hook은 최상위에서 호출되어야 함
    const filteredStores = useMemo(() => {
        return stores;
    }, [stores]);

    useEffect(() => {
        // 사용자 위치 가져오기
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    setUserLocation({ lat: 37.5665, lng: 126.9780 });
                }
            );
        } else {
            setUserLocation({ lat: 37.5665, lng: 126.9780 });
        }

        const loadStores = async () => {
            setIsLoading(true);
            try {
                const response = await fetchData(false); // excludeShipped = false
                if (response.success) {
                    let vipStores;
                    
                    if (isManagementMode) {
                        // 관리 모드: VIP직영인 모든 매장 표시
                        vipStores = response.data.filter(store =>
                            store.vipStatus === 'VIP직영'
                        );
                    } else {
                        // 직영점 모드: 로그인한 본인 매장만 표시
                        if (loggedInStore && (loggedInStore.id || loggedInStore.name)) {
                            vipStores = response.data.filter(store =>
                                store.vipStatus === 'VIP직영' &&
                                (store.id === loggedInStore.id || store.name === loggedInStore.name)
                            );
                        } else {
                            vipStores = [];
                        }
                    }
                    
                    setStores(vipStores);
                } else {
                    setError('매장 정보를 불러오는데 실패했습니다.');
                }
            } catch (err) {
                console.error('Error loading stores:', err);
                setError('매장 정보를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        loadStores();
    }, [isManagementMode, loggedInStore]);

    // 매장 선택 핸들러 (편집 다이얼로그 열기)
    const handleStoreSelect = async (store) => {
        setSelectedStore(store);
        setEditingStore(store);
        setEditDialogOpen(true);
        
        // 기존 데이터 로드
        try {
            const [mark, photos] = await Promise.all([
                customerAPI.getPreApprovalMark(store.name),
                customerAPI.getStorePhotos(store.name)
            ]);
            
            setEditPreApprovalMark(mark?.url || '');
            
            if (photos) {
                setEditStorePhotos({
                    frontUrl: photos.frontPhoto || '',
                    insideUrl: photos.insidePhoto || '',
                    outsideUrl: photos.outsidePhoto || '',
                    outside2Url: photos.outside2Photo || '',
                    managerUrl: photos.managerPhoto || '',
                    staff1Url: photos.staff1Photo || '',
                    staff2Url: photos.staff2Photo || '',
                    staff3Url: photos.staff3Photo || ''
                });
            } else {
                setEditStorePhotos({
                    frontUrl: '',
                    insideUrl: '',
                    outsideUrl: '',
                    outside2Url: '',
                    managerUrl: '',
                    staff1Url: '',
                    staff2Url: '',
                    staff3Url: ''
                });
            }
        } catch (error) {
            console.error('매장 정보 로드 실패:', error);
            setEditPreApprovalMark('');
            setEditStorePhotos({
                frontUrl: '',
                insideUrl: '',
                outsideUrl: '',
                outside2Url: '',
                managerUrl: '',
                staff1Url: '',
                staff2Url: '',
                staff3Url: ''
            });
        }
    };

    // 편집 다이얼로그 닫기
    const handleCloseEditDialog = () => {
        setEditDialogOpen(false);
        setEditingStore(null);
        setEditPreApprovalMark('');
        setEditStorePhotos({
            frontUrl: '',
            insideUrl: '',
            outsideUrl: '',
            outside2Url: '',
            managerUrl: '',
            staff1Url: '',
            staff2Url: '',
            staff3Url: ''
        });
    };

    // 파일 업로드 핸들러
    const handleFileUpload = async (event, photoType) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!editingStore) {
            alert('매장을 먼저 선택해주세요.');
            return;
        }

        // 이미지 파일 검증
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드 가능합니다.');
            return;
        }

        setUploadingPhotoType(photoType);
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('storeName', editingStore.name);
            formData.append('photoType', photoType);

            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3002'}/api/direct/store-image/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '업로드 실패' }));
                throw new Error(errorData.error || '업로드에 실패했습니다.');
            }

            const data = await response.json();
            
            // 업로드된 URL을 해당 필드에 자동 입력
            const urlFieldMap = {
                front: 'frontUrl',
                inside: 'insideUrl',
                outside: 'outsideUrl',
                outside2: 'outside2Url',
                manager: 'managerUrl',
                staff1: 'staff1Url',
                staff2: 'staff2Url',
                staff3: 'staff3Url'
            };

            const fieldName = urlFieldMap[photoType];
            if (fieldName) {
                setEditStorePhotos(prev => ({
                    ...prev,
                    [fieldName]: data.url
                }));
            }

            alert('업로드되었습니다.');
        } catch (error) {
            console.error('파일 업로드 실패:', error);
            alert('업로드에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
        } finally {
            setUploadingPhotoType(null);
            // 파일 input 초기화
            event.target.value = '';
        }
    };

    // 저장
    const handleSaveStoreInfo = async () => {
        if (!editingStore) return;
        
        setIsSaving(true);
        try {
            // 사전승낙서마크 저장
            if (editPreApprovalMark.trim()) {
                await customerAPI.savePreApprovalMark(editingStore.name, editPreApprovalMark.trim());
            }
            
            // 매장 사진 저장
            await customerAPI.saveStorePhotos({
                storeName: editingStore.name,
                frontUrl: editStorePhotos.frontUrl.trim(),
                insideUrl: editStorePhotos.insideUrl.trim(),
                outsideUrl: editStorePhotos.outsideUrl.trim(),
                outside2Url: editStorePhotos.outside2Url.trim(),
                managerUrl: editStorePhotos.managerUrl.trim(),
                staff1Url: editStorePhotos.staff1Url.trim(),
                staff2Url: editStorePhotos.staff2Url.trim(),
                staff3Url: editStorePhotos.staff3Url.trim()
            });
            
            alert('저장되었습니다.');
            handleCloseEditDialog();
        } catch (error) {
            console.error('저장 실패:', error);
            alert('저장에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                선호구입매장 관리
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                지도에서 매장을 클릭하여 사전승낙서마크와 매장 사진을 관리할 수 있습니다.
            </Typography>

            <Box 
                id="direct-store-map-container"
                sx={{ 
                    height: '500px', 
                    width: '100%', 
                    position: 'relative', 
                    borderRadius: 2, 
                    overflow: 'hidden', 
                    border: '1px solid #eee', 
                    mb: 3, 
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    '& > .MuiPaper-root': {
                        height: '500px !important',
                        width: '100% !important',
                        margin: '0 !important',
                        padding: '0 !important',
                        display: 'flex !important',
                        flexDirection: 'column !important',
                        position: 'relative !important',
                        overflow: 'hidden !important',
                        flex: '1 1 auto !important'
                    },
                    '& .leaflet-container': {
                        height: '500px !important',
                        width: '100% !important',
                        minHeight: '500px !important',
                        maxHeight: '500px !important',
                        position: 'absolute !important',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 0
                    },
                    '& .leaflet-map-pane': {
                        height: '500px !important',
                        width: '100% !important',
                        position: 'absolute !important',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                    },
                    '& .leaflet-tile-pane': {
                        height: '500px !important',
                        width: '100% !important',
                        position: 'absolute !important',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                    },
                    '& .leaflet-overlay-pane': {
                        height: '500px !important',
                        width: '100% !important',
                        position: 'absolute !important',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                    },
                    '& .leaflet-pane': {
                        position: 'absolute !important',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                    },
                    '& .leaflet-tile': {
                        visibility: 'visible !important',
                        opacity: 1 !important
                    }
                }}
            >
                <Map
                    userLocation={userLocation}
                    filteredStores={filteredStores}
                    isAgentMode={false}
                    currentView="all"
                    onStoreSelect={handleStoreSelect}
                    isCustomerMode={false}
                    useCustomerStylePopup={true}
                    loggedInStore={loggedInStore}
                    fixedHeight={500}
                />
            </Box>

            {/* 매장 정보 테이블 */}
            <Box sx={{ flexShrink: 0 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StoreIcon color="primary" />
                    매장 목록
                </Typography>
                <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>업체명</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>전화</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>휴대폰</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>사업자번호</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>점장명</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>매장주소</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }} align="center">관리</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredStores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            표시할 매장이 없습니다.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredStores.map((store) => (
                                    <TableRow key={store.id || store.uniqueId} hover>
                                        <TableCell sx={{ fontWeight: 'medium' }}>{store.name || '-'}</TableCell>
                                        <TableCell>{store.phone || '-'}</TableCell>
                                        <TableCell>{store.storePhone || '-'}</TableCell>
                                        <TableCell>{store.businessNumber || '-'}</TableCell>
                                        <TableCell>{store.managerName || store.manager || '-'}</TableCell>
                                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {store.address || '-'}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Button
                                                variant="outlined"
                                                color="primary"
                                                size="small"
                                                onClick={() => handleStoreSelect(store)}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                편집
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* 편집 다이얼로그 */}
            <Dialog 
                open={editDialogOpen} 
                onClose={handleCloseEditDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6">매장 정보 편집 - {editingStore?.name}</Typography>
                        <IconButton onClick={handleCloseEditDialog} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        {/* 사전승낙서마크 */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                                사전승낙서 마크
                            </Typography>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label="사전승낙서 마크 HTML"
                                value={editPreApprovalMark}
                                onChange={(e) => setEditPreApprovalMark(e.target.value)}
                                placeholder='<a href="https://ictmarket.or.kr:8443/precon/pop_CertIcon.do?PRECON_REQ_ID=PRE0000136285" target="_blank"><img style="cursor:pointer;" src="https://ictmarket.or.kr:8443/getCertIcon.do?cert_icon=KL20060528930E004"></a>'
                                helperText="사전승낙서 마크 HTML 코드를 입력하세요"
                            />
                        </Grid>

                        {/* 매장 사진 */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                                매장 사진 URL
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            fullWidth
                                            label="전면 사진 URL"
                                            value={editStorePhotos.frontUrl}
                                            onChange={(e) => setEditStorePhotos({ ...editStorePhotos, frontUrl: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id="upload-front"
                                            type="file"
                                            onChange={(e) => handleFileUpload(e, 'front')}
                                            disabled={uploadingPhotoType === 'front'}
                                        />
                                        <label htmlFor="upload-front">
                                            <IconButton
                                                color="primary"
                                                component="span"
                                                disabled={uploadingPhotoType === 'front' || !editingStore}
                                            >
                                                {uploadingPhotoType === 'front' ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                                            </IconButton>
                                        </label>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            fullWidth
                                            label="내부 사진 URL"
                                            value={editStorePhotos.insideUrl}
                                            onChange={(e) => setEditStorePhotos({ ...editStorePhotos, insideUrl: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id="upload-inside"
                                            type="file"
                                            onChange={(e) => handleFileUpload(e, 'inside')}
                                            disabled={uploadingPhotoType === 'inside'}
                                        />
                                        <label htmlFor="upload-inside">
                                            <IconButton
                                                color="primary"
                                                component="span"
                                                disabled={uploadingPhotoType === 'inside' || !editingStore}
                                            >
                                                {uploadingPhotoType === 'inside' ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                                            </IconButton>
                                        </label>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            fullWidth
                                            label="외부 사진 URL"
                                            value={editStorePhotos.outsideUrl}
                                            onChange={(e) => setEditStorePhotos({ ...editStorePhotos, outsideUrl: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id="upload-outside"
                                            type="file"
                                            onChange={(e) => handleFileUpload(e, 'outside')}
                                            disabled={uploadingPhotoType === 'outside'}
                                        />
                                        <label htmlFor="upload-outside">
                                            <IconButton
                                                color="primary"
                                                component="span"
                                                disabled={uploadingPhotoType === 'outside' || !editingStore}
                                            >
                                                {uploadingPhotoType === 'outside' ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                                            </IconButton>
                                        </label>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            fullWidth
                                            label="외부2 사진 URL"
                                            value={editStorePhotos.outside2Url}
                                            onChange={(e) => setEditStorePhotos({ ...editStorePhotos, outside2Url: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id="upload-outside2"
                                            type="file"
                                            onChange={(e) => handleFileUpload(e, 'outside2')}
                                            disabled={uploadingPhotoType === 'outside2'}
                                        />
                                        <label htmlFor="upload-outside2">
                                            <IconButton
                                                color="primary"
                                                component="span"
                                                disabled={uploadingPhotoType === 'outside2' || !editingStore}
                                            >
                                                {uploadingPhotoType === 'outside2' ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                                            </IconButton>
                                        </label>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Grid>

                        {/* 점장 및 직원 사진 */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                                점장 및 직원 사진 URL
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            fullWidth
                                            label="점장 사진 URL"
                                            value={editStorePhotos.managerUrl}
                                            onChange={(e) => setEditStorePhotos({ ...editStorePhotos, managerUrl: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id="upload-manager"
                                            type="file"
                                            onChange={(e) => handleFileUpload(e, 'manager')}
                                            disabled={uploadingPhotoType === 'manager'}
                                        />
                                        <label htmlFor="upload-manager">
                                            <IconButton
                                                color="primary"
                                                component="span"
                                                disabled={uploadingPhotoType === 'manager' || !editingStore}
                                            >
                                                {uploadingPhotoType === 'manager' ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                                            </IconButton>
                                        </label>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            fullWidth
                                            label="직원1 사진 URL"
                                            value={editStorePhotos.staff1Url}
                                            onChange={(e) => setEditStorePhotos({ ...editStorePhotos, staff1Url: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id="upload-staff1"
                                            type="file"
                                            onChange={(e) => handleFileUpload(e, 'staff1')}
                                            disabled={uploadingPhotoType === 'staff1'}
                                        />
                                        <label htmlFor="upload-staff1">
                                            <IconButton
                                                color="primary"
                                                component="span"
                                                disabled={uploadingPhotoType === 'staff1' || !editingStore}
                                            >
                                                {uploadingPhotoType === 'staff1' ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                                            </IconButton>
                                        </label>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            fullWidth
                                            label="직원2 사진 URL"
                                            value={editStorePhotos.staff2Url}
                                            onChange={(e) => setEditStorePhotos({ ...editStorePhotos, staff2Url: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id="upload-staff2"
                                            type="file"
                                            onChange={(e) => handleFileUpload(e, 'staff2')}
                                            disabled={uploadingPhotoType === 'staff2'}
                                        />
                                        <label htmlFor="upload-staff2">
                                            <IconButton
                                                color="primary"
                                                component="span"
                                                disabled={uploadingPhotoType === 'staff2' || !editingStore}
                                            >
                                                {uploadingPhotoType === 'staff2' ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                                            </IconButton>
                                        </label>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            fullWidth
                                            label="직원3 사진 URL"
                                            value={editStorePhotos.staff3Url}
                                            onChange={(e) => setEditStorePhotos({ ...editStorePhotos, staff3Url: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id="upload-staff3"
                                            type="file"
                                            onChange={(e) => handleFileUpload(e, 'staff3')}
                                            disabled={uploadingPhotoType === 'staff3'}
                                        />
                                        <label htmlFor="upload-staff3">
                                            <IconButton
                                                color="primary"
                                                component="span"
                                                disabled={uploadingPhotoType === 'staff3' || !editingStore}
                                            >
                                                {uploadingPhotoType === 'staff3' ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                                            </IconButton>
                                        </label>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEditDialog} disabled={isSaving}>
                        취소
                    </Button>
                    <Button 
                        onClick={handleSaveStoreInfo} 
                        variant="contained" 
                        disabled={isSaving}
                        startIcon={<SaveIcon />}
                    >
                        {isSaving ? '저장 중...' : '저장'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DirectStorePreferredStoreTab;
