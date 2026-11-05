import { sql } from 'drizzle-orm'
import { blob, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// --- Tablas de Better Auth ---------------------------------------------------

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

// --- Datos de la app ----------------------------------------------------------

export const binder = sqliteTable('binder', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  pageCount: integer('page_count').notNull().default(2),
  position: integer('position').notNull().default(0),
  /** Color de las hojas del binder (ver src/binderColors.ts). */
  color: text('color').notNull().default('morado'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/** Preferencias de cada usuario (por ahora, el skin de la app). */
export const userPref = sqliteTable('user_pref', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  skin: text('skin').notNull().default('clasico'),
  /** 'dark' o 'light'. */
  mode: text('mode').notNull().default('dark'),
})

/** Contenido de un casillero: carta oficial o foto, guardado como JSON. */
export const slot = sqliteTable(
  'slot',
  {
    binderId: text('binder_id')
      .notNull()
      .references(() => binder.id, { onDelete: 'cascade' }),
    page: integer('page').notNull(),
    slot: integer('slot').notNull(),
    data: text('data', { mode: 'json' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.binderId, t.page, t.slot] })],
)

/** Fotos guardadas en la base cuando no hay Vercel Blob configurado. */
export const photo = sqliteTable('photo', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(),
  data: blob('data', { mode: 'buffer' }).notNull(),
})

/** Colección: cartas sin páginas ni casilleros, en el orden en que se agregan. */
export const collection = sqliteTable('collection', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/** Carta oficial o foto dentro de una colección, guardada como JSON. */
export const collectionItem = sqliteTable(
  'collection_item',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collection.id, { onDelete: 'cascade' }),
    data: text('data', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('collection_item_by_collection').on(t.collectionId, t.createdAt)],
)
