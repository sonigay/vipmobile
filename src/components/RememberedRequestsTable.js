import React from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  Chip
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Send as SendIcon,
  ClearAll as ClearAllIcon
} from '@mui/icons-material';

function RememberedRequestsTable({ 
  rememberedRequests, 
  onRemoveRequest, 
  onClearAllRequests, 
  onBulkRequest 
}) {
  if (rememberedRequests.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#666', fontWeight: 'bold' }}>
          기억된 요청 목록
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100px',
          border: '2px dashed #ddd',
          borderRadius: 1,
          backgroundColor: '#fafafa'
        }}>
          <Typography variant="body2" color="text.secondary">
            기억된 요청이 없습니다
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#666', fontWeight: 'bold' }}>
          기억된 요청 목록 ({rememberedRequests.length}개)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<SendIcon />}
            onClick={onBulkRequest}
            sx={{
              backgroundColor: '#4CAF50',
              '&:hover': {
                backgroundColor: '#45a049'
              }
            }}
          >
            기억된목록요청
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<ClearAllIcon />}
            onClick={onClearAllRequests}
          >
            전체삭제
          </Button>
        </Box>
      </Box>

      <TableContainer sx={{ maxHeight: 300 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>순번</TableCell>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>매장명</TableCell>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>모델</TableCell>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>색상</TableCell>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>기억시간</TableCell>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5', textAlign: 'center' }}>삭제</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rememberedRequests.map((request, index) => (
              <TableRow key={request.id} hover>
                <TableCell>
                  <Chip 
                    label={index + 1} 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{request.storeName}</TableCell>
                <TableCell>{request.model}</TableCell>
                <TableCell>
                  <Chip 
                    label={request.color} 
                    size="small" 
                    color="secondary" 
                    variant="filled"
                  />
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: '#666' }}>
                  {request.timestamp}
                </TableCell>
                <TableCell align="center">
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => onRemoveRequest(request.id)}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    삭제
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default RememberedRequestsTable;
