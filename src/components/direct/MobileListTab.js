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
  Alert,
  FormControlLabel,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Autocomplete,
  TextField
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Edit as EditIcon,
  Recommend as RecommendIcon,
  Star as StarIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import { Checkbox } from '@mui/material';
import { directStoreApi } from '../../api/directStoreApi';

const MobileListTab = ({ onProductSelect }) => {
  const [carrierTab, setCarrierTab] = useState(0); // 0: SK, 1: KT, 2: LG
  const [mobileList, setMobileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tagMenuAnchor, setTagMenuAnchor] = useState({}); // { modelId: anchorElement }
  const [planGroups, setPlanGroups] = useState([]); // 요금제군 목록
  const [selectedPlanGroups, setSelectedPlanGroups] = useState({}); // { modelId: planGroup }
  const [calculatedPrices, setCalculatedPrices] = useState({}); // { modelId: { storeSupportWithAddon, storeSupportWithoutAddon, purchasePriceWithAddon, purchasePriceWithoutAddon } }

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

  // 요금제군 목록 로드
  useEffect(() => {
    const fetchPlanGroups = async () => {
      try {
        const carrier = getCurrentCarrier();
        const linkSettings = await directStoreApi.getLinkSettings(carrier);
        if (linkSettings.success && linkSettings.planGroup) {
          setPlanGroups(linkSettings.planGroup.planGroups || []);
        }
      } catch (err) {
        console.error('요금제군 목록 로딩 실패:', err);
      }
    };

    fetchPlanGroups();
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

  const handleTagMenuOpen = (event, modelId) => {
    event.stopPropagation();
    setTagMenuAnchor(prev => ({ ...prev, [modelId]: event.currentTarget }));
  };

  const handleTagMenuClose = (modelId) => {
    setTagMenuAnchor(prev => {
      const newState = { ...prev };
      delete newState[modelId];
      return newState;
    });
  };

  const handleTagChange = async (modelId, tagType, checked) => {
    try {
      const currentMobile = mobileList.find(m => m.id === modelId);
      const tags = {
        isPopular: tagType === 'popular' ? checked : currentMobile?.isPopular || false,
        isRecommended: tagType === 'recommend' ? checked : currentMobile?.isRecommended || false,
        isCheap: tagType === 'cheap' ? checked : currentMobile?.isCheap || false,
        isPremium: tagType === 'premium' ? checked : currentMobile?.isPremium || false,
        isBudget: tagType === 'budget' ? checked : currentMobile?.isBudget || false
      };
      
      // 태그 외에도 모델 정보 전달하여 시트에 함께 저장되도록 함
      const payload = {
        ...tags,
        model: currentMobile?.model,
        petName: currentMobile?.petName,
        carrier: currentMobile?.carrier,
        factoryPrice: currentMobile?.factoryPrice,
        publicSupport: currentMobile?.publicSupport,
        storeSupport: currentMobile?.storeSupportWithAddon,
        storeSupportNoAddon: currentMobile?.storeSupportNoAddon,
        requiredAddons: currentMobile?.requiredAddons,
        image: currentMobile?.image
      };

      await directStoreApi.updateMobileTags(modelId, payload);
      
      // 로컬 상태 업데이트
      setMobileList(prevList => prevList.map(item => 
        item.id === modelId 
          ? { ...item, ...tags, tags: Object.keys(tags).filter(k => tags[k]) }
          : item
      ));
    } catch (err) {
      console.error('구분 태그 업데이트 실패:', err);
      alert('구분 태그 업데이트에 실패했습니다.');
    }
  };

  const getSelectedTags = (row) => {
    const tags = [];
    if (row.isPopular) tags.push('인기');
    if (row.isRecommended) tags.push('추천');
    if (row.isCheap) tags.push('저렴');
    if (row.isPremium) tags.push('프리미엄');
    if (row.isBudget) tags.push('중저가');
    return tags.length > 0 ? tags.join(', ') : '선택';
  };

  // 요금제군 선택 핸들러
  const handlePlanGroupChange = async (modelId, planGroup) => {
    if (!planGroup) {
      setSelectedPlanGroups(prev => {
        const newState = { ...prev };
        delete newState[modelId];
        return newState;
      });
      setCalculatedPrices(prev => {
        const newState = { ...prev };
        delete newState[modelId];
        return newState;
      });
      return;
    }

    setSelectedPlanGroups(prev => ({ ...prev, [modelId]: planGroup }));

    try {
      const carrier = getCurrentCarrier();
      const result = await directStoreApi.calculateMobilePrice(modelId, planGroup, '010신규', carrier);
      if (result.success) {
        setCalculatedPrices(prev => ({
          ...prev,
          [modelId]: {
            storeSupportWithAddon: result.storeSupportWithAddon,
            storeSupportWithoutAddon: result.storeSupportWithoutAddon,
            purchasePriceWithAddon: result.purchasePriceWithAddon,
            purchasePriceWithoutAddon: result.purchasePriceWithoutAddon
          }
        }));
      }
    } catch (err) {
      console.error('가격 계산 실패:', err);
    }
  };

  // 표시할 값 가져오기 (계산된 값이 있으면 사용, 없으면 원래 값)
  const getDisplayValue = (row, field) => {
    const calculated = calculatedPrices[row.id];
    if (calculated && calculatedPrices[row.id]) {
      return calculated[field];
    }
    return row[field];
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
                <TableCell align="center" width="120">구분</TableCell>
                <TableCell align="center" width="100">이미지</TableCell>
                <TableCell align="center" width="220">모델명 / 펫네임</TableCell>
                <TableCell align="center" width="120">요금제군</TableCell>
                <TableCell align="center" width="100">출고가</TableCell>
                <TableCell align="center" width="100">이통사지원금</TableCell>
                <TableCell align="center" colSpan={2} width="180" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.5)' }}>
                  대리점 지원금
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    <span>부가유치</span>
                    <span>미유치</span>
                  </Box>
                </TableCell>
                <TableCell align="center" colSpan={2} width="180" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.5)', bgcolor: 'rgba(212, 175, 55, 0.1)' }}>
                  구매가 (할부원금)
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    <span>부가유치</span>
                    <span>미유치</span>
                  </Box>
                </TableCell>
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
                  // directStoreApi에서 이미 계산된 값 사용
                  const purchasePriceAddon = row.purchasePriceWithAddon || (row.factoryPrice || 0) - (row.support || row.publicSupport || 0) - (row.storeSupport || 0);
                  const purchasePriceNoAddon = row.purchasePriceWithoutAddon || (row.factoryPrice || 0) - (row.support || row.publicSupport || 0) - (row.storeSupportNoAddon || 0);

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<LabelIcon />}
                          onClick={(e) => handleTagMenuOpen(e, row.id)}
                          sx={{ 
                            minWidth: 100,
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            py: 0.5
                          }}
                        >
                          {getSelectedTags(row)}
                        </Button>
                        <Menu
                          anchorEl={tagMenuAnchor[row.id]}
                          open={Boolean(tagMenuAnchor[row.id])}
                          onClose={() => handleTagMenuClose(row.id)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'popular', !row.isPopular);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isPopular || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip icon={<StarIcon />} label="인기" color="secondary" size="small" />
                            </ListItemText>
                          </MenuItem>
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'recommend', !row.isRecommended);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isRecommended || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip icon={<RecommendIcon />} label="추천" color="primary" size="small" />
                            </ListItemText>
                          </MenuItem>
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'cheap', !row.isCheap);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isCheap || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip label="저렴" color="success" size="small" />
                            </ListItemText>
                          </MenuItem>
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'premium', !row.isPremium);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isPremium || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip label="프리미엄" color="warning" size="small" />
                            </ListItemText>
                          </MenuItem>
                          <MenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleTagChange(row.id, 'budget', !row.isBudget);
                          }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={row.isBudget || false}
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemText>
                              <Chip label="중저가" color="info" size="small" />
                            </ListItemText>
                          </MenuItem>
                        </Menu>
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
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '0.95rem' }}>{row.petName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{row.model}</Typography>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Autocomplete
                          size="small"
                          options={planGroups}
                          value={selectedPlanGroups[row.id] || null}
                          onChange={(e, newValue) => handlePlanGroupChange(row.id, newValue)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="요금제군 선택"
                              sx={{ minWidth: 100 }}
                            />
                          )}
                          sx={{ minWidth: 120 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            textDecoration: 'line-through',
                            color: 'text.secondary'
                          }}
                        >
                          {row.factoryPrice?.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ color: 'info.main' }}>
                        {(row.support || row.publicSupport)?.toLocaleString()}
                      </TableCell>

                      {/* 대리점 지원금 */}
                      <TableCell align="center" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.3)', width: '90px' }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontSize: '1.1rem', 
                            fontWeight: 'bold', 
                            color: 'info.main' 
                          }}
                        >
                          {getDisplayValue(row, 'storeSupportWithAddon')?.toLocaleString() || (row.storeSupport || row.storeSupportWithAddon)?.toLocaleString() || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ width: '90px' }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontSize: '1.1rem', 
                            fontWeight: 'bold', 
                            color: 'warning.main' 
                          }}
                        >
                          {getDisplayValue(row, 'storeSupportWithoutAddon')?.toLocaleString() || row.storeSupportNoAddon?.toLocaleString() || '-'}
                        </Typography>
                      </TableCell>

                      {/* 구매가 (할부원금) */}
                      <TableCell align="center" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.3)', bgcolor: 'rgba(212, 175, 55, 0.05)', width: '90px' }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontSize: '1.15rem', 
                            fontWeight: 'bold', 
                            color: 'primary.main' 
                          }}
                        >
                          {getDisplayValue(row, 'purchasePriceWithAddon')?.toLocaleString() || purchasePriceAddon.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: 'rgba(212, 175, 55, 0.05)', width: '90px' }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontSize: '1.15rem', 
                            fontWeight: 'bold', 
                            color: 'success.main' 
                          }}
                        >
                          {getDisplayValue(row, 'purchasePriceWithoutAddon')?.toLocaleString() || purchasePriceNoAddon.toLocaleString()}
                        </Typography>
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
