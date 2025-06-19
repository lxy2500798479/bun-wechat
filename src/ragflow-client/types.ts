/**
 * 存放所有与RagFlow API相关的TypeScript类型定义。
 */

// =================================================================
//                      通用API响应结构
// =================================================================

/**
 * API成功响应的基础结构
 */
export interface RagflowSuccessResponse<T> {
  code: 0;
  message?: string;
  data: T;
}

/**
 * API失败响应的基础结构
 */
export interface RagflowErrorResponse {
  code: number; // 非 0
  message?: string;
  data: null;
}

// RagFlow节点配置接口
export interface RagFlowNodeConfig {
  ragflow_key: string;
  ragflow_url: string;
  ragflow_agent_id: string;
  ragflow_dialog_id?: string; // ✅ 新增：普通session对话模式ID，设为可选
  enabled?: boolean;
  priority?: number; // 数字越小，优先级越高
}

// 执行结果接口
export interface ExecutionResult<T> {
  result: T;
  nodeConfig: RagFlowNodeConfig;
}

/**
 * API响应的联合类型
 */
export type RagflowApiResponse<T> = RagflowSuccessResponse<T> | RagflowErrorResponse;

// =================================================================
//                 API端点相关的类型定义
// =================================================================

/**
 * 会话对象结构
 */
export interface CreateSessionResponse {
  chat_id: string;
  create_date: string;
  create_time: number;
  id: string;
  messages: Message[];
  name: string;
  update_date: string;
  update_time: number;
}
export interface Message {
  content: string;
  role: string;
}

/**
 * 创建会话 (POST /v1/chats/{chatId}/sessions)
 */
export interface CreateSessionPayload {
  name: string;
}

/**
 * 获取回复 (POST /v1/chats/{chatId}/completions)
 */
export interface CompletionPayload {
  question: string;
  session_id: string;
  stream?: boolean;
}
export interface ChatSessionResponse {
  answer: string;
  audio_binary?: any;
  created_at: number;
  id: string;
  prompt: string;
  reference: object;
  session_id: string;
}

/**
 * 获取 Agent 列表的请求参数
 */
export interface GetAgentListParams {
  page?: number;
  page_size?: number;
  orderby?: string;
  desc?: boolean;
  name?: string;
  id?: string;
}

export interface AgentListResponse {
  avatar: any;
  canvas_type: any;
  create_date: string;
  create_time: number;
  description: any;
  dsl: object;
  id: string;
  title: string;
  update_date: string;
  update_time: number;
  user_id: string;
}

export interface CreateAgentSessionResponse {
  id: string;
  agent_id: string;
  dsl: object;
  message: [object];
  source: string;
  user_id: string;
}

/**
 * 进行Agent对话的请求体
 */
export interface AgentCompletionPayload {
  question: string;
  session_id: string;
  stream?: boolean;
  user_id?: string;
  sync_dsl?: boolean;
}

/**
 * 进行Agent对话的响应数据
 */
export interface AgentCompletionResponse {
  answer: string;
  session_id: string;
  // ... 其他字段
}
