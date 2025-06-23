import type {RecvMsgEvent} from "../types/request/chat.ts";
import {Log} from "../lib/logger.ts";
import {wechatBotClient} from "../wechat-bot";
import config from "../config";
import {RagFlowApiClient, RagflowHighAvailabilityClient} from "../ragflow-client";
import { etcdClient } from "../client/etcd.ts";
import type {RagflowNodeConfig} from "../config/type.ts";


interface BotRuntimeConfig {
    groupSet: Set<string>;
    personSet: Set<string>;
}

interface PinnedSession {
    sessionId: string;
    nodeConfig: RagflowNodeConfig; // 将成功节点的配置也存起来
}

class ChatService {
    private botConfigs: Map<string, BotRuntimeConfig>;
    private ragflowClients: Map<string, RagflowHighAvailabilityClient>;

    constructor() {
        this.botConfigs = new Map();
        this.ragflowClients = new Map();
        const {bots} = config.wechatBot;
        Log.info(`开始加载 ${Object.keys(bots).length} 个机器人的专属配置...`);
        for (const botWxid in bots) {
            const botInfo = bots[botWxid];
            this.botConfigs.set(botWxid, {
                groupSet: new Set(botInfo!.whiteList.groups),
                personSet: new Set(botInfo!.whiteList.persons),
            });
            if (botInfo!.ragflowNodes && botInfo!.ragflowNodes.length > 0) {
                const haClient = new RagflowHighAvailabilityClient(botInfo!.ragflowNodes);
                this.ragflowClients.set(botWxid, haClient);
            }
            Log.info(`机器人 [${botWxid}] 配置已加载：${botInfo!.whiteList.groups.length} 个群聊白名单，${botInfo!.whiteList.persons.length} 个个人白名单。`);
            Log.info(`群聊白名单: ${Array.from(this.botConfigs.get(botWxid)!.groupSet).join(', ')}`);
            Log.info(`个人白名单: ${Array.from(this.botConfigs.get(botWxid)!.personSet).join(', ')}`);
        }
    }

    public async handleRecvMsg(payload: RecvMsgEvent) {
        const {fromType} = payload.data.data;
        switch (fromType) {
            case 1:
                await this._excutePersonMsg(payload);
                break;
            case 2:
                await this._excuteGroupMsg(payload);
                break;
            default:
                Log.warn(`接收到未知类型的消息: ${fromType}`, payload.data.data.msg);
                break;
        }
        return;
    }

    /**
     * ✅ 重构后：处理私聊消息，逻辑更清晰
     */
    private async _excutePersonMsg(payload: RecvMsgEvent) {
        const { wxid: botWxid, data: { data: { fromWxid, msgId } } } = payload;

        const botConfig = this.botConfigs.get(botWxid);
        if (!botConfig || !botConfig.personSet.has(fromWxid)) {
            Log.warn(`机器人 [${botWxid}] 收到非其白名单用户 [${fromWxid}] 的消息，已忽略。`);
            return;
        }

        const pinnedSession = await this._getOrCreatePinnedSession(payload);
        if (!pinnedSession) {
            await wechatBotClient.sendReplyMessage(botWxid, fromWxid, msgId, '抱歉，我现在无法创建对话，请稍后再试。');
            return;
        }

        const etcdKey = `/wxsession/${botWxid}/${fromWxid}`;
        await this._processChatMessage(payload, pinnedSession, fromWxid, etcdKey);
    }

    /**
     * ✅ 重构后：处理群聊消息，逻辑更清晰
     */
    private async _excuteGroupMsg(payload: RecvMsgEvent) {
        const { wxid: botWxid, data: { data: { fromWxid, finalFromWxid ,atWxidList } } } = payload;

        const botConfig = this.botConfigs.get(botWxid);
        if (!botConfig || !botConfig.groupSet.has(fromWxid)) {
            Log.warn(`机器人 [${botWxid}] 收到非其白名单群组 [${fromWxid}] 的消息，已忽略。`);
            return;
        }

        if (!atWxidList || !atWxidList.includes(botWxid)) {
            Log.debug(`群聊 [${fromWxid}] 中收到消息，但机器人 [${botWxid}] 未被@，已忽略。`);
            return;
        }

        const pinnedSession = await this._getOrCreatePinnedSession(payload);
        if (!pinnedSession) {
            return; // 群聊中静默失败
        }

        const etcdKey = `/wxsession/${botWxid}/${fromWxid}/${finalFromWxid}`;
        await this._processChatMessage(payload, pinnedSession, fromWxid, etcdKey);
    }

    /**
     * ✅ 新增：封装出来的通用消息处理与RAG流程
     * @param payload 原始消息事件
     * @param pinnedSession 固定好的会话
     * @param replyToWxid 要回复的wxid（私聊是用户id，群聊是群id）
     * @param etcdKey 用于失败时删除的etcd键
     */
    private async _processChatMessage(payload: RecvMsgEvent, pinnedSession: PinnedSession, replyToWxid: string, etcdKey: string) {
        const { wxid: botWxid, data: { data: { msgId, msg } } } = payload;

        try {
            const pinnedClient = new RagFlowApiClient(pinnedSession.nodeConfig.apiKey, pinnedSession.nodeConfig.apiBase);
            const response = await pinnedClient.dialogCompletion(
                pinnedSession.nodeConfig.chatId,
                {
                    question: msg,
                    session_id: pinnedSession.sessionId,
                    stream: false,
                }
            );
            await wechatBotClient.sendReplyMessage(botWxid, replyToWxid, msgId, response.answer);
        } catch (error) {
            Log.error(`与固定节点 [${pinnedSession.nodeConfig.apiBase}] 的通信失败。`, error);
            await etcdClient.del(etcdKey);
            Log.warn(`已从 etcd 中删除失效的会话: ${etcdKey}`);
            await wechatBotClient.sendReplyMessage(botWxid, replyToWxid, msgId, config.wechatBot.failMsg);
        }
    }

    private async _getOrCreatePinnedSession(payload: RecvMsgEvent): Promise<PinnedSession | null> {
        const {fromType, fromWxid, finalFromWxid} = payload.data.data;
        const botWxid = payload.wxid;

        const etcdKey = fromType === 1
            ? `/wxsession/${botWxid}/${fromWxid}`
            : `/wxsession/${botWxid}/${fromWxid}/${finalFromWxid}`;

        const storedSessionJson = await etcdClient.get(etcdKey);
        if (storedSessionJson) {
            Log.debug(`从 etcd 找到已固定的会话: (Key: ${etcdKey})`);
            return JSON.parse(storedSessionJson);
        }

        const haClient = this.ragflowClients.get(botWxid);
        if (!haClient) {
            Log.warn(`机器人 [${botWxid}] 没有配置RAGFlow客户端。`);
            return null;
        }

        try {
            Log.info(`未找到固定会话，开始创建并固定新会话 (Key: ${etcdKey})...`);
            const sessionName = `session_for_${etcdKey.replace(/\//g, '-')}`;
            const {session, nodeConfig} = await haClient.createSession(sessionName);
            const newPinnedSession: PinnedSession = {
                sessionId: session.id,
                nodeConfig: nodeConfig,
            };
            await etcdClient.put(etcdKey, JSON.stringify(newPinnedSession));
            Log.info(`新会话 [${session.id}] 已成功创建并固定到节点: ${nodeConfig.apiBase}`);
            return newPinnedSession;
        } catch (error) {
            Log.error(`创建并固定会话失败 (Key: ${etcdKey})`, error);
            return null;
        }
    }
}

export const chatService = new ChatService();