

export interface AppConfig {
    database: { url: string; };
    redis: { url: string; cacheExpire: number; };
    auth: {
        tokenExpire: number;
        jwtSecret: string;
        outerAccessKeys: Record<string, string>;
    };
    server: { port: number; nodeEnv: string; };
    wechatBot: {
        apiBase: string;
        failMsg: string;
        chatMode: string;
        bots: Record<string, {
            whiteList: {
                groups: string[];
                persons: string[];
            };
            ragflowNodes: RagflowNodeConfig[];
        }>;
    };
    // ... 其他配置项的接口
}

interface RagflowNodeConfig {
    apiBase: string;
    apiKey: string;
    chatId: string;
}