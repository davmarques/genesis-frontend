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
      return data?.publicUrl || "#";
    } catch (e) {
      console.error("Erro ao gerar URL do storage:", e);
      return "#";
    }
  };

  const fetchChecklists = async () => {
    try {
      let query = supabase
        .from('checklist')
        .select(`
          *,
          unidade:unidade_id(nome),
          setor:setor_id(nome)
        `)
        .order('created_at', { ascending: false });

      if (role !== 'pmo') {
        const userStr = localStorage.getItem("genesis_user");
        const user = userStr ? JSON.parse(userStr) : null;
        if (user?.setor_id) {
          query = query.eq('setor_id', user.setor_id);
        } else if (user?.unidade_id) {
          query = query.eq('unidade_id', user.unidade_id);
        }
      }

      const { data, error } = await query;
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
  }, [role, userSector]);

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

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");
        extractedText.push(pageText || `[Página ${i}: Nenhum texto legível]`);
      }
      setPdfData(extractedText);
    } catch (error: any) {
      setPdfData([`Erro ao ler PDF: ${error.message}`]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !checklistTitle || !selectedUnidade || !selectedSetor) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos e selecione o arquivo.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const fileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('checklist_upload')
        .upload(fileName, selectedFile);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('checklist')
        .insert({
          unidade_id: Number(selectedUnidade),
          setor_id: Number(selectedSetor),
          titulo: checklistTitle,
          pdf_url: fileName
        });
      if (dbError) throw dbError;

      toast({ title: "Sucesso!", description: "Checklist importado." });
      setShowImportDialog(false);
      fetchChecklists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChecklist = async (id: number, pdfPath: string) => {
    if (!confirm("Deseja excluir este checklist?")) return;
    try {
      const { error } = await supabase.from('checklist').delete().eq('id', id);
      if (error) throw error;
      if (pdfPath && !pdfPath.startsWith('http')) {
        await supabase.storage.from('checklist_upload').remove([pdfPath]);
      }
      toast({ title: "Sucesso", description: "Checklist excluído." });
      fetchChecklists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
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
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Falha no download." });
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const getSubtitle = () => {
    switch (role) {
      case "pmo": return "Gerenciar checklists de todos os setores";
      case "manager": return `Gerencie o checklist do setor ${userSector}`;
      default: return "Visualize suas atividades";
    }
  };

  const filteredDbChecklists = dbChecklists.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.titulo.toLowerCase().includes(searchLower) ||
      (item.setor?.nome || "").toLowerCase().includes(searchLower)
    );
  });

  return (
    <AppLayout title="Checklists" subtitle={getSubtitle()}>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou setor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {rolePermissions.canImportChecklists && (
            <>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="application/pdf" className="hidden" />
              <Button variant="outline" className="gap-2" onClick={triggerFileInput} disabled={isImporting}>
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importar PDF
              </Button>
            </>
          )}
        </div>

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importar Checklist</DialogTitle>
              <DialogDescription>Confirme as informações do documento.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select value={selectedSetor} onValueChange={setSelectedSetor}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {setores.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={checklistTitle} onChange={e => setChecklistTitle(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancelar</Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirmImport} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">Todos ({filteredDbChecklists.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="pt-4 space-y-4">
            {filteredDbChecklists.length > 0 ? (
              filteredDbChecklists.map((item) => (
                <Card key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-primary/5 text-primary">{item.setor?.nome || "Setor"}</Badge>
                    <span className="font-semibold">{item.titulo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={getStorageUrl(item.pdf_url)} target="_blank" rel="noreferrer"><Eye className="w-4 h-4 mr-1" /> Ver</a>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDownload(item.pdf_url, item.titulo)}><Download className="w-4 h-4 mr-1" /> Exportar</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteChecklist(item.id, item.pdf_url)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                Nenhum checklist disponível.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ChecklistCard({ checklist, role }: { checklist: any; role: string }) { return null; }
