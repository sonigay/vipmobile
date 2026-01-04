import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { API_BASE_URL } from '../../api';

// 드래그 가능한 탭 컴포넌트
const SortableTab = ({ tab, index, activeTabIndex, onTabClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: tab.policyTableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <Tab
      ref={setNodeRef}
      style={style}
      {...attributes}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            {...listeners}
            sx={{
              cursor: 'grab',
              display: 'inline-flex',
              alignItems: 'center',
              '&:active': {
                cursor: 'grabbing'
              }
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Box>
          <Box
            onClick={(e) => {
              e.stopPropagation();
              onTabClick(e, index);
            }}
            sx={{ cursor: 'pointer', flex: 1 }}
          >
            {tab.policyTableName}
          </Box>
        </Box>
      }
      value={index}
    />
  );
};

// 날짜 포맷팅 함수 (생성일시, 등록일시용)
const formatDate = (dateValue) => {
  if (!dateValue) return '-';
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return dateValue || '-';
    }
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.warn('날짜 포맷팅 오류:', dateValue, error);
    return dateValue || '-';
  }
};

const PolicyTableListTab = ({ loggedInStore, mode }) => {
  const [tabs, setTabs] = useState([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [watermarkedImageUrl, setWatermarkedImageUrl] = useState(null); // 워터마크가 포함된 이미지 URL

  // 검색/필터링
  const [searchCreator, setSearchCreator] = useState('');
  const [filterApplyDateFrom, setFilterApplyDateFrom] = useState('');

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 권한 체크
  // 일반정책모드인 경우 modePermissions.generalPolicy로 체크
  // 정책모드인 경우 userRole로 체크
  const userRole = loggedInStore?.userRole;
  const twoLetterPattern = /^[A-Z]{2}$/;
  const canAccess = mode === 'generalPolicy' 
    ? loggedInStore?.modePermissions?.generalPolicy === true
    : userRole && (['A', 'B', 'C', 'D', 'E', 'F', 'S', 'SS'].includes(userRole) || twoLetterPattern.test(userRole));
  const canDelete = userRole === 'SS' || (userRole && twoLetterPattern.test(userRole));

  useEffect(() => {
    if (canAccess) {
      loadTabs();
    }
  }, [canAccess]);

  // 정책 목록 캐싱을 위한 상태
  const [policiesCache, setPoliciesCache] = useState({});

  useEffect(() => {
    if (tabs.length > 0 && activeTabIndex < tabs.length) {
      const tabName = tabs[activeTabIndex].policyTableName;
      // 캐시에 있으면 캐시에서 가져오고, 없으면 로드
      if (policiesCache[tabName]) {
        setPolicies(policiesCache[tabName]);
      } else {
        loadPolicies(tabName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeTabIndex]);

  // loadPolicies 함수 수정하여 캐시에 저장

  const loadTabs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (mode) {
        params.append('mode', mode);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/tabs?${params}`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        // 권한 필터링은 백엔드에서 처리되지만, 프론트엔드에서도 한 번 더 확인
        setTabs(data);
        if (data.length > 0) {
          setActiveTabIndex(0);
        }
      }
    } catch (error) {
      console.error('탭 목록 로드 오류:', error);
      setError('탭 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadPolicies = async (policyTableName) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        policyTableName: policyTableName,
        ...(searchCreator && { creator: searchCreator }),
        ...(filterApplyDateFrom && { applyDateSearch: filterApplyDateFrom }),
        ...(mode && { mode: mode })
      });

      const response = await fetch(`${API_BASE_URL}/api/policy-tables?${params}`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        // 생성일시 기준으로 내림차순 정렬 (가장 최근 정책이 위로)
        const sortedData = data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA; // 내림차순
        });
        setPolicies(sortedData);
        // 캐시에 저장 (탭 전환 시 재로딩 방지)
        setPoliciesCache(prev => ({ ...prev, [policyTableName]: sortedData }));
      }
    } catch (error) {
      console.error('정책표 목록 로드 오류:', error);
      setError('정책표 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTabIndex(newValue);
    // 캐시에서 로드하므로 빈 배열로 초기화하지 않음 (성능 개선)
    // setPolicies([]);
    setSearchCreator('');
    setFilterApplyDateFrom('');
  };

  // 탭 순서 저장
  const saveTabOrder = async (newTabs) => {
    try {
      setSavingOrder(true);
      const order = newTabs.map(tab => tab.policyTableId);
      
      // 헤더 값 안전하게 처리 (한글 등 특수문자 인코딩)
      const userName = loggedInStore?.name || loggedInStore?.target || 'Unknown';
      const safeUserName = typeof userName === 'string' ? encodeURIComponent(userName) : 'Unknown';
      
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/tabs/order`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
          'x-user-name': safeUserName
        },
        body: JSON.stringify({ order })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('탭 순서 저장 완료');
          // 성공 메시지 표시 (선택사항)
          // alert('탭 순서가 저장되었습니다.');
        } else {
          console.error('탭 순서 저장 실패:', data.error);
          setError('탭 순서 저장에 실패했습니다.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('탭 순서 저장 실패:', response.status, errorData);
        setError('탭 순서 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('탭 순서 저장 오류:', error);
      setError('탭 순서 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingOrder(false);
    }
  };

  // 드래그 종료 핸들러
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTabs((items) => {
        const oldIndex = items.findIndex(item => item.policyTableId === active.id);
        const newIndex = items.findIndex(item => item.policyTableId === over.id);
        
        const newTabs = arrayMove(items, oldIndex, newIndex);
        
        // 순서 저장
        saveTabOrder(newTabs);
        
        // 활성 탭 인덱스 업데이트
        const currentTabId = items[activeTabIndex]?.policyTableId;
        if (currentTabId) {
          const newActiveIndex = newTabs.findIndex(tab => tab.policyTableId === currentTabId);
          if (newActiveIndex !== -1) {
            setActiveTabIndex(newActiveIndex);
          }
        }
        
        return newTabs;
      });
    }
  };

  const handlePolicyClick = async (policy) => {
    try {
      const params = new URLSearchParams();
      if (mode) {
        params.append('mode', mode);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/${policy.id}?${params}`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
          'x-user-name': encodeURIComponent(loggedInStore?.userName || loggedInStore?.name || '')
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedPolicy(data);
        setImageError(false);
        setDetailModalOpen(true);

        // 정책모드일 때만 확인이력 기록 (일반정책모드에서는 기록하지 않음)
        if (mode !== 'generalPolicy' && loggedInStore?.contactId && loggedInStore?.name) {
          try {
            await fetch(`${API_BASE_URL}/api/policy-tables/${policy.id}/view`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-role': loggedInStore?.userRole || '',
                'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
                'x-user-name': encodeURIComponent(loggedInStore?.userName || loggedInStore?.name || '')
              },
              body: JSON.stringify({
                companyId: loggedInStore.contactId || loggedInStore.id,
                companyName: loggedInStore.name || loggedInStore.userName
              })
            });
          } catch (viewError) {
            console.error('확인이력 기록 실패:', viewError);
            // 확인이력 기록 실패는 무시 (사용자에게 오류 표시하지 않음)
          }
        }
      }
    } catch (error) {
      console.error('정책표 상세 조회 오류:', error);
      setError('정책표 상세를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleRefreshImage = async () => {
    if (!selectedPolicy) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/${selectedPolicy.id}/refresh-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.id || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedPolicy({ ...selectedPolicy, imageUrl: data.imageUrl });
        setImageError(false);
        alert('이미지가 갱신되었습니다.');
      } else {
        const errorData = await response.json();
        setError(errorData.error || '이미지 갱신에 실패했습니다.');
      }
    } catch (error) {
      console.error('이미지 갱신 오류:', error);
      setError('이미지 갱신 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 워터마크가 포함된 이미지 생성 함수 (일반정책모드용)
  const createWatermarkedImage = async (imageUrl) => {
    if (mode !== 'generalPolicy' || !loggedInStore?.name && !loggedInStore?.userName) {
      return imageUrl; // 일반정책모드가 아니거나 사용자 정보가 없으면 원본 반환
    }

    try {
      const watermarkText = loggedInStore?.name || loggedInStore?.userName || '';
      if (!watermarkText) return imageUrl;

      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            // 원본 이미지 그리기
            ctx.drawImage(img, 0, 0);
            
            // 워터마크 설정
            ctx.fillStyle = 'rgba(0, 0, 0, 0.03)'; // 매우 투명한 검은색
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 워터마크를 여러 개 그리기 (랜덤 위치, 회전)
            const watermarkCount = 12;
            for (let i = 0; i < watermarkCount; i++) {
              const x = Math.random() * canvas.width;
              const y = Math.random() * canvas.height;
              const rotation = (Math.random() - 0.5) * 60; // -30도 ~ +30도
              const fontSize = 20 + Math.random() * 30; // 20px ~ 50px
              
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate((rotation * Math.PI) / 180);
              ctx.font = `bold ${fontSize}px Arial`;
              ctx.fillText(watermarkText, 0, 0);
              ctx.restore();
            }
            
            // Canvas를 Blob URL로 변환
            canvas.toBlob((blob) => {
              URL.revokeObjectURL(blobUrl);
              if (blob) {
                const watermarkedUrl = URL.createObjectURL(blob);
                resolve(watermarkedUrl);
              } else {
                reject(new Error('Canvas to blob conversion failed'));
              }
            }, 'image/png', 1.0);
          } catch (err) {
            URL.revokeObjectURL(blobUrl);
            reject(err);
          }
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Image load failed'));
        };
        
        img.src = blobUrl;
      });
    } catch (error) {
      console.error('워터마크 이미지 생성 오류:', error);
      return imageUrl; // 오류 시 원본 반환
    }
  };

  // 정책 선택 시 워터마크 이미지 생성
  useEffect(() => {
    let currentWatermarkedUrl = null;

    if (selectedPolicy && selectedPolicy.imageUrl && mode === 'generalPolicy') {
      createWatermarkedImage(selectedPolicy.imageUrl)
        .then(url => {
          currentWatermarkedUrl = url;
          setWatermarkedImageUrl(url);
        })
        .catch(error => {
          console.error('워터마크 이미지 생성 실패:', error);
          setWatermarkedImageUrl(selectedPolicy.imageUrl);
        });
    } else {
      setWatermarkedImageUrl(null);
    }

    // 정리 함수: 컴포넌트 언마운트 시 URL 해제
    return () => {
      if (currentWatermarkedUrl && currentWatermarkedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentWatermarkedUrl);
      }
    };
  }, [selectedPolicy, mode, loggedInStore?.name, loggedInStore?.userName]);

  const handleCopyImage = async () => {
    if (!selectedPolicy || !selectedPolicy.imageUrl) return;

    try {
      // 일반정책모드이고 워터마크 이미지가 있으면 워터마크 이미지 사용, 아니면 원본 사용
      const imageUrlToCopy = (mode === 'generalPolicy' && watermarkedImageUrl) 
        ? watermarkedImageUrl 
        : selectedPolicy.imageUrl;

      // CORS 문제 해결을 위해 mode: 'cors' 추가
      // 그리고 이미지를 canvas로 변환하여 처리 (모바일 호환성 향상)
      const response = await fetch(imageUrlToCopy, {
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      
      // blob.type이 없거나 잘못된 경우 명시적으로 설정
      let imageType = blob.type;
      if (!imageType || !imageType.startsWith('image/')) {
        // Content-Type 헤더 확인
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          imageType = contentType;
        } else {
          // 기본값으로 image/png 사용
          imageType = 'image/png';
        }
      }

      // 모바일 브라우저 호환성을 위해 이미지를 canvas로 변환
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const imageLoadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((convertedBlob) => {
              if (convertedBlob) {
                resolve(convertedBlob);
              } else {
                reject(new Error('Canvas to blob conversion failed'));
              }
            }, imageType, 1.0);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Image load failed'));
      });

      // Blob URL 생성하여 이미지 로드
      const blobUrl = URL.createObjectURL(blob);
      img.src = blobUrl;

      const convertedBlob = await imageLoadPromise;
      URL.revokeObjectURL(blobUrl);

      // ClipboardItem 생성 시 명시적으로 타입 지정
      const clipboardItem = new ClipboardItem({ 
        [imageType]: convertedBlob 
      });

      await navigator.clipboard.write([clipboardItem]);

      alert('이미지가 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error('이미지 복사 오류:', error);
      console.error('오류 상세:', {
        message: error.message,
        stack: error.stack,
        imageUrl: selectedPolicy.imageUrl
      });
      
      // 모바일에서 실패할 경우 대안 제시
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        alert('모바일에서 이미지 복사에 실패했습니다.\n이미지를 길게 눌러 저장하거나, 이미지 URL을 복사해주세요.');
      } else {
        alert('이미지 복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정책표를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });

      if (response.ok) {
        const currentTab = tabs[activeTabIndex];
        if (currentTab) {
          await loadPolicies(currentTab.policyTableName);
        }
        if (selectedPolicy && selectedPolicy.id === id) {
          setDetailModalOpen(false);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('정책표 삭제 오류:', error);
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const currentTab = tabs[activeTabIndex];
    if (currentTab) {
      loadPolicies(currentTab.policyTableName);
    }
  };

  if (!canAccess) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="warning">이 탭에 접근할 권한이 없습니다.</Alert>
      </Box>
    );
  }

  const currentTab = tabs[activeTabIndex];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        정책표목록
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 탭 */}
      {tabs.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tabs.map(tab => tab.policyTableId)}
              strategy={horizontalListSortingStrategy}
            >
              <Tabs
                value={activeTabIndex}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
              >
                {tabs.map((tab, index) => (
                  <SortableTab
                    key={tab.policyTableId}
                    tab={tab}
                    index={index}
                    activeTabIndex={activeTabIndex}
                    onTabClick={handleTabChange}
                  />
                ))}
              </Tabs>
            </SortableContext>
          </DndContext>
          {savingOrder && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" sx={{ ml: 1 }}>
                순서 저장 중...
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* 검색/필터링 */}
      {currentTab && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="생성자 검색"
                value={searchCreator}
                onChange={(e) => setSearchCreator(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="적용일시 검색"
                value={filterApplyDateFrom}
                onChange={(e) => setFilterApplyDateFrom(e.target.value)}
                placeholder="텍스트로 검색"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button variant="contained" fullWidth onClick={handleSearch}>
                검색
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* 테이블 */}
      {loading && policies.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>정책적용일시</TableCell>
                <TableCell>생성자</TableCell>
                {mode !== 'generalPolicy' && (
                  <TableCell>정책영업그룹</TableCell>
                )}
                <TableCell>생성일시</TableCell>
                <TableCell>등록일시</TableCell>
                <TableCell>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={mode !== 'generalPolicy' ? 6 : 5} align="center">
                    등록된 정책표가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((policy) => (
                  <TableRow
                    key={policy.id}
                    hover
                    onClick={() => handlePolicyClick(policy)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{policy.applyDate || '-'}</TableCell>
                    <TableCell>{policy.creator}</TableCell>
                    {mode !== 'generalPolicy' && (
                      <TableCell>
                        {policy.accessGroupNames && policy.accessGroupNames.length > 0
                          ? policy.accessGroupNames.join(', ')
                          : '-'}
                      </TableCell>
                    )}
                    <TableCell>{formatDate(policy.createdAt)}</TableCell>
                    <TableCell>{formatDate(policy.registeredAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canDelete && (
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(policy.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 상세 모달 */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          정책표 상세 - {selectedPolicy?.policyTableName}
        </DialogTitle>
        <DialogContent>
          {selectedPolicy && (
            <Box>
              {/* 상단: 정책적용일시, 정책적용내용 */}
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  정책적용일시
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {selectedPolicy.applyDate || '-'}
                </Typography>
                <Typography variant="subtitle2" gutterBottom>
                  정책적용내용
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                  {selectedPolicy.applyContent}
                </Typography>
              </Paper>

              {/* 하단: 이미지 */}
              <Paper sx={{ p: 2 }}>
                <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshImage}
                    disabled={loading}
                  >
                    정책다시확인하기
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyImage}
                  >
                    이미지복사하기
                  </Button>
                </Box>
                {imageError ? (
                  <Alert severity="warning">
                    이미지를 불러올 수 없습니다. "정책다시확인하기" 버튼을 클릭하여 이미지를 갱신해주세요.
                  </Alert>
                ) : (
                  <Box sx={{ textAlign: 'center' }}>
                    <img
                      src={(mode === 'generalPolicy' && watermarkedImageUrl) ? watermarkedImageUrl : selectedPolicy.imageUrl}
                      alt="정책표"
                      style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ddd', borderRadius: 4 }}
                      onError={() => {
                        setImageError(true);
                      }}
                    />
                  </Box>
                )}
              </Paper>

              {/* 확인 이력 (정책모드만) */}
              {mode !== 'generalPolicy' && selectedPolicy && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      확인 이력 ({(() => {
                        if (!selectedPolicy.viewHistory || !Array.isArray(selectedPolicy.viewHistory)) {
                          return 0;
                        }
                        // 중복 제거 (같은 업체의 첫 조회일시만 표시)
                        const uniqueViews = new Map();
                        selectedPolicy.viewHistory.forEach(view => {
                          if (view.companyId && !uniqueViews.has(view.companyId)) {
                            uniqueViews.set(view.companyId, view);
                          }
                        });
                        return uniqueViews.size;
                      })()}개 업체)
                    </Typography>
                    {(() => {
                      if (!selectedPolicy.viewHistory || !Array.isArray(selectedPolicy.viewHistory) || selectedPolicy.viewHistory.length === 0) {
                        return (
                          <Typography variant="body2" color="text.secondary">
                            아직 확인한 업체가 없습니다.
                          </Typography>
                        );
                      }

                      // 중복 제거 (같은 업체의 첫 조회일시만 표시)
                      const uniqueViews = new Map();
                      selectedPolicy.viewHistory.forEach(view => {
                        if (view.companyId && !uniqueViews.has(view.companyId)) {
                          uniqueViews.set(view.companyId, view);
                        } else if (view.companyId && uniqueViews.has(view.companyId)) {
                          // 이미 있는 경우, firstViewDate가 더 이전이면 업데이트
                          const existing = uniqueViews.get(view.companyId);
                          if (view.firstViewDate && existing.firstViewDate) {
                            if (new Date(view.firstViewDate) < new Date(existing.firstViewDate)) {
                              uniqueViews.set(view.companyId, view);
                            }
                          }
                        }
                      });

                      const uniqueViewHistory = Array.from(uniqueViews.values())
                        .sort((a, b) => {
                          const dateA = a.firstViewDate || a.viewDate || '';
                          const dateB = b.firstViewDate || b.viewDate || '';
                          return new Date(dateB) - new Date(dateA);
                        });

                      return (
                        <TableContainer component={Paper} sx={{ maxHeight: 300, mt: 1 }}>
                          <Table stickyHeader size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>번호</TableCell>
                                <TableCell>조회일시</TableCell>
                                <TableCell>업체명</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {uniqueViewHistory.map((view, index) => (
                                <TableRow key={view.companyId || index}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    {view.firstViewDate || view.viewDate || '-'}
                                  </TableCell>
                                  <TableCell>{view.companyName || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      );
                    })()}
                  </Paper>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailModalOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PolicyTableListTab;

