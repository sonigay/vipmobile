import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Alert,
  Collapse,
  Divider,
  Link
} from '@mui/material';
import axios from 'axios';



function Login({ onLogin }) {
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState('');
  const [ipInfo, setIpInfo] = useState(null);
  const [userConsent, setUserConsent] = useState(false);
  const [showConsentForm, setShowConsentForm] = useState(false);
  const [storedIpInfo, setStoredIpInfo] = useState(null);


  // 사용자 기기 정보 수집
  useEffect(() => {
    const collectDeviceInfo = () => {
      const userAgent = navigator.userAgent;
      const deviceType = /Mobi|Android/i.test(userAgent) ? 'Mobile' : 'Desktop';
      const browserInfo = getBrowserInfo(userAgent);
      const osInfo = getOSInfo(userAgent);
      const screenInfo = `${window.screen.width}x${window.screen.height}`;
      
      setDeviceInfo(`${deviceType}, ${osInfo}, ${browserInfo}, ${screenInfo}`);
    };
    
    collectDeviceInfo();
  }, []);

  // IP 정보 수집
  useEffect(() => {

    const fetchIPInfo = async () => {
      try {
        const response = await axios.get('https://ipapi.co/json/');
        const data = response.data;
        setIpInfo({
          ip: data.ip,
          city: data.city,
          region: data.region,
          country: data.country_name,
          location: `${data.city}, ${data.region}, ${data.country_name}`
        });
        
        // 저장된 동의 정보 확인
        const consentGiven = localStorage.getItem('userConsent');
        
        // 동의 정보가 없는 경우에만 동의 폼 표시 (IP 변경과 무관하게)
        if (!consentGiven) {
          setShowConsentForm(true);
          
          // 현재 IP 정보 저장 (향후 로깅용)
          localStorage.setItem('userIpInfo', JSON.stringify({
            ip: data.ip,
            timestamp: new Date().toISOString()
          }));
        } else {
          // 이미 동의한 경우 IP 정보만 업데이트
          localStorage.setItem('userIpInfo', JSON.stringify({
            ip: data.ip,
            timestamp: new Date().toISOString()
          }));
          setShowConsentForm(false);
          setUserConsent(true); // 이미 동의한 상태로 설정
        }
      } catch (error) {
        console.error('IP 정보 가져오기 실패:', error);
        setIpInfo({ ip: '알 수 없음', location: '알 수 없음' });
        
        // API 실패 시 저장된 동의 여부 확인
        const consentGiven = localStorage.getItem('userConsent');
        if (!consentGiven) {
          setShowConsentForm(true);
        } else {
          setShowConsentForm(false);
          setUserConsent(true);
        }
      }
    };
    
    fetchIPInfo();
  }, []);
  
  // 브라우저 정보 추출
  const getBrowserInfo = (userAgent) => {
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('SamsungBrowser')) return 'Samsung Browser';
    if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
    if (userAgent.includes('Edg')) return 'Edge';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    return 'Unknown Browser';
  };
  
  // OS 정보 추출
  const getOSInfo = (userAgent) => {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'MacOS';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    if (userAgent.includes('Linux')) return 'Linux';
    return 'Unknown OS';
  };



  // 업데이트 진행 팝업 닫기 핸들러


  // Chrome 브라우저 감지
  const isChrome = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('chrome') && !userAgent.includes('edg'); // Edge는 제외
  };

  // 확장 프로그램 설치 감지
  const isExtensionInstalled = () => {
    return window.VIP_AGENT_PROTECTION_ENABLED === true ||
           document.documentElement.getAttribute('data-vip-extension') === 'installed' ||
           document.querySelector('meta[name="vip-extension-installed"]') !== null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeId.trim()) {
      setError('매장 ID를 입력해주세요.');
      return;
    }
    
    if (showConsentForm && !userConsent) {
      setError('접속 정보 수집에 동의해 주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const API_URL = process.env.REACT_APP_API_URL;
      
      // 새로운 로그인 API를 사용하여 로그인
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          storeId,
          deviceInfo,
          ipAddress: ipInfo?.ip || '알 수 없음',
          location: ipInfo?.location || '알 수 없음'
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || '로그인에 실패했습니다.');
        return;
      }
      
      if (data.success) {
        // 정보 저장
        if (showConsentForm && userConsent) {
          // 사용자가 동의한 경우 동의 정보와 IP 정보 저장
          localStorage.setItem('userConsent', 'true');
          localStorage.setItem('userIpInfo', JSON.stringify({
            ip: ipInfo?.ip || '알 수 없음',
            timestamp: new Date().toISOString()
          }));
        }
        
        if (data.isAgent) {
          // 대리점 관리자인 경우
          onLogin({
            id: data.agentInfo.contactId,
            name: `${data.agentInfo.target} (${data.agentInfo.qualification})`,
            isAgent: true,
            target: data.agentInfo.target,
            qualification: data.agentInfo.qualification,
            contactId: data.agentInfo.contactId,
            userRole: data.agentInfo.userRole,
            modePermissions: data.modePermissions // 다중 권한 정보 추가
          });
        } else if (data.isInventory) {
          // 재고 관리자인 경우
          onLogin({
            ...data.storeInfo,
            isInventory: true,
            isAgent: false,
            isSettlement: false
          });
        } else if (data.isSettlement) {
          // 정산 관리자인 경우
          onLogin({
            ...data.storeInfo,
            isSettlement: true,
            isAgent: false,
            isInventory: false
          });
        } else {
          // 일반 매장인 경우 - Chrome 브라우저 및 확장 프로그램 체크
          
          // 1. Chrome 브라우저 체크
          if (!isChrome()) {
            setError('❌ Chrome 브라우저만 사용 가능합니다.\n\nChrome 다운로드: https://www.google.com/chrome/');
            setLoading(false);
            return;
          }
          
          // 2. 확장 프로그램 설치 체크 (0.5초 대기 후 체크)
          setTimeout(() => {
            if (!isExtensionInstalled()) {
              setError('❌ VIP 확장 프로그램이 설치되지 않았습니다!\n\n📥 설치 방법:\n1. 위의 "📥 2단계: VIP 확장 프로그램 다운로드" 버튼 클릭\n2. 다운로드한 ZIP 파일 압축 해제\n3. Chrome 확장 프로그램 설치 (chrome://extensions/)\n4. 페이지 새로고침(F5) 후 다시 로그인\n\n💡 자세한 설치 방법은 다운로드한 폴더의 INSTALL_GUIDE.md 파일을 확인하세요.');
              setLoading(false);
              return;
            }
            
            // 체크 통과 - 로그인 처리
            console.log('✅ Chrome 브라우저 및 확장 프로그램 확인 완료');
            onLogin({
              ...data.storeInfo,
              isAgent: false,
              isInventory: false,
              isSettlement: false
            });
            setLoading(false);
          }, 500);
        }
      } else {
        setError('존재하지 않는 ID입니다.');
      }
    } catch (error) {
      setError('서버 연결에 실패했습니다.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <img 
              src="/login.png" 
              alt="(주)브이아이피플러스"
              style={{ maxWidth: '150px', margin: '0 auto' }}
            />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 1, fontSize: '1.1rem', fontWeight: 500 }}>
              (주)브이아이피플러스
            </Typography>
          </Box>

          {showConsentForm && (
            <Collapse in={showConsentForm}>
              <Alert severity="info" sx={{ mb: 2 }}>
                서비스 이용을 위해 접속 정보 수집에 동의해 주세요.
              </Alert>
              <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2" paragraph>
                  수집하는 정보: 접속 IP 주소, 위치 정보, 사용 기기 정보, 검색 활동 내역
                </Typography>
                <Typography variant="body2" paragraph>
                  수집 목적: 서비스 이용 통계 및 개선, 고객 맞춤 서비스 제공
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={userConsent} 
                      onChange={(e) => setUserConsent(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="접속 정보 수집에 동의합니다"
                />
              </Box>
            </Collapse>
          )}

          {/* Chrome 및 확장 프로그램 안내 */}
          <Alert severity="warning" sx={{ mb: 2, bgcolor: '#fff3e0', border: '2px solid #ff9800' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#e65100' }}>
              ⚠️ 일반모드 사용자 필수 조건
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, color: '#663c00' }}>
              • <strong>Chrome 브라우저</strong> 사용 필수
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5, color: '#663c00' }}>
              • <strong>VIP 확장 프로그램</strong> 설치 필수
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
              <Button
                variant="outlined"
                size="small"
                href="https://www.google.com/chrome/"
                target="_blank"
                sx={{ 
                  borderColor: '#1976d2',
                  color: '#1976d2',
                  fontWeight: 600,
                  '&:hover': {
                    borderColor: '#1565c0',
                    bgcolor: '#e3f2fd'
                  }
                }}
              >
                🌐 1단계: Chrome 브라우저 다운로드
              </Button>
              
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  const API_URL = process.env.REACT_APP_API_URL;
                  window.open(`${API_URL}/api/download-chrome-extension`, '_blank');
                }}
                sx={{ 
                  bgcolor: '#667eea',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: '#5a67d8'
                  }
                }}
              >
                📥 2단계: VIP 확장 프로그램 다운로드
              </Button>
            </Box>
            
            <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#663c00' }}>
              💡 다운로드 후 압축 해제 → Chrome 확장 프로그램 설치 → 페이지 새로고침
            </Typography>
          </Alert>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="매장 ID(P코드) 또는 관리자 ID"
              type="password"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              margin="normal"
              error={!!error}
              helperText={error}
              disabled={loading}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              disabled={loading || (showConsentForm && !userConsent)}
            >
              {loading ? <CircularProgress size={24} /> : '로그인'}
            </Button>
          </form>
          
          <Divider sx={{ my: 3 }} />
          
          {/* PARTNERS 섹션 */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 2, 
                fontSize: '0.9rem', 
                fontWeight: 600, 
                color: '#374151',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              PARTNERS
            </Typography>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 1.5,
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              <Box sx={{ 
                width: '70px',
                height: '60px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <img 
                  src="/1.png" 
                  alt="LG유플러스"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '70px',
                height: '60px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <img 
                  src="/2.png" 
                  alt="엠제이통신"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '70px',
                height: '60px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <img 
                  src="/3.png" 
                  alt="스마트폰면세점"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '70px',
                height: '60px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <img 
                  src="/4.png" 
                  alt="본앤코리아"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '70px',
                height: '60px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <img 
                  src="/5.png" 
                  alt="폰다컴퍼니"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '70px',
                height: '60px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <img 
                  src="/6.jpg" 
                  alt="민텔레콤"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '70px',
                height: '60px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <img 
                  src="/7.jpg" 
                  alt="와룡"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '70px',
                height: '60px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <img 
                  src="/8.jpg" 
                  alt="정직폰"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '70px',
                height: '60px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <img 
                  src="/9.png" 
                  alt="킹콩폰"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
            </Box>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Box className="login-info" sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
              엘지유플러스 공식 대리점 (주)브이아이피플러스를 이용해 주셔서 진심으로 감사드립니다.
            서비스 이용에 만족하셨다면 주변에 많은 소개 부탁드리며, 담당 영업사원을 통해 말씀해 주시면 해당 매장에 신속하게 연락드려 더욱 빠르고 친절하게 영업 지원해 드리겠습니다.
            </Typography>
          </Box>
        </Paper>
      </Box>
      
      {/* 업데이트 진행 팝업 */}
      
    </Container>
  );
}

export default Login; 
