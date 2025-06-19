// src/controllers/chat.controller.ts (推荐的修改)

import { Log } from "../lib/logger.ts";
import { R } from "../lib/response.ts";
import type { WechatEvent } from "../types/request/chat.ts"; // 假设类型文件路径
import { chatService } from "../services/chat.service.ts";

export async function receiveChatHandler(req: Request) {
    try {
        // @ts-ignore
        const payload: WechatEvent = await req.json();


        // 根据事件类型进行分发
        switch (payload.event) {
            case 10008: // 群消息
            case 10009: // 私聊消息
                if (payload.data.type === 'recvMsg') {
                    // 调用服务层方法，并传递完整的 payload
                    await chatService.handleRecvMsg(payload);
                }
                break;

            default:
                Log.warn(`接收到未处理的事件 event: ${payload.event}`);
                break;
        }

        return R.success("事件已接收");

    } catch (e: unknown) {
        Log.error('处理微信消息时发生错误:', e);
        // 在 catch 块中，也应该返回一个错误响应
        return R.serverError("处理事件时发生内部错误");
    }
}