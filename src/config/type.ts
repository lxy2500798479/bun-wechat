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
        bots: Record<string, { // bots 的键是 bot WXID
            whiteList: {
                groups: string[];
                persons: string[];
            };
        }>;
    };
    // ... 其他配置项的接口
}