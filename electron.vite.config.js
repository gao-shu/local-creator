var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { defineConfig, loadEnv } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
var root = __dirname;
var src = path.resolve(root, './src');
var appVersion = JSON.parse(readFileSync(path.resolve(root, 'package.json'), 'utf8')).version;
var cjsEntry = function (entry) { return ({
    build: {
        rollupOptions: {
            input: { index: path.resolve(root, entry) },
            output: { format: 'cjs' },
        },
    },
}); };
export default defineConfig(function (_a) {
    var _b, _c, _d, _e;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:28080';
    var proxy = { target: proxyTarget, changeOrigin: true };
    return {
        main: __assign({ resolve: { alias: { '@': src } }, define: {
                'process.env.VITE_UPLOAD_ORIGIN': JSON.stringify((_b = env.VITE_UPLOAD_ORIGIN) !== null && _b !== void 0 ? _b : ''),
                'process.env.VITE_UPDATE_PUBLISH_URL': JSON.stringify((_c = env.VITE_UPDATE_PUBLISH_URL) !== null && _c !== void 0 ? _c : ''),
                'process.env.VITE_UPDATE_ORIGIN': JSON.stringify((_d = env.VITE_UPDATE_ORIGIN) !== null && _d !== void 0 ? _d : ''),
                'process.env.LC_UPDATE_PUBLISH_URL': JSON.stringify((_e = env.LC_UPDATE_PUBLISH_URL) !== null && _e !== void 0 ? _e : ''),
            } }, cjsEntry('electron/main.ts')),
        preload: cjsEntry('electron/preload.ts'),
        renderer: {
            root: '.',
            define: {
                __APP_VERSION__: JSON.stringify(appVersion),
            },
            build: { rollupOptions: { input: { index: path.resolve(root, 'index.html') } } },
            resolve: {
                alias: {
                    '@': src,
                    '@local-creator/ai-core': path.resolve(src, './packages/ai-core/index.ts'),
                },
            },
            plugins: [react()],
            server: { port: 15173, proxy: { '/api': proxy, '/uploads': proxy } },
        },
    };
});
