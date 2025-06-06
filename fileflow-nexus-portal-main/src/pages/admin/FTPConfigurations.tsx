import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, TestConnection } from 'lucide-react';
import { Client } from 'basic-ftp';

interface FTPConfiguration {
  id: string;
  company_id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  base_path: string;
  use_ssl: boolean;
  company: {
    name: string;
  };
}

interface Company {
  id: string;
  name: string;
}

const FTPConfigurations = () => {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [configurations, setConfigurations] = useState<FTPConfiguration[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [editingConfig, setEditingConfig] = useState<FTPConfiguration | null>(null);
  const [formData, setFormData] = useState({
    company_id: '',
    host: '',
    port: '21',
    username: '',
    password: '',
    base_path: '/',
    use_ssl: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Buscar configurações FTP
      const { data: ftpData, error: ftpError } = await supabase
        .from('ftp_configurations')
        .select(`
          *,
          company:companies(name)
        `)
        .order('created_at', { ascending: false });

      if (ftpError) throw ftpError;
      setConfigurations(ftpData || []);

      // Buscar empresas
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as configurações FTP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (config?: FTPConfiguration) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        company_id: config.company_id,
        host: config.host,
        port: config.port.toString(),
        username: config.username,
        password: config.password,
        base_path: config.base_path,
        use_ssl: config.use_ssl,
      });
    } else {
      setEditingConfig(null);
      setFormData({
        company_id: '',
        host: '',
        port: '21',
        username: '',
        password: '',
        base_path: '/',
        use_ssl: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingConfig(null);
    setFormData({
      company_id: '',
      host: '',
      port: '21',
      username: '',
      password: '',
      base_path: '/',
      use_ssl: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const configData = {
        ...formData,
        port: parseInt(formData.port),
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('ftp_configurations')
          .update(configData)
          .eq('id', editingConfig.id);

        if (error) throw error;
        toast({
          title: "Configuração atualizada",
          description: "As configurações FTP foram atualizadas com sucesso",
        });
      } else {
        const { error } = await supabase
          .from('ftp_configurations')
          .insert(configData);

        if (error) throw error;
        toast({
          title: "Configuração criada",
          description: "As configurações FTP foram criadas com sucesso",
        });
      }

      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações FTP",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração?')) return;

    try {
      const { error } = await supabase
        .from('ftp_configurations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({
        title: "Configuração excluída",
        description: "As configurações FTP foram excluídas com sucesso",
      });
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir configuração:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir as configurações FTP",
        variant: "destructive",
      });
    }
  };

  const testConnection = async (config: FTPConfiguration) => {
    setIsTestingConnection(true);
    const ftpClient = new Client();
    try {
      await ftpClient.access({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        secure: config.use_ssl,
      });

      // Tentar listar o diretório base
      await ftpClient.list(config.base_path);

      toast({
        title: "Conexão bem-sucedida",
        description: "A conexão com o servidor FTP foi estabelecida com sucesso",
      });
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Não foi possível conectar ao servidor FTP",
        variant: "destructive",
      });
    } finally {
      ftpClient.close();
      setIsTestingConnection(false);
    }
  };

  if (!user || user.type !== 'staff') {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Configurações FTP</CardTitle>
            <CardDescription>
              Gerencie as configurações de conexão FTP para cada empresa
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Configuração
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados de conexão FTP para a empresa
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <select
                    id="company"
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    value={formData.company_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_id: e.target.value }))}
                    required
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                    placeholder="ftp.exemplo.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Porta</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="21"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Usuário</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="usuario"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="senha"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="base_path">Diretório Base</Label>
                  <Input
                    id="base_path"
                    value={formData.base_path}
                    onChange={(e) => setFormData(prev => ({ ...prev, base_path: e.target.value }))}
                    placeholder="/"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="use_ssl"
                    checked={formData.use_ssl}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, use_ssl: checked }))}
                  />
                  <Label htmlFor="use_ssl">Usar SSL/TLS</Label>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingConfig ? 'Salvar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Porta</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Diretório Base</TableHead>
                  <TableHead>SSL/TLS</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : configurations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Nenhuma configuração encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  configurations.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>{config.company.name}</TableCell>
                      <TableCell>{config.host}</TableCell>
                      <TableCell>{config.port}</TableCell>
                      <TableCell>{config.username}</TableCell>
                      <TableCell>{config.base_path}</TableCell>
                      <TableCell>
                        {config.use_ssl ? 'Sim' : 'Não'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => testConnection(config)}
                            disabled={isTestingConnection}
                          >
                            <TestConnection className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(config)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(config.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FTPConfigurations; 