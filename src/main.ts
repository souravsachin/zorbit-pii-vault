import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // OpenTelemetry must be initialized before the app starts
  initOpenTelemetry();

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);

  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Zorbit PII Vault')
    .setDescription('Secure storage of Personally Identifiable Information (PII) with tokenization, detokenization, encryption at rest (AES-256-GCM), and access audit capabilities.')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('pii', 'PII tokenization, detokenization, and management')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = configService.get<number>('PORT', 3005);

  await app.listen(port);
  console.log(`zorbit-pii-vault service listening on port ${port}`);
}

function initOpenTelemetry(): void {
  // TODO: Initialize OpenTelemetry SDK when @opentelemetry/sdk-node is configured
  // const sdk = new NodeSDK({
  //   serviceName: process.env.OTEL_SERVICE_NAME || 'zorbit-pii-vault',
  //   traceExporter: new OTLPTraceExporter({
  //     url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  //   }),
  // });
  // sdk.start();
}

bootstrap();
