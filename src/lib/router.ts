// src/lib/router.ts (更新后)

import {Log} from "./logger.ts";

type Handler = (req: Request) => Response | Promise<Response>;

interface Route {
    method: string;
    path: string;
    handler: Handler;
}

export class Router {
    private routes: Route[] = [];
    private readonly basePath: string;

    constructor(options: { basePath?: string } = {}) {
        this.basePath = options.basePath || '';
        if (this.basePath.endsWith('/')) {
            this.basePath = this.basePath.slice(0, -1);
        }
    }

    public get(path: string, handler: Handler): void {
        this.addRoute('GET', path, handler);
    }

    public post(path: string, handler: Handler): void {
        this.addRoute('POST', path, handler);
    }

    private addRoute(method: string, path: string, handler: Handler): void {
        const finalPath = this.basePath + (path.startsWith('/') ? path : `/${path}`);
        Log.info(`✅ 路由已注册: [${method}] ${finalPath}`);
        this.routes.push({ method, path: finalPath, handler });
    }

    public handle = (req: Request): Promise<Response> => {
        const url = new URL(req.url);
        const requestMethod = req.method;
        const requestPath = url.pathname;

        for (const route of this.routes) {
            if (route.method === requestMethod && route.path === requestPath) {
                try {
                    return Promise.resolve(route.handler(req));
                } catch (error) {
                    return this.handleError(error);
                }
            }
        }

        return Promise.resolve(this.handleNotFound());
    };

    private handleNotFound(): Response {
        return new Response(JSON.stringify({ success: false, message: '未找到' }), { // ✅ 消息汉化
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    private handleError(error: unknown): Promise<Response> {
        Log.error('💥 处理器错误:', error);
        const response = new Response(JSON.stringify({ success: false, message: '内部服务器错误' }), { // ✅ 消息汉化
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
        return Promise.resolve(response);
    }
}