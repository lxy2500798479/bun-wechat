import { Log } from '../lib/logger';
import type {WechatBotApiResponse} from "./types.ts";

/**
 * 用于与微信 HTTP API 交互的客户端。
 * 封装了请求发送、错误处理和日志记录。
 */
export class WechatBotClient {
    private readonly baseUrl: string;

    constructor() {
        const apiUrl = Bun.env.WECHAT_API_BASE;
        if (!apiUrl) {
            const errorMessage = '环境变量 WECHAT_API_BASE 未设置，客户端无法启动。';
            Log.error(errorMessage);
            throw new Error(errorMessage);
        }
        this.baseUrl = apiUrl;
    }

    /**
     * 发送引用回复消息。
     *
     * @param botWxid - 用于发送消息的机器人 WXID。
     * @param toWxid - 接收者的 WXID（用户或群组）。
     * @param msgId - 要引用的消息 ID。
     * @param content - 回复的文本内容。
     * @returns API 的 JSON 响应，如果请求失败则返回 null。
     */
    public async sendReplyMessage(botWxid: string, toWxid: string, msgId: string, content: string): Promise<WechatBotApiResponse | null> {
        const payload = {
            type: "sendReferText",
            data: {
                msgId,
                wxid: toWxid,
                msg: content,
            }
        };

        const endpoint = `?wxid=${botWxid}`;

        Log.info(`正在发送回复消息至: ${toWxid}`);
        return this._sendRequest(endpoint, payload);
    }

    /**
     * 用于处理对微信 API 的 POST 请求的通用私有方法。
     *
     * @param endpoint - API 端点（包含查询参数）。
     * @param body - 将被序列化的请求体。
     * @returns 成功则返回 API 的 JSON 响应，否则返回 null。
     */
    private async _sendRequest(endpoint: string, body: any): Promise<WechatBotApiResponse | null> {
        const url = this.baseUrl + endpoint;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                Log.error(`API 请求失败，状态码: ${response.status}`, { url, response: errorBody });
                return null;
            }

            Log.debug('API 请求成功。');
            return await response.json();

        } catch (error) {
            Log.error('请求期间发生网络错误。', error);
            return null;
        }
    }
}

/**
 * WechatBotClient 的单例，供整个应用使用。
 */
export const wechatBotClient = new WechatBotClient();