import type {RecvMsgEvent} from "../types/request/chat.ts";
import {Log} from "../lib/logger.ts";
import {wechatBotClient} from "../wechat-bot";
import config from "../config";
import {RagFlowApiClient, RagflowHighAvailabilityClient} from "../ragflow-client";
import redis from "../client/redis.ts";
import type {RagflowNodeConfig} from "../config/type.ts";


interface BotRuntimeConfig {
    groupSet: Set<string>;
    personSet: Set<string>;
}

interface PinnedSession {
    sessionId: string;
    nodeConfig: RagflowNodeConfig; // 将成功节点的配置也存起来
}

export class ChatService {


    private botConfigs: Map<string, BotRuntimeConfig>;
    private ragflowClients: Map<string, RagflowHighAvailabilityClient>;

    constructor() {
        this.botConfigs = new Map();
        this.ragflowClients = new Map();

        const {bots} = config.wechatBot;

        Log.info(`开始加载 ${Object.keys(bots).length} 个机器人的专属配置...`);

        for (const botWxid in bots) {
            const botInfo = bots[botWxid];

            // 将数组转换为 Set 以提高查找效率
            this.botConfigs.set(botWxid, {
                groupSet: new Set(botInfo!.whiteList.groups),
                personSet: new Set(botInfo!.whiteList.persons),
            });
            if (botInfo!.ragflowNodes && botInfo!.ragflowNodes.length > 0) {
                const haClient = new RagflowHighAvailabilityClient(botInfo!.ragflowNodes);
                this.ragflowClients.set(botWxid, haClient);
            }

            Log.info(`机器人 [${botWxid}] 配置已加载：${botInfo!.whiteList.groups.length} 个群聊白名单，${botInfo!.whiteList.persons.length} 个个人白名单。`);
        }


    }

    public async handleRecvMsg(payload: RecvMsgEvent) {
        const {fromType} = payload.data.data;


        switch (fromType) {
            case 1: // 私聊
                await this._excutePersonMsg(payload);
                break;
            case 2: // 群聊
                await this._excuteGroupMsg(payload);
                break;
            case 3: // 公众号
                break;
            default: // 未知
                Log.warn(`接收到未知类型的消息: ${fromType}`, payload.data.data.msg);
                break;
        }
        return;
    }


    private async _excutePersonMsg(payload: RecvMsgEvent) {
        const botWxid = payload.wxid;
        const fromWxid = payload.data.data.fromWxid;

        const botConfig = this.botConfigs.get(botWxid);
        if (!botConfig || !botConfig.personSet.has(fromWxid)) {
            Log.warn(`机器人 [${botWxid}] 收到非其白名单用户 [${fromWxid}] 的消息，已忽略。`);
            return;
        }

        // 1. 获取或创建固定会话
        const pinnedSession = await this._getOrCreatePinnedSession(payload);
        if (!pinnedSession) {
            await wechatBotClient.sendReplyMessage(botWxid, fromWxid, payload.data.data.msgId, '抱歉，我现在无法创建对话，请稍后再试。');
            return;
        }

        try {
            // 2. 创建一个直连到“固定节点”的专用客户端，不再使用HA客户端
            const pinnedClient = new RagFlowApiClient(pinnedSession.nodeConfig.apiKey, pinnedSession.nodeConfig.apiBase);

            // 3. 使用专用客户端进行对话
            const response = await pinnedClient.dialogCompletion(
                pinnedSession.nodeConfig.chatId,
                {
                    question: payload.data.data.msg,
                    session_id: pinnedSession.sessionId,
                    stream:false,
                }
            );

            await wechatBotClient.sendReplyMessage(botWxid, fromWxid, payload.data.data.msgId, response.answer);

        } catch (error) {
            Log.error(`与固定节点 [${pinnedSession.nodeConfig.apiBase}] 的通信失败。`, error);
            // 4. 如果通信失败，说明固定节点可能宕机，从Redis删除失效的会话
            const redisKey = `wxsession:${botWxid}:${fromWxid}`;
            await redis.del(redisKey);
            Log.warn(`已从Redis中删除失效的会话: ${redisKey}`);

            await wechatBotClient.sendReplyMessage(botWxid, fromWxid, payload.data.data.msgId, config.wechatBot.failMsg);
        }
    }

    private async _excuteGroupMsg(payload: RecvMsgEvent) {
        // console.log(payload)
        const botWxid = payload.wxid;
        const fromWxid = payload.data.data.fromWxid; // 群聊ID
        const finalFromWxid = payload.data.data.finalFromWxid; // 发言人ID

        const botConfig = this.botConfigs.get(botWxid);
        if (!botConfig || !botConfig.groupSet.has(fromWxid)) {
            Log.warn(`机器人 [${botWxid}] 收到非其白名单群组 [${fromWxid}] 的消息，已忽略。`);
            return;
        }

        const pinnedSession = await this._getOrCreatePinnedSession(payload);
        if (!pinnedSession) {
            return; // 群聊中可选择静默失败
        }

        try {
            const pinnedClient = new RagFlowApiClient(pinnedSession.nodeConfig.apiKey, pinnedSession.nodeConfig.apiBase);
            const response = await pinnedClient.dialogCompletion(
                pinnedSession.nodeConfig.chatId,
                {
                    question: payload.data.data.msg,
                    session_id: pinnedSession.sessionId,
                    stream:false,
                }
            );
            await wechatBotClient.sendReplyMessage(botWxid, fromWxid, payload.data.data.msgId, response.answer);

        } catch (error) {
            Log.error(`与固定节点 [${pinnedSession.nodeConfig.apiBase}] 的通信失败。`, error);
            const redisKey = `wxsession:${fromWxid}:${finalFromWxid}`;
            await redis.del(redisKey);
            Log.warn(`已从Redis中删除失效的会话: ${redisKey}`);
            await wechatBotClient.sendReplyMessage(botWxid, fromWxid, payload.data.data.msgId, config.wechatBot.failMsg);
        }
    }



    /**
     * 根据消息类型，从Redis获取或创建新的会话ID。
     * @param payload - 完整的微信事件负载
     * @returns 返回会话ID，如果创建失败则返回null
     */
    private async _getOrCreatePinnedSession(payload: RecvMsgEvent): Promise<PinnedSession | null> {
        const { fromType, fromWxid, finalFromWxid } = payload.data.data;
        const botWxid = payload.wxid;

        const redisKey = fromType === 1
            ? `wxsession:${botWxid}:${fromWxid}`
            : `wxsession:${botWxid}:${fromWxid}:${finalFromWxid}`;

        // 1. 尝试从Redis获取已固定的会话
        const storedSessionJson = await redis.get(redisKey);
        if (storedSessionJson) {
            Log.debug(`从Redis找到已固定的会话: (Key: ${redisKey})`);
            return JSON.parse(storedSessionJson);
        }

        // 2. 如果没有，使用HA客户端创建新会话并固定
        const haClient = this.ragflowClients.get(botWxid);
        if (!haClient) {
            Log.warn(`机器人 [${botWxid}] 没有配置RAGFlow客户端。`);
            return null;
        }

        try {
            Log.info(`未找到固定会话，开始创建并固定新会话 (Key: ${redisKey})...`);
            const sessionName = `session_for_${redisKey}`;
            const { session, nodeConfig } = await haClient.createSession(sessionName); // 调用重构后的方法

            const newPinnedSession: PinnedSession = {
                sessionId: session.id,
                nodeConfig: nodeConfig, // 将节点配置一起打包
            };

            // 3. 将包含节点信息的整个会话对象存入Redis
            await redis.set(redisKey, JSON.stringify(newPinnedSession));
            Log.info(`新会话 [${session.id}] 已成功创建并固定到节点: ${nodeConfig.apiBase}`);
            return newPinnedSession;

        } catch (error) {
            Log.error(`创建并固定会话失败 (Key: ${redisKey})`, error);
            return null;
        }
    }

}

export const chatService = new ChatService();
