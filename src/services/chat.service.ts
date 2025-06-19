import type {RecvMsgEvent} from "../types/request/chat.ts";
import {Log} from "../lib/logger.ts";
import {wechatBotClient} from "../wechat-bot";
import config from "../config";


interface BotRuntimeConfig {
    groupSet: Set<string>;
    personSet: Set<string>;
}

export class ChatService {


    private botConfigs: Map<string, BotRuntimeConfig>;

    constructor() {
        this.botConfigs = new Map();

        const {bots} = config.wechatBot;

        Log.info(`开始加载 ${Object.keys(bots).length} 个机器人的专属配置...`);

        for (const botWxid in bots) {
            const botInfo = bots[botWxid];

            // 将数组转换为 Set 以提高查找效率
            this.botConfigs.set(botWxid, {
                groupSet: new Set(botInfo!.whiteList.groups),
                personSet: new Set(botInfo!.whiteList.persons),
            });

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

        // 6. 从 Map 中获取该机器人的专属配置
        const botConfig = this.botConfigs.get(botWxid);

        // 7. 使用该机器人的专属白名单进行验证
        if (!botConfig || !botConfig.personSet.has(fromWxid)) {
            Log.warn(`机器人 [${botWxid}] 收到非其白名单用户 [${fromWxid}] 的消息，已忽略。`);
            return;
        }

        Log.info(`机器人 [${botWxid}] 正在回复用户 [${fromWxid}]。`);
        // 使用全局配置中的 failMsg 或其他消息
        await wechatBotClient.sendReplyMessage(botWxid, fromWxid, payload.data.data.msgId, '收到你的消息了');
    }

    private async _excuteGroupMsg(payload: RecvMsgEvent) {
        const botWxid = payload.wxid;
        const fromWxid = payload.data.data.fromWxid; // 此处 fromWxid 是群聊ID

        // 获取该机器人的专属配置
        const botConfig = this.botConfigs.get(botWxid);

        if (!botConfig || !botConfig.groupSet.has(fromWxid)) {
            Log.warn(`机器人 [${botWxid}] 收到非其白名单群组 [${fromWxid}] 的消息，已忽略。`);
            return;
        }

        Log.info(`机器人 [${botWxid}] 正在回复群聊 [${fromWxid}]。`);
        await wechatBotClient.sendReplyMessage(botWxid, fromWxid, payload.data.data.msgId, '收到群消息了');
    }
}

export const chatService = new ChatService();
