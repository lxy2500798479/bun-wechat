import { join, dirname } from 'node:path';
// ⭐️ 引入 Node.js 的 fs/promises 模块用于文件追加操作
import { appendFile, mkdir } from 'node:fs/promises';

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

/**
 * 静态日志类，提供全局的日志记录方法
 */
export class Log {
    // ... (debug, info, warn, error, formatMessage, getCallerLocation 等方法保持不变)
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
     * ⭐️ [已修正] 写入文件的私有静态方法
     * 使用 fs.promises.appendFile 来确保日志是追加写入，而不是覆盖。
     */
    private static async writeToFile(message: string): Promise<void> {
        try {
            const date = new Date().toISOString().slice(0, 10);
            const logFilePath = join(LOG_DIR, `app-${date}.log`);

            // 1. 确保日志目录存在 (appendFile 不会自动创建目录)
            // 'recursive: true' 效果类似于 mkdir -p
            await mkdir(dirname(logFilePath), { recursive: true });

            // 2. 使用 appendFile 将日志追加到文件末尾
            // 它会以 utf-8 编码写入，并正确处理文件创建
            await appendFile(logFilePath, message, 'utf-8');

        } catch (err) {
            console.error('Failed to append log to file:', err);
        }
    }
}