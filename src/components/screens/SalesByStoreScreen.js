import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Grid,
  Skeleton,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  ColorLens as ColorLensIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  TrendingUp as TrendingUpIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import AgentDetailScreen from './AgentDetailScreen';
import { 
  getCachedModelColorData, 
  getCachedNormalizationStatus,
  getCachedCustomerListByPos,
  getCachedCustomerListByModel,
  clearModelColorCache,
  getModelColorCacheStats
} from '../../utils/modelColorCache';

function SalesByStoreScreen({ loggedInStore }) {
  const [data, setData] = useState({ byStore: {}, byAgent: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unmatchedOnSaleData, setUnmatchedOnSaleData] = useState([]);
  const [showUnmatchedPopup, setShowUnmatchedPopup] = useState(false);
  const [matchingFailures, setMatchingFailures] = useState({});
  const [showMatchingFailuresPopup, setShowMatchingFailuresPopup] = useState(false);
  const [viewMode, setViewMode] = useState('store'); // 'store', 'agent', 'modelColor'
  const [selectedStore, setSelectedStore] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [selectedPos, setSelectedPos] = useState(0);
  const [selectedModelColor, setSelectedModelColor] = useState(0);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAgentValue, setEditAgentValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [normalizationStatus, setNormalizationStatus] = useState(null);
  const [modelColorData, setModelColorData] = useState([]);
  const [loadingModelColor, setLoadingModelColor] = useState(false);
  const [customerListData, setCustomerListData] = useState([]);
  const [loadingCustomerList, setLoadingCustomerList] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState({ type: '', value: '' });
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [inventoryData, setInventoryData] = useState({});
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryTab, setInventoryTab] = useState(0); // 0: 전체, 1: 306891, 2: 314942, 3: 315835
  const [inventoryDataByStore, setInventoryDataByStore] = useState({});
  const [filters, setFilters] = useState({
    agent: '',
    storeCode: '',
    status: '',
    minCompletionRate: '',
    maxCompletionRate: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAgentDetail, setSelectedAgentDetail] = useState(null);
  const [showCacheStatsDialog, setShowCacheStatsDialog] = useState(false);
  const [cacheStats, setCacheStats] = useState(null);
  const [assignmentStatus, setAssignmentStatus] = useState({});
  const [loadingAssignment, setLoadingAssignment] = useState(false);

  // 차트 데이터 준비 함수들
  const prepareAgentPerformanceData = () => {
    const agentData = data.byAgent || {};
    return Object.entries(agentData)
      .map(([agent, agentData]) => {
        const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
        const totalReceived = Object.values(agentData).reduce((sum, posData) => sum + posData.received, 0);
        const completionRate = totalItems > 0 ? Math.round((totalReceived / totalItems) * 100) : 0;
        
        return {
          name: agent,
          총건수: totalItems,
          접수완료: totalReceived,
          미접수: totalItems - totalReceived,
          완료율: completionRate
        };
      })
      .sort((a, b) => b.총건수 - a.총건수)
      .slice(0, 10); // 상위 10명만 표시
  };

  const prepareDocumentStatusData = () => {
    const agentData = data.byAgent || {};
    const totalReceived = Object.values(agentData).reduce((sum, agentData) => 
      sum + Object.values(agentData).reduce((agentSum, posData) => agentSum + posData.received, 0), 0
    );
    const totalNotReceived = Object.values(agentData).reduce((sum, agentData) => 
      sum + Object.values(agentData).reduce((agentSum, posData) => agentSum + posData.notReceived, 0), 0
    );
    
    return [
      { name: '서류접수 완료', value: totalReceived, fill: '#4caf50' },
      { name: '서류접수 대기', value: totalNotReceived, fill: '#ff9800' }
    ];
  };

  const prepareStoreDistributionData = () => {
    const storeData = data.byStore || {};
    return Object.entries(storeData)
      .map(([storeCode, storeData]) => {
        const totalItems = Object.values(storeData).reduce((sum, agentData) => sum + agentData.total, 0);
        return {
          name: storeCode,
          총건수: totalItems
        };
      })
      .sort((a, b) => b.총건수 - a.총건수)
      .slice(0, 8); // 상위 8개 대리점만 표시
  };

  const prepareCompletionTrendData = () => {
    const agentData = data.byAgent || {};
    return Object.entries(agentData)
      .map(([agent, agentData]) => {
        const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
        const totalReceived = Object.values(agentData).reduce((sum, posData) => sum + posData.received, 0);
        const completionRate = totalItems > 0 ? Math.round((totalReceived / totalItems) * 100) : 0;
        
        return {
          name: agent,
          완료율: completionRate,
          총건수: totalItems
        };
      })
      .sort((a, b) => b.완료율 - a.완료율)
      .slice(0, 10); // 상위 10명만 표시
  };

  // 담당자별 성과 엑셀 다운로드
  const downloadAgentPerformanceExcel = async () => {
    setDownloadingExcel(true);
    setMessage({ type: '', text: '' });

    try {
      const XLSX = await import('xlsx');
      
      // 담당자별 성과 데이터 준비
      const agentData = data.byAgent || {};
      const excelData = Object.entries(agentData).map(([agent, agentData]) => {
        const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
        const totalReceived = Object.values(agentData).reduce((sum, posData) => sum + posData.received, 0);
        const completionRate = totalItems > 0 ? Math.round((totalReceived / totalItems) * 100) : 0;
        
        return {
          '담당자': agent,
          '총건수': totalItems,
          '서류접수': totalReceived,
          '서류미접수': totalItems - totalReceived,
          '완료율(%)': completionRate,
          'POS개수': Object.keys(agentData).length
        };
      }).sort((a, b) => b['총건수'] - a['총건수']);

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // 열 너비 설정
      const columnWidths = [
        { wch: 20 },  // 담당자
        { wch: 12 },  // 총건수
        { wch: 12 },  // 서류접수
        { wch: 12 },  // 서류미접수
        { wch: 12 },  // 완료율
        { wch: 12 }   // POS개수
      ];
      worksheet['!cols'] = columnWidths;

      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, '담당자별성과');

      // 파일 다운로드
      const fileName = `담당자별성과_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setMessage({ type: 'success', text: '담당자별 성과 엑셀 파일이 다운로드되었습니다.' });
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
      setMessage({ type: 'error', text: '엑셀 다운로드에 실패했습니다.' });
    } finally {
      setDownloadingExcel(false);
    }
  };

  // 재고 현황 엑셀 다운로드
  const downloadInventoryExcel = async () => {
    if (Object.keys(inventoryData).length === 0) {
      setMessage({ type: 'warning', text: '다운로드할 재고 현황 데이터가 없습니다.' });
      return;
    }

    setDownloadingExcel(true);
    setMessage({ type: '', text: '' });

    try {
      const XLSX = await import('xlsx');
      
      // 재고 현황 데이터 준비
      const excelData = Object.entries(inventoryData)
        .sort((a, b) => b[1].remainingStock - a[1].remainingStock)
        .map(([model, data]) => ({
          '정규화된 모델': model,
          '보유재고': data.inventory,
          '사전예약': data.reservations,
          '예상잔여재고': data.remainingStock,
          '상태': data.status
        }));

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // 열 너비 설정
      const columnWidths = [
        { wch: 30 },  // 정규화된 모델
        { wch: 12 },  // 보유재고
        { wch: 12 },  // 사전예약
        { wch: 15 },  // 예상잔여재고
        { wch: 12 }   // 상태
      ];
      worksheet['!cols'] = columnWidths;

      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, '재고현황');

      // 파일 다운로드
      const fileName = `재고현황_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setMessage({ type: 'success', text: '재고 현황 엑셀 파일이 다운로드되었습니다.' });
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
      setMessage({ type: 'error', text: '엑셀 다운로드에 실패했습니다.' });
    } finally {
      setDownloadingExcel(false);
    }
  };

  // 필터링된 데이터 계산
  const getFilteredData = () => {
    const agentData = data.byAgent || {};
    const storeData = data.byStore || {};
    
    let filteredAgents = Object.keys(agentData);
    let filteredStores = Object.keys(storeData);
    
    // 담당자 필터
    if (filters.agent) {
      filteredAgents = filteredAgents.filter(agent => 
        agent.toLowerCase().includes(filters.agent.toLowerCase())
      );
    }
    
    // 대리점코드 필터
    if (filters.storeCode) {
      filteredStores = filteredStores.filter(store => 
        store.toLowerCase().includes(filters.storeCode.toLowerCase())
      );
    }
    
    // 완료율 필터
    if (filters.minCompletionRate || filters.maxCompletionRate) {
      filteredAgents = filteredAgents.filter(agent => {
        const agentData = data.byAgent[agent] || {};
        const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
        const totalReceived = Object.values(agentData).reduce((sum, posData) => sum + posData.received, 0);
        const completionRate = totalItems > 0 ? Math.round((totalReceived / totalItems) * 100) : 0;
        
        const minRate = filters.minCompletionRate ? parseInt(filters.minCompletionRate) : 0;
        const maxRate = filters.maxCompletionRate ? parseInt(filters.maxCompletionRate) : 100;
        
        return completionRate >= minRate && completionRate <= maxRate;
      });
    }
    
    // 상태 필터 (서류접수 상태)
    if (filters.status) {
      filteredAgents = filteredAgents.filter(agent => {
        const agentData = data.byAgent[agent] || {};
        const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
        const totalReceived = Object.values(agentData).reduce((sum, posData) => sum + posData.received, 0);
        
        if (filters.status === 'completed') {
          return totalReceived === totalItems && totalItems > 0;
        } else if (filters.status === 'pending') {
          return totalReceived < totalItems;
        } else if (filters.status === 'no-data') {
          return totalItems === 0;
        }
        return true;
      });
    }
    
    return filteredAgents;
  };

  // 재고 현황 데이터 로드 (대리점별)
  const loadInventoryData = async (storeCode = null) => {
    setLoadingInventory(true);
    setMessage({ type: '', text: '' });

    try {
      const url = storeCode 
        ? `${process.env.REACT_APP_API_URL}/api/inventory-analysis?storeCode=${storeCode}`
        : `${process.env.REACT_APP_API_URL}/api/inventory-analysis`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('재고 현황 데이터를 불러올 수 없습니다.');
      }
      
      const result = await response.json();
      
      if (result.success) {
        if (storeCode) {
          // 특정 대리점 데이터 저장
          setInventoryDataByStore(prev => ({
            ...prev,
            [storeCode]: result.inventoryAnalysis
          }));
        } else {
          // 전체 데이터 저장
          setInventoryData(result.inventoryAnalysis);
        }
        setMessage({ type: 'success', text: `재고 현황 로드 완료: ${Object.keys(result.inventoryAnalysis).length}개 모델` });
      } else {
        throw new Error(result.message || '재고 현황 데이터 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('재고 현황 데이터 로드 오류:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingInventory(false);
    }
  };

  // 대리점별 재고 데이터 로드
  const loadInventoryDataByStore = async () => {
    // 전체 데이터 로드
    await loadInventoryData();
    
    // 각 대리점별 데이터 로드
    const storeCodes = ['306891', '314942', '315835'];
    for (const code of storeCodes) {
      await loadInventoryData(code);
    }
  };

  // 현재 탭에 따른 재고 데이터 반환
  const getCurrentInventoryData = () => {
    const storeCodes = ['306891', '314942', '315835'];
    const currentStoreCode = storeCodes[inventoryTab - 1];
    
    if (inventoryTab === 0) {
      return inventoryData;
    } else if (currentStoreCode && inventoryDataByStore[currentStoreCode]) {
      return inventoryDataByStore[currentStoreCode];
    }
    
    return {};
  };



  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-by-store/data`);
      
      if (!response.ok) {
        throw new Error('데이터를 불러올 수 없습니다.');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setUnmatchedOnSaleData(result.unmatchedOnSaleData || []);
        setMatchingFailures(result.matchingFailures || {});
        
        // 디버깅 로그 추가
        console.log('판매처별정리 데이터 로드 완료:', {
          byStore: Object.keys(result.data.byStore || {}).length,
          byAgent: Object.keys(result.data.byAgent || {}).length,
          unmatchedOnSale: result.unmatchedOnSaleData?.length || 0,
          matchingFailures: result.matchingFailures?.totalFailures || 0,
          successRate: result.stats?.matchingSuccessRate || '0.0'
        });
        
        // 담당자별 데이터 상세 로그
        Object.entries(result.data.byAgent || {}).forEach(([agent, agentData]) => {
          const posNames = Object.keys(agentData);
          const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
          const totalReceived = Object.values(agentData).reduce((sum, posData) => sum + posData.received, 0);
          console.log(`클라이언트 ${agent}: ${posNames.length}개 POS, 총 ${totalItems}건, 접수 ${totalReceived}건`);
          console.log(`  POS명: ${posNames.slice(0, 10).join(', ')}${posNames.length > 10 ? `... (총 ${posNames.length}개)` : ''}`);
        });
        
        if (Object.keys(result.data).length > 0) {
          setSelectedStore(0);
        }
      } else {
        throw new Error(result.message || '데이터 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('판매처별정리 데이터 로드 오류:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
    
    // 재고배정 상태도 함께 로드
    try {
      setLoadingAssignment(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/assignment-status`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 예약번호를 키로 하는 맵 생성
          const statusMap = {};
          result.data.forEach(item => {
            statusMap[item.reservationNumber] = {
              assignmentStatus: item.assignmentStatus,
              activationStatus: item.activationStatus,
              assignedSerialNumber: item.assignedSerialNumber,
              waitingOrder: item.waitingOrder
            };
          });
          setAssignmentStatus(statusMap);
        }
      }
    } catch (error) {
      console.error('재고배정 상태 로드 오류:', error);
    } finally {
      setLoadingAssignment(false);
    }
  };

  // 담당자 수정 다이얼로그 열기 (현재는 비활성화)
  const handleEditAgent = (item) => {
    // 새로운 데이터 구조에서는 개별 항목 편집이 어려우므로 임시로 비활성화
    setMessage({ type: 'info', text: '담당자 수정 기능은 현재 개발 중입니다.' });
  };

  // 담당자 수정 저장
  const handleSaveAgent = async () => {
    if (!editingAgent) return;
    
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-by-store/update-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeCode: editingAgent.storeCode,
          posName: editingAgent.posName,
          agent: editAgentValue
        })
      });
      
      if (!response.ok) {
        throw new Error('담당자 업데이트에 실패했습니다.');
      }
      
      const result = await response.json();
      
      if (result.success) {
        // 로컬 상태 업데이트
        setData(prevData => {
          const newData = { ...prevData };
          const storeCode = editingAgent.storeCode;
          const posName = editingAgent.posName;
          
          if (newData[storeCode]) {
            newData[storeCode] = newData[storeCode].map(item => 
              item.posName === posName && item.storeCode === storeCode
                ? { ...item, agent: editAgentValue }
                : item
            );
          }
          
          return newData;
        });
        
        setMessage({ type: 'success', text: '담당자가 성공적으로 업데이트되었습니다.' });
        setEditDialogOpen(false);
      } else {
        throw new Error(result.message || '담당자 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('담당자 업데이트 오류:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  // 담당자 수정 취소
  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingAgent(null);
    setEditAgentValue('');
  };

  const handleAgentClick = (agentName) => {
    setSelectedAgentDetail(agentName);
  };

  const handleBackFromAgentDetail = () => {
    console.log('handleBackFromAgentDetail 호출됨');
    setSelectedAgentDetail(null);
    console.log('selectedAgentDetail 상태가 null로 설정됨');
  };

  // 영업사원 선택 시 배정셋팅과 연동하는 함수
  const handleAgentSelectionForAssignment = (agentName) => {
    try {
      // 현재 배정셋팅 설정 가져오기
      const currentSettings = JSON.parse(localStorage.getItem('reservationAssignmentSettings') || '{}');
      
      // 해당 영업사원의 매장들 찾기
      const agentData = data.byAgent[agentName] || {};
      const agentStores = Object.keys(agentData);
      
      // 매장별 설정 업데이트
      const updatedStores = { ...currentSettings.targets?.stores };
      agentStores.forEach(storeName => {
        // 매장 ID 찾기 (storeName을 ID로 사용하거나 매핑 필요)
        const storeId = storeName; // 임시로 storeName을 ID로 사용
        updatedStores[storeId] = true;
      });
      
      // 담당자별 설정 업데이트
      const updatedAgents = { ...currentSettings.targets?.agents };
      // 담당자 ID 찾기 (실제 구현에서는 agents 배열에서 찾아야 함)
      const agentId = agentName; // 임시로 agentName을 ID로 사용
      updatedAgents[agentId] = true;
      
      // 업데이트된 설정 저장
      const updatedSettings = {
        ...currentSettings,
        targets: {
          ...currentSettings.targets,
          stores: updatedStores,
          agents: updatedAgents
        }
      };
      
      localStorage.setItem('reservationAssignmentSettings', JSON.stringify(updatedSettings));
      
      console.log(`✅ 영업사원 "${agentName}" 선택 - ${agentStores.length}개 매장이 배정셋팅에서 자동 체크됨`);
      
      // 사용자에게 알림
      setMessage({ 
        type: 'success', 
        text: `"${agentName}" 담당자의 ${agentStores.length}개 매장이 배정셋팅에서 자동 선택되었습니다.` 
      });
      
    } catch (error) {
      console.error('영업사원 선택 연동 오류:', error);
      setMessage({ 
        type: 'error', 
        text: '배정셋팅 연동 중 오류가 발생했습니다.' 
      });
    }
  };

  // 캐시된 정규화 상태 확인
  const checkNormalizationStatus = useCallback(async () => {
    try {
      const result = await getCachedNormalizationStatus(process.env.REACT_APP_API_URL);
      setNormalizationStatus(result.isNormalized);
      
      if (!result.isNormalized) {
        setMessage({ type: 'warning', text: '모델 정규화작업이 필요합니다.' });
      }
    } catch (error) {
      console.error('정규화 상태 확인 오류:', error);
      setNormalizationStatus(false);
    }
  }, []);

  // 캐시된 POS별 고객 리스트 로드
  const loadCustomerListByPos = useCallback(async (posName) => {
    setLoadingCustomerList(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await getCachedCustomerListByPos(process.env.REACT_APP_API_URL, posName);
      
      if (result.success) {
        setCustomerListData(result.data);
        setSelectedFilter({ type: 'pos', value: posName });
        setMessage({ type: 'success', text: `${posName} 고객 리스트 로드 완료: ${result.data.length}명` });
      } else {
        throw new Error(result.message || 'POS별 고객 리스트 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('POS별 고객 리스트 로드 오류:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingCustomerList(false);
    }
  }, []);

  // 캐시된 모델별 고객 리스트 로드
  const loadCustomerListByModel = useCallback(async (model) => {
    setLoadingCustomerList(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await getCachedCustomerListByModel(process.env.REACT_APP_API_URL, model);
      
      if (result.success) {
        setCustomerListData(result.data);
        setSelectedFilter({ type: 'model', value: model });
        setMessage({ type: 'success', text: `${model} 고객 리스트 로드 완료: ${result.data.length}명` });
      } else {
        throw new Error(result.message || '모델별 고객 리스트 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('모델별 고객 리스트 로드 오류:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingCustomerList(false);
    }
  }, []);

  // 캐시 클리어
  const handleClearCache = useCallback(() => {
    if (window.confirm('모델색상별 정리 캐시를 클리어하시겠습니까?')) {
      clearModelColorCache();
      setMessage({ type: 'success', text: '모델색상별 정리 캐시가 클리어되었습니다.' });
    }
  }, []);

  // 캐시 통계 보기
  const handleShowCacheStats = useCallback(() => {
    const stats = getModelColorCacheStats();
    setCacheStats(stats);
    setShowCacheStatsDialog(true);
  }, []);

  // 고객리스트 엑셀 다운로드 함수
  const downloadCustomerListExcel = async () => {
    if (customerListData.length === 0) {
      setMessage({ type: 'warning', text: '다운로드할 데이터가 없습니다.' });
      return;
    }

    setDownloadingExcel(true);
    setMessage({ type: '', text: '' });

    try {
      // XLSX 라이브러리 동적 import
      const XLSX = await import('xlsx');
      
      // 헤더 정의
      const headers = [
        '고객명',
        '예약번호',
        '사이트예약',
        '마당접수일',
        '온세일접수일',
        '모델&색상',
        '유형',
        '대리점',
        'POS명',
        '사이트메모',
        '마당메모',
        '접수자'
      ];

      // 데이터 준비
      const excelData = customerListData.map(customer => [
        customer.customerName || '',
        customer.reservationNumber || '',
        customer.reservationDateTime || '',
        customer.yardReceivedDate || '',
        customer.onSaleReceivedDate || '',
        customer.model || '',
        customer.type || '',
        customer.storeCode || '',
        customer.posName || '',
        customer.reservationMemo || '',
        customer.yardReceivedMemo || '',
        customer.receiver || ''
      ]);

      // 워크북 생성
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...excelData]);

      // 컬럼 너비 설정
      const colWidths = [
        { wch: 15 }, // 고객명
        { wch: 12 }, // 예약번호
        { wch: 15 }, // 사이트예약
        { wch: 15 }, // 마당접수일
        { wch: 15 }, // 온세일접수일
        { wch: 25 }, // 모델&색상
        { wch: 10 }, // 유형
        { wch: 12 }, // 대리점
        { wch: 15 }, // POS명
        { wch: 20 }, // 사이트메모
        { wch: 20 }, // 마당메모
        { wch: 10 }  // 접수자
      ];
      ws['!cols'] = colWidths;

      // 워크시트를 워크북에 추가
      const sheetName = selectedFilter.type === 'pos' 
        ? `${selectedFilter.value}_고객리스트`
        : `${selectedFilter.value}_고객리스트`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // 파일명 생성
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fileName = `${selectedFilter.value}_고객리스트_${timestamp}.xlsx`;

      // 엑셀 파일 다운로드
      XLSX.writeFile(wb, fileName);

      setMessage({ type: 'success', text: `엑셀 파일 다운로드 완료: ${fileName}` });
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
      setMessage({ type: 'error', text: '엑셀 파일 다운로드에 실패했습니다.' });
    } finally {
      setDownloadingExcel(false);
    }
  };

  // 모델색상별 정리 엑셀 다운로드 함수
  const downloadModelColorExcel = async () => {
    if (modelColorData.length === 0) {
      setMessage({ type: 'warning', text: '다운로드할 데이터가 없습니다.' });
      return;
    }

    setDownloadingExcel(true);
    setMessage({ type: '', text: '' });

    try {
      // XLSX 라이브러리 동적 import
      const XLSX = await import('xlsx');
      
      // 헤더 정의
      const headers = [
        '랭크',
        '모델색상',
        '서류접수',
        '서류미접수',
        '합계'
      ];

      // 데이터 준비
      const excelData = modelColorData.map(item => [
        item.rank || '',
        item.model || '',
        item.received || 0,
        item.notReceived || 0,
        item.total || 0
      ]);

      // 워크북 생성
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...excelData]);

      // 컬럼 너비 설정
      const colWidths = [
        { wch: 8 },  // 랭크
        { wch: 35 }, // 모델색상
        { wch: 12 }, // 서류접수
        { wch: 12 }, // 서류미접수
        { wch: 10 }  // 합계
      ];
      ws['!cols'] = colWidths;

      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(wb, ws, '모델색상별_정리');

      // 파일명 생성
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fileName = `모델색상별_정리_${timestamp}.xlsx`;

      // 엑셀 파일 다운로드
      XLSX.writeFile(wb, fileName);

      setMessage({ type: 'success', text: `엑셀 파일 다운로드 완료: ${fileName}` });
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
      setMessage({ type: 'error', text: '엑셀 파일 다운로드에 실패했습니다.' });
    } finally {
      setDownloadingExcel(false);
    }
  };

  // 캐시된 모델색상별 데이터 로드
  const loadModelColorData = useCallback(async () => {
    if (!normalizationStatus) {
      setMessage({ type: 'warning', text: '정규화작업이 완료되지 않았습니다.' });
      return;
    }

    setLoadingModelColor(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await getCachedModelColorData(process.env.REACT_APP_API_URL);
      
      if (result.success) {
        setModelColorData(result.data);
        setMessage({ type: 'success', text: `모델색상별 데이터 로드 완료: ${result.data.length}개 조합` });
      } else {
        throw new Error(result.message || '모델색상별 데이터 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('모델색상별 데이터 로드 오류:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingModelColor(false);
    }
    
    // 재고배정 상태도 함께 로드
    try {
      setLoadingAssignment(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/assignment-status`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 예약번호를 키로 하는 맵 생성
          const statusMap = {};
          result.data.forEach(item => {
            statusMap[item.reservationNumber] = {
              assignmentStatus: item.assignmentStatus,
              activationStatus: item.activationStatus,
              assignedSerialNumber: item.assignedSerialNumber,
              waitingOrder: item.waitingOrder
            };
          });
          setAssignmentStatus(statusMap);
        }
      }
    } catch (error) {
      console.error('재고배정 상태 로드 오류:', error);
    } finally {
      setLoadingAssignment(false);
    }
  }, [normalizationStatus]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadData();
    checkNormalizationStatus();
    loadInventoryDataByStore(); // 대리점별 재고 데이터 로드
  }, []);

  // 캐시된 모델색상별 탭 선택 시 데이터 로드
  useEffect(() => {
    if (viewMode === 'modelColor' && normalizationStatus && modelColorData.length === 0) {
      loadModelColorData();
    }
  }, [viewMode, normalizationStatus, modelColorData.length, loadModelColorData]);

  // 재고 탭 변경 시 해당 대리점 데이터 로드
  useEffect(() => {
    const storeCodes = ['306891', '314942', '315835'];
    const currentStoreCode = storeCodes[inventoryTab - 1];
    
    if (inventoryTab > 0 && currentStoreCode && !inventoryDataByStore[currentStoreCode]) {
      loadInventoryData(currentStoreCode);
    }
  }, [inventoryTab]);

  // 디버깅용: 데이터 구조 확인
  useEffect(() => {
    if (data.byAgent && Object.keys(data.byAgent).length > 0) {
      console.log('담당자별 데이터 구조:', data.byAgent);
      Object.entries(data.byAgent).forEach(([agent, agentData]) => {
        const posNames = Object.keys(agentData);
        const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
        const totalReceived = Object.values(agentData).reduce((sum, posData) => sum + posData.received, 0);
        console.log(`${agent} 담당자: ${posNames.length}개 POS, 총 ${totalItems}건, 접수 ${totalReceived}건`);
        console.log(`  POS 목록:`, posNames);
      });
    }
  }, [data.byAgent]);

  // 데이터 목록
  const storeCodes = Object.keys(data.byStore);
  const agents = Object.keys(data.byAgent);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadData}
        >
          다시 시도
        </Button>
      </Container>
    );
  }

  if (storeCodes.length === 0 && agents.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="info">
          표시할 데이터가 없습니다.
        </Alert>
      </Container>
    );
  }

  const currentStoreCode = storeCodes[selectedStore];
  const currentStoreData = data.byStore[currentStoreCode] || [];
  const currentAgentName = agents[selectedAgent];
  const currentAgentData = data.byAgent[currentAgentName] || {};

  // 담당자 상세 화면이 선택된 경우
  if (selectedAgentDetail) {
    return (
      <AgentDetailScreen
        agentName={selectedAgentDetail}
        onBack={handleBackFromAgentDetail}
        loggedInStore={loggedInStore}
      />
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold', color: '#ff9a9e' }}>
        판매처별정리
      </Typography>

      {/* 메시지 표시 */}
      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}

      {/* 고급 필터 */}
      {showFilters && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              🔍 고급 필터
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="담당자명 검색"
                  value={filters.agent}
                  onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
                  placeholder="담당자명을 입력하세요"
                  size="small"
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="대리점코드 검색"
                  value={filters.storeCode}
                  onChange={(e) => setFilters({ ...filters, storeCode: e.target.value })}
                  placeholder="대리점코드를 입력하세요"
                  size="small"
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  label="최소 완료율 (%)"
                  type="number"
                  value={filters.minCompletionRate}
                  onChange={(e) => setFilters({ ...filters, minCompletionRate: e.target.value })}
                  placeholder="0"
                  size="small"
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  label="최대 완료율 (%)"
                  type="number"
                  value={filters.maxCompletionRate}
                  onChange={(e) => setFilters({ ...filters, maxCompletionRate: e.target.value })}
                  placeholder="100"
                  size="small"
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  select
                  label="상태"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  size="small"
                >
                  <MenuItem value="">전체</MenuItem>
                  <MenuItem value="completed">완료율 높음</MenuItem>
                  <MenuItem value="pending">진행 중</MenuItem>
                  <MenuItem value="no-data">데이터 없음</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setFilters({
                  agent: '',
                  storeCode: '',
                  status: '',
                  minCompletionRate: '',
                  maxCompletionRate: ''
                })}
              >
                필터 초기화
              </Button>
              <Chip
                label={`필터링된 담당자: ${getFilteredData().length}명`}
                color="info"
                size="small"
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 액션 버튼 */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : '새로고침'}
        </Button>
        
        <Button
          variant={viewMode === 'store' ? 'contained' : 'outlined'}
          startIcon={<StoreIcon />}
          onClick={() => setViewMode('store')}
          sx={{ backgroundColor: viewMode === 'store' ? '#ff9a9e' : undefined }}
        >
          대리점코드별 정리
        </Button>
        
        <Button
          variant={viewMode === 'agent' ? 'contained' : 'outlined'}
          startIcon={<PersonIcon />}
          onClick={() => setViewMode('agent')}
          sx={{ backgroundColor: viewMode === 'agent' ? '#ff9a9e' : undefined }}
        >
          담당자별 정리
        </Button>
        
        <Button
          variant={viewMode === 'modelColor' ? 'contained' : 'outlined'}
          startIcon={<ColorLensIcon />}
          onClick={() => {
            if (normalizationStatus) {
              setViewMode('modelColor');
            } else {
              setMessage({ 
                type: 'warning', 
                text: '모델색상별정리를 사용하려면 먼저 사전예약정리 셋팅에서 모델 정규화작업을 완료해주세요.' 
              });
            }
          }}
          sx={{ backgroundColor: viewMode === 'modelColor' ? '#ff9a9e' : undefined }}
        >
          모델색상별 정리
        </Button>
        
        <Button
          variant={showCharts ? 'contained' : 'outlined'}
          startIcon={<BarChartIcon />}
          onClick={() => setShowCharts(!showCharts)}
          sx={{ backgroundColor: showCharts ? '#ff9a9e' : undefined }}
        >
          {showCharts ? '차트 숨기기' : '차트 보기'}
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={downloadAgentPerformanceExcel}
          disabled={downloadingExcel || Object.keys(data.byAgent || {}).length === 0}
        >
          {downloadingExcel ? <CircularProgress size={20} /> : '담당자별 성과 다운로드'}
        </Button>
        
        <Button
          variant={showFilters ? 'contained' : 'outlined'}
          startIcon={<FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
          sx={{ backgroundColor: showFilters ? '#ff9a9e' : undefined }}
        >
          {showFilters ? '필터 숨기기' : '고급 필터'}
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<WarningIcon />}
          onClick={() => setShowUnmatchedPopup(true)}
          disabled={unmatchedOnSaleData.length === 0}
          sx={{
            backgroundColor: unmatchedOnSaleData.length > 0 ? '#ff6b6b' : undefined,
            color: unmatchedOnSaleData.length > 0 ? 'white' : undefined,
            '&:hover': {
              backgroundColor: unmatchedOnSaleData.length > 0 ? '#ff5a5a' : undefined
            }
          }}
        >
          온세일매칭실패데이터 ({unmatchedOnSaleData.length})
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<ErrorIcon />}
          onClick={() => setShowMatchingFailuresPopup(true)}
          disabled={matchingFailures.totalFailures === 0}
          sx={{
            backgroundColor: matchingFailures.totalFailures > 0 ? '#ff9800' : undefined,
            color: matchingFailures.totalFailures > 0 ? 'white' : undefined,
            '&:hover': {
              backgroundColor: matchingFailures.totalFailures > 0 ? '#f57c00' : undefined
            }
          }}
        >
          POS코드매칭실패 ({matchingFailures.totalFailures || 0}건, {matchingFailures.failureRate || '0.0'}%)
        </Button>
      </Box>

      {/* 대리점코드별 탭 */}
      {viewMode === 'store' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              대리점코드별 정리
            </Typography>
            
            <Tabs
              value={selectedStore}
              onChange={(event, newValue) => setSelectedStore(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  minHeight: 48,
                  fontSize: '0.9rem',
                  fontWeight: 500
                }
              }}
            >
              {storeCodes.map((storeCode, index) => {
                const storeData = data.byStore[storeCode] || {};
                const totalItems = Object.values(storeData).reduce((sum, agentData) => sum + agentData.total, 0);
                
                return (
                  <Tab
                    key={storeCode}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StoreIcon fontSize="small" />
                        {storeCode}
                        <Chip
                          label={totalItems}
                          size="small"
                          color="primary"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      </Box>
                    }
                    sx={{
                      '&.Mui-selected': {
                        color: '#ff9a9e'
                      }
                    }}
                  />
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* 담당자별 탭 */}
      {viewMode === 'agent' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              담당자별 정리
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {getFilteredData().map((agent, index) => {
                const agentData = data.byAgent[agent] || {};
                const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
                const isSelected = selectedAgent === index;
                
                return (
                  <Button
                    key={agent}
                    variant={isSelected ? 'contained' : 'outlined'}
                    size="small"
                    startIcon={<PersonIcon />}
                    onClick={() => {
                      setSelectedAgent(index);
                      // 배정셋팅과 연동: 해당 영업사원의 매장들을 자동 체크
                      handleAgentSelectionForAssignment(agent);
                    }}
                    onDoubleClick={() => handleAgentClick(agent)}
                    sx={{
                      backgroundColor: isSelected ? '#ff9a9e' : undefined,
                      color: isSelected ? 'white' : undefined,
                      '&:hover': {
                        backgroundColor: isSelected ? '#ff8a8e' : undefined
                      },
                      minWidth: 'auto',
                      px: 2,
                      py: 1,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                    title="더블클릭하여 담당자 상세 정보 보기"
                  >
                    {agent}
                    <Chip
                      label={totalItems}
                      size="small"
                      color={isSelected ? 'default' : 'primary'}
                      sx={{ 
                        fontSize: '0.6rem', 
                        height: 16, 
                        ml: 1,
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : undefined,
                        color: isSelected ? 'white' : undefined
                      }}
                    />
                  </Button>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 대리점코드별 데이터 테이블 */}
      {viewMode === 'store' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              {currentStoreCode} - 담당자별 정리
            </Typography>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="60px" align="center">랭크</TableCell>
                    <TableCell width="200px">담당자</TableCell>
                    <TableCell width="120px" align="center">서류접수</TableCell>
                    <TableCell width="120px" align="center">서류미접수</TableCell>
                    <TableCell width="100px" align="center">합계</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(currentStoreData)
                    .map(([agent, agentData]) => ({
                      agent,
                      agentData,
                      total: agentData.total
                    }))
                    .sort((a, b) => b.total - a.total) // 합계 내림차순 정렬
                    .map(({ agent, agentData }, index) => (
                    <TableRow key={agent} hover>
                      <TableCell align="center">
                        <Chip
                          label={index + 1}
                          size="small"
                          color={index < 3 ? 'primary' : 'default'}
                          sx={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 'bold',
                            backgroundColor: index < 3 ? '#ff9a9e' : undefined,
                            color: index < 3 ? 'white' : undefined
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={agent}
                            color="primary"
                            size="small"
                            icon={<PersonIcon />}
                            sx={{ 
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: '#ff8a8e'
                              }
                            }}
                            onClick={() => {
                              setViewMode('agent');
                              const agentIndex = agents.findIndex(a => a === agent);
                              if (agentIndex !== -1) {
                                setSelectedAgent(agentIndex);
                              }
                            }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={agentData.received}
                          color="success"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={agentData.notReceived}
                          color="warning"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={agentData.total}
                          color="primary"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40, fontWeight: 'bold' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* 통계 정보 */}
            <Box sx={{ mt: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={`총 담당자: ${Object.keys(currentStoreData).length}명`}
                    color="primary"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={`총 건수: ${Object.values(currentStoreData).reduce((sum, agentData) => sum + agentData.total, 0)}건`}
                    color="info"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={`서류접수: ${Object.values(currentStoreData).reduce((sum, agentData) => sum + agentData.received, 0)}건`}
                    color="success"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={`미접수: ${Object.values(currentStoreData).reduce((sum, agentData) => sum + agentData.notReceived, 0)}건`}
                    color="warning"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={loadingAssignment ? '재고배정 로딩중...' : `재고배정: ${Object.values(assignmentStatus).filter(status => status.assignmentStatus === '배정완료').length}완료/${Object.values(assignmentStatus).filter(status => status.assignmentStatus.startsWith('미배정')).length}미배정`}
                    color="success"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={loadingAssignment ? '개통완료 로딩중...' : `개통완료: ${Object.values(assignmentStatus).filter(status => status.activationStatus === '개통완료').length}완료/${Object.values(assignmentStatus).filter(status => status.activationStatus === '미개통').length}미개통`}
                    color="info"
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 담당자별 데이터 테이블 */}
      {viewMode === 'agent' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              {currentAgentName} - POS별 정리 (총 {Object.keys(currentAgentData).length}개 POS)
            </Typography>
            
            {/* 디버깅 정보 */}
            <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                디버깅: {currentAgentName} 담당자의 POS 데이터 - 총 {Object.keys(currentAgentData).length}개 POS
              </Typography>
            </Box>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="60px" align="center">랭크</TableCell>
                    <TableCell width="200px">POS명</TableCell>
                    <TableCell width="120px" align="center">서류접수</TableCell>
                    <TableCell width="120px" align="center">서류미접수</TableCell>
                    <TableCell width="100px" align="center">합계</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(currentAgentData)
                    .map(([posName, posData]) => ({
                      posName,
                      posData,
                      total: posData.total
                    }))
                    .sort((a, b) => b.total - a.total) // 합계 내림차순 정렬
                    .map(({ posName, posData }, index) => (
                    <TableRow key={posName} hover>
                      <TableCell align="center">
                        <Chip
                          label={index + 1}
                          size="small"
                          color={index < 3 ? 'primary' : 'default'}
                          sx={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 'bold',
                            backgroundColor: index < 3 ? '#ff9a9e' : undefined,
                            color: index < 3 ? 'white' : undefined
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={posName || '-'}
                          color="primary"
                          size="small"
                          icon={<StoreIcon />}
                          sx={{ 
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#ff8a8e'
                            }
                          }}
                          onClick={() => {
                            loadCustomerListByPos(posName);
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={posData.received}
                          color="success"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={posData.notReceived}
                          color="warning"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={posData.total}
                          color="primary"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40, fontWeight: 'bold' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* 통계 정보 */}
            <Box sx={{ mt: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={`총 POS: ${Object.keys(currentAgentData).length}개`}
                    color="primary"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={`총 건수: ${Object.values(currentAgentData).reduce((sum, posData) => sum + posData.total, 0)}건`}
                    color="info"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={`서류접수: ${Object.values(currentAgentData).reduce((sum, posData) => sum + posData.received, 0)}건`}
                    color="success"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={`미접수: ${Object.values(currentAgentData).reduce((sum, posData) => sum + posData.notReceived, 0)}건`}
                    color="warning"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={loadingAssignment ? '재고배정 로딩중...' : `재고배정: ${Object.values(assignmentStatus).filter(status => status.assignmentStatus === '배정완료').length}완료/${Object.values(assignmentStatus).filter(status => status.assignmentStatus.startsWith('미배정')).length}미배정`}
                    color="success"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <Chip
                    label={loadingAssignment ? '개통완료 로딩중...' : `개통완료: ${Object.values(assignmentStatus).filter(status => status.activationStatus === '개통완료').length}완료/${Object.values(assignmentStatus).filter(status => status.activationStatus === '미개통').length}미개통`}
                    color="info"
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 온세일 매칭 실패 데이터 팝업 */}
      <Dialog 
        open={showUnmatchedPopup} 
        onClose={() => setShowUnmatchedPopup(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: '#ff6b6b', fontWeight: 'bold' }}>
          미매칭대상리스트입니다. 확인해주세요
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            사전예약사이트에 없지만 온세일 시트에 있는 데이터입니다. ({unmatchedOnSaleData.length}건)
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="60px" align="center">순번</TableCell>
                  <TableCell width="200px">고객명</TableCell>
                  <TableCell width="150px" align="center">대리점코드</TableCell>
                  <TableCell width="150px" align="center">온세일접수일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unmatchedOnSaleData.map((item, index) => (
                  <TableRow key={index} hover>
                    <TableCell align="center">
                      <Chip
                        label={index + 1}
                        size="small"
                        color="default"
                        sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.customerName}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={item.storeCode}
                        color="primary"
                        size="small"
                        sx={{ fontSize: '0.8rem' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">
                        {item.receivedDate}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUnmatchedPopup(false)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* POS코드 매칭 실패 데이터 팝업 */}
      <Dialog 
        open={showMatchingFailuresPopup} 
        onClose={() => setShowMatchingFailuresPopup(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ color: '#ff9800', fontWeight: 'bold' }}>
          POS코드 매칭 실패 현황
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            담당자 매칭에 실패한 POS코드 현황입니다. ({matchingFailures.totalFailures || 0}건, 실패율: {matchingFailures.failureRate || '0.0'}%)
          </Typography>
          
          <Typography variant="h6" sx={{ mb: 2, color: '#ff9800' }}>
            상위 실패 POS코드 (Top 10)
          </Typography>
          
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="60px" align="center">순위</TableCell>
                  <TableCell width="150px">POS코드</TableCell>
                  <TableCell width="200px">POS명</TableCell>
                  <TableCell width="100px" align="center">실패건수</TableCell>
                  <TableCell width="200px">설명</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(matchingFailures.topFailurePosCodes || []).map((item, index) => (
                  <TableRow key={index}>
                    <TableCell align="center">{index + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{item.code}</TableCell>
                    <TableCell>{item.posName}</TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={item.count} 
                        size="small" 
                        color="error" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        POS코드변경설정에서 매핑 설정 필요
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Typography variant="h6" sx={{ mb: 2, color: '#ff9800' }}>
            상세 실패 데이터
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="60px" align="center">순번</TableCell>
                  <TableCell width="150px">POS코드</TableCell>
                  <TableCell width="200px">POS명</TableCell>
                  <TableCell width="150px">예약번호</TableCell>
                  <TableCell width="150px">고객명</TableCell>
                  <TableCell width="120px">접수자</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(matchingFailures.failureByPosCode || {}).map(([posCode, posData], index) => 
                  posData.items.map((item, itemIndex) => (
                    <TableRow key={`${posCode}-${itemIndex}`}>
                      <TableCell align="center">{index * 100 + itemIndex + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{posCode}</TableCell>
                      <TableCell>{posData.posName}</TableCell>
                      <TableCell>{item.reservationNumber}</TableCell>
                      <TableCell>{item.customerName}</TableCell>
                      <TableCell>{item.receiver}</TableCell>
                    </TableRow>
                  ))
                ).flat().slice(0, 50)} {/* 최대 50개만 표시 */}
              </TableBody>
            </Table>
          </TableContainer>
          
          {Object.keys(matchingFailures.failureByPosCode || {}).length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
              * 상위 50개 데이터만 표시됩니다. 전체 데이터는 엑셀 다운로드를 이용하세요.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMatchingFailuresPopup(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 모델색상별 정리 탭 */}
      {viewMode === 'modelColor' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              모델색상별 정리
            </Typography>
            
            {normalizationStatus ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ColorLensIcon />}
                  onClick={() => setSelectedModelColor(0)}
                  sx={{
                    backgroundColor: selectedModelColor === 0 ? '#ff9a9e' : undefined,
                    color: selectedModelColor === 0 ? 'white' : undefined,
                    '&:hover': {
                      backgroundColor: selectedModelColor === 0 ? '#ff8a8e' : undefined
                    }
                  }}
                >
                  전체 모델
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={loadModelColorData}
                  disabled={loadingModelColor}
                >
                  {loadingModelColor ? <CircularProgress size={16} /> : '데이터 로드'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={handleClearCache}
                >
                  캐시 클리어
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<BarChartIcon />}
                  onClick={handleShowCacheStats}
                >
                  캐시 통계
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<StoreIcon />}
                  onClick={loadInventoryData}
                  disabled={loadingInventory}
                >
                  {loadingInventory ? <CircularProgress size={16} /> : '재고 현황'}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={downloadModelColorExcel}
                  disabled={downloadingExcel || modelColorData.length === 0}
                  sx={{ 
                    backgroundColor: '#ff9a9e',
                    '&:hover': { backgroundColor: '#ff8a8e' }
                  }}
                >
                  {downloadingExcel ? <CircularProgress size={16} /> : '엑셀 다운로드'}
                </Button>
                {modelColorData.length > 0 && (
                  <Chip
                    label={`${modelColorData.length}개 모델색상 조합`}
                    color="success"
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                모델색상별정리를 사용하려면 먼저 사전예약정리 셋팅에서 모델 정규화작업을 완료해주세요.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 모델색상별 데이터 테이블 */}
      {viewMode === 'modelColor' && normalizationStatus && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
                모델색상별 서류접수 현황
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadModelColorData}
                disabled={loadingModelColor}
                size="small"
              >
                {loadingModelColor ? <CircularProgress size={16} /> : '새로고침'}
              </Button>
            </Box>
            
            {loadingModelColor ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : modelColorData.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="60px" align="center">랭크</TableCell>
                      <TableCell width="350px">모델색상</TableCell>
                      <TableCell width="200px" align="center" colSpan={3}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>서류접수</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            <Chip label="신규" size="small" sx={{ fontSize: '0.6rem', height: 20 }} />
                            <Chip label="MNP" size="small" sx={{ fontSize: '0.6rem', height: 20 }} />
                            <Chip label="기변" size="small" sx={{ fontSize: '0.6rem', height: 20 }} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell width="200px" align="center" colSpan={3}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>서류미접수</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            <Chip label="신규" size="small" sx={{ fontSize: '0.6rem', height: 20 }} />
                            <Chip label="MNP" size="small" sx={{ fontSize: '0.6rem', height: 20 }} />
                            <Chip label="기변" size="small" sx={{ fontSize: '0.6rem', height: 20 }} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell width="100px" align="center">합계</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {modelColorData.map((item) => (
                      <TableRow key={`${item.model}-${item.color}`} hover>
                        <TableCell align="center">
                          <Chip
                            label={item.rank}
                            size="small"
                            color={item.rank <= 3 ? 'primary' : 'default'}
                            sx={{ 
                              fontSize: '0.7rem', 
                              fontWeight: 'bold',
                              backgroundColor: item.rank <= 3 ? '#ff9a9e' : undefined,
                              color: item.rank <= 3 ? 'white' : undefined
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.model}
                            color="primary"
                            size="small"
                            icon={<ColorLensIcon />}
                            sx={{ 
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: '#ff8a8e'
                              }
                            }}
                            onClick={() => loadCustomerListByModel(item.model)}
                          />
                        </TableCell>
                        {/* 서류접수 - 유형별 */}
                        <TableCell align="center">
                          <Chip
                            label={item.received?.신규 || 0}
                            color="success"
                            size="small"
                            sx={{ fontSize: '0.7rem', minWidth: 30 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.received?.MNP || 0}
                            color="success"
                            size="small"
                            sx={{ fontSize: '0.7rem', minWidth: 30 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.received?.기변 || 0}
                            color="success"
                            size="small"
                            sx={{ fontSize: '0.7rem', minWidth: 30 }}
                          />
                        </TableCell>
                        {/* 서류미접수 - 유형별 */}
                        <TableCell align="center">
                          <Chip
                            label={item.notReceived?.신규 || 0}
                            color="warning"
                            size="small"
                            sx={{ fontSize: '0.7rem', minWidth: 30 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.notReceived?.MNP || 0}
                            color="warning"
                            size="small"
                            sx={{ fontSize: '0.7rem', minWidth: 30 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.notReceived?.기변 || 0}
                            color="warning"
                            size="small"
                            sx={{ fontSize: '0.7rem', minWidth: 30 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.total}
                            color="primary"
                            size="small"
                            sx={{ fontSize: '0.8rem', minWidth: 40, fontWeight: 'bold' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                모델색상별 데이터가 없습니다. 새로고침 버튼을 클릭하여 데이터를 로드해주세요.
              </Alert>
            )}

            {/* 재고 현황 테이블 */}
            {Object.keys(getCurrentInventoryData()).length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
                    📦 재고 현황 분석
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={downloadInventoryExcel}
                    disabled={downloadingExcel}
                    size="small"
                    sx={{ 
                      backgroundColor: '#ff9a9e',
                      '&:hover': { backgroundColor: '#ff8a8e' }
                    }}
                  >
                    {downloadingExcel ? <CircularProgress size={16} /> : '재고 현황 다운로드'}
                  </Button>
                </Box>

                {/* 대리점별 탭 */}
                <Box sx={{ mb: 2 }}>
                  <Tabs 
                    value={inventoryTab} 
                    onChange={(event, newValue) => setInventoryTab(newValue)}
                    sx={{
                      '& .MuiTab-root': {
                        minHeight: 48,
                        fontSize: '0.9rem',
                        fontWeight: 500
                      }
                    }}
                  >
                    <Tab 
                      label="전체" 
                      sx={{ 
                        '&.Mui-selected': {
                          color: '#ff9a9e'
                        }
                      }}
                    />
                    <Tab 
                      label="306891 (경수)" 
                      sx={{ 
                        '&.Mui-selected': {
                          color: '#ff9a9e'
                        }
                      }}
                    />
                    <Tab 
                      label="314942 (군산)" 
                      sx={{ 
                        '&.Mui-selected': {
                          color: '#ff9a9e'
                        }
                      }}
                    />
                    <Tab 
                      label="315835 (인천)" 
                      sx={{ 
                        '&.Mui-selected': {
                          color: '#ff9a9e'
                        }
                      }}
                    />
                  </Tabs>
                </Box>
                
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width="200px">정규화된 모델</TableCell>
                        <TableCell width="100px" align="center">보유재고</TableCell>
                        <TableCell width="100px" align="center">사전예약</TableCell>
                        <TableCell width="120px" align="center">예상잔여재고</TableCell>
                        <TableCell width="100px" align="center">상태</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(getCurrentInventoryData())
                        .sort((a, b) => b[1].remainingStock - a[1].remainingStock) // 잔여재고 내림차순 정렬
                        .map(([model, data]) => (
                        <TableRow key={model} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {model}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={data.inventory}
                              color="primary"
                              size="small"
                              sx={{ fontSize: '0.8rem', minWidth: 40 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={data.reservations}
                              color="secondary"
                              size="small"
                              sx={{ fontSize: '0.8rem', minWidth: 40 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={data.remainingStock}
                              color={data.status === '충분' ? 'success' : data.status === '부족' ? 'warning' : 'error'}
                              size="small"
                              sx={{ fontSize: '0.8rem', minWidth: 40, fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={data.status}
                              color={data.status === '충분' ? 'success' : data.status === '부족' ? 'warning' : 'error'}
                              size="small"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 재고 현황 통계 */}
                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={2}>
                      <Chip
                        label={`총 모델: ${Object.keys(getCurrentInventoryData()).length}개`}
                        color="primary"
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Chip
                        label={`재고 충분: ${Object.values(getCurrentInventoryData()).filter(item => item.status === '충분').length}개`}
                        color="success"
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Chip
                        label={`재고 부족: ${Object.values(getCurrentInventoryData()).filter(item => item.status === '부족').length}개`}
                        color="warning"
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Chip
                        label={`초과예약: ${Object.values(getCurrentInventoryData()).filter(item => item.status === '초과예약').length}개`}
                        color="error"
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Chip
                        label={loadingAssignment ? '재고배정 로딩중...' : `재고배정: ${Object.values(assignmentStatus).filter(status => status.assignmentStatus === '배정완료').length}완료/${Object.values(assignmentStatus).filter(status => status.assignmentStatus.startsWith('미배정')).length}미배정`}
                        color="success"
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Chip
                        label={loadingAssignment ? '개통완료 로딩중...' : `개통완료: ${Object.values(assignmentStatus).filter(status => status.activationStatus === '개통완료').length}완료/${Object.values(assignmentStatus).filter(status => status.activationStatus === '미개통').length}미개통`}
                        color="info"
                        variant="outlined"
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* 고객 리스트 테이블 */}
      {customerListData.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
                {selectedFilter.type === 'pos' ? `${selectedFilter.value} 고객 리스트` : `${selectedFilter.value} 고객 리스트`}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={downloadCustomerListExcel}
                  disabled={downloadingExcel || customerListData.length === 0}
                  size="small"
                  sx={{ 
                    backgroundColor: '#ff9a9e',
                    '&:hover': { backgroundColor: '#ff8a8e' }
                  }}
                >
                  {downloadingExcel ? <CircularProgress size={16} /> : '엑셀 다운로드'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CloseIcon />}
                  onClick={() => {
                    setCustomerListData([]);
                    setSelectedFilter({ type: '', value: '' });
                  }}
                  size="small"
                >
                  닫기
                </Button>
              </Box>
            </Box>
            
            {loadingCustomerList ? (
              <Box sx={{ py: 2 }}>
                <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="120px">고객명</TableCell>
                      <TableCell width="100px">예약번호</TableCell>
                      <TableCell width="120px">사이트예약</TableCell>
                      <TableCell width="120px">마당접수일</TableCell>
                      <TableCell width="120px">온세일접수일</TableCell>
                      <TableCell width="150px">모델&색상</TableCell>
                      <TableCell width="80px">유형</TableCell>
                      <TableCell width="100px">대리점</TableCell>
                      <TableCell width="100px">POS명</TableCell>
                      <TableCell width="120px">사이트메모</TableCell>
                      <TableCell width="120px">마당메모</TableCell>
                      <TableCell width="80px">접수자</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customerListData.map((customer, index) => (
                      <TableRow key={customer.reservationNumber} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.customerName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.reservationNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.reservationDateTime}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.yardReceivedDate || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.onSaleReceivedDate || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={customer.modelCapacityColor || '-'}
                            color="primary"
                            size="small"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.type || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.storeCode || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.posName || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.reservationMemo || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.yardReceivedMemo || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.receiver || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* 차트 섹션 */}
      {showCharts && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, color: '#ff9a9e', fontWeight: 'bold' }}>
              📊 데이터 시각화
            </Typography>
            
            <Grid container spacing={3}>
              {/* 담당자별 성과 차트 */}
              <Grid item xs={12} lg={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e' }}>
                      담당자별 성과 (상위 10명)
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareAgentPerformanceData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="접수완료" fill="#4caf50" />
                        <Bar dataKey="미접수" fill="#ff9800" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* 서류접수 현황 파이 차트 */}
              <Grid item xs={12} lg={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e' }}>
                      서류접수 현황
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={prepareDocumentStatusData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {prepareDocumentStatusData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* 대리점별 분포 차트 */}
              <Grid item xs={12} lg={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e' }}>
                      대리점별 분포 (상위 8개)
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareStoreDistributionData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="총건수" fill="#2196f3" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* 완료율 트렌드 차트 */}
              <Grid item xs={12} lg={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e' }}>
                      담당자별 완료율 (상위 10명)
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={prepareCompletionTrendData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="완료율" stroke="#ff9a9e" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 담당자 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onClose={handleCancelEdit} maxWidth="sm" fullWidth>
        <DialogTitle>
          담당자 수정
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              POS명: {editingAgent?.posName}
            </Typography>
            <TextField
              fullWidth
              label="담당자"
              value={editAgentValue}
              onChange={(e) => setEditAgentValue(e.target.value)}
              placeholder="담당자명을 입력하세요"
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEdit} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={handleSaveAgent}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 캐시 통계 다이얼로그 */}
      <Dialog open={showCacheStatsDialog} onClose={() => setShowCacheStatsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <BarChartIcon color="primary" />
            모델색상별 정리 캐시 통계
          </Box>
        </DialogTitle>
        <DialogContent>
          {cacheStats && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1">캐시 항목 수:</Typography>
                <Chip 
                  label={`${cacheStats.size} / ${cacheStats.maxSize}`} 
                  color={cacheStats.size > cacheStats.maxSize * 0.8 ? 'warning' : 'primary'}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1">사용률:</Typography>
                <Typography variant="body1" color="primary">
                  {Math.round((cacheStats.size / cacheStats.maxSize) * 100)}%
                </Typography>
              </Box>
              
              <Divider />
              
              <Typography variant="subtitle2" gutterBottom>
                캐시된 데이터 타입:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {cacheStats.keys.map((key, index) => {
                  const type = key.split(':')[0];
                  return (
                    <Chip
                      key={index}
                      label={type}
                      size="small"
                      variant="outlined"
                      color="secondary"
                    />
                  );
                })}
              </Box>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  모델색상별 정리 캐시는 성능 향상을 위해 자주 사용되는 데이터를 메모리에 저장합니다.
                  캐시가 가득 차면 가장 오래된 항목이 자동으로 제거됩니다.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCacheStatsDialog(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default SalesByStoreScreen; 