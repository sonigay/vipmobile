import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip
} from '@mui/material';
import {
  Business as BusinessIcon,
  Inventory as InventoryIcon,
  AccountBalance as SettlementIcon,
  Assignment as AssignmentIcon,
  BarChart as BarChartIcon,
  Policy as PolicyIcon,
  MeetingRoom as MeetingRoomIcon,
  Event as EventIcon,
  CheckCircle as CheckCircleIcon,
  AccountBalance as BudgetIcon,
  TrendingUp as SalesIcon,
  Refresh as RefreshIcon,
  DataUsage as DataUsageIcon,
  Message as MessageIcon,
  Phone as PhoneIcon
} from '@mui/icons-material';

const ModeSelectionPopup = ({ 
  open, 
  onClose, 
  availableModes, 
  onModeSelect, 
  onModeSwitch,
  isModeSwitch = false,
  userName = '사용자' 
}) => {
  const modeConfigs = {
    agent: {
      title: '관리자 모드',
      description: '담당 매장들의 재고 현황 관리 및 개통실적 확인',
      icon: <BusinessIcon sx={{ fontSize: 40, color: '#1976d2' }} />,
      color: '#1976d2',
      features: [
        '담당 매장 재고 현황',
        '개통실적 확인 및 분석',
        '실시간 알림 시스템',
        '매장별 상세 정보'
      ]
    },
    inventory: {
      title: '재고 관리 모드',
      description: '전체 재고 감사, 배정 관리 및 실시간 대시보드',
      icon: <InventoryIcon sx={{ fontSize: 40, color: '#2e7d32' }} />,
      color: '#2e7d32',
      features: [
        '재고 감사 및 마스터 관리',
        '재고 배정 시스템',
        '중복 케이스 관리',
        '실시간 대시보드'
      ]
    },
    settlement: {
      title: '정산 모드',
      description: '엑셀 파일 업로드/다운로드 및 정산 데이터 처리',
      icon: <SettlementIcon sx={{ fontSize: 40, color: '#d32f2f' }} />,
      color: '#d32f2f',
      features: [
        '엑셀 파일 업로드',
        '정산 데이터 처리',
        '파일 형식 검증',
        '데이터 내보내기'
      ]
    },
    inspection: {
      title: '검수 모드',
      description: '검수 및 품질 관리 시스템',
      icon: <AssignmentIcon sx={{ fontSize: 40, color: '#7b1fa2' }} />,
      color: '#7b1fa2',
      features: [
        '검수 프로세스 관리',
        '품질 기준 설정',
        '검수 결과 기록',
        '검수 리포트 생성'
      ]
    },
    chart: {
      title: '장표 모드',
      description: '채권장표 및 기타 장표 기능 (권한에 따라 메뉴 제한)',
      icon: <BarChartIcon sx={{ fontSize: 40, color: '#ff9800' }} />,
      color: '#ff9800',
      features: [
        '채권장표 OCR 처리',
        '이미지 업로드 및 분석',
        '데이터 편집 및 저장',
        '권한별 메뉴 접근 제어'
      ]
    },
    policy: {
      title: '정책 모드',
      description: '정책 및 규정 관리 시스템',
      icon: <PolicyIcon sx={{ fontSize: 40, color: '#00bcd4' }} />,
      color: '#00bcd4',
      features: [
        '정책 문서 관리',
        '규정 업데이트',
        '정책 공지사항',
        '정책 이력 추적'
      ]
    },
    meeting: {
      title: '회의 모드',
      description: '회의 및 일정 관리 시스템',
      icon: <MeetingRoomIcon sx={{ fontSize: 40, color: '#667eea' }} />,
      color: '#667eea',
      features: [
        '회의 일정 관리',
        '회의실 예약',
        '참석자 관리',
        '회의록 작성'
      ]
    },
    reservation: {
      title: '사전예약 모드',
      description: '사전예약 및 일정 관리 시스템',
      icon: <EventIcon sx={{ fontSize: 40, color: '#ff9a9e' }} />,
      color: '#ff9a9e',
      features: [
        '사전예약 관리',
        '일정 조율',
        '알림 시스템',
        '예약 현황 확인'
      ]
    },
    budget: {
      title: '예산 모드',
      description: '예산 관리 및 분석 시스템',
      icon: <BudgetIcon sx={{ fontSize: 40, color: '#795548' }} />,
      color: '#795548',
      features: [
        '액면예산 관리',
        '별도추가 관리',
        '부가추가지원 관리',
        '부가차감지원 관리'
      ]
    },
    sales: {
      title: '영업 모드',
      description: '지도 기반 실적 시각화 및 영업 데이터 분석',
      icon: <SalesIcon sx={{ fontSize: 40, color: '#e91e63' }} />,
      color: '#e91e63',
      features: [
        '지도 기반 실적 표시',
        'POS코드별 실적 집계',
        '지역별 실적 분석',
        '실시간 필터링'
      ]
    },
    inventoryRecovery: {
      title: '재고회수 모드',
      description: '재고 회수 및 관리 시스템',
      icon: <RefreshIcon sx={{ fontSize: 40, color: '#8bc34a' }} />,
      color: '#8bc34a',
      features: [
        '재고 회수 현황 관리',
        '회수 통계 분석',
        '자동화 프로세스',
        '회수 알림 시스템'
      ]
    },
    dataCollection: {
      title: '정보수집 모드',
      description: '데이터 수집 및 분석 시스템',
      icon: <DataUsageIcon sx={{ fontSize: 40, color: '#9c27b0' }} />,
      color: '#9c27b0',
      features: [
        '데이터 수집 및 관리',
        '정보 분석 및 통계',
        '자동화된 데이터 처리',
        '실시간 모니터링'
      ]
    },
    smsManagement: {
      title: 'SMS 관리 모드',
      description: 'SMS 수신 및 전달 관리 시스템',
      icon: <MessageIcon sx={{ fontSize: 40, color: '#00897B' }} />,
      color: '#00897B',
      features: [
        'SMS 자동 수신',
        '번호별 전달 설정',
        '전송 이력 관리',
        '실시간 모니터링'
      ]
    },
    obManagement: {
      title: 'OB 관리 모드',
      description: 'OB(Outbound) 관리 및 추적 시스템',
      icon: <PhoneIcon sx={{ fontSize: 40, color: '#5E35B1' }} />,
      color: '#5E35B1',
      features: [
        'OB 데이터 관리',
        '발신 현황 추적',
        '성과 분석',
        '자동화 설정'
      ]
    },
    onSaleManagement: {
      title: '온세일관리 모드',
      description: '온세일 가입 링크 관리 시스템',
      icon: <PhoneIcon sx={{ fontSize: 40, color: '#667eea' }} />,
      color: '#667eea',
      features: [
        '가입 링크 등록/수정',
        '대리점 정보 숨김 설정',
        '링크 활성화 관리',
        '접근 권한 제어'
      ]
    },
    basicMode: {
      title: '기본 모드',
      description: '매장 재고 확인 및 주변 매장 검색',
      icon: <BusinessIcon sx={{ fontSize: 40, color: '#1976d2' }} />,
      color: '#1976d2',
      features: [
        '지도 기반 매장 검색',
        '재고 확인 및 요청',
        '주변 매장 찾기',
        '실시간 재고 현황'
      ]
    },
    onSaleReception: {
      title: '온세일접수 모드',
      description: '온세일 가입 신청 접수',
      icon: <PhoneIcon sx={{ fontSize: 40, color: '#667eea' }} />,
      color: '#667eea',
      features: [
        '온세일 가입 링크 접근',
        '대리점 정보 보호',
        '비밀번호 기반 인증',
        '안전한 가입 접수'
      ]
    }
  };

  const handleModeSelect = (mode) => {
    console.log('ModeSelectionPopup handleModeSelect 호출됨:', mode);
    console.log('isModeSwitch:', isModeSwitch);
    console.log('onModeSwitch 존재:', !!onModeSwitch);
    console.log('onModeSelect 존재:', !!onModeSelect);
    
    if (isModeSwitch && onModeSwitch) {
      console.log('모드 전환 핸들러 호출');
      onModeSwitch(mode);
    } else if (onModeSelect) {
      console.log('초기 로그인 모드 선택 핸들러 호출');
      onModeSelect(mode);
    } else {
      console.log('적절한 핸들러가 없음');
    }
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
        }
      }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center', 
        pb: 1,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '12px 12px 0 0'
      }}>
        <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
          모드 선택
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
          {userName}님, 접속할 모드를 선택해주세요
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {availableModes.map((mode) => {
            const config = modeConfigs[mode];
            if (!config) return null;

            return (
              <Grid item xs={12} md={4} key={mode}>
                <Card 
                  sx={{ 
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: '2px solid transparent',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                      borderColor: config.color
                    }
                  }}
                  onClick={() => handleModeSelect(mode)}
                >
                  <CardContent sx={{ 
                    textAlign: 'center', 
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <Box>
                      <Box sx={{ mb: 2 }}>
                        {config.icon}
                      </Box>
                      
                      <Typography variant="h6" component="div" sx={{ 
                        fontWeight: 600, 
                        mb: 1,
                        color: config.color
                      }}>
                        {config.title}
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {config.description}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        주요 기능:
                      </Typography>
                      {config.features.map((feature, index) => (
                        <Box key={index} sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          mb: 0.5 
                        }}>
                          <CheckCircleIcon sx={{ 
                            fontSize: 16, 
                            color: config.color, 
                            mr: 1 
                          }} />
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {feature}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    <Button
                      variant="contained"
                      fullWidth
                      sx={{ 
                        mt: 2,
                        backgroundColor: config.color,
                        '&:hover': {
                          backgroundColor: config.color,
                          opacity: 0.9
                        }
                      }}
                    >
                      선택하기
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} variant="outlined">
          취소
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModeSelectionPopup; 