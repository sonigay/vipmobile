import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Box, Typography, Button, CircularProgress, Chip, IconButton } from '@mui/material';
import Map from './components/Map';
import FilterPanel from './components/FilterPanel';
import AgentFilterPanel from './components/AgentFilterPanel';
import Login from './components/Login';
import InventoryMode from './components/InventoryMode';
import Header from './components/Header';
// 배정 관련 Screen import 제거 (재고 모드로 이동)
import { fetchData, fetchModels, cacheManager } from './api';
import { calculateDistance } from './utils/distanceUtils';
import { 
  fetchCurrentMonthData, 
  fetchPreviousMonthData, 
  fetchActivationDataByDate,
  fetchActivationDateComparison,
  generateStoreActivationComparison, 
  filterActivationByAgent 
} from './utils/activationService';
import './App.css';
import StoreInfoTable from './components/StoreInfoTable';
import UpdatePopup from './components/UpdatePopup';
import UpdateProgressPopup from './components/UpdateProgressPopup';
import { hasNewUpdates, getUnreadUpdates, getAllUpdates, setLastUpdateVersion, setHideUntilDate } from './utils/updateHistory';
import { hasNewDeployment, performAutoLogout, shouldCheckForUpdates, setLastUpdateCheck } from './utils/updateDetection';
// 알림 시스템 관련 import 제거 (재고 모드로 이동)
// 모바일 최적화 관련 import 제거 (재고 모드로 이동)
// 실시간 대시보드 관련 import 제거 (재고 모드로 이동)
import './mobile.css';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper 
} from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { addNotification, addAssignmentCompletedNotification, addSettingsChangedNotification } from './utils/notificationUtils';

// Logger 유틸리티
const logActivity = async (activityData) => {
  try {
    const API_URL = process.env.REACT_APP_API_URL;
    const loggingEnabled = process.env.REACT_APP_LOGGING_ENABLED === 'true';
    
    if (!loggingEnabled) {
      console.log('활동 로깅이 비활성화되어 있습니다.');
      return;
    }
    
    console.log('활동 로깅 데이터:', activityData);
    
    // 서버로 전송
    console.log(`로그 전송 URL: ${API_URL}/api/log-activity`);
    const response = await fetch(`${API_URL}/api/log-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activityData),
    });
    
    const data = await response.json();
    console.log('로그 전송 응답:', data);
    
    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status} ${response.statusText}`);
    }
    
    console.log('활동 로깅 성공!');
  } catch (error) {
    console.error('활동 로깅 실패:', error);
    console.error('활동 데이터:', activityData);
  }
};

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [data, setData] = useState(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedRadius, setSelectedRadius] = useState(2000);
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loggedInStore, setLoggedInStore] = useState(null);
  // 관리자 모드 관련 상태 추가
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [agentTarget, setAgentTarget] = useState('');
  const [agentQualification, setAgentQualification] = useState('');
  const [agentContactId, setAgentContactId] = useState('');
  // 재고모드 관련 상태 추가
  const [isInventoryMode, setIsInventoryMode] = useState(false);
  const [inventoryUserName, setInventoryUserName] = useState(''); // 재고모드 접속자 이름 추가
  // 재고배정 모드 관련 상태 추가
  // 배정 모드 관련 상태 제거 (재고 모드로 이동)
  // 실시간 대시보드 모드 관련 상태 제거 (재고 모드로 이동)
  // 재고요청점 검색 관련 상태 추가
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [forceZoomToStore, setForceZoomToStore] = useState(null); // 강제 확대 상태 추가
  const [requestedStore, setRequestedStore] = useState(null); // 요청점검색으로 선택된 매장
  // 관리자 모드 재고 확인 뷰 상태 추가
  const [currentView, setCurrentView] = useState('all'); // 'all' | 'assigned'
  // 현재 세션의 IP 및 위치 정보
  const [ipInfo, setIpInfo] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  // 캐시 상태
  const [cacheStatus, setCacheStatus] = useState(null);
  // 업데이트 팝업 상태
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [unreadUpdates, setUnreadUpdates] = useState([]);
  // 새로운 업데이트 진행 팝업 상태
  const [showUpdateProgressPopup, setShowUpdateProgressPopup] = useState(false);
  // 개통실적 데이터 상태
  const [activationData, setActivationData] = useState(null);
  // 개통실적 날짜별 데이터 상태
  const [activationDataByDate, setActivationDataByDate] = useState(null);
  // 개통실적 모델 검색 상태
  const [activationModelSearch, setActivationModelSearch] = useState('');
  // 개통실적 날짜 검색 상태
  const [activationDateSearch, setActivationDateSearch] = useState('');
    // 알림 시스템 초기화
  const [notificationInitialized, setNotificationInitialized] = useState(false);
  
  // 토스트 알림 상태
  const [toastNotifications, setToastNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationList, setNotificationList] = useState([]);


  // 재고모드 접속 아이디 목록
  const INVENTORY_MODE_IDS = [
    "JEGO306891",  // 경수
    "JEGO315835",  // 경인
    "JEGO314942",  // 호남
    "JEGO316558",  // 동서울
    "JEGO316254",  // 호남2
    "VIP3473",     // 김수빈
    "VIP4464",     // 홍기현
    "VIP8119",     // 홍남옥
    "VIP8062",     // 이병각
    "VIP6741",     // 이형주
    "VIP6965"      // 정광영
  ];
  
  // 알림 시스템 및 모바일 최적화 초기화 제거 (재고 모드로 이동)

  // 배정 모드 핸들러 제거 (재고 모드로 이동)

  // 실시간 대시보드 모드 핸들러 제거 (재고 모드로 이동)

  // 캐시 상태 업데이트 함수
  const updateCacheStatus = useCallback(() => {
    const status = cacheManager.getStatus();
    setCacheStatus(status);
  }, []);

  // 캐시 정리 함수
  const handleCacheCleanup = useCallback(() => {
    cacheManager.cleanup();
    updateCacheStatus();
  }, [updateCacheStatus]);

  // 전체 캐시 삭제 함수
  const handleCacheClearAll = useCallback(() => {
    cacheManager.clearAll();
    updateCacheStatus();
  }, [updateCacheStatus]);

  // 캐시 클릭 핸들러 (자동 캐시 정리 + 새로고침)
  const handleCacheClick = useCallback(() => {
    console.log('캐시 정리 및 새로고침 시작');
    
    // Service Worker에 캐시 정리 메시지 전송
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_CACHE'
      });
    }
    
    // 클라이언트 캐시도 정리
    cacheManager.clearAll();
    
    // API 캐시도 정리
    if (window.clientCacheUtils) {
      window.clientCacheUtils.cleanup();
    }
    
    // 잠시 후 페이지 새로고침
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }, []);

  // 개통실적 데이터 로드 함수
  const loadActivationData = useCallback(async () => {
    try {
      console.log('개통실적 데이터 로딩 시작...');
      
      // 당월, 전월, 날짜별 데이터 병렬 로드
      const [currentData, previousData, dateData] = await Promise.all([
        fetchCurrentMonthData(),
        fetchPreviousMonthData(),
        fetchActivationDataByDate()
      ]);

      // 매장별 비교 데이터 생성
      const comparisonData = generateStoreActivationComparison(currentData, previousData);
      
      // 담당자 필터링 적용
      let filteredData = comparisonData;
      if (isAgentMode && agentTarget) {
        filteredData = filterActivationByAgent(comparisonData, agentTarget);
      }
      
      setActivationData(filteredData);
      setActivationDataByDate(dateData);
      console.log('개통실적 데이터 로딩 완료');
      console.log('날짜별 데이터:', dateData);
      console.log('날짜별 데이터 키들:', Object.keys(dateData || {}));
    } catch (error) {
      console.error('개통실적 데이터 로딩 실패:', error);
      setActivationData(null);
      setActivationDataByDate(null);
    }
  }, [isAgentMode, agentTarget]);

  // 특정 날짜의 개통실적 데이터 로드 함수
  const loadActivationDataForDate = useCallback(async (date) => {
    try {
      console.log(`특정 날짜 개통실적 데이터 로딩 시작: ${date}`);
      
      const dateComparisonData = await fetchActivationDateComparison(date);
      
      // 담당자 필터링 적용
      let filteredData = dateComparisonData;
      if (isAgentMode && agentTarget) {
        filteredData = {};
        Object.entries(dateComparisonData).forEach(([storeName, storeData]) => {
          const hasMatchingAgent = storeData.agents.some(agent => {
            if (!agent || !agentTarget) return false;
            const agentPrefix = agent.toString().substring(0, 3);
            const targetPrefix = agentTarget.toString().substring(0, 3);
            return agentPrefix === targetPrefix;
          });
          
          if (hasMatchingAgent) {
            filteredData[storeName] = storeData;
          }
        });
      }
      
      // lastActivationDate 필드 추가 (Map 컴포넌트 호환성을 위해)
      Object.keys(filteredData).forEach(storeName => {
        filteredData[storeName].lastActivationDate = new Date(date);
      });
      
      setActivationData(filteredData);
      console.log(`특정 날짜 개통실적 데이터 로딩 완료: ${date}`);
      console.log('날짜 비교 데이터:', filteredData);
      
      // 전월 데이터 디버깅
      const storesWithPreviousData = Object.values(filteredData).filter(store => store.previousMonth > 0);
      console.log(`프론트엔드 - 전월 데이터가 있는 매장 수: ${storesWithPreviousData.length}`);
      if (storesWithPreviousData.length > 0) {
        console.log('프론트엔드 - 전월 데이터가 있는 매장들:', storesWithPreviousData.map(store => ({
          storeName: store.storeName,
          previousMonth: store.previousMonth,
          currentMonth: store.currentMonth
        })));
      } else {
        console.log('프론트엔드 - 전월 데이터가 있는 매장이 없습니다.');
      }
    } catch (error) {
      console.error(`특정 날짜 개통실적 데이터 로딩 실패: ${date}`, error);
      setActivationData(null);
    }
  }, [isAgentMode, agentTarget]);

  // 개통실적 모델별 통계 계산
  const getActivationModelStats = useCallback(() => {
    if (!activationData) return [];
    
    const modelStats = {};
    
    // 담당자별 필터링된 데이터 사용
    const filteredData = isAgentMode && agentTarget 
      ? Object.entries(activationData).filter(([storeName, storeData]) => {
          return storeData.agents && storeData.agents.includes(agentTarget);
        }).reduce((acc, [storeName, storeData]) => {
          acc[storeName] = storeData;
          return acc;
        }, {})
      : activationData;
    
    Object.values(filteredData).forEach(storeData => {
      const { currentMonth, models } = storeData;
      
      Object.entries(models).forEach(([modelKey, count]) => {
        const modelName = modelKey.split(' (')[0]; // "iPhone 15 (블랙)" -> "iPhone 15"
        
        if (!modelStats[modelName]) {
          modelStats[modelName] = {
            modelName,
            currentMonth: 0,
            previousMonth: 0,
            storeCount: new Set()
          };
        }
        
        modelStats[modelName].currentMonth += count;
        modelStats[modelName].storeCount.add(storeData.storeName);
      });
    });
    
    // 전월 데이터도 계산 (전체 개통량 기준으로 비율 계산)
    Object.values(filteredData).forEach(storeData => {
      const { currentMonth, previousMonth, models } = storeData;
      
      Object.entries(models).forEach(([modelKey, count]) => {
        const modelName = modelKey.split(' (')[0];
        
        if (modelStats[modelName] && currentMonth > 0 && previousMonth > 0) {
          // 해당 모델의 당월 비율을 계산하여 전월 데이터 추정
          const modelRatio = count / currentMonth;
          const estimatedPrevious = Math.round(modelRatio * previousMonth);
          modelStats[modelName].previousMonth += estimatedPrevious;
        }
      });
    });
    
    // 배열로 변환하고 판매량 내림차순 정렬
    return Object.values(modelStats)
      .map(stat => ({
        ...stat,
        storeCount: stat.storeCount.size,
        changeRate: stat.previousMonth > 0 
          ? ((stat.currentMonth - stat.previousMonth) / stat.previousMonth * 100).toFixed(1)
          : stat.currentMonth > 0 ? '100.0' : '0.0'
      }))
      .sort((a, b) => b.currentMonth - a.currentMonth);
  }, [activationData, isAgentMode, agentTarget]);

  // 개통실적 특정 모델의 매장별 통계
  const getActivationStoreStats = useCallback((modelName) => {
    if (!activationData || !modelName) return [];
    
    const storeStats = [];
    
    // 담당자별 필터링된 데이터 사용
    const filteredData = isAgentMode && agentTarget 
      ? Object.entries(activationData).filter(([storeName, storeData]) => {
          return storeData.agents && storeData.agents.includes(agentTarget);
        }).reduce((acc, [storeName, storeData]) => {
          acc[storeName] = storeData;
          return acc;
        }, {})
      : activationData;
    
    Object.values(filteredData).forEach(storeData => {
      const { storeName, currentMonth, previousMonth, models } = storeData;
      
      let modelCurrent = 0;
      let modelPrevious = 0;
      const colorDetails = {};
      
      Object.entries(models).forEach(([modelKey, count]) => {
        if (modelKey.startsWith(modelName + ' (')) {
          modelCurrent += count;
          const color = modelKey.match(/\(([^)]+)\)/)?.[1] || '미지정';
          colorDetails[color] = (colorDetails[color] || 0) + count;
        }
      });
      
      // 전월 데이터도 계산 (전체 개통량 기준으로 비율 계산)
      if (currentMonth > 0 && previousMonth > 0) {
        const modelRatio = modelCurrent / currentMonth;
        modelPrevious = Math.round(modelRatio * previousMonth);
      }
      
      if (modelCurrent > 0) {
        storeStats.push({
          storeName,
          currentMonth: modelCurrent,
          previousMonth: modelPrevious,
          changeRate: modelPrevious > 0 
            ? ((modelCurrent - modelPrevious) / modelPrevious * 100).toFixed(1)
            : '100.0',
          colorDetails
        });
      }
    });
    
    // 판매량 내림차순 정렬
    return storeStats.sort((a, b) => b.currentMonth - a.currentMonth);
  }, [activationData, isAgentMode, agentTarget]);

  // 개통실적 전체 통계 계산 (전체 날짜 선택 시)
  const getActivationDateStats = useCallback(() => {
    if (!activationData) return [];
    
    // 전체 데이터를 하나의 통계로 집계
    const totalStats = {
      date: '전체',
      currentMonth: 0,
      previousMonth: 0,
      storeCount: new Set(),
      models: {}
    };
    
    // 담당자별 필터링된 데이터 사용
    const filteredData = isAgentMode && agentTarget 
      ? Object.entries(activationData).filter(([storeName, storeData]) => {
          return storeData.agents && storeData.agents.includes(agentTarget);
        }).reduce((acc, [storeName, storeData]) => {
          acc[storeName] = storeData;
          return acc;
        }, {})
      : activationData;
    
    Object.values(filteredData).forEach(storeData => {
      const { currentMonth, previousMonth, models } = storeData;
      
      totalStats.currentMonth += currentMonth;
      totalStats.previousMonth += previousMonth;
      totalStats.storeCount.add(storeData.storeName);
      
      // 모델별 집계
      Object.entries(models).forEach(([modelKey, count]) => {
        const modelName = modelKey.split(' (')[0];
        if (!totalStats.models[modelName]) {
          totalStats.models[modelName] = 0;
        }
        totalStats.models[modelName] += count;
      });
    });
    
    // 배열로 변환
    return [{
      ...totalStats,
      storeCount: totalStats.storeCount.size,
      changeRate: totalStats.previousMonth > 0 
        ? ((totalStats.currentMonth - totalStats.previousMonth) / totalStats.previousMonth * 100).toFixed(1)
        : totalStats.currentMonth > 0 ? '100.0' : '0.0'
    }];
  }, [activationData, isAgentMode, agentTarget]);

  // 개통실적 날짜 옵션 생성 (지난 날짜들 포함)
  const getActivationDateOptions = useCallback(() => {
    if (!activationDataByDate) return [];
    
    console.log('=== 날짜 옵션 생성 디버깅 ===');
    console.log('activationDataByDate:', activationDataByDate);
    console.log('사용 가능한 날짜들:', Object.keys(activationDataByDate));
    
    const dateOptions = [];
    const today = new Date();
    
    // 오늘부터 과거 30일까지의 날짜 옵션 생성
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toISOString().split('T')[0]; // ISO 형식 (YYYY-MM-DD)
      
      // 해당 날짜에 데이터가 있는지 확인
      const hasData = activationDataByDate[dateKey] && Object.keys(activationDataByDate[dateKey]).length > 0;
      
      console.log(`날짜 ${dateKey}: 데이터 있음 = ${hasData}`);
      
      // 데이터가 있거나 오늘 날짜인 경우 추가
      if (hasData || i === 0) {
        // 표시용 일자만 생성 (예: "25일")
        const displayDate = new Date(dateKey);
        const day = displayDate.getDate();
        const displayLabel = `${day}일`;
        
        dateOptions.push({
          value: dateKey,
          label: displayLabel,
          isToday: i === 0,
          hasData: hasData
        });
      }
    }
    
    console.log('최종 날짜 옵션:', dateOptions);
    return dateOptions;
  }, [activationDataByDate]);

  // 담당자별 총 개통실적 계산 (카테고리별)
  const getAgentTotalActivation = useCallback(() => {
    if (!activationData || !isAgentMode || !agentTarget) return null;
    
    const totalStats = {
      phones: 0,
      wearables: 0,
      tablets: 0
    };
    
    // 담당자별 필터링된 데이터 사용
    const filteredData = Object.entries(activationData).filter(([storeName, storeData]) => {
      return storeData.agents && storeData.agents.includes(agentTarget);
    });
    
    filteredData.forEach(([storeName, storeData]) => {
      const { models } = storeData;
      
      Object.entries(models).forEach(([modelKey, count]) => {
        const modelName = modelKey.split(' (')[0];
        
        // 모델명으로 카테고리 판단 (간단한 키워드 매칭)
        if (modelName.toLowerCase().includes('iphone') || 
            modelName.toLowerCase().includes('galaxy') ||
            modelName.toLowerCase().includes('갤럭시') ||
            modelName.toLowerCase().includes('아이폰')) {
          totalStats.phones += count;
        } else if (modelName.toLowerCase().includes('watch') || 
                   modelName.toLowerCase().includes('갤럭시워치') ||
                   modelName.toLowerCase().includes('애플워치') ||
                   modelName.toLowerCase().includes('버즈') ||
                   modelName.toLowerCase().includes('buds')) {
          totalStats.wearables += count;
        } else if (modelName.toLowerCase().includes('ipad') || 
                   modelName.toLowerCase().includes('갤럭시탭') ||
                   modelName.toLowerCase().includes('태블릿')) {
          totalStats.tablets += count;
        } else {
          // 기본적으로 휴대폰으로 분류
          totalStats.phones += count;
        }
      });
    });
    
    return totalStats;
  }, [activationData, isAgentMode, agentTarget]);

  // 담당자별 총 재고 계산 (카테고리별)
  const getAgentTotalInventory = useCallback(() => {
    if (!data || !isAgentMode || !agentTarget) return null;
    
    const totalStats = {
      phones: 0,
      wearables: 0,
      tablets: 0
    };
    
    // 담당자별 필터링된 매장들
    const agentStores = filterStoresByAgent(data.stores, agentTarget);
    
    agentStores.forEach(store => {
      if (!store.inventory) return;
      
      // 새로운 데이터 구조: { phones: {}, sims: {}, wearables: {}, smartDevices: {} }
      Object.entries(store.inventory).forEach(([category, categoryData]) => {
        if (typeof categoryData === 'object' && categoryData !== null) {
          Object.entries(categoryData).forEach(([modelName, modelData]) => {
            if (typeof modelData === 'object' && modelData !== null) {
              Object.values(modelData).forEach(status => {
                if (typeof status === 'object' && status !== null) {
                  Object.values(status).forEach(item => {
                    let quantity = 0;
                    if (typeof item === 'object' && item && item.quantity) {
                      quantity = item.quantity || 0;
                    } else if (typeof item === 'number') {
                      quantity = item || 0;
                    }
                    
                    // 카테고리별 분류
                    if (category === 'phones') {
                      totalStats.phones += quantity;
                    } else if (category === 'wearables') {
                      totalStats.wearables += quantity;
                    } else if (category === 'smartDevices') {
                      // 태블릿은 smartDevices에 포함될 가능성이 높음
                      if (modelName.toLowerCase().includes('ipad') || 
                          modelName.toLowerCase().includes('갤럭시탭') ||
                          modelName.toLowerCase().includes('태블릿')) {
                        totalStats.tablets += quantity;
                      } else {
                        totalStats.wearables += quantity;
                      }
                    } else {
                      // 기타 카테고리는 휴대폰으로 분류
                      totalStats.phones += quantity;
                    }
                  });
                }
              });
            }
          });
        }
      });
    });
    
    return totalStats;
  }, [data, isAgentMode, agentTarget]);

  // 선택한 모델의 총 개통수 계산
  const getSelectedModelTotalActivation = useCallback(() => {
    if (!activationData || !activationModelSearch || !isAgentMode || !agentTarget) return 0;
    
    let totalCount = 0;
    
    // 담당자별 필터링된 데이터 사용
    const filteredData = Object.entries(activationData).filter(([storeName, storeData]) => {
      return storeData.agents && storeData.agents.includes(agentTarget);
    });
    
    filteredData.forEach(([storeName, storeData]) => {
      const { models } = storeData;
      
      Object.entries(models).forEach(([modelKey, count]) => {
        if (modelKey.startsWith(activationModelSearch + ' (')) {
          totalCount += count;
        }
      });
    });
    
    return totalCount;
  }, [activationData, activationModelSearch, isAgentMode, agentTarget]);

  // 선택한 날짜의 총 개통수 계산
  const getSelectedDateTotalActivation = useCallback(() => {
    if (!activationDataByDate || !activationDateSearch || !isAgentMode || !agentTarget) return 0;
    
    let totalCount = 0;
    
    // 해당 날짜의 데이터 확인
    const dateData = activationDataByDate[activationDateSearch];
    if (!dateData) return 0;
    
    // 담당자별 필터링
    Object.values(dateData).forEach(storeData => {
      const hasMatchingAgent = storeData.agents.some(agent => {
        if (!agent || !agentTarget) return false;
        const agentPrefix = agent.toString().substring(0, 3);
        const targetPrefix = agentTarget.toString().substring(0, 3);
        return agentPrefix === targetPrefix;
      });
      
      if (hasMatchingAgent) {
        totalCount += storeData.totalCount;
      }
    });
    
    return totalCount;
  }, [activationDataByDate, activationDateSearch, isAgentMode, agentTarget]);

  // 개통실적 특정 날짜의 매장별 통계
  const getActivationDateStoreStats = useCallback((dateKey) => {
    if (!activationData || !dateKey) return [];
    
    const storeStats = [];
    
    // activationData에서 해당 날짜의 데이터 사용 (전월 비교 데이터 포함)
    Object.entries(activationData).forEach(([storeName, storeData]) => {
      // 담당자 필터링
      if (isAgentMode && agentTarget) {
        const hasMatchingAgent = storeData.agents.some(agent => {
          if (!agent || !agentTarget) return false;
          const agentPrefix = agent.toString().substring(0, 3);
          const targetPrefix = agentTarget.toString().substring(0, 3);
          return agentPrefix === targetPrefix;
        });
        
        if (!hasMatchingAgent) return;
      }
      
      storeStats.push({
        storeName: storeData.storeName,
        currentMonth: storeData.currentMonth,
        previousMonth: storeData.previousMonth,
        changeRate: storeData.previousMonth > 0 
          ? ((storeData.currentMonth - storeData.previousMonth) / storeData.previousMonth * 100).toFixed(1)
          : storeData.currentMonth > 0 ? '100.0' : '0.0',
        models: storeData.models
      });
    });
    
    // 판매량 내림차순 정렬
    return storeStats.sort((a, b) => b.currentMonth - a.currentMonth);
  }, [activationData, isAgentMode, agentTarget]);

  // 로그인 상태 복원 및 새로운 배포 감지
  useEffect(() => {
    const checkForNewDeployment = async () => {
      // 새로운 배포가 있는지 확인
      if (shouldCheckForUpdates()) {
        const hasNew = await hasNewDeployment();
        if (hasNew) {
          console.log('새로운 배포 감지 - 자동 로그아웃 실행');
          await performAutoLogout();
          // 업데이트 진행 팝업 표시
          setShowUpdateProgressPopup(true);
          return;
        }
        setLastUpdateCheck();
      }
    };

    // 새로운 배포 체크
    checkForNewDeployment();

    // 로그인 상태 복원
    const savedLoginState = localStorage.getItem('loginState');
    if (savedLoginState) {
      try {
        const parsedState = JSON.parse(savedLoginState);
        setIsLoggedIn(true);
        setLoggedInStore(parsedState.store);
        
        // 관리자 모드 상태 복원
        if (parsedState.isAgent) {
          setIsAgentMode(true);
          setAgentTarget(parsedState.agentTarget || '');
          setAgentQualification(parsedState.agentQualification || '');
          setAgentContactId(parsedState.agentContactId || '');
          setCurrentView(parsedState.currentView || 'all');
          
          // 관리자 모드 위치 설정 (안산지역 중심)
          setUserLocation({
            lat: 37.3215,  // 안산지역 중심
            lng: 126.8309,
          });
          setSelectedRadius(80000);
        } else if (parsedState.isInventory) {
          // 재고모드 상태 복원
          setIsInventoryMode(true);
          setInventoryUserName(parsedState.inventoryUserName || '재고관리자');
          
          // 재고모드 위치 설정 (전체 지역 보기)
          setUserLocation({
            lat: 37.5665,
            lng: 126.9780,
          });
          setSelectedRadius(50000);
        } else if (parsedState.store) {
          // 일반 매장 모드 위치 설정
          const store = parsedState.store;
          if (store.latitude && store.longitude) {
            setUserLocation({
              lat: parseFloat(store.latitude),
              lng: parseFloat(store.longitude)
            });
          }
        }
      } catch (error) {
        console.error('저장된 로그인 상태를 복원하는 중 오류 발생:', error);
        localStorage.removeItem('loginState');
      }
    }
  }, []);

  // Service Worker 메시지 리스너
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'AUTO_LOGOUT_REQUIRED') {
          console.log('Service Worker에서 자동 로그아웃 요청 받음');
          performAutoLogout();
          setShowUpdateProgressPopup(true);
        }
      });
    }
  }, []);

  // 업데이트 확인 및 팝업 표시 (앱 시작 시 한 번만 실행)
  useEffect(() => {
    // 로그인 상태와 관계없이 앱 시작 시 업데이트 체크
    const checkForUpdates = async () => {
      try {
        const hasNew = await hasNewUpdates();
        if (hasNew) {
          const updates = await getUnreadUpdates();
          setUnreadUpdates(updates);
          setShowUpdatePopup(true);
          console.log('새로운 업데이트 발견, 팝업 표시:', updates.length, '개');
        }
      } catch (error) {
        console.error('업데이트 확인 중 오류:', error);
      }
    };
    
    // 앱 시작 시 업데이트 체크 (지연 실행으로 안정성 향상)
    setTimeout(() => {
      checkForUpdates();
    }, 1000);
  }, []); // 의존성 배열을 비워서 앱 시작 시 한 번만 실행

  // 담당자별 재고 필터링 함수 (useEffect보다 먼저 정의)
  const filterStoresByAgent = useCallback((stores, agentTarget) => {
    if (!stores || !Array.isArray(stores) || !agentTarget) {
      return stores || [];
    }

    console.log(`담당자별 재고 필터링 시작: ${agentTarget}`);
    
    return stores.filter(store => {
      if (!store.manager) return false;
      
      // 담당자명 앞 3글자 비교 (기존 로직과 동일)
      const managerPrefix = store.manager.toString().substring(0, 3);
      const agentPrefix = agentTarget.toString().substring(0, 3);
      
      const isMatch = managerPrefix === agentPrefix;
      
      if (isMatch) {
        console.log(`담당자 매칭: ${store.manager} (${store.name})`);
      }
      
      return isMatch;
    });
  }, []);

  // 재고 필터링 함수 (상태 변수들 뒤에 정의)
  const filterStores = useCallback((stores, selectedModel, selectedColor, userLocation, searchRadius) => {
    console.log('재고 필터링 시작:', { selectedModel, selectedColor });
    
    if (!stores || !Array.isArray(stores)) {
      console.log('매장 데이터가 없거나 유효하지 않음');
      return [];
    }

    return stores.filter(store => {
      // 1. 재고 확인
      let hasInventory = false;
      let totalQuantity = 0;
      
      if (store.inventory) {
        // 새로운 데이터 구조: { phones: {}, sims: {}, wearables: {}, smartDevices: {} }
        if (selectedModel) {
          // 특정 모델의 재고 확인
          Object.values(store.inventory).forEach(category => {
            if (category[selectedModel]) {
              if (selectedColor) {
                // 특정 모델과 색상의 재고 확인
                Object.values(category[selectedModel]).forEach(status => {
                  if (status[selectedColor]) {
                    totalQuantity += status[selectedColor] || 0;
                  }
                });
              } else {
                // 특정 모델의 전체 재고 확인
                Object.values(category[selectedModel]).forEach(status => {
                  Object.values(status).forEach(qty => {
                    totalQuantity += qty || 0;
                  });
                });
              }
            }
          });
          hasInventory = totalQuantity > 0;
          console.log(`매장 [${store.name}] - ${selectedModel}${selectedColor ? ` ${selectedColor}` : ''} 재고: ${totalQuantity}`);
        } else {
          // 모델이 선택되지 않은 경우: 모든 재고 합계 확인
          Object.values(store.inventory).forEach(category => {
            if (typeof category === 'object' && category !== null) {
              Object.values(category).forEach(model => {
                if (typeof model === 'object' && model !== null) {
                  Object.values(model).forEach(status => {
                    if (typeof status === 'object' && status !== null) {
                      Object.values(status).forEach(qty => {
                        totalQuantity += qty || 0;
                      });
                    }
                  });
                }
              });
            }
          });
          hasInventory = totalQuantity > 0;
          console.log(`매장 [${store.name}] - 전체 재고: ${totalQuantity}`);
        }
      }
      
      store.totalQuantity = totalQuantity;
      store.hasInventory = hasInventory;

      // 2. 위치 기반 필터링
      if (userLocation && searchRadius) {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          parseFloat(store.latitude),
          parseFloat(store.longitude)
        );
        store.distance = distance;
        return distance <= searchRadius && hasInventory;
      }
      
      return hasInventory;
    });
  }, []);

  // 디바이스 및 IP 정보 수집
  useEffect(() => {
    // 디바이스 정보 가져오기
    const userAgent = navigator.userAgent;
    setDeviceInfo(userAgent);
    
    // localStorage에서 IP 정보 가져오기
    const savedIpInfo = localStorage.getItem('userIpInfo');
    if (savedIpInfo) {
      setIpInfo(JSON.parse(savedIpInfo));
    }
  }, []);

  // 데이터 로딩 함수
  const loadData = useCallback(async () => {
    if (!isLoggedIn) return;
    
    setIsLoading(true);
    try {
      console.log('데이터 로딩 시작');
      
      // 전체재고확인에서는 3일 이내 출고재고 제외, 담당재고확인에서는 모든 재고 포함
      const includeShipped = isAgentMode && currentView === 'assigned' ? true : false;
      
      console.log('재고 데이터 요청 설정:', {
        isAgentMode,
        currentView,
        includeShipped,
        설명: includeShipped ? '담당재고확인 - 3일 이내 출고재고 포함' : '전체재고확인 - 3일 이내 출고재고 제외'
      });
      
      // 캐시 무효화를 위한 타임스탬프 추가
      const timestamp = Date.now();
      const [storesResponse, modelsResponse] = await Promise.all([
        fetchData(includeShipped, timestamp),
        fetchModels()
      ]);

      console.log('매장 응답 전체:', storesResponse);
      console.log('모델 응답 전체:', modelsResponse);

      if (storesResponse.success && modelsResponse.success) {
        // 데이터 구조 자세히 로깅
        console.log('모델 데이터 원본:', modelsResponse.data);
        const models = Object.keys(modelsResponse.data || {}).sort();
        console.log('추출된 모델 목록:', models);
        console.log('모델별 색상 데이터:', modelsResponse.data);

        // 데이터 설정 전 최종 확인
        const finalData = {
          stores: storesResponse.data,
          models: models,
          colorsByModel: modelsResponse.data,
        };
        console.log('최종 설정될 데이터:', finalData);

        // 데이터 설정과 동시에 필터링된 매장 목록 초기화
        setData(finalData);
        setFilteredStores([]);
        
        // 강제로 필터링 useEffect 트리거
        setTimeout(() => {
          console.log('필터링 강제 실행');
        }, 0);
      } else {
        console.error('데이터 로딩 실패 상세:', { 
          storesSuccess: storesResponse.success,
          modelsSuccess: modelsResponse.success,
          storesError: storesResponse.error,
          modelsError: modelsResponse.error
        });
      }
    } catch (error) {
      console.error('데이터 로딩 중 상세 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn, isAgentMode, currentView]);

  // 초기 데이터 로딩
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 캐시 상태 주기적 업데이트
  useEffect(() => {
    updateCacheStatus();
    const interval = setInterval(updateCacheStatus, 30000); // 30초마다 업데이트
    return () => clearInterval(interval);
  }, [updateCacheStatus]);

  // 로그인한 매장 정보 업데이트 (재고 정보 포함)
  useEffect(() => {
    if (isLoggedIn && data?.stores && loggedInStore) {
      console.log('로그인 매장 재고 정보 업데이트 시작');
      
      // 로그인한 매장의 최신 정보 찾기
      const updatedStore = data.stores.find(store => store.id === loggedInStore.id);
      
      if (updatedStore) {
        console.log('로그인 매장 최신 정보 발견:', {
          매장명: updatedStore.name,
          재고: updatedStore.inventory
        });
        
        // 로그인 매장 정보 업데이트
        setLoggedInStore(updatedStore);
      }
    }
  }, [isLoggedIn, data, loggedInStore?.id]);

  // 위치 정보 가져오기
  useEffect(() => {
    if (!userLocation && isLoggedIn && data?.stores?.length > 0) {
      // 로그인한 매장 찾기
      const loggedInStore = data.stores[0]; // 첫 번째 매장을 예시로 사용
      if (loggedInStore.latitude && loggedInStore.longitude) {
        setUserLocation({
          lat: parseFloat(loggedInStore.latitude),
          lng: parseFloat(loggedInStore.longitude)
        });
      } else {
        // 매장 위치 정보가 없는 경우 서울시청 좌표 사용
        setUserLocation({
          lat: 37.5665,
          lng: 126.9780,
        });
      }
    }
  }, [isLoggedIn, data, userLocation]);

  // 매장 필터링
  useEffect(() => {
    if (!data?.stores) {
      console.log('매장 데이터가 없음');
      return;
    }

    console.log('필터링 시작:', {
      총매장수: data.stores.length,
      관리자모드: isAgentMode,
      현재뷰: currentView
    });

    try {
      // 1. 기본 매장 목록 복사
      let filtered = data.stores.map(store => ({
        ...store,
        distance: null
      }));

      // 2. 관리자 모드에서 담당자별 필터링 적용
      if (isAgentMode && currentView === 'assigned' && agentTarget) {
        filtered = filterStoresByAgent(filtered, agentTarget);
        console.log(`담당자별 필터링 결과: ${filtered.length}개 매장`);
      }

      // 3. 거리 계산
      if (userLocation) {
        filtered = filtered.map(store => {
          if (!store.latitude || !store.longitude) {
            return { ...store, distance: Infinity };
          }

          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            parseFloat(store.latitude),
            parseFloat(store.longitude)
          );

          return { ...store, distance };
        });
        
        // 관리자 모드가 아닌 경우에만 반경 필터링 적용
        if (!isAgentMode && selectedRadius) {
          filtered = filtered.filter(store => store.distance <= selectedRadius / 1000);
        }
      }

      // 4. 결과 로깅
      console.log('필터링 결과:', {
        총매장수: data.stores.length,
        필터링된매장수: filtered.length,
        검색반경: selectedRadius ? `${selectedRadius/1000}km` : '없음',
        관리자모드: isAgentMode,
        현재뷰: currentView
      });

      setFilteredStores(filtered);
    } catch (error) {
      console.error('필터링 중 오류 발생:', error);
      setFilteredStores([]);
    }
  }, [data, selectedRadius, userLocation, isAgentMode, currentView, agentTarget]);

  const handleLogin = (store) => {
    setIsLoggedIn(true);
    setLoggedInStore(store);
    
    // 재고모드인지 확인 (백엔드 응답의 isInventory 플래그 우선 확인)
    if (store.isInventory || INVENTORY_MODE_IDS.includes(store.id)) {
      console.log('로그인: 재고모드');
      setIsInventoryMode(true);
      setIsAgentMode(false);
      
      // 재고모드 접속자 이름 설정
      const inventoryUserNames = {
        'JEGO306891': '경수',
        'JEGO315835': '경인',
        'JEGO314942': '호남',
        'JEGO316558': '동서울',
        'JEGO316254': '호남2',
        'VIP3473': '김수빈',
        'VIP4464': '홍기현',
        'VIP8119': '홍남옥',
        'VIP8062': '이병각',
        'VIP6741': '이형주',
        'VIP6965': '정광영'
      };
      
      const userName = inventoryUserNames[store.id] || '재고관리자';
      setInventoryUserName(userName);
      console.log(`재고모드 접속자: ${userName}`);
      
      // 재고모드에서는 서울시청을 중심으로 전체 지역 보기
      setUserLocation({
        lat: 37.5665,
        lng: 126.9780,
      });
      setSelectedRadius(50000);
      
      // 로그인 상태 저장
      localStorage.setItem('loginState', JSON.stringify({
        isInventory: true,
        isAgent: false,
        store: store,
        inventoryUserName: userName
      }));
    }
    // 관리자 모드인지 확인
    else if (store.isAgent) {
      console.log('로그인: 관리자 모드');
      setIsAgentMode(true);
      setIsInventoryMode(false);
      setAgentTarget(store.target);
      setAgentQualification(store.qualification);
      setAgentContactId(store.contactId);
      
      // 관리자 모드에서는 안산지역을 중심으로 인천-평택 지역 보기
      setUserLocation({
        lat: 37.3215,  // 안산지역 중심
        lng: 126.8309,
      });
      // 검색 반경을 더 넓게 설정 (인천-평택 지역까지 보이도록)
      setSelectedRadius(80000);
      
      // 로그인 상태 저장
      localStorage.setItem('loginState', JSON.stringify({
        isAgent: true,
        isInventory: false,
        store: store,
        agentTarget: store.target,
        agentQualification: store.qualification,
        agentContactId: store.contactId,
        currentView: 'all'
      }));

      // 관리자 모드일 때 개통실적 데이터 로드
      loadActivationData();
    } else {
      console.log('로그인: 일반 매장 모드');
      setIsAgentMode(false);
      setIsInventoryMode(false);
      // 일반 매장인 경우 기존 로직 유지
      if (store.latitude && store.longitude) {
        setUserLocation({
          lat: parseFloat(store.latitude),
          lng: parseFloat(store.longitude)
        });
      }
      
      // 로그인 상태 저장
      localStorage.setItem('loginState', JSON.stringify({
        isAgent: false,
        isInventory: false,
        store: store
      }));
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInStore(null);
    setData(null);
    setSelectedModel('');
    setSelectedColor('');
    setSelectedRadius(2000);
    setFilteredStores([]);
    setSelectedStore(null);
    // 관리자 모드 상태 초기화
    setIsAgentMode(false);
    setAgentTarget('');
    setAgentQualification('');
    setAgentContactId('');
    // 재고모드 상태 초기화
    setIsInventoryMode(false);
    setInventoryUserName(''); // 재고모드 접속자 이름 초기화
    // 재고 확인 뷰 상태 초기화
    setCurrentView('all');
    
    // 로그인 상태 삭제
    localStorage.removeItem('loginState');
  };

  const handleModelSelect = useCallback((model) => {
    console.log('선택된 모델 변경:', model);
    setSelectedModel(model);
    setSelectedColor('');  // 색상 선택 초기화
    setFilteredStores([]); // 검색 결과 초기화
    
    // 모델 검색 로그 전송
    if (loggedInStore) {
      console.log('모델 선택 로그 전송 시작:', model);
      logActivity({
        userId: loggedInStore.id,
        userType: isAgentMode ? 'agent' : 'store',
        targetName: isAgentMode ? agentTarget : loggedInStore.name,
        ipAddress: ipInfo?.ip || 'unknown',
        location: ipInfo?.location || 'unknown',
        deviceInfo: deviceInfo || 'unknown',
        activity: 'search',
        model: model
      });
    }
    
    // 데이터 로드는 로그 전송 후 실행
    loadData();
  }, [loadData, loggedInStore, isAgentMode, agentTarget, ipInfo, deviceInfo]);

  const handleColorSelect = useCallback((color) => {
    console.log('선택된 색상 변경:', color);
    setSelectedColor(color);
    setFilteredStores([]); // 검색 결과 초기화
    
    // 색상 검색 로그 전송
    if (loggedInStore && selectedModel) {
      console.log('색상 선택 로그 전송 시작:', color, '모델:', selectedModel);
      logActivity({
        userId: loggedInStore.id,
        userType: isAgentMode ? 'agent' : 'store',
        targetName: isAgentMode ? agentTarget : loggedInStore.name,
        ipAddress: ipInfo?.ip || 'unknown',
        location: ipInfo?.location || 'unknown',
        deviceInfo: deviceInfo || 'unknown',
        activity: 'search',
        model: selectedModel,
        colorName: color
      });
    }
    
    // 데이터 로드는 로그 전송 후 실행
    loadData();
  }, [loadData, loggedInStore, selectedModel, isAgentMode, agentTarget, ipInfo, deviceInfo]);

  const handleRadiusSelect = useCallback((radius) => {
    console.log('선택된 반경 변경:', radius);
    setSelectedRadius(radius);
  }, []);

  const handleStoreSelect = useCallback((store) => {
    console.log('선택된 매장:', store);
    setSelectedStore(store);
  }, []);

  // 재고요청점 검색 함수
  const handleStoreSearch = useCallback((query) => {
    setSearchQuery(query);
    
    if (!query.trim() || !data?.stores) {
      setSearchResults([]);
      return;
    }
    
    // 매장명 또는 담당자명으로 검색 (대소문자 구분 없이)
    const filtered = data.stores.filter(store => {
      const storeName = store.name?.toLowerCase() || '';
      const managerName = store.manager?.toLowerCase() || '';
      const searchTerm = query.toLowerCase();
      
      return storeName.includes(searchTerm) || managerName.includes(searchTerm);
    });
    
    console.log(`검색어: "${query}" - 검색 결과: ${filtered.length}개`);
    console.log('검색된 매장들:', filtered.map(s => ({ name: s.name, manager: s.manager })));
    
    setSearchResults(filtered);
  }, [data?.stores]);

  // 검색된 매장으로 지도 이동
  const handleSearchResultSelect = useCallback((store) => {
    console.log('검색 결과 선택:', store);
    setSelectedStore(store);
    setRequestedStore(store); // 요청점검색으로 선택된 매장 저장
    setSearchQuery('');
    setSearchResults([]);
    
    // 선택된 매장으로 지도 이동 (강제 확대)
    if (store.latitude && store.longitude) {
      const lat = parseFloat(store.latitude);
      const lng = parseFloat(store.longitude);
      
      console.log('지도 이동 좌표:', lat, lng);
      
      // 먼저 userLocation 변경
      setUserLocation({ lat, lng });
      
      // 강제 확대 실행 (약간의 지연 후)
      setTimeout(() => {
        console.log('강제 확대 상태 설정');
        setForceZoomToStore({ lat, lng });
      }, 100);
    }
  }, []);

  // 전화 연결 버튼 클릭 핸들러
  const handleCallButtonClick = useCallback(() => {
    if (loggedInStore && isAgentMode) {
      // 관리자가 전화 연결 버튼을 클릭한 경우 로그 전송
      logActivity({
        userId: loggedInStore.id,
        userType: 'agent',
        targetName: agentTarget,
        ipAddress: ipInfo?.ip || 'unknown',
        location: ipInfo?.location || 'unknown',
        deviceInfo: deviceInfo || 'unknown',
        activity: 'call_button',
        callButton: true
      });
    }
  }, [loggedInStore, isAgentMode, agentTarget, ipInfo, deviceInfo]);

  // 카카오톡 보내기 버튼 클릭 핸들러
  const handleKakaoTalkButtonClick = useCallback(() => {
    if (loggedInStore && isAgentMode) {
      // 관리자가 카카오톡 보내기 버튼을 클릭한 경우 로그 전송
      logActivity({
        userId: loggedInStore.id,
        userType: 'agent',
        targetName: agentTarget,
        ipAddress: ipInfo?.ip || 'unknown',
        location: ipInfo?.location || 'unknown',
        deviceInfo: deviceInfo || 'unknown',
        activity: 'kakao_button',
        kakaoButton: true,
        model: selectedModel,
        colorName: selectedColor
      });
    }
  }, [loggedInStore, isAgentMode, agentTarget, ipInfo, deviceInfo, selectedModel, selectedColor]);

  // 재고 확인 뷰 변경 핸들러
  const handleViewChange = useCallback((view) => {
    setCurrentView(view);
    console.log(`재고 확인 뷰 변경: ${view}`);
    
    // 로컬 스토리지에 현재 뷰 상태 저장
    const savedLoginState = localStorage.getItem('loginState');
    if (savedLoginState) {
      try {
        const parsedState = JSON.parse(savedLoginState);
        parsedState.currentView = view;
        localStorage.setItem('loginState', JSON.stringify(parsedState));
      } catch (error) {
        console.error('로그인 상태 업데이트 실패:', error);
      }
    }
    
    // 관리자모드에서 뷰가 변경되면 데이터 다시 로드 (캐시 무효화)
    if (isAgentMode && isLoggedIn) {
      console.log('관리자모드 뷰 변경으로 인한 데이터 재로드');
      // 캐시 무효화를 위해 약간의 지연 후 데이터 로드
      setTimeout(() => {
        loadData();
      }, 100);
    }
  }, [isAgentMode, isLoggedIn, loadData]);

  // 업데이트 팝업 닫기 핸들러
  const handleUpdatePopupClose = useCallback((hideToday = false) => {
    setShowUpdatePopup(false);
    
    if (hideToday) {
      // 오늘 하루 보지 않기 설정
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // 다음날 자정으로 설정
      setHideUntilDate(tomorrow);
      console.log('오늘 하루 보지 않기 설정 완료:', tomorrow);
    } else {
      // 마지막 업데이트 버전을 현재 버전으로 설정
      if (unreadUpdates.length > 0) {
        const latestVersion = unreadUpdates[0].version;
        setLastUpdateVersion(latestVersion);
        console.log('업데이트 확인 완료:', latestVersion);
      }
    }
  }, [unreadUpdates]);

  // 업데이트 확인 핸들러
  const handleCheckUpdate = useCallback(async () => {
    try {
      const hasNew = await hasNewUpdates();
      if (hasNew) {
        const updates = await getUnreadUpdates();
        setUnreadUpdates(updates);
        setShowUpdatePopup(true);
        console.log('업데이트 확인 - 새로운 업데이트 발견:', updates.length, '개');
      } else {
        // 최신 버전인 경우 업데이트 진행 팝업을 표시하지 않고 바로 닫기
        console.log('업데이트 확인 - 최신 버전입니다');
        // 최신 버전임을 알리는 간단한 알림만 표시
        alert('현재 최신 버전을 사용하고 있습니다.');
      }
    } catch (error) {
      console.error('업데이트 확인 중 오류:', error);
      alert('업데이트 확인 중 오류가 발생했습니다.');
    }
  }, []);

  // 업데이트 진행 팝업 닫기 핸들러
  const handleUpdateProgressPopupClose = useCallback(() => {
    setShowUpdateProgressPopup(false);
  }, []);

  // 매장 재고 계산 함수 추가
  const getStoreInventory = useCallback((store) => {
    if (!store || !store.inventory) return 0;
    
    // 새로운 데이터 구조: { phones: {}, sims: {}, wearables: {}, smartDevices: {} }
    let totalInventory = 0;
    
    if (selectedModel && selectedColor) {
      // 특정 모델과 색상의 재고 확인
      Object.values(store.inventory).forEach(category => {
        if (category && category[selectedModel]) {
          Object.values(category[selectedModel]).forEach(status => {
            if (status && status[selectedColor]) {
              totalInventory += status[selectedColor] || 0;
            }
          });
        }
      });
    } else if (selectedModel) {
      // 특정 모델의 전체 재고 확인
      Object.values(store.inventory).forEach(category => {
        if (category && category[selectedModel]) {
          Object.values(category[selectedModel]).forEach(status => {
            if (status && typeof status === 'object') {
              Object.values(status).forEach(qty => {
                totalInventory += qty || 0;
              });
            }
          });
        }
      });
    } else {
      // 전체 재고 계산
      Object.values(store.inventory).forEach(category => {
        if (typeof category === 'object' && category !== null) {
          Object.values(category).forEach(model => {
            if (typeof model === 'object' && model !== null) {
              Object.values(model).forEach(status => {
                if (typeof status === 'object' && status !== null) {
                  Object.values(status).forEach(qty => {
                    if (typeof qty === 'number') {
                      totalInventory += qty || 0;
                    } else if (typeof qty === 'object' && qty && typeof qty.quantity === 'number') {
                      totalInventory += qty.quantity || 0;
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
    
    return totalInventory;
  }, [selectedModel, selectedColor]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/notifications?user_id=${loggedInStore?.id}`);
      if (response.ok) {
        const data = await response.json();
        const unreadCount = data.notifications.filter(n => !n.is_read).length;
        setUnreadNotifications(unreadCount);
      }
    } catch (error) {
      console.error('알림 로딩 실패:', error);
    }
  }, [loggedInStore?.id]);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play();
    } catch (error) {
      console.error('알림음 재생 실패:', error);
    }
  }, []);

  const showNotificationToast = useCallback((notification) => {
    // 토스트 알림 표시 로직
    console.log('새로운 배정 알림:', notification);
    playNotificationSound();
    setUnreadNotifications(prev => prev + 1);
    
    // 알림 목록에 추가
    const newNotification = {
      id: Date.now(),
      title: notification.title || '새로운 배정 완료',
      message: notification.message || '새로운 배정이 완료되었습니다.',
      timestamp: new Date(),
      isRead: false,
      data: notification.data || {}
    };
    
    setNotificationList(prev => [newNotification, ...prev]);
    
    // 토스트 알림 추가
    const toastId = Date.now();
    const newToast = {
      id: toastId,
      title: notification.title || '새로운 배정 완료',
      message: notification.message || '새로운 배정이 완료되었습니다.',
      timestamp: new Date()
    };
    
    setToastNotifications(prev => [...prev, newToast]);
    
    // 5초 후 자동 제거
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(toast => toast.id !== toastId));
    }, 5000);
  }, [playNotificationSound]);

  // 실시간 알림 수신 설정
  useEffect(() => {
    if (isAgentMode && loggedInStore) {
      const eventSource = new EventSource(`${process.env.REACT_APP_API_URL}/api/notifications/stream?user_id=${loggedInStore.id}`);
      
      eventSource.onmessage = (event) => {
        const notification = JSON.parse(event.data);
        if (notification.type === 'assignment_completed') {
          showNotificationToast(notification);
        }
      };

      eventSource.onerror = (error) => {
        console.error('실시간 알림 연결 오류:', error);
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    }
  }, [isAgentMode, loggedInStore, showNotificationToast]);

  // 관리자모드 접속 시 알림 로드
  useEffect(() => {
    if (isAgentMode && loggedInStore) {
      loadNotifications();
    }
  }, [isAgentMode, loggedInStore, loadNotifications]);

  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  // 재고모드일 때는 별도 화면 렌더링
  if (isInventoryMode) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <InventoryMode 
          onLogout={handleLogout} 
          loggedInStore={loggedInStore} 
        />
      </ThemeProvider>
    );
  }

  // 배정 모드 제거 (재고 모드로 이동)

  // 실시간 대시보드 모드 제거 (재고 모드로 이동)



  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ 
        height: '100vh', 
        py: 2,
        '@media (max-width: 768px)': {
          maxWidth: '100%',
          px: 1,
          py: 1
        }
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
          <Header 
            onCheckUpdate={handleCheckUpdate}
            inventoryUserName={inventoryUserName}
            isInventoryMode={isInventoryMode}
            currentUserId={loggedInStore?.id}
            onLogout={handleLogout}
            loggedInStore={loggedInStore}
            isAgentMode={isAgentMode}
            currentView={currentView}
            onViewChange={setCurrentView}
            activationData={activationData}
            agentTarget={agentTarget}
          />
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {isAgentMode ? (
                // 관리자 모드일 때 StoreInfoTable과 AgentFilterPanel 표시
                <>
                  {currentView === 'activation' ? (
                    // 담당개통확인 모드 - 지도를 위로, 테이블을 아래로
                    <>
                      <Box sx={{ flex: 1, mb: 2 }}>
                        <Map
                          userLocation={userLocation}
                          filteredStores={isAgentMode && agentTarget ? filterStoresByAgent(data?.stores || [], agentTarget) : filteredStores}
                          selectedStore={selectedStore}
                          requestedStore={requestedStore}
                          onStoreSelect={handleStoreSelect}
                          selectedRadius={isAgentMode ? null : selectedRadius}
                          selectedModel={selectedModel}
                          selectedColor={selectedColor}
                          loggedInStoreId={loggedInStore?.id}
                          isAgentMode={isAgentMode}
                          currentView={currentView}
                          forceZoomToStore={forceZoomToStore}
                          activationData={activationData}
                          showActivationMarkers={currentView === 'activation'}
                          activationModelSearch={activationModelSearch}
                          activationDateSearch={activationDateSearch}
                          agentTarget={agentTarget}
                        />
                      </Box>
                      
                      <Box sx={{ 
                        backgroundColor: 'white', 
                        borderRadius: 1, 
                        p: 2,
                        boxShadow: 1
                      }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            담당개통확인
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                모델 검색:
                              </Typography>
                              <select
                                value={activationModelSearch}
                                onChange={(e) => {
                                  const selectedModel = e.target.value;
                                  setActivationModelSearch(selectedModel);
                                  if (selectedModel) {
                                    setActivationDateSearch(''); // 모델 선택시 날짜 검색 초기화
                                    // 모델 선택 시 기존 데이터 로드 (전체 날짜 기준)
                                    loadActivationData();
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="">전체 모델</option>
                                {getActivationModelStats().map(stat => (
                                  <option key={stat.modelName} value={stat.modelName}>
                                    {stat.modelName}
                                  </option>
                                ))}
                              </select>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                날짜 검색:
                              </Typography>
                              <select
                                value={activationDateSearch}
                                onChange={(e) => {
                                  const selectedDate = e.target.value;
                                  setActivationDateSearch(selectedDate);
                                  if (selectedDate) {
                                    setActivationModelSearch(''); // 날짜 선택시 모델 검색 초기화
                                    // 특정 날짜 선택 시 해당 날짜의 당월/전월 데이터 로드
                                    loadActivationDataForDate(selectedDate);
                                  } else {
                                    // 전체 날짜 선택 시 기존 데이터 로드
                                    loadActivationData();
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="">전체 날짜</option>
                                {getActivationDateOptions().map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.isToday ? `${option.label} (전일)` : option.label}
                                  </option>
                                ))}
                              </select>
                            </Box>
                          </Box>
                        </Box>
                        
                        {activationModelSearch ? (
                          // 특정 모델의 매장별 통계
                          <Box>
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 2, 
                              p: 1, 
                              backgroundColor: '#e3f2fd', 
                              borderRadius: 1,
                              fontSize: '14px',
                              mb: 2
                            }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                                {activationModelSearch} 당월 총개통:
                              </Typography>
                              <span style={{ color: '#2196f3', fontWeight: 'bold', fontSize: '16px' }}>
                                {getSelectedModelTotalActivation()}개
                              </span>
                            </Box>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f5f5f5' }}>
                                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>매장명</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>당월개통</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>전월개통</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>증감률</th>
                                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>색상별</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getActivationStoreStats(activationModelSearch).map((store, index) => (
                                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{store.storeName}</td>
                                    <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 'bold', color: '#2196f3' }}>
                                      {store.currentMonth}개
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
                                      {store.previousMonth}개
                                    </td>
                                    <td style={{ 
                                      padding: '8px', 
                                      textAlign: 'center', 
                                      border: '1px solid #ddd',
                                      color: parseFloat(store.changeRate) > 0 ? '#4caf50' : parseFloat(store.changeRate) < 0 ? '#f44336' : '#ff9800',
                                      fontWeight: 'bold'
                                    }}>
                                      {parseFloat(store.changeRate) > 0 ? '+' : ''}{store.changeRate}%
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '12px' }}>
                                      {Object.entries(store.colorDetails).map(([color, count]) => (
                                        <span key={color} style={{ marginRight: '8px' }}>
                                          {color}: {count}개
                                        </span>
                                      ))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </Box>
                        ) : activationDateSearch ? (
                          // 특정 날짜의 매장별 통계
                          <Box>
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 2, 
                              p: 1, 
                              backgroundColor: '#e8f5e8', 
                              borderRadius: 1,
                              fontSize: '14px',
                              mb: 2
                            }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                {activationDateSearch} 총개통:
                              </Typography>
                              <span style={{ color: '#4caf50', fontWeight: 'bold', fontSize: '16px' }}>
                                {getSelectedDateTotalActivation()}개
                              </span>
                            </Box>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f5f5f5' }}>
                                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>매장명</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>당월개통</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>전월개통</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>증감률</th>
                                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>모델별</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getActivationDateStoreStats(activationDateSearch).map((store, index) => (
                                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{store.storeName}</td>
                                    <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 'bold', color: '#2196f3' }}>
                                      {store.currentMonth}개
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
                                      {store.previousMonth}개
                                    </td>
                                    <td style={{ 
                                      padding: '8px', 
                                      textAlign: 'center', 
                                      border: '1px solid #ddd',
                                      color: parseFloat(store.changeRate) > 0 ? '#4caf50' : parseFloat(store.changeRate) < 0 ? '#f44336' : '#ff9800',
                                      fontWeight: 'bold'
                                    }}>
                                      {parseFloat(store.changeRate) > 0 ? '+' : ''}{store.changeRate}%
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '12px' }}>
                                      {Object.entries(store.models).map(([model, count]) => (
                                        <span key={model} style={{ marginRight: '8px' }}>
                                          {model}: {count}개
                                        </span>
                                      ))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </Box>
                        ) : (
                          // 전체 모델별 통계
                          <Box>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f5f5f5' }}>
                                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>
                                    {activationDateSearch ? '날짜' : '모델명'}
                                  </th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>당월개통</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>전월개통</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>증감률</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>매장수</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(activationDateSearch ? getActivationDateStats() : getActivationModelStats()).map((stat, index) => (
                                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                      {activationDateSearch ? stat.date : stat.modelName}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 'bold', color: '#2196f3' }}>
                                      {stat.currentMonth}개
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
                                      {stat.previousMonth}개
                                    </td>
                                    <td style={{ 
                                      padding: '8px', 
                                      textAlign: 'center', 
                                      border: '1px solid #ddd',
                                      color: parseFloat(stat.changeRate) > 0 ? '#4caf50' : parseFloat(stat.changeRate) < 0 ? '#f44336' : '#ff9800',
                                      fontWeight: 'bold'
                                    }}>
                                      {parseFloat(stat.changeRate) > 0 ? '+' : ''}{stat.changeRate}%
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
                                      {stat.storeCount}개
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </Box>
                        )}
                      </Box>
                    </>
                  ) : (
                    // 기존 재고확인 모드
                <>
                  <StoreInfoTable 
                    selectedStore={selectedStore}
                    requestedStore={requestedStore}
                    agentTarget={agentTarget}
                    agentContactId={agentContactId}
                    onCallButtonClick={handleCallButtonClick}
                    onKakaoTalkButtonClick={handleKakaoTalkButtonClick}
                    selectedModel={selectedModel}
                    selectedColor={selectedColor}
                    currentView={currentView}
                        agentTotalInventory={getAgentTotalInventory()}
                  />
                  <AgentFilterPanel
                    models={data?.models}
                    colorsByModel={data?.colorsByModel}
                    selectedModel={selectedModel}
                    selectedColor={selectedColor}
                    onModelSelect={handleModelSelect}
                    onColorSelect={handleColorSelect}
                    searchQuery={searchQuery}
                    searchResults={searchResults}
                    onStoreSearch={handleStoreSearch}
                    onSearchResultSelect={handleSearchResultSelect}
                  />
                    </>
                  )}
                </>
              ) : (
                // 일반 매장 모드일 때 FilterPanel만 표시
                <FilterPanel
                  models={data?.models}
                  colorsByModel={data?.colorsByModel}
                  selectedModel={selectedModel}
                  selectedColor={selectedColor}
                  selectedRadius={selectedRadius}
                  onModelSelect={handleModelSelect}
                  onColorSelect={handleColorSelect}
                  onRadiusSelect={handleRadiusSelect}
                  isAgentMode={isAgentMode}
                />
              )}
              {currentView !== 'activation' && (
              <Box sx={{ flex: 1 }}>
                <Map
                  userLocation={userLocation}
                  filteredStores={filteredStores}
                  selectedStore={selectedStore}
                  requestedStore={requestedStore}
                  onStoreSelect={handleStoreSelect}
                  selectedRadius={isAgentMode ? null : selectedRadius} // 관리자 모드일 때는 반경 표시 안함
                  selectedModel={selectedModel}
                  selectedColor={selectedColor}
                  loggedInStoreId={loggedInStore?.id}
                  isAgentMode={isAgentMode}
                  currentView={currentView}
                  forceZoomToStore={forceZoomToStore}
                    activationData={activationData}
                    showActivationMarkers={currentView === 'activation'}
                    activationModelSearch={activationModelSearch}
                    activationDateSearch={activationDateSearch}
                    agentTarget={agentTarget}
                />
              </Box>
              )}
            </>
          )}
        </Box>
      </Container>
      
      {/* 업데이트 팝업 */}
      <UpdatePopup
        open={showUpdatePopup}
        onClose={handleUpdatePopupClose}
        updates={unreadUpdates}
        onMarkAsRead={handleUpdatePopupClose}
      />
      
      {/* 업데이트 진행 팝업 */}
      <UpdateProgressPopup
        open={showUpdateProgressPopup}
        onClose={handleUpdateProgressPopupClose}
        isLatestVersion={false}
      />

      {/* 알림 모달 */}
      <Dialog
        open={showNotificationModal}
        onClose={() => {
          setShowNotificationModal(false);
          // 알림 모달을 닫을 때 읽음 처리
          setUnreadNotifications(0);
          // 모든 알림을 읽음 처리로 표시
          if (loggedInStore?.id) {
            fetch(`${process.env.REACT_APP_API_URL}/api/notifications/mark-all-read`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ user_id: loggedInStore.id })
            }).catch(error => {
              console.error('알림 읽음 처리 실패:', error);
            });
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsIcon color="primary" />
            <Typography variant="h6">알림</Typography>
            {unreadNotifications > 0 && (
              <Chip 
                label={unreadNotifications} 
                color="error" 
                size="small"
                sx={{ ml: 'auto' }}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ minHeight: '300px' }}>
            {notificationList.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                새로운 알림이 없습니다.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {notificationList.map((notification) => (
                  <Box 
                    key={notification.id} 
                    sx={{ 
                      p: 2, 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 1,
                      backgroundColor: notification.isRead ? '#fafafa' : '#fff3e0'
                    }}
                  >
                    <Typography variant="body1" gutterBottom sx={{ fontWeight: 'bold' }}>
                      {notification.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {notification.timestamp.toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNotificationModal(false)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 토스트 알림들 */}
      {toastNotifications.map((toast, index) => (
        <Box
          key={toast.id}
          className="notification-toast"
          sx={{
            top: `${20 + index * 80}px`
          }}
        >
          <div className="notification-title">{toast.title}</div>
          <div className="notification-message">{toast.message}</div>
          <div className="notification-time">
            {toast.timestamp.toLocaleTimeString()}
          </div>
        </Box>
      ))}

      {/* 알림 시스템 */}
                    {/* 알림 시스템 제거 (재고 모드로 이동) */}
    </ThemeProvider>
  );
}

export default App; 