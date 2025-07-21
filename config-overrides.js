const webpack = require('webpack');

module.exports = function override(config) {
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify"),
        "url": require.resolve("url"),
        "buffer": require.resolve("buffer"),
        "querystring": require.resolve("querystring-es3"),
        "path": require.resolve("path-browserify"),
        "process": require.resolve("process/browser"),
        "util": require.resolve("util"),
        "events": require.resolve("events"),
        "fs": false,
        "child_process": false,
        "net": false,
        "tls": false,
        "zlib": false,
        "vm": false
    });
    
    config.resolve.fallback = fallback;
    
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser'
        })
    ]);

    // Node.js 스타일 모듈을 위한 별칭 추가
    config.resolve.alias = {
        ...config.resolve.alias,
        'node:events': 'events',
        'node:process': 'process/browser',
        'node:util': 'util'
    };
    
    // 모듈 파싱 옵션 추가
    config.module.rules.push({
        test: /\.m?js/,
        resolve: {
            fullySpecified: false
        }
    });

    // 번들링 최적화 설정 추가
    config.optimization = {
        ...config.optimization,
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                },
                common: {
                    name: 'common',
                    minChunks: 2,
                    chunks: 'all',
                    enforce: true
                }
            }
        }
    };

    // 소스맵 설정 개선
    if (config.mode === 'production') {
        config.devtool = 'source-map';
    }

    return config;
} 