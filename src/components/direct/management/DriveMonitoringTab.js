import React, { useState, useEffect } from 'react';
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
  IconButton,
  Tooltip,
  Checkbox,
  FormControlLabel,
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

const DiscordImageMonitoringTab = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monitoringData, setMonitoringData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [refreshResults, setRefreshResults] = useState(null);

  useEffect(() => {
    loadMonitoringData();
    // 60초마다 자동 새로고침
    const interval = setInterval(loadMonitoringData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadMonitoringData = async (validateUrls = false) => {
    try {
      setLoading(true);
      const validateParam = validateUrls ? '&validate=true' : '';
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3002'}/api/discord/image-monitoring?type=direct${validateParam}`
      );
      
      if (!response.ok) {
        throw new Error('모니터링 데이터를 불러오는데 실패했습니다.');
      }
      
      const result = await response.json();
      if (result.success) {
        setMonitoringData(result.data);
        setError(null);
      } else {
        throw new Error(result.error || '알 수 없는 오류');
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

    try {
      setRefreshing(true);
      const isMeetingMode = window.location.pathname.includes('meeting') || 
                            document.title.includes('회의');
      
      let allItems = [];
      if (isMeetingMode && monitoringData.meeting) {
        allItems = monitoringData.meeting.slides.map(item => ({ type: 'meeting-slide', ...item }));
      } else if (monitoringData.direct) {
        allItems = [
          ...monitoringData.direct.mobileImages.map(item => ({ type: 'mobile-image', ...item })),
          ...monitoringData.direct.masterImages.map(item => ({ type: 'master-image', ...item })),
          ...monitoringData.direct.storePhotos.map(item => ({ type: 'store-photo', ...item }))
        ];
      }

      const itemsToRefresh = Array.from(selectedItems).map(index => allItems[index]);
      
      console.log(`🔄 [배치 갱신] ${itemsToRefresh.length}개 항목 갱신 시작...`);
      
      // 타임아웃 설정 (5분)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      
      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:3002'}/api/discord/batch-refresh-urls`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToRefresh }),
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        // 응답 상태 확인
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status} 오류` }));
          throw new Error(errorData.error || `서버 오류 (${response.status})`);
        }

        const result = await response.json();
        
        if (result.success) {
          setRefreshResults(result);
          const message = `갱신 완료: 성공 ${result.successCount}개, 실패 ${result.failCount}개`;
          console.log(`✅ [배치 갱신] ${message}`);
          alert(message);
          // 데이터 다시 로드
          await loadMonitoringData();
          setSelectedItems(new Set());
        } else {
          throw new Error(result.error || '갱신에 실패했습니다.');
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('❌ [배치 갱신] URL 갱신 오류:', err);
        
        // 네트워크 오류인 경우에도 서버에서 처리가 완료되었을 수 있으므로 확인
        if (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.message.includes('CORS')) {
          // 네트워크 오류지만 서버에서 처리가 완료되었을 수 있음
          // 사용자에게 확인 메시지 표시
          const shouldReload = window.confirm(
            '네트워크 오류가 발생했지만 서버에서 갱신이 완료되었을 수 있습니다.\n\n' +
            '데이터를 새로고침하여 확인하시겠습니까?'
          );
          if (shouldReload) {
            await loadMonitoringData();
            setSelectedItems(new Set());
          }
        } else {
          alert(`갱신 실패: ${err.message}`);
        }
      } finally {
        setRefreshing(false);
      }
    } catch (err) {
      // 바깥쪽 try 블록의 예외 처리 (예: setRefreshing(true) 이후의 예외)
      console.error('❌ [배치 갱신] 예상치 못한 오류:', err);
      setRefreshing(false);
      alert(`갱신 중 오류가 발생했습니다: ${err.message}`);
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

      // 모드에 따라 데이터 구조가 다름
      const isMeetingMode = window.location.pathname.includes('meeting') || 
                            document.title.includes('회의');
      
      let totalCount = 0;
      let allItems = [];
      let statsData = null;
      
      if (isMeetingMode && monitoringData.meeting) {
        // 회의모드
        const { meeting } = monitoringData;
        totalCount = meeting.slides.length;
        allItems = meeting.slides.map((item, idx) => ({
          ...item,
          index: idx,
          category: 'meeting-slide',
          label: `${item.meetingId} - ${item.slideId} (${item.title || '제목 없음'})`
        }));
        statsData = {
          slides: meeting.slides.length
        };
      } else if (monitoringData.direct) {
        // 직영점 관리모드
        const { direct } = monitoringData;
        totalCount = direct.mobileImages.length + direct.masterImages.length + direct.storePhotos.length;
        allItems = [
          ...direct.mobileImages.map((item, idx) => ({ ...item, index: idx, category: 'mobile-image', label: `${item.carrier} - ${item.modelName || item.modelId}` })),
          ...direct.masterImages.map((item, idx) => ({ ...item, index: direct.mobileImages.length + idx, category: 'master-image', label: `${item.carrier} - ${item.modelName || item.modelId}` })),
          ...direct.storePhotos.map((item, idx) => ({ ...item, index: direct.mobileImages.length + direct.masterImages.length + idx, category: 'store-photo', label: `${item.storeName} - ${item.photoType}` }))
        ];
        statsData = {
          mobileImages: direct.mobileImages.length,
          masterImages: direct.masterImages.length,
          storePhotos: direct.storePhotos.length
        };
      }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          Discord 이미지 URL 모니터링
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => loadMonitoringData(false)}
            disabled={loading}
          >
            새로고침
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => loadMonitoringData(true)}
            disabled={loading}
            color="secondary"
          >
            상태 검증
          </Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshSelected}
            disabled={refreshing || selectedItems.size === 0}
          >
            선택 항목 갱신 ({selectedItems.size})
          </Button>
        </Stack>
      </Box>

      {/* 통계 카드 */}
      {statsData && (
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
      )}

      {/* 갱신 결과 */}
      {refreshResults && (
        <Alert 
          severity={refreshResults.failCount === 0 ? 'success' : 'warning'} 
          sx={{ mb: 3 }}
          onClose={() => setRefreshResults(null)}
        >
          <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
            갱신 완료
          </Typography>
          <Typography variant="body2">
            총 {refreshResults.total}개 중 성공: {refreshResults.successCount}개, 실패: {refreshResults.failCount}개
          </Typography>
        </Alert>
      )}

      {/* 이미지 목록 */}
      {totalCount > 0 ? (
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
      )}
    </Box>
  );
};

export default DiscordImageMonitoringTab;
