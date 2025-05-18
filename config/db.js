import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: 'ironport#33',
  database: process.env.DB_NAME || 'expense_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool;

export async function createConnection() {
  try {
    pool = mysql.createPool(dbConfig);

    // Test the connection
    const connection = await pool.getConnection();
    console.log('Database connection established successfully');

    // Initialize database if needed
    // await initDatabase(connection);

    // await insertUsers(connection);
    // await deleteAllUsers(connection);
    // await getCategories(connection);
    // await getAllUsers(connection);
    // await createExpensesTable(connection);

    // await readDatabase(connection);

    connection.release();
    return pool;
  } catch (error) {
    console.error('Error connecting to database:', error.message);
    process.exit(1);
  }
}

async function initDatabase(connection) {
  try {
    // Create tables if they don't exist
    await createUsersTable(connection);
    await createCategoriesTable(connection);
    await createExpensesTable(connection);
    await insertDefaultCategories(connection);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
}

async function createUsersTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      phone VARCHAR(20),
      password VARCHAR(100) NOT NULL,
      gender ENUM('male', 'female', 'other'),
      birth_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function getAllUsers(connection) {
  const [users] = await connection.query('SELECT * FROM users');
  console.log('Users table retrieved', users);

  return users;
}

async function deleteUsersTable(connection) {
  await connection.query(`DROP TABLE IF EXISTS users`);
  console.log('Users table deleted');
}

async function deleteAllUsers(connection) {
  await connection.query(`DELETE FROM users`);
  console.log('All users deleted');
}

async function insertUsers(connection) {
  await connection.query(`
    INSERT INTO users (name, email, phone, password, gender, birth_date) VALUES ('John Doe', 'john@example.com', '1234567890', 'password', 'male', '1990-01-01');
    `);
}

async function createCategoriesTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      icon VARCHAR(50),
      is_default BOOLEAN DEFAULT false,
      user_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

async function createExpensesTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method ENUM('cash', 'credit_card', 'debit_card', 'bank_transfer', 'other', 'UPI') DEFAULT 'cash',
      notes TEXT,
      category_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

async function insertDefaultCategories(connection) {
  const defaultCategories = [
    { name: 'Fuel', icon: 'fuel' },
    { name: 'Rent', icon: 'home' },
    { name: 'Groceries', icon: 'shopping-cart' },
    { name: 'Utilities', icon: 'zap' },
    { name: 'Entertainment', icon: 'film' },
    { name: 'Dining', icon: 'utensils' },
    { name: 'Transportation', icon: 'car' },
    { name: 'Healthcare', icon: 'heart' },
    { name: 'Education', icon: 'book' },
    { name: 'Shopping', icon: 'shopping-bag' },
  ];

  // Check if default categories exist
  const [existingCategories] = await connection.query(
    'SELECT COUNT(*) as count FROM categories WHERE is_default = true'
  );

  if (existingCategories[0].count === 0) {
    for (const category of defaultCategories) {
      await connection.query(
        'INSERT INTO categories (name, icon, is_default) VALUES (?, ?, true)',
        [category.name, category.icon]
      );
    }
    console.log('Default categories created');
  }
}

async function getCategories(connection) {
  const [categories] = await connection.query('SELECT * FROM categories');
  console.log('Categories table retrieved', categories);
  return categories;
}

async function readDatabase(connection) {
  try {
    // 1. Get all table names
    const [tables] = await connection.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'expense_tracker';
    `);
    console.log(
      'Tables retrieved:',
      tables.map((t) => t.TABLE_NAME)
    );

    // 2. Initialize result array
    const schemaDetails = [];

    // 3. For each table, fetch columns, constraints, and indexes
    for (const { TABLE_NAME } of tables) {
      const tableDetails = {
        tableName: TABLE_NAME,
        columns: [],
        constraints: [],
        indexes: [],
      };

      // 4. Get column details
      const [columns] = await connection.query(
        `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          CHARACTER_MAXIMUM_LENGTH,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          COLUMN_KEY,
          EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'expense_tracker' 
          AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION;
      `,
        [TABLE_NAME]
      );

      tableDetails.columns = columns.map((col) => ({
        name: col.COLUMN_NAME,
        dataType: col.DATA_TYPE,
        maxLength: col.CHARACTER_MAXIMUM_LENGTH,
        isNullable: col.IS_NULLABLE === 'YES',
        defaultValue: col.COLUMN_DEFAULT,
        isPrimaryKey: col.COLUMN_KEY === 'PRI',
        isAutoIncrement: col.EXTRA.includes('auto_increment'),
      }));

      // 5. Get constraints (primary and foreign keys)
      const [constraints] = await connection.query(
        `
        SELECT 
          tc.TABLE_NAME,
          tc.CONSTRAINT_NAME,
          tc.CONSTRAINT_TYPE,
          kcu.COLUMN_NAME,
          kcu.REFERENCED_TABLE_NAME,
          kcu.REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        WHERE tc.TABLE_SCHEMA = 'expense_tracker'
          AND tc.TABLE_NAME = ?
          AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'FOREIGN KEY');
      `,
        [TABLE_NAME]
      );

      tableDetails.constraints = constraints.map((con) => ({
        constraintName: con.CONSTRAINT_NAME,
        constraintType: con.CONSTRAINT_TYPE,
        columnName: con.COLUMN_NAME,
        referencedTable: con.REFERENCED_TABLE_NAME,
        referencedColumn: con.REFERENCED_COLUMN_NAME,
      }));

      // 6. Get indexes
      const [indexes] = await connection.query(
        `
        SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = 'expense_tracker'
          AND TABLE_NAME = ?
        ORDER BY INDEX_NAME;
      `,
        [TABLE_NAME]
      );

      tableDetails.indexes = indexes.map((idx) => ({
        indexName: idx.INDEX_NAME,
        columnName: idx.COLUMN_NAME,
        isUnique: idx.NON_UNIQUE === 0,
      }));

      schemaDetails.push(tableDetails);
    }

    // 7. Pretty-print the full schema details
    console.log('Schema details retrieved:');
    console.log(JSON.stringify(schemaDetails, null, 2));

    return schemaDetails;
  } catch (error) {
    console.error('Error retrieving schema:', error);
    throw error;
  }
}

export function getPool() {
  if (!pool) throw new Error('Database connection not established');
  return pool;
}

export default {
  createConnection,
  getPool,
};
