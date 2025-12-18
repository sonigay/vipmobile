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
  DialogActions,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';



function Login({ onLogin }) {
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState('');
  const [ipInfo, setIpInfo] = useState(null);
  const [userConsent, setUserConsent] = useState(false);
  const [showConsentForm, setShowConsentForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [tempLoginData, setTempLoginData] = useState(null); // 임시 로그인 데이터 저장
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const MAX_PASSWORD_ATTEMPTS = 5;
  const [loginType, setLoginType] = useState('업체'); // '업체' 또는 '맴버'


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

  // IP 정보 수집 (에러 발생 시 조용히 처리, 로그인 프로세스에 영향 없음)
  useEffect(() => {
    const fetchIPInfo = async () => {
      try {
        // 타임아웃 설정 (10초)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('IP 정보 요청 시간 초과')), 10000)
        );
        
        // IP 정보 요청 (타임아웃과 경쟁)
        const ipRequest = axios.get('https://ipapi.co/json/', {
          timeout: 10000, // 10초 타임아웃
          validateStatus: (status) => status >= 200 && status < 300 // 2xx만 성공으로 처리
        });
        
        const response = await Promise.race([ipRequest, timeoutPromise]);
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
        // IP 정보는 선택적 기능이므로 에러를 조용히 처리
        // 개발 환경에서만 로그 출력
        if (process.env.NODE_ENV === 'development') {
          const errorType = error.message?.includes('CORS') || error.code === 'ERR_NETWORK' 
            ? 'CORS/네트워크 에러' 
            : error.message?.includes('시간 초과') || error.name === 'TimeoutError'
            ? '타임아웃'
            : '기타 에러';
          console.warn(`⚠️ [Login] IP 정보 가져오기 실패 (무시됨, 로그인 진행 가능): ${errorType}`, error.message);
        }
        
        // 기본값 설정 (에러가 발생해도 로그인 가능)
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
    if (userAgent.includes('Whale')) return 'Whale';
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


  // Chrome/Edge/Whale 브라우저 감지 (Chromium 기반)
  const isSupportedBrowser = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('chrome') || 
           userAgent.includes('edg') || 
           userAgent.includes('whale'); // Chrome, Edge 또는 Whale
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
          console.log('🔍 [패스워드 디버깅] isPasswordEmpty:', agentInfo.isPasswordEmpty);
          
          // 패스워드 설정이 필요한 경우 (D열과 E열이 모두 비어있음)
          if (agentInfo.isPasswordEmpty) {
            console.log('🔐 패스워드 설정 필요');
            setTempLoginData(data);
            setShowPasswordSetup(true);
            setLoading(false);
            return;
          }
          
          // 패스워드 검증이 필요한 경우
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
        obManagementRole: data.agentInfo.obManagementRole,
        meetingRole: data.agentInfo.meetingRole, // 회의 모드 권한 추가
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
      // 1. Chrome/Edge/Whale 브라우저 체크
      if (!isSupportedBrowser()) {
        setError('❌ Chrome, Edge 또는 Whale 브라우저만 사용 가능합니다.\n\nChrome 다운로드: https://www.google.com/chrome/\nEdge 다운로드: https://www.microsoft.com/edge\nWhale 다운로드: https://whale.naver.com/');
        setLoading(false);
        return;
      }
      
      // 2. 확장 프로그램 설치 및 버전 체크 (0.5초 대기 후 체크)
      setTimeout(async () => {
        if (!isExtensionInstalled()) {
          setError('❌ VIP 확장프로그램이 설치되지 않았습니다!\n\n📥 설치 방법:\n1. 페이지 Ctrl+F5 (새로고침)\n2. "📥 VIP 확장 프로그램 다운로드" 버튼 클릭\n3. ZIP 파일 압축 해제\n4. 브라우저 주소창에 입력:\n   • Chrome: chrome://extensions/\n   • Edge: edge://extensions/\n   • Whale: whale://extensions/\n5. 개발자 모드 켜기 → 압축 해제한 폴더 로드\n6. 페이지 Ctrl+F5 (새로고침) 후 로그인\n\n💡 설치가이드.html 파일 참고');
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
              setError(`❌ 버전이 변경되었습니다. 재설치가 필요합니다.\n\n현재 버전: ${currentVersion || '알 수 없음'}\n최신 버전: ${requiredVersion}\n\n📥 재설치 방법:\n1. 페이지 Ctrl+F5 (새로고침)\n2. "📥 VIP 확장 프로그램 다운로드" 버튼 클릭\n3. ZIP 파일 압축 해제\n4. 브라우저 주소창에 입력:\n   • Chrome: chrome://extensions/\n   • Edge: edge://extensions/\n   • Whale: whale://extensions/\n5. 기존 확장 제거 → 개발자 모드 켜기 → 새 폴더 로드\n6. 페이지 Ctrl+F5 (새로고침) 후 로그인`);
              setLoading(false);
              return;
            }
          }
        } catch (versionError) {
          console.error('버전 체크 오류:', versionError);
        }
        
        // 4. 모든 체크 통과 시 로그인 처리
        console.log('🔍 [Login] 일반 매장 로그인 - data.storeInfo:', data.storeInfo);
        console.log('🔍 [Login] 일반 매장 로그인 - data.storeInfo.userRole:', data.storeInfo?.userRole);
        console.log('🔍 [Login] 일반 매장 로그인 - data.modePermissions:', data.modePermissions);
        onLogin({
          ...data.storeInfo,
          userRole: data.storeInfo?.userRole, // userRole 명시적으로 전달
          modePermissions: data.modePermissions || data.storeInfo?.modePermissions, // modePermissions 명시적으로 전달
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

  // 패스워드 설정 함수
  const handlePasswordSetup = async (usePassword) => {
    if (usePassword === true) {
      if (!password.trim() || !confirmPassword.trim()) {
        setError('패스워드와 확인 패스워드를 입력해주세요.');
        return;
      }
      
      if (password !== confirmPassword) {
        setError('패스워드가 일치하지 않습니다.');
        return;
      }
      
      if (password.length < 4) {
        setError('패스워드는 최소 4자 이상이어야 합니다.');
        return;
      }
    }
    
    setLoading(true);
    setError('');
    
    try {
      const API_URL = process.env.REACT_APP_API_URL;
      
      // 패스워드 설정 API 호출
      const response = await fetch(`${API_URL}/api/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          storeId,
          password: usePassword ? password : '',
          confirmPassword: usePassword ? confirmPassword : '',
          usePassword
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ 패스워드 설정 성공');
        setShowPasswordSetup(false);
        setPassword('');
        setConfirmPassword('');
        
        if (usePassword) {
          // 패스워드 설정 후 바로 패스워드 입력 모달 표시
          setShowPasswordInput(true);
        } else {
          // 패스워드 미사용 설정 후 바로 로그인
          proceedLogin(tempLoginData);
        }
      } else {
        setError(result.error || '패스워드 설정에 실패했습니다.');
      }
    } catch (error) {
      console.error('패스워드 설정 오류:', error);
      setError('패스워드 설정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 패스워드 설정 모달 닫기
  const handleClosePasswordSetup = () => {
    setShowPasswordSetup(false);
    setPassword('');
    setConfirmPassword('');
    setTempLoginData(null);
    setLoading(false);
  };

  // 패스워드 입력 모달 닫기
  const handleClosePasswordModal = () => {
    setShowPasswordInput(false);
    setPassword('');
    setPasswordAttempts(0); // 카운터 초기화
    setTempLoginData(null);
    setLoading(false);
  };

  return (
    <>
      {/* 업체/맴버 토글 - 전체 화면 기준 상단 오른쪽 (Container 밖) */}
      <Box sx={{ 
        position: 'fixed', 
        top: 16, 
        right: 16, 
        zIndex: 1000
      }}>
        <ToggleButtonGroup
          value={loginType}
          exclusive
          onChange={(e, newValue) => {
            if (newValue !== null) {
              setLoginType(newValue);
              setError(''); // 토글 변경 시 에러 초기화
              if (newValue === '맴버') {
                // 맴버 선택 시 고객모드로 이동
                navigate('/member');
              }
            }
          }}
          aria-label="로그인 타입 선택"
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              px: 2,
              py: 0.5,
              fontWeight: 600,
              fontSize: '0.85rem',
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.dark',
                }
              }
            }
          }}
        >
          <ToggleButton value="업체" aria-label="업체 로그인">
            업체
          </ToggleButton>
          <ToggleButton value="맴버" aria-label="맴버 로그인">
            맴버
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

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
              4. 브라우저 주소창에 <code style={{ bgcolor: '#fff', padding: '2px 4px', borderRadius: '3px' }}>chrome://extensions/</code>, <code style={{ bgcolor: '#fff', padding: '2px 4px', borderRadius: '3px' }}>edge://extensions/</code> 또는 <code style={{ bgcolor: '#fff', padding: '2px 4px', borderRadius: '3px' }}>whale://extensions/</code> 입력<br/>
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
              disabled={loading || loginType === '맴버'}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              disabled={loading || (showConsentForm && !userConsent) || loginType === '맴버'}
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
      
      {/* 패스워드 설정 모달 */}
      {showPasswordSetup && (
        <Dialog 
          open={showPasswordSetup}
          onClose={handleClosePasswordSetup}
        >
          <DialogTitle>패스워드 설정</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Typography variant="body1" sx={{ mb: 3 }}>
                패스워드를 사용하시겠습니까?
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => handlePasswordSetup(false)}
                  disabled={loading}
                  sx={{ flex: 1 }}
                >
                  패스워드 미사용
                </Button>
                <Button 
                  variant="contained" 
                  onClick={() => setRequirePassword(true)}
                  disabled={loading}
                  sx={{ flex: 1 }}
                >
                  패스워드 사용
                </Button>
              </Box>
              
              {requirePassword && (
                <Box>
                  <TextField
                    type="password"
                    label="패스워드"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    sx={{ mb: 2 }}
                    error={!!error}
                  />
                  <TextField
                    type="password"
                    label="패스워드 확인"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    fullWidth
                    sx={{ mb: 2 }}
                    error={!!error}
                    helperText={error}
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button 
                      variant="outlined" 
                      onClick={() => {
                        setRequirePassword(false);
                        setPassword('');
                        setConfirmPassword('');
                        setError('');
                      }}
                      disabled={loading}
                    >
                      취소
                    </Button>
                    <Button 
                      variant="contained" 
                      onClick={() => handlePasswordSetup(true)}
                      disabled={loading}
                    >
                      {loading ? <CircularProgress size={24} /> : '설정 완료'}
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          </DialogContent>
        </Dialog>
      )}
      
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
    </>
  );
}

export default Login; 
