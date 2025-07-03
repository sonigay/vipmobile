import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Button
} from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import CallIcon from '@mui/icons-material/Call';
import ChatIcon from '@mui/icons-material/Chat';
import SearchIcon from '@mui/icons-material/Search';
import { fetchAgentData } from '../api';

/**
 * 문자열에서 앞 N글자 추출하는 함수
 */
const getPrefix = (str, length = 3) => {
  if (!str) return '';
  // 앞 3글자만 추출 (공백 제거 없이 원본 그대로 사용)
  return str.toString().substring(0, length);
};

/**
 * 전화 연결 함수
 */
const handleCall = (phoneNumber) => {
  if (!phoneNumber) return;
  
  // 전화 연결 (모바일 디바이스에서 작동)
  window.location.href = `tel:${phoneNumber}`;
  
  console.log(`전화 연결: ${phoneNumber}`);
};

/**
 * 선택된 매장 정보를 표시하는 테이블 컴포넌트
 */
function StoreInfoTable({ selectedStore, requestedStore, agentTarget, agentContactId, onCallButtonClick, onKakaoTalkButtonClick, selectedModel, selectedColor, currentView }) {
  const [matchedContact, setMatchedContact] = useState(null);
  const [loading, setLoading] = useState(false);

  // 디버깅을 위한 로그 추가
  useEffect(() => {
    if (selectedStore) {
      console.log('선택된 매장 정보:', {
        이름: selectedStore.name,
        담당자: selectedStore.manager || '없음',
        담당자타입: typeof selectedStore.manager,
        담당자앞3글자: getPrefix(selectedStore.manager, 3)
      });
    }
  }, [selectedStore]);

  // 선택된 매장의 담당자와 일치하는 담당자 연락처 정보 불러오기
  useEffect(() => {
    const loadAgentData = async () => {
      if (!selectedStore?.manager) {
        console.log('담당자 정보가 없어 매칭 안함');
        return;
      }
      
      try {
        setLoading(true);
        const agents = await fetchAgentData();
        
        console.log('담당자 연락처 정보 로드됨:', agents.length);
        
        // 매칭 전에 모든 담당자 정보 확인 (디버깅)
        console.log('모든 담당자 연락처 정보:');
        agents.forEach((agent, index) => {
          console.log(`담당자 #${index + 1}:`, {
            담당자: agent.target,
            담당자앞3글자: getPrefix(agent.target, 3),
            자격: agent.qualification,
            연락처: agent.contactId,
            매칭여부: getPrefix(selectedStore.manager, 3) === getPrefix(agent.target, 3)
          });
        });
        
        // 정확히 앞 3글자만 비교하는 매칭 로직 (VLOOKUP 방식)
        const managerPrefix = getPrefix(selectedStore.manager, 3);
        
        // 매칭된 담당자 연락처 찾기
        const matched = agents.find(agent => {
          if (!agent.target) return false;
          
          const targetPrefix = getPrefix(agent.target, 3);
          const isExactMatch = targetPrefix === managerPrefix;
          
          if (isExactMatch) {
            console.log(`매칭 성공: ${targetPrefix} === ${managerPrefix}`);
            console.log(`- 담당자: ${selectedStore.manager} / 연락처 담당자: ${agent.target}`);
          }
          
          return isExactMatch;
        });
        
        if (matched) {
          console.log(`매칭된 담당자 연락처 발견: ${matched.target} (연락처: ${matched.contactId})`);
          setMatchedContact(matched.contactId);
        } else {
          console.log(`매칭된 담당자 연락처 없음 - 담당자 앞 3글자(${managerPrefix})와 일치하는 담당자가 없음`);
          setMatchedContact(null);
        }
      } catch (error) {
        console.error('담당자 연락처 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAgentData();
  }, [selectedStore]);

  /**
   * 전화 연결 함수 (로깅 추가)
   */
  const handleCall = (phoneNumber) => {
    if (!phoneNumber) return;
    
    // 전화 연결 (모바일 디바이스에서 작동)
    window.location.href = `tel:${phoneNumber}`;
    
    // 로깅 콜백 호출
    if (onCallButtonClick) {
      onCallButtonClick();
    }
    
    console.log(`전화 연결: ${phoneNumber}`);
  };

  /**
   * 카카오톡 보내기 함수
   */
  const handleKakaoTalk = (store, model, color) => {
    if (!store || !model || !color) {
      alert('모델과 색상을 모두 선택해주세요.');
      return;
    }

    let message;

    // 요청점이 선택된 경우
    if (requestedStore) {
      message = `📱 앱 전송 메시지
안녕하세요! ${store.name}에서
${model} / ${color} 모델
사용 가능한지 확인 부탁드립니다
"${requestedStore.name}"으로 이동 예정입니다.
감사합니다.`;
    } else {
      // 요청점이 선택되지 않은 경우
      message = `📱 앱 전송 메시지
안녕하세요! ${store.name}에서
${model} / ${color} 모델
사용 가능한지 확인 부탁드립니다
요청점이 확인되지 않아 어디로 이동할지는 별도로 말씀드리겠습니다.
감사합니다.`;
    }

    // 클립보드에 복사
    navigator.clipboard.writeText(message).then(() => {
      console.log('카카오톡 메시지가 클립보드에 복사되었습니다:', message);
      alert('카카오톡 문구가 복사되었습니다!\n\n담당자에게 @태그는 직접 추가해주세요!');
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
      alert('클립보드 복사에 실패했습니다.');
    });
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <StoreIcon sx={{ mr: 1 }} />
          선택된 업체 정보
        </Box>
        {currentView && (
          <Chip 
            label={currentView === 'all' ? '전체재고확인' : '담당재고확인'}
            size="small"
            color={currentView === 'all' ? 'primary' : 'secondary'}
            variant="outlined"
            sx={{ fontSize: '0.7em' }}
          />
        )}
      </Typography>

      {selectedStore ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell variant="head" width="30%">업체명</TableCell>
                <TableCell>{selectedStore.name}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell variant="head">담당자</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PersonIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                      <span style={{ fontWeight: 'medium' }}>
                        {selectedStore.manager || '미지정'}
                      </span>
                    </Box>
                    {loading ? (
                      <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                        연락처 조회 중...
                      </Typography>
                    ) : matchedContact ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
                        <Button 
                          variant="contained" 
                          color="primary" 
                          startIcon={<CallIcon />}
                          onClick={() => handleCall(matchedContact)}
                          size="small"
                          sx={{ borderRadius: '20px', minWidth: '100px' }}
                        >
                          전화걸기
                        </Button>
                        <Button 
                          variant="contained" 
                          sx={{ 
                            borderRadius: '20px', 
                            minWidth: '100px',
                            backgroundColor: '#FEE500',
                            color: '#3C1E1E',
                            fontWeight: 'bold',
                            fontSize: '0.7rem',
                            textTransform: 'none',
                            boxShadow: '0 2px 8px rgba(254, 229, 0, 0.3)',
                            '&:hover': {
                              backgroundColor: '#FDD835',
                              boxShadow: '0 4px 12px rgba(254, 229, 0, 0.4)'
                            },
                            '&:disabled': {
                              backgroundColor: '#F5F5F5',
                              color: '#999'
                            }
                          }}
                          startIcon={
                            <img 
                              src="/kakao-logo.png" 
                              alt="KakaoTalk" 
                              style={{ 
                                width: '18px', 
                                height: '18px',
                                marginRight: '4px'
                              }}
                            />
                          }
                          onClick={() => handleKakaoTalk(selectedStore, selectedModel, selectedColor)}
                          size="small"
                          disabled={!selectedModel || !selectedColor}
                          title={!selectedModel || !selectedColor ? '모델과 색상을 모두 선택해주세요' : '카카오톡 문구 생성'}
                        >
                          카톡문구생성
                        </Button>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ mt: 1, color: 'error.main' }}>
                        연락처를 찾을 수 없습니다
                      </Typography>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell variant="head">주소</TableCell>
                <TableCell>{selectedStore.address || '주소 정보 없음'}</TableCell>
              </TableRow>
              {requestedStore && (
                <TableRow>
                  <TableCell variant="head">요청점</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <SearchIcon sx={{ mr: 1, fontSize: '1.2rem', color: 'primary.main' }} />
                      <span style={{ fontWeight: 'medium', color: 'primary.main' }}>
                        {requestedStore.name}
                      </span>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          지도에서 업체를 선택하세요
        </Typography>
      )}
    </Paper>
  );
}

export default StoreInfoTable; 