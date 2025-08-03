import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  AccountBalance as BudgetIcon,
  Construction as ConstructionIcon
} from '@mui/icons-material';

function BudgetMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  return (
    <Box sx={{ 
      p: 3, 
      height: '100vh', 
      overflow: 'auto',
      backgroundColor: '#f5f5f5'
    }}>
      {/* 헤더 */}
      <Box sx={{ 
        mb: 3, 
        background: 'linear-gradient(135deg, #795548 0%, #5d4037 100%)',
        borderRadius: 3,
        p: 3,
        boxShadow: '0 8px 32px rgba(121, 85, 72, 0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 배경 패턴 */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '200px',
          height: '100%',
          background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          transform: 'rotate(15deg)'
        }} />
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <Box>
            <Typography variant="h3" component="h1" sx={{ 
              fontWeight: 800,
              color: '#ffffff',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              mb: 0.5
            }}>
              💰 예산 모드
            </Typography>
            <Typography variant="body2" sx={{ 
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 500
            }}>
              예산 관리 및 분석 시스템
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Chip 
              label="준비중" 
              icon={<ConstructionIcon />}
              sx={{ 
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                fontWeight: 'bold',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)'
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* 준비중 메시지 */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card sx={{ 
            borderRadius: 3,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid #e0e0e0'
          }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Box sx={{ mb: 3 }}>
                <BudgetIcon sx={{ 
                  fontSize: 80, 
                  color: '#795548',
                  mb: 2
                }} />
                <CircularProgress 
                  size={60} 
                  sx={{ 
                    color: '#795548',
                    mb: 2
                  }} 
                />
              </Box>
              
              <Typography variant="h4" component="h2" sx={{ 
                fontWeight: 700,
                color: '#795548',
                mb: 2
              }}>
                🚧 예산 모드 준비중
              </Typography>
              
              <Typography variant="body1" sx={{ 
                color: '#666666',
                mb: 3,
                maxWidth: 600,
                mx: 'auto'
              }}>
                예산 관리 및 분석 기능이 현재 개발 중입니다.
                <br />
                곧 더 나은 예산 관리 도구로 찾아뵙겠습니다!
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Chip 
                  label="예산 분석" 
                  sx={{ 
                    backgroundColor: '#efebe9',
                    color: '#795548',
                    fontWeight: 'bold'
                  }}
                />
                <Chip 
                  label="예산 설정" 
                  sx={{ 
                    backgroundColor: '#efebe9',
                    color: '#795548',
                    fontWeight: 'bold'
                  }}
                />
                <Chip 
                  label="예산 추적" 
                  sx={{ 
                    backgroundColor: '#efebe9',
                    color: '#795548',
                    fontWeight: 'bold'
                  }}
                />
                <Chip 
                  label="예산 리포트" 
                  sx={{ 
                    backgroundColor: '#efebe9',
                    color: '#795548',
                    fontWeight: 'bold'
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default BudgetMode; 