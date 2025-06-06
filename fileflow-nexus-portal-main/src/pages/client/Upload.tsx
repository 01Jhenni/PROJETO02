import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Building, Upload as UploadIcon, CheckCircle, AlertCircle, FilePlus2, Calendar } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Client } from 'basic-ftp';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import UploadHistory from "@/components/UploadHistory";

interface UploadStatus {
  companyId: string;
  documentTypeId: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  file?: File;
  month?: string;
}

const Upload = () => {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (companyId: string, documentTypeId: string, file: File) => {
    // Validate file extension
    const documentType = user?.companies
      .find(c => c.id === companyId)
      ?.documentTypes.find(dt => dt.id === documentTypeId);

    if (!documentType) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !documentType.allowedExtensions.includes(fileExtension)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: `Este documento aceita apenas os formatos: ${documentType.allowedExtensions.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    setSelectedCompany(companyId);
    setSelectedDocumentType(documentTypeId);
    setSelectedMonth(new Date().toLocaleString('pt-BR', { month: 'long' }));

    setUploadStatuses(prev => {
      const existing = prev.find(s => s.companyId === companyId && s.documentTypeId === documentTypeId);
      if (existing) {
        return prev.map(s => 
          s.companyId === companyId && s.documentTypeId === documentTypeId
            ? { ...s, file, status: 'pending' }
            : s
        );
      }
      return [...prev, { companyId, documentTypeId, file, status: 'pending' }];
    });
  };

  const handleMonthSelect = (companyId: string, documentTypeId: string, month: string) => {
    setSelectedMonth(month);
    setUploadStatuses(prev => 
      prev.map(s => 
        s.companyId === companyId && s.documentTypeId === documentTypeId
          ? { ...s, month }
          : s
      )
    );
  };

  const uploadToFTP = async (status: UploadStatus) => {
    if (!status.file || !status.month) return;

    const company = user?.companies.find(c => c.id === status.companyId);
    const documentType = company?.documentTypes.find(dt => dt.id === status.documentTypeId);
    if (!company || !documentType) return;

    try {
      // Converter arquivo para base64
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(status.file!);
      });

      // Chamar a função Edge
      const { data, error } = await supabase.functions.invoke('ftp-upload', {
        body: {
          company_id: status.companyId,
          document_type_id: status.documentTypeId,
          file_name: status.file!.name,
          file_content: fileContent,
          month: status.month
        }
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro no upload:', error);
      throw error;
    }
  };

  const handleUpload = async () => {
    if (!selectedCompany || !selectedDocumentType || !selectedMonth) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    let uploadData: { id: string } | null = null;

    try {
      // Criar registro do upload no banco de dados
      const { data, error: uploadError } = await supabase
        .from('uploads')
        .insert({
          user_id: user?.id,
          company_id: selectedCompany,
          document_type_id: selectedDocumentType,
          file_name: selectedFile?.name,
          file_size: selectedFile?.size,
          month: selectedMonth,
          status: 'pending',
        })
        .select()
        .single();

      if (uploadError) throw uploadError;
      uploadData = data;

      // Atualizar status para processando
      await supabase
        .from('uploads')
        .update({ status: 'processing' })
        .eq('id', uploadData.id);

      // Upload para o FTP
      const response = await fetch('/functions/v1/ftp-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          file: await fileToBase64(selectedFile!),
          fileName: selectedFile?.name,
          companyId: selectedCompany,
          documentTypeId: selectedDocumentType,
          month: selectedMonth,
          uploadId: uploadData.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao fazer upload do arquivo');
      }

      // Atualizar status para concluído
      await supabase
        .from('uploads')
        .update({ status: 'completed' })
        .eq('id', uploadData.id);

      toast({
        title: "Upload concluído",
        description: "O arquivo foi enviado com sucesso",
      });

      // Limpar formulário
      setSelectedFile(null);
      setSelectedCompany('');
      setSelectedDocumentType('');
      setSelectedMonth('');
    } catch (error) {
      console.error('Erro no upload:', error);
      
      // Atualizar status para erro
      if (uploadData?.id) {
        await supabase
          .from('uploads')
          .update({ 
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          })
          .eq('id', uploadData.id);
      }

      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao fazer o upload do arquivo",
        variant: "destructive",
      });
    }
  };

  // Função auxiliar para converter File para Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove o prefixo "data:application/pdf;base64," do resultado
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Erro ao converter arquivo para base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  if (!user) return null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload de Arquivos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload de Arquivos</CardTitle>
              <CardDescription>
                Selecione a empresa e faça o upload dos documentos necessários
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <Label htmlFor="company">Empresa</Label>
                <Select
                  value={selectedCompany}
                  onValueChange={setSelectedCompany}
                >
                  <SelectTrigger id="company" className="w-full">
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {user.companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCompany && (
                <Tabs defaultValue={user.companies.find(c => c.id === selectedCompany)?.documentTypes[0]?.id}>
                  <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                    {user.companies
                      .find(c => c.id === selectedCompany)
                      ?.documentTypes.map(docType => (
                        <TabsTrigger key={docType.id} value={docType.id}>
                          {docType.name}
                        </TabsTrigger>
                      ))}
                  </TabsList>

                  {user.companies
                    .find(c => c.id === selectedCompany)
                    ?.documentTypes.map(docType => (
                      <TabsContent key={docType.id} value={docType.id}>
                        <Card>
                          <CardHeader>
                            <CardTitle>{docType.name}</CardTitle>
                            <CardDescription>{docType.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <Label>Mês de Referência</Label>
                                <Select
                                  onValueChange={(value) => handleMonthSelect(selectedCompany, docType.id, value)}
                                  value={selectedMonth}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o mês" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => {
                                      const date = new Date();
                                      date.setMonth(i);
                                      return (
                                        <SelectItem key={i} value={date.toLocaleString('pt-BR', { month: 'long' })}>
                                          {date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Arquivo</Label>
                                <div className="mt-2">
                                  <input
                                    type="file"
                                    accept={docType.allowedExtensions.map(ext => `.${ext}`).join(',')}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileSelect(selectedCompany, docType.id, file);
                                    }}
                                    className="hidden"
                                    id={`file-${docType.id}`}
                                  />
                                  <Label
                                    htmlFor={`file-${docType.id}`}
                                    className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50"
                                  >
                                    <div className="flex flex-col items-center">
                                      <FilePlus2 className="h-8 w-8 mb-2" />
                                      <span>Clique para selecionar o arquivo</span>
                                      <span className="text-sm text-muted-foreground">
                                        Formatos aceitos: {docType.allowedExtensions.join(', ')}
                                      </span>
                                    </div>
                                  </Label>
                                </div>
                              </div>

                              {selectedFile && (
                                <div className="flex items-center gap-2 text-sm">
                                  <FilePlus2 className="h-4 w-4" />
                                  <span>
                                    {selectedFile.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    ))}
                </Tabs>
              )}

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !selectedFile}
                >
                  {isUploading ? 'Enviando...' : 'Enviar Arquivo'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <UploadHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Upload;
