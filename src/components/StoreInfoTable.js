import React from 'react';
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

/**
 * 선택된 매장 정보를 표시하는 테이블 컴포넌트
 */
function StoreInfoTable({ selectedStore, agentTarget, agentContactId }) {
  const handlePhoneCall = () => {
    // 선택된 매장의 담당자가 현재 로그인한 대리점과 일치하는 경우
    if (selectedStore?.manager === agentTarget) {
      // 대리점 연락처로 전화 연결
      window.location.href = `tel:${agentContactId}`;
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
                  >
                    전화 연결
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