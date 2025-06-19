import { Log } from '../lib/logger';
import type {AppConfig} from "./type.ts";



class ConfigService {
    // 此方法负责连接 etcd 并获取配置
    private async fetchFromEtcd(): Promise<AppConfig | null> {
        const etcdUrl = Bun.env.ETCD_HOSTS || 'http://127.0.0.1:2379';
        const username = Bun.env.ETCD_USERNAME;
        const password = Bun.env.ETCD_PASSWORD;
        const configKey = 'config/wechat-bots'; // 使用我们最终确定的键
        const base64ConfigKey = Buffer.from(configKey).toString('base64');
        let token: string | null = null;

        // 内部认证函数
        const authenticate = async (): Promise<boolean> => {
            if (!username) return true; // 无需认证
            Log.info(`正在为用户 [${username}] 请求 etcd 认证令牌...`);
            try {
                const res = await fetch(`${etcdUrl}/v3/auth/authenticate`, {
                    method: 'POST',
                    body: JSON.stringify({ name: username, password }),
                });
                if (!res.ok) {
                    Log.error(`etcd 认证失败，状态码: ${res.status}`);
                    return false;
                }
                const data = await res.json();
                token = data.token;
                Log.info('成功获取 etcd 认证令牌。');
                return true;
            } catch (e) {
                Log.error('请求 etcd 认证接口时发生网络错误。', e);
                return false;
            }
        };

        // 1. 认证
        if (!(await authenticate())) return null;

        // 2. 获取配置
        Log.info(`正在从 etcd 获取配置，键: ${configKey}`);
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = token;
            }
            const response = await fetch(`${etcdUrl}/v3/kv/range`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ key: base64ConfigKey }),
            });

            if (!response.ok) {
                Log.error(`从 etcd 获取配置失败，状态码: ${response.status}`);
                return null;
            }
            const data = await response.json();
            if (!data.kvs || data.kvs.length === 0) {
                Log.warn(`在 etcd 中未找到配置，键: ${configKey}`);
                return null;
            }
            const base64Value = data.kvs[0].value;
            const jsonValue = Buffer.from(base64Value, 'base64').toString('utf8');
            return JSON.parse(jsonValue) as AppConfig;
        } catch (error) {
            Log.error("请求 etcd 数据时发生网络错误。", error);
            return null;
        }
    }

    /**
     * 公共的初始化方法
     */
    public async initialize(): Promise<AppConfig> {
        Log.info("开始从 etcd 初始化应用配置...");
        const loadedConfig = await this.fetchFromEtcd();
        if (loadedConfig) {
            Log.info("应用配置已成功从 etcd 加载。");
            return loadedConfig;
        } else {
            Log.error("无法从 etcd 加载应用配置，程序即将退出。");
            process.exit(1); // 加载失败，直接退出
        }
    }
}

// 2. 利用 Bun 的顶层 await 特性，在模块被导入时就执行异步初始化
const configService = new ConfigService();
const config: AppConfig = await configService.initialize();

// 3. 导出最终的、已加载完毕的配置对象
export default config;