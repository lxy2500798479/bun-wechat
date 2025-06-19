// src/ragflow-client/ragflow-ha.client.ts

import { RagFlowApiClient } from './ragflow-api.client';
import type { RagflowNodeConfig } from '../config/type';
import { Log } from '../lib/logger';
import type {
    CreateSessionResponse
} from './types';

/**
 * 封装执行结果，包含API调用的返回数据和成功执行该操作的节点配置
 */
export interface ExecutionResult<T> {
    result: T;
    nodeConfig: RagflowNodeConfig;
}

interface ManagedNode {
    config: RagflowNodeConfig;
    client: RagFlowApiClient;
}

/**
 * 用于RagFlow的高可用（HA）客户端，可以管理多个节点。
 * 它会根据节点的优先级自动处理故障转移。
 */
export class RagflowHighAvailabilityClient {
    private readonly nodes: ManagedNode[] = [];

    constructor(nodeConfigs: RagflowNodeConfig[]) {
        if (!nodeConfigs || nodeConfigs.length === 0) {
            Log.warn('RAGFlow 高可用客户端：未提供任何节点配置。');
            return;
        }

        this.nodes = nodeConfigs
            .filter(config => config.enabled)
            .sort((a, b) => (a.priority || 99) - (b.priority || 99))
            .map(config => ({
                config,
                client: new RagFlowApiClient(config.apiKey, config.apiBase)
            }));

        Log.info(`RAGFlow 高可用客户端已初始化，共有 ${this.nodes.length} 个活动节点。`);
        this.nodes.forEach((node, index) => {
            Log.debug(`活动节点 #${index + 1}: 优先级=${node.config.priority}, 地址=${node.config.apiBase}, 对话ID=${node.config.chatId}`);
        });
    }

    private async execute<T>(action: (node: ManagedNode) => Promise<T>): Promise<ExecutionResult<T>> {
        if (this.nodes.length === 0) {
            throw new Error('所有 RAGFlow 节点都不可用或未配置。');
        }

        let lastError: unknown = null;

        for (const node of this.nodes) {
            try {
                const result = await action(node);
                // 返回结果和成功节点的配置
                return { result, nodeConfig: node.config };
            } catch (error) {
                lastError = error;
                Log.error(`位于 ${node.config.apiBase} 的 RAGFlow 节点失败。正在尝试下一个可用节点...`, error);
            }
        }

        Log.error('所有配置的 RAGFlow 节点都未能成功执行操作。');
        throw new Error('所有 RAGFlow 节点均告失败。', { cause: lastError });
    }

    /**
     * 【核心修正】创建新会话，并返回会话信息和成功创建该会话的节点配置
     * @param name - 新会话的名称
     * @returns 一个包含 session 和 nodeConfig 的对象
     */
    public async createSession(name: string): Promise<{ session: CreateSessionResponse; nodeConfig: RagflowNodeConfig; }> {
        const { result, nodeConfig } = await this.execute(async (node) => {
            const chatId = node.config.chatId;
            if (!chatId) {
                throw new Error(`配置错误: 节点 ${node.config.apiBase} 未定义 'chatId'`);
            }
            return node.client.createSession(chatId, { name });
        });
        // 返回一个符合 ChatService 期望的对象结构
        return { session: result, nodeConfig };
    }
}