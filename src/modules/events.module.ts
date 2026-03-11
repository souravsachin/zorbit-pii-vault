import { Module, Global } from '@nestjs/common';
import { EventPublisherService } from '../events/event-publisher.service';

@Global()
@Module({
  providers: [EventPublisherService],
  exports: [EventPublisherService],
})
export class EventsModule {}
