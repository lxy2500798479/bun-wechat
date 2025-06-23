import router from './router/router.ts';
import config from "./config"; // 导入我们定义好的 router 实例




const server = Bun.serve({
    port: config.server.port,

    // 将 fetch 的处理器指向我们 router 实例的 handle 方法
    fetch: router.handle,

    // 注意：我们 router 的 .handle 方法已经包含了错误处理逻辑，
    // 所以这里的 error 处理器主要捕获 fetch 之外的、更深层次的服务器错误。
    error(error: Error) {
        console.error('💥 Top-Level Server Error:', error);
        return new Response(JSON.stringify({ success: false, message: 'A critical server error occurred' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    },
});

console.log(`✅ Server is running on http://localhost:${server.port}/api/`);