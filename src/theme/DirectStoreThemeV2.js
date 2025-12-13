/**
 * 직영점모드 새로운 디자인 테마 V2
 * 모던하고 세련된 디자인으로 완전히 새롭게 리팩토링
 */
import { createTheme, alpha } from '@mui/material/styles';

// 새로운 색상 팔레트
const colors = {
  // Primary: 모던한 블루-퍼플 그라데이션
  primary: {
    50: '#f0f4ff',
    100: '#e0e9ff',
    200: '#c7d7ff',
    300: '#a4baff',
    400: '#8193ff',
    500: '#6366f1', // 메인 컬러
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  // Secondary: 따뜻한 오렌지-핑크
  secondary: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316', // 메인 컬러
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },
  // Accent: 생동감 있는 그린
  accent: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  // Neutral: 세련된 그레이스케일
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
};

// 통신사별 브랜드 컬러
const carrierColors = {
  SK: {
    primary: '#00a9e0',
    secondary: '#0077c8',
    gradient: 'linear-gradient(135deg, #00a9e0 0%, #0077c8 100%)',
  },
  KT: {
    primary: '#00abc7',
    secondary: '#00d4aa',
    gradient: 'linear-gradient(135deg, #00abc7 0%, #00d4aa 100%)',
  },
  LG: {
    primary: '#ec008c',
    secondary: '#ff6b9d',
    gradient: 'linear-gradient(135deg, #ec008c 0%, #ff6b9d 100%)',
  },
};

const directStoreThemeV2 = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.primary[500],
      light: colors.primary[400],
      dark: colors.primary[700],
      contrastText: '#ffffff',
    },
    secondary: {
      main: colors.secondary[500],
      light: colors.secondary[400],
      dark: colors.secondary[700],
      contrastText: '#ffffff',
    },
    success: {
      main: colors.accent[500],
      light: colors.accent[400],
      dark: colors.accent[700],
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
      subtle: '#f1f5f9',
      elevated: '#ffffff',
    },
    text: {
      primary: colors.neutral[900],
      secondary: colors.neutral[600],
      disabled: colors.neutral[400],
    },
    divider: alpha(colors.neutral[500], 0.12),
    action: {
      active: colors.primary[500],
      hover: alpha(colors.primary[500], 0.08),
      selected: alpha(colors.primary[500], 0.12),
      disabled: alpha(colors.neutral[500], 0.26),
    },
  },
  typography: {
    fontFamily: [
      '"Pretendard"',
      '"Noto Sans KR"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 800,
      fontSize: '2.5rem',
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 700,
      fontSize: '1.75rem',
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.5,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    ...Array(18).fill('0 25px 50px -12px rgba(0, 0, 0, 0.25)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.neutral[300]} ${colors.neutral[100]}`,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: colors.neutral[100],
          },
          '&::-webkit-scrollbar-thumb': {
            background: colors.neutral[300],
            borderRadius: '4px',
            '&:hover': {
              background: colors.neutral[400],
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: colors.neutral[900],
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          borderBottom: `1px solid ${alpha(colors.neutral[500], 0.1)}`,
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 24px',
          fontSize: '0.9375rem',
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 'none',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.primary[600]} 100%)`,
          color: '#ffffff',
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.primary[600]} 0%, ${colors.primary[700]} 100%)`,
            boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -2px rgba(99, 102, 241, 0.2)',
          },
        },
        containedSecondary: {
          background: `linear-gradient(135deg, ${colors.secondary[500]} 0%, ${colors.secondary[600]} 100%)`,
          color: '#ffffff',
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.secondary[600]} 0%, ${colors.secondary[700]} 100%)`,
            boxShadow: '0 10px 15px -3px rgba(249, 115, 22, 0.3), 0 4px 6px -2px rgba(249, 115, 22, 0.2)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
            backgroundColor: alpha(colors.primary[500], 0.08),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderRadius: 16,
          border: `1px solid ${alpha(colors.neutral[500], 0.1)}`,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, ${colors.primary[500]}, ${colors.secondary[500]})`,
            opacity: 0,
            transition: 'opacity 0.3s ease',
          },
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderColor: alpha(colors.primary[500], 0.3),
            '&::before': {
              opacity: 1,
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
        },
        elevation1: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        },
        elevation2: {
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        },
        elevation3: {
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.9375rem',
          minHeight: 48,
          padding: '12px 24px',
          color: colors.neutral[600],
          transition: 'all 0.2s ease',
          '&:hover': {
            color: colors.primary[500],
            backgroundColor: alpha(colors.primary[500], 0.08),
          },
          '&.Mui-selected': {
            color: colors.primary[500],
            fontWeight: 700,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: `2px solid ${alpha(colors.neutral[500], 0.1)}`,
        },
        indicator: {
          height: '3px',
          borderRadius: '3px 3px 0 0',
          background: `linear-gradient(90deg, ${colors.primary[500]}, ${colors.secondary[500]})`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.75rem',
          height: 28,
        },
        colorPrimary: {
          background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`,
          color: '#ffffff',
        },
        colorSecondary: {
          background: `linear-gradient(135deg, ${colors.secondary[500]}, ${colors.secondary[600]})`,
          color: '#ffffff',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            transition: 'all 0.2s ease',
            '&:hover': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.primary[400],
              },
            },
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '2px',
                borderColor: colors.primary[500],
              },
            },
          },
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          overflow: 'hidden',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: colors.neutral[50],
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${alpha(colors.neutral[500], 0.1)}`,
          padding: '16px',
        },
        head: {
          fontWeight: 700,
          fontSize: '0.875rem',
          color: colors.neutral[700],
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          marginTop: 8,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },
});

// 통신사별 컬러를 테마에 추가
directStoreThemeV2.carrierColors = carrierColors;

export default directStoreThemeV2;
