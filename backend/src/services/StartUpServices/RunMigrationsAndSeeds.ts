import { exec } from "child_process";
import { promisify } from "util";
import User from "../../models/User";
import { logger } from "../../utils/logger";

const execAsync = promisify(exec);

const RunMigrationsAndSeeds = async (): Promise<void> => {
  try {
    logger.info("Starting database migration check...");

    // 1. Always run migrations
    // We use 'npx sequelize db:migrate' which uses .sequelizerc (pointing to dist)
    // This assumes the code is running in an environment where 'npx' and 'sequelize-cli' are available.
    logger.info("Running migrations...");
    const { stdout: migrateStdout, stderr: migrateStderr } = await execAsync("npx sequelize db:migrate");
    if (migrateStdout) logger.info(`Migration output: ${migrateStdout}`);
    if (migrateStderr) logger.warn(`Migration stderr: ${migrateStderr}`);
    
    logger.info("Migrations executed successfully.");

    // 2. Check if we need to seed
    // We need to ensure the connection is ready or just try. 
    // Since we just ran migrations, the DB is accessible.
    const userCount = await User.count();

    if (userCount === 0) {
      logger.info("Database appears empty (no users). Running seeds...");
      const { stdout: seedStdout, stderr: seedStderr } = await execAsync("npx sequelize db:seed:all");
      if (seedStdout) logger.info(`Seed output: ${seedStdout}`);
      if (seedStderr) logger.warn(`Seed stderr: ${seedStderr}`);
      logger.info("Seeds executed successfully.");
    } else {
      logger.info("Database already populated. Skipping seeds.");
    }
  } catch (error) {
    logger.error("Error during database startup (migrations/seeds):");
    logger.error(error);
    // Re-throw to prevent server from starting in an inconsistent state
    throw error;
  }
};

export default RunMigrationsAndSeeds;
