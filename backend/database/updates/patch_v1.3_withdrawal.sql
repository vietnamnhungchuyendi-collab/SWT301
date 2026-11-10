USE FJMS;
GO

-- Create WithdrawalRequests Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WithdrawalRequests' and xtype='U')
BEGIN
    CREATE TABLE WithdrawalRequests (
        withdrawal_id INT IDENTITY(1,1) PRIMARY KEY,
        wallet_id INT NOT NULL,
        bank_account_id INT NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        status NVARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_WithdrawalRequests_Wallet FOREIGN KEY (wallet_id) REFERENCES Wallet(wallet_id),
        CONSTRAINT FK_WithdrawalRequests_BankAccount FOREIGN KEY (bank_account_id) REFERENCES BankAccount(bank_account_id)
    );
END
GO
