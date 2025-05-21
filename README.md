Plataforma DM-FIN: Gestão de Documentos e Financeira
Visão Geral do Projeto
A Plataforma DM-FIN é um sistema web robusto para gestão de documentos e informações financeiras, segmentado para clientes e colaboradores.

Portal do Cliente: Permite upload categorizado de arquivos (SPED, NFE, CTE, PDFs, Planilhas), visualização do status de upload, envio para FTP, acesso a um dashboard financeiro mensal e suporte via chatbot com IA.
Painel do Colaborador: Oferece funcionalidades para registro e análise de importações, gerenciamento de usuários e empresas, e um chat interno que se integra com o suporte ao cliente.
Arquitetura Técnica
A plataforma utiliza uma arquitetura moderna e escalável:

Frontend: React (com Vite) para uma interface de usuário rápida e interativa.
Backend (APIs): Node.js com Express para gerenciar a lógica de negócio, autenticação, comunicação com FTP e integração com serviços de IA.
Banco de Dados & BaaS (Backend-as-a-Service): Supabase (PostgreSQL para dados, Authentication para login/usuários, Storage para arquivos temporários, Realtime para chat).
Armazenamento Final de Arquivos: Servidor FTP/SFTP externo.
Inteligência Artificial: Integração com OpenAI API (ou Google Gemini API) para o chatbot de suporte.
Estrutura de Pastas do Projeto
Seu projeto deve ser organizado em duas pastas principais: backend e frontend.

.
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── chatController.js
│   │   │   └── uploadController.js
│   │   ├── middleware/
│   │   │   └── authMiddleware.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── chat.js
│   │   │   └── upload.js
│   │   ├── services/
│   │   │   ├── ftpService.js
│   │   │   └── iaService.js
│   │   │   └── supabaseService.js (Opcional, se precisar de um cliente Supabase dedicado com service key)
│   │   └── app.js
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── assets/
    │   ├── components/
    │   │   ├── Auth/
    │   │   │   └── LoginForm.jsx
    │   │   ├── Client/
    │   │   │   ├── Dashboard.jsx
    │   │   │   ├── FileUpload.jsx
    │   │   │   └── SupportBot.jsx (Opcional, se o chat for um componente separado do bot)
    │   │   ├── Collaborator/
    │   │   │   ├── ImportLogs.jsx
    │   │   │   └── Settings.jsx
    │   │   ├── Shared/
    │   │   │   ├── ChatWidget.jsx
    │   │   │   ├── Header.jsx
    │   │   │   └── Sidebar.jsx
    │   ├── hooks/
    │   │   └── useAuth.js
    │   ├── pages/
    │   │   ├── ClientPortal.jsx
    │   │   ├── CollaboratorPanel.jsx
    │   │   └── LoginPage.jsx
    │   ├── services/
    │   │   ├── api.js
    │   │   └── supabaseClient.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   └── router.jsx (Opcional, se usar um arquivo de rotas centralizado)
    ├── .env.example
    ├── package.json
    └── vite.config.js
1. Configuração do Supabase (Backend-as-a-Service)
1.1. Criar Projeto Supabase
Acesse Supabase e crie uma conta (se já não tiver).
Crie um novo projeto. Anote o Project URL e a anon public key (encontrados em Project Settings > API). Você também precisará da service_role key para o backend (também em API Keys), mas nunca a exponha no frontend.
1.2. Configuração do Banco de Dados (PostgreSQL)
Vá para Database > SQL Editor no seu projeto Supabase e execute as seguintes instruções SQL para criar as tabelas e funções necessárias:

SQL

-- Tabela de Usuários (Clientes e Colaboradores)
CREATE TABLE public.users (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'collaborator', 'admin')), -- 'client', 'collaborator', 'admin'
  full_name text,
  phone_number text,
  company_id uuid REFERENCES public.companies (id) -- Para clientes, vincular à empresa
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to own profile" ON public.users
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Allow admins to view and modify all users" ON public.users
FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin');


-- Tabela de Empresas
CREATE TABLE public.companies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  name text UNIQUE NOT NULL,
  cnpj text UNIQUE,
  address text,
  contact_email text,
  contact_phone text
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view companies they are associated with" ON public.companies
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.company_id = companies.id) OR
  get_user_role(auth.uid()) IN ('collaborator', 'admin')
);

CREATE POLICY "Allow admins to manage companies" ON public.companies
FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Tabela de Arquivos Enviados por Clientes
CREATE TYPE file_type AS ENUM ('SPED', 'NFE', 'CTE', 'PDF_NFS', 'NFCE', 'PLANILHA');

CREATE TABLE public.client_uploads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  client_id uuid REFERENCES public.users (id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies (id) ON DELETE CASCADE NOT NULL,
  file_type file_type NOT NULL,
  original_filename text NOT NULL,
  storage_path text NOT NULL, -- Caminho no Supabase Storage
  ftp_path text, -- Caminho final no servidor FTP
  uploaded_at timestamp with time zone,
  ftp_transfer_status text DEFAULT 'pending' CHECK (ftp_transfer_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text, -- Para registrar erros na transferência FTP
  UNIQUE (client_id, company_id, file_type, created_at::date) -- Garante apenas um upload por tipo por dia por cliente/empresa
);

ALTER TABLE public.client_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow clients to manage their own uploads" ON public.client_uploads
FOR ALL TO authenticated USING (client_id = auth.uid() AND get_user_role(auth.uid()) = 'client');

CREATE POLICY "Allow collaborators/admins to view all uploads" ON public.client_uploads
FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('collaborator', 'admin'));

-- Tabela de Dados Financeiros (para o Dashboard do Cliente)
CREATE TABLE public.financial_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  company_id uuid REFERENCES public.companies (id) ON DELETE CASCADE NOT NULL,
  month_year date NOT NULL, -- Ex: '2023-01-01' para Janeiro de 2023
  revenue numeric(18, 2),
  expenses numeric(18, 2),
  profit numeric(18, 2),
  -- Outras métricas financeiras
  UNIQUE (company_id, month_year)
);

ALTER TABLE public.financial_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow clients to view their company's financial data" ON public.financial_data
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.company_id = financial_data.company_id)
);

CREATE POLICY "Allow collaborators/admins to manage all financial data" ON public.financial_data
FOR ALL TO authenticated USING (get_user_role(auth.uid()) IN ('collaborator', 'admin'));

-- Tabela de Logs de Importação (para Colaboradores)
CREATE TABLE public.import_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  importer_user_id uuid REFERENCES public.users (id), -- Quem registrou/analisou
  company_id uuid REFERENCES public.companies (id) ON DELETE CASCADE NOT NULL,
  file_type file_type NOT NULL,
  import_status text DEFAULT 'pending' CHECK (import_status IN ('pending', 'imported', 'error', 'partially_imported')),
  details jsonb, -- JSON para armazenar detalhes de erros, linhas processadas, etc.
  processed_at timestamp with time zone
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow collaborators/admins to manage import logs" ON public.import_logs
FOR ALL TO authenticated USING (get_user_role(auth.uid()) IN ('collaborator', 'admin'));


-- Tabela de Mensagens de Chat
CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  sender_id uuid REFERENCES public.users (id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES public.users (id) ON DELETE CASCADE, -- Pode ser NULL se for um chat com o bot ou grupo
  company_id uuid REFERENCES public.companies (id) ON DELETE CASCADE, -- Para agrupar conversas de clientes
  message_text text NOT NULL,
  is_read boolean DEFAULT FALSE,
  attachment_url text, -- Opcional: para anexos no chat
  message_type text DEFAULT 'human' CHECK (message_type IN ('human', 'bot'))
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view their own messages" ON public.messages
FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Allow users to insert messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- Função para obter o papel do usuário (útil para RLS)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE
    user_role text;
  BEGIN
    SELECT role INTO user_role FROM public.users WHERE id = user_id;
    RETURN user_role;
  END;
$$;
1.3. Configuração de Autenticação e Storage
Autenticação: Em Authentication > Settings, habilite o método de login desejado (e-mail/senha é o mais comum para iniciar).
Storage: Em Storage, crie um novo Bucket chamado client-uploads. Defina as políticas de acesso para permitir upload por usuários autenticados.
2. Configuração do Backend (Node.js/Express)
2.1. Criação e Configuração
Crie uma pasta chamada backend na raiz do seu projeto.

Dentro de backend, crie o arquivo package.json:

JSON

{
  "name": "dm-fin-backend",
  "version": "1.0.0",
  "description": "Backend for DM-FIN platform",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@supabase/supabase-js": "^2.x.x",
    "axios": "^1.x.x",
    "basic-ftp": "^5.x.x",
    "cors": "^2.x.x",
    "dotenv": "^16.x.x",
    "express": "^4.x.x",
    "jsonwebtoken": "^9.x.x",
    "multer": "^1.4.5-lts.1",
    "openai": "^4.x.x"
  },
  "devDependencies": {
    "nodemon": "^3.x.x"
  }
}
Execute npm install (ou yarn install) na pasta backend para instalar as dependências.

Crie um arquivo .env na pasta backend (e um .env.example para controle de versão, mas não envie o .env real para o Git):

Snippet de código

# Variáveis de Ambiente do Backend

# Supabase
SUPABASE_URL=SUA_URL_DO_PROJETO_SUPABASE
SUPABASE_SERVICE_KEY=SUA_CHAVE_SERVICE_ROLE_DO_SUPABASE # ATENÇÃO: NUNCA EXPOR ESTA CHAVE NO CLIENTE!
SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLIC_DO_SUPABASE # Para uso no frontend, mas também no backend se necessário para auth.getUser

# FTP
FTP_HOST=seu.servidor.ftp.com
FTP_USER=seu_usuario_ftp
FTP_PASSWORD=sua_senha_ftp
FTP_PORT=21 # Ou 22 para SFTP (se for SFTP, considere usar uma biblioteca como 'ssh2-sftp-client' em vez de 'basic-ftp')

# OpenAI (ou Google Gemini)
OPENAI_API_KEY=sua_openai_api_key

# Segurança (se quiser gerar tokens JWT próprios, mas Supabase já gerencia)
JWT_SECRET=uma_string_aleatoria_muito_forte_para_o_jwt_backend
Crie a estrutura de pastas src/controllers, src/middleware, src/routes, src/services dentro de backend/.

2.2. Arquivos Essenciais do Backend
backend/src/app.js

JavaScript

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Client para o backend (usando service_key para privilégios elevados)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
app.locals.supabase = supabase; // Torna o cliente Supabase disponível para rotas

app.use(cors()); // Permite requisições de diferentes origens (importante para frontend)
app.use(express.json()); // Para parsear JSON no corpo das requisições
app.use(express.urlencoded({ extended: true })); // Para parsear URL-encoded data

// Importar e usar rotas
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const chatRoutes = require('./routes/chat');

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => {
  res.send('DM-FIN Backend is running!');
});

// Tratamento de erros genérico (opcional, mas recomendado)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
backend/src/middleware/authMiddleware.js

JavaScript

const { createClient } = require('@supabase/supabase-js');

// Clientes Supabase: um com anon key (para verificar sessão do frontend), outro com service key (para buscar role do public.users)
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseService = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Não autorizado, token não fornecido.' });
  }

  try {
    // Verifica a sessão do usuário com o Supabase Auth usando o token do frontend
    const { data: userSession, error } = await supabaseAnon.auth.getUser(token);

    if (error || !userSession.user) {
      console.error('Erro de autenticação Supabase:', error);
      return res.status(401).json({ message: 'Não autorizado, token inválido ou expirado.' });
    }

    // Busca o papel do usuário na sua tabela 'public.users'
    const { data: userData, error: userError } = await supabaseService
      .from('users')
      .select('id, role, company_id')
      .eq('id', userSession.user.id)
      .single();

    if (userError || !userData) {
      console.error('Erro ao buscar dados do usuário em public.users:', userError);
      return res.status(401).json({ message: 'Não autorizado, dados do usuário não encontrados ou associados.' });
    }

    // Anexa as informações do usuário à requisição
    req.user = {
      id: userData.id,
      role: userData.role,
      company_id: userData.company_id,
      email: userSession.user.email,
    };
    next();
  } catch (error) {
    console.error('Erro na verificação do token:', error);
    res.status(401).json({ message: 'Não autorizado, falha na verificação do token.' });
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Seu papel (${req.user.role}) não tem permissão para acessar esta rota.` });
    }
    next();
  };
};

module.exports = { protect, authorize };
backend/src/services/ftpService.js

JavaScript

const { Client } = require('basic-ftp');
const path = require('path');
const fs = require('fs');

const ftpConfig = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  port: parseInt(process.env.FTP_PORT || '21', 10),
  secure: false, // Defina como true para FTPS ou SFTP, mas exigirá mais configuração e talvez outra biblioteca
};

const transferFileToFTP = async (localFilePath, remoteFolderPath, remoteFileName) => {
  const client = new Client();
  try {
    await client.access(ftpConfig);
    console.log(`Conectado ao FTP: ${ftpConfig.host}`);

    // Garante que o diretório remoto exista
    await client.ensureDir(remoteFolderPath);
    console.log(`Diretório remoto garantido: ${remoteFolderPath}`);

    // Realiza a transferência do arquivo
    await client.uploadFrom(localFilePath, path.join(remoteFolderPath, remoteFileName));
    console.log(`Arquivo ${remoteFileName} enviado para ${remoteFolderPath}`);
    return true;
  } catch (error) {
    console.error(`Erro na Transferência FTP: ${error.message}`);
    throw error;
  } finally {
    client.close(); // Fecha a conexão FTP
  }
};

module.exports = { transferFileToFTP };
backend/src/controllers/uploadController.js

JavaScript

const { transferFileToFTP } = require('../services/ftpService');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const os = require('os'); // Para criar diretórios temporários no sistema operacional

// Cliente Supabase com SERVICE_ROLE_KEY para operações de backend (download de storage, atualizações de status que ignoram RLS)
const supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

const processUpload = async (req, res) => {
  const supabase = req.app.locals.supabase; // Cliente Supabase do app.js (já configurado com service key)
  const { uploadId } = req.body; // ID do registro de upload no seu DB Supabase

  if (!uploadId) {
    return res.status(400).json({ message: 'O ID do upload é obrigatório.' });
  }

  try {
    // 1. Obter detalhes do upload do Supabase (client_uploads)
    const { data: uploadData, error: fetchError } = await supabase
      .from('client_uploads')
      .select('company_id, original_filename, storage_path, file_type')
      .eq('id', uploadId)
      .single();

    if (fetchError || !uploadData) {
      console.error('Erro ao buscar dados do upload:', fetchError);
      return res.status(404).json({ message: 'Registro de upload não encontrado ou inacessível.' });
    }

    const { company_id, original_filename, storage_path, file_type } = uploadData;

    // 2. Obter nome da empresa para a estrutura de pastas do FTP
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .single();

    if (companyError || !companyData) {
      console.error('Erro ao buscar dados da empresa:', companyError);
      return res.status(404).json({ message: 'Empresa não encontrada.' });
    }

    // Formata o nome da empresa para ser um nome de pasta seguro
    const companyName = companyData.name.replace(/[^a-zA-Z0-9\-_]/g, '_');

    // 3. Baixar arquivo do Supabase Storage para um diretório temporário local
    // Use supabaseService aqui, pois ele tem a service_role key para acesso garantido ao Storage
    const { data: fileBlob, error: downloadError } = await supabaseService.storage
      .from('client-uploads') // Nome do seu bucket no Supabase Storage
      .download(storage_path);

    if (downloadError) {
      console.error('Erro ao baixar do Supabase Storage:', downloadError);
      throw new Error(`Falha ao baixar arquivo do storage: ${downloadError.message}`);
    }

    const tempFilePath = path.join(os.tmpdir(), original_filename); // Caminho temporário no SO
    await fs.promises.writeFile(tempFilePath, Buffer.from(await fileBlob.arrayBuffer()));
    console.log(`Arquivo baixado para caminho temporário: ${tempFilePath}`);

    // 4. Determinar o caminho FTP remoto (Ex: MinhaEmpresa/SPED/arquivo.pdf)
    const remoteFolderPath = `${companyName}/${file_type.toUpperCase()}`;
    const remoteFileName = original_filename;

    // 5. Transferir o arquivo para o FTP
    await transferFileToFTP(tempFilePath, remoteFolderPath, remoteFileName);
    console.log('Arquivo transferido com sucesso para o FTP.');

    // 6. Remover o arquivo temporário localmente
    fs.unlink(tempFilePath, (err) => {
      if (err) console.error(`Erro ao deletar arquivo temporário ${tempFilePath}:`, err);
      else console.log(`Arquivo temporário ${tempFilePath} deletado.`);
    });

    // 7. Atualizar o status do upload no banco de dados Supabase
    const { error: updateError } = await supabase
      .from('client_uploads')
      .update({
        ftp_transfer_status: 'completed',
        ftp_path: path.join(remoteFolderPath, remoteFileName),
        error_message: null, // Limpa qualquer erro anterior
      })
      .eq('id', uploadId);

    if (updateError) {
      console.error('Erro ao atualizar status do upload no DB:', updateError);
      return res.status(500).json({ message: 'Transferência FTP concluída, mas falha ao atualizar o status no banco de dados.' });
    }

    res.status(200).json({ message: 'Arquivo processado e enviado para o FTP com sucesso.' });
  } catch (error) {
    console.error('Erro em processUpload:', error);
    // Em caso de erro, atualiza o status para 'failed'
    await supabase.from('client_uploads').update({
      ftp_transfer_status: 'failed',
      error_message: error.message,
    }).eq('id', uploadId);
    res.status(500).json({ message: 'Falha ao processar upload e transferir para o FTP.', error: error.message });
  }
};

module.exports = { processUpload };
backend/src/services/iaService.js

JavaScript

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getChatbotResponse = async (userMessage, conversationHistory = []) => {
  try {
    const messages = [
      { role: 'system', content: 'Você é um assistente de suporte inteligente para uma plataforma de gestão de documentos e finanças. Seja prestativo, objetivo e direcione o usuário para a seção correta da plataforma ou, se não puder ajudar, para um colaborador humano. Não "alucine" respostas; se não souber, diga que não pode ajudar e que vai conectar com o suporte. Ex: "Para upload de arquivos, por favor, vá para a aba de upload." ou "Para dúvidas financeiras, posso te conectar a um de nossos analistas." ' },
      ...conversationHistory.map(msg => ({ role: msg.message_type === 'human' ? 'user' : 'assistant', content: msg.message_text })),
      { role: 'user', content: userMessage },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Considere "gpt-4" para melhor qualidade, se disponível e viável.
      messages: messages,
      temperature: 0.7, // Controla a criatividade da IA (0.0-1.0)
      max_tokens: 200, // Limita o tamanho da resposta
      n: 1, // Número de respostas a gerar
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Erro ao obter resposta da IA:', error);
    // Resposta de fallback em caso de erro na API da IA
    return 'Desculpe, não consigo processar sua solicitação agora. Por favor, tente novamente mais tarde ou contate o suporte humano.';
  }
};

module.exports = { getChatbotResponse };
backend/src/routes/auth.js (Para rotas de backend que precisam de autenticação, ex: para administradores gerenciarem usuários. O login em si é via Supabase direto no frontend).

JavaScript

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Exemplo: Obter perfil do usuário logado (cliente, colaborador, admin)
router.get('/me', protect, async (req, res) => {
  // As informações do usuário (id, role, company_id) já estão em req.user graças ao middleware 'protect'
  res.status(200).json({ user: req.user });
});

// Exemplo: Rota de administração para adicionar um novo colaborador (apenas para admins)
router.post('/register-collaborator', protect, authorize(['admin']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { email, password, fullName, phoneNumber, role } = req.body;

    if (!email || !password || !fullName || !role) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios (email, senha, nome completo, papel) são necessários.' });
    }

    if (!['collaborator', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Papel inválido. Deve ser "collaborator" ou "admin".' });
    }

    try {
        // Criar usuário no Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true // Opcional: envia email de confirmação
        });

        if (authError) throw authError;

        // Inserir detalhes adicionais na tabela public.users
        const { data: newUser, error: dbError } = await supabase
            .from('users')
            .insert({
                id: authUser.user.id,
                email: email,
                full_name: fullName,
                phone_number: phoneNumber,
                role: role
            })
            .select()
            .single();

        if (dbError) {
            // Se falhar a inserção no DB, tentar deletar o usuário do Supabase Auth para evitar lixo
            await supabase.auth.admin.deleteUser(authUser.user.id);
            throw dbError;
        }

        res.status(201).json({ message: 'Colaborador registrado com sucesso.', user: newUser });

    } catch (error) {
        console.error('Erro ao registrar colaborador:', error);
        res.status(500).json({ message: `Falha ao registrar colaborador: ${error.message}` });
    }
});


module.exports = router;
backend/src/routes/upload.js

JavaScript

const express = require('express');
const router = express.Router();
const multer = require('multer'); // Para lidar com upload de arquivos
const { protect, authorize } = require('../middleware/authMiddleware');
const uploadController = require('../controllers/uploadController');

// Configuração do Multer para armazenar em memória (para uploads leves)
// Para arquivos muito grandes, considere 'multer.diskStorage' para salvar temporariamente no disco.
const upload = multer({ storage: multer.memoryStorage() });

// Rota para o cliente fazer o upload INICIAL para o Supabase Storage
// Esta rota é chamada do frontend.
router.post('/initial-upload', protect, authorize(['client']), upload.single('file'), async (req, res) => {
  const supabase = req.app.locals.supabase; // Cliente Supabase com Service Key
  const { companyId, fileType } = req.body; // Dados adicionais do formulário
  const file = req.file; // Arquivo vindo do Multer

  if (!file || !companyId || !fileType) {
    return res.status(400).json({ message: 'Arquivo, ID da empresa e tipo de arquivo são obrigatórios.' });
  }

  // Validação adicional: garante que o cliente esteja associado à empresa que ele tenta fazer upload
  if (req.user.role === 'client' && req.user.company_id !== companyId) {
    return res.status(403).json({ message: 'Cliente não autorizado para esta empresa.' });
  }

  // Define o caminho no Supabase Storage: client_id/company_id/timestamp_originalfilename.ext
  const filePath = `${req.user.id}/${companyId}/${Date.now()}_${file.originalname}`;

  try {
    // Faz o upload do buffer do arquivo para o Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('client-uploads') // Nome do seu bucket no Supabase Storage
      .upload(filePath, file.buffer, {
        contentType: file.mimetype, // Tipo MIME do arquivo
        upsert: false, // Não sobrescrever se já existir (opcional, pode ser true para sobrescrever)
      });

    if (uploadError) {
      console.error('Erro no upload para Supabase Storage:', uploadError);
      return res.status(500).json({ message: 'Falha ao fazer upload do arquivo para o storage.' });
    }

    // Registra os detalhes do upload no banco de dados (tabela client_uploads)
    const { data: uploadRecord, error: dbError } = await supabase
      .from('client_uploads')
      .insert({
        client_id: req.user.id,
        company_id: companyId,
        file_type: fileType,
        original_filename: file.originalname,
        storage_path: data.path, // Caminho retornado pelo Supabase Storage
        uploaded_at: new Date().toISOString(),
      })
      .select() // Retorna os dados inseridos
      .single();

    if (dbError) {
      console.error('Erro ao inserir registro de upload no DB:', dbError);
      // Se falhar a inserção no DB, pode ser útil tentar remover o arquivo do Storage
      await supabase.storage.from('client-uploads').remove([data.path]);
      return res.status(500).json({ message: 'Falha ao registrar upload no banco de dados.' });
    }

    // Retorna o ID do registro de upload, que será usado para acionar a transferência FTP
    res.status(200).json({
      message: 'Arquivo enviado para o storage e registrado.',
      uploadId: uploadRecord.id,
      storagePath: data.path,
    });
  } catch (error) {
    console.error('Erro no upload inicial:', error);
    res.status(500).json({ message: 'Erro interno do servidor durante o upload inicial.', error: error.message });
  }
});

// Rota para o backend processar e enviar o arquivo do Supabase Storage para o FTP
// Esta rota é chamada APÓS o cliente ter feito o upload inicial para o Supabase Storage
router.post('/process-ftp', protect, authorize(['client']), uploadController.processUpload);

module.exports = router;
backend/src/routes/chat.js

JavaScript

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getChatbotResponse } = require('../services/iaService');

router.post('/send-message', protect, async (req, res) => {
  const supabase = req.app.locals.supabase;
  const { receiverId, messageText, companyId } = req.body; // receiverId pode ser 'bot' ou um ID de usuário

  if (!messageText) {
    return res.status(400).json({ message: 'O texto da mensagem é obrigatório.' });
  }

  try {
    // 1. Salvar a mensagem do usuário no banco de dados
    const { data, error: dbError } = await supabase
      .from('messages')
      .insert({
        sender_id: req.user.id,
        receiver_id: receiverId !== 'bot' ? receiverId : null, // Se for bot, receiver_id é NULL
        company_id: req.user.role === 'client' ? req.user.company_id : companyId, // Associar à empresa do cliente
        message_text: messageText,
        message_type: 'human',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Erro ao salvar mensagem no DB:', dbError);
      return res.status(500).json({ message: 'Falha ao salvar mensagem.' });
    }

    // 2. Se a mensagem for para o bot, gerar uma resposta da IA
    if (receiverId === 'bot') {
      // Opcional: buscar histórico recente para dar contexto à IA
      const { data: conversationHistory, error: historyError } = await supabase
        .from('messages')
        .select('message_text, message_type')
        .or(`(sender_id.eq.${req.user.id},and(receiver_id.is.null,message_type.eq.bot)),(receiver_id.eq.${req.user.id},and(sender_id.is.null,message_type.eq.bot))`)
        .order('created_at', { ascending: true })
        .limit(10); // Limita o histórico para não sobrecarregar a IA

      if (historyError) console.error('Erro ao buscar histórico de conversas:', historyError);

      const aiResponse = await getChatbotResponse(messageText, conversationHistory);

      // 3. Salvar a resposta do bot no banco de dados
      const { data: botMessage, error: botDbError } = await supabase
        .from('messages')
        .insert({
          sender_id: null, // O bot não tem um ID de usuário na tabela 'users'
          receiver_id: req.user.id, // O bot responde ao usuário que enviou a mensagem
          company_id: req.user.role === 'client' ? req.user.company_id : null, // Associar à empresa do cliente, se aplicável
          message_text: aiResponse,
          message_type: 'bot',
        })
        .select()
        .single();

      if (botDbError) {
        console.error('Erro ao salvar mensagem do bot no DB:', botDbError);
        return res.status(500).json({ message: 'Falha ao salvar resposta do bot.' });
      }
      return res.status(200).json({ message: 'Mensagem enviada e bot respondeu.', userMessage: data, botMessage });
    }

    // Se não for para o bot, apenas confirma que a mensagem foi enviada
    res.status(200).json({ message: 'Mensagem enviada.', sentMessage: data });
  } catch (error) {
    console.error('Erro ao enviar mensagem do chat:', error);
    res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
  }
});

// Rota para buscar mensagens (para clientes e colaboradores)
router.get('/messages/:companyId?', protect, async (req, res) => {
  const supabase = req.app.locals.supabase;
  const { companyId } = req.params; // ID da empresa para filtrar conversas (opcional)

  try {
    let query = supabase.from('messages').select('*');

    if (req.user.role === 'client') {
      // Clientes só veem suas próprias conversas com outros usuários ou o bot
      query = query.or(`(sender_id.eq.${req.user.id}),(receiver_id.eq.${req.user.id})`);
      if (req.user.company_id) {
          query = query.eq('company_id', req.user.company_id);
      }
    } else { // Colaboradores/Admins
      // Colaboradores e admins podem ver todas as mensagens ou filtrar por empresa
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      // Opcional: Adicionar lógica para colaboradores verem apenas mensagens diretas deles
      // ou apenas mensagens de clientes específicos que eles estão encarregados
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return res.status(500).json({ message: 'Falha ao buscar mensagens.' });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Erro ao buscar mensagens do chat:', error);
    res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
  }
});


module.exports = router;
3. Configuração do Frontend (React com Vite)
3.1. Criação e Configuração
Crie uma pasta chamada frontend na raiz do seu projeto.

Dentro de frontend, inicialize um projeto React com Vite:

Bash

npm create vite@latest . -- --template react
(O . no final significa para criar na pasta atual, frontend).

Execute npm install (ou yarn install) na pasta frontend.

Crie um arquivo .env na pasta frontend (e um .env.example para controle de versão):

Snippet de código

# Variáveis de Ambiente do Frontend

# Supabase (Chaves públicas)
VITE_SUPABASE_URL=SUA_URL_DO_PROJETO_SUPABASE
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLIC_DO_SUPABASE

# URL do seu Backend Node.js
VITE_BACKEND_API_URL=http://localhost:3000/api
Instale as dependências adicionais para o frontend:

Bash

npm install axios react-router-dom @supabase/supabase-js react-dropzone chart.js react-chartjs-2 sweetalert2
# Se quiser, para o dashboard: npm install chart.js react-chartjs-2
Crie a estrutura de pastas src/components, src/pages, src/services etc., dentro de frontend/.

3.2. Arquivos Essenciais do Frontend
frontend/src/services/supabaseClient.js

JavaScript

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
frontend/src/services/api.js

JavaScript

import axios from 'axios';
import { supabase } from './supabaseClient'; // Importa o cliente Supabase para pegar o token

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_API_URL, // URL do seu backend Node.js
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar o token de autenticação em todas as requisições
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Opcional: Interceptor para lidar com erros de resposta (ex: 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.error("Token expirado ou inválido. Redirecionando para login...");
      await supabase.auth.signOut(); // Força o logout
      window.location.href = '/login'; // Redireciona para a página de login
    }
    return Promise.reject(error);
  }
);

export default api;
frontend/src/App.jsx

JavaScript

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './services/supabaseClient';
import LoginPage from './pages/LoginPage';
import ClientPortal from './pages/ClientPortal';
import CollaboratorPanel from './pages/CollaboratorPanel';
import Swal from 'sweetalert2'; // Para alertas bonitos

function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true); // Novo estado para controlar o carregamento do usuário

  useEffect(() => {
    const getSessionAndRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session) {
          await fetchUserRole(session.user.id);
        }
      } catch (error) {
        console.error('Erro ao obter sessão:', error);
      } finally {
        setLoadingUser(false);
      }
    };

    getSessionAndRole();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setLoadingUser(false); // Garante que o loading seja false após logout
      }
    });

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setUserRole(data.role);
    } catch (error) {
      console.error('Erro ao buscar papel do usuário:', error.message);
      Swal.fire('Erro', 'Não foi possível carregar o papel do usuário.', 'error');
      setUserRole(null);
    } finally {
        setLoadingUser(false);
    }
  };

  // Componente de Rota Protegida
  const ProtectedRoute = ({ children, allowedRoles }) => {
    const navigate = useNavigate();

    // Enquanto estiver carregando ou não tiver sessão, não renderiza nada ainda
    if (loadingUser || session === null) {
        return <div>Carregando...</div>; // Ou um spinner de carregamento global
    }

    // Se não houver sessão, redireciona para o login
    if (!session) {
        useEffect(() => { navigate('/login'); }, [navigate]);
        return null;
    }

    // Se o papel do usuário não for um dos permitidos, redireciona e mostra alerta
    if (!allowedRoles.includes(userRole)) {
        useEffect(() => {
            Swal.fire('Acesso Negado', 'Você não tem permissão para acessar esta página.', 'warning');
            navigate('/'); // Redireciona para uma página inicial ou dashboard padrão
        }, [navigate]);
        return null;
    }

    // Se tudo estiver ok, renderiza os filhos
    return children;
  };

  // Componente para lidar com redirecionamento padrão
  const HomeRedirect = () => {
    const navigate = useNavigate();
    useEffect(() => {
      if (session && userRole) {
        if (userRole === 'client') {
          navigate('/client-portal');
        } else if (userRole === 'collaborator' || userRole === 'admin') {
          navigate('/collaborator-panel');
        }
      } else if (!session && !loadingUser) {
        navigate('/login');
      }
    }, [session, userRole, loadingUser, navigate]);
    return <div>{loadingUser ? 'Carregando...' : ''}</div>;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/client-portal" element={
          <ProtectedRoute allowedRoles={['client']}>
            <ClientPortal session={session} />
          </ProtectedRoute>
        } />
        <Route path="/collaborator-panel" element={
          <ProtectedRoute allowedRoles={['collaborator', 'admin']}>
            <CollaboratorPanel session={session} />
          </ProtectedRoute>
        } />
        {/* Rota padrão: redireciona com base no status de autenticação/papel */}
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
frontend/src/pages/LoginPage.jsx

JavaScript

import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      Swal.fire('Sucesso!', 'Login realizado com sucesso.', 'success');
      // O App.jsx agora ouvirá a mudança de sessão e redirecionará automaticamente
    } catch (error) {
      Swal.fire('Erro no Login', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h2>Acesse sua conta</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="forgot-password">Esqueceu sua senha? <a href="#">Clique aqui</a></p>
      </div>
    </div>
  );
}

export default LoginPage;
frontend/src/pages/ClientPortal.jsx

JavaScript

import React, { useState, useEffect } from 'react';
import FileUpload from '../components/Client/FileUpload';
import Dashboard from '../components/Client/Dashboard';
import ChatWidget from '../components/Shared/ChatWidget';
import Header from '../components/Shared/Header'; // Você precisará criar este componente
import Sidebar from '../components/Shared/Sidebar'; // Você precisará criar este componente
import { supabase } from '../services/supabaseClient';

function ClientPortal({ session }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' ou 'dashboard'
  const [clientCompanyId, setClientCompanyId] = useState(null);
  const [clientUser, setClientUser] = useState(null);

  useEffect(() => {
    const fetchClientData = async () => {
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, company_id, role')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Error fetching client data:', error);
          return;
        }
        setClientUser(data);
        setClientCompanyId(data.company_id);
      }
    };
    fetchClientData();
  }, [session]);

  if (!clientUser) {
    return <div>Carregando informações do cliente...</div>;
  }

  return (
    <div className="client-portal-layout">
      <Header user={clientUser} />
      <Sidebar userRole={clientUser.role} setActiveTab={setActiveTab} />
      <main className="client-content">
        <nav className="tabs">
          <button
            className={activeTab === 'upload' ? 'active' : ''}
            onClick={() => setActiveTab('upload')}
          >
            Upload de Arquivos
          </button>
          <button
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard Financeiro
          </button>
        </nav>

        <div className="tab-content">
          {activeTab === 'upload' && (
            <FileUpload
              clientId={clientUser.id}
              companyId={clientCompanyId}
            />
          )}
          {activeTab === 'dashboard' && clientCompanyId && (
            <Dashboard companyId={clientCompanyId} />
          )}
          {activeTab === 'dashboard' && !clientCompanyId && (
            <p>Selecione uma empresa para ver o dashboard financeiro.</p>
          )}
        </div>
      </main>
      {/* O ChatWidget aparecerá no canto, independente da aba */}
      <ChatWidget userId={clientUser.id} userRole={clientUser.role} companyId={clientCompanyId} />
    </div>
  );
}

export default ClientPortal;
frontend/src/components/Client/FileUpload.jsx

JavaScript

import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';

function FileUpload({ clientId, companyId }) {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [companies, setCompanies] = useState([]);
  const [fileStatuses, setFileStatuses] = useState({
    SPED: { status: 'pending', file: null, uploadId: null, date: null, name: 'SPED' },
    NFE: { status: 'pending', file: null, uploadId: null, date: null, name: 'NFE' },
    CTE: { status: 'pending', file: null, uploadId: null, date: null, name: 'CTE' },
    PDF_NFS: { status: 'pending', file: null, uploadId: null, date: null, name: 'PDF de NFS' },
    NFCE: { status: 'pending', file: null, uploadId: null, date: null, name: 'NFCE' },
    PLANILHA: { status: 'pending', file: null, uploadId: null, date: null, name: 'Planilha' },
  });

  const fileTypes = ['SPED', 'NFE', 'CTE', 'PDF_NFS', 'NFCE', 'PLANILHA'];

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        // Clientes só veem suas empresas (RLS do Supabase já deveria garantir isso)
        const { data, error } = await supabase
          .from('companies')
          .select('id, name');

        if (error) throw error;
        setCompanies(data);
        if (data.length > 0) {
          setSelectedCompany(companyId || data[0].id); // Prioriza o ID da empresa do cliente, se houver
        }
      } catch (error) {
        console.error('Erro ao buscar empresas:', error.message);
        Swal.fire('Erro', 'Não foi possível carregar as empresas.', 'error');
      }
    };

    fetchCompanies();
  }, [companyId]); // Depende do companyId passado pelo prop

  // Efeito para carregar uploads existentes para a empresa e cliente selecionados
  useEffect(() => {
    const fetchExistingUploads = async () => {
      if (!selectedCompany || !clientId) return;

      try {
        const today = new Date().toISOString().split('T')[0]; // Pega a data YYYY-MM-DD

        const { data, error } = await supabase
          .from('client_uploads')
          .select('file_type, original_filename, uploaded_at, id, ftp_transfer_status')
          .eq('client_id', clientId)
          .eq('company_id', selectedCompany)
          .gte('created_at', today) // Busca uploads feitos HOJE
          .lte('created_at', `${today}T23:59:59.999Z`); // Até o final do dia

        if (error) throw error;

        const updatedStatuses = { ...fileStatuses };
        data.forEach(upload => {
          if (updatedStatuses[upload.file_type]) {
            updatedStatuses[upload.file_type] = {
              status: 'completed', // Considerando que já foi para o Supabase Storage
              file: { name: upload.original_filename },
              uploadId: upload.id,
              date: new Date(upload.uploaded_at).toLocaleString(),
              name: updatedStatuses[upload.file_type].name, // Mantém o nome do tipo
              ftpStatus: upload.ftp_transfer_status
            };
          }
        });
        setFileStatuses(updatedStatuses);
      } catch (error) {
        console.error('Erro ao buscar uploads existentes:', error.message);
      }
    };
    fetchExistingUploads();
  }, [selectedCompany, clientId]); // Depende da empresa e cliente selecionados

  const onDrop = async (acceptedFiles, fileType) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    if (!selectedCompany) {
      Swal.fire('Atenção', 'Por favor, selecione uma empresa primeiro.', 'warning');
      return;
    }

    setFileStatuses(prev => ({
      ...prev,
      [fileType]: { ...prev[fileType], status: 'uploading', file: file, date: null, ftpStatus: 'pending' },
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', selectedCompany);
      formData.append('fileType', fileType);

      // Chamada para o backend para fazer o upload inicial para Supabase Storage
      const response = await api.post('/upload/initial-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.uploadId) {
        setFileStatuses(prev => ({
          ...prev,
          [fileType]: {
            status: 'completed',
            file: file,
            uploadId: response.data.uploadId,
            date: new Date().toLocaleString(),
            name: prev[fileType].name,
            ftpStatus: 'pending' // Ainda pendente de envio para FTP
          },
        }));
        Swal.fire('Sucesso!', `${fileStatuses[fileType].name} enviado para processamento inicial (no storage).`, 'success');
      } else {
        throw new Error('ID de upload não retornado pela API.');
      }
    } catch (error) {
      console.error(`Erro ao enviar ${fileType}:`, error);
      setFileStatuses(prev => ({
        ...prev,
        [fileType]: { ...prev[fileType], status: 'failed', file: null, date: null, ftpStatus: 'failed' },
      }));
      Swal.fire('Erro', `Falha ao enviar ${fileStatuses[fileType].name}: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const handleSendAllFiles = async () => {
    Swal.fire({
      title: 'Confirma o envio?',
      text: 'Todos os arquivos marcados como "completo" serão processados para envio ao FTP. Isso pode levar um tempo.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, enviar!',
      cancelButtonText: 'Cancelar',
    }).then(async (result) => {
      if (result.isConfirmed) {
        const filesToSend = Object.entries(fileStatuses)
          .filter(([, data]) => data.status === 'completed' && data.uploadId !== null && data.ftpStatus !== 'completed')
          .map(([, data]) => ({ type: data.name, uploadId: data.uploadId }));

        if (filesToSend.length === 0) {
          Swal.fire('Atenção', 'Nenhum arquivo para enviar ou todos já foram enviados.', 'warning');
          return;
        }

        let successCount = 0;
        let failCount = 0;
        const failedFiles = [];

        for (const fileEntry of filesToSend) {
          const { type, uploadId } = fileEntry;
          try {
            // Atualiza o status para "processing" no frontend enquanto aguarda o FTP
            setFileStatuses(prev => ({
                ...prev,
                [type]: { ...prev[type], ftpStatus: 'processing' }
            }));

            await api.post('/upload/process-ftp', { uploadId });
            successCount++;
            setFileStatuses(prev => ({
                ...prev,
                [type]: { ...prev[type], ftpStatus: 'completed' }
            }));
          } catch (error) {
            console.error(`Erro ao processar FTP para ${type} (ID: ${uploadId}):`, error);
            failCount++;
            failedFiles.push(type);
            setFileStatuses(prev => ({
                ...prev,
                [type]: { ...prev[type], ftpStatus: 'failed' }
            }));
          }
        }

        if (failCount === 0) {
          Swal.fire('Envio Concluído', `Todos os ${successCount} arquivos foram enviados com sucesso para o FTP!`, 'success');
        } else {
          Swal.fire(
            'Envio Parcialmente Concluído',
            `Sucesso: ${successCount}, Falhas: ${failCount}. Arquivos com falha: ${failedFiles.join(', ')}.`,
            'warning'
          );
        }
      }
    });
  };

  const getDropzoneProps = (fileType) => {
    const { getRootProps, getInputProps } = useDropzone({
      onDrop: (acceptedFiles) => onDrop(acceptedFiles, fileType),
      multiple: false,
      disabled: !selectedCompany || fileStatuses[fileType].status === 'uploading' || fileStatuses[fileType].ftpStatus === 'processing'
    });
    return { getRootProps, getInputProps };
  };

  return (
    <div className="file-upload-section">
      <h3>Upload de Arquivos para {selectedCompany ? companies.find(c => c.id === selectedCompany)?.name : '...'}</h3>

      <div className="form-group">
        <label htmlFor="companySelect">Selecionar Empresa:</label>
        <select
          id="companySelect"
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          disabled={!!companyId} // Se a empresa já veio do contexto, desabilita a seleção
        >
          {companies.map(comp => (
            <option key={comp.id} value={comp.id}>{comp.name}</option>
          ))}
        </select>
      </div>

      <div className="file-type-grid">
        {fileTypes.map((type) => {
          const status = fileStatuses[type].status;
          const ftpStatus = fileStatuses[type].ftpStatus;
          const fileName = fileStatuses[type].file ? fileStatuses[type].file.name : 'Nenhum arquivo';
          const uploadDate = fileStatuses[type].date;

          const { getRootProps, getInputProps } = getDropzoneProps(type);

          return (
            <div key={type} className={`file-type-item ${status} ftp-${ftpStatus}`}>
              <h4>{fileStatuses[type].name}</h4>
              <div {...getRootProps()} className="dropzone-area">
                <input {...getInputProps()} />
                <p>Arraste e solte ou clique para selecionar</p>
                {status === 'uploading' && <p>Fazendo upload para o storage...</p>}
                {status === 'completed' && (
                  <p>
                    **Upload:** {fileName} ({uploadDate})<br/>
                    **FTP Status:** {ftpStatus === 'pending' && 'Aguardando envio'}
                                     {ftpStatus === 'processing' && 'Enviando...'}
                                     {ftpStatus === 'completed' && 'Enviado!'}
                                     {ftpStatus === 'failed' && 'Erro no FTP!'}
                  </p>
                )}
                {status === 'failed' && <p>Falha no upload inicial!</p>}
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="send-all-button"
        onClick={handleSendAllFiles}
        disabled={Object.values(fileStatuses).every(s => s.status !== 'completed' || s.ftpStatus === 'completed' || s.ftpStatus === 'processing')}
      >
        Enviar Arquivos Pendentes para FTP
      </button>
    </div>
  );
}

export default FileUpload;
frontend/src/components/Client/Dashboard.jsx

JavaScript

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import Swal from 'sweetalert2';

// Registrar componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Dashboard({ companyId }) {
  const [financialData, setFinancialData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Esta rota precisaria ser implementada no backend,
        // buscando dados da tabela `financial_data` para a `companyId`
        const response = await api.get(`/financial-data/${companyId}`);
        setFinancialData(response.data);
      } catch (err) {
        console.error('Erro ao buscar dados financeiros:', err);
        setError('Não foi possível carregar os dados financeiros.');
        Swal.fire('Erro', 'Não foi possível carregar os dados financeiros do dashboard.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, [companyId]);

  if (loading) return <div>Carregando dashboard financeiro...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (financialData.length === 0) return <div>Nenhum dado financeiro disponível para esta empresa.</div>;

  // Preparar dados para o gráfico
  const labels = financialData.map(data => new Date(data.month_year).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }));
  const revenues = financialData.map(data => parseFloat(data.revenue));
  const expenses = financialData.map(data => parseFloat(data.expenses));
  const profits = financialData.map(data => parseFloat(data.profit));

  const data = {
    labels,
    datasets: [
      {
        label: 'Receita',
        data: revenues,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
      {
        label: 'Despesas',
        data: expenses,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
      },
      {
        label: 'Lucro',
        data: profits,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Desempenho Financeiro Mensal',
      },
    },
    scales: {
        y: {
            beginAtZero: true
        }
    }
  };

  return (
    <div className="dashboard-section">
      <h3>Dashboard Financeiro</h3>
      <div className="chart-container">
        <Bar data={data} options={options} />
      </div>

      <h4>Detalhes Financeiros</h4>
      <table className="financial-table">
        <thead>
          <tr>
            <th>Mês/Ano</th>
            <th>Receita</th>
            <th>Despesas</th>
            <th>Lucro</th>
          </tr>
        </thead>
        <tbody>
          {financialData.map((data) => (
            <tr key={data.id}>
              <td>{new Date(data.month_year).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
              <td>R$ {data.revenue.toFixed(2)}</td>
              <td>R$ {data.expenses.toFixed(2)}</td>
              <td>R$ {data.profit.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;
frontend/src/components/Shared/ChatWidget.jsx

JavaScript

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import api from '../../services/api';
import Swal from 'sweetalert2';
import './ChatWidget.css'; // Crie um CSS para isso

function ChatWidget({ userId, userRole, companyId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const BOT_USER_ID = 'bot'; // ID fictício para o bot, para identificar as mensagens dele no frontend.
                             // No backend, o sender_id do bot será NULL.

  useEffect(() => {
    if (!isChatOpen) return;

    const fetchMessages = async () => {
      try {
        // CompanyId é opcional. Se for cliente, ele já usa o companyId do próprio usuário.
        // Se for colaborador, pode filtrar por companyId se estiver visualizando um cliente específico.
        const url = companyId && userRole !== 'client' ? `/chat/messages/${companyId}` : '/chat/messages';
        const response = await api.get(url);
        setMessages(response.data);
      } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        Swal.fire('Erro', 'Não foi possível carregar as mensagens do chat.', 'error');
      }
    };

    fetchMessages();

    // Configurar o Realtime Listener para novas mensagens
    // O canal 'chat_room' deve ser o mesmo que o Supabase está transmitindo
    const channel = supabase
      .channel('chat_room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          // Apenas adiciona a mensagem se ela for relevante para o usuário logado
          // (enviada por ele, recebida por ele, ou se ele for colaborador vendo a empresa)
          if (payload.new.sender_id === userId || payload.new.receiver_id === userId ||
              (payload.new.message_type === 'bot' && payload.new.receiver_id === userId) ||
              (userRole !== 'client' && payload.new.company_id === companyId) // Colaboradores veem conversas da empresa
             ) {
            setMessages((prevMessages) => [...prevMessages, payload.new]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel); // Limpa o listener ao desmontar
    };
  }, [isChatOpen, userId, userRole, companyId]); // Recarrega se o chat abrir ou dados do usuário mudarem

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); // Rola para a última mensagem
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      let receiver = null;
      if (userRole === 'client') {
        receiver = BOT_USER_ID; // Clientes iniciam conversas com o bot
      } else {
        // Para colaboradores: precisaria de uma lógica para selecionar o cliente para quem enviar a mensagem
        // Por agora, se for colaborador e não tiver um receiverId selecionado (i.e. companyId sem cliente específico),
        // ele não poderá enviar. Ajuste esta lógica conforme a UX desejada.
        Swal.fire('Atenção', 'Como colaborador, você precisa selecionar um cliente para conversar.', 'info');
        return;
      }

      await api.post('/chat/send-message', {
        receiverId: receiver, // Para o bot, ou para um colaborador/cliente específico
        messageText: newMessage,
        companyId: userRole === 'client' ? companyId : null, // Apenas clientes associam a mensagem à sua empresa
      });
      setNewMessage(''); // Limpa a caixa de texto
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      Swal.fire('Erro', 'Não foi possível enviar a mensagem.', 'error');
    }
  };

  return (
    <div className={`chat-widget-container ${isChatOpen ? 'open' : ''}`}>
      <button className="chat-toggle-button" onClick={() => setIsChatOpen(!isChatOpen)}>
        {isChatOpen ? 'Fechar Chat' : 'Abrir Chat de Suporte'}
      </button>

      {isChatOpen && (
        <div className="chat-window">
          <div className="chat-header">Suporte Online</div>
          <div className="messages-display">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message-item ${msg.sender_id === userId ? 'my-message' : 'other-message'} ${msg.message_type === 'bot' ? 'bot-message' : ''}`}
              >
                <div className="message-content">
                  <strong>
                    {msg.sender_id === userId ? 'Você' : (msg.message_type === 'bot' ? 'Bot' : `Colaborador`)}:
                  </strong> {msg.message_text}
                  <span className="message-time">{new Date(msg.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} /> {/* Para rolagem automática */}
          </div>
          <form onSubmit={handleSendMessage} className="message-input-form">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              disabled={userRole !== 'client' && !companyId} // Colaborador precisa de contexto para enviar
            />
            <button type="submit" disabled={userRole !== 'client' && !companyId}>Enviar</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ChatWidget;
frontend/src/index.css (CSS básico para o frontend)

Este é um CSS de partida. Você deve expandir e refinar conforme a sua identidade visual.

CSS

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  display: flex;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  a:hover {
    color: #747bff;
  }
  button {
    background-color: #f9f9f9;
  }
}

/* -------------------- Login Page -------------------- */
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  background-color: #f0f2f5; /* Light background for login */
}

.login-container {
  background-color: #ffffff;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
  width: 100%;
  max-width: 400px;
}

.login-container h2 {
  color: #333;
  margin-bottom: 24px;
}

.login-container .form-group {
  margin-bottom: 20px;
  text-align: left;
}

.login-container label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: bold;
}

.login-container input[type="email"],
.login-container input[type="password"] {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box; /* Include padding in width */
  font-size: 16px;
  color: #333;
}

.login-container button[type="submit"] {
  width: 100%;
  padding: 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.login-container button[type="submit"]:hover {
  background-color: #0056b3;
}

.login-container button[type="submit"]:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.login-container .forgot-password {
  margin-top: 16px;
  font-size: 14px;
  color: #666;
}

.login-container .forgot-password a {
  color: #007bff;
  text-decoration: none;
}

.login-container .forgot-password a:hover {
  text-decoration: underline;
}

/* -------------------- General Layout (Client/Collaborator) -------------------- */
.client-portal-layout, .collaborator-panel-layout {
  display: flex;
  width: 100%;
  min-height: 100vh;
  background-color: #f4f7f6; /* Light background for main content */
  color: #333;
}

header {
  width: 100%;
  background-color: #34495e; /* Darker blue/grey */
  color: white;
  padding: 15px 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
}

header h1 {
  margin: 0;
  font-size: 1.5em;
}

header .user-info {
  font-size: 0.9em;
}

aside.sidebar {
  width: 220px;
  background-color: #2c3e50; /* Dark blue/grey */
  color: white;
  padding-top: 80px; /* Offset for fixed header */
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
  position: fixed;
  height: 100%;
  left: 0;
  top: 0;
  z-index: 900;
}

aside.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

aside.sidebar ul li {
  margin-bottom: 5px;
}

aside.sidebar ul li button {
  background: none;
  border: none;
  color: white;
  width: 100%;
  padding: 15px 20px;
  text-align: left;
  font-size: 1.1em;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

aside.sidebar ul li button:hover,
aside.sidebar ul li button.active {
  background-color: #34495e; /* Slightly lighter dark blue */
}

main.client-content, main.collaborator-content {
  margin-left: 220px; /* Offset for sidebar */
  padding: 80px 20px 20px 20px; /* Offset for header and general padding */
  flex-grow: 1;
}

/* -------------------- Tabs -------------------- */
.tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
}

.tabs button {
  background-color: #e9ecef;
  color: #495057;
  padding: 10px 15px;
  border: none;
  border-radius: 5px 5px 0 0;
  cursor: pointer;
  margin-right: 5px;
  transition: background-color 0.3s ease;
}

.tabs button:hover {
  background-color: #dee2e6;
}

.tabs button.active {
  background-color: #007bff;
  color: white;
  border-bottom: 2px solid #007bff;
}

.tab-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

/* -------------------- File Upload Section -------------------- */
.file-upload-section h3 {
  color: #34495e;
  margin-bottom: 20px;
}

.file-upload-section .form-group {
  margin-bottom: 20px;
}

.file-upload-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
}

.file-upload-section select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 16px;
  color: #333;
}

.file-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 30px;
}

.file-type-item {
  background-color: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.file-type-item h4 {
  margin-top: 0;
  color: #34495e;
}

.dropzone-area {
  border: 2px dashed #007bff;
  border-radius: 5px;
  padding: 30px;
  cursor: pointer;
  background-color: #eaf5ff;
  color: #007bff;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.dropzone-area:hover {
  background-color: #dbeaff;
  border-color: #0056b3;
}

.dropzone-area p {
  margin: 5px 0;
  font-size: 0.9em;
}

/* Status colors */
.file-type-item.pending .dropzone-area {
  border-color: #ccc;
  background-color: #f8f8f8;
  color: #666;
}

.file-type-item.uploading .dropzone-area {
  border-color: #ffc107; /* Amarelo */
  background-color: #fff3cd;
  color: #856404;
}

.file-type-item.completed .dropzone-area {
  border-color: #28a745; /* Verde */
  background-color: #d4edda;
  color: #155724;
}

.file-type-item.failed .dropzone-area {
  border-color: #dc3545; /* Vermelho */
  background-color: #f8d7da;
  color: #721c24;
}

/* FTP Status Indicators */
.file-type-item.ftp-pending .dropzone-area {
  border-color: #ffc107; /* Laranja para pendente FTP */
  background-color: #fff3cd;
  color: #856404;
}
.file-type-item.ftp-processing .dropzone-area {
  border-color: #17a2b8; /* Azul claro para processando FTP */
  background-color: #d1ecf1;
  color: #0c5460;
}
.file-type-item.ftp-completed .dropzone-area {
  border-color: #28a745; /* Verde para completado FTP */
  background-color: #d4edda;
  color: #155724;
}
.file-type-item.ftp-failed .dropzone-area {
  border-color: #dc3545; /* Vermelho para falha FTP */
  background-color: #f8d7da;
  color: #721c24;
}


.send-all-button {
  display: block;
  width: fit-content;
  margin: 30px auto 0 auto;
  padding: 15px 30px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1.1em;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.send-all-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.send-all-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* -------------------- Dashboard Section -------------------- */
.dashboard-section h3 {
  color: #34495e;
  margin-bottom: 20px;
}

.chart-container {
  max-width: 800px;
  margin: 0 auto 40px auto;
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.financial-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  background-color: white;
  border-radius: 8px;
  overflow: hidden; /* Para cantos arredondados com borda */
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.financial-table th, .financial-table td {
  border: 1px solid #ddd;
  padding: 12px 15px;
  text-align: left;
}

.financial-table th {
  background-color: #f2f2f2;
  font-weight: bold;
  color: #333;
}

.financial-table tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}

.financial-table tbody tr:hover {
  background-color: #f1f1f1;
}

.error-message {
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  padding: 10px;
  border-radius: 5px;
  margin-top: 20px;
}

/* -------------------- Chat Widget -------------------- */
.chat-widget-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  width: 350px;
  max-height: 450px;
  display: flex;
  flex-direction: column;
}

.chat-toggle-button {
  background-color: #28a745; /* Green */
  color: white;
  padding: 10px 15px;
  border-radius: 50px; /* Pill shape */
  border: none;
  cursor: pointer;
  font-size: 1em;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  align-self: flex-end; /* Alinha o botão para a direita */
  transition: background-color 0.3s ease;
}

.chat-toggle-button:hover {
  background-color: #218838;
}

.chat-window {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  margin-top: 10px; /* Espaço entre o botão e a janela do chat */
  overflow: hidden;
  height: 380px; /* Altura fixa para a janela do chat */
}

.chat-header {
  background-color: #007bff;
  color: white;
  padding: 10px 15px;
  font-weight: bold;
  text-align: center;
}

.messages-display {
  flex-grow: 1;
  padding: 15px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: #e9ecef;
}

.message-item {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 15px;
  word-wrap: break-word; /* Quebra palavras longas */
}

.my-message {
  align-self: flex-end;
  background-color: #dcf8c6; /* Light green */
  color: #333;
}

.other-message {
  align-self: flex-start;
  background-color: #f1f0f0; /* Light grey */
  color: #333;
}

.bot-message {
    background-color: #e0f2f7; /* Light blue for bot */
    border: 1px solid #a7d9ed;
    color: #0a3d62;
    font-style: italic;
}

.message-content strong {
  font-size: 0.9em;
  margin-bottom: 2px;
}

.message-time {
  font-size: 0.7em;
  color: #666;
  text-align: right;
  margin-top: 2px;
}

.message-input-form {
  display: flex;
  padding: 10px;
  border-top: 1px solid #ddd;
  background-color: white;
}

.message-input-form input {
  flex-grow: 1;
  border: 1px solid #ddd;
  border-radius: 20px;
  padding: 8px 15px;
  margin-right: 10px;
  font-size: 0.9em;
}

.message-input-form button {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 8px 15px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.message-input-form button:hover {
  background-color: #0056b3;
}

/* Hide the chat window when not open */
.chat-widget-container:not(.open) .chat-window {
  display: none;
}
4. Como Executar o Projeto
Siga estes passos cuidadosamente:

4.1. Clone ou Crie as Pastas
Crie uma pasta vazia para seu projeto (ex: dm-fin-project).
Dentro dela, crie duas subpastas: backend e frontend.
4.2. Configurar o Backend
Navegue para a pasta backend no seu terminal: cd dm-fin-project/backend.
Crie o arquivo package.json e cole o conteúdo fornecido na seção "Dependências" do Backend.
Execute npm install (ou yarn install) para instalar as dependências.
Crie a estrutura de pastas src/controllers, src/middleware, src/routes, src/services dentro de backend/.
Crie os arquivos JavaScript (ex: app.js, authMiddleware.js, ftpService.js, uploadController.js, iaService.js, e os arquivos de rota auth.js, upload.js, chat.js) dentro de suas respectivas pastas e cole o código fornecido.
Crie o arquivo .env na pasta backend e preencha com suas credenciais do Supabase, FTP e OpenAI.
Inicie o servidor backend: npm run dev (se tiver nodemon instalado para desenvolvimento) ou node src/app.js. Você deverá ver a mensagem: Backend running on http://localhost:3000.
4.3. Configurar o Frontend
Navegue para a pasta frontend no seu terminal: cd dm-fin-project/frontend.
Inicialize o projeto React com Vite: npm create vite@latest . -- --template react.
Execute npm install (ou yarn install) para instalar as dependências.
Instale as dependências adicionais: npm install axios react-router-dom @supabase/supabase-js react-dropzone chart.js react-chartjs-2 sweetalert2.
Crie a estrutura de pastas src/components, src/pages, src/services e cole os arquivos .jsx e .js fornecidos em suas respectivas pastas. Lembre-se de criar o arquivo ChatWidget.css em frontend/src/components/Shared/ e colar o CSS específico do chat.
Substitua o conteúdo de frontend/src/App.jsx, frontend/src/main.jsx (apenas certificando-se que renderiza o App), e frontend/src/index.css (para ter um estilo inicial) com os códigos fornecidos.
Crie o arquivo .env na pasta frontend e preencha com suas chaves públicas do Supabase e a URL do seu backend.
Inicie a aplicação frontend: npm run dev. Você deverá ver a mensagem: Vite vX.X.X development server running at: > http://localhost:5173/.
4.4. Teste o Sistema
Abra o navegador e acesse http://localhost:5173/.
Você deve ser redirecionado para a página de login.
Para testar:
No Supabase, crie alguns usuários de teste (um cliente, um colaborador, um admin) em Authentication > Users.
Crucial: Após criar os usuários no Supabase Auth, vá na sua tabela public.users e insira manualmente os IDs desses usuários (que são os UUIDs do Supabase Auth) e defina seus roles (client, collaborator, admin) e associe um company_id para o cliente.
Crie algumas empresas na tabela public.companies.
Faça login com um usuário client. Teste o upload de arquivos e o chat.
Faça login com um usuário collaborator ou admin. Explore as funcionalidades (ainda a serem desenvolvidas em detalhes no frontend).
