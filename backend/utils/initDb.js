import { poolPromise } from '../config/db.js';

export const initDb = async () => {
  try {
    const pool = await poolPromise;

    // Create Wallet Table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Wallet' and xtype='U')
      CREATE TABLE Wallet (
        wallet_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        balance DECIMAL(18,2) DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );
    `);

    // Create BankAccount Table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BankAccount' and xtype='U')
      CREATE TABLE BankAccount (
        bank_account_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        bank_name NVARCHAR(100) NOT NULL,
        account_number NVARCHAR(50) NOT NULL,
        account_holder_name NVARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );
    `);

    // Create WalletTransaction Table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WalletTransaction' and xtype='U')
      CREATE TABLE WalletTransaction (
        transaction_id INT IDENTITY(1,1) PRIMARY KEY,
        wallet_id INT NOT NULL,
        transaction_type NVARCHAR(50) NOT NULL, -- e.g., 'DEPOSIT'
        amount DECIMAL(18,2) NOT NULL,
        description NVARCHAR(255),
        created_at DATETIME DEFAULT GETDATE()
      );
    `);

    // Create reviews Table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='reviews' and xtype='U')
      CREATE TABLE reviews (
        review_id INT IDENTITY(1,1) PRIMARY KEY,
        contract_id INT NOT NULL,
        reviewer_id INT NOT NULL,
        reviewee_id INT NOT NULL,
        rating INT NOT NULL,
        comment NVARCHAR(1000),
        created_at DATETIME DEFAULT GETDATE()
      );
    `);

    // Create/Update ai_chat_sessions Table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ai_chat_sessions' and xtype='U')
      BEGIN
        CREATE TABLE ai_chat_sessions (
          session_id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL,
          title NVARCHAR(255) NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        );
      END
      ELSE
      BEGIN
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('ai_chat_sessions') AND name = 'title')
          ALTER TABLE ai_chat_sessions ADD title NVARCHAR(255) NOT NULL DEFAULT 'New Chat';
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('ai_chat_sessions') AND name = 'created_at')
          ALTER TABLE ai_chat_sessions ADD created_at DATETIME DEFAULT GETDATE();
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('ai_chat_sessions') AND name = 'updated_at')
          ALTER TABLE ai_chat_sessions ADD updated_at DATETIME DEFAULT GETDATE();
      END
    `);

    // Create/Update ai_chat_messages Table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ai_chat_messages' and xtype='U')
      BEGIN
        CREATE TABLE ai_chat_messages (
          message_id INT IDENTITY(1,1) PRIMARY KEY,
          session_id INT NOT NULL,
          role VARCHAR(50) NOT NULL,
          content NVARCHAR(MAX) NOT NULL,
          created_at DATETIME DEFAULT GETDATE()
        );
      END
      ELSE
      BEGIN
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('ai_chat_messages') AND name = 'session_id')
          ALTER TABLE ai_chat_messages ADD session_id INT NOT NULL;
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('ai_chat_messages') AND name = 'role')
          ALTER TABLE ai_chat_messages ADD role VARCHAR(50) NULL;
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('ai_chat_messages') AND name = 'content')
          ALTER TABLE ai_chat_messages ADD content NVARCHAR(MAX) NOT NULL;
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('ai_chat_messages') AND name = 'created_at')
          ALTER TABLE ai_chat_messages ADD created_at DATETIME DEFAULT GETDATE();
        
        -- Make sender_type NULL-able if it exists so it doesn't block INSERTs
        IF EXISTS (SELECT * FROM syscolumns WHERE id = object_id('ai_chat_messages') AND name = 'sender_type')
          ALTER TABLE ai_chat_messages ALTER COLUMN sender_type VARCHAR(50) NULL;
      END
    `);

    await pool.request().query(`
      IF EXISTS (SELECT * FROM sysobjects WHERE name='violation_reports' AND xtype='U')
      BEGIN
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('violation_reports') AND name = 'project_id')
          ALTER TABLE violation_reports ADD project_id INT NULL;
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('violation_reports') AND name = 'entity_type')
          ALTER TABLE violation_reports ADD entity_type NVARCHAR(50) NULL;
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('violation_reports') AND name = 'entity_id')
          ALTER TABLE violation_reports ADD entity_id INT NULL;
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('violation_reports') AND name = 'owner_id')
          ALTER TABLE violation_reports ADD owner_id INT NULL;
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('violation_reports') AND name = 'metadata')
          ALTER TABLE violation_reports ADD metadata NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('violation_reports') AND name = 'description')
          ALTER TABLE violation_reports ADD description NVARCHAR(MAX) NULL;

        IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = object_id('proposals') AND name = 'portfolio_ids')
          ALTER TABLE proposals ADD portfolio_ids NVARCHAR(MAX) NULL;
      END
    `);

    console.log('✅ Wallet Management, Review, and AI Chat tables initialized (if not existed)');
  } catch (error) {
    console.error('❌ Failed to initialize database tables:', error);
  }
};
