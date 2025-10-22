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
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  Update as UpdateIcon
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
  
  const API_URL = process.env.REACT_APP_API_URL;

  // 업데이트 팝업 자동 표시
  useEffect(() => {
    // 모드 진입 시 업데이트 팝업 표시
    setShowUpdatePopup(true);
  }, []);

  // 링크 목록 불러오기
  useEffect(() => {
    fetchLinks();
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

