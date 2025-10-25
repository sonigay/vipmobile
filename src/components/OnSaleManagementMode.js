import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  TablePagination,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  Update as UpdateIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';

const OnSaleManagementMode = ({ 
  loggedInStore, 
  onLogout, 
  onModeChange, 
  availableModes 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 링크 목록 상태
  const [links, setLinks] = useState([]);
  
  // 링크 추가/수정 다이얼로그 상태
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [linkForm, setLinkForm] = useState({
    url: '',
    buttonName: '',
    hideAgentInfo: false,
    isActive: true,
    useActivationForm: false,
    activationSheetId: '',
    activationSheetName: ''
  });

  // 개통정보 목록 관련 상태
  const [activationList, setActivationList] = useState([]);
  const [activationLoading, setActivationLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLink, setSelectedLink] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const API_URL = process.env.REACT_APP_API_URL;

  // 업데이트 팝업 자동 표시
  useEffect(() => {
    // 모드 진입 시 업데이트 팝업 표시
    setShowUpdatePopup(true);
  }, []);

  // 링크 목록 불러오기
  useEffect(() => {
    fetchLinks();
    fetchActivationList(); // 개통정보 목록도 함께 불러오기
  }, []);

  // 수정 완료 메시지 리스너
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'ACTIVATION_UPDATED') {
        console.log('🔄 수정 완료 알림 받음, 목록 새로고침');
        fetchActivationList();
      }
      if (event.data && event.data.type === 'ACTIVATION_COMPLETED') {
        console.log('🔄 개통완료 알림 받음, 목록 새로고침');
        fetchActivationList();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/onsale/links`);
      const data = await response.json();
      
      if (data.success) {
        setLinks(data.links);
      } else {
        setError(data.error || '링크 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('링크 조회 실패:', error);
      setError('링크 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLink = () => {
    setEditingLink(null);
    setLinkForm({
      url: '',
      buttonName: '',
      hideAgentInfo: false,
      isActive: true,
      useActivationForm: false,
      activationSheetId: '',
      activationSheetName: ''
    });
    setShowLinkDialog(true);
  };

  const handleEditLink = (link) => {
    setEditingLink(link);
    setLinkForm({
      url: link.url,
      buttonName: link.buttonName,
      hideAgentInfo: link.hideAgentInfo,
      isActive: link.isActive,
      useActivationForm: link.useActivationForm || false,
      activationSheetId: link.activationSheetId || '',
      activationSheetName: link.activationSheetName || ''
    });
    setShowLinkDialog(true);
  };

  const handleSaveLink = async () => {
    try {
      // 유효성 검사
      if (!linkForm.url || !linkForm.buttonName) {
        setError('URL과 버튼명은 필수입니다.');
        return;
      }
      
      // 개통양식 사용 시 시트 정보 필수
      if (linkForm.useActivationForm && (!linkForm.activationSheetId || !linkForm.activationSheetName)) {
        setError('개통양식을 사용할 경우 시트 ID와 시트 이름을 모두 입력해주세요.');
        return;
      }

      setLoading(true);
      setError(null);

      const url = editingLink 
        ? `${API_URL}/api/onsale/links/${editingLink.rowIndex}`
        : `${API_URL}/api/onsale/links`;
      
      const method = editingLink ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(linkForm),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(editingLink ? '링크가 수정되었습니다.' : '링크가 추가되었습니다.');
        setShowLinkDialog(false);
        fetchLinks();
        
        // 성공 메시지 3초 후 제거
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('링크 저장 실패:', error);
      setError('링크 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLink = async (link) => {
    if (!window.confirm(`"${link.buttonName}" 링크를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/onsale/links/${link.rowIndex}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('링크가 삭제되었습니다.');
        fetchLinks();
        
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('링크 삭제 실패:', error);
      setError('링크 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 개통정보 목록 불러오기
  const fetchActivationList = async () => {
    try {
      setActivationLoading(true);
      const params = new URLSearchParams();
      if (selectedLink !== 'all') {
        const link = links.find(l => l.buttonName === selectedLink);
        if (link && link.activationSheetId) {
          params.append('sheetId', link.activationSheetId);
        }
      } else {
        params.append('allSheets', 'true');
      }
      
      const response = await fetch(`${API_URL}/api/onsale/activation-list?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setActivationList(result.data);
      } else {
        setError('개통정보 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('개통정보 목록 로드 실패:', error);
      setError('개통정보 목록을 불러오는데 실패했습니다.');
    } finally {
      setActivationLoading(false);
    }
  };

  // 개통정보 수정
  const handleEditActivation = (activation) => {
    const editUrl = `/activation-info?editMode=true&sheetId=${activation.sheetId}&rowIndex=${activation.rowIndex}&vipCompany=${encodeURIComponent(loggedInStore.name)}&activationSheetId=${activation.sheetId}`;
    window.location.href = editUrl;
  };

  const handleViewActivation = (activation) => {
    const viewUrl = `/activation-info?viewMode=true&sheetId=${activation.sheetId}&rowIndex=${activation.rowIndex}&vipCompany=${encodeURIComponent(loggedInStore.name)}&activationSheetId=${activation.sheetId}`;
    window.location.href = viewUrl;
  };

  // 개통정보 취소
  const handleCancelActivation = async (activation) => {
    if (!window.confirm('이 개통정보를 취소 처리하시겠습니까?')) {
      return;
    }
    
    try {
      setActivationLoading(true);
      const response = await fetch(`${API_URL}/api/onsale/activation-info/${activation.sheetId}/${activation.rowIndex}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelledBy: loggedInStore.name
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess('개통정보가 취소되었습니다.');
        fetchActivationList(); // 목록 새로고침
      } else {
        setError(result.error || '개통정보 취소에 실패했습니다.');
      }
    } catch (error) {
      console.error('개통정보 취소 실패:', error);
      setError('개통정보 취소에 실패했습니다.');
    } finally {
      setActivationLoading(false);
    }
  };

  // 검색 필터링
  const filteredActivations = activationList.filter(activation => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      activation.customerName?.toLowerCase().includes(searchLower) ||
      activation.phoneNumber?.includes(searchTerm) ||
      activation.modelName?.toLowerCase().includes(searchLower) ||
      activation.plan?.toLowerCase().includes(searchLower) ||
      activation.storeName?.toLowerCase().includes(searchLower)
    );
  });

  // 페이지네이션
  const paginatedActivations = filteredActivations.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );


  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ 
        bgcolor: 'transparent',
        background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <Toolbar>
          <LinkIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            온세일 관리 모드
          </Typography>
          
          <Button
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={fetchLinks}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
            }}
          >
            새로고침
          </Button>
          
          <Button
            color="inherit"
            startIcon={<UpdateIcon />}
            onClick={() => setShowUpdatePopup(true)}
            sx={{
              ml: 2,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
            }}
          >
            업데이트 확인
          </Button>
          
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={onModeChange}
              sx={{
                ml: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
              }}
            >
              모드 변경
            </Button>
          )}
          
          <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 컨텐츠 */}
      <Box sx={{ p: 3 }}>
        {/* 에러 메시지 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 성공 메시지 */}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* 상단 액션 바 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 2px 4px rgba(142, 36, 170, 0.2)',
              mb: 3
            }}
          >
            📱 온세일 링크 관리
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchLinks}
              sx={{ mr: 1 }}
              disabled={loading}
            >
              새로고침
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddLink}
              disabled={loading}
              sx={{ 
                background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #7b1fa2 0%, #4a2c7a 100%)'
                },
                boxShadow: '0 4px 15px rgba(142, 36, 170, 0.3)'
              }}
            >
              링크 추가
            </Button>
          </Box>
        </Box>

        {/* 링크 목록 테이블 */}
        <Paper sx={{ 
          background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaf6 100%)',
          border: '1px solid #e1bee7',
          boxShadow: '0 4px 20px rgba(142, 36, 170, 0.1)',
          borderRadius: 3
        }}>
          {loading && links.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress sx={{ color: '#8e24aa' }} />
            </Box>
          ) : links.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: '#8e24aa', fontSize: '1.1rem' }}>
                📝 등록된 링크가 없습니다.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ 
                    background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                    '& .MuiTableCell-head': { color: 'white', fontWeight: 'bold' }
                  }}>
                    <TableCell><strong>🔗 버튼명</strong></TableCell>
                    <TableCell><strong>🌐 링크 URL</strong></TableCell>
                    <TableCell align="center"><strong>대리점정보숨김</strong></TableCell>
                    <TableCell align="center"><strong>개통양식</strong></TableCell>
                    <TableCell align="center"><strong>활성화</strong></TableCell>
                    <TableCell align="center"><strong>작업</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.rowIndex}>
                      <TableCell>{link.buttonName}</TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            maxWidth: 400, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {link.url}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={link.hideAgentInfo ? 'O' : 'X'} 
                          color={link.hideAgentInfo ? 'primary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={link.useActivationForm ? '사용' : '미사용'} 
                          color={link.useActivationForm ? 'secondary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={link.isActive ? 'O' : 'X'} 
                          color={link.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          size="small" 
                          onClick={() => handleEditLink(link)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteLink(link)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* 개통정보 목록 */}
      <Box sx={{ mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 2px 4px rgba(142, 36, 170, 0.2)',
              mb: 3
            }}
          >
            📋 개통정보 목록
          </Typography>

          {/* 필터 및 검색 */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>링크 선택</InputLabel>
              <Select
                value={selectedLink}
                onChange={(e) => setSelectedLink(e.target.value)}
                label="링크 선택"
              >
                <MenuItem value="all">전체 리스트</MenuItem>
                {links.filter(link => link.useActivationForm).map(link => (
                  <MenuItem key={link.buttonName} value={link.buttonName}>
                    {link.buttonName} ({link.activationSheetName})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              placeholder="고객명, 개통번호, 모델명, 요금제, 매장명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchActivationList}
              disabled={activationLoading}
            >
              새로고침
            </Button>
          </Box>

          {/* 개통정보 테이블 */}
          {activationLoading ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : paginatedActivations.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="textSecondary">
                {searchTerm ? '검색 결과가 없습니다.' : '등록된 개통정보가 없습니다.'}
              </Typography>
            </Paper>
          ) : (
            <>
              <TableContainer component={Paper} sx={{ mb: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>제출일시</TableCell>
                      <TableCell>작업자</TableCell>
                      <TableCell>매장명</TableCell>
                      <TableCell>개통유형</TableCell>
                      <TableCell>고객명</TableCell>
                      <TableCell>개통번호</TableCell>
                      <TableCell>생년월일</TableCell>
                      <TableCell>모델명</TableCell>
                      <TableCell>일련번호</TableCell>
                      <TableCell>유심모델명</TableCell>
                      <TableCell>유심일련번호</TableCell>
                      <TableCell>요금제</TableCell>
                      <TableCell>개통완료</TableCell>
                      <TableCell>개통시간</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>작업</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedActivations.map((activation, index) => (
                      <TableRow 
                        key={index}
                        onClick={() => handleViewActivation(activation)}
                        sx={{ 
                          backgroundColor: activation.isCompleted ? '#e3f2fd' : 
                                         activation.isCancelled ? '#fce4ec' : 
                                         activation.lastEditor ? '#f1f8e9' : 'inherit',
                          opacity: activation.isCancelled ? 0.7 : 1,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: activation.isCompleted ? '#bbdefb' : 
                                           activation.isCancelled ? '#f8bbd9' : 
                                           activation.lastEditor ? '#dcedc8' : '#f8f9fa'
                          }
                        }}
                      >
                        <TableCell>{activation.submittedAt}</TableCell>
                        <TableCell>
                          {activation.isCancelled ? (
                            <Box>
                              <Box sx={{ fontSize: '0.8rem', color: 'error.main' }}>
                                취소: {activation.cancelledBy}
                              </Box>
                              {activation.lastEditor && (
                                <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                                  수정: {activation.lastEditor}
                                </Box>
                              )}
                            </Box>
                          ) : (
                            <Box>
                              {activation.lastEditor && (
                                <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                                  수정: {activation.lastEditor}
                                </Box>
                              )}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>{activation.storeName}</TableCell>
                        <TableCell>{activation.activationType}</TableCell>
                        <TableCell>{activation.customerName}</TableCell>
                        <TableCell>{activation.phoneNumber}</TableCell>
                        <TableCell>{activation.birthDate}</TableCell>
                        <TableCell>{activation.modelName}</TableCell>
                        <TableCell>{activation.deviceSerial}</TableCell>
                        <TableCell>{activation.simModel}</TableCell>
                        <TableCell>{activation.simSerial}</TableCell>
                        <TableCell>{activation.plan}</TableCell>
                        <TableCell>
                          {activation.isCompleted ? (
                            <Box>
                              <Box sx={{ fontSize: '0.8rem', color: 'success.main', fontWeight: 'bold' }}>
                                완료: {activation.completedBy}
                              </Box>
                            </Box>
                          ) : (
                            <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                              미완료
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          {activation.completedAt ? (
                            <Box sx={{ fontSize: '0.8rem', color: 'text.primary' }}>
                              {activation.completedAt}
                            </Box>
                          ) : (
                            <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                              -
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          {activation.isCancelled ? (
                            <Chip 
                              label={`취소됨 (${activation.cancelledBy})`} 
                              color="error" 
                              size="small" 
                            />
                          ) : (
                            <Chip label="정상" color="success" size="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleEditActivation(activation)}
                              disabled={activation.isCancelled}
                              sx={{ color: '#5e35b1' }}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleCancelActivation(activation)}
                              disabled={activation.isCancelled || activationLoading}
                              sx={{ color: '#d32f2f' }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* 페이지네이션 */}
              <TablePagination
                component="div"
                count={filteredActivations.length}
                page={page}
                onPageChange={(event, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25]}
                labelRowsPerPage="페이지당 행 수:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
              />
            </>
          )}
        </Paper>
      </Box>

      {/* 링크 추가/수정 다이얼로그 */}
      <Dialog 
        open={showLinkDialog} 
        onClose={() => setShowLinkDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingLink ? '링크 수정' : '링크 추가'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="링크 URL"
              value={linkForm.url}
              onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
              margin="normal"
              placeholder="https://onsalemobile.uplus.co.kr/..."
              required
            />
            
            <TextField
              fullWidth
              label="버튼명"
              value={linkForm.buttonName}
              onChange={(e) => setLinkForm({ ...linkForm, buttonName: e.target.value })}
              margin="normal"
              placeholder="U+온라인가입"
              required
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={linkForm.hideAgentInfo}
                  onChange={(e) => setLinkForm({ ...linkForm, hideAgentInfo: e.target.checked })}
                />
              }
              label="대리점 정보 숨기기 (확장 프로그램 사용)"
              sx={{ mt: 2, mb: 1 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={linkForm.isActive}
                  onChange={(e) => setLinkForm({ ...linkForm, isActive: e.target.checked })}
                />
              }
              label="활성화 (일반모드에 표시)"
              sx={{ mt: 2, mb: 2 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={linkForm.useActivationForm}
                  onChange={(e) => setLinkForm({ ...linkForm, useActivationForm: e.target.checked })}
                />
              }
              label="개통양식 사용"
              sx={{ mt: 2, mb: 1 }}
            />
            
            {linkForm.useActivationForm && (
              <>
                <TextField
                  fullWidth
                  label="개통양식 시트 ID"
                  value={linkForm.activationSheetId}
                  onChange={(e) => setLinkForm({ ...linkForm, activationSheetId: e.target.value })}
                  margin="normal"
                  placeholder="1BxiM5m0e..."
                  helperText="구글 스프레드시트의 ID (URL에서 확인 가능)"
                />
                
                <TextField
                  fullWidth
                  label="개통양식 시트 이름"
                  value={linkForm.activationSheetName}
                  onChange={(e) => setLinkForm({ ...linkForm, activationSheetName: e.target.value })}
                  margin="normal"
                  placeholder="개통정보_2024"
                  helperText="개통정보가 저장될 시트의 이름"
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLinkDialog(false)}>
            취소
          </Button>
          <Button 
            onClick={handleSaveLink} 
            variant="contained"
            disabled={loading}
            sx={{ 
              background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #7b1fa2 0%, #4a2c7a 100%)'
              },
              boxShadow: '0 4px 15px rgba(142, 36, 170, 0.3)'
            }}
          >
            {loading ? <CircularProgress size={24} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="onSaleManagement"
        loggedInStore={loggedInStore}
      />
    </Box>
  );
};

export default OnSaleManagementMode;

