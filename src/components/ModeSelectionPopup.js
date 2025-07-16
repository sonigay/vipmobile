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
  CheckCircle as CheckCircleIcon
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
      description: '장표 및 차트 생성 시스템',
      icon: <BarChartIcon sx={{ fontSize: 40, color: '#e91e63' }} />,
      color: '#e91e63',
      features: [
        '차트 및 그래프 생성',
        '데이터 시각화',
        '장표 템플릿 관리',
        '보고서 자동 생성'
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