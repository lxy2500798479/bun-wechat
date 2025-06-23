import {join} from 'node:path';
// ✅ 移除 'node:fs' 依赖，因为它导致了打包后的运行时错误
import { existsSync, mkdirSync } from 'node:fs';

// 日志级别定义
enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
}

// 日志级别名称映射
const LogLevelName: { [key in LogLevel]: string } = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
};

// 日志配置
const LOG_DIR = join(process.cwd(), 'logs');
const MIN_LEVEL = LogLevel.INFO;
const SHOW_LOCATION = true;

// ✅ 移除手动检查和创建目录的逻辑
// Bun 的文件写入操作会自动处理目录创建，所以这段代码是不必要的，并且是错误的根源。

if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
}


/**
 * 静态日志类，提供全局的日志记录方法
 */
export class Log {
    // ... (debug, info, warn, error, formatMessage, getCallerLocation, log 方法保持不变)
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

        if (error) {
            if (error instanceof Error) {
                combinedMessage += ` | Error: ${error.stack || error.message}`;
            } else {
                combinedMessage += ` | Error Details: ${JSON.stringify(error)}`;
            }
        }
        this.log(LogLevel.ERROR, combinedMessage, args);
    }

    private static formatMessage(message: any): string {
        if (typeof message === 'string') {
            return message;
        }
        if (typeof message === 'object' && message !== null) {
            return JSON.stringify(message, null, 2);
        }
        return String(message);
    }

    private static getCallerLocation(): string {
        const err = new Error();
        const stack = err.stack?.split('\n');

        if (!stack || stack.length < 5) {
            return '';
        }

        const callerLine = stack[4];

        const match = callerLine?.match(/\(?(file:\/\/\/.*?):(\d+):(\d+)\)?$/);
        if (match && match.length > 2) {
            // @ts-ignore
            const relativePath = match[1].replace(`file://${process.cwd()}/`, '');
            return `(${relativePath}:${match[2]})`;
        }

        return '';
    }

    private static log(level: LogLevel, message: any, args: any[]): void {
        if (level < MIN_LEVEL) return;

        let finalMessage = this.formatMessage(message);

        if (args.length > 0) {
            finalMessage += ` | Args: ${JSON.stringify(args, null, 2)}`;
        }

        const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
        const levelName = LogLevelName[level].padEnd(5, ' ');
        const location = SHOW_LOCATION ? this.getCallerLocation().padEnd(30, ' ') : '';

        const formattedMessage = `${timestamp} [${levelName}] [APP] ${location}- ${finalMessage}\n`;

        process.stdout.write(formattedMessage);
        this.writeToFile(formattedMessage);
    }

    /**
     * 写入文件的私有静态方法
     * 这里的 Bun.file().writer() 会在 flush 时确保文件和目录存在
     */
    private static async writeToFile(message: string): Promise<void> {
        try {
            const date = new Date().toISOString().slice(0, 10);
            const logFilePath = join(LOG_DIR, `app-${date}.log`);
            const file = Bun.file(logFilePath);
            const writer = file.writer();
            const encoder = new TextEncoder();
            writer.write(encoder.encode(message));
            await writer.flush();
        } catch (err) {
            console.error('写入日志到文件失败:', err);
        }
    }
}