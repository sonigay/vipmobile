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

function ModeSelector({ loggedInStore, selectedModes, onModeToggle, selectedTabs, onTabToggle, onModeOnlyToggle, selectedSubTabs, onSubTabToggle }) {
  // 사용 가능한 모드 목록 (권한이 있는 모드만)
  const availableModes = useMemo(() => {
    if (!loggedInStore?.modePermissions) {
      return [];
    }

    const subPermissions = ['onSalePolicy', 'onSaleLink', 'bondChart', 'inspectionOverview'];
    return Object.entries(loggedInStore.modePermissions)
      .filter(([mode, hasPermission]) => {
        // 서브 권한은 제외
        if (subPermissions.includes(mode)) {
          return false;
        }
        // 회의 모드의 경우 M 또는 O 권한 허용
        if (mode === 'meeting') {
          const permission = String(hasPermission || '').trim().toUpperCase();
          return hasPermission === 'M' || 
                 hasPermission === 'O' ||
                 hasPermission === true || 
                 permission === 'M' ||
                 permission === 'O';
        }
        // 다른 모드는 권한이 있으면 포함 (true 또는 'O')
        return hasPermission === true || hasPermission === 'O' || String(hasPermission || '').trim().toUpperCase() === 'O';
      })
      .map(([mode]) => mode)
      .filter(mode => {
        // 모드 설정이 있는 모드만 표시 (회의 모드 포함)
        const modeConfig = getModeConfig(mode);
        return modeConfig;
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
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {availableTabs.map((tab) => {
                            const tabKey = `${modeKey}-${tab.key}`;
                            const isTabSelected = selectedTabs.includes(tabKey);
                            const hasSubTabs = tab.subTabs && tab.subTabs.length > 0;

                            return (
                              <Box key={tab.key} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Chip
                                  label={tab.label}
                                  size="small"
                                  clickable
                                  onClick={() => handleTabToggle(modeKey, tab.key)}
                                  color={isTabSelected ? 'primary' : 'default'}
                                  variant={isTabSelected ? 'filled' : 'outlined'}
                                  sx={{
                                    backgroundColor: isTabSelected ? `${modeConfig.color}20` : 'transparent',
                                    borderColor: modeConfig.color,
                                    alignSelf: 'flex-start',
                                    '&:hover': {
                                      backgroundColor: `${modeConfig.color}30`
                                    }
                                  }}
                                />
                                {isTabSelected && hasSubTabs && (
                                  <Box sx={{ ml: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mb: 0.5 }}>
                                      하부 탭 선택:
                                    </Typography>
                                    {tab.subTabs.map((subTab) => {
                                      const subTabKey = `${modeKey}-${tab.key}-${subTab.key}`;
                                      const isSubTabSelected = selectedSubTabs && selectedSubTabs.includes(subTabKey);

                                      return (
                                        <Chip
                                          key={subTab.key}
                                          label={subTab.label}
                                          size="small"
                                          clickable
                                          onClick={() => onSubTabToggle && onSubTabToggle(modeKey, tab.key, subTab.key)}
                                          color={isSubTabSelected ? 'secondary' : 'default'}
                                          variant={isSubTabSelected ? 'filled' : 'outlined'}
                                          sx={{
                                            backgroundColor: isSubTabSelected ? `${modeConfig.color}15` : 'transparent',
                                            borderColor: modeConfig.color,
                                            fontSize: '0.7rem',
                                            height: '24px',
                                            '&:hover': {
                                              backgroundColor: `${modeConfig.color}25`
                                            }
                                          }}
                                        />
                                      );
                                    })}
                                  </Box>
                                )}
                              </Box>
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

