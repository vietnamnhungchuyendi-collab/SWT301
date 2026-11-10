USE FJMS;
GO

-- Fix avatar_url column size to support base64 image strings
DECLARE @ConstraintName nvarchar(200); 
SELECT @ConstraintName = Name FROM sys.default_constraints 
WHERE parent_object_id = object_id('users') AND parent_column_id = columnproperty(object_id('users'),'avatar_url','ColumnId'); 

IF @ConstraintName IS NOT NULL 
BEGIN
    EXEC('ALTER TABLE users DROP CONSTRAINT ' + @ConstraintName);
END
GO

ALTER TABLE users ALTER COLUMN avatar_url VARCHAR(MAX);
GO
