import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ExistingCalculatorPanel from './ob/ExistingCalculatorPanel';
import TogetherCalculatorPanel from './ob/TogetherCalculatorPanel';
import { api } from '../api';
import { initialInputs, useObCalculation } from '../utils/obCalculationEngine';
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Update as UpdateIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';
import Snackbar from '@mui/material/Snackbar';
import ObSheetConfigModal from './ob/ObSheetConfigModal';
import ObSettlementManagementPanel from './ob/ObSettlementManagementPanel';
import ObSettlementOverview from './ob/ObSettlementOverview';

const OB_LINK_SHEET_ID =
  process.env.REACT_APP_OB_LINK_SHEET_ID ||
  process.env.REACT_APP_SHEET_ID ||
  '1scNwIN5ZgV_DGGQW7WKJW9mL33vMGnFfsASPHYxt-18';
const SHEET_CONFIG_DRIVE_URL = OB_LINK_SHEET_ID
  ? `https://docs.google.com/spreadsheets/d/${OB_LINK_SHEET_ID}`
  : '';
const TAB_KEYS = {
  CALCULATOR: 'calculator',
  OVERVIEW: 'overview',
  MANAGEMENT: 'management'
};

const TAB_DEFINITIONS = [
  { key: TAB_KEYS.CALCULATOR, label: '투게더 계산기', roles: ['O', 'S', 'M'] },
  { key: TAB_KEYS.OVERVIEW, label: 'OB 정산 확인', roles: ['S', 'M'] },
  { key: TAB_KEYS.MANAGEMENT, label: 'OB 정산 관리', roles: ['M'] }
];

const ObManagementMode = ({ 
  loggedInStore, 
  onLogout, 
  onModeChange, 
  availableModes 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [planData, setPlanData] = useState([]);
  const [discountData, setDiscountData] = useState([]);
  const [segDiscountData, setSegDiscountData] = useState([]);
  const [inputs, setInputs] = useState(initialInputs());
  const [allResults, setAllResults] = useState([]); // 전체 데이터 캐시
  const [results, setResults] = useState([]); // 현재 표시되는 데이터
  const [selectedResultId, setSelectedResultId] = useState(null);
  const [subscriptionNumber, setSubscriptionNumber] = useState('');
  const [selectedUser, setSelectedUser] = useState('me'); // 'me' or 'all' or userId
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_KEYS.CALCULATOR);
const [sheetConfigs, setSheetConfigs] = useState([]);
  const [sheetConfigsLoading, setSheetConfigsLoading] = useState(false);
  const [sheetConfigsError, setSheetConfigsError] = useState('');
  const [sheetConfigModalOpen, setSheetConfigModalOpen] = useState(false);
  const [editingSheetConfig, setEditingSheetConfig] = useState(null);
  const [sheetConfigMessage, setSheetConfigMessage] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const obManagementRole = useMemo(() => {
    const candidates = [
      loggedInStore?.obManagementRole,
      loggedInStore?.agentInfo?.obManagementRole
    ]
      .map((role) => (role || '').toString().toUpperCase())
      .filter(Boolean);
    const matched = candidates.find((role) => ['M', 'S', 'O'].includes(role));
    return matched || 'O';
  }, [loggedInStore]);

  const allowedTabs = useMemo(
    () => TAB_DEFINITIONS.filter((tab) => tab.roles.includes(obManagementRole)),
    [obManagementRole]
  );
  const allowedTabKeys = useMemo(
    () => allowedTabs.map((tab) => tab.key),
    [allowedTabs]
  );
  const currentUserName = useMemo(() => {
    return (
      loggedInStore?.name ||
      loggedInStore?.target ||
      loggedInStore?.agentInfo?.target ||
      loggedInStore?.userId ||
      ''
    );
  }, [loggedInStore]);

  useEffect(() => {
    if (allowedTabs.length === 0) {
      if (activeTab !== TAB_KEYS.CALCULATOR) {
        setActiveTab(TAB_KEYS.CALCULATOR);
      }
      return;
    }
    if (!allowedTabKeys.includes(activeTab)) {
      const fallbackTab = allowedTabs[0]?.key || TAB_KEYS.CALCULATOR;
      if (activeTab !== fallbackTab) {
        setActiveTab(fallbackTab);
      }
    }
  }, [allowedTabs, allowedTabKeys, activeTab]);

  // OB 관리모드 진입 시 데이터 로드 + 업데이트 팝업 표시 (숨김 설정 확인 후)
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // userId 확인 (userId 또는 name 필드 사용)
        const userId = loggedInStore?.userId || loggedInStore?.name || loggedInStore?.id || '';
        console.log('[OB] Loading with userId:', userId, 'loggedInStore:', loggedInStore);
        
        // 요금제/할인 데이터는 항상 로드
        const [plansRes, discountsRes] = await Promise.all([
          api.getObPlanData(),
          api.getObDiscountData()
        ]);
        setPlanData(plansRes.data || []);
        setDiscountData(discountsRes.data || []);
        // OB_할인 시트의 원본 데이터를 segDiscountData로 사용
        setSegDiscountData(discountsRes.data || []);
        
        // 결과 목록은 전체 데이터 로드
        if (userId) {
          const listRes = await api.getObResults(userId, true); // 항상 전체 로드
          const allData = listRes.data || [];
          setAllResults(allData);
          // 초기에는 내 데이터 + 당월만 표시
          const monthFiltered = filterByMonth(allData, selectedMonth);
          setResults(monthFiltered.filter(r => r.userId === userId));
          setSelectedUser('me');
        } else {
          console.warn('[OB] No userId found, skipping results load');
          setAllResults([]);
          setResults([]);
        }
      } catch (e) {
        console.error('[OB] Load error:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();

    // 오늘 하루 보지 않기 설정 확인
    const hideUntil = localStorage.getItem('hideUpdate_obManagement');
    const shouldShowPopup = !(hideUntil && new Date() < new Date(hideUntil));
    
    if (shouldShowPopup) {
      // 숨김 설정이 없거나 만료된 경우에만 팝업 표시
      setShowUpdatePopup(true);
    }
  }, [loggedInStore]);

  const fetchSheetConfigs = useCallback(async () => {
    setSheetConfigsLoading(true);
    setSheetConfigsError('');
    try {
      const response = await api.getObSettlementLinks();
      if (response?.success) {
        setSheetConfigs(Array.isArray(response.data) ? response.data : []);
      } else {
        setSheetConfigs([]);
        setSheetConfigsError(response?.error || '정산 링크 정보를 불러오지 못했습니다.');
      }
    } catch (error) {
      console.error('[OB] Failed to fetch settlement links:', error);
      setSheetConfigs([]);
      setSheetConfigsError(error.message || '정산 링크 정보를 불러오지 못했습니다.');
    } finally {
      setSheetConfigsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheetConfigs();
  }, [fetchSheetConfigs]);

  useEffect(() => {
    if (activeTab === TAB_KEYS.MANAGEMENT) {
      fetchSheetConfigs();
    }
  }, [activeTab, fetchSheetConfigs]);

  const { existing, together, diff } = useObCalculation(inputs, planData, discountData, segDiscountData);

  // 월별 필터링 함수
  const filterByMonth = (data, month) => {
    if (!month) return data;
    return data.filter(row => {
      const createdAt = row.createdAt || '';
      const rowMonth = createdAt.substring(0, 7); // YYYY-MM 추출
      return rowMonth === month;
    });
  };

  // 월 목록 생성 (최근 12개월)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
      options.push({ value, label });
    }
    return options;
  };

  // 고객명/연락처 동기화 핸들러
  const handleCustomerNameSync = (index, field, value) => {
    setInputs(prev => {
      const newInputs = { ...prev };
      // 기존결합과 투게더결합 양쪽 모두 업데이트
      if (newInputs.existingLines[index]) {
        newInputs.existingLines[index] = { ...newInputs.existingLines[index], [field]: value };
      }
      if (newInputs.togetherLines[index]) {
        newInputs.togetherLines[index] = { ...newInputs.togetherLines[index], [field]: value };
      }
      return newInputs;
    });
  };

  const showSheetConfigMessage = (message, severity = 'success') => {
    setSheetConfigMessage({
      open: true,
      message,
      severity
    });
  };

  const handleTabChange = (_event, value) => {
    if (!allowedTabKeys.includes(value)) {
      return;
    }
    setActiveTab(value);
  };

  const handleOpenSheetConfigModal = () => {
    setEditingSheetConfig(null);
    setSheetConfigModalOpen(true);
  };

  const handleEditSheetConfig = (config) => {
    setEditingSheetConfig(config);
    setSheetConfigModalOpen(true);
  };

  const handleCloseSheetConfigModal = () => {
    setSheetConfigModalOpen(false);
    setEditingSheetConfig(null);
  };

  const handleSheetConfigSubmit = async (payload) => {
    const normalizedPayload = {
      ...payload,
      originalMonth: editingSheetConfig?.month,
      registrant: loggedInStore?.name || loggedInStore?.userId || ''
    };

    const isUpdate = Boolean(editingSheetConfig);
    try {
      await api.saveObSettlementLink(normalizedPayload);
      await fetchSheetConfigs();
      handleCloseSheetConfigModal();
      showSheetConfigMessage(
        isUpdate ? '월별 링크를 수정했습니다.' : '월별 링크를 저장했습니다.',
        isUpdate ? 'info' : 'success'
      );
    } catch (error) {
      console.error('[OB] Failed to save settlement link:', error);
      showSheetConfigMessage(error.message || '월별 링크 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDeleteSheetConfig = (config) => {
    if (!config) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `${config.month || '선택한'} 링크를 삭제하시겠습니까?`
      );
      if (!confirmed) return;
    }
    api.deleteObSettlementLink(config.month)
      .then(() => {
        fetchSheetConfigs();
        showSheetConfigMessage('월별 링크를 삭제했습니다.', 'info');
      })
      .catch((error) => {
        console.error('[OB] Failed to delete settlement link:', error);
        showSheetConfigMessage(error.message || '월별 링크 삭제 중 오류가 발생했습니다.', 'error');
      });
  };

  const handleDownloadTemplate = () => {
    showSheetConfigMessage('플랜 문서에 정리된 시트 템플릿을 참고해주세요.', 'info');
  };

  const handleSnackbarClose = (_event, reason) => {
    if (reason === 'clickaway') return;
    setSheetConfigMessage((prev) => ({
      ...prev,
      open: false
    }));
  };

  const renderCalculatorSection = () => (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardContent>
          {/* 가입번호 입력 */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ minWidth: 80 }}>가입번호:</Typography>
            <TextField
              size="small"
              value={subscriptionNumber}
              onChange={(e) => setSubscriptionNumber(e.target.value)}
              placeholder="가입번호 입력"
              sx={{ flex: 1 }}
            />
            {selectedResultId && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setInputs(initialInputs());
                  setSubscriptionNumber('');
                  setSelectedResultId(null);
                }}
              >
                신규 작성
              </Button>
            )}
          </Box>
          
          {/* 인터넷 옵션 (공통) */}
          <Box sx={{ 
            mb: 2, 
            p: 2, 
            background: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)', 
            borderRadius: 2, 
            border: '1px solid #fdd835',
            boxShadow: '0 2px 6px rgba(253,203,110,0.3)'
          }}>
            <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 'bold', color: '#2d3436' }}>
              🌐 인터넷 옵션 (기존결합 & 투게더결합 공통)
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={inputs.hasInternet || false}
                  onChange={(e) => setInputs(prev => ({ ...prev, hasInternet: e.target.checked }))}
                />
                <span>인터넷 회선 포함</span>
              </label>
              <select
                value={inputs.internetSpeed || '500M'}
                onChange={(e) => setInputs(prev => ({ ...prev, internetSpeed: e.target.value }))}
                disabled={!inputs.hasInternet}
                style={{ padding: 6, fontSize: 14, border: '1px solid #ccc', borderRadius: 4, minWidth: 100 }}
              >
                <option value="100M">100M</option>
                <option value="500M">500M</option>
                <option value="1G">1G</option>
              </select>
            </Box>
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <ExistingCalculatorPanel 
              inputs={inputs} 
              result={existing} 
              onInputChange={setInputs}
              planData={planData}
              onCustomerNameSync={handleCustomerNameSync}
            />
            <TogetherCalculatorPanel 
              inputs={inputs} 
              result={together} 
              onInputChange={setInputs}
              planData={planData}
              onCustomerNameSync={handleCustomerNameSync}
            />
          </Box>
          <Box sx={{ 
            mt: 3, 
            p: 2.5, 
            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', 
            border: '2px solid #2196f3', 
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(33,150,243,0.2)'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 'bold' }}>기존결합</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0d47a1' }}>
                    {existing.amount?.toLocaleString()}원
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ color: '#1976d2', fontWeight: 'bold' }}>VS</Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#c2185b', fontWeight: 'bold' }}>투게더결합</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#880e4f' }}>
                    {together.amount?.toLocaleString()}원
                  </Typography>
                </Box>
                <Box sx={{ 
                  ml: 2, 
                  p: 1.5, 
                  borderRadius: 2, 
                  backgroundColor: diff < 0 ? '#c8e6c9' : '#ffccbc',
                  border: `2px solid ${diff < 0 ? '#4caf50' : '#ff5722'}`
                }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>차액</Typography>
                  <Typography variant="h5" sx={{ color: diff < 0 ? '#2e7d32' : '#d32f2f', fontWeight: 'bold' }}>
                    {diff?.toLocaleString()}원
                  </Typography>
                </Box>
              </Box>
              <Button 
                variant="contained" 
                onClick={() => handleSave(diff < 0 ? 'together' : 'existing')}
                size="large"
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(102,126,234,0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                    boxShadow: '0 6px 16px rgba(102,126,234,0.5)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                💾 저장
              </Button>
            </Box>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">가입번호별 리스트</Typography>
                <TextField
                  select
                  size="small"
                  value={selectedMonth}
                  onChange={(e) => {
                    const newMonth = e.target.value;
                    setSelectedMonth(newMonth);
                    const monthFiltered = filterByMonth(allResults, newMonth);
                    
                    // 현재 선택된 사용자 필터 유지
                    const currentUserId = loggedInStore?.userId || loggedInStore?.name || loggedInStore?.id || '';
                    if (selectedUser === 'me') {
                      setResults(monthFiltered.filter(r => r.userId === currentUserId));
                    } else if (selectedUser === 'all') {
                      setResults(monthFiltered);
                    } else {
                      setResults(monthFiltered.filter(r => (r.userName || '(이름없음)') === selectedUser));
                    }
                  }}
                  sx={{ minWidth: 150 }}
                >
                  {getMonthOptions().map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(() => {
                  // 월별 필터링된 데이터로 카운트
                  const monthFiltered = filterByMonth(allResults, selectedMonth);
                  const userCounts = {};
                  monthFiltered.forEach(row => {
                    const name = row.userName || '(이름없음)';
                    userCounts[name] = (userCounts[name] || 0) + 1;
                  });
                  const currentUserId = loggedInStore?.userId || loggedInStore?.name || loggedInStore?.id || '';
                  
                  return (
                    <>
                      <Button
                        size="small"
                        variant={selectedUser === 'me' ? 'contained' : 'outlined'}
                        onClick={() => {
                          setSelectedUser('me');
                          const monthFilteredInner = filterByMonth(allResults, selectedMonth);
                          setResults(monthFilteredInner.filter(r => r.userId === currentUserId));
                        }}
                      >
                        내 데이터 ({filterByMonth(allResults, selectedMonth).filter(r => r.userId === currentUserId).length})
                      </Button>
                      {Object.entries(userCounts).filter(([name]) => name !== '(이름없음)').map(([name, count]) => (
                        <Button
                          key={name}
                          size="small"
                          variant={selectedUser === name ? 'contained' : 'outlined'}
                          onClick={() => {
                            setSelectedUser(name);
                            const monthFilteredInner = filterByMonth(allResults, selectedMonth);
                            setResults(monthFilteredInner.filter(r => (r.userName || '(이름없음)') === name));
                          }}
                        >
                          {name} ({filterByMonth(allResults, selectedMonth).filter(r => (r.userName || '(이름없음)') === name).length})
                        </Button>
                      ))}
                      <Button
                        size="small"
                        variant={selectedUser === 'all' ? 'contained' : 'outlined'}
                        onClick={() => {
                          setSelectedUser('all');
                          setResults(filterByMonth(allResults, selectedMonth));
                        }}
                      >
                        전체 ({filterByMonth(allResults, selectedMonth).length})
                      </Button>
                    </>
                  );
                })()}
              </Box>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>저장자</th>
                    <th style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>가입번호</th>
                    <th style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>고객명</th>
                    <th style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>기존 총액</th>
                    <th style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>투게더 총액</th>
                    <th style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>차액</th>
                    <th style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>상태</th>
                    <th style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>등록일시</th>
                  </tr>
                </thead>
                <tbody>
                  {(results || []).map(row => {
                    const statusColors = {
                      '성공': '#e3f2fd',
                      '실패': '#fce4ec',
                      '보류': '#f1f8e9',
                    };
                    const bgColor = selectedResultId === row.id 
                      ? '#fff3e0' 
                      : (statusColors[row.status] || 'transparent');
                    
                    return (
                      <tr
                        key={row.id}
                        onClick={() => handleRowClick(row)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: bgColor
                        }}
                      >
                        <td style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>{row.userName || '-'}</td>
                        <td style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>{row.subscriptionNumber || '-'}</td>
                        <td style={{ border: '1px solid #eee', padding: 6, textAlign: 'center', whiteSpace: 'pre-line' }}>
                          {(row.scenarioName || '-').replace(/, /g, '\n')}
                        </td>
                        <td style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>{Number(row.existingAmount || 0).toLocaleString()}</td>
                        <td style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>{Number(row.togetherAmount || 0).toLocaleString()}</td>
                        <td style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>{Number(row.diff || 0).toLocaleString()}</td>
                        <td style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <select
                            value={row.status || ''}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              try {
                                await api.updateObResult(row.id, { status: newStatus });
                                
                                // allResults 업데이트 (캐시)
                                const updatedAll = allResults.map(r => 
                                  r.id === row.id ? { ...r, status: newStatus } : r
                                );
                                setAllResults(updatedAll);
                                
                                // results도 업데이트
                                const updatedResults = results.map(r => 
                                  r.id === row.id ? { ...r, status: newStatus } : r
                                );
                                setResults(updatedResults);
                              } catch (err) {
                                setError(err.message);
                              }
                            }}
                            style={{ padding: 4, fontSize: 12, border: '1px solid #ccc', borderRadius: 4 }}
                          >
                            <option value="">-</option>
                            <option value="성공">성공</option>
                            <option value="실패">실패</option>
                            <option value="보류">보류</option>
                          </select>
                        </td>
                        <td style={{ border: '1px solid #eee', padding: 6, textAlign: 'center' }}>{row.createdAt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
  const handleSave = async (chosen) => {
    try {
      const userId = loggedInStore?.userId || loggedInStore?.name || loggedInStore?.id || '';
      
      if (!userId) {
        setError('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
        return;
      }
      
      // 고객명 목록 생성 (기존결합 또는 투게더결합 중 더 많은 쪽 사용)
      const existingLines = inputs.existingLines || [];
      const togetherLines = inputs.togetherLines || [];
      const lines = existingLines.length >= togetherLines.length ? existingLines : togetherLines;
      
      const customerNamesStr = lines
        .filter(l => l.customerName)
        .map(l => l.phone ? `${l.customerName}(${l.phone})` : l.customerName)
        .join(', ');
      
      const userName = loggedInStore?.name || loggedInStore?.userId || '';
      
      const payload = {
        userId,
        userName,
        scenarioName: customerNamesStr || `시나리오_${new Date().toLocaleString('ko-KR')}`,
        inputs: {
          ...inputs,
          subscriptionNumber // 가입번호 추가
        },
        existingAmount: existing.amount,
        togetherAmount: together.amount,
        diff,
        chosenType: chosen,
        notes: ''
      };
      
      let res;
      if (selectedResultId) {
        // Update existing
        res = await api.updateObResult(selectedResultId, payload);
      } else {
        // Create new
        res = await api.saveObResult(payload);
      }
      
      if (res?.success) {
        // 전체 데이터 다시 로드
        const listRes = await api.getObResults(userId, true);
        const allData = listRes.data || [];
        setAllResults(allData);
        
        // 월별 필터 적용
        const monthFiltered = filterByMonth(allData, selectedMonth);
        
        // 현재 선택된 사용자 필터로 재필터링
        if (selectedUser === 'me') {
          setResults(monthFiltered.filter(r => r.userId === userId));
        } else if (selectedUser === 'all') {
          setResults(monthFiltered);
        } else {
          setResults(monthFiltered.filter(r => (r.userName || '(이름없음)') === selectedUser));
        }
        
        setSelectedResultId(null);
        setSubscriptionNumber('');
      }
    } catch (e) {
      console.error('[OB] Save error:', e);
      setError(e.message);
    }
  };

  const handleRowClick = (row) => {
    try {
      const restored = JSON.parse(row.inputsJson || '{}');
      setInputs(restored.existingLines ? restored : initialInputs());
      setSubscriptionNumber(restored.subscriptionNumber || '');
      setSelectedResultId(row.id);
    } catch (e) {
      console.error('Failed to restore inputs:', e);
    }
  };

  // 로딩 상태
  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ backgroundColor: '#5E35B1' }}>
          <Toolbar>
            <PhoneIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              OB 관리 모드
            </Typography>
            
            {/* 업데이트 확인 버튼 */}
            <Button
              color="inherit"
              startIcon={<UpdateIcon />}
              onClick={() => setShowUpdatePopup(true)}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              업데이트 확인
            </Button>
            
            {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
            {onModeChange && availableModes && availableModes.length > 1 && (
              <Button
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={onModeChange}
                sx={{
                  ml: 2,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                모드 변경
              </Button>
            )}
            
            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={60} />
        </Box>
      </Box>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ backgroundColor: '#5E35B1' }}>
          <Toolbar>
            <PhoneIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              OB 관리 모드
            </Typography>
            
            {/* 업데이트 확인 버튼 */}
            <Button
              color="inherit"
              startIcon={<UpdateIcon />}
              onClick={() => setShowUpdatePopup(true)}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              업데이트 확인
            </Button>
            
            {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
            {onModeChange && availableModes && availableModes.length > 1 && (
              <Button
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={onModeChange}
                sx={{
                  ml: 2,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                모드 변경
              </Button>
            )}
            
            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Alert severity="error" sx={{ width: '50%' }}>
            <AlertTitle>오류</AlertTitle>
            {error}
          </Alert>
        </Box>
      </Box>
    );
  }

  // 메인 화면
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ backgroundColor: '#5E35B1' }}>
        <Toolbar>
          <PhoneIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ fontWeight: 600, mr: 3 }}>
            OB 관리 모드
          </Typography>
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              textColor="inherit"
              indicatorColor="secondary"
              variant="scrollable"
              scrollButtons="auto"
            >
              {allowedTabs.map((tab) => (
                <Tab key={tab.key} value={tab.key} label={tab.label} />
              ))}
            </Tabs>
          </Box>
          
          {/* 업데이트 확인 버튼 */}
          <Button
            color="inherit"
            startIcon={<UpdateIcon />}
            onClick={() => setShowUpdatePopup(true)}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.2)'
              }
            }}
          >
            업데이트 확인
          </Button>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={onModeChange}
              sx={{
                ml: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              모드 변경
            </Button>
          )}
          
          <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#f5f5f5' }}>
        {activeTab === TAB_KEYS.CALCULATOR && renderCalculatorSection()}
        {activeTab === TAB_KEYS.OVERVIEW && allowedTabKeys.includes(TAB_KEYS.OVERVIEW) && (
          <ObSettlementOverview sheetConfigs={sheetConfigs} />
        )}
        {activeTab === TAB_KEYS.MANAGEMENT && allowedTabKeys.includes(TAB_KEYS.MANAGEMENT) && (
          <ObSettlementManagementPanel
            sheetConfigs={sheetConfigs}
            storageSheetUrl={SHEET_CONFIG_DRIVE_URL}
            loading={sheetConfigsLoading}
            error={sheetConfigsError}
            onCreate={handleOpenSheetConfigModal}
            onEdit={handleEditSheetConfig}
            onDelete={handleDeleteSheetConfig}
            onDownloadTemplate={handleDownloadTemplate}
            currentUser={currentUserName}
          />
        )}
      </Box>

      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="obManagement"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          console.log('OB 관리모드 새 업데이트가 추가되었습니다.');
        }}
      />

      <ObSheetConfigModal
        open={sheetConfigModalOpen}
        initialValues={editingSheetConfig}
        onClose={handleCloseSheetConfigModal}
        onSubmit={handleSheetConfigSubmit}
      />

      <Snackbar
        open={sheetConfigMessage.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={sheetConfigMessage.severity} onClose={handleSnackbarClose} sx={{ width: '100%' }}>
          {sheetConfigMessage.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ObManagementMode;

