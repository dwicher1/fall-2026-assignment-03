import { Kysely, sql } from 'kysely';
import type { Database } from '../database.js';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('time_logs')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('ticket_id', 'integer', (col) =>
      col.references('tickets.id').onDelete('cascade').notNull(),
    )
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('hours', 'numeric', (col) => col.notNull())
    .addColumn('logged_at', 'timestamptz', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addCheckConstraint('time_logs_positive_hours', sql`hours > 0`)
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('time_logs').execute();
}
