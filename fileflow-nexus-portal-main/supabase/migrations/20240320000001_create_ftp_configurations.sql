-- Create ftp_configurations table
CREATE TABLE ftp_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 21,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    base_path TEXT NOT NULL DEFAULT '/',
    use_ssl BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(company_id)
);

-- Create index for faster queries
CREATE INDEX ftp_configurations_company_id_idx ON ftp_configurations(company_id);

-- Enable Row Level Security
ALTER TABLE ftp_configurations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow staff to view all configurations
CREATE POLICY "Staff can view all FTP configurations"
    ON ftp_configurations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.type = 'staff'
        )
    );

-- Create policy to allow staff to insert configurations
CREATE POLICY "Staff can insert FTP configurations"
    ON ftp_configurations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.type = 'staff'
        )
    );

-- Create policy to allow staff to update configurations
CREATE POLICY "Staff can update FTP configurations"
    ON ftp_configurations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.type = 'staff'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.type = 'staff'
        )
    );

-- Create policy to allow staff to delete configurations
CREATE POLICY "Staff can delete FTP configurations"
    ON ftp_configurations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.type = 'staff'
        )
    );

-- Create function to update updated_at and updated_by
CREATE OR REPLACE FUNCTION update_ftp_configuration_audit()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update audit fields
CREATE TRIGGER update_ftp_configuration_audit
    BEFORE UPDATE ON ftp_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_ftp_configuration_audit();

-- Create function to set created_by
CREATE OR REPLACE FUNCTION set_ftp_configuration_created_by()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_by = auth.uid();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically set created_by
CREATE TRIGGER set_ftp_configuration_created_by
    BEFORE INSERT ON ftp_configurations
    FOR EACH ROW
    EXECUTE FUNCTION set_ftp_configuration_created_by(); 