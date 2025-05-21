
# 🗂️ Sistema de Gestão de Arquivos e Atendimento - Clientes e Colaboradores

Este sistema tem como objetivo facilitar o envio de documentos fiscais por parte dos clientes e a gestão dos dados por parte dos colaboradores, garantindo organização, automação de processos, integração via FTP e suporte inteligente com IA.

---

## 📌 Funcionalidades

### 👥 Autenticação
- Login com redirecionamento baseado no tipo de usuário:
  - **Cliente**: acesso à área de envio de arquivos e dashboard.
  - **Colaborador**: acesso à área de análise de importações, chat interno e configurações.

---

### 🧾 Área do Cliente
- Escolha da **empresa** para qual os arquivos serão enviados.
- Upload por tipo de documento:
  - **SPED**
  - **NFE**
  - **CTE**
  - **PDF de NFS**
  - **NFCE**
  - **Planilha**
- Cada aba muda de cor:
  - ✅ Verde: arquivo enviado
  - ❌ Vermelho: pendente
- Envio final via **FTP** com estrutura:
```

/NOME\_EMPRESA/ANO-MES/
/SPED/
/NFE/
/CTE/
/NFS\_PDF/
/NFCE/
/PLANILHAS/

```
- Dashboard com dados financeiros atualizados mensalmente.
- Bot de suporte com **Inteligência Artificial** (IA) para atendimento automatizado.

---

### 🧑‍💼 Área do Colaborador
- Visualização e registro das **importações de arquivos** com status:
- Importado com sucesso
- Erro (com observação)
- Pendente
- **Chat interno e com cliente** estilo WhatsApp.
- Aba de **configurações**:
- Gerenciar empresas
- Gerenciar usuários
- Gerenciar permissões
- Parametrizações do sistema

---

## 🛠️ Tecnologias Utilizadas

| Camada       | Tecnologia                                 |
|--------------|---------------------------------------------|
| Frontend     | React.js + TailwindCSS                      |
| Backend      | Node.js (Express) ou Python (Flask/Django)  |
| Banco de Dados | PostgreSQL / MySQL                        |
| Upload FTP   | `ftplib` (Python) ou `basic-ftp` (Node.js)  |
| Chat         | WebSocket / Socket.IO / Firebase            |
| Bot IA       | OpenAI API / Rasa / Dialogflow              |
| Hospedagem   | Docker + VPS / AWS / DigitalOcean           |

---

## 📁 Estrutura de Pastas (FTP)
```

📁 /NOME\_EMPRESA/
📁 2025-05/
📁 SPED/
📁 NFE/
📁 CTE/
📁 NFS\_PDF/
📁 NFCE/
📁 PLANILHAS/

````

---

## 📊 Banco de Dados (modelo simplificado)

```sql
USERS (id, nome, email, senha_hash, tipo, empresa_id)
EMPRESAS (id, nome, cnpj)
UPLOADS (id, user_id, empresa_id, tipo_arquivo, data_upload, status, caminho)
IMPORTACOES (id, upload_id, status, observacao, data)
CHATS (id, user_from, user_to, mensagem, data)
DASHBOARD_DADOS (id, empresa_id, mes, ano, receita, despesa, impostos, etc)
````

---

## 🚀 Como Executar o Projeto

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/seu-repositorio.git

# 2. Instale as dependências
cd backend
npm install
# ou
pip install -r requirements.txt

# 3. Configure o .env com as credenciais do banco e FTP

# 4. Inicie o servidor
npm run dev
# ou
python app.py

# 5. Inicie o frontend
cd frontend
npm install
npm run dev
```

---

## ✅ Status do Projeto

🚧 **Em desenvolvimento**
📅 Previsão para MVP: **\[definir data de entrega]**

---

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Fork este repositório
2. Crie uma branch: `git checkout -b minha-feature`
3. Faça commit das alterações: `git commit -m 'feat: minha nova feature'`
4. Push na branch: `git push origin minha-feature`
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está licenciado sob a Licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

## 📞 Contato

Desenvolvido por **Jhennifer Ferreira Nascimento**
📧 Email: \[[seu-email@example.com](mailto:seu-email@example.com)]
🔗 GitHub: [https://github.com/01Jhenni](https://github.com/01Jhenni)
📱 TikTok: [@01jhenni](https://www.tiktok.com/@01jhenni)

```

---

Se quiser, posso gerar esse `README.md` pronto para download ou incluir mais seções como **FAQ**, **Capturas de Tela**, **Roadmap**, ou até **fluxogramas/diagramas** do sistema. Deseja adicionar algo mais?
```
