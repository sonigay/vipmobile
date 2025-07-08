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
  Divider
} from '@mui/material';
import axios from 'axios';
import UpdateProgressPopup from './UpdateProgressPopup';
import { hasNewDeployment, performAutoLogout, shouldCheckForUpdates, setLastUpdateCheck } from '../utils/updateDetection';

function Login({ onLogin }) {
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState('');
  const [ipInfo, setIpInfo] = useState(null);
  const [userConsent, setUserConsent] = useState(false);
  const [showConsentForm, setShowConsentForm] = useState(false);
  const [storedIpInfo, setStoredIpInfo] = useState(null);
  const [showUpdateProgressPopup, setShowUpdateProgressPopup] = useState(false);

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
  const handleUpdateProgressPopupClose = () => {
    setShowUpdateProgressPopup(false);
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
            contactId: data.agentInfo.contactId
          });
        } else {
          // 일반 매장인 경우
          onLogin({
            ...data.storeInfo,
            isAgent: false
          });
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

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="매장 ID(P코드) 또는 관리자 ID"
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
          
          {/* 협력업체 푸터 섹션 */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.875rem' }}>
              협력업체
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 1,
              mb: 2,
              flexWrap: 'nowrap'
            }}>
              <Box sx={{ 
                width: '80px',
                height: '60px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fafafa'
              }}>
                <img 
                  src="/1.png" 
                  alt="LG유플러스(주)"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '80px',
                height: '60px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fafafa'
              }}>
                <img 
                  src="/2.png" 
                  alt="(주)엠제이통신"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '80px',
                height: '60px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fafafa'
              }}>
                <img 
                  src="/3.png" 
                  alt="(주)스마트폰면세점"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ 
                width: '80px',
                height: '60px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fafafa'
              }}>
                <img 
                  src="/4.png" 
                  alt="(주)본앤코리아"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 1,
              flexWrap: 'nowrap'
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', width: '80px', textAlign: 'center' }}>
                LG유플러스(주)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', width: '80px', textAlign: 'center' }}>
                (주)엠제이통신
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', width: '80px', textAlign: 'center' }}>
                (주)스마트폰면세점
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', width: '80px', textAlign: 'center' }}>
                (주)본앤코리아
              </Typography>
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
      <UpdateProgressPopup
        open={showUpdateProgressPopup}
        onClose={handleUpdateProgressPopupClose}
      />
    </Container>
  );
}

export default Login; 
