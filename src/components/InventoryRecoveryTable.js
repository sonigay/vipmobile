import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Divider,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

function InventoryRecoveryTable({ data, tabIndex, onStatusUpdate, onRefresh }) {
  const [copySuccess, setCopySuccess] = useState({});

  // 담당자별로 데이터 그룹화
  const groupedData = useMemo(() => {
    const groups = {};
    data.forEach(item => {
      const manager = item.manager || '담당자 미지정';
      if (!groups[manager]) {
        groups[manager] = [];
      }
      groups[manager].push(item);
    });
    return groups;
  }, [data]);

  // 테이블 헤더
  const tableHeaders = [
    '담당자',
    '업체명',
    '모델명',
    '색상',
    '일련번호',
    '현황',
    '입고일',
    '상태'
  ];

  // 클립보드 복사 함수
  const handleCopyToClipboard = async (manager, items) => {
    let copyText = '';
    
    // 탭별로 다른 형식으로 복사
    if (tabIndex === 0) { // 총 회수대상
      copyText = `📦 총 회수대상 - ${manager}\n`;
      copyText += `담당자명/업체명/모델명/색상/일련번호\n`;
      copyText += `─`.repeat(50) + '\n';
    } else if (tabIndex === 1) { // 금일 회수대상
      copyText = `🎯 금일 회수대상 - ${manager}\n`;
      copyText += `담당자명/업체명/모델명/색상/일련번호\n`;
      copyText += `─`.repeat(50) + '\n';
    } else if (tabIndex === 2) { // 금일 회수완료
      copyText = `✅ 금일 회수완료 - ${manager}\n`;
      copyText += `담당자명/업체명/모델명/색상/일련번호\n`;
      copyText += `─`.repeat(50) + '\n';
    } else if (tabIndex === 3) { // 위경도좌표없는곳
      copyText = `⚠️ 위경도좌표없는곳 - ${manager}\n`;
      copyText += `담당자명/업체명/모델명/색상/일련번호\n`;
      copyText += `─`.repeat(50) + '\n';
    }

    // 데이터 추가
    items.forEach(item => {
      copyText += `${item.manager}/${item.storeName}/${item.modelName}/${item.color}/${item.serialNumber}\n`;
    });

    try {
      await navigator.clipboard.writeText(copyText);
      
      setCopySuccess(prev => ({ ...prev, [manager]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [manager]: false }));
      }, 2000);
      
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      // 폴백: 텍스트 영역 생성 후 복사
      const textArea = document.createElement('textarea');
      textArea.value = copyText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopySuccess(prev => ({ ...prev, [manager]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [manager]: false }));
      }, 2000);
    }
  };

  // 상태 업데이트 핸들러
  const handleStatusChange = (item, column, value) => {
    onStatusUpdate(item.rowIndex, column, value);
  };

  // 데이터가 없는 경우
  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          {tabIndex === 0 && '총 회수대상 데이터가 없습니다.'}
          {tabIndex === 1 && '금일 회수대상 데이터가 없습니다.'}
          {tabIndex === 2 && '금일 회수완료 데이터가 없습니다.'}
          {tabIndex === 3 && '위경도좌표없는곳 데이터가 없습니다.'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* 새로고침 버튼 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          {tabIndex === 0 && '📦 총 회수대상'}
          {tabIndex === 1 && '🎯 금일 회수대상'}
          {tabIndex === 2 && '✅ 금일 회수완료'}
          {tabIndex === 3 && '⚠️ 위경도좌표없는곳'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
        >
          새로고침
        </Button>
      </Box>

      {/* 담당자별 테이블 */}
      {Object.entries(groupedData).map(([manager, items], managerIndex) => (
        <Box key={manager} sx={{ mb: 4 }}>
          {/* 담당자 헤더 */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 2,
            p: 2,
            backgroundColor: '#f5f5f5',
            borderRadius: 1
          }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
              👤 {manager} ({items.length}건)
            </Typography>
            
            {/* 복사 버튼 */}
            <Button
              variant={copySuccess[manager] ? 'contained' : 'outlined'}
              color={copySuccess[manager] ? 'success' : 'primary'}
              startIcon={copySuccess[manager] ? <CheckIcon /> : <CopyIcon />}
              onClick={() => handleCopyToClipboard(manager, items)}
              size="small"
            >
              {copySuccess[manager] ? '복사완료!' : '복사하기'}
            </Button>
          </Box>

          {/* 테이블 */}
          <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                  {tableHeaders.map((header, index) => (
                    <TableCell 
                      key={index}
                      sx={{ 
                        fontWeight: 'bold',
                        textAlign: index === 0 ? 'left' : 'center'
                      }}
                    >
                      {header}
                    </TableCell>
                  ))}
                  {/* 액션 컬럼 */}
                  {tabIndex === 0 && (
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                      회수대상선정
                    </TableCell>
                  )}
                  {tabIndex === 1 && (
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                      회수완료
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, itemIndex) => (
                  <TableRow 
                    key={itemIndex}
                    sx={{ 
                      '&:nth-of-type(odd)': { backgroundColor: '#fafafa' },
                      '&:hover': { backgroundColor: '#f0f8ff' }
                    }}
                  >
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {item.manager}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {item.storeName}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {item.modelName}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip 
                        label={item.color} 
                        size="small" 
                        sx={{ 
                          backgroundColor: item.color === '검정' ? '#000' : 
                                        item.color === '흰색' ? '#fff' : 
                                        item.color === '파랑' ? '#1976d2' : 
                                        item.color === '빨강' ? '#d32f2f' : 
                                        item.color === '초록' ? '#2e7d32' : '#f5f5f5',
                          color: item.color === '흰색' ? '#000' : '#fff',
                          border: item.color === '흰색' ? '1px solid #ccc' : 'none'
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {item.serialNumber}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip 
                        label={item.status} 
                        size="small"
                        color={item.status === '정상' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {item.entryDate}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip 
                        label={item.deviceStatus} 
                        size="small"
                        color={item.deviceStatus === '정상' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    
                    {/* 액션 컬럼 */}
                    {tabIndex === 0 && (
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Button
                          variant={item.recoveryTargetSelected ? 'contained' : 'outlined'}
                          color={item.recoveryTargetSelected ? 'success' : 'primary'}
                          size="small"
                          onClick={() => handleStatusChange(
                            item, 
                            'recoveryTargetSelected', 
                            item.recoveryTargetSelected ? '' : 'O'
                          )}
                        >
                          {item.recoveryTargetSelected ? '선정됨' : '선정하기'}
                        </Button>
                      </TableCell>
                    )}
                    
                    {tabIndex === 1 && (
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Button
                          variant={item.recoveryCompleted ? 'contained' : 'outlined'}
                          color={item.recoveryCompleted ? 'success' : 'primary'}
                          size="small"
                          onClick={() => handleStatusChange(
                            item, 
                            'recoveryCompleted', 
                            item.recoveryCompleted ? '' : 'O'
                          )}
                        >
                          {item.recoveryCompleted ? '완료됨' : '완료하기'}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      {/* 복사 성공 알림 */}
      {Object.values(copySuccess).some(success => success) && (
        <Alert severity="success" sx={{ mt: 2 }}>
          클립보드에 복사되었습니다! 카톡 등에 붙여넣기하여 사용하세요.
        </Alert>
      )}
    </Box>
  );
}

export default InventoryRecoveryTable;
