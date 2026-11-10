USE FJMS;
GO

-- Add status column to WalletTransaction if not exists
IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'status' AND Object_ID = Object_ID(N'WalletTransaction'))
BEGIN
    ALTER TABLE WalletTransaction ADD status NVARCHAR(50) DEFAULT 'COMPLETED';
END
GO

-- Create EscrowAccounts Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EscrowAccounts' and xtype='U')
BEGIN
    CREATE TABLE EscrowAccounts (
        escrow_id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        employer_id INT NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        status NVARCHAR(50) DEFAULT 'FUNDED', -- 'FUNDED', 'RELEASED', 'REFUNDED'
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- Create EscrowTransactions Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EscrowTransactions' and xtype='U')
BEGIN
    CREATE TABLE EscrowTransactions (
        transaction_id INT IDENTITY(1,1) PRIMARY KEY,
        escrow_id INT NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        type NVARCHAR(50) NOT NULL, -- 'DEPOSIT', 'RELEASE', 'REFUND'
        status NVARCHAR(50) DEFAULT 'COMPLETED',
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO
