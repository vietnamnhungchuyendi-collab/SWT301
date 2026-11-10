-- Fix: Update CHECK constraint on violation_reports.status to match application code
-- Application uses: 'PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'

-- Step 1: Find and drop existing CHECK constraint on status column
DECLARE @constraintName NVARCHAR(200);
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns col ON cc.parent_object_id = col.object_id
  AND cc.parent_column_id = col.column_id
WHERE OBJECT_NAME(cc.parent_object_id) = 'violation_reports'
  AND col.name = 'status';

IF @constraintName IS NOT NULL
BEGIN
  EXEC('ALTER TABLE violation_reports DROP CONSTRAINT ' + @constraintName);
  PRINT 'Dropped old constraint: ' + @constraintName;
END
ELSE
BEGIN
  PRINT 'No existing status CHECK constraint found.';
END

-- Step 2: Add correct constraint matching application values
IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints cc
  JOIN sys.tables t ON cc.parent_object_id = t.object_id
  WHERE t.name = 'violation_reports' AND cc.name = 'ck_violation_reports_status'
)
BEGIN
  ALTER TABLE violation_reports
  ADD CONSTRAINT ck_violation_reports_status
  CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'));
  PRINT 'Added new constraint ck_violation_reports_status';
END
ELSE
BEGIN
  PRINT 'Constraint ck_violation_reports_status already exists with correct values.';
END
