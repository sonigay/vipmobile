import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Box, 
  Chip,
  Menu,
  MenuItem,
  Button
} from '@mui/material';
import { 
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { isMobile } from '../utils/mobileUtils';

const MobileHeader = ({
  title,
  subtitle,
  onMenuClick,
  onLogout,
  onNotificationsClick,
  onSettingsClick,
  onInfoClick,
  showNotifications = false,
  notificationCount = 0,
  userInfo = null,
  stats = null,
  isInventoryMode = false,
  isAssignmentMode = false
}) => {
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogoutClick = () => {
    handleMenuClose();
    onLogout();
  };

  const handleSettingsClick = () => {
    handleMenuClose();
    onSettingsClick();
  };

  const handleInfoClick = () => {
    handleMenuClose();
    onInfoClick();
  };

  // 모바일이 아닌 경우 렌더링하지 않음
  if (!isMobile()) {
    return null;
  }

  return (
    <AppBar 
      position="sticky" 
      sx={{ 
        backgroundColor: '#ffffff',
        color: '#333',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderBottom: '1px solid #e0e0e0'
      }}
    >
      <Toolbar sx={{ minHeight: '56px', padding: '0 16px' }}>
        {/* 메뉴 버튼 */}
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
          sx={{ marginRight: 1 }}
        >
          <MenuIcon />
        </IconButton>

        {/* 제목 영역 */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontSize: '16px',
              fontWeight: 600,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                fontSize: '12px',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>

        {/* 통계 정보 */}
        {stats && (
          <Box sx={{ display: 'flex', gap: 0.5, marginRight: 1 }}>
            {stats.phones && (
              <Chip
                label={`휴대폰: ${stats.phones}`}
                size="small"
                sx={{ 
                  fontSize: '10px',
                  height: '20px',
                  backgroundColor: '#e8f5e8',
                  color: '#2e7d32'
                }}
              />
            )}
            {stats.wearables && (
              <Chip
                label={`웨어러블: ${stats.wearables}`}
                size="small"
                sx={{ 
                  fontSize: '10px',
                  height: '20px',
                  backgroundColor: '#fff3e0',
                  color: '#f57c00'
                }}
              />
            )}
            {stats.tablets && (
              <Chip
                label={`태블릿: ${stats.tablets}`}
                size="small"
                sx={{ 
                  fontSize: '10px',
                  height: '20px',
                  backgroundColor: '#f3e5f5',
                  color: '#7b1fa2'
                }}
              />
            )}
          </Box>
        )}

        {/* 알림 버튼 */}
        {showNotifications && (
          <IconButton
            color="inherit"
            onClick={onNotificationsClick}
            sx={{ marginRight: 1 }}
          >
            <NotificationsIcon />
            {notificationCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  backgroundColor: '#f44336',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </Box>
            )}
          </IconButton>
        )}

        {/* 사용자 메뉴 */}
        <IconButton
          color="inherit"
          onClick={handleMenuOpen}
          sx={{ marginLeft: 0.5 }}
        >
          <AccountCircleIcon />
        </IconButton>

        {/* 사용자 메뉴 드롭다운 */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          PaperProps={{
            sx: {
              minWidth: '200px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              borderRadius: '8px',
              border: '1px solid #e0e0e0'
            }
          }}
        >
          {/* 사용자 정보 */}
          {userInfo && (
            <MenuItem disabled sx={{ opacity: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
                  {userInfo.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {userInfo.role}
                </Typography>
              </Box>
            </MenuItem>
          )}

          {/* 설정 */}
          <MenuItem onClick={handleSettingsClick}>
            <SettingsIcon sx={{ marginRight: 1, fontSize: '20px' }} />
            <Typography variant="body2">설정</Typography>
          </MenuItem>

          {/* 정보 */}
          <MenuItem onClick={handleInfoClick}>
            <InfoIcon sx={{ marginRight: 1, fontSize: '20px' }} />
            <Typography variant="body2">정보</Typography>
          </MenuItem>

          {/* 구분선 */}
          <Box sx={{ borderTop: '1px solid #e0e0e0', margin: '4px 0' }} />

          {/* 로그아웃 */}
          <MenuItem onClick={handleLogoutClick} sx={{ color: '#f44336' }}>
            <LogoutIcon sx={{ marginRight: 1, fontSize: '20px' }} />
            <Typography variant="body2">로그아웃</Typography>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default MobileHeader; 