import React, { useState, useEffect, useMemo } from 'react';
import { 
    Box, Typography, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, 
    DialogActions, TextField, Button, Grid, IconButton, Stack, Paper, Table, 
    TableBody, TableCell, TableContainer, TableHead, TableRow 
} from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon, CloudUpload as CloudUploadIcon, Store as StoreIcon, Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Check as CheckIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { Autocomplete, Chip } from '@mui/material';
import Map from '../Map';
import { fetchData, customerAPI } from '../../api';
import { directStoreApiClient } from '../../api/directStoreApiClient';

/**
 * 직영점모드/관리모드용 선호구입매장 탭
 * 매장 선택 및 사전승낙서마크, 매장 사진 관리 기능 제공
 */
const DirectStorePreferredStoreTab = ({ loggedInStore, isManagementMode = false, activeTab = null }) => {
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
    
    // 대중교통 위치 상태
    const [editBusTerminalIds, setEditBusTerminalIds] = useState([]); // 선택된 버스터미널 ID 배열
    const [editSubwayStationIds, setEditSubwayStationIds] = useState([]); // 선택된 지하철역 ID 배열
    const [allTransitLocations, setAllTransitLocations] = useState([]); // 모든 대중교통 위치 목록
    const [transitLocations, setTransitLocations] = useState([]); // 매장별 대중교통 위치 (지도 표시용)
    const [isLoadingTransit, setIsLoadingTransit] = useState(false);
    const [isAddingNewTransit, setIsAddingNewTransit] = useState({ type: null, name: '', address: '' }); // 새 위치 추가 상태

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
                    // 위치 정보 실패 시: 직영점모드는 접속 매장 중심, 관리모드는 평택 중심
                    if (isManagementMode) {
                        // 관리모드: 평택 중심 좌표 설정 (인천과 청주지역까지 보이도록)
                        setUserLocation({ lat: 36.9922, lng: 127.1128, isDefault: true });
                    } else if (loggedInStore?.coords?.lat && loggedInStore?.coords?.lng) {
                        // 직영점모드: 접속 매장 중심 좌표 사용
                        setUserLocation({ 
                            lat: loggedInStore.coords.lat, 
                            lng: loggedInStore.coords.lng,
                            isDefault: true 
                        });
                    } else {
                        // 매장 위치 정보가 없으면 평택 중심
                        setUserLocation({ lat: 36.9922, lng: 127.1128, isDefault: true });
                    }
                }
            );
        } else {
            // Geolocation 미지원 시: 직영점모드는 접속 매장 중심, 관리모드는 평택 중심
            if (isManagementMode) {
                // 관리모드: 평택 중심 좌표 설정 (인천과 청주지역까지 보이도록)
                setUserLocation({ lat: 36.9922, lng: 127.1128, isDefault: true });
            } else if (loggedInStore?.coords?.lat && loggedInStore?.coords?.lng) {
                // 직영점모드: 접속 매장 중심 좌표 사용
                setUserLocation({ 
                    lat: loggedInStore.coords.lat, 
                    lng: loggedInStore.coords.lng,
                    isDefault: true 
                });
            } else {
                // 매장 위치 정보가 없으면 평택 중심
                setUserLocation({ lat: 36.9922, lng: 127.1128, isDefault: true });
            }
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

    // 대중교통 위치 데이터 로드
    const loadAllTransitLocations = async () => {
        try {
            const response = await directStoreApiClient.getAllTransitLocations();
            if (response.success && response.data) {
                setAllTransitLocations(response.data);
            }
        } catch (error) {
            console.error('대중교통 위치 목록 로드 실패:', error);
        }
    };

    const loadTransitLocations = async () => {
        setIsLoadingTransit(true);
        try {
            const response = await directStoreApiClient.getTransitLocations();
            if (response.success && response.data) {
                setTransitLocations(response.data);
            }
        } catch (error) {
            console.error('매장별 대중교통 위치 로드 실패:', error);
        } finally {
            setIsLoadingTransit(false);
        }
    };

    // 컴포넌트 마운트 시 대중교통 위치 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            await loadAllTransitLocations();
            await loadTransitLocations();
        };
        loadData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 탭이 활성화될 때 지도 크기 재계산
    // activeTab이 변경되면 지도가 다시 마운트되므로, 마운트 후 크기 재계산
    useEffect(() => {
        if (!isLoading && stores.length > 0 && activeTab !== null) {
            // 지도가 마운트된 후 크기 재계산
            const timer = setTimeout(() => {
                const mapContainer = document.getElementById('direct-store-map-container');
                if (!mapContainer) return;
                
                const leafletContainer = mapContainer.querySelector('.leaflet-container');
                if (leafletContainer && leafletContainer._leaflet && typeof leafletContainer._leaflet.invalidateSize === 'function') {
                    try {
                        // 지도 크기 재계산
                        leafletContainer._leaflet.invalidateSize();
                        // 약간의 지연 후 다시 한 번 재계산 (타일 렌더링 보장)
                        setTimeout(() => {
                            if (leafletContainer._leaflet && typeof leafletContainer._leaflet.invalidateSize === 'function') {
                                leafletContainer._leaflet.invalidateSize();
                            }
                        }, 200);
                    } catch (error) {
                        console.warn('지도 크기 재계산 오류:', error);
                    }
                }
            }, 500);
            
            return () => clearTimeout(timer);
        }
    }, [isLoading, stores.length, activeTab]); // activeTab이 변경되면 재계산

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
        
        // 대중교통 위치 로드 (ID 배열로)
        try {
            const response = await directStoreApiClient.getTransitLocations();
            if (response.success && response.data) {
                const transitData = response.data.find(t => t.storeName === store.name);
                if (transitData) {
                    setEditBusTerminalIds(transitData.busTerminals ? transitData.busTerminals.map(t => t.id).filter(Boolean) : []);
                    setEditSubwayStationIds(transitData.subwayStations ? transitData.subwayStations.map(s => s.id).filter(Boolean) : []);
                } else {
                    setEditBusTerminalIds([]);
                    setEditSubwayStationIds([]);
                }
            } else {
                setEditBusTerminalIds([]);
                setEditSubwayStationIds([]);
            }
        } catch (error) {
            console.error('대중교통 위치 로드 실패:', error);
            setEditBusTerminalIds([]);
            setEditSubwayStationIds([]);
        }
        setIsAddingNewTransit({ type: null, name: '', address: '' });
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
        setEditBusTerminalIds([]);
        setEditSubwayStationIds([]);
        setIsAddingNewTransit({ type: null, name: '', address: '' });
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

    // 버스터미널 선택 핸들러
    const handleBusTerminalSelect = (event, newValue) => {
        if (newValue && newValue.id) {
            if (!editBusTerminalIds.includes(newValue.id)) {
                setEditBusTerminalIds([...editBusTerminalIds, newValue.id]);
            }
        }
    };
    
    // 버스터미널 삭제 핸들러
    const handleBusTerminalRemove = (idToRemove) => {
        setEditBusTerminalIds(editBusTerminalIds.filter(id => id !== idToRemove));
    };
    
    // 지하철역 선택 핸들러
    const handleSubwayStationSelect = (event, newValue) => {
        if (newValue && newValue.id) {
            if (!editSubwayStationIds.includes(newValue.id)) {
                setEditSubwayStationIds([...editSubwayStationIds, newValue.id]);
            }
        }
    };
    
    // 지하철역 삭제 핸들러
    const handleSubwayStationRemove = (idToRemove) => {
        setEditSubwayStationIds(editSubwayStationIds.filter(id => id !== idToRemove));
    };
    
    // 새 대중교통 위치 추가 핸들러
    const handleAddNewTransitLocation = async (type) => {
        const { name, address } = isAddingNewTransit;
        if (!name || !address) {
            alert('이름과 주소를 모두 입력해주세요.');
            return;
        }
        
        try {
            const response = await directStoreApiClient.createTransitLocation(type, name, address);
            if (response.success && response.data) {
                // 새로 생성된 위치를 선택 목록에 추가
                if (type === '버스터미널') {
                    setEditBusTerminalIds([...editBusTerminalIds, response.data.id]);
                } else {
                    setEditSubwayStationIds([...editSubwayStationIds, response.data.id]);
                }
                // 목록 새로고침
                await loadAllTransitLocations();
                // 입력 필드 초기화
                setIsAddingNewTransit({ type: null, name: '', address: '' });
                alert('대중교통 위치가 추가되었습니다.');
            } else {
                alert('대중교통 위치 추가에 실패했습니다: ' + (response.error || '알 수 없는 오류'));
            }
        } catch (error) {
            console.error('대중교통 위치 추가 실패:', error);
            alert('대중교통 위치 추가에 실패했습니다.');
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
            
            // 대중교통 위치 저장 (ID 배열로)
            const transitResponse = await directStoreApiClient.saveTransitLocation(
                editingStore.name,
                editBusTerminalIds,
                editSubwayStationIds
            );
            
            if (!transitResponse.success) {
                console.error('대중교통 위치 저장 실패:', transitResponse.error);
                // 대중교통 위치 저장 실패는 경고만 표시하고 계속 진행
            } else {
                // 캐시 갱신을 위해 데이터 다시 로드
                await loadTransitLocations();
                await loadAllTransitLocations();
            }
            
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
                    '& .leaflet-container': {
                        height: '100%',
                        width: '100%',
                        minHeight: '500px'
                    }
                }}
            >
                <Map
                    key={`map-${isManagementMode ? 'management' : 'direct'}-${activeTab !== null ? `tab-${activeTab}` : 'default'}-${isLoading ? 'loading' : 'ready'}-${stores.length}`}
                    userLocation={userLocation}
                    filteredStores={filteredStores}
                    isAgentMode={false}
                    currentView="all"
                    onStoreSelect={handleStoreSelect}
                    isCustomerMode={false}
                    useCustomerStylePopup={true}
                    loggedInStore={loggedInStore}
                    fixedHeight={500}
                    transitLocations={transitLocations}
                    showTransitMarkers={true}
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
                        
                        {/* 대중교통 위치 */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                                대중교통 위치
                            </Typography>
                            
                            {/* 버스터미널 섹션 */}
                            <Box sx={{ mb: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                        버스터미널
                                    </Typography>
                                </Box>
                                
                                {/* 선택된 버스터미널 표시 */}
                                <Box sx={{ mb: 2 }}>
                                    {editBusTerminalIds.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {editBusTerminalIds.map((id) => {
                                                const location = allTransitLocations.find(loc => loc.id === id && loc.type === '버스터미널');
                                                if (!location) return null;
                                                return (
                                                    <Chip
                                                        key={id}
                                                        label={`${location.name} (${location.address})`}
                                                        onDelete={() => handleBusTerminalRemove(id)}
                                                        color="primary"
                                                        variant="outlined"
                                                    />
                                                );
                                            })}
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                                            선택된 버스터미널이 없습니다.
                                        </Typography>
                                    )}
                                </Box>
                                
                                {/* 버스터미널 선택 드롭다운 */}
                                <Box sx={{ mb: 2 }}>
                                    <Autocomplete
                                        options={allTransitLocations.filter(loc => loc.type === '버스터미널')}
                                        getOptionLabel={(option) => `${option.name} - ${option.address}`}
                                        value={null}
                                        onChange={handleBusTerminalSelect}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="버스터미널 선택"
                                                placeholder="버스터미널을 선택하세요"
                                                size="small"
                                            />
                                        )}
                                        renderOption={(props, option) => (
                                            <li {...props} key={option.id}>
                                                <Box>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {option.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {option.address}
                                                    </Typography>
                                                </Box>
                                            </li>
                                        )}
                                    />
                                </Box>
                                
                                {/* 새 버스터미널 추가 */}
                                {isAddingNewTransit.type === '버스터미널' ? (
                                    <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', bgcolor: '#f9f9f9' }}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid item xs={12} sm={4}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="이름"
                                                    value={isAddingNewTransit.name}
                                                    onChange={(e) => setIsAddingNewTransit({ ...isAddingNewTransit, name: e.target.value })}
                                                    placeholder="예: 평택터미널"
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={5}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="주소"
                                                    value={isAddingNewTransit.address}
                                                    onChange={(e) => setIsAddingNewTransit({ ...isAddingNewTransit, address: e.target.value })}
                                                    placeholder="경기도 평택시..."
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={3}>
                                                <Button
                                                    fullWidth
                                                    size="small"
                                                    variant="contained"
                                                    onClick={() => handleAddNewTransitLocation('버스터미널')}
                                                    disabled={!isAddingNewTransit.name || !isAddingNewTransit.address}
                                                >
                                                    추가
                                                </Button>
                                                <Button
                                                    fullWidth
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => setIsAddingNewTransit({ type: null, name: '', address: '' })}
                                                    sx={{ mt: 1 }}
                                                >
                                                    취소
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                ) : (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<AddIcon />}
                                        onClick={() => setIsAddingNewTransit({ type: '버스터미널', name: '', address: '' })}
                                    >
                                        새 버스터미널 추가
                                    </Button>
                                )}
                            </Box>
                            
                            {/* 지하철역 섹션 */}
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                        지하철역
                                    </Typography>
                                </Box>
                                
                                {/* 선택된 지하철역 표시 */}
                                <Box sx={{ mb: 2 }}>
                                    {editSubwayStationIds.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {editSubwayStationIds.map((id) => {
                                                const location = allTransitLocations.find(loc => loc.id === id && loc.type === '지하철역');
                                                if (!location) return null;
                                                return (
                                                    <Chip
                                                        key={id}
                                                        label={`${location.name} (${location.address})`}
                                                        onDelete={() => handleSubwayStationRemove(id)}
                                                        color="secondary"
                                                        variant="outlined"
                                                    />
                                                );
                                            })}
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                                            선택된 지하철역이 없습니다.
                                        </Typography>
                                    )}
                                </Box>
                                
                                {/* 지하철역 선택 드롭다운 */}
                                <Box sx={{ mb: 2 }}>
                                    <Autocomplete
                                        options={allTransitLocations.filter(loc => loc.type === '지하철역')}
                                        getOptionLabel={(option) => `${option.name} - ${option.address}`}
                                        value={null}
                                        onChange={handleSubwayStationSelect}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="지하철역 선택"
                                                placeholder="지하철역을 선택하세요"
                                                size="small"
                                            />
                                        )}
                                        renderOption={(props, option) => (
                                            <li {...props} key={option.id}>
                                                <Box>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {option.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {option.address}
                                                    </Typography>
                                                </Box>
                                            </li>
                                        )}
                                    />
                                </Box>
                                
                                {/* 새 지하철역 추가 */}
                                {isAddingNewTransit.type === '지하철역' ? (
                                    <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', bgcolor: '#f9f9f9' }}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid item xs={12} sm={4}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="이름"
                                                    value={isAddingNewTransit.name}
                                                    onChange={(e) => setIsAddingNewTransit({ ...isAddingNewTransit, name: e.target.value })}
                                                    placeholder="예: 무선역 1번출구"
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={5}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="주소"
                                                    value={isAddingNewTransit.address}
                                                    onChange={(e) => setIsAddingNewTransit({ ...isAddingNewTransit, address: e.target.value })}
                                                    placeholder="경기도 평택시..."
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={3}>
                                                <Button
                                                    fullWidth
                                                    size="small"
                                                    variant="contained"
                                                    onClick={() => handleAddNewTransitLocation('지하철역')}
                                                    disabled={!isAddingNewTransit.name || !isAddingNewTransit.address}
                                                >
                                                    추가
                                                </Button>
                                                <Button
                                                    fullWidth
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => setIsAddingNewTransit({ type: null, name: '', address: '' })}
                                                    sx={{ mt: 1 }}
                                                >
                                                    취소
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                ) : (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<AddIcon />}
                                        onClick={() => setIsAddingNewTransit({ type: '지하철역', name: '', address: '' })}
                                    >
                                        새 지하철역 추가
                                    </Button>
                                )}
                            </Box>
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
