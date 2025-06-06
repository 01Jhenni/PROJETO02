import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { Client } from 'https://esm.sh/basic-ftp@5.0.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FTPConfig {
  host: string
  username: string
  password: string
  document_type: string
}

interface UploadRequest {
  file: string; // base64
  fileName: string;
  companyId: string;
  documentTypeId: string;
  month: string;
  uploadId: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401 }
      );
    }

    // Validar e processar a requisição
    const { file, fileName, companyId, documentTypeId, month, uploadId } = await req.json() as UploadRequest;
    if (!file || !fileName || !companyId || !documentTypeId || !month || !uploadId) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos' }),
        { status: 400 }
      );
    }

    // Verificar se o usuário tem acesso à empresa
    const { data: companyAccess, error: accessError } = await supabaseClient
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (accessError || !companyAccess) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado à empresa' }),
        { status: 403 }
      );
    }

    // Verificar se o tipo de documento é permitido para a empresa
    const { data: documentType, error: docError } = await supabaseClient
      .from('company_document_types')
      .select('document_type_id')
      .eq('company_id', companyId)
      .eq('document_type_id', documentTypeId)
      .single();

    if (docError || !documentType) {
      return new Response(
        JSON.stringify({ error: 'Tipo de documento não permitido para esta empresa' }),
        { status: 403 }
      );
    }

    // Buscar configurações do FTP
    const { data: ftpConfig, error: ftpError } = await supabaseClient
      .from('ftp_configurations')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (ftpError || !ftpConfig) {
      // Atualizar status do upload para erro
      await supabaseClient
        .from('uploads')
        .update({ 
          status: 'error',
          error_message: 'Configuração FTP não encontrada'
        })
        .eq('id', uploadId);

      return new Response(
        JSON.stringify({ error: 'Configuração FTP não encontrada' }),
        { status: 404 }
      );
    }

    // Validar formato do arquivo
    const allowedExtensions = ['.pdf', '.xml', '.txt'];
    const fileExtension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      // Atualizar status do upload para erro
      await supabaseClient
        .from('uploads')
        .update({ 
          status: 'error',
          error_message: 'Formato de arquivo não permitido'
        })
        .eq('id', uploadId);

      return new Response(
        JSON.stringify({ error: 'Formato de arquivo não permitido' }),
        { status: 400 }
      );
    }

    // Decodificar arquivo base64
    const fileBuffer = Uint8Array.from(atob(file), c => c.charCodeAt(0));

    // Upload para o FTP
    const ftpClient = new Client();
    try {
      await ftpClient.access({
        host: ftpConfig.host,
        user: ftpConfig.username,
        password: ftpConfig.password,
        secure: ftpConfig.use_ssl,
      });

      // Criar diretório se não existir
      const remotePath = `${ftpConfig.base_path}/${companyId}/${documentTypeId}/${month}`;
      await ftpClient.ensureDir(remotePath);

      // Upload do arquivo
      await ftpClient.uploadFrom(fileBuffer, `${remotePath}/${fileName}`);

      // Atualizar status do upload para concluído
      await supabaseClient
        .from('uploads')
        .update({ status: 'completed' })
        .eq('id', uploadId);

      return new Response(
        JSON.stringify({ message: 'Upload concluído com sucesso' }),
        { status: 200 }
      );
    } catch (error) {
      // Atualizar status do upload para erro
      await supabaseClient
        .from('uploads')
        .update({ 
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Erro no upload FTP'
        })
        .eq('id', uploadId);

      throw error;
    } finally {
      ftpClient.close();
    }
  } catch (error) {
    console.error('Erro no upload:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500 }
    );
  }
}) 