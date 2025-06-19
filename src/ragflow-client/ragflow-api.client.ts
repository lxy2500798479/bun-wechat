/**
 * 底层、完整的RagFlow API客户端，
 * 它的每个方法都对应一个官方API端点，提供了最大的灵活性。
 */
import type {
  AgentCompletionPayload,
  AgentCompletionResponse,
  AgentListResponse,
  ChatSessionResponse,
  CompletionPayload,
  CreateAgentSessionResponse,
  CreateSessionPayload,
  CreateSessionResponse,
  GetAgentListParams,
  RagflowApiResponse,
  RagflowSuccessResponse,
} from './types';

// ✅ --- 新增的类型守卫函数 ---
// 这个函数会在运行时检查响应，并向TypeScript明确保证其类型。
function isSuccessResponse<T>(response: RagflowApiResponse<T>): response is RagflowSuccessResponse<T> {
  return response.code === 0;
}

export class RagFlowApiClient {
  private readonly apiKey: string;
  private readonly apiBase: string;

  constructor(apiKey: string, apiBase: string) {
    if (!apiKey || !apiBase) {
      throw new Error('RagFlowApiClient: apiKey 和 apiBase 不能为空。');
    }
    this.apiKey = apiKey;
    this.apiBase = apiBase;
  }

  private async _request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;

    const defaultHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (typeof options.body === 'string') {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const config: RequestInit = {
      ...options,
      headers: { ...defaultHeaders, ...options.headers },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errorText}`);
    }

    const resData: RagflowApiResponse<T> = await response.json();
    // console.log(resData);

    if (isSuccessResponse(resData)) {
      return resData.data;
    }

    throw new Error(`API Error (code ${resData.code}): ${resData.message}`);
  }

  // --- 对话相关API ---

  async createSession(chatId: string, payload: CreateSessionPayload): Promise<CreateSessionResponse> {
    return this._request<CreateSessionResponse>(`/chats/${chatId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async dialogCompletion(chatId: string, payload: CompletionPayload): Promise<ChatSessionResponse> {
    return this._request<ChatSessionResponse>(`/chats/${chatId}/completions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createAgentSession(chatId: string, payload: any): Promise<CreateAgentSessionResponse> {
    return this._request<CreateAgentSessionResponse>(`/agents/${chatId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * ✅ 新增: 与Agent进行对话
   * @param agentId 代理的ID
   * @param payload 请求体，包含问题和会话ID
   */
  async agentCompletion(agentId: string, payload: AgentCompletionPayload): Promise<AgentCompletionResponse> {
    return this._request<AgentCompletionResponse>(`/agents/${agentId}/completions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * 获取Agent列表，支持分页和筛选
   * @param params (可选) 查询参数对象，不传时默认查询第1页，每页10条
   * @returns {Promise<AgentListResponse>} Agent列表响应
   */
  async getAgentList(params: GetAgentListParams = {}): Promise<AgentListResponse[]> {
    // 设置默认分页参数
    const defaultParams: GetAgentListParams = {
      page: 1,
      page_size: 10,
    };

    const mergedParams = { ...defaultParams, ...params };

    const queryParams = new URLSearchParams();

    for (const key in mergedParams) {
      const value = mergedParams[key as keyof GetAgentListParams];
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    }

    const queryString = queryParams.toString();

    const endpoint = `/agents${queryString ? `?${queryString}` : ''}`;

    return this._request<AgentListResponse[]>(endpoint, {
      method: 'GET',
    });
  }
}
