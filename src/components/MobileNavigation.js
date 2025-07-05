import React, { useState, useEffect } from 'react';
import { Box, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { 
  Map as MapIcon, 
  Inventory as InventoryIcon, 
  History as HistoryIcon, 
  Settings as SettingsIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { isMobile } from '../utils/mobileUtils';

const MobileNavigation = ({ 
  currentSection, 
  onSectionChange, 
  isInventoryMode = false,
  isAssignmentMode = false 
}) => {
  const [value, setValue] = useState(currentSection || 'map');

  useEffect(() => {
    setValue(currentSection || 'map');
  }, [currentSection]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
    onSectionChange(newValue);
  };

  // 모바일이 아닌 경우 렌더링하지 않음
  if (!isMobile()) {
    return null;
  }

  // 재고모드일 때는 다른 네비게이션 표시
  if (isInventoryMode) {
    return (
      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          zIndex: 1000,
          borderTop: '1px solid #e0e0e0'
        }} 
        elevation={3}
      >
        <BottomNavigation
          value={value}
          onChange={handleChange}
          showLabels
          sx={{
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '6px 12px 8px',
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '12px',
              marginTop: '4px',
            },
            '& .MuiSvgIcon-root': {
              fontSize: '24px',
            }
          }}
        >
          <BottomNavigationAction
            label="재고확인"
            value="inventory"
            icon={<InventoryIcon />}
          />
          <BottomNavigationAction
            label="배정설정"
            value="assignment-settings"
            icon={<AssignmentIcon />}
          />
          <BottomNavigationAction
            label="부서배정"
            value="department-assignment"
            icon={<AssignmentIcon />}
          />
          <BottomNavigationAction
            label="지점배정"
            value="office-assignment"
            icon={<AssignmentIcon />}
          />
          <BottomNavigationAction
            label="영업사원배정"
            value="sales-assignment"
            icon={<AssignmentIcon />}
          />
        </BottomNavigation>
      </Paper>
    );
  }

  // 재고배정 모드일 때는 다른 네비게이션 표시
  if (isAssignmentMode) {
    return (
      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          zIndex: 1000,
          borderTop: '1px solid #e0e0e0'
        }} 
        elevation={3}
      >
        <BottomNavigation
          value={value}
          onChange={handleChange}
          showLabels
          sx={{
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '6px 12px 8px',
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '12px',
              marginTop: '4px',
            },
            '& .MuiSvgIcon-root': {
              fontSize: '24px',
            }
          }}
        >
          <BottomNavigationAction
            label="설정"
            value="settings"
            icon={<SettingsIcon />}
          />
          <BottomNavigationAction
            label="부서배정"
            value="department"
            icon={<AssignmentIcon />}
          />
          <BottomNavigationAction
            label="지점배정"
            value="office"
            icon={<AssignmentIcon />}
          />
          <BottomNavigationAction
            label="영업사원배정"
            value="sales"
            icon={<AssignmentIcon />}
          />
        </BottomNavigation>
      </Paper>
    );
  }

  // 일반 모드 (지도, 재고, 이력, 설정)
  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        borderTop: '1px solid #e0e0e0'
      }} 
      elevation={3}
    >
      <BottomNavigation
        value={value}
        onChange={handleChange}
        showLabels
        sx={{
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 12px 8px',
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '12px',
            marginTop: '4px',
          },
          '& .MuiSvgIcon-root': {
            fontSize: '24px',
          }
        }}
      >
        <BottomNavigationAction
          label="지도"
          value="map"
          icon={<MapIcon />}
        />
        <BottomNavigationAction
          label="재고"
          value="inventory"
          icon={<InventoryIcon />}
        />
        <BottomNavigationAction
          label="이력"
          value="history"
          icon={<HistoryIcon />}
        />
        <BottomNavigationAction
          label="설정"
          value="settings"
          icon={<SettingsIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
};

export default MobileNavigation; 