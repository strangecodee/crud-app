import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: (msg) => console.log(`[SQL] ${msg}`), // Sequelize SQL logging
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  }
);

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`[${new Date().toISOString()}] 🟢 Database Connected: ${process.env.DB_NAME}`);
    await sequelize.sync({ alter: true });
    console.log(`[${new Date().toISOString()}] 📦 Tables Synchronized`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 🔴 DB Error: ${error.message}`);
  }
})();

export default sequelize;

