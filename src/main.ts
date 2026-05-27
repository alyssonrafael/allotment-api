import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');
  app.enableCors({ origin: allowedOrigins, credentials: true });

  const prefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(prefix);

  // alias /health para UptimeRobot e Docker healthcheck
  const http = app.getHttpAdapter().getInstance();
  http.get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => res.json({ status: 'ok' }));

  if (process.env.SWAGGER_ENABLED === 'true') {
    const serverUrl = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3333}`;
    const config = new DocumentBuilder()
      .setTitle('Allotment API')
      .setDescription('API para gestão de eventos e allotments')
      .setVersion('1.0')
      .addServer(serverUrl)
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();
