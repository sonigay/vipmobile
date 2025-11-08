import React, { useMemo } from 'react';
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
  Box
} from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import {
  getModeConfig,
  getModeColor,
  getModeIcon,
  MODE_ORDER,
  resolveModeKey
} from '../config/modeConfig';

const ModeSelectionPopup = ({
  open, 
  onClose, 
  availableModes, 
  onModeSelect, 
  onModeSwitch,
  isModeSwitch = false,
  userName = '사용자' 
}) => {
  const orderedModes = useMemo(() => {
    if (!Array.isArray(availableModes)) return [];
    const modeMap = new Map(availableModes.map(mode => [resolveModeKey(mode), mode]));
    const sorted = MODE_ORDER.filter((key) => modeMap.has(key)).map((key) => modeMap.get(key));
    const remaining = availableModes.filter(mode => !sorted.includes(mode));
    return [...sorted, ...remaining];
  }, [availableModes]);

  const handleModeSelect = (mode) => {
    console.log('ModeSelectionPopup handleModeSelect 호출됨:', mode);
    console.log('isModeSwitch:', isModeSwitch);
    console.log('onModeSwitch 존재:', !!onModeSwitch);
    console.log('onModeSelect 존재:', !!onModeSelect);
    
    if (isModeSwitch && onModeSwitch) {
      console.log('모드 전환 핸들러 호출');
      onModeSwitch(mode);
      // 모드 전환의 경우 핸들러에서 팝업을 닫음
      onClose();
    } else if (onModeSelect) {
      console.log('초기 로그인 모드 선택 핸들러 호출');
      // 초기 로그인의 경우 핸들러가 팝업을 닫도록 함 (비밀번호 모달 등 추가 처리가 필요할 수 있음)
      // completeModeSelection에서 팝업을 닫으므로 여기서는 닫지 않음
      onModeSelect(mode);
    } else {
      console.log('적절한 핸들러가 없음');
      onClose();
    }
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
          {orderedModes.map((mode) => {
            const config = getModeConfig(mode);

            if (!config) {
              console.warn(`⚠️ [ModeSelectionPopup] 모드 ${mode}에 대한 설정을 찾을 수 없습니다.`);
              return null;
            }

            const iconColor = getModeColor(mode);
            const IconComponent = getModeIcon(mode);
            const permissionRef = config.sheetRefs?.admin || config.sheetRefs?.general || '';
            const updateRef = config.sheetRefs?.updates || '';

            return (
              <Grid item xs={12} md={4} key={mode}>
                <Card
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: '2px solid transparent',
                    background: 'transparent',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                      borderColor: iconColor
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
                        <IconComponent sx={{ fontSize: 40, color: iconColor }} />
                      </Box>

                      <Typography variant="h6" component="div" sx={{
                        fontWeight: 600,
                        mb: 1,
                        color: iconColor
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
                            color: iconColor, 
                            mr: 1 
                          }} />
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {feature}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {(permissionRef || updateRef) && (
                      <Box sx={{ mt: 2 }}>
                        {permissionRef && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            권한 시트: {permissionRef}
                          </Typography>
                        )}
                        {updateRef && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            업데이트 시트: {updateRef}
                          </Typography>
                        )}
                      </Box>
                    )}

                    <Button
                      variant="contained"
                      fullWidth
                      sx={{ 
                        mt: 2,
                        backgroundColor: iconColor,
                        '&:hover': {
                          backgroundColor: iconColor,
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