USE FJMS;
GO

-- 1. Add ai_evaluation column to proposals table if not exists
IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'ai_evaluation' AND Object_ID = Object_ID(N'proposals'))
BEGIN
    ALTER TABLE proposals ADD ai_evaluation NVARCHAR(MAX) NULL;
END
GO

-- 2. Create project_invitations Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='project_invitations' and xtype='U')
BEGIN
    CREATE TABLE project_invitations (
        invitation_id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        employer_id INT NOT NULL,
        freelancer_id INT NOT NULL,
        message NVARCHAR(MAX) NULL,
        status NVARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'DECLINED'
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Invitations_Project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        CONSTRAINT FK_Invitations_Employer FOREIGN KEY (employer_id) REFERENCES users(user_id),
        CONSTRAINT FK_Invitations_Freelancer FOREIGN KEY (freelancer_id) REFERENCES users(user_id)
    );
END
GO

-- 3. Add cv_url and cv_ai_evaluation to freelancer_profiles table
IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'cv_url' AND Object_ID = Object_ID(N'freelancer_profiles'))
BEGIN
    ALTER TABLE freelancer_profiles ADD cv_url VARCHAR(500) NULL;
END
GO

IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'cv_ai_evaluation' AND Object_ID = Object_ID(N'freelancer_profiles'))
BEGIN
    ALTER TABLE freelancer_profiles ADD cv_ai_evaluation NVARCHAR(MAX) NULL;
END
GO
