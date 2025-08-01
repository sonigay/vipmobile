import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Container
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import UpdateIcon from '@mui/icons-material/Update';
import * as XLSX from 'xlsx';

import AppUpdatePopup from './AppUpdatePopup';


function SettlementMode({ onLogout, loggedInStore, settlementUserName, onModeChange, availableModes }) {
  const [excelData, setExcelData] = useState(null);
  const [originalFileName, setOriginalFileName] = useState(''); // 원본 파일명 저장
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 업데이트 팝업 상태
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  // 정산모드 진입 시 업데이트 팝업 표시
  useEffect(() => {
    // 모드 진입 시 자동으로 업데이트 팝업 표시
    setShowUpdatePopup(true);
  }, []);

  // 엑셀 파일 업로드 처리
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 파일 형식 검증
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(fileExtension)) {
      setError('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
      return;
    }

    setIsLoading(true);
    setError('');

    // 원본 파일명 저장
    setOriginalFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        setExcelData(jsonData);
        setIsLoading(false);
      } catch (error) {
        setError('파일 읽기 중 오류가 발생했습니다.');
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError('파일 읽기 중 오류가 발생했습니다.');
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // 엑셀 파일 다운로드 처리
  const handleDownload = () => {
    if (!excelData) {
      setError('다운로드할 데이터가 없습니다.');
      return;
    }

    try {
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '정산데이터');
      
      // 원본 파일명이 있으면 사용, 없으면 기본 파일명 사용
      let fileName;
      if (originalFileName) {
        // 원본 파일명에서 확장자 제거 후 다시 추가
        const nameWithoutExt = originalFileName.replace(/\.(xlsx|xls)$/i, '');
        fileName = `${nameWithoutExt}_수정본.xlsx`;
      } else {
        // 기본 파일명에 현재 날짜 추가
        const today = new Date().toISOString().split('T')[0];
        fileName = `정산데이터_${today}.xlsx`;
      }
      
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      setError('파일 다운로드 중 오류가 발생했습니다.');
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        {/* 헤더 영역 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            정산 관리 시스템
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {settlementUserName} ({loggedInStore?.id})
            </Typography>
            
            {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
            {onModeChange && availableModes && availableModes.length > 1 && (
              <Button
                variant="outlined"
                onClick={() => {
                  console.log('SettlementMode 모드 전환 버튼 클릭됨');
                  console.log('onModeChange 존재:', !!onModeChange);
                  console.log('availableModes:', availableModes);
                  onModeChange();
                }}
                startIcon={<SwapHorizIcon />}
                sx={{ 
                  borderColor: '#1976d2',
                  color: '#1976d2',
                  '&:hover': { 
                    borderColor: '#1565c0',
                    backgroundColor: 'rgba(25, 118, 210, 0.04)'
                  }
                }}
              >
                모드 변경
              </Button>
            )}
            
            {/* 업데이트 확인 버튼 */}
            <Button
              variant="outlined"
              startIcon={<UpdateIcon />}
              onClick={() => setShowUpdatePopup(true)}
              sx={{ 
                borderColor: '#d32f2f',
                color: '#d32f2f',
                '&:hover': { 
                  borderColor: '#c62828',
                  backgroundColor: 'rgba(211, 47, 47, 0.04)'
                }
              }}
            >
              업데이트 확인
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={onLogout}
              sx={{ 
                borderColor: '#d32f2f',
                color: '#d32f2f',
                '&:hover': { 
                  borderColor: '#c62828',
                  backgroundColor: 'rgba(211, 47, 47, 0.04)'
                }
              }}
            >
              로그아웃
            </Button>
          </Box>
        </Box>

        {/* 파일 업로드/다운로드 버튼 */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            component="label"
            startIcon={<CloudUploadIcon />}
            disabled={isLoading}
            sx={{ 
              backgroundColor: '#1976d2',
              '&:hover': { backgroundColor: '#1565c0' }
            }}
          >
            엑셀 파일 업로드
            <input
              type="file"
              hidden
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
            />
          </Button>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={!excelData || isLoading}
            sx={{ 
              borderColor: '#1976d2',
              color: '#1976d2',
              '&:hover': { 
                borderColor: '#1565c0',
                backgroundColor: 'rgba(25, 118, 210, 0.04)'
              }
            }}
          >
            엑셀 파일 다운로드
          </Button>
        </Box>

        {/* 로딩 상태 */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {/* 에러 메시지 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* 업로드된 데이터 표시 */}
        {excelData && (
          <>
            {/* 파일 정보 표시 */}
            <Box sx={{ mb: 2, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                📁 업로드된 파일: <strong>{originalFileName}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                📊 데이터 행 수: <strong>{excelData.length - 1}개</strong> (헤더 제외)
              </Typography>
            </Box>
            
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      {excelData[0] && excelData[0].map((header, index) => (
                        <TableCell 
                          key={index}
                          sx={{ 
                            backgroundColor: '#f5f5f5',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                          }}
                        >
                          {header || `열 ${index + 1}`}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {excelData.slice(1).map((row, rowIndex) => (
                      <TableRow key={rowIndex} hover>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} sx={{ fontSize: '0.875rem' }}>
                            {cell || ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}

        {/* 데이터가 없을 때 안내 메시지 */}
        {!excelData && !isLoading && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              엑셀 파일을 업로드해주세요
            </Typography>
            <Typography variant="body2" color="text.secondary">
              정산 데이터가 포함된 엑셀 파일(.xlsx, .xls)을 업로드하면<br />
              데이터를 확인하고 다운로드할 수 있습니다.
            </Typography>
          </Paper>
        )}
      </Box>
      
      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="settlement"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          console.log('정산모드 새 업데이트가 추가되었습니다.');
        }}
      />
    </Container>
  );
}

export default SettlementMode; 