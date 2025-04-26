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
 * 문자열에서 앞 N글자 추출하는 함수
 */
const getPrefix = (str, length = 3) => {
  if (!str) return '';
  // 앞 3글자만 추출 (공백 제거 없이 원본 그대로 사용)
  return str.toString().substring(0, length);
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
        담당자앞3글자: getPrefix(selectedStore.manager, 3)
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
          console.log(`대리점 #${index + 1}:`, {
            대상: agent.target,
            대상앞3글자: getPrefix(agent.target, 3),
            자격: agent.qualification,
            연락처: agent.contactId,
            매칭여부: getPrefix(selectedStore.manager, 3) === getPrefix(agent.target, 3)
          });
        });
        
        // 정확히 앞 3글자만 비교하는 매칭 로직 (VLOOKUP 방식)
        const managerPrefix = getPrefix(selectedStore.manager, 3);
        
        // 매칭된 대리점 찾기
        const matched = agents.find(agent => {
          if (!agent.target) return false;
          
          const targetPrefix = getPrefix(agent.target, 3);
          const isExactMatch = targetPrefix === managerPrefix;
          
          if (isExactMatch) {
            console.log(`매칭 성공: ${targetPrefix} === ${managerPrefix}`);
            console.log(`- 담당자: ${selectedStore.manager} / 대리점 대상: ${agent.target}`);
          }
          
          return isExactMatch;
        });
        
        if (matched) {
          console.log(`매칭된 대리점 발견: ${matched.target} (연락처: ${matched.contactId})`);
          setMatchedAgent(matched);
        } else {
          console.log(`매칭된 대리점 없음 - 담당자 앞 3글자(${managerPrefix})와 일치하는 대리점이 없음`);
          setMatchedAgent(null);
        }
      } catch (error) {
        console.error('대리점 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAgentData();
  }, [selectedStore]);

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