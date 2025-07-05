import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Box, AppBar, Toolbar, Typography, Button, CircularProgress, Chip } from '@mui/material';
import Map from './components/Map';
import FilterPanel from './components/FilterPanel';
import AgentFilterPanel from './components/AgentFilterPanel';
import Login from './components/Login';
import InventoryMode from './components/InventoryMode';
import { fetchData, fetchModels, cacheManager } from './api';
import { calculateDistance } from './utils/distanceUtils';
import { 
  fetchCurrentMonthData, 
  fetchPreviousMonthData, 
  generateStoreActivationComparison,
  filterActivationByAgent
} from './utils/activationService';
import './App.css';
import StoreInfoTable from './components/StoreInfoTable';
import UpdatePopup from './components/UpdatePopup';
import UpdateProgressPopup from './components/UpdateProgressPopup';
import { hasNewUpdates, getUnreadUpdates, getAllUpdates, setLastUpdateVersion, setHideUntilDate } from './utils/updateHistory';
import { hasNewDeployment, performAutoLogout, shouldCheckForUpdates, setLastUpdateCheck } from './utils/updateDetection';

// Logger 유틸리티
const logActivity = async (activityData) => {
  try {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
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
  // 개통실적 모델 검색 상태
  const [activationModelSearch, setActivationModelSearch] = useState('');
  // 개통실적 날짜 검색 상태
  const [activationDateSearch, setActivationDateSearch] = useState('');

  // 재고모드 ID 목록
  const INVENTORY_MODE_IDS = ["JEGO306891", "JEGO315835", "JEGO314942", "JEGO316558", "JEGO316254"];

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
      
      // 당월 및 전월 데이터 병렬 로드
      const [currentData, previousData] = await Promise.all([
        fetchCurrentMonthData(),
        fetchPreviousMonthData()
      ]);

      // 매장별 비교 데이터 생성
      const comparisonData = generateStoreActivationComparison(currentData, previousData);
      
      // 담당자 필터링 적용
      let filteredData = comparisonData;
      if (isAgentMode && agentTarget) {
        filteredData = filterActivationByAgent(comparisonData, agentTarget);
      }
      
      setActivationData(filteredData);
      console.log('개통실적 데이터 로딩 완료');
    } catch (error) {
      console.error('개통실적 데이터 로딩 실패:', error);
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
    
    // 전월 데이터도 계산
    Object.values(filteredData).forEach(storeData => {
      const { previousMonth, models } = storeData;
      
      Object.entries(models).forEach(([modelKey, count]) => {
        const modelName = modelKey.split(' (')[0];
        
        if (modelStats[modelName]) {
          modelStats[modelName].previousMonth += count;
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
        modelPrevious = Math.round((modelCurrent / currentMonth) * previousMonth);
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

  // 개통실적 날짜별 통계 계산
  const getActivationDateStats = useCallback(() => {
    if (!activationData) return [];
    
    const dateStats = {};
    
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
      const { currentMonth, previousMonth, models, lastActivationDate } = storeData;
      
      // 날짜별로 그룹화 (당월 마지막 개통일 기준)
      const dateKey = lastActivationDate.toLocaleDateString();
      
      if (!dateStats[dateKey]) {
        dateStats[dateKey] = {
          date: dateKey,
          currentMonth: 0,
          previousMonth: 0,
          storeCount: new Set(),
          models: {}
        };
      }
      
      dateStats[dateKey].currentMonth += currentMonth;
      dateStats[dateKey].previousMonth += previousMonth;
      dateStats[dateKey].storeCount.add(storeData.storeName);
      
      // 모델별 집계
      Object.entries(models).forEach(([modelKey, count]) => {
        const modelName = modelKey.split(' (')[0];
        if (!dateStats[dateKey].models[modelName]) {
          dateStats[dateKey].models[modelName] = 0;
        }
        dateStats[dateKey].models[modelName] += count;
      });
    });
    
    // 배열로 변환하고 날짜 내림차순 정렬
    return Object.values(dateStats)
      .map(stat => ({
        ...stat,
        storeCount: stat.storeCount.size,
        changeRate: stat.previousMonth > 0 
          ? ((stat.currentMonth - stat.previousMonth) / stat.previousMonth * 100).toFixed(1)
          : stat.currentMonth > 0 ? '100.0' : '0.0'
      }))
      .sort((a, b) => {
        // 날짜 형식 변환 (MM/DD/YYYY -> YYYY-MM-DD)
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
  }, [activationData, isAgentMode, agentTarget]);

  // 개통실적 날짜 옵션 생성 (지난 날짜들 포함)
  const getActivationDateOptions = useCallback(() => {
    if (!activationData) return [];
    
    const dateOptions = [];
    const today = new Date();
    
    // 오늘부터 과거 30일까지의 날짜 옵션 생성
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toLocaleDateString();
      
      // 실제 데이터가 있는 날짜인지 확인
      const hasData = Object.values(activationData).some(storeData => {
        if (isAgentMode && agentTarget) {
          return storeData.agents && storeData.agents.includes(agentTarget) && 
                 storeData.lastActivationDate.toLocaleDateString() === dateKey;
        }
        return storeData.lastActivationDate.toLocaleDateString() === dateKey;
      });
      
      // 데이터가 있거나 오늘 날짜인 경우 추가
      if (hasData || i === 0) {
        dateOptions.push({
          value: dateKey,
          label: dateKey,
          isToday: i === 0,
          hasData: hasData
        });
      }
    }
    
    return dateOptions;
  }, [activationData, isAgentMode, agentTarget]);

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
    if (!activationData || !activationDateSearch || !isAgentMode || !agentTarget) return 0;
    
    let totalCount = 0;
    
    // 담당자별 필터링된 데이터 사용
    const filteredData = Object.entries(activationData).filter(([storeName, storeData]) => {
      return storeData.agents && storeData.agents.includes(agentTarget);
    });
    
    filteredData.forEach(([storeName, storeData]) => {
      const { currentMonth, lastActivationDate } = storeData;
      
      if (lastActivationDate.toLocaleDateString() === activationDateSearch) {
        totalCount += currentMonth;
      }
    });
    
    return totalCount;
  }, [activationData, activationDateSearch, isAgentMode, agentTarget]);

  // 개통실적 특정 날짜의 매장별 통계
  const getActivationDateStoreStats = useCallback((dateKey) => {
    if (!activationData || !dateKey) return [];
    
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
      const { storeName, currentMonth, previousMonth, models, lastActivationDate } = storeData;
      
      // 해당 날짜의 데이터만 필터링
      if (lastActivationDate.toLocaleDateString() === dateKey) {
        storeStats.push({
          storeName,
          currentMonth,
          previousMonth,
          changeRate: previousMonth > 0 
            ? ((currentMonth - previousMonth) / previousMonth * 100).toFixed(1)
            : currentMonth > 0 ? '100.0' : '0.0',
          models
        });
      }
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
        store: store
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
        if (category[selectedModel]) {
          Object.values(category[selectedModel]).forEach(status => {
            if (status[selectedColor]) {
              totalInventory += status[selectedColor] || 0;
            }
          });
        }
      });
    } else if (selectedModel) {
      // 특정 모델의 전체 재고 확인
      Object.values(store.inventory).forEach(category => {
        if (category[selectedModel]) {
          Object.values(category[selectedModel]).forEach(status => {
            Object.values(status).forEach(qty => {
              totalInventory += qty || 0;
            });
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
                    totalInventory += qty || 0;
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
        <InventoryMode onLogout={handleLogout} loggedInStore={loggedInStore} />
      </ThemeProvider>
    );
  }



  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ height: '100vh', py: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                {isAgentMode ? (
                  // 관리자 모드일 때 대리점 정보 표시
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.7em' }}>
                      {agentTarget} ({agentQualification})
                    </span>
                    {currentView === 'activation' && getAgentTotalActivation() && (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1, 
                        p: 0.5, 
                        backgroundColor: 'rgba(255,255,255,0.1)', 
                        borderRadius: 1,
                        fontSize: '0.6em'
                      }}>
                        <span style={{ color: '#4caf50' }}>
                          휴대폰: {getAgentTotalActivation().phones}개
                        </span>
                        <span style={{ color: '#ff9800' }}>
                          웨어러블: {getAgentTotalActivation().wearables}개
                        </span>
                        <span style={{ color: '#9c27b0' }}>
                          태블릿: {getAgentTotalActivation().tablets}개
                        </span>
                      </Box>
                    )}
                    {currentView === 'assigned' && getAgentTotalInventory() && (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1, 
                        p: 0.5, 
                        backgroundColor: 'rgba(255,255,255,0.1)', 
                        borderRadius: 1,
                        fontSize: '0.6em'
                      }}>
                        <span style={{ color: '#4caf50' }}>
                          휴대폰: {getAgentTotalInventory().phones}개
                        </span>
                        <span style={{ color: '#ff9800' }}>
                          웨어러블: {getAgentTotalInventory().wearables}개
                        </span>
                        <span style={{ color: '#9c27b0' }}>
                          태블릿: {getAgentTotalInventory().tablets}개
                        </span>
                      </Box>
                    )}
                  </Box>
                ) : loggedInStore && (
                  // 일반 매장 모드일 때 기존 정보 표시
                  <>
                    <span style={{ fontWeight: 'bold', fontSize: '0.7em' }}>{loggedInStore.name}</span>
                    {selectedModel ? (
                      <span style={{ marginLeft: '16px', fontSize: '0.6em' }}>
                        {selectedModel} 
                        {selectedColor ? ` ${selectedColor}` : ''} 
                        재고: {(() => {
                          if (!loggedInStore.inventory) return 0;
                          
                          // 새로운 데이터 구조에 맞게 재고 계산
                          let totalInventory = 0;
                          
                          if (selectedModel && selectedColor) {
                            // 특정 모델과 색상의 재고 확인
                            Object.values(loggedInStore.inventory).forEach(category => {
                              if (category[selectedModel]) {
                                Object.values(category[selectedModel]).forEach(status => {
                                  if (status[selectedColor]) {
                                    totalInventory += status[selectedColor] || 0;
                                  }
                                });
                              }
                            });
                          } else if (selectedModel) {
                            // 특정 모델의 전체 재고 확인
                            Object.values(loggedInStore.inventory).forEach(category => {
                              if (category[selectedModel]) {
                                Object.values(category[selectedModel]).forEach(status => {
                                  Object.values(status).forEach(qty => {
                                    totalInventory += qty || 0;
                                  });
                                });
                              }
                            });
                          }
                          
                          return totalInventory;
                        })()}
                      </span>
                    ) : (
                      <span style={{ marginLeft: '16px', fontSize: '0.6em' }}>
                        총 재고: {(() => {
                          if (!loggedInStore.inventory) return 0;
                          
                          // 새로운 데이터 구조에 맞게 전체 재고 계산
                          let totalInventory = 0;
                          Object.values(loggedInStore.inventory).forEach(category => {
                            if (typeof category === 'object' && category !== null) {
                              Object.values(category).forEach(model => {
                                if (typeof model === 'object' && model !== null) {
                                  Object.values(model).forEach(status => {
                                    if (typeof status === 'object' && status !== null) {
                                      Object.values(status).forEach(qty => {
                                        totalInventory += qty || 0;
                                      });
                                    }
                                  });
                                }
                              });
                            }
                          });
                          
                          return totalInventory;
                        })()}
                      </span>
                    )}
                  </>
                )}
                {!loggedInStore && '가까운 가용재고 조회'}
              </Typography>
              
              {/* 캐시 상태 표시 */}
              {cacheStatus && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                  <Chip 
                    label={`캐시: ${cacheStatus.memory.valid}/${cacheStatus.memory.total}`}
                    size="small"
                    color={cacheStatus.memory.valid > 0 ? "success" : "default"}
                    variant="outlined"
                    sx={{ fontSize: '0.7em' }}
                    onClick={handleCacheClick}
                    style={{ cursor: 'pointer' }}
                    title="클릭하여 캐시 정리 및 새로고침"
                  />
                  <Chip 
                    label={`LS: ${cacheStatus.localStorage.total}`}
                    size="small"
                    color={cacheStatus.localStorage.total > 0 ? "info" : "default"}
                    variant="outlined"
                    sx={{ fontSize: '0.7em' }}
                  />
                </Box>
              )}
              
              {/* 관리자 모드 재고 확인 메뉴 */}
              {isLoggedIn && isAgentMode && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                  <Button 
                    color="inherit" 
                    onClick={() => handleViewChange('all')}
                    sx={{ 
                      fontSize: '0.8em',
                      backgroundColor: currentView === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.2)'
                      }
                    }}
                  >
                    전체재고확인
                  </Button>
                  <Button 
                    color="inherit" 
                    onClick={() => handleViewChange('assigned')}
                    sx={{ 
                      fontSize: '0.8em',
                      backgroundColor: currentView === 'assigned' ? 'rgba(255,255,255,0.1)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.2)'
                      }
                    }}
                  >
                    담당재고확인
                  </Button>
                  <Button 
                    color="inherit" 
                    onClick={() => handleViewChange('activation')}
                    sx={{ 
                      fontSize: '0.8em',
                      backgroundColor: currentView === 'activation' ? 'rgba(255,255,255,0.1)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.2)'
                      }
                    }}
                  >
                    담당개통확인
                  </Button>
                </Box>
              )}
              
              {isLoggedIn && (
                <>
                  <Button 
                    color="inherit" 
                    onClick={handleCheckUpdate}
                    sx={{ 
                      fontSize: '0.8em',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: 1,
                      mr: 1
                    }}
                  >
                    업데이트 확인
                  </Button>
                  <Button color="inherit" onClick={handleLogout} sx={{ fontSize: '0.8em' }}>
                    로그아웃
                  </Button>
                </>
              )}
            </Toolbar>
          </AppBar>
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
                          filteredStores={filteredStores}
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
                                  setActivationModelSearch(e.target.value);
                                  if (e.target.value) setActivationDateSearch(''); // 모델 선택시 날짜 검색 초기화
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
                                  setActivationDateSearch(e.target.value);
                                  if (e.target.value) setActivationModelSearch(''); // 날짜 선택시 모델 검색 초기화
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
                                    {option.isToday ? `${option.label} (오늘)` : option.label}
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
    </ThemeProvider>
  );
}

export default App; 