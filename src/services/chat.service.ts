import type {RecvMsgEvent} from "../types/request/chat.ts";
import {Log} from "../lib/logger.ts";
import {wechatBotClient} from "../wechat-bot";


export class ChatService {


    // 将白名单的解析和加载放在构造函数或类的属性中，避免每次调用都重新解析
    private whiteGroupSet: Set<string>;
    private whitePersonSet: Set<string>;

    constructor() {
        // 从 .env 加载并解析白名单，存储为 Set 以提高查找效率
        const whiteGroupList = (Bun.env.WHITE_GROUP_LIST || '').split(';').filter(Boolean);
        const whitePersonList = (Bun.env.WHITE_PERSIONS || '').split(';').filter(Boolean);

        this.whiteGroupSet = new Set(whiteGroupList);
        this.whitePersonSet = new Set(whitePersonList);

        if (this.whiteGroupSet.size > 0) {
            Log.info(`群聊白名单已加载，共 ${this.whiteGroupSet.size} 个群组`);
        }
        if (this.whitePersonSet.size > 0) {
            Log.info(`私聊白名单已加载，共 ${this.whitePersonSet.size} 个用户`);
        }
    }

    public async handleRecvMsg(payload: RecvMsgEvent) {
        console.log(payload)
        const botWxid = payload.wxid;
        const msgDetails = payload.data.data;
        const {fromType, fromWxid, finalFromWxid, atWxidList, msg, msgSource} = msgDetails;


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


        if (!this.whitePersonSet.has(payload.data.data.fromWxid)) {
            Log.warn(`收到非白名单用户的私聊消息，但未做处理。用户 wxid: ${payload.wxid}`);
            return;
        }

        await wechatBotClient.sendReplyMessage(payload.wxid,payload.data.data.fromWxid,payload.data.data.msgId,'收到你的消息了');


        return;
    }

    private async _excuteGroupMsg(payload: RecvMsgEvent) {


        if (!this.whiteGroupSet.has(payload.data.data.fromWxid)) {
            Log.warn(`收到非白名单群组的消息，但未做处理。群组 wxid: ${payload.data.data.fromWxid}`);
            return;
        }

        await wechatBotClient.sendReplyMessage(payload.wxid,payload.data.data.fromWxid,payload.data.data.msgId,'收到你的消息了');


        return;
    }
}

export const chatService = new ChatService();
