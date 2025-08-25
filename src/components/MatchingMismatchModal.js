import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
  Alert,
  AlertTitle
} from '@mui/material';
import { Warning, Error, CheckCircle, Info } from '@mui/icons-material';

const MatchingMismatchModal = ({ visible, onClose, matchingMismatches }) => {
  if (!matchingMismatches || matchingMismatches.length === 0) {
    return null;
  }

  const getStatusChip = (type) => {
    if (type === '출고처') {
      return <Chip icon={<Warning />} label={type} color="warning" size="small" />;
    }
    return <Chip icon={<Error />} label={type} color="error" size="small" />;
  };

  const getStatusChipForRecord = (record) => {
    const isAgentMismatch = record.거래처정보.담당자 !== record.폰클출고처데이터.담당자;
    const isCodeMismatch = record.거래처정보.코드 !== record.폰클출고처데이터.코드;
    
    if (isAgentMismatch && isCodeMismatch) {
      return <Chip icon={<Error />} label="담당자+코드 불일치" color="error" size="small" />;
    } else if (isAgentMismatch) {
      return <Chip icon={<Warning />} label="담당자 불일치" color="warning" size="small" />;
    } else if (isCodeMismatch) {
      return <Chip icon={<Warning />} label="코드 불일치" color="warning" size="small" />;
    }
    return <Chip icon={<CheckCircle />} label="정상" color="success" size="small" />;
  };

  return (
    <Dialog
      open={visible}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        style: { margin: 16, maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Warning sx={{ color: 'warning.main' }} />
          <Typography variant="h6">매칭 불일치 알림</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>정보</AlertTitle>
          <strong>거래처정보</strong>와 <strong>폰클출고처데이터</strong> 간의 담당자/코드 불일치가 발견되었습니다.
          <br />
          이는 등록점과 보유재고 계산에 영향을 줄 수 있습니다.
        </Alert>
        
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>구분</strong></TableCell>
                <TableCell><strong>출고처명</strong></TableCell>
                <TableCell><strong>거래처정보</strong></TableCell>
                <TableCell><strong>폰클데이터</strong></TableCell>
                <TableCell><strong>상태</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matchingMismatches.map((record, index) => (
                <TableRow key={index}>
                  <TableCell>{getStatusChip(record.type)}</TableCell>
                  <TableCell>{record.거래처정보.출고처}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2"><strong>담당자:</strong> {record.거래처정보.담당자}</Typography>
                      <Typography variant="body2"><strong>코드:</strong> {record.거래처정보.코드}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2"><strong>담당자:</strong> {record.폰클출고처데이터.담당자}</Typography>
                      <Typography variant="body2"><strong>코드:</strong> {record.폰클출고처데이터.코드}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{getStatusChipForRecord(record)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>📋 불일치 유형 설명</Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            <Box component="li" sx={{ mb: 1 }}>
              <Chip icon={<Warning />} label="담당자 불일치" color="warning" size="small" />: 
              거래처정보와 폰클출고처데이터의 담당자가 다름
            </Box>
            <Box component="li" sx={{ mb: 1 }}>
              <Chip icon={<Warning />} label="코드 불일치" color="warning" size="small" />: 
              거래처정보와 폰클출고처데이터의 코드가 다름
            </Box>
            <Box component="li">
              <Chip icon={<Error />} label="담당자+코드 불일치" color="error" size="small" />: 
              담당자와 코드 모두 다름
            </Box>
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MatchingMismatchModal;
