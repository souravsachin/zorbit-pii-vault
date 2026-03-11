import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  app.enableCors();

  const configService = app.get(ConfigService);
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
