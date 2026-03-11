import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * TypeORM DataSource used by the CLI for migrations.
 * The runtime connection is configured in AppModule via TypeOrmModule.forRootAsync.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5437', 10),
  database: process.env.DATABASE_NAME || 'zorbit_pii_vault',
  username: process.env.DATABASE_USER || 'zorbit',
  password: process.env.DATABASE_PASSWORD || 'zorbit_dev',
  entities: ['dist/models/entities/**/*.js'],
  migrations: ['dist/migrations/**/*.js'],
  synchronize: false,
  logging: true,
});
