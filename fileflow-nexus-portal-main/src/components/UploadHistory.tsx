import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, AlertCircle, CheckCircle, Clock, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface Upload {
  id: string;
  file_name: string;
  file_size: number;
  month: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message?: string;
  created_at: string;
  company: {
    name: string;
  };
  document_type: {
    name: string;
  };
}

const UploadHistory = () => {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  useEffect(() => {
    fetchUploads();
  }, [selectedCompany, selectedStatus, selectedMonth]);

  const fetchUploads = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('uploads')
        .select(`
          id,
          file_name,
          file_size,
          month,
          status,
          error_message,
          created_at,
          company:companies(name),
          document_type:document_types(name)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (selectedCompany !== 'all') {
        query = query.eq('company_id', selectedCompany);
      }
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }
      if (selectedMonth !== 'all') {
        query = query.eq('month', selectedMonth);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUploads(data || []);
    } catch (error) {
      console.error('Erro ao buscar uploads:', error);
      toast({
        title: "Erro ao carregar histórico",
        description: "Não foi possível carregar o histórico de uploads",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: Upload['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Concluído</Badge>;
      case 'error':
        return <Badge className="bg-red-500">Erro</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-500">Processando</Badge>;
      default:
        return <Badge className="bg-gray-500">Pendente</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredUploads = uploads.filter(upload => 
    upload.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    upload.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    upload.document_type.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMonths = () => {
    const months = new Set(uploads.map(u => u.month));
    return Array.from(months).sort((a, b) => {
      const [monthA, yearA] = a.split('/');
      const [monthB, yearB] = b.split('/');
      return new Date(parseInt(yearB), parseInt(monthB) - 1) - new Date(parseInt(yearA), parseInt(monthA) - 1);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Uploads</CardTitle>
        <CardDescription>
          Acompanhe o status de todos os seus uploads
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Select
                value={selectedCompany}
                onValueChange={setSelectedCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {user?.companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select
                value={selectedMonth}
                onValueChange={setSelectedMonth}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {getMonths().map(month => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Input
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Tabela de Uploads */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <Clock className="h-4 w-4 animate-spin mr-2" />
                        Carregando...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUploads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Nenhum upload encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell className="font-medium">{upload.file_name}</TableCell>
                      <TableCell>{upload.company.name}</TableCell>
                      <TableCell>{upload.document_type.name}</TableCell>
                      <TableCell>{upload.month}</TableCell>
                      <TableCell>{formatFileSize(upload.file_size)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(upload.status)}
                          {upload.status === 'error' && upload.error_message && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                toast({
                                  title: "Detalhes do erro",
                                  description: upload.error_message,
                                  variant: "destructive",
                                });
                              }}
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(upload.created_at)}</TableCell>
                      <TableCell>
                        {upload.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              // Implementar download do arquivo
                              toast({
                                title: "Download iniciado",
                                description: "O arquivo será baixado em breve",
                              });
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadHistory; 