/**

 * API响应的基础结构
 */
export interface WechatBotApiResponse {
    code?: number;
    msg?: string;
    result?: never;
    wxid?: string;
    port?: number;
    pid?: number;
    flag?: string;
    timestamp?: string;
}
