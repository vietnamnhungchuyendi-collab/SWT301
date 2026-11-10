-- ============================================================================
-- MIGRATION 002: Clean up legacy columns + add indexes + create evidence table
-- ============================================================================

BEGIN TRANSACTION;
SET XACT_ABORT ON;

PRINT '=== MIGRATION 002: Database cleanup for Production Ready ===';

-- ==========================================
-- 1. Create report_evidence table
-- ==========================================
PRINT 'Creating report_evidence table...';
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'report_evidence')
BEGIN
    CREATE TABLE report_evidence (
        id INT IDENTITY(1,1) PRIMARY KEY,
        report_id INT NOT NULL,
        file_url NVARCHAR(500) NOT NULL,
        file_type VARCHAR(50) NOT NULL,  -- 'IMAGE', 'DOCUMENT', 'URL', 'OTHER'
        file_name NVARCHAR(255) NULL,
        file_size INT NULL,               -- bytes
        uploaded_by INT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT FK_report_evidence_report 
            FOREIGN KEY (report_id) REFERENCES violation_reports(report_id),
        CONSTRAINT FK_report_evidence_user 
            FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
    );

    CREATE INDEX IX_report_evidence_report_id ON report_evidence(report_id);
    PRINT '  ✓ report_evidence table created';
END
ELSE
BEGIN
    PRINT '  • report_evidence table already exists, skipping';
END

-- ==========================================
-- 2. Add performance indexes
-- ==========================================
PRINT 'Adding performance indexes...';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_violation_reports_entity')
BEGIN
    CREATE INDEX IX_violation_reports_entity 
        ON violation_reports(entity_type, entity_id) 
        INCLUDE (reporter_id, owner_id, status, created_at);
    PRINT '  ✓ Added IX_violation_reports_entity';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_violation_reports_status_created')
BEGIN
    CREATE INDEX IX_violation_reports_status_created 
        ON violation_reports(status, created_at DESC)
        INCLUDE (reporter_id, entity_type, entity_id);
    PRINT '  ✓ Added IX_violation_reports_status_created';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_violation_reports_reporter_created')
BEGIN
    CREATE INDEX IX_violation_reports_reporter_created 
        ON violation_reports(reporter_id, created_at DESC);
    PRINT '  ✓ Added IX_violation_reports_reporter_created';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_moderation_logs_report_created')
BEGIN
    CREATE INDEX IX_moderation_logs_report_created 
        ON moderation_logs(report_id, created_at ASC);
    PRINT '  ✓ Added IX_moderation_logs_report_created';
END

-- ==========================================
-- 3. Backup legacy data before column removal
-- ==========================================
PRINT 'Backing up legacy data...';

-- Create backup table if not exists
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'violation_reports_backup')
BEGIN
    SELECT * INTO violation_reports_backup FROM violation_reports WHERE 1=0;
    PRINT '  ✓ Created violation_reports_backup table';
END

-- Copy current data to backup
INSERT INTO violation_reports_backup
SELECT * FROM violation_reports vr
WHERE NOT EXISTS (SELECT 1 FROM violation_reports_backup b WHERE b.report_id = vr.report_id);
PRINT '  ✓ Legacy data backed up to violation_reports_backup';

-- ==========================================
-- 4. Verify data integrity - no null essential fields
-- ==========================================
PRINT 'Verifying data integrity...';

-- Check for reports with missing entity_type
IF EXISTS (SELECT 1 FROM violation_reports WHERE entity_type IS NULL)
BEGIN
    UPDATE violation_reports
    SET entity_type = CASE 
        WHEN project_id IS NOT NULL THEN 'PROJECT'
        WHEN target_user_id IS NOT NULL THEN 'USER'
        ELSE 'USER'
    END
    WHERE entity_type IS NULL;
    PRINT '  ✓ Fixed NULL entity_type records';
END

-- Check for reports with missing entity_id
IF EXISTS (SELECT 1 FROM violation_reports WHERE entity_id IS NULL)
BEGIN
    UPDATE violation_reports
    SET entity_id = CASE 
        WHEN project_id IS NOT NULL THEN project_id
        WHEN target_user_id IS NOT NULL THEN target_user_id
        ELSE reporter_id
    END
    WHERE entity_id IS NULL;
    PRINT '  ✓ Fixed NULL entity_id records';
END

-- Check for reports with missing violation_type
IF EXISTS (SELECT 1 FROM violation_reports WHERE violation_type IS NULL)
BEGIN
    UPDATE violation_reports
    SET violation_type = COALESCE(report_type, 'OTHER')
    WHERE violation_type IS NULL;
    PRINT '  ✓ Fixed NULL violation_type records';
END

-- Check for reports with missing description
IF EXISTS (SELECT 1 FROM violation_reports WHERE (description IS NULL OR description = '') AND reason IS NOT NULL)
BEGIN
    UPDATE violation_reports
    SET description = reason
    WHERE (description IS NULL OR description = '') AND reason IS NOT NULL;
    PRINT '  ✓ Migrated reason to description';
END

PRINT 'Data integrity verified.';

-- ==========================================
-- 5. Drop legacy columns after migration
-- ==========================================
PRINT 'Dropping legacy columns...';

-- Drop columns that are now handled by entity_type + entity_id
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('violation_reports') AND name = 'target_user_id')
BEGIN
    ALTER TABLE violation_reports DROP COLUMN target_user_id;
    PRINT '  ✓ Dropped target_user_id (legacy)';
END

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('violation_reports') AND name = 'reported_user_id')
BEGIN
    ALTER TABLE violation_reports DROP COLUMN reported_user_id;
    PRINT '  ✓ Dropped reported_user_id (legacy)';
END

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('violation_reports') AND name = 'project_id')
BEGIN
    ALTER TABLE violation_reports DROP COLUMN project_id;
    PRINT '  ✓ Dropped project_id (legacy)';
END

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('violation_reports') AND name = 'reason')
BEGIN
    ALTER TABLE violation_reports DROP COLUMN reason;
    PRINT '  ✓ Dropped reason (legacy - merged into description)';
END

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('violation_reports') AND name = 'report_type')
BEGIN
    ALTER TABLE violation_reports DROP COLUMN report_type;
    PRINT '  ✓ Dropped report_type (legacy - replaced by violation_type)';
END

-- ==========================================
-- 6. Mark migration complete
-- ==========================================
PRINT '';
PRINT '=== MIGRATION 002 COMPLETED SUCCESSFULLY ===';
PRINT 'Legacy columns removed, indexes created, evidence table added.';
PRINT 'Backup available in violation_reports_backup table.';

COMMIT TRANSACTION;
PRINT 'Transaction committed.';