import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        detail: 'An unexpected error occurred',
      });
    }

    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;
    let detail: string | string[];

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      detail = exceptionResponse;
    } else {
      const res = exceptionResponse as Record<string, unknown>;
      if (Array.isArray(res.message)) {
        message = 'Validation failed';
        detail = res.message as string[];
      } else {
        message = (res.message as string) ?? exception.message;
        detail = message;
      }
    }

    return response.status(statusCode).json({ statusCode, message, detail });
  }
}
