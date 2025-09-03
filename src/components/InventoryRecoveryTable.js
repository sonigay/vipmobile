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

  // 색상별 배경색 반환 함수
  const getColorBackground = (color) => {
    const colorMap = {
      // 기본 색상
      '검정': '#000000',
      '흰색': '#ffffff',
      '화이트': '#ffffff',
      'White': '#ffffff',
      '파랑': '#1976d2',
      '블루': '#1976d2',
      'Blue': '#1976d2',
      '빨강': '#d32f2f',
      '레드': '#d32f2f',
      'Red': '#d32f2f',
      '초록': '#2e7d32',
      '그린': '#2e7d32',
      'Green': '#2e7d32',
      
      // 추가 색상
      '노랑': '#f57c00',
      '옐로우': '#f57c00',
      'Yellow': '#f57c00',
      '주황': '#ff9800',
      '오렌지': '#ff9800',
      'Orange': '#ff9800',
      '보라': '#9c27b0',
      '퍼플': '#9c27b0',
      'Purple': '#9c27b0',
      '핑크': '#e91e63',
      'Pink': '#e91e63',
      '갈색': '#795548',
      '브라운': '#795548',
      'Brown': '#795548',
      '회색': '#757575',
      '그레이': '#757575',
      'Gray': '#757575',
      '실버': '#bdbdbd',
      'Silver': '#bdbdbd',
      '골드': '#ffd700',
      'Gold': '#ffd700',
      
      // 특수 색상들 (라이트그린, 아이스블루 등)
      '라이트그린': '#4caf50',
      'LightGreen': '#4caf50',
      '아이스블루': '#03a9f4',
      'IceBlue': '#03a9f4',
      '라이트블루': '#03a9f4',
      'LightBlue': '#03a9f4',
      '네이비': '#3f51b5',
      'Navy': '#3f51b5',
      '다크그레이': '#424242',
      'DarkGray': '#424242',
      '크림': '#fff8e1',
      'Cream': '#fff8e1',
      '베이지': '#d7ccc8',
      'Beige': '#d7ccc8',
      '올리브': '#827717',
      'Olive': '#827717',
      '마린': '#00695c',
      'Marine': '#00695c',
      '코랄': '#ff5722',
      'Coral': '#ff5722',
      '라벤더': '#e1bee7',
      'Lavender': '#e1bee7'
    };
    
    return colorMap[color] || '#f5f5f5';
  };

  // 색상별 텍스트 색상 반환 함수
  const getColorText = (color) => {
    // 밝은 색상들 (어두운 글씨 필요)
    const lightColors = [
      '흰색', '화이트', 'White', 
      '노랑', '옐로우', 'Yellow', 
      '주황', '오렌지', 'Orange', 
      '실버', 'Silver', 
      '골드', 'Gold',
      '크림', 'Cream',
      '베이지', 'Beige',
      '라이트그린', 'LightGreen',
      '아이스블루', 'IceBlue', '라이트블루', 'LightBlue'
    ];
    
    // 중간 톤 색상들 (검은 글씨 필요)
    const mediumColors = [
      '라벤더', 'Lavender',
      '코랄', 'Coral'
    ];
    
    if (lightColors.includes(color)) {
      return '#000000'; // 검은 글씨
    } else if (mediumColors.includes(color)) {
      return '#000000'; // 검은 글씨
    } else {
      return '#ffffff'; // 흰 글씨
    }
  };

  // 색상별 테두리 반환 함수
  const getColorBorder = (color) => {
    const lightColors = ['흰색', '화이트', 'White', '실버', 'Silver', '골드', 'Gold'];
    return lightColors.includes(color) ? '1px solid #ccc' : 'none';
  };

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
    '출고일',
    '상태'
  ];

  // 위경도좌표없는곳 탭일 때만 주소 컬럼 추가
  const getTableHeaders = () => {
    if (tabIndex === 3) { // 위경도좌표없는곳
      return [...tableHeaders, '주소'];
    }
    return tableHeaders;
  };

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
       if (tabIndex === 3) { // 위경도좌표없는곳
         copyText += `${item.manager}/${item.storeName}/${item.modelName}/${item.color}/${item.serialNumber}/${item.address || '주소없음'}\n`;
       } else {
         copyText += `${item.manager}/${item.storeName}/${item.modelName}/${item.color}/${item.serialNumber}\n`;
       }
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
             <Table size="small" sx={{ tableLayout: 'fixed' }}>
                              <TableHead>
                  <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                    {getTableHeaders().map((header, index) => (
                      <TableCell 
                        key={index}
                        sx={{ 
                          fontWeight: 'bold',
                          textAlign: index === 0 ? 'left' : 'center',
                                                     width: index === 0 ? '130px' : // 담당자
                                  index === 1 ? '180px' : // 업체명
                                  index === 2 ? '160px' : // 모델명
                                  index === 3 ? '90px' :  // 색상
                                  index === 4 ? '120px' : // 일련번호
                                  index === 5 ? '120px' : // 출고일
                                  index === 6 ? '90px' :  // 상태
                                  index === 7 ? '250px' : // 주소 (위경도좌표없는곳)
                                  'auto'
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
                                         <TableCell sx={{ 
                       fontWeight: 'bold',
                       width: '130px',
                       overflow: 'hidden',
                       textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap'
                     }}>
                       {item.manager}
                     </TableCell>
                     <TableCell sx={{ 
                       textAlign: 'center',
                       width: '180px',
                       overflow: 'hidden',
                       textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap'
                     }}>
                       {item.storeName}
                     </TableCell>
                     <TableCell sx={{ 
                       textAlign: 'center',
                       width: '160px',
                       overflow: 'hidden',
                       textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap'
                     }}>
                       {item.modelName}
                     </TableCell>
                     <TableCell sx={{ 
                       textAlign: 'center',
                       width: '90px'
                     }}>
                       <Chip 
                         label={item.color} 
                         size="small" 
                         sx={{ 
                           backgroundColor: getColorBackground(item.color),
                           color: getColorText(item.color),
                           border: getColorBorder(item.color),
                           fontWeight: 'bold',
                           minWidth: '60px'
                         }}
                       />
                     </TableCell>
                     <TableCell sx={{ 
                       textAlign: 'center',
                       width: '120px',
                       overflow: 'hidden',
                       textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap'
                     }}>
                       {item.serialNumber}
                     </TableCell>
                     <TableCell sx={{ 
                       textAlign: 'center',
                       width: '120px',
                       overflow: 'hidden',
                       textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap'
                     }}>
                       {item.recentShipmentDate || '출고일 정보 없음'}
                     </TableCell>
                     <TableCell sx={{ 
                       textAlign: 'center',
                       width: '90px'
                     }}>
                       <Chip 
                         label={item.deviceStatus} 
                         size="small"
                         color={item.deviceStatus === '정상' ? 'success' : 'warning'}
                       />
                     </TableCell>
                     
                                           {/* 주소 컬럼 - 위경도좌표없는곳 탭에서만 표시 */}
                                             {tabIndex === 3 && (
                         <TableCell sx={{ 
                           textAlign: 'center',
                           width: '250px',
                           overflow: 'hidden',
                           textOverflow: 'ellipsis',
                           whiteSpace: 'nowrap'
                         }}>
                          <Typography variant="body2" sx={{ 
                            wordBreak: 'break-word',
                            fontSize: '0.875rem'
                          }}>
                            {item.address || '주소 정보 없음'}
                          </Typography>
                        </TableCell>
                      )}
                      
                                             {/* 액션 컬럼 */}
                       {tabIndex === 0 && (
                        <TableCell sx={{ 
                          textAlign: 'center',
                          width: '140px'
                        }}>
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
                        <TableCell sx={{ 
                          textAlign: 'center',
                          width: '140px'
                        }}>
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
