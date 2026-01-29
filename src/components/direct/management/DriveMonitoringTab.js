// eslint-disable-next-line
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Tooltip,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Image as ImageIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Store as StoreIcon,
  PhoneAndroid as PhoneIcon,
  Slideshow as SlideshowIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../../../api';

const DiscordImageMonitoringTab = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monitoringData, setMonitoringData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [refreshResults, setRefreshResults] = useState(null);
  // urlValidationCache를 ref로 변경하여 클로저 문제 해결
  const urlValidationCacheRef = useRef(new Map());
  const [refreshProgress, setRefreshProgress] = useState(0); // 갱신 진행률 (0-100)
  const [activeTab, setActiveTab] = useState('mobile');

  // 데이터 가공 및 필터링 헬퍼 함수
  const getFilteredData = () => {
    if (!monitoringData) return { allItems: [], statsData: null, totalCount: 0 };
    // ... (rest of function same, simplified for brevity in instruction, keeping same logic)
    const isMeetingMode = window.location.pathname.includes('meeting') ||
      document.title.includes('회의');

    let allItems = [];
    let statsData = null;

    if (isMeetingMode && monitoringData.meeting) {
      const { meeting } = monitoringData;
      allItems = meeting.slides.map((item, idx) => ({
        ...item,
        index: idx,
        category: 'meeting-slide',
        label: `${item.meetingId} - ${item.slideId} (${item.title || '제목 없음'})`
      }));
      statsData = { slides: meeting.slides.length };
    } else if (monitoringData.direct) {
      const { direct } = monitoringData;

      // 전체 데이터 (통계용)
      statsData = {
        mobileImages: direct.mobileImages.length,
        masterImages: direct.masterImages.length,
        storePhotos: direct.storePhotos.length
      };

      // 탭에 따라 데이터 필터링
      if (activeTab === 'mobile') {
        allItems = direct.mobileImages.map((item, idx) => ({
          ...item,
          index: idx,
          category: 'mobile-image',
          label: `${item.carrier} - ${item.modelName || item.modelId}`
        }));
      } else if (activeTab === 'master') {
        allItems = direct.masterImages.map((item, idx) => ({
          ...item,
          index: idx,
          category: 'master-image',
          label: `${item.carrier} - ${item.modelName || item.modelId}`
        }));
      } else if (activeTab === 'store') {
        allItems = direct.storePhotos.map((item, idx) => ({
          ...item,
          index: idx,
          category: 'store-photo',
          label: `${item.storeName} - ${item.photoType}`
        }));
      }
    }

    return { allItems, statsData, totalCount: allItems.length };
  };

  const { allItems, statsData, totalCount } = getFilteredData();

  // 탭 변경 시 선택 초기화
  useEffect(() => {
    setSelectedItems(new Set());
  }, [activeTab]);

  useEffect(() => {
    loadMonitoringData();
    // 60초마다 자동 새로고침 (검증 없이)
    const interval = setInterval(() => loadMonitoringData(false), 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMonitoringData = async (validateUrls = false) => {
    try {
      setLoading(true);
      // 검증 요청 시 캐시 무효화를 위해 타임스탬프 추가
      const validateParam = validateUrls ? `&validate=true&_t=${Date.now()}` : '';
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || API_BASE_URL}/api/discord/image-monitoring?type=direct${validateParam}`,
        {
          // 검증 요청 시 캐시 무시
          cache: validateUrls ? 'no-cache' : 'default'
        }
      );

      if (!response.ok) {
        throw new Error('모니터링 데이터를 불러오는데 실패했습니다.');
      }

      const data = await response.json();

      if (data.success) {
        const payload = data.data;
        // eslint-disable-next-line no-console
        console.log('📥 [Frontend] 데이터 수신 (Status Check):', {
          hasDirect: !!payload.direct,
          itemCount: payload.direct?.storePhotos?.length
        });

        if (payload.direct && payload.direct.storePhotos.length > 0) {
          const firstItem = payload.direct.storePhotos[0];
          // eslint-disable-next-line no-console
          console.log('🔍 [Frontend Debug] First Item Status:', {
            storeName: firstItem.storeName,
            photoType: firstItem.photoType,
            urlStatus: firstItem.urlStatus,
            urlValid: firstItem.urlValid
          });

          const expiredItems = payload.direct.storePhotos.filter(i => i.urlStatus !== 'valid');
          // eslint-disable-next-line no-console
          console.log(`⚠️ [Frontend] 만료된 매장사진 수: ${expiredItems.length}`);
        }

        // 검증 결과가 있으면 캐시에 저장
        if (validateUrls) {
          const newCache = new Map();
          const updateCache = (items) => {
            items.forEach(item => {
              if (item.imageUrl && item.urlStatus && item.urlStatus !== 'unknown') {
                newCache.set(item.imageUrl, {
                  urlStatus: item.urlStatus,
                  urlValid: item.urlValid,
                  urlError: item.urlError
                });
              }
            });
          };

          if (payload.direct) {
            updateCache(payload.direct.mobileImages || []);
            updateCache(payload.direct.masterImages || []);
            updateCache(payload.direct.storePhotos || []);
          }

          urlValidationCacheRef.current = newCache;
        }

        // 검증 결과가 없는 경우 캐시에서 복원
        if (!validateUrls && urlValidationCacheRef.current.size > 0) {
          const restoreValidation = (items) => {
            return items.map(item => {
              if (item.imageUrl && urlValidationCacheRef.current.has(item.imageUrl)) {
                const cached = urlValidationCacheRef.current.get(item.imageUrl);
                return {
                  ...item,
                  urlStatus: cached.urlStatus,
                  urlValid: cached.urlValid,
                  urlError: cached.urlError
                };
              }
              return item;
            });
          };

          if (payload.direct) {
            payload.direct.mobileImages = restoreValidation(payload.direct.mobileImages || []);
            payload.direct.masterImages = restoreValidation(payload.direct.masterImages || []);
            payload.direct.storePhotos = restoreValidation(payload.direct.storePhotos || []);
          }
        }

        setMonitoringData(payload);
        setError(null);
      } else {
        throw new Error(data.error || '알 수 없는 오류');
      }
    } catch (err) {
      console.error('모니터링 데이터 로드 오류:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (items) => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((_, index) => index)));
    }
  };

  const handleSelectItem = (index) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const handleRefreshSelected = async () => {
    if (selectedItems.size === 0) {
      alert('갱신할 항목을 선택해주세요.');
      return;
    }

    // 갱신 대상 아이템 필터링 (allItems에서 인덱스로 직접 조회)
    // allItems는 이미 getFilteredData로 현재 탭에 맞는 데이터임
    const targetItems = Array.from(selectedItems)
      .map(index => allItems[index])
      .filter(item => item !== undefined)
      .map(item => {
        // 백엔드 API에 맞게 데이터 가공
        if (item.category === 'mobile-image') {
          return {
            type: 'mobile-image',
            carrier: item.carrier,
            modelId: item.modelId,
            modelName: item.modelName,
            threadId: item.threadId,
            messageId: item.messageId
          };
        } else if (item.category === 'master-image') {
          return {
            type: 'master-image',
            carrier: item.carrier,
            modelId: item.modelId,
            modelName: item.modelName,
            threadId: item.threadId,
            messageId: item.messageId
          };
        } else if (item.category === 'store-photo') {
          return {
            type: 'store-photo',
            storeName: item.storeName,
            photoType: item.photoType,
            threadId: item.threadId,
            messageId: item.messageId
          };
        }
        return null;
      })
      .filter(item => item !== null);

    if (targetItems.length === 0) return;

    if (!window.confirm(`선택한 ${targetItems.length}개 항목의 이미지를 갱신하시겠습니까?\n(시간이 다소 소요될 수 있습니다)`)) {
      return;
    }

    setRefreshing(true);
    setRefreshProgress(0);

    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;

    console.log(`🔄 [클라이언트 배칭] 총 ${targetItems.length}개 항목 갱신 시작`);

    try {
      const chunkSize = 5;
      const chunks = [];
      for (let i = 0; i < targetItems.length; i += chunkSize) {
        chunks.push(targetItems.slice(i, i + chunkSize));
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`🔄 [클라이언트 배칭] 청크 ${i + 1}/${chunks.length} 처리 중...`);

        try {
          const response = await fetch('/api/discord/batch-refresh-urls', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items: chunk })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const result = await response.json();
          if (result.success) {
            successCount += result.successCount;
            failCount += result.failCount;
          } else {
            failCount += chunk.length;
            console.error(`❌ [클라이언트 배칭] 청크 ${i + 1} 실패:`, result.error);
          }
        } catch (error) {
          console.error(`❌ [클라이언트 배칭] 청크 ${i + 1} 요청 오류:`, error);
          failCount += chunk.length;
        }

        processedCount += chunk.length;
        const progress = Math.round((processedCount / targetItems.length) * 100);
        setRefreshProgress(progress);
        console.log(`📊 진행률: ${progress}% (${processedCount}/${targetItems.length})`);
      }

      // 데이터 다시 로드 및 즉시 검증
      await loadMonitoringData(true);

      alert(`갱신 완료!\n성공: ${successCount}건\n실패: ${failCount}건`);
      setSelectedItems(new Set());

    } catch (error) {
      console.error('이미지 일괄 갱신 오류:', error);
      alert('일괄 갱신 중 오류가 발생했습니다.');
    } finally {
      setRefreshing(false);
      setRefreshProgress(0);
    }
  };

  if (loading && !monitoringData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !monitoringData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={loadMonitoringData} sx={{ mt: 2 }}>다시 시도</Button>
      </Box>
    );
  }

  if (!monitoringData) {
    return null;
  }

  const isMeetingMode = window.location.pathname.includes('meeting') ||
    document.title.includes('회의');

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Discord 이미지 URL 모니터링
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => loadMonitoringData(true)}
              disabled={refreshing}
            >
              상태 검증
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshSelected}
              disabled={selectedItems.size === 0 || refreshing}
            >
              {refreshing ? '갱신 중...' : `선택 항목 갱신 (${selectedItems.size})`}
            </Button>
          </Stack>
        </Box>

        {/* 진행률 표시 바 */}
        {refreshing && (
          <Box sx={{ width: '100%', mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                이미지 URL 갱신 진행 중... (잠시 소요됩니다)
              </Typography>
              <Typography variant="caption" color="text.primary">
                {refreshProgress}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={refreshProgress} />
          </Box>
        )}

        {refreshResults && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRefreshResults(null)}>
            갱신 완료: 성공 {refreshResults.successCount}건, 실패 {refreshResults.failCount}건
          </Alert>
        )}
      </Box>

      {/* 통계 카드 */}
      {
        statsData && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {isMeetingMode ? (
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <SlideshowIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">회의 슬라이드</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {statsData.slides}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      회의목록
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ) : (
              <>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PhoneIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6">모델 이미지</Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {statsData.mobileImages}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        직영점_모델이미지
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <ImageIcon color="secondary" sx={{ mr: 1 }} />
                        <Typography variant="h6">단말 마스터</Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {statsData.masterImages}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        직영점_단말마스터
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <StoreIcon color="success" sx={{ mr: 1 }} />
                        <Typography variant="h6">매장 사진</Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {statsData.storePhotos}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        직영점_매장사진
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>
        )
      }

      {/* 탭 네비게이션 */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 2 }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant={activeTab === 'mobile' ? 'contained' : 'text'}
              onClick={() => setActiveTab('mobile')}
              startIcon={<PhoneIcon />}
            >
              모바일 이미지 ({statsData?.mobileImages || 0})
            </Button>
            <Button
              variant={activeTab === 'master' ? 'contained' : 'text'}
              onClick={() => setActiveTab('master')}
              startIcon={<PhoneIcon />}
            >
              마스터 이미지 ({statsData?.masterImages || 0})
            </Button>
            <Button
              variant={activeTab === 'store' ? 'contained' : 'text'}
              onClick={() => setActiveTab('store')}
              startIcon={<StoreIcon />}
            >
              매장 사진 ({statsData?.storePhotos || 0})
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* 이미지 목록 */}
      {
        totalCount > 0 ? (
          <Paper>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Discord 이미지 목록 (총 {totalCount}개)</Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedItems.size === allItems.length && allItems.length > 0}
                    indeterminate={selectedItems.size > 0 && selectedItems.size < allItems.length}
                    onChange={() => handleSelectAll(allItems)}
                  />
                }
                label="전체 선택"
              />
            </Box>
            <TableContainer sx={{ overflowX: 'auto', maxWidth: '100%' }}>
              <Table size="small" sx={{ minWidth: 800 }}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" width="50px"></TableCell>
                    <TableCell>유형</TableCell>
                    <TableCell>이름/모델</TableCell>
                    <TableCell>통신사</TableCell>
                    <TableCell>이미지 URL</TableCell>
                    <TableCell>메시지 ID</TableCell>
                    <TableCell>스레드 ID</TableCell>
                    <TableCell>상태</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allItems.map((item, index) => {
                    const isSelected = selectedItems.has(index);
                    const categoryIcon = item.category === 'mobile-image' ? <PhoneIcon /> :
                      item.category === 'master-image' ? <ImageIcon /> :
                        item.category === 'store-photo' ? <StoreIcon /> :
                          <SlideshowIcon />;
                    const categoryLabel = item.category === 'mobile-image' ? '모델이미지' :
                      item.category === 'master-image' ? '단말마스터' :
                        item.category === 'store-photo' ? '매장사진' :
                          '회의슬라이드';

                    return (
                      <TableRow
                        key={index}
                        hover
                        selected={isSelected}
                        onClick={() => handleSelectItem(index)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={isSelected} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {categoryIcon}
                            <Typography variant="body2">{categoryLabel}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {item.label}
                          </Typography>
                          {item.petName && (
                            <Typography variant="caption" color="text.secondary">
                              {item.petName}
                            </Typography>
                          )}
                          {item.photoType && (
                            <Typography variant="caption" color="text.secondary">
                              {item.photoType}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{item.carrier || item.meetingId || '-'}</TableCell>
                        <TableCell>
                          <Tooltip title={item.imageUrl}>
                            <Typography
                              variant="body2"
                              sx={{
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {item.imageUrl || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {item.messageId ? item.messageId.substring(0, 10) + '...' : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {item.threadId ? item.threadId.substring(0, 10) + '...' : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const urlStatus = item.urlStatus || 'unknown';
                            const urlValid = item.urlValid;

                            if (urlStatus === 'unknown' || urlValid === undefined) {
                              return (
                                <Chip
                                  icon={<WarningIcon />}
                                  label="미확인"
                                  color="default"
                                  size="small"
                                />
                              );
                            } else if (urlValid === true && urlStatus === 'valid') {
                              return (
                                <Chip
                                  icon={<CheckCircleIcon />}
                                  label="정상"
                                  color="success"
                                  size="small"
                                />
                              );
                            } else if (urlStatus === 'expired') {
                              return (
                                <Chip
                                  icon={<ErrorIcon />}
                                  label="만료"
                                  color="error"
                                  size="small"
                                />
                              );
                            } else {
                              return (
                                <Chip
                                  icon={<ErrorIcon />}
                                  label={item.urlError || "오류"}
                                  color="error"
                                  size="small"
                                />
                              );
                            }
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Discord 이미지가 없습니다.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              이미지를 업로드하면 여기에 표시됩니다.
            </Typography>
          </Paper>
        )
      }
    </Box >
  );
};

export default DiscordImageMonitoringTab;
