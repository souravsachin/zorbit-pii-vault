import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { createKafkaConfig } from '../config/kafka.config';
import { PiiEventType, ZorbitEventEnvelope } from './pii.events';

/**
 * Publishes domain events to Kafka following the canonical Zorbit event envelope.
 */
@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private producer!: Producer;
  private kafka!: Kafka;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const kafkaConfig = createKafkaConfig(this.configService);
    this.kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
    });
    this.producer = this.kafka.producer();

    try {
      await this.producer.connect();
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.logger.warn('Kafka producer connection failed — events will be dropped', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.producer?.disconnect();
    } catch {
      // swallow on shutdown
    }
  }

  /**
   * Publish a domain event to Kafka.
   * @param eventType - e.g. 'pii.token.created'
   * @param namespace - e.g. 'G'
   * @param namespaceId - e.g. 'G'
   * @param payload - event-specific data
   */
  async publish<T>(
    eventType: PiiEventType,
    namespace: string,
    namespaceId: string,
    payload: T,
  ): Promise<void> {
    const envelope: ZorbitEventEnvelope<T> = {
      eventId: uuidv4(),
      eventType,
      timestamp: new Date().toISOString(),
      source: 'zorbit-pii-vault',
      namespace,
      namespaceId,
      payload,
    };

    const topic = eventType.replace(/\./g, '-'); // pii.token.created → pii-token-created

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: namespaceId,
            value: JSON.stringify(envelope),
          },
        ],
      });
      this.logger.debug(`Published event ${eventType} to topic ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${eventType}`, error);
    }
  }
}
