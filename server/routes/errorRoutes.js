/**
 * errorRoutes.js
 * 에러 로깅 API 라우트
 * 
 * 프론트엔드/백엔드 에러를 Supabase에 저장하고 조회
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Supabase 클라이언트 (index.js에서 전달받음)
let supabase = null;

const initErrorRoutes = (supabaseClient) => {
    supabase = supabaseClient;
    return router;
};

/**
 * 에러 해시 생성 (중복 방지용)
 */
const generateErrorHash = (message, source, lineNumber) => {
    const data = `${message || ''}:${source || ''}:${lineNumber || 0}`;
    return crypto.createHash('md5').update(data).digest('hex');
};

/**
 * POST /api/errors
 * 에러 로그 저장
 */
router.post('/', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(503).json({ success: false, error: 'Supabase not initialized' });
        }

        const {
            type,           // 'frontend', 'backend', 'network', 'react'
            level = 'error',
            message,
            stack,
            source,
            lineNumber,
            columnNumber,
            url,
            userAgent,
            userId,
            mode,
            apiEndpoint,
            statusCode,
            requestMethod,
            responseBody,
            metadata = {}
        } = req.body;

        // 필수 필드 검증
        if (!type || !message) {
            return res.status(400).json({
                success: false,
                error: 'type and message are required'
            });
        }

        // 에러 해시 생성
        const errorHash = generateErrorHash(message, source, lineNumber);

        // 최근 1시간 내 동일 에러 체크 (중복 방지)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
            .from('error_logs')
            .select('id')
            .eq('error_hash', errorHash)
            .gte('created_at', oneHourAgo)
            .limit(1);

        if (existing && existing.length > 0) {
            return res.json({
                success: true,
                deduplicated: true,
                message: 'Error already logged within the last hour'
            });
        }

        // 에러 로그 저장
        const { data, error } = await supabase
            .from('error_logs')
            .insert({
                type,
                level,
                message: message.substring(0, 10000), // 메시지 길이 제한
                stack: stack?.substring(0, 50000),
                source,
                line_number: lineNumber,
                column_number: columnNumber,
                url,
                user_agent: userAgent,
                user_id: userId,
                mode,
                api_endpoint: apiEndpoint,
                status_code: statusCode,
                request_method: requestMethod,
                response_body: responseBody?.substring(0, 5000),
                metadata,
                error_hash: errorHash
            })
            .select()
            .single();

        if (error) {
            console.error('[ErrorRoutes] Supabase insert error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('[ErrorRoutes] POST /api/errors error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/errors
 * 에러 로그 조회
 */
router.get('/', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(503).json({ success: false, error: 'Supabase not initialized' });
        }

        const {
            type,           // 필터: frontend, backend, network, react
            level,          // 필터: error, warning, info
            mode,           // 필터: 특정 모드
            limit = 100,
            offset = 0,
            since           // ISO 날짜 문자열
        } = req.query;

        let query = supabase
            .from('error_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (type) query = query.eq('type', type);
        if (level) query = query.eq('level', level);
        if (mode) query = query.eq('mode', mode);
        if (since) query = query.gte('created_at', since);

        const { data, error, count } = await query;

        if (error) {
            console.error('[ErrorRoutes] Supabase query error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        res.json({
            success: true,
            data,
            total: count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (err) {
        console.error('[ErrorRoutes] GET /api/errors error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/errors/stats
 * 에러 통계 조회
 */
router.get('/stats', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(503).json({ success: false, error: 'Supabase not initialized' });
        }

        const { since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } = req.query;

        // 타입별 카운트
        const { data: byType } = await supabase
            .from('error_logs')
            .select('type')
            .gte('created_at', since);

        // 레벨별 카운트
        const { data: byLevel } = await supabase
            .from('error_logs')
            .select('level')
            .gte('created_at', since);

        const stats = {
            total: byType?.length || 0,
            byType: {
                frontend: byType?.filter(e => e.type === 'frontend').length || 0,
                backend: byType?.filter(e => e.type === 'backend').length || 0,
                network: byType?.filter(e => e.type === 'network').length || 0,
                react: byType?.filter(e => e.type === 'react').length || 0
            },
            byLevel: {
                error: byLevel?.filter(e => e.level === 'error').length || 0,
                warning: byLevel?.filter(e => e.level === 'warning').length || 0,
                info: byLevel?.filter(e => e.level === 'info').length || 0
            }
        };

        res.json({ success: true, data: stats, since });

    } catch (err) {
        console.error('[ErrorRoutes] GET /api/errors/stats error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/errors/clear
 * 오래된 에러 로그 삭제 (7일 이상)
 */
router.delete('/clear', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(503).json({ success: false, error: 'Supabase not initialized' });
        }

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { error, count } = await supabase
            .from('error_logs')
            .delete()
            .lt('created_at', sevenDaysAgo);

        if (error) {
            console.error('[ErrorRoutes] Delete error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        res.json({ success: true, deletedCount: count });

    } catch (err) {
        console.error('[ErrorRoutes] DELETE /api/errors/clear error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = { initErrorRoutes };
