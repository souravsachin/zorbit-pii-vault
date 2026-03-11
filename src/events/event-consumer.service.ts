import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { createKafkaConfig } from '../config/kafka.config';
import { ConsumedEvents, ZorbitEventEnvelope } from './pii.events';
import { TokenizationService } from '../services/tokenization.service';

/**
 * Consumes external events from Kafka.
 * Handles identity.user.deleted to cascade-delete PII data.
 */
@Injectable()
export class EventConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventConsumerService.name);
  private consumer!: Consumer;
  private kafka!: Kafka;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenizationService: TokenizationService,
  ) {}

  async onModuleInit(): Promise<void> {
    const kafkaConfig = createKafkaConfig(this.configService);
    this.kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
    });
    this.consumer = this.kafka.consumer({ groupId: kafkaConfig.groupId });

    try {
      await this.consumer.connect();

      // Subscribe to identity user deletion events
      const topic = ConsumedEvents.IDENTITY_USER_DELETED.replace(/\./g, '-');
      await this.consumer.subscribe({ topic, fromBeginning: false });

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });

      this.logger.log('Kafka consumer connected and subscribed');
    } catch (error) {
      this.logger.warn('Kafka consumer connection failed — events will not be consumed', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.consumer?.disconnect();
    } catch {
      // swallow on shutdown
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, message } = payload;

    if (!message.value) {
      return;
    }

    try {
      const envelope: ZorbitEventEnvelope = JSON.parse(message.value.toString());

      if (envelope.eventType === ConsumedEvents.IDENTITY_USER_DELETED) {
        await this.handleUserDeleted(envelope.payload as { userHashId: string });
      }

      this.logger.debug(`Processed event from topic ${topic}: ${envelope.eventType}`);
    } catch (error) {
      this.logger.error(`Failed to process message from topic ${topic}`, error);
    }
  }

  /**
   * When a user is deleted in the identity service, cascade delete all their PII data.
   */
  private async handleUserDeleted(payload: { userHashId: string }): Promise<void> {
    this.logger.log(`Cascade deleting PII for deleted user ${payload.userHashId}`);
    await this.tokenizationService.deleteAllByCreator(payload.userHashId);
  }
}
