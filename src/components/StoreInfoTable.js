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
function StoreInfoTable({ selectedStore, agentTarget, agentContactId, onCallButtonClick, onKakaoTalkButtonClick, selectedModel, selectedColor }) {
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
  const handleKakaoTalk = (storeInfo, selectedModel, selectedColor) => {
    if (!storeInfo) return;
    
    const manager = storeInfo.manager || '담당자';
    const storeName = storeInfo.name;
    
    // 메시지 템플릿 구성
    const message = `📱 앱 전송 메시지\n${manager}님 안녕하세요!\n${storeName}에서 ${selectedModel} / ${selectedColor}\n사용 가능한지 확인 부탁드립니다. 감사합니다`;
    
    // 클립보드에 메시지 복사
    navigator.clipboard.writeText(message).then(() => {
      console.log('메시지가 클립보드에 복사되었습니다:', message);
      
      // 로깅 콜백 호출
      if (onKakaoTalkButtonClick) {
        onKakaoTalkButtonClick();
      }
      
      // 간단한 성공 알림
      console.log('카카오톡 문구가 클립보드에 복사되었습니다.');
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
      alert('클립보드 복사에 실패했습니다.');
    });
    
    console.log(`카카오톡 문구 생성: ${storeName} - ${selectedModel} / ${selectedColor}`);
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <StoreIcon sx={{ mr: 1 }} />
        선택된 업체 정보
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
                          sx={{ borderRadius: '20px' }}
                        >
                          전화걸기
                        </Button>
                        <Button 
                          variant="contained" 
                          color="warning" 
                          startIcon={<span style={{ fontSize: '1.2rem' }}>💬</span>}
                          onClick={() => handleKakaoTalk(selectedStore, selectedModel, selectedColor)}
                          size="small"
                          sx={{ borderRadius: '20px' }}
                          disabled={!selectedModel || !selectedColor}
                          title={!selectedModel || !selectedColor ? '모델과 색상을 모두 선택해주세요' : '카카오톡 문구 생성'}
                        >
                          카톡문구 생성
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