import React, { useEffect, useState, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Box,
    CircularProgress,
    Button
} from '@mui/material';
import { CloudOff as CloudOffIcon } from '@mui/icons-material';

/**
 * 서버 상태 모니터링 컴포넌트
 * 주기적으로 /health 엔드포인트를 호출하여 서버 상태를 확인합니다.
 * 연속으로 실패하면 서버가 다운된 것으로 간주하고 차단 화면을 표시합니다.
 * 서버가 다시 살아나면 자동으로 페이지를 새로고침(로그아웃 효과)합니다.
 */
const ServerHealthMonitor = () => {
    const [isServerDown, setIsServerDown] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [lastCheckTime, setLastCheckTime] = useState(Date.now());

    // 설정값
    const POLLING_INTERVAL = 10000; // 10초마다 체크
    const RETRY_INTERVAL = 3000;    // 다운 감지 시 3초마다 재시도
    const FAILURE_THRESHOLD = 3;    // 3번 연속 실패 시 다운으로 간주

    const failCountRef = useRef(0);
    const wasDownRef = useRef(false);
    const timerRef = useRef(null);

    const checkHealth = async () => {
        try {
            const API_URL = process.env.REACT_APP_API_URL || '';
            // 타임아웃을 짧게 설정 (5초)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${API_URL}/health`, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Cache-Control': 'no-cache' }
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // 성공 시
                failCountRef.current = 0;
                setRetryCount(0);

                // 이전에 다운 상태였다면 (서버가 다시 살아남) -> 강제 새로고침
                if (wasDownRef.current) {
                    console.log('✅ 서버 복구 감지! 강제 새로고침을 실행합니다.');
                    // 캐시 삭제 및 강제 새로고침 (Ctrl+F5 효과)
                    if (window.caches) {
                        try {
                            const keys = await window.caches.keys();
                            await Promise.all(keys.map(key => window.caches.delete(key)));
                        } catch (e) {
                            console.error('캐시 삭제 실패:', e);
                        }
                    }
                    window.location.reload(true);
                    return true; // 복구됨
                }

                if (isServerDown) {
                    setIsServerDown(false);
                    wasDownRef.current = false;
                }
                return true; // 정상
            } else {
                throw new Error(`Server responded with status: ${response.status}`);
            }
        } catch (error) {
            // 실패 시
            failCountRef.current += 1;
            // console.warn(`⚠️ 서버 헬스체크 실패 (${failCountRef.current}/${FAILURE_THRESHOLD}):`, error.message);

            if (failCountRef.current >= FAILURE_THRESHOLD) {
                if (!isServerDown) {
                    console.error('🚨 서버 다운 감지! 차단 화면을 표시합니다.');
                    setIsServerDown(true);
                    wasDownRef.current = true;
                }
            }
            return false; // 실패
        } finally {
            setLastCheckTime(Date.now());
        }
    };

    useEffect(() => {
        // 초기 실행
        // checkHealth(); 

        // 주기적 실행
        const runLoop = async () => {
            const isHealthy = await checkHealth();

            // 상태에 따라 다음 실행 시간 결정
            const nextInterval = (wasDownRef.current || failCountRef.current >= 1)
                ? RETRY_INTERVAL
                : POLLING_INTERVAL;

            timerRef.current = setTimeout(runLoop, nextInterval);
        };

        timerRef.current = setTimeout(runLoop, POLLING_INTERVAL);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []); // 의존성 배열 비움 (Ref 사용)

    // 수동 재시도
    const handleManualRetry = () => {
        setRetryCount(prev => prev + 1);
        checkHealth();
    };

    // 정상 상태면 아무것도 렌더링하지 않음
    if (!isServerDown) return null;

    return (
        <Dialog
            open={isServerDown}
            fullScreen
            PaperProps={{
                sx: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'white'
                }
            }}
            style={{ zIndex: 9999 }} // 최상위 레벨
        >
            <Box sx={{ textAlign: 'center', p: 3, maxWidth: 600 }}>
                <CloudOffIcon sx={{ fontSize: 100, color: '#ff5252', mb: 4 }} />

                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                    서버 연결 끊김
                </Typography>

                <Typography variant="body1" sx={{ mb: 4, opacity: 0.8, fontSize: '1.2rem' }}>
                    서버가 종료되었거나 응답하지 않습니다.<br />
                    서버가 다시 시작될 때까지 기다려 주세요.
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 4 }}>
                    <CircularProgress size={24} sx={{ color: '#ff5252', mr: 2 }} />
                    <Typography variant="body2">
                        서버 연결 재시도 중...
                        {lastCheckTime > 0 && ` (마지막 확인: ${new Date(lastCheckTime).toLocaleTimeString()})`}
                    </Typography>
                </Box>

                <Button
                    variant="outlined"
                    onClick={handleManualRetry}
                    sx={{
                        color: 'white',
                        borderColor: 'white',
                        '&:hover': { borderColor: '#ff5252', color: '#ff5252' }
                    }}
                >
                    지금 다시 확인
                </Button>
            </Box>
        </Dialog>
    );
};

export default ServerHealthMonitor;
