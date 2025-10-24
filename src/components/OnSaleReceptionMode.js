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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TablePagination,
  InputAdornment
} from '@mui/material';
import {
  Lock as LockIcon,
  Link as LinkIcon,
  OpenInNew as OpenInNewIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Update as UpdateIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';

const OnSaleReceptionMode = ({ 
  loggedInStore, 
  onLogout,
  onModeChange,
  availableModes
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 인증 상태
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  // 활성화된 링크 목록
  const [activeLinks, setActiveLinks] = useState([]);
  
  // 프록시 페이지 표시
  const [showProxyPage, setShowProxyPage] = useState(false);
  const [proxyHtml, setProxyHtml] = useState('');
  const [currentLink, setCurrentLink] = useState(null);
  
  // 개통정보 목록 관련 상태
  const [activationList, setActivationList] = useState([]);
  const [activationLoading, setActivationLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const API_URL = process.env.REACT_APP_API_URL;

  // 업데이트 팝업 자동 표시 (인증 성공 시)
  useEffect(() => {
    if (isAuthenticated) {
      setShowUpdatePopup(true);
      fetchActivationList(); // 개통정보 목록도 함께 불러오기
    }
  }, [isAuthenticated]);

  // 컴포넌트 마운트 시 활성화된 링크 불러오기
  useEffect(() => {
    fetchActiveLinks();
  }, []);

  const fetchActiveLinks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/onsale/active-links`);
      const data = await response.json();
      
      if (data.success) {
        setActiveLinks(data.links);
      }
    } catch (error) {
      console.error('링크 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      if (!password) {
        setError('비밀번호를 입력해주세요.');
        return;
      }

      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/check-onsale-permission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: loggedInStore.id,
          password: password
        }),
      });

      const data = await response.json();

      if (data.success && data.hasPermission) {
        setIsAuthenticated(true);
        setShowPasswordDialog(false);
        setPassword('');
      } else {
        setError(data.error || '권한이 없거나 비밀번호가 일치하지 않습니다.');
      }
    } catch (error) {
      console.error('권한 확인 실패:', error);
      setError('권한 확인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkClick = async (link) => {
    try {
      // 개통양식 사용 여부 확인
      if (link.useActivationForm && link.activationSheetId && link.activationSheetName) {
        // targetUrl에 vipCompany 파라미터 추가
        let targetUrl = link.url;
        if (loggedInStore && loggedInStore.name) {
          const separator = targetUrl.includes('?') ? '&' : '?';
          targetUrl = `${targetUrl}${separator}vipCompany=${encodeURIComponent(loggedInStore.name)}`;
        }
        
        // 개통정보 입력 페이지로 이동
        const params = new URLSearchParams({
          vipCompany: encodeURIComponent(loggedInStore.name),
          activationSheetId: link.activationSheetId,
          activationSheetName: link.activationSheetName,
          targetUrl: targetUrl,
          storeId: loggedInStore.id
        });
        window.location.href = `/?${params.toString()}`;
        return;
      }
      
      // 개통양식 사용하지 않는 경우: 기존 로직 (U+ 페이지로 바로 이동)
      let targetUrl = link.url;
      
      if (loggedInStore && loggedInStore.name) {
        // URL에 vipCompany 파라미터 추가
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${separator}vipCompany=${encodeURIComponent(loggedInStore.name)}`;
        console.log('💾 업체명 URL에 추가:', loggedInStore.name);
        console.log('🔗 최종 URL:', targetUrl);
      }
      
      // 모든 링크를 직접 새 창에서 열기 (확장 프로그램이 처리)
      window.open(targetUrl, '_blank');
    } catch (error) {
      console.error('링크 열기 실패:', error);
      setError('페이지를 불러오는데 실패했습니다.');
      
      // 에러 발생 시 원본 링크로 직접 열기
      window.open(link.url, '_blank');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseProxy = () => {
    setShowProxyPage(false);
    setProxyHtml('');
    setCurrentLink(null);
  };

  // 개통정보 목록 불러오기
  const fetchActivationList = async () => {
    try {
      setActivationLoading(true);
      const url = `${API_URL}/api/onsale/activation-list?storeName=${encodeURIComponent(loggedInStore.name)}&allSheets=true`;
      console.log('🔍 온세일접수 모드 - 개통정보 목록 요청:', url);
      console.log('🔍 매장명:', loggedInStore.name);
      
      const response = await fetch(url);
      const result = await response.json();
      
      console.log('🔍 온세일접수 모드 - API 응답:', result);
      
      if (result.success) {
        console.log('🔍 온세일접수 모드 - 개통정보 개수:', result.data.length);
        setActivationList(result.data);
      } else {
        console.error('🔍 온세일접수 모드 - API 에러:', result.error);
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
    const editUrl = `/activation-info?editMode=true&sheetId=${activation.sheetId}&rowIndex=${activation.rowIndex}&vipCompany=${encodeURIComponent(loggedInStore.name)}`;
    window.open(editUrl, '_blank');
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
      activation.plan?.toLowerCase().includes(searchLower)
    );
  });

  // 페이지네이션
  const paginatedActivations = filteredActivations.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // 인증되지 않은 경우
  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        {/* 헤더 */}
        <AppBar position="static" sx={{ 
          bgcolor: 'transparent',
          background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <Toolbar>
            <LockIcon sx={{ mr: 2 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              온세일접수 모드
            </Typography>
            
            <Button
              color="inherit"
              startIcon={<UpdateIcon />}
              onClick={() => setShowUpdatePopup(true)}
              sx={{
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

        {/* 인증 요청 화면 */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: 'calc(100vh - 64px)',
            p: 3
          }}
        >
          <Paper sx={{ 
            p: 4, 
            maxWidth: 500, 
            width: '100%', 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaf6 100%)',
            border: '1px solid #e1bee7',
            boxShadow: '0 8px 32px rgba(142, 36, 170, 0.15)'
          }}>
            <LockIcon sx={{ fontSize: 60, color: '#8e24aa', mb: 2 }} />
            <Typography variant="h5" gutterBottom sx={{ color: '#5e35b1', fontWeight: 'bold' }}>
              🔐 온세일접수 모드 접근
            </Typography>
            <Typography variant="body2" sx={{ color: '#8e24aa', mb: 3 }}>
              이 모드에 접근하려면 비밀번호가 필요합니다.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => setShowPasswordDialog(true)}
              sx={{ 
                mt: 2,
                background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #7b1fa2 0%, #4a2c7a 100%)',
                  transform: 'translateY(-2px)'
                },
                boxShadow: '0 6px 20px rgba(142, 36, 170, 0.4)',
                transition: 'all 0.3s ease',
                px: 4,
                py: 1.5
              }}
            >
              🔑 비밀번호 입력
            </Button>
          </Paper>
        </Box>

        {/* 비밀번호 입력 다이얼로그 */}
        <Dialog 
          open={showPasswordDialog} 
          onClose={() => setShowPasswordDialog(false)}
          PaperProps={{
            sx: {
              background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaf6 100%)',
              border: '1px solid #e1bee7',
              boxShadow: '0 8px 32px rgba(142, 36, 170, 0.15)'
            }
          }}
        >
          <DialogTitle sx={{ color: '#5e35b1', fontWeight: 'bold', textAlign: 'center' }}>
            🔐 비밀번호 입력
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, minWidth: 300 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}
              <TextField
                fullWidth
                type="password"
                label="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit();
                  }
                }}
                autoFocus
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': { borderColor: '#8e24aa' },
                    '&.Mui-focused fieldset': { borderColor: '#8e24aa' }
                  },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#8e24aa' }
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button 
              onClick={() => setShowPasswordDialog(false)}
              sx={{ color: '#8e24aa' }}
            >
              취소
            </Button>
            <Button 
              onClick={handlePasswordSubmit}
              variant="contained"
              disabled={loading}
              sx={{ 
                background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #7b1fa2 0%, #4a2c7a 100%)'
                },
                boxShadow: '0 4px 15px rgba(142, 36, 170, 0.3)',
                px: 3
              }}
            >
              {loading ? <CircularProgress size={24} /> : '확인'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // 프록시 페이지 표시
  if (showProxyPage) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        {/* 프록시 페이지 헤더 */}
        <AppBar position="static" sx={{ 
          bgcolor: 'transparent',
          background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {currentLink?.buttonName}
            </Typography>
            <Button 
              color="inherit" 
              onClick={handleCloseProxy}
              startIcon={<CloseIcon />}
            >
              닫기
            </Button>
          </Toolbar>
        </AppBar>

        {/* iframe으로 프록시된 HTML 표시 */}
        <Box sx={{ height: 'calc(100vh - 64px)' }}>
          <iframe
            srcDoc={proxyHtml}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title="온세일 가입 페이지"
          />
        </Box>
      </Box>
    );
  }

  // 인증 완료 - 링크 목록 표시
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
            온세일접수 모드
          </Typography>
          
          <Button
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={fetchActiveLinks}
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
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

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
          🔗 가입 신청 링크
        </Typography>

        {loading && activeLinks.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : activeLinks.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">
              활성화된 가입 링크가 없습니다.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {activeLinks.map((link, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaf6 100%)',
                  border: '1px solid #e1bee7',
                  boxShadow: '0 4px 20px rgba(142, 36, 170, 0.1)',
                  '&:hover': { 
                    boxShadow: '0 8px 30px rgba(142, 36, 170, 0.2)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease'
                }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: '#5e35b1', fontWeight: 'bold' }}>
                      {link.buttonName}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#8e24aa' }}>
                      {link.hideAgentInfo ? '(대리점 정보 보호)' : '(일반 링크)'}
                    </Typography>
                    {link.useActivationForm && (
                      <Typography variant="body2" sx={{ color: '#5e35b1', fontWeight: 'bold', mt: 0.5 }}>
                        (개통양식 사용)
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button
                      fullWidth
                      variant="contained"
                      endIcon={link.hideAgentInfo ? <VisibilityIcon /> : <OpenInNewIcon />}
                      onClick={() => handleLinkClick(link)}
                      disabled={loading}
                      sx={{ 
                        background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                        '&:hover': { 
                          background: 'linear-gradient(135deg, #7b1fa2 0%, #4a2c7a 100%)',
                          transform: 'translateY(-1px)'
                        },
                        boxShadow: '0 4px 15px rgba(142, 36, 170, 0.3)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      가입 신청하기
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* 개통정보 목록 */}
        <Box sx={{ mt: 4 }}>
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

          {/* 검색 및 새로고침 */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="고객명, 개통번호, 모델명, 요금제로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1 }}
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
                      <TableCell>고객명</TableCell>
                      <TableCell>개통번호</TableCell>
                      <TableCell>모델명</TableCell>
                      <TableCell>요금제</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>작업</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedActivations.map((activation, index) => (
                      <TableRow 
                        key={index}
                        sx={{ 
                          backgroundColor: activation.isCancelled ? '#f5f5f5' : 'inherit',
                          opacity: activation.isCancelled ? 0.7 : 1
                        }}
                      >
                        <TableCell>{activation.submittedAt}</TableCell>
                        <TableCell>{activation.customerName}</TableCell>
                        <TableCell>{activation.phoneNumber}</TableCell>
                        <TableCell>{activation.modelName}</TableCell>
                        <TableCell>{activation.plan}</TableCell>
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
                              <CancelIcon />
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
        </Box>
      </Box>

      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="onSaleReception"
        loggedInStore={loggedInStore}
      />
    </Box>
  );
};

export default OnSaleReceptionMode;

