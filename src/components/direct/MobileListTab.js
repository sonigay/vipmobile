import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Button,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Edit as EditIcon,
  Recommend as RecommendIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../api/directStoreApi';

const MobileListTab = ({ onProductSelect }) => {
  const [carrierTab, setCarrierTab] = useState(0); // 0: SK, 1: KT, 2: LG
  const [mobileList, setMobileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCarrierChange = (event, newValue) => {
    setCarrierTab(newValue);
  };

  const getCurrentCarrier = () => {
    switch (carrierTab) {
      case 0: return 'SK';
      case 1: return 'KT';
      case 2: return 'LG';
      default: return 'SK';
    }
  };

  useEffect(() => {
    const fetchMobileList = async () => {
      try {
        setLoading(true);
        setError(null);
        const carrier = getCurrentCarrier();
        const data = await directStoreApi.getMobileList(carrier);
        setMobileList(data || []);
      } catch (err) {
        console.error('휴대폰 목록 로딩 실패:', err);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        setMobileList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMobileList();
  }, [carrierTab]);

  const [uploadingModelId, setUploadingModelId] = useState(null);
  const fileInputRef = React.useRef(null);

  // ... (existing useEffect)

  const handleImageUploadClick = (modelId) => {
    setUploadingModelId(modelId);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !uploadingModelId) return;

    try {
      setLoading(true); // 전체 로딩 혹은 개별 로딩 처리 (여기서는 전체 로딩으로 단순화)

      // API 호출
      const result = await directStoreApi.uploadImage(file, uploadingModelId);

      // 성공 시 리스트 업데이트 (이미지 URL 반영)
      setMobileList(prevList => prevList.map(item =>
        item.id === uploadingModelId
          ? { ...item, image: result.imageUrl } // 서버에서 imageUrl을 반환한다고 가정
          : item
      ));

      alert('이미지가 성공적으로 업로드되었습니다.');
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setLoading(false);
      setUploadingModelId(null);
    }
  };

  const handleRowClick = (model) => {
    if (onProductSelect) {
      onProductSelect(model);
    }
  };

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileChange}
      />

      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
        휴대폰 목록
      </Typography>

      {/* 통신사 탭 */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={carrierTab}
          onChange={handleCarrierChange}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          sx={{
            '& .MuiTab-root': {
              fontWeight: 'bold',
              fontSize: '1.1rem',
              py: 2
            },
            '& .Mui-selected': {
              bgcolor: 'rgba(212, 175, 55, 0.05)'
            }
          }}
        >
          <Tab label="SK Telecom" sx={{ color: '#e60012' }} />
          <Tab label="KT" sx={{ color: '#00abc7' }} />
          <Tab label="LG U+" sx={{ color: '#ec008c' }} />
        </Tabs>
      </Paper>

      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* 로딩 인디케이터 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* 상품 테이블 */
        <TableContainer component={Paper} sx={{ flexGrow: 1, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align="center" width="80">구분</TableCell>
                <TableCell align="center" width="100">이미지</TableCell>
                <TableCell>모델명 / 펫네임</TableCell>
                <TableCell align="right">출고가</TableCell>
                <TableCell align="right">공시지원금</TableCell>
                <TableCell align="center" colSpan={2} sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.5)' }}>
                  대리점 지원금
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    <span>부가유치</span>
                    <span>미유치</span>
                  </Box>
                </TableCell>
                <TableCell align="center" colSpan={2} sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.5)', bgcolor: 'rgba(212, 175, 55, 0.1)' }}>
                  구매가 (할부원금)
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    <span>부가유치</span>
                    <span>미유치</span>
                  </Box>
                </TableCell>
                <TableCell align="center" width="100">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mobileList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">표시할 데이터가 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                mobileList.map((row) => {
                  const purchasePriceAddon = (row.factoryPrice || 0) - (row.support || 0) - (row.storeSupport || 0);
                  const purchasePriceNoAddon = (row.factoryPrice || 0) - (row.support || 0) - (row.storeSupportNoAddon || 0);

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell align="center">
                        {row.isRecommended && <Chip icon={<RecommendIcon />} label="추천" color="primary" size="small" />}
                        {row.isPopular && <Chip icon={<StarIcon />} label="인기" color="secondary" size="small" />}
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ position: 'relative', display: 'inline-block' }}>
                          <Avatar
                            variant="rounded"
                            src={row.image}
                            sx={{ width: 60, height: 60, bgcolor: 'background.subtle' }}
                          >
                            <PhotoCameraIcon />
                          </Avatar>
                          <IconButton
                            size="small"
                            sx={{
                              position: 'absolute',
                              bottom: -8,
                              right: -8,
                              bgcolor: 'background.paper',
                              boxShadow: 1,
                              '&:hover': { bgcolor: 'primary.main', color: 'black' }
                            }}
                            onClick={() => handleImageUploadClick(row.id)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" fontWeight="bold">{row.petName}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.model}</Typography>
                      </TableCell>
                      <TableCell align="right">{row.factoryPrice?.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ color: 'info.main' }}>{row.support?.toLocaleString()}</TableCell>

                      {/* 대리점 지원금 */}
                      <TableCell align="right" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.3)' }}>
                        {row.storeSupport?.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {row.storeSupportNoAddon?.toLocaleString()}
                      </TableCell>

                      {/* 구매가 (할부원금) */}
                      <TableCell align="right" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.3)', bgcolor: 'rgba(212, 175, 55, 0.05)', fontWeight: 'bold', color: 'primary.main' }}>
                        {purchasePriceAddon.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ bgcolor: 'rgba(212, 175, 55, 0.05)' }}>
                        {purchasePriceNoAddon.toLocaleString()}
                      </TableCell>

                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outlined" size="small">
                          상세
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default MobileListTab;
