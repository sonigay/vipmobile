import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Chip } from '@mui/material';
import { Update as UpdateIcon, Person as PersonIcon } from '@mui/icons-material';

function Header({ onCheckUpdate, inventoryUserName, isInventoryMode }) {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          재고 조회 시스템
          {isInventoryMode && inventoryUserName && (
            <Chip
              icon={<PersonIcon />}
              label={`접속자: ${inventoryUserName}`}
              size="small"
              sx={{ 
                ml: 2, 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
          )}
        </Typography>
        {onCheckUpdate && (
          <Box>
            <Button
              color="inherit"
              startIcon={<UpdateIcon />}
              onClick={onCheckUpdate}
              sx={{ 
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 2,
                px: 2
              }}
            >
              업데이트 확인
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default Header; 