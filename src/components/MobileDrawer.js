import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  IconButton,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  Map as MapIcon,
  Inventory as InventoryIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Assignment as AssignmentIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  Info as InfoIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { isMobile } from '../utils/mobileUtils';

const MobileDrawer = ({
  open,
  onClose,
  currentSection,
  onSectionChange,
  userInfo = null,
  isInventoryMode = false,
  isAssignmentMode = false,
  isAgentMode = false,
  stats = null
}) => {
  const handleSectionClick = (section) => {
    onSectionChange(section);
    onClose();
  };

  // 모바일이 아닌 경우 렌더링하지 않음
  if (!isMobile()) {
    return null;
  }

  // 재고모드 메뉴 아이템
  const inventoryMenuItems = [
    {
      id: 'inventory',
      label: '재고확인',
      icon: <InventoryIcon />,
      description: '전체 재고 현황 확인'
    },
    {
      id: 'assignment-settings',
      label: '배정설정',
      icon: <SettingsIcon />,
      description: '배정 비율 및 대상 설정'
    },
    {
      id: 'department-assignment',
      label: '부서배정',
      icon: <BusinessIcon />,
      description: '부서별 재고 배정'
    },
    {
      id: 'office-assignment',
      label: '지점배정',
      icon: <StoreIcon />,
      description: '지점별 재고 배정'
    },
    {
      id: 'sales-assignment',
      label: '영업사원배정',
      icon: <PersonIcon />,
      description: '영업사원별 재고 배정'
    }
  ];

  // 재고배정 모드 메뉴 아이템
  const assignmentMenuItems = [
    {
      id: 'settings',
      label: '배정설정',
      icon: <SettingsIcon />,
      description: '배정 비율 및 대상 설정'
    },
    {
      id: 'department',
      label: '부서배정',
      icon: <BusinessIcon />,
      description: '부서별 재고 배정'
    },
    {
      id: 'office',
      label: '지점배정',
      icon: <StoreIcon />,
      description: '지점별 재고 배정'
    },
    {
      id: 'sales',
      label: '영업사원배정',
      icon: <PersonIcon />,
      description: '영업사원별 재고 배정'
    }
  ];

  // 일반 모드 메뉴 아이템
  const generalMenuItems = [
    {
      id: 'map',
      label: '지도',
      icon: <MapIcon />,
      description: '매장 위치 및 재고 확인'
    },
    {
      id: 'inventory',
      label: '재고',
      icon: <InventoryIcon />,
      description: '재고 현황 및 관리'
    },
    {
      id: 'history',
      label: '이력',
      icon: <HistoryIcon />,
      description: '배정 이력 및 통계'
    },
    {
      id: 'settings',
      label: '설정',
      icon: <SettingsIcon />,
      description: '시스템 설정'
    }
  ];

  // 현재 모드에 따른 메뉴 아이템 선택
  const menuItems = isInventoryMode 
    ? inventoryMenuItems 
    : isAssignmentMode 
    ? assignmentMenuItems 
    : generalMenuItems;

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 280,
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e0e0e0'
        }
      }}
    >
      {/* 헤더 */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#f8f9fa'
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
          {isInventoryMode ? '재고 관리' : isAssignmentMode ? '재고 배정' : '메뉴'}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* 사용자 정보 */}
      {userInfo && (
        <Box sx={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: 1 }}>
            <PersonIcon sx={{ marginRight: 1, color: '#666' }} />
            <Typography variant="body1" sx={{ fontWeight: 600, color: '#333' }}>
              {userInfo.name}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 1 }}>
            {userInfo.role}
          </Typography>
          {userInfo.target && (
            <Chip
              label={userInfo.target}
              size="small"
              sx={{ 
                backgroundColor: '#e3f2fd',
                color: '#1976d2',
                fontSize: '12px'
              }}
            />
          )}
        </Box>
      )}

      {/* 통계 정보 */}
      {stats && (
        <Box sx={{ padding: '16px', borderBottom: '1px solid #f0f0f0', backgroundColor: '#f8f9fa' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1, color: '#333' }}>
            현재 통계
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {stats.phones && (
              <Chip
                label={`휴대폰: ${stats.phones}`}
                size="small"
                sx={{ 
                  fontSize: '11px',
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
                  fontSize: '11px',
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
                  fontSize: '11px',
                  backgroundColor: '#f3e5f5',
                  color: '#7b1fa2'
                }}
              />
            )}
          </Box>
        </Box>
      )}

      {/* 메뉴 아이템 */}
      <List sx={{ padding: 0 }}>
        {menuItems.map((item, index) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton
              selected={currentSection === item.id}
              onClick={() => handleSectionClick(item.id)}
              sx={{
                padding: '12px 16px',
                '&.Mui-selected': {
                  backgroundColor: '#e3f2fd',
                  '&:hover': {
                    backgroundColor: '#e3f2fd',
                  }
                },
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                }
              }}
            >
              <ListItemIcon sx={{ 
                minWidth: 40,
                color: currentSection === item.id ? '#1976d2' : '#666'
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: currentSection === item.id ? 600 : 400,
                      color: currentSection === item.id ? '#1976d2' : '#333'
                    }}
                  >
                    {item.label}
                  </Typography>
                }
                secondary={
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ fontSize: '11px' }}
                  >
                    {item.description}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* 추가 메뉴 */}
      <List sx={{ padding: 0 }}>
        <ListItem disablePadding>
          <ListItemButton sx={{ padding: '12px 16px' }}>
            <ListItemIcon sx={{ minWidth: 40, color: '#666' }}>
              <NotificationsIcon />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ color: '#333' }}>
                  알림 설정
                </Typography>
              }
              secondary={
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                  알림 및 공지사항 관리
                </Typography>
              }
            />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton sx={{ padding: '12px 16px' }}>
            <ListItemIcon sx={{ minWidth: 40, color: '#666' }}>
              <InfoIcon />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ color: '#333' }}>
                  시스템 정보
                </Typography>
              }
              secondary={
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                  버전 및 업데이트 정보
                </Typography>
              }
            />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton sx={{ padding: '12px 16px' }}>
            <ListItemIcon sx={{ minWidth: 40, color: '#666' }}>
              <HelpIcon />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ color: '#333' }}>
                  도움말
                </Typography>
              }
              secondary={
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                  사용법 및 가이드
                </Typography>
              }
            />
          </ListItemButton>
        </ListItem>
      </List>

      {/* 하단 정보 */}
      <Box sx={{ 
        marginTop: 'auto', 
        padding: '16px', 
        borderTop: '1px solid #f0f0f0',
        backgroundColor: '#f8f9fa'
      }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          JEGO 재고관리 시스템
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', marginTop: 0.5 }}>
          v1.0.0
        </Typography>
      </Box>
    </Drawer>
  );
};

export default MobileDrawer; 