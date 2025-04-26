import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import StoreIcon from '@mui/icons-material/Store';
import PersonIcon from '@mui/icons-material/Person';
import { fetchAgentData } from '../api';

/**
 * 문자열을 정리하는 함수 (공백 제거, 소문자 변환)
 */
const cleanString = (str) => {
  if (!str) return '';
  return str.toString().trim().toLowerCase();
};

/**
 * 문자열에서 앞 N글자 추출하는 함수 (공백 제거 및 정리 포함)
 */
const getPrefix = (str, length = 3) => {
  const cleaned = cleanString(str);
  return cleaned.substring(0, length);
};

/**
 * 선택된 매장 정보를 표시하는 테이블 컴포넌트
 */
function StoreInfoTable({ selectedStore, agentTarget, agentContactId }) {
  const [matchedAgent, setMatchedAgent] = useState(null);
  const [loading, setLoading] = useState(false);

  // 디버깅을 위한 로그 추가
  useEffect(() => {
    if (selectedStore) {
      console.log('선택된 매장 정보:', {
        이름: selectedStore.name,
        담당자: selectedStore.manager || '없음',
        담당자타입: typeof selectedStore.manager,
        담당자길이: selectedStore.manager ? selectedStore.manager.length : 0,
        담당자정리후: cleanString(selectedStore.manager),
        담당자정리후길이: cleanString(selectedStore.manager).length,
        담당자2글자: getPrefix(selectedStore.manager, 2),
        담당자3글자: getPrefix(selectedStore.manager, 3)
      });
    }
  }, [selectedStore]);

  // 선택된 매장의 담당자와 일치하는 대리점 정보 불러오기
  useEffect(() => {
    const loadAgentData = async () => {
      if (!selectedStore?.manager) {
        console.log('담당자 정보가 없어 매칭 안함');
        return;
      }
      
      try {
        setLoading(true);
        const agents = await fetchAgentData();
        
        console.log('대리점 정보 로드됨:', agents.length);
        
        // 매칭 전에 모든 대리점 정보 확인 (디버깅)
        console.log('모든 대리점 정보:');
        agents.forEach((agent, index) => {
          // 더 자세한 디버깅을 위해 각 항목별로 출력
          console.log(`대리점 #${index + 1}:`, {
            대상: agent.target,
            대상정리후: cleanString(agent.target),
            대상3글자: getPrefix(agent.target, 3),
            자격: agent.qualification,
            연락처: agent.contactId,
            매칭여부담당자3글자: getPrefix(selectedStore.manager, 3) === getPrefix(agent.target, 3)
          });
        });
        
        // 매칭 로직 개선 - 다양한 매칭 방법 시도
        let matched = null;
        
        // 0. 정리 후 완전히 일치하는지 확인 (정확한 매칭)
        matched = agents.find(agent => {
          if (!agent.target || !selectedStore.manager) return false;
          
          // 공백 제거 후 완전 일치 확인
          const cleanedTarget = cleanString(agent.target);
          const cleanedManager = cleanString(selectedStore.manager);
          
          const isExactFullMatch = cleanedTarget === cleanedManager;
          
          if (isExactFullMatch) {
            console.log(`[완전 매칭] 성공: "${cleanedTarget}" === "${cleanedManager}"`);
          }
          
          return isExactFullMatch;
        });
        
        // 1. 정리 후 담당자와 대리점 대상의 앞 3글자 정확히 일치하는지 확인
        if (!matched) {
          matched = agents.find(agent => {
            if (!agent.target || !selectedStore.manager) return false;
            
            // 앞 3글자 비교 (정확히 일치) - 공백 제거 후
            const targetPrefix = getPrefix(agent.target, 3);
            const managerPrefix = getPrefix(selectedStore.manager, 3);
            
            const isExactMatch = targetPrefix === managerPrefix;
            
            if (isExactMatch) {
              console.log(`[정확 매칭] 성공: "${targetPrefix}" === "${managerPrefix}"`);
              console.log(`- 원본 값: "${agent.target}" ↔ "${selectedStore.manager}"`);
            }
            
            return isExactMatch;
          });
        }
        
        // 2. 앞 2글자라도 일치하는지 확인
        if (!matched) {
          matched = agents.find(agent => {
            if (!agent.target || !selectedStore.manager) return false;
            
            // 앞 2글자 비교 (정확히 일치) - 공백 제거 후
            const targetPrefix = getPrefix(agent.target, 2);
            const managerPrefix = getPrefix(selectedStore.manager, 2);
            
            const isExactMatch = targetPrefix === managerPrefix;
            
            if (isExactMatch) {
              console.log(`[2글자 매칭] 성공: "${targetPrefix}" === "${managerPrefix}"`);
              console.log(`- 원본 값: "${agent.target}" ↔ "${selectedStore.manager}"`);
            }
            
            return isExactMatch && targetPrefix.length >= 2; // 2글자 이상인 경우만
          });
        }
        
        // 3. 정확한 매칭이 없으면 포함 관계 확인
        if (!matched) {
          matched = agents.find(agent => {
            if (!agent.target || !selectedStore.manager) return false;
            
            // 공백 제거 후 담당자 이름이 대리점 대상에 포함되는지 확인
            const cleanedTarget = cleanString(agent.target);
            const cleanedManager = cleanString(selectedStore.manager);
            
            const isIncluded = cleanedTarget.includes(cleanedManager) || 
                               cleanedManager.includes(cleanedTarget);
            
            if (isIncluded) {
              console.log(`[포함 매칭] 성공: "${cleanedTarget}" ↔ "${cleanedManager}"`);
              console.log(`- 원본 값: "${agent.target}" ↔ "${selectedStore.manager}"`);
            }
            
            return isIncluded;
          });
        }
        
        // 4. 그래도 매칭이 없으면 첫 글자라도 같은지 확인
        if (!matched) {
          matched = agents.find(agent => {
            if (!agent.target || !selectedStore.manager) return false;
            
            // 공백 제거 후 첫 글자 비교
            const cleanedTarget = cleanString(agent.target);
            const cleanedManager = cleanString(selectedStore.manager);
            
            const isFirstCharMatch = cleanedTarget.charAt(0) === cleanedManager.charAt(0);
            
            if (isFirstCharMatch) {
              console.log(`[첫글자 매칭] 성공: "${cleanedTarget.charAt(0)}" ↔ "${cleanedManager.charAt(0)}"`);
              console.log(`- 원본 값: "${agent.target}" ↔ "${selectedStore.manager}"`);
            }
            
            return isFirstCharMatch;
          });
        }
        
        if (matched) {
          console.log(`매칭된 대리점 발견: ${matched.target} (연락처: ${matched.contactId})`);
          setMatchedAgent(matched);
        } else {
          console.log('매칭된 대리점 없음 - 모든 매칭 방법 실패');
          
          // 마지막 수단으로 사용자 지정 대리점 (agentTarget)과 매칭 시도
          if (agentTarget && agentContactId) {
            console.log(`사용자 로그인 대리점으로 강제 매칭: ${agentTarget}`);
            setMatchedAgent({
              target: agentTarget,
              contactId: agentContactId
            });
          } else {
            setMatchedAgent(null);
          }
        }
      } catch (error) {
        console.error('대리점 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAgentData();
  }, [selectedStore, agentTarget, agentContactId]);

  const handlePhoneCall = () => {
    // 매칭된 대리점이 있는 경우
    if (matchedAgent) {
      console.log(`담당자 ${selectedStore.manager}에 연결: ${matchedAgent.contactId}`);
      window.location.href = `tel:${matchedAgent.contactId}`;
    } else {
      alert('담당자와 매칭되는 대리점 연락처를 찾을 수 없습니다.');
    }
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
                <TableCell sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PersonIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                    <span style={{ fontWeight: 'medium' }}>
                      {selectedStore.manager || '미지정'}
                    </span>
                    {matchedAgent && (
                      <Typography variant="caption" sx={{ ml: 1, color: 'success.main' }}>
                        (매칭됨)
                      </Typography>
                    )}
                  </Box>
                  {selectedStore.manager && (
                    <Button
                      variant="contained"
                      color={matchedAgent ? 'primary' : 'secondary'}
                      startIcon={<PhoneIcon />}
                      onClick={handlePhoneCall}
                      size="small"
                      disabled={loading}
                    >
                      {matchedAgent ? '담당자 연결' : '연결 불가'}
                    </Button>
                  )}
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