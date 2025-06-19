// src/lib/logger.ts (改造为静态日志模式)

import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

// 日志级别定义保持不变
enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
}

// 日志级别名称映射保持不变
const LogLevelName: { [key in LogLevel]: string } = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
};

// 日志配置保持不变
const LOG_DIR = join(process.cwd(), 'logs');
const MIN_LEVEL = LogLevel[process.env.LOG_LEVEL?.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO;
const SHOW_LOCATION = Bun.env.LOG_LOCATION === 'true';

// 确保日志目录存在
if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 静态日志类，提供全局的日志记录方法
 */
export class Log {
    // 关键改动：将 message 的类型从 string 改为 any，使其可以接收任何类型
    public static debug(message: any, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, args);
    }

    public static info(message: any, ...args: any[]): void {
        this.log(LogLevel.INFO, message, args);
    }

    public static warn(message: any, ...args: any[]): void {
        this.log(LogLevel.WARN, message, args);
    }

    public static error(message: any, error?: unknown, ...args: any[]): void {
        let combinedMessage = this.formatMessage(message);

        // 在方法内部进行类型检查
        if (error) {
            if (error instanceof Error) {
                // 如果是 Error 实例，就记录其堆栈信息
                combinedMessage += ` | Error: ${error.stack || error.message}`;
            } else {
                // 如果是其他类型（字符串、对象等），就用 JSON.stringify 记录
                combinedMessage += ` | Error Details: ${JSON.stringify(error)}`;
            }
        }
        this.log(LogLevel.ERROR, combinedMessage, args);
    }

    /**
     * 智能地将任何类型的消息转换为字符串
     */
    private static formatMessage(message: any): string {
        if (typeof message === 'string') {
            return message;
        }
        if (typeof message === 'object' && message !== null) {
            // 使用 JSON.stringify 并提供 2 个空格的缩进，让输出更易读
            return JSON.stringify(message, null, 2);
        }
        return String(message);
    }

    /**
     * 获取日志调用方的文件和行号
     */
    private static getCallerLocation(): string {
        const err = new Error();
        const stack = err.stack?.split('\n');

        // 修复点 1：检查 stack 长度应该用 5，因为我们要访问索引 4
        if (!stack || stack.length < 5) {
            return '';
        }

        const callerLine = stack[4];

        // 修复点 2：使用更严谨的检查，确保 match 存在且包含我们需要的捕获组
        // 我们的正则有 3 个捕获组，所以 match 数组长度至少为 4
        const match = callerLine?.match(/\(?(file:\/\/\/.*?):(\d+):(\d+)\)?$/);
        if (match && match.length > 2) { // 确保 match[1] 和 match[2] 存在
            // @ts-ignore
            const relativePath = match[1].replace(`file://${process.cwd()}/`, '');
            return `(${relativePath}:${match[2]})`;
        }

        return '';
    }

    private static log(level: LogLevel, message: any, args: any[]): void {
        if (level < MIN_LEVEL) return;

        // 1. 格式化主消息
        let finalMessage = this.formatMessage(message);

        // 2. 如果有额外参数，也格式化并追加
        if (args.length > 0) {
            finalMessage += ` | Args: ${JSON.stringify(args, null, 2)}`;
        }

        const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
        const levelName = LogLevelName[level].padEnd(5, ' ');
        const location = SHOW_LOCATION ? this.getCallerLocation().padEnd(30, ' ') : ''; // 获取位置

        // 3. 组合成最终的日志字符串
        const formattedMessage = `${timestamp} [${levelName}] [APP] ${location}- ${finalMessage}\n`;

        process.stdout.write(formattedMessage);
        this.writeToFile(formattedMessage);
    }
    /**
     * 写入文件的私有静态方法
     */
    private static async writeToFile(message: string): Promise<void> {
        try {
            const date = new Date().toISOString().slice(0, 10);
            const logFilePath = join(LOG_DIR, `app-${date}.log`);
            await Bun.write(logFilePath, message);
        } catch (err) {
            console.error('Failed to write log to file:', err);
        }
    }
}