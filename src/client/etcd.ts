import {Log} from '../lib/logger';

/**
 * 一个通过 HTTP 与 etcd v3 API 交互的客户端。
 * 负责处理认证和基本的键值操作。
 */
class EtcdClient {
    private readonly etcdUrl: string;
    private readonly username?: string;
    private readonly password?: string;
    private token: string | null = null;
    private isAuthenticating: boolean = false;
    private authPromise: Promise<boolean> | null = null;

    constructor() {
        this.etcdUrl = Bun.env.ETCD_HOSTS || 'http://etcd.kenny.pro:1237';
        this.username = Bun.env.ETCD_USERNAME || 'root';
        this.password = Bun.env.ETCD_PASSWORD || 'Kx9mP2nQ7vR8sT4uY6wZ';
    }

    /**
     * 如果提供了凭据，则向 etcd 进行身份验证。
     * 管理一个认证令牌以避免在每个请求中都重新认证。
     * @returns {Promise<boolean>} - 如果认证成功或不需要认证，则返回 true。
     */
    private _authenticate(): Promise<boolean> {
        if (!this.username) {
            return Promise.resolve(true); // 无需认证
        }
        if (this.token) {
            return Promise.resolve(true); // 令牌已存在
        }

        if (this.isAuthenticating && this.authPromise) {
            return this.authPromise; // 防止并发认证请求
        }

        this.isAuthenticating = true;
        this.authPromise = (async () => {
            Log.info(`正在为用户 [${this.username}] 请求 etcd 认证令牌...`);
            try {
                const res = await fetch(`${this.etcdUrl}/v3/auth/authenticate`, {
                    method: 'POST',
                    body: JSON.stringify({name: this.username, password: this.password}),
                });
                if (!res.ok) {
                    Log.error(`etcd 认证失败，状态码: ${res.status}`);
                    this.token = null;
                    return false;
                }
                const data = await res.json();
                this.token = data.token;
                Log.info('成功获取 etcd 认证令牌。');
                return true;
            } catch (e) {
                Log.error('请求 etcd 认证接口时发生网络错误。', e);
                this.token = null;
                return false;
            } finally {
                this.isAuthenticating = false;
                this.authPromise = null;
            }
        })();
        return this.authPromise;
    }

    /**
     * 向 etcd API 发送经过身份验证的请求的通用方法。
     */
    private async _makeRequest(endpoint: string, body: object): Promise<any> {
        if (!(await this._authenticate())) {
            throw new Error("etcd 认证失败。");
        }

        const headers: HeadersInit = {'Content-Type': 'application/json'};
        if (this.token) {
            headers['Authorization'] = this.token;
        }

        const response = await fetch(`${this.etcdUrl}${endpoint}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.token = null; // 如果未经授权，则清除令牌以强制重新认证
            }
            throw new Error(`etcd 请求 ${endpoint} 失败，状态码: ${response.status}`);
        }

        return response.json();
    }

    /**
     * 从 etcd 检索给定键的值。
     * @param {string} key - 要检索的键。
     * @returns {Promise<string | null>} - 值的字符串形式，如果未找到则为 null。
     */
    public async get(key: string): Promise<string | null> {
        try {
            const base64Key = Buffer.from(key).toString('base64');
            const data = await this._makeRequest('/v3/kv/range', {key: base64Key});

            if (!data.kvs || data.kvs.length === 0) {
                return null;
            }
            const base64Value = data.kvs[0].value;
            return Buffer.from(base64Value, 'base64').toString('utf8');
        } catch (error) {
            Log.error(`从 etcd 获取键 '${key}' 失败。`, error);
            return null;
        }
    }

    /**
     * 在 etcd 中存储一个键值对。
     * @param {string} key - 键。
     * @param {string} value - 值。
     * @returns {Promise<boolean>} - 成功时为 true，失败时为 false。
     */
    public async put(key: string, value: string): Promise<boolean> {
        try {
            const base64Key = Buffer.from(key).toString('base64');
            const base64Value = Buffer.from(value).toString('base64');
            await this._makeRequest('/v3/kv/put', {key: base64Key, value: base64Value});
            return true;
        } catch (error) {
            Log.error(`向 etcd 写入键 '${key}' 失败。`, error);
            return false;
        }
    }

    /**
     * 从 etcd 中删除一个键。
     * @param {string} key - 要删除的键。
     * @returns {Promise<boolean>} - 成功时为 true，失败时为 false。
     */
    public async del(key: string): Promise<boolean> {
        try {
            const base64Key = Buffer.from(key).toString('base64');
            await this._makeRequest('/v3/kv/deleterange', {key: base64Key});
            return true;
        } catch (error) {
            Log.error(`从 etcd 删除键 '${key}' 失败。`, error);
            return false;
        }
    }
}

// 导出一个单例实例，供整个应用使用
export const etcdClient = new EtcdClient();