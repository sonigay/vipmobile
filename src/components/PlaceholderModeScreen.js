import React, { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Paper,
  Box,
  Stack,
  Chip
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import UpdateIcon from '@mui/icons-material/Update';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AppUpdatePopup from './AppUpdatePopup';
import {
  getModeColor,
  getModeConfig,
  getModeTitle
} from '../config/modeConfig';

const PlaceholderModeScreen = ({
  modeKey,
  onLogout,
  onModeChange,
  availableModes = [],
  loggedInStore
}) => {
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  const modeConfig = useMemo(() => getModeConfig(modeKey), [modeKey]);
  const modeColor = useMemo(() => getModeColor(modeKey), [modeKey]);
  const modeTitle = useMemo(() => getModeTitle(modeKey, '준비중 모드'), [modeKey]);
  const modeDescription = modeConfig?.description || '준비 중인 기능입니다. 빠른 시일 내에 공개될 예정입니다.';
  const features = modeConfig?.features || [];
  const sheetRefs = modeConfig?.sheetRefs || {};
  const permissionRef = sheetRefs.admin || sheetRefs.general || '';
  const updateRef = sheetRefs.updates || '';

  useEffect(() => {
    const hideUntil = localStorage.getItem(`hideUpdate_${modeKey}`);
    if (!hideUntil || new Date() >= new Date(hideUntil)) {
      setShowUpdatePopup(true);
    }
  }, [modeKey]);

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: modeColor }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" component="div">
              {modeTitle}
            </Typography>
            {loggedInStore?.name && (
              <Chip
                icon={<InfoOutlinedIcon />}
                label={loggedInStore.name}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  color: 'white',
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {typeof onModeChange === 'function' && (availableModes?.length || 0) > 1 && (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<SwapHorizIcon />}
                onClick={onModeChange}
                sx={{
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.8)'
                  }
                }}
              >
                모드 변경
              </Button>
            )}
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<UpdateIcon />}
              onClick={() => setShowUpdatePopup(true)}
              sx={{
                borderColor: 'rgba(255,255,255,0.5)',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.8)'
                }
              }}
            >
              업데이트 확인
            </Button>
            {typeof onLogout === 'function' && (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={onLogout}
                sx={{
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.8)'
                  }
                }}
              >
                로그아웃
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <Paper
          elevation={3}
          sx={{
            maxWidth: 720,
            width: '100%',
            p: { xs: 3, md: 5 },
            borderRadius: 3,
            textAlign: 'center'
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, color: modeColor }}>
            준비 중입니다
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
            {modeDescription}
          </Typography>

          {features.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                예상 제공 기능
              </Typography>
              <Stack spacing={1.5} alignItems="center">
                {features.map((feature, index) => (
                  <Stack
                    direction="row"
                    spacing={1}
                    key={index}
                    alignItems="center"
                    sx={{ width: '100%', maxWidth: 480 }}
                  >
                    <CheckCircleIcon sx={{ fontSize: 18, color: modeColor }} />
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
                      {feature}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              참고 사항
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              현재 모드는 구축 중입니다. 권한 및 업데이트 시트 컬럼 정보는 아래를 참고하여 시트 구조 변경 시
              반드시 함께 수정해주세요.
            </Typography>
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
          </Box>

          <Typography variant="body2" color="text.secondary">
            개발 및 테스트가 완료되는 대로 공지드리겠습니다.
          </Typography>
        </Paper>
      </Container>

      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode={modeKey}
        loggedInStore={loggedInStore}
      />
    </>
  );
};

export default PlaceholderModeScreen;

