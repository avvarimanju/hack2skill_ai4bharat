// Centralized logging utility for Lambda functions
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  siteId?: string;
  artifactId?: string;
  [key: string]: any;
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    switch (level) {
      case 'debug':
        this.logLevel = LogLevel.DEBUG;
        break;
      case 'info':
        this.logLevel = LogLevel.INFO;
        break;
      case 'warn':
        this.logLevel = LogLevel.WARN;
        break;
      case 'error':
        this.logLevel = LogLevel.ERROR;
        break;
      default:
        this.logLevel = LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, message: string, context?: LogContext, error?: Error): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context, error));
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, context, error));
    }
  }

  // Performance logging
  time(label: string): void {
    console.time(label);
  }

  timeEnd(label: string): void {
    console.timeEnd(label);
  }
}

export const logger = new Logger();