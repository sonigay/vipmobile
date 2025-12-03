import { createTheme } from '@mui/material/styles';

// 직영점 모드 전용 프리미엄 테마 (Black & Gold)
const directStoreTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#D4AF37', // Gold
            light: '#F4CF57',
            dark: '#A48F27',
            contrastText: '#000000',
        },
        secondary: {
            main: '#FFFFFF', // White
            light: '#FFFFFF',
            dark: '#CCCCCC',
            contrastText: '#000000',
        },
        background: {
            default: '#000000', // Deep Black
            paper: '#121212',   // Dark Gray for cards
            subtle: '#1E1E1E',  // Slightly lighter background
        },
        text: {
            primary: '#FFFFFF',
            secondary: 'rgba(255, 255, 255, 0.7)',
            disabled: 'rgba(255, 255, 255, 0.5)',
            highlight: '#D4AF37', // Gold text
        },
        divider: 'rgba(212, 175, 55, 0.2)', // Subtle Gold divider
        action: {
            active: '#D4AF37',
            hover: 'rgba(212, 175, 55, 0.08)',
            selected: 'rgba(212, 175, 55, 0.16)',
        },
    },
    typography: {
        fontFamily: '"Noto Sans KR", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontWeight: 700,
            letterSpacing: '-0.02em',
        },
        h2: {
            fontWeight: 700,
            letterSpacing: '-0.01em',
        },
        h3: {
            fontWeight: 600,
            letterSpacing: '-0.01em',
        },
        h4: {
            fontWeight: 600,
        },
        h5: {
            fontWeight: 500,
        },
        h6: {
            fontWeight: 500,
        },
        subtitle1: {
            letterSpacing: '0.02em',
        },
        button: {
            fontWeight: 600,
            textTransform: 'none', // 버튼 텍스트 대문자 변환 방지
        },
    },
    components: {
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)', // Glassmorphism background
                    backdropFilter: 'blur(10px)',
                    borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
                    boxShadow: 'none',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '8px 16px',
                },
                containedPrimary: {
                    background: 'linear-gradient(45deg, #D4AF37 30%, #F4CF57 90%)',
                    color: '#000000',
                    boxShadow: '0 3px 5px 2px rgba(212, 175, 55, .3)',
                    '&:hover': {
                        background: 'linear-gradient(45deg, #A48F27 30%, #D4AF37 90%)',
                    },
                },
                outlinedPrimary: {
                    borderColor: '#D4AF37',
                    '&:hover': {
                        borderColor: '#F4CF57',
                        backgroundColor: 'rgba(212, 175, 55, 0.08)',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: '#121212',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 16,
                    boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                    transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 12px 24px rgba(0,0,0,0.6), 0 0 10px rgba(212, 175, 55, 0.2)',
                        border: '1px solid rgba(212, 175, 55, 0.3)',
                    },
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    '&.Mui-selected': {
                        color: '#D4AF37',
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                },
                head: {
                    fontWeight: 700,
                    backgroundColor: '#1E1E1E',
                    color: '#D4AF37',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none', // 기본 gradient 제거
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#121212',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: 16,
                },
            },
        },
    },
});

export default directStoreTheme;
