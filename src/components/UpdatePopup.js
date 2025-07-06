import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Update as UpdateIcon,
  CheckCircle as CheckCircleIcon,
  BugReport as BugReportIcon,
  Build as BuildIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { formatUpdateContent } from '../utils/updateHistory';

const UpdatePopup = ({ open, onClose, updates, onMarkAsRead }) => {
  const [hideToday, setHideToday] = useState(false);

  const handleClose = () => {
    if (onMarkAsRead) {
      onMarkAsRead(hideToday);
    }
    onClose();
  };

  const getUpdateIcon = (type) => {
    switch (type) {
      case 'feature':
        return <CheckCircleIcon color="primary" />;
      case 'bugfix':
        return <BugReportIcon color="error" />;
      case 'system':
        return <BuildIcon color="info" />;
      default:
        return <UpdateIcon color="action" />;
    }
  };

  const getUpdateColor = (type) => {
    switch (type) {
      case 'feature':
        return 'primary';
      case 'bugfix':
        return 'error';
      case 'system':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus
      disableAutoFocus
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        backgroundColor: 'primary.main',
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <UpdateIcon sx={{ mr: 1 }} />
          <Typography variant="h6">
            업데이트 내용
          </Typography>
        </Box>
        <Button
          color="inherit"
          onClick={handleClose}
          sx={{ minWidth: 'auto', p: 0 }}
        >
          <CloseIcon />
        </Button>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        {updates && updates.length > 0 ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              새로운 업데이트가 적용되었습니다. 주요 변경사항을 확인해주세요.
            </Typography>
            
            <List>
              {updates.map((update, index) => (
                <React.Fragment key={update.version}>
                  <ListItem sx={{ px: 0, py: 2 }}>
                    <ListItemIcon>
                      {getUpdateIcon(update.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography variant="h6" sx={{ mr: 1 }}>
                            {update.title}
                          </Typography>
                          <Chip 
                            label={update.version}
                            size="small"
                            color={getUpdateColor(update.type)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            📅 {update.date}
                          </Typography>
                          <List dense sx={{ pl: 0 }}>
                            {update.changes.map((change, changeIndex) => (
                              <ListItem key={changeIndex} sx={{ py: 0.5, px: 0 }}>
                                <ListItemIcon sx={{ minWidth: 20 }}>
                                  <Typography variant="body2" color="primary">
                                    •
                                  </Typography>
                                </ListItemIcon>
                                <ListItemText
                                  primary={
                                    <Typography variant="body2">
                                      {change}
                                    </Typography>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < updates.length - 1 && (
                    <Divider sx={{ my: 1 }} />
                  )}
                </React.Fragment>
              ))}
            </List>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <UpdateIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              새로운 업데이트가 없습니다
            </Typography>
            <Typography variant="body2" color="text.secondary">
              현재 최신 버전을 사용하고 있습니다.
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 3, pt: 0, flexDirection: 'column', alignItems: 'stretch' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={hideToday}
              onChange={(e) => setHideToday(e.target.checked)}
              color="primary"
            />
          }
          label="오늘 하루 보지 않기"
          sx={{ alignSelf: 'flex-start', mb: 2 }}
        />
        <Button 
          onClick={handleClose}
          variant="contained"
          fullWidth
          sx={{ borderRadius: 2 }}
        >
          확인
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdatePopup; 