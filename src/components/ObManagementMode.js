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
  Container
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
  const [results, setResults] = useState([]);
  const [scenarioName, setScenarioName] = useState('');
  const [selectedResultId, setSelectedResultId] = useState(null);
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
        
        // 결과 목록은 userId가 있을 때만 로드
        if (userId) {
          const listRes = await api.getObResults(userId);
          setResults(listRes.data || []);
        } else {
          console.warn('[OB] No userId found, skipping results load');
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

  const handleSave = async (chosen) => {
    try {
      const userId = loggedInStore?.userId || loggedInStore?.name || loggedInStore?.id || '';
      
      if (!userId) {
        setError('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
        return;
      }
      
      const payload = {
        userId,
        scenarioName: scenarioName || `시나리오_${new Date().toLocaleString('ko-KR')}`,
        inputs,
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
        const listRes = await api.getObResults(userId);
        setResults(listRes.data || []);
        setScenarioName('');
        setSelectedResultId(null);
      }
    } catch (e) {
      console.error('[OB] Save error:', e);
      setError(e.message);
    }
  };

  const handleRowClick = (row) => {
    try {
      const restored = JSON.parse(row.inputsJson || '{}');
      setInputs(restored.lines ? restored : initialInputs());
      setScenarioName(row.scenarioName || '');
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
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ minWidth: 80 }}>시나리오명:</Typography>
                <input
                  type="text"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="시나리오명 입력 (선택)"
                  style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: 4 }}
                />
                {selectedResultId && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setInputs(initialInputs());
                      setScenarioName('');
                      setSelectedResultId(null);
                    }}
                  >
                    신규 작성
                  </Button>
                )}
              </Box>
              <BundleOptionsPanel inputs={inputs} onChange={setInputs} />
              <LineInputPanel inputs={inputs} onChange={setInputs} planData={planData} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <ExistingCalculatorPanel inputs={inputs} result={existing} onSave={() => handleSave('existing')} />
                <TogetherCalculatorPanel inputs={inputs} result={together} onSave={() => handleSave('together')} />
              </Box>
              <Box sx={{ mt: 2, p: 1, backgroundColor: '#fff', border: '1px solid #eee', borderRadius: 1, display: 'flex', justifyContent: 'space-between' }}>
                <Typography>[기존] {existing.amount?.toLocaleString()}</Typography>
                <Typography>[투게더] {together.amount?.toLocaleString()} | 차액 {diff?.toLocaleString()}</Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>저장된 시나리오</Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ border: '1px solid #eee', padding: 6 }}>scenario</th>
                        <th style={{ border: '1px solid #eee', padding: 6 }}>existing total</th>
                        <th style={{ border: '1px solid #eee', padding: 6 }}>together total</th>
                        <th style={{ border: '1px solid #eee', padding: 6 }}>diff</th>
                        <th style={{ border: '1px solid #eee', padding: 6 }}>createdAt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(results || []).map(row => (
                        <tr
                          key={row.id}
                          onClick={() => handleRowClick(row)}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: selectedResultId === row.id ? '#e3f2fd' : 'transparent'
                          }}
                        >
                          <td style={{ border: '1px solid #eee', padding: 6 }}>{row.scenarioName || '-'}</td>
                          <td style={{ border: '1px solid #eee', padding: 6 }}>{Number(row.existingAmount || 0).toLocaleString()}</td>
                          <td style={{ border: '1px solid #eee', padding: 6 }}>{Number(row.togetherAmount || 0).toLocaleString()}</td>
                          <td style={{ border: '1px solid #eee', padding: 6 }}>{Number(row.diff || 0).toLocaleString()}</td>
                          <td style={{ border: '1px solid #eee', padding: 6 }}>{row.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Container>
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

