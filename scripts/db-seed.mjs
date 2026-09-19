/**
 * Database seeding script - create initial admin user and test data
 */
import { registerUser, addUserQuota } from '../packages/auth/index.mjs';
import { execute } from '../packages/database/schema.mjs';
import { randomUUID } from 'node:crypto';

console.log('Seeding database...\n');

async function seed() {
  try {
    // Create admin user
    console.log('Creating admin user...');
    const admin = await registerUser({
      email: 'admin@zora.local',
      password: 'admin123',
      username: 'Admin',
    });

    // Set admin role and add quota
    await execute('UPDATE users SET role = ?, quota_balance = ? WHERE id = ?', [
      'admin',
      10000,
      admin.userId
    ]);
    console.log('✓ Admin user created (email: admin@zora.local, password: admin123)');

    // Create test user
    console.log('Creating test user...');
    const testUser = await registerUser({
      email: 'test@zora.local',
      password: 'test123',
      username: 'Test User',
    });

    await addUserQuota(testUser.userId, 1000);
    console.log('✓ Test user created (email: test@zora.local, password: test123)');

    // Insert default models
    console.log('Inserting default models...');
    const now = Date.now();

    const models = [
      {
        id: 'gpt-5.5',
        name: 'GPT 5.5',
        kind: 'agent',
        provider: 'openai',
        quota_cost_per_unit: 1,
        max_concurrency: null,
      },
      {
        id: 'gpt-image-2',
        name: 'GPT Image 2',
        kind: 'image',
        provider: 'openai',
        quota_cost_per_unit: 10,
        max_concurrency: 4,
      },
      {
        id: 'MiniMax-H3',
        name: 'MiniMax H3',
        kind: 'video',
        provider: 'minimax',
        quota_cost_per_unit: 100,
        max_concurrency: 2,
      },
    ];

    for (const model of models) {
      await execute(
        `INSERT INTO server_models (id, name, kind, enabled, provider, quota_cost_per_unit, max_concurrency, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`,
        [
          model.id,
          model.name,
          model.kind,
          model.provider,
          model.quota_cost_per_unit,
          model.max_concurrency,
          now,
          now
        ]
      );
    }

    console.log(`✓ ${models.length} models inserted`);

    console.log('\n✓ Database seeding completed successfully');
    console.log('\nYou can now login with:');
    console.log('  Admin: admin@zora.local / admin123 (10000 积分)');
    console.log('  Test:  test@zora.local / test123 (1100 积分)');

  } catch (error) {
    if (error.message && error.message.includes('已被注册')) {
      console.log('\n⚠ Database already seeded (users exist)');
      console.log('To re-seed, delete data/zora.db and run again');
    } else {
      throw error;
    }
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n✖ Seeding failed:', error);
    process.exit(1);
  });
