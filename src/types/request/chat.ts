// src/types/wechat-events.ts

/**
 * 基础事件结构，用于泛型定义
 * E: event (数字)
 * T: type (data.type, 字符串或数字)
 * D: data.data (内层 data 对象)
 */
interface BaseEvent<E extends number, T, D> {
    event: E;
    wxid: string;
    data: {
        type: T;
        des?: string;
        data: D;
        timestamp: string;
        wxid: string;
        port: number;
        pid?: number;
        flag?: string;
    };
}

// =================================================================
//      定义每一种事件的内层 data (data.data) 结构
// =================================================================

// 10000: 注入成功
export interface InjectSuccessData {
    port: string;
    pid: string;
}

// 10008, 10009, 10010, 10007: 收到消息
export interface RecvMsgData {
    timeStamp: string;
    fromType: number;
    msgType: number;
    msgSource: number;
    fromWxid: string;
    finalFromWxid: string;
    atWxidList: string[];
    silence: number;
    membercount: number;
    signature: string;
    msg: string;
    msgId: string;
    sendId?: string; // 有时不存在
    msgXml?: string; // 微信支付时存在
}

// 10006: 转账事件
export interface TransPayData {
    fromWxid: string;
    msgSource: number;
    transType: number;
    money: string;
    memo: string;
    transferid: string;
    transcationid: string;
    invalidtime: string;
    msgId: string;
}

// 10011: 好友请求
export interface FriendReqData {
    wxid: string;
    wxNum: string;
    nick: string;
    v3: string;
    v4: string;
    sign: string;
    country: string;
    province: string;
    city: string;
    avatarMinUrl: string;
    avatarMaxUrl: string;
    sex: string;
    content: string;
    scene: string;
    shareWxid: string;
    shareNick: string;
    groupWxid: string;
    msgId: string;
}

// 10013: 撤回事件
export interface RevokeMsgData {
    timeStamp: string;
    fromType: number;
    msgType: number;
    msgSource: number;
    fromWxid: string;
    finalFromWxid: string;
    msg: string;
    msgId: string;
}

// 10015: 二维码收款
export interface QrPayData {
    fromWxid: string;
    fromNickName: string;
    msgSource: number;
    money: string;
    transferid: string;
    invalidtime: string;
}

// 10016: 群成员变动
export interface GroupMemberChangesData {
    timeStamp: string;
    fromWxid: string;
    finalFromWxid: string;
    eventType: number;
}

// 99999: 授权到期
export interface AuthExpireData {
    wxid: string;
    wxNum: string;
    msg: string;
}


// =================================================================
//      定义特殊结构的事件 (不完全符合 BaseEvent 结构)
// =================================================================

// 10014: 登录/登出事件
// 它的 data 结构比较特殊，没有内层的 data
export interface LoginEvent {
    event: 10014;
    wxid: string;
    data: {
        type: 1; // 1 代表登录
        port: number;
        wxid: string;
        wxNum: string;
        nick: string;
        phone: string;
        avatarUrl: string;
        country: string;
        province: string;
        city: string;
    };
}

export interface LogoutEvent {
    event: 10014;
    wxid: string;
    data: {
        type: 0; // 0 代表登出
        wxid: string;
        port: number;
    };
}

// 10: 心跳事件 (猜测)
// 结构非常简单，没有 data 对象
export interface HeartbeatEvent {
    event: 10;
}


// =================================================================
//      使用 BaseEvent 和具体 Data 结构组合成完整的事件类型
// =================================================================

export type InjectSuccessEvent = BaseEvent<10000, 'injectSuccess', InjectSuccessData>;
export type RecvMsgEvent = BaseEvent<10008 | 10009 | 10010 | 10007, 'recvMsg', RecvMsgData>;
export type TransPayEvent = BaseEvent<10006, 'transPay', TransPayData>;
export type FriendReqEvent = BaseEvent<10011, 'friendReq', FriendReqData>;
export type RevokeMsgEvent = BaseEvent<10013, 'revokeMsg', RevokeMsgData>;
export type QrPayEvent = BaseEvent<10015, 'qrPay', QrPayData>;
export type GroupMemberChangesEvent = BaseEvent<10016, 'groupMemberChanges', GroupMemberChangesData>;
export type AuthExpireEvent = BaseEvent<99999, 'authExpire', AuthExpireData>;


// =================================================================
//      最终导出的联合类型，包含了所有可能的事件
// =================================================================

export type WechatEvent =
    | InjectSuccessEvent
    | RecvMsgEvent
    | TransPayEvent
    | FriendReqEvent
    | RevokeMsgEvent
    | QrPayEvent
    | GroupMemberChangesEvent
    | AuthExpireEvent
    | LoginEvent
    | LogoutEvent
    | HeartbeatEvent;