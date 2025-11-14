import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Checkbox,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip
} from '@mui/material';
import { getModeConfig, getModeIcon } from '../../config/modeConfig';
import { getAvailableTabsForMode } from '../../config/modeTabConfig';

function ModeSelector({ loggedInStore, selectedModes, onModeToggle, selectedTabs, onTabToggle, onModeOnlyToggle }) {
  // 사용 가능한 모드 목록 (권한이 있는 모드만)
  const availableModes = useMemo(() => {
    if (!loggedInStore?.modePermissions) {
      return [];
    }

    const subPermissions = ['onSalePolicy', 'onSaleLink', 'bondChart', 'inspectionOverview'];
    return Object.entries(loggedInStore.modePermissions)
      .filter(([mode, hasPermission]) => {
        return (hasPermission === true || hasPermission === 'O') && !subPermissions.includes(mode);
      })
      .map(([mode]) => mode)
      .filter(mode => {
        // 모드 설정이 있는 모드만 표시 (모든 모드 표시)
        const modeConfig = getModeConfig(mode);
        return modeConfig && mode !== 'meeting'; // 회의 모드는 제외
      });
  }, [loggedInStore]);

  const handleModeToggle = (modeKey) => {
    onModeToggle(modeKey);
  };

  const handleTabToggle = (modeKey, tabKey) => {
    onTabToggle(modeKey, tabKey);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        모드 및 탭 선택
      </Typography>

      <Grid container spacing={2}>
        {availableModes.map((modeKey) => {
          const modeConfig = getModeConfig(modeKey);
          if (!modeConfig) return null;

          const ModeIcon = getModeIcon(modeKey);
          const isModeSelected = selectedModes.includes(modeKey);
          const availableTabs = getAvailableTabsForMode(modeKey, loggedInStore);

          return (
            <Grid item xs={12} md={6} key={modeKey}>
              <Card
                variant="outlined"
                sx={{
                  border: isModeSelected ? 2 : 1,
                  borderColor: isModeSelected ? modeConfig.color : 'divider',
                  backgroundColor: isModeSelected ? `${modeConfig.color}08` : 'background.paper'
                }}
              >
                <CardActionArea onClick={() => handleModeToggle(modeKey)}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <ModeIcon sx={{ color: modeConfig.color, mr: 1 }} />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isModeSelected}
                            onChange={() => handleModeToggle(modeKey)}
                            sx={{ color: modeConfig.color }}
                          />
                        }
                        label={
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {modeConfig.title}
                          </Typography>
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                      {modeConfig.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>

                {isModeSelected && (
                  <Box sx={{ px: 2, pb: 2 }}>
                    {availableTabs.length > 0 ? (
                      <>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          탭 선택:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {availableTabs.map((tab) => {
                            const tabKey = `${modeKey}-${tab.key}`;
                            const isTabSelected = selectedTabs.includes(tabKey);

                            return (
                              <Chip
                                key={tab.key}
                                label={tab.label}
                                size="small"
                                clickable
                                onClick={() => handleTabToggle(modeKey, tab.key)}
                                color={isTabSelected ? 'primary' : 'default'}
                                variant={isTabSelected ? 'filled' : 'outlined'}
                                sx={{
                                  backgroundColor: isTabSelected ? `${modeConfig.color}20` : 'transparent',
                                  borderColor: modeConfig.color,
                                  '&:hover': {
                                    backgroundColor: `${modeConfig.color}30`
                                  }
                                }}
                              />
                            );
                          })}
                        </Box>
                      </>
                    ) : (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontStyle: 'italic' }}>
                          이 모드는 탭이 없습니다.
                        </Typography>
                        <Chip
                          label="모드 전체 추가"
                          size="small"
                          clickable
                          onClick={() => onModeOnlyToggle && onModeOnlyToggle(modeKey)}
                          color="primary"
                          variant="outlined"
                          sx={{
                            borderColor: modeConfig.color,
                            '&:hover': {
                              backgroundColor: `${modeConfig.color}30`
                            }
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {availableModes.length === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            사용 가능한 모드가 없습니다.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

export default ModeSelector;

