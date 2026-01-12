/**
 * マイグレーション実行スクリプト
 *
 * 使用方法:
 *   npx tsx src/lib/migrations/runMigrations.ts
 *
 * または package.json に追加:
 *   "db:migrate": "tsx src/lib/migrations/runMigrations.ts"
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

interface MigrationRecord {
  id: number;
  name: string;
  executed_at: Date;
}

async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // マイグレーション管理テーブルを作成（存在しない場合）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 実行済みマイグレーションを取得
    const executedResult = await pool.query<MigrationRecord>(
      'SELECT name FROM _migrations ORDER BY id'
    );
    const executedMigrations = new Set(executedResult.rows.map(row => row.name));

    // マイグレーションファイルを取得
    const migrationsDir = __dirname;
    const files = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    console.log(`Found ${files.length} migration file(s)`);

    // 未実行のマイグレーションを実行
    let executedCount = 0;
    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`  Skip: ${file} (already executed)`);
        continue;
      }

      console.log(`  Running: ${file}`);

      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf-8');

      // トランザクションでマイグレーションを実行
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // SQLを実行
        await client.query(sql);

        // マイグレーション記録を保存
        await client.query(
          'INSERT INTO _migrations (name) VALUES ($1)',
          [file]
        );

        await client.query('COMMIT');
        console.log(`    Success: ${file}`);
        executedCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`    Failed: ${file}`);
        console.error(`    Error: ${errorMessage}`);
        throw error;
      } finally {
        client.release();
      }
    }

    if (executedCount === 0) {
      console.log('\nAll migrations are up to date.');
    } else {
      console.log(`\nSuccessfully executed ${executedCount} migration(s).`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\nMigration failed:', errorMessage);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// スクリプトとして実行された場合
runMigrations().catch(console.error);

export { runMigrations };
