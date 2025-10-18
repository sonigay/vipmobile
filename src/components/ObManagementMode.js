import React, { useState, useEffect } from 'react';
import ExistingCalculatorPanel from './ob/ExistingCalculatorPanel';
import TogetherCalculatorPanel from './ob/TogetherCalculatorPanel';
import LineInputPanel from './ob/LineInputPanel';
import BundleOptionsPanel from './ob/BundleOptionsPanel';
import { api } from '../api';
import { initialInputs, useObCalculation } from '../utils/obCalculationEngine';
import {
  Box,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  Container,
  TextField
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Update as UpdateIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';

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
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

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
        const [plansRes, discountsRes, devSheetRes] = await Promise.all([
          api.getObPlanData(),
          api.getObDiscountData(),
          api.getObDevSheetData()
        ]);
        setPlanData(plansRes.data || []);
        setDiscountData(discountsRes.data || []);
        setSegDiscountData(devSheetRes.data?.segDiscount || []);
        
        // 개발용: 시트 분석 로그
        console.log('[OB DEV] Main Sheet:', devSheetRes.data?.mainSheet);
        console.log('[OB DEV] Seg Discount:', devSheetRes.data?.segDiscount);
        console.log('[OB DEV] Plan List:', devSheetRes.data?.planList);
        
        // 결과 목록은 전체 데이터 로드
        if (userId) {
          const listRes = await api.getObResults(userId, true); // 항상 전체 로드
          const allData = listRes.data || [];
          setAllResults(allData);
          // 초기에는 내 데이터만 표시
          setResults(allData.filter(r => r.userId === userId));
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

  const { existing, together, diff } = useObCalculation(inputs, planData, discountData, segDiscountData);

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
        
        // 현재 선택된 필터로 재필터링
        if (selectedUser === 'me') {
          setResults(allData.filter(r => r.userId === userId));
        } else if (selectedUser === 'all') {
          setResults(allData);
        } else {
          setResults(allData.filter(r => (r.userName || '(이름없음)') === selectedUser));
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

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#f5f5f5' }}>
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
              <Box sx={{ mb: 2, p: 2, backgroundColor: '#fffde7', borderRadius: 1, border: '1px solid #fdd835' }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>인터넷 옵션 (기존결합 & 투게더결합 공통)</Typography>
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
              <Box sx={{ mt: 2, p: 2, backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <Typography variant="body1">
                      [기존] <strong>{existing.amount?.toLocaleString()}원</strong>
                    </Typography>
                    <Typography variant="body1">
                      [투게더] <strong>{together.amount?.toLocaleString()}원</strong>
                    </Typography>
                    <Typography variant="body1" sx={{ color: diff < 0 ? '#d32f2f' : '#2e7d32' }}>
                      차액 <strong>{diff?.toLocaleString()}원</strong>
                    </Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    onClick={() => handleSave(diff < 0 ? 'together' : 'existing')}
                    size="large"
                  >
                    저장
                  </Button>
                </Box>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>가입번호별 리스트</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {(() => {
                      const userCounts = {};
                      (allResults || []).forEach(row => {
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
                              setResults(allResults.filter(r => r.userId === currentUserId));
                            }}
                          >
                            내 데이터 ({allResults.filter(r => r.userId === currentUserId).length})
                          </Button>
                          {Object.entries(userCounts).filter(([name]) => name !== '(이름없음)').map(([name, count]) => (
                            <Button
                              key={name}
                              size="small"
                              variant={selectedUser === name ? 'contained' : 'outlined'}
                              onClick={() => {
                                setSelectedUser(name);
                                setResults(allResults.filter(r => (r.userName || '(이름없음)') === name));
                              }}
                            >
                              {name} ({count})
                            </Button>
                          ))}
                          <Button
                            size="small"
                            variant={selectedUser === 'all' ? 'contained' : 'outlined'}
                            onClick={() => {
                              setSelectedUser('all');
                              setResults(allResults);
                            }}
                          >
                            전체 ({(allResults || []).length})
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
    </Box>
  );
};

export default ObManagementMode;

