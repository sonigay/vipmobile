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
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
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
  const [password, setPassword] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [tempLoginData, setTempLoginData] = useState(null); // 임시 로그인 데이터 저장
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const MAX_PASSWORD_ATTEMPTS = 5;


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


  // Chrome/Edge 브라우저 감지 (Chromium 기반)
  const isChrome = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('chrome') || userAgent.includes('edg'); // Chrome 또는 Edge
  };

  // 확장 프로그램 설치 감지
  const isExtensionInstalled = () => {
    return window.VIP_AGENT_PROTECTION_ENABLED === true ||
           document.documentElement.getAttribute('data-vip-extension') === 'installed' ||
           document.querySelector('meta[name="vip-extension-installed"]') !== null;
  };

  // 확장 프로그램 버전 가져오기
  const getExtensionVersion = () => {
    return window.VIP_EXTENSION_VERSION || 
           document.documentElement.getAttribute('data-vip-extension-version') ||
           null;
  };

  // 버전 비교 (semver 간단 비교)
  const isVersionValid = (current, required) => {
    if (!current) return false;
    
    const parseVersion = (v) => v.split('.').map(Number);
    const [cMajor, cMinor, cPatch] = parseVersion(current);
    const [rMajor, rMinor, rPatch] = parseVersion(required);
    
    if (cMajor > rMajor) return true;
    if (cMajor < rMajor) return false;
    if (cMinor > rMinor) return true;
    if (cMinor < rMinor) return false;
    return cPatch >= rPatch;
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
        // 대리점 아이디인 경우 패스워드 검증 필요 여부 확인
        if (data.isAgent) {
          const agentInfo = data.agentInfo;
          
          console.log('🔍 [패스워드 디버깅] agentInfo:', agentInfo);
          console.log('🔍 [패스워드 디버깅] passwordNotUsed:', agentInfo.passwordNotUsed);
          console.log('🔍 [패스워드 디버깅] hasPassword:', agentInfo.hasPassword);
          
          // 패스워드 필요 여부 확인
          const needPassword = !agentInfo.passwordNotUsed && agentInfo.hasPassword;
          console.log('🔍 [패스워드 디버깅] needPassword:', needPassword);
          
          if (needPassword) {
            // 패스워드 입력 모달 표시
            console.log('🔐 패스워드 입력 필요');
            setTempLoginData(data); // 로그인 데이터 임시 저장
            setShowPasswordInput(true);
            setLoading(false);
            return;
          } else {
            console.log('✅ 패스워드 입력 불필요 - 바로 로그인');
          }
        }
        
        // 패스워드가 필요 없거나 일반 매장인 경우 바로 로그인 처리
        proceedLogin(data);
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      if (!showPasswordInput) {
        setLoading(false);
      }
    }
  };

  // 로그인 처리 함수 분리
  const proceedLogin = (data) => {
    // 정보 저장
    if (showConsentForm && userConsent) {
      localStorage.setItem('userConsent', 'true');
      localStorage.setItem('userIpInfo', JSON.stringify({
        ip: ipInfo?.ip || '알 수 없음',
        timestamp: new Date().toISOString()
      }));
    }
    
    if (data.isAgent) {
      // 대리점 관리자 로그인
      onLogin({
        id: data.agentInfo.contactId,
        name: `${data.agentInfo.target} (${data.agentInfo.qualification})`,
        isAgent: true,
        target: data.agentInfo.target,
        qualification: data.agentInfo.qualification,
        contactId: data.agentInfo.contactId,
        userRole: data.agentInfo.userRole,
        modePermissions: data.modePermissions
      });
    } else if (data.isInventory) {
      // 재고 관리자 로그인
      onLogin({
        ...data.storeInfo,
        isInventory: true,
        isAgent: false,
        isSettlement: false
      });
    } else if (data.isSettlement) {
      // 정산 관리자 로그인
      onLogin({
        ...data.storeInfo,
        isSettlement: true,
        isAgent: false,
        isInventory: false
      });
    } else {
      // 일반 매장 로그인 (Chrome 체크 등 기존 로직)
      // 1. Chrome/Edge 브라우저 체크
      if (!isChrome()) {
        setError('❌ Chrome 또는 Edge 브라우저만 사용 가능합니다.\n\nChrome 다운로드: https://www.google.com/chrome/\nEdge 다운로드: https://www.microsoft.com/edge');
        setLoading(false);
        return;
      }
      
      // 2. 확장 프로그램 설치 및 버전 체크 (0.5초 대기 후 체크)
      setTimeout(async () => {
        if (!isExtensionInstalled()) {
          setError('❌ VIP 확장프로그램이 설치되지 않았습니다!\n\n📥 설치 방법:\n1. 페이지 Ctrl+F5 (새로고침)\n2. "📥 VIP 확장 프로그램 다운로드" 버튼 클릭\n3. ZIP 파일 압축 해제\n4. 브라우저 주소창에 입력:\n   • Chrome: chrome://extensions/\n   • Edge: edge://extensions/\n5. 개발자 모드 켜기 → 압축 해제한 폴더 로드\n6. 페이지 Ctrl+F5 (새로고침) 후 로그인\n\n💡 설치가이드.html 파일 참고');
          setLoading(false);
          return;
        }
        
        // 3. 버전 체크
        try {
          const API_URL = process.env.REACT_APP_API_URL;
          const versionResponse = await fetch(`${API_URL}/api/extension-version`);
          const versionData = await versionResponse.json();
          
          if (versionData.success) {
            const currentVersion = getExtensionVersion();
            const requiredVersion = versionData.requiredVersion;
            
            if (!isVersionValid(currentVersion, requiredVersion)) {
              setError(`❌ 버전이 변경되었습니다. 재설치가 필요합니다.\n\n현재 버전: ${currentVersion || '알 수 없음'}\n최신 버전: ${requiredVersion}\n\n📥 재설치 방법:\n1. 페이지 Ctrl+F5 (새로고침)\n2. "📥 VIP 확장 프로그램 다운로드" 버튼 클릭\n3. ZIP 파일 압축 해제\n4. 브라우저 주소창에 입력:\n   • Chrome: chrome://extensions/\n   • Edge: edge://extensions/\n5. 기존 확장 제거 → 개발자 모드 켜기 → 새 폴더 로드\n6. 페이지 Ctrl+F5 (새로고침) 후 로그인`);
              setLoading(false);
              return;
            }
          }
        } catch (versionError) {
          console.error('버전 체크 오류:', versionError);
        }
        
        // 4. 모든 체크 통과 시 로그인 처리
        onLogin({
          ...data.storeInfo,
          isAgent: false,
          isInventory: false,
          isSettlement: false
        });
      }, 500);
    }
  };

  // 패스워드 검증 함수
  const handlePasswordVerify = async () => {
    if (!password.trim()) {
      setError('패스워드를 입력해주세요.');
      return;
    }
    
    // 시도 횟수 확인
    if (passwordAttempts >= MAX_PASSWORD_ATTEMPTS) {
      setError('패스워드 입력 횟수를 초과했습니다. 관리자에게 문의하세요.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const API_URL = process.env.REACT_APP_API_URL;
      
      // 패스워드 검증 API 호출
      const response = await fetch(`${API_URL}/api/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          storeId,
          password
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.verified) {
        // 패스워드 검증 성공 - 로그인 처리
        console.log('✅ 패스워드 검증 성공');
        setShowPasswordInput(false);
        setPasswordAttempts(0); // 성공 시 카운터 초기화
        proceedLogin(tempLoginData);
      } else {
        // 패스워드 불일치 - 시도 횟수 증가
        const newAttempts = passwordAttempts + 1;
        setPasswordAttempts(newAttempts);
        
        if (newAttempts >= MAX_PASSWORD_ATTEMPTS) {
          setError('패스워드 입력 횟수를 초과했습니다. 관리자에게 문의하세요.');
        } else {
          setError(`패스워드가 일치하지 않습니다. (${newAttempts}/${MAX_PASSWORD_ATTEMPTS})`);
        }
        
        setPassword('');
      }
    } catch (error) {
      console.error('패스워드 검증 오류:', error);
      setError('패스워드 검증 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 패스워드 모달 닫을 때 카운터 초기화
  const handleClosePasswordModal = () => {
    setShowPasswordInput(false);
    setPassword('');
    setPasswordAttempts(0); // 카운터 초기화
    setTempLoginData(null);
    setLoading(false);
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

          {/* 확장 프로그램 안내 */}
          <Alert severity="warning" sx={{ mb: 2, bgcolor: '#fff3e0', border: '2px solid #ff9800' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#e65100' }}>
              ⚠️ 매장 사용자 필수 조건
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5, color: '#663c00' }}>
              • <strong>VIP 확장 프로그램</strong> 설치 필수
            </Typography>
            
            <Button
              variant="contained"
              fullWidth
              size="small"
              onClick={() => {
                const API_URL = process.env.REACT_APP_API_URL;
                window.open(`${API_URL}/api/download-chrome-extension`, '_blank');
              }}
              sx={{ 
                bgcolor: '#667eea',
                fontWeight: 600,
                mb: 1.5,
                '&:hover': {
                  bgcolor: '#5a67d8'
                }
              }}
            >
              📥 VIP 확장 프로그램 다운로드
            </Button>
            
            <Typography variant="caption" sx={{ display: 'block', color: '#663c00', lineHeight: 1.5 }}>
              <strong>설치 방법:</strong><br/>
              1. 페이지 Ctrl+F5 (새로고침)<br/>
              2. "📥 VIP 확장 프로그램 다운로드" 버튼 클릭<br/>
              3. 압축 해제<br/>
              4. 브라우저 주소창에 <code style={{ bgcolor: '#fff', padding: '2px 4px', borderRadius: '3px' }}>chrome://extensions/</code> 또는 <code style={{ bgcolor: '#fff', padding: '2px 4px', borderRadius: '3px' }}>edge://extensions/</code> 입력<br/>
              5. 개발자 모드 켜기 → 압축 해제한 폴더 로드<br/>
              6. 페이지 Ctrl+F5 (새로고침) 후 로그인
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
      
      {/* 패스워드 입력 모달 */}
      {showPasswordInput && (
        <Dialog 
          open={showPasswordInput}
          onClose={handleClosePasswordModal}
        >
          <DialogTitle>패스워드 입력</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                type="password"
                label="패스워드"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordVerify();
                  }
                }}
                fullWidth
                autoFocus
                error={!!error}
                helperText={error}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={handleClosePasswordModal}
            >
              취소
            </Button>
            <Button 
              onClick={handlePasswordVerify}
              variant="contained"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : '확인'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      
      {/* 업데이트 진행 팝업 */}
      
    </Container>
  );
}

export default Login; 
