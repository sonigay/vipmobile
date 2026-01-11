import React, { useState, useEffect, useRef } from 'react';
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
  TablePagination,
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
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  DragIndicator as DragIndicatorIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
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
  const previousWatermarkedUrlRef = useRef(null); // 이전 워터마크 URL 추적용
  const [deletingPolicyId, setDeletingPolicyId] = useState(null); // 삭제 중인 정책표 ID (UI 업데이트용)

  // 검색/필터링
  const [searchCreator, setSearchCreator] = useState('');
  const [filterApplyDateFrom, setFilterApplyDateFrom] = useState('');

  // 페이지네이션
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 수정 모드 관련 상태
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({
    applyDate: '',
    applyContent: '',
    accessGroupIds: []
  });
  const [userGroups, setUserGroups] = useState([]);

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
      if (mode !== 'generalPolicy') {
        loadUserGroups();
      }
    }
  }, [canAccess, mode]);

  // 정책영업그룹 목록 로드
  const loadUserGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/policy-table/user-groups`, {
        headers: {
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        let groups = [];
        if (Array.isArray(data)) {
          groups = data;
        } else if (data.success !== false && Array.isArray(data.data)) {
          groups = data.data;
        }
        setUserGroups(groups);
      }
    } catch (error) {
      console.error('정책영업그룹 로드 오류:', error);
      setUserGroups([]);
    }
  };

  // 정책 목록 캐싱을 위한 상태 (모드별로 분리)
  const [policiesCache, setPoliciesCache] = useState({});

  useEffect(() => {
    if (tabs.length > 0 && activeTabIndex < tabs.length) {
      const tabName = tabs[activeTabIndex].policyTableName;
      // 캐시 키: 모드 + 탭이름 (모드별로 캐시 분리)
      const cacheKey = `${mode || 'default'}_${tabName}`;
      
      // 검색/필터링이 없을 때만 캐시 사용
      const hasFilters = searchCreator || filterApplyDateFrom;
      
      if (!hasFilters && policiesCache[cacheKey]) {
        setPolicies(policiesCache[cacheKey]);
      } else {
        loadPolicies(tabName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeTabIndex, mode, searchCreator, filterApplyDateFrom]);

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
        
        // 검색/필터링이 없을 때만 캐시에 저장
        const hasFilters = searchCreator || filterApplyDateFrom;
        if (!hasFilters) {
          // 캐시 키: 모드 + 탭이름 (모드별로 캐시 분리)
          const cacheKey = `${mode || 'default'}_${policyTableName}`;
          setPoliciesCache(prev => ({ ...prev, [cacheKey]: sortedData }));
        }
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
    setPage(0); // 탭 변경 시 첫 페이지로 리셋
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
        setIsEditMode(false);
        
        // 수정 폼 데이터 초기화
        const accessGroupIds = data.accessGroupId 
          ? (data.accessGroupId.startsWith('[') 
              ? JSON.parse(data.accessGroupId) 
              : [data.accessGroupId])
          : [];
        setEditFormData({
          applyDate: data.applyDate || '',
          applyContent: data.applyContent || '',
          accessGroupIds: accessGroupIds
        });

        // 확인이력 기록 (일반정책모드와 정책모드 모두 기록)
        // 확인이력 표시는 정책모드에서만 (아래 UI 코드에서 처리)
        // 일반정책모드: contactId 또는 id 사용, name 또는 userName 사용
        // 정책모드: contactId 또는 id 사용, name 또는 userName 사용
        const companyId = loggedInStore?.contactId || loggedInStore?.id;
        const companyName = loggedInStore?.name || loggedInStore?.userName;
        if (companyId && companyName) {
          try {
            const viewUrl = `${API_BASE_URL}/api/policy-tables/${policy.id}/view`;
            const requestHeaders = {
              'Content-Type': 'application/json',
              'x-user-role': loggedInStore?.userRole || '',
              'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
              'x-user-name': encodeURIComponent(loggedInStore?.userName || loggedInStore?.name || '')
            };
            // x-mode 헤더 추가
            // 일반정책모드: 'generalPolicy', 정책모드: 'policy' 또는 빈 문자열이 아닌 경우
            if (mode === 'generalPolicy') {
              requestHeaders['x-mode'] = 'generalPolicy';
            } else if (mode && mode !== 'generalPolicy') {
              // 정책모드인 경우 (mode가 있고 generalPolicy가 아닌 경우)
              requestHeaders['x-mode'] = 'policy';
            } else {
              // mode가 없는 경우 기본값으로 'policy' 사용
              requestHeaders['x-mode'] = 'policy';
            }
            const requestBody = {
              companyId: companyId,
              companyName: companyName
            };
            
            console.log('🔍 [확인이력] 요청 시작:', {
              url: viewUrl,
              method: 'POST',
              headers: requestHeaders,
              body: requestBody,
              mode: mode || 'undefined'
            });
            
            const viewResponse = await fetch(viewUrl, {
              method: 'POST',
              headers: requestHeaders,
              body: JSON.stringify(requestBody)
            });
            
            console.log('🔍 [확인이력] 응답 수신:', {
              status: viewResponse.status,
              statusText: viewResponse.statusText,
              ok: viewResponse.ok,
              headers: Object.fromEntries(viewResponse.headers.entries())
            });
            
            if (!viewResponse.ok) {
              const errorText = await viewResponse.text();
              console.error('❌ [확인이력] 응답 오류:', {
                status: viewResponse.status,
                statusText: viewResponse.statusText,
                body: errorText
              });
            } else {
              const responseData = await viewResponse.json();
              console.log('✅ [확인이력] 기록 성공:', responseData);
            }
          } catch (viewError) {
            console.error('❌ [확인이력] 기록 실패:', {
              error: viewError,
              message: viewError.message,
              stack: viewError.stack,
              name: viewError.name
            });
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
      
      // 이전 워터마크 URL 정리
      if (previousWatermarkedUrlRef.current && previousWatermarkedUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousWatermarkedUrlRef.current);
        previousWatermarkedUrlRef.current = null;
      }
      setWatermarkedImageUrl(null);
      
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
        
        // 일반정책모드인 경우 워터마크 이미지 재생성
        if (mode === 'generalPolicy' && data.imageUrl) {
          createWatermarkedImage(data.imageUrl)
            .then(url => {
              previousWatermarkedUrlRef.current = url;
              setWatermarkedImageUrl(url);
            })
            .catch(error => {
              console.error('워터마크 이미지 생성 실패:', error);
              setWatermarkedImageUrl(data.imageUrl);
            });
        }
        
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

      // Discord CDN 이미지인 경우 프록시를 통해 가져오기 (CORS 문제 해결)
      const isDiscordCdn = imageUrl.includes('cdn.discordapp.com') || imageUrl.includes('media.discordapp.net');
      let fetchUrl = imageUrl;
      
      if (isDiscordCdn) {
        // 프록시 URL 생성
        const proxyUrl = `${API_BASE_URL}/api/meetings/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        fetchUrl = proxyUrl;
      }

      const response = await fetch(fetchUrl, {
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
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 워터마크를 여러 개 그리기 (랜덤 위치, 회전) - 더 많이, 더 크게
            const watermarkCount = 30; // 12개에서 30개로 증가
            const minFontSize = 40; // 최소 폰트 크기 증가
            const maxFontSize = 120; // 최대 폰트 크기 증가
            
            // 격자 기반 배치로 분포 개선
            const gridCols = 6; // 6열
            const gridRows = 5; // 5행
            const cellWidth = canvas.width / gridCols;
            const cellHeight = canvas.height / gridRows;
            
            for (let i = 0; i < watermarkCount; i++) {
              // 격자 기반 위치 계산
              const col = i % gridCols;
              const row = Math.floor(i / gridCols);
              
              // 각 셀 내에서 랜덤 위치
              const baseX = col * cellWidth + cellWidth / 2;
              const baseY = row * cellHeight + cellHeight / 2;
              const offsetX = (Math.random() - 0.5) * cellWidth * 0.8; // 셀의 80% 범위 내
              const offsetY = (Math.random() - 0.5) * cellHeight * 0.8;
              
              const x = Math.max(0, Math.min(canvas.width, baseX + offsetX));
              const y = Math.max(0, Math.min(canvas.height, baseY + offsetY));
              const rotation = (Math.random() - 0.5) * 60; // -30도 ~ +30도
              const fontSize = minFontSize + Math.random() * (maxFontSize - minFontSize);
              
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
    // 이전 워터마크 URL 정리
    if (previousWatermarkedUrlRef.current && previousWatermarkedUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previousWatermarkedUrlRef.current);
      previousWatermarkedUrlRef.current = null;
    }

    if (selectedPolicy && selectedPolicy.imageUrl && mode === 'generalPolicy') {
      createWatermarkedImage(selectedPolicy.imageUrl)
        .then(url => {
          // 이전 URL 저장
          previousWatermarkedUrlRef.current = url;
          setWatermarkedImageUrl(url);
        })
        .catch(error => {
          console.error('워터마크 이미지 생성 실패:', error);
          setWatermarkedImageUrl(selectedPolicy.imageUrl);
        });
    } else {
      setWatermarkedImageUrl(null);
      previousWatermarkedUrlRef.current = null;
    }

    // 정리 함수: 컴포넌트 언마운트 시 URL 해제
    return () => {
      if (previousWatermarkedUrlRef.current && previousWatermarkedUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousWatermarkedUrlRef.current);
        previousWatermarkedUrlRef.current = null;
      }
    };
  }, [selectedPolicy?.id, selectedPolicy?.imageUrl, mode, loggedInStore?.name, loggedInStore?.userName]);

  const handleCopyImage = async () => {
    if (!selectedPolicy || !selectedPolicy.imageUrl) return;

    try {
      // 일반정책모드이고 워터마크 이미지가 있으면 워터마크 이미지 사용, 아니면 원본 사용
      let imageUrlToCopy = (mode === 'generalPolicy' && watermarkedImageUrl) 
        ? watermarkedImageUrl 
        : selectedPolicy.imageUrl;

      // 모바일 감지
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // Discord CDN 이미지인 경우 프록시를 통해 가져오기 (CORS 문제 해결)
      const isDiscordCdn = imageUrlToCopy.includes('cdn.discordapp.com') || imageUrlToCopy.includes('media.discordapp.net');
      if (isDiscordCdn && !imageUrlToCopy.startsWith('blob:')) {
        // blob URL이 아닌 경우에만 프록시 사용
        const proxyUrl = `${API_BASE_URL}/api/meetings/proxy-image?url=${encodeURIComponent(imageUrlToCopy)}`;
        imageUrlToCopy = proxyUrl;
      }

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

      let finalBlob = blob;

      // 모바일에서는 Canvas 변환을 완전히 피하고 원본 Blob을 직접 사용
      // Canvas 변환은 항상 품질 손실을 일으키므로 모바일에서는 원본 그대로 사용
      if (isMobile) {
        // 모바일: 원본 Blob을 직접 사용 (Canvas 변환 완전히 제거)
        finalBlob = blob;
        console.log('📱 [모바일] 원본 Blob 직접 사용 (Canvas 변환 없음)');
      } else if (!imageUrlToCopy.startsWith('blob:')) {
        // PC: 기존 로직 유지 (Canvas 변환)
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const imageLoadPromise = new Promise((resolve, reject) => {
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              
              // 이미지 품질 향상을 위한 설정
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              
              ctx.drawImage(img, 0, 0);
              
              // PNG는 quality 파라미터가 무시되므로 항상 PNG 사용
              // JPEG인 경우에만 quality 적용
              const outputType = imageType.includes('jpeg') || imageType.includes('jpg') ? 'image/jpeg' : 'image/png';
              const quality = outputType === 'image/jpeg' ? 1.0 : undefined; // JPEG만 quality 적용
              
              canvas.toBlob((convertedBlob) => {
                if (convertedBlob) {
                  resolve(convertedBlob);
                } else {
                  reject(new Error('Canvas to blob conversion failed'));
                }
              }, outputType, quality);
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error('Image load failed'));
        });

        const blobUrl = URL.createObjectURL(blob);
        img.src = blobUrl;

        finalBlob = await imageLoadPromise;
        
        URL.revokeObjectURL(blobUrl);
        imageType = imageType.includes('jpeg') || imageType.includes('jpg') ? 'image/jpeg' : 'image/png';
      } else {
        // blob URL인 경우 (워터마크 이미지) - 원본 그대로 사용
        // blob URL에서 직접 Blob 가져오기
        const blobResponse = await fetch(imageUrlToCopy);
        finalBlob = await blobResponse.blob();
        // blob URL의 경우 이미지 타입 확인
        if (!finalBlob.type || !finalBlob.type.startsWith('image/')) {
          imageType = 'image/png';
        } else {
          imageType = finalBlob.type;
        }
      }
      
      // 모바일에서 안정성을 위해 blob을 다시 확인
      if (!finalBlob || finalBlob.size === 0) {
        throw new Error('이미지 변환 실패: 빈 blob');
      }

      // 모바일 브라우저는 ClipboardItem에 이미지를 넣을 때 자동으로 압축하는 경우가 많음
      // 모바일에서는 클립보드 복사 없이 바로 원본 이미지 다운로드
      if (isMobile) {
        // 모바일: 원본 이미지 다운로드
        const blobUrl = URL.createObjectURL(finalBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `policy-${selectedPolicy.id || 'image'}.${imageType.includes('jpeg') || imageType.includes('jpg') ? 'jpg' : 'png'}`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Blob URL 정리 (약간의 지연 후)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        
        alert('이미지가 다운로드되었습니다. 다운로드한 이미지를 카카오톡 등에서 사용하세요.');
        return;
      }

      // PC: 클립보드 복사 (기존 로직)
      // 모바일에서 품질 유지를 위해 이미지 타입을 명확히 지정
      // PNG는 무손실 압축이므로 품질 손실이 없음
      let clipboardImageType = imageType;
      // PC에서는 가능하면 PNG 사용 (무손실)
      if (!imageType.includes('jpeg') && !imageType.includes('jpg')) {
        clipboardImageType = 'image/png';
      }

      // ClipboardItem 생성 시 명시적으로 타입 지정
      const clipboardItem = new ClipboardItem({ 
        [clipboardImageType]: finalBlob 
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

  const handleDelete = async (id, e) => {
    // 이벤트 전파 방지 (즉시 실행)
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    // confirm 다이얼로그를 열기 전에 이벤트 전파를 완전히 차단
    if (e && e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }

    // 이미 삭제 중인 경우 중복 실행 방지
    if (deletingPolicyId === id) {
      return;
    }

    if (!window.confirm('정책표를 삭제하시겠습니까?')) {
      return;
    }

    // 삭제 시작 플래그 설정 (UI 업데이트를 위해 state 사용)
    setDeletingPolicyId(id);

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
          // 정책 목록 새로고침 (삭제된 정책이 목록에서 사라짐)
          await loadPolicies(currentTab.policyTableName);
        }
        if (selectedPolicy && selectedPolicy.id === id) {
          setDetailModalOpen(false);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || '삭제에 실패했습니다.');
        // 삭제 실패 시 플래그 해제
        setDeletingPolicyId(null);
      }
    } catch (error) {
      console.error('정책표 삭제 오류:', error);
      setError('삭제 중 오류가 발생했습니다.');
      // 삭제 실패 시 플래그 해제
      setDeletingPolicyId(null);
    } finally {
      setLoading(false);
      // 삭제 완료 후 플래그 해제 (성공 시 loadPolicies 후 자동으로 사라지므로)
      // 약간의 지연을 두어 UI 업데이트가 완료되도록 함
      setTimeout(() => {
        setDeletingPolicyId(null);
      }, 100);
    }
  };

  const handleSearch = () => {
    setPage(0); // 검색 시 첫 페이지로 리셋
    const currentTab = tabs[activeTabIndex];
    if (currentTab) {
      loadPolicies(currentTab.policyTableName);
    }
  };

  // 수정 모드 토글
  const handleToggleEditMode = () => {
    if (isEditMode) {
      // 취소: 원래 데이터로 복원
      const accessGroupIds = selectedPolicy?.accessGroupId 
        ? (selectedPolicy.accessGroupId.startsWith('[') 
            ? JSON.parse(selectedPolicy.accessGroupId) 
            : [selectedPolicy.accessGroupId])
        : [];
      setEditFormData({
        applyDate: selectedPolicy?.applyDate || '',
        applyContent: selectedPolicy?.applyContent || '',
        accessGroupIds: accessGroupIds
      });
    }
    setIsEditMode(!isEditMode);
  };

  // 정책표 수정 저장
  const handleSaveEdit = async () => {
    if (!selectedPolicy) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/policy-tables/${selectedPolicy.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': loggedInStore?.userRole || '',
          'x-user-id': loggedInStore?.contactId || loggedInStore?.id || ''
        },
        body: JSON.stringify({
          applyDate: editFormData.applyDate,
          applyContent: editFormData.applyContent,
          accessGroupIds: editFormData.accessGroupIds
        })
      });

      if (response.ok) {
        // 선택된 정책 정보 업데이트
        const params = new URLSearchParams();
        if (mode) {
          params.append('mode', mode);
        }
        const detailResponse = await fetch(`${API_BASE_URL}/api/policy-tables/${selectedPolicy.id}?${params}`, {
          headers: {
            'x-user-role': loggedInStore?.userRole || '',
            'x-user-id': loggedInStore?.contactId || loggedInStore?.id || '',
            'x-user-name': encodeURIComponent(loggedInStore?.userName || loggedInStore?.name || '')
          }
        });
        if (detailResponse.ok) {
          const updatedData = await detailResponse.json();
          setSelectedPolicy(updatedData);
          
          // policies 상태에서 해당 정책을 즉시 업데이트
          setPolicies(prevPolicies => {
            const updatedPolicies = prevPolicies.map(policy => 
              policy.id === selectedPolicy.id ? updatedData : policy
            );
            // 생성일시 기준으로 내림차순 정렬 유지
            return updatedPolicies.sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });
          });
          
          // 프론트엔드 캐시 무효화 및 업데이트
          const currentTab = tabs[activeTabIndex];
          if (currentTab) {
            const cacheKey = `${mode || 'default'}_${currentTab.policyTableName}`;
            setPoliciesCache(prev => {
              const newCache = { ...prev };
              // 캐시가 있으면 업데이트, 없으면 삭제
              if (newCache[cacheKey]) {
                const updatedCache = newCache[cacheKey].map(policy => 
                  policy.id === selectedPolicy.id ? updatedData : policy
                );
                newCache[cacheKey] = updatedCache.sort((a, b) => {
                  const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return dateB - dateA;
                });
              } else {
                delete newCache[cacheKey];
              }
              return newCache;
            });
          }
        }
        
        setIsEditMode(false);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('정책표 수정 오류:', error);
      setError('수정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
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
                policies
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((policy) => (
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
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            e.nativeEvent?.stopImmediatePropagation();
                            handleDelete(policy.id, e);
                          }}
                          color="error"
                          disabled={deletingPolicyId === policy.id || loading}
                        >
                          {deletingPolicyId === policy.id ? (
                            <CircularProgress size={16} color="error" />
                          ) : (
                          <DeleteIcon />
                          )}
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={policies.length}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[1, 5, 10, 20, 100]}
            labelRowsPerPage="페이지당 행 수:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 총 ${count}개`}
          />
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">
                    정책 정보
                  </Typography>
                  {canDelete && (
                    <Button
                      size="small"
                      variant={isEditMode ? 'outlined' : 'contained'}
                      startIcon={isEditMode ? <CancelIcon /> : <EditIcon />}
                      onClick={handleToggleEditMode}
                      disabled={loading}
                    >
                      {isEditMode ? '취소' : '수정'}
                    </Button>
                  )}
                </Box>
                
                {isEditMode ? (
                  <>
                    <TextField
                      fullWidth
                      label="정책적용일시"
                      value={editFormData.applyDate}
                      onChange={(e) => setEditFormData({ ...editFormData, applyDate: e.target.value })}
                      sx={{ mb: 2 }}
                      disabled={loading}
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="정책적용내용"
                      value={editFormData.applyContent}
                      onChange={(e) => setEditFormData({ ...editFormData, applyContent: e.target.value })}
                      sx={{ mb: 2 }}
                      disabled={loading}
                    />
                    {mode !== 'generalPolicy' && (
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>정책영업그룹</InputLabel>
                        <Select
                          multiple
                          value={editFormData.accessGroupIds}
                          onChange={(e) => setEditFormData({ ...editFormData, accessGroupIds: e.target.value })}
                          input={<OutlinedInput label="정책영업그룹" />}
                          renderValue={(selected) => {
                            const selectedNames = selected
                              .map(id => userGroups.find(g => g.id === id)?.name)
                              .filter(Boolean);
                            return selectedNames.length > 0 ? selectedNames.join(', ') : '선택 안 함';
                          }}
                          disabled={loading}
                        >
                          {userGroups.map((group) => (
                            <MenuItem key={group.id} value={group.id}>
                              <Checkbox checked={editFormData.accessGroupIds.indexOf(group.id) > -1} />
                              <ListItemText primary={group.name} />
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveEdit}
                      disabled={loading}
                      fullWidth
                    >
                      저장
                    </Button>
                  </>
                ) : (
                  <>
                <Typography variant="subtitle2" gutterBottom>
                  정책적용일시
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {selectedPolicy.applyDate || '-'}
                </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                      {selectedPolicy.applyContent}
                    </Typography>
                    {mode !== 'generalPolicy' && (
                      <>
                <Typography variant="subtitle2" gutterBottom>
                          정책영업그룹
                </Typography>
                        <Typography variant="body1">
                          {selectedPolicy.accessGroupNames && selectedPolicy.accessGroupNames.length > 0
                            ? selectedPolicy.accessGroupNames.join(', ')
                            : '-'}
                </Typography>
                      </>
                    )}
                  </>
                )}
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
                    startIcon={/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? <DownloadIcon /> : <ContentCopyIcon />}
                    onClick={handleCopyImage}
                  >
                    {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? '이미지 다운로드' : '이미지복사하기'}
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

              {/* 확인 이력 (정책모드에서만 표시, 일반정책모드는 기록만 함) */}
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
                              {uniqueViewHistory.map((view, index) => {
                                // 날짜 포맷팅 (한국 시간으로 표시)
                                let formattedDate = '-';
                                const dateStr = view.firstViewDate || view.viewDate;
                                if (dateStr) {
                                  try {
                                    // ISO 형식 (YYYY-MM-DD HH:mm:ss)을 한국 시간으로 파싱
                                    const date = new Date(dateStr.replace(' ', 'T') + '+09:00');
                                    if (!isNaN(date.getTime())) {
                                      formattedDate = date.toLocaleString('ko-KR', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: false
                                      });
                                    } else {
                                      formattedDate = dateStr;
                                    }
                                  } catch (e) {
                                    formattedDate = dateStr;
                                  }
                                }
                                
                                return (
                                  <TableRow key={view.companyId || index}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{formattedDate}</TableCell>
                                    <TableCell>{view.companyName || '-'}</TableCell>
                                  </TableRow>
                                );
                              })}
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

