import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  MoreVertical,
  Download,
  Upload,
  Eye,
  Edit,
  Trash2,
  Building2,
  Handshake,
  FileText,
  Loader2
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import * as pdfjsLib from "pdfjs-dist";

// Configurar o worker do PDF.js usando CDN para garantir compatibilidade e evitar erro 500 no Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "overdue";
  priority: "low" | "medium" | "high";
  sector: string;
  assignee: string;
  dueDate: string;
  completedDate?: string;
  points: number;
  isPmoValidated: boolean;
  isProcessActivity: boolean;
}

interface Agreement {
  id: string;
  name: string;
  sector: string;
  status: "active" | "inactive";
  lastAudit?: string;
}

const mockAgreements: Agreement[] = [
 /*  { id: "1", name: "Amil", sector: "UTI", status: "active", lastAudit: "2025-11-20" },
  { id: "2", name: "Unimed", sector: "Cardiologia", status: "active", lastAudit: "2025-11-22" },
  { id: "3", name: "Bradesco Saúde", sector: "UTI", status: "active", lastAudit: "2025-11-15" },
  { id: "4", name: "SulAmérica", sector: "Faturamento", status: "active", lastAudit: "2025-11-18" },
  { id: "5", name: "Cassi", sector: "Cardiologia", status: "inactive", lastAudit: "2025-10-10" }, */
];

const mockChecklists: ChecklistItem[] = [
  /* {
    id: "1",
    title: "Verificação de Equipamentos Médicos",
    description: "Inspeção completa de todos os equipamentos da UTI",
    status: "completed",
    priority: "high",
    sector: "UTI",
    assignee: "João Silva",
    dueDate: "2025-11-25",
    completedDate: "2025-11-25",
    points: 10,
    isPmoValidated: true,
    isProcessActivity: true
  },
  {
    id: "2",
    title: "Auditoria de Prontuários",
    description: "Revisar 20 prontuários aleatórios do mês anterior",
    status: "in-progress",
    priority: "medium",
    sector: "Cardiologia",
    assignee: "Maria Santos",
    dueDate: "2025-11-28",
    points: 10,
    isPmoValidated: true,
    isProcessActivity: true
  },
  {
    id: "3",
    title: "Limpeza e Esterilização",
    description: "Protocolo completo de limpeza das salas cirúrgicas",
    status: "overdue",
    priority: "high",
    sector: "Centro Cirúrgico",
    assignee: "Pedro Costa",
    dueDate: "2025-11-24",
    points: 10,
    isPmoValidated: false,
    isProcessActivity: false
  },
  {
    id: "4",
    title: "Conferência de Medicamentos",
    description: "Verificar estoque e validade dos medicamentos",
    status: "pending",
    priority: "low",
    sector: "Farmácia",
    assignee: "Ana Lima",
    dueDate: "2025-12-01",
    points: 10,
    isPmoValidated: true,
    isProcessActivity: true
  },
  {
    id: "5",
    title: "Treinamento de Equipe",
    description: "Sessão de atualização sobre novos protocolos",
    status: "pending",
    priority: "medium",
    sector: "Emergência",
    assignee: "Carlos Mendes",
    dueDate: "2025-12-05",
    points: 0,
    isPmoValidated: false,
    isProcessActivity: false
  }, */
];

export default function Checklists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const { role, rolePermissions, userSector } = useRole();
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfData, setPdfData] = useState<string[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [dbChecklists, setDbChecklists] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [selectedUnidade, setSelectedUnidade] = useState<string>("");
  const [selectedSetor, setSelectedSetor] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getStorageUrl = (path: string) => {
    if (!path) return "#";
    if (path.startsWith('http')) return path;
    
    try {
      const { data } = supabase.storage.from('checklist_upload').getPublicUrl(path);
      console.log("Gerando URL para:", path, "->", data?.publicUrl);
      return data?.publicUrl || "#";
    } catch (e) {
      console.error("Erro ao gerar URL do storage:", e);
      return "#";
    }
  };

  const fetchChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from('checklist')
        .select(`
          *,
          unidade:unidade_id(nome),
          setor:setor_id(nome)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDbChecklists(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar checklists:", error);
    }
  };

  const fetchMetadata = async () => {
    try {
      const { data: units } = await supabase.from('unidade').select('id, nome');
      const { data: sectors } = await supabase.from('setor').select('id, nome');
      setUnidades(units || []);
      setSetores(sectors || []);
      
      const userStr = localStorage.getItem("genesis_user");
      const user = userStr ? JSON.parse(userStr) : null;
      if (user?.unidade_id) setSelectedUnidade(user.unidade_id.toString());
      if (user?.setor_id) setSelectedSetor(user.setor_id.toString());
    } catch (error) {
      console.error("Erro ao buscar metadados:", error);
    }
  };

  useEffect(() => {
    fetchChecklists();
    fetchMetadata();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    setSelectedFile(file);
    setChecklistTitle(file.name.replace(".pdf", ""));
    setIsImporting(true);
    setShowImportDialog(true);
    setPdfData([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const extractedText: string[] = [];

      console.log(`Documento PDF carregado: ${numPages} páginas.`);

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extrair texto de cada item
        const pageText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");
        
        if (pageText.trim()) {
          extractedText.push(pageText);
        } else {
          extractedText.push(`[Página ${i}: Nenhum texto legível encontrado. O documento pode ser uma imagem/scaneado.]`);
        }
      }

      console.log("Texto extraído com sucesso.");
      setPdfData(extractedText);
    } catch (error: any) {
      console.error("Erro ao processar PDF:", error);
      const errorMessage = error?.message || "Erro desconhecido";
      setPdfData([`Erro ao ler o arquivo PDF: ${errorMessage}. Verifique se o arquivo não está protegido ou corrompido.`]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !checklistTitle || !selectedUnidade || !selectedSetor) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Certifique-se de que o arquivo foi carregado, possui um título, unidade e setor selecionados.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const fileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      
      // 1. Upload para o Storage
      const { error: uploadError } = await supabase.storage
        .from('checklist_upload')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Salvar na Tabela Checklist
      const { error: dbError } = await supabase
        .from('checklist')
        .insert({
          unidade_id: Number(selectedUnidade),
          setor_id: Number(selectedSetor),
          titulo: checklistTitle,
          pdf_url: fileName
        });

      if (dbError) throw dbError;

      toast({
        title: "Sucesso!",
        description: "Checklist importado e salvo com sucesso.",
      });
      setShowImportDialog(false);
      setSelectedFile(null);
      setChecklistTitle("");
      fetchChecklists(); // Atualizar a lista
    } catch (error: any) {
      console.error("Erro ao salvar checklist:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar os dados no banco.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChecklist = async (id: number, pdfPath: string) => {
    if (!confirm("Tem certeza que deseja excluir este checklist permanentemente?")) return;

    try {
      // 1. Deletar do Banco
      const { error: dbError } = await supabase
        .from('checklist')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      // 2. Deletar do Storage (opcional)
      if (pdfPath && !pdfPath.startsWith('http')) {
        await supabase.storage
          .from('checklist_upload')
          .remove([pdfPath]);
      }

      toast({
        title: "Sucesso",
        description: "Checklist excluído com sucesso.",
      });
      fetchChecklists();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    }
  };

  const handleDownload = async (path: string, fileName: string) => {
    try {
      const url = getStorageUrl(path);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
      toast({
        variant: "destructive",
        title: "Erro no download",
        description: "Não foi possível baixar o arquivo diretamente.",
      });
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const getSubtitle = () => {
    switch (role) {
      case "pmo": return "Validar e gerenciar checklists de todos os setores";
      case "coordinator": return `Gerencie o checklist do setor ${userSector}`;
      case "collaborator": return "Visualize e complete suas atividades";
    }
  };

  // Filter checklists based on role
  const filteredChecklists = mockChecklists.filter(checklist => {
    if (role === "pmo") return true;
    if (role === "coordinator") return checklist.sector === userSector || checklist.sector === "Cardiologia";
    return checklist.assignee === "João Silva"; // Collaborator sees only their tasks
  });

  const sectors = Array.from(new Set(filteredChecklists.map(c => c.sector)));
  const agreementSectors = Array.from(new Set(mockAgreements.map(a => a.sector)));

  const filteredDbChecklists = dbChecklists.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.titulo.toLowerCase().includes(searchLower) ||
      (item.setor?.nome || "").toLowerCase().includes(searchLower) ||
      (item.unidade?.nome || "").toLowerCase().includes(searchLower)
    );
  });

  const groupedBySector = sectors.reduce((acc, sector) => {
    acc[sector] = filteredChecklists.filter(c => c.sector === sector);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const agreementsBySector = agreementSectors.reduce((acc, sector) => {
    acc[sector] = mockAgreements.filter(a => a.sector === sector);
    return acc;
  }, {} as Record<string, Agreement[]>);

  return (
    <AppLayout title="Checklists" subtitle={getSubtitle()}>
      <div className="p-6 space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <div className="flex flex-1 gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou setor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </div>

          <div className="flex gap-2">
            {rolePermissions.canImportChecklists && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="application/pdf"
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={triggerFileInput}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Importar PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {/* PDF Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Importar Checklist
              </DialogTitle>
              <DialogDescription>
                Confirme as informações abaixo para finalizar a importação do documento.
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              {isImporting ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Processando documento...</p>
                </div>
              ) : pdfData.length > 0 ? (
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Unidade</Label>
                      <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {unidades.map((u) => (
                            <SelectItem key={u.id} value={u.id.toString()}>
                              {u.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Setor</Label>
                      <Select value={selectedSetor} onValueChange={setSelectedSetor}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o setor" />
                        </SelectTrigger>
                        <SelectContent>
                          {setores.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2 mb-2">
                    <Label className="text-sm font-semibold">Título do Documento</Label>
                    <Input 
                      value={checklistTitle}
                      onChange={(e) => setChecklistTitle(e.target.value)}
                      placeholder="Identificação do checklist..."
                    />
                  </div>
                  
                  {pdfData[0]?.includes('Erro') && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive font-medium">{pdfData[0]}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={isSaving}>
                      Fechar
                    </Button>
                    {!pdfData[0]?.includes('Erro') && (
                      <Button 
                        className="bg-green-600 hover:bg-green-700 gap-2"
                        onClick={handleConfirmImport}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Confirmar Importação
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center p-12 text-muted-foreground">
                  Nenhum dado pôde ser extraído.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* PMO Validation Section */}
        {/*  {role === "pmo" && (
          <Card className="p-6 border-gold/30 bg-gold/5">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gold">
              <CheckCircle2 className="w-5 h-5" />
              Atividades Pendentes de Validação
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Marque as atividades como "Atividade do Processo" para que sejam elegíveis para pontuação (+10 pts cada).
            </p>
            <div className="space-y-3">
              {mockChecklists.filter(c => !c.isPmoValidated).map(checklist => (
                <div key={checklist.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">{checklist.title}</span>
                      <Badge variant="outline">{checklist.sector}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{checklist.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Validar
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )} */}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {/* {(role === "pmo" || role === "coordinator") && (
              <TabsTrigger value="sectors">Por Setor</TabsTrigger>
            )} */}
            <TabsTrigger value="all">Todos ({filteredChecklists.length})</TabsTrigger>
            <TabsTrigger value="agreements">Convênios</TabsTrigger>
            {/* <TabsTrigger value="pending">
              Pendentes ({filteredChecklists.filter(c => c.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="in-progress">
              Em Andamento ({filteredChecklists.filter(c => c.status === "in-progress").length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Concluídos ({filteredChecklists.filter(c => c.status === "completed").length})
            </TabsTrigger> */}
          </TabsList>

          <TabsContent value="all" className="mt-6 space-y-6">
            {/* Seção de Checklists do Banco (Accordion) */}
            {filteredDbChecklists.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                  <FileText className="w-5 h-5" />
                  Checklists Importados ({filteredDbChecklists.length})
                </h3>
                <div className="w-full space-y-3">
                  {filteredDbChecklists.map((item) => (
                    <Card key={item.id} className="p-4 bg-card border hover:border-primary/30 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold px-2 py-0 h-6">
                          {item.setor?.nome || "Setor Geral"}
                        </Badge>
                        <Badge variant="outline" className="text-muted-foreground border-border/50 px-2 py-0 h-6">
                          {item.unidade?.nome || "Unidade Central"}
                        </Badge>
                        <span className="font-semibold text-foreground min-w-[200px]">
                          {item.titulo}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground mr-2">
                          {new Date(item.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        
                        <Button size="sm" variant="default" asChild className="gap-2 bg-primary hover:bg-primary/90 shadow-sm h-8">
                          <a 
                            href={getStorageUrl(item.pdf_url)} 
                            target="_blank" 
                            rel="noreferrer"
                          >
                            <Eye className="w-4 h-4" />
                            Ver PDF
                          </a>
                        </Button>

                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="gap-2 h-8"
                          onClick={() => handleDownload(item.pdf_url, item.titulo)}
                        >
                          <Download className="w-4 h-4" />
                          Exportar
                        </Button>

                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleDeleteChecklist(item.id, item.pdf_url)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
                <div className="h-px bg-border my-6" />
              </div>
            )}

            {/* Atividades Mockadas */}
            {/* <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-muted-foreground">
                <Plus className="w-5 h-5" />
                Atividades do Sistema
              </h3>
              {filteredChecklists.map((checklist) => (
                <ChecklistCard key={checklist.id} checklist={checklist} role={role} />
              ))}
            </div> */}
          </TabsContent>

          <TabsContent value="agreements" className="mt-6 space-y-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Handshake className="w-5 h-5 text-primary" />
                Gestão de Convênios por Setor
              </h3>
              {(role === "pmo" || role === "coordinator") && (
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Convênio
                </Button>
              )}
            </div>

            {agreementSectors.map(sector => (
              <div key={sector} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-secondary/10">
                    <Building2 className="w-4 h-4 text-secondary" />
                  </div>
                  <h4 className="font-semibold text-lg">{sector}</h4>
                  <div className="h-px flex-1 bg-border/50" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agreementsBySector[sector].map(agreement => (
                    <Card key={agreement.id} className="p-4 hover:border-primary/30 transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {agreement.name}
                        </span>
                        <Badge variant={agreement.status === "active" ? "default" : "secondary"} className={
                          agreement.status === "active" ? "bg-success/20 text-success border-success/30 hover:bg-success/20" : ""
                        }>
                          {agreement.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
                        <Clock className="w-3 h-3" />
                        Última auditoria: {agreement.lastAudit ? new Date(agreement.lastAudit).toLocaleDateString('pt-BR') : "N/A"}
                      </div>
                    </Card>
                  ))}
                  {(role === "pmo" || role === "coordinator") && (
                    <button className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all bg-muted/5">
                      <Plus className="w-5 h-5" />
                      <span className="text-sm">Vincular Convênio</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="sectors" className="mt-6 space-y-8">
            {sectors.map(sector => (
              <div key={sector} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold">
                    {sector}
                  </Badge>
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-sm text-muted-foreground">{groupedBySector[sector].length} atividades</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {groupedBySector[sector].map(checklist => (
                    <ChecklistCard key={checklist.id} checklist={checklist} role={role} />
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="pending" className="mt-6 space-y-4">
            {filteredChecklists.filter(c => c.status === "pending").map((checklist) => (
              <ChecklistCard key={checklist.id} checklist={checklist} role={role} />
            ))}
          </TabsContent>

          <TabsContent value="in-progress" className="mt-6 space-y-4">
            {filteredChecklists.filter(c => c.status === "in-progress").map((checklist) => (
              <ChecklistCard key={checklist.id} checklist={checklist} role={role} />
            ))}
          </TabsContent>

          <TabsContent value="completed" className="mt-6 space-y-4">
            {filteredChecklists.filter(c => c.status === "completed").map((checklist) => (
              <ChecklistCard key={checklist.id} checklist={checklist} role={role} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ChecklistCard({ checklist, role }: { checklist: ChecklistItem; role: string }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-warning" />;
      case "overdue":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "bg-success/10 text-success border-success/30",
      "in-progress": "bg-warning/10 text-warning border-warning/30",
      overdue: "bg-destructive/10 text-destructive border-destructive/30",
      pending: "bg-muted text-muted-foreground border-border"
    };
    const labels = {
      completed: "Concluído",
      "in-progress": "Em Andamento",
      overdue: "Atrasado",
      pending: "Pendente"
    };
    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      high: "bg-destructive/10 text-destructive border-destructive/30",
      medium: "bg-warning/10 text-warning border-warning/30",
      low: "bg-muted text-muted-foreground border-border"
    };
    const labels = {
      high: "Alta",
      medium: "Média",
      low: "Baixa"
    };
    return (
      <Badge variant="outline" className={variants[priority as keyof typeof variants]}>
        {labels[priority as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <Card className="p-6 hover:border-primary/50 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          {role === "collaborator" && checklist.status === "pending" ? (
            <button className="mt-1 w-6 h-6 rounded-full border-2 border-muted-foreground hover:border-primary hover:bg-primary/10 transition-all" />
          ) : (
            getStatusIcon(checklist.status)
          )}
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {checklist.title}
                </h3>
                {checklist.isProcessActivity && (
                  <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">
                    Atividade do Processo
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {checklist.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {getStatusBadge(checklist.status)}
              {getPriorityBadge(checklist.priority)}
              {role === "pmo" && <Badge variant="outline">{checklist.sector}</Badge>}
              <span className="text-sm text-muted-foreground">
                Responsável: {checklist.assignee}
              </span>
              <span className="text-sm text-muted-foreground">
                Prazo: {new Date(checklist.dueDate).toLocaleDateString('pt-BR')}
              </span>
              {checklist.isProcessActivity && (
                <Badge className="bg-success/10 text-success border-success/30">
                  +{checklist.points} pts
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {role === "collaborator" && checklist.status === "pending" && (
            <Button size="sm" className="bg-success hover:bg-success/90">
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Validar
            </Button>
          )}
          {role === "coordinator" && (
            <>
              <Button variant="ghost" size="icon">
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
          {role === "pmo" && (
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
