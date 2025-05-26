# 📁 FileFlow Nexus Portal

Sistema completo para **gestão de arquivos fiscais, importações e atendimento** para clientes e colaboradores de escritórios contábeis.

---

## ✨ Visão Geral

O FileFlow Nexus Portal facilita o envio, organização e acompanhamento de documentos fiscais, além de oferecer dashboards financeiros, registro de importações, chat interno e automações para o time contábil.

---

## 🚀 Funcionalidades Principais

### 👤 Área do Cliente

- **Upload de Documentos**: Envio de arquivos fiscais por tipo (SPED, NFE, CTE, PDF de NFS, NFCE, Planilhas).
- **Seleção de Empresa e Mês**: Cliente escolhe para qual empresa e mês está enviando os arquivos.
- **Status Visual**: Abas coloridas indicam arquivos enviados (✅ verde) ou pendentes (❌ vermelho).
- **Envio via FTP**: Estrutura automática de pastas por empresa, ano e mês.
- **Dashboard Financeiro**: Visualização de dados financeiros atualizados mensalmente.
- **Bot de Suporte com IA**: Atendimento automatizado para dúvidas e suporte.

### 🧑‍💼 Área do Colaborador

- **Gestão de Importações**: Registro, acompanhamento e filtro de importações de arquivos, com status (importado, erro, pendente).
- **Registro de Erros**: Upload de prints, descrição do erro e notificação por e-mail ao responsável.
- **Chat Interno e com Cliente**: Comunicação eficiente estilo WhatsApp.
- **Configurações**: Gerenciamento de empresas, usuários, permissões e parametrizações do sistema.

---

## 🛠️ Tecnologias Utilizadas

| Camada         | Tecnologia                                 |
| -------------- | ------------------------------------------ |
| Frontend       | React.js, Vite, TailwindCSS                |
| Backend        | Node.js (Express) ou Python (Flask/Django) |
| Banco de Dados | PostgreSQL / MySQL                         |
| Upload FTP     | basic-ftp (Node.js) / ftplib (Python)      |
| Chat           | WebSocket / Socket.IO / Firebase           |
| Bot IA         | OpenAI API / Rasa / Dialogflow             |
| Hospedagem     | Docker, VPS, AWS, DigitalOcean             |

---

## 🗂️ Estrutura de Pastas (FTP)

```
/NOME_EMPRESA/ANO-MES/
  /SPED/
  /NFE/
  /CTE/
  /NFS_PDF/
  /NFCE/
  /PLANILHAS/
```

---

## 🗄️ Modelo de Banco de Dados (Simplificado)

```sql
USERS (id, nome, email, senha_hash, tipo, empresa_id)
EMPRESAS (id, nome, cnpj)
UPLOADS (id, user_id, empresa_id, tipo_arquivo, data_upload, status, caminho)
IMPORTACOES (id, upload_id, status, observacao, data)
CHATS (id, user_from, user_to, mensagem, data)
DASHBOARD_DADOS (id, empresa_id, mes, ano, receita, despesa, impostos, etc)
```

---

## 📊 Dashboards

- **Dashboard do Cliente**: Gráficos de uploads, pendências e dados financeiros por mês.
- **Dashboard do Colaborador**: Visão geral das importações, erros e status dos arquivos.

---

## ⚡ Como Executar o Projeto

### 1. Clone o repositório

```bash
git clone https://github.com/01Jhenni/PROJETO02.git
```

### 2. Instale as dependências

#### Backend

```bash
cd backend
npm install
# ou
pip install -r requirements.txt
```

#### Frontend

```bash
cd frontend
npm install
```

### 3. Configure o `.env` com as credenciais do banco e FTP

### 4. Inicie o servidor

```bash
# Backend
npm run dev
# ou
python app.py
```

### 5. Inicie o frontend

```bash
cd frontend
npm run dev
```

---

## 🤝 Contribuição

Contribuições são bem-vindas!

1. Fork este repositório
2. Crie uma branch: `git checkout -b minha-feature`
3. Faça commit das alterações: `git commit -m 'feat: minha nova feature'`
4. Push na branch: `git push origin minha-feature`
5. Abra um Pull Request

---

## 📄 Licença

Projeto sob Licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

## 📞 Contato

Desenvolvido por **Jhennifer Ferreira Nascimento**  
📧 Email: [seu-email@example.com]  
🔗 GitHub: [@01Jhenni](https://github.com/01Jhenni)  
📱 TikTok: [@01jhenni](https://www.tiktok.com/@01jhenni)

---

> _Sinta-se à vontade para sugerir melhorias, abrir issues ou contribuir com novas funcionalidades!_
