// src/lib/router.ts (更新后)

type Handler = (req: Request) => Response | Promise<Response>;

interface Route {
    method: string;
    path: string;
    handler: Handler;
}

export class Router {
    private routes: Route[] = [];
    private readonly basePath: string; // 新增一个私有属性来存储根路径

    /**
     * 构造函数，接收一个可选的 basePath
     * @param options - 包含 basePath 的配置对象
     */
    constructor(options: { basePath?: string } = {}) {
        // 清理并设置根路径，例如将 "/api/v1/" 变为 "/api/v1"
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

    /**
     * 私有方法，用于向路由表添加一条记录
     * 变化点：在这里将根路径和路由路径拼接起来
     */
    private addRoute(method: string, path: string, handler: Handler): void {
        // 确保路径以 / 开头
        const finalPath = this.basePath + (path.startsWith('/') ? path : `/${path}`);
        console.log(`✅ Route registered: [${method}] ${finalPath}`); // 增加日志，方便调试
        this.routes.push({ method, path: finalPath, handler });
    }


    public handle = (req: Request): Promise<Response> => {
        const url = new URL(req.url);
        const requestMethod = req.method;
        const requestPath = url.pathname;

        // 查找匹配的路由
        for (const route of this.routes) {
            if (route.method === requestMethod && route.path === requestPath) {
                // 找到匹配项，执行对应的处理函数
                try {
                    // 使用 Promise.resolve 来统一处理同步和异步的 handler
                    return Promise.resolve(route.handler(req));
                } catch (error) {
                    // 捕获 handler 中的同步错误
                    return this.handleError(error);
                }
            }
        }

        // 如果循环结束都没有找到，返回 404
        return Promise.resolve(this.handleNotFound());
    };

    /**
     * 处理 404 Not Found 的响应
     */
    private handleNotFound(): Response {
        return new Response(JSON.stringify({ success: false, message: 'Not Found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * 统一处理捕获到的错误
     */
    private handleError(error: unknown): Promise<Response> {
        console.error('💥 Handler Error:', error);
        const response = new Response(JSON.stringify({ success: false, message: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
        return Promise.resolve(response);
    }
}