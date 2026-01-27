
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const LogContext = createContext();

export const useLogs = () => useContext(LogContext);

export const LogProvider = ({ children }) => {
    const [logs, setLogs] = useState([]);
    const MAX_LOGS = 1000;
    const originalConsoleRef = useRef({});

    const addLog = (level, message, source = 'Client', stack = null) => {
        const newLog = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            level, // 'info', 'warn', 'error'
            message: typeof message === 'object' ? JSON.stringify(message) : String(message),
            source, // 'Client', 'Server', 'System'
            stack
        };

        // 리액트 렌더링 사이클 중에 호출될 경우(예: 컴포넌트 렌더링 중 console.warn 발생)
        // 'Cannot update a component while rendering a different component' 경고를 방지하기 위해
        // 상태 업데이트를 다음 틱으로 지연시킵니다.
        setTimeout(() => {
            setLogs(prev => {
                const updated = [newLog, ...prev];
                if (updated.length > MAX_LOGS) {
                    return updated.slice(0, MAX_LOGS);
                }
                return updated;
            });
        }, 0);
    };

    useEffect(() => {
        // 1. Console Override
        const levels = ['log', 'warn', 'error', 'info', 'debug'];

        levels.forEach(level => {
            originalConsoleRef.current[level] = console[level];

            console[level] = (...args) => {
                // Call original
                originalConsoleRef.current[level].apply(console, args);

                // Add to our context
                // Try to verify if it's a "system" style log or just a message
                let msg = args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg) : arg
                ).join(' ');

                // Map console levels to our simpler levels
                let ourLevel = 'info';
                if (level === 'warn') ourLevel = 'warn';
                if (level === 'error') ourLevel = 'error';

                addLog(ourLevel, msg, 'Client');
            };
        });

        // 2. Global Error Handler
        const handleWindowError = (message, source, lineno, colno, error) => {
            addLog('error', message, 'Client', error?.stack || `${source}:${lineno}:${colno}`);
        };

        // 3. Unhandled Promise Rejection
        const handleRejection = (event) => {
            addLog('error', `Unhandled Rejection: ${event.reason}`, 'Client');
        };

        window.addEventListener('error', handleWindowError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            // Cleanup: Restore console
            levels.forEach(level => {
                if (originalConsoleRef.current[level]) {
                    console[level] = originalConsoleRef.current[level];
                }
            });
            window.removeEventListener('error', handleWindowError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    const clearLogs = () => setLogs([]);

    return (
        <LogContext.Provider value={{ logs, addLog, clearLogs }}>
            {children}
        </LogContext.Provider>
    );
};
