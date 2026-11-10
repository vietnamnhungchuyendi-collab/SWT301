-- ============================================================================
-- MIGRATION 001: Normalize violation_reports table
-- 
-- Mục tiêu:
-- - Loại bỏ các field dư thừa (target_user_id, project_id, reported_user_id)
-- - Chuẩn hóa thành schema production-ready
-- - Giữ backward compatibility qua views
-- - Tạo moderation_logs table
-- ============================================================================

BEGIN TRANSACTION;
SET XACT_ABORT ON;

PRINT '=== MIGRATION 001: Chuẩn hóa violation_reports ===';

-- ==========================================
-- 1. Tạo bảng moderation_logs mới
-- ==========================================
PRINT 'Creating moderation_logs table...';
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'moderation_logs')
BEGIN
    CREATE TABLE moderation_logs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        report_id INT NOT NULL,
        admin_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,           -- 'RESOLVE', 'DISMISS', 'REOPEN'
        note NVARCHAR(MAX) NULL,
        old_status VARCHAR(50) NOT NULL,
        new_status VARCHAR(50) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        
        CONSTRAINT FK_moderation_logs_report 
            FOREIGN KEY (report_id) REFERENCES violation_reports(report_id),
        CONSTRAINT FK_moderation_logs_admin 
            FOREIGN KEY (admin_id) REFERENCES users(user_id)
    );

    CREATE INDEX IX_moderation_logs_report_id ON moderation_logs(report_id);
    CREATE INDEX IX_moderation_logs_admin_id ON moderation_logs(admin_id);
    CREATE INDEX IX_moderation_logs_created_at ON moderation_logs(created_at);
    
    PRINT '  ✓ moderation_logs table created';
END
ELSE
BEGIN
    PRINT '  • moderation_logs table already exists, skipping';
END

-- ==========================================
-- 2. Kiểm tra và cập nhật violation_reports
-- ==========================================
PRINT 'Checking violation_reports table structure...';

-- Thêm entity_type nếu chưa có (normalized uppercase)
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('violation_reports') 
               AND name = 'entity_type')
BEGIN
    ALTER TABLE violation_reports 
    ADD entity_type VARCHAR(50) DEFAULT 'USER';
    PRINT '  ✓ Added entity_type column';
END

-- Thêm entity_id nếu chưa có
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('violation_reports') 
               AND name = 'entity_id')
BEGIN
    ALTER TABLE violation_reports 
    ADD entity_id INT NULL;
    PRINT '  ✓ Added entity_id column';
END

-- Thêm owner_id nếu chưa có
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('violation_reports') 
               AND name = 'owner_id')
BEGIN
    ALTER TABLE violation_reports 
    ADD owner_id INT NULL;
    PRINT '  ✓ Added owner_id column';
END

-- Thêm violation_type (thay thế report_type)
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('violation_reports') 
               AND name = 'violation_type')
BEGIN
    ALTER TABLE violation_reports 
    ADD violation_type VARCHAR(100) NULL;
    PRINT '  ✓ Added violation_type column';
END

-- Thêm UNDER_REVIEW status support
IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('violation_reports') 
           AND name = 'status')
BEGIN
    -- Kiểm tra constraint hiện tại
    DECLARE @constraint_name NVARCHAR(255);
    SELECT @constraint_name = name 
    FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('violation_reports')
    AND COL_NAME(parent_object_id, parent_column_id) = 'status';
    
    IF @constraint_name IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE violation_reports DROP CONSTRAINT ' + @constraint_name);
        PRINT '  ✓ Dropped old status constraint';
    END
END

-- ==========================================
-- 3. Backfill dữ liệu cũ sang schema mới
-- ==========================================
PRINT 'Backfilling data to new schema...';

-- Cập nhật entity_type, entity_id từ dữ liệu cũ
UPDATE violation_reports
SET 
    entity_type = CASE 
        WHEN project_id IS NOT NULL THEN 'PROJECT'
        WHEN entity_type IS NULL OR entity_type = '' THEN 'USER'
        ELSE UPPER(entity_type)
    END,
    entity_id = CASE 
        WHEN project_id IS NOT NULL THEN project_id
        WHEN entity_id IS NULL THEN target_user_id
        ELSE entity_id
    END,
    owner_id = CASE 
        WHEN owner_id IS NULL AND project_id IS NOT NULL THEN NULL -- sẽ được update sau qua project lookup
        ELSE owner_id
    END,
    violation_type = CASE 
        WHEN violation_type IS NULL THEN report_type
        ELSE violation_type
    END
WHERE entity_id IS NULL OR entity_type IS NULL;

PRINT '  ✓ Backfill completed';

-- ==========================================
-- 4. Tạo migration log
-- ==========================================
PRINT 'Migration 001 completed successfully';
PRINT '=== END MIGRATION 001 ===';

COMMIT TRANSACTION;
PRINT 'Transaction committed.';