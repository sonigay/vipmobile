import { createTheme } from '@mui/material/styles';

// 직영점 모드 전용 밝은 테마 (Light & Gold)
const directStoreTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#D4AF37', // Gold
            light: '#F4CF57',
            dark: '#A48F27',
            contrastText: '#000000',
        },
        secondary: {
            main: '#546E7A', // Blue Gray
            light: '#78909C',
            dark: '#37474F',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#F5F5F5', // Light Gray
            paper: '#FFFFFF',   // White for cards
            subtle: '#FAFAFA',  // Very light background
        },
        text: {
            primary: '#212121',
            secondary: 'rgba(0, 0, 0, 0.6)',
            disabled: 'rgba(0, 0, 0, 0.38)',
            highlight: '#D4AF37', // Gold text
        },
        divider: 'rgba(0, 0, 0, 0.12)', // Light divider
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
                    backgroundColor: '#FFFFFF', // White background
                    borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    borderRadius: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.15), 0 0 10px rgba(212, 175, 55, 0.2)',
                        border: '1px solid rgba(212, 175, 55, 0.5)',
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
                    color: 'rgba(0, 0, 0, 0.6)',
                    '&.Mui-selected': {
                        color: '#D4AF37',
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                },
                head: {
                    fontWeight: 700,
                    backgroundColor: '#FAFAFA',
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
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: 16,
                },
            },
        },
    },
});

export default directStoreTheme;
