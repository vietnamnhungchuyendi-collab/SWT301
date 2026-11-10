-- ============================================================================
-- MIGRATION 003: Enterprise hardening - FK constraints, security logging,
--                 migration tracking, performance optimization
-- ============================================================================

BEGIN TRANSACTION;
SET XACT_ABORT ON;

PRINT '=== MIGRATION 003: Enterprise Hardening ===';

-- ==========================================
-- 1. Create migration tracking table
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '_migrations')
BEGIN
    CREATE TABLE _migrations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        checksum NVARCHAR(64) NULL
    );
    PRINT '  ✓ Created _migrations tracking table';
END

-- Check if already executed
IF EXISTS (SELECT 1 FROM _migrations WHERE name = 'migration_003_enterprise_hardening')
BEGIN
    PRINT '  • Migration already executed, skipping';
    COMMIT TRANSACTION;
    RETURN;
END

-- ==========================================
-- 2. Create security_events table
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'security_events')
BEGIN
    CREATE TABLE security_events (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        ip_address NVARCHAR(45) NULL,
        event_type VARCHAR(50) NOT NULL,
        endpoint VARCHAR(255) NULL,
        metadata NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_security_events_event_type ON security_events(event_type, created_at DESC);
    CREATE INDEX IX_security_events_user_id ON security_events(user_id, created_at DESC);
    CREATE INDEX IX_security_events_ip ON security_events(ip_address, created_at DESC);

    PRINT '  ✓ Created security_events table';
END

-- ==========================================
-- 3. Add FK constraints (if not already present)
-- ==========================================
PRINT 'Adding FK constraints...';

-- violation_reports.reporter_id -> users.user_id
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_violation_reports_reporter'
)
BEGIN
    ALTER TABLE violation_reports
    ADD CONSTRAINT FK_violation_reports_reporter
    FOREIGN KEY (reporter_id) REFERENCES users(user_id);
    PRINT '  ✓ Added FK_violation_reports_reporter';
END

-- violation_reports.owner_id -> users.user_id  
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_violation_reports_owner'
)
BEGIN
    ALTER TABLE violation_reports
    ADD CONSTRAINT FK_violation_reports_owner
    FOREIGN KEY (owner_id) REFERENCES users(user_id);
    PRINT '  ✓ Added FK_violation_reports_owner';
END

-- moderation_logs.report_id -> violation_reports.report_id
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_moderation_logs_report'
)
AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'moderation_logs')
BEGIN
    ALTER TABLE moderation_logs
    ADD CONSTRAINT FK_moderation_logs_report
    FOREIGN KEY (report_id) REFERENCES violation_reports(report_id);
    PRINT '  ✓ Added FK_moderation_logs_report';
END

-- moderation_logs.admin_id -> users.user_id
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_moderation_logs_admin'
)
AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'moderation_logs')
BEGIN
    ALTER TABLE moderation_logs
    ADD CONSTRAINT FK_moderation_logs_admin
    FOREIGN KEY (admin_id) REFERENCES users(user_id);
    PRINT '  ✓ Added FK_moderation_logs_admin';
END

-- report_evidence.report_id -> violation_reports.report_id
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_report_evidence_report'
)
AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'report_evidence')
BEGIN
    ALTER TABLE report_evidence
    ADD CONSTRAINT FK_report_evidence_report
    FOREIGN KEY (report_id) REFERENCES violation_reports(report_id);
    PRINT '  ✓ Added FK_report_evidence_report';
END

-- report_evidence.uploaded_by -> users.user_id
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_report_evidence_uploader'
)
AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'report_evidence')
BEGIN
    ALTER TABLE report_evidence
    ADD CONSTRAINT FK_report_evidence_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id);
    PRINT '  ✓ Added FK_report_evidence_uploader';
END

-- ==========================================
-- 4. Add additional performance indexes
-- ==========================================
PRINT 'Adding performance indexes...';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_violation_reports_violation_type')
BEGIN
    CREATE INDEX IX_violation_reports_violation_type 
        ON violation_reports(violation_type) 
        INCLUDE (status, created_at);
    PRINT '  ✓ Added IX_violation_reports_violation_type';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_violation_reports_description')
BEGIN
    -- Full-text search index for description field
    CREATE INDEX IX_violation_reports_description 
        ON violation_reports(description) 
        INCLUDE (report_id, status);
    PRINT '  ✓ Added IX_violation_reports_description';
END

-- ==========================================
-- 5. Record migration
-- ==========================================
INSERT INTO _migrations (name, checksum)
VALUES ('migration_003_enterprise_hardening', 
        CAST(HASHBYTES('SHA2_256', 'migration_003_enterprise_hardening') AS NVARCHAR(64)));

PRINT '';
PRINT '=== MIGRATION 003 COMPLETED SUCCESSFULLY ===';
PRINT 'FK constraints added, security_events table created, migration tracking enabled.';

COMMIT TRANSACTION;
GO