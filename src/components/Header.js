import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Update as UpdateIcon } from '@mui/icons-material';

function Header({ onCheckUpdate }) {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          재고 조회 시스템
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