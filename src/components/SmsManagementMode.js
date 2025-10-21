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
  Card,
  CardContent,
  Container,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  InputAdornment,
  Tooltip,
  Grid
} from '@mui/material';
import {
  Message as MessageIcon,
  Update as UpdateIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  CleaningServices as CleaningServicesIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';

const SmsManagementMode = ({ 
  loggedInStore, 
  onLogout, 
  onModeChange, 
  availableModes 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 2단계 탭 구조
  const [mainTab, setMainTab] = useState(0); // 0: 문자전달, 1: 자동응답
  const [forwardTab, setForwardTab] = useState(0); // 문자전달 서브탭
  const [replyTab, setReplyTab] = useState(0); // 자동응답 서브탭
  
  // SMS 목록 상태
  const [smsList, setSmsList] = useState([]);
  const [smsFilter, setSmsFilter] = useState('all');
  const [smsSearch, setSmsSearch] = useState('');
  
  // 전달 규칙 상태
  const [rules, setRules] = useState([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    receiverFilter: '',
    senderFilter: '',
    keywordFilter: '',
    targetNumbers: [],
    autoForward: false,
    active: true,
    memo: ''
  });
  const [targetNumberInput, setTargetNumberInput] = useState('');
  
  // 전달 이력 상태
  const [history, setHistory] = useState([]);
  
  // 수동 전달 모달 상태
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardingSms, setForwardingSms] = useState(null);
  const [forwardTargets, setForwardTargets] = useState([]);
  const [forwardTargetInput, setForwardTargetInput] = useState('');
  const [forwardMemo, setForwardMemo] = useState('');
  
  // 상세보기 모달 상태
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailSms, setDetailSms] = useState(null);
  const [detailHistory, setDetailHistory] = useState([]);
  
  // 통계 상태
  const [stats, setStats] = useState({ total: 0, pending: 0, forwarded: 0, failed: 0, receiveOnly: 0 });
  
  // 데이터 정리 상태
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleanupTarget, setCleanupTarget] = useState('all');
  
  // 자동응답 규칙 상태
  const [autoReplyRules, setAutoReplyRules] = useState([]);
  const [showAutoReplyRuleDialog, setShowAutoReplyRuleDialog] = useState(false);
  const [editingAutoReplyRule, setEditingAutoReplyRule] = useState(null);
  const [autoReplyRuleForm, setAutoReplyRuleForm] = useState({
    name: '',
    keywords: '',
    answerType: '템플릿',
    answerTemplate: '',
    priceConfig: '',
    active: true,
    priority: 10,
    memo: ''
  });
  
  // 자동응답 거래처 상태
  const [autoReplyContacts, setAutoReplyContacts] = useState([]);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({
    type: '거래처',
    salesPersonId: '',
    name: '',
    contact: '',
    memo: ''
  });
  
  // 자동응답 이력 상태
  const [autoReplyHistory, setAutoReplyHistory] = useState([]);
  const [autoReplyHistoryFilter, setAutoReplyHistoryFilter] = useState('all');

  // SMS 관리모드 진입 시 업데이트 팝업 표시
  useEffect(() => {
    const hideUntil = localStorage.getItem('hideUpdate_smsManagement');
    const shouldShowPopup = !(hideUntil && new Date() < new Date(hideUntil));
    
    if (shouldShowPopup) {
      setShowUpdatePopup(true);
    }
  }, []);

  // 데이터 로드
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30초마다 자동 새로고침
    return () => clearInterval(interval);
  }, [mainTab, forwardTab, replyTab, smsFilter, autoReplyHistoryFilter]);

  const loadData = async () => {
    if (mainTab === 0) {
      // 문자전달 탭
      if (forwardTab === 0) {
        await loadSms();
        await loadStats();
      } else if (forwardTab === 1) {
        await loadRules();
      } else if (forwardTab === 2) {
        await loadHistory();
      }
    } else if (mainTab === 1) {
      // 자동응답 탭
      if (replyTab === 0) {
        await loadAutoReplyRules();
      } else if (replyTab === 1) {
        await loadAutoReplyContacts();
      } else if (replyTab === 2) {
        await loadAutoReplyHistory();
      }
    }
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setContactForm({
      type: contact.type || '거래처',
      salesPersonId: contact.salesPersonId || '',
      name: contact.name || '',
      contact: contact.contact || '',
      memo: contact.memo || ''
    });
    setShowContactDialog(true);
  };

  // SMS 목록 로드
  const loadSms = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/sms/received?limit=100&status=${smsFilter}`
      );
      const result = await response.json();
      
      if (result.success) {
        setSmsList(result.data);
      }
    } catch (error) {
      console.error('SMS 목록 로드 실패:', error);
      setError('SMS 목록을 불러오는데 실패했습니다.');
    }
  };

  // 전달 규칙 로드
  const loadRules = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sms/rules`);
      const result = await response.json();
      
      if (result.success) {
        setRules(result.data);
      }
    } catch (error) {
      console.error('전달 규칙 로드 실패:', error);
      setError('전달 규칙을 불러오는데 실패했습니다.');
    }
  };

  // 전달 이력 로드
  const loadHistory = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sms/history`);
      const result = await response.json();
      
      if (result.success) {
        setHistory(result.data);
      }
    } catch (error) {
      console.error('전달 이력 로드 실패:', error);
      setError('전달 이력을 불러오는데 실패했습니다.');
    }
  };

  // 자동응답 규칙 로드
  const loadAutoReplyRules = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sms/auto-reply/rules`);
      const result = await response.json();
      
      if (result.success) {
        setAutoReplyRules(result.data);
      }
    } catch (error) {
      console.error('자동응답 규칙 로드 실패:', error);
      setError('자동응답 규칙을 불러오는데 실패했습니다.');
    }
  };

  // 자동응답 거래처 로드
  const loadAutoReplyContacts = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sms/auto-reply/contacts`);
      const result = await response.json();
      
      if (result.success) {
        setAutoReplyContacts(result.data);
      }
    } catch (error) {
      console.error('자동응답 거래처 로드 실패:', error);
      setError('자동응답 거래처를 불러오는데 실패했습니다.');
    }
  };

  // 자동응답 이력 로드
  const loadAutoReplyHistory = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/sms/auto-reply/history?limit=100&status=${autoReplyHistoryFilter}`
      );
      const result = await response.json();
      
      if (result.success) {
        setAutoReplyHistory(result.data);
      }
    } catch (error) {
      console.error('자동응답 이력 로드 실패:', error);
      setError('자동응답 이력을 불러오는데 실패했습니다.');
    }
  };

  // 통계 로드
  const loadStats = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sms/stats`);
      const result = await response.json();
      
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('통계 로드 실패:', error);
    }
  };

  // 규칙 추가/수정
  const handleSaveRule = async () => {
    try {
      const url = editingRule
        ? `${process.env.REACT_APP_API_URL}/api/sms/rules/${editingRule.id}`
        : `${process.env.REACT_APP_API_URL}/api/sms/rules`;
      
      const method = editingRule ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleForm)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setShowRuleDialog(false);
        setEditingRule(null);
        setRuleForm({
          name: '',
          receiverFilter: '',
          senderFilter: '',
          keywordFilter: '',
          targetNumbers: [],
          autoForward: false,
          active: true,
          memo: ''
        });
        await loadRules();
      } else {
        setError('규칙 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('규칙 저장 실패:', error);
      setError('규칙 저장 중 오류가 발생했습니다.');
    }
  };

  // 규칙 삭제
  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('이 규칙을 삭제하시겠습니까?')) return;
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/sms/rules/${ruleId}`,
        { method: 'DELETE' }
      );
      
      const result = await response.json();
      
      if (result.success) {
        await loadRules();
      } else {
        setError('규칙 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('규칙 삭제 실패:', error);
      setError('규칙 삭제 중 오류가 발생했습니다.');
    }
  };

  // SMS 수동 전달
  const handleForwardSms = async () => {
    if (forwardTargets.length === 0) {
      alert('전달할 번호를 입력해주세요.');
      return;
    }
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sms/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smsId: forwardingSms.id,
          targetNumbers: forwardTargets,
          memo: forwardMemo
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setShowForwardDialog(false);
        setForwardingSms(null);
        setForwardTargets([]);
        setForwardMemo('');
        await loadSms();
        alert(`${result.successCount}/${result.totalCount}개 번호로 전달되었습니다.`);
      } else {
        setError('전달에 실패했습니다.');
      }
    } catch (error) {
      console.error('전달 실패:', error);
      setError('전달 중 오류가 발생했습니다.');
    }
  };

  // SMS 상세보기
  const handleShowDetail = async (sms) => {
    setDetailSms(sms);
    
    // 전달 이력 로드
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/sms/history?smsId=${sms.id}`
      );
      const result = await response.json();
      
      if (result.success) {
        setDetailHistory(result.data);
      }
    } catch (error) {
      console.error('이력 로드 실패:', error);
    }
    
    setShowDetailDialog(true);
  };

  // 전달 대상 번호 추가
  const addForwardTarget = () => {
    if (forwardTargetInput && !forwardTargets.includes(forwardTargetInput)) {
      setForwardTargets([...forwardTargets, forwardTargetInput]);
      setForwardTargetInput('');
    }
  };

  // 규칙 전달 대상 번호 추가
  const addRuleTarget = () => {
    if (targetNumberInput && !ruleForm.targetNumbers.includes(targetNumberInput)) {
      setRuleForm({
        ...ruleForm,
        targetNumbers: [...ruleForm.targetNumbers, targetNumberInput]
      });
      setTargetNumberInput('');
    }
  };

  // 데이터 정리 함수
  const handleCleanupData = async () => {
    if (!window.confirm(`정말 ${cleanupDays}일 이전 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sms/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: cleanupDays,
          target: cleanupTarget
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`${result.deletedCount}개의 데이터가 삭제되었습니다.`);
        setShowCleanupDialog(false);
        await loadData();
      } else {
        setError('데이터 정리에 실패했습니다.');
      }
    } catch (error) {
      console.error('데이터 정리 실패:', error);
      setError('데이터 정리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // 자동응답 관련 함수들
  // ============================================

  // 자동응답 규칙 저장
  const handleSaveAutoReplyRule = async () => {
    try {
      const url = editingAutoReplyRule
        ? `${process.env.REACT_APP_API_URL}/api/sms/auto-reply/rules/${editingAutoReplyRule.id}`
        : `${process.env.REACT_APP_API_URL}/api/sms/auto-reply/rules`;
      
      const method = editingAutoReplyRule ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoReplyRuleForm)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setShowAutoReplyRuleDialog(false);
        setEditingAutoReplyRule(null);
        setAutoReplyRuleForm({
          name: '',
          keywords: '',
          answerType: '템플릿',
          answerTemplate: '',
          priceConfig: '',
          active: true,
          priority: 10,
          memo: ''
        });
        await loadAutoReplyRules();
      } else {
        setError('규칙 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('규칙 저장 실패:', error);
      setError('규칙 저장 중 오류가 발생했습니다.');
    }
  };

  // 자동응답 규칙 삭제
  const handleDeleteAutoReplyRule = async (id) => {
    if (!window.confirm('정말 이 규칙을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sms/auto-reply/rules/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadAutoReplyRules();
      } else {
        setError('규칙 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('규칙 삭제 실패:', error);
      setError('규칙 삭제 중 오류가 발생했습니다.');
    }
  };

  // 거래처 연락처 저장
  const handleSaveContact = async () => {
    try {
      const url = editingContact
        ? `${process.env.REACT_APP_API_URL}/api/sms/auto-reply/contacts/${editingContact.id}`
        : `${process.env.REACT_APP_API_URL}/api/sms/auto-reply/contacts`;
      const method = editingContact ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setShowContactDialog(false);
        setEditingContact(null);
        setContactForm({
          type: '거래처',
          salesPersonId: '',
          name: '',
          contact: '',
          memo: ''
        });
        await loadAutoReplyContacts();
      } else {
        setError('연락처 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('연락처 저장 실패:', error);
      setError('연락처 저장 중 오류가 발생했습니다.');
    }
  };

  // 거래처 연락처 삭제
  const handleDeleteContact = async (id) => {
    if (!window.confirm('정말 이 연락처를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sms/auto-reply/contacts/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadAutoReplyContacts();
      } else {
        setError('연락처 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('연락처 삭제 실패:', error);
      setError('연락처 삭제 중 오류가 발생했습니다.');
    }
  };

  // 필터링된 SMS 목록
  const filteredSmsList = smsList.filter(sms => {
    if (smsSearch) {
      return sms.sender.includes(smsSearch) || sms.message.includes(smsSearch);
    }
    return true;
  });

  // 로딩 상태
  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ backgroundColor: '#00897B' }}>
          <Toolbar>
            <MessageIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              SMS 관리 모드
            </Typography>
            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={60} />
        </Box>
      </Box>
    );
  }

  // 메인 화면
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ backgroundColor: '#00897B' }}>
        <Toolbar>
          <MessageIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            SMS 관리 모드
          </Typography>
          
          <Button
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={loadData}
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

      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* 1단계 메인 탭 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'white' }}>
        <Tabs value={mainTab} onChange={(e, v) => setMainTab(v)} variant="fullWidth">
          <Tab label="📨 문자전달" />
          <Tab label="🤖 자동응답" />
        </Tabs>
      </Box>

      {/* 2단계 서브 탭 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: '#f9f9f9' }}>
        {mainTab === 0 && (
          <Tabs value={forwardTab} onChange={(e, v) => setForwardTab(v)}>
            <Tab label="SMS 목록" />
            <Tab label="전달 규칙" />
            <Tab label="전달 이력" />
            <Tab label="설정" icon={<SettingsIcon />} iconPosition="start" />
          </Tabs>
        )}
        {mainTab === 1 && (
          <Tabs value={replyTab} onChange={(e, v) => setReplyTab(v)}>
            <Tab label="규칙 관리" />
            <Tab label="거래처 관리" />
            <Tab label="응답 이력" />
            <Tab label="설정" icon={<SettingsIcon />} iconPosition="start" />
          </Tabs>
        )}
      </Box>

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#f5f5f5', p: 3 }}>
        <Container maxWidth="xl">
          {/* ============================================ */}
          {/* 문자전달 탭 콘텐츠 */}
          {/* ============================================ */}
          {mainTab === 0 && forwardTab === 0 && (
            <Box>
              {/* 통계 카드 */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        전체 SMS
                      </Typography>
                      <Typography variant="h4">{stats.total}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        대기중
                      </Typography>
                      <Typography variant="h4" color="warning.main">{stats.pending}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        전달완료
                      </Typography>
                      <Typography variant="h4" color="success.main">{stats.forwarded}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        수신만
                      </Typography>
                      <Typography variant="h4" color="info.main">{stats.receiveOnly}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        실패
                      </Typography>
                      <Typography variant="h4" color="error.main">{stats.failed}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* 필터 및 검색 */}
              <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Box>
                  <Button
                    variant={smsFilter === 'all' ? 'contained' : 'outlined'}
                    onClick={() => setSmsFilter('all')}
                    size="small"
                  >
                    전체
                  </Button>
                  <Button
                    variant={smsFilter === '대기중' ? 'contained' : 'outlined'}
                    onClick={() => setSmsFilter('대기중')}
                    size="small"
                    sx={{ ml: 1 }}
                  >
                    대기중
                  </Button>
                  <Button
                    variant={smsFilter === '전달완료' ? 'contained' : 'outlined'}
                    onClick={() => setSmsFilter('전달완료')}
                    size="small"
                    sx={{ ml: 1 }}
                  >
                    전달완료
                  </Button>
                  <Button
                    variant={smsFilter === '수신만' ? 'contained' : 'outlined'}
                    onClick={() => setSmsFilter('수신만')}
                    size="small"
                    sx={{ ml: 1 }}
                  >
                    수신만
                  </Button>
                  <Button
                    variant={smsFilter === '실패' ? 'contained' : 'outlined'}
                    onClick={() => setSmsFilter('실패')}
                    size="small"
                    sx={{ ml: 1 }}
                  >
                    실패
                  </Button>
                </Box>
                <TextField
                  size="small"
                  placeholder="발신번호 또는 메시지 검색"
                  value={smsSearch}
                  onChange={(e) => setSmsSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                  sx={{ flexGrow: 1 }}
                />
              </Box>

              {/* SMS 테이블 */}
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>수신일시</TableCell>
                      <TableCell>발신번호</TableCell>
                      <TableCell>수신번호</TableCell>
                      <TableCell>메시지</TableCell>
                      <TableCell>전달상태</TableCell>
                      <TableCell>전달대상</TableCell>
                      <TableCell>액션</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSmsList.map((sms) => (
                      <TableRow key={sms.id}>
                        <TableCell>{sms.receivedAt}</TableCell>
                        <TableCell>{sms.sender}</TableCell>
                        <TableCell>{sms.receiver}</TableCell>
                        <TableCell>
                          <Typography noWrap sx={{ maxWidth: 300 }}>
                            {sms.message}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const status = sms.forwardStatus || '';
                            const color = status.startsWith('전달완료')
                              ? 'success'
                              : status.startsWith('대기중')
                                ? 'warning'
                                : status.startsWith('수신만')
                                  ? 'info'
                                  : (status.startsWith('부분실패') || status.startsWith('실패'))
                                    ? 'error'
                                    : 'default';
                            return (
                              <Chip
                                label={status}
                                color={color}
                                size="small"
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {sms.forwardTargets ? sms.forwardTargets.split(',').length + '개' : '-'}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="상세보기">
                            <IconButton size="small" onClick={() => handleShowDetail(sms)}>
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="전달">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setForwardingSms(sms);
                                setShowForwardDialog(true);
                              }}
                            >
                              <SendIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSmsList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="textSecondary">SMS가 없습니다</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* 탭 1: 전달 규칙 */}
          {mainTab === 0 && forwardTab === 1 && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h5">전달 규칙 관리</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingRule(null);
                    setRuleForm({
                      name: '',
                      receiverFilter: '',
                      senderFilter: '',
                      keywordFilter: '',
                      targetNumbers: [],
                      autoForward: false,
                      active: true,
                      memo: ''
                    });
                    setShowRuleDialog(true);
                  }}
                >
                  규칙 추가
                </Button>
              </Box>

              <Grid container spacing={2}>
                {rules.map((rule) => (
                  <Grid item xs={12} md={6} lg={4} key={rule.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6">{rule.name}</Typography>
                          <Box>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingRule(rule);
                                setRuleForm({
                                  name: rule.name,
                                  receiverFilter: rule.receiverFilter || '',
                                  senderFilter: rule.senderFilter,
                                  keywordFilter: rule.keywordFilter,
                                  targetNumbers: rule.targetNumbers.split(',').filter(n => n),
                                  autoForward: rule.autoForward,
                                  active: rule.active,
                                  memo: rule.memo
                                });
                                setShowRuleDialog(true);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          📱 수신번호: {rule.receiverFilter || '모든 폰'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          📞 발신번호: {rule.senderFilter || '모든 번호'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          🔍 키워드: {rule.keywordFilter || '모든 내용'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          ➡️ 전달대상: {rule.targetNumbers.split(',').filter(n => n).length}개
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Chip
                            label={rule.autoForward ? '자동전달' : '수동전달'}
                            size="small"
                            color={rule.autoForward ? 'primary' : 'default'}
                            sx={{ mr: 1 }}
                          />
                          <Chip
                            label={rule.active ? '활성화' : '비활성화'}
                            size="small"
                            color={rule.active ? 'success' : 'default'}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                {rules.length === 0 && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                      <Typography color="textSecondary">
                        등록된 전달 규칙이 없습니다.
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          {/* 탭 2: 전달 이력 */}
          {mainTab === 0 && forwardTab === 2 && (
            <Box>
              <Typography variant="h5" gutterBottom>전달 이력</Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>SMS ID</TableCell>
                      <TableCell>전달일시</TableCell>
                      <TableCell>전달번호</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>처리방식</TableCell>
                      <TableCell>오류메시지</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.smsId}</TableCell>
                        <TableCell>{h.forwardedAt}</TableCell>
                        <TableCell>{h.targetNumber}</TableCell>
                        <TableCell>
                          <Chip
                            label={h.status}
                            color={h.status === '성공' ? 'success' : 'error'}
                            size="small"
                            icon={h.status === '성공' ? <CheckCircleIcon /> : <ErrorIcon />}
                          />
                        </TableCell>
                        <TableCell>{h.processType}</TableCell>
                        <TableCell>{h.errorMessage || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {history.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="textSecondary">전달 이력이 없습니다</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* 탭 3: 설정 */}
          {mainTab === 0 && forwardTab === 3 && (
            <Box>
              <Typography variant="h5" gutterBottom>설정</Typography>
              
              <Grid container spacing={3}>
                {/* 시스템 상태 카드 */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>시스템 상태</Typography>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="textSecondary">
                          자동 헤더 체크: <Chip label="활성화" size="small" color="success" />
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                          시트 초기화: 자동 (첫 API 호출 시)
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                          자동 새로고침: 30초
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 통계 카드 */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>데이터 현황</Typography>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="textSecondary">
                          전체 SMS: <strong>{stats.total}개</strong>
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                          전달 규칙: <strong>{rules.length}개</strong>
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                          전달 이력: <strong>{history.length}개</strong>
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 데이터 정리 카드 */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>데이터 정리</Typography>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        오래된 SMS 데이터와 전달 이력을 삭제하여 시스템 성능을 유지할 수 있습니다.
                      </Typography>
                      <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
                        ⚠️ 삭제된 데이터는 복구할 수 없습니다. 신중하게 선택해주세요.
                      </Alert>
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<CleaningServicesIcon />}
                        onClick={() => setShowCleanupDialog(true)}
                      >
                        데이터 정리
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 안드로이드 앱 연동 안내 */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>📱 안드로이드 앱 연동</Typography>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        SMS 자동 수신을 위해서는 안드로이드 앱 설치가 필요합니다.
                      </Typography>
                      <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2" gutterBottom>
                          <strong>앱 설치 방법:</strong>
                        </Typography>
                        <Typography variant="body2" component="div">
                          1. APK 파일을 구형 안드로이드폰에 설치<br/>
                          2. SMS 읽기 권한 허용<br/>
                          3. 백그라운드 실행 권한 허용<br/>
                          4. 서버 URL 입력<br/>
                          5. 완료!
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                        * 안드로이드 앱은 Phase 2에서 제공됩니다.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ============================================ */}
          {/* 자동응답 탭 콘텐츠 */}
          {/* ============================================ */}

          {/* 자동응답 탭 0: 규칙 관리 */}
          {mainTab === 1 && replyTab === 0 && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h5">자동응답 규칙 관리</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingAutoReplyRule(null);
                    setAutoReplyRuleForm({
                      name: '',
                      keywords: '',
                      answerType: '템플릿',
                      answerTemplate: '',
                      priceConfig: '',
                      active: true,
                      priority: 10,
                      memo: ''
                    });
                    setShowAutoReplyRuleDialog(true);
                  }}
                >
                  규칙 추가
                </Button>
              </Box>

              <Grid container spacing={2}>
                {autoReplyRules.map(rule => (
                  <Grid item xs={12} md={6} lg={4} key={rule.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6">{rule.name}</Typography>
                          <Box>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingAutoReplyRule(rule);
                                setAutoReplyRuleForm({
                                  name: rule.name,
                                  keywords: rule.keywords,
                                  answerType: rule.answerType,
                                  answerTemplate: rule.answerTemplate,
                                  priceConfig: rule.priceConfig,
                                  active: rule.active,
                                  priority: rule.priority,
                                  memo: rule.memo
                                });
                                setShowAutoReplyRuleDialog(true);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteAutoReplyRule(rule.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          🔍 키워드: {rule.keywords || '없음'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          💬 답변: {rule.answerTemplate.substring(0, 30)}{rule.answerTemplate.length > 30 ? '...' : ''}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          📊 우선순위: {rule.priority}
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Chip
                            label={rule.answerType}
                            size="small"
                            color={rule.answerType === '템플릿' ? 'primary' : 'secondary'}
                            sx={{ mr: 1 }}
                          />
                          <Chip
                            label={rule.active ? '활성화' : '비활성화'}
                            size="small"
                            color={rule.active ? 'success' : 'default'}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* 자동응답 탭 1: 거래처 관리 */}
          {mainTab === 1 && replyTab === 1 && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h5">거래처 연락처 관리</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setContactForm({
                      type: '거래처',
                      salesPersonId: '',
                      name: '',
                      contact: '',
                      memo: ''
                    });
                    setShowContactDialog(true);
                  }}
                >
                  연락처 추가
                </Button>
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>유형</TableCell>
                      <TableCell>이름</TableCell>
                      <TableCell>연락처</TableCell>
                      <TableCell>담당영업사원</TableCell>
                      <TableCell>출처</TableCell>
                      <TableCell>등록일시</TableCell>
                      <TableCell>액션</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {autoReplyContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <Chip
                            label={contact.type}
                            size="small"
                            color={contact.type === '영업사원' ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{contact.name}</TableCell>
                        <TableCell>{contact.contact}</TableCell>
                        <TableCell>{contact.salesPersonId}</TableCell>
                        <TableCell>
                          <Chip label={contact.source} size="small" />
                        </TableCell>
                        <TableCell>{contact.createdAt || '-'}</TableCell>
                        <TableCell>
                          {contact.source === '앱' && (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => handleEditContact(contact)}
                                color="primary"
                                sx={{ mr: 1 }}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteContact(contact.id)}
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* 자동응답 탭 2: 응답 이력 */}
          {mainTab === 1 && replyTab === 2 && (
            <Box>
              <Typography variant="h5" gutterBottom>자동응답 이력</Typography>

              {/* 필터 */}
              <Box sx={{ mb: 2 }}>
                <Button
                  variant={autoReplyHistoryFilter === 'all' ? 'contained' : 'outlined'}
                  onClick={() => setAutoReplyHistoryFilter('all')}
                  size="small"
                >
                  전체
                </Button>
                <Button
                  variant={autoReplyHistoryFilter === '대기중' ? 'contained' : 'outlined'}
                  onClick={() => setAutoReplyHistoryFilter('대기중')}
                  size="small"
                  sx={{ ml: 1 }}
                >
                  대기중
                </Button>
                <Button
                  variant={autoReplyHistoryFilter === '발송완료' ? 'contained' : 'outlined'}
                  onClick={() => setAutoReplyHistoryFilter('발송완료')}
                  size="small"
                  sx={{ ml: 1 }}
                >
                  발송완료
                </Button>
                <Button
                  variant={autoReplyHistoryFilter === '실패' ? 'contained' : 'outlined'}
                  onClick={() => setAutoReplyHistoryFilter('실패')}
                  size="small"
                  sx={{ ml: 1 }}
                >
                  실패
                </Button>
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>수신일시</TableCell>
                      <TableCell>발신번호</TableCell>
                      <TableCell>거래처명</TableCell>
                      <TableCell>문의내용</TableCell>
                      <TableCell>매칭규칙</TableCell>
                      <TableCell>답변내용</TableCell>
                      <TableCell>발송번호</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>발송일시</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {autoReplyHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.receivedAt}</TableCell>
                        <TableCell>{h.sender}</TableCell>
                        <TableCell>{h.clientName}</TableCell>
                        <TableCell>{h.inquiry.substring(0, 30)}{h.inquiry.length > 30 ? '...' : ''}</TableCell>
                        <TableCell>{h.matchedRule}</TableCell>
                        <TableCell>{h.reply.substring(0, 30)}{h.reply.length > 30 ? '...' : ''}</TableCell>
                        <TableCell>{h.senderPhone}</TableCell>
                        <TableCell>
                          <Chip
                            label={h.status}
                            size="small"
                            color={
                              h.status === '발송완료' ? 'success' :
                              h.status === '대기중' ? 'warning' : 'error'
                            }
                          />
                        </TableCell>
                        <TableCell>{h.sentAt || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* 자동응답 탭 3: 설정 */}
          {mainTab === 1 && replyTab === 3 && (
            <Box>
              <Typography variant="h5" gutterBottom>자동응답 설정</Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>시스템 안내</Typography>
                      <Alert severity="info" sx={{ mt: 2 }}>
                        자동응답 시스템은 등록된 거래처/영업사원에게만 응답합니다.<br/>
                        규칙은 우선순위 순으로 확인되며, 첫 번째 매칭된 규칙으로 답변합니다.
                      </Alert>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="textSecondary">
                          활성 규칙: <strong>{autoReplyRules.filter(r => r.active).length}개</strong>
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                          등록된 연락처: <strong>{autoReplyContacts.length}개</strong>
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                          총 응답 이력: <strong>{autoReplyHistory.length}개</strong>
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </Container>
      </Box>

      {/* 자동응답 규칙 추가/수정 모달 */}
      <Dialog open={showAutoReplyRuleDialog} onClose={() => setShowAutoReplyRuleDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingAutoReplyRule ? '규칙 수정' : '규칙 추가'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="규칙명"
            value={autoReplyRuleForm.name}
            onChange={(e) => setAutoReplyRuleForm({ ...autoReplyRuleForm, name: e.target.value })}
            sx={{ mt: 1, mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="키워드 (쉼표로 구분)"
            value={autoReplyRuleForm.keywords}
            onChange={(e) => setAutoReplyRuleForm({ ...autoReplyRuleForm, keywords: e.target.value })}
            placeholder="영업시간,시간,몇시"
            helperText="여러 키워드를 쉼표로 구분하세요"
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>답변 유형</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={autoReplyRuleForm.answerType === '템플릿' ? 'contained' : 'outlined'}
                onClick={() => setAutoReplyRuleForm({ ...autoReplyRuleForm, answerType: '템플릿' })}
                size="small"
              >
                템플릿
              </Button>
              <Button
                variant={autoReplyRuleForm.answerType === '실시간가격' ? 'contained' : 'outlined'}
                onClick={() => setAutoReplyRuleForm({ ...autoReplyRuleForm, answerType: '실시간가격' })}
                size="small"
                disabled
              >
                실시간가격 (Phase 2)
              </Button>
            </Box>
          </Box>
          
          <TextField
            fullWidth
            label="답변 템플릿"
            value={autoReplyRuleForm.answerTemplate}
            onChange={(e) => setAutoReplyRuleForm({ ...autoReplyRuleForm, answerTemplate: e.target.value })}
            multiline
            rows={4}
            placeholder="안녕하세요! 영업시간은 평일 오전 9시 - 오후 6시입니다."
            helperText={
              autoReplyRuleForm.answerTemplate.length > 0 
                ? `${autoReplyRuleForm.answerTemplate.length}자 ${autoReplyRuleForm.answerTemplate.length > 200 ? '⚠️ 200자 초과 시 분할 전송될 수 있습니다' : ''}`
                : '답변 템플릿을 입력하세요 (권장: 200자 이내)'
            }
            error={autoReplyRuleForm.answerTemplate.length > 200}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            type="number"
            label="우선순위"
            value={autoReplyRuleForm.priority}
            onChange={(e) => setAutoReplyRuleForm({ ...autoReplyRuleForm, priority: parseInt(e.target.value) })}
            helperText="숫자가 낮을수록 우선순위가 높습니다"
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="메모"
            value={autoReplyRuleForm.memo}
            onChange={(e) => setAutoReplyRuleForm({ ...autoReplyRuleForm, memo: e.target.value })}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={autoReplyRuleForm.active}
                onChange={(e) => setAutoReplyRuleForm({ ...autoReplyRuleForm, active: e.target.checked })}
              />
            }
            label="활성화"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAutoReplyRuleDialog(false)}>취소</Button>
          <Button onClick={handleSaveAutoReplyRule} variant="contained">
            {editingAutoReplyRule ? '수정' : '추가'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 거래처 연락처 추가 모달 */}
      <Dialog open={showContactDialog} onClose={() => setShowContactDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>거래처/영업사원 추가</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, mt: 1 }}>
            <Typography variant="subtitle2" gutterBottom>유형</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={contactForm.type === '거래처' ? 'contained' : 'outlined'}
                onClick={() => setContactForm({ ...contactForm, type: '거래처' })}
                size="small"
              >
                거래처
              </Button>
              <Button
                variant={contactForm.type === '영업사원' ? 'contained' : 'outlined'}
                onClick={() => setContactForm({ ...contactForm, type: '영업사원' })}
                size="small"
              >
                영업사원
              </Button>
            </Box>
          </Box>
          
          <TextField
            fullWidth
            label={contactForm.type === '영업사원' ? '영업사원 ID' : '담당 영업사원 ID'}
            value={contactForm.salesPersonId}
            onChange={(e) => setContactForm({ ...contactForm, salesPersonId: e.target.value })}
            placeholder="담당자 연락처 (예: 010-1234-5678)"
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label={contactForm.type === '영업사원' ? '영업사원명' : '거래처명'}
            value={contactForm.name}
            onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="연락처"
            value={contactForm.contact}
            onChange={(e) => setContactForm({ ...contactForm, contact: e.target.value })}
            placeholder="010-9999-9999"
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="메모"
            value={contactForm.memo}
            onChange={(e) => setContactForm({ ...contactForm, memo: e.target.value })}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowContactDialog(false)}>취소</Button>
          <Button onClick={handleSaveContact} variant="contained">
            추가
          </Button>
        </DialogActions>
      </Dialog>

      {/* 데이터 정리 모달 */}
      <Dialog open={showCleanupDialog} onClose={() => setShowCleanupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>데이터 정리</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            선택한 기간 이전의 데이터가 영구적으로 삭제됩니다.
          </Alert>
          
          <Typography variant="subtitle2" gutterBottom>삭제 기준 날짜</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant={cleanupDays === 0 ? 'contained' : 'outlined'}
              onClick={() => setCleanupDays(0)}
              size="small"
              color="error"
            >
              전체 삭제
            </Button>
            <Button
              variant={cleanupDays === 7 ? 'contained' : 'outlined'}
              onClick={() => setCleanupDays(7)}
              size="small"
            >
              7일 이전
            </Button>
            <Button
              variant={cleanupDays === 30 ? 'contained' : 'outlined'}
              onClick={() => setCleanupDays(30)}
              size="small"
            >
              30일 이전
            </Button>
            <Button
              variant={cleanupDays === 90 ? 'contained' : 'outlined'}
              onClick={() => setCleanupDays(90)}
              size="small"
            >
              90일 이전
            </Button>
          </Box>
          
          <TextField
            fullWidth
            type="number"
            label="사용자 지정 (일)"
            value={cleanupDays}
            onChange={(e) => setCleanupDays(parseInt(e.target.value) || 0)}
            helperText={cleanupDays === 0 ? '⚠️ 모든 데이터가 삭제됩니다!' : `${cleanupDays}일 이전의 데이터가 삭제됩니다`}
            sx={{ mb: 2 }}
          />
          
          <Typography variant="subtitle2" gutterBottom>정리 대상</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant={cleanupTarget === 'sms' ? 'contained' : 'outlined'}
              onClick={() => setCleanupTarget('sms')}
              size="small"
            >
              SMS만
            </Button>
            <Button
              variant={cleanupTarget === 'history' ? 'contained' : 'outlined'}
              onClick={() => setCleanupTarget('history')}
              size="small"
            >
              이력만
            </Button>
            <Button
              variant={cleanupTarget === 'all' ? 'contained' : 'outlined'}
              onClick={() => setCleanupTarget('all')}
              size="small"
              color="error"
            >
              SMS + 이력
            </Button>
          </Box>
          
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
            * 전달 규칙은 삭제되지 않습니다.
          </Typography>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
            * 헤더는 항상 유지됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCleanupDialog(false)}>취소</Button>
          <Button onClick={handleCleanupData} variant="contained" color="error">
            {cleanupDays === 0 ? '전체 삭제' : `${cleanupDays}일 이전 삭제`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 수동 전달 모달 */}
      <Dialog open={showForwardDialog} onClose={() => setShowForwardDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>SMS 전달</DialogTitle>
        <DialogContent>
          {forwardingSms && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                발신: {forwardingSms.sender} / 수신: {forwardingSms.receiver}
              </Typography>
              <Typography variant="body2" gutterBottom>
                {forwardingSms.message}
              </Typography>
            </Box>
          )}
          
          <TextField
            fullWidth
            label="전달할 번호"
            value={forwardTargetInput}
            onChange={(e) => setForwardTargetInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addForwardTarget();
              }
            }}
            placeholder="010-1234-5678"
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={addForwardTarget}>
                    <AddIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          
          <Box sx={{ mb: 2 }}>
            {forwardTargets.map((num, idx) => (
              <Chip
                key={idx}
                label={num}
                onDelete={() => setForwardTargets(forwardTargets.filter((_, i) => i !== idx))}
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Box>
          
          <TextField
            fullWidth
            label="메모"
            value={forwardMemo}
            onChange={(e) => setForwardMemo(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowForwardDialog(false)}>취소</Button>
          <Button onClick={handleForwardSms} variant="contained" startIcon={<SendIcon />}>
            전달 ({forwardTargets.length}개)
          </Button>
        </DialogActions>
      </Dialog>

      {/* 규칙 추가/수정 모달 */}
      <Dialog open={showRuleDialog} onClose={() => setShowRuleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRule ? '규칙 수정' : '규칙 추가'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="규칙명"
            value={ruleForm.name}
            onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
            sx={{ mt: 1, mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="수신번호 필터 (어느 폰) - 선택사항"
            value={ruleForm.receiverFilter}
            onChange={(e) => setRuleForm({ ...ruleForm, receiverFilter: e.target.value })}
            placeholder="010-9999-9999 (특정 폰에서 받은 것만)"
            helperText="비워두면 모든 폰에서 수신한 SMS 확인"
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="발신번호 필터 (누가 보낸) - 선택사항"
            value={ruleForm.senderFilter}
            onChange={(e) => setRuleForm({ ...ruleForm, senderFilter: e.target.value })}
            placeholder="010-1234-5678 (특정 발신번호만)"
            helperText="비워두면 모든 발신번호 허용"
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="키워드 필터 (무슨 내용) - 선택사항"
            value={ruleForm.keywordFilter}
            onChange={(e) => setRuleForm({ ...ruleForm, keywordFilter: e.target.value })}
            placeholder="긴급,중요,알림 (키워드 중 하나라도 포함되면 OK)"
            helperText="비워두면 모든 내용 허용"
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="전달대상 번호"
            value={targetNumberInput}
            onChange={(e) => setTargetNumberInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addRuleTarget();
              }
            }}
            placeholder="010-1234-5678"
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={addRuleTarget}>
                    <AddIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          
          <Box sx={{ mb: 2 }}>
            {ruleForm.targetNumbers.map((num, idx) => (
              <Chip
                key={idx}
                label={num}
                onDelete={() => setRuleForm({
                  ...ruleForm,
                  targetNumbers: ruleForm.targetNumbers.filter((_, i) => i !== idx)
                })}
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Box>
          
          <TextField
            fullWidth
            label="메모"
            value={ruleForm.memo}
            onChange={(e) => setRuleForm({ ...ruleForm, memo: e.target.value })}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={ruleForm.autoForward}
                onChange={(e) => setRuleForm({ ...ruleForm, autoForward: e.target.checked })}
              />
            }
            label="자동 전달"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={ruleForm.active}
                onChange={(e) => setRuleForm({ ...ruleForm, active: e.target.checked })}
              />
            }
            label="활성화"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRuleDialog(false)}>취소</Button>
          <Button onClick={handleSaveRule} variant="contained">
            {editingRule ? '수정' : '추가'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 상세보기 모달 */}
      <Dialog open={showDetailDialog} onClose={() => setShowDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>SMS 상세보기</DialogTitle>
        <DialogContent>
          {detailSms && (
            <Box>
              <Typography variant="subtitle2" color="textSecondary">수신일시</Typography>
              <Typography variant="body1" gutterBottom>{detailSms.receivedAt}</Typography>
              
              <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>발신번호</Typography>
              <Typography variant="body1" gutterBottom>{detailSms.sender}</Typography>
              
              <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>수신번호</Typography>
              <Typography variant="body1" gutterBottom>{detailSms.receiver}</Typography>
              
              <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>메시지</Typography>
              <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', mb: 2 }}>
                <Typography variant="body1">{detailSms.message}</Typography>
              </Paper>
              
              <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>전달 이력</Typography>
              {detailHistory.length > 0 ? (
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>전달일시</TableCell>
                      <TableCell>전달번호</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>처리방식</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detailHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.forwardedAt}</TableCell>
                        <TableCell>{h.targetNumber}</TableCell>
                        <TableCell>
                          <Chip
                            label={h.status}
                            color={h.status === '성공' ? 'success' : 'error'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{h.processType}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="textSecondary">전달 이력이 없습니다.</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetailDialog(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="smsManagement"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          console.log('SMS 관리모드 새 업데이트가 추가되었습니다.');
        }}
      />
    </Box>
  );
};

export default SmsManagementMode;
