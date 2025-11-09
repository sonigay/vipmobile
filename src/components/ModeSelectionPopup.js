import React, { useMemo, useState } from 'react';
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
  Box,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';
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
  // 뷰 모드 상태 (기본값: 'compact' - 간략히 모드)
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('mode-selection-view-mode');
    return saved || 'compact';
  });

  // 검색어 상태
  const [searchQuery, setSearchQuery] = useState('');

  // 카테고리 필터 상태 (기본값: 'all')
  const [selectedCategory, setSelectedCategory] = useState('all');

  // 즐겨찾기 상태
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('mode-selection-favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // 뷰 모드 변경 핸들러
  const handleViewModeChange = (event, newViewMode) => {
    if (newViewMode !== null) {
      setViewMode(newViewMode);
      localStorage.setItem('mode-selection-view-mode', newViewMode);
    }
  };

  // 카테고리 필터 변경 핸들러
  const handleCategoryChange = (event, newCategory) => {
    if (newCategory !== null) {
      setSelectedCategory(newCategory);
    }
  };

  // 즐겨찾기 토글 핸들러
  const handleFavoriteToggle = (modeKey, event) => {
    event.stopPropagation();
    const resolvedKey = resolveModeKey(modeKey);
    const newFavorites = favorites.includes(resolvedKey)
      ? favorites.filter(f => f !== resolvedKey)
      : [...favorites, resolvedKey];
    setFavorites(newFavorites);
    localStorage.setItem('mode-selection-favorites', JSON.stringify(newFavorites));
  };

  // 정렬 및 필터링된 모드 목록
  const orderedModes = useMemo(() => {
    if (!Array.isArray(availableModes)) return [];
    const modeMap = new Map(availableModes.map(mode => [resolveModeKey(mode), mode]));
    const sorted = MODE_ORDER.filter((key) => modeMap.has(key)).map((key) => modeMap.get(key));
    const remaining = availableModes.filter(mode => !sorted.includes(mode));
    let modes = [...sorted, ...remaining];

    // 카테고리 필터 적용
    if (selectedCategory !== 'all') {
      modes = modes.filter(mode => {
        const config = getModeConfig(mode);
        return config?.category === selectedCategory;
      });
    }

    // 검색어 필터 적용
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      modes = modes.filter(mode => {
        const config = getModeConfig(mode);
        return config?.title?.toLowerCase().includes(query);
      });
    }

    // 즐겨찾기 우선 정렬
    modes.sort((a, b) => {
      const aKey = resolveModeKey(a);
      const bKey = resolveModeKey(b);
      const aIsFavorite = favorites.includes(aKey);
      const bIsFavorite = favorites.includes(bKey);
      
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      return 0;
    });

    return modes;
  }, [availableModes, selectedCategory, searchQuery, favorites]);

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

      {/* 검색 및 필터 영역 */}
      <Box sx={{ p: 2, pb: 1, backgroundColor: '#f5f5f5' }}>
        {/* 검색창 */}
        <TextField
          fullWidth
          size="small"
          placeholder="모드 이름으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />

        {/* 뷰 모드 선택 및 카테고리 필터 */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 뷰 모드 선택 */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            aria-label="뷰 모드 선택"
          >
            <ToggleButton value="large" aria-label="큰 아이콘">
              큰 아이콘
            </ToggleButton>
            <ToggleButton value="medium" aria-label="중간 아이콘">
              중간 아이콘
            </ToggleButton>
            <ToggleButton value="compact" aria-label="간략히">
              간략히
            </ToggleButton>
          </ToggleButtonGroup>

          {/* 카테고리 필터 */}
          <ToggleButtonGroup
            value={selectedCategory}
            exclusive
            onChange={handleCategoryChange}
            size="small"
            aria-label="카테고리 필터"
          >
            <ToggleButton value="all" aria-label="전체">
              전체
            </ToggleButton>
            <ToggleButton value="admin" aria-label="관리자 모드">
              관리자 모드
            </ToggleButton>
            <ToggleButton value="general" aria-label="일반 모드">
              일반 모드
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {orderedModes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {searchQuery ? '검색 결과가 없습니다.' : '표시할 모드가 없습니다.'}
            </Typography>
          </Box>
        ) : viewMode === 'compact' ? (
          // 간략히 모드 (리스트 형태)
          <List>
            {orderedModes.map((mode) => {
              const config = getModeConfig(mode);
              if (!config) return null;

              const iconColor = getModeColor(mode);
              const IconComponent = getModeIcon(mode);
              const resolvedKey = resolveModeKey(mode);
              const isFavorite = favorites.includes(resolvedKey);

              return (
                <ListItem
                  key={mode}
                  disablePadding
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={(e) => handleFavoriteToggle(mode, e)}
                      sx={{ color: isFavorite ? '#FFC107' : '#9E9E9E' }}
                    >
                      {isFavorite ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>
                  }
                >
                  <ListItemButton onClick={() => handleModeSelect(mode)}>
                    <ListItemIcon>
                      <IconComponent sx={{ fontSize: 24, color: iconColor }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={config.title}
                      primaryTypographyProps={{
                        fontWeight: 600,
                        color: iconColor
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        ) : (
          // 큰 아이콘 또는 중간 아이콘 모드 (그리드 형태)
          <Grid container spacing={viewMode === 'large' ? 3 : 2}>
            {orderedModes.map((mode) => {
              const config = getModeConfig(mode);

              if (!config) {
                console.warn(`⚠️ [ModeSelectionPopup] 모드 ${mode}에 대한 설정을 찾을 수 없습니다.`);
                return null;
              }

              const iconColor = getModeColor(mode);
              const IconComponent = getModeIcon(mode);
              const resolvedKey = resolveModeKey(mode);
              const isFavorite = favorites.includes(resolvedKey);
              const iconSize = viewMode === 'large' ? 40 : 20;
              const gridSize = viewMode === 'large' ? 4 : 6;

              return (
                <Grid item xs={12} md={gridSize} key={mode}>
                  <Card
                    sx={{
                      height: '100%',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      border: '2px solid transparent',
                      background: 'transparent',
                      position: 'relative',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                        borderColor: iconColor
                      }
                    }}
                    onClick={() => handleModeSelect(mode)}
                  >
                    {/* 즐겨찾기 버튼 */}
                    <IconButton
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 1,
                        color: isFavorite ? '#FFC107' : '#9E9E9E',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 1)'
                        }
                      }}
                      onClick={(e) => handleFavoriteToggle(mode, e)}
                      size="small"
                    >
                      {isFavorite ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>

                    <CardContent sx={{
                      textAlign: 'center',
                      p: viewMode === 'large' ? 3 : 2,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <Box>
                        <Box sx={{ mb: 2 }}>
                          <IconComponent sx={{ fontSize: iconSize, color: iconColor }} />
                        </Box>

                        <Typography variant={viewMode === 'large' ? 'h6' : 'subtitle1'} component="div" sx={{
                          fontWeight: 600,
                          mb: 1,
                          color: iconColor
                        }}>
                          {config.title}
                        </Typography>

                        {viewMode === 'large' && (
                          <>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                              {config.description}
                            </Typography>

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
                          </>
                        )}

                        {viewMode === 'medium' && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            {config.description}
                          </Typography>
                        )}
                      </Box>

                      <Button
                        variant="contained"
                        fullWidth
                        size={viewMode === 'large' ? 'medium' : 'small'}
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
        )}
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