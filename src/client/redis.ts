import { RedisClient } from "bun";
import { Log } from '../lib/logger';
import config from "../config";
import Bun from "bun";

const redisUrl = config.redis.url;
if (!redisUrl) {
    Log.error('❌ REDIS_URL 未设置，应用无法启动。');
    // @ts-ignore
    Bun.exit(1);
}

const redis = new RedisClient(redisUrl);

redis.onconnect = () => {
    Log.info('✅ Redis 连接已建立。');
};

redis.onclose = (error) => {
    if (error) {
        Log.error('❌ Redis 连接因错误而关闭。', error);
    } else {
        Log.warn('Redis 连接已正常关闭。');
    }
};

(async () => {
    try {
        const response = await redis.ping('PING');
        Log.info(`Redis 连接测试响应: ${response}`);
        if (response !== 'OK') {
            throw new Error('Redis 连接测试失败：未收到预期的响应。');
        }
    } catch (error) {
        Log.error('初始化 Redis 连接失败。', error as Error);
        // @ts-ignore
        Bun.exit(1);
    }
})();

export default redis;