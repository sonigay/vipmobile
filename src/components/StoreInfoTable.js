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
 * 선택된 매장 정보를 표시하는 테이블 컴포넌트
 */
function StoreInfoTable({ selectedStore, agentTarget, agentContactId }) {
  const [matchedAgent, setMatchedAgent] = useState(null);
  const [loading, setLoading] = useState(false);

  // 선택된 매장의 담당자와 일치하는 대리점 정보 불러오기
  useEffect(() => {
    const loadAgentData = async () => {
      if (!selectedStore?.manager) return;
      
      try {
        setLoading(true);
        const agents = await fetchAgentData();
        
        // 대리점 대상과 매장 담당자 매칭 (앞 3글자 비교)
        const matched = agents.find(agent => {
          if (!agent.target || !selectedStore.manager) return false;
          
          // 담당자가 대리점 대상의 앞 3글자를 포함하는지 확인
          const targetPrefix = agent.target.substring(0, 3);
          return selectedStore.manager.includes(targetPrefix);
        });
        
        if (matched) {
          console.log(`매칭된 대리점 발견: ${matched.target}`);
          setMatchedAgent(matched);
        } else {
          console.log('매칭된 대리점 없음');
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
    // 매장의 담당자가 현재 로그인한 대리점과 일치하는 경우
    if (matchedAgent) {
      // 매칭된 대리점 연락처로 전화 연결
      window.location.href = `tel:${matchedAgent.contactId}`;
    } else if (selectedStore?.phone) {
      // 매장 연락처로 전화 연결
      window.location.href = `tel:${selectedStore.phone}`;
    } else {
      alert('연락처 정보가 없습니다.');
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
                <TableCell sx={{ display: 'flex', alignItems: 'center' }}>
                  <PersonIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                  {selectedStore.manager || '미지정'}
                  {matchedAgent && (
                    <Typography variant="caption" sx={{ ml: 1, color: 'success.main' }}>
                      (매칭됨)
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell variant="head">주소</TableCell>
                <TableCell>{selectedStore.address || '주소 정보 없음'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell variant="head">연락처</TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PhoneIcon />}
                    onClick={handlePhoneCall}
                    size="small"
                    disabled={loading}
                  >
                    {matchedAgent ? '대리점 연결' : '매장 연결'}
                  </Button>
                </TableCell>
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