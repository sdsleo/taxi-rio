import { Injectable, LoggerService } from '@nestjs/common';
import { getRequestContext } from '@taxi-rio/shared';

@Injectable()
export class JsonLogger implements LoggerService {
  private readonly serviceName: string;

  constructor() {
    this.serviceName = process.env.OTEL_SERVICE_NAME || 'taxi-rio-api';
  }

  private formatMessage(level: string, message: unknown, context?: string, stack?: string): string {
    const ctx = getRequestContext();
    const logObject = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.serviceName,
      context: context || 'Application',
      correlation_id: ctx?.correlationId || null,
      trace_id: ctx?.traceId || null,
      user_id: ctx?.userId || null,
      message: typeof message === 'object' ? message : String(message),
      ...(stack ? { stack } : {}),
    };

    return JSON.stringify(logObject);
  }

  log(message: unknown, context?: string): void {
    process.stdout.write(this.formatMessage('info', message, context) + '\n');
  }

  error(message: unknown, stack?: string, context?: string): void {
    process.stderr.write(this.formatMessage('error', message, context, stack) + '\n');
  }

  warn(message: unknown, context?: string): void {
    process.stdout.write(this.formatMessage('warn', message, context) + '\n');
  }

  debug?(message: unknown, context?: string): void {
    process.stdout.write(this.formatMessage('debug', message, context) + '\n');
  }

  verbose?(message: unknown, context?: string): void {
    process.stdout.write(this.formatMessage('verbose', message, context) + '\n');
  }
}
